import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;

describe("Query Resolution System", function () {
  let registry, receiptVerifier, escrow;
  let owner, client, worker;

  before(async function () {
    [owner, client, worker] = await ethers.getSigners();

    // Deploy contracts
    const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
    registry = await AgentRegistry.deploy();
    await registry.waitForDeployment();

    const ReceiptVerifier = await ethers.getContractFactory("ReceiptVerifier");
    receiptVerifier = await ReceiptVerifier.deploy();
    await receiptVerifier.waitForDeployment();

    const TaskEscrow = await ethers.getContractFactory("TaskEscrow");
    escrow = await TaskEscrow.deploy(
      await registry.getAddress(),
      await receiptVerifier.getAddress()
    );
    await escrow.waitForDeployment();

    // Register agents with stake
    await registry.connect(client).register("ClientAgent", ["task-creation"], {
      value: ethers.parseEther("0.001"),
    });
    await registry.connect(worker).register("WorkerAgent", ["solidity-development"], {
      value: ethers.parseEther("0.001"),
    });
  });

  it("should submit a query during task execution", async function () {
    // Create and fund a task (Medium priority = 1% fee, so 0.01 + 0.0001 = 0.0101 ETH)
    const tx = await escrow.connect(client).createAndFundTask(
      worker.address,
      ethers.parseEther("0.01"),
      Math.floor(Date.now() / 1000) + 86400,
      "QmTest123",
      { value: ethers.parseEther("0.02") } // Send more than enough
    );
    await tx.wait();

    // Worker submits a query
    const queryTx = await escrow.connect(worker).submitQuery(
      1,
      "Need clarification on requirement 3",
      0 // SpecificationClarification
    );
    const receipt = await queryTx.wait();

    // Check event was emitted
    const event = receipt.logs.find(
      (log) => log.fragment && log.fragment.name === "QuerySubmitted"
    );
    expect(event).to.exist;

    // Check query was stored
    const queryCount = await escrow.getQueryCount(1);
    expect(queryCount).to.equal(1);
  });

  it("should respond to a query", async function () {
    // Client responds to the query
    const responseTx = await escrow.connect(client).respondToQuery(
      1,
      "Requirement 3 means implement the REST API"
    );
    const receipt = await responseTx.wait();

    // Check event
    const event = receipt.logs.find(
      (log) => log.fragment && log.fragment.name === "QueryResponded"
    );
    expect(event).to.exist;

    // Get query and verify response
    const query = await escrow.getQuery(1, 0);
    expect(query.responded).to.be.true;
    expect(query.response).to.equal("Requirement 3 means implement the REST API");
  });

  it("should not allow responding to own query", async function () {
    // Worker submits a new query
    await escrow.connect(worker).submitQuery(
      1,
      "Another question",
      1 // ResourceIssue
    );

    // Worker tries to respond to their own query (should fail)
    await expect(
      escrow.connect(worker).respondToQuery(1, "Invalid response")
    ).to.be.revertedWith("!own query");
  });

  it("should check if latest query is responded", async function () {
    // The latest query (queryId 1) was NOT responded, so this should be false
    const isResponded = await escrow.isLatestQueryResponded(1);
    expect(isResponded).to.be.false;
  });
});
