import { sendTextToPreferredAndroidAiApp } from '@/lib/android-ai-app';

export type ShareTextResult =
  { type: 'app'; label: string } | { type: 'system' } | { type: 'unavailable' };

export async function shareText(text: string): Promise<ShareTextResult> {
  const target = await sendTextToPreferredAndroidAiApp(text);
  if (target) {
    return { type: 'app', label: target.label };
  }

  if (navigator.share) {
    await navigator.share({ text });
    return { type: 'system' };
  }

  return { type: 'unavailable' };
}
