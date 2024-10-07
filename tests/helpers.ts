import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";
import { Smart } from "../target/types/smart";
import { BorshTypesCoder } from "@coral-xyz/anchor/dist/cjs/coder/borsh/types";

export async function executeInstruction ( 
    instruction: anchor.web3.TransactionInstruction, 
    signer: Uint8Array,
    program: Program<Smart>
  ) {

    const blockhash = await program.provider.connection.getLatestBlockhash();

    const instructionData = {
      data: instruction.data,
      programId: instruction.programId
    }

    const publicKeySEC1 = secp256k1.getPublicKey(signer, false); // msg
    const signerPubkey = publicKeySEC1.subarray(publicKeySEC1.length-64)
    const walletSeed = signerPubkey.subarray(0, 32);

    const typeCoder =  new BorshTypesCoder( program.idl);
    const executeArgs = typeCoder.encode("executeInstructionParams", instructionData)
    
    const executeArgsHash = keccak_256(executeArgs);
    const signature = secp256k1.sign(executeArgsHash, signer );
    
    const executeSignature = {
      recoveryId: signature.recovery, 
      compactSignature: Array.from(signature.toCompactRawBytes()),
      signerPubkey: Array.from(signerPubkey),
      walletSeed: Array.from(walletSeed),        
    }
    // // invoke execute instruction with inst2
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
      
    const txSignature = await method4.rpc();
    console.log("Your transaction signature", txSignature);

    // // wait for confirmation
    const confirm4 = await program.provider.connection.confirmTransaction({
      signature : txSignature,
      blockhash: blockhash.blockhash,
      lastValidBlockHeight : blockhash.lastValidBlockHeight
    }, 'confirmed');
    console.log("confirm3", confirm4);

    // // get transaction details
    const txDetails4 = await program.provider.connection.getTransaction(txSignature, {
      commitment: 'confirmed',
    })
    console.log(txDetails4);
  }