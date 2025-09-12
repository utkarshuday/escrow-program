import assert from 'node:assert';
import { describe, before, it } from 'node:test';
import {
  createTestEnvironment,
  getRandomId,
  sendMakeOfferInstruction,
  TestEnvironment,
} from './escrow.test-helper';
import {
  isProgramError,
  isSolanaError,
  SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM,
  SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE,
} from 'gill';
import { ESCROW_PROGRAM_ADDRESS } from '../clients/js/src/generated';

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
      const { vault } = await sendMakeOfferInstruction({
        testEnv,
        id,
        tokenAAmountOffered,
        tokenBAmountWanted,
      });
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
      await sendMakeOfferInstruction({
        testEnv,
        id,
        tokenAAmountOffered,
        tokenBAmountWanted,
      });
      try {
        await sendMakeOfferInstruction({
          testEnv,
          id,
          tokenAAmountOffered,
          tokenBAmountWanted,
        });
        assert.ok(false, 'Offer creation did not fail for same ID');
      } catch (err) {
        if (
          isSolanaError(
            err,
            SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE
          )
        ) {
          const underlyingError = err.cause;
          assert.ok(true);
        }
      }
    });
  });
});
