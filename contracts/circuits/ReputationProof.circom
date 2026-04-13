pragma circom 2.1.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

template ReputationRangeProof() {
    /* PRIVATE INPUTS */
    signal input reputation;        // agent's actual reputation score (0-1000)
    signal input threshold;         // minimum reputation required (publicly known)
    signal input salt;              // random salt to prevent brute force attacks
    signal input agentAddress;      // agent's address to bind the proof

    /* PUBLIC INPUTS */
    // None needed - all inputs are private except what we prove

    /* OUTPUTS */
    signal output isEligible;       // 1 if reputation >= threshold, 0 otherwise
    signal output commitment;       // commitment to (agentAddress, reputation, salt)

    /* VALIDATION CHECKS */
    // Ensure reputation is in valid range [0, 1000]
    component reputationCheck = LessEqThan(10);
    reputationCheck.in[0] <== reputation;
    reputationCheck.in[1] <== 1000;
    reputationCheck.out === 1;

    // Ensure threshold is in valid range [0, 1000]
    component thresholdCheck = LessEqThan(10);
    thresholdCheck.in[0] <== threshold;
    thresholdCheck.in[1] <== 1000;
    thresholdCheck.out === 1;

    // Ensure salt is not zero (to prevent certain attacks)
    component saltCheck = IsZero();
    saltCheck.in <== salt;
    saltCheck.out === 0;

    /* ELIGIBILITY CHECK: reputation >= threshold */
    component eligibilityCheck = GreaterEqThan(10);
    eligibilityCheck.in[0] <== reputation;
    eligibilityCheck.in[1] <== threshold;
    isEligible <== eligibilityCheck.out;

    /* COMMITMENT: hash(agentAddress, reputation, salt) */
    component commitmentHash = Poseidon(3);
    commitmentHash.inputs[0] <== agentAddress;
    commitmentHash.inputs[1] <== reputation;
    commitmentHash.inputs[2] <== salt;
    commitment <== commitmentHash.out;
}

// Main component makes Agentaddress and threshold public
component main {public [agentAddress, threshold]} = ReputationRangeProof();