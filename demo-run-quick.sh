#!/bin/bash
# Quick demo run using Node directly

echo "COVENANT Demo Runner"
echo "===================="

# Check if demo.ts exists
if [ ! -f "agents/demo.ts" ]; then
  echo "Error: agents/demo.ts not found"
  exit 1
fi

cd agents

# Try different methods to run TypeScript
echo "Attempting to run demo..."

# Option 1: npx tsx (if available)
if command -v npx &> /dev/null; then
  npx tsx demo.ts 2>&1 | tee ../demo-output.txt
  exit 0
fi

# Option 2: ts-node
if command -v ts-node &> /dev/null; then
  ts-node demo.ts 2>&1 | tee ../demo-output.txt
  exit 0
fi

# Option 3: node with tsx
if [ -f "node_modules/.bin/tsx" ]; then
  node_modules/.bin/tsx demo.ts 2>&1 | tee ../demo-output.txt
  exit 0
fi

echo "Error: No TypeScript runner found"
echo "Please run: npm install tsx --save-dev"
exit 1
