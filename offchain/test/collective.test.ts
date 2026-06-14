import { describe, it, expect, beforeEach } from "vitest";
import { CollectiveService } from "../src/services/collective.service.js";

describe("CollectiveService", () => {
  let service: CollectiveService;
  const creator = "0x1111111111111111111111111111111111111111" as `0x${string}`;
  const member1 = "0x2222222222222222222222222222222222222222" as `0x${string}`;
  const member2 = "0x3333333333333333333333333333333333333333" as `0x${string}`;
  const outsider = "0x4444444444444444444444444444444444444444" as `0x${string}`;

  beforeEach(() => {
    service = new CollectiveService({
      identityAddress: "0x0000000000000000000000000000000000000001",
      identityAbi: [],
      publicClient: {
        readContract: async () => true,
      } as any,
    });
  });

  describe("Collective Creation", () => {
    it("should create a collective", async () => {
      const c = await service.createCollective(creator, "Test DAO", "A test", {
        purpose: "Testing",
        minStake: "0.001",
        maxMembers: 10,
        profitSplit: {},
        tags: ["test"],
      });
      expect(c.name).toBe("Test DAO");
      expect(c.members).toContain(creator);
      expect(c.active).toBe(true);
    });

    it("should get collective by id", async () => {
      const c = await service.createCollective(creator, "Test", "Desc", {
        purpose: "", minStake: "0", maxMembers: 10, profitSplit: {}, tags: [],
      });
      expect(service.getCollective(c.id)).toBeDefined();
    });
  });

  describe("Membership", () => {
    let collectiveId: string;

    beforeEach(async () => {
      const c = await service.createCollective(creator, "Test", "Desc", {
        purpose: "", minStake: "0", maxMembers: 3, profitSplit: {}, tags: [],
      });
      collectiveId = c.id;
    });

    it("should add a member", async () => {
      await service.joinCollective(collectiveId, member1);
      const c = service.getCollective(collectiveId)!;
      expect(c.members).toContain(member1);
      expect(c.members.length).toBe(2);
    });

    it("should remove a member", async () => {
      await service.joinCollective(collectiveId, member1);
      service.leaveCollective(collectiveId, member1);
      const c = service.getCollective(collectiveId)!;
      expect(c.members).not.toContain(member1);
    });

    it("should reject duplicate membership", async () => {
      await service.joinCollective(collectiveId, member1);
      expect(() =>
        service.joinCollective(collectiveId, member1)
      ).rejects.toThrow("Already a member");
    });

    it("should reject last member leaving", async () => {
      expect(() => service.leaveCollective(collectiveId, creator)).toThrow(
        "Cannot leave last member"
      );
    });
  });

  describe("Treasury", () => {
    let collectiveId: string;

    beforeEach(async () => {
      const c = await service.createCollective(creator, "Test", "Desc", {
        purpose: "", minStake: "0", maxMembers: 10, profitSplit: {}, tags: [],
      });
      collectiveId = c.id;
    });

    it("should deposit to treasury", () => {
      service.depositToTreasury(collectiveId, 1000000000000000n);
      const c = service.getCollective(collectiveId)!;
      expect(c.treasury).toBe(1000000000000000n);
    });

    it("should withdraw from treasury", () => {
      service.depositToTreasury(collectiveId, 1000000000000000n);
      service.withdrawFromTreasury(collectiveId, creator, 500000000000000n);
      const c = service.getCollective(collectiveId)!;
      expect(c.treasury).toBe(500000000000000n);
    });

    it("should reject insufficient treasury", () => {
      expect(() =>
        service.withdrawFromTreasury(collectiveId, creator, 1000000000000000n)
      ).toThrow("Insufficient treasury");
    });
  });

  describe("Proposals", () => {
    let collectiveId: string;

    beforeEach(async () => {
      const c = await service.createCollective(creator, "Test", "Desc", {
        purpose: "", minStake: "0", maxMembers: 10, profitSplit: {}, tags: [],
      });
      collectiveId = c.id;
    });

    it("should create a proposal", () => {
      const p = service.createProposal(collectiveId, creator, "Upgrade", "Do it", "upgrade", "0x");
      expect(p.title).toBe("Upgrade");
      expect(p.status).toBe("active");
    });

    it("should reject proposal from non-member", () => {
      expect(() =>
        service.createProposal(collectiveId, outsider, "X", "Y", "z", "0x")
      ).toThrow("Not a member");
    });

    it("should count votes", async () => {
      await service.joinCollective(collectiveId, member1);
      const p = service.createProposal(collectiveId, creator, "X", "Y", "z", "0x");

      service.setNow(service.now() + 1); // advance 1 second
      service.vote(p.id, creator, true);
      service.vote(p.id, member1, true);

      const proposal = service.getProposal(p.id)!;
      expect(proposal.votesFor.length).toBe(2);
    });

    it("should pass proposal when quorum reached", async () => {
      await service.joinCollective(collectiveId, member1);
      const p = service.createProposal(collectiveId, creator, "X", "Y", "z", "0x");

      service.setNow(service.now() + 1);
      service.vote(p.id, creator, true);
      service.vote(p.id, member1, true);

      const proposal = service.getProposal(p.id)!;
      expect(proposal.status).toBe("passed");
    });
  });

  describe("Tasks", () => {
    let collectiveId: string;

    beforeEach(async () => {
      const c = await service.createCollective(creator, "Test", "Desc", {
        purpose: "", minStake: "0", maxMembers: 10, profitSplit: {}, tags: [],
      });
      collectiveId = c.id;
      service.depositToTreasury(collectiveId, 10000000000000000n);
    });

    it("should create a task", () => {
      const t = service.createTask(collectiveId, creator, "Build", "Thing", 1000n, Date.now() + 86400000);
      expect(t.title).toBe("Build");
      expect(t.status).toBe("open");
    });

    it("should assign a task", () => {
      const t = service.createTask(collectiveId, creator, "Build", "Thing", 1000n, Date.now() + 86400000);
      service.assignTask(t.id, member1);
      const task = service.getTask(t.id)!;
      expect(task.assignedTo).toBe(member1);
      expect(task.status).toBe("assigned");
    });

    it("should complete a task", () => {
      const t = service.createTask(collectiveId, creator, "Build", "Thing", 1000n, Date.now() + 86400000);
      service.assignTask(t.id, member1);
      service.completeTask(t.id);
      const task = service.getTask(t.id)!;
      expect(task.status).toBe("completed");
    });
  });
});
