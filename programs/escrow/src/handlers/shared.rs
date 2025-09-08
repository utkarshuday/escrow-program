use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    transfer_checked,
    close_account,
    CloseAccount,
    Mint,
    TokenAccount,
    TokenInterface,
    TransferChecked,
};

pub fn transfer_tokens<'info>(
    from: &InterfaceAccount<'info, TokenAccount>,
    to: &InterfaceAccount<'info, TokenAccount>,
    amount: &u64,
    token_program: &Interface<'info, TokenInterface>,
    mint: &InterfaceAccount<'info, Mint>,
    authority: &AccountInfo<'info>, // Be careful! Understand why this is used
    owning_pda_seeds: Option<&[&[u8]]>
) -> Result<()> {
    let cpi_accounts = TransferChecked {
        from: from.to_account_info(),
        to: to.to_account_info(),
        authority: authority.to_account_info(),
        mint: mint.to_account_info(),
    };

    let cpi_program = token_program.to_account_info();

    let signer_seeds = owning_pda_seeds.map(|seeds| [seeds]);

    transfer_checked(
        if let Some(seeds_arr) = signer_seeds.as_ref() {
            CpiContext::new(cpi_program, cpi_accounts).with_signer(seeds_arr)
        } else {
            CpiContext::new(cpi_program, cpi_accounts)
        },
        *amount,
        mint.decimals
    )
}

pub fn close_token_account<'info>(
    account: &InterfaceAccount<'info, TokenAccount>,
    authority: &AccountInfo<'info>,
    destination: &AccountInfo<'info>,
    token_program: &Interface<'info, TokenInterface>,
    owning_pda_seeds: Option<&[&[u8]]>
) -> Result<()> {
    let cpi_accounts = CloseAccount {
        account: account.to_account_info(),
        authority: authority.to_account_info(),
        destination: destination.to_account_info(),
    };

    let cpi_program = token_program.to_account_info();

    let signer_seeds = owning_pda_seeds.map(|seeds| [seeds]);

    close_account(
        if let Some(seeds) = signer_seeds.as_ref() {
            CpiContext::new(cpi_program, cpi_accounts).with_signer(seeds)
        } else {
            CpiContext::new(cpi_program, cpi_accounts)
        }
    )
}
