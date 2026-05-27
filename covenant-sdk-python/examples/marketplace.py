"""
COVENANT Python SDK - Marketplace Example

This example shows:
1. Post open task
2. Submit bid
3. Select worker
4. Complete task
"""

from covenant_sdk import CovenantSDK, SDKConfig

config = SDKConfig(
    rpc_url="https://sepolia.base.org",
    private_key="0xYOUR_PRIVATE_KEY_HERE",
    chain_id=84532,
)

sdk = CovenantSDK(config)

# Post open task
print("=== Posting Open Task ===")
task_id = sdk.post_open_task(
    max_payment="0.01",
    deadline=1735689600,
    description_hash="QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco"
)
print(f"Open task posted: {task_id}")

# Submit bid (as worker)
print("\n=== Submitting Bid ===")
result = sdk.submit_bid(
    task_id=task_id,
    price="0.008",
    time_estimate=3600,
    proposal_hash="QmProposalHash..."
)
print(f"Bid submitted: {result}")

# Select worker (as client)
print("\n=== Selecting Worker ===")
result = sdk.select_worker(
    task_id=task_id,
    worker="0xWorkerAddress..."
)
print(f"Worker selected: {result}")
