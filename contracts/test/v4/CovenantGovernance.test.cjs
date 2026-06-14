const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("CovenantGovernance V4", function () {
  async function deployGovernanceFixture() {
    const [owner, guardian, vetoer, proposer] = await ethers.getSigners();

    const Governance = await ethers.getContractFactory("contracts/v4/CovenantGovernance.sol:CovenantGovernance");
    const governance = await Governance.deploy();
    await governance.initialize(guardian.address, vetoer.address, ethers.parseEther("100"));

    return { governance, owner, guardian, vetoer, proposer };
  }

  describe("Proposal Creation", function () {
    it("should create a proposal", async function () {
      const { governance, proposer } = await loadFixture(deployGovernanceFixture);
      const votingPeriod = 86400;

      const tx = await governance.connect(proposer).propose(
        governance.target,
        "0x",
        ethers.keccak256(ethers.toUtf8Bytes("test proposal")),
        votingPeriod
      );

      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);

      const proposal = await governance.getProposal(1);
      expect(proposal.proposer).to.equal(proposer.address);
      expect(proposal.status).to.equal(1);
    });

    it("should reject voting period too short", async function () {
      const { governance, proposer } = await loadFixture(deployGovernanceFixture);

      await expect(
        governance.connect(proposer).propose(
          governance.target,
          "0x",
          ethers.ZeroHash,
          60
        )
      ).to.be.revertedWith("voting too short");
    });
  });

  describe("Vote Submission", function () {
    it("should submit votes with guardian signature", async function () {
      const { governance, guardian, proposer } = await loadFixture(deployGovernanceFixture);
      const votingPeriod = 86400;

      await governance.connect(proposer).propose(
        governance.target,
        "0x",
        ethers.keccak256(ethers.toUtf8Bytes("test")),
        votingPeriod
      );

      const message = ethers.keccak256(
        ethers.solidityPacked(["uint256", "uint256", "uint256", "uint256"], [1, 60, 40, 31337])
      );
      const signature = await guardian.signMessage(ethers.getBytes(message));

      await governance.connect(proposer).submitVotes(1, 60, 40, signature);

      const updatedProposal = await governance.getProposal(1);
      expect(updatedProposal.forVotes).to.equal(60);
      expect(updatedProposal.againstVotes).to.equal(40);
    });
  });

  describe("Veto", function () {
    it("should allow vetoer to veto a proposal", async function () {
      const { governance, vetoer, proposer } = await loadFixture(deployGovernanceFixture);
      const votingPeriod = 86400;

      await governance.connect(proposer).propose(
        governance.target,
        "0x",
        ethers.keccak256(ethers.toUtf8Bytes("test")),
        votingPeriod
      );

      await governance.connect(vetoer).vetoProposal(1);

      const proposal = await governance.getProposal(1);
      expect(proposal.status).to.equal(4);
    });

    it("should reject veto from non-vetoer", async function () {
      const { governance, proposer } = await loadFixture(deployGovernanceFixture);
      const votingPeriod = 86400;

      await governance.connect(proposer).propose(
        governance.target,
        "0x",
        ethers.keccak256(ethers.toUtf8Bytes("test")),
        votingPeriod
      );

      await expect(
        governance.connect(proposer).vetoProposal(1)
      ).to.be.revertedWith("not vetoer");
    });
  });

  describe("Emergency Controls", function () {
    it("should allow guardian to emit emergency pause event", async function () {
      const { governance, guardian } = await loadFixture(deployGovernanceFixture);

      await expect(
        governance.connect(guardian).emergencyPause(governance.target, true)
      ).to.emit(governance, "EmergencyPaused").withArgs(governance.target, true);
    });
  });
});
