import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, Text, View } from 'react-native';

import { Theme } from '@/constants/theme';

export default function ReminderDraftModal() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Reminder draft</Text>
        <Text style={styles.subtitle}>
          Use this space to preview or refine the copy before DueSoon sends it on your behalf. Keep the tone neutral and
          confident—no emojis, no pressure.
        </Text>
        <View style={styles.exampleBox}>
          <Text style={styles.exampleLabel}>Subject</Text>
          <Text style={styles.exampleValue}>Gentle update on invoice #1042</Text>
          <Text style={styles.exampleLabel}>Body</Text>
          <Text style={styles.exampleBody}>
            Hello Jamie,{'\n\n'}Hope you’re well. This is a quick note that the $2,400 invoice for the discovery sprint
            is now 5 days past the due date. Payment links are below—let me know if you need anything else.
            {'\n\n'}Thanks!
          </Text>
        </View>
        <Text style={styles.footer}>Send only when you’re ready—the sequence pauses until you confirm.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Theme.palette.background,
  },
  container: {
    flex: 1,
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: '500',
    color: Theme.palette.ink,
  },
  subtitle: {
    fontSize: 15,
    color: Theme.palette.inkMuted,
    lineHeight: 22,
  },
  exampleBox: {
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderRadius: Theme.radii.lg,
    padding: Theme.spacing.lg,
    gap: Theme.spacing.sm,
    backgroundColor: Theme.palette.surface,
  },
  exampleLabel: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    color: Theme.palette.slateSoft,
  },
  exampleValue: {
    fontSize: 16,
    fontWeight: '500',
    color: Theme.palette.ink,
  },
  exampleBody: {
    fontSize: 15,
    color: Theme.palette.slate,
    lineHeight: 22,
  },
  footer: {
    fontSize: 13,
    color: Theme.palette.slateSoft,
  },
});
