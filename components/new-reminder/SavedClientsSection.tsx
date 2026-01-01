import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { memo } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Theme } from "@/constants/theme";
import {
  contactLogoForMethod,
  formatMethodLabel,
  getContactSummary,
} from "@/lib/contact-methods";
import type { Client, ContactMethod } from "@/types/clients";

type SavedClientsSectionProps = {
  clients: Client[];
  loading: boolean;
  error: string | null;
  onSelect?: (client: Client, method: ContactMethod) => void;
  limit?: number;
  maxContactsPerClient?: number;
  title?: string;
  hint?: string;
  actionLabel?: string;
  onPressAction?: () => void;
  showWhenEmpty?: boolean;
  emptyText?: string;
  showSearch?: boolean;
  searchValue?: string;
  onChangeSearch?: (value: string) => void;
  searchPlaceholder?: string;
};

export const SavedClientsSection = memo(function SavedClientsSection({
  clients,
  loading,
  error,
  onSelect,
  limit,
  maxContactsPerClient = 3,
  title = "Use an existing client",
  hint = "Tap any card to reuse its contact details.",
  actionLabel,
  onPressAction,
  showWhenEmpty = false,
  emptyText = "No saved clients yet.",
  showSearch = false,
  searchValue = "",
  onChangeSearch,
  searchPlaceholder = "Search saved clients",
}: SavedClientsSectionProps) {
  if ((!clients.length && !loading && !error && !showWhenEmpty) || !onSelect) {
    return null;
  }

  const limited = typeof limit === "number" ? clients.slice(0, limit) : clients;

  return (
    <View style={styles.savedSection}>
      <View style={styles.savedClientHeader}>
        <Text style={styles.savedClientsTitle}>{title}</Text>
        <View style={styles.headerActions}>
          {actionLabel ? (
            <Pressable
              hitSlop={8}
              onPress={onPressAction}
              style={styles.savedClientsActionButton}
            >
              <Text style={styles.savedClientsAction}>{actionLabel}</Text>
            </Pressable>
          ) : null}
          {loading ? (
            <Text style={styles.savedClientsBadge}>Loading…</Text>
          ) : null}
        </View>
      </View>
      {hint ? <Text style={styles.savedClientsHint}>{hint}</Text> : null}
      {error ? <Text style={styles.savedClientsError}>{error}</Text> : null}
      {showSearch ? (
        <View style={styles.searchField}>
          <Feather name="search" size={16} color={Theme.palette.slateSoft} />
          <TextInput
            style={styles.searchInput}
            placeholder={searchPlaceholder}
            placeholderTextColor={Theme.palette.slateSoft}
            value={searchValue}
            onChangeText={onChangeSearch}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>
      ) : null}
      <View style={styles.savedClientsList}>
        {!loading && !error
          ? limited.length === 0
            ? (
                <Text style={styles.emptyText}>{emptyText}</Text>
              )
            : limited.map((client) => (
              <View key={client.id} style={styles.savedClientCard}>
                <View style={styles.savedClientHeader}>
                  <View>
                    <Text style={styles.savedClientName}>{client.name}</Text>
                    {client.company_name ? (
                      <Text style={styles.savedClientMeta}>
                        {client.company_name}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.savedClientsBadge}>
                    {client.contact_methods?.length ?? 0} contacts
                  </Text>
                </View>
                {client.contact_methods?.length ? (
                  client.contact_methods
                    .slice(0, maxContactsPerClient)
                    .map((method) => (
                      <Pressable
                        key={method.id}
                        style={styles.contactRow}
                        onPress={() => onSelect(client, method)}
                      >
                        <View style={styles.contactRowContent}>
                          <View style={styles.contactLogoWrap}>
                            <Image
                              source={{ uri: contactLogoForMethod(method.type) }}
                              style={styles.contactLogo}
                              contentFit="contain"
                            />
                          </View>
                          <View style={styles.contactRowInfo}>
                            <Text style={styles.contactLabel}>
                              {method.label || formatMethodLabel(method)}
                            </Text>
                            <Text style={styles.contactDetail}>
                              {getContactSummary(method)}
                            </Text>
                          </View>
                        </View>
                        <Feather
                          name="chevron-right"
                          size={18}
                          color={Theme.palette.slate}
                        />
                      </Pressable>
                    ))
                ) : (
                  <Text style={styles.savedClientMeta}>
                    No contact methods yet.
                  </Text>
                )}
              </View>
            ))
          : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  savedSection: {
    gap: Theme.spacing.sm,
  },
  savedClientHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: Theme.spacing.sm,
  },
  savedClientsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  savedClientsHint: {
    fontSize: 13,
    color: Theme.palette.slate,
  },
  savedClientsBadge: {
    fontSize: 12,
    color: Theme.palette.slateSoft,
  },
  savedClientsList: {
    gap: Theme.spacing.sm,
  },
  savedClientCard: {
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderRadius: Theme.radii.lg,
    padding: Theme.spacing.lg,
    backgroundColor: "#FFFFFF",
    gap: Theme.spacing.sm,
  },
  savedClientName: {
    fontSize: 16,
    fontWeight: "500",
    color: Theme.palette.ink,
  },
  savedClientMeta: {
    fontSize: 14,
    color: Theme.palette.slate,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderRadius: Theme.radii.md,
    backgroundColor: Theme.palette.surface,
    marginTop: Theme.spacing.xs,
  },
  contactRowContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.sm,
    flex: 1,
  },
  contactLogoWrap: {
    width: 36,
    height: 36,
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  contactLogo: {
    width: 24,
    height: 24,
  },
  contactRowInfo: {
    flex: 1,
    gap: 2,
  },
  contactLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  contactDetail: {
    fontSize: 12,
    color: Theme.palette.slate,
  },
  savedClientsError: {
    fontSize: 13,
    color: Theme.palette.accent,
  },
  emptyText: {
    fontSize: 14,
    color: Theme.palette.slate,
  },
  searchField: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
    gap: Theme.spacing.sm,
    backgroundColor: "#FFFFFF",
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Theme.palette.ink,
  },
  savedClientsAction: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.palette.slate,
  },
  savedClientsActionButton: {
    paddingVertical: Theme.spacing.xxs,
    paddingHorizontal: Theme.spacing.xs,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.xs,
  },
});
