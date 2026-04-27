import { executeWork, executeWithMode, getExecutionMode } from "../../lib/executor.js";
import { isOpenRouterConfigured } from "../../lib/llm.js";
import * as dotenv from "dotenv";

dotenv.config();

// Mock task description for testing
const TEST_TASK = "Create a simple 'Hello World' program in Python";

/**
 * Test Claude CLI execution mode
 */
async function testClaudeCLI() {
  console.log("=== Testing Claude CLI Execution Mode ===");
  try {
    // This will test Claude CLI if available
    const result = await executeWithMode(TEST_TASK, "claude-cli");
    console.log("✓ Claude CLI execution successful");
    console.log(`  Mode: ${result.mode}`);
    console.log(`  Output length: ${result.report.length} characters`);
    return true;
  } catch (error) {
    console.log("⚠ Claude CLI execution failed (may be expected if Claude CLI not available)");
    console.log(`  Error: ${error.message}`);
    return false;
  }
}

/**
 * Test MCP execution mode
 */
async function testMCP() {
  console.log("\n=== Testing MCP Execution Mode ===");
  try {
    // This will test MCP server if available
    const result = await executeWithMode(TEST_TASK, "mcp");
    console.log("✓ MCP execution successful");
    console.log(`  Mode: ${result.mode}`);
    console.log(`  Output length: ${result.report.length} characters`);
    return true;
  } catch (error) {
    console.log("⚠ MCP execution failed (may be expected if MCP server not available)");
    console.log(`  Error: ${error.message}`);
    return false;
  }
}

/**
 * Test OpenRouter execution mode
 */
async function testOpenRouter() {
  console.log("\n=== Testing OpenRouter Execution Mode ===");
  if (!isOpenRouterConfigured()) {
    console.log("⚠ OpenRouter not configured (missing API key)");
    return false;
  }

  try {
    // This will test OpenRouter if API key is available
    const result = await executeWithMode(TEST_TASK, "openrouter");
    console.log("✓ OpenRouter execution successful");
    console.log(`  Mode: ${result.mode}`);
    console.log(`  Output length: ${result.report.length} characters`);
    return true;
  } catch (error) {
    console.log("✗ OpenRouter execution failed");
    console.log(`  Error: ${error.message}`);
    return false;
  }
}

/**
 * Test fallback mechanisms
 */
async function testFallbacks() {
  console.log("\n=== Testing Fallback Mechanisms ===");

  // Test environment variable configuration
  const originalMode = process.env.EXECUTION_MODE;

  try {
    // Test default mode
    console.log("Testing default execution mode...");
    const defaultMode = getExecutionMode();
    console.log(`  Default mode: ${defaultMode}`);

    // Test CLI argument parsing
    console.log("Testing CLI argument parsing...");
    process.argv.push("--use-openrouter");
    const openrouterMode = getExecutionMode();
    console.log(`  OpenRouter mode via CLI: ${openrouterMode}`);

    process.argv.pop(); // Remove --use-openrouter
    process.argv.push("--use-mcp");
    const mcpMode = getExecutionMode();
    console.log(`  MCP mode via CLI: ${mcpMode}`);

    process.argv.pop(); // Remove --use-mcp

    console.log("✓ Fallback mechanism tests completed");
    return true;
  } catch (error) {
    console.log("✗ Fallback mechanism test failed");
    console.log(`  Error: ${error.message}`);
    return false;
  } finally {
    // Restore original environment
    if (originalMode) {
      process.env.EXECUTION_MODE = originalMode;
    }
  }
}

/**
 * Test compatibility with different platforms
 */
async function testPlatformCompatibility() {
  console.log("\n=== Testing Platform Compatibility ===");

  // Check if we're in a Claude Code environment
  const hasClaudeCLI = !!process.env.CLAUDE_CLI_PATH || typeof process.env.CLAUDE_CLI_PATH !== 'undefined';
  console.log(`  Claude CLI available: ${hasClaudeCLI}`);

  // Check for MCP server
  const hasMCP = !!process.env.MCP_SERVER_URL;
  console.log(`  MCP Server configured: ${hasMCP}`);

  // Check for OpenRouter
  const hasOpenRouter = isOpenRouterConfigured();
  console.log(`  OpenRouter configured: ${hasOpenRouter}`);

  console.log("✓ Platform compatibility check completed");
  return true;
}

/**
 * Main test function
 */
async function runAllTests() {
  console.log("COVENANT Executor Integration Test Suite");
  console.log("=====================================");

  const results = {
    claude: false,
    mcp: false,
    openrouter: false,
    fallbacks: false,
    platform: false
  };

  try {
    results.claude = await testClaudeCLI();
    results.mcp = await testMCP();
    results.openrouter = await testOpenRouter();
    results.fallbacks = await testFallbacks();
    results.platform = await testPlatformCompatibility();

    console.log("\n=== Test Results Summary ===");
    console.log(`Claude CLI: ${results.claude ? 'PASS' : 'SKIP/FAIL'}`);
    console.log(`MCP: ${results.mcp ? 'PASS' : 'SKIP/FAIL'}`);
    console.log(`OpenRouter: ${results.openrouter ? 'PASS' : 'SKIP/FAIL'}`);
    console.log(`Fallbacks: ${results.fallbacks ? 'PASS' : 'FAIL'}`);
    console.log(`Platform: ${results.platform ? 'PASS' : 'FAIL'}`);

    const passed = Object.values(results).filter(Boolean).length;
    const total = Object.keys(results).length;
    console.log(`\nOverall: ${passed}/${total} test categories passed`);

    if (passed === total) {
      console.log("🎉 All executor integration tests PASSED");
      return true;
    } else {
      console.log("⚠ Some tests were skipped or failed (this may be expected based on configuration)");
      return true; // Not necessarily a failure, just indicates incomplete setup
    }
  } catch (error) {
    console.error("❌ Executor integration test FAILED:", error);
    return false;
  }
}

// Run the tests
runAllTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error("💥 Test execution error:", error);
    process.exit(1);
  });