import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { DivinationMethodId } from 'mingyu-core/divination/config';
import { DivinationPanel } from '@/components/DivinationPanel';
import { PageTopbar } from '@/components/PageTopbar';
import { PrivacyHint } from '@/components/PrivacyHint';
import { useAppPreferences } from '@/hooks/useAppPreferences';
import { getDivinationHistoryById } from '@/lib/history-records';
import { getWorkspaceNavigationItem, isWorkspaceEntryId } from '@/lib/workspace-navigation';

function resolveDivinationMethod(value: string | null, fallback: DivinationMethodId) {
  if (!isWorkspaceEntryId(value)) return fallback;
  const item = getWorkspaceNavigationItem(value);
  return item.kind === 'divination' && item.method ? item.method : fallback;
}

export function DivinationInputPage() {
  const [searchParams] = useSearchParams();
  const [preferences] = useAppPreferences();
  const method = resolveDivinationMethod(
    searchParams.get('method'),
    preferences.defaultDivinationMethod,
  );

  return (
    <div className="page-shell input-page-shell divination-route-page">
      <div className="bazi-view-container">
        <div className="input-page-main-content">
          <PrivacyHint />
          <div className="analysis-view">
            <DivinationPanel
              key={method}
              initialMethod={method}
              lockedMethod={method}
              displayMode="input"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function DivinationResultPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const recordId = searchParams.get('record');
  const record = useMemo(
    () => (recordId ? getDivinationHistoryById(recordId) : undefined),
    [recordId],
  );
  const method = record?.draft.method || 'random';
  const item = isWorkspaceEntryId(method) ? getWorkspaceNavigationItem(method) : null;

  return (
    <div className="page-shell input-page-shell divination-route-page divination-result-page">
      <div className="bazi-view-container">
        <PageTopbar
          title={`${item?.label || '占卜'}结果`}
          onBack={() => navigate(`/divination?method=${encodeURIComponent(method)}`)}
        />
        <div className="analysis-view">
          <DivinationPanel displayMode="result" />
        </div>
      </div>
    </div>
  );
}
