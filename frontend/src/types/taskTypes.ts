export enum TaskStatus {
  Created = 0,
  Funded = 1,
  InProgress = 2,
  Submitted = 3,
  Completed = 4,
  Failed = 5,
  Disputed = 6,
}

export interface OpenTask {
  taskId: bigint;
  client: string;
  maxPayment: bigint;
  deadline: bigint;
  descriptionHash: string;
  status: number;
  postedAt: bigint;
  selectedWorker: string;
  selectedPrice: bigint;
  selectedTimeEstimate: bigint;
  selectedProposalHash: string;
}

export interface Bid {
  price: bigint;
  timeEstimate: bigint;
  proposalHash: string;
  bidAt: bigint;
  bidder: string;
  hasCounter: boolean;
  counterPrice: bigint;
  counterTimeEstimate: bigint;
  counterProposalHash: string;
}
