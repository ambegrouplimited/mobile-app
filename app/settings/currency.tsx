import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
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
import { resolveFractionDigits } from "@/lib/currency";
import { useAuth } from "@/providers/auth-provider";
import { fetchCurrencies } from "@/services/currencies";
import type { Currency } from "@/types/currency";

const palette = Theme.palette;

const CURRENCY_CACHE_KEY = "cache.settings.currencies";

export default function CurrencySettingsScreen() {
  const router = useRouter();
  const { user, updateUserProfile } = useAuth();
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const currentCode = (user?.default_currency ?? "USD").toUpperCase();

  const loadCurrencies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cached = await getCachedValue<Currency[]>(CURRENCY_CACHE_KEY);
      if (cached?.length) {
        setCurrencies(cached.map((currency) => ({ ...currency, code: currency.code.toUpperCase() })));
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
      setError(err instanceof Error ? err.message : "Unable to load currencies.");
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

  const handleSelect = async (currency: Currency) => {
    if (savingCode || currency.code === currentCode) {
      return;
    }
    setSavingCode(currency.code);
    setError(null);
    try {
      await Haptics.selectionAsync();
      await updateUserProfile({ defaultCurrency: currency.code });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update your default currency."
      );
    } finally {
      setSavingCode(null);
    }
  };

  const renderCurrencyItem = useCallback(
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
    [currentCode, savingCode],
  );

  const listHeader = (
    <View style={styles.headerWrapper}>
      <Pressable style={styles.backLink} onPress={() => router.back()}>
        <Feather name="arrow-left" size={24} color={palette.ink} />
        <Text style={styles.backLabel}>Back to settings</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.title}>Default currency</Text>
        <Text style={styles.subtitle}>
          Choose which currency DueSoon should use by default when creating reminders.
        </Text>
      </View>

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
  );

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={filteredCurrencies}
        keyExtractor={(item) => item.code}
        renderItem={renderCurrencyItem}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={listHeader}
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
  const maximumFractionDigits = resolveFractionDigits(
    ratio,
    RATE_DEFAULT_FRACTION_DIGITS
  );
  return ratio.toLocaleString(undefined, {
    minimumFractionDigits: RATE_DEFAULT_FRACTION_DIGITS,
    maximumFractionDigits,
  });
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: palette.background,
  },
  listContent: {
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.xl,
    gap: Theme.spacing.sm,
  },
  headerWrapper: {
    gap: Theme.spacing.lg,
  },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.xs,
  },
  backLabel: {
    fontSize: 14,
    color: palette.slate,
  },
  header: {
    gap: Theme.spacing.xs,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    color: palette.ink,
  },
  subtitle: {
    fontSize: 15,
    color: palette.inkMuted,
  },
  searchField: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Theme.spacing.sm,
    fontSize: 15,
    color: palette.ink,
  },
  errorText: {
    color: palette.accent,
    fontSize: 13,
  },
  loadingState: {
    alignItems: "center",
    gap: Theme.spacing.xs,
    paddingVertical: Theme.spacing.xl,
  },
  loadingLabel: {
    fontSize: 13,
    color: palette.slate,
  },
  row: {
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    gap: Theme.spacing.md,
  },
  rowActive: {
    backgroundColor: palette.background,
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  rowCode: {
    fontSize: 16,
    fontWeight: "600",
    color: palette.ink,
  },
  rowName: {
    fontSize: 14,
    color: palette.slate,
  },
  rowMeta: {
    alignItems: "flex-end",
    gap: 6,
  },
  rateLabel: {
    fontSize: 12,
    color: palette.slateSoft,
  },
  emptyText: {
    padding: Theme.spacing.lg,
    textAlign: "center",
    color: palette.slate,
  },
});
