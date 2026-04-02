import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  calculateFullBaziChart,
  calculateFullZiweiChart,
  buildCombinedZiweiCompatibilityPrompt,
  buildCombinedZiweiPrompt,
  buildPersonFromInput,
  buildZiweiChartInput,
} from '@/lib/full-chart-engine';
import { buildAnalysisPayloadV1 } from '@/lib/iztro/build-analysis-payload';
import {
  buildHoroscope,
  getDefaultHoroscopeContext,
  shiftLocalDate,
} from '@/lib/iztro/runtime-helpers';
import {
  buildDecadalTimelineOptions,
  findCurrentDecadalOption,
  formatDecadalAgeRange,
} from '@/lib/iztro/decadal';
import {
  buildResultSearch,
  defaultPromptState,
  parseInputState,
  parsePromptState,
  type PromptSourceKey,
  type QueryPromptState,
  type ResultTabKey,
  type ZiweiScopeMode,
} from '@/lib/query-state';
import {
  buildBaziCustomPromptPatch,
  buildZiweiCustomPromptPatch,
  shouldShowPromptShareButton,
} from '@/lib/prompt-page-rules';
import { PageTopbar } from '@/components/PageTopbar';
import { uniqueNonEmptyStrings } from '@/lib/array-utils';
import type { AnalysisPayloadV1, PalaceFact } from '@/types/analysis';
import type { BaziChartResult } from '@/utils/bazi/baziTypes';
import type { ScopeType } from '@/types/analysis';
import type { BaziFortuneSelectionValue } from '@/utils/bazi/fortuneSelection';

type ZiweiRuntimeState = Awaited<ReturnType<typeof calculateFullZiweiChart>> | null;
type PromptEngineModule = typeof import('@/lib/prompt-engine');
type BaziFortuneSelectionModule = typeof import('@/utils/bazi/fortuneSelection');
type PromptShortcutMode =
  | '综合'
  | '事业'
  | '财运'
  | '婚恋'
  | '子女'
  | '六亲'
  | '健康'
  | '学业'
  | '自定义';
type InspirationCategory = '全部' | '事业' | '财运' | '婚恋' | '子女' | '六亲' | '健康';

const LazyBaziFortuneSelector = lazy(async () => {
  const module = await import('@/components/BaziFortuneTools');
  return { default: module.BaziFortuneSelector };
});

const LazyBaziFortuneModal = lazy(async () => {
  const module = await import('@/components/BaziFortuneTools');
  return { default: module.BaziFortuneModal };
});

const inspirationCategories: InspirationCategory[] = ['全部', '事业', '财运', '婚恋', '子女', '六亲', '健康'];

const commonQuestionInspirations: Array<{
  category: Exclude<InspirationCategory, '全部'>;
  question: string;
}> = [
  { category: '事业', question: '我更适合走稳定上班路线，还是尝试主动开拓发展？' },
  { category: '事业', question: '我在工作中更适合做执行、管理、专业技术，还是资源整合？' },
  { category: '事业', question: '我现在的事业卡点主要出在能力、人际还是选择方向？' },
  { category: '事业', question: '如果想换工作，我更该优先看平台、收入还是成长空间？' },
  { category: '事业', question: '我适不适合创业，还是更适合在体系内发展？' },
  { category: '事业', question: '我更适合留在熟悉领域深耕，还是切换到新方向？' },
  { category: '事业', question: '我在职场里最容易被看到的优势是什么？' },
  { category: '事业', question: '我在工作合作中更适合主导还是辅助？' },
  { category: '事业', question: '如果想提升事业发展，我最该先补哪一项能力？' },
  { category: '事业', question: '我的事业压力更多来自外部环境还是自己选择？' },
  { category: '财运', question: '我的财运更偏正财还是偏财？' },
  { category: '财运', question: '我更适合靠工资积累，还是靠副业、项目、经营来赚钱？' },
  { category: '财运', question: '我在财务上最容易踩的坑是什么？' },
  { category: '财运', question: '我更适合求稳理财，还是适度冒险争取更大收益？' },
  { category: '财运', question: '我的财富积累重点更在开源还是守财？' },
  { category: '财运', question: '我赚钱时更该依赖专业能力还是资源整合能力？' },
  { category: '财运', question: '我在金钱决策上更容易冲动还是保守？' },
  { category: '财运', question: '我是否容易出现赚得快但留不住的情况？' },
  { category: '财运', question: '我适不适合和别人一起做生意或投资？' },
  { category: '财运', question: '如果要改善财务状态，我最该先管住哪一块？' },
  { category: '婚恋', question: '我的感情模式更容易主动、被动，还是反复拉扯？' },
  { category: '婚恋', question: '我适合什么类型的伴侣？' },
  { category: '婚恋', question: '我在亲密关系里最需要调整的地方是什么？' },
  { category: '婚恋', question: '我感情不顺更容易出在选择对象还是相处方式？' },
  { category: '婚恋', question: '如果进入长期关系，我最需要注意什么问题？' },
  { category: '婚恋', question: '我在感情里更容易付出过多还是防备过重？' },
  { category: '婚恋', question: '我更适合慢热稳定型关系，还是强吸引型关系？' },
  { category: '婚恋', question: '我在关系中最容易触发的矛盾点是什么？' },
  { category: '婚恋', question: '我该怎么判断一段关系值不值得继续投入？' },
  { category: '婚恋', question: '我的婚恋重点更在遇到合适的人，还是学会正确相处？' },
  { category: '子女', question: '我的子女缘分深不深？' },
  { category: '子女', question: '我在亲子关系里更适合温和引导还是严格管理？' },
  { category: '子女', question: '我未来与子女的互动重点会体现在哪些方面？' },
  { category: '子女', question: '在子女教育上，我最需要避免什么做法？' },
  { category: '子女', question: '我与子女的关系更容易亲近还是有距离感？' },
  { category: '子女', question: '我在对子女的期待上会不会给自己太大压力？' },
  { category: '子女', question: '面对子女问题，我更该重视沟通还是规则建立？' },
  { category: '子女', question: '我的亲子关系中最需要注意的情绪模式是什么？' },
  { category: '六亲', question: '我和父母之间的关系重点与压力点是什么？' },
  { category: '六亲', question: '我和兄弟姐妹之间更容易互助还是有隐性消耗？' },
  { category: '六亲', question: '我在家庭关系中更容易承担责任，还是容易被关系拖累？' },
  { category: '六亲', question: '面对家人问题，我更适合主动介入还是保持边界？' },
  { category: '六亲', question: '我在家庭里更像支持者、协调者，还是承压者？' },
  { category: '六亲', question: '我与家人之间最需要厘清的边界问题是什么？' },
  { category: '六亲', question: '我在家庭责任分配上是否容易失衡？' },
  { category: '六亲', question: '我和原生家庭的影响更偏助力还是牵制？' },
  { category: '六亲', question: '我应该怎样处理亲情中的愧疚感和责任感？' },
  { category: '健康', question: '我的身体最需要注意哪些方面？' },
  { category: '健康', question: '我当前更容易出现情绪压力，还是身体透支问题？' },
  { category: '健康', question: '我的作息、饮食、运动里最该先调整哪一项？' },
  { category: '健康', question: '我在健康管理上最容易忽视的隐患是什么？' },
  { category: '健康', question: '我更需要注意慢性消耗，还是突然性的身体失衡？' },
  { category: '健康', question: '我的健康问题更容易和情绪、压力有关吗？' },
  { category: '健康', question: '如果只调整一个生活习惯，最该先改什么？' },
  { category: '健康', question: '我在休息和恢复方面最容易出现什么问题？' },
];

const baziSingleShortcutActions = [
  {
    label: '综合' as const,
    promptId: 'ai-mingge-zonglun',
    question:
      '请做一份综合分析，按“命局特点、性格优势与短板、事业发展、财运节奏、婚恋关系、六亲互动、健康隐患、学业与成长、当前阶段提醒、落地建议”这几个部分展开，结论尽量具体。',
  },
  {
    label: '事业' as const,
    promptId: 'ai-career',
    question:
      '请重点分析我的事业方向、适合的发展路径、职场优势、容易遇到的阻力、适合上班还是创业、当前阶段的突破口，以及接下来更值得投入的方向。',
  },
  {
    label: '财运' as const,
    promptId: 'ai-wealth-timing',
    question:
      '请重点分析我的财运类型、正财偏财表现、赚钱方式、起财时机、守财能力、容易破财的风险点，以及现阶段更稳妥的财务建议。',
  },
  {
    label: '婚恋' as const,
    promptId: 'ai-marriage',
    question:
      '请重点分析我的婚恋观与关系模式、适合的伴侣类型、感情中的优势和问题、婚缘节奏、进入长期关系后的注意点，以及当前最该调整的重点。',
  },
  {
    label: '子女' as const,
    promptId: 'ai-children-fate',
    question:
      '请重点分析我的子女缘、子女互动模式、亲子关系中的优势与压力、教育相处重点、需要注意的阶段性问题，以及更适合的引导方式。',
  },
  {
    label: '六亲' as const,
    promptId: 'ai-mingge-zonglun',
    question:
      '请重点分析我的六亲关系，分别说明与父母、兄弟姐妹、伴侣、子女之间的互动模式、助力与牵制、边界问题、责任压力，以及最需要改善的关系重点。',
  },
  {
    label: '健康' as const,
    promptId: 'ai-health',
    question:
      '请重点分析我最需要注意的健康隐患，说明更容易受影响的身心方向、压力与作息对健康的影响、生活习惯中的主要问题、日常调理重点，以及当前阶段的提醒。',
  },
  {
    label: '学业' as const,
    promptId: 'ai-mingge-zonglun',
    question:
      '请重点分析我的学业运、理解力与专注力特点、考试发挥、适合的学习方式、容易拖后腿的问题、进修深造潜力，以及当前最有效的提升建议。',
  },
] as const;

const ziweiSingleShortcutActions = [
  {
    label: '综合' as const,
    topic: 'life',
    question:
      '请做一份综合分析，按“人生主线、性格优势与短板、事业发展、财运节奏、婚恋关系、六亲互动、健康隐患、学业与成长、当前阶段提醒、落地建议”这几个部分展开，结论尽量具体。',
  },
  {
    label: '事业' as const,
    topic: 'career-wealth',
    question:
      '请重点分析我的事业方向、适合的发展路径、职场优势、容易遇到的阻力、适合上班还是创业、当前阶段的突破口，以及接下来更值得投入的方向。',
  },
  {
    label: '财运' as const,
    topic: 'career-wealth',
    question:
      '请重点分析我的财运类型、赚钱抓手、正财偏财表现、起财节奏、守财能力、容易破财的风险点，以及现阶段更稳妥的财务建议。',
  },
  {
    label: '婚恋' as const,
    topic: 'relationship',
    question:
      '请重点分析我的婚恋观与关系模式、适合的伴侣类型、感情中的优势和问题、婚缘节奏、进入长期关系后的注意点，以及当前最该调整的重点。',
  },
  {
    label: '子女' as const,
    topic: 'relationship',
    question:
      '请重点分析我的子女缘、子女互动模式、亲子关系中的优势与压力、教育相处重点、需要注意的阶段性问题，以及更适合的引导方式。',
  },
  {
    label: '六亲' as const,
    topic: 'chat',
    question:
      '请重点分析我的六亲关系，分别说明与父母、兄弟姐妹、伴侣、子女之间的互动模式、助力与牵制、边界问题、责任压力，以及最需要改善的关系重点。',
  },
  {
    label: '健康' as const,
    topic: 'chat',
    question:
      '请重点分析我最需要注意的健康隐患，说明更容易受影响的身心方向、压力与作息对健康的影响、生活习惯中的主要问题、日常养护重点，以及当前阶段的提醒。',
  },
  {
    label: '学业' as const,
    topic: 'chat',
    question:
      '请重点分析我的学业运、理解力与专注力特点、考试发挥、适合的学习方式、容易拖后腿的问题、进修深造潜力，以及当前最有效的提升建议。',
  },
] as const;

const ziweiScopeLabelMap: Record<ZiweiScopeMode, string> = {
  origin: '本命',
  decadal: '大限',
  yearly: '流年',
  monthly: '流月',
  daily: '流日',
  hourly: '流时',
};

const ZIWEI_GRID_ORDER = [3, 4, 5, 6, 2, 'center', 'center-skip', 7, 1, 'center-skip', 'center-skip', 8, 0, 11, 10, 9] as const;

function buildCombinedPromptText(system: string, user: string) {
  return [system, '', user].join('\n');
}

function formatGender(value: string) {
  return value === 'male' ? '男' : value === 'female' ? '女' : value || '未知';
}

function formatBaziDate(result: BaziChartResult) {
  return `${result.solarDate.year}-${String(result.solarDate.month).padStart(2, '0')}-${String(result.solarDate.day).padStart(2, '0')}`;
}

function joinText(values: Array<string | undefined>, fallback = '暂无') {
  const list = values.filter(Boolean) as string[];
  return list.length > 0 ? list.join('、') : fallback;
}

function joinMultilineText(values: Array<string | undefined>, fallback = '暂无') {
  return joinText(values, fallback).replaceAll('、', '\n');
}

function joinStarNames(stars: PalaceFact['major_stars'], fallback: string) {
  return stars.length > 0 ? stars.map((star) => star.name).join(' ') : fallback;
}

function getCurrentLiunian(result: BaziChartResult) {
  if (!result.liunian?.length) return null;
  const currentYear = new Date().getFullYear();
  return (
    result.liunian.find((item) => item.year === currentYear) ??
    result.liunian[0] ??
    null
  );
}

function splitGanZhi(value: string) {
  return [value.charAt(0), value.charAt(1)];
}

function formatMonthDayLabel(dateStr: string) {
  const [, month, day] = dateStr.split('-');
  return `${month}/${day}`;
}

function getDateParts(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return { year, month, day };
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function buildBaziFortuneSelectionValue(promptState: QueryPromptState): BaziFortuneSelectionValue {
  return {
    scope: promptState.baziFortuneScope,
    cycleIndex: parseOptionalNumber(promptState.baziFortuneCycleIndex),
    year: parseOptionalNumber(promptState.baziFortuneYear),
    month: parseOptionalNumber(promptState.baziFortuneMonth),
    day: parseOptionalNumber(promptState.baziFortuneDay),
  };
}

function ChartStar(props: {
  star: PalaceFact['major_stars'][number];
  tone: 'major' | 'minor' | 'scope';
}) {
  const { star, tone } = props;

  return (
    <span
      className={`chart-star chart-star-${tone} ${
        star.birth_mutagen ? 'has-birth-mutagen' : ''
      } ${star.active_scope_mutagen ? 'has-active-mutagen' : ''}`}
    >
      <span className="chart-star-name">{star.name}</span>
      {star.birth_mutagen ? (
        <span className="chart-star-mark chart-star-mark-birth">{star.birth_mutagen}</span>
      ) : null}
      {star.active_scope_mutagen ? (
        <span className="chart-star-mark chart-star-mark-active">{star.active_scope_mutagen}</span>
      ) : null}
    </span>
  );
}

function ChartStarLine(props: {
  stars: PalaceFact['major_stars'];
  tone: 'major' | 'minor' | 'scope';
  fallback?: string;
  limit?: number;
  layout?: 'wrap' | 'column';
}) {
  const stars = props.limit ? props.stars.slice(0, props.limit) : props.stars;
  const layoutClassName = props.layout === 'column' ? 'is-column' : 'is-wrap';

  if (stars.length === 0) {
    return props.fallback ? (
      <div className={`chart-cell-stars chart-cell-stars-${props.tone} ${layoutClassName}`}>
        <span className="chart-star-empty">{props.fallback}</span>
      </div>
    ) : null;
  }

  return (
    <div className={`chart-cell-stars chart-cell-stars-${props.tone} ${layoutClassName}`}>
      {stars.map((star) => (
        <ChartStar
          key={`${props.tone}-${star.name}-${star.birth_mutagen ?? 'n'}-${star.active_scope_mutagen ?? 'n'}`}
          star={star}
          tone={props.tone}
        />
      ))}
    </div>
  );
}

function ZiweiTraditionalBoard(props: {
  payload: AnalysisPayloadV1;
  boardTitle: string;
  name: string;
  selectedPalaceIndex: number;
  onSelectPalace: (index: number) => void;
}) {
  const { payload, boardTitle, name, selectedPalaceIndex, onSelectPalace } = props;
  const selectedPalace =
    payload.palaces.find((item) => item.index === selectedPalaceIndex) ??
    payload.palaces[0];
  const palaceMap = new Map(payload.palaces.map((item) => [item.index, item]));
  const oppositePalace = palaceMap.get(selectedPalace.opposite_palace_index)?.name ?? '暂无';
  const surrounded = selectedPalace.surrounded_palace_indexes
    .map((index) => palaceMap.get(index)?.name ?? `宫位${index}`)
    .join('、');
  const centerFocusTags = uniqueNonEmptyStrings(selectedPalace.scope_hits).slice(0, 2);
  const centerSummaryTags =
    centerFocusTags.length === 0
      ? uniqueNonEmptyStrings(selectedPalace.summary_tags).slice(0, 2)
      : [];

  return (
    <section className="ziwei-traditional-shell">
      <div className="ziwei-traditional-head">
        <div>
          <h3>{boardTitle}</h3>
        </div>
        <span className="result-chip result-chip-highlight">{payload.active_scope.label}</span>
      </div>

      <div className="ziwei-traditional-board">
        <div className="ziwei-board-note ziwei-board-note-top-left">
          命宫支
          <strong>{payload.basic_info.soul_palace_branch}</strong>
        </div>
        <div className="ziwei-board-note ziwei-board-note-top-right">
          身宫支
          <strong>{payload.basic_info.body_palace_branch}</strong>
        </div>
        <div className="ziwei-board-note ziwei-board-note-bottom-left">
          {payload.basic_info.chinese_date}
        </div>
        <div className="ziwei-board-note ziwei-board-note-bottom-right">
          {payload.basic_info.birth_time_label}
        </div>

        <div className="ziwei-traditional-grid">
          {ZIWEI_GRID_ORDER.map((item, index) => {
            if (item === 'center') {
              return (
                <div className="ziwei-board-center chart-center" key={`center-${index}`}>
                  <div className="ziwei-board-center-head chart-center-head">
                    <div className="chart-center-scope">{payload.active_scope.label}</div>
                    <div className="chart-center-age">{payload.active_scope.nominal_age} 岁</div>
                  </div>
                  <div className="chart-center-info">
                    <div>{name} · {payload.basic_info.gender}</div>
                    <div>{payload.basic_info.zodiac} / {payload.basic_info.sign}</div>
                    <div>{payload.basic_info.solar_date}</div>
                    <div>{payload.basic_info.lunar_date}</div>
                    <div>{payload.basic_info.birth_time_label}</div>
                    <div>{payload.active_scope.solar_date}</div>
                  </div>
                  <div className="ziwei-board-center-meta chart-center-grid">
                    <div className="chart-center-chip">命主 {payload.basic_info.soul}</div>
                    <div className="chart-center-chip">身主 {payload.basic_info.body}</div>
                    <div className="chart-center-chip">{payload.basic_info.five_elements_class}</div>
                    <div className="chart-center-chip">命宫 {payload.basic_info.soul_palace_branch}</div>
                    <div className="chart-center-chip">长生 {selectedPalace.changsheng12}</div>
                    <div className="chart-center-chip">博士 {selectedPalace.boshi12}</div>
                  </div>
                  <div className="ziwei-board-center-relation chart-center-focus">
                    <div className="chart-center-focus-label">当前宫位</div>
                    <div className="ziwei-board-center-name chart-center-focus-name">{selectedPalace.name}</div>
                    <div className="ziwei-board-center-stars chart-center-focus-stars">
                      {joinStarNames(selectedPalace.major_stars, '无主星')}
                    </div>
                    <div className="chart-center-relations">
                      <div className="chart-center-relation-row">
                        <span className="chart-center-relation-label">对宫</span>
                        <span className="chart-center-relation-value">{oppositePalace}</span>
                      </div>
                      <div className="chart-center-relation-row">
                        <span className="chart-center-relation-label">三方四正</span>
                        <span className="chart-center-relation-value">{surrounded}</span>
                      </div>
                    </div>
                    <div className="chart-center-badges">
                      {centerFocusTags.map((tag) => (
                        <span className="chart-center-chip chart-center-chip-strong" key={`${selectedPalace.index}-focus-${tag}`}>
                          {tag}
                        </span>
                      ))}
                      {centerSummaryTags.map((tag) => (
                        <span className="chart-center-chip" key={`${selectedPalace.index}-summary-${tag}`}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            }

            if (item === 'center-skip') {
              return <div className="ziwei-board-center ziwei-board-center-empty" key={`empty-${index}`} />;
            }

            const palace = palaceMap.get(item);
            if (!palace) return null;
            const isActive = palace.index === selectedPalaceIndex;
            const isOpposite = palace.index === selectedPalace.opposite_palace_index;
            const isSurrounded = selectedPalace.surrounded_palace_indexes.includes(palace.index);
            const footerBadges = uniqueNonEmptyStrings([
              palace.dynamic_scope_name ?? palace.scope_hits[0],
              palace.summary_tags[0],
              palace.changsheng12,
            ]).slice(0, 2);

            return (
              <button
                type="button"
                key={palace.index}
                className={`ziwei-grid-cell chart-cell ${isActive ? 'is-active' : ''} ${
                  palace.is_body_palace ? 'is-body-palace' : ''
                } ${isOpposite ? 'is-opposite is-relation-opposite' : ''} ${
                  isSurrounded ? 'is-surrounded is-relation-surrounded' : ''
                }`}
                onClick={() => onSelectPalace(palace.index)}
              >
                <div className="ziwei-grid-cell-corner chart-cell-corner chart-cell-corner-left">
                  {palace.heavenly_stem}
                  {palace.earthly_branch}
                </div>
                <div className="ziwei-grid-cell-corner chart-cell-corner chart-cell-corner-right">
                  {palace.decadal_range[0]}-{palace.decadal_range[1]}
                </div>
                <div className="chart-cell-body">
                  <div className="ziwei-grid-cell-title chart-cell-title-stack">
                    <span className="chart-cell-title">{palace.name}</span>
                    <div className="ziwei-grid-cell-flags chart-cell-flags">
                      {palace.is_body_palace ? <span className="chart-cell-flag">身</span> : null}
                      {palace.is_original_palace ? <span className="chart-cell-flag">因</span> : null}
                    </div>
                  </div>

                  <div className="chart-cell-major-column">
                    <ChartStarLine
                      fallback="无主星"
                      layout="column"
                      stars={palace.major_stars}
                      tone="major"
                    />
                  </div>

                  <div className="chart-cell-side-columns">
                    <ChartStarLine layout="column" limit={5} stars={palace.minor_stars} tone="minor" />
                    <ChartStarLine layout="column" limit={4} stars={palace.scope_stars} tone="scope" />
                  </div>
                </div>
                <div className="ziwei-grid-cell-foot chart-cell-foot">
                  {footerBadges.map((item) => (
                    <span className="chart-cell-badge" key={`${palace.index}-${item}`}>
                      {item}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function BaziFortuneLoadingCard() {
  return (
    <section className="fortune-selector-card fortune-selector-card-loading">
      <div className="fortune-skeleton-grid" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="fortune-skeleton-row" key={index}>
            <span className="skeleton-block fortune-skeleton-label" />
            <div className="fortune-skeleton-list">
              {Array.from({ length: 6 }, (_, itemIndex) => (
                <span className="skeleton-block fortune-skeleton-item" key={itemIndex} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function BaziFortuneLoadingModal() {
  return (
    <div className="modal-backdrop">
      <div className="modal-card bazi-fortune-modal">
        <div className="fortune-modal-skeleton" aria-hidden="true">
          <span className="skeleton-block fortune-modal-skeleton-title" />
          <span className="skeleton-block fortune-modal-skeleton-tip" />
          <span className="skeleton-block fortune-modal-skeleton-tip fortune-modal-skeleton-tip-short" />
          <div className="fortune-modal-skeleton-grid">
            {Array.from({ length: 4 }, (_, index) => (
              <div className="fortune-modal-skeleton-section" key={index}>
                <span className="skeleton-block fortune-modal-skeleton-heading" />
                <div className="fortune-modal-skeleton-list">
                  {Array.from({ length: 4 }, (_, itemIndex) => (
                    <span
                      className="skeleton-block fortune-modal-skeleton-item"
                      key={itemIndex}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function InlineSkeleton(props: {
  className?: string;
}) {
  return <span className={`skeleton-block ${props.className ?? ''}`.trim()} aria-hidden="true" />;
}

function PromptPreSkeleton() {
  return (
    <div className="result-pre result-pre-skeleton" aria-hidden="true">
      <span className="skeleton-block result-pre-skeleton-line" />
      <span className="skeleton-block result-pre-skeleton-line result-pre-skeleton-line-long" />
      <span className="skeleton-block result-pre-skeleton-line" />
      <span className="skeleton-block result-pre-skeleton-line result-pre-skeleton-line-short" />
      <span className="skeleton-block result-pre-skeleton-line result-pre-skeleton-line-long" />
      <span className="skeleton-block result-pre-skeleton-line" />
    </div>
  );
}

function ZiweiScopeModal(props: {
  selectedScope: ZiweiScopeMode;
  onApply: (scope: ZiweiScopeMode) => void;
  onClose: () => void;
}) {
  const { selectedScope, onApply, onClose } = props;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card ziwei-scope-modal" onClick={(event) => event.stopPropagation()}>
        <div className="panel-head">
          <div>
            <h2>选择年限</h2>
            <p>切换紫微提示词使用的运限层级。</p>
          </div>
        </div>

        <div className="draft-tip">
          <strong>当前使用：</strong>
          {ziweiScopeLabelMap[selectedScope]}
        </div>

        <div className="fortune-modal-grid">
          <section className="fortune-modal-section">
            <div className="fortune-modal-section-head">
              <h3>紫微运限</h3>
              <small>点击后直接切换提示词所用的紫微运限层级。</small>
            </div>
            <div className="fortune-modal-list">
              {Object.entries(ziweiScopeLabelMap).map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  className={`fortune-modal-item ${
                    selectedScope === key ? 'is-active is-selected' : ''
                  }`}
                  onClick={() => {
                    onApply(key as ZiweiScopeMode);
                    onClose();
                  }}
                >
                  <strong>{label}</strong>
                  <span>用于紫微提示词分析</span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="modal-actions">
          <button type="button" className="modal-btn modal-btn-secondary" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

function ZiweiFortuneSelector(props: {
  runtime: NonNullable<ZiweiRuntimeState>;
  selectedScope: ScopeType;
  selectedDateStr: string;
  onSelectScopeDate: (scope: ScopeType, dateStr: string) => void;
}) {
  const { runtime, selectedScope, selectedDateStr, onSelectScopeDate } = props;
  const defaultContext = useMemo(() => getDefaultHoroscopeContext(), []);
  const originPayload = runtime.payloadByScope.origin;
  const birthSolarDate = originPayload.basic_info.solar_date;
  const decadalOptions = useMemo(
    () => buildDecadalTimelineOptions(originPayload.palaces, birthSolarDate),
    [birthSolarDate, originPayload.palaces],
  );
  const initialDecadal = useMemo(
    () => findCurrentDecadalOption(decadalOptions, runtime.payloadByScope.yearly.active_scope.nominal_age),
    [decadalOptions, runtime],
  );
  const [selectedDecadalIndex, setSelectedDecadalIndex] = useState(
    Math.max(0, decadalOptions.findIndex((item) => item === initialDecadal)),
  );

  const selectedDecadal = decadalOptions[selectedDecadalIndex] ?? decadalOptions[0];
  const yearOptions = useMemo(() => {
    if (!selectedDecadal) return [];
    const items: Array<{
      year: number;
      age: number;
      dateStr: string;
      label: string;
      ganZhi: string;
    }> = [];

    for (let age = selectedDecadal.startAge; age <= selectedDecadal.endAge; age += 1) {
      const dateStr = shiftLocalDate(birthSolarDate, age - 1, 'year');
      const horoscope = buildHoroscope(runtime.astrolabe, dateStr, defaultContext.hourIndex);
      items.push({
        year: getDateParts(dateStr).year,
        age,
        dateStr,
        label: horoscope.yearly.name || `${getDateParts(dateStr).year}`,
        ganZhi: `${horoscope.yearly.heavenlyStem}${horoscope.yearly.earthlyBranch}`,
      });
    }

    return items;
  }, [birthSolarDate, defaultContext.hourIndex, runtime.astrolabe, selectedDecadal]);

  const [selectedYearDateStr, setSelectedYearDateStr] = useState(selectedDateStr);
  const selectedYearItem =
    yearOptions.find((item) => item.dateStr === selectedYearDateStr) ?? yearOptions[0];

  const monthOptions = useMemo(() => {
    if (!selectedYearItem) return [];
    const { year } = getDateParts(selectedYearItem.dateStr);
    return Array.from({ length: 12 }, (_, index) => {
      const dateStr = `${year}-${String(index + 1).padStart(2, '0')}-15`;
      const horoscope = buildHoroscope(runtime.astrolabe, dateStr, defaultContext.hourIndex);
      return {
        month: index + 1,
        dateStr,
        label: horoscope.monthly.name || `${index + 1}月`,
        ganZhi: `${horoscope.monthly.heavenlyStem}${horoscope.monthly.earthlyBranch}`,
      };
    });
  }, [defaultContext.hourIndex, runtime.astrolabe, selectedYearItem]);

  const [selectedMonthDateStr, setSelectedMonthDateStr] = useState(selectedDateStr);
  const selectedMonthItem =
    monthOptions.find((item) => item.dateStr === selectedMonthDateStr) ?? monthOptions[0];

  const dayOptions = useMemo(() => {
    if (!selectedMonthItem) return [];
    const { year, month } = getDateParts(selectedMonthItem.dateStr);
    return Array.from({ length: getDaysInMonth(year, month) }, (_, index) => {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`;
      const horoscope = buildHoroscope(runtime.astrolabe, dateStr, defaultContext.hourIndex);
      return {
        day: index + 1,
        dateStr,
        label: formatMonthDayLabel(dateStr),
        ganZhi: `${horoscope.daily.heavenlyStem}${horoscope.daily.earthlyBranch}`,
      };
    });
  }, [defaultContext.hourIndex, runtime.astrolabe, selectedMonthItem]);

  useEffect(() => {
    if (selectedDecadal && !yearOptions.some((item) => item.dateStr === selectedYearDateStr)) {
      setSelectedYearDateStr(yearOptions[0]?.dateStr ?? selectedDecadal.dateStr);
    }
  }, [selectedDecadal, selectedYearDateStr, yearOptions]);

  useEffect(() => {
    if (selectedYearItem && !monthOptions.some((item) => item.dateStr === selectedMonthDateStr)) {
      setSelectedMonthDateStr(monthOptions[0]?.dateStr ?? selectedYearItem.dateStr);
    }
  }, [monthOptions, selectedMonthDateStr, selectedYearItem]);

  return (
    <section className="fortune-selector-card fortune-selector-card-ziwei">
      <div className="fortune-grid">
        <div className="fortune-row">
          <div className="row-title">大限</div>
          <div className="fortune-container">
            {decadalOptions.map((item, index) => {
              const isActive = selectedScope === 'decadal' && selectedDateStr === item.dateStr;
              return (
                <button
                  type="button"
                  key={`${item.label}-${item.startAge}`}
                  className={`fortune-item ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedDecadalIndex(index);
                    onSelectScopeDate('decadal', item.dateStr);
                  }}
                >
                  <div className="fortune-year">{item.label}</div>
                  <div className="fortune-age">{formatDecadalAgeRange(item)}岁</div>
                  <div className="fortune-vertical-group">
                    <div className="fortune-text-chip">{formatMonthDayLabel(item.dateStr)}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="fortune-row">
          <div className="row-title">流年</div>
          <div className="fortune-container">
            {yearOptions.map((item) => {
              const [gan, zhi] = splitGanZhi(item.ganZhi);
              const isActive = selectedScope === 'yearly' && selectedDateStr === item.dateStr;
              return (
                <button
                  type="button"
                  key={item.dateStr}
                  className={`fortune-item ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedYearDateStr(item.dateStr);
                    onSelectScopeDate('yearly', item.dateStr);
                  }}
                >
                  <div className="fortune-year">{item.year}</div>
                  <div className="fortune-age">{item.age}岁</div>
                  <div className="fortune-vertical-group">
                    <div className="char-pair"><span className="main-char">{gan}</span></div>
                    <div className="char-pair"><span className="main-char">{zhi}</span></div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="fortune-row">
          <div className="row-title">流月</div>
          <div className="fortune-container">
            {monthOptions.map((item) => {
              const [gan, zhi] = splitGanZhi(item.ganZhi);
              const isActive = selectedScope === 'monthly' && selectedDateStr === item.dateStr;
              return (
                <button
                  type="button"
                  key={item.dateStr}
                  className={`fortune-item ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedMonthDateStr(item.dateStr);
                    onSelectScopeDate('monthly', item.dateStr);
                  }}
                >
                  <div className="fortune-year">{item.label}</div>
                  <div className="fortune-age">{formatMonthDayLabel(item.dateStr)}</div>
                  <div className="fortune-vertical-group">
                    <div className="char-pair"><span className="main-char">{gan}</span></div>
                    <div className="char-pair"><span className="main-char">{zhi}</span></div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="fortune-row">
          <div className="row-title">流日</div>
          <div className="fortune-container">
            {dayOptions.map((item) => {
              const [gan, zhi] = splitGanZhi(item.ganZhi);
              const isActive = selectedScope === 'daily' && selectedDateStr === item.dateStr;
              return (
                <button
                  type="button"
                  key={item.dateStr}
                  className={`fortune-item ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectScopeDate('daily', item.dateStr)}
                >
                  <div className="fortune-year">{item.day}</div>
                  <div className="fortune-age">{item.label}</div>
                  <div className="fortune-vertical-group">
                    <div className="char-pair"><span className="main-char">{gan}</span></div>
                    <div className="char-pair"><span className="main-char">{zhi}</span></div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function BaziChartBoard(props: {
  title: string;
  name: string;
  result: BaziChartResult;
}) {
  const { title, name, result } = props;
  const missingElements = uniqueNonEmptyStrings(result.wuxingStrength.missing);
  const pillarRows = [
    {
      label: '天干',
      values: [
        result.pillars.year.gan,
        result.pillars.month.gan,
        result.pillars.day.gan,
        result.pillars.hour.gan,
      ],
      className: 'is-stem',
    },
    {
      label: '地支',
      values: [
        result.pillars.year.zhi,
        result.pillars.month.zhi,
        result.pillars.day.zhi,
        result.pillars.hour.zhi,
      ],
      className: 'is-branch',
    },
    {
      label: '十神',
      values: [
        result.tenGods.year,
        result.tenGods.month,
        result.tenGods.day,
        result.tenGods.hour,
      ],
    },
    {
      label: '藏干',
      values: [
        joinMultilineText(result.hiddenStems.year, '无'),
        joinMultilineText(result.hiddenStems.month, '无'),
        joinMultilineText(result.hiddenStems.day, '无'),
        joinMultilineText(result.hiddenStems.hour, '无'),
      ],
      className: 'is-multiline',
    },
    {
      label: '副星',
      values: [
        joinMultilineText(result.hiddenTenGods.year, '无'),
        joinMultilineText(result.hiddenTenGods.month, '无'),
        joinMultilineText(result.hiddenTenGods.day, '无'),
        joinMultilineText(result.hiddenTenGods.hour, '无'),
      ],
      className: 'is-multiline',
    },
    {
      label: '纳音',
      values: [
        result.nayin.year,
        result.nayin.month,
        result.nayin.day,
        result.nayin.hour,
      ],
    },
    {
      label: '长生',
      values: [
        result.pillarLifeStages.year,
        result.pillarLifeStages.month,
        result.pillarLifeStages.day,
        result.pillarLifeStages.hour,
      ],
    },
    {
      label: '神煞',
      values: [
        joinMultilineText(result.shensha.year.slice(0, 3), '无'),
        joinMultilineText(result.shensha.month.slice(0, 3), '无'),
        joinMultilineText(result.shensha.day.slice(0, 3), '无'),
        joinMultilineText(result.shensha.hour.slice(0, 3), '无'),
      ],
      className: 'is-multiline',
    },
  ];

  return (
    <section className="result-showcase-card bazi-showcase-card">
      <div className="result-showcase-head">
        <div>
          <p className="result-section-kicker">{title}</p>
          <h2>{name}</h2>
        </div>
        <div className="result-chip-row">
          <span className="result-chip">{formatGender(result.gender)}</span>
          <span className="result-chip">{formatBaziDate(result)}</span>
          <span className="result-chip">{result.timeInfo.name}时</span>
        </div>
      </div>

      <div className="result-summary-grid result-summary-grid-bazi">
        <div className="result-stat-card result-stat-card-accent">
          <span>日主</span>
          <strong>{result.dayMaster.gan}</strong>
          <small>
            {result.dayMaster.element} · {result.dayMaster.yinYang}
          </small>
        </div>
        <div className="result-stat-card">
          <span>命格</span>
          <strong>{result.analysis.mingGe.pattern}</strong>
          <small>{result.analysis.dayMasterStrength.status}</small>
        </div>
        <div className="result-stat-card">
          <span>用神</span>
          <strong>{result.analysis.usefulGod.useful || '待定'}</strong>
          <small>{joinText(result.analysis.favorableElements, '暂无')}</small>
        </div>
        <div className="result-stat-card">
          <span>忌神</span>
          <strong>{result.analysis.avoidGod || '待定'}</strong>
          <small>{joinText(result.analysis.unfavorableElements, '暂无')}</small>
        </div>
      </div>

      <div className="bazi-core-layout">
        <div className="bazi-pillars-card">
          <div className="bazi-pillars-header">
            <h3>四柱盘</h3>
          </div>
          <div className="bazi-pillars-table">
            <div className="bazi-pillars-cell is-label is-head">信息</div>
            <div className="bazi-pillars-cell is-head">年柱</div>
            <div className="bazi-pillars-cell is-head">月柱</div>
            <div className="bazi-pillars-cell is-head is-day-master">日柱</div>
            <div className="bazi-pillars-cell is-head">时柱</div>
            {pillarRows.flatMap((row) => [
              <div key={`${row.label}-label`} className="bazi-pillars-cell is-label">
                {row.label}
              </div>,
              ...row.values.map((value, index) => (
                <div
                  key={`${row.label}-${index}`}
                  className={`bazi-pillars-cell ${row.className ?? ''} ${
                    index === 2 ? 'is-day-master' : ''
                  }`}
                >
                  {value}
                </div>
              )),
            ])}
          </div>
        </div>

        <div className="bazi-side-panel">
          <div className="result-side-card bazi-fortune-card">
            <div className="result-side-head">
              <h3>五行分布</h3>
              <p>{result.wuxingStrength.status}</p>
            </div>
            <div className="wuxing-bars">
              {Object.entries(result.wuxingStrength.percentages).map(([key, value]) => (
                <div className="wuxing-bar-row" key={key}>
                  <span className="wuxing-bar-label">{key}</span>
                  <div className="wuxing-bar-track">
                    <div className="wuxing-bar-fill" style={{ width: `${value}%` }} />
                  </div>
                  <strong>{value}%</strong>
                </div>
              ))}
            </div>
            <div className="result-tag-cloud">
              {missingElements.map((item) => (
                <span className="result-soft-tag" key={item}>
                  缺 {item}
                </span>
              ))}
            </div>
          </div>

          <Suspense fallback={<BaziFortuneLoadingCard />}>
            <LazyBaziFortuneSelector result={result} />
          </Suspense>
        </div>
      </div>
    </section>
  );
}

function ZiweiBoard(props: {
  title: string;
  name: string;
  payload: AnalysisPayloadV1;
  runtime: NonNullable<ZiweiRuntimeState>;
}) {
  const { title, name, payload, runtime } = props;
  const defaultContext = useMemo(() => getDefaultHoroscopeContext(), []);
  const [selectedScope, setSelectedScope] = useState<ScopeType>(payload.active_scope.scope);
  const [selectedDateStr, setSelectedDateStr] = useState(payload.active_scope.solar_date);
  const [selectedHourIndex] = useState(defaultContext.hourIndex);
  const selectedHoroscope = useMemo(
    () => buildHoroscope(runtime.astrolabe, selectedDateStr, selectedHourIndex),
    [runtime.astrolabe, selectedDateStr, selectedHourIndex],
  );
  const displayPayload = useMemo(
    () =>
      buildAnalysisPayloadV1({
        astrolabe: runtime.astrolabe,
        horoscope: selectedHoroscope,
        currentScope: selectedScope,
      }),
    [runtime.astrolabe, selectedHoroscope, selectedScope],
  );
  const [selectedPalaceIndex, setSelectedPalaceIndex] = useState(
    displayPayload.active_scope.palace_index ?? displayPayload.palaces[0]?.index ?? 0,
  );
  const selectedPalace =
    displayPayload.palaces.find((item) => item.index === selectedPalaceIndex) ??
    displayPayload.palaces[0];
  const oppositePalace =
    displayPayload.palaces.find((item) => item.index === selectedPalace?.opposite_palace_index) ??
    null;
  const surroundedPalaces = displayPayload.palaces.filter((item) =>
    selectedPalace?.surrounded_palace_indexes.includes(item.index),
  );
  const activeScopeMutagens = uniqueNonEmptyStrings(
    displayPayload.active_scope.mutagen_map.map((item) => `${item.mutagen} ${item.star}`),
  );
  const detailSummaryTags = selectedPalace
    ? uniqueNonEmptyStrings(selectedPalace.summary_tags)
    : [];
  const detailScopeHits = selectedPalace
    ? uniqueNonEmptyStrings(selectedPalace.scope_hits)
    : [];

  useEffect(() => {
    setSelectedScope(payload.active_scope.scope);
    setSelectedDateStr(payload.active_scope.solar_date);
  }, [payload.active_scope.scope, payload.active_scope.solar_date]);

  useEffect(() => {
    setSelectedPalaceIndex(
      displayPayload.active_scope.palace_index ?? displayPayload.palaces[0]?.index ?? 0,
    );
  }, [displayPayload]);

  return (
    <section className="result-showcase-card ziwei-showcase-card">
      <div className="result-showcase-head">
        <div>
          <p className="result-section-kicker">{title}</p>
          <h2>{name}</h2>
        </div>
        <div className="result-chip-row">
          <span className="result-chip">{displayPayload.active_scope.label}</span>
          <span className="result-chip">{displayPayload.basic_info.birth_time_label}</span>
          <span className="result-chip">{displayPayload.basic_info.gender}</span>
        </div>
      </div>

      <div className="result-summary-grid">
        <div className="result-stat-card result-stat-card-accent">
          <span>命主</span>
          <strong>{displayPayload.basic_info.soul}</strong>
          <small>命宫支 {displayPayload.basic_info.soul_palace_branch}</small>
        </div>
        <div className="result-stat-card">
          <span>身主</span>
          <strong>{displayPayload.basic_info.body}</strong>
          <small>身宫支 {displayPayload.basic_info.body_palace_branch}</small>
        </div>
        <div className="result-stat-card">
          <span>五行局</span>
          <strong>{displayPayload.basic_info.five_elements_class}</strong>
          <small>{displayPayload.basic_info.sign}</small>
        </div>
        <div className="result-stat-card">
          <span>当前时限</span>
          <strong>{displayPayload.active_scope.label}</strong>
          <small>{displayPayload.active_scope.solar_date}</small>
        </div>
      </div>

      <div className="ziwei-layout">
        <ZiweiTraditionalBoard
          payload={displayPayload}
          boardTitle="传统盘"
          name={name}
          selectedPalaceIndex={selectedPalaceIndex}
          onSelectPalace={setSelectedPalaceIndex}
        />

        <div className="ziwei-side-panel">
          <div className="ziwei-focus-card ziwei-summary-card">
            <div className="result-side-head">
              <h3>盘面摘要</h3>
            </div>
            <div className="result-meta-lines">
              <div>
                <span>阳历</span>
                <strong>{displayPayload.basic_info.solar_date}</strong>
              </div>
              <div>
                <span>农历</span>
                <strong>{displayPayload.basic_info.lunar_date}</strong>
              </div>
              <div>
                <span>生肖 / 星座</span>
                <strong>
                  {displayPayload.basic_info.zodiac} / {displayPayload.basic_info.sign}
                </strong>
              </div>
            </div>
            <div className="result-tag-cloud">
              {activeScopeMutagens.map((item) => (
                <span className="result-soft-tag result-soft-tag-strong" key={item}>
                  {item}
                </span>
              ))}
              {activeScopeMutagens.length === 0 ? (
                <span className="result-soft-tag">当前时限暂无四化标记</span>
              ) : null}
            </div>

            {selectedPalace ? (
              <div className="ziwei-detail-card">
                <div className="ziwei-detail-head">
                  <div>
                    <span className="ziwei-detail-kicker">当前宫位</span>
                    <h4>{selectedPalace.name}</h4>
                  </div>
                  <div className="result-chip-stack">
                    <span className="result-chip">
                      {selectedPalace.heavenly_stem}
                      {selectedPalace.earthly_branch}
                    </span>
                    {selectedPalace.dynamic_scope_name ? (
                      <span className="result-chip result-chip-highlight">
                        {selectedPalace.dynamic_scope_name}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="ziwei-detail-grid">
                  <div>
                    <span>主星</span>
                    <strong>{joinText(selectedPalace.major_stars.map((item) => item.name), '无主星')}</strong>
                  </div>
                  <div>
                    <span>辅星</span>
                    <strong>{joinText(selectedPalace.minor_stars.map((item) => item.name), '无')}</strong>
                  </div>
                  <div>
                    <span>对宫</span>
                    <strong>{oppositePalace?.name ?? '暂无'}</strong>
                  </div>
                  <div>
                    <span>三方四正</span>
                    <strong>{joinText(surroundedPalaces.map((item) => item.name), '暂无')}</strong>
                  </div>
                </div>
                <div className="result-tag-cloud">
                  {detailSummaryTags.map((tag) => (
                    <span className="result-soft-tag" key={`detail-${selectedPalace.index}-${tag}`}>
                      {tag}
                    </span>
                  ))}
                  {detailScopeHits.map((tag) => (
                    <span
                      className="result-soft-tag result-soft-tag-strong"
                      key={`detail-scope-${selectedPalace.index}-${tag}`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <ZiweiFortuneSelector
            runtime={runtime}
            selectedScope={selectedScope}
            selectedDateStr={selectedDateStr}
            onSelectScopeDate={(scope, dateStr) => {
              setSelectedScope(scope);
              setSelectedDateStr(dateStr);
            }}
          />
        </div>
      </div>
    </section>
  );
}

async function shareText(text: string) {
  if (navigator.share) {
    await navigator.share({
      text,
    });
    return true;
  }

  return false;
}

export function ResultPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const inputState = useMemo(() => parseInputState(searchParams), [searchParams]);
  const promptState = useMemo(() => parsePromptState(searchParams), [searchParams]);
  const shouldLoadBaziPromptModules =
    promptState.tab === 'prompt' && promptState.promptSource === 'bazi';
  const [baziResult, setBaziResult] = useState<BaziChartResult | null>(null);
  const [partnerBaziResult, setPartnerBaziResult] = useState<BaziChartResult | null>(null);
  const [baziError, setBaziError] = useState('');
  const [ziweiRuntime, setZiweiRuntime] = useState<ZiweiRuntimeState>(null);
  const [partnerZiweiRuntime, setPartnerZiweiRuntime] = useState<ZiweiRuntimeState>(null);
  const [ziweiError, setZiweiError] = useState('');
  const [shareState, setShareState] = useState('分享');
  const [copyState, setCopyState] = useState('复制');
  const [isBaziFortuneModalOpen, setIsBaziFortuneModalOpen] = useState(false);
  const [isZiweiScopeModalOpen, setIsZiweiScopeModalOpen] = useState(false);
  const [activeBaziShortcutMode, setActiveBaziShortcutMode] = useState<PromptShortcutMode>('自定义');
  const [activeZiweiShortcutMode, setActiveZiweiShortcutMode] = useState<PromptShortcutMode>('自定义');
  const [isQuestionInspirationModalOpen, setIsQuestionInspirationModalOpen] = useState(false);
  const [activeInspirationCategory, setActiveInspirationCategory] = useState<InspirationCategory>('全部');
  const [inspirationSearch, setInspirationSearch] = useState('');
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? 0 : window.innerWidth,
  );
  const [promptEngine, setPromptEngine] = useState<PromptEngineModule | null>(null);
  const [baziFortuneSelectionModule, setBaziFortuneSelectionModule] =
    useState<BaziFortuneSelectionModule | null>(null);

  useEffect(() => {
    try {
      const person = buildPersonFromInput(inputState);
      setBaziResult(calculateFullBaziChart(person));
      setBaziError('');
    } catch (error) {
      setBaziResult(null);
      setBaziError(error instanceof Error ? error.message : '八字排盘失败。');
    }
  }, [inputState]);

  useEffect(() => {
    if (inputState.analysisMode !== 'compatibility') {
      setPartnerBaziResult(null);
      return;
    }

    try {
      const partner = buildPersonFromInput({
        gender: inputState.partnerGender,
        year: inputState.partnerYear,
        month: inputState.partnerMonth,
        day: inputState.partnerDay,
        timeIndex: inputState.partnerTimeIndex,
        dateType: inputState.partnerDateType,
        isLeapMonth: inputState.partnerIsLeapMonth,
        useTrueSolarTime: inputState.partnerUseTrueSolarTime,
        birthHour: inputState.partnerBirthHour,
        birthMinute: inputState.partnerBirthMinute,
        birthPlace: inputState.partnerBirthPlace,
        birthLongitude: inputState.partnerBirthLongitude,
      });
      setPartnerBaziResult(calculateFullBaziChart(partner));
      setBaziError('');
    } catch (error) {
      setPartnerBaziResult(null);
      setBaziError(error instanceof Error ? error.message : '第二人八字排盘失败。');
    }
  }, [inputState]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    function handleResize() {
      setViewportWidth(window.innerWidth);
    }

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    if (
      (shouldLoadBaziPromptModules ? promptEngine : true) &&
      ((shouldLoadBaziPromptModules || isBaziFortuneModalOpen)
        ? baziFortuneSelectionModule
        : true)
    ) {
      return;
    }

    let cancelled = false;

    async function loadPromptModules() {
      const loaders: Array<Promise<void>> = [];

      if (shouldLoadBaziPromptModules && !promptEngine) {
        loaders.push(
          import('@/lib/prompt-engine').then((module) => {
            if (!cancelled) {
              setPromptEngine(module);
            }
          }),
        );
      }

      if ((shouldLoadBaziPromptModules || isBaziFortuneModalOpen) && !baziFortuneSelectionModule) {
        loaders.push(
          import('@/utils/bazi/fortuneSelection').then((module) => {
            if (!cancelled) {
              setBaziFortuneSelectionModule(module);
            }
          }),
        );
      }

      await Promise.all(loaders);
    }

    void loadPromptModules();

    return () => {
      cancelled = true;
    };
  }, [
    baziFortuneSelectionModule,
    isBaziFortuneModalOpen,
    promptEngine,
    shouldLoadBaziPromptModules,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const ziweiInput = buildZiweiChartInput(inputState);
        const runtime = await calculateFullZiweiChart(ziweiInput);
        if (!cancelled) {
          setZiweiRuntime(runtime);
          setZiweiError('');
        }
      } catch (error) {
        if (!cancelled) {
          setZiweiRuntime(null);
          setZiweiError(error instanceof Error ? error.message : '紫微排盘失败。');
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [inputState]);

  useEffect(() => {
    if (inputState.analysisMode !== 'compatibility') {
      setPartnerZiweiRuntime(null);
      return;
    }

    let cancelled = false;

    async function run() {
      try {
        const runtime = await calculateFullZiweiChart(
          buildZiweiChartInput({
            name: inputState.partnerName,
            gender: inputState.partnerGender,
            dateType: inputState.partnerDateType,
            year: inputState.partnerYear,
            month: inputState.partnerMonth,
            day: inputState.partnerDay,
            timeIndex: inputState.partnerTimeIndex,
            isLeapMonth: inputState.partnerIsLeapMonth,
          }),
        );
        if (!cancelled) {
          setPartnerZiweiRuntime(runtime);
          setZiweiError('');
        }
      } catch (error) {
        if (!cancelled) {
          setPartnerZiweiRuntime(null);
          setZiweiError(error instanceof Error ? error.message : '第二人紫微排盘失败。');
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [inputState]);

  const currentZiweiPayload = useMemo(() => {
    if (!ziweiRuntime) return null;
    return ziweiRuntime.payloadByScope[promptState.ziweiScope as ScopeType];
  }, [ziweiRuntime, promptState.ziweiScope]);

  const partnerZiweiPayload = useMemo(() => {
    if (!partnerZiweiRuntime) return null;
    return partnerZiweiRuntime.payloadByScope[promptState.ziweiScope as ScopeType];
  }, [partnerZiweiRuntime, promptState.ziweiScope]);

  const selectedBaziPreset = useMemo(
    () => {
      if (!promptEngine) {
        return null;
      }

      const promptList =
        inputState.analysisMode === 'compatibility'
          ? promptEngine.BAZI_AI_PROMPTS.combined
          : promptEngine.BAZI_AI_PROMPTS.single;

      return (
        promptList.find((item) => item.id === promptState.baziPresetId) ??
        promptList[0] ??
        null
      );
    },
    [inputState.analysisMode, promptEngine, promptState.baziPresetId],
  );

  const baziFortuneSelection = useMemo(
    () => buildBaziFortuneSelectionValue(promptState),
    [promptState],
  );
  const normalizedBaziFortuneSelection = useMemo(
    () => {
      if (!baziResult || !baziFortuneSelectionModule) {
        return { scope: 'natal' as const };
      }

      return baziFortuneSelectionModule.normalizeFortuneSelection(
        baziResult,
        baziFortuneSelection,
      );
    },
    [baziFortuneSelection, baziFortuneSelectionModule, baziResult],
  );
  const baziFortuneContext = useMemo(
    () => {
      if (!baziResult || !baziFortuneSelectionModule) {
        return null;
      }

      return baziFortuneSelectionModule.buildFortuneSelectionContext(
        baziResult,
        normalizedBaziFortuneSelection,
      );
    },
    [baziFortuneSelectionModule, baziResult, normalizedBaziFortuneSelection],
  );

  const finalBaziQuestion = useMemo(() => {
    const baseQuestion = promptState.baziQuickQuestion.trim() || '请先做整体解读。';
    if (baziFortuneContext) {
      return `请结合${baziFortuneContext.displayLabel}重点回答：${baseQuestion}`;
    }

    return baseQuestion;
  }, [baziFortuneContext, promptState.baziQuickQuestion]);

  const baziPromptText = useMemo(() => {
    if (promptState.tab !== 'prompt' || !promptEngine) return '';
    if (!baziResult) return '';
    if (inputState.analysisMode === 'compatibility') {
      if (!partnerBaziResult) return '';
      const compatibilityPrompt = promptEngine.getCompatibilityPrompt(
        promptState.baziQuickQuestion.trim() || '请先从婚恋匹配角度做整体解读。',
        baziResult,
        partnerBaziResult,
      );
      return buildCombinedPromptText(compatibilityPrompt.system, compatibilityPrompt.user);
    }
    if (!baziFortuneSelectionModule) return '';
    if (!selectedBaziPreset) return '';
    const { system, user } = promptEngine.buildPromptFromConfig(
      finalBaziQuestion,
      selectedBaziPreset,
      baziResult,
      0,
      false,
      baziFortuneContext,
    );
    return buildCombinedPromptText(system, user);
  }, [baziFortuneContext, baziFortuneSelectionModule, baziResult, finalBaziQuestion, inputState.analysisMode, partnerBaziResult, promptEngine, promptState.baziQuickQuestion, promptState.tab, selectedBaziPreset]);

  const ziweiPromptText = useMemo(() => {
    if (promptState.tab !== 'prompt') return '';
    if (inputState.analysisMode === 'compatibility') {
      if (!currentZiweiPayload || !partnerZiweiPayload) return '';
      return buildCombinedZiweiCompatibilityPrompt({
        primaryPayload: currentZiweiPayload,
        partnerPayload: partnerZiweiPayload,
        topic: promptState.ziweiTopic,
        question:
          promptState.ziweiQuickQuestion || '请先分析双方关系匹配度、互动模式和相处建议。',
      });
    }
    if (!currentZiweiPayload) return '';
    return buildCombinedZiweiPrompt(
      currentZiweiPayload,
      promptState.ziweiTopic,
      promptState.ziweiQuickQuestion || '请先做整体解读。',
    );
  }, [currentZiweiPayload, inputState.analysisMode, partnerZiweiPayload, promptState.tab, promptState.ziweiQuickQuestion, promptState.ziweiTopic]);

  const activePromptText =
    promptState.promptSource === 'bazi' ? baziPromptText : ziweiPromptText;
  const isBaziFortuneSummaryLoading =
    shouldLoadBaziPromptModules && !baziFortuneSelectionModule;
  const baziFortuneSummaryText = baziFortuneContext?.displayText ?? '仅使用本命信息';
  const ziweiScopeSummaryText = ziweiScopeLabelMap[promptState.ziweiScope] ?? '本命';
  const showShareButton = shouldShowPromptShareButton({
    viewportWidth,
    hasNavigatorShare: typeof navigator !== 'undefined' && typeof navigator.share === 'function',
  });
  const filteredQuestionInspirations = useMemo(() => {
    const keyword = inspirationSearch.trim();

    return commonQuestionInspirations.filter((item) => {
      const matchesCategory =
        activeInspirationCategory === '全部' || item.category === activeInspirationCategory;
      const matchesKeyword = keyword ? item.question.includes(keyword) : true;
      return matchesCategory && matchesKeyword;
    });
  }, [activeInspirationCategory, inspirationSearch]);

  function updatePromptState(next: Partial<QueryPromptState>) {
    const merged = {
      ...promptState,
      ...next,
    };
    setSearchParams(buildResultSearch(inputState, merged));
  }

  function switchTab(tab: ResultTabKey) {
    updatePromptState({ tab });
  }

  function applyBaziShortcutMode(mode: PromptShortcutMode) {
    setActiveBaziShortcutMode(mode);
    if (mode === '自定义') {
      updatePromptState(buildBaziCustomPromptPatch());
      return;
    }

    const matched = baziSingleShortcutActions.find((item) => item.label === mode);
    if (!matched) {
      return;
    }

    updatePromptState({
      baziPresetId: matched.promptId,
      baziQuickQuestion: matched.question,
    });
  }

  function applyZiweiShortcutMode(mode: PromptShortcutMode) {
    setActiveZiweiShortcutMode(mode);
    if (mode === '自定义') {
      updatePromptState(buildZiweiCustomPromptPatch());
      return;
    }

    const matched = ziweiSingleShortcutActions.find((item) => item.label === mode);
    if (!matched) {
      return;
    }

    updatePromptState({
      ziweiTopic: matched.topic,
      ziweiQuickQuestion: matched.question,
    });
  }

  function applyInspiredQuestion(question: string) {
    if (promptState.promptSource === 'bazi') {
      setActiveBaziShortcutMode('自定义');
      updatePromptState({
        baziPresetId: 'ai-mingge-zonglun',
        baziQuickQuestion: question,
      });
    } else {
      setActiveZiweiShortcutMode('自定义');
      updatePromptState({
        ziweiTopic: 'chat',
        ziweiQuickQuestion: question,
      });
    }

    setIsQuestionInspirationModalOpen(false);
  }

  function openQuestionInspirationModal() {
    setActiveInspirationCategory('全部');
    setInspirationSearch('');
    setIsQuestionInspirationModalOpen(true);
  }

  async function handleShare() {
    if (!activePromptText) {
      setShareState('暂无内容');
      return;
    }

    try {
      const ok = await shareText(activePromptText);
      setShareState(ok ? '已调起系统分享' : '当前设备不支持系统分享');
    } catch {
      setShareState('分享失败');
    }
  }

  async function handleCopy() {
    if (!activePromptText) {
      setCopyState('暂无内容');
      return;
    }

    try {
      await navigator.clipboard.writeText(activePromptText);
      setCopyState('已复制');
    } catch {
      setCopyState('复制失败');
    }
  }

  return (
    <div className="page-shell">
      <PageTopbar
        title="排盘结果"
        wide
        onBack={() =>
          navigate(`/?mode=${inputState.analysisMode === 'compatibility' ? 'compatibility' : 'single'}`)
        }
      />

      <div className="tab-strip">
        <button type="button" className={`tab-chip ${promptState.tab === 'bazi' ? 'is-active' : ''}`} onClick={() => switchTab('bazi')}>
          八字
        </button>
        <button type="button" className={`tab-chip ${promptState.tab === 'ziwei' ? 'is-active' : ''}`} onClick={() => switchTab('ziwei')}>
          紫薇
        </button>
        <button type="button" className={`tab-chip ${promptState.tab === 'prompt' ? 'is-active' : ''}`} onClick={() => switchTab('prompt')}>
          AI
        </button>
      </div>

      <div className="result-tab-stage">
        <div
          className={`result-tab-pane ${promptState.tab === 'bazi' ? 'is-active' : 'is-inactive'}`}
          aria-hidden={promptState.tab !== 'bazi'}
        >
          <div className="single-panel-shell">
            <section className="panel result-panel result-panel-bazi">
              {baziError ? <p className="error-text">{baziError}</p> : null}
              {inputState.analysisMode === 'compatibility' ? (
                <div className="result-dual-layout">
                  {baziResult ? (
                    <BaziChartBoard
                      title="第一人八字"
                      name={inputState.name || '第一人'}
                      result={baziResult}
                    />
                  ) : null}
                  {partnerBaziResult ? (
                    <BaziChartBoard
                      title="第二人八字"
                      name={inputState.partnerName || '第二人'}
                      result={partnerBaziResult}
                    />
                  ) : null}
                </div>
              ) : baziResult ? (
                <BaziChartBoard
                  title="八字总览"
                  name={inputState.name || '当前命盘'}
                  result={baziResult}
                />
              ) : null}
            </section>
          </div>
        </div>

        <div
          className={`result-tab-pane ${promptState.tab === 'ziwei' ? 'is-active' : 'is-inactive'}`}
          aria-hidden={promptState.tab !== 'ziwei'}
        >
          <div className="single-panel-shell">
            <section className="panel result-panel result-panel-ziwei">
              {ziweiError ? <p className="error-text">{ziweiError}</p> : null}
              {inputState.analysisMode === 'compatibility' && currentZiweiPayload && partnerZiweiPayload ? (
                <div className="result-dual-layout">
                  <ZiweiBoard
                    title="第一人紫微"
                    name={inputState.name || '第一人'}
                    payload={currentZiweiPayload}
                    runtime={ziweiRuntime!}
                  />
                  <ZiweiBoard
                    title="第二人紫微"
                    name={inputState.partnerName || '第二人'}
                    payload={partnerZiweiPayload}
                    runtime={partnerZiweiRuntime!}
                  />
                </div>
              ) : null}
              {inputState.analysisMode !== 'compatibility' && currentZiweiPayload ? (
                <ZiweiBoard
                  title="紫微总览"
                  name={inputState.name || '当前命盘'}
                  payload={currentZiweiPayload}
                  runtime={ziweiRuntime!}
                />
              ) : null}
            </section>
          </div>
        </div>

        <div
          className={`result-tab-pane ${promptState.tab === 'prompt' ? 'is-active' : 'is-inactive'}`}
          aria-hidden={promptState.tab !== 'prompt'}
        >
          <div className="workspace-grid">
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>提示词设置</h2>
                  <p>选择基于八字或紫微，再用快捷按钮生成问题。</p>
                </div>
              </div>

              <div className="field-list">
                <div className="prompt-compact-grid">
                  <label className="field-card">
                    <div className="field-header">
                      <span>提示词来源</span>
                    </div>
                    <select
                      value={promptState.promptSource}
                      onChange={(event) =>
                        updatePromptState({
                          promptSource: event.target.value as PromptSourceKey,
                        })
                      }
                    >
                      <option value="bazi">基于八字</option>
                      <option value="ziwei">基于紫微</option>
                    </select>
                  </label>

                  {promptState.promptSource === 'bazi' && inputState.analysisMode === 'single' ? (
                    <div className="field-card">
                      <div className="field-header">
                        <span>年限选择</span>
                      </div>
                      <button
                        type="button"
                        className="place-trigger"
                        onClick={() => setIsBaziFortuneModalOpen(true)}
                      >
                        {isBaziFortuneSummaryLoading ? (
                          <InlineSkeleton className="inline-skeleton inline-skeleton-medium" />
                        ) : (
                          <span>{baziFortuneSummaryText}</span>
                        )}
                      </button>
                    </div>
                  ) : null}

                  {promptState.promptSource === 'ziwei' ? (
                    <div className="field-card">
                      <div className="field-header">
                        <span>年限选择</span>
                      </div>
                      <button
                        type="button"
                        className="place-trigger"
                        onClick={() => setIsZiweiScopeModalOpen(true)}
                      >
                        <span>{ziweiScopeSummaryText}</span>
                      </button>
                      <small>点击后用模态窗切换紫微提示词使用的运限层级。</small>
                    </div>
                  ) : null}
                </div>

                {promptState.promptSource === 'bazi' ? (
                  <>
                    <div className="quick-grid">
                      {(inputState.analysisMode === 'compatibility'
                        ? [
                            { label: '合婚', promptId: 'ai-compat-marriage', question: '请重点分析我们两人的婚恋匹配度、长期磨合点和相处建议。' },
                            { label: '合伙', promptId: 'ai-compat-career', question: '请重点分析我们两人的合作模式、分工建议和利益风险。' },
                            { label: '友情', promptId: 'ai-compat-friendship', question: '请重点分析我们两人的相处默契、冲突点和关系建议。' },
                          ]
                        : baziSingleShortcutActions
                      ).map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          className={`quick-chip ${
                            inputState.analysisMode === 'single' && activeBaziShortcutMode === item.label
                              ? 'is-active'
                              : ''
                          }`}
                          onClick={() =>
                            inputState.analysisMode === 'compatibility'
                              ? updatePromptState({
                                  baziPresetId: item.promptId,
                                  baziQuickQuestion: item.question,
                                })
                              : applyBaziShortcutMode(item.label)
                          }
                        >
                          {item.label}
                        </button>
                      ))}
                      {inputState.analysisMode === 'single' ? (
                        <>
                          <button
                            type="button"
                            className={`quick-chip ${activeBaziShortcutMode === '自定义' ? 'is-active' : ''}`}
                            onClick={() => applyBaziShortcutMode('自定义')}
                          >
                            自定义
                          </button>
                          <button
                            type="button"
                            className="quick-chip"
                            onClick={openQuestionInspirationModal}
                          >
                            问题灵感
                          </button>
                        </>
                      ) : null}
                    </div>

                    {inputState.analysisMode === 'single' && activeBaziShortcutMode === '自定义' ? (
                      <label className="field-card">
                        <div className="field-header">
                          <span>自定义问题</span>
                        </div>
                        <textarea
                          rows={6}
                          value={promptState.baziQuickQuestion}
                          placeholder="例如：我近期适合换工作还是稳住？"
                          onChange={(event) =>
                            updatePromptState({
                              baziQuickQuestion: event.target.value,
                            })
                          }
                        />
                      </label>
                    ) : null}
                  </>
                ) : null}

                {promptState.promptSource === 'ziwei' ? (
                  <>
                    <div className="quick-grid">
                      {(inputState.analysisMode === 'compatibility'
                        ? [
                            { label: '感情', topic: 'relationship', question: '请重点分析双方关系匹配度、吸引点、冲突点和相处建议。' },
                            { label: '合作', topic: 'career-wealth', question: '请重点分析双方合作默契、优势互补和潜在风险。' },
                            { label: '相处', topic: 'chat', question: '请从双方盘面看互动模式、沟通盲点和长期建议。' },
                          ]
                        : ziweiSingleShortcutActions
                      ).map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          className={`quick-chip ${
                            inputState.analysisMode === 'single' && activeZiweiShortcutMode === item.label
                              ? 'is-active'
                              : ''
                          }`}
                          onClick={() =>
                            inputState.analysisMode === 'compatibility'
                              ? updatePromptState({
                                  ziweiTopic: item.topic,
                                  ziweiQuickQuestion: item.question,
                                })
                              : applyZiweiShortcutMode(item.label)
                          }
                        >
                          {item.label}
                        </button>
                      ))}
                      {inputState.analysisMode === 'single' ? (
                        <>
                          <button
                            type="button"
                            className={`quick-chip ${activeZiweiShortcutMode === '自定义' ? 'is-active' : ''}`}
                            onClick={() => applyZiweiShortcutMode('自定义')}
                          >
                            自定义
                          </button>
                          <button
                            type="button"
                            className="quick-chip"
                            onClick={openQuestionInspirationModal}
                          >
                            问题灵感
                          </button>
                        </>
                      ) : null}
                    </div>

                    {inputState.analysisMode === 'single' && activeZiweiShortcutMode === '自定义' ? (
                      <label className="field-card">
                        <div className="field-header">
                          <span>自定义问题</span>
                        </div>
                        <textarea
                          rows={6}
                          value={promptState.ziweiQuickQuestion}
                          placeholder="例如：请重点分析我这段时间该主动还是先稳住。"
                          onChange={(event) =>
                            updatePromptState({
                              ziweiQuickQuestion: event.target.value,
                            })
                          }
                        />
                      </label>
                    ) : null}
                  </>
                ) : null}
              </div>
            </section>

            <section className="panel panel-output">
              <div className="panel-head">
                <div>
                  <h2>提示词正文</h2>
                  <p>系统要求和问题正文已合并，复制这一整段提示词即可。</p>
                </div>
                <div className="action-row compact-actions">
                  <button className="copy-button secondary-button" type="button" onClick={handleCopy}>
                    {copyState}
                  </button>
                  {showShareButton ? (
                    <button className="copy-button" type="button" onClick={handleShare}>
                      {shareState}
                    </button>
                  ) : null}
                </div>
              </div>
              {activePromptText ? (
                <pre className="result-pre">{activePromptText}</pre>
              ) : (
                <PromptPreSkeleton />
              )}
            </section>
          </div>
        </div>
      </div>

      {isBaziFortuneModalOpen && baziResult && inputState.analysisMode === 'single' ? (
        <Suspense fallback={<BaziFortuneLoadingModal />}>
          <LazyBaziFortuneModal
            result={baziResult}
            selection={baziFortuneSelection}
            onClose={() => setIsBaziFortuneModalOpen(false)}
            onApply={(next) =>
              updatePromptState({
                baziFortuneScope: next.scope,
                baziFortuneCycleIndex:
                  next.scope === 'natal' ? '' : String(next.cycleIndex ?? ''),
                baziFortuneYear: next.scope === 'natal' ? '' : String(next.year ?? ''),
                baziFortuneMonth:
                  next.scope === 'month' || next.scope === 'day'
                    ? String(next.month ?? '')
                    : '',
                baziFortuneDay: next.scope === 'day' ? String(next.day ?? '') : '',
              })
            }
          />
        </Suspense>
      ) : null}

      {isZiweiScopeModalOpen ? (
        <ZiweiScopeModal
          selectedScope={promptState.ziweiScope}
          onClose={() => setIsZiweiScopeModalOpen(false)}
          onApply={(scope) =>
            updatePromptState({
              ziweiScope: scope,
            })
          }
        />
      ) : null}

      {isQuestionInspirationModalOpen && inputState.analysisMode === 'single' ? (
        <div className="modal-backdrop" onClick={() => setIsQuestionInspirationModalOpen(false)}>
          <div className="modal-card question-inspiration-modal" onClick={(event) => event.stopPropagation()}>
            <div className="birth-place-modal-head">
              <h2>问题灵感</h2>
            </div>

            <div className="question-inspiration-toolbar">
              <div className="question-inspiration-filters">
                {inspirationCategories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    className={`question-filter-chip ${
                      activeInspirationCategory === category ? 'is-active' : ''
                    }`}
                    onClick={() => setActiveInspirationCategory(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>

              <div className="question-inspiration-search">
                <input
                  type="text"
                  className="form-input"
                  placeholder="搜索常见问题"
                  value={inspirationSearch}
                  onChange={(event) => setInspirationSearch(event.target.value)}
                />
              </div>
            </div>

            <div className="question-inspiration-list">
              {filteredQuestionInspirations.map((item) => (
                <button
                  key={`${item.category}-${item.question}`}
                  type="button"
                  className="question-inspiration-item"
                  onClick={() => applyInspiredQuestion(item.question)}
                >
                  <span className="question-inspiration-tag">{item.category}</span>
                  <span>{item.question}</span>
                </button>
              ))}
              {filteredQuestionInspirations.length === 0 ? (
                <div className="question-inspiration-empty">没有找到匹配的问题，请换个关键词或分类。</div>
              ) : null}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="modal-btn modal-btn-secondary"
                onClick={() => setIsQuestionInspirationModalOpen(false)}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
