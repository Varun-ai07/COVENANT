import "@nomicfoundation/hardhat-chai-matchers";
import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

describe("DisputeArbitrationMock", function () {
  let registry, escrow, verifier, arbitration, owner, client, worker;
  const MIN_STAKE = ethers.parseEther("0.001");

  async function deployFixture() {
    const [owner, client, worker, juror1, juror2, juror3, juror4, juror5] = await ethers.getSigners();

    // Fund everyone
    for (const signer of [client, worker, juror1, juror2, juror3, juror4, juror5]) {
      await owner.sendTransaction({ to: signer.address, value: ethers.parseEther("5") });
    }

    const Registry = await ethers.getContractFactory("AgentRegistry");
    registry = await Registry.deploy();

    const Verifier = await ethers.getContractFactory("ReceiptVerifier");
    verifier = await Verifier.deploy();

    const Escrow = await ethers.getContractFactory("TaskEscrow");
    escrow = await Escrow.deploy(await registry.getAddress(), await verifier.getAddress());
    await registry.addAuthorizedContract(await escrow.getAddress());
    await verifier.addAuthorizedIssuer(await escrow.getAddress());

    // Register client, worker, and jurors
    for (const signer of [client, worker, juror1, juror2, juror3, juror4, juror5]) {
      await registry.connect(signer).register(`Agent-${signer.address.slice(2, 8)}`, ["test"], { value: MIN_STAKE });
    }

    // Create a task between client and worker
    const payment = ethers.parseEther("0.5");
    const deadline = (await time.latest()) + 86400;
    // Medium priority fee: 1% (100 bps)
    const fee = (payment * 100n) / 10000n;
    await escrow.connect(client).createAndFundTask(
      worker.address, payment, deadline, ethers.encodeBytes32String("QmTask"), { value: payment + fee }
    );

    const Mock = await ethers.getContractFactory("DisputeArbitrationMock");
    arbitration = await Mock.deploy(
      await registry.getAddress(),
      await escrow.getAddress(),
      ethers.ZeroAddress,
      ethers.ZeroHash
    );

    // Authorize mock in registry so it can update reputation during dispute resolution
    await registry.addAuthorizedContract(await arbitration.getAddress());

    return { registry, escrow, verifier, arbitration, owner, client, worker, juror1, juror2, juror3, juror4, juror5 };
  }

  describe("Dispute Creation", function () {
    it("should create a dispute successfully", async function () {
      const { arbitration, client } = await loadFixture(deployFixture);

      const bond = ethers.parseEther("0.0002");
      await expect(arbitration.connect(client).disputeTask(1, { value: bond }))
        .to.emit(arbitration, "DisputeCreated")
        .withArgs(1, 1, client.address)
        .and.to.emit(arbitration, "JurySelected");

      const dispute = await arbitration.getDispute(1);
      expect(dispute.taskId).to.equal(1);
      expect(dispute.client).to.equal(client.address);
      expect(dispute.jurors.length).to.equal(3);
      expect(dispute.resolved).to.equal(false);
    });

    it("should auto-select 3 jurors", async function () {
      const { arbitration, client } = await loadFixture(deployFixture);

      await arbitration.connect(client).disputeTask(1, { value: ethers.parseEther("0.0002") });
      const dispute = await arbitration.getDispute(1);

      expect(dispute.jurors.length).to.equal(3);
      const jurorSet = new Set(dispute.jurors);
      expect(jurorSet.has(client.address)).to.equal(false);
    });

    it("should create dispute from worker side", async function () {
      const { arbitration, worker } = await loadFixture(deployFixture);

      await expect(arbitration.connect(worker).disputeTask(1, { value: ethers.parseEther("0.0002") }))
        .to.emit(arbitration, "DisputeCreated");

      const dispute = await arbitration.getDispute(1);
      expect(dispute.worker).to.equal(worker.address);
    });

    it("should reject dispute for non-existent task", async function () {
      const { arbitration, client } = await loadFixture(deployFixture);
      await expect(arbitration.connect(client).disputeTask(999, { value: ethers.parseEther("0.0002") }))
        .to.be.reverted;
    });

    it("should reject incorrect dispute bond", async function () {
      const { arbitration, client } = await loadFixture(deployFixture);
      await expect(arbitration.connect(client).disputeTask(1, { value: ethers.parseEther("0.001") }))
        .to.be.revertedWith("Incorrect dispute bond amount");
    });
  });

  describe("Voting", function () {
    it("should allow jurors to cast votes and resolve dispute (worker wins)", async function () {
      const { arbitration, client } = await loadFixture(deployFixture);

      await arbitration.connect(client).disputeTask(1, { value: ethers.parseEther("0.0002") });

      const dispute = await arbitration.getDispute(1);
      const j1 = await ethers.getSigner(dispute.jurors[0]);
      const j2 = await ethers.getSigner(dispute.jurors[1]);
      const j3 = await ethers.getSigner(dispute.jurors[2]);

      await expect(arbitration.connect(j3).castVote(1, true)).to.emit(arbitration, "VoteCast");
      await expect(arbitration.connect(j2).castVote(1, true)).to.emit(arbitration, "VoteCast");
      // Third vote triggers auto-resolution
      await expect(arbitration.connect(j1).castVote(1, true)).to.emit(arbitration, "DisputeResolved");

      const resolved = await arbitration.getDispute(1);
      expect(resolved.resolved).to.equal(true);
      expect(resolved.workerWins).to.equal(true);
    });

    it("should reject non-juror voting", async function () {
      const { arbitration, client } = await loadFixture(deployFixture);

      await arbitration.connect(client).disputeTask(1, { value: ethers.parseEther("0.0002") });
      await expect(arbitration.connect(client).castVote(1, true))
        .to.be.revertedWith("Not a juror for this dispute");
    });

    it("should reject duplicate votes", async function () {
      const { arbitration, client } = await loadFixture(deployFixture);

      await arbitration.connect(client).disputeTask(1, { value: ethers.parseEther("0.0002") });
      const dispute = await arbitration.getDispute(1);
      const jurorSigner = await ethers.getSigner(dispute.jurors[0]);

      await arbitration.connect(jurorSigner).castVote(1, true);
      await expect(arbitration.connect(jurorSigner).castVote(1, false))
        .to.be.revertedWith("Already voted");
    });

    it("should resolve dispute when worker loses (2-1 against)", async function () {
      const { arbitration, client } = await loadFixture(deployFixture);

      await arbitration.connect(client).disputeTask(1, { value: ethers.parseEther("0.0002") });

      const dispute = await arbitration.getDispute(1);
      const j1 = await ethers.getSigner(dispute.jurors[0]);
      const j2 = await ethers.getSigner(dispute.jurors[1]);
      const j3 = await ethers.getSigner(dispute.jurors[2]);

      await arbitration.connect(j1).castVote(1, false);
      await arbitration.connect(j2).castVote(1, false);
      await arbitration.connect(j3).castVote(1, true);

      const resolved = await arbitration.getDispute(1);
      expect(resolved.resolved).to.equal(true);
      expect(resolved.workerWins).to.equal(false);
    });
  });

  describe("Error Handling", function () {
    it("should reject getting non-existent dispute", async function () {
      const { arbitration } = await loadFixture(deployFixture);
      await expect(arbitration.getDispute(999))
        .to.be.revertedWithCustomError(arbitration, "DisputeNotFound");
    });

    it("should reject vote on non-existent dispute", async function () {
      const { arbitration, client } = await loadFixture(deployFixture);
      await expect(arbitration.connect(client).castVote(999, true))
        .to.be.reverted;
    });
  });
});
