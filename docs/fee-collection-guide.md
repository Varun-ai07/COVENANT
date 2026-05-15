# COVENANT Fee Collection Guide

This guide explains how to collect protocol fees from your deployed COVENANT contracts on Base Sepolia/Mainnet.

## Overview

COVENANT charges two types of protocol fees:

| Fee Type | Rate | Who Pays | When |
|----------|------|----------|------|
| Base Protocol Fee | 1% | Client | On task completion |
| Priority Fee | 0.5-5% | Client | On task creation |

All fees flow to the `feeRecipient` address set in TaskEscrow.sol.

---

## Fee Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ CLIENT AGENT                                                     │
│                                                                  │
│   createAndFundTaskWithPriority(payment=0.1 ETH, Priority=High)  │
│                                                                  │
│   Total sent: 0.1 ETH + 0.002 ETH (2% priority fee) = 0.102 ETH │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ TASKESCROW.SOL                                                   │
│                                                                  │
│   - Task payment: 0.1 ETH (held in escrow)                       │
│   - Priority fee: 0.002 ETH → accumulatedFees                    │
│                                                                  │
│   On task completion:                                            │
│   - Worker receives: 0.099 ETH (0.1 - 1% base fee)              │
│   - Base fee: 0.001 ETH → accumulatedFees                        │
│   - Total fees: 0.003 ETH                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ FEE RECIPIENT (YOUR WALLET)                                      │
│                                                                  │
│   withdrawFees() → 0.003 ETH to your address                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Setting Up Fee Collection

### Step 1: Set Fee Recipient

Run once after deployment:

```bash
cd contracts
npx hardhat run scripts/set-fee-recipient.cjs --network baseSepolia
```

This sets your address as the fee recipient:

```javascript
// set-fee-recipient.cjs
const FEE_RECIPIENT = "0xB62C652cCc69213E97c5c2ba266b9e7D0f21a811";
const TASK_ESCROW_ADDRESS = "0xbb2933f2Bc773AB518dAe4Ae5340B5A325F1a504";

await escrow.setFeeRecipient(FEE_RECIPIENT);
```

### Step 2: Verify Setup

Check current state:

```bash
npx hardhat console --network baseSepolia
```

```javascript
const escrow = await ethers.getContractAt("TaskEscrow", "0xbb2933f2Bc773AB518dAe4Ae5340B5A325F1a504");

// Check fee recipient
console.log("Fee Recipient:", await escrow.feeRecipient());

// Check accumulated fees
console.log("Accumulated Fees:", ethers.formatEther(await escrow.accumulatedFees()), "ETH");

// Check owner
console.log("Owner:", await escrow.owner());
```

### Step 3: Withdraw Fees

When you have accumulated fees:

```bash
npx hardhat run scripts/withdraw-fees-safe.cjs --network baseSepolia
```

This safely withdraws ONLY the accumulated fees, not the contract balance (which belongs to task participants).

---

## Fee Schedule (Immutable Constants)

```solidity
// TaskEscrow.sol

// Base protocol fee: 1%
uint256 public constant PROTOCOL_FEE_BPS = 100; // 100 basis points = 1%

// Priority fees
uint256 public constant PRIORITY_FEE_BPS_LOW = 50;     // 0.5%
uint256 public constant PRIORITY_FEE_BPS_MEDIUM = 100; // 1%
uint256 public constant PRIORITY_FEE_BPS_HIGH = 200;   // 2%
uint256 public constant PRIORITY_FEE_BPS_URGENT = 500; // 5%
```

These are `constant` values — they cannot be changed after deployment.

---

## Revenue Projections

| Daily Task Volume | Daily Fee Revenue | Annual Fee Revenue |
|-------------------|-------------------|-------------------|
| $1,000 | $10 | $3,650 |
| $10,000 | $100 | $36,500 |
| $100,000 | $1,000 | $365,000 |
| $1,000,000 | $10,000 | $3,650,000 |

Assumes average 1% fee (base + priority mix).

---

## Automation (Optional)

For automatic fee withdrawals, you can use:

### Gelato Network

Create a Gelato task that calls `withdrawFees()` when `accumulatedFees > threshold`:

```javascript
// Example Gelato setup (not implemented)
const gelatoTask = {
  execAddress: TASK_ESCROW_ADDRESS,
  execSelector: escrow.interface.getFunction("withdrawFees").selector,
  execData: "0x",
  interval: 7 * 24 * 60 * 60, // Weekly
  conditions: [
    {
      type: "gt",
      value: ethers.parseEther("0.01") // Withdraw when > 0.01 ETH
    }
  ]
};
```

### Manual Cron

```bash
# Add to crontab for weekly withdrawal check
0 0 * * 0 cd /path/to/covenant/contracts && npx hardhat run scripts/withdraw-fees-safe.cjs --network baseSepolia
```

---

## Security Notes

1. **Fee recipient can be changed** — Only owner can call `setFeeRecipient()`
2. **Withdrawal is permissioned** — Only owner or feeRecipient can call `withdrawFees()`
3. **Fees are separate from escrow** — Withdrawal touches only `accumulatedFees`, not task funds
4. **Immutable fee rates** — Cannot be raised after deployment

---

## Command Reference

| Command | Purpose |
|---------|---------|
| `set-fee-recipient.cjs` | Set your wallet as fee recipient |
| `withdraw-fees.cjs` | Withdraw fees (owner only) |
| `withdraw-fees-safe.cjs` | Withdraw with safety checks |

---

## Monitoring

Track your fees on Basescan:

- **TaskEscrow:** https://sepolia.basescan.org/address/0xbb2933f2Bc773AB518dAe4Ae5340B5A325F1a504
- **Read Contract → accumulatedFees:** Current unwithdrawn fees
- **Read Contract → feeRecipient:** Your collection address

---

## Troubleshooting

### "Only owner can set fee recipient"
- You're not the contract deployer
- Check owner with `await escrow.owner()`
- Have the owner run the script

### "No fees to withdraw"
- No tasks have been completed yet
- Fees accumulate only on task completion

### "Not authorized"
- You're neither the owner nor the feeRecipient
- Check your address matches one of those roles
