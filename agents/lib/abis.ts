import AgentRegistryArtifact from "../abis/AgentRegistry.json" with { type: "json" };
import TaskEscrowArtifact from "../abis/TaskEscrow.json" with { type: "json" };
import ReceiptVerifierArtifact from "../abis/ReceiptVerifier.json" with { type: "json" };

export const AgentRegistryABI = AgentRegistryArtifact.abi;
export const TaskEscrowABI = TaskEscrowArtifact.abi;
export const ReceiptVerifierABI = ReceiptVerifierArtifact.abi;
