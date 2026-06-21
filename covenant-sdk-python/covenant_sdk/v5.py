"""COVENANT Python SDK V5 — Extension methods for V5 contracts."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from web3 import Web3
from web3.contract import Contract

from .config import SDKConfig
from .types import ContractAddresses

_ABI_DIR = Path(__file__).parent / "abis"


def _load_abi(name: str) -> List[Dict[str, Any]]:
    path = _ABI_DIR / f"{name}.json"
    with open(path) as f:
        return json.load(f)


class CovenantSDKV5:
    """V5 extension: adds methods for all 12 V5 contracts."""

    def __init__(self, config: SDKConfig) -> None:
        self._config = config
        self._w3 = Web3(Web3.HTTPProvider(config.get_rpc_url()))
        self._addresses = config.get_addresses()
        self._account = None

        if config.private_key:
            from eth_account import Account
            self._account = Account.from_key(config.private_key)

        # Load V5 ABIs and build contract instances
        self._settlement: Contract = self._w3.eth.contract(
            address=Web3.to_checksum_address(self._addresses.CovenantSettlement),
            abi=_load_abi("CovenantSettlement"),
        )
        self._arbitration: Contract = self._w3.eth.contract(
            address=Web3.to_checksum_address(self._addresses.CovenantArbitration),
            abi=_load_abi("CovenantArbitration"),
        )
        self._attestation: Contract = self._w3.eth.contract(
            address=Web3.to_checksum_address(self._addresses.CovenantAttestation),
            abi=_load_abi("CovenantAttestation"),
        )
        self._governance: Contract = self._w3.eth.contract(
            address=Web3.to_checksum_address(self._addresses.CovenantGovernance),
            abi=_load_abi("CovenantGovernance"),
        )
        self._insurance: Contract = self._w3.eth.contract(
            address=Web3.to_checksum_address(self._addresses.InsurancePool),
            abi=_load_abi("InsurancePool"),
        )
        self._training: Contract = self._w3.eth.contract(
            address=Web3.to_checksum_address(self._addresses.TrainingMarketplace),
            abi=_load_abi("TrainingMarketplace"),
        )
        self._grants: Contract = self._w3.eth.contract(
            address=Web3.to_checksum_address(self._addresses.GrantProgram),
            abi=_load_abi("GrantProgram"),
        )
        self._revision: Contract = self._w3.eth.contract(
            address=Web3.to_checksum_address(self._addresses.RevisionManager),
            abi=_load_abi("RevisionManager"),
        )
        self._batch_v5: Contract = self._w3.eth.contract(
            address=Web3.to_checksum_address(self._addresses.ParallelTaskBatch),
            abi=_load_abi("ParallelTaskBatch"),
        )
        self._collective_v5: Contract = self._w3.eth.contract(
            address=Web3.to_checksum_address(self._addresses.AgentCollective),
            abi=_load_abi("AgentCollective"),
        )
        self._multi_escrow: Contract = self._w3.eth.contract(
            address=Web3.to_checksum_address(self._addresses.MultiTokenEscrow),
            abi=_load_abi("MultiTokenEscrow"),
        )

    def _require_wallet(self) -> None:
        if not self._account:
            raise RuntimeError("Private key required for write operations.")

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

    # ═══════════════════════════════════════════════════════════════
    # CovenantSettlement
    # ═══════════════════════════════════════════════════════════════

    def create_stream(self, payee: str, rate_per_second: int, duration: int) -> str:
        """Create a payment stream to a payee."""
        self._require_wallet()
        checksum = Web3.to_checksum_address(payee)
        total = rate_per_second * duration
        tx = self._settlement.functions.createStream(
            checksum, rate_per_second, duration
        ).build_transaction(self._base_tx(value=total))
        return self._send_transaction(tx)

    def withdraw_stream(self, stream_id: int) -> str:
        """Withdraw from an active stream."""
        self._require_wallet()
        tx = self._settlement.functions.withdrawStream(
            stream_id
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def cancel_stream(self, stream_id: int) -> str:
        """Cancel an active stream."""
        self._require_wallet()
        tx = self._settlement.functions.cancelStream(
            stream_id
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def get_stream(self, stream_id: int) -> Dict[str, Any]:
        """Get stream details."""
        result = self._settlement.functions.getStream(stream_id).call()
        return {
            "payer": result[0], "payee": result[1],
            "rate_per_second": result[2], "start_time": result[3],
            "end_time": result[4], "deposited": result[5],
            "streamed": result[6], "active": result[7],
        }

    def stream_count(self) -> int:
        return self._settlement.functions.streamCount().call()

    def claimable_amount(self, stream_id: int) -> int:
        return self._settlement.functions.claimableAmount(stream_id).call()

    def settle_receipt(self, payer: str, payee: str, amount: int, nonce: int, payer_signature: bytes) -> str:
        self._require_wallet()
        tx = self._settlement.functions.settleReceipt(
            Web3.to_checksum_address(payer),
            Web3.to_checksum_address(payee),
            amount, nonce, payer_signature,
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def receipt_count(self) -> int:
        return self._settlement.functions.receiptCount().call()

    # ═══════════════════════════════════════════════════════════════
    # CovenantArbitration
    # ═══════════════════════════════════════════════════════════════

    def create_dispute(self, task_id: int, evidence_hash: bytes) -> str:
        self._require_wallet()
        tx = self._arbitration.functions.createDispute(
            task_id, evidence_hash
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def stake_for_dispute(self, dispute_id: int, amount: int) -> str:
        self._require_wallet()
        tx = self._arbitration.functions.stakeForDispute(
            dispute_id
        ).build_transaction(self._base_tx(value=amount))
        return self._send_transaction(tx)

    def settle_dispute(self, dispute_id: int) -> str:
        self._require_wallet()
        tx = self._arbitration.functions.settleDispute(
            dispute_id
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def submit_ruling(self, dispute_id: int, ruling: int, split_bps: int, arbiter_sig: bytes) -> str:
        self._require_wallet()
        tx = self._arbitration.functions.submitRuling(
            dispute_id, ruling, split_bps, arbiter_sig
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def get_dispute_v5(self, dispute_id: int) -> Dict[str, Any]:
        result = self._arbitration.functions.getDispute(dispute_id).call()
        return {
            "task_id": result[0], "disputant": result[1],
            "ruling": result[2], "split_bps": result[3],
            "created_at": result[4], "evidence_hash": result[5],
            "client_stake": result[6], "worker_stake": result[7],
            "settled": result[8],
        }

    def dispute_count(self) -> int:
        return self._arbitration.functions.disputeCount().call()

    # ═══════════════════════════════════════════════════════════════
    # CovenantAttestation
    # ═══════════════════════════════════════════════════════════════

    def attest(self, subject: str, schema_hash: bytes, data_hash: bytes, expires_at: int) -> str:
        self._require_wallet()
        tx = self._attestation.functions.attest(
            Web3.to_checksum_address(subject),
            schema_hash, data_hash, expires_at,
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def verify_attestation(self, attestation_id: bytes) -> Dict[str, Any]:
        result = self._attestation.functions.verify(attestation_id).call()
        return {"valid": result[0], "attestation": result[1]}

    def attestation_count(self) -> int:
        return self._attestation.functions.attestationCount().call()

    def get_agent_attestations(self, agent: str) -> List[bytes]:
        return self._attestation.functions.getAgentAttestations(
            Web3.to_checksum_address(agent)
        ).call()

    def register_issuer(self, issuer: str, name: str) -> str:
        self._require_wallet()
        tx = self._attestation.functions.registerIssuer(
            Web3.to_checksum_address(issuer), name
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def revoke_attestation(self, attestation_id: bytes) -> str:
        self._require_wallet()
        tx = self._attestation.functions.revoke(
            attestation_id
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    # ═══════════════════════════════════════════════════════════════
    # CovenantGovernance
    # ═══════════════════════════════════════════════════════════════

    def propose(self, target: str, call_data: bytes, description_hash: bytes, voting_period: int) -> str:
        self._require_wallet()
        tx = self._governance.functions.propose(
            Web3.to_checksum_address(target),
            call_data, description_hash, voting_period,
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def submit_votes(self, proposal_id: int, for_votes: int, against_votes: int, guardian_sig: bytes) -> str:
        self._require_wallet()
        tx = self._governance.functions.submitVotes(
            proposal_id, for_votes, against_votes, guardian_sig
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def execute_proposal(self, proposal_id: int) -> str:
        self._require_wallet()
        tx = self._governance.functions.executeProposal(
            proposal_id
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def veto_proposal(self, proposal_id: int) -> str:
        self._require_wallet()
        tx = self._governance.functions.vetoProposal(
            proposal_id
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def get_proposal(self, proposal_id: int) -> Dict[str, Any]:
        result = self._governance.functions.getProposal(proposal_id).call()
        return {
            "proposer": result[0], "description_hash": result[1],
            "call_data": result[2], "target": result[3],
            "voting_end": result[4], "execution_delay": result[5],
            "status": result[6], "for_votes": result[7],
            "against_votes": result[8],
        }

    def proposal_count(self) -> int:
        return self._governance.functions.proposalCount().call()

    def quorum(self) -> int:
        return self._governance.functions.quorum().call()

    # ═══════════════════════════════════════════════════════════════
    # InsurancePool
    # ═══════════════════════════════════════════════════════════════

    def join_pool(self, amount: int) -> str:
        self._require_wallet()
        tx = self._insurance.functions.joinPool().build_transaction(
            self._base_tx(value=amount)
        )
        return self._send_transaction(tx)

    def file_claim(self, task_id: int, amount: int) -> str:
        self._require_wallet()
        tx = self._insurance.functions.fileClaim(
            task_id, amount
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def vote_on_claim(self, claim_id: int, in_favor: bool) -> str:
        self._require_wallet()
        tx = self._insurance.functions.voteOnClaim(
            claim_id, in_favor
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def approve_claim(self, claim_id: int) -> str:
        self._require_wallet()
        tx = self._insurance.functions.approveClaim(
            claim_id
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def get_pool_balance(self) -> int:
        return self._insurance.functions.getPoolBalance().call()

    def claim_count(self) -> int:
        return self._insurance.functions.claimCount().call()

    def member_count(self) -> int:
        return self._insurance.functions.memberCount().call()

    def get_claim_v5(self, claim_id: int) -> Dict[str, Any]:
        result = self._insurance.functions.claims(claim_id).call()
        return {
            "claimant": result[0], "task_id": result[1],
            "amount_requested": result[2], "approved": result[3],
            "paid": result[4], "votes_for": result[5],
            "votes_against": result[6],
        }

    # ═══════════════════════════════════════════════════════════════
    # TrainingMarketplace
    # ═══════════════════════════════════════════════════════════════

    def create_training(self, title: str, price: int) -> str:
        self._require_wallet()
        tx = self._training.functions.createTraining(
            title, price
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def enroll_training(self, training_id: int, price: int) -> str:
        self._require_wallet()
        tx = self._training.functions.enroll(
            training_id
        ).build_transaction(self._base_tx(value=price))
        return self._send_transaction(tx)

    def get_training(self, training_id: int) -> Dict[str, Any]:
        result = self._training.functions.trainings(training_id).call()
        return {
            "instructor": result[0], "title": result[1],
            "price": result[2], "active": result[3],
            "enrollment_count": result[4],
        }

    def training_count(self) -> int:
        return self._training.functions.trainingCount().call()

    # ═══════════════════════════════════════════════════════════════
    # GrantProgram
    # ═══════════════════════════════════════════════════════════════

    def deposit_to_grants(self, amount: int) -> str:
        self._require_wallet()
        tx = self._grants.functions.deposit().build_transaction(
            self._base_tx(value=amount)
        )
        return self._send_transaction(tx)

    def apply_grant(self, amount: int) -> str:
        self._require_wallet()
        tx = self._grants.functions.applyGrant(
            amount
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def vote_grant(self, grant_id: int, in_favor: bool) -> str:
        self._require_wallet()
        tx = self._grants.functions.voteGrant(
            grant_id, in_favor
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def disburse_grant(self, grant_id: int) -> str:
        self._require_wallet()
        tx = self._grants.functions.disburseGrant(
            grant_id
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def get_grant(self, grant_id: int) -> Dict[str, Any]:
        result = self._grants.functions.grants(grant_id).call()
        return {
            "applicant": result[0], "amount": result[1],
            "approved": result[2], "disbursed": result[3],
            "votes_for": result[4], "votes_against": result[5],
        }

    def grant_count(self) -> int:
        return self._grants.functions.grantCount().call()

    def treasury(self) -> int:
        return self._grants.functions.treasury().call()

    # ═══════════════════════════════════════════════════════════════
    # RevisionManager
    # ═══════════════════════════════════════════════════════════════

    def request_revision(self, task_id: int, feedback_hash: str) -> str:
        self._require_wallet()
        tx = self._revision.functions.requestRevision(
            task_id, feedback_hash
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def submit_revision(self, task_id: int, new_hash: bytes) -> str:
        self._require_wallet()
        tx = self._revision.functions.submitRevision(
            task_id, new_hash
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def get_revision_count(self, task_id: int) -> int:
        return self._revision.functions.getRevisionCount(task_id).call()

    def get_latest_revision(self, task_id: int) -> Dict[str, Any]:
        result = self._revision.functions.getLatestRevision(task_id).call()
        return {
            "task_id": result[0], "revision_number": result[1],
            "deliverable_hash": result[2], "feedback_hash": result[3],
            "requested_by": result[4], "requested_at": result[5],
            "completed_at": result[6], "completed": result[7],
        }

    def revision_allowed(self, task_id: int) -> bool:
        return self._revision.functions.revisionAllowed(task_id).call()

    # ═══════════════════════════════════════════════════════════════
    # ParallelTaskBatch (V5)
    # ═══════════════════════════════════════════════════════════════

    def create_batch_v5(
        self, workers: List[str], payments: List[int],
        deadlines: List[int], description_hashes: List[bytes],
        aggregation_spec: bytes,
    ) -> str:
        self._require_wallet()
        checksums = [Web3.to_checksum_address(w) for w in workers]
        total = sum(payments)
        tx = self._batch_v5.functions.createBatch(
            checksums, payments, deadlines, description_hashes, aggregation_spec
        ).build_transaction(self._base_tx(value=total))
        return self._send_transaction(tx)

    def get_batch_v5(self, batch_id: int) -> Dict[str, Any]:
        result = self._batch_v5.functions.getBatch(batch_id).call()
        return {
            "client": result[0], "total_budget": result[1],
            "task_ids": result[2], "aggregation_spec": result[3],
            "status": result[4], "created_at": result[5],
            "aggregated_result_hash": result[6],
        }

    def aggregate_results(self, batch_id: int) -> str:
        self._require_wallet()
        tx = self._batch_v5.functions.aggregateResults(
            batch_id
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    # ═══════════════════════════════════════════════════════════════
    # AgentCollective (V5)
    # ═══════════════════════════════════════════════════════════════

    def create_collective_v5(self, min_contribution: int, max_members: int) -> str:
        self._require_wallet()
        tx = self._collective_v5.functions.createCollective(
            min_contribution, max_members
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def join_collective_v5(self, collective_id: int, amount: int) -> str:
        self._require_wallet()
        tx = self._collective_v5.functions.joinCollective(
            collective_id
        ).build_transaction(self._base_tx(value=amount))
        return self._send_transaction(tx)

    def launch_collective_task(
        self, collective_id: int, worker: str,
        payment: int, deadline: int, description_hash: bytes,
    ) -> str:
        self._require_wallet()
        tx = self._collective_v5.functions.launchCollectiveTask(
            collective_id, Web3.to_checksum_address(worker),
            payment, deadline, description_hash,
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def get_collective_v5(self, collective_id: int) -> Dict[str, Any]:
        result = self._collective_v5.functions.getCollective(collective_id).call()
        return {
            "member_count": result[0], "total_fund": result[1],
            "launched": result[2],
        }

    # ═══════════════════════════════════════════════════════════════
    # MultiTokenEscrow
    # ═══════════════════════════════════════════════════════════════

    def create_task_erc20(self, worker: str, token: str, amount: int, deadline: int) -> str:
        self._require_wallet()
        tx = self._multi_escrow.functions.createTaskERC20(
            Web3.to_checksum_address(worker),
            Web3.to_checksum_address(token),
            amount, deadline,
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def verify_task_erc20(self, task_id: int, success: bool) -> str:
        self._require_wallet()
        tx = self._multi_escrow.functions.verifyTask(
            task_id, success
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def multi_token_task_count(self) -> int:
        return self._multi_escrow.functions.taskCount().call()

    def is_accepted_token(self, token: str) -> bool:
        return self._multi_escrow.functions.acceptedTokens(
            Web3.to_checksum_address(token)
        ).call()
