import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Theme } from '@/constants/theme';

type Variant = 'accent' | 'outline';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant: Variant;
  icon: ReactNode;
  iconColor: string;
};

export function AuthButton({ label, onPress, disabled, loading, variant, icon, iconColor }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        variant === 'accent' ? styles.accent : styles.outline,
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}>
      <View style={styles.icon}>{loading ? <ActivityIndicator size="small" color={iconColor} /> : icon}</View>
      <Text style={[styles.label, variant === 'accent' ? styles.labelAccent : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: Theme.radii.md,
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    width: '100%',
  },
  accent: {
    backgroundColor: Theme.palette.accent,
  },
  outline: {
    borderWidth: 1,
    borderColor: Theme.palette.border,
    backgroundColor: Theme.palette.background,
  },
  pressed: {
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.65,
  },
  icon: {
    width: 24,
    alignItems: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: Theme.palette.ink,
  },
  labelAccent: {
    color: '#FFFFFF',
  },
});
