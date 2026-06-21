"""COVENANT Python SDK - Autonomous Agent Enforcement Protocol client."""

from .config import DEFAULT_ADDRESSES, DEFAULT_RPC_URLS, SDKConfig
from .sdk import CovenantSDK
from .v5 import CovenantSDKV5
from .types import (
    AgentData,
    BatchData,
    BatchStatus,
    CollectiveData,
    ContractAddresses,
    DisputeData,
    InsuranceClaimData,
    MemberInfo,
    MilestoneData,
    QueryData,
    QueryType,
    ReceiptData,
    TaskData,
    TaskStatus,
)

__all__ = [
    "CovenantSDK",
    "CovenantSDKV5",
    "SDKConfig",
    "AgentData",
    "BatchData",
    "BatchStatus",
    "CollectiveData",
    "ContractAddresses",
    "DisputeData",
    "InsuranceClaimData",
    "MemberInfo",
    "MilestoneData",
    "QueryData",
    "QueryType",
    "ReceiptData",
    "TaskData",
    "TaskStatus",
    "DEFAULT_ADDRESSES",
    "DEFAULT_RPC_URLS",
]

__version__ = "0.3.0"
