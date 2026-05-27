const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TrainingMarketplace", function () {
  let marketplace, owner, instructor, student, feeRecipient;

  beforeEach(async function () {
    [owner, instructor, student, feeRecipient] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("TrainingMarketplace");
    marketplace = await Factory.deploy(feeRecipient.address);
    await marketplace.waitForDeployment();
  });

  it("should create a training", async function () {
    const tx = await marketplace.connect(instructor).createTraining(
      "Data Analysis", "Learn data analysis", ethers.parseEther("0.001"),
      ["data-analysis", "research"], 10
    );
    const receipt = await tx.wait();
    expect(receipt.status).to.equal(1);
    expect(await marketplace.getTrainingCount()).to.equal(1);
  });

  it("should enroll in training", async function () {
    await marketplace.connect(instructor).createTraining(
      "Data Analysis", "Learn data analysis", ethers.parseEther("0.001"),
      ["data-analysis"], 10
    );
    const tx = await marketplace.connect(student).enroll(0, { value: ethers.parseEther("0.001") });
    const receipt = await tx.wait();
    expect(receipt.status).to.equal(1);
  });

  it("should complete training", async function () {
    await marketplace.connect(instructor).createTraining(
      "Data Analysis", "Learn data analysis", ethers.parseEther("0.001"),
      ["data-analysis"], 10
    );
    await marketplace.connect(student).enroll(0, { value: ethers.parseEther("0.001") });
    await marketplace.connect(student).completeTraining(0);
    const training = await marketplace.getTraining(0);
    expect(training.graduates).to.equal(1);
  });

  it("should rate training", async function () {
    await marketplace.connect(instructor).createTraining(
      "Data Analysis", "Learn data analysis", ethers.parseEther("0.001"),
      ["data-analysis"], 10
    );
    await marketplace.connect(student).enroll(0, { value: ethers.parseEther("0.001") });
    await marketplace.connect(student).completeTraining(0);
    await marketplace.connect(student).rateTraining(0, 5);
    const training = await marketplace.getTraining(0);
    expect(training.totalRatings).to.equal(1);
  });

  it("should deactivate training", async function () {
    await marketplace.connect(instructor).createTraining(
      "Data Analysis", "Learn data analysis", ethers.parseEther("0.001"),
      ["data-analysis"], 10
    );
    await marketplace.connect(instructor).deactivateTraining(0);
    const training = await marketplace.getTraining(0);
    expect(training.active).to.be.false;
  });
});
