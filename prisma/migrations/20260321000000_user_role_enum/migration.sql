-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('buyer', 'provider', 'admin', 'platform');

-- Normalize legacy role values before converting the column to an enum.
UPDATE "UserIdentity"
SET "role" = 'buyer'
WHERE "role" = 'user';

-- Replace the free-form role column with the constrained enum.
ALTER TABLE "UserIdentity"
ALTER COLUMN "role" TYPE "UserRole"
USING "role"::"UserRole";
