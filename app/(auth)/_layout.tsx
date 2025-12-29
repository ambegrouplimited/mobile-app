import { Stack, Redirect } from 'expo-router';

import { ScreenLoader } from '@/components/ui/screen-loader';
import { useAuth } from '@/providers/auth-provider';

export default function AuthLayout() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <ScreenLoader label="Preparing sign-in..." />;
  }

  if (status === 'authenticated') {
    return <Redirect href="/" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
