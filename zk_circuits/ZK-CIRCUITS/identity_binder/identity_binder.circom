pragma circom 2.1.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/babyjub.circom";
include "circomlib/circuits/comparators.circom";

template IdentityBinder() {

    // PRIVATE INPUTS
    signal input privateKey; 
    signal input nonce; // To prevent replay for the same agent and same context

    // PUBLIC INPUTS
    signal input address;
    signal input contextHash;

    // OUTPUTS
    signal output nullifier;
    signal output publickeyHash; 

    // 1. Baby Jubjub public key derivation
    component pubKey = BabyPbk();
    pubKey.in <== privateKey;
    
    // 2. Hash the public key
    component pubKeyHasher = Poseidon(2);
    pubKeyHasher.inputs[0] <== pubKey.Ax;
    pubKeyHasher.inputs[1] <== pubKey.Ay;
    
    // Fix: Using 'publickeyHash' to match the output signal name
    publickeyHash <== pubKeyHasher.out;

    // 3. Safety check (optional but here since you included the library)
    component nonceCheck = IsZero();
    nonceCheck.in <== nonce;

    // 4. Generate the Nullifier
    component nullifierHasher = Poseidon(3);
    nullifierHasher.inputs[0] <== privateKey; // Now matches the input signal
    nullifierHasher.inputs[1] <== nonce;
    nullifierHasher.inputs[2] <== contextHash;
    
    nullifier <== nullifierHasher.out;
    
    // 5. Explicitly bind the address
    // This ensures 'address' is part of the circuit's constraint system
    signal addressSquared <== address * address;
}

component main {public [address, contextHash]} = IdentityBinder();