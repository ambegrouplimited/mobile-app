import { Redirect, Tabs } from 'expo-router';
import React from 'react';

import { BottomTabBar } from '@/components/ui/bottom-tab-bar';
import { ScreenLoader } from '@/components/ui/screen-loader';
import { useAuth } from '@/providers/auth-provider';

export default function TabLayout() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <ScreenLoader label="Loading your workspace..." />;
  }

  if (status !== 'authenticated') {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <BottomTabBar {...props} />}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
        }}
      />
      <Tabs.Screen
        name="new-reminder"
        options={{
          title: 'New reminder',
        }}
      />
      <Tabs.Screen
        name="reminders"
        options={{
          title: 'Reminders',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
        }}
      />
    </Tabs>
  );
}
