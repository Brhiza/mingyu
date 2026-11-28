import * as React from 'react';
import type { Method } from '../../../core';
import { loadGlobalRules } from '../../../web-settings';
import { runCalculateInBackground } from '../../../workers/calc-runner';
import { openPlacePickerModal } from '../../../v2-ui/birth-place-modal';
import { WorkspaceSkeleton } from '../WorkspaceSkeleton';
import type { CalendarToolTabId } from './culture-types';
import { getBeijingNowParts, parseDateParts, parseTimeParts } from './GanzhiCalendarPanel';

const CALENDAR_TABS: ReadonlyArray<{
  id: CalendarToolTabId;
  label: string;
  desc: string;
}> = [
  { id: 'solar-term', label: '节气交节', desc: '二十四节气精确交节时刻' },
  { id: 'moon-phase', label: '月相朔望', desc: '月龄、照明率与朔望弦月' },
  { id: 'true-solar', label: '真太阳时换算', desc: '经度与均时差太阳时修正' },
  { id: 'time-scales', label: '天文时间尺度', desc: '儒略日与地球力学时换算' },
  { id: 'solar-illumination', label: '太阳光照', desc: '日出日落、正午与曙暮光' },
];

export interface AstroCalendarPanelProps {
  initialDate?: string;
  onChange?: (method: Method, payload: Record<string, unknown>) => void;
  onResult?: (method: Method, payload: Record<string, unknown>, result: unknown) => void;
}

function formatReadableIso(raw: unknown, mode: 'beijing' | 'utc' | 'local' = 'local'): string {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) return '—';
  if (mode === 'beijing' || s.endsWith('Z')) {
    const ms = Date.parse(s);
    if (Number.isFinite(ms)) {
      const shifted = mode === 'utc' ? new Date(ms) : new Date(ms + 8 * 3_600_000);
      const y = shifted.getUTCFullYear();
      const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
      const d = String(shifted.getUTCDate()).padStart(2, '0');
      const hh = String(shifted.getUTCHours()).padStart(2, '0');
      const mm = String(shifted.getUTCMinutes()).padStart(2, '0');
      const ss = String(shifted.getUTCSeconds()).padStart(2, '0');
      return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
    }
  }
  return s.replace('T', ' ').replace(/\.\d+Z$/, '').replace(/Z$/, '');
}

export function AstroCalendarPanel({ initialDate, onChange, onResult }: AstroCalendarPanelProps) {
  const nowParts = React.useMemo(() => getBeijingNowParts(), []);

  const [activeKind, setActiveKind] = React.useState<CalendarToolTabId>('solar-term');
  const [selectedDate, setSelectedDate] = React.useState<string>(() =>
    initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? initialDate : nowParts.dateStr,
  );
  const [termYear, setTermYear] = React.useState<string>(() =>
    (initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)
      ? initialDate
      : nowParts.dateStr
    ).slice(0, 4),
  );
  const [selectedTime, setSelectedTime] = React.useState<string>(nowParts.timeStr);
  const [placeDisplay, setPlaceDisplay] = React.useState('北京市 东城区');
  const [placeLon, setPlaceLon] = React.useState(116.416);
  const [placeLat, setPlaceLat] = React.useState(39.928);

  const [loading, setLoading] = React.useState(false);
  const [errorText, setErrorText] = React.useState<string | null>(null);
  const [resultData, setResultData] = React.useState<Record<string, unknown> | undefined>(undefined);

  const calcSeqRef = React.useRef(0);

  const buildCalendarPayload = React.useCallback(
    (
      kind: CalendarToolTabId = activeKind,
      date = selectedDate,
      yearText = termYear,
      time = selectedTime,
      place = placeDisplay,
      lon = placeLon,
      lat = placeLat,
    ): Record<string, unknown> => {
      const d = parseDateParts(date);
      const t = parseTimeParts(time);

      switch (kind) {
        case 'solar-term':
          return {
            question: `请列出 ${yearText} 年二十四节气精确交节时刻。`,
            calendar: {
              kind: 'solar-term',
              year: Math.min(2199, Math.max(1900, Number.parseInt(yearText, 10) || nowParts.year)),
            },
          };
        case 'moon-phase': {
          const hh = String(t.hour).padStart(2, '0');
          const mm = String(t.minute).padStart(2, '0');
          return {
            question: '请解释该时刻的月相、月龄与前后朔望交点。',
            calendar: {
              kind: 'moon-phase',
              at: `${date}T${hh}:${mm}:00+08:00`,
            },
          };
        }
        case 'true-solar':
          return {
            question: `请计算 ${place}（经度 ${lon}°）在该钟表时刻的真太阳时修正。`,
            calendar: {
              kind: 'true-solar',
              birth: {
                year: d.year,
                month: d.month,
                day: d.day,
                hour: t.hour,
                minute: t.minute,
                second: 0,
                calendar: 'solar',
                timezone: 8,
              },
              longitude: lon,
            },
          };
        case 'time-scales':
          return {
            question: '请换算该时刻的儒略日 JD_UTC、ΔT 估算与近似地球力学时 JD_TT。',
            calendar: {
              kind: 'time-scales',
              time: {
                year: d.year,
                month: d.month,
                day: d.day,
                hour: t.hour,
                minute: t.minute,
                second: 0,
                timezone: 8,
              },
            },
          };
        case 'solar-illumination':
          return {
            question: `请计算 ${place} 当日的日出日落、视太阳正午与光照高度。`,
            calendar: {
              kind: 'solar-illumination',
              time: {
                year: d.year,
                month: d.month,
                day: d.day,
                hour: t.hour,
                minute: t.minute,
                second: 0,
                timezone: 8,
              },
              latitude: lat,
              longitude: lon,
            },
          };
      }
    },
    [activeKind, nowParts.year, placeDisplay, placeLat, placeLon, selectedDate, selectedTime, termYear],
  );

  const runCalculation = React.useCallback(
    async (
      kind: CalendarToolTabId = activeKind,
      date = selectedDate,
      yearText = termYear,
      time = selectedTime,
      place = placeDisplay,
      lon = placeLon,
      lat = placeLat,
    ) => {
      const seq = ++calcSeqRef.current;
      const payload = buildCalendarPayload(kind, date, yearText, time, place, lon, lat);
      onChange?.('calendar', payload);
      setLoading(true);
      setErrorText(null);
      try {
        const res = (await runCalculateInBackground('calendar', payload, {
          promptGuidance: loadGlobalRules().prompt,
        })) as {
          data?: { result?: Record<string, unknown> };
        };
        if (seq !== calcSeqRef.current) return;
        onResult?.('calendar', payload, res);
        setResultData(res.data?.result);
      } catch (err) {
        if (seq !== calcSeqRef.current) return;
        const rawMsg = err instanceof Error ? err.message.trim() : '';
        setErrorText(rawMsg && !rawMsg.startsWith('[') ? rawMsg : '历法推算失败，请检查输入年份与地点。');
      } finally {
        if (seq === calcSeqRef.current) setLoading(false);
      }
    },
    [
      activeKind,
      buildCalendarPayload,
      onChange,
      onResult,
      placeDisplay,
      placeLat,
      placeLon,
      selectedDate,
      selectedTime,
      termYear,
    ],
  );

  React.useEffect(() => {
    if (initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)) {
      setSelectedDate(initialDate);
      setTermYear(initialDate.slice(0, 4));
      void runCalculation(activeKind, initialDate, initialDate.slice(0, 4));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDate]);

  React.useEffect(() => {
    void runCalculation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderResult = () => {
    if (loading) return <WorkspaceSkeleton variant="calendar" />;
    if (errorText) return <div className="workspace-ui-form-error">{errorText}</div>;
    if (!resultData) return '暂无历法数据。';

    if (resultData.kind === 'solar-term' && Array.isArray(resultData.terms)) {
      return (
        <div className="culture-grid-list">
          {(
            resultData.terms as Array<{
              name: string;
              isJie: boolean;
              utcDateTime: string;
              targetLongitudeDegrees: number;
            }>
          ).map((term) => {
            const bjTime = new Date(term.utcDateTime).toLocaleString('zh-CN', {
              timeZone: 'Asia/Shanghai',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });
            return (
              <div key={`${term.name}-${term.utcDateTime}`}>
                <span>
                  {term.isJie ? '十二节 · 换月令' : '十二中气'} · 黄经{term.targetLongitudeDegrees}°
                </span>
                <strong>{term.name}</strong>
                <p>{`北京时间 ${bjTime}`}</p>
              </div>
            );
          })}
        </div>
      );
    }

    if (resultData.kind === 'moon-phase') {
      const frac =
        typeof resultData.illuminationFraction === 'number'
          ? (resultData.illuminationFraction * 100).toFixed(1)
          : '—';
      const age =
        typeof resultData.approximateMoonAgeDays === 'number'
          ? resultData.approximateMoonAgeDays.toFixed(2)
          : '—';
      const prev = resultData.previousPrincipalPhase as
        | { name?: string; utcDateTime?: string }
        | undefined;
      const next = resultData.nextPrincipalPhase as
        | { name?: string; utcDateTime?: string }
        | undefined;
      return (
        <div className="ganzhi-detail-facts">
          <div>
            <span>当前八相月相</span>
            <strong>{`${String(resultData.eightPhaseName ?? '')}（照明率 ${frac}%）`}</strong>
          </div>
          <div>
            <span>近似月龄</span>
            <strong>
              {`${age} 天（距朔角 ${Number(resultData.elongationDegrees ?? 0).toFixed(1)}°）`}
            </strong>
          </div>
          <div>
            <span>上一朔望弦</span>
            <strong>{`${prev?.name ?? '—'} · 北京时间 ${formatReadableIso(prev?.utcDateTime, 'beijing')}`}</strong>
          </div>
          <div>
            <span>下一朔望弦</span>
            <strong>{`${next?.name ?? '—'} · 北京时间 ${formatReadableIso(next?.utcDateTime, 'beijing')}`}</strong>
          </div>
        </div>
      );
    }

    if (resultData.kind === 'true-solar') {
      const corr = resultData.correction as
        | {
            longitudeCorrectionMinutes?: number;
            equationOfTimeMinutes?: number;
            totalCorrectionMinutes?: number;
          }
        | undefined;
      return (
        <div className="ganzhi-detail-facts">
          <div>
            <span>钟表平太阳时间</span>
            <strong>{`${formatReadableIso(resultData.localDateTime)}（东八区北京时间）`}</strong>
          </div>
          <div>
            <span>真太阳时结果</span>
            <strong>{`${formatReadableIso(resultData.trueSolarDateTime)}（${placeDisplay}）`}</strong>
          </div>
          <div>
            <span>经度平太阳时差</span>
            <strong>
              {`${(corr?.longitudeCorrectionMinutes ?? 0).toFixed(2)} 分钟（东经 ${placeLon.toFixed(2)}°）`}
            </strong>
          </div>
          <div>
            <span>均时差与总修正</span>
            <strong>
              {`总修正 ${(corr?.totalCorrectionMinutes ?? 0).toFixed(2)} 分钟（均时差 ${(
                corr?.equationOfTimeMinutes ?? 0
              ).toFixed(2)} 分钟）`}
            </strong>
          </div>
        </div>
      );
    }

    if (resultData.kind === 'time-scales') {
      const jdUtc =
        typeof resultData.julianDayUtc === 'number' ? resultData.julianDayUtc.toFixed(6) : '—';
      const jdTt =
        typeof resultData.approximateJulianDayTt === 'number'
          ? resultData.approximateJulianDayTt.toFixed(6)
          : '—';
      const deltaT =
        typeof resultData.deltaTSeconds === 'number'
          ? `${resultData.deltaTSeconds.toFixed(3)} 秒`
          : '—';
      return (
        <div className="ganzhi-detail-facts">
          <div>
            <span>当地民用时刻</span>
            <strong>{`${formatReadableIso(resultData.localDateTime)}（东八区）`}</strong>
          </div>
          <div>
            <span>世界标准时（UTC）</span>
            <strong>{formatReadableIso(resultData.utcDateTime, 'utc')}</strong>
          </div>
          <div>
            <span>儒略日（世界时）</span>
            <strong>{jdUtc}</strong>
          </div>
          <div>
            <span>地球自转估算 ΔT</span>
            <strong>{deltaT}</strong>
          </div>
          <div>
            <span>近似地球力学时</span>
            <strong>{jdTt}</strong>
          </div>
        </div>
      );
    }

    if (resultData.kind === 'solar-illumination') {
      const inst = resultData.instant as
        | { altitudeDegrees?: number; azimuthDegrees?: number; phase?: string }
        | undefined;
      const noons = Array.isArray(resultData.apparentSolarNoons)
        ? resultData.apparentSolarNoons
        : [];
      const firstNoon = noons[0] as
        | { localDateTime?: string; altitudeDegrees?: number }
        | undefined;
      return (
        <div className="ganzhi-detail-facts">
          <div>
            <span>当前昼夜阶段</span>
            <strong>{`${inst?.phase ?? '昼间'}（${placeDisplay}）`}</strong>
          </div>
          <div>
            <span>太阳高度角 / 方位角</span>
            <strong>
              {`高度 ${(inst?.altitudeDegrees ?? 0).toFixed(2)}° · 方位 ${(
                inst?.azimuthDegrees ?? 0
              ).toFixed(2)}°`}
            </strong>
          </div>
          <div>
            <span>当日视太阳正午（上中天）</span>
            <strong>
              {`${formatReadableIso(firstNoon?.localDateTime)}（中天高度 ${
                firstNoon?.altitudeDegrees !== undefined
                  ? `${firstNoon.altitudeDegrees.toFixed(2)}°`
                  : '—'
              }）`}
            </strong>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <section className="almanac-astro-panel">
      <div className="culture-tools-tabbar">
        <div className="workspace-ui-tabs">
          {CALENDAR_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              title={tab.desc}
              className={`workspace-ui-tab${activeKind === tab.id ? ' is-active' : ''}`}
              onClick={() => {
                setActiveKind(tab.id);
                void runCalculation(tab.id);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeKind === 'solar-term' ? (
        <div className="workspace-ui-form-row">
          <label className="workspace-ui-field">
            <span>公历年份（1900–2199）</span>
            <input
              type="text"
              className="workspace-ui-control"
              placeholder="输入四位公历年份"
              value={termYear}
              onChange={(e) => {
                const nextYear = e.target.value.replace(/[^\d]/g, '').slice(0, 4);
                setTermYear(nextYear);
                onChange?.(
                  'calendar',
                  buildCalendarPayload(activeKind, selectedDate, nextYear, selectedTime),
                );
              }}
            />
          </label>
        </div>
      ) : (
        <>
          <div className="workspace-ui-form-row is-two-column">
            <label className="workspace-ui-field">
              <span>公历日期</span>
              <input
                type="date"
                className="workspace-ui-control"
                value={selectedDate}
                onChange={(e) => {
                  const nextDate = e.target.value || nowParts.dateStr;
                  setSelectedDate(nextDate);
                  onChange?.(
                    'calendar',
                    buildCalendarPayload(activeKind, nextDate, termYear, selectedTime),
                  );
                }}
              />
            </label>
            <label className="workspace-ui-field">
              <span>钟表时刻（北京时间）</span>
              <input
                type="time"
                className="workspace-ui-control"
                value={selectedTime}
                onChange={(e) => {
                  const nextTime = e.target.value || nowParts.timeStr;
                  setSelectedTime(nextTime);
                  onChange?.(
                    'calendar',
                    buildCalendarPayload(activeKind, selectedDate, termYear, nextTime),
                  );
                }}
              />
            </label>
          </div>

          {activeKind === 'true-solar' || activeKind === 'solar-illumination' ? (
            <div className="workspace-ui-form-row">
              <div className="workspace-ui-field">
                <label>观测地区</label>
                <button
                  type="button"
                  className="workspace-ui-control address-trigger"
                  onClick={() => {
                    openPlacePickerModal({
                      title: '选择真太阳时 / 光照观测地区',
                      currentDisplayName: placeDisplay,
                      onSelect: (entry) => {
                        const nextLon = entry.longitude;
                        const nextLat = entry.latitude ?? 39.9;
                        setPlaceDisplay(entry.displayName);
                        setPlaceLon(nextLon);
                        setPlaceLat(nextLat);
                        void runCalculation(
                          activeKind,
                          selectedDate,
                          termYear,
                          selectedTime,
                          entry.displayName,
                          nextLon,
                          nextLat,
                        );
                      },
                    });
                  }}
                >
                  <span>{`${placeDisplay}（东经 ${placeLon.toFixed(2)}°，北纬 ${placeLat.toFixed(2)}°）`}</span>
                  <span className="address-trigger-arrow">更换</span>
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}

      <div className="workspace-ui-form-actions">
        <button
          type="button"
          className="workspace-ui-button is-primary"
          onClick={() => void runCalculation()}
        >
          立即换算
        </button>
      </div>

      <div>{renderResult()}</div>
    </section>
  );
}
