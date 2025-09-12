import {
  Address,
  airdropFactory,
  createSolanaClient,
  createTransaction,
  generateKeyPairSigner,
  getProgramDerivedAddress,
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
  bobTokenAccountB: Address;
  programClient: typeof programClient;
};

export async function createTestEnvironment(): Promise<TestEnvironment> {
  const { rpc, rpcSubscriptions, sendAndConfirmTransaction } =
    createSolanaClient({
      urlOrMoniker: 'localnet',
    });
  const rpcClient = { rpc, rpcSubscriptions };
  const [authority, alice, bob] = await Promise.all(
    Array.from({ length: 3 }, () => generateKeyPairSignerWithSol(rpcClient))
  );

  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
  const tokenMintA = await generateKeyPairSigner();
  let createTokenTx = await buildCreateTokenTransaction({
    feePayer: authority,
    latestBlockhash,
    mint: tokenMintA,
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
    amount: 1000 * 1_000_000_000,
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
    amount: 100 * 1_000_000_000,
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
    programClient,
  };
}

async function generateKeyPairSignerWithSol(
  rpcClient: RpcClient,
  putativeLamports: bigint = 1_000_000_000n
) {
  const signer = await generateKeyPairSigner();
  await airdropFactory(rpcClient)({
    recipientAddress: signer.address,
    lamports: lamports(putativeLamports),
    commitment: 'confirmed',
  });
  return signer;
}

export async function createMakeOfferInstruction({
  testEnv,
  id,
  tokenAAmountOffered,
  tokenBAmountWanted,
  maker = testEnv.alice,
  tokenProgram = TOKEN_2022_PROGRAM_ADDRESS,
}: {
  testEnv: TestEnvironment;
  id: bigint;
  tokenAAmountOffered: number;
  tokenBAmountWanted: number;
  maker?: TransactionSigner & MessageSigner;
  tokenProgram?: Address;
}) {
  const makeOfferIx = await testEnv.programClient.getMakeOfferInstructionAsync({
    maker,
    tokenProgram,
    tokenMintA: testEnv.tokenMintA,
    tokenMintB: testEnv.tokenMintB,
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

  const idBuffer = Buffer.alloc(8);
  idBuffer.writeBigUInt64LE(id);
  const [offer] = await getProgramDerivedAddress({
    programAddress: testEnv.programClient.ESCROW_PROGRAM_ADDRESS,
    seeds: ['offer', idBuffer],
  });

  const vault = await getAssociatedTokenAccountAddress(
    testEnv.tokenMintA,
    offer,
    TOKEN_2022_PROGRAM_ADDRESS
  );
  return { offer, vault, transactionMessage: createTx };
}
