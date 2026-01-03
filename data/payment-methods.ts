import { Asset } from "expo-asset";

import type { PaymentMethodType } from "@/types/payment-methods";

export const paymentLogos = {
  stripe: Asset.fromModule(require("@/assets/stripe.svg")).uri,
  paypal: Asset.fromModule(require("@/assets/paypal.svg")).uri,
  venmo: Asset.fromModule(require("@/assets/venmo.svg")).uri,
  cashapp: Asset.fromModule(require("@/assets/cashapp.svg")).uri,
  revolut: Asset.fromModule(require("@/assets/revolut.svg")).uri,
  wise: Asset.fromModule(require("@/assets/wise.svg")).uri,
  zelle: Asset.fromModule(require("@/assets/zelle.svg")).uri,
  ach: Asset.fromModule(require("@/assets/ach.png")).uri,
  bank: Asset.fromModule(require("@/assets/bank.svg")).uri,
  crypto: Asset.fromModule(require("@/assets/crypto.svg")).uri,
  iban: Asset.fromModule(require("@/assets/iban.png")).uri,
  n26: Asset.fromModule(require("@/assets/n26.svg")).uri,
  btc: Asset.fromModule(require("@/assets/crypto/btc.svg")).uri,
  eth: Asset.fromModule(require("@/assets/crypto/eth.svg")).uri,
  sol: Asset.fromModule(require("@/assets/crypto/solana.svg")).uri,
  usdt: Asset.fromModule(require("@/assets/crypto/usdt.svg")).uri,
  usdc: Asset.fromModule(require("@/assets/crypto/usdc.svg")).uri,
  bnb: Asset.fromModule(require("@/assets/crypto/bnb.svg")).uri,
  doge: Asset.fromModule(require("@/assets/crypto/dogecoin.svg")).uri,
  avax: Asset.fromModule(require("@/assets/crypto/avalanche.svg")).uri,
  xrp: Asset.fromModule(require("@/assets/crypto/xrp-logo.svg")).uri,
  tron: Asset.fromModule(require("@/assets/crypto/tron.svg")).uri,
  ton: Asset.fromModule(require("@/assets/crypto/toncoin.svg")).uri,
  monero: Asset.fromModule(require("@/assets/crypto/monero.svg")).uri,
} as const;

export type PaymentField = {
  key: string;
  label: string;
  placeholder: string;
  required?: boolean;
  multiline?: boolean;
  helper?: string;
};

export type PaymentVariant = {
  id: string;
  label: string;
  type: PaymentMethodType;
  fields: PaymentField[];
  note?: string;
  icon?: keyof typeof paymentLogos;
};

export type PaymentMethodDef = {
  id: string;
  logo: keyof typeof paymentLogos;
  title: string;
  subtitle: string;
  variants: PaymentVariant[];
};

export const BASE_PAYMENT_METHODS: PaymentMethodDef[] = [
  {
    id: "stripe",
    logo: "stripe",
    title: "Stripe",
    subtitle: "Share Stripe Checkout or invoice links.",
    variants: [
      {
        id: "stripe_link",
        label: "Stripe payment link",
        type: "stripe_link",
        fields: [
          {
            key: "url",
            label: "Payment link",
            placeholder: "https://pay.stripe.com/...",
            required: true,
          },
          {
            key: "label",
            label: "Label (optional)",
            placeholder: "Invoice label clients recognize",
          },
          {
            key: "instructions",
            label: "Instructions (optional)",
            placeholder: "Valid for 7 days. Applies to invoice #1042.",
            multiline: true,
          },
        ],
      },
    ],
  },
  {
    id: "paypal",
    logo: "paypal",
    title: "PayPal",
    subtitle: "Provide PayPal links or handles.",
    variants: [
      {
        id: "paypal_link",
        label: "PayPal link",
        type: "paypal_link",
        fields: [
          { key: "url", label: "PayPal link", placeholder: "https://paypal.me/duesoon", required: true },
          { key: "label", label: "Label (optional)", placeholder: "PayPal invoice" },
          {
            key: "instructions",
            label: "Instructions (optional)",
            placeholder: "Due within 5 days.",
            multiline: true,
          },
        ],
      },
      {
        id: "paypal_handle",
        label: "PayPal handle",
        type: "paypal_handle",
        fields: [
          { key: "handle", label: "PayPal username", placeholder: "@duesoon", required: true },
          { key: "label", label: "Label (optional)", placeholder: "PayPal instructions" },
          {
            key: "instructions",
            label: "Instructions (optional)",
            placeholder: "Send via PayPal balance or linked bank.",
            multiline: true,
          },
        ],
      },
    ],
  },
  {
    id: "cashapp",
    logo: "cashapp",
    title: "Cash App",
    subtitle: "Share a link or $cashtag for Cash App.",
    variants: [
      {
        id: "cashapp_link",
        label: "Cash App link",
        type: "cashapp_link",
        fields: [
          { key: "url", label: "Payment link", placeholder: "https://cash.app/$duesoon", required: true },
          { key: "label", label: "Label (optional)", placeholder: "Cash App payment" },
          {
            key: "instructions",
            label: "Instructions (optional)",
            placeholder: "Note invoice # in the memo.",
            multiline: true,
          },
        ],
      },
      {
        id: "cashapp_handle",
        label: "$cashtag",
        type: "cashapp_handle",
        fields: [
          { key: "handle", label: "$cashtag", placeholder: "$duesoon", required: true },
          { key: "label", label: "Label (optional)", placeholder: "Cash App instructions" },
          {
            key: "instructions",
            label: "Instructions (optional)",
            placeholder: "Use Cash App and confirm once sent.",
            multiline: true,
          },
        ],
      },
    ],
  },
  {
    id: "venmo",
    logo: "venmo",
    title: "Venmo",
    subtitle: "Share Venmo links or handles.",
    variants: [
      {
        id: "venmo_link",
        label: "Venmo link",
        type: "venmo_link",
        fields: [
          { key: "url", label: "Payment link", placeholder: "https://venmo.com/u/duesoon", required: true },
          { key: "label", label: "Label (optional)", placeholder: "Venmo payment" },
          {
            key: "instructions",
            label: "Instructions (optional)",
            placeholder: "Include invoice # in the note.",
            multiline: true,
          },
        ],
      },
      {
        id: "venmo_handle",
        label: "@handle",
        type: "venmo_handle",
        fields: [
          { key: "handle", label: "Venmo username", placeholder: "@duesoon", required: true },
          { key: "label", label: "Label (optional)", placeholder: "Preferred Venmo note" },
          {
            key: "instructions",
            label: "Instructions (optional)",
            placeholder: "Use Venmo balance or linked bank.",
            multiline: true,
          },
        ],
      },
    ],
  },
  {
    id: "revolut",
    logo: "revolut",
    title: "Revolut",
    subtitle: "Provide a Revolut link or full account details.",
    variants: [
      {
        id: "revolut_link",
        label: "Revolut link",
        type: "revolut_link",
        fields: [
          { key: "url", label: "Payment link", placeholder: "https://revolut.me/duesoon", required: true },
          { key: "label", label: "Label (optional)", placeholder: "Revolut payment" },
          {
            key: "instructions",
            label: "Instructions (optional)",
            placeholder: "Specify preferred currency.",
            multiline: true,
          },
        ],
      },
      {
        id: "revolut_account",
        label: "Revolut account",
        type: "revolut_account",
        fields: [
          { key: "account_name", label: "Account name", placeholder: "DueSoon LTD" },
          { key: "iban", label: "IBAN", placeholder: "DE56 5001 0517 5407 3249 31", required: true },
          { key: "bic", label: "BIC / SWIFT", placeholder: "REVOLT21", required: true },
          {
            key: "instructions",
            label: "Instructions (optional)",
            placeholder: "Reference the invoice number.",
            multiline: true,
          },
        ],
      },
    ],
  },
  {
    id: "wise",
    logo: "wise",
    title: "Wise",
    subtitle: "Share Wise links or account numbers.",
    variants: [
      {
        id: "wise_link",
        label: "Wise link",
        type: "wise_link",
        fields: [
          { key: "url", label: "Payment link", placeholder: "https://wise.com/pay/duesoon", required: true },
          { key: "label", label: "Label (optional)", placeholder: "Wise payment link" },
          {
            key: "instructions",
            label: "Instructions (optional)",
            placeholder: "Link will request the invoice total.",
            multiline: true,
          },
        ],
      },
      {
        id: "wise_account",
        label: "Wise account",
        type: "wise_account",
        fields: [
          { key: "account_name", label: "Account name", placeholder: "DueSoon LTD" },
          { key: "iban", label: "IBAN", placeholder: "GB33BUKB20201555555555", required: true },
          { key: "bic", label: "BIC / SWIFT", placeholder: "TRWIBEB1XXX", required: true },
          {
            key: "instructions",
            label: "Instructions (optional)",
            placeholder: "Include invoice number in reference.",
            multiline: true,
          },
        ],
      },
    ],
  },
  {
    id: "ach",
    logo: "ach",
    title: "ACH transfer",
    subtitle: "Share US bank routing details.",
    variants: [
      {
        id: "ach",
        label: "ACH details",
        type: "ach",
        fields: [
          { key: "ach_bank_name", label: "Bank name", placeholder: "First Republic Bank", required: true },
          { key: "ach_routing_number", label: "Routing number", placeholder: "021000021", required: true },
          { key: "ach_account_number", label: "Account number", placeholder: "000123456789", required: true },
          { key: "ach_account_type", label: "Account type (optional)", placeholder: "Checking / Savings" },
          {
            key: "instructions",
            label: "Instructions (optional)",
            placeholder: "Include invoice number in memo.",
            multiline: true,
          },
        ],
      },
    ],
  },
  {
    id: "sepa",
    logo: "iban",
    title: "SEPA transfer",
    subtitle: "Collect EUR via IBAN.",
    variants: [
      {
        id: "sepa",
        label: "SEPA details",
        type: "sepa",
        fields: [
          { key: "account_name", label: "Account name", placeholder: "DueSoon GmbH" },
          { key: "iban", label: "IBAN", placeholder: "DE44 5001 0517 5407 3249 31", required: true },
          {
            key: "instructions",
            label: "Instructions (optional)",
            placeholder: "Reference the invoice number.",
            multiline: true,
          },
        ],
      },
    ],
  },
  {
    id: "n26",
    logo: "n26",
    title: "N26 account",
    subtitle: "Share your N26 IBAN and BIC.",
    variants: [
      {
        id: "n26_account",
        label: "N26 account",
        type: "n26_account",
        fields: [
          { key: "account_name", label: "Account name", placeholder: "DueSoon UG" },
          { key: "iban", label: "IBAN", placeholder: "DE02 1001 1001 2626 2626 26", required: true },
          { key: "bic", label: "BIC / SWIFT", placeholder: "NTSBDEB1XXX", required: true },
          {
            key: "instructions",
            label: "Instructions (optional)",
            placeholder: "Transfers usually arrive within 1-2 days.",
            multiline: true,
          },
        ],
      },
    ],
  },
  {
    id: "zelle",
    logo: "zelle",
    title: "Zelle",
    subtitle: "Ensure clients have your email or phone for Zelle transfers.",
    variants: [
      {
        id: "zelle_email",
        label: "Zelle email",
        type: "zelle",
        fields: [
          { key: "zelle_email", label: "Email", placeholder: "billing@duesoon.com", required: true },
          { key: "label", label: "Label (optional)", placeholder: "Preferred contact" },
          {
            key: "instructions",
            label: "Instructions (optional)",
            placeholder: "Zelle available at most US banks.",
            multiline: true,
          },
        ],
      },
      {
        id: "zelle_phone",
        label: "Zelle phone",
        type: "zelle",
        fields: [
          { key: "zelle_phone", label: "Phone number", placeholder: "+1 415 555 1234", required: true },
          { key: "label", label: "Label (optional)", placeholder: "Preferred contact" },
          {
            key: "instructions",
            label: "Instructions (optional)",
            placeholder: "Use this phone for Zelle transfers.",
            multiline: true,
          },
        ],
      },
    ],
  },
  {
    id: "crypto",
    logo: "xrp",
    title: "Crypto",
    subtitle: "Collect payments in the coin or stablecoin your client prefers.",
    variants: [
      {
        id: "xrp",
        label: "XRP",
        type: "crypto_xrp",
        icon: "xrp",
        fields: [
          { key: "wallet_address", label: "Wallet address", placeholder: "Enter XRP address", required: true },
          { key: "wallet_network", label: "Network / chain", placeholder: "XRPL", required: true },
          { key: "wallet_memo", label: "Destination tag (optional)", placeholder: "123456" },
          {
            key: "instructions",
            label: "Instructions (optional)",
            placeholder: "Reminder closes once XRP is received.",
            multiline: true,
          },
        ],
        note: "Include a destination tag when required by the exchange.",
      },
      {
        id: "btc",
        label: "BTC",
        type: "crypto_btc",
        icon: "btc",
        fields: [
          { key: "wallet_address", label: "Wallet address", placeholder: "bc1...", required: true },
          { key: "wallet_network", label: "Network / chain", placeholder: "Bitcoin mainnet", required: true },
          {
            key: "instructions",
            label: "Instructions (optional)",
            placeholder: "Use native segwit where possible.",
            multiline: true,
          },
        ],
      },
      {
        id: "eth",
        label: "ETH",
        type: "crypto_eth",
        icon: "eth",
        fields: [
          { key: "wallet_address", label: "Wallet address", placeholder: "0x...", required: true },
          { key: "wallet_network", label: "Network / chain", placeholder: "Ethereum mainnet", required: true },
          {
            key: "instructions",
            label: "Instructions (optional)",
            placeholder: "ERC-20 tokens only.",
            multiline: true,
          },
        ],
      },
      {
        id: "usdc",
        label: "USDC",
        type: "crypto_usdc",
        icon: "usdc",
        fields: [
          { key: "wallet_address", label: "Wallet address", placeholder: "0x / Sol / Tron address", required: true },
          { key: "wallet_network", label: "Network / chain", placeholder: "Ethereum / Solana / Tron", required: true },
          {
            key: "instructions",
            label: "Instructions (optional)",
            placeholder: "Specify preferred chain.",
            multiline: true,
          },
        ],
      },
      {
        id: "usdt",
        label: "USDT",
        type: "crypto_usdt",
        icon: "usdt",
        fields: [
          { key: "wallet_address", label: "Wallet address", placeholder: "TRC-20 / ERC-20 / Omni address", required: true },
          { key: "wallet_network", label: "Network / chain", placeholder: "TRC-20 / ERC-20 / Omni", required: true },
          {
            key: "instructions",
            label: "Instructions (optional)",
            placeholder: "State chain to avoid delays.",
            multiline: true,
          },
        ],
      },
      {
        id: "sol",
        label: "SOL",
        type: "crypto_sol",
        icon: "sol",
        fields: [
          { key: "wallet_address", label: "Wallet address", placeholder: "Solana address", required: true },
          { key: "wallet_network", label: "Network / chain", placeholder: "Solana mainnet", required: true },
          {
            key: "instructions",
            label: "Instructions (optional)",
            placeholder: "Use Phantom or compatible wallet.",
            multiline: true,
          },
        ],
      },
      {
        id: "bnb",
        label: "BNB",
        type: "crypto_bnb",
        icon: "bnb",
        fields: [
          { key: "wallet_address", label: "Wallet address", placeholder: "0x or BNB address", required: true },
          { key: "wallet_network", label: "Network / chain", placeholder: "BSC / Beacon", required: true },
          {
            key: "instructions",
            label: "Instructions (optional)",
            placeholder: "Specify BSC vs Beacon chain.",
            multiline: true,
          },
        ],
      },
      {
        id: "doge",
        label: "DOGE",
        type: "crypto_doge",
        icon: "doge",
        fields: [
          { key: "wallet_address", label: "Wallet address", placeholder: "DOGE address", required: true },
          { key: "wallet_network", label: "Network / chain", placeholder: "Dogecoin mainnet", required: true },
          {
            key: "instructions",
            label: "Instructions (optional)",
            placeholder: "Network fees fluctuate.",
            multiline: true,
          },
        ],
      },
      {
        id: "avax",
        label: "AVAX",
        type: "crypto_avax",
        icon: "avax",
        fields: [
          { key: "wallet_address", label: "Wallet address", placeholder: "Avalanche C-Chain", required: true },
          { key: "wallet_network", label: "Network / chain", placeholder: "Avalanche C-Chain", required: true },
          {
            key: "instructions",
            label: "Instructions (optional)",
            placeholder: "Use C-Chain only.",
            multiline: true,
          },
        ],
      },
      {
        id: "tron",
        label: "TRON",
        type: "crypto_tron",
        icon: "tron",
        fields: [
          { key: "wallet_address", label: "Wallet address", placeholder: "TRON address", required: true },
          { key: "wallet_network", label: "Network / chain", placeholder: "TRC-20", required: true },
          {
            key: "instructions",
            label: "Instructions (optional)",
            placeholder: "Tron network only.",
            multiline: true,
          },
        ],
      },
      {
        id: "ton",
        label: "TON",
        type: "crypto_ton",
        icon: "ton",
        fields: [
          { key: "wallet_address", label: "Wallet address", placeholder: "TON address", required: true },
          { key: "wallet_network", label: "Network / chain", placeholder: "TON mainnet", required: true },
          {
            key: "instructions",
            label: "Instructions (optional)",
            placeholder: "Use TON wallets only.",
            multiline: true,
          },
        ],
      },
      {
        id: "monero",
        label: "XMR",
        type: "crypto_monero",
        icon: "monero",
        fields: [
          { key: "wallet_address", label: "Wallet address", placeholder: "Monero address", required: true },
          { key: "wallet_memo", label: "Payment ID (optional)", placeholder: "Optional Payment ID" },
          {
            key: "instructions",
            label: "Instructions (optional)",
            placeholder: "Reminder closes once XMR arrives.",
            multiline: true,
          },
        ],
      },
      {
        id: "crypto_other",
        label: "Other",
        type: "crypto_other",
        icon: "crypto",
        fields: [
          { key: "wallet_address", label: "Wallet address", placeholder: "Enter wallet address", required: true },
          { key: "wallet_network", label: "Network / chain", placeholder: "Network or chain name", required: true },
          { key: "wallet_memo", label: "Memo / tag (optional)", placeholder: "Add memo or tag if required" },
          { key: "label", label: "Label (optional)", placeholder: "Currency or wallet label" },
          {
            key: "instructions",
            label: "Instructions (optional)",
            placeholder: "Any special steps for this wallet.",
            multiline: true,
          },
        ],
      },
    ],
  },

];

export const PAYMENT_METHODS = [
  ...BASE_PAYMENT_METHODS,
  {
    id: "other",
    logo: "bank",
    title: "Other",
    subtitle: "Capture any other payment instructions you rely on.",
    variants: [
      {
        id: "custom",
        label: "Custom instructions",
        type: "custom",
        fields: [
          { key: "label", label: "Method name", placeholder: "Payment method label", required: true },
          {
            key: "instructions",
            label: "Instructions",
            placeholder: "Example: Wire transfer • add invoice 1042",
            multiline: true,
            required: true,
          },
        ],
        note: "Share any special steps or links your client should follow.",
      },
    ],
  },
];
