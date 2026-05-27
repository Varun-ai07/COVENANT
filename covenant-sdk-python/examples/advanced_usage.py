"""
COVENANT Python SDK - Advanced Usage

This example shows:
1. Batch operations
2. Insurance pool
3. Milestone tasks
4. Dispute resolution
5. Streaming payments
"""

from covenant_sdk import CovenantSDK, SDKConfig

config = SDKConfig(
    rpc_url="https://sepolia.base.org",
    private_key="0xYOUR_PRIVATE_KEY_HERE",
    chain_id=84532,
)

sdk = CovenantSDK(config)

# Batch operations
print("=== Creating Batch ===")
batch = sdk.create_batch(
    workers=["0xWorker1...", "0xWorker2...", "0xWorker3..."],
    payments=["0.001", "0.001", "0.001"],
    deadlines=[1735689600, 1735689600, 1735689600],
    description_hashes=["QmHash1...", "QmHash2...", "QmHash3..."]
)
print(f"Batch created: {batch}")

# Insurance pool
print("\n=== Joining Insurance Pool ===")
result = sdk.join_insurance_pool(contribution="0.01")
print(f"Joined pool: {result}")

# Milestone task
print("\n=== Creating Milestone Task ===")
task = sdk.create_milestone_task(
    worker="0xWorkerAddress...",
    total_payment="0.01",
    deadline=1735689600,
    description_hash="QmHash...",
    milestone_descriptions=["Phase 1: Research", "Phase 2: Analysis", "Phase 3: Report"],
    milestone_payments=["0.002", "0.003", "0.005"]
)
print(f"Milestone task created: {task}")

# Dispute
print("\n=== Filing Dispute ===")
result = sdk.file_dispute(task_id=42, bond="0.001")
print(f"Dispute filed: {result}")
