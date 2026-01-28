import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_PREFIX = "onboarding.complete.v1";

function keyForUser(userId: string) {
  return `${STORAGE_PREFIX}.${userId}`;
}

export async function hasCompletedOnboarding(userId: string): Promise<boolean> {
  if (!userId) {
    return false;
  }
  try {
    const value = await AsyncStorage.getItem(keyForUser(userId));
    return value === "done";
  } catch {
    return false;
  }
}

export async function markOnboardingComplete(userId: string): Promise<void> {
  if (!userId) {
    return;
  }
  try {
    await AsyncStorage.setItem(keyForUser(userId), "done");
  } catch {
    // ignore write failures
  }
}
