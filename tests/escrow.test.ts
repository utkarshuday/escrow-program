import assert from 'node:assert';
import { describe, before, it } from 'node:test';

import * as programClient from '../dist/js-client';
import { getOfferDecoder, OFFER_DISCRIMINATOR } from '../dist/js-client';

import type { Address, MessageSigner, TransactionSigner } from 'gill';
import { airdropFactory, generateKeyPairSigner, lamports } from 'gill';
import {
  rpc,
  rpcSubscriptions,
  ONE_SOL,
  createTokenMint,
  mintToken,
  generateKeyPairSignerWithSol,
} from './escrow.test-helper';
import {
  getAssociatedTokenAccountAddress,
  TOKEN_2022_PROGRAM_ADDRESS,
} from 'gill/programs';

describe('Escrow', async () => {
  let wallet: TransactionSigner & MessageSigner;
  let bob: TransactionSigner & MessageSigner;
  let alice: TransactionSigner & MessageSigner;
  let tokenMintA: Address;
  let tokenMintB: Address;
  let aliceTokenAccountA: Address;
  let bobTokenAccountB: Address;

  before(async () => {
    // Airdrop some SOL in the wallets
    [alice, bob, wallet] = await Promise.all(
      Array.from({ length: 3 }, () => generateKeyPairSignerWithSol())
    );
    // Create Token mints
    tokenMintA = await createTokenMint({
      feePayer: wallet,
      name: 'TOKEN A',
      symbol: 'TKNA',
      uri: 'https://raw.githubusercontent.com/utkarshuday/escrow-program/main/tests/assets/token-a.json',
    });

    tokenMintB = await createTokenMint({
      feePayer: wallet,
      name: 'TOKEN B',
      symbol: 'TKNB',
      uri: 'https://raw.githubusercontent.com/utkarshuday/escrow-program/main/tests/assets/token-b.json',
    });

    // Mint tokens
    await mintToken({
      feePayer: wallet,
      mint: tokenMintA,
      amount: 10 * 1_000_000_000,
      destination: alice.address,
    });

    await mintToken({
      feePayer: wallet,
      mint: tokenMintB,
      amount: 1 * 1_000_000_000,
      destination: bob.address,
    });

    // Get token addresses
    aliceTokenAccountA = await getAssociatedTokenAccountAddress(
      tokenMintA,
      alice.address,
      TOKEN_2022_PROGRAM_ADDRESS
    );

    bobTokenAccountB = await getAssociatedTokenAccountAddress(
      tokenMintB,
      bob.address,
      TOKEN_2022_PROGRAM_ADDRESS
    );
  });

  describe('makeOffer', () => {
    it('successfully creates an offer with valid inputs', async () => {});
  });
});
