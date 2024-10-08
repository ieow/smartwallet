import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Smart } from "../target/types/smart";
import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from '@noble/hashes/sha3';
import { BN } from "bn.js";
import { BorshTypesCoder } from "@coral-xyz/anchor/dist/cjs/coder/borsh/types";
import { createWallet, executeInstruction, transferSol } from "./helpers";
import { createMint, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
 

describe("smart", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Smart as Program<Smart>;

  const payer = anchor.getProvider();
  
  const mintAuthority = anchor.web3.Keypair.generate();
  const freezeAuthority = anchor.web3.Keypair.generate();

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
  
  it("Creates a wallet", async () => {
    // const hash = new Uint8Array(32); // 32-byte array for hash
    const signer = secp256k1.utils.randomPrivateKey();
    const publicKeySEC1 = secp256k1.getPublicKey(signer, false); // msg
    const signerPubkey = publicKeySEC1.subarray(publicKeySEC1.length-64)
    const walletSeed = signerPubkey.subarray(0, 32);

    const pdaPrefixSeed = anchor.utils.bytes.utf8.encode("wallet-seed");

    const account = anchor.web3.PublicKey.findProgramAddressSync([ pdaPrefixSeed, walletSeed ], program.programId);

    const blockhash = await program.provider.connection.getLatestBlockhash();
    console.log("blockhash", blockhash);


    // const tx = await program.methods
    //   .createWallet(
    //     {
    //       recoveryId: recoveryId,
    //       compactSignature: Array.from(signatureRS),
    //       signerPubkey: Array.from(signerPubkey),
    //       walletSeed: Array.from(walletSeed),
    //     },
    //     Array.from(walletSeed),
    //     account[0]
    //   ).rpc();
    const method = createWallet(program, signer, walletSeed);
    const tx = await method.rpc();
    console.log("Your transaction signature", tx);

    // wait for confirmation
    const confrim = await program.provider.connection.confirmTransaction({
      signature : tx,
      blockhash: blockhash.blockhash,
      lastValidBlockHeight : blockhash.lastValidBlockHeight
    }, 'confirmed');

    const txDetails = await program.provider.connection.getTransaction(tx, {
      commitment: 'confirmed',
    })
    console.log(txDetails);

    console.log("====================== ======================");

    // airdrop to account
    const tx1 = await program.provider.connection.requestAirdrop(account[0], 1 * anchor.web3.LAMPORTS_PER_SOL);
    const confrim1 = await program.provider.connection.confirmTransaction({
      signature : tx1,
      blockhash: blockhash.blockhash,
      lastValidBlockHeight : blockhash.lastValidBlockHeight
    }, 'confirmed'); 
    
    // send sol
    let keypair = anchor.web3.Keypair.generate();
    const method2 = transferSol(program, signer, keypair.publicKey, 0.1);
    try {
      // execute send sol transaction for pda
      const inst2 = await  method2.instruction();
      const tx2 = await method2.rpc();

      console.log("====================== ===================");
      
      const method4 = await executeInstruction(inst2, signer, program);
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
    } catch (error) {
      console.log("error", error);
      console.log("error", error.getLogs());
      throw error
    }
  });



  it("Mint SPL" , async () => {
    
  })
});
