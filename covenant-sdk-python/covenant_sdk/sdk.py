"""COVENANT Python SDK - synchronous client for the Autonomous Agent Enforcement Protocol."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from eth_account import Account
from eth_account.signers.local import LocalAccount
from web3 import Web3
from web3.contract import Contract
from web3.types import TxReceipt, Wei

from .config import SDKConfig
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

_ABI_DIR = Path(__file__).parent / "abis"


def _load_abi(name: str) -> List[Dict[str, Any]]:
    """Load an ABI JSON file from the abis/ directory."""
    path = _ABI_DIR / f"{name}.json"
    with open(path) as f:
        return json.load(f)


class CovenantSDK:
    """Synchronous Python client for the COVENANT protocol.

    Args:
        config: SDK configuration (rpc_url, private_key, chain_id, etc.)

    Example::

        sdk = CovenantSDK(SDKConfig(rpc_url="https://sepolia.base.org"))
        agent = sdk.get_agent("0x...")
        agents = sdk.find_agents("data-analysis")
    """

    def __init__(self, config: SDKConfig) -> None:
        self._config = config
        self._w3 = Web3(Web3.HTTPProvider(config.get_rpc_url()))
        self._addresses = config.get_addresses()
        self._account: Optional[LocalAccount] = None

        if config.private_key:
            self._account = Account.from_key(config.private_key)

        # Load ABIs
        self._registry_abi = _load_abi("AgentRegistry")
        self._escrow_abi = _load_abi("TaskEscrow")
        self._market_abi = _load_abi("OpenTaskMarket")
        self._batch_abi = _load_abi("ParallelTaskBatch")
        self._collective_abi = _load_abi("AgentCollective")
        self._insurance_abi = _load_abi("AgentInsurance")
        self._receipt_abi = _load_abi("ReceiptVerifier")
        self._dispute_abi = _load_abi("DisputeArbitration")

        # Build contract instances
        self._registry: Contract = self._w3.eth.contract(
            address=Web3.to_checksum_address(self._addresses.AgentRegistry),
            abi=self._registry_abi,
        )
        self._escrow: Contract = self._w3.eth.contract(
            address=Web3.to_checksum_address(self._addresses.TaskEscrow),
            abi=self._escrow_abi,
        )
        self._market: Contract = self._w3.eth.contract(
            address=Web3.to_checksum_address(self._addresses.OpenTaskMarket),
            abi=self._market_abi,
        )
        self._batch: Contract = self._w3.eth.contract(
            address=Web3.to_checksum_address(self._addresses.ParallelTaskBatch),
            abi=self._batch_abi,
        )
        self._collective: Contract = self._w3.eth.contract(
            address=Web3.to_checksum_address(self._addresses.AgentCollective),
            abi=self._collective_abi,
        )
        self._insurance: Contract = self._w3.eth.contract(
            address=Web3.to_checksum_address(self._addresses.AgentInsurance),
            abi=self._insurance_abi,
        )
        self._receipt: Contract = self._w3.eth.contract(
            address=Web3.to_checksum_address(self._addresses.ReceiptVerifier),
            abi=self._receipt_abi,
        )
        self._dispute: Contract = self._w3.eth.contract(
            address=Web3.to_checksum_address(self._addresses.DisputeArbitration),
            abi=self._dispute_abi,
        )

    # =========================================================================
    # Properties
    # =========================================================================

    @property
    def addresses(self) -> ContractAddresses:
        """Contract addresses in use."""
        return self._addresses

    @property
    def w3(self) -> Web3:
        """Underlying Web3 instance."""
        return self._w3

    # =========================================================================
    # Agent Methods
    # =========================================================================

    def get_agent(self, address: str) -> AgentData:
        """Get agent profile by address.

        Args:
            address: Ethereum address of the agent.

        Returns:
            AgentData with on-chain profile fields.
        """
        checksum = Web3.to_checksum_address(address)
        result = self._registry.functions.getAgent(checksum).call()
        return self._parse_agent(result)

    def get_agent_count(self) -> int:
        """Get total number of registered agents."""
        return self._registry.functions.getAgentCount().call()

    def find_agents(
        self,
        capability: str,
        min_reputation: Optional[int] = None,
        limit: int = 20,
    ) -> List[str]:
        """Find agents by capability tag.

        Args:
            capability: Capability string to search for.
            min_reputation: Optional minimum reputation filter.
            limit: Max results to return (default 20).

        Returns:
            List of agent addresses matching the criteria.
        """
        addresses = self._registry.functions.getAgentsByCapability(capability).call()

        if min_reputation is not None:
            filtered: List[str] = []
            for addr in addresses:
                agent = self.get_agent(addr)
                if agent.reputation >= min_reputation:
                    filtered.append(addr)
                if len(filtered) >= limit:
                    break
            return filtered

        return list(addresses[:limit])

    def get_all_agents(self, offset: int = 0, limit: int = 50) -> List[str]:
        """Get all registered agent addresses.

        Args:
            offset: Unused (ABI does not support pagination).
            limit: Max results to return.

        Returns:
            List of agent addresses.
        """
        addresses = self._registry.functions.getAllAgents().call()
        return list(addresses[offset : offset + limit])

    def register_agent(
        self, name: str, capabilities: List[str], stake_eth: float
    ) -> str:
        """Register a new agent on-chain.

        Args:
            name: Agent display name.
            capabilities: List of capability tags.
            stake_eth: Stake amount in ETH.

        Returns:
            Transaction hash.
        """
        self._require_wallet()
        assert self._account is not None

        stake_wei = self._w3.to_wei(stake_eth, "ether")
        tx = self._registry.functions.register(
            name, capabilities
        ).build_transaction(self._base_tx(value=stake_wei))
        return self._send_transaction(tx)

    # =========================================================================
    # Task Methods
    # =========================================================================

    def get_task(self, task_id: int) -> TaskData:
        """Get task data by ID.

        Args:
            task_id: Numeric task ID.

        Returns:
            TaskData with on-chain task fields.
        """
        result = self._escrow.functions.getTask(task_id).call()
        return self._parse_task(task_id, result)

    def get_task_count(self) -> int:
        """Get total number of tasks created."""
        return self._escrow.functions.taskCounter().call()

    def get_client_tasks(self, client: str) -> List[int]:
        """Get all task IDs for a client address.

        Args:
            client: Client's Ethereum address.

        Returns:
            List of task IDs.
        """
        checksum = Web3.to_checksum_address(client)
        return self._escrow.functions.getClientTasks(checksum).call()

    def get_worker_tasks(self, worker: str) -> List[int]:
        """Get all task IDs for a worker address.

        Args:
            worker: Worker's Ethereum address.

        Returns:
            List of task IDs.
        """
        checksum = Web3.to_checksum_address(worker)
        return self._escrow.functions.getWorkerTasks(checksum).call()

    def create_task(
        self,
        worker: str,
        payment_eth: float,
        deadline: int,
        description_hash: str,
    ) -> str:
        """Create a new task with escrowed payment.

        Args:
            worker: Worker agent address.
            payment_eth: Payment amount in ETH.
            deadline: Unix timestamp deadline.
            description_hash: IPFS CID or hash of task description.

        Returns:
            Transaction hash.
        """
        self._require_wallet()
        checksum = Web3.to_checksum_address(worker)
        tx = self._escrow.functions.createTask(
            checksum, deadline, description_hash
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def submit_work(self, task_id: int, deliverable_hash: str) -> str:
        """Submit work deliverable for a task.

        Args:
            task_id: Task ID.
            deliverable_hash: IPFS CID or hash of the deliverable.

        Returns:
            Transaction hash.
        """
        self._require_wallet()
        tx = self._escrow.functions.submitWork(
            task_id, deliverable_hash
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def verify_task(self, task_id: int, success: bool) -> str:
        """Verify a submitted task and release/reject payment.

        Args:
            task_id: Task ID.
            success: True to approve, False to reject.

        Returns:
            Transaction hash.
        """
        self._require_wallet()
        tx = self._escrow.functions.verifyTask(
            task_id, success
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def dispute_task(self, task_id: int, dispute_bond_eth: float) -> str:
        """Open a dispute on a task.

        Args:
            task_id: Task ID.
            dispute_bond_eth: Dispute bond amount in ETH.

        Returns:
            Transaction hash.
        """
        self._require_wallet()
        bond_wei = self._w3.to_wei(dispute_bond_eth, "ether")
        tx = self._escrow.functions.disputeTask(
            task_id
        ).build_transaction(self._base_tx(value=bond_wei))
        return self._send_transaction(tx)

    # =========================================================================
    # Open Task Market Methods
    # =========================================================================

    def post_open_task(
        self, max_payment_eth: float, deadline: int, description_hash: str
    ) -> str:
        """Post an open task for competitive bidding.

        Args:
            max_payment_eth: Maximum payment in ETH (sent as msg.value).
            deadline: Unix timestamp deadline.
            description_hash: IPFS CID or hash of task description.

        Returns:
            Transaction hash.
        """
        self._require_wallet()
        max_payment_wei = self._w3.to_wei(max_payment_eth, "ether")
        tx = self._market.functions.postOpenTask(
            max_payment_wei, deadline, description_hash
        ).build_transaction(self._base_tx(value=max_payment_wei))
        return self._send_transaction(tx)

    def submit_bid(
        self,
        task_id: int,
        price_eth: float,
        time_estimate: int,
        proposal_hash: str,
    ) -> str:
        """Submit a bid on an open task.

        Args:
            task_id: Open task ID.
            price_eth: Bid price in ETH.
            time_estimate: Estimated completion time in seconds.
            proposal_hash: IPFS CID or hash of the proposal.

        Returns:
            Transaction hash.
        """
        self._require_wallet()
        price_wei = self._w3.to_wei(price_eth, "ether")
        tx = self._market.functions.submitBid(
            task_id, price_wei, time_estimate, proposal_hash
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def select_worker(self, task_id: int, worker: str) -> str:
        """Select a winning bidder for an open task.

        Args:
            task_id: Open task ID.
            worker: Address of the selected bidder.

        Returns:
            Transaction hash.
        """
        self._require_wallet()
        checksum = Web3.to_checksum_address(worker)
        tx = self._market.functions.selectWorker(
            task_id, checksum
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    # =========================================================================
    # Batch Operations
    # =========================================================================

    def create_batch(
        self,
        workers: List[str],
        payments: List[float],
        deadlines: List[int],
        description_hashes: List[str],
        aggregation_spec: str,
    ) -> str:
        """Create a batch of tasks for parallel execution.

        Args:
            workers: List of worker addresses.
            payments: List of payment amounts in ETH (one per worker).
            deadlines: List of deadline timestamps (seconds).
            description_hashes: List of IPFS CIDs for task descriptions.
            aggregation_spec: IPFS CID for aggregation specification.

        Returns:
            Transaction hash.
        """
        self._require_wallet()
        if not (len(workers) == len(payments) == len(deadlines) == len(description_hashes)):
            raise ValueError("All arrays must have the same length")

        checksums = [Web3.to_checksum_address(w) for w in workers]
        payments_wei = [self._w3.to_wei(p, "ether") for p in payments]
        total = sum(payments_wei)

        tx = self._batch.functions.createBatch(
            checksums, payments_wei, deadlines, description_hashes, aggregation_spec
        ).build_transaction(self._base_tx(value=total))
        return self._send_transaction(tx)

    def get_batch(self, batch_id: int) -> BatchData:
        """Get batch details by ID.

        Args:
            batch_id: Numeric batch ID.

        Returns:
            BatchData with on-chain batch fields.
        """
        result = self._batch.functions.getBatchDetails(batch_id).call()
        return BatchData(
            client=result[0],
            total_budget=result[1],
            task_ids=[int(tid) for tid in result[2]],
            aggregation_spec=result[3],
            status=BatchStatus.from_int(result[4]),
            created_at=result[5],
        )

    def get_batch_count(self) -> int:
        """Get total number of batches created."""
        return self._batch.functions.batchCounter().call()

    def check_batch_submitted(self, batch_id: int) -> bool:
        """Check if all subtasks in a batch have been submitted.

        Args:
            batch_id: Batch ID to check.

        Returns:
            True if all subtasks are submitted.
        """
        return self._batch.functions.areAllSubtasksSubmitted(batch_id).call()

    def aggregate_results(self, batch_id: int) -> str:
        """Finalize a batch by aggregating all completed task results.

        Args:
            batch_id: Batch ID to finalize.

        Returns:
            Transaction hash.
        """
        self._require_wallet()
        tx = self._batch.functions.aggregateResults(batch_id).build_transaction(
            self._base_tx()
        )
        return self._send_transaction(tx)

    def get_aggregated_result(self, batch_id: int) -> str:
        """Get the aggregated result hash after a batch is finalized.

        Args:
            batch_id: Batch ID.

        Returns:
            Aggregated result hash (bytes32 hex string).
        """
        result = self._batch.functions.getAggregatedResult(batch_id).call()
        return result.hex() if isinstance(result, bytes) else str(result)

    # =========================================================================
    # Collective Operations
    # =========================================================================

    def create_collective(
        self, min_contribution: float, max_members: int, initial_contribution: Optional[float] = None
    ) -> str:
        """Create a new agent collective.

        Args:
            min_contribution: Minimum contribution in ETH to join.
            max_members: Maximum number of members (2-100).
            initial_contribution: Initial ETH contribution (defaults to min_contribution).

        Returns:
            Transaction hash.
        """
        self._require_wallet()
        min_wei = self._w3.to_wei(min_contribution, "ether")
        value = self._w3.to_wei(initial_contribution or min_contribution, "ether")
        tx = self._collective.functions.createCollective(
            min_wei, max_members
        ).build_transaction(self._base_tx(value=value))
        return self._send_transaction(tx)

    def join_collective(self, collective_id: int, contribution: float) -> str:
        """Join an existing collective by contributing ETH.

        Args:
            collective_id: Collective ID to join.
            contribution: Contribution amount in ETH.

        Returns:
            Transaction hash.
        """
        self._require_wallet()
        value = self._w3.to_wei(contribution, "ether")
        tx = self._collective.functions.joinCollective(
            collective_id
        ).build_transaction(self._base_tx(value=value))
        return self._send_transaction(tx)

    def launch_collective_task(
        self,
        collective_id: int,
        worker: str,
        payment: float,
        deadline: int,
        description_hash: str,
    ) -> str:
        """Launch a task from a collective's pooled funds.

        Args:
            collective_id: Collective ID.
            worker: Worker address to assign.
            payment: Payment amount in ETH.
            deadline: Deadline timestamp (seconds).
            description_hash: IPFS CID for task description.

        Returns:
            Transaction hash.
        """
        self._require_wallet()
        checksum = Web3.to_checksum_address(worker)
        payment_wei = self._w3.to_wei(payment, "ether")
        tx = self._collective.functions.launchTask(
            collective_id, checksum, payment_wei, deadline, description_hash
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def get_collective(self, collective_id: int) -> CollectiveData:
        """Get collective details by ID.

        Args:
            collective_id: Collective ID.

        Returns:
            CollectiveData with on-chain collective fields.
        """
        result = self._collective.functions.getCollective(collective_id).call()
        return CollectiveData(
            creator=result[0],
            members=list(result[1]),
            total_fund=result[2],
            selected_worker=result[3],
            task_id=result[4],
            deliverable_hash=result[5].hex() if isinstance(result[5], bytes) else str(result[5]),
            distributed=result[6],
            max_members=result[7],
        )

    def get_collective_count(self) -> int:
        """Get total number of collectives created."""
        return self._collective.functions.collectiveCounter().call()

    # =========================================================================
    # Insurance Operations
    # =========================================================================

    def join_insurance_pool(self, contribution: float) -> str:
        """Join the agent insurance pool by contributing ETH.

        Args:
            contribution: Contribution amount in ETH (min 0.01).

        Returns:
            Transaction hash.
        """
        self._require_wallet()
        value = self._w3.to_wei(contribution, "ether")
        tx = self._insurance.functions.joinPool().build_transaction(
            self._base_tx(value=value)
        )
        return self._send_transaction(tx)

    def pay_premium(self, task_id: int, premium: float) -> str:
        """Pay insurance premium for a specific task.

        Args:
            task_id: Task ID to insure.
            premium: Premium amount in ETH.

        Returns:
            Transaction hash.
        """
        self._require_wallet()
        premium_wei = self._w3.to_wei(premium, "ether")
        tx = self._insurance.functions.payPremium(task_id).build_transaction(
            self._base_tx(value=premium_wei)
        )
        return self._send_transaction(tx)

    def claim_insurance(self, task_id: int) -> str:
        """File an insurance claim for a failed task.

        Args:
            task_id: Task ID to claim insurance for.

        Returns:
            Transaction hash.
        """
        self._require_wallet()
        tx = self._insurance.functions.claimInsurance(task_id).build_transaction(
            self._base_tx()
        )
        return self._send_transaction(tx)

    def get_pool_balance(self) -> int:
        """Get the current balance of the insurance pool.

        Returns:
            Pool balance in wei.
        """
        return self._insurance.functions.getPoolBalance().call()

    def get_member_info(self, agent_address: str) -> MemberInfo:
        """Get insurance membership info for an agent.

        Args:
            agent_address: Agent's Ethereum address.

        Returns:
            MemberInfo with membership details.
        """
        checksum = Web3.to_checksum_address(agent_address)
        result = self._insurance.functions.getMemberInfo(checksum).call()
        return MemberInfo(
            is_member=result[0],
            total_premiums_paid=result[1],
            total_claims_received=result[2],
        )

    def get_claim(self, claim_id: int) -> InsuranceClaimData:
        """Get insurance claim details.

        Args:
            claim_id: Claim ID.

        Returns:
            InsuranceClaimData with claim details.
        """
        result = self._insurance.functions.getClaim(claim_id).call()
        return InsuranceClaimData(
            task_id=result[0],
            agent=result[1],
            amount_requested=result[2],
            amount_awarded=result[3],
            is_paid=result[4],
            is_governance_vote_complete=result[5],
            votes_for=result[6],
            votes_against=result[7],
            voting_start_time=result[8],
            voting_end_time=result[9],
        )

    def get_claim_count(self) -> int:
        """Get total number of insurance claims filed."""
        return self._insurance.functions.claimCounter().call()

    def get_coverage_percent(self) -> int:
        """Get the insurance coverage percentage.

        Returns:
            Coverage percent (e.g., 80 means 80% of task payment is covered).
        """
        return self._insurance.functions.CLAIM_COVERAGE_PERCENT().call()

    # =========================================================================
    # Milestone Operations
    # =========================================================================

    def create_milestone_task(
        self,
        worker: str,
        total_payment: float,
        deadline: int,
        description_hash: str,
        milestone_descriptions: List[str],
        milestone_payments: List[float],
    ) -> str:
        """Create a task with milestone-based payments.

        Args:
            worker: Worker agent address.
            total_payment: Total payment in ETH (sum of milestones).
            deadline: Unix timestamp deadline.
            description_hash: IPFS CID for task description.
            milestone_descriptions: List of milestone description hashes.
            milestone_payments: List of milestone payment amounts in ETH.

        Returns:
            Transaction hash.
        """
        self._require_wallet()
        checksum = Web3.to_checksum_address(worker)
        total_wei = self._w3.to_wei(total_payment, "ether")
        payments_wei = [self._w3.to_wei(p, "ether") for p in milestone_payments]
        tx = self._escrow.functions.createTaskWithMilestones(
            checksum, total_wei, deadline, description_hash,
            milestone_descriptions, payments_wei
        ).build_transaction(self._base_tx(value=total_wei))
        return self._send_transaction(tx)

    def submit_milestone(self, task_id: int, milestone_index: int, deliverable_hash: str) -> str:
        """Submit a deliverable for a specific milestone.

        Args:
            task_id: Task ID.
            milestone_index: Milestone index (0-based).
            deliverable_hash: IPFS CID of milestone deliverable.

        Returns:
            Transaction hash.
        """
        self._require_wallet()
        tx = self._escrow.functions.submitMilestone(
            task_id, milestone_index, deliverable_hash
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def verify_milestone(self, task_id: int, milestone_index: int, success: bool) -> str:
        """Verify a submitted milestone and release its payment.

        Args:
            task_id: Task ID.
            milestone_index: Milestone index (0-based).
            success: Whether the milestone passes verification.

        Returns:
            Transaction hash.
        """
        self._require_wallet()
        tx = self._escrow.functions.verifyMilestone(
            task_id, milestone_index, success
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def get_milestone(self, task_id: int, milestone_index: int) -> MilestoneData:
        """Get details of a specific milestone.

        Args:
            task_id: Task ID.
            milestone_index: Milestone index (0-based).

        Returns:
            MilestoneData with milestone details.
        """
        result = self._escrow.functions.getMilestone(task_id, milestone_index).call()
        return MilestoneData(
            description_hash=result[0],
            payment_amount=result[1],
            completed=result[2],
            paid=result[3],
            deliverable_hash=result[4],
            submitted_at=result[5],
        )

    def get_milestone_count(self, task_id: int) -> int:
        """Get the number of milestones in a task.

        Args:
            task_id: Task ID.

        Returns:
            Number of milestones.
        """
        return self._escrow.functions.getMilestoneCount(task_id).call()

    # =========================================================================
    # Receipt Operations
    # =========================================================================

    def get_receipts(self, address: str) -> List[ReceiptData]:
        """Get all ERC-8004 receipts for an address.

        Args:
            address: Ethereum address to look up receipts for.

        Returns:
            List of ReceiptData for the address.
        """
        checksum = Web3.to_checksum_address(address)
        receipt_ids = self._receipt.functions.getReceiptsByAgent(checksum).call()
        results = []
        for rid in receipt_ids:
            try:
                results.append(self.get_receipt(rid.hex() if isinstance(rid, bytes) else str(rid)))
            except Exception:
                continue
        return results

    def get_receipt(self, receipt_id: str) -> ReceiptData:
        """Get a specific ERC-8004 receipt by ID.

        Args:
            receipt_id: Receipt ID as bytes32 hex string.

        Returns:
            ReceiptData with receipt details.
        """
        if isinstance(receipt_id, str) and receipt_id.startswith("0x"):
            rid = bytes.fromhex(receipt_id[2:])
        else:
            rid = receipt_id.encode() if isinstance(receipt_id, str) else receipt_id
        result = self._receipt.functions.getReceipt(rid).call()
        return ReceiptData(
            receipt_id=result[0].hex() if isinstance(result[0], bytes) else str(result[0]),
            issuer=result[1],
            counterparty=result[2],
            interaction_type=result[3],
            data_hash=result[4].hex() if isinstance(result[4], bytes) else str(result[4]),
            timestamp=result[5],
            block_number=result[6],
            is_valid=result[7],
        )

    def get_receipt_count(self, address: str) -> int:
        """Get the total number of receipts issued for an agent address.

        Args:
            address: Agent's Ethereum address.

        Returns:
            Number of receipts.
        """
        checksum = Web3.to_checksum_address(address)
        return self._receipt.functions.getAgentReceiptCount(checksum).call()

    # =========================================================================
    # Query Operations
    # =========================================================================

    def submit_query(self, task_id: int, query_text: str, query_type: int) -> str:
        """Submit a query about a task during execution.

        Args:
            task_id: Task ID.
            query_text: The query text.
            query_type: Query type (0=Specification, 1=Resource, 2=Feasibility).

        Returns:
            Transaction hash.
        """
        self._require_wallet()
        tx = self._escrow.functions.submitQuery(
            task_id, query_text, query_type
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def respond_to_query(self, task_id: int, response_text: str) -> str:
        """Respond to a worker's query about a task.

        Args:
            task_id: Task ID.
            response_text: The response text.

        Returns:
            Transaction hash.
        """
        self._require_wallet()
        tx = self._escrow.functions.respondToQuery(
            task_id, response_text
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def get_query(self, task_id: int, query_id: int) -> QueryData:
        """Get details of a specific query.

        Args:
            task_id: Task ID.
            query_id: Query index (0-based).

        Returns:
            QueryData with query details.
        """
        result = self._escrow.functions.getQuery(task_id, query_id).call()
        return QueryData(
            sender=result[0],
            query_text=result[1],
            query_type=QueryType.from_int(result[2]),
            response=result[3],
            responded=result[4],
            created_at=result[5],
            responded_at=result[6],
        )

    def get_query_count(self, task_id: int) -> int:
        """Get the number of queries submitted on a task.

        Args:
            task_id: Task ID.

        Returns:
            Number of queries.
        """
        return self._escrow.functions.getQueryCount(task_id).call()

    # =========================================================================
    # Dispute Operations
    # =========================================================================

    def file_dispute(self, task_id: int, bond_eth: float) -> str:
        """File a formal dispute on a task.

        Args:
            task_id: Task ID to dispute.
            bond_eth: Dispute bond amount in ETH.

        Returns:
            Transaction hash.
        """
        self._require_wallet()
        bond_wei = self._w3.to_wei(bond_eth, "ether")
        tx = self._dispute.functions.disputeTask(task_id).build_transaction(
            self._base_tx(value=bond_wei)
        )
        return self._send_transaction(tx)

    def cast_vote(self, dispute_id: int, in_favor_of_worker: bool) -> str:
        """Cast a vote on a dispute.

        Args:
            dispute_id: Dispute ID.
            in_favor_of_worker: True to vote for worker, False for client.

        Returns:
            Transaction hash.
        """
        self._require_wallet()
        tx = self._dispute.functions.castVote(
            dispute_id, in_favor_of_worker
        ).build_transaction(self._base_tx())
        return self._send_transaction(tx)

    def get_dispute(self, dispute_id: int) -> DisputeData:
        """Get dispute details by ID.

        Args:
            dispute_id: Dispute ID.

        Returns:
            DisputeData with dispute details.
        """
        result = self._dispute.functions.getDispute(dispute_id).call()
        return DisputeData(
            task_id=result[0],
            client=result[1],
            worker=result[2],
            dispute_bond=result[3],
            jurors=list(result[4]),
            resolved=result[5],
            worker_wins=result[6],
            created_at=result[7],
            voting_ends_at=result[8],
        )

    def get_dispute_count(self) -> int:
        """Get total number of disputes filed."""
        return self._dispute.functions.disputeCounter().call()

    # =========================================================================
    # Stats & Leaderboard
    # =========================================================================

    def get_stats(self) -> Dict[str, Any]:
        """Get aggregate protocol stats.

        Returns:
            Dictionary with protocol statistics.
        """
        agent_count = self._registry.functions.getAgentCount().call()
        task_count = self._escrow.functions.taskCounter().call()
        return {
            "total_agents": agent_count,
            "total_tasks": task_count,
        }

    def get_leaderboard(self, limit: int = 10) -> List[AgentData]:
        """Get top agents ranked by reputation.

        Args:
            limit: Number of top agents to return.

        Returns:
            List of AgentData sorted by reputation (highest first).
        """
        addresses = self._registry.functions.getAllAgents().call()
        agents = []
        for addr in addresses:
            try:
                agent = self.get_agent(addr)
                if agent.is_active:
                    agents.append(agent)
            except Exception:
                continue
        agents.sort(key=lambda a: a.reputation, reverse=True)
        return agents[:limit]

    # =========================================================================
    # Private Helpers
    # =========================================================================

    def _require_wallet(self) -> None:
        """Raise if no private key is configured."""
        if not self._account:
            raise RuntimeError(
                "Private key required for write operations. "
                "Pass private_key in SDKConfig."
            )

    def _base_tx(self, value: int = 0) -> Dict[str, Any]:
        """Build base transaction parameters."""
        assert self._account is not None
        return {
            "from": self._account.address,
            "nonce": self._w3.eth.get_transaction_count(self._account.address),
            "gas": 0,  # estimated below
            "maxFeePerGas": self._w3.eth.gas_price * 2,
            "maxPriorityFeePerGas": self._w3.to_wei(1, "gwei"),
            "value": value,
            "chainId": self._config.chain_id,
        }

    def _send_transaction(self, tx: Dict[str, Any]) -> str:
        """Estimate gas, sign, and send a transaction. Returns tx hash."""
        assert self._account is not None
        tx["gas"] = self._w3.eth.estimate_gas(tx)
        signed = self._account.sign_transaction(tx)
        tx_hash = self._w3.eth.send_raw_transaction(signed.raw_transaction)
        return tx_hash.hex()

    @staticmethod
    def _parse_agent(result: tuple) -> AgentData:
        """Parse on-chain Agent struct tuple into AgentData."""
        return AgentData(
            did=result[0].hex() if isinstance(result[0], bytes) else str(result[0]),
            wallet=result[1],
            reputation=result[2],
            is_active=bool(result[3]),
            tasks_completed=result[4],
            tasks_failed=result[5],
            staked_amount=result[6],
            registered_at=result[7],
            last_task_at=result[8],
            name=result[9],
            total_value_transacted=result[10],
            capabilities=result[11],
        )

    @staticmethod
    def _parse_task(task_id: int, result: tuple) -> TaskData:
        """Parse on-chain Task struct tuple into TaskData."""
        return TaskData(
            task_id=task_id,
            client=result[0],
            worker=result[1],
            payment=result[2],
            deadline=result[3],
            description_hash=result[4],
            deliverable_hash=result[5],
            status=TaskStatus.from_int(result[6]),
            created_at=result[7],
            completed_at=result[8],
            priority=result[9],
            uses_milestones=result[11],
            parent_task_id=result[12],
        )
