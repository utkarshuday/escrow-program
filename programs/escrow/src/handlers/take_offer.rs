use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{ Mint, TokenAccount, TokenInterface },
};
use crate::{ handlers::shared::{ close_token_account, transfer_tokens }, state::Offer };

#[derive(Accounts)]
pub struct TakeOffer<'info> {
    pub system_program: Program<'info, System>,
    pub token_program_b: Interface<'info, TokenInterface>,

    pub token_program_a: Interface<'info, TokenInterface>,

    pub associated_token_program: Program<'info, AssociatedToken>,

    #[account(mut)]
    pub taker: Signer<'info>,

    #[account(mut)]
    pub maker: SystemAccount<'info>,

    pub token_mint_a: InterfaceAccount<'info, Mint>,

    pub token_mint_b: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        close = maker,
        has_one = token_mint_b, 
        has_one = maker,
        seeds = [b"offer", offer.id.to_le_bytes().as_ref()], 
        bump = offer.bump
    )]
    pub offer: Account<'info, Offer>,

    #[account(
        init_if_needed,
        payer = taker,
        associated_token::mint = token_mint_a,
        associated_token::authority = taker,
        associated_token::token_program = token_program_a
    )]
    pub taker_token_account_a: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = token_mint_b,
        associated_token::authority = taker,
        associated_token::token_program = token_program_b
    )]
    pub taker_token_account_b: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = token_mint_a,
        associated_token::authority = offer,
        associated_token::token_program = token_program_a
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = taker,
        associated_token::mint = token_mint_b,
        associated_token::authority = maker,
        associated_token::token_program = token_program_b
    )]
    pub maker_token_account_b: InterfaceAccount<'info, TokenAccount>,
}

pub fn take_offer(ctx: Context<TakeOffer>) -> Result<()> {
    let id_bytes = ctx.accounts.offer.id.to_le_bytes();
    let seeds = &[b"offer", id_bytes.as_ref(), &[ctx.accounts.offer.bump]];
    let signer_seeds = Some(seeds.as_ref());

    transfer_tokens(
        &ctx.accounts.vault,
        &ctx.accounts.taker_token_account_a,
        &ctx.accounts.vault.amount,
        &ctx.accounts.token_program_a,
        &ctx.accounts.token_mint_a,
        &ctx.accounts.offer.to_account_info(),
        signer_seeds
    )?;

    close_token_account(
        &ctx.accounts.vault,
        &ctx.accounts.offer.to_account_info(),
        &ctx.accounts.maker.to_account_info(),
        &ctx.accounts.token_program_a,
        signer_seeds
    )?;

    transfer_tokens(
        &ctx.accounts.taker_token_account_b,
        &ctx.accounts.maker_token_account_b,
        &ctx.accounts.offer.token_b_amount_wanted,
        &ctx.accounts.token_program_b,
        &ctx.accounts.token_mint_b,
        &ctx.accounts.taker,
        None
    )
}
