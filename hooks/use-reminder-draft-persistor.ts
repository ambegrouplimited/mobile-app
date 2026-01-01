import { useCallback, useEffect, useRef } from "react";

import { createReminderDraft, updateReminderDraft } from "@/services/reminder-drafts";
import type { ReminderDraftMetadata } from "@/types/reminder-drafts";

type UseReminderDraftPersistorOptions = {
  token: string | null;
  draftId: string | null;
  onDraftId?: (id: string) => void;
  params: Record<string, string>;
  metadata?: ReminderDraftMetadata | null;
  lastStep: string;
  lastPath: string;
  enabled: boolean;
  debounceMs?: number;
};

type UseReminderDraftPersistorResult = {
  ensureDraftSaved: () => Promise<string | null>;
};

export function useReminderDraftPersistor(
  options: UseReminderDraftPersistorOptions,
): UseReminderDraftPersistorResult {
  const {
    token,
    draftId,
    onDraftId,
    params,
    metadata,
    lastStep,
    lastPath,
    enabled,
    debounceMs = 600,
  } = options;

  const latestPayloadRef = useRef({
    params,
    metadata,
    lastStep,
    lastPath,
  });
  latestPayloadRef.current = { params, metadata, lastStep, lastPath };

  const lastPersistedSignature = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const signature = JSON.stringify({
    params,
    metadata: metadata ?? null,
    lastStep,
    lastPath,
  });

  const persist = useCallback(async () => {
    if (!token || !enabled) {
      return draftId;
    }
    const payload = {
      params: latestPayloadRef.current.params,
      metadata: latestPayloadRef.current.metadata ?? undefined,
      last_step: latestPayloadRef.current.lastStep,
      last_path: latestPayloadRef.current.lastPath,
    };
    if (!draftId) {
      const created = await createReminderDraft(payload, token);
      onDraftId?.(created.id);
      lastPersistedSignature.current = JSON.stringify({
        params: payload.params,
        metadata: payload.metadata ?? null,
        lastStep: payload.last_step,
        lastPath: payload.last_path,
      });
      return created.id;
    }
    await updateReminderDraft(draftId, payload, token);
    lastPersistedSignature.current = JSON.stringify({
      params: payload.params,
      metadata: payload.metadata ?? null,
      lastStep: payload.last_step,
      lastPath: payload.last_path,
    });
    return draftId;
  }, [draftId, enabled, onDraftId, token]);

  useEffect(() => {
    if (!enabled || !token) {
      return;
    }
    if (signature === lastPersistedSignature.current) {
      return;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      persist().catch(() => {
        // Errors are surfaced through the manual ensureDraftSaved call.
      });
    }, debounceMs);
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [debounceMs, enabled, persist, signature, token]);

  const ensureDraftSaved = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    return persist();
  }, [persist]);

  return { ensureDraftSaved };
}
