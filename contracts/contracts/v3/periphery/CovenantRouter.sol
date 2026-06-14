// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../interfaces/ICovenantIdentity.sol";
import "../interfaces/ICovenantEscrow.sol";
import "../interfaces/ICovenantSettlement.sol";
import "../interfaces/ICovenantAttestation.sol";

/// @title CovenantRouter V3 - Multicall batcher + convenience functions
contract CovenantRouter is OwnableUpgradeable {
    address public identity;
    address public escrow;
    address public settlement;
    address public attestation;

    struct Call {
        address target;
        bytes data;
        uint256 value;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {}

    function initialize(
        address _identity,
        address _escrow,
        address _settlement,
        address _attestation
    ) public initializer {
        __Ownable_init();
        identity = _identity;
        escrow = _escrow;
        settlement = _settlement;
        attestation = _attestation;
    }

    function multicall(Call[] calldata calls) external payable returns (bytes[] memory results) {
        results = new bytes[](calls.length);
        for (uint256 i = 0; i < calls.length; i++) {
            (bool success, bytes memory result) = calls[i].target.call{value: calls[i].value}(calls[i].data);
            require(success, "call failed");
            results[i] = result;
        }
    }

    function registerAndCreateTask(
        uint96 stake,
        bytes32 metadataRoot,
        address worker,
        uint128 taskAmount,
        uint32 deadline,
        bytes32 taskMetaHash
    ) external payable returns (uint256 taskId) {
        ICovenantIdentity(identity).register{value: stake}(stake, metadataRoot);

        taskId = ICovenantEscrow(escrow).createTask{value: taskAmount}(
            worker,
            taskAmount,
            deadline,
            taskMetaHash
        );
    }

    function batchCreateTasks(
        address[] calldata workers,
        uint128[] calldata amounts,
        uint32[] calldata deadlines,
        bytes32[] calldata metaHashes
    ) external payable returns (uint256[] memory taskIds) {
        require(
            workers.length == amounts.length &&
            amounts.length == deadlines.length &&
            deadlines.length == metaHashes.length,
            "length mismatch"
        );

        taskIds = new uint256[](workers.length);
        uint256 totalValue;

        for (uint256 i = 0; i < workers.length; i++) {
            taskIds[i] = ICovenantEscrow(escrow).createTask{value: amounts[i]}(
                workers[i],
                amounts[i],
                deadlines[i],
                metaHashes[i]
            );
            totalValue += amounts[i];
        }

        if (msg.value > totalValue) {
            (bool refundSuccess, ) = msg.sender.call{value: msg.value - totalValue}("");
            require(refundSuccess, "refund failed");
        }
    }

    function setContracts(
        address _identity,
        address _escrow,
        address _settlement,
        address _attestation
    ) external onlyOwner {
        identity = _identity;
        escrow = _escrow;
        settlement = _settlement;
        attestation = _attestation;
    }
}
