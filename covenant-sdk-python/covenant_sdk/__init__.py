"""COVENANT Python SDK - Autonomous Agent Enforcement Protocol client."""

from .config import DEFAULT_ADDRESSES, DEFAULT_RPC_URLS, V4_ADDRESSES, SDKConfig
from .sdk import CovenantSDK
from .v4 import CovenantSDKV4
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
    "CovenantSDKV4",
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
    "V4_ADDRESSES",
]

__version__ = "0.3.0"
