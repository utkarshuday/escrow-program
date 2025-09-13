import {
  Address,
  airdropFactory,
  Base64EncodedBytes,
  createSolanaClient,
  createTransaction,
  generateKeyPairSigner,
  getBase64Decoder,
  getBase64Encoder,
  getProgramDerivedAddress,
  getU64Encoder,
  lamports,
  MessageSigner,
  Rpc,
  RpcSubscriptions,
  SendAndConfirmTransactionWithSignersFunction,
  signTransactionMessageWithSigners,
  SolanaRpcApi,
  SolanaRpcSubscriptionsApi,
  TransactionSigner,
} from 'gill';
import {
  buildCreateTokenTransaction,
  buildMintTokensTransaction,
  getAssociatedTokenAccountAddress,
  TOKEN_2022_PROGRAM_ADDRESS,
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
  aliceTokenAccountA: Address;
  bobTokenAccountA: Address;
  aliceTokenAccountB: Address;
  bobTokenAccountB: Address;
  bobInitialTokenBAmount: bigint;
  aliceInitialTokenAAamount: bigint;
  programClient: typeof programClient;
};

const tokenDecimals = 9;
export const DECIMALS = 10n ** BigInt(tokenDecimals);
export const ANCHOR_ERROR__CONSTRAINT_HAS_ONE = 2001;
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

  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
  const tokenMintA = await generateKeyPairSigner();
  let createTokenTx = await buildCreateTokenTransaction({
    feePayer: authority,
    latestBlockhash,
    mint: tokenMintA,
    decimals: tokenDecimals,
    metadata: {
      isMutable: true,
      name: 'Token A',
      symbol: 'TKNA',
      uri: 'https://raw.githubusercontent.com/utkarshuday/escrow-program/main/tests/assets/token-a.json',
    },
    tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
  });
  let signedTransaction =
    await signTransactionMessageWithSigners(createTokenTx);
  await sendAndConfirmTransaction(signedTransaction);

  const tokenMintB = await generateKeyPairSigner();
  createTokenTx = await buildCreateTokenTransaction({
    feePayer: authority,
    latestBlockhash,
    mint: tokenMintB,
    decimals: tokenDecimals,
    metadata: {
      isMutable: true,
      name: 'Token B',
      symbol: 'TKNB',
      uri: 'https://raw.githubusercontent.com/utkarshuday/escrow-program/main/tests/assets/token-b.json',
    },
    tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
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
    tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
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
    tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
  });
  signedTransaction = await signTransactionMessageWithSigners(mintTokensTx);
  await sendAndConfirmTransaction(signedTransaction);

  const aliceTokenAccountA = await getAssociatedTokenAccountAddress(
    tokenMintA,
    alice.address,
    TOKEN_2022_PROGRAM_ADDRESS
  );

  const aliceTokenAccountB = await getAssociatedTokenAccountAddress(
    tokenMintB,
    alice.address,
    TOKEN_2022_PROGRAM_ADDRESS
  );

  const bobTokenAccountA = await getAssociatedTokenAccountAddress(
    tokenMintA,
    bob.address,
    TOKEN_2022_PROGRAM_ADDRESS
  );

  const bobTokenAccountB = await getAssociatedTokenAccountAddress(
    tokenMintB,
    bob.address,
    TOKEN_2022_PROGRAM_ADDRESS
  );

  return {
    ...rpcClient,
    authority,
    alice,
    bob,
    sendAndConfirmTransaction,
    tokenMintA: tokenMintA.address,
    tokenMintB: tokenMintB.address,
    aliceTokenAccountA,
    bobTokenAccountB,
    aliceTokenAccountB,
    bobTokenAccountA,
    aliceInitialTokenAAamount,
    bobInitialTokenBAmount,
    programClient,
  };
}

async function generateKeyPairSignerWithSol(
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
  tokenProgram = TOKEN_2022_PROGRAM_ADDRESS,
  tokenMintA = testEnv.tokenMintA,
  tokenMintB = testEnv.tokenMintB,
}: {
  testEnv: TestEnvironment;
  id: bigint;
  tokenAAmountOffered: number | bigint;
  tokenBAmountWanted: number | bigint;
  maker?: TransactionSigner & MessageSigner;
  tokenProgram?: Address;
  tokenMintA?: Address;
  tokenMintB?: Address;
}) {
  const makeOfferIx = await testEnv.programClient.getMakeOfferInstructionAsync({
    maker,
    tokenProgram,
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
    testEnv.tokenMintA,
    offer,
    TOKEN_2022_PROGRAM_ADDRESS
  );
  return { offer, vault, transactionMessage: createTx };
}

export async function createTakeOfferTransaction({
  testEnv,
  offer,
  tokenProgram = TOKEN_2022_PROGRAM_ADDRESS,
}: {
  testEnv: TestEnvironment;
  offer: Address;
  tokenProgram?: Address;
}) {
  const takeOfferIx = await testEnv.programClient.getTakeOfferInstructionAsync({
    offer,
    taker: testEnv.bob,
    tokenMintA: testEnv.tokenMintA,
    tokenMintB: testEnv.tokenMintB,
    maker: testEnv.alice.address,
    tokenProgram,
  });
  const { value: latestBlockhash } = await testEnv.rpc
    .getLatestBlockhash()
    .send();
  const createTx = createTransaction({
    feePayer: testEnv.bob,
    instructions: [takeOfferIx],
    latestBlockhash,
  });
  return { transactionMessage: createTx };
}

export async function createRefundOfferTransaction({
  testEnv,
  offer,
  tokenProgram = TOKEN_2022_PROGRAM_ADDRESS,
  maker = testEnv.alice,
}: {
  testEnv: TestEnvironment;
  offer: Address;
  tokenProgram?: Address;
  maker?: TransactionSigner & MessageSigner;
}) {
  const refundOfferIx =
    await testEnv.programClient.getRefundOfferInstructionAsync({
      offer,
      tokenMintA: testEnv.tokenMintA,
      tokenMintB: testEnv.tokenMintB,
      maker,
      tokenProgram,
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
