import {
  createSolanaClient,
  generateKeyPairSigner,
  type TransactionSigner,
} from 'gill';
import { buildCreateTokenTransaction } from 'gill/programs';

export const TOKEN_DECIMALS = 9;
export const ONE_SOL = 1_000_000_000;

export const { rpc, rpcSubscriptions, sendAndConfirmTransaction } =
  createSolanaClient({
    urlOrMoniker: 'http://127.0.0.1:8899',
  });

export async function createTokenMint(feePayer: TransactionSigner) {
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
  const mint = await generateKeyPairSigner();
  const createTokenTx = await buildCreateTokenTransaction({
    feePayer,
    latestBlockhash,
    mint,
    metadata: {
      isMutable: true,
      name: 'Only Possible On Solana',
      symbol: 'OPOS',
      uri: 'https://raw.githubusercontent.com/solana-developers/opos-asset/main/assets/Climate/metadata.json',
    },
  });
}
