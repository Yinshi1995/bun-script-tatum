// index.ts (Bun + TypeScript + Prisma)
//
// Supports 4 deposit strategies (from DB: Network.depositAddressStrategy):
// 1) HD_XPUB              -> address = f(xpub, index)
// 2) WALLET_SINGLE_ADDR   -> one master address per network (derived once, then reused)
// 3) WALLET_PER_DEPOSIT   -> new wallet/address per deposit (NOT persisted in this minimal script)
// 4) SHARED_ADDR_WITH_TAG -> one master address + unique tag/memo/paymentId (atomically)
//
// Fixes vs previous version:
// - v3 "wallet" endpoint is NOT uniform: XRP uses /v3/xrp/account (not /wallet). Stellar commonly uses /account too.
// - v4 subscription: skip if tatumChain is null OR not in v4 allowlist.
// - Minor: EVM balance endpoint isn't universal; keep best-effort but don't pretend it's correct for all EVMs.

import { PrismaClient, DepositAddressStrategy } from "@prisma/client";
import crypto from "crypto";

type HdWallet = { xpub: string; mnemonic: string };
type AddressResp = { address: string };
type V4SubscriptionResp = { data?: { id?: string } } | { id?: string } | any;

// Wallet shapes for non-HD chains (Algorand returns secret+mnemonic+address; XRP returns address+secret)
type AnyWallet = {
  xpub?: string;
  mnemonic?: string;
  address?: string;
  secret?: string;
  privateKey?: string;
};

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

function encryptSecret(plain: string): string {
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
    select: {
      id: true,
      code: true,
      name: true,
      tatumV3Path: true,
      tatumChain: true,
      tatumLedger: true,
      requiresMemo: true,
      depositAddressStrategy: true,
      isActive: true,
    },
  });

  if (!network) throw new Error(`Network not found in DB by code="${code}"`);
  if (!network.isActive) throw new Error(`Network "${code}" is not active`);
  if (!network.tatumV3Path) {
    throw new Error(`Network "${code}" has no tatumV3Path set in DB (required for /v3/{path}/...)`);
  }

  return network;
}

// ===== v3 wallet endpoint differences =====
//
// Some chains do not have /v3/{path}/wallet.
// Example: XRP uses /v3/xrp/account (returns { address, secret }).
// Stellar may also use /v3/stellar/account in many integrations.

const V3_WALLET_ENDPOINT_BY_PATH: Record<string, "wallet" | "account"> = {
  // defaults to "wallet" if not present
  xrp: "account",
  stellar: "account",
};

function v3WalletEndpoint(v3Path: string): "wallet" | "account" {
  return V3_WALLET_ENDPOINT_BY_PATH[v3Path] ?? "wallet";
}

/**
 * Tatum v3: generate wallet for chain
 * Endpoint depends on chain:
 * - /v3/{path}/wallet  (many chains, HD often returns {xpub, mnemonic})
 * - /v3/{path}/account (XRP returns {address, secret}; Stellar often uses account)
 */
async function generateWallet(v3Path: string): Promise<AnyWallet> {
  const ep = v3WalletEndpoint(v3Path);
  return tatum<AnyWallet>(`/v3/${v3Path}/${ep}`, { method: "GET" });
}

/**
 * Tatum v3: derive address for chain (HD)
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
 * Ensure master row exists.
 * Seed already upserts it, but keep defensive.
 */
async function ensureMasterRow(networkId: number) {
  await prisma.tatumWallet.upsert({
    where: { networkId },
    create: {
      networkId,
      xpub: null,
      address: null,
      mnemonicEncrypted: null,
      nextDerivationIndex: 0,
      nextDepositTag: 1,
      isActive: true,
    },
    update: { isActive: true },
    select: { id: true },
  });
}

/**
 * HD master: ensure xpub+mnemonicEncrypted.
 */
async function getOrCreateHdMaster(networkId: number, v3Path: string) {
  await ensureMasterRow(networkId);

  const existing = await prisma.tatumWallet.findUnique({
    where: { networkId },
    select: { id: true, xpub: true, mnemonicEncrypted: true, nextDerivationIndex: true },
  });

  if (existing?.xpub && existing?.mnemonicEncrypted) return existing;

  const w = (await generateWallet(v3Path)) as HdWallet;
  if (!w?.xpub || !w?.mnemonic) {
    throw new Error(`Wallet endpoint for v3Path="${v3Path}" did not return xpub+mnemonic`);
  }
  const mnemonicEncrypted = encryptSecret(w.mnemonic);

  return prisma.tatumWallet.update({
    where: { networkId },
    data: {
      xpub: existing?.xpub ?? w.xpub,
      mnemonicEncrypted: existing?.mnemonicEncrypted ?? mnemonicEncrypted,
      isActive: true,
    },
    select: { id: true, xpub: true, mnemonicEncrypted: true, nextDerivationIndex: true },
  });
}

/**
 * Single/shared master address:
 * - Ensure master has address (derive it from xpub index=0 if needed, or use wallet.address if provided).
 */
async function getOrCreateMasterAddress(networkId: number, v3Path: string) {
  await ensureMasterRow(networkId);

  const existing = await prisma.tatumWallet.findUnique({
    where: { networkId },
    select: { id: true, xpub: true, address: true, mnemonicEncrypted: true },
  });

  if (existing?.address) return existing;

  const w = await generateWallet(v3Path);

  // If wallet/account directly provides address (XRP, Algorand-like), use it
  if (w?.address && (w?.mnemonic || w?.secret || w?.privateKey || v3WalletEndpoint(v3Path) === "account")) {
    const secretToStore = w.mnemonic ?? w.secret ?? w.privateKey ?? "";
    const enc = secretToStore ? encryptSecret(secretToStore) : null;

    return prisma.tatumWallet.update({
      where: { networkId },
      data: {
        address: w.address,
        mnemonicEncrypted: existing?.mnemonicEncrypted ?? enc,
        isActive: true,
      },
      select: { id: true, xpub: true, address: true, mnemonicEncrypted: true },
    });
  }

  // Otherwise assume HD wallet response, derive address at index=0
  if (!w?.xpub || !w?.mnemonic) {
    throw new Error(
      `Cannot obtain master address for v3Path="${v3Path}": response lacks address and lacks xpub+mnemonic`
    );
  }

  const addr = await deriveAddress(v3Path, w.xpub, 0);
  const mnemonicEncrypted = encryptSecret(w.mnemonic);

  return prisma.tatumWallet.update({
    where: { networkId },
    data: {
      xpub: existing?.xpub ?? w.xpub,
      address: addr,
      mnemonicEncrypted: existing?.mnemonicEncrypted ?? mnemonicEncrypted,
      isActive: true,
    },
    select: { id: true, xpub: true, address: true, mnemonicEncrypted: true },
  });
}

/**
 * Atomically allocates next derivation index from DB.
 */
async function allocateDerivationIndex(networkId: number): Promise<number> {
  await ensureMasterRow(networkId);

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

/**
 * Atomically allocates next deposit tag/memo (SHARED_ADDR_WITH_TAG).
 */
async function allocateDepositTag(networkId: number): Promise<number> {
  await ensureMasterRow(networkId);

  const rows = await prisma.$queryRaw<{ tag: number }[]>`
    UPDATE "TatumWallet"
    SET "nextDepositTag" = "nextDepositTag" + 1
    WHERE "networkId" = ${networkId}
    RETURNING ("nextDepositTag" - 1) AS "tag"
  `;

  const tag = rows?.[0]?.tag;
  if (typeof tag !== "number") throw new Error("Failed to allocate deposit tag");
  return tag;
}

// ===== v4 subscription =====

// Minimal v4 allowlist (based on the validation error you saw).
// You can extend this anytime safely.
const V4_SUPPORTED_CHAINS = new Set<string>([
  "bitcoin-mainnet",
  "ethereum-mainnet",
  "bsc-mainnet",
  "polygon-mainnet",
  "base-mainnet",
  "optimism-mainnet",
  "tron-mainnet",
  "ripple-mainnet",
  "ripple-testnet",
  "solana-mainnet",
  "solana-devnet",
  "stellar-mainnet",
  "stellar-testnet",
  "litecoin-core-mainnet",
  "litecoin-core-testnet",
]);

async function subscribeAddressEvent(
  chain: string,
  address: string,
  webhookUrl: string
): Promise<string | null> {
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

// ===== balances (best-effort, minimal switches) =====

async function getBalanceBestEffort(v3Path: string, address: string): Promise<string> {
  // ETH-like (best-effort only; different chains can have different endpoints)
  if (
    v3Path === "ethereum" ||
    v3Path === "bsc" ||
    v3Path === "polygon" ||
    v3Path === "base" ||
    v3Path === "optimism"
  ) {
    try {
      // This is definitely correct for ethereum; may not be for every EVM in v3.
      const r = await tatum<{ balance: string }>(`/v3/ethereum/account/balance/${address}`, { method: "GET" });
      return r.balance;
    } catch {
      return "N/A";
    }
  }

  // TRON
  if (v3Path === "tron") {
    try {
      const r = await tatum<any>(`/v3/tron/account/${address}`, { method: "GET" });
      if (typeof r?.balance === "string") return r.balance;
      if (typeof r?.balance === "number") return String(r.balance);
      return JSON.stringify(r);
    } catch {
      return "N/A";
    }
  }

  // Algorand
  if (v3Path === "algorand") {
    try {
      const r = await tatum<any>(`/v3/algorand/account/${address}`, { method: "GET" });
      if (typeof r?.balance === "number") return String(r.balance);
      if (typeof r?.balance === "string") return r.balance;
      return JSON.stringify(r);
    } catch {
      return "N/A";
    }
  }

  // XRP
  if (v3Path === "xrp") {
    try {
      const r = await tatum<any>(`/v3/xrp/account/${address}`, { method: "GET" });
      if (typeof r?.balance === "string") return r.balance;
      if (typeof r?.balance === "number") return String(r.balance);
      return JSON.stringify(r);
    } catch {
      return "N/A";
    }
  }

  // Stellar
  if (v3Path === "stellar") {
    try {
      const r = await tatum<any>(`/v3/stellar/account/${address}`, { method: "GET" });
      if (r?.balances) return JSON.stringify(r.balances);
      return JSON.stringify(r);
    } catch {
      return "N/A";
    }
  }

  // UTXO-like fallback (bitcoin, litecoin, dogecoin, bcash, etc.)
  try {
    const r = await tatum<{ incoming?: string; outgoing?: string; balance?: string }>(
      `/v3/${v3Path}/address/balance/${address}`,
      { method: "GET" }
    );
    if (typeof r?.balance === "string") return r.balance;

    const incoming = typeof r?.incoming === "string" ? r.incoming : null;
    const outgoing = typeof r?.outgoing === "string" ? r.outgoing : null;
    if (incoming != null && outgoing != null) return `incoming=${incoming}, outgoing=${outgoing}`;

    return JSON.stringify(r);
  } catch {
    return "N/A";
  }
}

// ===== Deposit allocation for all 4 strategies =====

type DepositTarget = {
  address: string;
  addressExtra?: string; // memo/tag
  derivationIndex?: number;
  strategy: DepositAddressStrategy;
};

async function allocateDepositTarget(network: {
  id: number;
  tatumV3Path: string;
  depositAddressStrategy: DepositAddressStrategy;
  requiresMemo: boolean;
}): Promise<DepositTarget> {
  const v3Path = network.tatumV3Path;

  switch (network.depositAddressStrategy) {
    case DepositAddressStrategy.HD_XPUB: {
      const master = await getOrCreateHdMaster(network.id, v3Path);
      if (!master.xpub) throw new Error("HD master has no xpub (unexpected)");
      const idx = await allocateDerivationIndex(network.id);
      const address = await deriveAddress(v3Path, master.xpub, idx);
      return { address, derivationIndex: idx, strategy: network.depositAddressStrategy };
    }

    case DepositAddressStrategy.WALLET_SINGLE_ADDR: {
      const master = await getOrCreateMasterAddress(network.id, v3Path);
      if (!master.address) throw new Error("Single-addr master has no address (unexpected)");
      return { address: master.address, strategy: network.depositAddressStrategy };
    }

    case DepositAddressStrategy.WALLET_PER_DEPOSIT: {
      // Minimal implementation: generate a fresh wallet each time.
      // IMPORTANT: for production you should persist secret/mnemonic in a per-deposit table.
      const w = await generateWallet(v3Path);

      let address = w?.address;
      if (!address && w?.xpub) {
        // fallback: if it returned HD wallet, just derive index=0 (still a "new wallet", because mnemonic is new)
        address = await deriveAddress(v3Path, w.xpub, 0);
      }
      if (!address) {
        throw new Error(`WALLET_PER_DEPOSIT: cannot get address from wallet for v3Path="${v3Path}"`);
      }

      return { address, strategy: network.depositAddressStrategy };
    }

    case DepositAddressStrategy.SHARED_ADDR_WITH_TAG: {
      // master shared address + unique tag/memo
      const master = await getOrCreateMasterAddress(network.id, v3Path);
      if (!master.address) throw new Error("Shared-addr master has no address (unexpected)");

      const tag = await allocateDepositTag(network.id);
      const addressExtra = String(tag);

      return { address: master.address, addressExtra, strategy: network.depositAddressStrategy };
    }

    default: {
      const _exhaustive: never = network.depositAddressStrategy as never;
      throw new Error(`Unsupported depositAddressStrategy: ${String(_exhaustive)}`);
    }
  }
}

async function main() {
  const network = await getNetworkOrThrow(NETWORK_CODE);

  const dep = await allocateDepositTarget({
    id: network.id,
    tatumV3Path: network.tatumV3Path!,
    depositAddressStrategy: network.depositAddressStrategy,
    requiresMemo: network.requiresMemo,
  });

  console.log("[network]", network.code);
  console.log("[name]", network.name);
  console.log("[tatumLedger]", network.tatumLedger);
  console.log("[tatumV3Path]", network.tatumV3Path);
  console.log("[tatumChain]", network.tatumChain ?? "null");
  console.log("[strategy]", dep.strategy);

  if (dep.derivationIndex != null) console.log("[deposit.index]", dep.derivationIndex);
  console.log("[deposit.address]", dep.address);
  if (dep.addressExtra) console.log("[deposit.addressExtra]", dep.addressExtra);

  const bal = await getBalanceBestEffort(network.tatumV3Path!, dep.address);
  console.log("[deposit.balance]", bal);

  // v4 subscription: best-effort
  let subId: string | null = null;

  if (!network.tatumChain) {
    console.log("[subscription] skipped (network.tatumChain is null)");
  } else if (!V4_SUPPORTED_CHAINS.has(network.tatumChain)) {
    console.log("[subscription] skipped (chain not supported by v4):", network.tatumChain);
  } else {
    subId = await subscribeAddressEvent(network.tatumChain, dep.address, WEBHOOK_URL);
    console.log("[subscription.id]", subId);
  }

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
