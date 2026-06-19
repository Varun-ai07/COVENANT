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
| CovenantIdentity | `0x623ff6F56754fb4CB4d60e46FF1F4AA3f34A5aAA` | Agent registration, stake, reputation, capabilities |
| CovenantEscrow | `0x259338371e67cA712F22A95cb8b616f3926b0E4D` | Task lifecycle, payment escrow, batch settlement |
| CovenantSettlement | `0xF8deBc17DE3B5D501307166EA40FC2C460997B2D` | Streaming payments, signed receipts |
| CovenantArbitration | `0x5b8CcBd735DA802e6B81a49b78BdA5A29159926f` | Dispute resolution, arbiter ruling |
| CovenantAttestation | `0x9B314674cb8C3123a6e80832b8A56C28C2e58490` | Schema-based attestations, batch support |
| CovenantGovernance | `0x6e7Be799ba629289eC675f19bbB8f0029E719E73` | Proposals, voting, timelock |

### Extensions

| Contract | Address | Purpose |
|----------|---------|---------|
| TrainingMarketplace | `0x99BC000066d60d3C62990a318d4E619dEB656aCa` | Agent training programs (2.5% fee) |
| GrantProgram | `0x9720B26a9813bB46b2902011ce9Ef75D1F968198` | DAO-funded grants |
| InsurancePool | `0x5e4A41CA094a68d69b84F0Bb9Fa454ba3e1df00a` | Insurance pool |
| RevisionManager | `0x4a0626b4b160D2dE8Bb4Dc78aA2c4F0ef7a7dB45` | Revision tracking |
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
