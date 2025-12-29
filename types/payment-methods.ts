export type PaymentMethodType =
  | "stripe_link"
  | "paypal_link"
  | "venmo_link"
  | "cashapp_link"
  | "paypal_handle"
  | "venmo_handle"
  | "cashapp_handle"
  | "ach"
  | "zelle"
  | "sepa"
  | "revolut_link"
  | "wise_link"
  | "revolut_account"
  | "wise_account"
  | "n26_account"
  | "crypto_xrp"
  | "crypto_btc"
  | "crypto_eth"
  | "crypto_usdc"
  | "crypto_usdt"
  | "crypto_sol"
  | "crypto_bnb"
  | "crypto_doge"
  | "crypto_avax"
  | "crypto_tron"
  | "crypto_ton"
  | "crypto_monero"
  | "crypto_other"
  | "custom";

export type PaymentMethodDetails = {
  type: PaymentMethodType;
  label: string;
  instructions?: string | null;
  url?: string | null;
  handle?: string | null;
  ach_bank_name?: string | null;
  ach_account_number?: string | null;
  ach_routing_number?: string | null;
  ach_account_type?: string | null;
  zelle_email?: string | null;
  zelle_phone?: string | null;
  iban?: string | null;
  bic?: string | null;
  account_name?: string | null;
  wallet_address?: string | null;
  wallet_network?: string | null;
  wallet_memo?: string | null;
  is_default?: boolean | null;
};

export type PaymentMethod = PaymentMethodDetails & {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

export type PaymentMethodCreatePayload = Omit<PaymentMethodDetails, "user_id" | "created_at" | "updated_at">;
export type PaymentMethodUpdatePayload = Partial<PaymentMethodCreatePayload>;
