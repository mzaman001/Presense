import React from "react";
import { render, act, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RealtimeProvider, useRealtimeContext } from "../RealtimeProvider";
import { useRealtimeConnectionStatus } from "../realtime-status";

// Mock Supabase Client Infrastructure
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let postgresChangesCallbacks: { [table: string]: (payload: any) => void } = {};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockChannels: { [table: string]: any } = {};
let statusCallbacks: { [table: string]: (status: string) => void } = {};

const mockSupabase = {
  channel: vi.fn().mockImplementation((name: string) => {
    const table = name.replace("realtime_", "");
    const channel = {
      on: vi.fn().mockImplementation((event, filter, callback) => {
        postgresChangesCallbacks[table] = callback;
        return channel;
      }),
      subscribe: vi.fn().mockImplementation((statusCallback) => {
        statusCallbacks[table] = statusCallback;
        if (statusCallback) {
          statusCallback("SUBSCRIBED");
        }
        return channel;
      }),
    };
    mockChannels[table] = channel;
    return channel;
  }),
  removeChannel: vi.fn().mockImplementation((channel) => {
    // Find and delete from mockChannels
    for (const table in mockChannels) {
      if (mockChannels[table] === channel) {
        // realtime-js reports an intentional removal through the same
        // subscribe callback as a dropped socket.
        statusCallbacks[table]?.("CLOSED");
        delete mockChannels[table];
        delete postgresChangesCallbacks[table];
      }
    }
  }),
};

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(() => mockSupabase),
}));

function StatusProbe() {
  return <div data-testid="status">{useRealtimeConnectionStatus()}</div>;
}
const status = () => screen.getByTestId("status").textContent;

// Test consumer component
function TestConsumer({
  tableName,
  onUpdate,
  onSubscribeReady,
}: {
  tableName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onUpdate: (payload: any) => void;
  onSubscribeReady?: (unsubscribe: () => void) => void;
}) {
  const { subscribe } = useRealtimeContext();

  React.useEffect(() => {
    const unsubscribe = subscribe(tableName, onUpdate);
    if (onSubscribeReady) {
      onSubscribeReady(unsubscribe);
    }
    return () => {
      unsubscribe();
    };
  }, [subscribe, tableName, onUpdate, onSubscribeReady]);

  return <div data-testid="consumer">Consumer for {tableName}</div>;
}

describe("RealtimeProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    postgresChangesCallbacks = {};
    statusCallbacks = {};
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should provide subscribe function and register channel on first subscriber", () => {
    const onUpdate = vi.fn();

    render(
      <RealtimeProvider>
        <TestConsumer tableName="todos" onUpdate={onUpdate} />
      </RealtimeProvider>,
    );

    // Verify channel creation
    expect(mockSupabase.channel).toHaveBeenCalledWith("realtime_todos");
    expect(mockChannels["todos"]).toBeDefined();
    expect(postgresChangesCallbacks["todos"]).toBeDefined();
  });

  it("should reuse the channel for subsequent subscribers and call all callbacks", () => {
    const onUpdate1 = vi.fn();
    const onUpdate2 = vi.fn();

    render(
      <RealtimeProvider>
        <TestConsumer tableName="todos" onUpdate={onUpdate1} />
        <TestConsumer tableName="todos" onUpdate={onUpdate2} />
      </RealtimeProvider>,
    );

    // Should only create channel once
    expect(mockSupabase.channel).toHaveBeenCalledTimes(1);

    // Trigger update
    const dummyPayload = { new: { id: 1, title: "Test Todo" } };
    act(() => {
      postgresChangesCallbacks["todos"](dummyPayload);
    });

    // Both should receive the update
    expect(onUpdate1).toHaveBeenCalledWith(dummyPayload);
    expect(onUpdate2).toHaveBeenCalledWith(dummyPayload);
  });

  it("should decrement refCount on unsubscribe, but only remove channel when refCount reaches 0", () => {
    let unsubscribe1: (() => void) | undefined;
    let unsubscribe2: (() => void) | undefined;

    const onUpdate1 = vi.fn();
    const onUpdate2 = vi.fn();

    render(
      <RealtimeProvider>
        <TestConsumer
          tableName="todos"
          onUpdate={onUpdate1}
          onSubscribeReady={(unsub) => {
            unsubscribe1 = unsub;
          }}
        />
        <TestConsumer
          tableName="todos"
          onUpdate={onUpdate2}
          onSubscribeReady={(unsub) => {
            unsubscribe2 = unsub;
          }}
        />
      </RealtimeProvider>,
    );

    expect(mockSupabase.channel).toHaveBeenCalledTimes(1);
    expect(mockSupabase.removeChannel).not.toHaveBeenCalled();

    // Unsubscribe first listener
    act(() => {
      if (unsubscribe1) unsubscribe1();
    });

    // Channel should NOT be removed yet since listener 2 is still active
    expect(mockSupabase.removeChannel).not.toHaveBeenCalled();

    // Unsubscribe second listener
    act(() => {
      if (unsubscribe2) unsubscribe2();
    });

    // Channel should NOT be removed immediately (5-second grace period)
    expect(mockSupabase.removeChannel).not.toHaveBeenCalled();

    // Advance timer by 5 seconds to trigger the debounced teardown
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Now channel should be removed since refCount reached 0
    expect(mockSupabase.removeChannel).toHaveBeenCalledTimes(1);
  });

  it("stays connected after a channel is torn down on purpose", () => {
    const { rerender } = render(
      <RealtimeProvider>
        <StatusProbe />
        <TestConsumer tableName="todos" onUpdate={vi.fn()} />
        <TestConsumer tableName="threads" onUpdate={vi.fn()} />
      </RealtimeProvider>,
    );
    expect(status()).toBe("connected");

    // Navigate away from the page that used "threads".
    rerender(
      <RealtimeProvider>
        <StatusProbe />
        <TestConsumer tableName="todos" onUpdate={vi.fn()} />
      </RealtimeProvider>,
    );
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(mockSupabase.removeChannel).toHaveBeenCalledTimes(1);
    expect(status()).toBe("connected");
  });

  it("does not let one healthy channel mask another that is down", () => {
    render(
      <RealtimeProvider>
        <StatusProbe />
        <TestConsumer tableName="todos" onUpdate={vi.fn()} />
        <TestConsumer tableName="threads" onUpdate={vi.fn()} />
      </RealtimeProvider>,
    );

    act(() => statusCallbacks["todos"]("CHANNEL_ERROR"));
    act(() => statusCallbacks["threads"]("SUBSCRIBED"));
    expect(status()).toBe("disconnected");

    act(() => statusCallbacks["todos"]("SUBSCRIBED"));
    expect(status()).toBe("connected");
  });

  it("should throw error if useRealtimeContext is used outside provider", () => {
    const ConsoleError = console.error;
    console.error = vi.fn(); // Suppress react error boundary warnings in test output

    expect(() => {
      render(<TestConsumer tableName="todos" onUpdate={vi.fn()} />);
    }).toThrow("useRealtimeContext must be used within a RealtimeProvider");

    console.error = ConsoleError;
  });
});
