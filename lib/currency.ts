const DEFAULT_MAX_FRACTION_DIGITS = 8;

export function resolveFractionDigits(
  value: number,
  defaultMaxDigits = 2,
  maxDigits = DEFAULT_MAX_FRACTION_DIGITS
) {
  if (!Number.isFinite(value)) {
    return defaultMaxDigits;
  }
  const normalized = Number(value.toFixed(maxDigits));
  const [, fraction = ""] = normalized
    .toString()
    .split(".");
  const actualDigits = fraction.length;
  if (actualDigits > defaultMaxDigits) {
    return Math.min(actualDigits, maxDigits);
  }
  return defaultMaxDigits;
}

