import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Smart } from "../target/types/smart";
import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from '@noble/hashes/sha3';


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

    const data = signerPubkey.subarray(0, 32);
    const hash = keccak_256(data);
    const signature = secp256k1.sign(hash, signer, );
    const recoveryId = signature.recovery;

    const signatureRS = signature.toCompactRawBytes();
    console.log("signature", signatureRS);
    console.log("signature length", signatureRS.length);

    const pdaPrefixSeed = anchor.utils.bytes.utf8.encode("seed");
    const pdaSeed = data;

    const account = anchor.web3.PublicKey.findProgramAddressSync([pdaPrefixSeed, pdaSeed], program.programId);
    console.log("account", account);

    const tx = await program.methods
      .createWallet(
        Array.from(data),
        recoveryId,
        Array.from(signatureRS),
        Array.from(signerPubkey),
      )
      .rpc();
    console.log("Your transaction signature", tx);


    // execute send sol transaction for pda
    const tx2 = await program.methods
      .sendSol(account[0])
      .rpc();
    console.log("Your transaction signature", tx2);
  });
});
