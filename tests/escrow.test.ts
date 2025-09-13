import assert from 'node:assert';
import { describe, before, it } from 'node:test';
import {
  createTestEnvironment,
  getRandomId,
  createMakeOfferInstruction,
  TestEnvironment,
} from './escrow.test-helper';
import {
  isProgramError,
  isSolanaError,
  signTransactionMessageWithSigners,
  SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE,
} from 'gill';
import {
  SYSTEM_ERROR__ACCOUNT_ALREADY_IN_USE,
  TOKEN_2022_ERROR__INSUFFICIENT_FUNDS,
} from 'gill/programs';

describe('Escrow', async () => {
  let testEnv: TestEnvironment;
  let tokenAAmountOffered = 10 * 1_000_000_000;
  let tokenBAmountWanted = 1 * 1_000_000_000;
  before(async () => {
    testEnv = await createTestEnvironment();
  });

  describe('makeOffer', () => {
    it('successfully creates an offer with valid inputs', async () => {
      const id = getRandomId();
      const { vault, transactionMessage } = await createMakeOfferInstruction({
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
      let { transactionMessage } = await createMakeOfferInstruction({
        testEnv,
        id,
        tokenAAmountOffered,
        tokenBAmountWanted,
      });
      let signedTransaction =
        await signTransactionMessageWithSigners(transactionMessage);
      await testEnv.sendAndConfirmTransaction(signedTransaction);

      ({ transactionMessage } = await createMakeOfferInstruction({
        testEnv,
        id,
        tokenAAmountOffered,
        tokenBAmountWanted,
      }));
      signedTransaction =
        await signTransactionMessageWithSigners(transactionMessage);
      try {
        await testEnv.sendAndConfirmTransaction(signedTransaction);
        assert.fail('Offer creation did not fail for same ID');
      } catch (err) {
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
        }
      }
    });

    it('fails when maker has insufficient token balance', async () => {
      const id = getRandomId();
      const lotOfTokens = 10000 * 1_000_000_000;
      const { transactionMessage } = await createMakeOfferInstruction({
        testEnv,
        id,
        tokenAAmountOffered: lotOfTokens,
        tokenBAmountWanted,
      });
      const signedTransaction =
        await signTransactionMessageWithSigners(transactionMessage);
      try {
        await testEnv.sendAndConfirmTransaction(signedTransaction);
        assert.fail(
          'Offer creation did not fail for insufficient token amount'
        );
      } catch (err) {
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
        }
      }
    });

    it('fails when token mints are the same', async () => {
      const id = getRandomId();
      const { transactionMessage } = await createMakeOfferInstruction({
        testEnv,
        id,
        tokenAAmountOffered,
        tokenBAmountWanted,
        tokenMintA: testEnv.tokenMintA,
        tokenMintB: testEnv.tokenMintA,
      });
      const signedTransaction =
        await signTransactionMessageWithSigners(transactionMessage);
      try {
        await testEnv.sendAndConfirmTransaction(signedTransaction);
        assert.fail('Offer creation did not fail for same token mints');
      } catch (err) {
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
        }
      }
    });

    it('fails when token_b_wanted_amount is zero', async () => {
      const id = getRandomId();
      const { transactionMessage } = await createMakeOfferInstruction({
        testEnv,
        id,
        tokenAAmountOffered,
        tokenBAmountWanted: 0,
      });
      const signedTransaction =
        await signTransactionMessageWithSigners(transactionMessage);
      try {
        await testEnv.sendAndConfirmTransaction(signedTransaction);
        assert.fail(
          'Offer creation did not fail for when token_b_wanted_amount is zero'
        );
      } catch (err) {
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
        }
      }
    });

    it('fails when token_a_offered_amount is zero', async () => {
      const id = getRandomId();
      const { transactionMessage } = await createMakeOfferInstruction({
        testEnv,
        id,
        tokenAAmountOffered: 0,
        tokenBAmountWanted,
      });
      const signedTransaction =
        await signTransactionMessageWithSigners(transactionMessage);
      try {
        await testEnv.sendAndConfirmTransaction(signedTransaction);
        assert.fail(
          'Offer creation did not fail for when token_a_offered_amount is zero'
        );
      } catch (err) {
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
        }
      }
    });
  });

  describe('can get all the offers', () => {
    it('successfully gets all the offers', async () => {
      // TODO: Learn about codecs and implement fetching all offers
    });
  });
});
