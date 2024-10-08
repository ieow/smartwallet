use anchor_lang::prelude::*;

use crate::{
    constants::{DISCRIMINATOR, PRESEED},
    validation::{validate, SignatureParams, ValidatorError},
};

// pda created via the Accounts struct instead
pub fn handler(
    ctx: Context<CreateWalletAccount>,
    signature: SignatureParams,
    data: [u8; 32],
    pda: Pubkey,
) -> Result<()> {
    msg!("Greetings from: {:?}", ctx.program_id);
    let wallet_account = &mut ctx.accounts.wallet_account;

    // should we validate the signer pubkey with the signer pubkey_x so that only valid pubkey_x can be use as authority?
    // should we split the authority from the seed used to generate pda?
    // require!( data == signature.wallet_seed, ValidatorError::InvalidData );
    require!(
        validate(&data, &signature),
        ValidatorError::InvalidSignature
    );

    msg!("authority : {:?}", wallet_account.authority);
    msg!("wallet key: {:?}", wallet_account.key());

    if pda != wallet_account.key() {
        msg!("Invalid PDA");
        return Err(ValidatorError::WalletMismatched.into());
    }

    wallet_account.authority = signature.signer_pubkey;
    msg!("authority : {:?}", wallet_account.authority);

    Ok(())
}

#[derive(Accounts)]
#[instruction( signature: SignatureParams)]
pub struct CreateWalletAccount<'info> {
    #[account(
        init,
        space = DISCRIMINATOR + WalletType::INIT_SPACE,
        seeds = [ PRESEED, signature.wallet_seed.as_ref()],
        bump,
        payer = feepayer,
    )]
    pub wallet_account: Account<'info, WalletType>,

    #[account(mut)]
    pub feepayer: Signer<'info>, // The user invoking the function and paying fees
    pub system_program: Program<'info, System>,
}
#[account]
#[derive(InitSpace)]
pub struct WalletType {
    pub authority: [u8; 64],
    // pub signer: Pubkey,
}
