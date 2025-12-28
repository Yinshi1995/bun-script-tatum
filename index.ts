// index.ts (Bun + TypeScript + Prisma)
//
// Flow (ETH example):
// 0) Load Network from DB (ethereum)
// 1) getOrCreate master wallet (xpub+mnemonicEncrypted) per network
// 2) allocate next derivation index atomically from DB
// 3) derive deposit address from xpub + index via Tatum v3
// 4) optionally create ADDRESS_EVENT subscription via Tatum v4

import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

type EthWallet = { xpub: string; mnemonic: string };
type EthAddressResp = { address: string };
type V4SubscriptionResp = { data?: { id?: string } } | { id?: string } | any;

const prisma = new PrismaClient();

const TATUM_API_KEY = mustGetEnv("TATUM_API_KEY");
const WEBHOOK_URL = mustGetEnv("WEBHOOK_URL");

// mainnet | testnet (v4 subscription query param)
const NET_TYPE = (process.env.TATUM_NET_TYPE ?? "mainnet") as "mainnet" | "testnet";

// Which network from DB we are using
// Example: "ethereum" (matches Network.code in your schema)
const NETWORK_CODE = process.env.NETWORK_CODE ?? "bitcoin"; // change as needed

// Base URL
const TATUM_BASE_URL = process.env.TATUM_BASE_URL ?? "https://api.tatum.io";

// Simple app-level encryption key for mnemonic at rest (recommend KMS in prod)
const MNEMONIC_ENC_KEY = mustGetEnv("MNEMONIC_ENC_KEY"); // 32 bytes in hex/base64 (см. ниже)

function mustGetEnv(k: string): string {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env var: ${k}`);
  return v;
}

async function tatum<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${TATUM_BASE_URL}${path}`, {
    ...init,
    headers: {
      "x-api-key": TATUM_API_KEY,
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`[tatum] ${res.status} ${res.statusText} for ${path}\n${text}`);
  }

  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    return (await res.text()) as any as T;
  }
  return (await res.json()) as T;
}

// ===== Tatum v3 ETH helpers (как у тебя) =====

async function generateEthWallet(): Promise<EthWallet> {
  return tatum<EthWallet>("/v3/ethereum/wallet", { method: "GET" });
}

async function deriveEthAddress(xpub: string, index: number): Promise<string> {
  const r = await tatum<EthAddressResp>(
    `/v3/ethereum/address/${encodeURIComponent(xpub)}/${index}`,
    { method: "GET" }
  );
  return r.address;
}

async function getEthBalance(address: string): Promise<string> {
  const r = await tatum<{ balance: string }>(`/v3/ethereum/account/balance/${address}`, {
    method: "GET",
  });
  return r.balance;
}

async function subscribeAddressEvent(address: string, webhookUrl: string): Promise<string | null> {
  const body = {
    type: "ADDRESS_EVENT",
    attr: { address, chain: "ETH", url: webhookUrl },
  };

  const resp = await tatum<V4SubscriptionResp>(`/v4/subscription?type=${NET_TYPE}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  return resp?.data?.id ?? resp?.id ?? null;
}

// ===== Encryption (mnemonic at rest) =====
//
// MNEMONIC_ENC_KEY: лучше 32 байта (AES-256-GCM).
// Удобно хранить как base64 или hex. Ниже поддержка и того и другого.

function key32FromEnv(): Buffer {
  const raw = MNEMONIC_ENC_KEY.trim();
  const isHex = /^[0-9a-fA-F]+$/.test(raw) && raw.length >= 64;
  const buf = isHex ? Buffer.from(raw.slice(0, 64), "hex") : Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(`MNEMONIC_ENC_KEY must be 32 bytes (got ${buf.length}). Use 32-byte base64 or 64 hex chars.`);
  }
  return buf;
}

function encryptMnemonic(plain: string): string {
  const key = key32FromEnv();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // store as: base64(iv).base64(tag).base64(ciphertext)
  return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

// ===== DB logic we discussed =====

async function getNetworkOrThrow(code: string) {
  const network = await prisma.network.findUnique({
    where: { code },
    select: { id: true, code: true, tatumV3Path: true, tatumChain: true, isActive: true },
  });
  if (!network) throw new Error(`Network not found in DB by code="${code}"`);
  if (!network.isActive) throw new Error(`Network "${code}" is not active`);
  return network;
}

/**
 * Ensure exactly one master wallet per network.
 * If absent: generate via Tatum and persist (xpub + mnemonicEncrypted).
 */
async function getOrCreateEthMasterWallet(networkId: number) {
  // 1) Быстро проверить, если уже есть полный кошелек — вернуть
  const existing = await prisma.tatumWallet.findUnique({
    where: { networkId },
    select: { id: true, xpub: true, mnemonicEncrypted: true, nextDerivationIndex: true },
  });
  if (existing?.xpub && existing?.mnemonicEncrypted) return existing;

  // 2) Сгенерить новый (нужно только если нет/неполный)
  const w = await generateEthWallet();
  const mnemonicEncrypted = encryptMnemonic(w.mnemonic);

  // 3) Upsert: если запись есть — обновим пустые поля; если нет — создадим
  return await prisma.tatumWallet.upsert({
    where: { networkId },
    create: {
      networkId,
      xpub: w.xpub,
      mnemonicEncrypted,
      nextDerivationIndex: 0,
      isActive: true,
    },
    update: {
      // Обновляем только если было пусто — безопасно
      xpub: existing?.xpub ?? w.xpub,
      mnemonicEncrypted: existing?.mnemonicEncrypted ?? mnemonicEncrypted,
      isActive: true,
    },
    select: { id: true, xpub: true, mnemonicEncrypted: true, nextDerivationIndex: true },
  });
}


/**
 * Atomically allocates the next derivation index (and increments in DB).
 * This avoids duplicates under concurrency.
 */
async function allocateDerivationIndex(networkId: number): Promise<number> {
  // Ensure row exists
  await prisma.tatumWallet.update({
    where: { networkId },
    data: {}, // no-op, but will throw if missing
  });

  const rows = await prisma.$queryRaw<{ idx: number }[]>`
    UPDATE "TatumWallet"
    SET "nextDerivationIndex" = "nextDerivationIndex" + 1
    WHERE "networkId" = ${networkId}
    RETURNING ("nextDerivationIndex" - 1) AS "idx"
  `;
  const idx = rows?.[0]?.idx;
  if (typeof idx !== "number") throw new Error("Failed to allocate derivation index");
  return idx;
}

async function main() {
  const network = await getNetworkOrThrow(NETWORK_CODE);

  // For ETH (as in your example). For other chains you’d switch generator + derive endpoints.
  const master = await getOrCreateEthMasterWallet(network.id);
  if (!master.xpub) throw new Error("Master wallet has no xpub (unexpected)");

  // Allocate deposit index atomically
  const depositIndex = await allocateDerivationIndex(network.id);

  // Derive deposit address from xpub + allocated index
  const address = await deriveEthAddress(master.xpub, depositIndex);

  console.log("[network]", network.code);
  console.log("[masterWallet.id]", master.id);
  console.log("[masterWallet.xpub]", master.xpub);
  console.log("[deposit.index]", depositIndex);
  console.log("[deposit.address]", address);

  // Optional checks
  const bal = await getEthBalance(address);
  console.log("[deposit.balance]", bal);

  // Subscription per deposit address (recommended if you want webhook on each deposit address)
  const subId = await subscribeAddressEvent(address, WEBHOOK_URL);
  console.log("[subscription.id]", subId);

  console.log("\nDone.");
}

await main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('Prisma disconnected.');
  });
