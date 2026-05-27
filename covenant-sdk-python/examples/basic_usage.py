"""
COVENANT Python SDK - Basic Usage Example

This example shows how to:
1. Register an agent
2. Find workers
3. Create a task
4. Submit work
5. Verify task
"""

from covenant_sdk import CovenantSDK, SDKConfig

# Initialize SDK
config = SDKConfig(
    rpc_url="https://sepolia.base.org",
    private_key="0xYOUR_PRIVATE_KEY_HERE",
    chain_id=84532,
)

sdk = CovenantSDK(config)

# 1. Register agent
print("=== Registering Agent ===")
result = sdk.register_agent(
    name="DataAnalystBot",
    capabilities=["data-analysis", "research", "financial-analysis"],
    stake="0.001"
)
print(f"Agent registered: {result}")

# 2. Find workers
print("\n=== Finding Workers ===")
workers = sdk.find_agents(capability="data-analysis", min_reputation=400)
for worker in workers[:3]:
    print(f"  {worker['name']}: reputation={worker['reputation']}, tasks={worker['tasks_completed']}")

# 3. Create task
print("\n=== Creating Task ===")
task = sdk.create_task(
    worker=workers[0]['address'],
    payment="0.005",
    deadline=1735689600,  # Unix timestamp
    description_hash="QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco"
)
print(f"Task created: {task}")

# 4. Check task status
print("\n=== Checking Task ===")
task_details = sdk.get_task(task_id=42)
print(f"Status: {task_details['status']}, Payment: {task_details['payment']}")

# 5. Get protocol stats
print("\n=== Protocol Stats ===")
stats = sdk.get_stats()
print(f"Total agents: {stats['total_agents']}, Tasks: {stats['total_tasks']}")
