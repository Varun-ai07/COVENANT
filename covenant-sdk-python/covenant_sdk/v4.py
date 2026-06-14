"""COVENANT Python SDK - V4 contract support for the redesigned minimal trust layer."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from eth_account import Account
from eth_account.signers.local import LocalAccount
from web3 import Web3
from web3.contract import Contract
from web3.types import TxReceipt, Wei

from .config import SDKConfig, V4_ADDRESSES
from .sdk import _load_abi

_ABI_DIR = Path(__file__).parent / "abis"


class CovenantSDKV4:
    """Synchronous Python client for the COVENANT V4 protocol.

    V4 uses 6 core contracts: Identity, Escrow, Settlement, Arbitration,
    Governance, Attestation.

    Args:
        config: SDK configuration (rpc_url, private_key, chain_id, etc.)
        v4_addresses: Optional V4 contract address overrides.

    Example::

        sdk = CovenantSDKV4(SDKConfig(rpc_url="https://sepolia.base.org"))
        agent = sdk.get_agent("0x...")
    """

    def __init__(
        self,
        config: SDKConfig,
        v4_addresses: Optional[Dict[str, str]] = None,
    ) -> None:
        self._config = config
        self._w3 = Web3(Web3.HTTPProvider(config.get_rpc_url()))
        self._v4_addrs = v4_addresses or V4_ADDRESSES.get(config.chain_id, {})
        self._account: Optional[LocalAccount] = None

        if config.private_key:
            self._account = Account.from_key(config.private_key)

        def _load(name: str) -> List[Dict[str, Any]]:
            path = _ABI_DIR / f"{name}.json"
            with open(path) as f:
                artifact = json.load(f)
            return artifact.get("abi", artifact)

        def _contract(name: str, addr_key: str) -> Optional[Contract]:
            addr = self._v4_addrs.get(addr_key)
            if not addr or addr == "0x0000000000000000000000000000000000000000":
                return None
            return self._w3.eth.contract(
                address=Web3.to_checksum_address(addr),
                abi=_load(name),
            )

        self._identity: Optional[Contract] = _contract("CovenantIdentity", "CovenantIdentity")
        self._escrow: Optional[Contract] = _contract("CovenantEscrow", "CovenantEscrow")
        self._settlement: Optional[Contract] = _contract("CovenantSettlement", "CovenantSettlement")
        self._arbitration: Optional[Contract] = _contract("CovenantArbitration", "CovenantArbitration")
        self._governance: Optional[Contract] = _contract("CovenantGovernance", "CovenantGovernance")

    @property
    def addresses(self) -> Dict[str, str]:
        return dict(self._v4_addrs)

    @property
    def w3(self) -> Web3:
        return self._w3

    # =========================================================================
    # Identity Methods
    # =========================================================================

    def get_agent(self, address: str) -> Any:
        assert self._identity is not None, "CovenantIdentity not deployed"
        checksum = Web3.to_checksum_address(address)
        return self._identity.functions.getAgent(checksum).call()

    def is_registered(self, address: str) -> bool:
        assert self._identity is not None, "CovenantIdentity not deployed"
        checksum = Web3.to_checksum_address(address)
        return self._identity.functions.isRegistered(checksum).call()

    def register(self, stake_eth: float, metadata_root: str) -> str:
        self._require_wallet()
        assert self._identity is not None
        assert self._account is not None
        stake_wei = self._w3.to_wei(stake_eth, "ether")
        tx = self._identity.functions.register(
            int(stake_wei), bytes.fromhex(metadata_root[2:]) if metadata_root.startswith("0x") else bytes.fromhex(metadata_root)
        ).build_transaction(self._base_tx(value=stake_wei))
        return self._send_transaction(tx)

    def increase_stake(self) -> str:
        self._require_wallet()
        assert self._identity is not None
        tx = self._identity.functions.increaseStake().build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def deactivate(self) -> str:
        self._require_wallet()
        assert self._identity is not None
        tx = self._identity.functions.deactivate().build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def grant_capability(
        self,
        agent: str,
        capability_hash: str,
        expiry: int,
        value_limit: int,
    ) -> str:
        self._require_wallet()
        assert self._identity is not None
        checksum = Web3.to_checksum_address(agent)
        cap_hash = bytes.fromhex(capability_hash[2:]) if capability_hash.startswith("0x") else bytes.fromhex(capability_hash)
        tx = self._identity.functions.grantCapability(
            checksum, cap_hash, expiry, value_limit
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def revoke_capability(self, agent: str, capability_hash: str) -> str:
        self._require_wallet()
        assert self._identity is not None
        checksum = Web3.to_checksum_address(agent)
        cap_hash = bytes.fromhex(capability_hash[2:]) if capability_hash.startswith("0x") else bytes.fromhex(capability_hash)
        tx = self._identity.functions.revokeCapability(
            checksum, cap_hash
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def has_capability(self, agent: str, capability_hash: str) -> bool:
        assert self._identity is not None
        checksum = Web3.to_checksum_address(agent)
        cap_hash = bytes.fromhex(capability_hash[2:]) if capability_hash.startswith("0x") else bytes.fromhex(capability_hash)
        return self._identity.functions.hasCapability(checksum, cap_hash).call()

    # =========================================================================
    # Escrow Methods
    # =========================================================================

    def create_task(
        self,
        worker: str,
        payment_eth: float,
        deadline: int,
        meta_hash: str,
    ) -> str:
        self._require_wallet()
        assert self._escrow is not None
        checksum = Web3.to_checksum_address(worker)
        payment_wei = self._w3.to_wei(payment_eth, "ether")
        meta = bytes.fromhex(meta_hash[2:]) if meta_hash.startswith("0x") else bytes.fromhex(meta_hash)
        tx = self._escrow.functions.createTask(
            checksum, int(payment_wei), deadline, meta
        ).build_transaction(self._base_tx(value=payment_wei))
        return self._send_transaction(tx)

    def fund_task(self, task_id: int) -> str:
        self._require_wallet()
        assert self._escrow is not None
        tx = self._escrow.functions.fundTask(task_id).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def submit_work(self, task_id: int, deliverable_hash: str) -> str:
        self._require_wallet()
        assert self._escrow is not None
        dh = bytes.fromhex(deliverable_hash[2:]) if deliverable_hash.startswith("0x") else bytes.fromhex(deliverable_hash)
        tx = self._escrow.functions.submitWork(task_id, dh).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def complete_task(self, task_id: int, client_signature: str) -> str:
        self._require_wallet()
        assert self._escrow is not None
        sig = bytes.fromhex(client_signature[2:]) if client_signature.startswith("0x") else bytes.fromhex(client_signature)
        tx = self._escrow.functions.completeTask(task_id, sig).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def dispute_task(self, task_id: int) -> str:
        self._require_wallet()
        assert self._escrow is not None
        tx = self._escrow.functions.disputeTask(task_id).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def get_task(self, task_id: int) -> Any:
        assert self._escrow is not None
        return self._escrow.functions.getTask(task_id).call()

    def get_task_count(self) -> int:
        assert self._escrow is not None
        return self._escrow.functions.taskCount().call()

    # =========================================================================
    # Settlement Methods
    # =========================================================================

    def settle_receipt(
        self,
        payer: str,
        payee: str,
        amount: int,
        nonce: int,
        payer_signature: str,
    ) -> str:
        self._require_wallet()
        assert self._settlement is not None
        payer_addr = Web3.to_checksum_address(payer)
        payee_addr = Web3.to_checksum_address(payee)
        sig = bytes.fromhex(payer_signature[2:]) if payer_signature.startswith("0x") else bytes.fromhex(payer_signature)
        tx = self._settlement.functions.settleReceipt(
            payer_addr, payee_addr, amount, nonce, sig
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def get_settlement_count(self) -> int:
        assert self._settlement is not None
        return self._settlement.functions.receiptCount().call()

    # =========================================================================
    # Arbitration Methods
    # =========================================================================

    def create_dispute(self, task_id: int, evidence_hash: str) -> str:
        self._require_wallet()
        assert self._arbitration is not None
        eh = bytes.fromhex(evidence_hash[2:]) if evidence_hash.startswith("0x") else bytes.fromhex(evidence_hash)
        tx = self._arbitration.functions.createDispute(task_id, eh).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def stake_for_dispute(self, dispute_id: int) -> str:
        self._require_wallet()
        assert self._arbitration is not None
        tx = self._arbitration.functions.stakeForDispute(dispute_id).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def submit_ruling(
        self,
        dispute_id: int,
        ruling: int,
        split_bps: int,
        arbiter_signature: str,
    ) -> str:
        self._require_wallet()
        assert self._arbitration is not None
        sig = bytes.fromhex(arbiter_signature[2:]) if arbiter_signature.startswith("0x") else bytes.fromhex(arbiter_signature)
        tx = self._arbitration.functions.submitRuling(
            dispute_id, ruling, split_bps, sig
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def settle_dispute(self, dispute_id: int) -> str:
        self._require_wallet()
        assert self._arbitration is not None
        tx = self._arbitration.functions.settleDispute(dispute_id).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def get_dispute(self, dispute_id: int) -> Any:
        assert self._arbitration is not None
        return self._arbitration.functions.getDispute(dispute_id).call()

    def get_dispute_count(self) -> int:
        assert self._arbitration is not None
        return self._arbitration.functions.disputeCount().call()

    # =========================================================================
    # Governance Methods
    # =========================================================================

    def create_proposal(
        self,
        target: str,
        call_data: str,
        description_hash: str,
        voting_period: int,
    ) -> str:
        self._require_wallet()
        assert self._governance is not None
        target_addr = Web3.to_checksum_address(target)
        cd = bytes.fromhex(call_data[2:]) if call_data.startswith("0x") else bytes.fromhex(call_data)
        dh = bytes.fromhex(description_hash[2:]) if description_hash.startswith("0x") else bytes.fromhex(description_hash)
        tx = self._governance.functions.propose(
            target_addr, cd, dh, voting_period
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def cast_vote(
        self,
        proposal_id: int,
        for_votes: int,
        against_votes: int,
        guardian_signature: str,
    ) -> str:
        self._require_wallet()
        assert self._governance is not None
        sig = bytes.fromhex(guardian_signature[2:]) if guardian_signature.startswith("0x") else bytes.fromhex(guardian_signature)
        tx = self._governance.functions.submitVotes(
            proposal_id, for_votes, against_votes, sig
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def execute_proposal(self, proposal_id: int) -> str:
        self._require_wallet()
        assert self._governance is not None
        tx = self._governance.functions.executeProposal(proposal_id).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def get_proposal(self, proposal_id: int) -> Any:
        assert self._governance is not None
        return self._governance.functions.getProposal(proposal_id).call()

    # =========================================================================
    # Stats
    # =========================================================================

    def get_stats(self) -> Dict[str, Any]:
        stats: Dict[str, Any] = {}
        if self._identity:
            stats["total_agents"] = self._identity.functions.totalAgents().call()
        if self._escrow:
            stats["total_tasks"] = self._escrow.functions.taskCount().call()
        if self._arbitration:
            stats["total_disputes"] = self._arbitration.functions.disputeCount().call()
        return stats

    # =========================================================================
    # Private Helpers
    # =========================================================================

    def _require_wallet(self) -> None:
        if not self._account:
            raise RuntimeError(
                "Private key required for write operations. "
                "Pass private_key in SDKConfig."
            )

    def _base_tx(self, value: int = 0) -> Dict[str, Any]:
        assert self._account is not None
        return {
            "from": self._account.address,
            "nonce": self._w3.eth.get_transaction_count(self._account.address),
            "gas": 0,
            "maxFeePerGas": self._w3.eth.gas_price * 2,
            "maxPriorityFeePerGas": self._w3.to_wei(1, "gwei"),
            "value": value,
            "chainId": self._config.chain_id,
        }

    def _send_transaction(self, tx: Dict[str, Any]) -> str:
        assert self._account is not None
        tx["gas"] = self._w3.eth.estimate_gas(tx)
        signed = self._account.sign_transaction(tx)
        tx_hash = self._w3.eth.send_raw_transaction(signed.raw_transaction)
        return tx_hash.hex()
