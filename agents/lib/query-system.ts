/**
 * Query Resolution System - Handles worker questions during task execution
 * Implements the query resolution mechanism from the verification optimization guide
 */

import { TaskEscrowABI } from "./abis.js";
import { CONTRACTS } from "./config.js";
import { generateJSON } from "./llm.js";

/**
 * Submit a query to the client about a task
 */
export async function submitQuery(
  taskId: bigint,
  queryText: string,
  queryType: 'specification_clarification' | 'resource_issue' | 'feasibility_concern',
  wallet: any
): Promise<string> {
  console.log(`[QuerySystem] Submitting query for task ${taskId}: ${queryText}`);

  // In a full implementation, this would encrypt the query and submit it to the contract
  // For now, we'll just log it
  const queryHash = await wallet.writeContract({
    address: CONTRACTS.TaskEscrow,
    abi: TaskEscrowABI,
    functionName: "submitQuery",
    args: [taskId, queryText, queryType],
  });

  console.log(`[QuerySystem] Query submitted with hash: ${queryHash}`);
  return queryHash;
}

/**
 * Respond to a worker query
 */
export async function respondToQuery(
  taskId: bigint,
  responseText: string,
  wallet: any
): Promise<string> {
  console.log(`[QuerySystem] Responding to query for task ${taskId}`);

  // In a full implementation, this would encrypt the response and submit it to the contract
  // For now, we'll just log it
  const responseHash = await wallet.writeContract({
    address: CONTRACTS.TaskEscrow,
    abi: TaskEscrowABI,
    functionName: "respondToQuery",
    args: [taskId, responseText],
  });

  console.log(`[QuerySystem] Response submitted with hash: ${responseHash}`);
  return responseHash;
}

/**
 * Monitor for incoming queries
 */
export async function monitorQueries(wallet: any, publicClient: any): Promise<void> {
  console.log("[QuerySystem] Monitoring for queries...");

  // In a full implementation, this would set up event listeners for QuerySubmitted events
  // and process them accordingly
}

/**
 * Generate a structured response to a worker query using LLM
 */
export async function generateQueryResponse(
  queryText: string,
  taskContext: any
): Promise<string> {
  const prompt = `
You are a client agent responding to a worker's query about a task.

Query: ${queryText}

Task Context:
${JSON.stringify(taskContext, null, 2)}

Provide a clear, concise response to the worker's query. If the query is about specifications,
provide specific details. If it's about resources, explain what's available. If it's about
feasibility, explain constraints or alternatives.

Response:
`;

  try {
    const response = await generateJSON<{ response: string }>(prompt, {
      maxTokens: 300,
    });

    return response.response;
  } catch (error) {
    console.error("[QuerySystem] Failed to generate query response:", error);
    return "Unable to generate response at this time. Please try again later.";
  }
}

// Export the functions
export default {
  submitQuery,
  respondToQuery,
  monitorQueries,
  generateQueryResponse
};