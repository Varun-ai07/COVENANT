import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { InsuranceService } from "../src/services/insurance.service.js";

describe("InsuranceService", () => {
  let service: InsuranceService;
  const mockAddress = "0x1234567890abcdef1234567890abcdef12345678" as `0x${string}`;
  const mockClient = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as `0x${string}`;

  beforeEach(() => {
    service = new InsuranceService({
      identityAddress: mockAddress,
      identityAbi: [],
      publicClient: {
        readContract: async () => true,
      } as any,
    });
  });

  describe("Enrollment", () => {
    it("should enroll an agent with valid premium", async () => {
      const policy = await service.enroll(mockAddress, 1000000000000000n);
      expect(policy.agent).toBe(mockAddress);
      expect(policy.premiumPaid).toBe(1000000000000000n);
      expect(policy.active).toBe(true);
    });

    it("should reject enrollment below minimum premium", async () => {
      await expect(
        service.enroll(mockAddress, 1000000000000n)
      ).rejects.toThrow("Premium below minimum");
    });

    it("should get policy after enrollment", async () => {
      await service.enroll(mockAddress, 1000000000000000n);
      const policy = service.getPolicy(mockAddress);
      expect(policy).toBeDefined();
      expect(policy?.active).toBe(true);
    });
  });

  describe("Claims", () => {
    beforeEach(async () => {
      await service.enroll(mockAddress, 1000000000000000n);
    });

    it("should submit a claim after cooldown", () => {
      const now = Math.floor(Date.now() / 1000);
      service.setNow(now);
      service.enroll(mockAddress, 1000000000000000n);
      service.setNow(now + 8 * 86400); // 8 days later

      const claim = service.submitClaim("task-1", mockAddress, 5000000000000000n, ["evidence1"]);
      expect(claim.taskId).toBe("task-1");
      expect(claim.status).toBe("submitted");
    });

    it("should reject claim without active policy", () => {
      expect(() =>
        service.submitClaim("task-1", mockClient, 1000n, [])
      ).toThrow("No active policy");
    });

    it("should reject claim exceeding coverage", () => {
      const coverage = 1000000000000000n * 50n;
      expect(() =>
        service.submitClaim("task-1", mockAddress, coverage + 1n, [])
      ).toThrow("Amount exceeds coverage");
    });

    it("should review and approve a claim", () => {
      const now = Math.floor(Date.now() / 1000);
      service.setNow(now);
      service.enroll(mockAddress, 1000000000000000n);
      service.setNow(now + 8 * 86400);

      const claim = service.submitClaim("task-1", mockAddress, 1000n, []);
      const reviewed = service.reviewClaim(claim.id, mockClient, true, "Approved");
      expect(reviewed.status).toBe("approved");
      expect(reviewed.reviewedBy).toBe(mockClient);
    });

    it("should review and reject a claim", () => {
      const t = Math.floor(Date.now() / 1000);
      service.setNow(t);
      service.enrollSync(mockAddress, 1000000000000000n);
      service.setNow(t + 10 * 86400);

      const claim = service.submitClaim("task-1", mockAddress, 1000n, []);
      const reviewed = service.reviewClaim(claim.id, mockClient, false, "Insufficient evidence");
      expect(reviewed.status).toBe("rejected");
      expect(reviewed.reviewedBy).toBe(mockClient);
    });
  });

  describe("Pool Stats", () => {
    it("should return correct stats", async () => {
      await service.enroll(mockAddress, 2000000000000000n);
      await service.enroll(mockClient, 1000000000000000n);

      const stats = service.getPoolStats();
      expect(stats.activePolicies).toBe(2);
      expect(stats.totalPremiums).toBe(3000000000000000n);
      expect(stats.poolBalance).toBe(3000000000000000n);
    });
  });

  describe("Premium Calculation", () => {
    it("should calculate premium from coverage", () => {
      const premium = service.calculatePremium(100000000000000000n);
      expect(premium).toBe(2000000000000000n); // 2%
    });

    it("should calculate coverage from premium", () => {
      const coverage = service.calculateCoverage(1000000000000000n);
      expect(coverage).toBe(50000000000000000n); // 50x
    });
  });
});
