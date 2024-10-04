use anchor_lang::{prelude::*};
// use anchor_lang::solana_program::program::invoke;

pub mod instructions;

declare_id!("BLYzT5n6WtwteMkNUQEtcRKyCVQys8Y3wbG1BESQannT");

use instructions::validation::{validate, SignatureParams, ValidatorError};
#[program]
pub mod smart {
    use anchor_lang::solana_program::{
            instruction::Instruction,  program::invoke_signed, system_instruction
        };

    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }

    pub fn create_wallet(
        ctx: Context<CreateWalletAccount>,
        signature: SignatureParams,
        data: [u8; 32],
    ) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        let wallet_account = &mut ctx.accounts.wallet_account;

        validate(&data, &signature)?;

        // Create PDA
        // let (pda, bump) = Pubkey::find_program_address(&[b"seed", &signer_pubkey], ctx.program_id);

        // if pda != wallet_account.key() {
        //     msg!("Invalid PDA");
        //     return Err(ValidatorError::WalletMismatched.into());
        // }

        // Calculate required space for the account
        // let space = DISCRIMINATOR +  WalletType::INIT_SPACE; // Size of WalletType data

        // // Calculate rent-exempt balance
        // let rent = Rent::get()?;
        // let lamports = rent.minimum_balance(space);

        // let payer = &ctx.accounts.feepayer;
        // Create account
        // let ix = system_instruction::create_account(
        //     &payer.key(),
        //     &pda,
        //     lamports,
        //     space as u64,
        //     ctx.program_id,
        // );

        // invoke_signed(
        //     &ix,
        //     &[
        //         payer.to_account_info(),
        //         wallet_account.to_account_info()
        //         // ctx.accounts.wallet.to_account_info(),
        //         // ctx.accounts.system_program.to_account_info(),
        //     ],
        //     &[
        //         &[ b"seed", signer_pubkey.as_ref(), &[bump]],
        //     ],
        // )?;

        wallet_account.authority = signature.signer_pubkey;

        Ok(())
    }


    pub fn send_sol(ctx: Context<SendSolAccount>, signature: SignatureParams, data: SendSolParams) -> Result<()> {
        let wallet_account = &mut ctx.accounts.wallet_account;

        if wallet_account.authority != signature.signer_pubkey {
            return Err(ValidatorError::WalletMismatched.into());
        }

        let vec_data = data.try_to_vec()?;
        // const 
        validate(&vec_data, &signature)?;  


        let ix = system_instruction::transfer(
            &wallet_account.key(),
            &data.to,
            data.amount
        );

        let seeds = &[
            wallet_account.authority.as_ref(),
            &[ctx.bumps.wallet_account],
        ];

        invoke_signed(
            &ix,
            &[
                wallet_account.to_account_info(),
                // ctx.accounts.to.to_account_info(),
            ],
            &[seeds],
        )?;

        Ok(())
    }

    pub fn execute(ctx: Context<AccountExecuteParams>, 
        signature: SignatureParams,
        instruction_data: Vec<u8>,
    ) -> Result<()> {
        msg!("Executing instruction on behalf of PDA");
        let wallet_account =  &ctx.accounts.wallet_account;
        
        if signature.signer_pubkey.clone() != ctx.accounts.wallet_account.authority {
            return Err(ValidatorError::WalletMismatched.into());
        }
        validate( &instruction_data, &signature)?;
        

        // Instruction::try_from(&instruction_data)?;
        // Create the instruction to be executed
        let instruction = Instruction {
            program_id: ctx.accounts.target_program.key(),
            accounts: ctx.remaining_accounts.iter().map(|a| AccountMeta {
                pubkey: a.key(),
                is_signer: a.is_signer,
                is_writable: a.is_writable,
            }).collect(),
            data: instruction_data,
        };

        // Execute the instruction on behalf of the PDA
        invoke_signed(
            &instruction,
            ctx.remaining_accounts,

            &[
                &[
                    wallet_account.authority.as_ref(),
                    &[ctx.bumps.wallet_account],
                ],
            ],
        )?;

        msg!("Instruction executed successfully");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}

#[derive(Accounts)]
#[instruction( data : [u8; 32] , signature : SignatureParams )]
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
#[instruction( signature : SignatureParams, instruction_data : Vec<u8>)]
pub struct AccountExecuteParams<'info> {
    #[account(
        seeds = [ signature.signer_pubkey_x.as_ref()],
        bump,
    )]
    pub wallet_account: Account<'info, WalletType>,
    pub target_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction( signature : SignatureParams, data : Vec<u8>)]

pub struct SendSolAccount<'info> {
    #[account(
        mut,
        seeds = [signature.signer_pubkey_x.as_ref()],
        bump,
    )]
    pub wallet_account: Account<'info, WalletType>,
    // pub to: AccountInfo<'info>,
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

// #[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
// pub struct SignatureParams {
//     recovery_id: u8,
//     r: [u8; 32],
//     s: [u8; 32],
//     signer_pubkey: [u8; 64],
// }

// #[error_code]
// enum ValidatorError {
//     #[msg("Wallet alread exist")]
//     WalletExisted,
//     #[msg("Wallet mismatched")]
//     WalletMismatched,
//     #[msg("Invalid Signature")]
//     InvalidSignature,
// }
