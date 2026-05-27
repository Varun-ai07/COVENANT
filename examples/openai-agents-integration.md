# OpenAI Agents SDK Integration

## Setup

```python
import asyncio
from agents import Agent
from agents.mcp import MCPServerStdio

async def main():
    async with MCPServerStdio(
        command="npx",
        args=["-y", "@varun-ai07/covenant-mcp"],
        env={"PRIVATE_KEY": "0xYOUR_KEY", "RPC_URL": "https://sepolia.base.org"}
    ) as covenant:
        agent = Agent(
            name="COVENANT Agent",
            instructions="You are an agent that can hire, pay, and verify other agents on-chain.",
            tools=covenant.tools,
        )
        result = await agent.run("Register me as a COVENANT agent")
        print(result)

asyncio.run(main())
```
