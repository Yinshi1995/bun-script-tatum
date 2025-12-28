-- CreateEnum
CREATE TYPE "AmlStatus" AS ENUM ('NOT_REQUESTED', 'PENDING', 'PASSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Exchange" AS ENUM ('NONE', 'KUCOIN', 'WHITEBIT');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "amlStatus" "AmlStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
ADD COLUMN     "derivationIndex" INTEGER,
ADD COLUMN     "exchange" "Exchange" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "hdWalletAccountId" INTEGER;

-- CreateTable
CREATE TABLE "HdWalletAccount" (
    "id" SERIAL NOT NULL,
    "blockchain" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "xpub" TEXT NOT NULL,
    "nextDerivationIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HdWalletAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deposit" (
    "id" SERIAL NOT NULL,
    "transactionId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "txid" TEXT NOT NULL,
    "amount" DECIMAL(36,18) NOT NULL,
    "confirmations" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Deposit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HdWalletAccount_xpub_key" ON "HdWalletAccount"("xpub");

-- CreateIndex
CREATE UNIQUE INDEX "Deposit_txid_key" ON "Deposit"("txid");

-- CreateIndex
CREATE INDEX "Deposit_address_idx" ON "Deposit"("address");

-- CreateIndex
CREATE INDEX "Deposit_txid_idx" ON "Deposit"("txid");

-- CreateIndex
CREATE INDEX "Transaction_depositAddress_idx" ON "Transaction"("depositAddress");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_hdWalletAccountId_fkey" FOREIGN KEY ("hdWalletAccountId") REFERENCES "HdWalletAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
