import assert from 'node:assert';
import { describe, before, test } from 'node:test';

import * as programClient from '../dist/js-client';
import { getOfferDecoder, OFFER_DISCRIMINATOR } from '../dist/js-client';

import type { Address, MessageSigner, TransactionSigner } from 'gill';
import { airdropFactory, generateKeyPairSigner, lamports } from 'gill';
import { rpc, rpcSubscriptions, ONE_SOL } from './escrow.test-helper';

describe('Escrow', async () => {
  let wallet: TransactionSigner & MessageSigner;
  let bob: TransactionSigner & MessageSigner;
  let alice: TransactionSigner & MessageSigner;
  let tokenMintA: Address;
  let tokenMintB: Address;
  let aliceTokenAccountA: Address;
  let bobTokenAccountB: Address;

  before(async () => {
    // Generate wallets
    wallet = await generateKeyPairSigner();
    bob = await generateKeyPairSigner();
    alice = await generateKeyPairSigner();
    // Airdrop some SOL in the wallets
    const airdrop = airdropFactory({ rpc, rpcSubscriptions });
    await Promise.all([
      airdrop({
        commitment: 'confirmed',
        recipientAddress: wallet.address,
        lamports: lamports(BigInt(1 * ONE_SOL)),
      }),
      airdrop({
        commitment: 'confirmed',
        recipientAddress: alice.address,
        lamports: lamports(BigInt(1 * ONE_SOL)),
      }),
      airdrop({
        commitment: 'confirmed',
        recipientAddress: bob.address,
        lamports: lamports(BigInt(1 * ONE_SOL)),
      }),
    ]);
  });
});
