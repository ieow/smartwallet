import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Smart } from "../target/types/smart";
import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from '@noble/hashes/sha3';
import { BN } from "bn.js";
import { BorshTypesCoder } from "@coral-xyz/anchor/dist/cjs/coder/borsh/types";
import { createWallet, executeInstruction, executeMultipleInstruction, transferSol } from "./helpers";
import { createAssociatedTokenAccount, createAssociatedTokenAccountInstruction, createMint, createTransferCheckedInstruction, getAssociatedTokenAddress, mintTo, TOKEN_2022_PROGRAM_ID, transferChecked } from '@solana/spl-token';
 

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
      
      const method4 = executeInstruction(inst2, signer, program);
      console.log((await method4.instruction()).data )

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


      // 
      const setComputeUnitLimit = anchor.web3.ComputeBudgetProgram.setComputeUnitLimit( {units : 1_400_000} )
      
      const method5 = await executeMultipleInstruction([inst2, inst2], signer, program);
      console.log((await method5.instruction()).data )
      method5.preInstructions ( [ setComputeUnitLimit] );
      const tx5 = await method5.rpc();
      
      // const tx5 = await program.provider.connection.sendRawTransaction(tx5_transaction.serialize());

      // // wait for confirmation
      const confirm5 = await program.provider.connection.confirmTransaction({
        signature : tx5,
        blockhash: blockhash.blockhash,
        lastValidBlockHeight : blockhash.lastValidBlockHeight
      }, 'confirmed');
      console.log("confirm3", confirm5);

      // // get transaction details
      const txDetails5 = await program.provider.connection.getTransaction(tx5, {
        commitment: 'confirmed',
      })
      console.log(txDetails5);

    } catch (error) {
      console.log("error", error);
      console.log("error", error.getLogs());
      throw error
    }
  });



  it("Mint SPL" , async () => {
    const signer = secp256k1.utils.randomPrivateKey();
    const publicKeySEC1 = secp256k1.getPublicKey(signer, false); // msg
    const signerPubkey = publicKeySEC1.subarray(publicKeySEC1.length-64)
    const walletSeed = signerPubkey.subarray(0, 32);

    const pdaPrefixSeed = anchor.utils.bytes.utf8.encode("wallet-seed");
    const account = anchor.web3.PublicKey.findProgramAddressSync([ pdaPrefixSeed, walletSeed ], program.programId);

    // create a pda account
    const pda = anchor.web3.Keypair.generate();
    const method = createWallet(program, signer, walletSeed);
    await method.rpc();

    // create a mint token
    const mintAuthority = anchor.web3.Keypair.generate();
    const freezeAuthority = anchor.web3.Keypair.generate();
    const decimals = 9;


    // airdrop sol to acc and mint auth
    const blockhash = await program.provider.connection.getLatestBlockhash();
    const tx_airdrp1 = await program.provider.connection.requestAirdrop(account[0], 1 * anchor.web3.LAMPORTS_PER_SOL);
    const confrim1 = await program.provider.connection.confirmTransaction({
      signature : tx_airdrp1,
      blockhash: blockhash.blockhash,
      lastValidBlockHeight : blockhash.lastValidBlockHeight
    }, 'confirmed');


    const tx_airdrp2 = await program.provider.connection.requestAirdrop(mintAuthority.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
    const confrim2 = await program.provider.connection.confirmTransaction({
      signature : tx_airdrp2,
      blockhash: blockhash.blockhash,
      lastValidBlockHeight : blockhash.lastValidBlockHeight
    }, 'confirmed');
    
    // create mint token
    const token = await createMint(
      program.provider.connection,
      mintAuthority, // payer
      mintAuthority.publicKey,
      freezeAuthority.publicKey,
      decimals
    );


    // derive pda token account
    // allowOwnerOffCurve: true is needed for PDAs
    const pdaTokenAccount = await getAssociatedTokenAddress(token, account[0] , true);

    // const pdaTokenAccountOnChain = await createAssociatedTokenAccount(
    //   program.provider.connection,
    //   mintAuthority, // payer
    //   // pdaTokenAccount, // account
    //   token, // mint
    //   account[0], // owner ( smart wallet (our program pda))
    // )
    const inst = createAssociatedTokenAccountInstruction(
      mintAuthority.publicKey, // payer
      pdaTokenAccount, // account
      account[0], // owner ( smart wallet (our program pda))
      token // mint 
    )

    // const method2 = executeInstruction(inst, signer, program);
    // const pda_inst = await method2.instruction();

    const transactionM = new anchor.web3.TransactionMessage({
      payerKey: mintAuthority.publicKey,
      recentBlockhash: blockhash.blockhash,
      instructions: [inst]
    })
    
    const vtx = new anchor.web3.VersionedTransaction(transactionM.compileToV0Message());
    vtx.sign([mintAuthority]);

    const vtx_hash = await program.provider.connection.sendTransaction(vtx);
    console.log("tx_hash", vtx_hash);

    // wait confirmation
    const confirm = await program.provider.connection.confirmTransaction({
      signature : vtx_hash,
      blockhash: blockhash.blockhash,
      lastValidBlockHeight : blockhash.lastValidBlockHeight
    }, 'confirmed');
    console.log("confirm", confirm);

    // mint token to wallet
    const tx = await mintTo(
      program.provider.connection,
      mintAuthority, // payer
      token, // mint
      pdaTokenAccount, // dest (receiver)
      mintAuthority.publicKey, // auth
      1_000_000_000_000,
    )


    
    // create Transfer token instruction
    // transferChecked
    const instTrf = createTransferCheckedInstruction (
      pdaTokenAccount, // source
      token, // mint
      pdaTokenAccount, //dest
      account[0], // owner
      1,
      decimals
    )

    console.log(instTrf.keys)

    // // execute inst with pda
    const method2 = executeInstruction(instTrf, signer, program);
    const pda_inst = await method2.instruction();


    console.log("keys", pda_inst.keys)
    console.log("pda_acc", account[0])
    // make pda is not signer so inst that can be send out
    // it will by signed by the program
    pda_inst.keys.forEach(key =>  {
      if (key.pubkey.equals(account[0]) ) {
        key.isSigner = false
      }
    })

    console.log("keys", pda_inst.keys)
    const setComputeUnitLimit = anchor.web3.ComputeBudgetProgram.setComputeUnitLimit( {units : 1_400_000} )

    // // compile transaction
    const pdaTransactionMessage = new anchor.web3.TransactionMessage({
      payerKey: mintAuthority.publicKey,
      recentBlockhash: blockhash.blockhash,
      instructions: [setComputeUnitLimit, pda_inst]
    });

    const vtx2 = new anchor.web3.VersionedTransaction(pdaTransactionMessage.compileToV0Message());
    vtx2.sign([mintAuthority]);

    try {
      const vtx_hash2 = await program.provider.connection.sendTransaction(vtx2);
      console.log("tx_hash2", vtx_hash2);

      // wait confirmation
      const confirm2 = await program.provider.connection.confirmTransaction({
        signature : vtx_hash2,
        blockhash: blockhash.blockhash,
        lastValidBlockHeight : blockhash.lastValidBlockHeight
      }, 'confirmed');
      console.log("confirm2", confirm2);
    }catch (error) {
      console.log("error", error);
      console.log("error", error.getLogs());
    }

  })
});
