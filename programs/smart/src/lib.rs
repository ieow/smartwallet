use anchor_lang::prelude::*;
use anchor_lang::program;

pub mod instructions;
use crate::instructions::*;

pub mod state;
use state::*;

declare_id!("BLYzT5n6WtwteMkNUQEtcRKyCVQys8Y3wbG1BESQannT");

use borsh::BorshDeserialize;
use instructions::validation::SignatureParams;

#[program]
pub mod smart {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }

    // pda created via the Accounts struct instead
    pub fn create_wallet(
        ctx: Context<CreateWalletAccounts>,
        signature: SignatureParams,
        data: [u8; 32],
        pda: Pubkey,
    ) -> Result<()> {
        instructions::create_wallet::handler(ctx, signature, data, pda)
    }

    pub fn transfer(
        ctx: Context<TransferSolAccounts>,
        signature: SignatureParams,
        data: TransferSolParams,
    ) -> Result<()> {
        instructions::transfer::handler(ctx, signature, data)
    }

    pub fn execute_instruction(
        ctx: Context<ExecuteInstructionAccounts>,
        signature: SignatureParams,
        instruction_data: ExecuteInstructionParams,
    ) -> Result<()> {
        instructions::execute_instruction::handler(ctx, signature, instruction_data)
    }

    pub fn execute_multiple_instruction(
        ctx: Context<ExecuteInstructionAccounts>,
        signature: SignatureParams,
        params: VecExecuteMultipleInstructionParams,
    ) -> Result<()> {
        instructions::execute_multiple_instruction::handler(ctx, signature, params)
    }
}

#[derive(Accounts)]
pub struct Initialize {}
