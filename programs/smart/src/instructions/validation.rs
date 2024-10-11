use anchor_lang::prelude::*;

use anchor_lang::solana_program::{
    keccak::hash,
    secp256k1_recover::secp256k1_recover,
    sysvar::{clock::Clock, Sysvar},
};

#[cfg(feature = "simulation")]
pub fn is_simulation() -> bool {
    true
}

#[cfg(not(feature = "simulation"))]
pub fn is_simulation() -> bool {
    false
}

pub fn validate(data: &[u8], signature: &SignatureParams) -> bool {
    let hash = hash(data);
    match secp256k1_recover(
        &hash.to_bytes(),
        signature.recovery_id,
        &signature.compact_signature,
    ) {
        Ok(recovered_pubkey) => {
            if is_simulation() {
                return true;
            }
            recovered_pubkey.to_bytes() == signature.signer_pubkey.clone()
        }
        Err(_) => is_simulation(),
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub struct SignatureParams {
    pub recovery_id: u8,
    pub compact_signature: [u8; 64],
    pub signer_pubkey: [u8; 64],
    pub wallet_seed: [u8; 32],
}

#[error_code]
pub enum ValidatorError {
    #[msg("Wallet alread exist")]
    WalletExisted,
    #[msg("Wallet mismatched")]
    WalletMismatched,
    #[msg("Invalid Signature")]
    InvalidSignature,
}
