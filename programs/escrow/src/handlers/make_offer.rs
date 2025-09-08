use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{ Mint, TokenAccount, TokenInterface },
};
use crate::state::Offer;
use crate::error::ErrorCode;
use super::shared::transfer_tokens;

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct MakeOffer<'info> {
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,

    #[account(mut)]
    pub maker: Signer<'info>,

    #[account(mint::token_program = token_program)]
    pub token_mint_a: InterfaceAccount<'info, Mint>,

    #[account(mint::token_program = token_program)]
    pub token_mint_b: InterfaceAccount<'info, Mint>,

    #[account(
      mut,
      associated_token::mint = token_mint_a,
      associated_token::authority = maker,
      associated_token::token_program = token_program
    )]
    pub maker_token_account_a: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init,
        payer = maker,
        space = Offer::DISCRIMINATOR.len() + Offer::INIT_SPACE,
        seeds = [b"offer", id.to_le_bytes().as_ref()],
        bump
    )]
    pub offer: Account<'info, Offer>,

    #[account(
        init,
        payer = maker,
        associated_token::mint = token_mint_a,
        associated_token::authority = offer,
        associated_token::token_program = token_program
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,
}

pub fn make_offer(
    ctx: Context<MakeOffer>,
    id: u64,
    token_a_amount_offered: u64,
    token_b_amount_wanted: u64
) -> Result<()> {
    require!(token_a_amount_offered > 0, ErrorCode::InvalidAmount);
    require!(token_b_amount_wanted > 0, ErrorCode::InvalidAmount);

    require!(
        ctx.accounts.token_mint_a.key() != ctx.accounts.token_mint_b.key(),
        ErrorCode::InvalidTokenMint
    );

    ctx.accounts.offer.set_inner(Offer {
        id,
        maker: ctx.accounts.maker.key(),
        token_mint_a: ctx.accounts.token_mint_a.key(),
        token_mint_b: ctx.accounts.token_mint_b.key(),
        token_b_amount_wanted,
        bump: ctx.bumps.offer,
    });

    transfer_tokens(
        &ctx.accounts.maker_token_account_a,
        &ctx.accounts.vault,
        &token_a_amount_offered,
        &ctx.accounts.token_program,
        &ctx.accounts.token_mint_a,
        &ctx.accounts.maker,
        None
    )
}
