import { test, expect } from '@playwright/test';

test('realtime channel subscription reuse and visibility change behavior', async ({ page }) => {
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  const joins: { topic: string; event: string }[] = [];
  const leaves: { topic: string; event: string }[] = [];

  // Listen to WebSocket events
  page.on('websocket', (ws) => {
    ws.on('framesent', (frame) => {
      const payloadStr = typeof frame.payload === 'string'
        ? frame.payload
        : frame.payload.toString('utf8');

      try {
        const data = JSON.parse(payloadStr);
        let topic = '';
        let event = '';

        if (Array.isArray(data)) {
          // Phoenix protocol: [join_ref, ref, topic, event, payload]
          topic = data[2] || '';
          event = data[3] || '';
        } else if (data && typeof data === 'object') {
          topic = data.topic || '';
          event = data.event || '';
        }

        if (event === 'phx_join') {
          joins.push({ topic, event });
        } else if (event === 'phx_leave') {
          leaves.push({ topic, event });
        }
      } catch {
        // Not a JSON frame, ignore
      }
    });
  });

  // Navigate to /test-realtime
  await page.goto('/test-realtime');

    // 2. Wait for test subscribers to mount
    await expect(page.locator('[data-testid="subscriber-items-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="subscriber-items-2"]')).toBeVisible();
    await expect(page.locator('[data-testid="subscriber-people"]')).toBeVisible();

  // Wait a short time for the subscriptions to establish
  await page.waitForTimeout(5000);

  // Extract joins for items and people
  const itemsJoins = joins.filter((j) => j.topic.includes('items'));
  const peopleJoins = joins.filter((j) => j.topic.includes('people'));

  console.log('Initial Joins:', joins);

  // Assert exactly one join for items and exactly one for people
  expect(itemsJoins).toHaveLength(1);
  expect(peopleJoins).toHaveLength(1);

  // Mock page visibility change to 'hidden'
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });

  // Wait to ensure no messages are sent
  await page.waitForTimeout(1000);

  // Assert no phx_leave was sent
  const itemsLeaves = leaves.filter((l) => l.topic.includes('items'));
  const peopleLeaves = leaves.filter((l) => l.topic.includes('people'));

  expect(itemsLeaves).toHaveLength(0);
  expect(peopleLeaves).toHaveLength(0);

  // Mock page visibility change back to 'visible'
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });

  // Wait a short time
  await page.waitForTimeout(1000);

  // Assert returning to 'visible' did not trigger any new joins
  const itemsJoinsAfter = joins.filter((j) => j.topic.includes('items'));
  const peopleJoinsAfter = joins.filter((j) => j.topic.includes('people'));

  expect(itemsJoinsAfter).toHaveLength(1);
  expect(peopleJoinsAfter).toHaveLength(1);
});
