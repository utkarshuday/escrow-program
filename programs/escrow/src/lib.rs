#![allow(unexpected_cfgs)]
use anchor_lang::prelude::*;
use handlers::*;

pub mod handlers;
pub mod state;
pub mod error;

declare_id!("FUcrdwZAbMgHknZh1ZoXkWdM75MDANE6UdDpxkPaz5qh");

#[program]
pub mod escrow {
    use super::*;
    pub fn make_offer(
        ctx: Context<MakeOffer>,
        id: u64,
        token_a_amount_offered: u64,
        token_b_amount_wanted: u64
    ) -> Result<()> {
        handlers::make_offer(ctx, id, token_a_amount_offered, token_b_amount_wanted)
    }

    pub fn take_offer(ctx: Context<TakeOffer>) -> Result<()> {
        handlers::take_offer(ctx)
    }

    pub fn refund_offer(ctx: Context<RefundOffer>) -> Result<()> {
        handlers::refund_offer(ctx)
    }
}
