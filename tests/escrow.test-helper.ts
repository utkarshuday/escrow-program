import {
  airdropFactory,
  createSolanaClient,
  createTransaction,
  generateKeyPairSigner,
  getBase64Decoder,
  getBase64Encoder,
  getMinimumBalanceForRentExemption,
  getProgramDerivedAddress,
  getU64Encoder,
  lamports,
  signTransactionMessageWithSigners,
} from 'gill';
import type {
  Address,
  Base64EncodedBytes,
  Blockhash,
  MessageSigner,
  Rpc,
  RpcSubscriptions,
  SendAndConfirmTransactionWithSignersFunction,
  SolanaRpcApi,
  SolanaRpcSubscriptionsApi,
  TransactionSigner,
} from 'gill';
import {
  buildCreateTokenTransaction,
  buildMintTokensTransaction,
  getAssociatedTokenAccountAddress,
  getCreateAccountInstruction,
  getInitializeMintInstruction,
  getMintSize,
  TOKEN_2022_PROGRAM_ADDRESS,
  TOKEN_PROGRAM_ADDRESS,
} from 'gill/programs';
import * as programClient from '../clients/js/src/generated';
import { randomBytes } from 'node:crypto';

export function getRandomId() {
  return randomBytes(8).readBigUInt64LE();
}

type RpcClient = {
  rpc: Rpc<SolanaRpcApi>;
  rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>;
};

export type TestEnvironment = RpcClient & {
  sendAndConfirmTransaction: SendAndConfirmTransactionWithSignersFunction;
  authority: TransactionSigner & MessageSigner;
  alice: TransactionSigner & MessageSigner;
  bob: TransactionSigner & MessageSigner;
  tokenMintA: Address;
  tokenMintB: Address;
  tokenProgramForTokenMintA: Address;
  tokenProgramForTokenMintB: Address;
  aliceTokenAccountA: Address;
  bobTokenAccountA: Address;
  aliceTokenAccountB: Address;
  bobTokenAccountB: Address;
  bobInitialTokenBAmount: bigint;
  aliceInitialTokenAAamount: bigint;
  programClient: typeof programClient;
};

export const tokenDecimals = 9;
export const DECIMALS = 10n ** BigInt(tokenDecimals);
export const ANCHOR_ERROR__CONSTRAINT_HAS_ONE = 2001;
export const ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED = 3012;

export async function createTestEnvironment(): Promise<TestEnvironment> {
  const { rpc, rpcSubscriptions, sendAndConfirmTransaction } =
    createSolanaClient({
      urlOrMoniker: 'localnet',
    });
  const rpcClient = { rpc, rpcSubscriptions };
  const [authority, alice, bob] = await Promise.all(
    Array.from({ length: 3 }, () => generateKeyPairSignerWithSol(rpcClient))
  );
  const aliceInitialTokenAAamount = 1000n * DECIMALS;
  const bobInitialTokenBAmount = 100n * DECIMALS;

  // Token programs for respective mints, can be tested for same or different mints
  const tokenProgramForTokenMintA = TOKEN_PROGRAM_ADDRESS;
  const tokenProgramForTokenMintB = TOKEN_2022_PROGRAM_ADDRESS;

  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

  const tokenMintA = await generateKeyPairSigner();
  let createTokenTx = await buildCreateTokenTransactionWithoutMetadata({
    feePayer: authority,
    latestBlockhash,
    mint: tokenMintA,
    tokenProgram: tokenProgramForTokenMintA,
  });
  let signedTransaction =
    await signTransactionMessageWithSigners(createTokenTx);
  await sendAndConfirmTransaction(signedTransaction);

  const tokenMintB = await generateKeyPairSigner();
  createTokenTx = await buildCreateTokenTransactionWithoutMetadata({
    feePayer: authority,
    latestBlockhash,
    mint: tokenMintB,
    tokenProgram: tokenProgramForTokenMintB,
  });
  signedTransaction = await signTransactionMessageWithSigners(createTokenTx);
  await sendAndConfirmTransaction(signedTransaction);

  let mintTokensTx = await buildMintTokensTransaction({
    feePayer: authority,
    latestBlockhash,
    mint: tokenMintA,
    mintAuthority: authority,
    amount: aliceInitialTokenAAamount,
    destination: alice.address,
    tokenProgram: tokenProgramForTokenMintA,
  });
  signedTransaction = await signTransactionMessageWithSigners(mintTokensTx);
  await sendAndConfirmTransaction(signedTransaction);

  mintTokensTx = await buildMintTokensTransaction({
    feePayer: authority,
    latestBlockhash,
    mint: tokenMintB,
    mintAuthority: authority,
    amount: bobInitialTokenBAmount,
    destination: bob.address,
    tokenProgram: tokenProgramForTokenMintB,
  });
  signedTransaction = await signTransactionMessageWithSigners(mintTokensTx);
  await sendAndConfirmTransaction(signedTransaction);

  const aliceTokenAccountA = await getAssociatedTokenAccountAddress(
    tokenMintA,
    alice.address,
    tokenProgramForTokenMintA
  );

  const aliceTokenAccountB = await getAssociatedTokenAccountAddress(
    tokenMintB,
    alice.address,
    tokenProgramForTokenMintB
  );

  const bobTokenAccountA = await getAssociatedTokenAccountAddress(
    tokenMintA,
    bob.address,
    tokenProgramForTokenMintA
  );

  const bobTokenAccountB = await getAssociatedTokenAccountAddress(
    tokenMintB,
    bob.address,
    tokenProgramForTokenMintB
  );

  return {
    ...rpcClient,
    authority,
    alice,
    bob,
    sendAndConfirmTransaction,
    tokenMintA: tokenMintA.address,
    tokenMintB: tokenMintB.address,
    tokenProgramForTokenMintA,
    tokenProgramForTokenMintB,
    aliceTokenAccountA,
    bobTokenAccountB,
    aliceTokenAccountB,
    bobTokenAccountA,
    aliceInitialTokenAAamount,
    bobInitialTokenBAmount,
    programClient,
  };
}

export async function generateKeyPairSignerWithSol(
  rpcClient: RpcClient,
  putativeLamports: bigint = DECIMALS
) {
  const signer = await generateKeyPairSigner();
  await airdropFactory(rpcClient)({
    recipientAddress: signer.address,
    lamports: lamports(putativeLamports),
    commitment: 'confirmed',
  });
  return signer;
}

export async function createMakeOfferTransaction({
  testEnv,
  id,
  tokenAAmountOffered,
  tokenBAmountWanted,
  maker = testEnv.alice,
  tokenMintA = testEnv.tokenMintA,
  tokenMintB = testEnv.tokenMintB,
  tokenProgramA = testEnv.tokenProgramForTokenMintA,
}: {
  testEnv: TestEnvironment;
  id: bigint;
  tokenAAmountOffered: number | bigint;
  tokenBAmountWanted: number | bigint;
  maker?: TransactionSigner & MessageSigner;
  tokenMintA?: Address;
  tokenMintB?: Address;
  tokenProgramA?: Address;
}) {
  const makeOfferIx = await testEnv.programClient.getMakeOfferInstructionAsync({
    maker,
    tokenProgramA,
    tokenMintA,
    tokenMintB,
    id,
    tokenAAmountOffered,
    tokenBAmountWanted,
  });
  const { value: latestBlockhash } = await testEnv.rpc
    .getLatestBlockhash()
    .send();
  const createTx = createTransaction({
    feePayer: maker,
    instructions: [makeOfferIx],
    latestBlockhash,
  });

  const [offer] = await getProgramDerivedAddress({
    programAddress: testEnv.programClient.ESCROW_PROGRAM_ADDRESS,
    seeds: ['offer', getU64Encoder().encode(id)],
  });

  const vault = await getAssociatedTokenAccountAddress(
    tokenMintA,
    offer,
    tokenProgramA
  );
  return { offer, vault, transactionMessage: createTx };
}

export async function createTakeOfferTransaction({
  testEnv,
  offer,
  maker = testEnv.alice.address,
  taker = testEnv.bob,
  tokenMintA = testEnv.tokenMintA,
  tokenMintB = testEnv.tokenMintB,
  tokenProgramA = testEnv.tokenProgramForTokenMintA,
  tokenProgramB = testEnv.tokenProgramForTokenMintB,
}: {
  testEnv: TestEnvironment;
  offer: Address;
  taker?: TransactionSigner & MessageSigner;
  maker?: Address;
  tokenMintA?: Address;
  tokenMintB?: Address;
  tokenProgramA?: Address;
  tokenProgramB?: Address;
}) {
  const takeOfferIx = await testEnv.programClient.getTakeOfferInstructionAsync({
    offer,
    taker,
    tokenMintA,
    tokenMintB,
    maker,
    tokenProgramA,
    tokenProgramB,
  });
  const { value: latestBlockhash } = await testEnv.rpc
    .getLatestBlockhash()
    .send();
  const createTx = createTransaction({
    feePayer: taker,
    instructions: [takeOfferIx],
    latestBlockhash,
  });
  return { transactionMessage: createTx };
}

export async function createRefundOfferTransaction({
  testEnv,
  offer,
  tokenMintA = testEnv.tokenMintA,
  tokenMintB = testEnv.tokenMintB,
  tokenProgramA = testEnv.tokenProgramForTokenMintA,
  maker = testEnv.alice,
}: {
  testEnv: TestEnvironment;
  offer: Address;
  tokenMintA?: Address;
  tokenMintB?: Address;
  tokenProgramA?: Address;
  maker?: TransactionSigner & MessageSigner;
}) {
  const refundOfferIx =
    await testEnv.programClient.getRefundOfferInstructionAsync({
      offer,
      tokenMintA,
      tokenMintB,
      maker,
      tokenProgramA,
    });
  const { value: latestBlockhash } = await testEnv.rpc
    .getLatestBlockhash()
    .send();
  const createTx = createTransaction({
    feePayer: maker,
    instructions: [refundOfferIx],
    latestBlockhash,
  });
  return { transactionMessage: createTx };
}

export async function getAllOffers(testEnv: TestEnvironment) {
  const accounts = await testEnv.rpc
    .getProgramAccounts(testEnv.programClient.ESCROW_PROGRAM_ADDRESS, {
      encoding: 'base64',
      filters: [
        {
          memcmp: {
            offset: 0n,
            bytes: getBase64Decoder().decode(
              testEnv.programClient.OFFER_DISCRIMINATOR
            ) as Base64EncodedBytes,
            encoding: 'base64',
          },
        },
      ],
    })
    .send();
  const decodedAccounts = accounts.map(account =>
    testEnv.programClient
      .getOfferDecoder()
      .decode(getBase64Encoder().encode(account.account.data[0]))
  );
  return decodedAccounts;
}
export async function buildCreateTokenTransactionWithoutMetadata({
  feePayer,
  mint,
  latestBlockhash,
  tokenProgram,
}: {
  feePayer: TransactionSigner & MessageSigner;
  mint: TransactionSigner & MessageSigner;
  latestBlockhash: {
    blockhash: Blockhash;
    lastValidBlockHeight: bigint;
  };
  tokenProgram: Address;
}) {
  const space = getMintSize();
  const transaction = createTransaction({
    feePayer,
    instructions: [
      getCreateAccountInstruction({
        space,
        lamports: getMinimumBalanceForRentExemption(space),
        newAccount: mint,
        payer: feePayer,
        programAddress: tokenProgram,
      }),
      getInitializeMintInstruction(
        {
          mint: mint.address,
          mintAuthority: feePayer.address,
          freezeAuthority: feePayer.address,
          decimals: 9,
        },
        {
          programAddress: tokenProgram,
        }
      ),
    ],
    latestBlockhash,
  });
  return transaction;
}
