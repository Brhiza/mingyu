import * as React from 'react';
import {
  Bot,
  ChevronRight,
  Clock,
  ExternalLink,
  FolderOpen,
  FolderPlus,
  Heart,
  LayoutGrid,
  Moon,
  Settings,
  Sparkles,
  Sun,
} from 'lucide-react';
import { formatBirthTimeText, type PersonalCase } from '../../v2-ui/cases-store';
import { getDisplayThemeMode, setDisplayThemeMode } from '../workspace-catalog';
import { Badge, Button, Card, PageHeader, Switch } from '../../components/ui';

export interface MePageProps {
  activeCase: PersonalCase | null;
  caseCount: number;
  historyCount: number;
  aiActive: boolean;
  meritBoxUrl?: string;
  onOpenCases: () => void;
  onNewCase: () => void;
  onOpenCaseChart: (record: PersonalCase) => void;
  onOpenHistory: () => void;
  onOpenTools: () => void;
  onOpenFortune: () => void;
  onOpenConnect: () => void;
  onOpenSettings: () => void;
}

function MeRow({
  icon: Icon,
  label,
  trailing,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  trailing?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[48px] w-full items-center justify-between gap-3 border-0 bg-transparent px-4 py-2.5 text-left transition-colors cursor-pointer hover:bg-[var(--surface-soft)]"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden="true"
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-soft)] text-[var(--accent-strong)]"
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="truncate text-[13.5px] font-bold text-[var(--text-strong)]">{label}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2 text-[var(--text-muted)]">
        {trailing}
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </span>
    </button>
  );
}

/** 移动端「我的」个人中心：一站收敛档案、历史、工具箱、AI 接入、设置与功德箱 */
export function MePage({
  activeCase,
  caseCount,
  historyCount,
  aiActive,
  meritBoxUrl,
  onOpenCases,
  onNewCase,
  onOpenCaseChart,
  onOpenHistory,
  onOpenTools,
  onOpenFortune,
  onOpenConnect,
  onOpenSettings,
}: MePageProps) {
  const [darkMode, setDarkMode] = React.useState<boolean>(() => getDisplayThemeMode() === 'dark');

  const handleToggleDarkMode = (checked: boolean) => {
    setDarkMode(checked);
    setDisplayThemeMode(checked ? 'dark' : 'light');
  };

  const activeCaseSummary = activeCase
    ? `${activeCase.reverseSource ? '四柱' : activeCase.calendar === 'lunar' ? '农历' : '公历'} ${activeCase.birthText} ${formatBirthTimeText(activeCase)}`
    : null;

  return (
    <div
      data-testid="me-page"
      className="mx-auto flex w-full min-w-0 max-w-[640px] flex-col gap-3.5 pb-8"
    >
      <PageHeader title="我的" />

      {/* 当前档案卡片 */}
      <Card className="grid gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="grid min-w-0 gap-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <strong className="truncate text-[15px] font-extrabold text-[var(--text-strong)]">
                {activeCase ? activeCase.name || '未命名档案' : '未选择档案'}
              </strong>
              {activeCase ? (
                <Badge variant={activeCase.gender === 'male' ? 'outline' : 'accent'}>
                  {activeCase.gender === 'male' ? '男' : '女'}
                </Badge>
              ) : null}
            </div>
            <span className="truncate text-[12px] text-[var(--text-muted)]">
              {activeCaseSummary || '新建或选择档案，开启个人日运与命盘'}
            </span>
          </div>

          {activeCase ? (
            <Button
              variant="primary"
              size="sm"
              className="shrink-0"
              onClick={() => onOpenCaseChart(activeCase)}
            >
              直接看盘
            </Button>
          ) : (
            <Button variant="primary" size="sm" className="shrink-0" onClick={onNewCase}>
              <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>新建</span>
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-[var(--border-soft)] pt-2.5">
          <Button variant="secondary" size="xs" className="flex-1" onClick={onOpenCases}>
            <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
            <span>管理档案（{caseCount}）</span>
          </Button>
          {activeCase ? (
            <Button variant="secondary" size="xs" className="shrink-0" onClick={onNewCase}>
              <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>新建</span>
            </Button>
          ) : null}
        </div>
      </Card>

      {/* 记录与工具 */}
      <Card className="divide-y divide-[var(--border-soft)] overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-0">
        <MeRow
          icon={FolderOpen}
          label="个人档案"
          trailing={<span className="font-mono text-[12px] tabular-nums">{caseCount}</span>}
          onClick={onOpenCases}
        />
        <MeRow
          icon={Clock}
          label="推演历史"
          trailing={<span className="font-mono text-[12px] tabular-nums">{historyCount}</span>}
          onClick={onOpenHistory}
        />
        <MeRow icon={LayoutGrid} label="工具箱" onClick={onOpenTools} />
        <MeRow icon={Sparkles} label="黄历运势" onClick={onOpenFortune} />
      </Card>

      {/* AI 与偏好设置 */}
      <Card className="divide-y divide-[var(--border-soft)] overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-0">
        <MeRow
          icon={Bot}
          label="接入 AI"
          trailing={
            <Badge variant={aiActive ? 'good' : 'outline'}>
              {aiActive ? '已连接' : '本地路由'}
            </Badge>
          }
          onClick={onOpenConnect}
        />
        <div className="flex min-h-[48px] items-center justify-between gap-3 px-4 py-2.5">
          <span className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-soft)] text-[var(--accent-strong)]"
            >
              {darkMode ? <Moon className="h-4 w-4" aria-hidden="true" /> : <Sun className="h-4 w-4" aria-hidden="true" />}
            </span>
            <span className="truncate text-[13.5px] font-bold text-[var(--text-strong)]">深色模式</span>
          </span>
          <Switch
            aria-label="切换深色模式"
            checked={darkMode}
            onCheckedChange={handleToggleDarkMode}
          />
        </div>
        <MeRow icon={Settings} label="外观与排盘设置" onClick={onOpenSettings} />
      </Card>

      {/* 公益支持（仅配置时展示） */}
      {meritBoxUrl ? (
        <a
          href={meritBoxUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[50px] items-center justify-between gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--accent)_32%,var(--border-soft))] bg-[var(--surface-elevated-strong)] px-4 py-3 text-[var(--accent-strong)] no-underline transition-colors hover:bg-[var(--accent-soft)]"
        >
          <span className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)]"
            >
              <Heart className="h-4 w-4 fill-current" aria-hidden="true" />
            </span>
            <strong className="text-[13.5px] font-extrabold">功德箱</strong>
          </span>
          <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
        </a>
      ) : null}
    </div>
  );
}

export default MePage;
