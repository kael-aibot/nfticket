import { Metaplex, keypairIdentity, irysStorage } from '@metaplex-foundation/js';
import { Commitment, Connection, Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import type {
  CompressedMintDescriptor,
  MetadataMintDescriptor,
  MintTransport,
  SubmittedMintResult,
} from '../../../lib/minting';
import type {
  BlockchainEnvironment,
  BlockchainEnvironmentIssue,
  TicketNftMode,
} from '../../../lib/blockchain';
import { getBlockchainEnvironmentIssues } from '../../../lib/blockchain';

export interface MetaplexMintConfig {
  rpcUrl: string;
  payerKeypair: Keypair;
  commitment?: Commitment;
  collectionMint?: string;
  collectionUpdateAuthority?: string;
  merkleTreeAddress?: string;
}

export interface LoadedMetaplexMintConfig {
  config: MetaplexMintConfig | null;
  issues: BlockchainEnvironmentIssue[];
}

export function createMetaplexTransport(config: MetaplexMintConfig): MintTransport {
  const connection = new Connection(config.rpcUrl, config.commitment ?? 'confirmed');
  const metaplex = Metaplex.make(connection)
    .use(keypairIdentity(config.payerKeypair))
    .use(irysStorage({
      address: config.rpcUrl.includes('devnet') ? 'https://devnet.irys.xyz' : 'https://node.irys.xyz',
      providerUrl: config.rpcUrl,
      timeout: 60_000,
    }));

  const payerPublicKey = config.payerKeypair.publicKey;

  return {
    async submitCompressedMint(descriptor: CompressedMintDescriptor): Promise<SubmittedMintResult> {
      const tree = requirePublicKey(config.merkleTreeAddress, 'SOLANA_MERKLE_TREE_ADDRESS');
      const collectionMint = requirePublicKey(
        config.collectionMint ?? descriptor.collectionMint,
        'SOLANA_COLLECTION_MINT',
      );
      const collectionAuthority = requireSignerAuthority(
        config.collectionUpdateAuthority ?? descriptor.collectionUpdateAuthority,
        payerPublicKey,
        'SOLANA_COLLECTION_UPDATE_AUTHORITY',
      );

      const metadataUri = await uploadTicketMetadata(metaplex, descriptor.metadata);
      const result = await metaplex.nfts().create({
        uri: metadataUri,
        name: descriptor.metadata.name,
        symbol: descriptor.metadata.symbol,
        sellerFeeBasisPoints: descriptor.metadata.sellerFeeBasisPoints,
        tokenOwner: new PublicKey(descriptor.owner),
        tree,
        collection: collectionMint,
        collectionAuthority: config.payerKeypair,
        updateAuthority: config.payerKeypair,
      });

      const assetId = result.mintAddress.toBase58();

      return {
        signature: result.response.signature,
        finality: 'finalized',
        assetId,
        mintAddress: assetId,
      };
    },

    async submitMetadataMint(descriptor: MetadataMintDescriptor): Promise<SubmittedMintResult> {
      const collectionMint = requirePublicKey(
        config.collectionMint ?? descriptor.collectionMint,
        'SOLANA_COLLECTION_MINT',
      );
      requireSignerAuthority(
        config.collectionUpdateAuthority ?? descriptor.updateAuthority,
        payerPublicKey,
        'SOLANA_COLLECTION_UPDATE_AUTHORITY',
      );

      const metadataUri = await uploadTicketMetadata(metaplex, descriptor.metadata);
      const result = await metaplex.nfts().create({
        uri: metadataUri,
        name: descriptor.metadata.name,
        symbol: descriptor.metadata.symbol,
        sellerFeeBasisPoints: descriptor.metadata.sellerFeeBasisPoints ?? 0,
        tokenOwner: new PublicKey(descriptor.owner),
        collection: collectionMint,
        collectionAuthority: config.payerKeypair,
        updateAuthority: config.payerKeypair,
      });

      const mintAddress = result.mintAddress.toBase58();

      return {
        signature: result.response.signature,
        finality: 'finalized',
        assetId: mintAddress,
        mintAddress,
      };
    },
  };
}

export function loadMintConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): LoadedMetaplexMintConfig {
  const rpcUrl = env.SOLANA_RPC_URL?.trim();
  const payerSecret = env.SOLANA_PAYER_SECRET?.trim();
  const issues: BlockchainEnvironmentIssue[] = [];

  if (!rpcUrl) {
    issues.push({
      field: 'rpcUrl',
      envVar: 'SOLANA_RPC_URL',
      message: 'Missing SOLANA_RPC_URL.',
    });
  }

  if (!payerSecret) {
    issues.push({
      field: 'payerSecret',
      envVar: 'SOLANA_PAYER_SECRET',
      message: 'Missing SOLANA_PAYER_SECRET.',
    });
  }

  if (issues.length > 0 || !rpcUrl || !payerSecret) {
    return { config: null, issues };
  }

  try {
    const payerKeypair = Keypair.fromSecretKey(parseSecretKey(payerSecret));

    return {
      config: {
        rpcUrl,
        payerKeypair,
        commitment: (env.SOLANA_COMMITMENT as Commitment | undefined) ?? 'confirmed',
        collectionMint: env.SOLANA_COLLECTION_MINT?.trim(),
        collectionUpdateAuthority: readEnvAlias(env, [
          'SOLANA_COLLECTION_UPDATE_AUTHORITY',
          'SOLANA_COLLECTION_AUTHORITY',
        ]),
        merkleTreeAddress: readEnvAlias(env, [
          'SOLANA_MERKLE_TREE_ADDRESS',
          'SOLANA_MERKLE_TREE',
        ]),
      },
      issues: [],
    };
  } catch (error) {
    return {
      config: null,
      issues: [
        {
          field: 'payerSecret',
          envVar: 'SOLANA_PAYER_SECRET',
          message: `Invalid SOLANA_PAYER_SECRET: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
}

export function getMintConfigurationIssues(params: {
  environment: Partial<BlockchainEnvironment>;
  mode: TicketNftMode;
  env?: NodeJS.ProcessEnv;
}): BlockchainEnvironmentIssue[] {
  const env = params.env ?? process.env;
  const issues = [
    ...getBlockchainEnvironmentIssues(params.environment, params.mode),
    ...loadMintConfigFromEnv(env).issues,
  ];

  return dedupeIssues(issues);
}

async function uploadTicketMetadata(
  metaplex: Metaplex,
  metadata: CompressedMintDescriptor['metadata'] | MetadataMintDescriptor['metadata'],
): Promise<string> {
  const { uri } = await metaplex.nfts().uploadMetadata({
    name: metadata.name,
    symbol: metadata.symbol,
    description: `NFTicket admission asset for ${metadata.name}`,
    image: metadata.uri,
    attributes: metadata.attributes ?? [],
    properties: {
      category: 'image',
      files: [{ uri: metadata.uri, type: guessContentType(metadata.uri) }],
    },
  });

  return uri;
}

function parseSecretKey(value: string): Uint8Array {
  if (value.startsWith('[')) {
    return Uint8Array.from(JSON.parse(value) as number[]);
  }

  try {
    return Uint8Array.from(bs58.decode(value));
  } catch {
    return Uint8Array.from(Buffer.from(value, 'base64'));
  }
}

function requirePublicKey(value: string | undefined, envVar: string): PublicKey {
  if (!value?.trim()) {
    throw new Error(`Missing required mint configuration: ${envVar}`);
  }

  try {
    return new PublicKey(value);
  } catch (error) {
    throw new Error(`Invalid ${envVar}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function requireSignerAuthority(value: string | undefined, signer: PublicKey, envVar: string): void {
  const authority = requirePublicKey(value, envVar);
  if (!authority.equals(signer)) {
    throw new Error(
      `${envVar} must match the SOLANA_PAYER_SECRET public key (${signer.toBase58()}) for collection verification.`,
    );
  }
}

function guessContentType(uri: string): string {
  const normalized = uri.toLowerCase();
  if (normalized.endsWith('.png')) {
    return 'image/png';
  }
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (normalized.endsWith('.gif')) {
    return 'image/gif';
  }
  if (normalized.endsWith('.svg')) {
    return 'image/svg+xml';
  }

  return 'image/png';
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

function dedupeIssues(issues: BlockchainEnvironmentIssue[]): BlockchainEnvironmentIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.field}:${issue.envVar}:${issue.message}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
