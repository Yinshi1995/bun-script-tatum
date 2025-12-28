/*
  Warnings:

  - You are about to drop the column `tatumEndpoint` on the `Network` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "NetworkEndpointType" AS ENUM ('JSON_RPC', 'REST', 'GRPC', 'INDEXER', 'BEACON', 'ELECTRS', 'SUBSTRATE', 'TENDERMINT_RPC', 'TENDERMINT_REST', 'ROSSETTA', 'OTHER');

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_networkId_fkey";

-- AlterTable
ALTER TABLE "CoinNetwork" ADD COLUMN     "requiresMemoOverride" BOOLEAN;

-- AlterTable
ALTER TABLE "Network" DROP COLUMN "tatumEndpoint";

-- CreateTable
CREATE TABLE "NetworkEndpoint" (
    "id" SERIAL NOT NULL,
    "networkId" INTEGER NOT NULL,
    "type" "NetworkEndpointType" NOT NULL,
    "url" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "NetworkEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetworkAlias" (
    "id" SERIAL NOT NULL,
    "networkId" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "NetworkAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NetworkEndpoint_networkId_type_idx" ON "NetworkEndpoint"("networkId", "type");

-- CreateIndex
CREATE INDEX "NetworkEndpoint_networkId_isPrimary_idx" ON "NetworkEndpoint"("networkId", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "NetworkEndpoint_networkId_type_url_key" ON "NetworkEndpoint"("networkId", "type", "url");

-- CreateIndex
CREATE INDEX "NetworkAlias_networkId_idx" ON "NetworkAlias"("networkId");

-- CreateIndex
CREATE INDEX "NetworkAlias_source_idx" ON "NetworkAlias"("source");

-- CreateIndex
CREATE UNIQUE INDEX "NetworkAlias_source_alias_key" ON "NetworkAlias"("source", "alias");

-- CreateIndex
CREATE INDEX "Network_isActive_idx" ON "Network"("isActive");

-- AddForeignKey
ALTER TABLE "NetworkEndpoint" ADD CONSTRAINT "NetworkEndpoint_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "Network"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkAlias" ADD CONSTRAINT "NetworkAlias_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "Network"("id") ON DELETE CASCADE ON UPDATE CASCADE;
