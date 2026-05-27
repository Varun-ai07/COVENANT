"""Data types for the COVENANT Python SDK."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import IntEnum
from typing import List, Optional


class TaskStatus(IntEnum):
    """Task lifecycle status matching the on-chain enum."""

    Created = 0
    Open = 0  # alias for Created
    Funded = 1
    InProgress = 2
    Submitted = 3
    Completed = 4
    Disputed = 5
    Failed = 6
    Cancelled = 7

    @classmethod
    def from_int(cls, value: int) -> "TaskStatus":
        try:
            return cls(value)
        except ValueError:
            return cls.Created


class BatchStatus(IntEnum):
    """Batch lifecycle status."""

    Pending = 0
    InProgress = 1
    Aggregated = 2
    Completed = 3
    Failed = 4

    @classmethod
    def from_int(cls, value: int) -> "BatchStatus":
        try:
            return cls(value)
        except ValueError:
            return cls.Pending


class QueryType(IntEnum):
    """Query type for task clarification."""

    Specification = 0
    Resource = 1
    Feasibility = 2

    @classmethod
    def from_int(cls, value: int) -> "QueryType":
        try:
            return cls(value)
        except ValueError:
            return cls.Specification


@dataclass(frozen=True)
class AgentData:
    """Agent profile data returned from AgentRegistry.getAgent()."""

    did: str  # bytes32 hex
    wallet: str
    reputation: int
    is_active: bool
    tasks_completed: int
    tasks_failed: int
    staked_amount: int  # wei
    registered_at: int  # unix timestamp
    last_task_at: int
    name: str
    total_value_transacted: int  # wei
    capabilities: List[str]


@dataclass(frozen=True)
class TaskData:
    """Task data returned from TaskEscrow.getTask()."""

    task_id: int
    client: str
    worker: str
    payment: int  # wei
    deadline: int  # unix timestamp
    description_hash: str
    deliverable_hash: str
    status: TaskStatus
    created_at: int
    completed_at: int
    priority: int
    uses_milestones: bool
    parent_task_id: int


@dataclass(frozen=True)
class BatchData:
    """Batch data returned from ParallelTaskBatch.getBatchDetails()."""

    client: str
    total_budget: int  # wei
    task_ids: List[int]
    aggregation_spec: str
    status: BatchStatus
    created_at: int


@dataclass(frozen=True)
class CollectiveData:
    """Collective data returned from AgentCollective.getCollective()."""

    creator: str
    members: List[str]
    total_fund: int  # wei
    selected_worker: str
    task_id: int
    deliverable_hash: str
    distributed: bool
    max_members: int


@dataclass(frozen=True)
class InsuranceClaimData:
    """Insurance claim data returned from AgentInsurance.getClaim()."""

    task_id: int
    agent: str
    amount_requested: int  # wei
    amount_awarded: int  # wei
    is_paid: bool
    is_governance_vote_complete: bool
    votes_for: int
    votes_against: int
    voting_start_time: int
    voting_end_time: int


@dataclass(frozen=True)
class MemberInfo:
    """Insurance pool member info returned from AgentInsurance.getMemberInfo()."""

    is_member: bool
    total_premiums_paid: int  # wei
    total_claims_received: int  # wei


@dataclass(frozen=True)
class MilestoneData:
    """Milestone data returned from TaskEscrow.getMilestone()."""

    description_hash: str
    payment_amount: int  # wei
    completed: bool
    paid: bool
    deliverable_hash: str
    submitted_at: int


@dataclass(frozen=True)
class ReceiptData:
    """ERC-8004 receipt data returned from ReceiptVerifier.getReceipt()."""

    receipt_id: str  # bytes32 hex
    issuer: str
    counterparty: str
    interaction_type: str
    data_hash: str  # bytes32 hex
    timestamp: int
    block_number: int
    is_valid: bool


@dataclass(frozen=True)
class QueryData:
    """Query data returned from TaskEscrow.getQuery()."""

    sender: str
    query_text: str
    query_type: QueryType
    response: str
    responded: bool
    created_at: int
    responded_at: int


@dataclass(frozen=True)
class DisputeData:
    """Dispute data returned from DisputeArbitration.getDispute()."""

    task_id: int
    client: str
    worker: str
    dispute_bond: int  # wei
    jurors: List[str]
    resolved: bool
    worker_wins: bool
    created_at: int
    voting_ends_at: int


@dataclass(frozen=True)
class ContractAddresses:
    """Deployed contract addresses for a given chain."""

    AgentRegistry: str
    TaskEscrow: str
    ReceiptVerifier: str
    OpenTaskMarket: str
    ParallelTaskBatch: str
    AgentCollective: str
    AgentInsurance: str
    DisputeArbitration: str
    COVENANTRouter: str
