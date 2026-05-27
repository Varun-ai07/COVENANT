// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title DisputeResolution
 * @notice Minimal dispute resolution. Juror selection happens offchain.
 * Onchain: bond collection + final ruling execution only.
 */
contract DisputeResolution is AccessControl, ReentrancyGuard {
    bytes32 public constant ARBITER_ROLE = keccak256("ARBITER_ROLE");

    uint256 public constant DISPUTE_BOND = 0.001 ether;
    uint256 public constant VOTING_DURATION = 2 days;

    struct Dispute {
        uint256 taskId;
        address filedBy;
        uint256 bondAmount;
        uint256 votingEndsAt;
        bool resolved;
        bool workerWins;
        uint256 workerShare; // basis points (0-10000)
    }

    mapping(uint256 => Dispute) public disputes;
    uint256 public disputeCounter;

    event DisputeFiled(uint256 indexed disputeId, uint256 indexed taskId, address indexed filedBy);
    event DisputeResolved(uint256 indexed disputeId, bool workerWins, uint256 workerShare);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ARBITER_ROLE, msg.sender);
    }

    function fileDispute(uint256 taskId) external payable nonReentrant {
        require(msg.value >= DISPUTE_BOND, "Insufficient bond");

        disputes[disputeCounter] = Dispute({
            taskId: taskId,
            filedBy: msg.sender,
            bondAmount: msg.value,
            votingEndsAt: block.timestamp + VOTING_DURATION,
            resolved: false,
            workerWins: false,
            workerShare: 0
        });

        emit DisputeFiled(disputeCounter, taskId, msg.sender);
        disputeCounter++;
    }

    function resolveDispute(uint256 disputeId, bool workerWins, uint256 workerShare) external onlyRole(ARBITER_ROLE) nonReentrant {
        Dispute storage dispute = disputes[disputeId];
        require(!dispute.resolved, "Already resolved");
        require(workerShare <= 10000, "Invalid share");

        dispute.resolved = true;
        dispute.workerWins = workerWins;
        dispute.workerShare = workerShare;

        // Return bond to filer (minus gas cost incentive)
        (bool sent, ) = payable(dispute.filedBy).call{value: dispute.bondAmount}("");
        require(sent, "Bond refund failed");

        emit DisputeResolved(disputeId, workerWins, workerShare);
    }

    function getDispute(uint256 disputeId) external view returns (Dispute memory) {
        return disputes[disputeId];
    }

    receive() external payable {}
}
