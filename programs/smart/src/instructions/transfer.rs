use anchor_lang::prelude::*;

use crate::constants::PRESEED;

use crate::{
    create_wallet::WalletType,
    validation::{validate, SignatureParams, ValidatorError},
};

#[derive(Accounts)]
#[instruction( signature: SignatureParams)]

pub struct TransferSolAccount<'info> {
    #[account(
        mut,
        seeds = [ PRESEED,  signature.wallet_seed.as_ref()],
        bump,
    )]
    pub wallet_account: Account<'info, WalletType>,

    #[account(mut)]
    /// CHECK: This is not dangerous because we don't read or write data from this account
    pub to: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub struct TransferSolParams {
    to: Pubkey,
    amount: u64,
}

pub fn handler(
    ctx: Context<TransferSolAccount>,
    signature: SignatureParams,
    data: TransferSolParams,
) -> Result<()> {
    msg!("send sol instruction on behalf of PDA");
    let wallet_account = &mut ctx.accounts.wallet_account;

    require!(
        wallet_account.authority == signature.signer_pubkey,
        ValidatorError::WalletMismatched
    );

    require!(
        validate(&data.try_to_vec()?, &signature),
        ValidatorError::InvalidSignature
    );

    // Need to check for rent requirement?
    // Ensure that the PDA has enough lamports
    let pda_lamports = wallet_account.get_lamports();
    if pda_lamports < data.amount {
        return Err(ProgramError::InsufficientFunds.into());
    }

    let recipient = &mut ctx.accounts.to;
    // Transfer lamports from the PDA to the recipient
    // system_instruction.transfer do not works as system program do not own pda and pda has `data`.
    wallet_account.sub_lamports(data.amount)?;
    recipient.add_lamports(data.amount)?;

    Ok(())
}
