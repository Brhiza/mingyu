import * as React from 'react';
import { Settings } from 'lucide-react';
import { Button, PageHeader } from '../../components/ui';
import { cn } from '../../lib/utils';
import type { Method } from '../../method-meta';
import {
  SYNASTRY_RELATIONSHIP_OPTIONS,
  type SynastryRelationship,
} from '../../systems/focus-presets';
import type { createBirthPlaceModal } from '../../v2-ui/birth-place-modal';
import { saveTemporaryCase, type PersonalCase } from '../../v2-ui/cases-store';
import type { CompatibilityChartTabId, PersonalChartTabId } from '../../v2-ui/chart-tabs';
import { WorkspaceSkeleton } from '../components/WorkspaceSkeleton';
import type { PersonFormWorkspaceHandle, PersonRole } from '../components/person/person-form-helpers';

const LazyPersonFormWorkspace = React.lazy(
  () => import('../components/person/PersonFormWorkspace'),
);
const BirthRangeScanPanel = React.lazy(() =>
  import('../components/BirthRangeScanPanel').then((m) => ({ default: m.BirthRangeScanPanel })),
);

export interface ChartInputViewProps {
  isCompatibilityMode: boolean;
  isRangeMode: boolean;
  activeMethod: Method;
  preferredPersonalChartTab: PersonalChartTabId;
  compatibilityMethod: CompatibilityChartTabId;
  compatRelationship: SynastryRelationship;
  seededPerson: PersonalCase;
  personalCases?: readonly PersonalCase[];
  partnerSeed?: Partial<PersonalCase>;
  rangeScanContext: {
    person: PersonalCase;
    method: 'astrolabe-range' | 'qizheng-range';
  } | null;
  sharedPlaceModal: ReturnType<typeof createBirthPlaceModal>;
  personWorkspaceRef: React.RefObject<PersonFormWorkspaceHandle | null>;
  personFormReady: boolean;
  chartError: string | null;
  onSelectSingleMode: () => void;
  onSelectCompatMode: () => void;
  onOpenSettings: () => void;
  onOpenCaseChart?: (record: PersonalCase) => void;
  onBackFromRange: () => void;
  onRangeScanComplete: (
    rangeMethod: 'astrolabe-range' | 'qizheng-range',
    payload: Record<string, unknown>,
    result: unknown,
  ) => void;
  onRequestCasePicker: (
    role: PersonRole,
    applyCase: (person: PersonalCase, isTemporary: boolean) => void,
  ) => void;
  onOpenTimeReverse: (person: PersonalCase, role: PersonRole) => void;
  onOpenRangeScan: (person: PersonalCase, role: PersonRole) => void;
  onPartnerSeedChange: (partner: Partial<PersonalCase>) => void;
  onPersonFormReady: () => void;
  onCompatRelationshipChange: (rel: SynastryRelationship) => void;
  onSubmit: () => void;
}

export function ChartInputView({
  isCompatibilityMode,
  isRangeMode,
  activeMethod,
  preferredPersonalChartTab,
  compatRelationship,
  seededPerson,
  personalCases = [],
  partnerSeed,
  rangeScanContext,
  sharedPlaceModal,
  personWorkspaceRef,
  personFormReady,
  chartError,
  onSelectSingleMode,
  onSelectCompatMode,
  onOpenSettings,
  onOpenCaseChart,
  onBackFromRange,
  onRangeScanComplete,
  onRequestCasePicker,
  onOpenTimeReverse,
  onOpenRangeScan,
  onPartnerSeedChange,
  onPersonFormReady,
  onCompatRelationshipChange,
  onSubmit,
}: ChartInputViewProps) {
  return (
    <div
      className={cn(
        'workspace-ui-screen workspace-input-page',
        isCompatibilityMode ? 'is-wide is-compatibility' : 'is-narrow',
      )}
    >
      <PageHeader
        title="命盘排盘"
        tabsAriaLabel="排盘模式切换"
        activeTab={isCompatibilityMode ? 'compat' : 'single'}
        tabs={[
          { id: 'single', label: '单人排盘' },
          { id: 'compat', label: '双人合盘' },
        ]}
        onTabChange={(nextMode) => {
          if (nextMode === 'compat') {
            onSelectCompatMode();
          } else {
            onSelectSingleMode();
          }
        }}
        rightSlot={
          <Button
            variant="secondary"
            size="sm"
            className="ws-desktop-only-action hidden min-[680px]:inline-flex"
            onClick={onOpenSettings}
          >
            <Settings className="h-3.5 w-3.5" />
            <span>排盘偏好</span>
          </Button>
        }
      />

      {isRangeMode ? (
        <BirthRangeScanPanel
          birthPlaceModal={sharedPlaceModal}
          initialMethod={
            activeMethod === 'qizheng-range'
              ? 'qizheng-range'
              : rangeScanContext?.method ??
                (preferredPersonalChartTab === 'qizheng' ? 'qizheng-range' : 'astrolabe-range')
          }
          initialPerson={rangeScanContext?.person ?? seededPerson}
          onBack={onBackFromRange}
          onScanComplete={onRangeScanComplete}
        />
      ) : (
        <>
          {!isCompatibilityMode && personalCases.length > 0 && onOpenCaseChart ? (
            <div
              data-testid="chart-quick-cases"
              className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              aria-label="已存档案直出排盘"
            >
              <span className="shrink-0 text-[11.5px] font-semibold text-[var(--text-muted)]">
                档案直排
              </span>
              {personalCases.slice(0, 8).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onOpenCaseChart(item)}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] px-3 text-[12px] font-semibold text-[var(--text-strong)] cursor-pointer transition-colors hover:border-[var(--accent)] hover:bg-[var(--state-selected-surface)] hover:text-[var(--state-selected-text)]"
                >
                  <span className="max-w-[96px] truncate">{item.name || '未命名'}</span>
                  <span className="text-[10.5px] text-[var(--text-muted)]">
                    {item.gender === 'male' ? '男' : '女'}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          <React.Suspense fallback={<WorkspaceSkeleton variant="form" />}>
            <LazyPersonFormWorkspace
              key={`${isCompatibilityMode ? 'compat' : 'single'}:${preferredPersonalChartTab}`}
              ref={personWorkspaceRef}
              mode={isCompatibilityMode ? 'compatibility' : 'single'}
              method={isCompatibilityMode ? 'bazi-synastry' : preferredPersonalChartTab}
              initialSelf={seededPerson}
              initialPartner={partnerSeed ?? undefined}
              defaultSaveToCase
              onRequestCasePicker={onRequestCasePicker}
              onOpenTimeReverse={onOpenTimeReverse}
              onOpenRangeScan={onOpenRangeScan}
              onChange={(state) => {
                if (state.self.isTemporary) {
                  saveTemporaryCase(state.self);
                }
                if (state.partner) {
                  onPartnerSeedChange(state.partner);
                }
              }}
              onReady={onPersonFormReady}
            />
          </React.Suspense>

          <section className="workspace-ui-form-surface workspace-chart-actions-surface">
            {isCompatibilityMode ? (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-[var(--text-secondary)]">
                  合盘场景
                </span>
                <div className="workspace-prompt-focus-pills" role="group" aria-label="选择合盘关系场景">
                  {SYNASTRY_RELATIONSHIP_OPTIONS.map((opt) => {
                    const isActive = compatRelationship === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => onCompatRelationshipChange(opt.value)}
                        className={`workspace-prompt-focus-pill${isActive ? ' is-active' : ''}`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {chartError ? <div className="workspace-ui-form-error">{chartError}</div> : null}
            <div className="workspace-ui-form-actions is-sticky-mobile">
              {personFormReady ? (
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full min-[680px]:w-auto min-[680px]:min-w-[168px]"
                  onClick={onSubmit}
                >
                  {isCompatibilityMode ? '开始合盘' : '开始排盘'}
                </Button>
              ) : (
                <div className="w-full" aria-busy="true" aria-label="正在加载排盘表单">
                  <WorkspaceSkeleton variant="form" />
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default ChartInputView;
