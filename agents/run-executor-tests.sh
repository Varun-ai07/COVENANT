#!/bin/bash

# COVENANT Executor Integration Test Runner
# This script runs the executor integration tests and provides a summary

echo "=================================="
echo "COVENANT Executor Integration Tests"
echo "=================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
  echo "Error: This script must be run from the agents directory"
  exit 1
fi

# Check if __tests__ directory exists
if [ ! -d "__tests__" ]; then
  echo "Error: __tests__ directory not found"
  exit 1
fi

# Run the tests
echo "Running executor integration tests..."
echo "--------------------------------------"

cd __tests__
npm test

# Capture exit code
EXIT_CODE=$?

echo ""
echo "--------------------------------------"
if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ Executor integration tests completed successfully"
else
  echo "❌ Executor integration tests failed"
fi

exit $EXIT_CODE