// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

/// @title TrainingMarketplace V5 — Agent training programs with 2.5% platform fee
contract TrainingMarketplace is OwnableUpgradeable, ReentrancyGuardUpgradeable {
    struct Training {
        address instructor;
        string title;
        uint256 price;
        bool active;
        uint256 enrollmentCount;
    }

    mapping(uint256 => Training) public trainings;
    uint256 public trainingCount;
    uint256 public platformFeeBps = 250; // 2.5%
    address public feeRecipient;

    event TrainingCreated(uint256 indexed trainingId, address indexed instructor, string title, uint256 price);
    event TrainingEnrolled(uint256 indexed trainingId, address indexed student, uint256 price);
    event PlatformFeeUpdated(uint256 oldFee, uint256 newFee);

    error InsufficientPayment();
    error TrainingNotActive();
    error NotInstructor();
    error InvalidFee();
    error InvalidAddress();
    error ExcessiveWithdraw();

    constructor() {}

    function initialize(address _feeRecipient) public initializer {
        if (_feeRecipient == address(0)) revert InvalidAddress();
        feeRecipient = _feeRecipient;
        __Ownable_init();
        __ReentrancyGuard_init();
    }

    function createTraining(string calldata title, uint256 price) external returns (uint256) {
        trainingCount++;
        trainings[trainingCount] = Training({instructor: msg.sender, title: title, price: price, active: true, enrollmentCount: 0});
        emit TrainingCreated(trainingCount, msg.sender, title, price);
        return trainingCount;
    }

    function enroll(uint256 trainingId) external payable nonReentrant {
        Training storage t = trainings[trainingId];
        if (!t.active) revert TrainingNotActive();
        if (msg.value < t.price) revert InsufficientPayment();

        uint256 platformFee = (t.price * platformFeeBps) / 10000;
        uint256 instructorPayment = t.price - platformFee;

        t.enrollmentCount++;

        // Refund excess ETH
        if (msg.value > t.price) {
            (bool s0, ) = msg.sender.call{value: msg.value - t.price}("");
            require(s0, "refund failed");
        }

        // CEI: State updated, now external calls
        (bool s1, ) = t.instructor.call{value: instructorPayment}("");
        require(s1, "instructor payment failed");
        if (platformFee > 0) {
            (bool s2, ) = feeRecipient.call{value: platformFee}("");
            require(s2, "fee payment failed");
        }

        emit TrainingEnrolled(trainingId, msg.sender, t.price);
    }

    function setPlatformFee(uint256 _feeBps) external onlyOwner {
        if (_feeBps > 1000) revert InvalidFee();
        uint256 old = platformFeeBps;
        platformFeeBps = _feeBps;
        emit PlatformFeeUpdated(old, _feeBps);
    }

    function setFeeRecipient(address _recipient) external onlyOwner {
        if (_recipient == address(0)) revert InvalidAddress();
        feeRecipient = _recipient;
    }

    function emergencyWithdraw(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert InvalidAddress();
        if (amount > address(this).balance / 10) revert ExcessiveWithdraw();
        (bool s, ) = to.call{value: amount}("");
        require(s, "withdraw failed");
    }
    receive() external payable {}
}
