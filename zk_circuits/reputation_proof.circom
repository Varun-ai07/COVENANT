template ReputationAboveThreshold() {
    signal input reputation;
    signal input threshold;
    signal input salt;
    signal output isEligible;
    signal output commitment;
    
    // Range check: reputation >= threshold
    component geq = GreaterEqThan(10);
    geq.in[0] <== reputation;
    geq.in[1] <== threshold;
    isEligible <== geq.out;
    
    // Commitment for privacy
    component hasher = Poseidon(2);
    hasher.inputs[0] <== reputation;
    hasher.inputs[1] <== salt;
    commitment <== hasher.out;
}
