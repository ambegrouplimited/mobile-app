import { Feather } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Theme } from "@/constants/theme";

type MissingDetailsModalProps = {
  visible: boolean;
  missingFields: string[];
  dueDateLabel: string;
  hasDueDate: boolean;
  onPressDueDate: () => void;
  notesValue: string;
  onChangeNotes: (value: string) => void;
  onSkip: () => void;
  onSave: () => void;
  onRequestClose?: () => void;
};

export function MissingDetailsModal({
  visible,
  missingFields,
  dueDateLabel,
  hasDueDate,
  onPressDueDate,
  notesValue,
  onChangeNotes,
  onSkip,
  onSave,
  onRequestClose,
}: MissingDetailsModalProps) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onRequestClose}>
      <View style={styles.quickModalOverlay}>
        <View style={styles.quickModalCard}>
          <Text style={styles.quickModalTitle}>Missing details</Text>
          <Text style={styles.quickModalSubtitle}>
            {missingFields.join(" and ")} {missingFields.length > 1 ? "are" : "is"} empty. Add them here or skip.
          </Text>
          <View style={styles.quickFieldGroup}>
            <Text style={styles.fieldLabel}>Due date</Text>
            <Pressable style={styles.dateButton} onPress={onPressDueDate}>
              <View style={styles.dateButtonContent}>
                <Feather name="calendar" size={18} color={Theme.palette.slate} />
                <Text style={[styles.dateButtonText, !hasDueDate && styles.dateButtonPlaceholder]}>
                  {dueDateLabel}
                </Text>
              </View>
            </Pressable>
          </View>
          <View style={styles.quickFieldGroup}>
            <Text style={styles.fieldLabel}>Client notes</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Add context, project references, or preferences."
              placeholderTextColor={Theme.palette.slateSoft}
              value={notesValue}
              onChangeText={onChangeNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
          <View style={styles.quickActions}>
            <Pressable style={styles.quickActionMuted} onPress={onSkip}>
              <Text style={styles.quickActionMutedText}>Skip</Text>
            </Pressable>
            <Pressable style={styles.quickActionPrimary} onPress={onSave}>
              <Text style={styles.quickActionPrimaryText}>Save & continue</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  quickModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: Theme.spacing.lg,
  },
  quickModalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: Theme.radii.lg,
    backgroundColor: "#FFFFFF",
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  quickModalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  quickModalSubtitle: {
    fontSize: 14,
    color: Theme.palette.slate,
    lineHeight: 20,
  },
  quickFieldGroup: {
    gap: Theme.spacing.xs,
  },
  fieldLabel: {
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: Theme.palette.slate,
  },
  dateButton: {
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderRadius: Theme.radii.md,
    padding: Theme.spacing.sm,
    backgroundColor: "#FFFFFF",
  },
  dateButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.sm,
  },
  dateButtonText: {
    fontSize: 15,
    color: Theme.palette.ink,
  },
  dateButtonPlaceholder: {
    color: Theme.palette.slateSoft,
  },
  textArea: {
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderRadius: Theme.radii.md,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    fontSize: 15,
    color: Theme.palette.ink,
    minHeight: 96,
  },
  quickActions: {
    flexDirection: "row",
    gap: Theme.spacing.sm,
  },
  quickActionMuted: {
    flex: 1,
    paddingVertical: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderRadius: Theme.radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionMutedText: {
    fontSize: 15,
    color: Theme.palette.slate,
  },
  quickActionPrimary: {
    flex: 1,
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.radii.md,
    backgroundColor: Theme.palette.slate,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionPrimaryText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
