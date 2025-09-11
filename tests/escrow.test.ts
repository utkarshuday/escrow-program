import assert from 'node:assert';
import { describe, before, it } from 'node:test';
import {
  createTestEnvironment,
  getRandomId,
  sendMakeOfferInstruction,
  TestEnvironment,
} from './escrow.test-helper';

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

    it('fails when trying to reuse an existing offer ID', async () => {});
  });
});
