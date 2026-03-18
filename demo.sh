#!/bin/bash
set -e

echo "╔═════════════════════════════════════╗"
echo "║     COVENANT DEMO — BASE SEPOLIA    ║"
echo "╚═════════════════════════════════════╝"
echo ""

# Check .env files exist
if [ ! -f "agents/.env" ]; then
  echo "✗ agents/.env not found"
  echo "  Run: cp agents/.env.example agents/.env"
  echo "  Then fill in your private keys"
  exit 1
fi

# Option 1: Local demo (free, unlimited)
if [ "$1" = "local" ]; then
  echo "Running LOCAL demo (Hardhat node)..."
  echo ""
  echo "Starting Hardhat node in background..."
  cd contracts
  npx hardhat node &
  HARDHAT_PID=$!
  sleep 3

  echo "Deploying to local node..."
  npx hardhat run scripts/deploy.ts --network localhost

  echo "Running demo..."
  cd ../agents
  export BASE_SEPOLIA_RPC_URL=http://127.0.0.1:8545
  npx tsx demo.ts

  # Cleanup
  kill $HARDHAT_PID 2>/dev/null || true
  exit 0
fi

# Option 2: Testnet demo (uses real Base Sepolia)
echo "Running TESTNET demo (Base Sepolia)..."
echo ""

cd agents
npx tsx demo.ts

echo ""
echo "✓ Demo complete!"
echo "View transactions: https://sepolia.basescan.org"
