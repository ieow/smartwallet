use anchor_lang::prelude::*;

use crate::execute_instruction_on_behalf_of_pda;
use crate::validation::{validate, SignatureParams, ValidatorError};

use super::{ExecuteInstructionAccounts, ExecuteInstructionParams};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub struct VecExecuteMultipleInstructionParams {
    list: Vec<ExecuteInstructionParams>,
}

pub fn handler(
    ctx: Context<ExecuteInstructionAccounts>,
    signature: SignatureParams,
    params: VecExecuteMultipleInstructionParams,
) -> Result<()> {
    msg!("Executing multiple instructions on behalf of PDA");
    let wallet_account = &ctx.accounts.wallet_account;
    let instructions_list = params.list;

    require!(
        signature.signer_pubkey.clone() == wallet_account.authority,
        ValidatorError::WalletMismatched
    );

    require!(
        validate(&instructions_list.try_to_vec()?, &signature),
        ValidatorError::InvalidSignature
    );

    let result = instructions_list.iter().try_for_each(|inst| {
        execute_instruction_on_behalf_of_pda(&ctx, inst, &signature.wallet_seed)?;
        Ok(())
    });
    msg!("Instruction executed successfully");
    result
}
