import { StyleSheet, Text, View } from "react-native";

import type { SubscriptionInfo } from "@/services/auth";

type IndicatorProps = {
  subscription?: SubscriptionInfo | null;
  size?: "small" | "medium";
};

const SYMBOLS = {
  active: "★",
  trialing: "✦",
} as const;

const COLORS = {
  active: {
    background: "#2F6E4F",
    color: "#FFFFFF",
  },
  trialing: {
    background: "#7F5AF0",
    color: "#FFFFFF",
  },
} as const;

function resolveStatus(
  subscription?: SubscriptionInfo | null
): "active" | "trialing" | null {
  if (subscription?.is_active) {
    return "active";
  }
  if (subscription?.is_trialing) {
    return "trialing";
  }
  return null;
}

export function SubscriptionIndicator({
  subscription,
  size = "small",
}: IndicatorProps) {
  const status = resolveStatus(subscription);
  if (!status) {
    return null;
  }
  const dimension = size === "medium" ? 20 : 16;
  const fontSize = size === "medium" ? 12 : 10;

  return (
    <View
      style={[
        styles.base,
        {
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
          backgroundColor: COLORS[status].background,
        },
      ]}
      accessibilityRole="image"
      accessibilityLabel={
        status === "active"
          ? "Subscription active"
          : "Subscription trialing"
      }
    >
      <Text style={[styles.symbol, { fontSize, color: COLORS[status].color }]}>
        {SYMBOLS[status]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
  },
  symbol: {
    fontWeight: "600",
    lineHeight: 14,
  },
});
