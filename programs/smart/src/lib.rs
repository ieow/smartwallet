use anchor_lang::prelude::*;
// use anchor_lang::solana_program::program::invoke;

pub mod instructions;

declare_id!("BLYzT5n6WtwteMkNUQEtcRKyCVQys8Y3wbG1BESQannT");

use borsh::{BorshDeserialize, BorshSerialize};
use instructions::validation::{validate, SignatureParams, ValidatorError};

#[program]
pub mod smart {

    use anchor_lang::solana_program::{
            instruction::Instruction,  program::invoke_signed, 
        };

    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }

    // pda created via the Accounts struct instead 
    pub fn create_wallet(
        ctx: Context<CreateWalletAccount>,
        signature: SignatureParams,
        data: [u8; 32],
        pda: Pubkey
    ) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        let wallet_account = &mut ctx.accounts.wallet_account;

        // should we validate the signer pubkey with the signer pubkey_x so that only valid pubkey_x can be use as authority?
        // should we split the authority from the seed used to generate pda?

        // validate(&data, &signature)?;
        require!(validate(&data, &signature), 
            ValidatorError::InvalidSignature
        );
        
        msg!("authority : {:?}" , wallet_account.authority);
        msg!("wallet key: {:?}", wallet_account.key()); 

        if pda != wallet_account.key() {
            msg!("Invalid PDA");
            return Err(ValidatorError::WalletMismatched.into());
        }


        wallet_account.authority = signature.signer_pubkey;
        msg!("authority : {:?}" , wallet_account.authority);

        Ok(())
    }


    pub fn send_sol(ctx: Context<SendSolAccount>, signature: SignatureParams, data: SendSolParams) -> Result<()> {

        msg!("send sol instruction on behalf of PDA");
        let wallet_account = &mut ctx.accounts.wallet_account;

        if wallet_account.authority != signature.signer_pubkey {
            return Err(ValidatorError::WalletMismatched.into());
        }

        let vec_data = data.try_to_vec()?;

        require!(validate(&vec_data, &signature), 
            ValidatorError::InvalidSignature
        );

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

    pub fn execute(ctx: Context<AccountExecuteParams>, 
        signature: SignatureParams,
        instruction_data: ExecuteInstructionParams,
    ) -> Result<()> {
        msg!("Executing instruction on behalf of PDA");
        let wallet_account =  &ctx.accounts.wallet_account;
        
        require!(signature.signer_pubkey.clone() == wallet_account.authority, 
            ValidatorError::WalletMismatched
        );
        // if signature.signer_pubkey.clone() != ctx.accounts.wallet_account.authority {
        //     return Err(ValidatorError::WalletMismatched.into());
        // }

        require!(validate(&instruction_data.try_to_vec()?, &signature), 
            ValidatorError::InvalidSignature
        );


        msg!("valided execute instruction on behalf of PDA");
        msg!("Instruction data {:?}", instruction_data);

        let test_inst = Instruction{
            program_id: instruction_data.program_id,
            accounts: ctx.remaining_accounts.iter().map(|x| {
                if x.is_writable {
                    AccountMeta::new(x.key(), x.is_signer)
                } else {
                    AccountMeta::new_readonly(x.key(), x.is_signer)
                }
            }).collect(),
            data: instruction_data.data
        };

        let seed = signature.signer_pubkey_x;
        // Execute the instruction on behalf of the PDA
        invoke_signed(
            &test_inst,
            ctx.remaining_accounts,
            &[
                &[
                    &seed,
                    &[ctx.bumps.wallet_account],
                ],
            ],
        )?;

        msg!("Instruction executed successfully");
        Ok(())
    }



    // test transfer 
    pub fn send_sol_signed(ctx: Context<SendSolAccountSigned>, data: SendSolParams) -> Result<()> {

        msg!("send sol instruction on behalf of PDA");
        let wallet_account = &mut ctx.accounts.wallet_account;

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


}

#[derive(Accounts)]
pub struct Initialize {}

#[derive(Accounts)]
#[instruction( signature: SignatureParams)]
pub struct CreateWalletAccount<'info> {
    #[account(
        init,
        space = DISCRIMINATOR + WalletType::INIT_SPACE,
        seeds = [signature.signer_pubkey_x.as_ref()],
        bump,
        payer = feepayer,
    )]
    pub wallet_account: Account<'info, WalletType>,

    #[account(mut)]
    pub feepayer: Signer<'info>, // The user invoking the function and paying fees
    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
#[instruction( signature: SignatureParams)]
pub struct AccountExecuteParams<'info> {
    #[account(
        seeds = [ signature.signer_pubkey_x.as_ref()],
        bump,
    )]
    pub wallet_account: Account<'info, WalletType>,
    // pub target_program: Program<'info, System>,
    // pub target_accounts: Vec<AccountInfo<'info>>,
}

#[derive(Accounts)]
#[instruction( signature: SignatureParams)]

pub struct SendSolAccount<'info> {
    #[account(
        mut,
        seeds = [signature.signer_pubkey_x.as_ref()],
        bump,
    )]
    pub wallet_account: Account<'info, WalletType>,

    #[account(mut)]
    /// CHECK: This is not dangerous because we don't read or write data from this account
    pub to: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}


#[account]
#[derive(InitSpace)]
pub struct WalletType {
    pub authority: [u8; 64],
    // pub signer: Pubkey,
}

const DISCRIMINATOR: usize = 8;


#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub struct SendSolParams {
    to : Pubkey,
    amount : u64
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub struct ExecuteInstructionParams {
    data : Vec<u8>,
    program_id : Pubkey
}



#[derive(Accounts)]
pub struct SendSolAccountSigned<'info> {
    #[account(mut)]
    pub wallet_account: Account<'info, WalletType>,

    #[account(mut)]
    /// CHECK: This is not dangerous because we don't read or write data from this account
    pub to: AccountInfo<'info>,
}