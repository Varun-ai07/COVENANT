template CapabilityProof() {
    signal input capabilityHash;
    signal input secret;
    signal output proof;
    
    // Prove knowledge of secret without revealing
    component hasher = Poseidon(2);
    hasher.inputs[0] <== capabilityHash;
    hasher.inputs[1] <== secret;
    proof <== hasher.out;
}
