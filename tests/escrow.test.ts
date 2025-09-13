import assert from 'node:assert';
import { describe, before, it } from 'node:test';
import {
  createTestEnvironment,
  getRandomId,
  createMakeOfferTransaction,
  TestEnvironment,
  getAllOffers,
  createTakeOfferTransaction,
  DECIMALS,
  createRefundOfferTransaction,
  ANCHOR_ERROR__CONSTRAINT_HAS_ONE,
} from './escrow.test-helper';
import {
  Address,
  isProgramError,
  isSolanaError,
  signTransactionMessageWithSigners,
  SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE,
} from 'gill';
import {
  SYSTEM_ERROR__ACCOUNT_ALREADY_IN_USE,
  TOKEN_2022_ERROR__INSUFFICIENT_FUNDS,
} from 'gill/programs';

describe('Escrow', () => {
  let testEnv: TestEnvironment;
  let tokenAAmountOffered = 10n * DECIMALS;
  let tokenBAmountWanted = 1n * DECIMALS;
  before(async () => {
    testEnv = await createTestEnvironment();
  });

  describe('makeOffer', () => {
    it('successfully creates an offer with valid inputs', async () => {
      const id = getRandomId();
      const { vault, transactionMessage } = await createMakeOfferTransaction({
        testEnv,
        id,
        tokenAAmountOffered,
        tokenBAmountWanted,
      });
      const signedTransaction =
        await signTransactionMessageWithSigners(transactionMessage);
      await testEnv.sendAndConfirmTransaction(signedTransaction);
      const {
        value: { amount },
      } = await testEnv.rpc.getTokenAccountBalance(vault).send();
      assert.equal(
        amount,
        tokenAAmountOffered,
        'Vault balance should match offered amount'
      );
    });

    it('fails when trying to reuse an existing offer ID', async () => {
      const id = getRandomId();
      let { transactionMessage } = await createMakeOfferTransaction({
        testEnv,
        id,
        tokenAAmountOffered,
        tokenBAmountWanted,
      });
      let signedTransaction =
        await signTransactionMessageWithSigners(transactionMessage);
      await testEnv.sendAndConfirmTransaction(signedTransaction);

      ({ transactionMessage } = await createMakeOfferTransaction({
        testEnv,
        id,
        tokenAAmountOffered,
        tokenBAmountWanted,
      }));
      signedTransaction =
        await signTransactionMessageWithSigners(transactionMessage);

      await assert.rejects(
        testEnv.sendAndConfirmTransaction(signedTransaction),
        err => {
          if (
            isSolanaError(
              err,
              SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE
            )
          ) {
            const underlyingError = err.cause;
            assert.ok(
              isProgramError(
                underlyingError,
                transactionMessage,
                testEnv.programClient.ESCROW_PROGRAM_ADDRESS,
                SYSTEM_ERROR__ACCOUNT_ALREADY_IN_USE
              )
            );
            return true;
          }
        },
        'Offer creation did not fail for same ID'
      );
    });

    it('fails when maker has insufficient token balance', async () => {
      const id = getRandomId();
      const lotOfTokens = 10000n * DECIMALS;
      const { transactionMessage } = await createMakeOfferTransaction({
        testEnv,
        id,
        tokenAAmountOffered: lotOfTokens,
        tokenBAmountWanted,
      });
      const signedTransaction =
        await signTransactionMessageWithSigners(transactionMessage);
      await assert.rejects(
        testEnv.sendAndConfirmTransaction(signedTransaction),
        err => {
          if (
            isSolanaError(
              err,
              SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE
            )
          ) {
            const underlyingError = err.cause;
            assert.ok(
              isProgramError(
                underlyingError,
                transactionMessage,
                testEnv.programClient.ESCROW_PROGRAM_ADDRESS,
                TOKEN_2022_ERROR__INSUFFICIENT_FUNDS
              )
            );
            return true;
          }
        },
        'Offer creation did not fail for insufficient token amount'
      );
    });

    it('fails when token mints are the same', async () => {
      const id = getRandomId();
      const { transactionMessage } = await createMakeOfferTransaction({
        testEnv,
        id,
        tokenAAmountOffered,
        tokenBAmountWanted,
        tokenMintA: testEnv.tokenMintA,
        tokenMintB: testEnv.tokenMintA,
      });
      const signedTransaction =
        await signTransactionMessageWithSigners(transactionMessage);
      await assert.rejects(
        testEnv.sendAndConfirmTransaction(signedTransaction),
        err => {
          if (
            isSolanaError(
              err,
              SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE
            )
          ) {
            const underlyingError = err.cause;
            assert.ok(
              testEnv.programClient.isEscrowError(
                underlyingError,
                transactionMessage,
                testEnv.programClient.ESCROW_ERROR__INVALID_TOKEN_MINT
              )
            );
            return true;
          }
        },
        'Offer creation did not fail for same token mints'
      );
    });

    it('fails when token_b_wanted_amount is zero', async () => {
      const id = getRandomId();
      const { transactionMessage } = await createMakeOfferTransaction({
        testEnv,
        id,
        tokenAAmountOffered,
        tokenBAmountWanted: 0,
      });
      const signedTransaction =
        await signTransactionMessageWithSigners(transactionMessage);
      await assert.rejects(
        testEnv.sendAndConfirmTransaction(signedTransaction),
        err => {
          if (
            isSolanaError(
              err,
              SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE
            )
          ) {
            const underlyingError = err.cause;
            assert.ok(
              testEnv.programClient.isEscrowError(
                underlyingError,
                transactionMessage,
                testEnv.programClient.ESCROW_ERROR__INVALID_AMOUNT
              )
            );
            return true;
          }
        },
        'Offer creation did not fail for when token_b_wanted_amount is zero'
      );
    });

    it('fails when token_a_offered_amount is zero', async () => {
      const id = getRandomId();
      const { transactionMessage } = await createMakeOfferTransaction({
        testEnv,
        id,
        tokenAAmountOffered: 0,
        tokenBAmountWanted,
      });
      const signedTransaction =
        await signTransactionMessageWithSigners(transactionMessage);
      await assert.rejects(
        testEnv.sendAndConfirmTransaction(signedTransaction),
        err => {
          if (
            isSolanaError(
              err,
              SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE
            )
          ) {
            const underlyingError = err.cause;
            assert.ok(
              testEnv.programClient.isEscrowError(
                underlyingError,
                transactionMessage,
                testEnv.programClient.ESCROW_ERROR__INVALID_AMOUNT
              )
            );
            return true;
          }
        },
        'Offer creation did not fail for when token_a_offered_amount is zero'
      );
    });
  });

  describe('can get all the offers', () => {
    it('successfully gets all the offers', async () => {
      const offers = await getAllOffers(testEnv);
      assert.ok(offers.length === 2, 'Expected to get two offers');

      // The first offer is created in the 'successfully creates an offer with valid inputs' test
      const offer1 = offers[0];
      assert.equal(
        offer1.maker,
        testEnv.alice.address,
        'Offer 1 maker address should match Alice'
      );
      assert.equal(
        offer1.tokenMintA,
        testEnv.tokenMintA,
        'Offer 1 tokenMintA should match'
      );
      assert.equal(
        offer1.tokenMintB,
        testEnv.tokenMintB,
        'Offer 1 tokenMintB should match'
      );
      assert.equal(
        offer1.tokenBAmountWanted,
        BigInt(tokenBAmountWanted),
        'Offer 1 tokenBWantedAmount should match'
      );
      assert.ok(
        typeof offer1.bump === 'number',
        'Offer 1 bump should be a number'
      );
      assert.ok(offer1.discriminator, 'Offer 1 discriminator should exist');

      // The second offer is created in the 'fails when trying to reuse an existing offer ID' test
      const offer2 = offers[0];
      assert.equal(
        offer2.maker,
        testEnv.alice.address,
        'Offer 2 maker address should match Alice'
      );
      assert.equal(
        offer2.tokenMintA,
        testEnv.tokenMintA,
        'Offer 2 tokenMintA should match'
      );
      assert.equal(
        offer2.tokenMintB,
        testEnv.tokenMintB,
        'Offer 2 tokenMintB should match'
      );
      assert.equal(
        offer2.tokenBAmountWanted,
        BigInt(tokenBAmountWanted),
        'Offer 2 tokenBWantedAmount should match'
      );
      assert.ok(
        typeof offer2.bump === 'number',
        'Offer 2 bump should be a number'
      );
      assert.ok(offer2.discriminator, 'Offer 2 discriminator should exist');
    });
  });

  describe('takeOffer', () => {
    let offerAddress: Address;
    before(async () => {
      const id = getRandomId();
      const { vault, offer, transactionMessage } =
        await createMakeOfferTransaction({
          testEnv,
          id,
          tokenAAmountOffered,
          tokenBAmountWanted,
        });
      offerAddress = offer;
      const signedTransaction =
        await signTransactionMessageWithSigners(transactionMessage);
      await testEnv.sendAndConfirmTransaction(signedTransaction);
    });

    it('successfully takes an offer', async () => {
      const { transactionMessage } = await createTakeOfferTransaction({
        testEnv,
        offer: offerAddress,
      });

      const signedTransaction =
        await signTransactionMessageWithSigners(transactionMessage);
      await testEnv.sendAndConfirmTransaction(signedTransaction);
      const {
        value: { amount: bobTokenAccountABalance },
      } = await testEnv.rpc
        .getTokenAccountBalance(testEnv.bobTokenAccountA)
        .send();
      assert.equal(
        bobTokenAccountABalance,
        tokenAAmountOffered,
        "Bob's token A balance should be offered amount"
      );

      const {
        value: { amount: aliceTokenAccountBBalance },
      } = await testEnv.rpc
        .getTokenAccountBalance(testEnv.aliceTokenAccountB)
        .send();

      assert.equal(
        aliceTokenAccountBBalance,
        tokenBAmountWanted,
        "Alice's token B balance should match wanted amount"
      );
    });

    it('fails when taker has insufficient token balance', async () => {
      const lotOfTokenBAmount = 1000n * DECIMALS;
      const id = getRandomId();
      let { offer, transactionMessage } = await createMakeOfferTransaction({
        testEnv,
        tokenAAmountOffered,
        tokenBAmountWanted: lotOfTokenBAmount,
        id,
      });
      let signedTransaction =
        await signTransactionMessageWithSigners(transactionMessage);
      await testEnv.sendAndConfirmTransaction(signedTransaction);

      ({ transactionMessage } = await createTakeOfferTransaction({
        testEnv,
        offer,
      }));

      signedTransaction =
        await signTransactionMessageWithSigners(transactionMessage);
      await assert.rejects(
        testEnv.sendAndConfirmTransaction(signedTransaction),
        err => {
          if (
            isSolanaError(
              err,
              SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE
            )
          ) {
            const underlyingError = err.cause;
            assert.ok(
              isProgramError(
                underlyingError,
                transactionMessage,
                testEnv.programClient.ESCROW_PROGRAM_ADDRESS,
                TOKEN_2022_ERROR__INSUFFICIENT_FUNDS
              )
            );
            return true;
          }
        },
        'Expected the take offer to fail but it succeeded'
      );
    });
  });

  describe('refundOffer', () => {
    let offerAddress: Address;
    before(async () => {
      const id = getRandomId();
      const { offer, transactionMessage } = await createMakeOfferTransaction({
        testEnv,
        id,
        tokenAAmountOffered,
        tokenBAmountWanted,
      });
      offerAddress = offer;
      const signedTransaction =
        await signTransactionMessageWithSigners(transactionMessage);
      await testEnv.sendAndConfirmTransaction(signedTransaction);
    });

    it('successfully refunds an offer to the maker', async () => {
      const {
        value: { amount: aliceTokenAccountABalanceBefore },
      } = await testEnv.rpc
        .getTokenAccountBalance(testEnv.aliceTokenAccountA)
        .send();
      const { transactionMessage } = await createRefundOfferTransaction({
        testEnv,
        offer: offerAddress,
      });
      const signedTransaction =
        await signTransactionMessageWithSigners(transactionMessage);
      await testEnv.sendAndConfirmTransaction(signedTransaction);

      const {
        value: { amount: aliceTokenAccountABalanceAfter },
      } = await testEnv.rpc
        .getTokenAccountBalance(testEnv.aliceTokenAccountA)
        .send();

      assert.ok(
        BigInt(aliceTokenAccountABalanceAfter) >
          BigInt(aliceTokenAccountABalanceBefore),
        "Alice's token A balance should be greater after refund"
      );
    });

    it('fails when non-maker tries to refund the offer', async () => {
      const id = getRandomId();
      let { offer, transactionMessage } = await createMakeOfferTransaction({
        testEnv,
        tokenAAmountOffered,
        tokenBAmountWanted,
        id,
      });
      let signedTransaction =
        await signTransactionMessageWithSigners(transactionMessage);
      await testEnv.sendAndConfirmTransaction(signedTransaction);

      ({ transactionMessage } = await createRefundOfferTransaction({
        testEnv,
        offer,
        maker: testEnv.bob,
      }));

      signedTransaction =
        await signTransactionMessageWithSigners(transactionMessage);

      await assert.rejects(
        testEnv.sendAndConfirmTransaction(signedTransaction),
        err => {
          if (
            isSolanaError(
              err,
              SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE
            )
          ) {
            const underlyingError = err.cause;
            assert.ok(
              isProgramError(
                underlyingError,
                transactionMessage,
                testEnv.programClient.ESCROW_PROGRAM_ADDRESS,
                ANCHOR_ERROR__CONSTRAINT_HAS_ONE
              )
            );
            return true;
          }
        },
        'Expected the refund to fail but it succeeded'
      );
    });
  });
});
