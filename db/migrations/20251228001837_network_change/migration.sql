/*
  Warnings:

  - A unique constraint covering the columns `[tatumSubscriptionId]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "TatumSubscriptionType" AS ENUM ('ADDRESS_EVENT', 'ADDRESS_TRANSACTION', 'CONTRACT_ADDRESS_LOG_EVENT', 'CONTRACT_ADDRESS_TX_EVENT', 'INCOMING_NATIVE_TX', 'OUTGOING_NATIVE_TX', 'INCOMING_TOKEN_TX', 'OUTGOING_TOKEN_TX');

-- AlterTable
ALTER TABLE "Network" ADD COLUMN     "tatumChain" TEXT,
ADD COLUMN     "tatumV3Path" TEXT;

-- AlterTable
ALTER TABLE "Setting" ADD COLUMN     "webhookBaseUrl" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "depositDerivationIndex" INTEGER,
ADD COLUMN     "tatumChain" TEXT,
ADD COLUMN     "tatumSubscriptionId" TEXT,
ADD COLUMN     "tatumV3Path" TEXT,
ADD COLUMN     "webhookUrl" TEXT;

-- CreateTable
CREATE TABLE "TatumWallet" (
    "id" SERIAL NOT NULL,
    "networkId" INTEGER NOT NULL,
    "xpub" TEXT,
    "address" TEXT,
    "mnemonicEncrypted" TEXT,
    "nextDerivationIndex" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TatumWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TatumSubscription" (
    "id" TEXT NOT NULL,
    "type" "TatumSubscriptionType" NOT NULL,
    "chain" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "networkId" INTEGER,
    "transactionId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TatumSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TatumWallet_networkId_key" ON "TatumWallet"("networkId");

-- CreateIndex
CREATE INDEX "TatumWallet_isActive_idx" ON "TatumWallet"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TatumSubscription_transactionId_key" ON "TatumSubscription"("transactionId");

-- CreateIndex
CREATE INDEX "TatumSubscription_chain_idx" ON "TatumSubscription"("chain");

-- CreateIndex
CREATE INDEX "TatumSubscription_address_idx" ON "TatumSubscription"("address");

-- CreateIndex
CREATE INDEX "TatumSubscription_isActive_idx" ON "TatumSubscription"("isActive");

-- CreateIndex
CREATE INDEX "Network_tatumChain_idx" ON "Network"("tatumChain");

-- CreateIndex
CREATE INDEX "Network_tatumV3Path_idx" ON "Network"("tatumV3Path");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_tatumSubscriptionId_key" ON "Transaction"("tatumSubscriptionId");

-- CreateIndex
CREATE INDEX "Transaction_tatumChain_idx" ON "Transaction"("tatumChain");

-- AddForeignKey
ALTER TABLE "TatumWallet" ADD CONSTRAINT "TatumWallet_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "Network"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TatumSubscription" ADD CONSTRAINT "TatumSubscription_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "Network"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TatumSubscription" ADD CONSTRAINT "TatumSubscription_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
