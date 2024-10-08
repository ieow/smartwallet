import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";
import { Smart } from "../target/types/smart";
import { BorshTypesCoder } from "@coral-xyz/anchor/dist/cjs/coder/borsh/types";
import { Hex } from "@noble/curves/abstract/utils";
import { BN } from "bn.js";

export const secp256k1Sign = (signer: Uint8Array, hash: Hex) => {
  const publicKeySEC1 = secp256k1.getPublicKey(signer, false); // msg
  const signerPubkey = publicKeySEC1.subarray(publicKeySEC1.length-64)
  const walletSeed = signerPubkey.subarray(0, 32);

  const signature = secp256k1.sign(hash, signer);
  
  const executeSignature = {
    recoveryId: signature.recovery, 
    compactSignature: Array.from(signature.toCompactRawBytes()),
    signerPubkey: Array.from(signerPubkey),
    walletSeed: Array.from(walletSeed),        
  }
  return executeSignature
}

export function createWallet ( program: Program<Smart>, signer: Uint8Array, walletSeed: Uint8Array ) {
  const pdaPrefixSeed = anchor.utils.bytes.utf8.encode("wallet-seed");
  const account = anchor.web3.PublicKey.findProgramAddressSync([ pdaPrefixSeed, walletSeed ], program.programId);

  const hash = keccak_256(walletSeed);
  const signature = secp256k1Sign(signer, hash);

  const method = program.methods.createWallet(
    signature,
    Array.from(walletSeed),
    account[0]
  )
  
  return method
}

export async function executeInstruction ( 
    instruction: anchor.web3.TransactionInstruction, 
    signer: Uint8Array,
    program: Program<Smart>
  ) {

    const instructionData = {
      data: instruction.data,
      programId: instruction.programId
    }

    const executeArgs = program.coder.types.encode("executeInstructionParams", instructionData);
    const executeArgsHash = keccak_256(executeArgs);

    const executeSignature = secp256k1Sign(signer, executeArgsHash);

    // invoke execute instruction with inst2
    const method4 = program.methods
      .execute(
        executeSignature,
        instructionData
      ).remainingAccounts(
        [ 
          ...instruction.keys, 
          {
            pubkey: program.programId,
            isSigner: false,
            isWritable: false
          }
        ]
      )
      
    return method4

  }

export function transferSol ( program: Program<Smart>, signer: Uint8Array, to: anchor.web3.PublicKey, amount: number ) {
    console.log("from pubkey", anchor.getProvider().publicKey);
    const sendSolParams = {
      from: anchor.getProvider().publicKey,
      to : to,
      amount : new BN(amount * anchor.web3.LAMPORTS_PER_SOL), 
    }

    const sendSolArgs = program.coder.types.encode(
      "transferSolParams",
      sendSolParams
    )
    const sendSolArgsHash = keccak_256(sendSolArgs);
    const sendSolSignatureParams = secp256k1Sign(signer, sendSolArgsHash);
    // execute send sol transaction for pda
    const method2 = program.methods
      .transfer(
        sendSolSignatureParams,
        sendSolParams,
      ).accounts(
        {
          to: to,
        }
      )

    return method2
}