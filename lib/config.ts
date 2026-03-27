import type { SolanaCluster } from './blockchain';
import { parseBlockchainEnvironment } from './blockchain';
import { parsePaymentEnvironment } from './payments';

/**
 * Feature flags used to stage Phase 2 rollout without breaking the current UI.
 */
export interface FeatureFlags {
  /** Enables usage of the canonical domain types and repository layer. */
  enableCoreDomain: boolean;
  /** Enables normalized event configuration reads and writes. */
  enableNormalizedEventConfig: boolean;
  /** Enables background job scheduling. */
  enableBackgroundJobs: boolean;
  /** Enables Prisma-backed persistence. */
  enablePrismaPersistence: boolean;
  /** Enables chain indexing services. */
  enableChainIndexer: boolean;
}

/**
 * Runtime storage backend selection.
 */
export type PersistenceDriver = 'browser' | 'memory' | 'prisma';

/**
 * Environment-scoped application configuration.
 */
export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  appEnv: string;
  persistenceDriver: PersistenceDriver;
  databaseUrl?: string;
  featureFlags: FeatureFlags;
  blockchain: {
    cluster: SolanaCluster;
    nftMode: 'compressed' | 'metadata';
  };
  payments: {
    enableStripe: boolean;
    enableSol: boolean;
    enableUsdc: boolean;
  };
}

/**
 * Default feature flags keep new systems off until explicitly enabled.
 */
export const defaultFeatureFlags: FeatureFlags = {
  enableCoreDomain: true,
  enableNormalizedEventConfig: true,
  enableBackgroundJobs: false,
  enablePrismaPersistence: false,
  enableChainIndexer: false,
};

/**
 * Parses all root application config and feature flags from the environment.
 */
export function parseAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const blockchain = parseBlockchainEnvironment(safeBlockchainEnv(env));
  const payments = parsePaymentEnvironment(env);

  return {
    nodeEnv: parseNodeEnv(env.NODE_ENV),
    appEnv: env.APP_ENV?.trim() || 'local',
    persistenceDriver: parsePersistenceDriver(env.PERSISTENCE_DRIVER),
    databaseUrl: optionalTrim(env.DATABASE_URL),
    featureFlags: parseFeatureFlags(env),
    blockchain: {
      cluster: blockchain.cluster,
      nftMode: blockchain.nftMode,
    },
    payments: {
      enableStripe: payments.enableStripe,
      enableSol: payments.enableSol,
      enableUsdc: payments.enableUsdc,
    },
  };
}

/**
 * Returns true when Prisma-backed persistence should be used.
 */
export function shouldUsePrismaPersistence(config: AppConfig): boolean {
  return config.featureFlags.enablePrismaPersistence && config.persistenceDriver === 'prisma';
}

/**
 * Returns true when background jobs should be scheduled.
 */
export function shouldRunBackgroundJobs(config: AppConfig): boolean {
  return config.featureFlags.enableBackgroundJobs;
}

/**
 * Returns true when chain indexing should be active.
 */
export function shouldRunIndexer(config: AppConfig): boolean {
  return config.featureFlags.enableChainIndexer;
}

function parseFeatureFlags(env: NodeJS.ProcessEnv): FeatureFlags {
  return {
    enableCoreDomain: parseBooleanFlag(env.FF_ENABLE_CORE_DOMAIN, defaultFeatureFlags.enableCoreDomain),
    enableNormalizedEventConfig: parseBooleanFlag(
      env.FF_ENABLE_NORMALIZED_EVENT_CONFIG,
      defaultFeatureFlags.enableNormalizedEventConfig,
    ),
    enableBackgroundJobs: parseBooleanFlag(
      env.FF_ENABLE_BACKGROUND_JOBS,
      defaultFeatureFlags.enableBackgroundJobs,
    ),
    enablePrismaPersistence: parseBooleanFlag(
      env.FF_ENABLE_PRISMA_PERSISTENCE,
      defaultFeatureFlags.enablePrismaPersistence,
    ),
    enableChainIndexer: parseBooleanFlag(
      env.FF_ENABLE_CHAIN_INDEXER,
      defaultFeatureFlags.enableChainIndexer,
    ),
  };
}

function parseNodeEnv(value: string | undefined): AppConfig['nodeEnv'] {
  if (value === 'production' || value === 'test') {
    return value;
  }

  return 'development';
}

function parsePersistenceDriver(value: string | undefined): PersistenceDriver {
  if (value === 'browser' || value === 'memory' || value === 'prisma') {
    return value;
  }

  return 'browser';
}

function parseBooleanFlag(value: string | undefined, fallback: boolean): boolean {
  if (!value?.trim()) {
    return fallback;
  }

  return value.trim().toLowerCase() === 'true';
}

function optionalTrim(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}

function safeBlockchainEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    ...env,
    SOLANA_TREASURY_WALLET: env.SOLANA_TREASURY_WALLET ?? '11111111111111111111111111111111',
    SOLANA_USDC_MINT: env.SOLANA_USDC_MINT ?? '11111111111111111111111111111111',
    SOLANA_MERKLE_TREE_ADDRESS:
      env.SOLANA_MERKLE_TREE_ADDRESS
      ?? env.SOLANA_MERKLE_TREE
      ?? '11111111111111111111111111111111',
    SOLANA_COLLECTION_MINT: env.SOLANA_COLLECTION_MINT ?? '11111111111111111111111111111111',
    SOLANA_COLLECTION_UPDATE_AUTHORITY:
      env.SOLANA_COLLECTION_UPDATE_AUTHORITY
      ?? env.SOLANA_COLLECTION_AUTHORITY
      ?? '11111111111111111111111111111111',
  };
}
