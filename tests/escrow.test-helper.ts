import {
  Address,
  airdropFactory,
  createSolanaClient,
  generateKeyPairSigner,
  lamports,
  signTransactionMessageWithSigners,
  type TransactionSigner,
} from 'gill';
import {
  buildCreateTokenTransaction,
  buildMintTokensTransaction,
  TOKEN_2022_PROGRAM_ADDRESS,
} from 'gill/programs';

export const ONE_SOL = 1_000_000_000;

export const { rpc, rpcSubscriptions, sendAndConfirmTransaction } =
  createSolanaClient({
    urlOrMoniker: 'http://127.0.0.1:8899',
  });

export async function generateKeyPairSignerWithSol(
  putativeLamports: bigint = 1_000_000_000n
) {
  const signer = await generateKeyPairSigner();
  await airdropFactory({ rpc, rpcSubscriptions })({
    recipientAddress: signer.address,
    lamports: lamports(putativeLamports),
    commitment: 'confirmed',
  });
  return signer;
}

export async function createTokenMint({
  feePayer,
  name,
  symbol,
  uri,
}: {
  feePayer: TransactionSigner;
  name: string;
  symbol: string;
  uri: string;
}) {
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
  const mint = await generateKeyPairSigner();
  const createTokenTx = await buildCreateTokenTransaction({
    feePayer,
    latestBlockhash,
    mint,
    metadata: {
      isMutable: true,
      name,
      symbol,
      uri,
    },
    tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
  });

  const signedTransaction =
    await signTransactionMessageWithSigners(createTokenTx);

  await sendAndConfirmTransaction(signedTransaction);
  return mint.address;
}

export async function mintToken({
  feePayer,
  mint,
  amount,
  destination,
}: {
  feePayer: TransactionSigner;
  mint: Address;
  amount: number;
  destination: Address;
}) {
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

  const mintTokensTx = await buildMintTokensTransaction({
    feePayer,
    latestBlockhash,
    mint,
    mintAuthority: feePayer,
    amount,
    destination,
    tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
  });

  const signedTransaction =
    await signTransactionMessageWithSigners(mintTokensTx);
  await sendAndConfirmTransaction(signedTransaction);
}
