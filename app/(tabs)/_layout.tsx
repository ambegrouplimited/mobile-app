import { Redirect, Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';

import { BottomTabBar } from '@/components/ui/bottom-tab-bar';
import { ScreenLoader } from '@/components/ui/screen-loader';
import { useAuth } from '@/providers/auth-provider';
import { hasCompletedOnboarding } from '@/lib/onboarding';

export default function TabLayout() {
  const { status, user } = useAuth();
  const [checkingOnboarding, setCheckingOnboarding] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (status !== 'authenticated' || !user?.id) {
      setCheckingOnboarding(false);
      setNeedsOnboarding(false);
      return () => {
        cancelled = true;
      };
    }
    setCheckingOnboarding(true);
    hasCompletedOnboarding(user.id)
      .then((done) => {
        if (!cancelled) {
          setNeedsOnboarding(!done);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNeedsOnboarding(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCheckingOnboarding(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [status, user?.id]);

  if (status === 'loading') {
    return <ScreenLoader label="Loading your workspace..." />;
  }

  if (status !== 'authenticated') {
    return <Redirect href="/welcome" />;
  }

  if (checkingOnboarding) {
    return <ScreenLoader label="Just a moment..." />;
  }

  if (needsOnboarding) {
    return <Redirect href="/onboarding/currency" />;
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
        name="messages"
        options={{
          title: 'Messages',
        }}
      />
    </Tabs>
  );
}
