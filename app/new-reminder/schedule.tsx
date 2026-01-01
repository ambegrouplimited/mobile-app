import { Feather } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerAndroid,
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Platform } from "react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Modal, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Theme } from "@/constants/theme";
import { useReminderDraftPersistor } from "@/hooks/use-reminder-draft-persistor";
import { useAuth } from "@/providers/auth-provider";

const MODES = ["manual", "weekly", "cadence"] as const;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CALENDAR_WEEKDAYS = WEEKDAYS;
const TONE_OPTIONS: ToneOption[] = ["gentle", "firm"];

function buildToneArray(count: number, fallback: ToneOption = "gentle") {
  return Array.from({ length: Math.max(1, count) }, () => fallback);
}

function resizeToneArray(tones: ToneOption[], count: number) {
  const safeCount = Math.max(1, count);
  if (tones.length === safeCount) {
    return tones;
  }
  if (tones.length > safeCount) {
    return tones.slice(0, safeCount);
  }
  const next = [...tones];
  while (next.length < safeCount) {
    next.push("gentle");
  }
  return next;
}

type ManualEntry = {
  id: string;
  date: string;
  time: string;
  tone: ToneOption;
};

type TimePickerTarget =
  | { target: "manual"; id: string }
  | { target: "weekly" }
  | { target: "cadence" }
  | null;

type ToneOption = "gentle" | "firm";

export default function ScheduleScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const rawParams = useLocalSearchParams<Record<string, string>>();
  const persistedParams = useMemo(() => normalizeParams(rawParams), [rawParams]);
  const draftId = persistedParams.draftId ?? null;
  const baseParams = useMemo(() => {
    const next = { ...persistedParams };
    delete next.draftId;
    return next;
  }, [persistedParams]);
  const { width: screenWidth } = useWindowDimensions();
  const [mode, setMode] = useState<(typeof MODES)[number]>("manual");
  const todayISO = useMemo(() => formatISODate(new Date()), []);
  const [manualTimes, setManualTimes] = useState<ManualEntry[]>([
    { id: "manual-0", date: todayISO, time: "09:00", tone: "gentle" },
  ]);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [weeklyDays, setWeeklyDays] = useState<number[]>([0, 2]);
  const [weeklyTime, setWeeklyTime] = useState("09:00");
  const [weeklyMax, setWeeklyMax] = useState("5");
  const [weeklyTones, setWeeklyTones] = useState<ToneOption[]>(() => buildToneArray(Number("5")));
  const [cadenceFreq, setCadenceFreq] = useState("4");
  const [cadenceStartDate, setCadenceStartDate] = useState("2025-04-05");
  const [cadenceStartTime, setCadenceStartTime] = useState("09:00");
  const [cadenceMax, setCadenceMax] = useState("5");
  const [cadenceTones, setCadenceTones] = useState<ToneOption[]>(() => buildToneArray(Number("5")));
  const hydratedRef = useRef(false);

  useEffect(() => {
    const count = Math.max(1, Number(weeklyMax) || 1);
    setWeeklyTones((prev) => resizeToneArray(prev, count));
  }, [weeklyMax]);

  useEffect(() => {
    const count = Math.max(1, Number(cadenceMax) || 1);
    setCadenceTones((prev) => resizeToneArray(prev, count));
  }, [cadenceMax]);

  useEffect(() => {
    if (hydratedRef.current) {
      return;
    }
    const modeParam = persistedParams.scheduleMode;
    const summaryRaw = persistedParams.scheduleSummary;
    if (modeParam && (MODES as readonly string[]).includes(modeParam as string)) {
      setMode(modeParam as (typeof MODES)[number]);
    }
    if (summaryRaw) {
      try {
        const summary = JSON.parse(summaryRaw);
        if (modeParam === "manual" && Array.isArray(summary.entries) && summary.entries.length) {
          setManualTimes(
            summary.entries.map((entry: any, index: number) => ({
              id: entry.id ?? `manual-${index}`,
              date: entry.date ?? todayISO,
              time: entry.time ?? "09:00",
              tone: (entry.tone as ToneOption) ?? "gentle",
            })),
          );
        } else if (modeParam === "weekly" && summary) {
          if (Array.isArray(summary.days) && summary.days.length) {
            setWeeklyDays(summary.days);
          }
          if (typeof summary.time === "string") {
            setWeeklyTime(summary.time);
          }
          if (summary.maxReminders) {
            setWeeklyMax(String(summary.maxReminders));
          }
          if (Array.isArray(summary.tones) && summary.tones.length) {
            setWeeklyTones(summary.tones as ToneOption[]);
          }
        } else if (modeParam === "cadence" && summary) {
          if (summary.frequencyDays) {
            setCadenceFreq(String(summary.frequencyDays));
          }
          if (summary.startDate) {
            setCadenceStartDate(summary.startDate);
          }
          if (summary.startTime) {
            setCadenceStartTime(summary.startTime);
          }
          if (summary.maxReminders) {
            setCadenceMax(String(summary.maxReminders));
          }
          if (Array.isArray(summary.tones) && summary.tones.length) {
            setCadenceTones(summary.tones as ToneOption[]);
          }
        }
      } catch {
        // Ignore malformed summary payloads.
      }
    }
    hydratedRef.current = true;
  }, [persistedParams.scheduleMode, persistedParams.scheduleSummary, todayISO]);

  const toggleWeeklyDay = (index: number) => {
    setWeeklyDays((prev) =>
      prev.includes(index)
        ? prev.filter((day) => day !== index)
        : [...prev, index].sort((a, b) => a - b),
    );
  };

  const updateManualTime = (id: string, value: string) => {
    setManualTimes((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, time: value } : entry)),
    );
  };

  const updateManualTone = (id: string, tone: ToneOption) => {
    setManualTimes((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, tone } : entry)),
    );
  };

  const removeManualTime = (id: string) => {
    setManualTimes((prev) => prev.filter((entry) => entry.id !== id));
  };

  const addManualDate = (dateISO: string) => {
    setManualTimes((prev) => {
      if (prev.some((entry) => entry.date === dateISO)) {
        return prev.filter((entry) => entry.date !== dateISO);
      }
      return [...prev, { id: `manual-${dateISO}`, date: dateISO, time: "09:00", tone: "gentle" }].sort((a, b) =>
        a.date.localeCompare(b.date),
      );
    });
  };

  const [timePickerValue, setTimePickerValue] = useState(() => parseTimeToDate("09:00"));
  const [timePickerTarget, setTimePickerTarget] = useState<TimePickerTarget>(null);

  const applyTime = (target: Exclude<TimePickerTarget, null>, date: Date) => {
    const formatted = formatTimeFromDate(date);
    if (target.target === "manual" && target.id) {
      updateManualTime(target.id, formatted);
    } else if (target.target === "weekly") {
      setWeeklyTime(formatted);
    } else if (target.target === "cadence") {
      setCadenceStartTime(formatted);
    }
  };

  const openTimePicker = (target: Exclude<TimePickerTarget, null>, fallback: string) => {
    const initial = parseTimeToDate(fallback);
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        mode: "time",
        value: initial,
        onChange: (event, date) => {
          if (event.type === "set" && date) {
            applyTime(target, date);
          }
        },
      });
      return;
    }
    setTimePickerValue(initial);
    setTimePickerTarget(target);
  };

  const confirmTimePicker = () => {
    if (!timePickerTarget) return;
    applyTime(timePickerTarget, timePickerValue);
    setTimePickerTarget(null);
  };

  const canContinue =
    (mode === "manual" && manualTimes.length > 0 && manualTimes.every((entry) => Boolean(entry.time.trim()))) ||
    (mode === "weekly" && weeklyDays.length > 0 && Boolean(weeklyTime.trim())) ||
    (mode === "cadence" && Number(cadenceFreq) > 0 && Boolean(cadenceStartTime.trim()));
  const scheduleSummaryPayload = useMemo(
    () =>
      buildScheduleSummaryPayload({
        mode,
        manualTimes,
        weeklyDays,
        weeklyTime,
        weeklyMax,
        weeklyTones,
        cadenceFreq,
        cadenceStartDate,
        cadenceStartTime,
        cadenceMax,
        cadenceTones,
      }),
    [
      cadenceFreq,
      cadenceMax,
      cadenceStartDate,
      cadenceStartTime,
      cadenceTones,
      manualTimes,
      mode,
      weeklyDays,
      weeklyMax,
      weeklyTime,
      weeklyTones,
    ],
  );
  const scheduleSummaryString = useMemo(
    () => JSON.stringify(scheduleSummaryPayload),
    [scheduleSummaryPayload],
  );
  const paramsForDraft = useMemo(() => {
    const next: Record<string, string> = { ...baseParams };
    next.scheduleMode = mode;
    next.scheduleSummary = scheduleSummaryString;
    return next;
  }, [baseParams, mode, scheduleSummaryString]);
  const metadata = useMemo(
    () => ({
      client_name: baseParams.client || "New reminder",
      amount_display: baseParams.amount || null,
      status:
        mode === "manual"
          ? `Manual (${manualTimes.length} dates)`
          : mode === "weekly"
            ? `Weekly cadence (${weeklyDays.length} days)`
            : `Cadence every ${cadenceFreq || "?"} days`,
      next_action: "Review the reminder summary.",
    }),
    [baseParams.amount, baseParams.client, cadenceFreq, manualTimes.length, mode, weeklyDays.length],
  );
  const { ensureDraftSaved } = useReminderDraftPersistor({
    token: session?.accessToken ?? null,
    draftId,
    params: paramsForDraft,
    metadata,
    lastStep: "schedule",
    lastPath: "/new-reminder/schedule",
    enabled: Boolean(session?.accessToken && draftId),
  });
  const handleReturnToReminders = () => {
    router.replace("/reminders");
  };
  const handleBack = () => {
    if (draftId) {
      router.push({
        pathname: "/new-reminder/payment-method",
        params: {
          ...baseParams,
          ...(draftId ? { draftId } : {}),
        },
      });
      return;
    }
    router.back();
  };

  const handleSaveSchedule = async () => {
    await Haptics.selectionAsync();
    const savedDraftId = await ensureDraftSaved();
    router.push({
      pathname: "/new-reminder/summary",
      params: {
        ...baseParams,
        scheduleMode: mode,
        scheduleSummary: scheduleSummaryString,
        ...(savedDraftId ? { draftId: savedDraftId } : {}),
      },
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.navRow}>
          <Pressable style={styles.backLink} onPress={handleBack}>
            <Feather name="arrow-left" size={24} color={Theme.palette.ink} />
            <Text style={styles.backLabel}>Back to payment method</Text>
          </Pressable>
          {draftId ? (
            <Pressable style={styles.remindersLink} onPress={handleReturnToReminders}>
              <Feather name="home" size={18} color={Theme.palette.slate} />
              <Text style={styles.remindersLabel}>Reminders</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Schedule reminders</Text>
          <Text style={styles.subtitle}>
            Choose how DueSoon should pace each follow-up. You can preview the queue before sending.
          </Text>
        </View>

        <View style={styles.modeRow}>
          {MODES.map((option) => {
            const active = mode === option;
            return (
              <Pressable
                key={option}
                onPress={() => setMode(option)}
                style={[styles.modeButton, active && styles.modeButtonActive]}
              >
                <Text style={[styles.modeLabel, active && styles.modeLabelActive]}>
                  {option === "manual"
                    ? "Manual"
                    : option === "weekly"
                      ? "Weekly"
                      : "Cadence"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {mode === "manual" ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Manual schedule</Text>
            <Text style={styles.sectionCopy}>
              Pick the calendar dates DueSoon should send a reminder. Tap a day to add it, then set the time below.
            </Text>
            <View style={styles.calendarHeader}>
              <Pressable onPress={() => setCalendarMonth((prev) => addMonths(prev, -1))}>
                <Feather name="chevron-left" size={20} color={Theme.palette.slate} />
              </Pressable>
              <Text style={styles.calendarMonthLabel}>{formatMonthLabel(calendarMonth)}</Text>
              <Pressable onPress={() => setCalendarMonth((prev) => addMonths(prev, 1))}>
                <Feather name="chevron-right" size={20} color={Theme.palette.slate} />
              </Pressable>
            </View>
            <View style={styles.calendarGrid}>
              <View style={styles.calendarRow}>
                {CALENDAR_WEEKDAYS.map((day) => (
                  <View key={day} style={styles.calendarWeekday}>
                    <Text style={styles.calendarWeekdayLabel}>{day}</Text>
                  </View>
                ))}
              </View>
              {chunkIntoWeeks(generateCalendarDays(calendarMonth)).map((week, rowIndex) => (
                <View key={`week-${rowIndex}`} style={styles.calendarRow}>
                  {week.map((cell) => {
                    if (!cell.date) {
                      return <View key={cell.key} style={styles.calendarCellEmpty} />;
                    }
                    const iso = formatISODate(cell.date);
                    const selected = manualTimes.some((entry) => entry.date === iso);
                    const disabled = cell.date < startOfToday();
                    return (
                      <Pressable
                        key={cell.key}
                        onPress={() => (!disabled ? addManualDate(iso) : undefined)}
                        style={[
                          styles.calendarCell,
                          !cell.inCurrentMonth && styles.calendarCellMuted,
                          selected && styles.calendarCellSelected,
                          disabled && styles.calendarCellDisabled,
                        ]}
                      >
                        <Text
                          style={[
                            styles.calendarCellLabel,
                            selected && styles.calendarCellLabelSelected,
                            disabled && styles.calendarCellLabelDisabled,
                          ]}
                        >
                          {cell.date.getDate()}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
            <View style={styles.manualList}>
              {manualTimes.map((entry) => (
                <View key={entry.id} style={styles.manualRow}>
                  <View style={styles.manualDateBlock}>
                    <Text style={styles.manualDateLabel}>{formatReadableDate(entry.date)}</Text>
                  </View>
                  <View style={styles.manualControls}>
                    <Pressable
                      style={styles.timeButton}
                      onPress={() => openTimePicker({ target: "manual", id: entry.id }, entry.time)}
                    >
                      <Text style={styles.timeButtonLabel}>{formatTimeLabel(entry.time)}</Text>
                    </Pressable>
                    <TonePicker value={entry.tone} onChange={(tone) => updateManualTone(entry.id, tone)} />
                  </View>
                  <Pressable onPress={() => removeManualTime(entry.id)} style={styles.removeButton}>
                    <Feather name="trash-2" size={16} color={Theme.palette.slate} />
                  </Pressable>
                </View>
              ))}
            </View>
            <Text style={styles.helper}>Times use your local timezone; DueSoon stores them as ISO datetimes.</Text>
          </View>
        ) : null}

        {mode === "weekly" ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Weekly pattern</Text>
            <Text style={styles.sectionCopy}>
              Pick the days DueSoon should nudge the client. We start from today and keep going until the limit.
            </Text>
            <View style={styles.weekdayGrid}>
              {WEEKDAYS.map((day, index) => {
                const active = weeklyDays.includes(index);
                return (
                  <Pressable
                    key={day}
                    onPress={() => toggleWeeklyDay(index)}
                    style={[styles.weekdayChip, active && styles.weekdayChipActive]}
                  >
                    <Text style={[styles.weekdayLabel, active && styles.weekdayLabelActive]}>{day}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Time of day</Text>
              <Pressable
                style={styles.timeButton}
                onPress={() => openTimePicker({ target: "weekly" }, weeklyTime)}
              >
                <Text style={styles.timeButtonLabel}>{formatTimeLabel(weeklyTime)}</Text>
              </Pressable>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Tone sequence</Text>
              <ToneSequencePicker
                count={Number(weeklyMax) || 1}
                value={weeklyTones}
                onChange={setWeeklyTones}
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Max reminders</Text>
              <TextInput
                style={styles.input}
                placeholder="5"
                value={weeklyMax}
                onChangeText={setWeeklyMax}
                keyboardType="numeric"
              />
            </View>
          </View>
        ) : null}

        {mode === "cadence" ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Cadence</Text>
            <Text style={styles.sectionCopy}>
              Choose a frequency in days. DueSoon schedules the first reminder on the start date and repeats.
            </Text>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Frequency (days)</Text>
              <TextInput
                style={styles.input}
                placeholder="4"
                keyboardType="numeric"
                value={cadenceFreq}
                onChangeText={setCadenceFreq}
              />
            </View>
            <View style={styles.fieldRow}>
              <View style={[styles.fieldGroup, styles.flexItem]}>
                <Text style={styles.fieldLabel}>Start date</Text>
                <TextInput
                  style={styles.input}
                  placeholder="2025-04-05"
                  value={cadenceStartDate}
                  onChangeText={setCadenceStartDate}
                />
              </View>
              <View style={[styles.fieldGroup, styles.flexItem]}>
                <Text style={styles.fieldLabel}>Start time</Text>
                <Pressable
                  style={styles.timeButton}
                  onPress={() => openTimePicker({ target: "cadence" }, cadenceStartTime)}
                >
                  <Text style={styles.timeButtonLabel}>{formatTimeLabel(cadenceStartTime)}</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Max reminders</Text>
              <TextInput
                style={styles.input}
                placeholder="5"
                value={cadenceMax}
                onChangeText={setCadenceMax}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Tone sequence</Text>
              <ToneSequencePicker
                count={Number(cadenceMax) || 1}
                value={cadenceTones}
                onChange={setCadenceTones}
              />
            </View>
          </View>
        ) : null}

        <Pressable
          style={[styles.primaryButton, !canContinue && styles.primaryButtonDisabled]}
          disabled={!canContinue}
          onPress={handleSaveSchedule}
        >
          <Text style={styles.primaryButtonText}>Save schedule</Text>
        </Pressable>
      </ScrollView>
      {Platform.OS === "ios" && timePickerTarget ? (
        <Modal animationType="fade" transparent visible>
          <View style={styles.timePickerOverlay}>
            <View style={[styles.timePickerCard, getTimePickerCardSize(screenWidth)]}>
              <View style={styles.timePickerBody}>
                <DateTimePicker
                  value={timePickerValue}
                  mode="time"
                  display="spinner"
                  themeVariant="light"
                  textColor={Theme.palette.ink}
                  onChange={(_, date) => date && setTimePickerValue(date)}
                  style={styles.timePicker}
                />
              </View>
              <View style={styles.timePickerActions}>
                <Pressable
                  style={[styles.timePickerButton, styles.timePickerButtonMuted]}
                  onPress={() => setTimePickerTarget(null)}
                >
                  <Text style={styles.timePickerButtonText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.timePickerButton} onPress={confirmTimePicker}>
                  <Text style={[styles.timePickerButtonText, styles.timePickerButtonTextPrimary]}>Set time</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Theme.palette.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.xl,
    gap: Theme.spacing.lg,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  remindersLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.xs,
  },
  remindersLabel: {
    fontSize: 14,
    color: Theme.palette.slate,
  },
  header: {
    gap: Theme.spacing.xs,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  subtitle: {
    fontSize: 15,
    color: Theme.palette.inkMuted,
    lineHeight: 22,
  },
  modeRow: {
    flexDirection: "row",
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    overflow: "hidden",
  },
  modeButton: {
    flex: 1,
    paddingVertical: Theme.spacing.sm,
    alignItems: "center",
    backgroundColor: Theme.palette.surface,
  },
  modeButtonActive: {
    backgroundColor: Theme.palette.slate,
  },
  modeLabel: {
    fontSize: 14,
    color: Theme.palette.slate,
  },
  modeLabelActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  card: {
    borderRadius: Theme.radii.lg,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    backgroundColor: "#FFFFFF",
    padding: Theme.spacing.lg,
    gap: Theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  sectionCopy: {
    fontSize: 14,
    color: Theme.palette.slate,
    lineHeight: 20,
  },
  manualList: {
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.sm,
  },
  manualRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.sm,
  },
  manualControls: {
    flex: 1,
    gap: Theme.spacing.sm,
  },
  manualControls: {
    flex: 1,
    gap: Theme.spacing.sm,
  },
  removeButton: {
    padding: Theme.spacing.xs,
  },
  toneToggleRow: {
    flexDirection: "row",
    gap: Theme.spacing.xs,
  },
  toneButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderRadius: Theme.radii.md,
    paddingVertical: Theme.spacing.xs,
    alignItems: "center",
  },
  toneButtonActive: {
    backgroundColor: Theme.palette.slate,
    borderColor: Theme.palette.slate,
  },
  toneButtonLabel: {
    fontSize: 13,
    color: Theme.palette.slate,
    textTransform: "capitalize",
  },
  toneButtonLabelActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  toneSequenceGrid: {
    gap: Theme.spacing.sm,
  },
  toneSequenceItem: {
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderRadius: Theme.radii.md,
    padding: Theme.spacing.sm,
    gap: Theme.spacing.xs,
  },
  toneSequenceLabel: {
    fontSize: 13,
    color: Theme.palette.slate,
  },
  weekdayGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.sm,
  },
  weekdayChip: {
    width: 60,
    borderRadius: Theme.radii.sm,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    paddingVertical: Theme.spacing.xs,
    alignItems: "center",
    backgroundColor: Theme.palette.surface,
  },
  weekdayChipActive: {
    backgroundColor: Theme.palette.slate,
    borderColor: Theme.palette.slate,
  },
  weekdayLabel: {
    fontSize: 13,
    color: Theme.palette.slate,
    fontWeight: "500",
  },
  weekdayLabelActive: {
    color: "#FFFFFF",
  },
  fieldGroup: {
    gap: Theme.spacing.xs,
    marginTop: Theme.spacing.sm,
  },
  fieldRow: {
    flexDirection: "row",
    gap: Theme.spacing.sm,
  },
  flexItem: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 13,
    color: Theme.palette.ink,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderRadius: Theme.radii.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    fontSize: 15,
    color: Theme.palette.ink,
  },
  fieldColumn: {
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.sm,
  },
  helper: {
    fontSize: 12,
    color: Theme.palette.slateSoft,
  },
  timePickerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  timePickerCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: Theme.radii.lg,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    gap: Theme.spacing.md,
    shadowColor: "#000000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  timePickerActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Theme.spacing.sm,
  },
  timePickerBody: {
    width: "100%",
    alignItems: "center",
  },
  timePicker: {
    width: "100%",
  },
  timePickerButton: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.radii.md,
    backgroundColor: Theme.palette.slate,
  },
  timePickerButtonMuted: {
    backgroundColor: Theme.palette.surface,
    borderWidth: 1,
    borderColor: Theme.palette.border,
  },
  timePickerButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  timePickerButtonTextPrimary: {
    color: "#FFFFFF",
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.radii.md,
    backgroundColor: Theme.palette.slate,
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Theme.spacing.sm,
  },
  calendarMonthLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  calendarGrid: {
    gap: Theme.spacing.xs,
    marginTop: Theme.spacing.sm,
  },
  calendarRow: {
    flexDirection: "row",
    gap: Theme.spacing.xs,
  },
  calendarWeekday: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  calendarWeekdayLabel: {
    fontSize: 12,
    color: Theme.palette.slate,
  },
  calendarCell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: Theme.radii.sm,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Theme.palette.border,
    backgroundColor: "#FFFFFF",
  },
  calendarCellMuted: {
    opacity: 0.5,
  },
  calendarCellSelected: {
    backgroundColor: Theme.palette.slate,
    borderColor: Theme.palette.slate,
  },
  calendarCellDisabled: {
    opacity: 0.35,
  },
  calendarCellEmpty: {
    flex: 1,
    aspectRatio: 1,
  },
  calendarCellLabel: {
    fontSize: 13,
    color: Theme.palette.ink,
  },
  calendarCellLabelSelected: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  calendarCellLabelDisabled: {
    color: Theme.palette.slateSoft,
  },
  manualDateBlock: {
    minWidth: 120,
  },
  manualDateLabel: {
    fontSize: 14,
    color: Theme.palette.ink,
    fontWeight: "500",
  },
  timeButton: {
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderRadius: Theme.radii.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    minWidth: 90,
    alignItems: "center",
    justifyContent: "center",
  },
  timeButtonLabel: {
    fontSize: 15,
    color: Theme.palette.ink,
    fontWeight: "500",
  },
});

function startOfMonth(value: Date) {
  const next = new Date(value);
  next.setDate(1);
  next.setHours(0, 0, 0, 0);
  return next;
}

function getTimePickerCardSize(screenWidth: number) {
  const maxWidth = Math.min(screenWidth - Theme.spacing.lg * 2, 360);
  return {
    width: maxWidth,
  };
}

function addMonths(value: Date, delta: number) {
  const next = new Date(value);
  next.setMonth(next.getMonth() + delta);
  return startOfMonth(next);
}

function formatISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatReadableDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

type CalendarCell = { key: string; date?: Date; inCurrentMonth?: boolean };

function generateCalendarDays(month: Date): CalendarCell[] {
  const firstDay = startOfMonth(month);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const startDate = new Date(firstDay);
  startDate.setDate(firstDay.getDate() - startOffset);
  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    cells.push({
      key: `${date.toISOString()}-${i}`,
      date,
      inCurrentMonth: date.getMonth() === month.getMonth(),
    });
  }
  return cells;
}

function chunkIntoWeeks(cells: CalendarCell[]) {
  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

function startOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function parseTimeToDate(time: string) {
  const [hours, minutes] = time.split(":").map((value) => Number(value) || 0);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function formatTimeFromDate(date: Date) {
  return date.toISOString().slice(11, 16);
}

function formatTimeLabel(value: string) {
  if (!value) return "Select time";
  const [hours, minutes] = value.split(":").map((v) => Number(v) || 0);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function TonePicker({ value, onChange }: { value: ToneOption; onChange: (tone: ToneOption) => void }) {
  return (
    <View style={styles.toneToggleRow}>
      {TONE_OPTIONS.map((tone) => {
        const active = tone === value;
        return (
          <Pressable
            key={tone}
            onPress={() => onChange(tone)}
            style={[styles.toneButton, active && styles.toneButtonActive]}
          >
            <Text style={[styles.toneButtonLabel, active && styles.toneButtonLabelActive]}>{tone}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ToneSequencePicker({
  count,
  value,
  onChange,
}: {
  count: number;
  value: ToneOption[];
  onChange: (tones: ToneOption[]) => void;
}) {
  const safeCount = Math.max(1, count);
  const padded = value.slice(0, safeCount);
  while (padded.length < safeCount) {
    padded.push("gentle");
  }

  return (
    <View style={styles.toneSequenceGrid}>
      {padded.map((tone, index) => (
        <View key={`tone-${index}`} style={styles.toneSequenceItem}>
          <Text style={styles.toneSequenceLabel}>#{index + 1}</Text>
          <TonePicker
            value={tone}
            onChange={(nextTone) =>
              onChange(
                padded.map((existing, idx) => (idx === index ? nextTone : existing)),
              )
            }
          />
        </View>
      ))}
    </View>
  );
}

type ScheduleSummaryInput = {
  mode: (typeof MODES)[number];
  manualTimes: ManualEntry[];
  weeklyDays: number[];
  weeklyTime: string;
  weeklyMax: string;
  weeklyTones: ToneOption[];
  cadenceFreq: string;
  cadenceStartDate: string;
  cadenceStartTime: string;
  cadenceMax: string;
  cadenceTones: ToneOption[];
};

function buildScheduleSummaryPayload(input: ScheduleSummaryInput) {
  if (input.mode === "manual") {
    return {
      entries: input.manualTimes.map((entry) => ({
        date: entry.date,
        time: entry.time,
        tone: entry.tone,
      })),
    };
  }
  if (input.mode === "weekly") {
    return {
      days: input.weeklyDays,
      time: input.weeklyTime,
      maxReminders: Number(input.weeklyMax) || 0,
      tones: input.weeklyTones,
    };
  }
  return {
    frequencyDays: Number(input.cadenceFreq) || 0,
    startDate: input.cadenceStartDate,
    startTime: input.cadenceStartTime,
    maxReminders: Number(input.cadenceMax) || 0,
    tones: input.cadenceTones,
  };
}

function normalizeParams(params: Record<string, string | string[]>) {
  const result: Record<string, string> = {};
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      result[key] = value[0] ?? "";
    } else if (typeof value === "string") {
      result[key] = value;
    }
  });
  return result;
}
