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
pub struct ExecuteMultipleInstructionAccounts<'info> {
    #[account(
        seeds = [ PRESEED, signature.wallet_seed.as_ref()],
        bump,
    )]
    pub wallet_account: Account<'info, WalletType>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub struct ExecuteMultipleInstructionParams {
    data: Vec<u8>,
    accounts: Vec<Pubkey>,
    program_id: Pubkey,
}

pub fn handler(
    ctx: Context<ExecuteMultipleInstructionAccounts>,
    signature: SignatureParams,
    instructions_list: Vec<ExecuteMultipleInstructionParams>,
) -> Result<()> {
    msg!("Executing instruction on behalf of PDA");
    let wallet_account = &ctx.accounts.wallet_account;

    require!(
        signature.signer_pubkey.clone() == wallet_account.authority,
        ValidatorError::WalletMismatched
    );

    require!(
        validate(&instructions_list.try_to_vec()?, &signature),
        ValidatorError::InvalidSignature
    );
    msg!("valided execute instruction on behalf of PDA");
    msg!("Instruction data {:?}", instructions_list);

    let result = instructions_list.iter().try_for_each(|inst| {
        let compiled_instruction = Instruction {
            program_id: inst.program_id,
            accounts: ctx
                .remaining_accounts
                .iter()
                .filter(|x| inst.accounts.contains(x.key))
                .map(|x| {
                    if x.is_writable {
                        AccountMeta::new(x.key(), x.is_signer)
                    } else {
                        AccountMeta::new_readonly(x.key(), x.is_signer)
                    }
                })
                .collect(),
            data: inst.data.clone(),
        };

        if ctx.accounts.wallet_account.to_account_info().is_writable {
            let seed = [
                PRESEED,
                signature.wallet_seed.as_ref(),
                &[ctx.bumps.wallet_account],
            ];
            // Execute the instruction on behalf of the PDA
            invoke_signed(&compiled_instruction, ctx.remaining_accounts, &[&seed])?;
            Ok(())
        } else {
            // Execute the instruction on behalf of the PDA
            invoke(&compiled_instruction, ctx.remaining_accounts)?;
            Ok(())
        }
    });
    msg!("Instruction executed successfully");
    result
}
