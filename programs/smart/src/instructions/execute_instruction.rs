use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::solana_program::program::{invoke, invoke_signed};

use crate::constants::PRESEED;

use crate::{
    create_wallet::WalletType,
    validation::{validate, SignatureParams, ValidatorError},
};

#[derive(Accounts)]
#[instruction( signature: SignatureParams)]
pub struct ExecuteInstructionAccounts<'info> {
    #[account(
        seeds = [ PRESEED, signature.wallet_seed.as_ref()],
        bump,
    )]
    pub wallet_account: Account<'info, WalletType>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub struct MyAccountMeta {
    pub pubkey: Pubkey,
    pub is_signer: bool,
    pub is_writable: bool,
}

impl From<MyAccountMeta> for AccountMeta {
    fn from(x: MyAccountMeta) -> Self {
        AccountMeta {
            pubkey: x.pubkey,
            is_signer: x.is_signer,
            is_writable: x.is_writable,
        }
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub struct ExecuteInstructionParams {
    data: Vec<u8>,
    keys: Vec<MyAccountMeta>,
    program_id: Pubkey,
}

pub fn handler(
    ctx: Context<ExecuteInstructionAccounts>,
    signature: SignatureParams,
    instruction_data: ExecuteInstructionParams,
) -> Result<()> {
    msg!("Executing instruction on behalf of PDA");
    let wallet_account = &ctx.accounts.wallet_account;

    require!(
        signature.signer_pubkey.clone() == wallet_account.authority,
        ValidatorError::WalletMismatched
    );

    require!(
        validate(&instruction_data.try_to_vec()?, &signature),
        ValidatorError::InvalidSignature
    );

    execute_instruction_on_behalf_of_pda(&ctx, &instruction_data, &signature.wallet_seed)?;

    Ok(())
}

pub fn execute_instruction_on_behalf_of_pda(
    ctx: &Context<ExecuteInstructionAccounts>,
    instruction_data: &ExecuteInstructionParams,
    wallet_seed: &[u8; 32],
) -> Result<()> {
    let wallet_account = &ctx.accounts.wallet_account;

    let compiled_instruction = Instruction {
        program_id: instruction_data.program_id,
        accounts: instruction_data
            .keys
            .iter()
            .map(|x| AccountMeta::from(x.clone()))
            .collect(),
        data: instruction_data.data.clone(),
    };

    let wallet_is_signer = instruction_data
        .keys
        .iter()
        .find(|x| x.pubkey == wallet_account.key() && x.is_signer)
        .is_some();

    if wallet_is_signer {
        let seed = [PRESEED, wallet_seed, &[ctx.bumps.wallet_account]];

        invoke_signed(&compiled_instruction, &ctx.remaining_accounts, &[&seed])?;
    } else {
        // Execute the instruction on behalf of the PDA
        // TODO: check if need to add back pda account
        invoke(&compiled_instruction, ctx.remaining_accounts)?;
    }

    Ok(())
}
