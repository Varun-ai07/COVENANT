// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TrainingMarketplace
 * @notice Enable agents to create, enroll in, and complete training programs
 */
contract TrainingMarketplace is Ownable, ReentrancyGuard {

    struct Training {
        uint256 id;
        address instructor;
        string title;
        string description;
        uint256 price;
        string[] capabilities;
        uint256 duration;
        uint256 rating; // 0-500 (scaled by 100)
        uint256 totalRatings;
        uint256 graduates;
        uint256 enrollmentCount;
        bool active;
        uint256 createdAt;
    }

    struct Enrollment {
        address student;
        uint256 trainingId;
        uint256 enrolledAt;
        uint256 completedAt;
        bool completed;
        bool rated;
    }

    mapping(uint256 => Training) public trainings;
    mapping(uint256 => Enrollment[]) public enrollments;
    mapping(uint256 => mapping(address => Enrollment)) public studentEnrollment;
    mapping(address => uint256[]) public instructorTrainings;
    mapping(address => uint256[]) public studentTrainings;

    uint256 public trainingCounter;
    uint256 public platformFeeBps = 250; // 2.5%
    uint256 public constant BPS_DENOMINATOR = 10000;
    address public feeRecipient;

    event TrainingCreated(uint256 indexed trainingId, address indexed instructor, string title, uint256 price);
    event TrainingEnrolled(uint256 indexed trainingId, address indexed student, uint256 price);
    event TrainingCompleted(uint256 indexed trainingId, address indexed student);
    event TrainingRated(uint256 indexed trainingId, address indexed student, uint256 rating);

    constructor(address _feeRecipient) Ownable(msg.sender) {
        feeRecipient = _feeRecipient;
    }

    function setFeeRecipient(address _recipient) external onlyOwner {
        feeRecipient = _recipient;
    }

    function setPlatformFee(uint256 _feeBps) external onlyOwner {
        platformFeeBps = _feeBps;
    }

    function createTraining(
        string calldata title,
        string calldata description,
        uint256 price,
        string[] calldata capabilities,
        uint256 duration
    ) external returns (uint256) {
        uint256 trainingId = trainingCounter++;

        trainings[trainingId] = Training({
            id: trainingId,
            instructor: msg.sender,
            title: title,
            description: description,
            price: price,
            capabilities: capabilities,
            duration: duration,
            rating: 0,
            totalRatings: 0,
            graduates: 0,
            enrollmentCount: 0,
            active: true,
            createdAt: block.timestamp
        });

        instructorTrainings[msg.sender].push(trainingId);
        emit TrainingCreated(trainingId, msg.sender, title, price);
        return trainingId;
    }

    function enroll(uint256 trainingId) external payable nonReentrant {
        Training storage training = trainings[trainingId];
        require(training.active, "Training not active");
        require(msg.value >= training.price, "Insufficient payment");
        require(studentEnrollment[trainingId][msg.sender].enrolledAt == 0, "Already enrolled");

        uint256 platformFee = (training.price * platformFeeBps) / BPS_DENOMINATOR;
        uint256 instructorPayment = training.price - platformFee;

        (bool success, ) = training.instructor.call{value: instructorPayment}("");
        require(success, "Transfer failed");

        if (platformFee > 0) {
            (bool feeSuccess, ) = feeRecipient.call{value: platformFee}("");
            require(feeSuccess, "Fee transfer failed");
        }

        studentEnrollment[trainingId][msg.sender] = Enrollment({
            student: msg.sender,
            trainingId: trainingId,
            enrolledAt: block.timestamp,
            completedAt: 0,
            completed: false,
            rated: false
        });

        enrollments[trainingId].push(studentEnrollment[trainingId][msg.sender]);
        training.enrollmentCount++;
        studentTrainings[msg.sender].push(trainingId);

        emit TrainingEnrolled(trainingId, msg.sender, training.price);
    }

    function completeTraining(uint256 trainingId) external {
        Enrollment storage enrollment = studentEnrollment[trainingId][msg.sender];
        require(enrollment.enrolledAt > 0, "Not enrolled");
        require(!enrollment.completed, "Already completed");

        enrollment.completed = true;
        enrollment.completedAt = block.timestamp;
        trainings[trainingId].graduates++;

        emit TrainingCompleted(trainingId, msg.sender);
    }

    function rateTraining(uint256 trainingId, uint256 rating) external {
        require(rating > 0 && rating <= 5, "Invalid rating");

        Enrollment storage enrollment = studentEnrollment[trainingId][msg.sender];
        require(enrollment.enrolledAt > 0, "Not enrolled");
        require(enrollment.completed, "Not completed");
        require(!enrollment.rated, "Already rated");

        enrollment.rated = true;

        Training storage training = trainings[trainingId];
        training.rating = ((training.rating * training.totalRatings) + (rating * 100)) / (training.totalRatings + 1);
        training.totalRatings++;

        emit TrainingRated(trainingId, msg.sender, rating);
    }

    function deactivateTraining(uint256 trainingId) external {
        require(trainings[trainingId].instructor == msg.sender, "Unauthorized");
        trainings[trainingId].active = false;
    }

    function getTraining(uint256 trainingId) external view returns (Training memory) {
        return trainings[trainingId];
    }

    function getTrainingCount() external view returns (uint256) {
        return trainingCounter;
    }

    function getEnrollments(uint256 trainingId) external view returns (Enrollment[] memory) {
        return enrollments[trainingId];
    }

    function getStudentTrainings(address student) external view returns (uint256[] memory) {
        return studentTrainings[student];
    }

    function getInstructorTrainings(address instructor) external view returns (uint256[] memory) {
        return instructorTrainings[instructor];
    }

    receive() external payable {}
}
