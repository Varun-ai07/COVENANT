const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("CovenantGovernance V3", function () {
  const DOMAIN_TYPEHASH = ethers.keccak256(ethers.toUtf8Bytes(
    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
  ));
  const PROPOSAL_TYPEHASH = ethers.keccak256(ethers.toUtf8Bytes(
    "Proposal(address target,bytes callData,bytes32 descriptionHash,uint32 votingEnd)"
  ));

  async function deployGovernanceFixture() {
    const [owner, guardian, proposer, voter1, voter2] = await ethers.getSigners();

    const Governance = await ethers.getContractFactory("contracts/v3/CovenantGovernance.sol:CovenantGovernance");
    const governance = await Governance.deploy();
    await governance.initialize(guardian.address, ethers.parseEther("100"));

    return { governance, owner, guardian, proposer, voter1, voter2 };
  }

  function computeDomainSeparator(name, version, chainId, verifyingContract) {
    return ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "bytes32", "bytes32", "uint256", "address"],
      [
        DOMAIN_TYPEHASH,
        ethers.keccak256(ethers.toUtf8Bytes(name)),
        ethers.keccak256(ethers.toUtf8Bytes(version)),
        chainId,
        verifyingContract
      ]
    ));
  }

  function computeStructHash(target, callData, descriptionHash, votingEnd) {
    return ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "address", "bytes32", "bytes32", "uint32"],
      [
        PROPOSAL_TYPEHASH,
        target,
        ethers.keccak256(callData),
        descriptionHash,
        votingEnd
      ]
    ));
  }

  function computeEIP712Digest(domainSeparator, structHash) {
    return ethers.keccak256(ethers.concat(["0x1901", domainSeparator, structHash]));
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

      const proposal = await governance.getProposal(1);
      const domainSeparator = computeDomainSeparator("CovenantGovernance", "1", 31337, governance.target);
      const structHash = computeStructHash(proposal.target, proposal.callData, proposal.descriptionHash, proposal.votingEnd);
      const digest = computeEIP712Digest(domainSeparator, structHash);

      const signature = await guardian.signMessage(ethers.getBytes(digest));

      await governance.connect(proposer).submitVotes(1, 60, 40, signature);

      const updatedProposal = await governance.getProposal(1);
      expect(updatedProposal.forVotes).to.equal(60);
      expect(updatedProposal.againstVotes).to.equal(40);
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
