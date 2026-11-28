import * as React from 'react';
import type { Method } from '../../../method-meta';
import { applyGlobalRulesToPayload, loadGlobalRules } from '../../../web-settings';
import { runCalculateInBackground } from '../../../workers/calc-runner';
import { UiSegmentedControl } from '../shared/UiSegmentedControl';
import { MEIHUA_DIRECTIONS, MEIHUA_OBJECTS } from './divination-shared';
import { RitualStageShell } from './RitualStageShell';

function useLiveDivinationData<T>(
  method: Method,
  payload: Record<string, unknown> | null,
): { data: T | null; loading: boolean } {
  const reqIdRef = React.useRef(0);
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(false);

  const payloadKey = React.useMemo(() => (payload ? JSON.stringify(payload) : ''), [payload]);

  React.useEffect(() => {
    if (!payloadKey) {
      setData(null);
      setLoading(false);
      return;
    }

    const reqId = ++reqIdRef.current;
    let cancelled = false;
    setLoading(true);

    const timer = window.setTimeout(async () => {
      try {
        const parsed = JSON.parse(payloadKey) as Record<string, unknown>;
        const res = (await runCalculateInBackground(
          method,
          applyGlobalRulesToPayload(method, parsed, false),
          { promptGuidance: loadGlobalRules().prompt },
        )) as { data?: T } | null;
        if (cancelled || reqId !== reqIdRef.current) return;
        setData(res?.data ?? null);
        setLoading(false);
      } catch {
        if (cancelled || reqId !== reqIdRef.current) return;
        setLoading(false);
      }
    }, 90);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [method, payloadKey]);

  return { data, loading };
}

const XIAOLIUREN_PALACES: ReadonlyArray<{
  index: number;
  name: string;
  deity: string;
  element: string;
  tone: 'good' | 'mid' | 'warn';
}> = [
  { index: 1, name: '留连', deity: '玄武', element: '土', tone: 'mid' },
  { index: 2, name: '速喜', deity: '朱雀', element: '火', tone: 'good' },
  { index: 3, name: '赤口', deity: '白虎', element: '金', tone: 'warn' },
  { index: 0, name: '大安', deity: '青龙', element: '木', tone: 'good' },
  { index: 5, name: '空亡', deity: '勾陈', element: '土', tone: 'warn' },
  { index: 4, name: '小吉', deity: '六合', element: '水', tone: 'good' },
];

interface XiaoliurenPreviewData {
  lunarMonth: number;
  lunarDay: number;
  isLeapMonth: boolean;
  hourLabel: string;
  ganzhi: { day: string; hour: string };
  calculation: {
    monthPalaceIndex: number;
    dayPalaceIndex: number;
    hourPalaceIndex: number;
  };
  primary: { index: number; name: string; verse: string };
  sequence: { month: { name: string }; day: { name: string }; hour: { name: string } };
}

const XLR_CLOCKWISE_ORDER = [0, 1, 2, 3, 4, 5] as const;

export function XiaoliurenStudio({
  mode,
  numbers,
  previewPayload,
  timeControl,
  showSubmitButton = false,
  onChangeMode,
  onChangeNumbers,
}: {
  mode: 'time' | 'numbers';
  numbers: [string, string, string];
  previewPayload: Record<string, unknown> | null;
  timeControl: React.ReactNode;
  showSubmitButton?: boolean;
  onChangeMode: (next: 'time' | 'numbers') => void;
  onChangeNumbers: (next: [string, string, string]) => void;
}) {
  const { data: liveData } = useLiveDivinationData<XiaoliurenPreviewData>(
    'xiaoliuren',
    previewPayload,
  );
  const [steppingIdx, setSteppingIdx] = React.useState<number | null>(null);
  const [stepLabel, setStepLabel] = React.useState<string>('');
  const stepTimerRef = React.useRef<number | null>(null);

  const stopStepping = React.useCallback(() => {
    if (stepTimerRef.current !== null) {
      window.clearInterval(stepTimerRef.current);
      stepTimerRef.current = null;
    }
    setSteppingIdx(null);
    setStepLabel('');
  }, []);

  React.useEffect(() => stopStepping, [stopStepping]);

  const monthIdx = liveData?.calculation.monthPalaceIndex ?? -1;
  const dayIdx = liveData?.calculation.dayPalaceIndex ?? -1;
  const hourIdx = liveData?.calculation.hourPalaceIndex ?? -1;

  const triggerPalmStepping = (targetM?: number, targetD?: number, targetH?: number) => {
    stopStepping();
    const mStop = targetM ?? (monthIdx >= 0 ? monthIdx : 0);
    const dStop = targetD ?? (dayIdx >= 0 ? dayIdx : 2);
    const hStop = targetH ?? (hourIdx >= 0 ? hourIdx : 4);

    const sequence: Array<{ idx: number; phase: string }> = [];
    for (let i = 0; i <= (mStop === 0 ? 6 : mStop); i++) {
      sequence.push({ idx: XLR_CLOCKWISE_ORDER[i % 6]!, phase: '起月' });
    }
    const dSteps = ((dStop - mStop + 6) % 6) || 3;
    for (let i = 1; i <= dSteps; i++) {
      sequence.push({ idx: XLR_CLOCKWISE_ORDER[(mStop + i) % 6]!, phase: '移日' });
    }
    const hSteps = ((hStop - dStop + 6) % 6) || 2;
    for (let i = 1; i <= hSteps; i++) {
      sequence.push({ idx: XLR_CLOCKWISE_ORDER[(dStop + i) % 6]!, phase: '定主占' });
    }

    let cursor = 0;
    const first = sequence[cursor++];
    if (!first) return;
    setSteppingIdx(first.idx);
    setStepLabel(first.phase);

    stepTimerRef.current = window.setInterval(() => {
      const next = sequence[cursor++];
      if (!next) {
        stopStepping();
        return;
      }
      setSteppingIdx(next.idx);
      setStepLabel(next.phase);
    }, 68);
  };

  const xlrActions = (
    <>
      {showSubmitButton ? (
        <button type="submit" className="workspace-ui-button is-primary ritual-primary-btn">
          掐指起课
        </button>
      ) : null}
      <button
        type="button"
        disabled={steppingIdx !== null}
        className="workspace-ui-button is-secondary"
        onClick={() => triggerPalmStepping()}
      >
        {steppingIdx !== null ? `${stepLabel}中…` : '掐指演课'}
      </button>
    </>
  );

  return (
    <RitualStageShell
      title="小六壬"
      showSubmitButton={showSubmitButton}
      submitLabel="掐指起课"
      actions={xlrActions}
      isComplete={Boolean(liveData)}
      headerRight={
        <UiSegmentedControl<'time' | 'numbers'>
          value={mode}
          options={[
            { value: 'time', label: '按时起课' },
            { value: 'numbers', label: '三数活起' },
          ]}
          onChange={(next) => {
            stopStepping();
            onChangeMode(next);
          }}
        />
      }
    >
      <div className="xlr-workbench">
        <div className="xlr-palm-altar" aria-label="小六壬掌中六宫">
          {XIAOLIUREN_PALACES.map((p) => {
            const tags: string[] = [];
            if (p.index === monthIdx) tags.push('月');
            if (p.index === dayIdx) tags.push('日');
            if (p.index === hourIdx) tags.push('时');
            const isPrimary = p.index === hourIdx;
            const isStepping = steppingIdx === p.index;
            return (
              <div
                key={p.name}
                className={`xlr-palm-node is-${p.tone}${tags.length > 0 ? ' is-hit' : ''}${
                  isPrimary ? ' is-primary' : ''
                }${isStepping ? ' is-stepping' : ''}`}
              >
                {tags.length > 0 ? (
                  <span className="xlr-palm-markers">{tags.join('·')}</span>
                ) : null}
                <strong>{p.name}</strong>
                <small>{`${p.deity} · ${p.element}`}</small>
              </div>
            );
          })}
        </div>

        <div className="xlr-detail-pane">
          {liveData ? (
            <div className="xlr-live-result" aria-live="polite">
              <div className="xlr-live-head">
                <span className="xlr-live-badge">{`主占 ${liveData.primary.name}`}</span>
                <span className="xlr-live-trace">
                  {`${liveData.sequence.month.name} → ${liveData.sequence.day.name} → ${liveData.primary.name}`}
                </span>
                <span className="xlr-live-basis">
                  {mode === 'time'
                    ? `农历${liveData.isLeapMonth ? '闰' : ''}${liveData.lunarMonth}月${liveData.lunarDay}日 ${liveData.hourLabel}`
                    : `${numbers.join(' · ')} 取课`}
                </span>
              </div>
              <p className="xlr-live-verse">{liveData.primary.verse}</p>
            </div>
          ) : null}

          <div className="xlr-control-pane">
            {mode === 'time' ? (
              timeControl
            ) : (
              <div className="ritual-center-block">
                <div className="xlr-three-nums-row">
                  {(['初数（月）', '次数（日）', '末数（时）'] as const).map((label, idx) => (
                    <label key={label} className="ritual-num-slot">
                      <span>{label}</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="workspace-ui-control ritual-serif-input"
                        placeholder={String(idx + 1)}
                        maxLength={4}
                        value={numbers[idx]}
                        onChange={(e) => {
                          const next = [...numbers] as [string, string, string];
                          next[idx] = e.target.value.replace(/[^\d]/g, '').slice(0, 4);
                          onChangeNumbers(next);
                        }}
                      />
                    </label>
                  ))}
                </div>
                <div className="ritual-quick-row">
                  <button
                    type="button"
                    className="ritual-mini-btn"
                    onClick={() => {
                      const n1 = Math.floor(Math.random() * 12) + 1;
                      const n2 = Math.floor(Math.random() * 30) + 1;
                      const n3 = Math.floor(Math.random() * 12) + 1;
                      onChangeNumbers([String(n1), String(n2), String(n3)]);
                      const m = (n1 - 1) % 6;
                      const d = (m + n2 - 1) % 6;
                      const h = (d + n3 - 1) % 6;
                      triggerPalmStepping(m, d, h);
                    }}
                  >
                    机选三数
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </RitualStageShell>
  );
}

interface MeihuaPreviewData {
  originalName: string;
  interName: string;
  changedName: string;
  mainHexagram: { name: string; symbol: string; upper: string; lower: string };
  interHexagram: { name: string; symbol: string };
  changedHexagram: { name: string; symbol: string };
  movingYao: { position: number; description: string };
  tiGua: { name: string; element: string };
  yongGua: { name: string; element: string };
  analysis: { tiYongRelation: string };
}

const MEIHUA_DIRECTION_ANGLE: Record<string, number> = {
  north: 0,
  northeast: 45,
  east: 90,
  southeast: 135,
  south: 180,
  southwest: 225,
  west: 270,
  northwest: 315,
};

export function MeihuaStudio({
  mode,
  numberValue,
  charText,
  soundCount,
  direction,
  objectType,
  previewPayload,
  timeControl,
  showSubmitButton = false,
  onChangeMode,
  onChangeNumber,
  onChangeCharText,
  onChangeSoundCount,
  onChangeDirection,
  onChangeObjectType,
}: {
  mode: 'time' | 'number' | 'character' | 'sound' | 'direction';
  numberValue: string;
  charText: string;
  soundCount: string;
  direction: string;
  objectType: string;
  previewPayload: Record<string, unknown> | null;
  timeControl: React.ReactNode;
  showSubmitButton?: boolean;
  onChangeMode: (next: 'time' | 'number' | 'character' | 'sound' | 'direction') => void;
  onChangeNumber: (next: string) => void;
  onChangeCharText: (next: string) => void;
  onChangeSoundCount: (next: string) => void;
  onChangeDirection: (next: string) => void;
  onChangeObjectType: (next: string) => void;
}) {
  const { data: liveData } = useLiveDivinationData<MeihuaPreviewData>('meihua', previewPayload);
  const [gongPulseKey, setGongPulseKey] = React.useState(0);
  const activeDir = MEIHUA_DIRECTIONS.find((d) => d.value === direction) ?? MEIHUA_DIRECTIONS[1]!;
  const activeObj = MEIHUA_OBJECTS.find((o) => o.value === objectType) ?? MEIHUA_OBJECTS[2]!;
  const charCount = [...charText.trim()].length;
  const parsedSoundCount = Math.max(0, Number.parseInt(soundCount || '0', 10) || 0);
  const compassAngle = MEIHUA_DIRECTION_ANGLE[direction] ?? 180;

  return (
    <RitualStageShell
      title="梅花易数"
      showSubmitButton={showSubmitButton}
      submitLabel="梅花起卦"
      isComplete={Boolean(liveData)}
      headerRight={
        <UiSegmentedControl<'time' | 'number' | 'character' | 'sound' | 'direction'>
          value={mode}
          options={[
            { value: 'time', label: '时间' },
            { value: 'number', label: '报数' },
            { value: 'character', label: '测字' },
            { value: 'sound', label: '声音' },
            { value: 'direction', label: '物象' },
          ]}
          onChange={onChangeMode}
        />
      }
    >
      {mode !== 'direction' && liveData ? (
        <div className="mh-live-preview" aria-live="polite">
          <div className="mh-live-triad">
            <div className="mh-live-hex is-main">
              <span className="mh-live-tag">主卦</span>
              <span className="mh-live-sym">{liveData.mainHexagram.symbol}</span>
              <strong>{liveData.originalName}</strong>
            </div>
            <span className="mh-live-arrow" aria-hidden="true">→</span>
            <div className="mh-live-hex">
              <span className="mh-live-tag">互卦</span>
              <span className="mh-live-sym">{liveData.interHexagram.symbol}</span>
              <strong>{liveData.interName}</strong>
            </div>
            <span className="mh-live-arrow" aria-hidden="true">→</span>
            <div className="mh-live-hex">
              <span className="mh-live-tag">变卦</span>
              <span className="mh-live-sym">{liveData.changedHexagram.symbol}</span>
              <strong>{liveData.changedName}</strong>
            </div>
          </div>
          <div className="mh-live-meta">
            <span>{liveData.movingYao.description}</span>
            <span>{`体 ${liveData.tiGua.name}(${liveData.tiGua.element}) · 用 ${liveData.yongGua.name}(${liveData.yongGua.element})`}</span>
            <strong>{liveData.analysis.tiYongRelation}</strong>
          </div>
        </div>
      ) : null}

      {mode === 'time' ? (
        <div className="ritual-center-block">{timeControl}</div>
      ) : null}

      {mode === 'number' ? (
        <div className="ritual-center-block">
          <label className="ritual-single-field">
            <span>起卦数字</span>
            <input
              type="text"
              inputMode="numeric"
              className="workspace-ui-control ritual-serif-input"
              placeholder="输入起卦正整数"
              value={numberValue}
              onChange={(e) => onChangeNumber(e.target.value.replace(/[^\d]/g, ''))}
            />
          </label>

          <div className="ritual-quick-row">
            <button
              type="button"
              className="ritual-mini-btn"
              onClick={() => {
                onChangeNumber(String(Math.floor(Math.random() * 999) + 1));
              }}
            >
              机选一数
            </button>
          </div>
        </div>
      ) : null}

      {mode === 'sound' ? (
        <div className="ritual-center-block mh-sound-block">
          <button
            type="button"
            className="mh-sound-gong"
            aria-label="轻击青铜磬计声"
            onClick={() => {
              setGongPulseKey((k) => k + 1);
              onChangeSoundCount(String(parsedSoundCount + 1));
            }}
          >
            {gongPulseKey > 0 ? <span key={gongPulseKey} className="mh-sound-ripple" aria-hidden="true" /> : null}
            <strong className="mh-sound-gong-count">{parsedSoundCount > 0 ? parsedSoundCount : '磬'}</strong>
            <small>{parsedSoundCount > 0 ? `已闻 ${parsedSoundCount} 声 · 续击` : '轻击闻声计数'}</small>
          </button>

          <div className="mh-sound-inline-controls">
            <input
              type="text"
              inputMode="numeric"
              aria-label="声响次数"
              className="workspace-ui-control ritual-serif-input mh-sound-input"
              placeholder="声数"
              value={soundCount}
              onChange={(e) => onChangeSoundCount(e.target.value.replace(/[^\d]/g, ''))}
            />
            {parsedSoundCount > 0 ? (
              <button
                type="button"
                className="ritual-mini-btn"
                onClick={() => onChangeSoundCount('')}
              >
                清零
              </button>
            ) : null}
            <button
              type="button"
              className="ritual-mini-btn"
              onClick={() => {
                onChangeSoundCount(String(Math.floor(Math.random() * 12) + 1));
              }}
            >
              机选声数
            </button>
          </div>
        </div>
      ) : null}

      {mode === 'character' ? (
        <div className="ritual-center-block">
          <label className="ritual-single-field is-wide mh-char-calligraphy">
            <span>{charCount > 0 ? `起卦汉字（${charCount}字）` : '起卦汉字或短语'}</span>
            <div className="mh-char-scroll-box">
              <input
                type="text"
                className="workspace-ui-control ritual-serif-input"
                placeholder="如：春、明月、山河"
                value={charText}
                onChange={(e) => onChangeCharText(e.target.value)}
              />
            </div>
          </label>
        </div>
      ) : null}

      {mode === 'direction' ? (
        <div className="mh-direction-split">
          <div className="mh-compass-rose" role="group" aria-label="梅花八方取象罗盘">
            {(['southeast', 'south', 'southwest', 'east', 'CENTER', 'west', 'northeast', 'north', 'northwest'] as const).map(
              (cellId) => {
                if (cellId === 'CENTER') {
                  return (
                    <div key="CENTER" className="mh-compass-center">
                      <span
                        className="mh-compass-needle"
                        style={{ transform: `rotate(${compassAngle}deg)` }}
                        aria-hidden="true"
                      />
                      <span>{`${activeObj.glyph}${activeDir.glyph}`}</span>
                      <small>{`${activeObj.label.split('·')[1] ?? ''} / ${activeDir.label.split('·')[0] ?? ''}`}</small>
                    </div>
                  );
                }
                const dir = MEIHUA_DIRECTIONS.find((d) => d.value === cellId)!;
                const isActive = direction === dir.value;
                return (
                  <button
                    key={dir.value}
                    type="button"
                    className={`mh-compass-cell${isActive ? ' is-active' : ''}`}
                    aria-pressed={isActive}
                    onClick={() => {
                      onChangeDirection(dir.value);
                    }}
                  >
                    <span className="mh-cell-glyph">{dir.glyph}</span>
                    <strong>{dir.label}</strong>
                  </button>
                );
              },
            )}
          </div>

          <div className="mh-direction-right">
            {liveData ? (
              <div className="mh-live-preview is-compact" aria-live="polite">
                <div className="mh-live-triad">
                  <div className="mh-live-hex is-main">
                    <span className="mh-live-tag">主卦</span>
                    <span className="mh-live-sym">{liveData.mainHexagram.symbol}</span>
                    <strong>{liveData.originalName}</strong>
                  </div>
                  <span className="mh-live-arrow" aria-hidden="true">→</span>
                  <div className="mh-live-hex">
                    <span className="mh-live-tag">互卦</span>
                    <span className="mh-live-sym">{liveData.interHexagram.symbol}</span>
                    <strong>{liveData.interName}</strong>
                  </div>
                  <span className="mh-live-arrow" aria-hidden="true">→</span>
                  <div className="mh-live-hex">
                    <span className="mh-live-tag">变卦</span>
                    <span className="mh-live-sym">{liveData.changedHexagram.symbol}</span>
                    <strong>{liveData.changedName}</strong>
                  </div>
                </div>
                <div className="mh-live-meta">
                  <span>{liveData.movingYao.description}</span>
                  <span>{`体 ${liveData.tiGua.name}(${liveData.tiGua.element}) · 用 ${liveData.yongGua.name}(${liveData.yongGua.element})`}</span>
                  <strong>{liveData.analysis.tiYongRelation}</strong>
                </div>
              </div>
            ) : null}

            <div className="mh-object-strip" role="group" aria-label="所见物类">
              {MEIHUA_OBJECTS.map((item) => {
                const isActive = objectType === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    className={`mh-object-chip${isActive ? ' is-active' : ''}`}
                    aria-pressed={isActive}
                    onClick={() => {
                      onChangeObjectType(item.value);
                    }}
                  >
                    <span>{item.glyph}</span>
                    <strong>{item.label}</strong>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </RitualStageShell>
  );
}

// 按上南(午)下北(子)左东(卯)右西(酉)顺时针排列
const COMPASS_BRANCHES = ['午', '未', '申', '酉', '戌', '亥', '子', '丑', '寅', '卯', '辰', '巳'] as const;

interface JinkoujuePositionPreview {
  name: string;
  stem?: string;
  branch: string;
  god?: string;
  element: string;
  isVoid?: boolean;
}

interface JinkoujuePreviewData {
  ganzhi: { day: string; hour: string };
  monthLeader: string;
  positions: {
    renYuan: JinkoujuePositionPreview;
    guiShen: JinkoujuePositionPreview;
    jiangShen: JinkoujuePositionPreview;
    diFen: JinkoujuePositionPreview;
  };
  yinYangUse: { rule: string; usePosition: string };
  movements: Array<{ name: string }>;
}

export function JinkoujueStudio({
  mode,
  branch,
  numberValue,
  previewPayload,
  timeControl,
  showSubmitButton = false,
  onChangeMode,
  onChangeBranch,
  onChangeNumber,
}: {
  mode: 'time' | 'branch' | 'number' | 'random';
  branch: string;
  numberValue: string;
  previewPayload: Record<string, unknown> | null;
  timeControl: React.ReactNode;
  showSubmitButton?: boolean;
  onChangeMode: (next: 'time' | 'branch' | 'number' | 'random') => void;
  onChangeBranch: (next: string) => void;
  onChangeNumber: (next: string) => void;
}) {
  const { data: liveData } = useLiveDivinationData<JinkoujuePreviewData>(
    'jinkoujue',
    mode === 'random' ? null : previewPayload,
  );

  const slots = liveData
    ? [
        liveData.positions.renYuan,
        liveData.positions.guiShen,
        liveData.positions.jiangShen,
        liveData.positions.diFen,
      ]
    : null;

  const pillarsEl =
    slots && liveData ? (
      <div className="jkj-live-wrap" aria-live="polite">
        <div className="jkj-live-pillars">
          {slots.map((pos) => {
            const isYong = liveData.yinYangUse.usePosition === pos.name;
            return (
              <div
                key={pos.name}
                className={`jkj-live-card${isYong ? ' is-yong' : ''}`}
              >
                <span className="jkj-live-pos">
                  {pos.name}
                  {isYong ? <em>用</em> : null}
                </span>
                <strong>{`${pos.stem ?? ''}${pos.branch}`}</strong>
                <small>
                  {pos.god ? `${pos.god} · ${pos.element}` : pos.element}
                  {pos.isVoid ? ' · 空' : ''}
                </small>
              </div>
            );
          })}
        </div>
        <div className="jkj-live-meta">
          <span>{`${liveData.ganzhi.day}日 ${liveData.ganzhi.hour}时 · 月将${liveData.monthLeader}`}</span>
          <span>{liveData.yinYangUse.rule}</span>
          {liveData.movements.length > 0 ? (
            <strong>{liveData.movements.map((m) => m.name).join(' · ')}</strong>
          ) : null}
        </div>
      </div>
    ) : null;

  return (
    <RitualStageShell
      title="大六壬金口诀"
      showSubmitButton={showSubmitButton}
      submitLabel="起金口课"
      isComplete={Boolean(liveData) || mode === 'random'}
      headerRight={
        <UiSegmentedControl<'time' | 'random' | 'number' | 'branch'>
          value={mode}
          options={[
            { value: 'time', label: '时间' },
            { value: 'random', label: '随机' },
            { value: 'number', label: '报数' },
            { value: 'branch', label: '地分' },
          ]}
          onChange={onChangeMode}
        />
      }
    >
      {mode === 'branch' ? (
        <div className="jkj-branch-split">
          <div className="jkj-branch-wheel" role="group" aria-label="十二地支选地分">
            <div className="jkj-wheel-center">
              <strong>{`${branch}位`}</strong>
              <small>地分</small>
            </div>
            {COMPASS_BRANCHES.map((b, idx) => {
              const rad = ((idx * 30 - 90) * Math.PI) / 180;
              const leftPct = 50 + Math.cos(rad) * 39;
              const topPct = 50 + Math.sin(rad) * 39;
              const active = branch === b;
              return (
                <button
                  key={b}
                  type="button"
                  style={{ left: `${leftPct.toFixed(2)}%`, top: `${topPct.toFixed(2)}%` }}
                  className={`jkj-branch-node${active ? ' is-active' : ''}`}
                  aria-pressed={active}
                  onClick={() => onChangeBranch(b)}
                >
                  {b}
                </button>
              );
            })}
          </div>
          <div className="jkj-branch-right">
            {pillarsEl}
            {timeControl}
          </div>
        </div>
      ) : (
        <>
          {pillarsEl}

          {mode === 'number' ? (
            <div className="ritual-center-block">
              <label className="ritual-single-field">
                <span>起课数字</span>
                <input
                  type="text"
                  inputMode="numeric"
                  className="workspace-ui-control ritual-serif-input"
                  placeholder="输入正整数"
                  value={numberValue}
                  onChange={(e) => onChangeNumber(e.target.value.replace(/[^\d]/g, ''))}
                />
              </label>
              <div className="ritual-quick-row">
                <button
                  type="button"
                  className="ritual-mini-btn"
                  onClick={() => onChangeNumber(String(Math.floor(Math.random() * 12) + 1))}
                >
                  机选一数
                </button>
              </div>
              {timeControl}
            </div>
          ) : null}

          {mode === 'time' ? <div className="ritual-center-block">{timeControl}</div> : null}

          {mode === 'random' ? (
            <div className="ritual-center-block">
              <div className="ritual-quick-row">
                <button
                  type="button"
                  className="ritual-mini-btn"
                  onClick={() => {
                    const picked = COMPASS_BRANCHES[Math.floor(Math.random() * COMPASS_BRANCHES.length)]!;
                    onChangeBranch(picked);
                    onChangeMode('branch');
                  }}
                >
                  机选地分
                </button>
              </div>
              {timeControl}
            </div>
          ) : null}
        </>
      )}
    </RitualStageShell>
  );
}

export function ZhugeStudio({
  mode,
  coins,
  charRawInputs,
  numbers,
  showSubmitButton = false,
  onChangeMode,
  onChangeCoins,
  onChangeCharAt,
  onBlurCharAt,
  onChangeNumbers,
}: {
  mode: 'coins' | 'text' | 'numbers';
  coins: ReadonlyArray<'●' | '○'>;
  charRawInputs: readonly [string, string, string];
  numbers: readonly [string, string, string];
  showSubmitButton?: boolean;
  onChangeMode: (next: 'coins' | 'text' | 'numbers') => void;
  onChangeCoins: (next: Array<'●' | '○'>) => void;
  onChangeCharAt: (idx: number, raw: string) => void;
  onBlurCharAt: (idx: number) => void;
  onChangeNumbers: (next: [string, string, string]) => void;
}) {
  const [isTossing, setIsTossing] = React.useState(false);
  const [failedCoins, setFailedCoins] = React.useState<Record<number, boolean>>({});
  const tossTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (tossTimerRef.current !== null) window.clearTimeout(tossTimerRef.current);
    };
  }, []);

  const triggerTossFiveCoins = () => {
    if (isTossing) return;
    setIsTossing(true);
    if (tossTimerRef.current !== null) window.clearTimeout(tossTimerRef.current);
    tossTimerRef.current = window.setTimeout(() => {
      tossTimerRef.current = null;
      setIsTossing(false);
      onChangeCoins(Array.from({ length: 5 }, () => (Math.random() < 0.5 ? '●' : '○')));
    }, 420);
  };

  const zhugeActions =
    mode === 'coins' ? (
      <>
        {showSubmitButton ? (
          <button type="submit" className="workspace-ui-button is-primary ritual-primary-btn">
            启签解卦
          </button>
        ) : null}
        <button
          type="button"
          disabled={isTossing}
          className="workspace-ui-button is-secondary"
          onClick={triggerTossFiveCoins}
        >
          {isTossing ? '掷钱中…' : '手掷五钱'}
        </button>
      </>
    ) : undefined;

  return (
    <RitualStageShell
      showSubmitButton={showSubmitButton}
      submitLabel="启签解卦"
      actions={zhugeActions}
      isComplete={
        mode === 'coins' ||
        (mode === 'text' && charRawInputs.every((c) => Boolean(c.trim()))) ||
        (mode === 'numbers' && numbers.every((n) => Boolean(n.trim())))
      }
      headerRight={
        <UiSegmentedControl<'coins' | 'text' | 'numbers'>
          value={mode}
          options={[
            { value: 'coins', label: '五枚铜钱' },
            { value: 'text', label: '汉字三字' },
            { value: 'numbers', label: '数字取签' },
          ]}
          onChange={onChangeMode}
        />
      }
    >
      {mode === 'coins' ? (
        <div className="ritual-center-block is-wide">
          <div className={`zg-coin-tray${isTossing ? ' is-tossing' : ''}`} aria-label="五枚铜钱">
            {coins.map((symbol, idx) => {
              const isYang = symbol === '●';
              const src = isYang
                ? '/divination-assets/ritual/coin-heads.webp'
                : '/divination-assets/ritual/coin-tails.webp';
              return (
                <button
                  key={idx}
                  type="button"
                  className={`zg-coin-btn${isYang ? ' is-yang' : ' is-yin'}`}
                  aria-label={`第${idx + 1}枚铜钱：${isYang ? '正面阳' : '反面阴'}，点击切换`}
                  onClick={() => {
                    const next = [...coins];
                    next[idx] = isYang ? '○' : '●';
                    onChangeCoins(next);
                  }}
                >
                  <span className="zg-coin-disc">
                    {!failedCoins[idx] ? (
                      <img
                        src={src}
                        alt={isYang ? '阳（正面）' : '阴（反面）'}
                        loading="lazy"
                        onError={() => setFailedCoins((prev) => ({ ...prev, [idx]: true }))}
                      />
                    ) : (
                      <em className="zg-coin-fallback">{isYang ? '阳' : '阴'}</em>
                    )}
                  </span>
                  <small>{`第${idx + 1}枚 · ${isYang ? '阳' : '阴'}`}</small>
                </button>
              );
            })}
          </div>

          <div className="zg-pattern-pill">{coins.join('  ')}</div>
        </div>
      ) : null}

      {mode === 'text' ? (
        <div className="ritual-center-block">
          <div className="zg-hanzi-grid">
            {[0, 1, 2].map((i) => (
              <label key={i} className="zg-hanzi-cell">
                <span>{`第${i + 1}字`}</span>
                <div className="zg-tianzige">
                  <input
                    type="text"
                    maxLength={8}
                    placeholder="字"
                    value={charRawInputs[i]}
                    onChange={(e) => onChangeCharAt(i, e.target.value)}
                    onBlur={() => onBlurCharAt(i)}
                  />
                </div>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {mode === 'numbers' ? (
        <div className="ritual-center-block">
          <div className="xlr-three-nums-row">
            {[0, 1, 2].map((i) => (
              <label key={i} className="ritual-num-slot">
                <span>{`第${i + 1}数`}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  className="workspace-ui-control ritual-serif-input"
                  maxLength={4}
                  placeholder="0–9"
                  value={numbers[i]}
                  onChange={(e) => {
                    const next = [...numbers] as [string, string, string];
                    next[i] = e.target.value.replace(/[^\d]/g, '').slice(0, 4);
                    onChangeNumbers(next);
                  }}
                />
              </label>
            ))}
          </div>
          <div className="ritual-quick-row">
            <button
              type="button"
              className="ritual-mini-btn"
              onClick={() =>
                onChangeNumbers([
                  String(Math.floor(Math.random() * 9) + 1),
                  String(Math.floor(Math.random() * 9) + 1),
                  String(Math.floor(Math.random() * 9) + 1),
                ])
              }
            >
              机选三数
            </button>
          </div>
        </div>
      ) : null}
    </RitualStageShell>
  );
}
