pragma circom 2.1.0;

include "circomlib\circuits\comparators.circom";
include "circomlib\circuits\poseidon.circom";

/* ============================================================
   REPUTATION RANGE PROOF
   
   PURPOSE:
     Proves agent's reputation >= threshold without revealing
     exact reputation score.
   
   PRIVACY:
     Verifier learns only PASS/FAIL, never actual reputation.
     Salt prevents brute-force attacks on commitment.
   
   SECURITY:
     - Commitment binds agent to specific reputation
     - Cannot claim different reputation in future proofs
     - Salt makes brute-force computationally infeasible
   ============================================================ */

template REPUTATIONRANGEPROOF(){

    signal input Reputation;
    signal input salt;

    signal input threshold;
    signal input Agentaddress;

    signal output isEligible;
    signal output Commitment;

/* For checking is the Reputation-Score lies between ( 0 and a 1000 ) */

    component Reputationcheck = LessEqThan(10);
    Reputationcheck.in[0] <== Reputation;
    Reputationcheck.in[1] <== 1000;
    Reputationcheck.out === 1;

/* For checking is the thresold lies between [0,1000] */

    component thresholdcheck = LessEqThan(10);
    thresholdcheck.in[0] <== threshold;
    thresholdcheck.in[1] <== 1000;
    thresholdcheck.out === 1;

/* This checks if the ReputationScore is greaterthan the threshold limit */

    component eligibilitycheck = GreaterEqThan(10);
    eligibilitycheck.in[0] <== Reputation;
    eligibilitycheck.in[1] <== threshold;
    isEligible <== eligibilitycheck.out;

/* This component makes sure that the salt is never zero */

    component saltcheck = IsZero();

    saltcheck.in <== salt;
    saltcheck.out === 0;

    component commitment = Poseidon(3);

    commitment.inputs[0] <== Agentaddress;
    commitment.inputs[1] <== Reputation;
    commitment.inputs[2] <== salt;
    Commitment <== commitment.out;

    
}

component main{public[Agentaddress,threshold]} = REPUTATIONRANGEPROOF();