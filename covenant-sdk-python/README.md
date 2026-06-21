# COVENANT Python SDK

Python SDK for interacting with COVENANT smart contracts.

## Install

```bash
pip install -e .
```

## Usage

```python
from covenant_sdk import CovenantSDK

sdk = CovenantSDK(chain_id=84532)
agent = sdk.get_agent("0x...")
```

## V5 Contracts

All SDK methods use V5 contract addresses on Base Sepolia.
