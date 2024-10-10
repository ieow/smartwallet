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
        accounts: instruction_data.keys
                    .iter()
                    .map(|x| AccountMeta::from(x.clone())).collect(),
        data: instruction_data.data,
    };

    let wallet_is_signer = instruction_data.keys.iter().find(|x| x.pubkey == wallet_account.key() && x.is_signer).is_some();
    instruction_data.keys.iter().for_each( |x| {
        msg!("Executing instruction instruction account {:?} is_signer {:?}", x.pubkey , x.is_signer);
    });
    msg!("wallet_is_signer {:?}", wallet_is_signer);
    if wallet_is_signer {
        let seed = [
            PRESEED,
            signature.wallet_seed.as_ref(),
            &[ctx.bumps.wallet_account],
        ];


        // ctx.accounts.wallet_account
        let wallet_info =  & ctx.accounts.wallet_account.to_account_info();
        // wallet_info.is_signer = true;
        msg!("wallet_info {:?}", wallet_info.key);

        ctx.remaining_accounts.iter().for_each( |x| {
            msg!("Executing instruction remaining_accounts {:?} is_signer {:?}", x.key() , x.is_signer);
        }); 

        ctx.accounts.to_account_infos().iter().for_each( |x| {
            msg!("Executing instruction accounts {:?} is_signer {:?}", x.key() , x.is_signer);
        });
        
        // let m1 = ctx.remaining_accounts.to_vec();
        // let m2 = m1.last().unwrap().(); //.last().unwrap().clone();
        // let mut remaining_accounts: Vec<AccountInfo> = ctx.remaining_accounts.iter().map(|acc| acc.to_account_info().to_owned()).collect();
        // remaining_accounts.push(wallet_info.clone());
        let last = ctx.remaining_accounts.clone().last().unwrap().clone();
        // Invoke the instruction on behalf of the PDA 
        // Execute the instruction on behalf of the PDA
        invoke_signed(&compiled_instruction, &[wallet_info.clone(), last ] , &[&seed])?;
    } else {
        // Execute the instruction on behalf of the PDA
        // invoke(&compiled_instruction, ctx.accounts)?;
    }

    msg!("Instruction executed successfully");
    Ok(())
}
