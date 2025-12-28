/*
  Warnings:

  - You are about to drop the column `depositCoinCode` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `depositNetworkId` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `networkId` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `payoutCoinCode` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `payoutNetworkId` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the `NetworkEndpoint` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `updatedAt` to the `CoinNetwork` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tatumLedger` to the `Network` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `source` on the `NetworkAlias` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `payoutCoinNetworkId` to the `Transaction` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "NetworkAliasSource" AS ENUM ('WHITEBIT', 'BINANCE', 'MANUAL');

-- DropForeignKey
ALTER TABLE "NetworkEndpoint" DROP CONSTRAINT "NetworkEndpoint_networkId_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_depositCoinCode_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_depositNetworkId_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_payoutCoinCode_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_payoutNetworkId_fkey";

-- DropIndex
DROP INDEX "Transaction_depositCoinCode_payoutCoinCode_idx";

-- DropIndex
DROP INDEX "Transaction_payoutNetworkId_depositNetworkId_idx";

-- AlterTable
ALTER TABLE "Coin" ALTER COLUMN "isActive" SET DEFAULT true;

-- AlterTable
ALTER TABLE "CoinNetwork" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "decimals" INTEGER,
ADD COLUMN     "tokenContractAddress" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Network" ADD COLUMN     "tatumLedger" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "NetworkAlias" DROP COLUMN "source",
ADD COLUMN     "source" "NetworkAliasSource" NOT NULL;

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "depositCoinCode",
DROP COLUMN "depositNetworkId",
DROP COLUMN "networkId",
DROP COLUMN "payoutCoinCode",
DROP COLUMN "payoutNetworkId",
ADD COLUMN     "depositCoinNetworkId" INTEGER,
ADD COLUMN     "payoutCoinNetworkId" INTEGER NOT NULL;

-- DropTable
DROP TABLE "NetworkEndpoint";

-- DropEnum
DROP TYPE "NetworkEndpointType";

-- CreateIndex
CREATE INDEX "Coin_isActive_idx" ON "Coin"("isActive");

-- CreateIndex
CREATE INDEX "CoinNetwork_isDefault_idx" ON "CoinNetwork"("isDefault");

-- CreateIndex
CREATE INDEX "NetworkAlias_source_idx" ON "NetworkAlias"("source");

-- CreateIndex
CREATE UNIQUE INDEX "NetworkAlias_source_alias_key" ON "NetworkAlias"("source", "alias");

-- CreateIndex
CREATE INDEX "Transaction_depositCoinNetworkId_payoutCoinNetworkId_idx" ON "Transaction"("depositCoinNetworkId", "payoutCoinNetworkId");
