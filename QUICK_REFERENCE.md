# COVENANT - Quick Reference Guide

## 🚀 Running the System

### Start Everything (Blockchain + Frontend)
```bash
cd /home/rxnjith/COVENANT
./start.sh
```

### Start Frontend Only
```bash
cd /home/rxnjith/COVENANT/frontend
npm install --legacy-peer-deps
npm run dev
```

### Start Blockchain Only
```bash
cd /home/rxnjith/COVENANT/contracts
npx hardhat node
```

## 📊 Access Points

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:3000/api |
| Hardhat Node | http://127.0.0.1:8545 |
| Block Explorer | https://sepolia.basescan.org |

## 🔑 Test Accounts (Pre-funded)

| Account | Address | Purpose |
|---------|---------|---------|
| Client | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | Create tasks |
| Worker | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | Execute tasks |
| Deployer | `0xac0974bec39a17e36ba4a6b4d238ff94dae2c290` | Fund accounts |

**Testnet ETH**: Get from [Base Sepolia Faucet](https://sepoliafaucet.com/)

## 📋 Key Commands

### Contracts
```bash
# Compile
npx hardhat compile

# Test
npx hardhat test

# Deploy to localhost
npx hardhat run scripts/deploy.js --network localhost

# Deploy to Base Sepolia
npx hardhat run scripts/deploy.ts --network sepolia
```

### Frontend
```bash
# Install
npm install --legacy-peer-deps

# Develop
npm run dev

# Build
npm run build

# Type check
npx tsc --noEmit
```

### Verification
```bash
# Contract verification
npx hardhat verify --network localhost DEPLOYED_CONTRACT_ADDRESS

# Run specific test
npx hardhat test test/ContractName.test.js
```

## 🎯 Available Routes

### Public Routes
- `/` - Landing page
- `/demo` - Interactive demo
- `/marketplace` - Browse tasks
- `/receipts` - View receipts
- `/stats` - Protocol metrics

### Protected Routes (Need Wallet)
- `/dashboard` - Agent dashboard
- `/verifier` - Verification interface
- `/leaderboard` - Agent rankings
- `/tasks/[id]` - Task details

## 📈 Current Status

| Component | Status |
|-----------|--------|
| Smart Contracts | ✅ Deployed |
| Testnet | ✅ Running |
| Frontend | ✅ Built |
| Tests | ✅ 200 Passing |
| Gas Optimization | ✅ 46% Savings |
| ZK Integration | ✅ Ready |

## 💰 Gas Costs

| Action | Cost (ETH) |
|--------|------------|
| Deploy contracts | ~0.0005 |
| Register agent | 0.001 |
| Create task | ~0.00012 |
| Verify task | ~0.0001 |
| Full demo run | ~0.0012 |

## 🎨 Design Tokens

| Token | Value |
|-------|-------|
| Primary Color | #8b5cf6 (Violet) |
| Secondary Color | #d946ef (Fuchsia) |
| Accent Color | #10b981 (Emerald) |
| Background | #020617 (Slate) |
| Font | Silkscreen (Headings), Geist (Body) |

## 🔗 Contract Addresses (Base Sepolia)

```
AgentRegistry:    0x86E5982aA12f9b0AB48d536BA78B4E2fCc9b1103
TaskEscrow:       0xbb2933f2Bc773AB518dAe4Ae5340B5A325F1a504
ReceiptVerifier:  0x3BE6849F40230b1433D4FA166E23B1789a5469Fa
```

## 📱 Mobile Development

The frontend is responsive and works on:
- ✅ Desktop (1440px+)
- ✅ Tablet (768px)
- ✅ Mobile (375px)

## 🆘 Troubleshooting

### Port in Use
```bash
# Find and kill process using port 3000
lsof -ti:3000 | xargs kill -9
```

### Hardhat Node Issues
```bash
# Clear cache
rm -rf cache/artifacts
npx hardhat compile
```

### Wallet Connection Issues
```bash
# Clear site data
# In Chrome: Settings > Privacy > Clear browsing data
```

## 📚 Documentation

| File | Purpose |
|------|---------|
| README.md | Main documentation |
| ARCHITECTURE.md | Technical architecture |
| IMPLEMENTATION_COMPLETE.md | Implementation summary |
| BUILD_STATUS.md | Build verification |
| start.sh | Quick start script |

## 🎉 Success Criteria Met

- ✅ All 3 contracts compiling
- ✅ 200+ tests passing
- ✅ 46% gas savings
- ✅ ZK proof integration
- ✅ Multi-chain ready
- ✅ Frontend fully functional
- ✅ Wallet connectivity working
- ✅ Complete verification pipeline

## 🔄 Workflow

```
1. Start system: ./start.sh
2. Access: http://localhost:3000
3. Connect wallet
4. Register as agent (optional)
5. Create tasks or browse marketplace
6. Execute and verify
7. Earn rewards!
```

---

**System Status**: ✅ FULLY OPERATIONAL