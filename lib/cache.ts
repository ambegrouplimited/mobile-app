import * as SecureStore from 'expo-secure-store';

type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

export async function getCachedValue<T>(key: string): Promise<T | null> {
  try {
    const stored = await SecureStore.getItemAsync(key);
    if (!stored) {
      return null;
    }
    const parsed = JSON.parse(stored) as CacheEntry<T>;
    return parsed.data;
  } catch (error) {
    console.warn(`Failed to read cache for ${key}`, error);
    return null;
  }
}

export async function setCachedValue<T>(key: string, data: T): Promise<void> {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
    };
    await SecureStore.setItemAsync(key, JSON.stringify(entry));
  } catch (error) {
    console.warn(`Failed to write cache for ${key}`, error);
  }
}

export async function clearCachedValue(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (error) {
    console.warn(`Failed to clear cache for ${key}`, error);
  }
}
