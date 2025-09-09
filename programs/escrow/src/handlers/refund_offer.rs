use anchor_lang::prelude::*;
use anchor_spl::token_interface::{ Mint, TokenAccount, TokenInterface };
use crate::{ handlers::shared::{ close_token_account, transfer_tokens }, state::Offer };

#[derive(Accounts)]
pub struct RefundOffer<'info> {
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,

    #[account(mut)]
    pub maker: Signer<'info>,

    #[account(mint::token_program = token_program)]
    pub token_mint_a: InterfaceAccount<'info, Mint>,

    #[account(mint::token_program = token_program)]
    pub token_mint_b: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        close = maker,
        has_one = maker,
        has_one = token_mint_b,
        seeds = [b"offer", offer.id.to_le_bytes().as_ref()], // what is going on here ?
        bump = offer.bump
    )]
    pub offer: Account<'info, Offer>,

    #[account(
        mut,
        associated_token::mint = token_mint_a,
        associated_token::authority = offer,
        associated_token::token_program = token_program
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = token_mint_a,
        associated_token::authority = maker,
        associated_token::token_program = token_program
    )]
    pub maker_token_account_a: InterfaceAccount<'info, TokenAccount>,
}

pub fn refund_offer(ctx: Context<RefundOffer>) -> Result<()> {
    let id_bytes = ctx.accounts.offer.id.to_le_bytes();
    let seeds = &[b"offer", id_bytes.as_ref(), &[ctx.accounts.offer.bump]];
    let signer_seeds = Some(seeds.as_ref());

    transfer_tokens(
        &ctx.accounts.vault,
        &ctx.accounts.maker_token_account_a,
        &ctx.accounts.vault.amount,
        &ctx.accounts.token_program,
        &ctx.accounts.token_mint_a,
        &ctx.accounts.offer.to_account_info(),
        signer_seeds
    )?;

    close_token_account(
        &ctx.accounts.vault,
        &ctx.accounts.offer.to_account_info(),
        &ctx.accounts.maker.to_account_info(),
        &ctx.accounts.token_program,
        signer_seeds
    )
}
