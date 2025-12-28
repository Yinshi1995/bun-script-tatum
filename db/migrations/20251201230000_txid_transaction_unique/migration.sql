/*
  Warnings:

  - A unique constraint covering the columns `[transactionId,txid]` on the table `Deposit` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Deposit_txid_key";

-- CreateIndex
CREATE UNIQUE INDEX "Deposit_transactionId_txid_key" ON "Deposit"("transactionId", "txid");
