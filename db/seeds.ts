// db/seed.ts
import db, { Prisma, ROLE, TatumEndpointRole, TatumProtocol } from "db"
import { SecurePassword } from "@blitzjs/auth/secure-password"

type SeedEndpoint = {
  role: TatumEndpointRole
  protocol: TatumProtocol
  url: string
  name?: string | null
  isDefault?: boolean
  isActive?: boolean
}

type SeedNetwork = {
  code: string
  name: string

  // legacy/внутренний
  tatumLedger: string

  // ✅ /v4/subscription attr.chain
  tatumChain?: string | null

  // ✅ /v3/{tatumV3Path}/...
  tatumV3Path?: string | null

  requiresMemo?: boolean
  isActive?: boolean
  endpoints: SeedEndpoint[]
}

export default async function main() {
  console.log("🌱 Seeding database...")

  // ADMIN
  const adminPassword = await SecurePassword.hash(process.env.SEED_ADMIN_PASSWORD || "admin123")
  await db.user.upsert({
    where: { email: "admin@example.com" },
    create: {
      email: "admin@example.com",
      role: ROLE.ADMIN,
      hashedPassword: adminPassword,
      isActive: true,
    },
    update: { role: ROLE.ADMIN, isActive: true },
  })

  // PARTNER
  const partnerPassword = await SecurePassword.hash(
    process.env.SEED_PARTNER_PASSWORD || "partner123"
  )
  await db.user.upsert({
    where: { email: "partner@example.com" },
    create: {
      email: "partner@example.com",
      role: ROLE.PARTNER,
      hashedPassword: partnerPassword,
      isActive: true,
    },
    update: { role: ROLE.PARTNER, isActive: true },
  })

  // SETTINGS
  await db.setting.upsert({
    where: { id: "global" },
    create: {
      id: "global",
      feeFloat: new Prisma.Decimal("0.50"),
      feeFixed: new Prisma.Decimal("1.00"),
      minFee: new Prisma.Decimal("0.0001"),
      minDeposit: new Prisma.Decimal("0.0005"),
      maxDeposit: new Prisma.Decimal("10"),
      siteOnline: true,
      webhookBaseUrl: process.env.WEBHOOK_BASE_URL || null,
    },
    update: {
      feeFloat: new Prisma.Decimal("0.50"),
      feeFixed: new Prisma.Decimal("1.00"),
      minFee: new Prisma.Decimal("0.0001"),
      minDeposit: new Prisma.Decimal("0.0005"),
      maxDeposit: new Prisma.Decimal("10"),
      siteOnline: true,
      webhookBaseUrl: process.env.WEBHOOK_BASE_URL || null,
    },
  })

  // COINS
  const coins = [
    { code: "BTC", name: "Bitcoin" },
    { code: "ETH", name: "Ethereum" },
    { code: "USDT", name: "Tether" },
    { code: "SOL", name: "Solana" },
    { code: "LTC", name: "Litecoin" },
    { code: "BCH", name: "Bitcoin Cash" },
    { code: "DOGE", name: "Dogecoin" },
    { code: "XRP", name: "XRP" },
    { code: "XLM", name: "Stellar" },
    { code: "TRX", name: "TRON" },
  ]

  await Promise.all(
    coins.map((c) =>
      db.coin.upsert({
        where: { code: c.code },
        create: {
          code: c.code,
          name: c.name,
          iconUrl: `https://cryptoicons.org/api/icon/${c.code.toLowerCase()}/200`,
          isActive: true,
        },
        update: {
          name: c.name,
          iconUrl: `https://cryptoicons.org/api/icon/${c.code.toLowerCase()}/200`,
          isActive: true,
        },
      })
    )
  )

  const networks: SeedNetwork[] = [
    // (1) Algorand
    {
      code: "algorand",
      name: "Algorand (Mainnet)",
      tatumLedger: "ALGO",
      tatumChain: "algorand-mainnet",
      tatumV3Path: "algorand",
      endpoints: [
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.REST,
          name: "Algod",
          url: "https://algorand-mainnet-algod.gateway.tatum.io",
          isDefault: true,
        },
        {
          role: TatumEndpointRole.INDEXER,
          protocol: TatumProtocol.INDEXER,
          name: "Indexer",
          url: "https://algorand-mainnet-indexer.gateway.tatum.io",
        },
      ],
    },

    // (2) Arbitrum One
    {
      code: "arbitrum-one",
      name: "Arbitrum One (Mainnet)",
      tatumLedger: "ARBITRUM_ONE",
      // notifications часто встречаются как arb-one-mainnet
      tatumChain: "arb-one-mainnet",
      // v3 path может отличаться у татум (у них есть отдельные endpoints), если используешь v3 — проверь
      tatumV3Path: null,
      endpoints: [
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.JSON_RPC,
          url: "https://arbitrum-one-mainnet.gateway.tatum.io",
          isDefault: true,
        },
      ],
    },

    // (3) Avalanche
    {
      code: "avalanche",
      name: "Avalanche (Mainnet)",
      tatumLedger: "AVAX",
      tatumChain: "avalanche-mainnet",
      tatumV3Path: null,
      endpoints: [
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.JSON_RPC,
          name: "C-Chain",
          url: "https://avalanche-mainnet.gateway.tatum.io",
          isDefault: true,
        },
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.JSON_RPC,
          name: "P-Chain",
          url: "https://avalanche-mainnet.gateway.tatum.io/ext/bc/P",
        },
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.JSON_RPC,
          name: "X-Chain",
          url: "https://avalanche-mainnet.gateway.tatum.io/ext/bc/X",
        },
      ],
    },

    // (4) Base
    {
      code: "base",
      name: "Base (Mainnet)",
      tatumLedger: "BASE",
      tatumChain: "base-mainnet",
      tatumV3Path: null,
      endpoints: [
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.JSON_RPC,
          url: "https://base-mainnet.gateway.tatum.io",
          isDefault: true,
        },
      ],
    },

    // (5) Bitcoin
    {
      code: "bitcoin",
      name: "Bitcoin (Mainnet)",
      tatumLedger: "BTC",
      tatumChain: "bitcoin-mainnet",
      tatumV3Path: "bitcoin",
      endpoints: [
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.JSON_RPC,
          url: "https://bitcoin-mainnet.gateway.tatum.io",
          isDefault: true,
        },
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.REST,
          name: "REST",
          url: "https://bitcoin-mainnet.gateway.tatum.io/rest",
        },
        {
          role: TatumEndpointRole.INDEXER,
          protocol: TatumProtocol.ELECTRS,
          name: "Electrs",
          url: "https://bitcoin-mainnet-electrs.gateway.tatum.io",
        },
      ],
    },

    // (6) BSC
    {
      code: "bsc",
      name: "Binance Smart Chain (Mainnet)",
      tatumLedger: "BSC",
      tatumChain: "bsc-mainnet",
      tatumV3Path: null,
      endpoints: [
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.JSON_RPC,
          url: "https://bsc-mainnet.gateway.tatum.io",
          isDefault: true,
        },
      ],
    },

    // (7) Celo
    {
      code: "celo",
      name: "Celo (Mainnet)",
      tatumLedger: "CELO",
      tatumChain: "celo-mainnet",
      tatumV3Path: null,
      endpoints: [
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.JSON_RPC,
          url: "https://celo-mainnet.gateway.tatum.io",
          isDefault: true,
        },
      ],
    },

    // (8) Dogecoin
    {
      code: "dogecoin",
      name: "Dogecoin (Mainnet)",
      tatumLedger: "DOGE",
      tatumChain: "dogecoin-mainnet",
      tatumV3Path: "dogecoin",
      endpoints: [
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.JSON_RPC,
          url: "https://dogecoin-mainnet.gateway.tatum.io",
          isDefault: true,
        },
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.REST,
          url: "https://dogecoin-mainnet.gateway.tatum.io/rest",
        },
      ],
    },

    // (9) EOS
    {
      code: "eos",
      name: "EOS (Mainnet)",
      tatumLedger: "EOS",
      tatumChain: "eos-mainnet",
      tatumV3Path: "eos",
      endpoints: [
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.REST,
          url: "https://eos-mainnet.gateway.tatum.io",
          isDefault: true,
        },
      ],
    },

    // (10) Ethereum
    {
      code: "ethereum",
      name: "Ethereum (Mainnet)",
      tatumLedger: "ETH",
      tatumChain: "ethereum-mainnet",
      tatumV3Path: "ethereum",
      endpoints: [
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.JSON_RPC,
          url: "https://ethereum-mainnet.gateway.tatum.io",
          isDefault: true,
        },
        {
          role: TatumEndpointRole.INDEXER,
          protocol: TatumProtocol.BEACON,
          name: "Beacon",
          url: "https://ethereum-mainnet.gateway.tatum.io/eth/v1",
        },
      ],
    },

    // (11) Flare
    {
      code: "flare",
      name: "Flare (Mainnet)",
      tatumLedger: "FLR",
      tatumChain: "flare-mainnet",
      tatumV3Path: null,
      endpoints: [
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.JSON_RPC,
          url: "https://flare-mainnet.gateway.tatum.io",
          isDefault: true,
        },
      ],
    },

    // (12) Kaia
    {
      code: "kaia",
      name: "Kaia (Mainnet)",
      tatumLedger: "KAIA",
      tatumChain: "kaia-mainnet",
      tatumV3Path: null,
      endpoints: [
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.JSON_RPC,
          url: "https://kaia-mainnet.gateway.tatum.io",
          isDefault: true,
        },
      ],
    },

    // (13) Litecoin
    {
      code: "litecoin",
      name: "Litecoin (Mainnet)",
      tatumLedger: "LTC",
      tatumChain: "litecoin-mainnet",
      tatumV3Path: "litecoin",
      endpoints: [
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.JSON_RPC,
          url: "https://litecoin-mainnet.gateway.tatum.io",
          isDefault: true,
        },
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.REST,
          url: "https://litecoin-mainnet.gateway.tatum.io/rest",
        },
      ],
    },

    // (14) Optimism
    {
      code: "optimism",
      name: "Optimism (Mainnet)",
      tatumLedger: "OPTIMISM",
      tatumChain: "optimism-mainnet",
      tatumV3Path: null,
      endpoints: [
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.JSON_RPC,
          url: "https://optimism-mainnet.gateway.tatum.io",
          isDefault: true,
        },
      ],
    },

    // (15) Polygon
    {
      code: "polygon",
      name: "Polygon (Mainnet)",
      tatumLedger: "POLYGON",
      tatumChain: "polygon-mainnet",
      tatumV3Path: null,
      endpoints: [
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.JSON_RPC,
          url: "https://polygon-mainnet.gateway.tatum.io",
          isDefault: true,
        },
      ],
    },

    // (16) Ripple
    {
      code: "ripple",
      name: "Ripple (Mainnet)",
      tatumLedger: "XRP",
      tatumChain: "ripple-mainnet",
      tatumV3Path: "xrp",
      requiresMemo: true,
      endpoints: [
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.REST,
          url: "https://ripple-mainnet.gateway.tatum.io",
          isDefault: true,
        },
      ],
    },

    // (17) Solana
    {
      code: "solana",
      name: "Solana (Mainnet)",
      tatumLedger: "SOL",
      tatumChain: "solana-mainnet",
      tatumV3Path: "solana",
      endpoints: [
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.JSON_RPC,
          url: "https://solana-mainnet.gateway.tatum.io",
          isDefault: true,
        },
      ],
    },

    // (18) Stellar
    {
      code: "stellar",
      name: "Stellar (Mainnet)",
      tatumLedger: "XLM",
      tatumChain: "stellar-mainnet",
      tatumV3Path: "stellar",
      requiresMemo: true,
      endpoints: [
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.HORIZON,
          name: "Horizon",
          url: "https://stellar-mainnet.gateway.tatum.io/",
          isDefault: true,
        },
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.SOROBAN,
          name: "Soroban",
          url: "https://stellar-mainnet-soroban.gateway.tatum.io/",
        },
      ],
    },

    // (19) Tron
    {
      code: "tron",
      name: "Tron (Mainnet)",
      tatumLedger: "TRON",
      tatumChain: "tron-mainnet",
      tatumV3Path: "tron",
      endpoints: [
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.JSON_RPC,
          name: "jsonrpc",
          url: "https://tron-mainnet.gateway.tatum.io/jsonrpc",
          isDefault: true,
        },
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.REST,
          name: "wallet",
          url: "https://tron-mainnet.gateway.tatum.io/wallet",
        },
        {
          role: TatumEndpointRole.INDEXER,
          protocol: TatumProtocol.REST,
          name: "walletsolidity",
          url: "https://tron-mainnet.gateway.tatum.io/walletsolidity",
        },
      ],
    },

    // (20) ZKsync
    {
      code: "zksync",
      name: "ZKsync (Mainnet)",
      tatumLedger: "ZKSYNC",
      tatumChain: "zksync-mainnet",
      tatumV3Path: null,
      endpoints: [
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.JSON_RPC,
          url: "https://zksync-mainnet.gateway.tatum.io",
          isDefault: true,
        },
      ],
    },

    // (21) Berachain
    {
      code: "berachain",
      name: "Berachain (Mainnet)",
      tatumLedger: "BERACHAIN",
      tatumChain: "berachain-mainnet",
      tatumV3Path: null,
      endpoints: [
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.JSON_RPC,
          url: "https://berachain-mainnet.gateway.tatum.io",
          isDefault: true,
        },
      ],
    },

    // (22) Bitcoin Cash
    {
      code: "bitcoin-cash",
      name: "Bitcoin Cash (Mainnet)",
      tatumLedger: "BCH",
      tatumChain: "bch-mainnet",
      tatumV3Path: "bcash",
      endpoints: [
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.JSON_RPC,
          url: "https://bitcoin-cash-mainnet.gateway.tatum.io",
          isDefault: true,
        },
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.REST,
          url: "https://bitcoin-cash-mainnet.gateway.tatum.io/rest",
        },
      ],
    },

    // (23) Cardano
    {
      code: "cardano",
      name: "Cardano (Mainnet)",
      tatumLedger: "ADA",
      tatumChain: "cardano-mainnet",
      tatumV3Path: "ada",
      endpoints: [
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.ROSSETTA,
          url: "https://cardano-mainnet.gateway.tatum.io",
          isDefault: true,
        },
      ],
    },

    // (24) Chiliz
    {
      code: "chiliz",
      name: "Chiliz (Mainnet)",
      tatumLedger: "CHILIZ",
      tatumChain: "chiliz-mainnet",
      tatumV3Path: null,
      endpoints: [
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.JSON_RPC,
          url: "https://chiliz-mainnet.gateway.tatum.io",
          isDefault: true,
        },
      ],
    },

    // (25) Cronos
    {
      code: "cronos",
      name: "Cronos (Mainnet)",
      tatumLedger: "CRONOS",
      tatumChain: "cronos-mainnet",
      tatumV3Path: null,
      endpoints: [
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.JSON_RPC,
          url: "https://cronos-mainnet.gateway.tatum.io",
          isDefault: true,
        },
      ],
    },

    // (26) Ethereum Classic
    {
      code: "ethereum-classic",
      name: "Ethereum Classic (Mainnet)",
      tatumLedger: "ETC",
      tatumChain: "ethereum-classic-mainnet",
      tatumV3Path: null,
      endpoints: [
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.JSON_RPC,
          url: "https://ethereum-classic-mainnet.gateway.tatum.io",
          isDefault: true,
        },
      ],
    },

    // (27) Fantom
    {
      code: "fantom",
      name: "Fantom (Mainnet)",
      tatumLedger: "FANTOM",
      tatumChain: "fantom-mainnet",
      tatumV3Path: null,
      endpoints: [
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.JSON_RPC,
          url: "https://fantom-mainnet.gateway.tatum.io",
          isDefault: true,
        },
      ],
    },

    // (28) Iota
    {
      code: "iota",
      name: "Iota (Mainnet)",
      tatumLedger: "IOTA",
      tatumChain: "iota-mainnet",
      tatumV3Path: null,
      endpoints: [
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.JSON_RPC,
          url: "https://iota-mainnet.gateway.tatum.io",
          isDefault: true,
        },
      ],
    },

    // (31) NEAR
    {
      code: "near",
      name: "NEAR (Mainnet)",
      tatumLedger: "NEAR",
      tatumChain: "near-mainnet",
      tatumV3Path: null,
      endpoints: [
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.JSON_RPC,
          url: "https://near-mainnet.gateway.tatum.io",
          isDefault: true,
        },
      ],
    },

    // (32) Polkadot
    {
      code: "polkadot",
      name: "Polkadot (Mainnet)",
      tatumLedger: "DOT",
      tatumChain: "polkadot-mainnet",
      tatumV3Path: null,
      endpoints: [
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.JSON_RPC,
          url: "https://polkadot-mainnet.gateway.tatum.io",
          isDefault: true,
        },
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.SUBSTRATE,
          url: "https://polkadot-mainnet.gateway.tatum.io/substrateapi",
        },
      ],
    },

    // (36) Tezos
    {
      code: "tezos",
      name: "Tezos (Mainnet)",
      tatumLedger: "XTZ",
      tatumChain: "tezos-mainnet",
      tatumV3Path: "tezos",
      endpoints: [
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.REST,
          url: "https://tezos-mainnet.gateway.tatum.io",
          isDefault: true,
        },
      ],
    },

    // (37) TON
    {
      code: "ton",
      name: "The Open Network (Mainnet)",
      tatumLedger: "TON",
      tatumChain: "ton-mainnet",
      tatumV3Path: "ton",
      endpoints: [
        {
          role: TatumEndpointRole.INDEXER,
          protocol: TatumProtocol.TON_V3_INDEXER,
          name: "V3 Indexer",
          url: "https://ton-mainnet.gateway.tatum.io/api/v3",
          isDefault: true,
        },
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.TON_V2_HTTP,
          name: "V2 HTTP",
          url: "https://ton-mainnet.gateway.tatum.io",
        },
      ],
    },

    // (40) Zcash
    {
      code: "zcash",
      name: "Zcash (Mainnet)",
      tatumLedger: "ZEC",
      tatumChain: "zcash-mainnet",
      tatumV3Path: "zcash",
      endpoints: [
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.JSON_RPC,
          url: "https://zcash-mainnet.gateway.tatum.io",
          isDefault: true,
        },
        {
          role: TatumEndpointRole.DEPOSIT,
          protocol: TatumProtocol.REST,
          url: "https://zcash-mainnet.gateway.tatum.io/rest",
        },
      ],
    },
  ]

  // Upsert networks + rewrite endpoints deterministically
  for (const n of networks) {
    const network = await db.network.upsert({
      where: { code: n.code },
      create: {
        code: n.code,
        name: n.name,
        tatumLedger: n.tatumLedger,
        tatumChain: n.tatumChain ?? null,
        tatumV3Path: n.tatumV3Path ?? null,
        requiresMemo: n.requiresMemo ?? false,
        isActive: n.isActive ?? true,
      },
      update: {
        name: n.name,
        tatumLedger: n.tatumLedger,
        tatumChain: n.tatumChain ?? null,
        tatumV3Path: n.tatumV3Path ?? null,
        requiresMemo: n.requiresMemo ?? false,
        isActive: n.isActive ?? true,
      },
    })

    await db.tatumEndpoint.deleteMany({ where: { networkId: network.id } })

    if (n.endpoints.length > 0) {
      await db.tatumEndpoint.createMany({
        data: n.endpoints.map((e) => ({
          networkId: network.id,
          role: e.role,
          protocol: e.protocol,
          name: e.name ?? null,
          url: e.url,
          isActive: e.isActive ?? true,
          isDefault: e.isDefault ?? false,
        })),
      })
    }

    // Seed TatumWallet row (пустой) — чтобы было удобно управлять из админки позже
    // (не создаём xpub/mnemonic тут — это секреты, их создаёшь отдельной админ-операцией)
    await db.tatumWallet.upsert({
      where: { networkId: network.id },
      create: {
        networkId: network.id,
        xpub: null,
        address: null,
        mnemonicEncrypted: null,
        nextDerivationIndex: 0,
        isActive: true,
      },
      update: {
        isActive: true,
      },
    })
  }

  // COIN <-> NETWORK (минимальный набор для старта)
  const coinNetworkPairs: Array<{
    coin: string
    network: string
    isDefault?: boolean
    depositEnabled?: boolean
    withdrawEnabled?: boolean
    requiresMemoOverride?: boolean | null
    tokenContractAddress?: string | null
    decimals?: number | null
  }> = [
    { coin: "BTC", network: "bitcoin", isDefault: true },
    { coin: "ETH", network: "ethereum", isDefault: true },
    { coin: "SOL", network: "solana", isDefault: true },
    { coin: "LTC", network: "litecoin", isDefault: true },
    { coin: "BCH", network: "bitcoin-cash", isDefault: true },
    { coin: "DOGE", network: "dogecoin", isDefault: true },
    { coin: "XRP", network: "ripple", isDefault: true, requiresMemoOverride: true },
    { coin: "XLM", network: "stellar", isDefault: true, requiresMemoOverride: true },

    // USDT примеры (контракты сознательно не ставлю)
    { coin: "USDT", network: "ethereum", isDefault: true, decimals: 6 },
    { coin: "USDT", network: "tron", decimals: 6 },
    { coin: "USDT", network: "bsc", decimals: 18 },
    { coin: "USDT", network: "polygon", decimals: 6 },
    { coin: "USDT", network: "optimism", decimals: 6 },
    { coin: "USDT", network: "arbitrum-one", decimals: 6 },
    { coin: "USDT", network: "base", decimals: 6 },
  ]

  for (const p of coinNetworkPairs) {
    const coin = await db.coin.findUnique({ where: { code: p.coin } })
    if (!coin) throw new Error(`Coin not found: ${p.coin}`)

    const network = await db.network.findUnique({ where: { code: p.network } })
    if (!network) throw new Error(`Network not found: ${p.network}`)

    await db.coinNetwork.upsert({
      where: { coinCode_networkId: { coinCode: coin.code, networkId: network.id } },
      create: {
        coinCode: coin.code,
        networkId: network.id,
        isDefault: p.isDefault ?? false,
        depositEnabled: p.depositEnabled ?? true,
        withdrawEnabled: p.withdrawEnabled ?? true,
        requiresMemoOverride: p.requiresMemoOverride ?? null,
        tokenContractAddress: p.tokenContractAddress ?? null,
        decimals: p.decimals ?? null,
      },
      update: {
        isDefault: p.isDefault ?? false,
        depositEnabled: p.depositEnabled ?? true,
        withdrawEnabled: p.withdrawEnabled ?? true,
        requiresMemoOverride: p.requiresMemoOverride ?? null,
        tokenContractAddress: p.tokenContractAddress ?? null,
        decimals: p.decimals ?? null,
      },
    })
  }

  console.log("✔ Seed completed")
}
