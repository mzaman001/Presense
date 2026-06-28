import React, { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom";
import { extractMentions } from "@/lib/utils";
import { MentionsInput } from "@/components/ui/MentionsInput";

describe("Mentions Parsing & UI Logic", () => {
  describe("extractMentions utility", () => {
    it("should return empty array for text with no mentions", () => {
      const text = "Hello world, this is a message without mentions.";
      expect(extractMentions(text)).toEqual([]);
    });

    it("should extract a single mention UUID correctly", () => {
      const text = "Please call @[John Doe](123e4567-e89b-12d3-a456-426614174000) tomorrow.";
      expect(extractMentions(text)).toEqual(["123e4567-e89b-12d3-a456-426614174000"]);
    });

    it("should extract multiple mention UUIDs correctly", () => {
      const text = "Meeting with @[Alice](11111111-2222-3333-4444-555555555555) and @[Bob](66666666-7777-8888-9999-000000000000) today.";
      expect(extractMentions(text)).toEqual(["11111111-2222-3333-4444-555555555555", "66666666-7777-8888-9999-000000000000"]);
    });

    it("should handle custom name formats or spaces inside brackets/parentheses", () => {
      const text = "Assigned to @[Sarah Jenkins-Smith](aaaabbbb-cccc-dddd-eeee-ffff00001111) and @[Dr. Watson](22223333-4444-5555-6666-777788889999).";
      expect(extractMentions(text)).toEqual(["aaaabbbb-cccc-dddd-eeee-ffff00001111", "22223333-4444-5555-6666-777788889999"]);
    });

    it("should filter out non-UUID mention IDs", () => {
      const text = "Meeting with @[Alice](uuid-alice) and @[Bob](123e4567-e89b-12d3-a456-426614174000) and custom @[Custom](invalid-id).";
      expect(extractMentions(text)).toEqual(["123e4567-e89b-12d3-a456-426614174000"]);
    });
  });

  describe("Mentions UI Popover Trigger", () => {
    const mockPeople = [
      { id: "11111111-1111-1111-1111-111111111111", name: "Alice Smith" },
      { id: "22222222-2222-2222-2222-222222222222", name: "Bob Jones" },
      { id: "33333333-3333-3333-3333-333333333333", name: "Charlie Brown" },
    ];

    const TestComponent = () => {
      const [value, setValue] = useState("");
      return (
        <MentionsInput
          value={value}
          onChange={setValue}
          people={mockPeople}
        />
      );
    };

    it("does not render popover initially", () => {
      render(<TestComponent />);
      const popover = screen.queryByTestId("mentions-popover");
      expect(popover).not.toBeInTheDocument();
    });

    it("renders popover list of people when typing '@'", async () => {
      render(<TestComponent />);
      const input = screen.getByTestId("mentions-input");

      fireEvent.change(input, { target: { value: "@" } });

      const popover = screen.getByTestId("mentions-popover");
      expect(popover).toBeInTheDocument();
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      expect(screen.getByText("Bob Jones")).toBeInTheDocument();
      expect(screen.getByText("Charlie Brown")).toBeInTheDocument();
    });

    it("filters popover list when typing search characters after '@'", () => {
      render(<TestComponent />);
      const input = screen.getByTestId("mentions-input");

      fireEvent.change(input, { target: { value: "@al" } });

      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      expect(screen.queryByText("Bob Jones")).not.toBeInTheDocument();
      expect(screen.queryByText("Charlie Brown")).not.toBeInTheDocument();
    });

    it("selects a person from the popover list and inserts their mention in @[Name](uuid) format", async () => {
      render(<TestComponent />);
      const input = screen.getByTestId("mentions-input") as HTMLInputElement;

      fireEvent.change(input, { target: { value: "@" } });

      const aliceBtn = screen.getByText("Alice Smith");
      fireEvent.click(aliceBtn);

      expect(screen.queryByTestId("mentions-popover")).not.toBeInTheDocument();
      expect(input.value).toBe("@[Alice Smith](11111111-1111-1111-1111-111111111111) ");
    });
  });
});
