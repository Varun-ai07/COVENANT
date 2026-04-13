// SPDX-License-Identifier: GPL-3.0
/*
    Copyright 2021 0KIMS association.

    This file is generated with [snarkJS](https://github.com/iden3/snarkjs).

    snarkJS is a free software: you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    snarkJS is distributed in the hope that it will be useful, but WITHOUT
    ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
    License for more details.

    You should have received a copy of the GNU General Public License
    along with snarkJS. If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity >=0.7.0 <0.9.0;

contract Groth16Verifier {
    // Scalar field size
    uint256 constant r    = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    // Base field size
    uint256 constant q   = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    // Verification Key data
    uint256 constant alphax  = 21547937735738028612706181316575288016711669474768504207265822313354869716992;
    uint256 constant alphay  = 11091661334064069689989856626871908106521930604335647964928962679109102077024;
    uint256 constant betax1  = 18617939416987839840146999306780328956651911832720988848026272827952682376043;
    uint256 constant betax2  = 8209305270996888528949250013605777996423686482795562192366165496533394419322;
    uint256 constant betay1  = 13379617546689210225767054364705878162417135870455198600264490943422527707409;
    uint256 constant betay2  = 7347970570496191711546431215142887258743938271787270897665579216606892944492;
    uint256 constant gammax1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant gammax2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant gammay1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant gammay2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;
    uint256 constant deltax1 = 7248358636778313864133645295492061213954199496227014508808455599521560619469;
    uint256 constant deltax2 = 1594542042130353747870201264730025029138750866002165134335842061126498878310;
    uint256 constant deltay1 = 15601315129443902966517052083114439824236591743315240652719821348531855288561;
    uint256 constant deltay2 = 17235130625569039748116399062123303817077057066883255813638391205689509282834;

    
    uint256 constant IC0x = 16485288641810124759810273582303640673407115181386716532690210337921232605448;
    uint256 constant IC0y = 7546255152401306502338267374161417144094101877083575313153427355827004414863;
    
    uint256 constant IC1x = 16368712962157370669594461550693113284933888941144692156792710955419490602429;
    uint256 constant IC1y = 12209899133724519760500286048261014013541275396155857048472056825626544950036;
    
    uint256 constant IC2x = 18941565655366129861857930329133604443865883009252746711163957794642717108801;
    uint256 constant IC2y = 19590152704826889941071497058655544222214677394735859342734362995921381571425;
    
    uint256 constant IC3x = 203128009994985606089245115875725133449706801621432985482692226492213619008;
    uint256 constant IC3y = 5942530316555198390756226559327884583543094786687968218912026062307555880118;
    
    uint256 constant IC4x = 2197125418988113338100915835883891614699071119182071272403250960255589471939;
    uint256 constant IC4y = 8917854509260061277019550620185302665906673822152337361017566261585102254;
    
    uint256 constant IC5x = 167470037682195793867688182311392976072378097055829661923084069055917383724;
    uint256 constant IC5y = 15287314696425881874129533354384560958244296901317390464481386255514659239744;
    
    uint256 constant IC6x = 18575096955828401503416486033887703383035158828440487670329119120974875890510;
    uint256 constant IC6y = 1166820818473206630721263325726006707929114408321743367980366259134199839664;
    
    uint256 constant IC7x = 10511432163761393752359975711125451695090344013272335292886276550627860577920;
    uint256 constant IC7y = 9754977908551444316199854858985038005982887956085079846414135874594104777987;
    
    uint256 constant IC8x = 9043622973463359715795603414031905417903670823457210591170815989712305236131;
    uint256 constant IC8y = 11069984368516834206830734186068273473702218982249615381768763728739202747165;
    
    uint256 constant IC9x = 13373344640584429633947528472372637533392633296805849145288304011903985092558;
    uint256 constant IC9y = 14691713744690513166396411690362407481536866670469334597296693269133160957142;
    
 
    // Memory data
    uint16 constant pVk = 0;
    uint16 constant pPairing = 128;

    uint16 constant pLastMem = 896;

    function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[9] calldata _pubSignals) public view returns (bool) {
        assembly {
            function checkField(v) {
                if iszero(lt(v, r)) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }
            
            // G1 function to multiply a G1 value(x,y) to value in an address
            function g1_mulAccC(pR, x, y, s) {
                let success
                let mIn := mload(0x40)
                mstore(mIn, x)
                mstore(add(mIn, 32), y)
                mstore(add(mIn, 64), s)

                success := staticcall(sub(gas(), 2000), 7, mIn, 96, mIn, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }

                mstore(add(mIn, 64), mload(pR))
                mstore(add(mIn, 96), mload(add(pR, 32)))

                success := staticcall(sub(gas(), 2000), 6, mIn, 128, pR, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }

            function checkPairing(pA, pB, pC, pubSignals, pMem) -> isOk {
                let _pPairing := add(pMem, pPairing)
                let _pVk := add(pMem, pVk)

                mstore(_pVk, IC0x)
                mstore(add(_pVk, 32), IC0y)

                // Compute the linear combination vk_x
                
                g1_mulAccC(_pVk, IC1x, IC1y, calldataload(add(pubSignals, 0)))
                
                g1_mulAccC(_pVk, IC2x, IC2y, calldataload(add(pubSignals, 32)))
                
                g1_mulAccC(_pVk, IC3x, IC3y, calldataload(add(pubSignals, 64)))
                
                g1_mulAccC(_pVk, IC4x, IC4y, calldataload(add(pubSignals, 96)))
                
                g1_mulAccC(_pVk, IC5x, IC5y, calldataload(add(pubSignals, 128)))
                
                g1_mulAccC(_pVk, IC6x, IC6y, calldataload(add(pubSignals, 160)))
                
                g1_mulAccC(_pVk, IC7x, IC7y, calldataload(add(pubSignals, 192)))
                
                g1_mulAccC(_pVk, IC8x, IC8y, calldataload(add(pubSignals, 224)))
                
                g1_mulAccC(_pVk, IC9x, IC9y, calldataload(add(pubSignals, 256)))
                

                // -A
                mstore(_pPairing, calldataload(pA))
                mstore(add(_pPairing, 32), mod(sub(q, calldataload(add(pA, 32))), q))

                // B
                mstore(add(_pPairing, 64), calldataload(pB))
                mstore(add(_pPairing, 96), calldataload(add(pB, 32)))
                mstore(add(_pPairing, 128), calldataload(add(pB, 64)))
                mstore(add(_pPairing, 160), calldataload(add(pB, 96)))

                // alpha1
                mstore(add(_pPairing, 192), alphax)
                mstore(add(_pPairing, 224), alphay)

                // beta2
                mstore(add(_pPairing, 256), betax1)
                mstore(add(_pPairing, 288), betax2)
                mstore(add(_pPairing, 320), betay1)
                mstore(add(_pPairing, 352), betay2)

                // vk_x
                mstore(add(_pPairing, 384), mload(add(pMem, pVk)))
                mstore(add(_pPairing, 416), mload(add(pMem, add(pVk, 32))))


                // gamma2
                mstore(add(_pPairing, 448), gammax1)
                mstore(add(_pPairing, 480), gammax2)
                mstore(add(_pPairing, 512), gammay1)
                mstore(add(_pPairing, 544), gammay2)

                // C
                mstore(add(_pPairing, 576), calldataload(pC))
                mstore(add(_pPairing, 608), calldataload(add(pC, 32)))

                // delta2
                mstore(add(_pPairing, 640), deltax1)
                mstore(add(_pPairing, 672), deltax2)
                mstore(add(_pPairing, 704), deltay1)
                mstore(add(_pPairing, 736), deltay2)


                let success := staticcall(sub(gas(), 2000), 8, _pPairing, 768, _pPairing, 0x20)

                isOk := and(success, mload(_pPairing))
            }

            let pMem := mload(0x40)
            mstore(0x40, add(pMem, pLastMem))

            // Validate that all evaluations ∈ F
            
            checkField(calldataload(add(_pubSignals, 0)))
            
            checkField(calldataload(add(_pubSignals, 32)))
            
            checkField(calldataload(add(_pubSignals, 64)))
            
            checkField(calldataload(add(_pubSignals, 96)))
            
            checkField(calldataload(add(_pubSignals, 128)))
            
            checkField(calldataload(add(_pubSignals, 160)))
            
            checkField(calldataload(add(_pubSignals, 192)))
            
            checkField(calldataload(add(_pubSignals, 224)))
            
            checkField(calldataload(add(_pubSignals, 256)))
            

            // Validate all evaluations
            let isValid := checkPairing(_pA, _pB, _pC, _pubSignals, pMem)

            mstore(0, isValid)
             return(0, 0x20)
         }
     }
 }
