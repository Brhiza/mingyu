import { safeStorage } from '@/lib/safe-storage';

const ACTIVE_CASE_STORAGE_KEY = 'mingyu_active_personal_case_v1';
export const ACTIVE_CASE_EVENT = 'mingyu:active-case';

export function readActiveCaseId() {
  const value = safeStorage.get(ACTIVE_CASE_STORAGE_KEY)?.trim();
  return value || null;
}

export function saveActiveCaseId(caseId: string | null) {
  if (caseId) {
    safeStorage.set(ACTIVE_CASE_STORAGE_KEY, caseId);
  } else {
    safeStorage.remove(ACTIVE_CASE_STORAGE_KEY);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(ACTIVE_CASE_EVENT));
  }
}
