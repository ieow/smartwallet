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
pub struct ExecuteMultipleInstructionParams {
    data: Vec<u8>,
    keys: Vec<MyAccountMeta>,
    program_id: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub struct VecExecuteMultipleInstructionParams {
    list : Vec<ExecuteMultipleInstructionParams>,
}

pub fn handler(
    ctx: Context<ExecuteMultipleInstructionAccounts>,
    signature: SignatureParams,
    params : VecExecuteMultipleInstructionParams,
) -> Result<()> {
    msg!("Executing instruction on behalf of PDA");
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
    msg!("valided execute multipl instruction on behalf of PDA");
    // msg!("Instruction data {:?}", instructions_list);

    let result = instructions_list.iter().try_for_each(|inst| {
        let compiled_instruction = Instruction {
            program_id: inst.program_id,
            accounts: inst.keys
                .iter()
                .map(|x| AccountMeta::from(x.clone())).collect(),
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
