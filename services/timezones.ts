import { apiFetch } from "@/lib/api-client";

export type TimezoneInfo = {
  name: string;
  label: string;
  offset_minutes: number;
};

let cachedTimezones: TimezoneInfo[] | null = null;
let inflight: Promise<TimezoneInfo[]> | null = null;

export async function fetchTimezones(): Promise<TimezoneInfo[]> {
  if (cachedTimezones) {
    return cachedTimezones;
  }
  if (inflight) {
    return inflight;
  }
  inflight = apiFetch<TimezoneInfo[]>("/api/timezones").then((data) => {
    cachedTimezones = data;
    inflight = null;
    return data;
  });
  return inflight;
}
