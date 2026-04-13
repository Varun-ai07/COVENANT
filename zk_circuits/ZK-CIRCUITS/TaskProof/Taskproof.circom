pragma circom 2.1.0;

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/bitify.circom";

template TaskOutputProof(N) {

    /*  PRIVATE INPUTS */

    signal input outputValues[N];     // actual computed metrics
    signal input rawDataHash;         // hash of private dataset
    signal input sessionNonce;        // replay protection


    /*  PUBLIC INPUTS */

    signal input thresholds[N];       // task requirements
    signal input specHash;            // hash of thresholds/spec
    signal input taskId;              // unique task identifier


    /* OUTPUTS */

    signal output allCriteriaMet;
    signal output deliverableCommitment;
    signal output nullifier;


    /* 1. RANGE CHECKS (SAFE & MINIMAL) */

    component range[N];

    for (var i = 0; i < N; i++) {
        range[i] = Num2Bits(8);       // values 0–255
        range[i].in <== outputValues[i];
    }


    /* 2. SPEC BINDING  thresholds must match specHash */

    component specHasher = Poseidon(N);

    for (var i = 0; i < N; i++) {
        specHasher.inputs[i] <== thresholds[i];
    }

    specHasher.out === specHash;


    /* 3. OUTPUT COMMITMENT binds values → commitment */

    component outputHasher = Poseidon(N);

    for (var i = 0; i < N; i++) {
        outputHasher.inputs[i] <== outputValues[i];
    }

    signal outputHash;
    outputHash <== outputHasher.out;


    /* 4. CRITERIA CHECKS */

    component geq[N];

    for (var i = 0; i < N; i++) {
        geq[i] = GreaterEqThan(8);
        geq[i].in[0] <== outputValues[i];
        geq[i].in[1] <== thresholds[i];
    }


    signal running[N];

    running[0] <== geq[0].out;

    for (var i = 1; i < N; i++) {
        running[i] <== running[i-1] * geq[i].out;
    }

    allCriteriaMet <== running[N-1];


    /* 5. FINAL COMMITMENT (DATASET + OUTPUT + TASK) */

    component finalHash = Poseidon(3);

    finalHash.inputs[0] <== outputHash;
    finalHash.inputs[1] <== rawDataHash;
    finalHash.inputs[2] <== taskId;

    deliverableCommitment <== finalHash.out;


    /* 6. NULLIFIER (REPLAY PROTECTION) */

    component nullifierHash = Poseidon(2);

    nullifierHash.inputs[0] <== outputHash;
    nullifierHash.inputs[1] <== sessionNonce;

    nullifier <== nullifierHash.out;
}


    /* MAIN */

component main {public [thresholds, specHash, taskId]} = TaskOutputProof(4);