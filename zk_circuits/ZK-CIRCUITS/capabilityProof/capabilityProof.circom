pragma circom 2.1.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

template CapabilityProof() {

    /* PRIVATE INPUTS */

    signal input capabilitySecret;   // secret per capability
    signal input modelHash;          // hidden implementation
    signal input sessionNonce;       // unique per proof


    /* PUBLIC INPUTS */

    signal input capabilityId;       // what capability is claimed
    signal input agentAddress;       // binds proof to agent
    signal input registeredCommitment; // stored on-chain


    /*  OUTPUTS  */

    signal output commitment;
    signal output nullifier;


    /*  1. STATIC COMMITMENT (REGISTRATION) */

    // This MUST be deterministic and match on-chain value
    component commitHash = Poseidon(4);

    commitHash.inputs[0] <== capabilitySecret;
    commitHash.inputs[1] <== modelHash;
    commitHash.inputs[2] <== capabilityId;
    commitHash.inputs[3] <== agentAddress;

    commitment <== commitHash.out;


    /*  2. VERIFY AGAINST REGISTERED VALUE */

    commitment === registeredCommitment;


    /*  3. NULLIFIER (REPLAY PROTECTION) */

    component nullifierHash = Poseidon(3);

    nullifierHash.inputs[0] <== capabilitySecret;
    nullifierHash.inputs[1] <== sessionNonce;
    nullifierHash.inputs[2] <== capabilityId;

    nullifier <== nullifierHash.out;


    /*  4. CAPABILITY BINDING SECURITY */

    // capabilityId inside commitment ensures:
    // you cannot reuse one capability secret for another

}
 
component main {public [capabilityId, agentAddress, registeredCommitment]} = CapabilityProof();