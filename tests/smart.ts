import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Smart } from "../target/types/smart";
import { secp256k1 } from "@noble/curves/secp256k1";
import { createWallet, executeInstruction, executeMultipleInstruction, transferSol, waitForConfirmation } from "./helpers";
import { createAssociatedTokenAccountInstruction, createMint, createTransferCheckedInstruction, getAssociatedTokenAddress, mintTo, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, transferChecked } from '@solana/spl-token';
 
const fakeSigner = [true, false]

for (let i = 0; i < fakeSigner.length; i++) {
  const isFakeSigner = fakeSigner[i];

  describe("smart", () => {
    // Configure the client to use the local cluster.
    anchor.setProvider(anchor.AnchorProvider.env());

    const program = anchor.workspace.Smart as Program<Smart>;

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
  
      // create pda
      const method = createWallet(program, signer, walletSeed);
      const tx = await method.rpc();

      // wait for confirmation
      await waitForConfirmation({ connection: program.provider.connection, tx: tx, blockhash: blockhash, getDetails: true });

      console.log("===================== Transfer Sol on behalf of PDA ======================");

      // airdrop to pda account
      const airdropTxSig = await program.provider.connection.requestAirdrop(account[0], 1 * anchor.web3.LAMPORTS_PER_SOL);
      await waitForConfirmation({ connection: program.provider.connection, tx: airdropTxSig, blockhash: blockhash, getDetails: false });
      
      // send sol on behalf of pda
      let keypair = anchor.web3.Keypair.generate();
      const method2 = transferSol(program, signer, keypair.publicKey, 0.1);

      // execute send sol transaction for pda
      const inst2 = await  method2.instruction();
      const tx2 = await method2.rpc();

      // wait for confirmation
      await waitForConfirmation({ connection: program.provider.connection, tx: tx2, blockhash: blockhash, getDetails: true });

      console.log("====================== Execute Instruction on behalf of PDA ===================");
      
      const method4 = executeInstruction(inst2, signer, program );
      const txSignature = await method4.rpc();
      // wait for confirmation
      await waitForConfirmation({ connection: program.provider.connection, tx: txSignature, blockhash: blockhash, getDetails: true }); 


      console.log("====================== Execute  Multiple Instruction on behalf of PDA ===================");
      
      // set instruction compute unit to Max
      const setComputeUnitLimit = anchor.web3.ComputeBudgetProgram.setComputeUnitLimit( {units : 1_400_000} )
      
      const method5 = await executeMultipleInstruction([inst2, inst2], signer, program, isFakeSigner);
      method5.preInstructions ( [ setComputeUnitLimit] );

      const tx5 = await method5.rpc().catch((e) => {
        if (!isFakeSigner) {
          throw e;
        };
      });

      if (isFakeSigner) {
        return;
      }
      
      // wait for confirmation
      await waitForConfirmation({ connection: program.provider.connection, tx: tx5, blockhash: blockhash, getDetails: true });
    });



    it("Mint SPL" , async () => {
      const signer = secp256k1.utils.randomPrivateKey();
      const publicKeySEC1 = secp256k1.getPublicKey(signer, false); // msg
      const signerPubkey = publicKeySEC1.subarray(publicKeySEC1.length-64)
      const walletSeed = signerPubkey.subarray(0, 32);

      const pdaPrefixSeed = anchor.utils.bytes.utf8.encode("wallet-seed");
      const account = anchor.web3.PublicKey.findProgramAddressSync([ pdaPrefixSeed, walletSeed ], program.programId);

      // create a pda account
      const method = createWallet(program, signer, walletSeed);
      await method.rpc();

      // create a mint token
      const mintAuthority = anchor.web3.Keypair.generate();
      const freezeAuthority = anchor.web3.Keypair.generate();
      const decimals = 9;


      // airdrop sol to acc and mint auth
      const blockhash = await program.provider.connection.getLatestBlockhash();
      const airdripAccountTxSign = await program.provider.connection.requestAirdrop(account[0], 1 * anchor.web3.LAMPORTS_PER_SOL);
      await waitForConfirmation({ connection: program.provider.connection, tx: airdripAccountTxSign, blockhash: blockhash, getDetails: false });

      const airdropAuthorityTxSign = await program.provider.connection.requestAirdrop(mintAuthority.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
      await waitForConfirmation({ connection: program.provider.connection, tx: airdropAuthorityTxSign, blockhash: blockhash, getDetails: false });
      
      // create mint token
      console.log('==================== Create and Preparing Mint Token =====================');
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
      
      const inst = createAssociatedTokenAccountInstruction(
        mintAuthority.publicKey, // payer
        pdaTokenAccount, // account
        account[0], // owner ( smart wallet (our program pda))
        token // mint 
      )

      // SPL tx need version 0 tx
      const txMsg = new anchor.web3.TransactionMessage({
        payerKey: mintAuthority.publicKey,
        recentBlockhash: blockhash.blockhash,
        instructions: [inst]
      })
      
      const vtx = new anchor.web3.VersionedTransaction(txMsg.compileToV0Message());
      vtx.sign([mintAuthority]);

      const vtx_hash = await program.provider.connection.sendTransaction(vtx);
      console.log("tx_hash", vtx_hash);

      // wait confirmation
      await waitForConfirmation({ connection: program.provider.connection, tx: vtx_hash, blockhash: blockhash });

      // mint token to wallet
      const tx = await mintTo(
        program.provider.connection,
        mintAuthority, // payer
        token, // mint
        pdaTokenAccount, // dest (receiver)
        mintAuthority.publicKey, // auth
        1_000_000_000_000,
      )

      console.log("====================== Transfer SPL Token on behalf of PDA =====================");
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

      // execute inst with pda
      const method2 = executeInstruction(instTrf, signer, program, isFakeSigner);
      const pda_inst = await method2.instruction();


      // make pda is not signer so inst that can be send out ( Signature is checked and validated if is_signer is true)
      // it will by signed by the program on behalf of pda
      pda_inst.keys.forEach(key =>  {
        if (key.pubkey.equals(account[0]) ) {
          key.isSigner = false
        }
      })

      // SPL Program Address(Account) need to be added
      pda_inst.keys.push({pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false})

      const setComputeUnitLimit = anchor.web3.ComputeBudgetProgram.setComputeUnitLimit( {units : 1_400_000} )

      // compile transaction
      const pdaTransactionMessage = new anchor.web3.TransactionMessage({
        payerKey: mintAuthority.publicKey,
        recentBlockhash: blockhash.blockhash,
        instructions: [setComputeUnitLimit, pda_inst]
      });

      const vtx2 = new anchor.web3.VersionedTransaction(pdaTransactionMessage.compileToV0Message());
      // sign by fee payer
      vtx2.sign([mintAuthority]);

      await program.provider.connection.simulateTransaction(vtx2, {
        sigVerify: false
      });
      console.log("success simulation with fake signer : " , isFakeSigner);

      const vtx_hash2 = await program.provider.connection.sendTransaction(vtx2).catch((e) => {
        if (!isFakeSigner) {
          throw e;
        };
      });

      if (isFakeSigner) {
        return 
      }

      // wait confirmation
      await waitForConfirmation({ connection: program.provider.connection, tx: vtx_hash2, blockhash: blockhash, getDetails: true });
    })
  });
}