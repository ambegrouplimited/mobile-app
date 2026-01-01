import { GoogleSignin } from "@react-native-google-signin/google-signin";
import * as AuthSession from "expo-auth-session";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";

import { requestDevicePushToken } from "@/lib/push-notifications";
import {
  AuthUser,
  OAuthProvider,
  TokenResponse,
  exchangeAppleCode,
  exchangeGoogleCode,
  exchangeGoogleIdToken,
  getAuthorizationUrl,
  refreshAuthTokens,
  requestTwoFactorRecovery,
  confirmTwoFactorRecovery,
  updateCurrentUser,
  verifyTwoFactorCode,
} from "@/services/auth";
import { deletePushToken, registerPushToken } from "@/services/notifications";

type AuthStatus = "loading" | "unauthenticated" | "authenticated";

type SessionState = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  refreshExpiresAt: number;
  user: AuthUser;
};

type NotificationSettingsPayload = {
  push_notifications?: boolean;
  messages?: boolean;
  reminder_pre_notifications?: {
    enabled?: boolean;
    count?: number;
    lead_minutes?: number;
  };
};

type TwoFactorRecoveryState = {
  requested: boolean;
  sending: boolean;
  verifying: boolean;
  error: string | null;
};

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  session: SessionState | null;
  isAuthenticating: boolean;
  oauthReady: Record<OAuthProvider, boolean>;
  oauthLoading: Record<OAuthProvider, boolean>;
  error: string | null;
  loginWithGoogle: () => Promise<void>;
  loginWithApple: () => Promise<void>;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
  dismissError: () => void;
  twoFactorChallenge: AuthUser | null;
  submitTwoFactorCode: (code: string) => Promise<void>;
  cancelTwoFactorChallenge: () => void;
  twoFactorError: string | null;
  twoFactorVerifying: boolean;
  twoFactorRecovery: {
    requested: boolean;
    sending: boolean;
    verifying: boolean;
    error: string | null;
  };
  requestTwoFactorRecovery: () => Promise<void>;
  submitTwoFactorRecovery: (code: string) => Promise<void>;
  updateUserProfile: (payload: {
    name?: string;
    type?: string;
    notificationSettings?: NotificationSettingsPayload;
    channels?: Record<string, boolean>;
  }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const STORAGE_KEY = "duesoon.session";
const AUTH_DISABLED = false;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;
const INITIAL_TWO_FACTOR_RECOVERY_STATE: TwoFactorRecoveryState = {
  requested: false,
  sending: false,
  verifying: false,
  error: null,
};

async function storageGet() {
  if (await SecureStore.isAvailableAsync()) {
    return SecureStore.getItemAsync(STORAGE_KEY);
  }
  if (typeof window !== "undefined") {
    return window.localStorage.getItem(STORAGE_KEY);
  }
  return null;
}

async function storageSet(value: string) {
  if (await SecureStore.isAvailableAsync()) {
    return SecureStore.setItemAsync(STORAGE_KEY, value);
  }
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, value);
  }
}

async function storageDelete() {
  if (await SecureStore.isAvailableAsync()) {
    return SecureStore.deleteItemAsync(STORAGE_KEY);
  }
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

function toSessionState(payload: TokenResponse): SessionState {
  const now = Date.now();
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: now + payload.expires_in * 1000,
    refreshExpiresAt: now + payload.refresh_expires_in * 1000,
    user: payload.user,
  };
}

function createStateToken() {
  return Array.from({ length: 4 })
    .map(() => Math.random().toString(36).slice(2))
    .join("");
}

function getRedirectUri() {
  return AuthSession.makeRedirectUri({
    scheme: Platform.select({ web: undefined, default: "mobileapp" }),
  });
}

async function openAuthSessionAsync(
  authUrl: string,
  returnUrl: string
): Promise<AuthSession.AuthSessionResult> {
  const result = await WebBrowser.openAuthSessionAsync(authUrl, returnUrl);
  if (result.type !== "success" || !result.url) {
    return { type: result.type as AuthSession.AuthSessionResult["type"] };
  }
  const params = parseQueryParams(result.url);
  return {
    type: "success",
    params,
    url: result.url,
    authentication: null,
    errorCode: params.error ?? null,
  };
}

function parseQueryParams(url: string): Record<string, string> {
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

type OAuthSessionConfig = {
  authUrl: string;
  stateToken: string;
  redirectUri: string;
};

function DisabledAuthProvider({ children }: { children: ReactNode }) {
  const value = useMemo<AuthContextValue>(
    () => ({
      status: "authenticated",
      user: {
        id: "demo-user",
        email: "demo@duesoon.app",
        name: "DueSoon Demo",
        type: "freelancer",
        created_at: new Date().toISOString(),
      },
      session: null,
      isAuthenticating: false,
      oauthReady: { google: true, apple: true },
      oauthLoading: { google: false, apple: false },
      error: null,
      loginWithGoogle: async () => {},
      loginWithApple: async () => {},
      refreshSession: async () => {},
      logout: async () => {},
      dismissError: () => {},
      twoFactorChallenge: null,
      submitTwoFactorCode: async () => {},
      cancelTwoFactorChallenge: () => {},
      twoFactorError: null,
      twoFactorVerifying: false,
      twoFactorRecovery: {
        requested: false,
        sending: false,
        verifying: false,
        error: null,
      },
      requestTwoFactorRecovery: async () => {},
      submitTwoFactorRecovery: async () => {},
      updateUserProfile: async () => {},
    }),
    []
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (AUTH_DISABLED) {
    return <DisabledAuthProvider>{children}</DisabledAuthProvider>;
  }
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<SessionState | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oauthCache, setOauthCache] = useState<
    Record<OAuthProvider, OAuthSessionConfig | null>
  >({
    google: null,
    apple: null,
  });
  const [oauthLoading, setOauthLoading] = useState<
    Record<OAuthProvider, boolean>
  >({
    google: false,
    apple: false,
  });
  const [googleReady, setGoogleReady] = useState(false);
  const refreshInFlight = useRef(false);
  const pushTokenRef = useRef<string | null>(null);
  const pushRegistrationInFlight = useRef(false);
  const lastAuthTokenRef = useRef<string | null>(null);
  const [twoFactorChallengeState, setTwoFactorChallengeState] = useState<{
    token: string;
    user: AuthUser;
  } | null>(null);
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);
  const [twoFactorVerifying, setTwoFactorVerifying] = useState(false);
  const [twoFactorRecoveryState, setTwoFactorRecoveryState] =
    useState<TwoFactorRecoveryState>(INITIAL_TWO_FACTOR_RECOVERY_STATE);
  const resetTwoFactorRecoveryState = useCallback(() => {
    setTwoFactorRecoveryState(INITIAL_TWO_FACTOR_RECOVERY_STATE);
  }, []);

  useEffect(() => {
    if (!GOOGLE_WEB_CLIENT_ID) {
      console.warn(
        "Missing EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID for Google Sign-In."
      );
      return;
    }
    GoogleSignin.configure({
      iosClientId: GOOGLE_IOS_CLIENT_ID,
      webClientId: GOOGLE_WEB_CLIENT_ID,
      offlineAccess: true,
      forceCodeForRefreshToken: true,
    });
    setGoogleReady(true);
  }, []);

  const persistSession = useCallback(async (payload: TokenResponse) => {
    const nextSession = toSessionState(payload);
    setSession(nextSession);
    setStatus("authenticated");
    await storageSet(JSON.stringify(nextSession));
  }, []);

  const clearSession = useCallback(async () => {
    setSession(null);
    await storageDelete();
  }, []);

  const logout = useCallback(async () => {
    const tokenToRemove = pushTokenRef.current;
    const authForRemoval = lastAuthTokenRef.current;
    if (tokenToRemove && authForRemoval) {
      try {
        await deletePushToken(tokenToRemove, authForRemoval);
      } catch {
        // ignore
      } finally {
        pushTokenRef.current = null;
      }
    }
    // try {
    //   await GoogleSignin.signOut();
    // } catch {
    //   // ignore
    // }
    await clearSession();
    setStatus("unauthenticated");
    setTwoFactorChallengeState(null);
    setTwoFactorError(null);
    setTwoFactorVerifying(false);
    resetTwoFactorRecoveryState();
  }, [clearSession, resetTwoFactorRecoveryState]);

  const removeRegisteredPushToken = useCallback(async (authToken?: string) => {
    const token = pushTokenRef.current;
    if (!token || !authToken) {
      if (!authToken) {
        pushTokenRef.current = token;
      }
      return;
    }
    try {
      await deletePushToken(token, authToken);
    } catch (error) {
      console.warn("Failed to remove push token", error);
    } finally {
      if (pushTokenRef.current === token) {
        pushTokenRef.current = null;
      }
    }
  }, []);

  const updateUserProfile = useCallback(
    async (payload: {
      name?: string;
      type?: string;
      notificationSettings?: NotificationSettingsPayload;
      channels?: Record<string, boolean>;
    }) => {
      if (!session?.accessToken) {
        throw new Error("You need to be signed in to update your profile.");
      }
      const body: {
        name?: string;
        type?: string;
        notification_settings?: NotificationSettingsPayload;
        channels?: Record<string, boolean>;
      } = {};
      if (payload.name !== undefined) {
        body.name = payload.name.trim();
      }
      if (payload.type !== undefined) {
        body.type = payload.type;
      }
      if (payload.notificationSettings) {
        body.notification_settings = payload.notificationSettings;
      }
      if (payload.channels) {
        body.channels = payload.channels;
      }
      if (
        !body.name &&
        !body.type &&
        !body.notification_settings &&
        !body.channels
      ) {
        throw new Error("No changes to update.");
      }
      const updatedUser = await updateCurrentUser(body, session.accessToken);
      setSession((prev) => {
        if (!prev) return prev;
        const nextSession = { ...prev, user: updatedUser };
        storageSet(JSON.stringify(nextSession));
        return nextSession;
      });
    },
    [session?.accessToken]
  );

  const refreshWithToken = useCallback(
    async (tokenOverride?: string) => {
      const refreshToken = tokenOverride ?? session?.refreshToken;
      if (refreshInFlight.current || !refreshToken) {
        return;
      }
      refreshInFlight.current = true;
      try {
        const next = await refreshAuthTokens(refreshToken);
        await persistSession(next);
      } catch (refreshError) {
        await logout();
        throw refreshError;
      } finally {
        refreshInFlight.current = false;
      }
    },
    [logout, persistSession, session?.refreshToken]
  );

  const refreshSession = useCallback(async () => {
    await refreshWithToken();
  }, [refreshWithToken]);

  const restoreSession = useCallback(async () => {
    try {
      const stored = await storageGet();
      if (!stored) {
        setStatus("unauthenticated");
        return;
      }
      const parsed = JSON.parse(stored) as SessionState;
      if (!parsed.refreshToken || parsed.refreshExpiresAt <= Date.now()) {
        await clearSession();
        setStatus("unauthenticated");
        return;
      }
      setSession(parsed);
      setStatus("authenticated");
      if (parsed.expiresAt <= Date.now()) {
        await refreshWithToken(parsed.refreshToken);
      }
    } catch {
      await clearSession();
      setStatus("unauthenticated");
    }
  }, [clearSession, refreshWithToken]);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    lastAuthTokenRef.current = session?.accessToken ?? null;
  }, [session?.accessToken]);

  useEffect(() => {
    if (
      !session?.accessToken ||
      session.user.notification_settings?.push_notifications === false
    ) {
      return;
    }
    const subscription = Notifications.addPushTokenListener(
      async (tokenInfo) => {
        if (!session?.accessToken) {
          return;
        }
        const nextToken = tokenInfo.data;
        if (!nextToken || pushTokenRef.current === nextToken) {
          return;
        }
        const platform =
          Platform.OS === "android"
            ? "android"
            : Platform.OS === "ios"
            ? "ios"
            : "web";
        try {
          await registerPushToken(
            { token: nextToken, platform },
            session.accessToken
          );
          pushTokenRef.current = nextToken;
        } catch (error) {
          console.warn("Failed to refresh push token", error);
        }
      }
    );
    return () => {
      subscription.remove();
    };
  }, [
    session?.accessToken,
    session?.user.notification_settings?.push_notifications,
  ]);

  useEffect(() => {
    if (!session?.accessToken) {
      return;
    }
    const pushPreference =
      session.user.notification_settings?.push_notifications;
    let cancelled = false;
    const run = async () => {
      if (pushPreference === false) {
        await removeRegisteredPushToken(session.accessToken);
        return;
      }
      if (pushRegistrationInFlight.current || pushTokenRef.current) {
        return;
      }
      pushRegistrationInFlight.current = true;
      try {
        const deviceToken = await requestDevicePushToken();
        if (!deviceToken || cancelled) {
          return;
        }
        if (pushTokenRef.current === deviceToken.token) {
          return;
        }
        await registerPushToken(deviceToken, session.accessToken);
        pushTokenRef.current = deviceToken.token;
      } catch (error) {
        console.warn("Failed to register push token", error);
      } finally {
        pushRegistrationInFlight.current = false;
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [
    removeRegisteredPushToken,
    session?.accessToken,
    session?.user.notification_settings?.push_notifications,
  ]);

  useEffect(() => {
    if (!session) {
      return;
    }
    const msUntilRefresh = Math.max(
      session.expiresAt - Date.now() - 60 * 1000,
      5_000
    );
    const timeoutId = setTimeout(() => {
      refreshSession().catch(() => {
        // Refresh failures are handled inside refreshSession.
      });
    }, msUntilRefresh);
    return () => clearTimeout(timeoutId);
  }, [refreshSession, session]);

  const prefetchAuthUrl = useCallback(async (provider: OAuthProvider) => {
    if (provider === "google") {
      return null;
    }
    setOauthLoading((prev) => ({ ...prev, [provider]: true }));
    const stateToken = createStateToken();
    const redirectUri = getRedirectUri();
    try {
      let config: OAuthSessionConfig;
      if (provider === "google") {
        const pkce = await createPKCECodes();
        const authorizationUrl = buildGoogleAuthUrl({
          redirectUri,
          state: stateToken,
          codeChallenge: pkce.codeChallenge,
        });
        config = {
          authUrl: authorizationUrl,
          stateToken,
          redirectUri,
          codeVerifier: pkce.codeVerifier,
        };
      } else {
        const authorizationUrl = await getAuthorizationUrl(provider, {
          redirectUri,
          state: stateToken,
        });
        config = {
          authUrl: authorizationUrl,
          stateToken,
          redirectUri,
        };
      }
      setOauthCache((prev) => ({ ...prev, [provider]: config }));
      return config;
    } catch (prefetchError) {
      const message =
        prefetchError instanceof Error
          ? prefetchError.message
          : "Unable to prepare sign-in. Please try again.";
      setError(message);
      setOauthCache((prev) => ({ ...prev, [provider]: null }));
      return null;
    } finally {
      setOauthLoading((prev) => ({ ...prev, [provider]: false }));
    }
  }, []);

  useEffect(() => {
    prefetchAuthUrl("apple");
  }, [prefetchAuthUrl]);

  const loginWithGoogleNative = useCallback(async () => {
    if (!GOOGLE_WEB_CLIENT_ID) {
      setError("Google sign-in is not configured.");
      return;
    }
    setIsAuthenticating(true);
    setError(null);
    try {
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
      const result = await GoogleSignin.signIn();
      const { idToken } = await GoogleSignin.getTokens();
      if (!idToken) {
        throw new Error("Google did not return an ID token.");
      }
      const tokenPayload = await exchangeGoogleIdToken({
        idToken,
      });
      if (
        "two_factor_required" in tokenPayload &&
        tokenPayload.two_factor_required
      ) {
        setTwoFactorChallengeState({
          token: tokenPayload.two_factor_token,
          user: tokenPayload.user,
        });
        resetTwoFactorRecoveryState();
        setIsAuthenticating(false);
        return;
      }
      await persistSession(tokenPayload);
    } catch (authError) {
      const message =
        authError instanceof Error
          ? authError.message
          : "Something went wrong while signing you in.";
      setError(message);
      if (!session) {
        setStatus("unauthenticated");
      }
      throw authError;
    } finally {
      setIsAuthenticating(false);
    }
  }, [persistSession, resetTwoFactorRecoveryState, session]);

  const startOAuth = useCallback(
    async (provider: OAuthProvider) => {
      if (provider === "google") {
        throw new Error("Google OAuth handled via native SDK");
      }
      setIsAuthenticating(true);
      setError(null);
      try {
        let config = oauthCache[provider];
        if (!config) {
          config = await prefetchAuthUrl(provider);
        }
        if (!config) {
          throw new Error("Preparing sign-in. Please try again.");
        }
        const result = await openAuthSessionAsync(
          config.authUrl,
          config.redirectUri
        );

        if (result.type !== "success") {
          throw new Error("Sign-in was canceled.");
        }

        const { params } = result;
        if (params.state && params.state !== config.stateToken) {
          throw new Error("Unable to verify the authorization response.");
        }

        const code = params.code;
        if (!code) {
          throw new Error("Authorization code not returned.");
        }

        if (provider === "google" && !config.codeVerifier) {
          throw new Error("Missing secure token. Please try signing in again.");
        }

        const tokenPayload =
          provider === "google"
            ? await exchangeGoogleCode({
                code,
                redirectUri: config.redirectUri,
                codeVerifier: config.codeVerifier,
              })
            : await exchangeAppleCode({
                code,
                redirectUri: config.redirectUri,
                fullName: params.full_name,
              });

        if (
          "two_factor_required" in tokenPayload &&
          tokenPayload.two_factor_required
        ) {
          setTwoFactorChallengeState({
            token: tokenPayload.two_factor_token,
            user: tokenPayload.user,
          });
          resetTwoFactorRecoveryState();
          setTwoFactorError(null);
          return;
        }

        await persistSession(tokenPayload);
      } catch (authError) {
        const message =
          authError instanceof Error
            ? authError.message
            : "Something went wrong while signing you in.";
        setError(message);
        if (!session) {
          setStatus("unauthenticated");
        }
        throw authError;
      } finally {
        setIsAuthenticating(false);
        setOauthCache((prev) => ({ ...prev, [provider]: null }));
        prefetchAuthUrl(provider);
      }
    },
    [oauthCache, persistSession, prefetchAuthUrl, resetTwoFactorRecoveryState, session]
  );

  const submitTwoFactorCode = useCallback(
    async (code: string) => {
      if (!twoFactorChallengeState) {
        return;
      }
      setTwoFactorVerifying(true);
      setTwoFactorError(null);
      try {
        const payload = await verifyTwoFactorCode({
          twoFactorToken: twoFactorChallengeState.token,
          code: code.trim(),
        });
        setTwoFactorChallengeState(null);
        resetTwoFactorRecoveryState();
        await persistSession(payload);
      } catch (err) {
        setTwoFactorError(
          err instanceof Error
            ? err.message
            : "Unable to verify the code. Please try again."
        );
      } finally {
        setTwoFactorVerifying(false);
      }
    },
    [persistSession, resetTwoFactorRecoveryState, twoFactorChallengeState]
  );

  const cancelTwoFactorChallenge = useCallback(() => {
    setTwoFactorChallengeState(null);
    setTwoFactorError(null);
    resetTwoFactorRecoveryState();
  }, [resetTwoFactorRecoveryState]);

  const requestTwoFactorRecoveryHandler = useCallback(async () => {
    if (!twoFactorChallengeState) {
      return;
    }
    setTwoFactorRecoveryState((prev) => ({
      ...prev,
      sending: true,
      error: null,
    }));
    try {
      await requestTwoFactorRecovery(twoFactorChallengeState.token);
      setTwoFactorRecoveryState({
        requested: true,
        sending: false,
        verifying: false,
        error: null,
      });
    } catch (err) {
      setTwoFactorRecoveryState((prev) => ({
        ...prev,
        sending: false,
        error:
          err instanceof Error
            ? err.message
            : "Unable to send a recovery code right now.",
      }));
    }
  }, [twoFactorChallengeState]);

  const submitTwoFactorRecovery = useCallback(
    async (code: string) => {
      if (!twoFactorChallengeState) {
        return;
      }
      setTwoFactorRecoveryState((prev) => ({
        ...prev,
        verifying: true,
        error: null,
      }));
      try {
        const payload = await confirmTwoFactorRecovery({
          twoFactorToken: twoFactorChallengeState.token,
          emailCode: code.trim(),
        });
        setTwoFactorChallengeState(null);
        resetTwoFactorRecoveryState();
        await persistSession(payload);
      } catch (err) {
        setTwoFactorRecoveryState((prev) => ({
          ...prev,
          error:
            err instanceof Error
              ? err.message
              : "Unable to verify the recovery code.",
        }));
      } finally {
        setTwoFactorRecoveryState((prev) => ({
          ...prev,
          verifying: false,
        }));
      }
    },
    [persistSession, resetTwoFactorRecoveryState, twoFactorChallengeState]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      isAuthenticating,
      oauthReady: {
        google: googleReady,
        apple: Boolean(oauthCache.apple),
      },
      oauthLoading,
      error,
      loginWithGoogle: loginWithGoogleNative,
      loginWithApple: () => startOAuth("apple"),
      refreshSession,
      logout,
      dismissError: () => setError(null),
      twoFactorChallenge: twoFactorChallengeState?.user ?? null,
      submitTwoFactorCode,
      cancelTwoFactorChallenge,
      twoFactorError,
      twoFactorVerifying,
      twoFactorRecovery: twoFactorRecoveryState,
      requestTwoFactorRecovery: requestTwoFactorRecoveryHandler,
      submitTwoFactorRecovery,
      updateUserProfile,
    }),
    [
      cancelTwoFactorChallenge,
      error,
      googleReady,
      isAuthenticating,
      loginWithGoogleNative,
      logout,
      oauthCache,
      oauthLoading,
      refreshSession,
      session,
      startOAuth,
      status,
      submitTwoFactorCode,
      requestTwoFactorRecoveryHandler,
      submitTwoFactorRecovery,
      twoFactorChallengeState?.user,
      twoFactorError,
      twoFactorVerifying,
      twoFactorRecoveryState,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
