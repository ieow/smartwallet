import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";
import { Smart } from "../target/types/smart";
import { BorshTypesCoder } from "@coral-xyz/anchor/dist/cjs/coder/borsh/types";
import { Hex } from "@noble/curves/abstract/utils";
import { BN } from "bn.js";

export const secp256k1Sign = (signer: Uint8Array, hash: Hex, walletSeed?: Uint8Array) => {
  const publicKeySEC1 = secp256k1.getPublicKey(signer, false); // msg
  const signerPubkey = publicKeySEC1.subarray(publicKeySEC1.length-64)
  const finalWalletSeed = walletSeed || signerPubkey.subarray(0, 32);

  if ( finalWalletSeed.length > 32 ) {
    throw new Error("walletSeed too long. Max 32 bytes")
  }

  const signature = secp256k1.sign(hash, signer);
  
  const executeSignature = {
    recoveryId: signature.recovery, 
    compactSignature: Array.from(signature.toCompactRawBytes()),
    signerPubkey: Array.from(signerPubkey),
    walletSeed: Array.from(finalWalletSeed),        
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
    Array.from(walletSeed), //seed
    account[0] // pda pubkey
  )
  return method
}

export function executeInstruction ( 
  instruction: anchor.web3.TransactionInstruction, 
  signer: Uint8Array,
  program: Program<Smart>
) {

  const instructionData = {
    data: instruction.data,
    keys: instruction.keys,
    programId: instruction.programId
  }

  const executeArgs = program.coder.types.encode("executeInstructionParams", instructionData);
  const executeArgsHash = keccak_256(executeArgs);

  const executeSignature = secp256k1Sign(signer, executeArgsHash);

  // invoke execute instruction with inst
  const method = program.methods
    .executeInstruction(
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
    
  return method
}


export async function executeMultipleInstruction ( 
  instruction: anchor.web3.TransactionInstruction[], 
  signer: Uint8Array,
  program: Program<Smart>
) {

  const instructionData = instruction.map(inst => {
    
    const instData = {
      data: inst.data,
      keys: inst.keys,
      programId: inst.programId
    }
    return instData
  })

  const params = {
    list : instructionData
  }

  const executeArgs = program.coder.types.encode("vecExecuteMultipleInstructionParams", params);

  const executeArgsHash = keccak_256(executeArgs);
  const executeSignature = secp256k1Sign(signer, executeArgsHash);

  // invoke execute multiple instruction 
  const method = program.methods
    .executeMultipleInstruction(
      executeSignature,
      params
    ).remainingAccounts(
      [ 
        ...instruction.reduce((acc, inst) => [...acc, ...inst.keys], []), 
        {
          pubkey: program.programId,
          isSigner: false,
          isWritable: false
        }
      ]
    )
    
  return method
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



export async function waitForConfirmation ( params: {
  connection: anchor.web3.Connection, 
  tx: string, 
  blockhash?: anchor.web3.BlockhashWithExpiryBlockHeight,
  getDetails?: boolean;
  maxSupportedTransactionVersion?: number
} ) {
  let { connection, tx, blockhash, getDetails, maxSupportedTransactionVersion } = params;

  if (!blockhash) {
    blockhash = await connection.getLatestBlockhash({
      commitment: "confirmed",
    });
  }
  // wait for confirmation
  const confrim = await connection.confirmTransaction({
    signature : tx,
    blockhash: blockhash.blockhash,
    lastValidBlockHeight : blockhash.lastValidBlockHeight
  }, 'confirmed');

  if (getDetails) {
    const txDetails = await connection.getTransaction(tx, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: maxSupportedTransactionVersion === undefined ? 1 : maxSupportedTransactionVersion
    });
    console.log(txDetails);
  }
}