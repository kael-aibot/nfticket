import { Connection, PublicKey, clusterApiUrl, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';

export interface SolanaConfig {
  rpcUrl: string;
  cluster: 'mainnet-beta' | 'devnet' | 'testnet';
  treasuryWallet: string;
  usdcMint: string;
}

export interface TransactionVerification {
  valid: boolean;
  error?: string;
  amount?: number;
  currency?: 'SOL' | 'USDC';
  from?: string;
  to?: string;
  confirmations?: number;
}

/**
 * Get Solana connection
 */
function getConnection(config: SolanaConfig): Connection {
  const endpoint = config.rpcUrl || clusterApiUrl(config.cluster || 'devnet');
  return new Connection(endpoint, 'confirmed');
}

/**
 * Verify a native SOL transfer transaction
 */
async function verifySolTransfer(
  connection: Connection,
  signature: string,
  expectedAmount: number,
  expectedRecipient: string,
  expectedSender?: string
): Promise<TransactionVerification> {
  try {
    // Fetch transaction
    const tx = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      return { valid: false, error: 'Transaction not found' };
    }

    if (!tx.meta) {
      return { valid: false, error: 'Transaction metadata not available' };
    }

    // Check transaction succeeded
    if (tx.meta.err) {
      return { valid: false, error: `Transaction failed: ${JSON.stringify(tx.meta.err)}` };
    }

    // Get account keys from the transaction
    const accountKeys = tx.transaction.message.getAccountKeys();
    if (!accountKeys) {
      return { valid: false, error: 'Could not extract account keys' };
    }

    // For a simple SOL transfer, look for:
    // - Account 0: payer/fee payer
    // - Account 1: recipient
    // The postBalance - preBalance for recipient should equal the amount

    const recipientIndex = accountKeys.staticAccountKeys.findIndex(
      key => key.toBase58() === expectedRecipient
    );

    if (recipientIndex === -1) {
      return { valid: false, error: 'Recipient not found in transaction' };
    }

    // Calculate amount received by recipient
    const preBalance = tx.meta.preBalances[recipientIndex] || 0;
    const postBalance = tx.meta.postBalances[recipientIndex] || 0;
    const amountReceived = (postBalance - preBalance) / LAMPORTS_PER_SOL;

    // Allow small tolerance for rent/fees (0.001 SOL)
    const tolerance = 0.001;
    if (Math.abs(amountReceived - expectedAmount) > tolerance) {
      return {
        valid: false,
        error: `Amount mismatch: expected ${expectedAmount} SOL, received ${amountReceived} SOL`,
        amount: amountReceived,
        currency: 'SOL',
      };
    }

    // Verify sender if provided
    if (expectedSender) {
      const senderIndex = accountKeys.staticAccountKeys.findIndex(
        key => key.toBase58() === expectedSender
      );
      if (senderIndex === -1) {
        return { valid: false, error: 'Sender not found in transaction' };
      }
    }

    // Get sender from fee payer (typically account 0)
    const sender = accountKeys.staticAccountKeys[0]?.toBase58();

    return {
      valid: true,
      amount: amountReceived,
      currency: 'SOL',
      from: sender,
      to: expectedRecipient,
      confirmations: tx.slot,
    };
  } catch (error) {
    return {
      valid: false,
      error: `Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Verify a USDC SPL token transfer transaction
 */
async function verifyUsdcTransfer(
  connection: Connection,
  signature: string,
  expectedAmount: number,
  expectedRecipient: string,
  usdcMint: string,
  expectedSender?: string
): Promise<TransactionVerification> {
  try {
    // Fetch transaction
    const tx = await connection.getParsedTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      return { valid: false, error: 'Transaction not found' };
    }

    if (!tx.meta) {
      return { valid: false, error: 'Transaction metadata not available' };
    }

    // Check transaction succeeded
    if (tx.meta.err) {
      return { valid: false, error: `Transaction failed: ${JSON.stringify(tx.meta.err)}` };
    }

    // Look for SPL token transfer instruction
    const instructions = tx.transaction.message.instructions;
    let transferFound = false;
    let transferAmount = 0;
    let sender = '';
    let recipient = '';

    for (const ix of instructions) {
      // Check if it's a parsed instruction with token transfer data
      if ('parsed' in ix && ix.parsed) {
        const parsed = ix.parsed;
        if (parsed.type === 'transfer' || parsed.type === 'transferChecked') {
          const info = parsed.info;
          if (info) {
            transferFound = true;
            transferAmount = Number(info.amount) / 1_000_000; // USDC has 6 decimals
            sender = info.authority || info.source;
            recipient = info.destination;
          }
        }
      }
    }

    if (!transferFound) {
      return { valid: false, error: 'No USDC transfer instruction found' };
    }

    // Verify recipient's associated token account matches expected wallet
    const expectedRecipientATA = await getAssociatedTokenAddress(
      new PublicKey(usdcMint),
      new PublicKey(expectedRecipient)
    );

    if (recipient !== expectedRecipientATA.toBase58()) {
      return {
        valid: false,
        error: 'Recipient token account does not match expected wallet',
      };
    }

    // Allow small tolerance for decimal precision (0.01 USDC)
    const tolerance = 0.01;
    if (Math.abs(transferAmount - expectedAmount) > tolerance) {
      return {
        valid: false,
        error: `Amount mismatch: expected ${expectedAmount} USDC, received ${transferAmount} USDC`,
        amount: transferAmount,
        currency: 'USDC',
      };
    }

    // Verify sender if provided
    if (expectedSender) {
      const expectedSenderATA = await getAssociatedTokenAddress(
        new PublicKey(usdcMint),
        new PublicKey(expectedSender)
      );
      if (sender !== expectedSender && sender !== expectedSenderATA.toBase58()) {
        return { valid: false, error: 'Sender does not match expected wallet' };
      }
    }

    return {
      valid: true,
      amount: transferAmount,
      currency: 'USDC',
      from: sender,
      to: expectedRecipient,
      confirmations: tx.slot,
    };
  } catch (error) {
    return {
      valid: false,
      error: `Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Verify a Solana transaction for NFTicket payment
 * 
 * @param signature - Transaction signature
 * @param expectedAmount - Expected amount in SOL or USDC
 * @param currency - 'SOL' or 'USDC'
 * @param config - Solana configuration
 * @param expectedSender - Optional wallet that should have sent the payment
 * @returns Verification result
 */
export async function verifyTransaction(
  signature: string,
  expectedAmount: number,
  currency: 'SOL' | 'USDC',
  config: SolanaConfig,
  expectedSender?: string
): Promise<TransactionVerification> {
  // Validate inputs
  if (!signature || signature.length < 64) {
    return { valid: false, error: 'Invalid transaction signature' };
  }

  if (expectedAmount <= 0) {
    return { valid: false, error: 'Invalid expected amount' };
  }

  if (!config.treasuryWallet) {
    return { valid: false, error: 'Treasury wallet not configured' };
  }

  const connection = getConnection(config);

  if (currency === 'USDC') {
    return verifyUsdcTransfer(
      connection,
      signature,
      expectedAmount,
      config.treasuryWallet,
      config.usdcMint,
      expectedSender
    );
  } else {
    return verifySolTransfer(
      connection,
      signature,
      expectedAmount,
      config.treasuryWallet,
      expectedSender
    );
  }
}

/**
 * Load Solana config from environment variables
 */
export function loadSolanaConfig(): SolanaConfig {
  return {
    rpcUrl: process.env.SOLANA_RPC_URL || '',
    cluster: (process.env.SOLANA_CLUSTER as any) || 'devnet',
    treasuryWallet: process.env.SOLANA_TREASURY_WALLET || '',
    usdcMint: process.env.SOLANA_USDC_MINT || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  };
}
