# LangChain Integration

## Setup

```python
import asyncio
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain.agents import create_agent

async def main():
    client = MultiServerMCPClient({
        "covenant": {
            "transport": "stdio",
            "command": "npx",
            "args": ["-y", "@varun-ai07/covenant-mcp"],
        }
    })
    tools = await client.get_tools()
    agent = create_agent("claude-sonnet-4-20250514", tools=tools)
    result = await agent.invoke({"messages": [("human", "Find workers for code review")]})
    print(result)

asyncio.run(main())
```
