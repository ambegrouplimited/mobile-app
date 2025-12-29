import type { PaymentMethodSelection } from "@/components/payment/PaymentMethodComposer";
import { PAYMENT_METHODS } from "@/data/payment-methods";
import type { PaymentMethodDef, PaymentVariant } from "@/data/payment-methods";
import type { PaymentMethod, PaymentMethodCreatePayload, PaymentMethodType } from "@/types/payment-methods";

export const PAYMENT_METHODS_CACHE_KEY = "cache.settings.paymentMethods";

type VariantMeta = {
  method: PaymentMethodDef;
  variant: PaymentVariant;
};

const OPTIONAL_FIELDS: (keyof PaymentMethodCreatePayload)[] = [
  "instructions",
  "url",
  "handle",
  "ach_bank_name",
  "ach_account_number",
  "ach_routing_number",
  "ach_account_type",
  "zelle_email",
  "zelle_phone",
  "iban",
  "bic",
  "account_name",
  "wallet_address",
  "wallet_network",
  "wallet_memo",
  "is_default",
];

const CRYPTO_TYPES: PaymentMethodType[] = [
  "crypto_xrp",
  "crypto_btc",
  "crypto_eth",
  "crypto_usdc",
  "crypto_usdt",
  "crypto_sol",
  "crypto_bnb",
  "crypto_doge",
  "crypto_avax",
  "crypto_tron",
  "crypto_ton",
  "crypto_monero",
  "crypto_other",
];

export type PaymentMethodListItem = {
  id: string;
  logo: PaymentMethodDef["logo"];
  title: string;
  detail: string;
  updatedAt: string;
};

export type ComposerInitialState = {
  methodId: string;
  variantId: string;
  formValues: Record<string, Record<string, string>>;
};

export function findVariantByType(type: PaymentMethodType): VariantMeta | null {
  for (const method of PAYMENT_METHODS) {
    for (const variant of method.variants) {
      if (variant.type === type) {
        return { method, variant };
      }
    }
  }
  return null;
}

export function selectionToPayload(selection: PaymentMethodSelection): PaymentMethodCreatePayload {
  const trimmedValues: Record<string, string> = {};
  selection.variant.fields.forEach((field) => {
    const rawValue = selection.values[field.key];
    if (typeof rawValue === "string" && rawValue.trim().length > 0) {
      trimmedValues[field.key] = rawValue.trim();
    }
  });

  const payload: PaymentMethodCreatePayload = {
    type: selection.variant.type,
    label: trimmedValues.label ?? selection.variant.label,
  };

  OPTIONAL_FIELDS.forEach((key) => {
    const value = trimmedValues[key as string];
    if (value) {
      payload[key] = value;
    }
  });

  return payload;
}

export function presentPaymentMethod(method: PaymentMethod): PaymentMethodListItem {
  const meta = findVariantByType(method.type);
  const logo = deriveLogo(method, meta);
  return {
    id: method.id,
    logo,
    title: method.label || meta?.variant.label || "Payment method",
    detail: buildDetail(method),
    updatedAt: method.updated_at,
  };
}

export function buildComposerInitialState(method: PaymentMethod): ComposerInitialState | null {
  const meta = findVariantByType(method.type);
  if (!meta) {
    return null;
  }
  const formKey = `${meta.method.id}:${meta.variant.id}`;
  const values: Record<string, string> = {};
  const source = method as Record<string, string | null | undefined>;
  meta.variant.fields.forEach((field) => {
    const raw = source[field.key];
    values[field.key] = raw ?? "";
  });
  return {
    methodId: meta.method.id,
    variantId: meta.variant.id,
    formValues: {
      [formKey]: values,
    },
  };
}

function buildDetail(method: PaymentMethod): string {
  switch (method.type) {
    case "stripe_link":
    case "paypal_link":
    case "venmo_link":
    case "cashapp_link":
    case "revolut_link":
    case "wise_link":
      return method.url ?? "Link not available";
    case "paypal_handle":
    case "venmo_handle":
    case "cashapp_handle":
      return method.handle ?? "Handle not provided";
    case "ach":
      return joinParts([
        method.ach_bank_name,
        method.ach_account_number,
        method.ach_routing_number ? `Routing ${method.ach_routing_number}` : null,
      ]);
    case "zelle":
      return method.zelle_email ?? method.zelle_phone ?? "Zelle contact not set";
    case "sepa":
    case "revolut_account":
    case "wise_account":
    case "n26_account":
      return joinParts([method.account_name, method.iban, method.bic]);
    case "custom":
      return method.instructions ?? "Custom instructions";
    default:
      if (CRYPTO_TYPES.includes(method.type)) {
        return joinParts([
          method.wallet_address,
          method.wallet_network,
          method.wallet_memo ? `Memo ${method.wallet_memo}` : null,
        ]);
      }
      return method.instructions ?? "Payment details unavailable";
  }
}

function deriveLogo(
  method: PaymentMethod,
  meta: VariantMeta | null
): PaymentMethodListItem["logo"] {
  if (!meta) {
    return "bank";
  }
  if (CRYPTO_TYPES.includes(method.type)) {
    if (method.type === "crypto_other") {
      return meta.method.logo;
    }
    return meta.variant.icon ?? meta.method.logo;
  }
  return meta.method.logo;
}

function joinParts(parts: Array<string | null | undefined>): string {
  const filtered = parts.filter((part): part is string => Boolean(part?.trim()));
  if (!filtered.length) {
    return "Details unavailable";
  }
  return filtered.join(" · ");
}
