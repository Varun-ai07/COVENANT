// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./CapabilityVerifier.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CapabilityVerifier
 * @notice Wrapper around Groth16Verifier that delegates proof verification
 *         to an underlying verifier contract and adds authorization.
 */
contract CapabilityVerifier is Ownable {
    mapping(address => bool) public authorizedIssuers;
    Groth16Verifier public immutable verifier;

    constructor(address _verifier) Ownable(msg.sender) {
        verifier = Groth16Verifier(_verifier);
    }

    function addAuthorizedIssuer(address issuer) external onlyOwner {
        authorizedIssuers[issuer] = true;
    }

    function removeAuthorizedIssuer(address issuer) external onlyOwner {
        authorizedIssuers[issuer] = false;
    }

    function verifyCapabilityProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[5] calldata _pubSignals
    ) external view returns (bool) {
        return verifyProof(_pA, _pB, _pC, _pubSignals);
    }

    function verifyProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[5] calldata _pubSignals
    ) public view returns (bool) {
        require(
            authorizedIssuers[msg.sender] || msg.sender == owner(),
            "Not authorized"
        );
        return verifier.verifyProof(_pA, _pB, _pC, _pubSignals);
    }
}
