import { buildTicketAssetId, isCompressedNftMode, prepareCompressedMint } from './blockchain';
import type { BlockchainEnvironment, TicketMetadataInput, TicketNftMode } from './blockchain';

/**
 * Finality states surfaced by the mint orchestration layer.
 */
export type MintFinalityStatus = 'pending' | 'finalized';

/**
 * Shared owner and metadata payload required for either ticket mint mode.
 */
export interface MintTicketRequest {
  eventId: string;
  ticketId: string;
  owner: string;
  delegate?: string;
  mode?: TicketNftMode;
  metadata: TicketMetadataInput;
}

/**
 * Compressed NFT mint descriptor passed to the transport implementation.
 */
export interface CompressedMintDescriptor {
  assetId: string;
  owner: string;
  delegate: string;
  merkleTree: string;
  collectionMint: string;
  collectionUpdateAuthority: string;
  metadata: TicketMetadataInput & {
    sellerFeeBasisPoints: number;
    attributes: Array<{
      trait_type: string;
      value: string;
    }>;
  };
}

/**
 * Metadata NFT mint descriptor passed to the transport implementation.
 */
export interface MetadataMintDescriptor {
  assetId: string;
  mintAddress: string;
  owner: string;
  updateAuthority: string;
  collectionMint: string;
  metadata: TicketMetadataInput;
}

/**
 * Result returned by a transport once a mint transaction has been submitted.
 */
export interface SubmittedMintResult {
  signature: string;
  finality: MintFinalityStatus;
  assetId: string;
  mintAddress?: string | null;
}

/**
 * Narrow transport contract that can be implemented with real Metaplex SDK calls.
 */
export interface MintTransport {
  submitCompressedMint(descriptor: CompressedMintDescriptor): Promise<SubmittedMintResult>;
  submitMetadataMint(descriptor: MetadataMintDescriptor): Promise<SubmittedMintResult>;
}

/**
 * Final mint record persisted by fulfillment once submission succeeds.
 */
export interface MintedTicketAsset {
  mode: TicketNftMode;
  assetId: string;
  signature: string;
  mintAddress: string | null;
  finality: MintFinalityStatus;
}

/**
 * High-level minting service used by fulfillment and retry flows.
 */
export interface MintingService {
  mintTicket(request: MintTicketRequest): Promise<MintedTicketAsset>;
}

/**
 * Creates a Metaplex-oriented minting service with compressed NFTs as the default path.
 */
export function createMintingService(params: {
  environment: BlockchainEnvironment;
  transport?: MintTransport;
}): MintingService {
  const transport = params.transport ?? createUnconfiguredMintTransport();

  return {
    async mintTicket(request) {
      const mode = request.mode ?? params.environment.nftMode;

      if (isCompressedNftMode(mode)) {
        const prepared = prepareCompressedMint(
          {
            eventId: request.eventId,
            ticketId: request.ticketId,
            owner: request.owner,
            delegate: request.delegate,
            metadata: request.metadata,
          },
          params.environment,
        );

        const result = await transport.submitCompressedMint({
          assetId: prepared.assetId,
          owner: prepared.owner.toBase58(),
          delegate: prepared.delegate.toBase58(),
          merkleTree: prepared.merkleTree.toBase58(),
          collectionMint: prepared.collectionMint.toBase58(),
          collectionUpdateAuthority: prepared.collectionUpdateAuthority.toBase58(),
          metadata: prepared.metadata,
        });

        return {
          mode,
          assetId: result.assetId,
          signature: result.signature,
          mintAddress: result.mintAddress ?? null,
          finality: result.finality,
        };
      }

      const descriptor = prepareMetadataMintDescriptor(request, params.environment);
      const result = await transport.submitMetadataMint(descriptor);

      return {
        mode,
        assetId: result.assetId,
        signature: result.signature,
        mintAddress: result.mintAddress ?? descriptor.mintAddress,
        finality: result.finality,
      };
    },
  };
}

/**
 * Builds a fallback metadata NFT mint descriptor for non-compressed events.
 */
export function prepareMetadataMintDescriptor(
  request: MintTicketRequest,
  environment: BlockchainEnvironment,
): MetadataMintDescriptor {
  const assetId = buildTicketAssetId(request.eventId, request.ticketId);

  return {
    assetId,
    mintAddress: buildMetadataMintAddress(assetId),
    owner: request.owner.trim(),
    updateAuthority: environment.collectionUpdateAuthority.trim(),
    collectionMint: environment.collectionMint.trim(),
    metadata: {
      ...request.metadata,
      name: request.metadata.name.trim(),
      symbol: request.metadata.symbol.trim(),
      uri: request.metadata.uri.trim(),
      sellerFeeBasisPoints: request.metadata.sellerFeeBasisPoints ?? 0,
      attributes: request.metadata.attributes ?? [],
    },
  };
}

/**
 * Disabled transport used when the caller fails to provide a real minting backend.
 */
export function createUnconfiguredMintTransport(): MintTransport {
  return {
    async submitCompressedMint() {
      throw new Error(
        'Mint transport is not configured. Provide a real Metaplex transport before minting compressed NFTs.',
      );
    },
    async submitMetadataMint() {
      throw new Error(
        'Mint transport is not configured. Provide a real Metaplex transport before minting metadata NFTs.',
      );
    },
  };
}

function buildMetadataMintAddress(assetId: string): string {
  return `metadata_${assetId.replace(/[^a-zA-Z0-9]+/g, '_')}`;
}
