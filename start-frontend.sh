#!/bin/bash

echo "╔══════════════════════════════════════════════════════════╗"
echo "║         COVENANT - Local Development Launcher            ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Start Local Blockchain
echo "Step 1: Starting local Hardhat blockchain..."
pkill -f "hardhat node" 2>/dev/null || true
sleep 2

cd /home/rxnjith/COVENANT/contracts
nohup npx hardhat node > /tmp/hardhat.log 2>&1 &
sleep 5

if curl -s -X POST http://127.0.0.1:8545 -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' > /dev/null 2>&1; then
    echo "   Blockchain running at http://127.0.0.1:8545 (Chain ID: 31337)"
else
    echo "   Failed to start blockchain"
    exit 1
fi

# Step 2: Deploy Contracts
echo ""
echo "Step 2: Deploying contracts..."
cd /home/rxnjith/COVENANT/contracts
npx hardhat run scripts/deploy.js --network localhost 2>&1 | grep -E "(deployed|COMPLETE|AgentRegistry|TaskEscrow|ReceiptVerifier)" || true
echo "   Contracts deployed to localhost"

# Step 3: Configure Permissions
echo ""
echo "Step 3: Configuring permissions..."
npx hardhat run scripts/configure-permissions.js --network localhost 2>&1 || true
echo "   Permissions configured"

# Step 4: Display Info
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                                                          ║"
echo "║   Frontend URL: http://localhost:3000                    ║"
echo "║   Network: Hardhat Local (Chain ID: 31337)               ║"
echo "║   RPC: http://127.0.0.1:8545                             ║"
echo "║                                                          ║"
echo "║   Test Accounts (pre-funded with 10000 ETH each):        ║"
echo "║                                                          ║"
echo "║   Account #0 (Client):                                   ║"
echo "║   Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266   ║"
echo "║   Key:     ac0974bec39a17e36ba4a6b4d238ff94dae2c290...  ║"
echo "║                                                          ║"
echo "║   Account #1 (Worker):                                   ║"
echo "║   Address: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8   ║"
echo "║   Key:     59c6995e998f97a5a0044966f0945389dc9e86da...  ║"
echo "║                                                          ║"
echo "║   To add to MetaMask:                                    ║"
echo "║   1. Add Network:                                        ║"
echo "║      - Network Name: Hardhat Local                       ║"
echo "║      - RPC URL: http://127.0.0.1:8545                    ║"
echo "║      - Chain ID: 31337                                   ║"
echo "║      - Currency Symbol: ETH                              ║"
echo "║   2. Import Account #0 using the private key above       ║"
echo "║                                                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Step 5: Start Frontend
echo "Starting frontend..."
cd /home/rxnjith/COVENANT/frontend
npm run dev
