// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract StakeSlashing is Ownable, ReentrancyGuard {
    constructor() Ownable(msg.sender) {}

    struct StakeRecord {
        address party;
        uint256 amount;
        uint256 taskId;
        bool slashed;
    }

    mapping(uint256 => StakeRecord[]) public stakes; // taskId => stakes
    mapping(uint256 => bool) public resolved;

    uint256 public totalSlashed;

    event StakeDeposited(uint256 indexed taskId, address indexed party, uint256 amount);
    event StakeSlashed(uint256 indexed taskId, address indexed party, uint256 amount);
    event StakeRefunded(uint256 indexed taskId, address indexed party, uint256 amount);

    function depositStake(uint256 taskId) external payable {
        require(msg.value > 0, "Must stake something");
        stakes[taskId].push(StakeRecord({
            party: msg.sender,
            amount: msg.value,
            taskId: taskId,
            slashed: false
        }));
        emit StakeDeposited(taskId, msg.sender, msg.value);
    }

    function slashLoser(uint256 taskId, address loser) external onlyOwner nonReentrant {
        require(!resolved[taskId], "Already resolved");
        StakeRecord[] storage taskStakes = stakes[taskId];

        for (uint256 i = 0; i < taskStakes.length; i++) {
            if (taskStakes[i].party == loser && !taskStakes[i].slashed) {
                taskStakes[i].slashed = true;
                totalSlashed += taskStakes[i].amount;
                emit StakeSlashed(taskId, loser, taskStakes[i].amount);
            }
        }
        resolved[taskId] = true;
    }

    function refundAll(uint256 taskId) external onlyOwner nonReentrant {
        require(!resolved[taskId], "Already resolved");
        resolved[taskId] = true; // CEI: set state BEFORE external calls

        StakeRecord[] storage taskStakes = stakes[taskId];
        for (uint256 i = 0; i < taskStakes.length; i++) {
            if (!taskStakes[i].slashed) {
                (bool success, ) = taskStakes[i].party.call{value: taskStakes[i].amount}("");
                require(success, "Refund failed");
                emit StakeRefunded(taskId, taskStakes[i].party, taskStakes[i].amount);
            }
        }
    }

    function withdrawSlashed() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds");
        (bool success, ) = owner().call{value: balance}("");
        require(success, "Withdraw failed");
    }

    function getStakes(uint256 taskId) external view returns (StakeRecord[] memory) {
        return stakes[taskId];
    }

    function getTotalSlashed() external view returns (uint256) {
        return totalSlashed;
    }

    receive() external payable {}
}
