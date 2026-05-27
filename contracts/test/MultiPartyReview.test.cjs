const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MultiPartyReview", function () {
  let contract;
  let owner, reviewer1, reviewer2, reviewer3, unauthorized;

  beforeEach(async function () {
    [owner, reviewer1, reviewer2, reviewer3, unauthorized] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("MultiPartyReview");
    contract = await Factory.deploy();
    await contract.waitForDeployment();

    // Owner is implicitly authorized as creator (msg.sender == owner() check)
    // Approve reviewers for task 1 and 2 so existing tests work
    await contract.setApprovedReviewer(1, reviewer1.address, true);
    await contract.setApprovedReviewer(1, reviewer2.address, true);
    await contract.setApprovedReviewer(1, reviewer3.address, true);
    await contract.setApprovedReviewer(2, reviewer1.address, true);
    await contract.setApprovedReviewer(2, reviewer2.address, true);
    await contract.setApprovedReviewer(2, reviewer3.address, true);
  });

  describe("Deployment", function () {
    it("should set owner correctly", async function () {
      expect(await contract.owner()).to.equal(owner.address);
    });

    it("should have default approval threshold of 7", async function () {
      expect(await contract.approvalThreshold()).to.equal(7);
    });
  });

  describe("Access Control - setAuthorizedCreator", function () {
    it("should allow owner to authorize a creator", async function () {
      await contract.setAuthorizedCreator(reviewer1.address, true);
      expect(await contract.authorizedCreators(reviewer1.address)).to.equal(true);
    });

    it("should revert if non-owner tries to authorize", async function () {
      await expect(
        contract.connect(reviewer1).setAuthorizedCreator(reviewer2.address, true)
      ).to.be.reverted;
    });

    it("should emit AuthorizedCreatorSet event", async function () {
      await expect(contract.setAuthorizedCreator(reviewer1.address, true))
        .to.emit(contract, "AuthorizedCreatorSet")
        .withArgs(reviewer1.address, true);
    });

    it("should allow authorized creator to create rounds", async function () {
      await contract.setAuthorizedCreator(reviewer1.address, true);
      await contract.connect(reviewer1).createReviewRound(10, 2);
      const round = await contract.getReviewRound(10);
      expect(round.requiredReviews).to.equal(2);
    });
  });

  describe("Access Control - setApprovedReviewer", function () {
    it("should allow owner to approve a reviewer", async function () {
      await contract.setApprovedReviewer(5, reviewer1.address, true);
      expect(await contract.approvedReviewers(5, reviewer1.address)).to.equal(true);
    });

    it("should revert if non-owner tries to approve", async function () {
      await expect(
        contract.connect(reviewer1).setApprovedReviewer(5, reviewer2.address, true)
      ).to.be.reverted;
    });

    it("should emit ApprovedReviewerSet event", async function () {
      await expect(contract.setApprovedReviewer(5, reviewer1.address, true))
        .to.emit(contract, "ApprovedReviewerSet")
        .withArgs(5, reviewer1.address, true);
    });
  });

  describe("createReviewRound", function () {
    it("should create a review round", async function () {
      await contract.createReviewRound(1, 3);
      const round = await contract.getReviewRound(1);
      expect(round.taskId).to.equal(1);
      expect(round.requiredReviews).to.equal(3);
      expect(round.submittedReviews).to.equal(0);
      expect(round.finalized).to.equal(false);
    });

    it("should snapshot approvalThreshold at creation", async function () {
      await contract.createReviewRound(1, 3);
      const round = await contract.getReviewRound(1);
      expect(round.approvalThresholdAtCreation).to.equal(7);

      // Change threshold after creation
      await contract.setApprovalThreshold(3);
      const round2 = await contract.getReviewRound(1);
      // Existing round keeps original snapshot
      expect(round2.approvalThresholdAtCreation).to.equal(7);
    });

    it("should emit ReviewRoundCreated event", async function () {
      await expect(contract.createReviewRound(1, 3))
        .to.emit(contract, "ReviewRoundCreated")
        .withArgs(1, 3);
    });

    it("should revert if round already exists", async function () {
      await contract.createReviewRound(1, 3);
      await expect(contract.createReviewRound(1, 3)).to.be.revertedWith("Round exists");
    });

    it("should revert if required reviews is 0", async function () {
      await expect(contract.createReviewRound(1, 0)).to.be.revertedWith("Invalid required reviews");
    });

    it("should revert if required reviews exceeds 10", async function () {
      await expect(contract.createReviewRound(1, 11)).to.be.revertedWith("Invalid required reviews");
    });

    it("should revert if caller is not authorized", async function () {
      await expect(
        contract.connect(unauthorized).createReviewRound(1, 3)
      ).to.be.revertedWith("Not authorized");
    });
  });

  describe("submitReview", function () {
    beforeEach(async function () {
      await contract.createReviewRound(1, 3);
    });

    it("should submit a review", async function () {
      await contract.connect(reviewer1).submitReview(1, 8, "QmHash1");
      const reviews = await contract.getReviews(1);
      expect(reviews.length).to.equal(1);
      expect(reviews[0].score).to.equal(8);
      expect(reviews[0].reviewer).to.equal(reviewer1.address);
    });

    it("should revert if no round exists", async function () {
      await expect(contract.connect(reviewer1).submitReview(99, 8, "QmHash1")).to.be.revertedWith("No round");
    });

    it("should revert if reviewer is not approved", async function () {
      await expect(
        contract.connect(unauthorized).submitReview(1, 8, "QmHash1")
      ).to.be.revertedWith("Not approved reviewer");
    });

    it("should allow owner to review without explicit approval", async function () {
      await contract.submitReview(1, 9, "QmHashOwner");
      const reviews = await contract.getReviews(1);
      expect(reviews[0].reviewer).to.equal(owner.address);
    });

    it("should revert if reviewer already reviewed", async function () {
      await contract.connect(reviewer1).submitReview(1, 8, "QmHash1");
      await expect(contract.connect(reviewer1).submitReview(1, 9, "QmHash2")).to.be.revertedWith("Already reviewed");
    });

    it("should revert if score is out of range", async function () {
      await expect(contract.connect(reviewer1).submitReview(1, 0, "QmHash1")).to.be.revertedWith("Invalid score");
      await expect(contract.connect(reviewer1).submitReview(1, 11, "QmHash1")).to.be.revertedWith("Invalid score");
    });

    it("should accept boundary scores 1 and 10", async function () {
      await contract.connect(reviewer1).submitReview(1, 1, "QmHash1");
      await contract.connect(reviewer2).submitReview(1, 10, "QmHash2");
      const reviews = await contract.getReviews(1);
      expect(reviews[0].score).to.equal(1);
      expect(reviews[1].score).to.equal(10);
    });

    it("should update hasReviewed mapping", async function () {
      expect(await contract.isReviewed(1, reviewer1.address)).to.equal(false);
      await contract.connect(reviewer1).submitReview(1, 8, "QmHash1");
      expect(await contract.isReviewed(1, reviewer1.address)).to.equal(true);
    });

    it("should track submitted reviews count", async function () {
      await contract.connect(reviewer1).submitReview(1, 8, "QmHash1");
      const round = await contract.getReviewRound(1);
      expect(round.submittedReviews).to.equal(1);
    });
  });

  describe("Auto-finalization", function () {
    it("should auto-finalize when all reviews submitted", async function () {
      await contract.createReviewRound(1, 2);
      await contract.connect(reviewer1).submitReview(1, 8, "QmHash1");
      await contract.connect(reviewer2).submitReview(1, 9, "QmHash2");

      const round = await contract.getReviewRound(1);
      expect(round.finalized).to.equal(true);
      expect(round.approved).to.equal(true); // avg 8 >= threshold 7
    });

    it("should reject if average below threshold", async function () {
      await contract.createReviewRound(1, 3);
      await contract.connect(reviewer1).submitReview(1, 5, "QmHash1");
      await contract.connect(reviewer2).submitReview(1, 6, "QmHash2");
      await contract.connect(reviewer3).submitReview(1, 6, "QmHash3");

      const round = await contract.getReviewRound(1);
      expect(round.finalized).to.equal(true);
      expect(round.approved).to.equal(false); // avg 5 < threshold 7
    });

    it("should revert review submission after finalization", async function () {
      await contract.createReviewRound(1, 1);
      await contract.connect(reviewer1).submitReview(1, 8, "QmHash1");
      await expect(contract.connect(reviewer2).submitReview(1, 9, "QmHash2")).to.be.revertedWith("Round finalized");
    });

    it("should use snapshot threshold, not live threshold, at finalization", async function () {
      // Create round when threshold is 7
      await contract.createReviewRound(1, 2);

      // Lower threshold to 3 after round creation
      await contract.setApprovalThreshold(3);

      // Submit reviews with avg 5 (would pass with threshold 3, but fails with snapshot 7)
      await contract.connect(reviewer1).submitReview(1, 5, "QmHash1");
      await contract.connect(reviewer2).submitReview(1, 5, "QmHash2");

      const round = await contract.getReviewRound(1);
      expect(round.approved).to.equal(false); // uses snapshot 7, avg 5 < 7
    });
  });

  describe("finalizeRound", function () {
    it("should finalize manually before all reviews submitted", async function () {
      await contract.createReviewRound(1, 5);
      await contract.connect(reviewer1).submitReview(1, 8, "QmHash1");
      await contract.connect(reviewer2).submitReview(1, 9, "QmHash2");

      await contract.finalizeRound(1);
      const round = await contract.getReviewRound(1);
      expect(round.finalized).to.equal(true);
    });

    it("should revert if already finalized", async function () {
      await contract.createReviewRound(1, 1);
      await contract.connect(reviewer1).submitReview(1, 8, "QmHash1");
      await expect(contract.finalizeRound(1)).to.be.revertedWith("Already finalized");
    });

    it("should revert if no reviews submitted", async function () {
      await contract.createReviewRound(1, 3);
      await expect(contract.finalizeRound(1)).to.be.revertedWith("No reviews");
    });
  });

  describe("setApprovalThreshold", function () {
    it("should allow owner to set threshold", async function () {
      await contract.setApprovalThreshold(5);
      expect(await contract.approvalThreshold()).to.equal(5);
    });

    it("should revert if non-owner tries to set threshold", async function () {
      await expect(contract.connect(reviewer1).setApprovalThreshold(5)).to.be.reverted;
    });
  });

  describe("getAverageScore", function () {
    it("should return 0 for no reviews", async function () {
      expect(await contract.getAverageScore(1)).to.equal(0);
    });

    it("should return correct average", async function () {
      await contract.createReviewRound(1, 3);
      await contract.connect(reviewer1).submitReview(1, 8, "QmHash1");
      await contract.connect(reviewer2).submitReview(1, 6, "QmHash2");
      await contract.connect(reviewer3).submitReview(1, 10, "QmHash3");

      // (8 + 6 + 10) / 3 = 8
      expect(await contract.getAverageScore(1)).to.equal(8);
    });
  });

  describe("Events", function () {
    it("should emit ReviewSubmitted", async function () {
      await contract.createReviewRound(1, 3);
      await expect(contract.connect(reviewer1).submitReview(1, 8, "QmHash1"))
        .to.emit(contract, "ReviewSubmitted")
        .withArgs(1, reviewer1.address, 8);
    });

    it("should emit ReviewRoundFinalized", async function () {
      await contract.createReviewRound(1, 1);
      await expect(contract.connect(reviewer1).submitReview(1, 8, "QmHash1"))
        .to.emit(contract, "ReviewRoundFinalized")
        .withArgs(1, true, 8);
    });

    it("should emit ReviewRoundCreated", async function () {
      await expect(contract.createReviewRound(1, 3))
        .to.emit(contract, "ReviewRoundCreated")
        .withArgs(1, 3);
    });
  });

  describe("Multiple tasks", function () {
    it("should handle independent review rounds", async function () {
      await contract.createReviewRound(1, 2);
      await contract.createReviewRound(2, 2);

      await contract.connect(reviewer1).submitReview(1, 9, "QmHash1");
      await contract.connect(reviewer1).submitReview(2, 5, "QmHash2");

      const round1 = await contract.getReviewRound(1);
      const round2 = await contract.getReviewRound(2);

      expect(round1.submittedReviews).to.equal(1);
      expect(round2.submittedReviews).to.equal(1);
      expect(await contract.getAverageScore(1)).to.equal(9);
      expect(await contract.getAverageScore(2)).to.equal(5);
    });
  });
});
