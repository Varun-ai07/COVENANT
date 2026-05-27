// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract ClientReputation is Ownable {
    constructor() Ownable(msg.sender) {}

    struct ClientStats {
        uint256 totalDecisions;
        uint256 approvals;
        uint256 rejections;
        uint256 approvalRate; // basis points (0-10000)
        uint256 lastDecision;
    }

    mapping(address => bool) public authorizedCallers;

    mapping(address => ClientStats) public clients;

    event DecisionRecorded(address indexed client, bool approved);
    event AuthorizedCallerUpdated(address indexed caller, bool authorized);

    modifier onlyAuthorized() {
        require(authorizedCallers[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }

    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        authorizedCallers[caller] = authorized;
        emit AuthorizedCallerUpdated(caller, authorized);
    }

    function recordDecision(address client, bool approved) external onlyAuthorized {
        ClientStats storage stats = clients[client];
        stats.totalDecisions++;
        if (approved) stats.approvals++;
        else stats.rejections++;
        stats.approvalRate = (stats.approvals * 10000) / stats.totalDecisions;
        stats.lastDecision = block.timestamp;
        emit DecisionRecorded(client, approved);
    }

    function getClientStats(address client) external view returns (ClientStats memory) {
        return clients[client];
    }

    function getApprovalRate(address client) external view returns (uint256) {
        return clients[client].approvalRate;
    }

    function isBadFaith(address client) external view returns (bool) {
        ClientStats storage stats = clients[client];
        return stats.totalDecisions >= 10 && stats.approvalRate < 3000; // < 30%
    }
}
