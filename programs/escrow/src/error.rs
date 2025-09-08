use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Amount must be greater than zero")]
    InvalidAmount,

    #[msg("Invalid token mint - must be different from offered token")]
    InvalidTokenMint,
}
