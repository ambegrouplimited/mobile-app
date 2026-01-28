import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Redirect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Theme } from "@/constants/theme";
import { getCachedValue, setCachedValue } from "@/lib/cache";
import { useAuth } from "@/providers/auth-provider";
import { fetchCurrencies } from "@/services/currencies";
import type { Currency } from "@/types/currency";

const palette = Theme.palette;
const CURRENCY_CACHE_KEY = "cache.settings.currencies";

export default function CurrencyOnboardingScreen() {
  const router = useRouter();
  const { user, session, updateUserProfile } = useAuth();
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const currentCode = (user?.default_currency ?? "USD").toUpperCase();
  const goNext = useCallback(() => {
    router.replace("/onboarding/timezone");
  }, [router]);

  const loadCurrencies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cached = await getCachedValue<Currency[]>(CURRENCY_CACHE_KEY);
      if (cached?.length) {
        setCurrencies(
          cached.map((currency) => ({
            ...currency,
            code: currency.code.toUpperCase(),
          }))
        );
        setLoading(false);
      }
      const response = await fetchCurrencies({ limit: 500 });
      const normalized = response
        .map((currency) => ({
          ...currency,
          code: currency.code.toUpperCase(),
        }))
        .sort((a, b) => a.code.localeCompare(b.code));
      setCurrencies(normalized);
      await setCachedValue(CURRENCY_CACHE_KEY, normalized);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load currencies."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCurrencies();
  }, [loadCurrencies]);

  const filteredCurrencies = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return currencies;
    }
    return currencies.filter(
      (currency) =>
        currency.code.toLowerCase().includes(query) ||
        currency.name.toLowerCase().includes(query)
    );
  }, [currencies, search]);

  const handleSelect = useCallback(
    async (currency: Currency) => {
      if (savingCode || currency.code === currentCode) {
        return;
      }
      if (!session?.accessToken) {
        router.replace("/login");
        return;
      }
      setSavingCode(currency.code);
      setError(null);
      try {
        await Haptics.selectionAsync();
        await updateUserProfile({ defaultCurrency: currency.code });
        goNext();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to update your default currency."
        );
      } finally {
        setSavingCode(null);
      }
    },
    [currentCode, goNext, router, savingCode, session?.accessToken, updateUserProfile]
  );

  const renderItem = useCallback(
    ({ item }: { item: Currency }) => {
      const isActive = item.code === currentCode;
      const isSaving = savingCode === item.code;
      return (
        <Pressable
          style={[styles.row, isActive && styles.rowActive]}
          onPress={() => handleSelect(item)}
          disabled={isSaving}
        >
          <View style={styles.rowText}>
            <Text style={styles.rowCode}>{item.code}</Text>
            <Text style={styles.rowName}>{item.name}</Text>
          </View>
          <View style={styles.rowMeta}>
            <Text style={styles.rateLabel}>
              {`1 USD = ${formatExchangeRate(item)} ${item.code}`}
            </Text>
            {isActive ? (
              <Feather name="check" size={18} color={palette.slate} />
            ) : isSaving ? (
              <ActivityIndicator color={palette.slate} />
            ) : (
              <Feather name="circle" size={16} color={palette.slateSoft} />
            )}
          </View>
        </Pressable>
      );
    },
    [currentCode, handleSelect, savingCode]
  );

  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={filteredCurrencies}
        keyExtractor={(item) => item.code}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.headerWrapper}>
            <View style={styles.progressRow}>
              <View>
                <Text style={styles.progressLabel}>Step 1 of 3</Text>
                <Text style={styles.progressTitle}>Pick your currency</Text>
              </View>
              <Pressable style={styles.skipButton} onPress={goNext}>
                <Text style={styles.skipButtonText}>Skip</Text>
              </Pressable>
            </View>
            <Text style={styles.subtitle}>
              This helps DueSoon format new reminders with the right billing
              currency. You can change it later in Settings.
            </Text>
            <View style={styles.searchField}>
              <Feather name="search" size={16} color={palette.slate} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by code or name"
                placeholderTextColor={palette.slateSoft}
                value={search}
                onChangeText={setSearch}
                autoCorrect={false}
                autoCapitalize="characters"
              />
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
        }
        ListFooterComponent={<View style={{ height: Theme.spacing.xl }} />}
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator color={palette.ink} />
              <Text style={styles.loadingLabel}>Loading currencies…</Text>
            </View>
          ) : (
            <Text style={styles.emptyText}>No currencies match your search.</Text>
          )
        }
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          loadCurrencies();
        }}
        keyboardShouldPersistTaps="handled"
      />
    </SafeAreaView>
  );
}

const RATE_DEFAULT_FRACTION_DIGITS = 4;

function formatExchangeRate(currency: Currency) {
  const ratio = 1 / currency.usd_per_unit;
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return "—";
  }
  const maximumFractionDigits = Math.min(
    RATE_DEFAULT_FRACTION_DIGITS,
    ratio < 0.01 ? 6 : RATE_DEFAULT_FRACTION_DIGITS
  );
  return ratio.toFixed(maximumFractionDigits);
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Theme.palette.background,
  },
  listContent: {
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.xl,
    gap: Theme.spacing.sm,
  },
  headerWrapper: {
    gap: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressLabel: {
    fontSize: 13,
    color: palette.slate,
  },
  progressTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: palette.ink,
  },
  subtitle: {
    fontSize: 15,
    color: palette.slate,
  },
  skipButton: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
  },
  skipButtonText: {
    fontSize: 14,
    color: palette.slate,
    fontWeight: "600",
  },
  searchField: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: Theme.radii.md,
    paddingHorizontal: Theme.spacing.md,
    backgroundColor: "#FFFFFF",
  },
  searchInput: {
    flex: 1,
    paddingVertical: Theme.spacing.sm,
    color: palette.ink,
  },
  row: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: Theme.radii.md,
    padding: Theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowActive: {
    borderColor: palette.slate,
    backgroundColor: palette.surface,
  },
  rowText: {
    gap: 4,
  },
  rowCode: {
    fontSize: 18,
    fontWeight: "700",
    color: palette.ink,
  },
  rowName: {
    fontSize: 13,
    color: palette.slate,
  },
  rowMeta: {
    alignItems: "flex-end",
    gap: 4,
  },
  rateLabel: {
    fontSize: 12,
    color: palette.slateSoft,
  },
  loadingState: {
    paddingVertical: Theme.spacing.xl,
    alignItems: "center",
  },
  loadingLabel: {
    marginTop: Theme.spacing.sm,
    color: palette.slate,
  },
  emptyText: {
    textAlign: "center",
    color: palette.slate,
    marginVertical: Theme.spacing.xl,
  },
  errorText: {
    color: Theme.palette.accent,
  },
});
