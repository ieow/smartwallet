import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Smart } from "../target/types/smart";
import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from '@noble/hashes/sha3';
import { BN } from "bn.js";
import { BorshTypesCoder } from "@coral-xyz/anchor/dist/cjs/coder/borsh/types";



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
    console.log("signerPubkey", signerPubkey);
    console.log("signerPubkey length", signerPubkey.length);

    const signerPubKeyX = signerPubkey.subarray(0, 32);
    const hash = keccak_256(signerPubKeyX);
    const signature = secp256k1.sign(hash, signer, );
    const recoveryId = signature.recovery;

    const signatureRS = signature.toCompactRawBytes();
    console.log("signature", signatureRS);
    console.log("signature length", signatureRS.length);

    const pdaPrefixSeed = anchor.utils.bytes.utf8.encode("seed");
    const pdaSeed = signerPubKeyX;

    const account = anchor.web3.PublicKey.findProgramAddressSync([pdaSeed], program.programId);
    console.log("account", account);

    const blockhash = await program.provider.connection.getLatestBlockhash();
    console.log("blockhash", blockhash);

    const lastValidBlockHeight = blockhash.lastValidBlockHeight;

    const tx = await program.methods
      .createWallet(
        {
          recoveryId: recoveryId,
          compactSignature: Array.from(signatureRS),
          signerPubkey: Array.from(signerPubkey),
          signerPubkeyX: Array.from(signerPubKeyX),
        },
        Array.from(signerPubKeyX),
        account[0]
      ).rpc();
      // .rpc({
      //   commitment: 'finalized',
      // });
    console.log("Your transaction signature", tx);

    // wait for confirmation
    const confrim = await program.provider.connection.confirmTransaction({
      signature : tx,
      blockhash: blockhash.blockhash,
      lastValidBlockHeight
    }, 'confirmed');

    console.log("confrim", confrim);

    const txDetails = await program.provider.connection.getTransaction(tx, {
      commitment: 'confirmed',
    })
    console.log(txDetails);

    console.log("account[0]", account[0]);


    const ainfo = await program.provider.connection.getAccountInfo(account[0])
    console.log("ainfo", ainfo);
    
    console.log("testing")

    // airdrop to account
    const tx1 = await program.provider.connection.requestAirdrop(account[0], 1 * anchor.web3.LAMPORTS_PER_SOL);



    const confrim1 = await program.provider.connection.confirmTransaction({
      signature : tx1,
      blockhash: blockhash.blockhash,
      lastValidBlockHeight
    }, 'confirmed'); 
    
    console.log("airdrop tx", tx1);
    const txDetails1 = await program.provider.connection.getTransaction(tx1, {
      commitment: 'confirmed',
    })
    console.log(txDetails1);

    // send sol
    let keypair = anchor.web3.Keypair.generate();
    console.log("to pubkey", anchor.getProvider().publicKey);
    const sendSolParams = {
      to : keypair.publicKey,
      amount : new BN(0.1 * anchor.web3.LAMPORTS_PER_SOL), 
    }

    const typeCoder =  new BorshTypesCoder( program.idl)
    const sendSolArgs = typeCoder.encode(
      "sendSolParams",
      sendSolParams
    )
    const sendSolArgsHash = keccak_256(sendSolArgs);
    const signatureSendSol = secp256k1.sign(sendSolArgsHash, signer, );

    const sendSolSignatureParams = {
      recoveryId: signatureSendSol.recovery,
      compactSignature: Array.from(signatureSendSol.toCompactRawBytes()),
      signerPubkey: Array.from(signerPubkey),
      signerPubkeyX: Array.from(signerPubKeyX),
    };

    try {
      // execute send sol transaction for pda
      const method2 = await program.methods
        .sendSol(
          sendSolSignatureParams,
          sendSolParams,
        ).accounts(
          {
            to: keypair.publicKey,
          }
        )
      
      const inst2 = await  method2.instruction();

      console.log("inst2", inst2);

      const tx2 = await method2.rpc();
      console.log("Your transaction signature", tx2);

      console.log(inst2.data);

      console.log("====================== ===================");
      // try sendSolSigned
      const method3 = await program.methods.sendSolSigned({
        // walletAccount: account[0],
        to: keypair.publicKey,
        amount: new BN(0.1 * anchor.web3.LAMPORTS_PER_SOL),
      })
      .accounts({
        walletAccount: account[0],
        to: keypair.publicKey,
      })

      const inst3 = await method3.instruction();


      const tx3 = await method3.rpc();

      // wait for confirmation
      const confirm3 = await program.provider.connection.confirmTransaction({
        signature : tx3,
        blockhash: blockhash.blockhash,
        lastValidBlockHeight
      }, 'confirmed');
      console.log("confirm3", confirm3);

      // get transaction detail
      const txDetails3 = await program.provider.connection.getTransaction(tx3, {
        commitment: 'confirmed',
      })
      console.log(txDetails3);




      console.log("====================== ===================");


      const convertInst2 = {
        data: inst2.data,
        programId: inst2.programId
      }

      const convertInst3 = {
        data: inst3.data,
        programId: inst3.programId
      }
      const executeArgs = typeCoder.encode("executeInstructionParams", convertInst2)
      
      const executeArgsHash = keccak_256(executeArgs);
      const signature = secp256k1.sign(executeArgsHash, signer, );

      
      const executeSignature = {
        recoveryId: signature.recovery, 
        compactSignature: Array.from(signature.toCompactRawBytes()),
        signerPubkey: Array.from(signerPubkey),
        signerPubkeyX: Array.from(signerPubKeyX),        
      }
      // // invoke execute instruction with inst2
      const method4 = program.methods
        .execute(
          executeSignature,
          convertInst2
        ).remainingAccounts(
          [...inst2.keys, {
            pubkey: program.programId,
            isSigner: false,
            isWritable: false
          }
          ]
        )
         
      const tx4 = await method4.rpc();


    
      console.log("Your transaction signature", tx4);

      // // wait for confirmation
      const confirm4 = await program.provider.connection.confirmTransaction({
        signature : tx4,
        blockhash: blockhash.blockhash,
        lastValidBlockHeight
      }, 'confirmed');
      console.log("confirm3", confirm4);

      // // get transaction details
      const txDetails4 = await program.provider.connection.getTransaction(tx4, {
        commitment: 'confirmed',
      })
      console.log(txDetails4);
      
    } catch (error) {
      console.log("error", error);
      console.log("error", error.getLogs());
      throw error
    }

  });
});
