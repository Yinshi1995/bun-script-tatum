/*
  Warnings:

  - You are about to drop the column `depositAmountBtc` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `depositCoinNetworkId` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `finalSentAmount` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `isPartner` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `partnerEmail` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `partnerShare` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `partnerUserId` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `payoutAmountBtc` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `payoutCoinNetworkId` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `profitBtc` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `profitRate` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `refundAddress` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `tatumSubscriptionId` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `webhookUrl` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `partnerTxCount` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `unwithdrawnEarnings` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `Coin` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CoinNetwork` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Setting` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TatumEndpoint` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TatumSubscription` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `payoutNetworkId` to the `Transaction` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DepositAddressStrategy" AS ENUM ('HD_XPUB', 'WALLET_SINGLE_ADDR', 'WALLET_PER_DEPOSIT', 'SHARED_ADDR_WITH_TAG');

-- DropForeignKey
ALTER TABLE "CoinNetwork" DROP CONSTRAINT "CoinNetwork_coinCode_fkey";

-- DropForeignKey
ALTER TABLE "CoinNetwork" DROP CONSTRAINT "CoinNetwork_networkId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";

-- DropForeignKey
ALTER TABLE "TatumEndpoint" DROP CONSTRAINT "TatumEndpoint_networkId_fkey";

-- DropForeignKey
ALTER TABLE "TatumSubscription" DROP CONSTRAINT "TatumSubscription_networkId_fkey";

-- DropForeignKey
ALTER TABLE "TatumSubscription" DROP CONSTRAINT "TatumSubscription_transactionId_fkey";

-- DropForeignKey
ALTER TABLE "Token" DROP CONSTRAINT "Token_userId_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_partnerUserId_fkey";

-- DropIndex
DROP INDEX "Transaction_depositCoinNetworkId_payoutCoinNetworkId_idx";

-- DropIndex
DROP INDEX "Transaction_isPartner_createdAt_idx";

-- DropIndex
DROP INDEX "Transaction_partnerEmail_idx";

-- DropIndex
DROP INDEX "Transaction_partnerUserId_createdAt_idx";

-- DropIndex
DROP INDEX "Transaction_tatumChain_idx";

-- DropIndex
DROP INDEX "Transaction_tatumSubscriptionId_key";

-- DropIndex
DROP INDEX "User_role_idx";

-- AlterTable
ALTER TABLE "Network" ADD COLUMN     "depositAddressStrategy" "DepositAddressStrategy" NOT NULL DEFAULT 'HD_XPUB';

-- AlterTable
ALTER TABLE "TatumWallet" ADD COLUMN     "nextDepositTag" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "depositAmountBtc",
DROP COLUMN "depositCoinNetworkId",
DROP COLUMN "finalSentAmount",
DROP COLUMN "isPartner",
DROP COLUMN "partnerEmail",
DROP COLUMN "partnerShare",
DROP COLUMN "partnerUserId",
DROP COLUMN "payoutAmountBtc",
DROP COLUMN "payoutCoinNetworkId",
DROP COLUMN "profitBtc",
DROP COLUMN "profitRate",
DROP COLUMN "refundAddress",
DROP COLUMN "tatumSubscriptionId",
DROP COLUMN "type",
DROP COLUMN "webhookUrl",
ADD COLUMN     "depositAddressStrategy" "DepositAddressStrategy",
ADD COLUMN     "depositNetworkId" INTEGER,
ADD COLUMN     "depositTag" TEXT,
ADD COLUMN     "payoutNetworkId" INTEGER NOT NULL,
ADD COLUMN     "tatumLedger" TEXT,
ALTER COLUMN "status" SET DEFAULT 'WAITING_FOR_DEPOSIT';

-- AlterTable
ALTER TABLE "User" DROP COLUMN "partnerTxCount",
DROP COLUMN "unwithdrawnEarnings";

-- DropTable
DROP TABLE "Coin";

-- DropTable
DROP TABLE "CoinNetwork";

-- DropTable
DROP TABLE "Setting";

-- DropTable
DROP TABLE "TatumEndpoint";

-- DropTable
DROP TABLE "TatumSubscription";

-- DropEnum
DROP TYPE "TatumEndpointRole";

-- DropEnum
DROP TYPE "TatumProtocol";

-- DropEnum
DROP TYPE "TatumSubscriptionType";

-- DropEnum
DROP TYPE "TransactionType";

-- CreateIndex
CREATE INDEX "Network_depositAddressStrategy_idx" ON "Network"("depositAddressStrategy");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Token_userId_idx" ON "Token"("userId");

-- CreateIndex
CREATE INDEX "Token_expiresAt_idx" ON "Token"("expiresAt");

-- CreateIndex
CREATE INDEX "Transaction_depositNetworkId_payoutNetworkId_idx" ON "Transaction"("depositNetworkId", "payoutNetworkId");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Token" ADD CONSTRAINT "Token_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_depositNetworkId_fkey" FOREIGN KEY ("depositNetworkId") REFERENCES "Network"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_payoutNetworkId_fkey" FOREIGN KEY ("payoutNetworkId") REFERENCES "Network"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
