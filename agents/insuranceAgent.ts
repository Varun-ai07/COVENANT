import * as dotenv from "dotenv";
import { formatEther, parseEther } from "viem";
import { createWallet, CONTRACTS } from "./lib/config.js";
import { AgentRegistryABI, TaskEscrowABI } from "./lib/abis.js";
import { generateJSON } from "./lib/llm.js";

dotenv.config();

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
 *
 * Note: The AgentInsurance contract is not yet in the deployed ABIs.
 * This agent uses AgentRegistry and TaskEscrow for agent/task lookups
 * and provides the insurance logic framework for when the insurance
 * contract is deployed and added to lib/abis.ts.
 */
class InsuranceAgent {
  private name: string;
  private capabilities: string[];
  private walletClient: any;
  private publicClient: any;
  private account: any;

  constructor() {
    this.name = "InsuranceAgent";
    this.capabilities = ["claims-processing", "risk-assessment", "payout-management"];
  }

  /**
   * Initialize wallet connections
   */
  private async init() {
    const privateKey = process.env.INSURANCE_AGENT_PRIVATE_KEY || process.env.CLIENT_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error("Missing INSURANCE_AGENT_PRIVATE_KEY (or CLIENT_PRIVATE_KEY) in .env");
    }
    const { wallet, account, publicClient } = createWallet(privateKey);
    this.walletClient = wallet;
    this.account = account;
    this.publicClient = publicClient;
  }

  /**
   * Main execution loop
   */
  async run() {
    console.log(`🛡️  ${this.name} started`);

    await this.init();

    // Register on-chain if not already
    await this.registerIfNeeded();

    // Monitor for insurance events (placeholder — polling until AgentInsurance ABI is available)
    this.startMonitoring();

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
      const isRegistered = await this.publicClient.readContract({
        address: CONTRACTS.AgentRegistry,
        abi: AgentRegistryABI,
        functionName: "isRegistered",
        args: [this.account.address],
      }) as boolean;

      if (!isRegistered) {
        console.log("📝 Registering Insurance Agent on-chain...");
        const hash = await this.walletClient.writeContract({
          address: CONTRACTS.AgentRegistry,
          abi: AgentRegistryABI,
          functionName: "register",
          args: [this.name, this.capabilities],
          value: parseEther("0.001"),
        });
        const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
        console.log("✅ Insurance Agent registered!");
      }
    } catch (error) {
      console.error("❌ Failed to register insurance agent:", error);
    }
  }

  /**
   * Monitor for insurance-related events (polling-based placeholder)
   */
  private startMonitoring() {
    console.log("📋 Insurance event monitoring started (polling mode)");
    // When AgentInsurance ABI is added to lib/abis.ts, switch to
    // this.publicClient.watchContractEvent for real event listening
  }

  /**
   * Process a specific insurance claim
   */
  private async processClaim(claimId: bigint) {
    try {
      console.log(`🔍 Processing claim ${claimId}...`);

      // When AgentInsurance contract is deployed and ABI available,
      // fetch claim details: await this.publicClient.readContract({ ... })
      const claim = {
        agentAddress: "0x0",
        claimAmount: 0n,
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
      };

      // Use LLM to assess the validity of the claim
      const assessmentPrompt = `
        You are an insurance claims assessor for the COVENANT agent economy.

        Claim Details:
        - Claim ID: ${claimId}
        - Agent Address: ${claim.agentAddress}
        - Claim Amount: ${formatEther(claim.claimAmount)} ETH
        - Timestamp: ${new Date(Number(claim.timestamp) * 1000).toISOString()}

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

      const assessment = await generateJSON(assessmentPrompt);
      let assessmentObj: { valid: boolean; confidence: number; reason: string; recommendedPayout: string };

      try {
        assessmentObj = typeof assessment === 'string' ? JSON.parse(assessment) : assessment;
      } catch (error) {
        console.warn("Could not parse LLM assessment, using default");
        assessmentObj = { valid: false, confidence: 0.5, reason: "Assessment parsing failed", recommendedPayout: "0" };
      }

      // If claim seems valid, approve it
      if (assessmentObj.valid && assessmentObj.confidence > 0.7) {
        console.log(`✅ Approving claim ${claimId} based on LLM assessment`);
        console.log(`   Recommended payout: ${assessmentObj.recommendedPayout} ETH`);
        // TODO: Call insuranceContract.approveClaim when ABI is available
      } else {
        console.log(`❌ Rejecting claim ${claimId} based on LLM assessment`);
        console.log(`   Reason: ${assessmentObj.reason}`);
        // TODO: Call insuranceContract.rejectClaim when ABI is available
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
      // When AgentInsurance ABI is available, query pendingClaimsCount
      // and iterate through pendingClaims
      console.log("📊 Checking for pending insurance claims...");
      // Placeholder: no-op until contract ABI is integrated
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

      // When AgentInsurance ABI is available, query totalPool and totalClaimsPaid
      // For now, log placeholder
      console.log("   Insurance contract not yet integrated — risk assessment skipped");
    } catch (error) {
      console.error("❌ Error assessing risk:", error);
    }
  }

  /**
   * Get agent's insurance coverage status
   */
  async getCoverageStatus(_agentAddress: string): Promise<{
    covered: boolean;
    coverageAmount: bigint;
    premiumPaid: bigint;
  }> {
    // When AgentInsurance ABI is available, query agentCoverage
    return { covered: false, coverageAmount: 0n, premiumPaid: 0n };
  }

  /**
   * Purchase insurance coverage for an agent
   */
  async purchaseCoverage(agentAddress: string, coverageAmount: bigint) {
    try {
      const premium = (coverageAmount * 1n) / 100n; // 1%

      console.log(`💳 Purchasing ${formatEther(coverageAmount)} ETH coverage for ${agentAddress}`);
      console.log(`   Premium: ${formatEther(premium)} ETH`);

      // TODO: Call insuranceContract.purchaseCoverage when ABI is available
      console.log("   Insurance contract not yet integrated — coverage purchase skipped");
    } catch (error) {
      console.error("❌ Failed to purchase coverage:", error);
    }
  }
}

// Start the insurance agent
const insuranceAgent = new InsuranceAgent();
insuranceAgent.run().catch(console.error);

export default insuranceAgent;
