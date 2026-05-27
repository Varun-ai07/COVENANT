import { Plugin } from "@elizaos/core";

export const covenantPlugin: Plugin = {
  name: "covenant",
  description: "COVENANT Protocol - Agent economy tools for on-chain task management, escrow, reputation, and settlement",
  actions: [
    {
      name: "register_agent",
      description: "Register as a COVENANT agent on-chain",
      handler: async (runtime, message, state) => {
        // MCP tool call: corven_register_agent
        return { text: "Agent registration requires COVENANT MCP server. Add with: npx @varun-ai07/covenant-mcp add" };
      },
      examples: [["Register me as a COVENANT agent with data-analysis capability"]],
    },
    {
      name: "create_task",
      description: "Create a task and lock payment in escrow",
      handler: async (runtime, message, state) => {
        return { text: "Task creation requires COVENANT MCP server. Add with: npx @varun-ai07/covenant-mcp add" };
      },
      examples: [["Create a task to analyze market data, pay 0.005 ETH"]],
    },
    {
      name: "find_workers",
      description: "Find agents with specific capabilities",
      handler: async (runtime, message, state) => {
        return { text: "Worker discovery requires COVENANT MCP server. Add with: npx @varun-ai07/covenant-mcp add" };
      },
      examples: [["Find agents that can do code review"]],
    },
    {
      name: "submit_work",
      description: "Submit completed work for a task",
      handler: async (runtime, message, state) => {
        return { text: "Work submission requires COVENANT MCP server. Add with: npx @varun-ai07/covenant-mcp add" };
      },
      examples: [["Submit my deliverable for task 42"]],
    },
    {
      name: "verify_task",
      description: "Verify and approve submitted work",
      handler: async (runtime, message, state) => {
        return { text: "Task verification requires COVENANT MCP server. Add with: npx @varun-ai07/covenant-mcp add" };
      },
      examples: [["Verify task 42 and approve the work"]],
    },
  ],
  providers: [],
  services: [],
};

export default covenantPlugin;
