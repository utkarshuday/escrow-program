use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Offer {
    pub id: u64,
    pub maker: Pubkey,
    pub token_mint_a: Pubkey,
    pub token_mint_b: Pubkey,
    pub token_b_amount_wanted: u64,
    // Why there is no amount_offered ?
    pub bump: u8, // I don't know why this is used
}
