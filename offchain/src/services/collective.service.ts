import { type Address, type PublicClient, keccak256, toBytes } from "viem";
import type {
  Collective,
  CollectiveProposal,
  CollectiveTask,
  CollectiveMetadata,
} from "../types.js";

export class CollectiveService {
  private collectives: Map<string, Collective> = new Map();
  private proposals: Map<string, CollectiveProposal> = new Map();
  private tasks: Map<string, CollectiveTask> = new Map();
  private collectiveCounter = 0;
  private proposalCounter = 0;
  private taskCounter = 0;

  private publicClient: PublicClient;
  private identityAddress: Address;
  private identityAbi: any;

  static MAX_MEMBERS = 100;
  static MIN_TREASURY = 1000000000000000n; // 0.001 ETH
  static VOTING_PERIOD = 3 * 24 * 60 * 60; // 3 days

  private _now: number | null = null;
  now(): number { return this._now ?? Math.floor(Date.now() / 1000); }
  setNow(t: number) { this._now = t; }

  constructor(config: {
    identityAddress: Address;
    identityAbi: any;
    publicClient: PublicClient;
  }) {
    this.identityAddress = config.identityAddress;
    this.identityAbi = config.identityAbi;
    this.publicClient = config.publicClient;
  }

  async createCollective(
    creator: Address,
    name: string,
    description: string,
    metadata: CollectiveMetadata
  ): Promise<Collective> {
    const isRegistered = await this.publicClient.readContract({
      address: this.identityAddress,
      abi: this.identityAbi,
      functionName: "isRegistered",
      args: [creator],
    });

    if (!isRegistered) {
      throw new Error("Creator not registered on-chain");
    }

    this.collectiveCounter++;
    const id = `collective-${this.collectiveCounter}`;

    const collective: Collective = {
      id,
      name,
      description,
      creator,
      members: [creator],
      treasury: 0n,
      createdAt: this.now(),
      active: true,
      metadata,
    };

    this.collectives.set(id, collective);
    return collective;
  }

  async joinCollective(collectiveId: string, member: Address): Promise<void> {
    const collective = this.collectives.get(collectiveId);
    if (!collective) throw new Error("Collective not found");
    if (!collective.active) throw new Error("Collective not active");
    if (collective.members.length >= CollectiveService.MAX_MEMBERS) {
      throw new Error("Max members reached");
    }
    if (collective.members.includes(member)) {
      throw new Error("Already a member");
    }

    const isRegistered = await this.publicClient.readContract({
      address: this.identityAddress,
      abi: this.identityAbi,
      functionName: "isRegistered",
      args: [member],
    });

    if (!isRegistered) {
      throw new Error("Member not registered on-chain");
    }

    collective.members.push(member);
  }

  leaveCollective(collectiveId: string, member: Address): void {
    const collective = this.collectives.get(collectiveId);
    if (!collective) throw new Error("Collective not found");
    if (!collective.members.includes(member)) throw new Error("Not a member");
    if (collective.members.length <= 1) throw new Error("Cannot leave last member");

    collective.members = collective.members.filter(m => m !== member);
  }

  depositToTreasury(collectiveId: string, amount: bigint): void {
    const collective = this.collectives.get(collectiveId);
    if (!collective) throw new Error("Collective not found");
    collective.treasury += amount;
  }

  withdrawFromTreasury(collectiveId: string, to: Address, amount: bigint): void {
    const collective = this.collectives.get(collectiveId);
    if (!collective) throw new Error("Collective not found");
    if (collective.treasury < amount) throw new Error("Insufficient treasury");
    collective.treasury -= amount;
  }

  createProposal(
    collectiveId: string,
    proposer: Address,
    title: string,
    description: string,
    targetAction: string,
    callData: string
  ): CollectiveProposal {
    const collective = this.collectives.get(collectiveId);
    if (!collective) throw new Error("Collective not found");
    if (!collective.members.includes(proposer)) throw new Error("Not a member");

    this.proposalCounter++;
    const id = `proposal-${this.proposalCounter}`;

    const proposal: CollectiveProposal = {
      id,
      collectiveId,
      title,
      description,
      proposedBy: proposer,
      targetAction,
      callData,
      votesFor: [],
      votesAgainst: [],
      status: "active",
      createdAt: this.now(),
      votingEnd: this.now() + CollectiveService.VOTING_PERIOD,
      quorum: Math.ceil(collective.members.length / 2),
    };

    this.proposals.set(id, proposal);
    return proposal;
  }

  vote(proposalId: string, voter: Address, inFavor: boolean): void {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error("Proposal not found");
    if (this.now() > proposal.votingEnd) throw new Error("Voting period ended");

    const collective = this.collectives.get(proposal.collectiveId);
    if (!collective || !collective.members.includes(voter)) {
      throw new Error("Not a member");
    }

    // Remove existing vote
    proposal.votesFor = proposal.votesFor.filter(v => v !== voter);
    proposal.votesAgainst = proposal.votesAgainst.filter(v => v !== voter);

    if (inFavor) {
      proposal.votesFor.push(voter);
    } else {
      proposal.votesAgainst.push(voter);
    }

    // Check if quorum reached
    const totalVotes = proposal.votesFor.length + proposal.votesAgainst.length;
    if (totalVotes >= proposal.quorum && proposal.status === "active") {
      if (proposal.votesFor.length > proposal.votesAgainst.length) {
        proposal.status = "passed";
      } else {
        proposal.status = "rejected";
      }
    }
  }

  createTask(
    collectiveId: string,
    creator: Address,
    title: string,
    description: string,
    budget: bigint,
    deadline: number
  ): CollectiveTask {
    const collective = this.collectives.get(collectiveId);
    if (!collective) throw new Error("Collective not found");
    if (!collective.members.includes(creator)) throw new Error("Not a member");
    if (collective.treasury < budget) throw new Error("Insufficient treasury");

    this.taskCounter++;
    const id = `ctask-${this.taskCounter}`;

    const task: CollectiveTask = {
      id,
      collectiveId,
      title,
      description,
      budget,
      deadline,
      assignedTo: null,
      status: "open",
      createdAt: this.now(),
    };

    this.tasks.set(id, task);
    collective.treasury -= budget;
    return task;
  }

  assignTask(taskId: string, worker: Address): void {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error("Task not found");
    if (task.status !== "open") throw new Error("Task not open");

    task.assignedTo = worker;
    task.status = "assigned";
  }

  completeTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error("Task not found");
    if (task.status !== "assigned" && task.status !== "in-progress") {
      throw new Error("Task not completable");
    }

    task.status = "completed";

    // Return remaining treasury
    const collective = this.collectives.get(task.collectiveId);
    if (collective) {
      collective.treasury += task.budget;
    }
  }

  getCollective(id: string): Collective | undefined {
    return this.collectives.get(id);
  }

  getCollectivesByMember(member: Address): Collective[] {
    return Array.from(this.collectives.values()).filter(c => c.members.includes(member));
  }

  getProposal(id: string): CollectiveProposal | undefined {
    return this.proposals.get(id);
  }

  getProposalsByCollective(collectiveId: string): CollectiveProposal[] {
    return Array.from(this.proposals.values()).filter(p => p.collectiveId === collectiveId);
  }

  getTask(id: string): CollectiveTask | undefined {
    return this.tasks.get(id);
  }

  getTasksByCollective(collectiveId: string): CollectiveTask[] {
    return Array.from(this.tasks.values()).filter(t => t.collectiveId === collectiveId);
  }

  getOpenTasks(): CollectiveTask[] {
    return Array.from(this.tasks.values()).filter(t => t.status === "open");
  }
}
