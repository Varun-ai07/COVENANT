// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../TaskEscrow.sol";
import "../AgentRegistry.sol";

/**
 * @dev Malicious contract that tries to re-enter TaskEscrow.verifyMilestone
 *      to double-pay itself. Tests that nonReentrant + CEI prevent this.
 */
contract ReentrancyAttacker {
    TaskEscrow public target;
    AgentRegistry public registry;
    uint256 public attackCount;
    bool public attacking;
    uint256 public taskId;

    constructor(address _target) {
        target = TaskEscrow(_target);
    }

    function registerSelf(address _registry) external payable {
        string[] memory caps = new string[](1);
        caps[0] = "attacker";
        bytes memory data = abi.encodeWithSignature(
            "register(string,string[])",
            "Attacker",
            caps
        );
        (bool sent, ) = _registry.call{value: msg.value}(data);
        require(sent, "Register failed");
    }

    receive() external payable {
        if (attacking && attackCount < 1) {
            attacking = false;
            attackCount++;

            // Try to re-enter verifyMilestone for same task, different milestone
            try target.verifyMilestone(taskId, 1, true) {} catch {}
        }
    }

    function createTaskWithMilestone(
        address _registry,
        uint256 payment
    ) external payable {
        registry = AgentRegistry(_registry);
        string[] memory descriptions = new string[](1);
        descriptions[0] = "Milestone 1";
        uint256[] memory payments = new uint256[](1);
        payments[0] = payment;

        taskId = target.createTaskWithMilestones{value: msg.value}(
            address(this),
            payment,
            block.timestamp + 86400,
            "QmAttack",
            descriptions,
            payments
        );
    }

    function fundTask(uint256 _taskId) external payable {
        target.fundTask{value: msg.value}(_taskId);
    }

    function submitMilestone(uint256 _taskId, uint256 milestoneIndex) external {
        target.submitMilestone(_taskId, milestoneIndex, "QmDelivered");
    }

    function verifyMilestone(uint256 _taskId, uint256 milestoneIndex) external {
        attacking = true;
        attackCount = 0;
        target.verifyMilestone(_taskId, milestoneIndex, true);
    }
}

/**
 * @dev Malicious contract that tries to re-enter withdrawFees
 */
contract WithdrawReentrancyAttacker {
    TaskEscrow public target;

    constructor(address _target) {
        target = TaskEscrow(_target);
    }

    receive() external payable {
        try target.withdrawFees() {} catch {}
    }

    function attack() external {
        target.withdrawFees();
    }
}

/**
 * @dev Malicious contract that tries to exceed AgentWallet daily limit via reentrancy
 */
contract WalletReentrancyAttacker {
    address public wallet;
    uint256 public attackCount;

    constructor(address _wallet) {
        wallet = _wallet;
    }

    receive() external payable {
        if (attackCount < 2) {
            attackCount++;
            bytes memory data = abi.encodeWithSignature(
                "execute(address,uint256,bytes)",
                address(0x1),
                msg.value,
                ""
            );
            (bool sent, ) = wallet.call{value: msg.value}(data);
        }
    }

    function attack(uint256 amount) external {
        bytes memory data = abi.encodeWithSignature(
            "execute(address,uint256,bytes)",
            address(0x1),
            amount,
            ""
        );
        (bool sent, ) = wallet.call{value: amount}(data);
    }
}

/**
 * @dev Malicious contract that tries cross-function reentrancy
 */
contract CrossFunctionReentrancyAttacker {
    TaskEscrow public target;

    constructor(address _target) {
        target = TaskEscrow(_target);
    }

    receive() external payable {
        try target.verifyTask(1, true) {} catch {}
    }

    function createTask(
        address _worker,
        uint256 payment
    ) external payable {
        target.createTask(
            _worker,
            payment,
            block.timestamp + 86400,
            "QmAttack"
        );
    }
}
