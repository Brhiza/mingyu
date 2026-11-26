import * as React from 'react';
import { ChevronLeft, Compass, MapPin, Play, Square } from 'lucide-react';
import type { BirthPlaceModalController } from '../../v2-ui/birth-place-modal';
import type { PersonalCase } from '../../v2-ui/cases-store';
import { runRangeScanInBackground } from '../../workers/range-runner';
import { Button, Card, Input, SegmentedTabs } from '../../components/ui';

export interface BirthRangeScanPanelProps {
  birthPlaceModal: BirthPlaceModalController;
  initialMethod?: 'astrolabe-range' | 'qizheng-range';
  initialPerson?: Partial<PersonalCase>;
  onBack?: () => void;
  onScanComplete: (
    method: 'astrolabe-range' | 'qizheng-range',
    payload: Record<string, unknown>,
    result: unknown,
  ) => void;
}

function buildInitialRangeSeed(person?: Partial<PersonalCase>) {
  const y = person?.year?.trim() ? person.year.trim().padStart(4, '0') : '1990';
  const m = person?.month?.trim() ? person.month.trim().padStart(2, '0') : '05';
  const d = person?.day?.trim() ? person.day.trim().padStart(2, '0') : '15';
  const hhNum = person?.birthHour !== undefined && person.birthHour !== ''
    ? Math.min(23, Math.max(0, Number.parseInt(person.birthHour, 10) || 0))
    : 14;
  const mmNum = person?.birthMinute !== undefined && person.birthMinute !== ''
    ? Math.min(59, Math.max(0, Number.parseInt(person.birthMinute, 10) || 0))
    : 0;
  const endTotalMinutes = Math.min(23 * 60 + 59, hhNum * 60 + mmNum + 5);
  const endH = Math.floor(endTotalMinutes / 60);
  const endM = endTotalMinutes % 60;
  const pad2 = (n: number) => String(n).padStart(2, '0');
  return {
    birthDate: `${y}-${m}-${d}`,
    startTime: `${pad2(hhNum)}:${pad2(mmNum)}:00`,
    endTime: `${pad2(endH)}:${pad2(endM)}:00`,
    placeDisplay: person?.birthPlace?.trim() || '北京市 东城区',
    longitude: typeof person?.longitude === 'number' && Number.isFinite(person.longitude) ? person.longitude : 116.416,
    latitude: typeof person?.latitude === 'number' && Number.isFinite(person.latitude) ? person.latitude : 39.928,
  };
}

export function BirthRangeScanPanel({
  birthPlaceModal,
  initialMethod = 'astrolabe-range',
  initialPerson,
  onBack,
  onScanComplete,
}: BirthRangeScanPanelProps) {
  const initialSeed = React.useMemo(() => buildInitialRangeSeed(initialPerson), [initialPerson]);
  const [targetMethod, setTargetMethod] = React.useState<'astrolabe-range' | 'qizheng-range'>(
    initialMethod,
  );
  const [birthDate, setBirthDate] = React.useState(initialSeed.birthDate);
  const [startTime, setStartTime] = React.useState(initialSeed.startTime);
  const [endTime, setEndTime] = React.useState(initialSeed.endTime);
  const [placeDisplay, setPlaceDisplay] = React.useState(initialSeed.placeDisplay);
  const [longitude, setLongitude] = React.useState(initialSeed.longitude);
  const [latitude, setLatitude] = React.useState(initialSeed.latitude);

  React.useEffect(() => {
    setTargetMethod(initialMethod);
  }, [initialMethod]);

  React.useEffect(() => {
    setBirthDate(initialSeed.birthDate);
    setStartTime(initialSeed.startTime);
    setEndTime(initialSeed.endTime);
    setPlaceDisplay(initialSeed.placeDisplay);
    setLongitude(initialSeed.longitude);
    setLatitude(initialSeed.latitude);
  }, [initialSeed]);
  const [question, setQuestion] = React.useState('请比较这段出生时间内不同时间分支的盘面变化。');
  const [running, setRunning] = React.useState(false);
  const [progressText, setProgressText] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const normalizeHms = (raw: string) => {
    const parts = raw.trim().split(':');
    const hh = String(Math.min(23, Math.max(0, Number.parseInt(parts[0] || '0', 10) || 0))).padStart(2, '0');
    const mm = String(Math.min(59, Math.max(0, Number.parseInt(parts[1] || '0', 10) || 0))).padStart(2, '0');
    const ss = String(Math.min(59, Math.max(0, Number.parseInt(parts[2] || '0', 10) || 0))).padStart(2, '0');
    return { hh, mm, ss, text: `${hh}:${mm}:${ss}` };
  };

  const handleScan = async () => {
    if (running) return;
    setError(null);
    const [y, m, d] = birthDate.split('-').map((n) => Number.parseInt(n, 10));
    if (!y || !m || !d) {
      setError('请选择有效的公历出生日期。');
      return;
    }
    const s = normalizeHms(startTime);
    const e = normalizeHms(endTime);
    const startIso = `${birthDate}T${s.text}+08:00`;
    const endIso = `${birthDate}T${e.text}+08:00`;
    const totalSec = Math.floor((Date.parse(endIso) - Date.parse(startIso)) / 1000);
    if (!Number.isFinite(totalSec) || totalSec <= 0) {
      setError('结束时间必须晚于开始时间。');
      return;
    }
    if (totalSec > 7200) {
      setError('单次逐秒范围扫描最多支持 2 小时（7200 秒），建议先缩小至 5～30 分钟区间。');
      return;
    }

    const payload: Record<string, unknown> = {
      question: question.trim() || '请比较出生时间段内不同分支的盘面变化。',
      birth: {
        year: y,
        month: m,
        day: d,
        hour: Number(s.hh),
        minute: Number(s.mm),
        second: Number(s.ss),
        latitude,
        longitude,
        timezone: 8,
      },
      range: {
        start: startIso,
        end: endIso,
        pageSize: targetMethod === 'astrolabe-range' ? 20 : 30,
      },
    };

    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setProgressText(`准备扫描共 ${totalSec} 秒（后台线程运行中，页面不会卡顿）…`);
    try {
      const result = await runRangeScanInBackground(targetMethod, payload, {
        signal: controller.signal,
        onProgress: (completed, total) => {
          setProgressText(`正在逐秒推算：${completed} / ${total} 秒…`);
        },
      });
      onScanComplete(targetMethod, payload, result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '范围扫描失败。');
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setRunning(false);
    }
  };

  return (
    <Card className="grid gap-3.5 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="m-0 flex items-center gap-2 whitespace-nowrap text-base font-bold text-[var(--text-strong)]">
          <Compass className="h-4 w-4 shrink-0 text-[var(--accent)]" />
          <span>生时区间边界扫描</span>
        </h3>
        {onBack ? (
          <Button type="button" variant="secondary" size="sm" onClick={onBack}>
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>返回排盘</span>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-1.5">
        <span className="text-xs font-bold text-[var(--text-strong)]">选择扫描术数</span>
        <SegmentedTabs
          value={targetMethod}
          onValueChange={setTargetMethod}
          options={[
            { id: 'astrolabe-range', label: '西洋星盘范围' },
            { id: 'qizheng-range', label: '七政四余范围' },
          ]}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1.5 text-xs font-bold text-[var(--text-strong)]">
          <span>出生公历日期</span>
          <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        </label>
        <label className="grid gap-1.5 text-xs font-bold text-[var(--text-strong)]">
          <span>起始时刻（HH:MM:SS）</span>
          <Input value={startTime} onChange={(e) => setStartTime(e.target.value)} placeholder="14:00:00" />
        </label>
        <label className="grid gap-1.5 text-xs font-bold text-[var(--text-strong)]">
          <span>结束时刻（HH:MM:SS，不含）</span>
          <Input value={endTime} onChange={(e) => setEndTime(e.target.value)} placeholder="14:05:00" />
        </label>
      </div>

      <div className="grid gap-1.5 text-xs font-bold text-[var(--text-strong)]">
        <span>出生地点（用于宫位与真太阳时计算）</span>
        <button
          type="button"
          className="flex h-10 w-full cursor-pointer items-center justify-between rounded-xl border border-[var(--border-soft)] bg-[var(--surface-input)] px-3 text-left text-sm font-normal text-[var(--text-strong)]"
          onClick={() => {
            birthPlaceModal.open({
              purpose: 'birth',
              initialPlace: placeDisplay,
              onConfirm: (sel) => {
                setPlaceDisplay(sel.displayName);
                setLongitude(sel.longitude);
                setLatitude(sel.latitude ?? 39.928);
              },
            });
          }}
        >
          <span className="flex items-center gap-1.5 truncate">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
            <span>
              {placeDisplay}（东经 {longitude.toFixed(2)}°，北纬 {latitude.toFixed(2)}°）
            </span>
          </span>
          <span className="text-xs text-[var(--accent)]">修改</span>
        </button>
      </div>

      <label className="grid gap-1.5 text-xs font-bold text-[var(--text-strong)]">
        <span>分析问题</span>
        <Input value={question} onChange={(e) => setQuestion(e.target.value)} />
      </label>

      {progressText ? (
        <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-xs text-[var(--text-secondary)]">
          {progressText}
        </div>
      ) : null}
      {error ? <div className="workspace-ui-form-error">{error}</div> : null}

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" size="lg" onClick={() => void handleScan()} disabled={running}>
          <Play className="h-4 w-4" />
          <span>{running ? '正在后台逐秒推演…' : '开始逐秒范围扫描'}</span>
        </Button>
        {running ? (
          <Button variant="secondary" size="lg" onClick={() => abortRef.current?.abort()}>
            <Square className="h-4 w-4" />
            <span>停止扫描</span>
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
