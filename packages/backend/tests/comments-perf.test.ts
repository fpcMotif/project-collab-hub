import { setTimeout } from "node:timers/promises";

import { describe, expect, it } from "vitest";

// Mock the insert operation
const dbInsert = async (_table: string, _data: unknown) => {
  // Simulate 5ms database latency
  await setTimeout(5);
  return `id_${Math.random()}`;
};

// Sequential implementation (the current state)
const insertSequentially = async (userIds: string[]) => {
  for (const userId of userIds) {
    const notificationDeliveryId = await dbInsert("notificationDeliveries", {
      userId,
    });
    await dbInsert("mentions", { notificationDeliveryId, userId });
  }
};

// Concurrent implementation (the proposed state)
const insertConcurrently = async (userIds: string[]) => {
  await Promise.all(
    userIds.map(async (userId) => {
      const notificationDeliveryId = await dbInsert("notificationDeliveries", {
        userId,
      });
      await dbInsert("mentions", { notificationDeliveryId, userId });
    })
  );
};

describe("Performance Optimization: N+1 Query in comments.ts", () => {
  it("should measure the performance of sequential vs concurrent inserts", async () => {
    // Generate 50 user IDs to simulate a large number of mentions
    const userIds = Array.from({ length: 50 }, (_, i) => `user_${i}`);

    const startSequential = performance.now();
    await insertSequentially(userIds);
    const endSequential = performance.now();
    const sequentialTime = endSequential - startSequential;

    const startConcurrent = performance.now();
    await insertConcurrently(userIds);
    const endConcurrent = performance.now();
    const concurrentTime = endConcurrent - startConcurrent;

    console.log(`Sequential time: ${sequentialTime.toFixed(2)}ms`);
    console.log(`Concurrent time: ${concurrentTime.toFixed(2)}ms`);

    // Concurrent should be significantly faster (at least 2x faster)
    expect(concurrentTime).toBeLessThan(sequentialTime / 2);
  });
});
