import * as React from 'react';
import '../../styles/divination-studio.css';
import { ChevronLeft, Sun } from 'lucide-react';
import {
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  PageHeader,
  SegmentedTabs,
  SubPillBar,
} from '../../components/ui';
import { cn } from '../../lib/utils';
import type { Method } from '../../method-meta';
import type { PersonalCase } from '../../v2-ui/cases-store';
import type { AlmanacPreset } from '../components/divination/DivinationFormPanel';
import type { AlmanacParticipantDraft } from '../components/divination/divination-shared';
import { WorkspaceSkeleton } from '../components/WorkspaceSkeleton';
import {
  NAME_CHAR_SUB_TABS,
  type AlmanacSubTabId,
  type NameCharSubTabId,
  type UtilityMainTabId,
  type UtilityToolId,
} from '../workspace-catalog';
import { UTILITY_SINGLE_PAGE_TITLES } from '../workspace-router';

const LazyDivinationFormPanel = React.lazy(
  () => import('../components/divination/DivinationFormPanel'),
);
const LazyCultureToolsPanel = React.lazy(
  () => import('../components/culture/CultureToolsPanel'),
);
const LazyTermGlossaryPanel = React.lazy(() =>
  import('../components/culture/TermGlossaryPanel').then((m) => ({
    default: m.TermGlossaryPanel,
  })),
);
const LazyFengShuiWorkbench = React.lazy(
  () => import('../components/fengshui/FengShuiWorkbench'),
);
const LazyCalendarPagePanel = React.lazy(
  () => import('../components/culture/CalendarPagePanel'),
);
const ZhouyiLookupPanel = React.lazy(() =>
  import('../components/ZhouyiLookupPanel').then((m) => ({ default: m.ZhouyiLookupPanel })),
);

const NUMBER_ENERGY_PLACEHOLDERS: Record<'phone' | 'plate' | 'general', string> = {
  phone: '请输入手机号码',
  plate: '请输入车牌号码',
  general: '请输入数字或编号序列',
};

export interface UtilitiesViewProps {
  currentUtilityMainTab: UtilityMainTabId;
  currentAlmanacSubTab: AlmanacSubTabId;
  currentNameCharSubTab: NameCharSubTabId;
  personalCases: PersonalCase[];
  almanacPreset?: AlmanacPreset | null;
  divinationLatestPayloadRef: React.MutableRefObject<Record<string, unknown>>;
  onNavigateHome: () => void;
  onNavigateToUtilities: (
    target: UtilityMainTabId | UtilityToolId | 'calendar' | 'bazhai' | 'xuankong',
  ) => void;
  onOpenAlmanacPreset: (
    topic: 'move' | 'renovation',
    participants: AlmanacParticipantDraft[],
  ) => void;
  onExecuteDivination: (method: Method, payload: Record<string, unknown>) => Promise<void> | void;
  onOpenZhouyiResult: (
    payload: Record<string, unknown>,
    result: {
      summary?: unknown;
      prompt?: { text: string };
      data?: unknown;
    },
  ) => void;
}

export function UtilitiesView({
  currentUtilityMainTab,
  currentAlmanacSubTab,
  currentNameCharSubTab,
  personalCases,
  almanacPreset = null,
  divinationLatestPayloadRef,
  onNavigateHome,
  onNavigateToUtilities,
  onOpenAlmanacPreset,
  onExecuteDivination,
  onOpenZhouyiResult,
}: UtilitiesViewProps) {
  const [numPurpose, setNumPurpose] = React.useState<'phone' | 'plate' | 'general'>('phone');
  const [numVal, setNumVal] = React.useState('');
  const [numError, setNumError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setNumError(null);
  }, [currentUtilityMainTab]);

  const handleNumberEnergySubmit = () => {
    if (!numVal.trim()) {
      setNumError('请先输入号码或数字序列后再开始推演。');
      return;
    }
    setNumError(null);
    void onExecuteDivination('number-energy', {
      value: numVal.trim(),
      purpose: numPurpose,
      question: '请分析这组号码的八星磁场分布与数理吉凶。',
    });
  };

  return (
    <div
      className={cn(
        'workspace-ui-screen workspace-focused-page',
        currentUtilityMainTab === 'almanac' || currentUtilityMainTab === 'residential'
          ? `workspace-divination-page is-wide is-timing-domain${
              currentUtilityMainTab === 'almanac' ? ' is-almanac' : ''
            }`
          : currentUtilityMainTab === 'number-energy'
            ? 'workspace-divination-page is-narrow'
            : 'min-w-0',
      )}
    >
      <PageHeader
        title={UTILITY_SINGLE_PAGE_TITLES[currentUtilityMainTab]}
        className={
          currentUtilityMainTab === 'almanac'
            ? 'justify-end min-[680px]:justify-between'
            : undefined
        }
        rightSlot={
          <>
            {currentUtilityMainTab === 'almanac' ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onNavigateToUtilities('calendar')}
              >
                <Sun className="h-3.5 w-3.5" aria-hidden="true" />
                <span>天文历法</span>
              </Button>
            ) : null}
            <Button
              variant="secondary"
              size="sm"
              className="ws-desktop-only-action hidden min-[680px]:inline-flex"
              onClick={onNavigateHome}
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>返回首页</span>
            </Button>
          </>
        }
      />

      {currentUtilityMainTab === 'name-char' ? (
        <>
          <SubPillBar
            ariaLabel="汉字经籍子模块"
            tone="secondary"
            value={currentNameCharSubTab}
            items={NAME_CHAR_SUB_TABS}
            onValueChange={(next) => onNavigateToUtilities(next)}
          />
          {currentNameCharSubTab === 'zhouyi' ? (
            <ZhouyiLookupPanel
              onOpenInResult={(payload, res) => {
                onOpenZhouyiResult(
                  payload,
                  res as {
                    summary?: unknown;
                    prompt?: { text: string };
                    data?: unknown;
                  },
                );
              }}
            />
          ) : currentNameCharSubTab === 'terms' ? (
            <React.Suspense fallback={<WorkspaceSkeleton variant="form" />}>
              <LazyTermGlossaryPanel />
            </React.Suspense>
          ) : (
            <React.Suspense fallback={<WorkspaceSkeleton variant="form" />}>
              <LazyCultureToolsPanel initialMethod={currentNameCharSubTab} hideHeader />
            </React.Suspense>
          )}
        </>
      ) : null}

      {currentUtilityMainTab === 'number-energy' ? (
        <Card className="grid gap-3.5 p-4 sm:p-5">
          <div className="grid gap-1.5">
            <span className="text-xs font-bold text-[var(--text-strong)]">号码类型</span>
            <SegmentedTabs
              value={numPurpose}
              onValueChange={(next) => {
                setNumPurpose(next);
                setNumError(null);
              }}
              options={[
                { id: 'phone', label: '手机号码' },
                { id: 'plate', label: '车牌号码' },
                { id: 'general', label: '通用数字/编号' },
              ]}
            />
          </div>
          <label className="grid gap-1.5 text-xs font-bold text-[var(--text-strong)]">
            <span>输入号码或数字序列</span>
            <Input
              type="text"
              value={numVal}
              placeholder={NUMBER_ENERGY_PLACEHOLDERS[numPurpose]}
              onChange={(e) => {
                setNumVal(e.target.value);
                if (e.target.value.trim()) setNumError(null);
              }}
            />
          </label>
          {numError ? <div className="workspace-ui-form-error">{numError}</div> : null}
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={handleNumberEnergySubmit}
          >
            解析数字
          </Button>
        </Card>
      ) : null}

      {currentUtilityMainTab === 'residential' ? (
        <React.Suspense fallback={<WorkspaceSkeleton variant="form" />}>
          <LazyFengShuiWorkbench
            personalCases={personalCases}
            onExecuteDivination={onExecuteDivination}
            onOpenAlmanacPreset={onOpenAlmanacPreset}
          />
        </React.Suspense>
      ) : null}

      {currentUtilityMainTab === 'almanac' ? (
        <div className="grid gap-3">
          <React.Suspense fallback={<WorkspaceSkeleton variant="form" />}>
            <LazyDivinationFormPanel
              key="almanac"
              method="almanac"
              almanacPreset={almanacPreset}
              showSubmitButton
              onChange={(next) => {
                divinationLatestPayloadRef.current = next;
              }}
              onSubmit={(submitted) => {
                void onExecuteDivination(
                  'almanac',
                  submitted ?? divinationLatestPayloadRef.current,
                );
              }}
            />
          </React.Suspense>

          <Dialog
            open={currentAlmanacSubTab === 'calendar'}
            onOpenChange={(open) => {
              if (!open) onNavigateToUtilities('almanac');
            }}
          >
            <DialogContent
              className="max-h-[88dvh] max-w-[820px]"
              aria-label="天文历法"
              onInteractOutside={(event) => {
                const target = event.target as HTMLElement | null;
                if (target?.closest('[role="dialog"]')) {
                  event.preventDefault();
                }
              }}
              onEscapeKeyDown={(event) => {
                if (document.querySelectorAll('[role="dialog"]').length > 1) {
                  event.preventDefault();
                }
              }}
            >
              <DialogHeader>
                <DialogTitle>天文历法</DialogTitle>
              </DialogHeader>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                {currentAlmanacSubTab === 'calendar' ? (
                  <React.Suspense fallback={<WorkspaceSkeleton variant="calendar" />}>
                    <LazyCalendarPagePanel />
                  </React.Suspense>
                ) : null}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      ) : null}
    </div>
  );
}

export default UtilitiesView;
