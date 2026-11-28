import * as React from 'react';
import '../../styles/divination-studio.css';
import { ChevronLeft } from 'lucide-react';
import { SubPillBar, Button, PageHeader } from '../../components/ui';
import { methodLabels, type Method } from '../../method-meta';
import type { DivinationFormMethod } from '../../v2-ui/chart-tabs';
import { preloadVisualBoardAssets } from '../../web-boards';
import { preloadCalculateEngine } from '../../workers/calc-runner';
import { WorkspaceSkeleton } from '../components/WorkspaceSkeleton';
import { DIVINATION_FLAT_ITEMS, type DivinationCenterMethod } from '../workspace-catalog';
import { isStandaloneHomeMethod } from '../workspace-router';

const LazyDivinationFormPanel = React.lazy(
  () => import('../components/divination/DivinationFormPanel'),
);
const LazyShiyueOraclePanel = React.lazy(() =>
  import('../components/divination/ShiyueOraclePanel').then((m) => ({
    default: m.ShiyueOraclePanel,
  })),
);

export interface DivinationInputViewProps {
  activeDivId: DivinationCenterMethod;
  activeDivMethod: DivinationFormMethod;
  divinationLatestPayloadRef: React.MutableRefObject<Record<string, unknown>>;
  onNavigateHome: () => void;
  onSelectMethod: (id: DivinationCenterMethod) => void;
  onExecuteDivination: (method: Method, payload: Record<string, unknown>) => void;
}

const LIVE_CHART_METHODS = new Set<DivinationFormMethod>([
  'qimen',
  'liuren',
  'taiyi',
  'huangji-jingshi',
  'wuyun-liuqi',
]);

export function DivinationInputView({
  activeDivId,
  activeDivMethod,
  divinationLatestPayloadRef,
  onNavigateHome,
  onSelectMethod,
  onExecuteDivination,
}: DivinationInputViewProps) {
  const isLiveChart = LIVE_CHART_METHODS.has(activeDivMethod);

  React.useEffect(() => {
    if (activeDivId === 'shiyue-oracle') return;
    preloadCalculateEngine(activeDivMethod);
    preloadVisualBoardAssets(activeDivMethod);
  }, [activeDivId, activeDivMethod]);
  return (
    <div
      className={`workspace-ui-screen workspace-focused-page workspace-divination-page ${
        isLiveChart ? 'is-wide is-live-chart-page' : 'is-narrow'
      }`}
    >
      {isStandaloneHomeMethod(activeDivId) ? (
        <PageHeader
          title={methodLabels[activeDivMethod] ?? activeDivId}
          rightSlot={
            <Button
              variant="secondary"
              size="sm"
              className="ws-desktop-only-action hidden min-[680px]:inline-flex"
              onClick={onNavigateHome}
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>返回首页</span>
            </Button>
          }
        />
      ) : (
        <>
          <PageHeader title="占卜起卦" />
          <SubPillBar
            ariaLabel="占卜术数选择"
            value={activeDivId}
            items={DIVINATION_FLAT_ITEMS}
            onValueChange={onSelectMethod}
          />
        </>
      )}

      <React.Suspense fallback={<WorkspaceSkeleton variant="form" />}>
        {activeDivId === 'shiyue-oracle' ? (
          <LazyShiyueOraclePanel />
        ) : (
          <LazyDivinationFormPanel
            key={activeDivMethod}
            method={activeDivMethod}
            showSubmitButton
            onChange={(next) => {
              divinationLatestPayloadRef.current = next;
            }}
            onSubmit={(submitted) => {
              onExecuteDivination(activeDivMethod, submitted ?? divinationLatestPayloadRef.current);
            }}
          />
        )}
      </React.Suspense>
    </div>
  );
}

export default DivinationInputView;
