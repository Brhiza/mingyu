import { Capacitor, registerPlugin } from '@capacitor/core';
import { safeStorage } from '@/lib/safe-storage';

export interface AndroidAiAppTarget {
  packageName: string;
  activityName: string;
  label: string;
}

interface AndroidAiAppLauncherPlugin {
  listTargets(): Promise<{ targets: AndroidAiAppTarget[] }>;
  sendText(options: { packageName: string; activityName: string; text: string }): Promise<void>;
}

const AndroidAiAppLauncher = registerPlugin<AndroidAiAppLauncherPlugin>('AndroidAiAppLauncher');

const ANDROID_AI_APP_STORAGE_KEY = 'mingyu:android-ai-app:v1';
export const ANDROID_AI_APP_EVENT = 'mingyu:android-ai-app-change';

export function isAndroidApp(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export function normalizeAndroidAiAppTarget(value: unknown): AndroidAiAppTarget | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<AndroidAiAppTarget>;
  const packageName = typeof raw.packageName === 'string' ? raw.packageName.trim() : '';
  const activityName = typeof raw.activityName === 'string' ? raw.activityName.trim() : '';
  const label = typeof raw.label === 'string' ? raw.label.trim() : '';
  if (!packageName || !activityName || !label) return null;
  if (packageName.length > 240 || activityName.length > 500 || label.length > 120) return null;
  return { packageName, activityName, label };
}

export function getAndroidAiAppTargetKey(target: AndroidAiAppTarget): string {
  return `${target.packageName}\n${target.activityName}`;
}

export function readPreferredAndroidAiApp(): AndroidAiAppTarget | null {
  return normalizeAndroidAiAppTarget(
    safeStorage.getJSON<AndroidAiAppTarget | null>(ANDROID_AI_APP_STORAGE_KEY, null),
  );
}

export function savePreferredAndroidAiApp(target: AndroidAiAppTarget | null): void {
  const normalized = normalizeAndroidAiAppTarget(target);
  if (normalized) {
    safeStorage.setJSON(ANDROID_AI_APP_STORAGE_KEY, normalized);
  } else {
    safeStorage.remove(ANDROID_AI_APP_STORAGE_KEY);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(ANDROID_AI_APP_EVENT));
  }
}

export async function listAndroidAiApps(): Promise<AndroidAiAppTarget[]> {
  if (!isAndroidApp()) return [];
  const result = await AndroidAiAppLauncher.listTargets();
  const unique = new Map<string, AndroidAiAppTarget>();
  for (const item of Array.isArray(result.targets) ? result.targets : []) {
    const normalized = normalizeAndroidAiAppTarget(item);
    if (normalized) unique.set(getAndroidAiAppTargetKey(normalized), normalized);
  }
  return [...unique.values()];
}

export async function sendTextToPreferredAndroidAiApp(
  text: string,
): Promise<AndroidAiAppTarget | null> {
  if (!isAndroidApp()) return null;
  const target = readPreferredAndroidAiApp();
  if (!target) return null;

  try {
    await AndroidAiAppLauncher.sendText({
      packageName: target.packageName,
      activityName: target.activityName,
      text,
    });
    return target;
  } catch {
    throw new Error('打开失败，请重新设置');
  }
}
