import * as React from 'react';
import { ArrowUpRight, Check, Sparkles } from 'lucide-react';
import tarotData from '../../../systems/tarot-data.json';
import lenormandData from '../../../systems/lenormand-data.json';
import { openPlacePickerModal } from '../../../v2-ui/birth-place-modal';
import type { DivinationFormMethod } from '../../../v2-ui/chart-tabs';
import { UiSegmentedControl } from '../shared/UiSegmentedControl';
import { getBeijingNowParts } from '../culture/GanzhiCalendarPanel';
import { Select } from '../../../components/ui';

export type DrawnCardItem = {
  id: number;
  name: string;
  position: string;
  reversed?: boolean;
};

export type AlmanacParticipantDraft = {
  id: string;
  name: string;
  gender: '' | '男' | '女';
  year: string;
  month: string;
  day: string;
  shichenIndex: string;
  calendar: 'solar' | 'lunar';
};

export const MEIHUA_METHODS: ReadonlyArray<{
  id: 'time' | 'number' | 'character' | 'sound' | 'direction';
  label: string;
}> = [
  { id: 'time', label: '时间起卦' },
  { id: 'number', label: '报数起卦' },
  { id: 'character', label: '汉字起卦' },
  { id: 'sound', label: '声音起卦' },
  { id: 'direction', label: '方位物象' },
];

export const MEIHUA_DIRECTIONS: ReadonlyArray<{ value: string; label: string; glyph: string }> = [
  { value: 'southeast', label: '东南 · 巽', glyph: '☴' },
  { value: 'south', label: '正南 · 离', glyph: '☲' },
  { value: 'southwest', label: '西南 · 坤', glyph: '☷' },
  { value: 'east', label: '正东 · 震', glyph: '☳' },
  { value: 'west', label: '正西 · 兑', glyph: '☱' },
  { value: 'northeast', label: '东北 · 艮', glyph: '☶' },
  { value: 'north', label: '正北 · 坎', glyph: '☵' },
  { value: 'northwest', label: '西北 · 乾', glyph: '☰' },
];

export const MEIHUA_OBJECTS: ReadonlyArray<{ value: string; label: string; glyph: string }> = [
  { value: 'heaven', label: '天象 · 乾', glyph: '☰' },
  { value: 'lake', label: '泽水 · 兑', glyph: '☱' },
  { value: 'fire', label: '火光 · 离', glyph: '☲' },
  { value: 'thunder', label: '雷电 · 震', glyph: '☳' },
  { value: 'wind', label: '风木 · 巽', glyph: '☴' },
  { value: 'water', label: '流水 · 坎', glyph: '☵' },
  { value: 'mountain', label: '山石 · 艮', glyph: '☶' },
  { value: 'earth', label: '大地 · 坤', glyph: '☷' },
];

export const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;

export const ALMANAC_TOPICS: ReadonlyArray<{ value: string; label: string; desc: string }> = [
  { value: 'marriage', label: '嫁娶订婚', desc: '领证、婚礼、纳采问名' },
  { value: 'move', label: '入宅搬家', desc: '乔迁新居、安床入户' },
  { value: 'opening', label: '开业开市', desc: '店铺开张、项目启动' },
  { value: 'travel', label: '出行远行', desc: '旅游、出差、赴任远行' },
  { value: 'renovation', label: '动土修造', desc: '装修开工、破土修缮' },
  { value: 'contract', label: '签约交易', desc: '商务签署、置业纳财' },
  { value: 'medical', label: '求医问药', desc: '体检、手术、调理养生' },
  { value: 'study', label: '入学赴试', desc: '进修、考试、拜师习艺' },
  { value: 'burial', label: '安葬祭祀', desc: '安葬、立碑、祭奠追思' },
  { value: 'custom', label: '自定义事项', desc: '输入特定黄历宜忌词' },
];

export const CONSTRUCTION_PERIODS: ReadonlyArray<{ label: string; year: number; desc: string }> = [
  { label: '九运 2024–2043', year: 2024, desc: '下元九紫离火运' },
  { label: '八运 2004–2023', year: 2008, desc: '下元八白艮土运' },
  { label: '七运 1984–2003', year: 1996, desc: '下元七赤兑金运' },
  { label: '六运 1964–1983', year: 1975, desc: '中元六白乾金运' },
];

export const SHICHEN_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '', label: '时辰不详' },
  { value: '0', label: '早子时 (00:00–01:00)' },
  { value: '1', label: '丑时 (01:00–03:00)' },
  { value: '2', label: '寅时 (03:00–05:00)' },
  { value: '3', label: '卯时 (05:00–07:00)' },
  { value: '4', label: '辰时 (07:00–09:00)' },
  { value: '5', label: '巳时 (09:00–11:00)' },
  { value: '6', label: '午时 (11:00–13:00)' },
  { value: '7', label: '未时 (13:00–15:00)' },
  { value: '8', label: '申时 (15:00–17:00)' },
  { value: '9', label: '酉时 (17:00–19:00)' },
  { value: '10', label: '戌时 (19:00–21:00)' },
  { value: '11', label: '亥时 (21:00–23:00)' },
  { value: '12', label: '晚子时 (23:00–24:00)' },
];

export const TAROT_SPREAD_LIST: ReadonlyArray<{
  id: string;
  name: string;
  cardCount: number;
  positions: readonly string[];
  description: string;
}> = Object.entries(tarotData.spreads).map(([id, item]) => ({
  id,
  name: item.name,
  cardCount: item.cardCount,
  positions: item.positions,
  description: item.description,
}));

export const TAROT_SPREAD_CATEGORIES: ReadonlyArray<{
  id: 'common' | 'love' | 'career' | 'deep';
  label: string;
  spreadIds: readonly string[];
}> = [
  {
    id: 'common',
    label: '常用通用',
    spreadIds: ['single', 'three', 'holyTriangle', 'fourElements'],
  },
  {
    id: 'love',
    label: '感情人际',
    spreadIds: ['love', 'relationship', 'decision'],
  },
  {
    id: 'career',
    label: '事业财富',
    spreadIds: ['career', 'wealth', 'problemSolving', 'horseshoe'],
  },
  {
    id: 'deep',
    label: '深度全息',
    spreadIds: ['celtic', 'year', 'twelveHouses', 'chakra', 'mindBodySpirit', 'hexagram', 'universal'],
  },
];

export const LENORMAND_SPREAD_LIST: ReadonlyArray<{
  id: string;
  name: string;
  cardCount: number;
  positions: readonly string[];
}> = Object.entries(lenormandData.spreads).map(([id, item]) => ({
  id,
  name: item.name,
  cardCount: item.positions.length,
  positions: item.positions,
}));

export const FENGSHUI_COMPASS_GROUPS: ReadonlyArray<{
  id: string;
  label: string;
  subLabel: string;
  mountains: readonly [string, string, string];
}> = [
  { id: '坎', label: '坐北朝南 · 坎宅', subLabel: '壬 / 子 / 癸山', mountains: ['壬', '子', '癸'] },
  { id: '离', label: '坐南朝北 · 离宅', subLabel: '丙 / 午 / 丁山', mountains: ['丙', '午', '丁'] },
  { id: '震', label: '坐东朝西 · 震宅', subLabel: '甲 / 卯 / 乙山', mountains: ['甲', '卯', '乙'] },
  { id: '兑', label: '坐西朝东 · 兑宅', subLabel: '庚 / 酉 / 辛山', mountains: ['庚', '酉', '辛'] },
  { id: '巽', label: '坐东南朝西北 · 巽宅', subLabel: '辰 / 巽 / 巳山', mountains: ['辰', '巽', '巳'] },
  { id: '坤', label: '坐西南朝东北 · 坤宅', subLabel: '未 / 坤 / 申山', mountains: ['未', '坤', '申'] },
  { id: '乾', label: '坐西北朝东南 · 乾宅', subLabel: '戌 / 乾 / 亥山', mountains: ['戌', '乾', '亥'] },
  { id: '艮', label: '坐东北朝西南 · 艮宅', subLabel: '丑 / 艮 / 寅山', mountains: ['丑', '艮', '寅'] },
];

export function addDaysToDateStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (!Number.isFinite(d.getTime())) return dateStr;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function toBeijingIso(dateStr: string, timeStr: string): string {
  const cleanDate = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : getBeijingNowParts().dateStr;
  const timeParts = timeStr.split(':');
  const hh = (timeParts[0] || '12').padStart(2, '0');
  const mm = (timeParts[1] || '00').padStart(2, '0');
  return `${cleanDate}T${hh}:${mm}:00+08:00`;
}

export function getDefaultQuestionForMethod(method: DivinationFormMethod): string {
  switch (method) {
    case 'almanac':
      return '请筛选近期适合办理此事的黄道吉日与吉时。';
    case 'bazhai':
    case 'xuankong':
    case 'residential':
      return '这套住宅的坐向格局与居住人是否相合，布局上需要注意什么？';
    case 'wuyun-liuqi':
      return '这一年的五运六气气候节律与日常调养重点是什么？';
    case 'huangji-jingshi':
      return '这一阶段的元会运世值年卦象与大势主线如何理解？';
    default:
      return '这件事接下来的走向如何，我当下该如何应对？';
  }
}

export function CardOptionGrid<T extends string>({
  value,
  options,
  onSelect,
  columns,
  className = '',
}: {
  value: T;
  options: ReadonlyArray<{
    id: T;
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    instant?: boolean;
  }>;
  onSelect: (next: T) => void;
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  const colClass = columns
    ? `is-cols-${columns}`
    : options.length === 4
      ? 'is-cols-4'
      : options.length === 3
        ? 'is-cols-3'
        : options.length >= 5
          ? 'is-cols-auto'
          : 'is-cols-2';

  return (
    <div className={`divination-card-selector-grid ${colClass}${className ? ` ${className}` : ''}`}>
      {options.map((opt) => {
        const isActive = value === opt.id;
        const Icon = opt.icon ?? Sparkles;
        return (
          <button
            key={opt.id}
            type="button"
            className={`divination-card-option${isActive ? ' is-active' : ''}`}
            aria-pressed={isActive}
            onClick={() => {
              if (!opt.instant && isActive) return;
              onSelect(opt.id);
            }}
          >
            <div className="divination-card-option-top">
              <span className="divination-card-option-mark" aria-hidden="true">
                <Icon className="divination-card-option-icon" />
              </span>
              <span className="divination-card-option-indicator" aria-hidden="true">
                {!opt.instant && isActive ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                ) : opt.instant ? (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                ) : null}
              </span>
            </div>
            <strong className="divination-card-option-label">{opt.label}</strong>
          </button>
        );
      })}
    </div>
  );
}

export function DateTimeInputs({
  actionLabel,
  customDate,
  customTime,
  defaultDate,
  defaultTime,
  onChangeDate,
  onChangeTime,
}: {
  actionLabel: string;
  customDate: string;
  customTime: string;
  defaultDate: string;
  defaultTime: string;
  onChangeDate: (next: string) => void;
  onChangeTime: (next: string) => void;
}) {
  return (
    <div className="divination-extra-panel divination-time-panel">
      <div className="workspace-ui-form-row is-two-column">
        <label className="workspace-ui-field">
          <span>{`${actionLabel}日期`}</span>
          <input
            type="date"
            className="workspace-ui-control"
            value={customDate}
            onChange={(e) => onChangeDate(e.target.value || defaultDate)}
          />
        </label>
        <label className="workspace-ui-field">
          <span>{`${actionLabel}时间（北京时间）`}</span>
          <input
            type="time"
            className="workspace-ui-control"
            value={customTime}
            onChange={(e) => onChangeTime(e.target.value || defaultTime)}
          />
        </label>
      </div>
    </div>
  );
}

export function UnifiedTimeBlock({
  fieldLabel = '起卦时间',
  actionLabel = '起卦',
  timeMode,
  customDate,
  customTime,
  nowDateStr,
  nowTimeStr,
  useTrueSolar,
  placeDisplayName,
  placeLongitude,
  onChangeTimeMode,
  onChangeCustomDate,
  onChangeCustomTime,
  onChangeUseTrueSolar,
  onChangePlace,
  onRefreshCurrent,
}: {
  fieldLabel?: string;
  actionLabel?: string;
  supportTrueSolar?: boolean;
  timeMode: 'current' | 'custom';
  customDate: string;
  customTime: string;
  nowDateStr: string;
  nowTimeStr: string;
  useTrueSolar: boolean;
  placeDisplayName: string;
  placeLongitude: number;
  onChangeTimeMode: (mode: 'current' | 'custom') => void;
  onChangeCustomDate: (next: string) => void;
  onChangeCustomTime: (next: string) => void;
  onChangeUseTrueSolar: (checked: boolean) => void;
  onChangePlace: (displayName: string, longitude: number, latitude?: number) => void;
  onRefreshCurrent?: () => void;
}) {
  const currentMoment = `${nowDateStr.slice(5)} ${nowTimeStr}`;

  return (
    <div className="unified-time-block" aria-label={fieldLabel}>
      <div className="unified-time-controls">
        <div className="utb-clock-group">
          <UiSegmentedControl<'current' | 'custom'>
            value={timeMode}
            options={[
              { value: 'current', label: '此刻' },
              { value: 'custom', label: '自定' },
            ]}
            onChange={onChangeTimeMode}
          />
          {timeMode === 'current' ? (
            onRefreshCurrent ? (
              <button
                type="button"
                className="utb-now-chip"
                title="刷新此刻时间"
                aria-label="刷新此刻"
                onClick={onRefreshCurrent}
              >
                <span>{currentMoment}</span>
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M13.2 6.2A5.4 5.4 0 0 0 3.4 4.7M2.8 9.8a5.4 5.4 0 0 0 9.8 1.5M13.5 3.3v3h-3M2.5 12.7v-3h3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            ) : (
              <span className="utb-now-chip is-static">{currentMoment}</span>
            )
          ) : null}
        </div>

        <UiSegmentedControl<'beijing' | 'true-solar'>
          value={useTrueSolar ? 'true-solar' : 'beijing'}
          options={[
            { value: 'beijing', label: '北京时间' },
            { value: 'true-solar', label: '真太阳时' },
          ]}
          onChange={(val) => onChangeUseTrueSolar(val === 'true-solar')}
        />

        {useTrueSolar ? (
          <button
            type="button"
            className="unified-place-pill"
            onClick={() => {
              openPlacePickerModal({
                currentDisplayName: placeDisplayName,
                onSelect: (entry) => {
                  onChangePlace(entry.displayName, entry.longitude, entry.latitude);
                },
              });
            }}
          >
            <span>{`${placeDisplayName} · ${placeLongitude.toFixed(1)}°E`}</span>
            <em>更换</em>
          </button>
        ) : null}
      </div>

      {timeMode === 'custom' ? (
        <DateTimeInputs
          actionLabel={actionLabel}
          customDate={customDate}
          customTime={customTime}
          defaultDate={nowDateStr}
          defaultTime={nowTimeStr}
          onChangeDate={onChangeCustomDate}
          onChangeTime={onChangeCustomTime}
        />
      ) : null}
    </div>
  );
}

export function LabeledInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (val: string) => void;
}) {
  return (
    <label className="workspace-ui-field form-item">
      <span>{label}</span>
      <input
        type="text"
        className="workspace-ui-control form-input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function LabeledSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  value: string;
  onChange: (val: string) => void;
}) {
  if (options.length <= 6) {
    return (
      <div className="workspace-ui-field form-item">
        <span>{label}</span>
        <UiSegmentedControl<string>
          value={value}
          options={options.map((opt) => ({ value: opt.value, label: opt.label }))}
          onChange={onChange}
        />
      </div>
    );
  }
  return (
    <label className="workspace-ui-field form-item">
      <span>{label}</span>
      <Select
        className="form-input"
        value={value}
        onValueChange={onChange}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </Select>
    </label>
  );
}
