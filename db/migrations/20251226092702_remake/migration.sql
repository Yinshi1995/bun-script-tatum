/*
  Warnings:

  - You are about to drop the `Message` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `NetworkAlias` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "TatumProtocol" AS ENUM ('JSON_RPC', 'REST', 'GRPC', 'INDEXER', 'BEACON', 'ELECTRS', 'ROSSETTA', 'SUBSTRATE', 'TENDERMINT_RPC', 'TENDERMINT_REST', 'HORIZON', 'SOROBAN', 'TON_V2_HTTP', 'TON_V3_INDEXER');

-- CreateEnum
CREATE TYPE "TatumEndpointRole" AS ENUM ('DEPOSIT', 'INDEXER', 'OTHER');

-- DropForeignKey
ALTER TABLE "NetworkAlias" DROP CONSTRAINT "NetworkAlias_networkId_fkey";

-- DropTable
DROP TABLE "Message";

-- DropTable
DROP TABLE "NetworkAlias";

-- DropEnum
DROP TYPE "NetworkAliasSource";

-- CreateTable
CREATE TABLE "TatumEndpoint" (
    "id" SERIAL NOT NULL,
    "networkId" INTEGER NOT NULL,
    "role" "TatumEndpointRole" NOT NULL,
    "protocol" "TatumProtocol" NOT NULL,
    "name" TEXT,
    "url" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TatumEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TatumEndpoint_networkId_role_isActive_idx" ON "TatumEndpoint"("networkId", "role", "isActive");

-- CreateIndex
CREATE INDEX "TatumEndpoint_networkId_protocol_isActive_idx" ON "TatumEndpoint"("networkId", "protocol", "isActive");

-- CreateIndex
CREATE INDEX "TatumEndpoint_isDefault_idx" ON "TatumEndpoint"("isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "TatumEndpoint_networkId_protocol_name_key" ON "TatumEndpoint"("networkId", "protocol", "name");

-- CreateIndex
CREATE INDEX "Network_tatumLedger_idx" ON "Network"("tatumLedger");

-- AddForeignKey
ALTER TABLE "TatumEndpoint" ADD CONSTRAINT "TatumEndpoint_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "Network"("id") ON DELETE CASCADE ON UPDATE CASCADE;
