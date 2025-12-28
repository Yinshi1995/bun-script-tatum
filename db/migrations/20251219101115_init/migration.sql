/*
  Warnings:

  - The primary key for the `Coin` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Coin` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Coin` table. All the data in the column will be lost.
  - The primary key for the `Message` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `email` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `actualDepositAmount` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `amlStatus` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `depositAddress` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `depositCoinId` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `depositExtraAddress` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `depositNetwork` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `derivationIndex` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `exchange` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `hdWalletAccountId` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `isPartnerTransaction` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `partnerId` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `partnerSharePercent` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `payoutAddress` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `payoutCoinId` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `payoutExtraAddress` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `payoutNetwork` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `profitPercent` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `User` table. All the data in the column will be lost.
  - The `role` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `Deposit` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `HdWalletAccount` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Partner` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Settings` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[username]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[apiKey]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `isActive` to the `Coin` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fromEmail` to the `Message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `depositCoinCode` to the `Transaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `isPartner` to the `Transaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ourDepositAddress` to the `Transaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `payoutCoinCode` to the `Transaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `payoutNetworkId` to the `Transaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `recipientAddress` to the `Transaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Transaction` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ROLE" AS ENUM ('PARTNER', 'ADMIN');

-- DropForeignKey
ALTER TABLE "Deposit" DROP CONSTRAINT "Deposit_transactionId_fkey";

-- DropForeignKey
ALTER TABLE "Partner" DROP CONSTRAINT "Partner_userId_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_depositCoinId_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_hdWalletAccountId_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_partnerId_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_payoutCoinId_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_userId_fkey";

-- DropIndex
DROP INDEX "Coin_code_key";

-- DropIndex
DROP INDEX "Transaction_depositAddress_idx";

-- DropIndex
DROP INDEX "Transaction_partnerId_idx";

-- DropIndex
DROP INDEX "Transaction_status_idx";

-- DropIndex
DROP INDEX "Transaction_userId_idx";

-- AlterTable
ALTER TABLE "Coin" DROP CONSTRAINT "Coin_pkey",
DROP COLUMN "id",
DROP COLUMN "status",
ADD COLUMN     "isActive" BOOLEAN NOT NULL,
ADD CONSTRAINT "Coin_pkey" PRIMARY KEY ("code");

-- AlterTable
ALTER TABLE "Message" DROP CONSTRAINT "Message_pkey",
DROP COLUMN "email",
ADD COLUMN     "fromEmail" TEXT NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Message_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Message_id_seq";

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "actualDepositAmount",
DROP COLUMN "amlStatus",
DROP COLUMN "depositAddress",
DROP COLUMN "depositCoinId",
DROP COLUMN "depositExtraAddress",
DROP COLUMN "depositNetwork",
DROP COLUMN "derivationIndex",
DROP COLUMN "exchange",
DROP COLUMN "hdWalletAccountId",
DROP COLUMN "isPartnerTransaction",
DROP COLUMN "partnerId",
DROP COLUMN "partnerSharePercent",
DROP COLUMN "payoutAddress",
DROP COLUMN "payoutCoinId",
DROP COLUMN "payoutExtraAddress",
DROP COLUMN "payoutNetwork",
DROP COLUMN "profitPercent",
DROP COLUMN "userId",
ADD COLUMN     "depositCoinCode" TEXT NOT NULL,
ADD COLUMN     "depositNetworkId" INTEGER,
ADD COLUMN     "finalSentAmount" DECIMAL(65,30),
ADD COLUMN     "isPartner" BOOLEAN NOT NULL,
ADD COLUMN     "networkId" INTEGER,
ADD COLUMN     "ourDepositAddress" TEXT NOT NULL,
ADD COLUMN     "ourDepositAddressExtra" TEXT,
ADD COLUMN     "partnerEmail" TEXT,
ADD COLUMN     "partnerShare" DECIMAL(65,30),
ADD COLUMN     "partnerUserId" INTEGER,
ADD COLUMN     "payoutCoinCode" TEXT NOT NULL,
ADD COLUMN     "payoutNetworkId" INTEGER NOT NULL,
ADD COLUMN     "profitRate" DECIMAL(65,30),
ADD COLUMN     "recipientAddress" TEXT NOT NULL,
ADD COLUMN     "recipientAddressExtra" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "depositAmount" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "depositAmountBtc" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "payoutAmount" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "payoutAmountBtc" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "profitBtc" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "User" DROP COLUMN "name",
ADD COLUMN     "apiKey" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "partnerTxCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "unwithdrawnEarnings" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "username" TEXT,
ALTER COLUMN "email" DROP NOT NULL,
DROP COLUMN "role",
ADD COLUMN     "role" "ROLE" NOT NULL DEFAULT 'PARTNER';

-- DropTable
DROP TABLE "Deposit";

-- DropTable
DROP TABLE "HdWalletAccount";

-- DropTable
DROP TABLE "Partner";

-- DropTable
DROP TABLE "Settings";

-- DropEnum
DROP TYPE "AmlStatus";

-- DropEnum
DROP TYPE "Exchange";

-- DropEnum
DROP TYPE "Role";

-- CreateTable
CREATE TABLE "CoinNetwork" (
    "id" SERIAL NOT NULL,
    "coinCode" TEXT NOT NULL,
    "networkId" INTEGER NOT NULL,
    "depositEnabled" BOOLEAN NOT NULL DEFAULT true,
    "withdrawEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CoinNetwork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Network" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tatumEndpoint" TEXT NOT NULL,
    "requiresMemo" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Network_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "feeFloat" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "feeFixed" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "minFee" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "minDeposit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "maxDeposit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "siteOnline" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoinNetwork_coinCode_idx" ON "CoinNetwork"("coinCode");

-- CreateIndex
CREATE INDEX "CoinNetwork_networkId_idx" ON "CoinNetwork"("networkId");

-- CreateIndex
CREATE UNIQUE INDEX "CoinNetwork_coinCode_networkId_key" ON "CoinNetwork"("coinCode", "networkId");

-- CreateIndex
CREATE UNIQUE INDEX "Network_code_key" ON "Network"("code");

-- CreateIndex
CREATE INDEX "Message_fromEmail_createdAt_idx" ON "Message"("fromEmail", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_status_createdAt_idx" ON "Transaction"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_isPartner_createdAt_idx" ON "Transaction"("isPartner", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_partnerUserId_createdAt_idx" ON "Transaction"("partnerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_partnerEmail_idx" ON "Transaction"("partnerEmail");

-- CreateIndex
CREATE INDEX "Transaction_depositCoinCode_payoutCoinCode_idx" ON "Transaction"("depositCoinCode", "payoutCoinCode");

-- CreateIndex
CREATE INDEX "Transaction_payoutNetworkId_depositNetworkId_idx" ON "Transaction"("payoutNetworkId", "depositNetworkId");

-- CreateIndex
CREATE INDEX "Transaction_finishedAt_idx" ON "Transaction"("finishedAt");

-- CreateIndex
CREATE INDEX "Transaction_depositTxHash_idx" ON "Transaction"("depositTxHash");

-- CreateIndex
CREATE INDEX "Transaction_payoutTxHash_idx" ON "Transaction"("payoutTxHash");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_apiKey_key" ON "User"("apiKey");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- AddForeignKey
ALTER TABLE "CoinNetwork" ADD CONSTRAINT "CoinNetwork_coinCode_fkey" FOREIGN KEY ("coinCode") REFERENCES "Coin"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinNetwork" ADD CONSTRAINT "CoinNetwork_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "Network"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_depositCoinCode_fkey" FOREIGN KEY ("depositCoinCode") REFERENCES "Coin"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_payoutCoinCode_fkey" FOREIGN KEY ("payoutCoinCode") REFERENCES "Coin"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_payoutNetworkId_fkey" FOREIGN KEY ("payoutNetworkId") REFERENCES "Network"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_depositNetworkId_fkey" FOREIGN KEY ("depositNetworkId") REFERENCES "Network"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_partnerUserId_fkey" FOREIGN KEY ("partnerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "Network"("id") ON DELETE SET NULL ON UPDATE CASCADE;
