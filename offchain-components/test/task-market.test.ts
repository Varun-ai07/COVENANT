import { describe, it, expect, beforeEach } from "vitest";
import { OpenTaskMarket } from "../src/services/task-market.service.js";

describe("OpenTaskMarket", () => {
  let market: OpenTaskMarket;
  const client = "0x1111111111111111111111111111111111111111" as `0x${string}`;
  const worker1 = "0x2222222222222222222222222222222222222222" as `0x${string}`;
  const worker2 = "0x3333333333333333333333333333333333333333" as `0x${string}`;

  beforeEach(() => {
    market = new OpenTaskMarket({
      identityAddress: "0x0000000000000000000000000000000000000001",
      identityAbi: [],
      publicClient: {
        readContract: async () => true,
      } as any,
    });
  });

  describe("Task Posting", () => {
    it("should post a task", async () => {
      const task = await market.postTask(
        client,
        "Build API",
        "REST API for agent",
        "development",
        10000000000000000n,
        Date.now() + 86400000,
        ["node", "typescript"],
        { difficulty: "medium", estimatedHours: 20, tags: ["api"], attachments: [], maxBids: 5 }
      );
      expect(task.title).toBe("Build API");
      expect(task.status).toBe("open");
      expect(task.client).toBe(client);
    });

    it("should reject invalid category", async () => {
      await expect(
        market.postTask(client, "X", "Y", "invalid", 1000n, Date.now() + 86400000, [], {
          difficulty: "easy", estimatedHours: 1, tags: [], attachments: [], maxBids: 0,
        })
      ).rejects.toThrow("Invalid category");
    });
  });

  describe("Bidding", () => {
    let taskId: string;

    beforeEach(async () => {
      const task = await market.postTask(
        client, "Task", "Desc", "development", 10000000000000000n,
        Date.now() + 86400000, [], { difficulty: "easy", estimatedHours: 10, tags: [], attachments: [], maxBids: 5 }
      );
      taskId = task.id;
    });

    it("should submit a bid", () => {
      const bid = market.submitBid(taskId, worker1, 8000000000000000n, "I can do it", 7 * 86400);
      expect(bid.worker).toBe(worker1);
      expect(bid.status).toBe("pending");
    });

    it("should reject bid exceeding budget", () => {
      expect(() =>
        market.submitBid(taskId, worker1, 20000000000000000n, "Expensive", 7 * 86400)
      ).toThrow("Bid exceeds budget");
    });

    it("should reject duplicate bid", () => {
      market.submitBid(taskId, worker1, 5000000000000000n, "Bid 1", 7 * 86400);
      expect(() =>
        market.submitBid(taskId, worker1, 5000000000000000n, "Bid 2", 7 * 86400)
      ).toThrow("Already bid on this task");
    });

    it("should accept a bid", async () => {
      const bid = market.submitBid(taskId, worker1, 8000000000000000n, "I can", 7 * 86400);
      market.acceptBid(taskId, bid.id, client);

      const task = market.getListing(taskId)!;
      expect(task.selectedWorker).toBe(worker1);
      expect(task.status).toBe("in-progress");
    });

    it("should reject other bids when one is accepted", async () => {
      const bid1 = market.submitBid(taskId, worker1, 8000000000000000n, "Bid 1", 7 * 86400);
      market.submitBid(taskId, worker2, 7000000000000000n, "Bid 2", 7 * 86400);

      market.acceptBid(taskId, bid1.id, client);

      const bids = market.getBids(taskId);
      expect(bids.find(b => b.worker === worker1)?.status).toBe("accepted");
      expect(bids.find(b => b.worker === worker2)?.status).toBe("rejected");
    });

    it("should reject bid acceptance from wrong client", async () => {
      const bid = market.submitBid(taskId, worker1, 8000000000000000n, "I can", 7 * 86400);
      expect(() =>
        market.acceptBid(taskId, bid.id, worker2)
      ).toThrow("Not the client");
    });

    it("should allow bid withdrawal", () => {
      const bid = market.submitBid(taskId, worker1, 8000000000000000n, "I can", 7 * 86400);
      market.withdrawBid(taskId, bid.id, worker1);
      const bids = market.getBids(taskId);
      expect(bids[0].status).toBe("withdrawn");
    });
  });

  describe("Task Lifecycle", () => {
    let taskId: string;

    beforeEach(async () => {
      const task = await market.postTask(
        client, "Task", "Desc", "development", 10000000000000000n,
        Date.now() + 86400000, [], { difficulty: "easy", estimatedHours: 10, tags: [], attachments: [], maxBids: 0 }
      );
      taskId = task.id;
    });

    it("should complete a task", async () => {
      const bid = market.submitBid(taskId, worker1, 8000000000000000n, "I can", 7 * 86400);
      market.acceptBid(taskId, bid.id, client);
      market.completeTask(taskId);

      const task = market.getListing(taskId)!;
      expect(task.status).toBe("completed");
    });

    it("should cancel a task", () => {
      market.cancelTask(taskId, client);
      const task = market.getListing(taskId)!;
      expect(task.status).toBe("cancelled");
    });

    it("should reject cancel from wrong client", () => {
      expect(() => market.cancelTask(taskId, worker1)).toThrow("Not the client");
    });
  });

  describe("Search", () => {
    beforeEach(async () => {
      await market.postTask(client, "Build API", "REST API", "development", 10000000000000000n,
        Date.now() + 86400000, [], { difficulty: "medium", estimatedHours: 20, tags: [], attachments: [], maxBids: 0 });
      await market.postTask(client, "Write Blog", "Technical blog", "content-creation", 5000000000000000n,
        Date.now() + 86400000, [], { difficulty: "easy", estimatedHours: 5, tags: [], attachments: [], maxBids: 0 });
      await market.postTask(client, "Data Analysis", "ML pipeline", "data-analysis", 20000000000000000n,
        Date.now() + 86400000, [], { difficulty: "hard", estimatedHours: 40, tags: [], attachments: [], maxBids: 0 });
    });

    it("should search by category", () => {
      const results = market.searchTasks("", "development");
      expect(results.length).toBe(1);
      expect(results[0].title).toBe("Build API");
    });

    it("should search by query", () => {
      const results = market.searchTasks("blog");
      expect(results.length).toBe(1);
      expect(results[0].title).toBe("Write Blog");
    });

    it("should search by budget range", () => {
      const results = market.searchTasks("", undefined, 10000000000000000n);
      expect(results.length).toBe(2);
    });

    it("should return open tasks only", () => {
      const open = market.getOpenTasks();
      expect(open.length).toBe(3);
    });
  });

  describe("Market Stats", () => {
    it("should return correct stats", async () => {
      const task = await market.postTask(client, "Task", "Desc", "development", 10000000000000000n,
        Date.now() + 86400000, [], { difficulty: "easy", estimatedHours: 10, tags: [], attachments: [], maxBids: 0 });

      market.submitBid(task.id, worker1, 8000000000000000n, "I can", 7 * 86400);
      market.submitBid(task.id, worker2, 7000000000000000n, "Me too", 7 * 86400);

      const stats = market.getMarketStats();
      expect(stats.totalTasks).toBe(1);
      expect(stats.openTasks).toBe(1);
      expect(stats.totalBids).toBe(2);
      expect(stats.averageBidsPerTask).toBe(2);
    });
  });
});
