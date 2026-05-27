export interface CovenantConfig {
  rpcUrl: string;
  privateKey?: string;
  chainId: number;
}

export interface AgentProfile {
  address: string;
  name: string;
  reputation: number;
  capabilities: string[];
  isActive: boolean;
}

export interface Task {
  id: number;
  client: string;
  worker: string;
  payment: string;
  deadline: number;
  status: string;
  descriptionHash: string;
  deliverableHash?: string;
}
