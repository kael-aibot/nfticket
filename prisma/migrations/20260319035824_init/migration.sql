-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('draft', 'published', 'archived', 'cancelled');

-- CreateEnum
CREATE TYPE "NftMode" AS ENUM ('compressed', 'metadata');

-- CreateEnum
CREATE TYPE "AuthMode" AS ENUM ('email', 'wallet', 'hybrid');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'confirmed', 'failed', 'refunded', 'cancelled');

-- CreateEnum
CREATE TYPE "PaymentRail" AS ENUM ('stripe', 'sol', 'usdc');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('reserved', 'issued', 'minted', 'transferred', 'scanned', 'voided');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('pending', 'scheduled', 'paid', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "ScanResult" AS ENUM ('accepted', 'rejected', 'duplicate', 'manual_review');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('not_required', 'pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "UserIdentity" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "displayName" TEXT,
    "primaryWallet" TEXT,
    "wallets" TEXT[],
    "authMode" "AuthMode" NOT NULL,
    "role" TEXT NOT NULL,
    "kycStatus" "KycStatus" NOT NULL DEFAULT 'not_required',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "timeZone" TEXT NOT NULL,
    "status" "EventStatus" NOT NULL,
    "capacity" INTEGER NOT NULL,
    "nftMode" "NftMode" NOT NULL,
    "acceptedPayments" "PaymentRail"[],
    "resaleEnabled" BOOLEAN NOT NULL DEFAULT true,
    "resaleMaxTransfers" INTEGER NOT NULL DEFAULT 4,
    "resaleMinMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "resaleMaxMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "royaltyBasisPoints" INTEGER NOT NULL DEFAULT 1000,
    "resaleApprovalNeeded" BOOLEAN NOT NULL DEFAULT false,
    "authMode" "AuthMode" NOT NULL DEFAULT 'hybrid',
    "requireVerifiedEmail" BOOLEAN NOT NULL DEFAULT true,
    "requireWalletLink" BOOLEAN NOT NULL DEFAULT false,
    "requireKyc" BOOLEAN NOT NULL DEFAULT false,
    "authorizedScanners" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "purchaserId" TEXT NOT NULL,
    "ticketId" TEXT,
    "paymentRail" "PaymentRail" NOT NULL,
    "amount" DECIMAL(18,6) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "paymentReference" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "orderId" TEXT,
    "ownerId" TEXT NOT NULL,
    "inventoryKey" TEXT NOT NULL,
    "tierName" TEXT NOT NULL,
    "seatLabel" TEXT,
    "faceValue" DECIMAL(18,6) NOT NULL,
    "currency" TEXT NOT NULL,
    "assetId" TEXT,
    "nftMode" "NftMode" NOT NULL,
    "status" "TicketStatus" NOT NULL,
    "transferCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "orderId" TEXT,
    "beneficiaryUserId" TEXT,
    "beneficiaryWallet" TEXT,
    "amount" DECIMAL(18,6) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "PayoutStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "payoutReference" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scan" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "scannerUserId" TEXT,
    "checkpoint" TEXT NOT NULL,
    "result" "ScanResult" NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "metadata" JSONB,

    CONSTRAINT "Scan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanAttempt" (
    "id" TEXT NOT NULL,
    "eventId" TEXT,
    "ticketId" TEXT,
    "scanId" TEXT,
    "scannerUserId" TEXT,
    "scannerLabel" TEXT,
    "deviceFingerprint" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "checkpoint" TEXT NOT NULL,
    "result" "ScanResult" NOT NULL,
    "failureReason" TEXT,
    "payload" JSONB NOT NULL,
    "location" JSONB,
    "scannedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "ScanAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppState" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppState_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserIdentity_email_key" ON "UserIdentity"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserIdentity_primaryWallet_key" ON "UserIdentity"("primaryWallet");

-- CreateIndex
CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_orderId_key" ON "Ticket"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_assetId_key" ON "Ticket"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "ScanAttempt_idempotencyKey_key" ON "ScanAttempt"("idempotencyKey");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "UserIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_purchaserId_fkey" FOREIGN KEY ("purchaserId") REFERENCES "UserIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "UserIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scan" ADD CONSTRAINT "Scan_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scan" ADD CONSTRAINT "Scan_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanAttempt" ADD CONSTRAINT "ScanAttempt_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanAttempt" ADD CONSTRAINT "ScanAttempt_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
