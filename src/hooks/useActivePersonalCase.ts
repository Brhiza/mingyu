import { useCallback, useEffect, useMemo, useState } from 'react';
import { ACTIVE_CASE_EVENT, readActiveCaseId, saveActiveCaseId } from '@/lib/active-case';
import {
  HISTORY_RECORDS_EVENT,
  loadPersonalHistory,
  touchPersonalHistoryUsage,
} from '@/lib/history-records';

export function useActivePersonalCase() {
  const [revision, setRevision] = useState(0);
  const storedCaseId = readActiveCaseId();
  const cases = useMemo(() => {
    void revision;
    return loadPersonalHistory();
  }, [revision]);
  const activeCase = cases.find((record) => record.id === storedCaseId) ?? null;

  useEffect(() => {
    const sync = () => setRevision((current) => current + 1);
    window.addEventListener('storage', sync);
    window.addEventListener(ACTIVE_CASE_EVENT, sync);
    window.addEventListener(HISTORY_RECORDS_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(ACTIVE_CASE_EVENT, sync);
      window.removeEventListener(HISTORY_RECORDS_EVENT, sync);
    };
  }, []);

  useEffect(() => {
    if (storedCaseId && !activeCase) {
      saveActiveCaseId(null);
    }
  }, [activeCase, storedCaseId]);

  const selectCase = useCallback((caseId: string | null) => {
    if (caseId) {
      touchPersonalHistoryUsage(caseId);
    }
    saveActiveCaseId(caseId);
  }, []);

  return {
    cases,
    activeCase,
    activeCaseId: activeCase?.id ?? null,
    selectCase,
  };
}
