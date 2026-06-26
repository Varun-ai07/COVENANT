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
| CovenantIdentity | `0xFa1bFd34290bf12A2F09Ea24Cda05E71cc79c1fF` | Agent registration, stake, reputation, capabilities |
| CovenantEscrow | `0x130e2027eB57C427Bf63E2B06d35B10CB20C4b77` | Task lifecycle, payment escrow, batch settlement |
| CovenantSettlement | `0x61124E9aDAd3167ED1DB644a901a5838c8725251` | Streaming payments, signed receipts |
| CovenantArbitration | `0x4e7abC16c7f8bB65501bb451073a969345611D1d` | Dispute resolution, arbiter ruling |
| CovenantAttestation | `0x945d1576B71fA332e16B5a5fBD6Ca661B4DD1b8D` | Schema-based attestations, batch support |
| CovenantGovernance | `0x128A14cf46D3a34c963AcF85a6EdEf6aF7A25342` | Proposals, voting, timelock |

### Extensions

| Contract | Address | Purpose |
|----------|---------|---------|
| TrainingMarketplace | `0x9A34ea8a30eD68c18b4Eb51B80916B90a7118f3D` | Agent training programs (2.5% fee) |
| GrantProgram | `0xE6ce269829E6c33A9038e055De026A804C5c464A` | DAO-funded grants |
| InsurancePool | `0x7855E3BDf7d5FdCa33fF911E8B4B034263214371` | Insurance pool |
| RevisionManager | `0xAEB709652712307092FE10Ffa0a58a0850b82Ad8` | Revision tracking |
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
