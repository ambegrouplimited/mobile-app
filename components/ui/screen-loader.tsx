import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Theme } from '@/constants/theme';

export function ScreenLoader({ label = 'Loading...' }: { label?: string }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="small" color={Theme.palette.slate} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Theme.palette.background,
    gap: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.lg,
  },
  label: {
    fontSize: 15,
    color: Theme.palette.inkMuted,
  },
});
