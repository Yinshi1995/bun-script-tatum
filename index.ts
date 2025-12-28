// index.ts (Bun + TypeScript + Prisma)
//
// Flow (generic HD chains):
// 0) Load Network from DB by NETWORK_CODE
// 1) getOrCreate master wallet (xpub+mnemonicEncrypted) per network
// 2) allocate next derivation index atomically from DB
// 3) derive deposit address from xpub + index via Tatum v3 (/v3/{tatumV3Path}/address/...)
// 4) optionally read balance (network-specific)
// 5) create ADDRESS_EVENT subscription via Tatum v4 using network.tatumChain

import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

type HdWallet = { xpub: string; mnemonic: string };
type AddressResp = { address: string };
type V4SubscriptionResp = { data?: { id?: string } } | { id?: string } | any;

const prisma = new PrismaClient();

const TATUM_API_KEY = mustGetEnv("TATUM_API_KEY");
const WEBHOOK_URL = mustGetEnv("WEBHOOK_URL");
const MNEMONIC_ENC_KEY = mustGetEnv("MNEMONIC_ENC_KEY");

const NET_TYPE = "mainnet";
const NETWORK_CODE = process.env.NETWORK_CODE ?? "bitcoin";
const TATUM_BASE_URL = process.env.TATUM_BASE_URL ?? "https://api.tatum.io";

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

// ===== Encryption (AES-256-GCM) =====

function key32FromEnv(): Buffer {
  const raw = MNEMONIC_ENC_KEY.trim();
  const isHex = /^[0-9a-fA-F]+$/.test(raw) && raw.length >= 64;
  const buf = isHex ? Buffer.from(raw.slice(0, 64), "hex") : Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(
      `MNEMONIC_ENC_KEY must be 32 bytes (got ${buf.length}). Use 32-byte base64 or 64 hex chars.`
    );
  }
  return buf;
}

function encryptMnemonic(plain: string): string {
  const key = key32FromEnv();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

// ===== DB helpers =====

async function getNetworkOrThrow(code: string) {
  const network = await prisma.network.findUnique({
    where: { code },
    select: { id: true, code: true, tatumV3Path: true, tatumChain: true, isActive: true },
  });

  if (!network) throw new Error(`Network not found in DB by code="${code}"`);
  if (!network.isActive) throw new Error(`Network "${code}" is not active`);

  if (!network.tatumV3Path) {
    throw new Error(`Network "${code}" has no tatumV3Path set in DB (required for /v3/{path}/...)`);
  }
  if (!network.tatumChain) {
    throw new Error(`Network "${code}" has no tatumChain set in DB (required for v4 subscriptions)`);
  }

  return network;
}

/**
 * Tatum v3: generate HD wallet for chain
 * Endpoint: /v3/{tatumV3Path}/wallet
 */
async function generateHdWallet(v3Path: string): Promise<HdWallet> {
  return tatum<HdWallet>(`/v3/${v3Path}/wallet`, { method: "GET" });
}

/**
 * Tatum v3: derive address for chain
 * Endpoint: /v3/{tatumV3Path}/address/{xpub}/{index}
 */
async function deriveAddress(v3Path: string, xpub: string, index: number): Promise<string> {
  const r = await tatum<AddressResp>(
    `/v3/${v3Path}/address/${encodeURIComponent(xpub)}/${index}`,
    { method: "GET" }
  );
  return r.address;
}

/**
 * Ensure exactly one master wallet per network.
 * Upsert: if record exists (maybe partial) -> fill missing.
 */
async function getOrCreateMasterWallet(networkId: number, v3Path: string) {
  const existing = await prisma.tatumWallet.findUnique({
    where: { networkId },
    select: { id: true, xpub: true, mnemonicEncrypted: true, nextDerivationIndex: true },
  });

  if (existing?.xpub && existing?.mnemonicEncrypted) return existing;

  const w = await generateHdWallet(v3Path);
  const mnemonicEncrypted = encryptMnemonic(w.mnemonic);

  return prisma.tatumWallet.upsert({
    where: { networkId },
    create: {
      networkId,
      xpub: w.xpub,
      mnemonicEncrypted,
      nextDerivationIndex: 0,
      isActive: true,
    },
    update: {
      xpub: existing?.xpub ?? w.xpub,
      mnemonicEncrypted: existing?.mnemonicEncrypted ?? mnemonicEncrypted,
      isActive: true,
    },
    select: { id: true, xpub: true, mnemonicEncrypted: true, nextDerivationIndex: true },
  });
}

/**
 * Atomically allocates next derivation index from DB.
 */
async function allocateDerivationIndex(networkId: number): Promise<number> {
  // Ensure row exists (throws if missing)
  await prisma.tatumWallet.update({ where: { networkId }, data: {} });

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

// ===== v4 subscription =====

async function subscribeAddressEvent(chain: string, address: string, webhookUrl: string): Promise<string | null> {
  const body = {
    type: "ADDRESS_EVENT",
    attr: { address, chain, url: webhookUrl },
  };

  const resp = await tatum<V4SubscriptionResp>(`/v4/subscription?type=${NET_TYPE}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  return resp?.data?.id ?? resp?.id ?? null;
}

// ===== balances (network-specific, best-effort) =====
//
// If you don't need balances now — you can delete this section.
// Важно: у разных сетей разные эндпоинты и форматы ответа.

async function getBalanceBestEffort(v3Path: string, address: string): Promise<string> {
  // Most UTXO chains in Tatum v3 use:
  // /v3/{chain}/address/balance/{address}
  // ETH-like uses:
  // /v3/ethereum/account/balance/{address}
  // TRON uses:
  // /v3/tron/account/{address}
  //
  // We do minimal switch based on v3Path.

  if (v3Path === "ethereum") {
    const r = await tatum<{ balance: string }>(`/v3/ethereum/account/balance/${address}`, { method: "GET" });
    return r.balance;
  }

  if (v3Path === "tron") {
    // Tron account endpoint returns { balance: string } or similar; keep defensive
    const r = await tatum<any>(`/v3/tron/account/${address}`, { method: "GET" });
    // some responses: { balance: "123" } (in SUN?) depends; we just stringify something sensible
    if (typeof r?.balance === "string") return r.balance;
    if (typeof r?.balance === "number") return String(r.balance);
    return JSON.stringify(r);
  }

  // UTXO-like fallback (bitcoin, litecoin, dogecoin, bcash, etc.)
  try {
    const r = await tatum<{ incoming?: string; outgoing?: string; balance?: string }>(
      `/v3/${v3Path}/address/balance/${address}`,
      { method: "GET" }
    );
    // Many Tatum balance endpoints return { incoming, outgoing } not direct balance
    if (typeof r?.balance === "string") return r.balance;

    const incoming = typeof r?.incoming === "string" ? r.incoming : null;
    const outgoing = typeof r?.outgoing === "string" ? r.outgoing : null;
    if (incoming != null && outgoing != null) {
      // Compute balance = incoming - outgoing (decimal strings). Use BigInt satoshis? Not safe w/ decimals.
      // We return both for safety.
      return `incoming=${incoming}, outgoing=${outgoing}`;
    }

    return JSON.stringify(r);
  } catch (e) {
    return "N/A";
  }
}

async function main() {
  const network = await getNetworkOrThrow(NETWORK_CODE);

  const master = await getOrCreateMasterWallet(network.id, network.tatumV3Path || "");
  if (!master.xpub) throw new Error("Master wallet has no xpub (unexpected)");

  const depositIndex = await allocateDerivationIndex(network.id);
  const address = await deriveAddress(network.tatumV3Path || "", master.xpub, depositIndex);

  console.log("[network]", network.code);
  console.log("[tatumV3Path]", network.tatumV3Path);
  console.log("[tatumChain]", network.tatumChain);
  console.log("[masterWallet.id]", master.id);
  console.log("[masterWallet.xpub]", master.xpub);
  console.log("[deposit.index]", depositIndex);
  console.log("[deposit.address]", address);

  const bal = await getBalanceBestEffort(network.tatumV3Path || "", address);
  console.log("[deposit.balance]", bal);

  const subId = await subscribeAddressEvent(network.tatumChain || "", address, WEBHOOK_URL);
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
    console.log("Prisma disconnected.");
  });
