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
pub struct AccountExecuteParams<'info> {
    #[account(
        seeds = [ PRESEED, signature.wallet_seed.as_ref()],
        bump,
    )]
    pub wallet_account: Account<'info, WalletType>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub struct ExecuteInstructionParams {
    data: Vec<u8>,
    program_id: Pubkey,
}

pub fn handler(
    ctx: Context<AccountExecuteParams>,
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
    msg!("valided execute instruction on behalf of PDA");
    msg!("Instruction data {:?}", instruction_data);

    let compiled_instruction = Instruction {
        program_id: instruction_data.program_id,
        accounts: ctx
            .remaining_accounts
            .iter()
            .map(|x| {
                if x.is_writable {
                    AccountMeta::new(x.key(), x.is_signer)
                } else {
                    AccountMeta::new_readonly(x.key(), x.is_signer)
                }
            })
            .collect(),
        data: instruction_data.data,
    };

    if ctx.accounts.wallet_account.to_account_info().is_writable {
        let seed = [
            PRESEED,
            signature.wallet_seed.as_ref(),
            &[ctx.bumps.wallet_account],
        ];
        // Execute the instruction on behalf of the PDA
        invoke_signed(&compiled_instruction, ctx.remaining_accounts, &[&seed])?;
    } else {
        // Execute the instruction on behalf of the PDA
        invoke(&compiled_instruction, ctx.remaining_accounts)?;
    }

    msg!("Instruction executed successfully");
    Ok(())
}
