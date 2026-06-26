"""Chain configuration and contract addresses for the COVENANT SDK."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional

from .types import ContractAddresses

# Default contract addresses by chain ID
DEFAULT_ADDRESSES: Dict[int, ContractAddresses] = {
    # Base Sepolia Testnet
    84532: ContractAddresses(
        AgentRegistry="0x0003072b15d2c299d46bC5FfE7785E803895E614",
        TaskEscrow="0xFD081B5cB8bAE37DC878078bE3165932b0bC0BB3",
        ReceiptVerifier="0xa47D15099be6aC516B53a6859D468E9004eEf76b",
        OpenTaskMarket="0x5ccF09469222E5046b0830c6d71ed6B912bE70e6",
        ParallelTaskBatch="0xaf23D40668f0e33426824Bf2027A0E9cD26c11Bc",
        AgentCollective="0x0CDE9560D2E95338922c40A52A2c81cdd20613d1",
        AgentInsurance="0x1798d370e3C566001A84F38EbDc0F6F1Db6bdd55",
        DisputeArbitration="0x37A62C6eDd18461CCe00B6772Da8640C75DE740e",
        COVENANTRouter="0x565C48FEFc39c9D98a37cCE30583913C7d0d5e09",
        CovenantIdentity="0xFa1bFd34290bf12A2F09Ea24Cda05E71cc79c1fF",
        CovenantEscrow="0x130e2027eB57C427Bf63E2B06d35B10CB20C4b77",
        CovenantSettlement="0x61124E9aDAd3167ED1DB644a901a5838c8725251",
        CovenantArbitration="0x4e7abC16c7f8bB65501bb451073a969345611D1d",
        CovenantAttestation="0x945d1576B71fA332e16B5a5fBD6Ca661B4DD1b8D",
        CovenantGovernance="0x128A14cf46D3a34c963AcF85a6EdEf6aF7A25342",
        InsurancePool="0x7855E3BDf7d5FdCa33fF911E8B4B034263214371",
        TrainingMarketplace="0x9A34ea8a30eD68c18b4Eb51B80916B90a7118f3D",
        GrantProgram="0xE6ce269829E6c33A9038e055De026A804C5c464A",
        RevisionManager="0xAEB709652712307092FE10Ffa0a58a0850b82Ad8",
        MultiTokenEscrow="0x0bd7E7E75AA828957AfE7445E17E58A278Bf256e",
    ),
    # Hardhat Local
    31337: ContractAddresses(
        AgentRegistry="0x0000000000000000000000000000000000000000",
        TaskEscrow="0x0000000000000000000000000000000000000000",
        ReceiptVerifier="0x0000000000000000000000000000000000000000",
        OpenTaskMarket="0x0000000000000000000000000000000000000000",
        ParallelTaskBatch="0x0000000000000000000000000000000000000000",
        AgentCollective="0x0000000000000000000000000000000000000000",
        AgentInsurance="0x0000000000000000000000000000000000000000",
        DisputeArbitration="0x0000000000000000000000000000000000000000",
        COVENANTRouter="0x0000000000000000000000000000000000000000",
    ),
    # Base Mainnet (placeholder)
    8453: ContractAddresses(
        AgentRegistry="0x0000000000000000000000000000000000000000",
        TaskEscrow="0x0000000000000000000000000000000000000000",
        ReceiptVerifier="0x0000000000000000000000000000000000000000",
        OpenTaskMarket="0x0000000000000000000000000000000000000000",
        ParallelTaskBatch="0x0000000000000000000000000000000000000000",
        AgentCollective="0x0000000000000000000000000000000000000000",
        AgentInsurance="0x0000000000000000000000000000000000000000",
        DisputeArbitration="0x0000000000000000000000000000000000000000",
        COVENANTRouter="0x0000000000000000000000000000000000000000",
    ),
}

# Default RPC URLs by chain ID
DEFAULT_RPC_URLS: Dict[int, str] = {
    84532: "https://sepolia.base.org",
    8453: "https://mainnet.base.org",
    31337: "http://localhost:8545",
}


@dataclass
class SDKConfig:
    """Configuration for the COVENANT SDK."""

    rpc_url: Optional[str] = None
    private_key: Optional[str] = None
    chain_id: int = 84532
    contract_addresses: Optional[ContractAddresses] = None

    def get_rpc_url(self) -> str:
        """Get the RPC URL, falling back to the default for the chain."""
        if self.rpc_url:
            return self.rpc_url
        url = DEFAULT_RPC_URLS.get(self.chain_id)
        if not url:
            raise ValueError(
                f"No default RPC URL for chain {self.chain_id}. "
                f"Pass rpc_url explicitly."
            )
        return url

    def get_addresses(self) -> ContractAddresses:
        """Get contract addresses, using overrides if provided."""
        defaults = DEFAULT_ADDRESSES.get(self.chain_id)
        if not defaults:
            raise ValueError(
                f"Unsupported chain ID: {self.chain_id}. "
                f"Supported: {list(DEFAULT_ADDRESSES.keys())}"
            )
        if self.contract_addresses:
            # Merge overrides onto defaults
            return ContractAddresses(
                **{
                    k: getattr(self.contract_addresses, k) or getattr(defaults, k)
                    for k in ContractAddresses.__dataclass_fields__
                }
            )
        return defaults
