import { Plugin } from "@elizaos/core";
import { JsonRpcProvider, Contract, parseEther, Wallet, keccak256, toUtf8Bytes } from "ethers";

const V5_ADDRESSES = {
  CovenantIdentity: "0xFa1bFd34290bf12A2F09Ea24Cda05E71cc79c1fF",
  CovenantEscrow: "0x130e2027eB57C427Bf63E2B06d35B10CB20C4b77",
};

const RPC_URL = "https://sepolia.base.org";

const IDENTITY_ABI = [
  "function register(uint96 stake, bytes32 metadataRoot) payable",
  "function isRegistered(address) view returns (bool)",
  "function getAgent(address) view returns (tuple(address owner, uint96 stake, uint16 reputation, uint32 registeredAt, uint32 lastActivity, bool active, bytes32 metadataRoot))",
];

const ESCROW_ABI = [
  "function createTask(address worker, uint128 amount, uint32 deadline, bytes32 metaHash) payable returns (uint256)",
  "function getTask(uint256 taskId) view returns (tuple(address client, address worker, uint128 amount, uint32 deadline, uint8 status, uint8 disputeCount, bytes32 metaHash))",
  "function taskCount() view returns (uint256)",
];

function getProvider() {
  return new JsonRpcProvider(RPC_URL);
}

export const covenantPlugin: Plugin = {
  name: "covenant",
  description: "COVENANT Protocol - Agent economy tools for on-chain task management",
  actions: [
    {
      name: "register_agent",
      description: "Register as a COVENANT agent on-chain",
      handler: async (runtime: any, message: any, state: any): Promise<any> => {
        try {
          const privateKey = runtime.getSetting("COVENANT_PRIVATE_KEY");
          if (!privateKey) return { text: "Set COVENANT_PRIVATE_KEY to register." };
          const wallet = new Wallet(privateKey as string, getProvider());
          const contract = new Contract(V5_ADDRESSES.CovenantIdentity, IDENTITY_ABI, wallet);
          const tx = await contract.register(0, keccak256(toUtf8Bytes("elizaos-agent")));
          await tx.wait();
          return { text: `Agent registered! TX: ${tx.hash}` };
        } catch (e: any) {
          return { text: `Registration failed: ${e.message}` };
        }
      },
      validate: async (...args: any[]) => true,
      examples: [] as any[],
    },
    {
      name: "create_task",
      description: "Create a task and lock payment in escrow",
      handler: async (runtime: any, message: any, state: any): Promise<any> => {
        try {
          const privateKey = runtime.getSetting("COVENANT_PRIVATE_KEY");
          if (!privateKey) return { text: "Set COVENANT_PRIVATE_KEY to create tasks." };
          const wallet = new Wallet(privateKey as string, getProvider());
          const contract = new Contract(V5_ADDRESSES.CovenantEscrow, ESCROW_ABI, wallet);
          const worker = "0x0000000000000000000000000000000000000000";
          const payment = "0.001";
          const deadline = Math.floor(Date.now() / 1000) + 86400;
          const metaHash = keccak256(toUtf8Bytes("task"));
          const tx = await contract.createTask(worker, parseEther(payment), deadline, metaHash, { value: parseEther(payment) });
          await tx.wait();
          return { text: `Task created! TX: ${tx.hash}` };
        } catch (e: any) {
          return { text: `Task creation failed: ${e.message}` };
        }
      },
      validate: async (...args: any[]) => true,
      examples: [] as any[],
    },
    {
      name: "find_workers",
      description: "Find agents with specific capabilities",
      handler: async (...args: any[]): Promise<any> => {
        try {
          const provider = getProvider();
          const contract = new Contract(V5_ADDRESSES.CovenantIdentity, IDENTITY_ABI, provider);
          const count = await contract.taskCount();
          return { text: `Found ${count} tasks on COVENANT.` };
        } catch (e: any) {
          return { text: `Query failed: ${e.message}` };
        }
      },
      validate: async (...args: any[]) => true,
      examples: [] as any[],
    },
    {
      name: "submit_work",
      description: "Submit completed work for a task",
      handler: async (...args: any[]): Promise<any> => {
        return { text: "Submit work via COVENANT MCP: npx @varun-ai07/covenant-mcp add" };
      },
      validate: async (...args: any[]) => true,
      examples: [] as any[],
    },
    {
      name: "verify_task",
      description: "Verify and approve submitted work",
      handler: async (...args: any[]): Promise<any> => {
        return { text: "Verify task via COVENANT MCP: npx @varun-ai07/covenant-mcp add" };
      },
      validate: async (...args: any[]) => true,
      examples: [] as any[],
    },
  ],
  providers: [],
  services: [],
};

export default covenantPlugin;
