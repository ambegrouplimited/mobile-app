import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as AuthSession from "expo-auth-session";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Theme } from "@/constants/theme";
import { useAuth } from "@/providers/auth-provider";
import {
  SlackConversation,
  SlackStatus,
  SlackUser,
  SlackWorkspace,
  connectSlackAccount,
  disconnectSlackAccount,
  fetchSlackConversations,
  fetchSlackStatus,
  fetchSlackUsers,
} from "@/services/slack";

WebBrowser.maybeCompleteAuthSession();

const ENV_REDIRECT = process.env.EXPO_PUBLIC_GMAIL_REDIRECT_URL;

function getRedirectUri() {
  if (ENV_REDIRECT) {
    return ENV_REDIRECT;
  }
  return AuthSession.makeRedirectUri({
    scheme: "mobileapp",
  });
}

function parseParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  try {
    const parsed = new URL(url);
    parsed.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    if (parsed.hash) {
      const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ""));
      hashParams.forEach((value, key) => {
        params[key] = value;
      });
    }
    return params;
  } catch {
    const fallback = Linking.parse(url);
    Object.entries(fallback.queryParams ?? {}).forEach(([key, value]) => {
      if (typeof value === "string") {
        params[key] = value;
      }
    });
    return params;
  }
}

export default function SlackDetailsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [status, setStatus] = useState<SlackStatus | null>(null);
  const [selectedWorkspace, setSelectedWorkspace] = useState<SlackWorkspace | null>(null);
  const [conversations, setConversations] = useState<SlackConversation[]>([]);
  const [users, setUsers] = useState<SlackUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!session?.accessToken) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetchSlackStatus(session.accessToken);
      setStatus(response);
      setSelectedWorkspace((prev) => {
        if (prev) {
          return prev;
        }
        return response.workspaces[0] ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load Slack data.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const loadWorkspaceData = useCallback(
    async (workspace: SlackWorkspace) => {
      if (!session?.accessToken) {
        return;
      }
      setBrowsing(true);
      setError(null);
      try {
        const [convos, members] = await Promise.all([
          fetchSlackConversations(workspace.team_id, session.accessToken),
          fetchSlackUsers(workspace.team_id, session.accessToken),
        ]);
        setConversations(convos);
        setUsers(members);
        setSelectedWorkspace(workspace);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load workspace data.");
      } finally {
        setBrowsing(false);
      }
    },
    [session?.accessToken],
  );

  const connectWorkspace = useCallback(async () => {
    if (!session?.accessToken) {
      return;
    }
    setError(null);
    try {
      const redirectUri = getRedirectUri();
      const response = await fetchSlackStatus(session.accessToken, { redirectUri });
      const onboardingUrl = response.onboarding_url;
      if (!onboardingUrl) {
        throw new Error("Unable to start Slack consent flow.");
      }
      const result = await WebBrowser.openAuthSessionAsync(onboardingUrl, redirectUri);
      if (result.type !== "success" || !result.url) {
        throw new Error("Slack connection was canceled.");
      }
      const params = parseParams(result.url);
      const code = params.code;
      const state = params.state;
      if (!code || !state) {
        throw new Error("Slack did not return the required credentials.");
      }
      const workspace = await connectSlackAccount(
        {
          code,
          state,
          redirectUri,
        },
        session.accessToken,
      );
      await loadStatus();
      await loadWorkspaceData(workspace);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to connect Slack workspace.");
    }
  }, [loadStatus, loadWorkspaceData, session?.accessToken]);

  const disconnectWorkspace = useCallback(
    async (workspace: SlackWorkspace) => {
      if (!session?.accessToken) {
        return;
      }
      setError(null);
      try {
        await disconnectSlackAccount(workspace.team_id, session.accessToken);
        await loadStatus();
        if (selectedWorkspace?.team_id === workspace.team_id) {
          setSelectedWorkspace(null);
          setConversations([]);
          setUsers([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to disconnect workspace.");
      }
    },
    [loadStatus, selectedWorkspace, session?.accessToken],
  );

  const workspaces = status?.workspaces ?? [];

  const selectedInfo = useMemo(() => {
    if (!selectedWorkspace) {
      return "Select a workspace to browse channels and people.";
    }
    return `${selectedWorkspace.team_name ?? selectedWorkspace.team_id}`;
  }, [selectedWorkspace]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadStatus();
    } finally {
      setRefreshing(false);
    }
  }, [loadStatus]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Theme.palette.ink} />
        }
      >
        <View style={styles.header}>
          <Pressable style={styles.backLink} onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color={Theme.palette.ink} />
            <Text style={styles.backLabel}>Messaging connections</Text>
          </Pressable>
          <Text style={styles.title}>Slack workspaces</Text>
          <Text style={styles.subtitle}>
            {workspaces.length > 0
              ? `${workspaces.length} workspace${workspaces.length === 1 ? "" : "s"} connected`
              : "No workspaces connected yet."}
          </Text>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={styles.connectButton} onPress={connectWorkspace} disabled={loading}>
          <Text style={styles.connectButtonText}>Connect new workspace</Text>
        </Pressable>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connected workspaces</Text>
          {workspaces.length === 0 ? (
            <Text style={styles.emptyText}>No workspaces connected.</Text>
          ) : (
            workspaces.map((workspace) => (
              <View key={workspace.team_id} style={styles.workspaceCard}>
                <View style={styles.workspaceInfo}>
                  <Text style={styles.workspaceName}>{workspace.team_name ?? workspace.team_id}</Text>
                  <Text style={styles.workspaceDetail}>
                    Signed in as {workspace.authed_user_id ?? "user"}{" "}
                    {workspace.expires_at ? `· Expires ${new Date(workspace.expires_at).toLocaleDateString()}` : ""}
                  </Text>
                </View>
                <View style={styles.workspaceActions}>
                  <Pressable style={styles.secondaryButton} onPress={() => loadWorkspaceData(workspace)}>
                    <Text style={styles.secondaryButtonText}>
                      {browsing && selectedWorkspace?.team_id === workspace.team_id ? "Loading…" : "Browse"}
                    </Text>
                  </Pressable>
                  <Pressable style={styles.disconnectButton} onPress={() => disconnectWorkspace(workspace)}>
                    <Text style={styles.disconnectText}>Disconnect</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Workspace data</Text>
          <Text style={styles.sectionSubtitle}>{selectedInfo}</Text>
          {selectedWorkspace ? (
            <>
              <Text style={styles.listLabel}>Channels & DMs</Text>
              <FlatList
                data={conversations}
                scrollEnabled={false}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                renderItem={({ item }) => (
                  <View style={styles.listItem}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemDetail}>{`${item.type}${item.is_private ? " · private" : ""}`}</Text>
                  </View>
                )}
                ListEmptyComponent={<Text style={styles.emptyText}>No conversations found.</Text>}
              />
              <Text style={styles.listLabel}>People</Text>
              <FlatList
                data={users}
                scrollEnabled={false}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                renderItem={({ item }) => (
                  <View style={styles.listItem}>
                    <Text style={styles.itemName}>{item.real_name || item.name}</Text>
                    <Text style={styles.itemDetail}>
                      {item.display_name || item.name}
                      {item.is_bot ? " · Bot" : ""}
                    </Text>
                  </View>
                )}
                ListEmptyComponent={<Text style={styles.emptyText}>No users found.</Text>}
              />
            </>
          ) : (
            <Text style={styles.emptyText}>Select a workspace above to browse details.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Theme.palette.background,
  },
  container: {
    flexGrow: 1,
    padding: Theme.spacing.lg,
    gap: Theme.spacing.lg,
  },
  header: {
    gap: Theme.spacing.xs,
  },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.xs,
  },
  backLabel: {
    fontSize: 14,
    color: Theme.palette.slate,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  subtitle: {
    color: Theme.palette.slate,
  },
  error: {
    color: "#B3261E",
  },
  connectButton: {
    alignSelf: "flex-start",
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.radii.md,
    backgroundColor: Theme.palette.ink,
  },
  connectButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  section: {
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    backgroundColor: "#FFFFFF",
    padding: Theme.spacing.md,
    gap: Theme.spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  sectionSubtitle: {
    color: Theme.palette.slate,
  },
  emptyText: {
    color: Theme.palette.slate,
    fontSize: 13,
  },
  workspaceCard: {
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    padding: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  workspaceInfo: {
    gap: 2,
  },
  workspaceName: {
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  workspaceDetail: {
    color: Theme.palette.slate,
    fontSize: 13,
  },
  workspaceActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.sm,
  },
  secondaryButton: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: Theme.palette.border,
  },
  secondaryButtonText: {
    color: Theme.palette.ink,
    fontWeight: "600",
  },
  disconnectButton: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.radii.md,
    backgroundColor: Theme.palette.surface,
  },
  disconnectText: {
    color: Theme.palette.ink,
    fontWeight: "600",
  },
  list: {
    gap: Theme.spacing.sm,
  },
  listLabel: {
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  listItem: {
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    padding: Theme.spacing.sm,
  },
  itemName: {
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  itemDetail: {
    color: Theme.palette.slate,
    fontSize: 13,
  },
});
