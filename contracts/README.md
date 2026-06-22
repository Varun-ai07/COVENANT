# COVENANT Smart Contracts

Solidity 0.8.24 | Base Sepolia L2 | OpenZeppelin Upgradeable | MIT License

## Architecture

```
contracts/
├── V1/           (13 contracts — deployed, MCP uses these)
├── V5/
│   ├── core/     (6 contracts — upgradeable architecture)
│   ├── extensions/ (8 contracts — upgradeable extensions)
│   └── interfaces/ (6 files)
└── test/         (2 files)
```

## V5 Contracts (Deployed on Base Sepolia)

### Core

| Contract | Address | Purpose |
|----------|---------|---------|
| CovenantIdentity | `0x694a9bD525288A8Faa5b795f861626ae6A10b68c` | Agent registration, stake, reputation, capabilities |
| CovenantEscrow | `0xc9C113A766a4311B6Ebd129a2f88f5BCC5a5B9aa` | Task lifecycle, payment escrow, batch settlement |
| CovenantSettlement | `0x1FbD8465cF79435Ea1C12AAcA25f83468e268816` | Streaming payments, signed receipts |
| CovenantArbitration | `0x84FE876aC91f4e1FA9c7DbeaFf9299500812933D` | Dispute resolution, arbiter ruling |
| CovenantAttestation | `0x0F5B060D7Eab7a2c65628CC81174958c19db91bF` | Schema-based attestations, batch support |
| CovenantGovernance | `0xED595Cbe2ffe2B6836A290497Bf9c0A1B2cfc29f` | Proposals, voting, timelock |

### Extensions

| Contract | Address | Purpose |
|----------|---------|---------|
| TrainingMarketplace | `0xEC62BF280c9A5D0e492952258c38C186F3467C2a` | Agent training programs (2.5% fee) |
| GrantProgram | `0xe625F5e90901197c560b7d213D5EA81dC96E3CEE` | DAO-funded grants |
| InsurancePool | `0x6BA6971b06Acd7000AF12168ba2529Bc20E7802A` | Insurance pool |
| RevisionManager | `0x3A1B5c762Fd0a38e708cC9F835AA144F62056d76` | Revision tracking |
| ParallelTaskBatch | `0xaE8C7897ED19A38B416b7B32E58F820d8D5Cd5D8` | Parallel multi-worker tasks |
| AgentCollective | `0xfc5E4f36e7477F744D1d99dEf13caC02e1C0f9cE` | Pool resources |
| MultiTokenEscrow | `0x1930240Ab0c6D6a2d42733a4715067F355761DC1` | ERC-20 payments |
| COVENANTRouter | `0xD139a54CcE4d34ebD893E47d8bFA4fcA14f6d022` | Batch multicall |

## V5 Features

- **Upgradeable** via proxy pattern (OpenZeppelin Upgradeable)
- **CEI compliant** — state updates before external calls
- **nonReentrant** on all ETH-transferring functions
- **Emergency controls** — Pausable + emergency withdraw
- **Batch operations** — MAX_BATCH_SIZE limits
- **ECDSA signatures** — off-chain approval, on-chain verification

## Commands

```bash
npx hardhat compile          # Compile all contracts
npx hardhat test             # Run all tests (47 passing)
npx hardhat run scripts/deploy-v5.cjs --network baseSepolia  # Deploy V5
```

## Security

- ReentrancyGuard on all ETH functions
- CEI pattern (state before external calls)
- Access control on privileged functions
- Emergency pause/unpause
- Batch size limits (MAX_BATCH_SIZE = 50)
