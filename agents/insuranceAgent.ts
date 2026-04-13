import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { AgentInsurance__factory } from "../frontend/src/contracts/AgentInsurance";
import { AgentRegistry__factory } from "../frontend/src/contracts/AgentRegistry";
import { TaskEscrow__factory } from "../frontend/src/contracts/TaskEscrow";
import { config } from "./lib/config";
import { llmGenerate } from "./lib/llm";
import { encryptTask, decryptTask } from "./lib/crypto";
import { tracker } from "./lib/tracker";

dotenv.config();

const provider = new ethers.JsonRpcProvider(config.rpcUrl);
const wallet = new ethers.Wallet(process.env.INSURANCE_AGENT_PRIVATE_KEY!, provider);
const insuranceContract = AgentInsurance__factory.connect(
  config.contracts.AgentInsurance,
  wallet
);
const agentRegistry = AgentRegistry__factory.connect(
  config.contracts.AgentRegistry,
  wallet
);
const taskEscrow = TaskEscrow__factory.connect(
  config.contracts.TaskEscrow,
  wallet
);

interface InsuranceClaim {
  taskId: bigint;
  agentAddress: string;
  claimAmount: bigint;
  reason: string;
  evidence: string;
  timestamp: bigint;
}

/**
 * Insurance Agent - Manages claims and payouts from the insurance pool
 */
class InsuranceAgent {
  private name: string;
  private capabilities: string[];

  constructor() {
    this.name = "InsuranceAgent";
    this.capabilities = ["claims-processing", "risk-assessment", "payout-management"];
  }

  /**
   * Main execution loop
   */
  async run() {
    console.log(`🛡️  ${this.name} started`);
    
    // Register on-chain if not already
    await this.registerIfNeeded();
    
    // Monitor for insurance events
    this.listenForClaims();
    
    // Periodically assess risk and adjust premiums
    setInterval(() => this.assessRisk(), 3600000); // Every hour
    
    // Process pending claims every 5 minutes
    setInterval(() => this.processClaims(), 300000);
  }

  /**
   * Register agent on-chain if not already registered
   */
  private async registerIfNeeded() {
    try {
      const isRegistered = await agentRegistry.isRegistered(wallet.address);
      if (!isRegistered) {
        console.log("📝 Registering Insurance Agent on-chain...");
        const tx = await agentRegistry.register(
          this.name,
          this.capabilities,
          { value: ethers.parseEther("0.001") }
        );
        await tx.wait();
        console.log("✅ Insurance Agent registered!");
        tracker.recordRegistration();
      }
    } catch (error) {
      console.error("❌ Failed to register insurance agent:", error);
    }
  }

  /**
   * Listen for insurance-related events
   */
  private listenForClaims() {
    // Listen for NewClaim events
    insuranceContract.on("NewClaim", async (claimId, agentAddress, descriptionHash, claimAmount) => {
      console.log(`📋 New insurance claim received: ${claimId}`);
      await this.processClaim(claimId);
    });

    // Listen for ClaimApproved events
    insuranceContract.on("ClaimApproved", async (claimId, payoutAmount) => {
      console.log(`💰 Claim approved: ${claimId}, Payout: ${ethers.formatEther(payoutAmount)} ETH`);
    });

    // Listen for ClaimRejected events
    insuranceContract.on("ClaimRejected", async (claimId, reason) => {
      console.log(`❌ Claim rejected: ${claimId}, Reason: ${reason}`);
    });
  }

  /**
   * Process a specific insurance claim
   */
  private async processClaim(claimId: bigint) {
    try {
      console.log(`🔍 Processing claim ${claimId}...`);
      
      // Get claim details from contract
      const claim = await insuranceContract.claims(claimId);
      
      // Decrypt the task description to understand context
      let taskDescription = "";
      try {
        // In a real implementation, we would fetch the encrypted task from IPFS
        // and decrypt it using the agent's private key
        // For now, we'll simulate this
        taskDescription = "Task description would be decrypted here";
      } catch (error) {
        console.warn("Could not decrypt task description:", error);
      }

      // Use LLM to assess the validity of the claim
      const assessmentPrompt = `
        You are an insurance claims assessor for the COVENANT agent economy.
        
        Claim Details:
        - Claim ID: ${claimId}
        - Agent Address: ${claim.agentAddress}
        - Claim Amount: ${ethers.formatEther(claim.claimAmount)} ETH
        - Timestamp: ${new Date(claim.timestamp * 1000).toISOString()}
        - Task Context: ${taskDescription}
        
        Assess whether this claim is valid based on:
        1. Is the claimed amount reasonable for the type of failure?
        2. Does the agent have a history of similar claims?
        3. Is the timing consistent with known task durations?
        4. Are there any red flags suggesting fraud?
        
        Provide your assessment as JSON with:
        {
          "valid": boolean,
          "confidence": number (0-1),
          "reason": string,
          "recommendedPayout": string (ETH amount)
        }
      `;

      const assessment = await llmGenerate(assessmentPrompt);
      let assessmentObj: { valid: boolean; confidence: number; reason: string; recommendedPayout: string };
      
      try {
        assessmentObj = JSON.parse(assessment);
      } catch (error) {
        console.warn("Could not parse LLM assessment, using default");
        assessmentObj = { valid: false, confidence: 0.5, reason: "Assessment parsing failed", recommendedPayout: "0" };
      }

      // If claim seems valid, approve it
      if (assessmentObj.valid && assessmentObj.confidence > 0.7) {
        console.log(`✅ Approving claim ${claimId} based on LLM assessment`);
        const payout = ethers.parseEther(assessmentObj.recommendedPayout);
        
        const tx = await insuranceContract.approveClaim(claimId, payout);
        await tx.wait();
        console.log(`💰 Claim ${claimId} approved for ${ethers.formatEther(payout)} ETH`);
        
        tracker.recordInsurancePayout(payout);
      } else {
        console.log(`❌ Rejecting claim ${claimId} based on LLM assessment`);
        const tx = await insuranceContract.rejectClaim(claimId, assessmentObj.reason);
        await tx.wait();
        tracker.recordInsuranceRejection();
      }
    } catch (error) {
      console.error(`❌ Error processing claim ${claimId}:`, error);
    }
  }

  /**
   * Process all pending claims
   */
  private async processClaims() {
    try {
      const pendingCount = await insuranceContract.pendingClaimsCount();
      console.log(`📊 Found ${pendingCount} pending claims to process`);
      
      for (let i = 0; i < pendingCount; i++) {
        const claimId = await insuranceContract.pendingClaims(i);
        await this.processClaim(claimId);
        // Add delay between claims to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error("❌ Error processing claims batch:", error);
    }
  }

  /**
   * Assess overall risk in the insurance pool and suggest premium adjustments
   */
  private async assessRisk() {
    try {
      console.log("📊 Assessing insurance pool risk...");
      
      const totalPool = await insuranceContract.totalPool();
      const totalClaimsPaid = await insuranceContract.totalClaimsPaid();
      const claimRate = totalClaimsPaid > 0 && totalPool > 0 
        ? Number(totalClaimsPaid) / Number(totalPool) 
        : 0;
      
      console.log(`   Pool Size: ${ethers.formatEther(totalPool)} ETH`);
      console.log(`   Claims Paid: ${ethers.formatEther(totalClaimsPaid)} ETH`);
      console.log(`   Claim Rate: ${(claimRate * 100).toFixed(2)}%`);
      
      // If claim rate is too high, suggest increasing premiums
      if (claimRate > 0.1) { // More than 10% claim rate
        console.log("⚠️  High claim rate detected - consider adjusting premiums");
        // In a real implementation, we might vote to adjust premium parameters
      }
      
      tracker.recordRiskAssessment(claimRate);
    } catch (error) {
      console.error("❌ Error assessing risk:", error);
    }
  }

  /**
   * Get agent's insurance coverage status
   */
  async getCoverageStatus(agentAddress: string): Promise<{
    covered: boolean;
    coverageAmount: bigint;
    premiumPaid: bigint;
  }> {
    try {
      const coverage = await insuranceContract.agentCoverage(agentAddress);
      return {
        covered: coverage.isCovered,
        coverageAmount: coverage.coverageAmount,
        premiumPaid: coverage.premiumPaid
      };
    } catch (error) {
      console.error("❌ Error getting coverage status:", error);
      return { covered: false, coverageAmount: 0n, premiumPaid: 0n };
    }
  }

  /**
   * Purchase insurance coverage for an agent
   */
  async purchaseCoverage(agentAddress: string, coverageAmount: bigint) {
    try {
      // Calculate premium (simplified: 1% of coverage amount per month)
      const premium = (coverageAmount * 1n) / 100n; // 1%
      
      console.log(`💳 Purchasing ${ethers.formatEther(coverageAmount)} ETH coverage for ${agentAddress}`);
      console.log(`   Premium: ${ethers.formatEther(premium)} ETH`);
      
      const tx = await insuranceContract.purchaseCoverage(
        agentAddress,
        coverageAmount,
        { value: premium }
      );
      await tx.wait();
      
      console.log("✅ Coverage purchased successfully!");
      tracker.recordInsurancePremium(premium);
    } catch (error) {
      console.error("❌ Failed to purchase coverage:", error);
    }
  }
}

// Start the insurance agent
const insuranceAgent = new InsuranceAgent();
insuranceAgent.run().catch(console.error);

export default insuranceAgent;