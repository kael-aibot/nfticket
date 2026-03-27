import {
  Commitment,
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  clusterApiUrl,
} from '@solana/web3.js';

export type SolanaCluster = 'devnet' | 'testnet' | 'mainnet-beta';
export type TicketNftMode = 'compressed' | 'metadata';

export interface BlockchainEnvironment {
  cluster: SolanaCluster;
  rpcUrl?: string;
  commitment?: Commitment;
  treasuryWallet: string;
  usdcMint: string;
  merkleTreeAddress: string;
  collectionMint: string;
  collectionUpdateAuthority: string;
  nftMode: TicketNftMode;
}

export interface BlockchainEnvironmentIssue {
  field: keyof BlockchainEnvironment | 'payerSecret';
  envVar: string;
  message: string;
}

export interface TicketMetadataInput {
  name: string;
  symbol: string;
  uri: string;
  sellerFeeBasisPoints?: number;
  attributes?: Array<{
    trait_type: string;
    value: string;
  }>;
}

export interface CompressedMintRequest {
  eventId: string;
  ticketId: string;
  owner: string;
  delegate?: string;
  metadata: TicketMetadataInput;
}

export interface PreparedCompressedMint {
  assetId: string;
  merkleTree: PublicKey;
  owner: PublicKey;
  delegate: PublicKey;
  collectionMint: PublicKey;
  collectionUpdateAuthority: PublicKey;
  metadata: {
    name: string;
    symbol: string;
    uri: string;
    sellerFeeBasisPoints: number;
    attributes: Array<{
      trait_type: string;
      value: string;
    }>;
  };
}

export interface PreparedUsdcTransfer {
  payer: PublicKey;
  recipient: PublicKey;
  mint: PublicKey;
  amountRaw: bigint;
  decimals: number;
}

export function resolveSolanaRpcUrl(cluster: SolanaCluster, override?: string): string {
  return override?.trim() || clusterApiUrl(cluster);
}

export function createBlockchainConnection(
  environment: BlockchainEnvironment,
): Connection {
  return new Connection(
    resolveSolanaRpcUrl(environment.cluster, environment.rpcUrl),
    environment.commitment ?? 'confirmed',
  );
}

export function parseBlockchainEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): BlockchainEnvironment {
  return {
    cluster: (env.SOLANA_CLUSTER as SolanaCluster | undefined) ?? 'devnet',
    rpcUrl: env.SOLANA_RPC_URL,
    commitment: (env.SOLANA_COMMITMENT as Commitment | undefined) ?? 'confirmed',
    treasuryWallet: requiredEnv(env.SOLANA_TREASURY_WALLET, 'SOLANA_TREASURY_WALLET'),
    usdcMint: requiredEnv(env.SOLANA_USDC_MINT, 'SOLANA_USDC_MINT'),
    merkleTreeAddress: requiredEnv(
      readEnvAlias(env, ['SOLANA_MERKLE_TREE_ADDRESS', 'SOLANA_MERKLE_TREE']),
      'SOLANA_MERKLE_TREE_ADDRESS',
    ),
    collectionMint: requiredEnv(env.SOLANA_COLLECTION_MINT, 'SOLANA_COLLECTION_MINT'),
    collectionUpdateAuthority: requiredEnv(
      readEnvAlias(env, ['SOLANA_COLLECTION_UPDATE_AUTHORITY', 'SOLANA_COLLECTION_AUTHORITY']),
      'SOLANA_COLLECTION_UPDATE_AUTHORITY',
    ),
    nftMode: (env.NFT_DEFAULT_MODE as TicketNftMode | undefined) ?? 'compressed',
  };
}

export function getBlockchainEnvironmentIssues(
  environment: Partial<BlockchainEnvironment>,
  mode: TicketNftMode,
): BlockchainEnvironmentIssue[] {
  const issues: BlockchainEnvironmentIssue[] = [];

  if (!environment.rpcUrl?.trim()) {
    issues.push({
      field: 'rpcUrl',
      envVar: 'SOLANA_RPC_URL',
      message: 'Missing SOLANA_RPC_URL.',
    });
  }

  if (!environment.treasuryWallet?.trim()) {
    issues.push({
      field: 'treasuryWallet',
      envVar: 'SOLANA_TREASURY_WALLET',
      message: 'Missing SOLANA_TREASURY_WALLET.',
    });
  }

  if (!environment.collectionMint?.trim()) {
    issues.push({
      field: 'collectionMint',
      envVar: 'SOLANA_COLLECTION_MINT',
      message: 'Missing SOLANA_COLLECTION_MINT.',
    });
  }

  if (!environment.collectionUpdateAuthority?.trim()) {
    issues.push({
      field: 'collectionUpdateAuthority',
      envVar: 'SOLANA_COLLECTION_UPDATE_AUTHORITY',
      message: 'Missing SOLANA_COLLECTION_UPDATE_AUTHORITY.',
    });
  }

  if (mode === 'compressed' && !environment.merkleTreeAddress?.trim()) {
    issues.push({
      field: 'merkleTreeAddress',
      envVar: 'SOLANA_MERKLE_TREE_ADDRESS',
      message: 'Compressed minting requires SOLANA_MERKLE_TREE_ADDRESS.',
    });
  }

  return issues;
}

export function prepareCompressedMint(
  request: CompressedMintRequest,
  environment: BlockchainEnvironment,
): PreparedCompressedMint {
  const owner = toPublicKey(request.owner, 'owner');
  const delegate = toPublicKey(request.delegate ?? request.owner, 'delegate');

  return {
    assetId: buildTicketAssetId(request.eventId, request.ticketId),
    merkleTree: toPublicKey(environment.merkleTreeAddress, 'merkle tree'),
    owner,
    delegate,
    collectionMint: toPublicKey(environment.collectionMint, 'collection mint'),
    collectionUpdateAuthority: toPublicKey(
      environment.collectionUpdateAuthority,
      'collection update authority',
    ),
    metadata: normalizeTicketMetadata(request.metadata),
  };
}

export function buildTicketAssetId(eventId: string, ticketId: string): string {
  const safeEventId = eventId.trim();
  const safeTicketId = ticketId.trim();

  if (!safeEventId || !safeTicketId) {
    throw new Error('eventId and ticketId are required to build an asset id');
  }

  return `${safeEventId}:${safeTicketId}`;
}

export function normalizeTicketMetadata(
  metadata: TicketMetadataInput,
): PreparedCompressedMint['metadata'] {
  if (!metadata.name.trim()) {
    throw new Error('metadata.name is required');
  }

  if (!metadata.symbol.trim()) {
    throw new Error('metadata.symbol is required');
  }

  if (!metadata.uri.trim()) {
    throw new Error('metadata.uri is required');
  }

  return {
    name: metadata.name.trim(),
    symbol: metadata.symbol.trim(),
    uri: metadata.uri.trim(),
    sellerFeeBasisPoints: clampSellerFeeBasisPoints(metadata.sellerFeeBasisPoints ?? 0),
    attributes: metadata.attributes ?? [],
  };
}

export function isCompressedNftMode(mode: TicketNftMode): boolean {
  return mode === 'compressed';
}

export function solToLamports(amountSol: number): number {
  if (!Number.isFinite(amountSol) || amountSol < 0) {
    throw new Error('SOL amount must be a non-negative finite number');
  }

  return Math.round(amountSol * LAMPORTS_PER_SOL);
}

export function prepareUsdcTransfer(params: {
  payer: string;
  recipient: string;
  amountUi: number;
  mint?: string;
  decimals?: number;
  environment: BlockchainEnvironment;
}): PreparedUsdcTransfer {
  const decimals = params.decimals ?? 6;

  if (!Number.isFinite(params.amountUi) || params.amountUi < 0) {
    throw new Error('USDC amount must be a non-negative finite number');
  }

  return {
    payer: toPublicKey(params.payer, 'payer'),
    recipient: toPublicKey(params.recipient, 'recipient'),
    mint: toPublicKey(params.mint ?? params.environment.usdcMint, 'USDC mint'),
    amountRaw: BigInt(Math.round(params.amountUi * 10 ** decimals)),
    decimals,
  };
}

function toPublicKey(value: string, label: string): PublicKey {
  try {
    return new PublicKey(value);
  } catch (error) {
    throw new Error(`Invalid ${label} public key: ${String(error)}`);
  }
}

function requiredEnv(value: string | undefined, name: string): string {
  if (!value?.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

function readEnvAlias(env: NodeJS.ProcessEnv, names: string[]): string | undefined {
  for (const name of names) {
    const value = env[name];
    if (value?.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function clampSellerFeeBasisPoints(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 10_000) {
    throw new Error('sellerFeeBasisPoints must be between 0 and 10000');
  }

  return Math.round(value);
}
