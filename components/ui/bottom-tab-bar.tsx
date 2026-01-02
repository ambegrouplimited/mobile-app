import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Theme } from '@/constants/theme';

const ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  index: 'bar-chart-2',
  'new-reminder': 'plus-circle',
  reminders: 'mail',
  messages: 'message-circle',
  settings: 'settings',
};

const LABELS: Record<string, string> = {
  index: 'Dashboard',
  'new-reminder': 'New reminder',
  reminders: 'Reminders',
  messages: 'Messages',
  settings: 'Settings',
};

export function BottomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, Theme.spacing.lg) }]}>
      <View style={styles.shell}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const iconName = ICONS[route.name];
          const label = LABELS[route.name] ?? route.name;
          const tint = isFocused ? Theme.palette.slate : Theme.palette.slateSoft;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) {
              void Haptics.selectionAsync();
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          if (!iconName) {
            return null;
          }

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              onPress={onPress}
              onLongPress={onLongPress}
              style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}>
              <Feather name={iconName} size={22} color={tint} />
              <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: Theme.spacing.lg,
    backgroundColor: Theme.palette.background,
  },
  shell: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: Theme.radii.lg * 1.2,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.sm,
    gap: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: Theme.palette.border,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Theme.spacing.xs,
  },
  itemPressed: {
    opacity: 0.7,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
  },
});
