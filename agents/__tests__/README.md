# COVENANT Executor Integration Tests

This directory contains tests to verify the integration of different execution platforms with the COVENANT worker agent system.

## Test Overview

The executor test suite validates the integration of three execution methods:

1. **Claude CLI** - Default execution method for complex tasks
2. **MCP Server** - Remote execution via Model Context Protocol
3. **OpenRouter** - Fallback option for simple tasks

## Running Tests

```bash
# Install dependencies
npm install

# Run executor integration tests
npm test
```

## Test Scenarios

The tests validate:

1. **Claude Code as default execution method** - Tests the primary integration path using Claude Code sub-agent spawning
2. **MCP server integration** - Tests remote execution capabilities
3. **OpenRouter integration** - Tests fallback execution for simple tasks
4. **Fallback mechanisms** - Tests proper fallback between execution methods
5. **Platform compatibility** - Tests detection of available execution platforms

## Configuration

To run all tests successfully, you'll need:

1. Claude CLI installed and accessible in PATH
2. MCP server running (optional)
3. OpenRouter API key in environment variables (optional)

## Environment Variables

```bash
# For OpenRouter testing
OPENROUTER_API_KEY=your_api_key_here
OPENROUTER_MODEL=meta-llao/llama-3.1-8b-instruct:free

# For MCP server testing
MCP_SERVER_URL=http://localhost:3001

# Execution mode selection
EXECUTION_MODE=claude-cli|mcp|openrouter
```

## Test Output

Tests will report:
- Which platforms are available
- Which execution methods work correctly
- Any fallback behavior
- Overall compatibility status

The tests are designed to be non-blocking - if a platform isn't configured, the corresponding test will be marked as skipped rather than failed.