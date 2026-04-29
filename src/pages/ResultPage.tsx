import { Suspense, lazy, memo, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  calculateFullBaziChart,
  calculateFullZiweiChart,
  buildCombinedZiweiCompatibilityPrompt,
  buildCombinedZiweiPrompt,
  buildPersonFromInput,
  buildZiweiChartInput,
} from '@/lib/full-chart-engine';
import {
  getDefaultHoroscopeContext,
} from '@/lib/iztro/runtime-helpers';
import {
  buildDecadalTimelineOptions,
  findCurrentDecadalOption,
  formatDecadalAgeRange,
  type DecadalTimelineOption,
} from '@/lib/iztro/decadal';
import {
  buildResultSearch,
  buildInputSearch,
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
import { QuestionInspirationModal } from '@/components/QuestionInspirationModal';
import { uniqueNonEmptyStrings } from '@/lib/array-utils';
import {
  buildThreePillarsProfile,
  buildUnknownTimeBaziPrompt,
  isUnknownTimeIndex,
  type ThreePillarsProfile,
} from '@/lib/birth-time-reverse';
import type { AnalysisPayloadV1, PalaceFact } from '@/types/analysis';
import type { BaziChartResult } from '@/utils/bazi/baziTypes';
import type { ScopeType } from '@/types/analysis';
import type { BaziFortuneSelectionValue } from '@/utils/bazi/fortuneSelection';
import type { ChartInput } from '@/types/chart';
import { formatBaziForPrompt } from '@/utils/bazi/baziAnalysisFormatter';

type ZiweiRuntimeState = Awaited<ReturnType<typeof calculateFullZiweiChart>> | null;
type ZiweiPayloadByScopeState = Record<ScopeType, AnalysisPayloadV1> | null;
type PromptEngineModule = typeof import('@/lib/prompt-engine');
type BaziFortuneSelectionModule = typeof import('@/utils/bazi/fortuneSelection');
type PromptShortcutMode = string;
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

const baziCompatibilityShortcutActions = [
  {
    label: '合婚' as const,
    promptId: 'ai-compat-marriage',
    question: '请重点分析我们两人的婚恋匹配度、长期磨合点和相处建议。',
  },
  {
    label: '合伙' as const,
    promptId: 'ai-compat-career',
    question: '请重点分析我们两人的合作模式、分工建议和利益风险。',
  },
  {
    label: '友情' as const,
    promptId: 'ai-compat-friendship',
    question: '请重点分析我们两人的相处默契、冲突点和关系建议。',
  },
  {
    label: '子女' as const,
    promptId: 'ai-compat-children',
    question: '请重点分析我们两人的子女缘分深浅、子女性格倾向和亲子相处重点。',
  },
  {
    label: '父母' as const,
    promptId: 'ai-compat-parents',
    question: '请重点分析我们双方父母的健康状况、需关注的风险方向和赡养建议。',
  },
  {
    label: '兄弟' as const,
    promptId: 'ai-compat-siblings',
    question: '请重点分析我们两人之间兄弟朋友关系的亲疏、助力与牵制、相处建议。',
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

const ziweiCompatibilityShortcutActions = [
  {
    label: '感情' as const,
    topic: 'relationship',
    question: '请重点分析双方关系匹配度、吸引点、冲突点和相处建议。',
  },
  {
    label: '合作' as const,
    topic: 'career-wealth',
    question: '请重点分析双方合作默契、优势互补和潜在风险。',
  },
  {
    label: '相处' as const,
    topic: 'chat',
    question: '请从双方盘面看互动模式、沟通盲点和长期建议。',
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
const PROMPT_DRAFT_STORAGE_PREFIX = 'result-prompt-draft';

function readPromptDraft(storageKey: string) {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    return window.localStorage.getItem(storageKey) ?? '';
  } catch {
    return '';
  }
}

function writePromptDraft(storageKey: string, value: string) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (value.trim()) {
      window.localStorage.setItem(storageKey, value);
      return;
    }

    window.localStorage.removeItem(storageKey);
  } catch {
    // 忽略本地存储异常，避免影响结果页主流程。
  }
}

function getBaziShortcutActions(analysisMode: 'single' | 'compatibility') {
  return analysisMode === 'compatibility'
    ? baziCompatibilityShortcutActions
    : baziSingleShortcutActions;
}

function getZiweiShortcutActions(analysisMode: 'single' | 'compatibility') {
  return analysisMode === 'compatibility'
    ? ziweiCompatibilityShortcutActions
    : ziweiSingleShortcutActions;
}

function resolveCompatType(promptId: string): 'marriage' | 'children' | 'parents' | 'siblings' | undefined {
  if (promptId === 'ai-compat-marriage') return 'marriage';
  if (promptId === 'ai-compat-children') return 'children';
  if (promptId === 'ai-compat-parents') return 'parents';
  if (promptId === 'ai-compat-siblings') return 'siblings';
  return undefined;
}

function findBaziShortcutByMode(
  mode: string,
  analysisMode: 'single' | 'compatibility',
) {
  return getBaziShortcutActions(analysisMode).find((item) => item.label === mode) ?? null;
}

function findZiweiShortcutByMode(
  mode: string,
  analysisMode: 'single' | 'compatibility',
) {
  return getZiweiShortcutActions(analysisMode).find((item) => item.label === mode) ?? null;
}

function resolveBaziShortcutMode(
  promptState: QueryPromptState,
  analysisMode: 'single' | 'compatibility',
) {
  if (findBaziShortcutByMode(promptState.baziShortcutMode, analysisMode)) {
    return promptState.baziShortcutMode;
  }

  if (analysisMode === 'compatibility') {
    return (
      baziCompatibilityShortcutActions.find((item) => item.promptId === promptState.baziPresetId)?.label ??
      '自定义'
    );
  }

  const matched = getBaziShortcutActions(analysisMode).find(
    (item) =>
      item.promptId === promptState.baziPresetId &&
      item.question === promptState.baziQuickQuestion,
  );
  return matched?.label ?? '自定义';
}

function resolveZiweiShortcutMode(
  promptState: QueryPromptState,
  analysisMode: 'single' | 'compatibility',
) {
  if (findZiweiShortcutByMode(promptState.ziweiShortcutMode, analysisMode)) {
    return promptState.ziweiShortcutMode;
  }

  if (analysisMode === 'compatibility') {
    return (
      ziweiCompatibilityShortcutActions.find((item) => item.topic === promptState.ziweiTopic)?.label ??
      '自定义'
    );
  }

  const matched = getZiweiShortcutActions(analysisMode).find(
    (item) =>
      item.topic === promptState.ziweiTopic &&
      item.question === promptState.ziweiQuickQuestion,
  );
  return matched?.label ?? '自定义';
}

function buildCombinedPromptText(system: string, user: string) {
  return [system, '', user].join('\n');
}

function buildCompatibilityPromptWithUnknownTime(params: {
  firstName: string;
  firstText: string;
  secondName: string;
  secondText: string;
  question: string;
}) {
  return [
    '你是资深八字命理师，当前合盘信息里至少有一方出生时辰未知，请只做保守分析。',
    '【要求】',
    '- 只基于提供的双方信息作答。',
    '- 其中带“时辰未知”的一方只能按三柱理解，不得自行补足时柱。',
    '- 先说能确认的关系主线，再说因时辰未知而待确认的部分。',
    '- 最后补充最值得继续核验的时辰线索。',
    '',
    `【当前时间】\n${new Date().toLocaleString('zh-CN')}`,
    `【第一人排盘信息】\n${params.firstText}`,
    '',
    `【第二人排盘信息】\n${params.secondText}`,
    '',
    `【问题】\n${params.question.trim() || '请先从整体关系匹配度和相处建议开始分析。'}`,
    '【任务】\n请结合双方已知信息，先做保守的关系分析，并明确哪些部分需要等时辰确认后再细化。',
    '【输出要求】\n先给关系结论，再分成“可确认部分”“待确认部分”“建议继续核验的线索”三段；用简体中文。',
  ].join('\n');
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

function formatUsefulGodPrioritySummary(result: BaziChartResult) {
  const primary = result.analysis.usefulGod.primaryFavorableWuxing || result.analysis.usefulGod.favorableWuxing?.[0] || '暂无';
  const secondary = joinText(result.analysis.usefulGod.secondaryFavorableWuxing || result.analysis.usefulGod.favorableWuxing?.slice(1) || [], '暂无');
  return `主用:${primary} / 辅助:${secondary}`;
}

function formatAvoidGodPrioritySummary(result: BaziChartResult) {
  const primary = result.analysis.usefulGod.primaryUnfavorableWuxing || result.analysis.usefulGod.unfavorableWuxing?.[0] || '暂无';
  const secondary = joinText(result.analysis.usefulGod.secondaryUnfavorableWuxing || result.analysis.usefulGod.unfavorableWuxing?.slice(1) || [], '暂无');
  return `主忌:${primary} / 次忌:${secondary}`;
}

function formatZiweiPromptScopeSummary(
  scope: ZiweiScopeMode,
  dateStr: string,
  resolvedLabel?: string,
) {
  const label = resolvedLabel || ziweiScopeLabelMap[scope] || '本命';
  if (!dateStr || scope === 'origin') {
    return label;
  }

  return `${label} · ${dateStr}`;
}

function joinStarNames(stars: PalaceFact['major_stars'], fallback: string) {
  return stars.length > 0 ? stars.map((star) => star.name).join(' ') : fallback;
}

function splitGanZhi(value: string) {
  return [value.charAt(0), value.charAt(1)];
}

function formatMonthDayLabel(dateStr: string) {
  const [, month, day] = dateStr.split('-');
  return `${month}/${day}`;
}

type ZiweiYearOption = {
  year: number;
  age: number;
  dateStr: string;
  label: string;
  ganZhi: string;
};

type ZiweiMonthOption = {
  month: number;
  dateStr: string;
  label: string;
  ganZhi: string;
};

type ZiweiDayOption = {
  day: number;
  dateStr: string;
  label: string;
  ganZhi: string;
};

function parseZiweiDateParts(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) {
    return null;
  }

  return { year, month, day };
}

function buildZiweiMonthAnchorDate(dateStr: string) {
  const parts = parseZiweiDateParts(dateStr);
  if (!parts) {
    return '';
  }

  return `${parts.year}-${String(parts.month).padStart(2, '0')}-15`;
}

function findZiweiDecadalIndexByDate(
  decadalOptions: DecadalTimelineOption[],
  dateStr: string,
  fallbackIndex: number,
) {
  if (!dateStr || decadalOptions.length === 0) {
    return fallbackIndex;
  }

  for (let index = decadalOptions.length - 1; index >= 0; index -= 1) {
    if (dateStr >= decadalOptions[index].dateStr) {
      return index;
    }
  }

  return 0;
}

function findZiweiYearOptionDate(yearOptions: ZiweiYearOption[], dateStr: string) {
  const parts = parseZiweiDateParts(dateStr);
  if (!parts) {
    return yearOptions[0]?.dateStr ?? '';
  }

  return yearOptions.find((item) => item.year === parts.year)?.dateStr ?? yearOptions[0]?.dateStr ?? '';
}

function findZiweiMonthOptionDate(monthOptions: ZiweiMonthOption[], dateStr: string) {
  const parts = parseZiweiDateParts(dateStr);
  if (!parts) {
    return monthOptions[0]?.dateStr ?? '';
  }

  return (
    monthOptions.find((item) => {
      const optionParts = parseZiweiDateParts(item.dateStr);
      return optionParts?.year === parts.year && optionParts?.month === parts.month;
    })?.dateStr ?? monthOptions[0]?.dateStr ?? ''
  );
}

function findZiweiDayOptionDate(dayOptions: ZiweiDayOption[], dateStr: string) {
  const parts = parseZiweiDateParts(dateStr);
  if (!parts) {
    return dayOptions[0]?.dateStr ?? '';
  }

  return dayOptions.find((item) => item.day === parts.day)?.dateStr ?? dayOptions[0]?.dateStr ?? '';
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

function ZiweiBoardSkeleton(props: {
  title: string;
  name: string;
}) {
  return (
    <section className="result-showcase-card ziwei-showcase-card ziwei-board-skeleton">
      <div className="result-showcase-head">
        <div>
          <p className="result-section-kicker">{props.title}</p>
          <h2>{props.name}</h2>
        </div>
        <div className="result-chip-row" aria-hidden="true">
          <span className="skeleton-block ziwei-board-skeleton-chip" />
          <span className="skeleton-block ziwei-board-skeleton-chip" />
          <span className="skeleton-block ziwei-board-skeleton-chip ziwei-board-skeleton-chip-short" />
        </div>
      </div>

      <div className="result-summary-grid" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="result-stat-card" key={index}>
            <span className="skeleton-block ziwei-board-skeleton-line ziwei-board-skeleton-line-short" />
            <span className="skeleton-block ziwei-board-skeleton-line" />
            <span className="skeleton-block ziwei-board-skeleton-line ziwei-board-skeleton-line-short" />
          </div>
        ))}
      </div>

      <div className="ziwei-layout" aria-hidden="true">
        <div className="ziwei-board-skeleton-panel ziwei-board-skeleton-main" />
        <div className="ziwei-side-panel">
          <div className="ziwei-board-skeleton-panel ziwei-board-skeleton-side" />
          <div className="ziwei-board-skeleton-panel ziwei-board-skeleton-side" />
        </div>
      </div>
    </section>
  );
}

function ZiweiScopeModal(props: {
  chartInput: ChartInput;
  payloadByScope: Record<ScopeType, AnalysisPayloadV1>;
  selectedScope: ZiweiScopeMode;
  selectedDateStr: string;
  onApply: (scope: ZiweiScopeMode, dateStr: string) => void;
  onClose: () => void;
}) {
  const { chartInput, payloadByScope, selectedScope, selectedDateStr, onApply, onClose } = props;
  const defaultContext = useMemo(() => getDefaultHoroscopeContext(), []);
  const normalizedSelectedScope: Exclude<ZiweiScopeMode, 'hourly'> =
    selectedScope === 'hourly' ? 'daily' : selectedScope;
  const originPayload = payloadByScope.origin;
  const birthSolarDate = originPayload.basic_info.solar_date;
  const decadalOptions = useMemo(
    () => buildDecadalTimelineOptions(originPayload.palaces, birthSolarDate),
    [birthSolarDate, originPayload.palaces],
  );
  const currentDecadal = useMemo(
    () => findCurrentDecadalOption(decadalOptions, payloadByScope.yearly.active_scope.nominal_age),
    [decadalOptions, payloadByScope.yearly.active_scope.nominal_age],
  );
  const currentDecadalIndex = useMemo(
    () => Math.max(0, decadalOptions.findIndex((item) => item === currentDecadal)),
    [currentDecadal, decadalOptions],
  );
  const fallbackScopeDateStr =
    selectedDateStr ||
    payloadByScope.daily.active_scope.solar_date ||
    payloadByScope.monthly.active_scope.solar_date ||
    payloadByScope.yearly.active_scope.solar_date ||
    defaultContext.dateStr;
  const initialDecadalIndex = useMemo(
    () => findZiweiDecadalIndexByDate(decadalOptions, fallbackScopeDateStr, currentDecadalIndex),
    [currentDecadalIndex, decadalOptions, fallbackScopeDateStr],
  );
  const [draftScope, setDraftScope] = useState<Exclude<ZiweiScopeMode, 'hourly'>>(
    normalizedSelectedScope,
  );
  const [draftDecadalIndex, setDraftDecadalIndex] = useState(initialDecadalIndex);
  const [draftYearDateStr, setDraftYearDateStr] = useState(fallbackScopeDateStr);
  const [draftMonthDateStr, setDraftMonthDateStr] = useState(
    buildZiweiMonthAnchorDate(fallbackScopeDateStr),
  );
  const [draftDayDateStr, setDraftDayDateStr] = useState(fallbackScopeDateStr);
  const [yearOptions, setYearOptions] = useState<ZiweiYearOption[]>([]);
  const [monthOptions, setMonthOptions] = useState<ZiweiMonthOption[]>([]);
  const [dayOptions, setDayOptions] = useState<ZiweiDayOption[]>([]);
  const [isFortuneOptionsLoading, setIsFortuneOptionsLoading] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    setDraftScope(normalizedSelectedScope);
    setDraftDecadalIndex(initialDecadalIndex);
    setDraftYearDateStr(fallbackScopeDateStr);
    setDraftMonthDateStr(buildZiweiMonthAnchorDate(fallbackScopeDateStr));
    setDraftDayDateStr(fallbackScopeDateStr);
  }, [fallbackScopeDateStr, initialDecadalIndex, normalizedSelectedScope]);

  useEffect(() => {
    workerRef.current = new Worker(new URL('../workers/ziwei-fortune-options.worker.ts', import.meta.url), {
      type: 'module',
    });

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const selectedDecadal = decadalOptions[draftDecadalIndex] ?? decadalOptions[0] ?? null;

  useEffect(() => {
    if (!workerRef.current) {
      return;
    }

    const requestId = `${draftDecadalIndex}-${draftYearDateStr}-${draftMonthDateStr}-${Date.now()}`;
    setIsFortuneOptionsLoading(true);

    workerRef.current.onmessage = (event: MessageEvent<{
      id: string;
      ok: boolean;
      yearOptions?: ZiweiYearOption[];
      monthOptions?: ZiweiMonthOption[];
      dayOptions?: ZiweiDayOption[];
    }>) => {
      if (event.data.id !== requestId) {
        return;
      }

      if (event.data.ok) {
        setYearOptions(event.data.yearOptions ?? []);
        setMonthOptions(event.data.monthOptions ?? []);
        setDayOptions(event.data.dayOptions ?? []);
      } else {
        setYearOptions([]);
        setMonthOptions([]);
        setDayOptions([]);
      }

      setIsFortuneOptionsLoading(false);
    };

    workerRef.current.postMessage({
      id: requestId,
      input: chartInput,
      birthSolarDate,
      hourIndex: defaultContext.hourIndex,
      selectedDecadal: selectedDecadal
        ? {
            startAge: selectedDecadal.startAge,
            endAge: selectedDecadal.endAge,
            dateStr: selectedDecadal.dateStr,
          }
        : null,
      selectedYearDateStr: draftYearDateStr,
      selectedMonthDateStr: draftMonthDateStr,
    });
  }, [
    birthSolarDate,
    chartInput,
    defaultContext.hourIndex,
    draftDecadalIndex,
    draftMonthDateStr,
    draftYearDateStr,
    selectedDecadal,
  ]);

  useEffect(() => {
    if (!yearOptions.length) {
      return;
    }

    const matchedDateStr = findZiweiYearOptionDate(yearOptions, draftDayDateStr || draftYearDateStr);
    if (matchedDateStr && matchedDateStr !== draftYearDateStr) {
      setDraftYearDateStr(matchedDateStr);
    }
  }, [draftDayDateStr, draftYearDateStr, yearOptions]);

  useEffect(() => {
    if (!monthOptions.length) {
      return;
    }

    const matchedDateStr = findZiweiMonthOptionDate(
      monthOptions,
      draftDayDateStr || draftMonthDateStr || draftYearDateStr,
    );
    if (matchedDateStr && matchedDateStr !== draftMonthDateStr) {
      setDraftMonthDateStr(matchedDateStr);
    }
  }, [draftDayDateStr, draftMonthDateStr, draftYearDateStr, monthOptions]);

  useEffect(() => {
    if (!dayOptions.length) {
      return;
    }

    const matchedDateStr = findZiweiDayOptionDate(dayOptions, draftDayDateStr || draftMonthDateStr);
    if (matchedDateStr && matchedDateStr !== draftDayDateStr) {
      setDraftDayDateStr(matchedDateStr);
    }
  }, [dayOptions, draftDayDateStr, draftMonthDateStr]);

  const selectedYearItem = yearOptions.find((item) => item.dateStr === draftYearDateStr) ?? yearOptions[0];
  const selectedMonthItem =
    monthOptions.find((item) => item.dateStr === draftMonthDateStr) ?? monthOptions[0];
  const selectedDayItem = dayOptions.find((item) => item.dateStr === draftDayDateStr) ?? dayOptions[0];
  const quickActions: Array<{ scope: Exclude<ZiweiScopeMode, 'origin' | 'hourly'>; label: string }> = [
    { scope: 'decadal', label: '大限' },
    { scope: 'yearly', label: '流年' },
    { scope: 'monthly', label: '流月' },
    { scope: 'daily', label: '流日' },
  ];
  const quickScopeDateMap: Record<Exclude<ZiweiScopeMode, 'origin' | 'hourly'>, string> = {
    decadal: payloadByScope.decadal.active_scope.solar_date,
    yearly: payloadByScope.yearly.active_scope.solar_date,
    monthly: payloadByScope.monthly.active_scope.solar_date,
    daily: payloadByScope.daily.active_scope.solar_date,
  };
  const draftScopeDateStr = (() => {
    switch (draftScope) {
      case 'origin':
        return '';
      case 'decadal':
        return selectedDecadal?.dateStr ?? '';
      case 'yearly':
        return selectedYearItem?.dateStr ?? draftYearDateStr ?? '';
      case 'monthly':
        return selectedMonthItem?.dateStr ?? draftMonthDateStr ?? draftYearDateStr ?? '';
      case 'daily':
        return selectedDayItem?.dateStr ?? draftDayDateStr ?? draftMonthDateStr ?? draftYearDateStr ?? '';
      default:
        return '';
    }
  })();
  const draftScopeDetailLabel = (() => {
    switch (draftScope) {
      case 'origin':
        return '';
      case 'decadal':
        return selectedDecadal ? `${selectedDecadal.label} ${formatDecadalAgeRange(selectedDecadal)}岁` : '';
      case 'yearly':
        return selectedYearItem ? `${selectedYearItem.year}年 ${selectedYearItem.ganZhi}` : '';
      case 'monthly':
        return selectedMonthItem ? `${selectedMonthItem.label} ${selectedMonthItem.ganZhi}` : '';
      case 'daily':
        return selectedDayItem ? `${selectedDayItem.label} ${selectedDayItem.ganZhi}` : '';
      default:
        return '';
    }
  })();
  const summaryText =
    draftScope === 'origin'
      ? '仅使用本命信息，不附加任何大限流年流月流日。'
      : formatZiweiPromptScopeSummary(draftScope, draftScopeDateStr, draftScopeDetailLabel);
  const isDecadalDetailActive = draftScope === 'decadal';
  const isYearOverallActive = draftScope === 'decadal';
  const isYearDetailActive = draftScope === 'yearly';
  const isMonthOverallActive = draftScope === 'yearly';
  const isMonthDetailActive = draftScope === 'monthly';
  const isDayOverallActive = draftScope === 'monthly';
  const isDayDetailActive = draftScope === 'daily';
  const showYearRow = draftScope !== 'origin';
  const showMonthRow = ['yearly', 'monthly', 'daily'].includes(draftScope);
  const showDayRow = ['monthly', 'daily'].includes(draftScope);

  function handleJumpToCurrent(scope: Exclude<ZiweiScopeMode, 'origin' | 'hourly'>) {
    const nextDateStr = quickScopeDateMap[scope] || defaultContext.dateStr;
    setDraftScope(scope);
    setDraftDecadalIndex(findZiweiDecadalIndexByDate(decadalOptions, nextDateStr, currentDecadalIndex));
    setDraftYearDateStr(nextDateStr);
    setDraftMonthDateStr(buildZiweiMonthAnchorDate(nextDateStr));
    setDraftDayDateStr(nextDateStr);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card bazi-fortune-modal" onClick={(event) => event.stopPropagation()}>
        <div className="panel-head">
          <div>
            <h2>选择年限</h2>
          </div>
        </div>

        <div className="draft-tip">
          <strong>当前将写入：</strong>
          {summaryText}
        </div>

        <div className="fortune-modal-summary-row">
          <span className="fortune-modal-quick-label">当前</span>
          <div className="fortune-modal-quick-actions">
            {quickActions.map((item) => (
              <button
                type="button"
                key={item.scope}
                className={`fortune-modal-quick-btn ${draftScope === item.scope ? 'is-active' : ''}`}
                onClick={() => handleJumpToCurrent(item.scope)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <span className="result-chip result-chip-highlight">
            {ziweiScopeLabelMap[draftScope]}
          </span>
          {draftScopeDetailLabel ? <span className="result-chip">{draftScopeDetailLabel}</span> : null}
        </div>

        <div className="fortune-modal-grid">
          <section className="fortune-modal-section">
            <div className="fortune-modal-section-head">
              <h3>大限</h3>
              <small>先选某一步大限，才会展开下一排流年。</small>
            </div>
            <div className="fortune-modal-list">
              {decadalOptions.map((item, index) => (
                <button
                  type="button"
                  key={`${item.label}-${item.startAge}-${item.endAge}`}
                  className={`fortune-modal-item ${
                    isDecadalDetailActive && draftDecadalIndex === index ? 'is-active is-selected' : ''
                  }`}
                  onClick={() => {
                    setDraftDecadalIndex(index);
                    setDraftScope('decadal');
                  }}
                >
                  <strong>{item.label}</strong>
                  <span>{formatDecadalAgeRange(item)}岁</span>
                  <span>{item.dateStr} 起</span>
                </button>
              ))}
            </div>
          </section>

          {showYearRow ? (
            <section className="fortune-modal-section">
              <div className="fortune-modal-section-head">
                <h3>流年</h3>
                <small>第一项是大限；选具体流年后，才会展开下一排流月。</small>
              </div>
              <div className="fortune-modal-list">
                <button
                  type="button"
                  className={`fortune-modal-item fortune-modal-item-overall ${
                    isYearOverallActive ? 'is-selected is-active' : ''
                  }`}
                  onClick={() => setDraftScope('decadal')}
                >
                  <strong>大限</strong>
                  <span>
                    {selectedDecadal ? `${selectedDecadal.label} ${formatDecadalAgeRange(selectedDecadal)}岁` : ''}
                  </span>
                </button>
                {yearOptions.map((item) => (
                  <button
                    type="button"
                    key={item.dateStr}
                    className={`fortune-modal-item ${
                      isYearDetailActive && draftYearDateStr === item.dateStr
                        ? 'is-active is-selected'
                        : ''
                    }`}
                    onClick={() => {
                      setDraftYearDateStr(item.dateStr);
                      setDraftMonthDateStr(buildZiweiMonthAnchorDate(item.dateStr));
                      setDraftDayDateStr(item.dateStr);
                      setDraftScope('yearly');
                    }}
                  >
                    <strong>{item.year}年</strong>
                    <span>{item.ganZhi}</span>
                    <span>{item.age} 岁</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {showMonthRow ? (
            <section className="fortune-modal-section">
              <div className="fortune-modal-section-head">
                <h3>流月</h3>
                <small>第一项是流年；选具体流月后，才会展开下一排流日。</small>
              </div>
              <div className="fortune-modal-list">
                <button
                  type="button"
                  className={`fortune-modal-item fortune-modal-item-overall ${
                    isMonthOverallActive ? 'is-selected is-active' : ''
                  }`}
                  onClick={() => setDraftScope('yearly')}
                >
                  <strong>流年</strong>
                  <span>{selectedYearItem ? `${selectedYearItem.year}年` : ''}</span>
                </button>
                {monthOptions.map((item) => (
                  <button
                    type="button"
                    key={item.dateStr}
                    className={`fortune-modal-item ${
                      isMonthDetailActive && draftMonthDateStr === item.dateStr
                        ? 'is-active is-selected'
                        : ''
                    }`}
                    onClick={() => {
                      setDraftMonthDateStr(item.dateStr);
                      setDraftDayDateStr(item.dateStr);
                      setDraftScope('monthly');
                    }}
                  >
                    <strong>{item.label}</strong>
                    <span>{item.ganZhi}</span>
                    <span>{formatMonthDayLabel(item.dateStr)}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {showDayRow ? (
            <section className="fortune-modal-section">
              <div className="fortune-modal-section-head">
                <h3>流日</h3>
                <small>第一项是流月；选具体流日时，只写这个流日本身。</small>
              </div>
              <div className="fortune-modal-list">
                <button
                  type="button"
                  className={`fortune-modal-item fortune-modal-item-overall ${
                    isDayOverallActive ? 'is-selected is-active' : ''
                  }`}
                  onClick={() => setDraftScope('monthly')}
                >
                  <strong>流月</strong>
                  <span>{selectedMonthItem ? selectedMonthItem.label : ''}</span>
                </button>
                {dayOptions.map((item) => (
                  <button
                    type="button"
                    key={item.dateStr}
                    className={`fortune-modal-item ${
                      isDayDetailActive && draftDayDateStr === item.dateStr
                        ? 'is-active is-selected'
                        : ''
                    }`}
                    onClick={() => {
                      setDraftDayDateStr(item.dateStr);
                      setDraftScope('daily');
                    }}
                  >
                    <strong>{item.label}</strong>
                    <span>{item.ganZhi}</span>
                    <span>{item.day} 日</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        {isFortuneOptionsLoading && yearOptions.length === 0 && monthOptions.length === 0 && dayOptions.length === 0 ? (
          <BaziFortuneLoadingCard />
        ) : null}

        <div className="modal-actions modal-actions-split">
          <div className="modal-actions-left">
            <button
              type="button"
              className="modal-btn modal-btn-secondary"
              onClick={() => setDraftScope('origin')}
            >
              仅用本命
            </button>
          </div>
          <div className="modal-actions-right">
            <button type="button" className="modal-btn modal-btn-secondary" onClick={onClose}>
              取消
            </button>
            <button
              type="button"
              className="modal-btn modal-btn-primary"
              onClick={() => {
                onApply(draftScope, draftScopeDateStr);
                onClose();
              }}
            >
              确定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ZiweiFortuneSelector(props: {
  chartInput: ChartInput;
  payloadByScope: Record<ScopeType, AnalysisPayloadV1>;
  selectedScope: ScopeType;
  selectedDateStr: string;
  onSelectScopeDate: (scope: ScopeType, dateStr: string) => void;
}) {
  const { chartInput, payloadByScope, selectedScope, selectedDateStr, onSelectScopeDate } = props;
  const defaultContext = useMemo(() => getDefaultHoroscopeContext(), []);
  const originPayload = payloadByScope.origin;
  const birthSolarDate = originPayload.basic_info.solar_date;
  const decadalOptions = useMemo(
    () => buildDecadalTimelineOptions(originPayload.palaces, birthSolarDate),
    [birthSolarDate, originPayload.palaces],
  );
  const initialDecadal = useMemo(
    () => findCurrentDecadalOption(decadalOptions, payloadByScope.yearly.active_scope.nominal_age),
    [decadalOptions, payloadByScope],
  );
  const [selectedDecadalIndex, setSelectedDecadalIndex] = useState(
    Math.max(0, decadalOptions.findIndex((item) => item === initialDecadal)),
  );
  const selectedDecadal = decadalOptions[selectedDecadalIndex] ?? decadalOptions[0];
  const [selectedYearDateStr, setSelectedYearDateStr] = useState(selectedDateStr);
  const [selectedMonthDateStr, setSelectedMonthDateStr] = useState(selectedDateStr);
  const [yearOptions, setYearOptions] = useState<Array<{
    year: number;
    age: number;
    dateStr: string;
    label: string;
    ganZhi: string;
  }>>([]);
  const [monthOptions, setMonthOptions] = useState<Array<{
    month: number;
    dateStr: string;
    label: string;
    ganZhi: string;
  }>>([]);
  const [dayOptions, setDayOptions] = useState<Array<{
    day: number;
    dateStr: string;
    label: string;
    ganZhi: string;
  }>>([]);
  const [isFortuneOptionsLoading, setIsFortuneOptionsLoading] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('../workers/ziwei-fortune-options.worker.ts', import.meta.url), {
      type: 'module',
    });

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!workerRef.current) {
      return;
    }

    const requestId = `${selectedDecadalIndex}-${selectedYearDateStr}-${selectedMonthDateStr}-${Date.now()}`;
    setIsFortuneOptionsLoading(true);

    workerRef.current.onmessage = (event: MessageEvent<{
      id: string;
      ok: boolean;
      yearOptions?: Array<{
        year: number;
        age: number;
        dateStr: string;
        label: string;
        ganZhi: string;
      }>;
      monthOptions?: Array<{
        month: number;
        dateStr: string;
        label: string;
        ganZhi: string;
      }>;
      dayOptions?: Array<{
        day: number;
        dateStr: string;
        label: string;
        ganZhi: string;
      }>;
      effectiveYearDateStr?: string;
      effectiveMonthDateStr?: string;
    }>) => {
      if (event.data.id !== requestId) {
        return;
      }

      if (event.data.ok) {
        setYearOptions(event.data.yearOptions ?? []);
        setMonthOptions(event.data.monthOptions ?? []);
        setDayOptions(event.data.dayOptions ?? []);
        if (event.data.effectiveYearDateStr) {
          setSelectedYearDateStr(event.data.effectiveYearDateStr);
        }
        if (event.data.effectiveMonthDateStr) {
          setSelectedMonthDateStr(event.data.effectiveMonthDateStr);
        }
      } else {
        setYearOptions([]);
        setMonthOptions([]);
        setDayOptions([]);
      }

      setIsFortuneOptionsLoading(false);
    };

    workerRef.current.postMessage({
      id: requestId,
      input: chartInput,
      birthSolarDate,
      hourIndex: defaultContext.hourIndex,
      selectedDecadal: selectedDecadal
        ? {
            startAge: selectedDecadal.startAge,
            endAge: selectedDecadal.endAge,
            dateStr: selectedDecadal.dateStr,
          }
        : null,
      selectedYearDateStr,
      selectedMonthDateStr,
    });
  }, [
    birthSolarDate,
    chartInput,
    defaultContext.hourIndex,
    selectedDecadal,
    selectedDecadalIndex,
    selectedMonthDateStr,
    selectedYearDateStr,
  ]);

  useEffect(() => {
    if (selectedDecadal && !yearOptions.some((item) => item.dateStr === selectedYearDateStr)) {
      setSelectedYearDateStr(yearOptions[0]?.dateStr ?? selectedDecadal.dateStr);
    }
  }, [selectedDecadal, selectedYearDateStr, yearOptions]);

  const selectedYearItem =
    yearOptions.find((item) => item.dateStr === selectedYearDateStr) ?? yearOptions[0];

  useEffect(() => {
    if (selectedYearItem && !monthOptions.some((item) => item.dateStr === selectedMonthDateStr)) {
      setSelectedMonthDateStr(monthOptions[0]?.dateStr ?? selectedYearItem.dateStr);
    }
  }, [monthOptions, selectedMonthDateStr, selectedYearItem]);

  if (isFortuneOptionsLoading && yearOptions.length === 0 && monthOptions.length === 0 && dayOptions.length === 0) {
    return <BaziFortuneLoadingCard />;
  }

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

const BaziChartBoard = memo(function BaziChartBoard(props: {
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
          <span>核心用神</span>
          <strong>{result.analysis.usefulGod.primaryUseful || result.analysis.usefulGod.useful || '待定'}</strong>
          <small>{formatUsefulGodPrioritySummary(result)}</small>
        </div>
        <div className="result-stat-card">
          <span>核心忌神</span>
          <strong>{result.analysis.usefulGod.primaryAvoid || result.analysis.usefulGod.avoid || '待定'}</strong>
          <small>{formatAvoidGodPrioritySummary(result)}</small>
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
});

const ThreePillarsBoard = memo(function ThreePillarsBoard(props: {
  title: string;
  name: string;
  profile: ThreePillarsProfile;
}) {
  const { title, name, profile } = props;
  const pillarRows = [
    {
      label: '天干',
      values: [
        profile.pillars.year.gan,
        profile.pillars.month.gan,
        profile.pillars.day.gan,
        '待反推',
      ],
      className: 'is-stem',
    },
    {
      label: '地支',
      values: [
        profile.pillars.year.zhi,
        profile.pillars.month.zhi,
        profile.pillars.day.zhi,
        '待反推',
      ],
      className: 'is-branch',
    },
    {
      label: '天干十神',
      values: [
        profile.pillars.year.tenGod,
        profile.pillars.month.tenGod,
        profile.pillars.day.tenGod,
        '待确认',
      ],
      className: 'is-multiline',
    },
    {
      label: '地支十神',
      values: [
        profile.pillars.year.branchTenGod,
        profile.pillars.month.branchTenGod,
        profile.pillars.day.branchTenGod,
        '待确认',
      ],
      className: 'is-multiline',
    },
    {
      label: '五行',
      values: [
        `${profile.pillars.year.ganWuxing}/${profile.pillars.year.zhiWuxing}`,
        `${profile.pillars.month.ganWuxing}/${profile.pillars.month.zhiWuxing}`,
        `${profile.pillars.day.ganWuxing}/${profile.pillars.day.zhiWuxing}`,
        '待确认',
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
          <span className="result-chip">{profile.genderLabel}</span>
          <span className="result-chip">{profile.solarDateLabel}</span>
          <span className="result-chip">未知时辰</span>
        </div>
      </div>

      <div className="result-summary-grid result-summary-grid-bazi">
        <div className="result-stat-card result-stat-card-accent">
          <span>日主</span>
          <strong>{profile.dayMaster.gan}</strong>
          <small>
            {profile.dayMaster.element} · {profile.dayMaster.yinYang}
          </small>
        </div>
        <div className="result-stat-card">
          <span>年柱</span>
          <strong>{profile.pillars.year.ganZhi}</strong>
          <small>{profile.pillars.year.tenGod}</small>
        </div>
        <div className="result-stat-card">
          <span>月柱</span>
          <strong>{profile.pillars.month.ganZhi}</strong>
          <small>{profile.pillars.month.tenGod}</small>
        </div>
        <div className="result-stat-card">
          <span>日柱</span>
          <strong>{profile.pillars.day.ganZhi}</strong>
          <small>{profile.zodiac} · {profile.constellation}</small>
        </div>
      </div>

      <div className="bazi-core-layout">
        <div className="bazi-pillars-card">
          <div className="bazi-pillars-header">
            <h3>三柱盘</h3>
            <p>当前时辰未知，时柱先保留为待反推。</p>
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
              <h3>三柱说明</h3>
              <p>这里只统计三柱六字，不把未知时柱强行补全。</p>
            </div>
            <div className="wuxing-bars">
              {Object.entries(profile.wuxingCount).map(([key, value]) => (
                <div className="wuxing-bar-row" key={key}>
                  <span className="wuxing-bar-label">{key}</span>
                  <div className="wuxing-bar-track">
                    <div className="wuxing-bar-fill" style={{ width: `${(value / 6) * 100}%` }} />
                  </div>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <div className="fortune-focus-card">
              <span>当前状态</span>
              <strong>按三柱先看主线</strong>
              <small>涉及时柱、子女、晚年、细节应期等内容，需要反推时辰后再细化。</small>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});

const ZiweiBoard = memo(function ZiweiBoard(props: {
  title: string;
  name: string;
  payload: AnalysisPayloadV1;
  chartInput: ChartInput;
  runtime: NonNullable<ZiweiRuntimeState>;
}) {
  const { title, name, payload, chartInput, runtime } = props;
  const defaultContext = useMemo(() => getDefaultHoroscopeContext(), []);
  const [selectedScope, setSelectedScope] = useState<ScopeType>(payload.active_scope.scope);
  const [selectedDateStr, setSelectedDateStr] = useState(payload.active_scope.solar_date);
  const [selectedHourIndex] = useState(defaultContext.hourIndex);
  const [displayPayload, setDisplayPayload] = useState(payload);
  const [isDisplayPayloadLoading, setIsDisplayPayloadLoading] = useState(false);
  const [selectedPalaceIndex, setSelectedPalaceIndex] = useState(
    payload.active_scope.palace_index ?? payload.palaces[0]?.index ?? 0,
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
    setDisplayPayload(payload);
  }, [payload.active_scope.scope, payload.active_scope.solar_date]);

  useEffect(() => {
    if (
      selectedScope === payload.active_scope.scope &&
      selectedDateStr === payload.active_scope.solar_date
    ) {
      setDisplayPayload(payload);
      setIsDisplayPayloadLoading(false);
      return;
    }

    const worker = new Worker(new URL('../workers/ziwei-display.worker.ts', import.meta.url), {
      type: 'module',
    });
    const requestId = `${selectedScope}-${selectedDateStr}-${Date.now()}`;

    setIsDisplayPayloadLoading(true);

    worker.onmessage = (event: MessageEvent<{
      id: string;
      ok: boolean;
      payload?: AnalysisPayloadV1;
    }>) => {
      if (event.data.id !== requestId) {
        return;
      }

      if (event.data.ok && event.data.payload) {
        setDisplayPayload(event.data.payload);
      }
      setIsDisplayPayloadLoading(false);
      worker.terminate();
    };

    worker.postMessage({
      id: requestId,
      input: chartInput,
      dateStr: selectedDateStr,
      hourIndex: selectedHourIndex,
      scope: selectedScope,
    });

    return () => {
      worker.terminate();
    };
  }, [
    chartInput,
    payload,
    selectedDateStr,
    selectedHourIndex,
    selectedScope,
  ]);

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
        <div className="ziwei-board-stack">
          <ZiweiTraditionalBoard
            payload={displayPayload}
            boardTitle="传统盘"
            name={name}
            selectedPalaceIndex={selectedPalaceIndex}
            onSelectPalace={setSelectedPalaceIndex}
          />
          {isDisplayPayloadLoading ? (
            <div className="ziwei-board-loading-mask" aria-hidden="true">
              <span className="skeleton-block ziwei-board-loading-pill" />
              <span className="skeleton-block ziwei-board-loading-line" />
              <span className="skeleton-block ziwei-board-loading-line ziwei-board-loading-line-short" />
            </div>
          ) : null}
        </div>

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
            chartInput={chartInput}
            payloadByScope={runtime.payloadByScope}
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
});

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
  const inputSearch = useMemo(() => buildInputSearch(searchParams), [searchParams]);
  const inputState = useMemo(() => parseInputState(new URLSearchParams(inputSearch)), [inputSearch]);
  const promptState = useMemo(() => parsePromptState(searchParams), [searchParams]);
  const baziDraftStorageKey = useMemo(
    () => `${PROMPT_DRAFT_STORAGE_PREFIX}:bazi:${inputSearch}`,
    [inputSearch],
  );
  const ziweiDraftStorageKey = useMemo(
    () => `${PROMPT_DRAFT_STORAGE_PREFIX}:ziwei:${inputSearch}`,
    [inputSearch],
  );
  const shouldLoadBaziPromptModules =
    promptState.tab === 'prompt' && promptState.promptSource === 'bazi';
  const [baziResult, setBaziResult] = useState<BaziChartResult | null>(null);
  const [partnerBaziResult, setPartnerBaziResult] = useState<BaziChartResult | null>(null);
  const [baziError, setBaziError] = useState('');
  const [ziweiRuntime, setZiweiRuntime] = useState<ZiweiRuntimeState>(null);
  const [partnerZiweiRuntime, setPartnerZiweiRuntime] = useState<ZiweiRuntimeState>(null);
  const [ziweiPayloadByScope, setZiweiPayloadByScope] = useState<ZiweiPayloadByScopeState>(null);
  const [partnerZiweiPayloadByScope, setPartnerZiweiPayloadByScope] =
    useState<ZiweiPayloadByScopeState>(null);
  const [promptZiweiPayload, setPromptZiweiPayload] = useState<AnalysisPayloadV1 | null>(null);
  const [promptPartnerZiweiPayload, setPromptPartnerZiweiPayload] = useState<AnalysisPayloadV1 | null>(null);
  const [ziweiError, setZiweiError] = useState('');
  const [shareState, setShareState] = useState('分享');
  const [copyState, setCopyState] = useState('复制');
  const [isBaziFortuneModalOpen, setIsBaziFortuneModalOpen] = useState(false);
  const [isZiweiScopeModalOpen, setIsZiweiScopeModalOpen] = useState(false);
  const [activeBaziShortcutMode, setActiveBaziShortcutMode] = useState<PromptShortcutMode>(() =>
    resolveBaziShortcutMode(promptState, inputState.analysisMode),
  );
  const [activeZiweiShortcutMode, setActiveZiweiShortcutMode] = useState<PromptShortcutMode>(() =>
    resolveZiweiShortcutMode(promptState, inputState.analysisMode),
  );
  const [baziQuestionDraft, setBaziQuestionDraft] = useState(() => {
    const mode = resolveBaziShortcutMode(promptState, inputState.analysisMode);
    return (
      readPromptDraft(baziDraftStorageKey) ||
      promptState.baziQuickQuestion ||
      findBaziShortcutByMode(mode, inputState.analysisMode)?.question ||
      ''
    );
  });
  const [ziweiQuestionDraft, setZiweiQuestionDraft] = useState(() => {
    const mode = resolveZiweiShortcutMode(promptState, inputState.analysisMode);
    return (
      readPromptDraft(ziweiDraftStorageKey) ||
      promptState.ziweiQuickQuestion ||
      findZiweiShortcutByMode(mode, inputState.analysisMode)?.question ||
      ''
    );
  });
  const [isQuestionInspirationModalOpen, setIsQuestionInspirationModalOpen] = useState(false);
  const [activeInspirationCategory, setActiveInspirationCategory] = useState<InspirationCategory>('全部');
  const [inspirationSearch, setInspirationSearch] = useState('');
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? 0 : window.innerWidth,
  );
  const [promptEngine, setPromptEngine] = useState<PromptEngineModule | null>(null);
  const [baziFortuneSelectionModule, setBaziFortuneSelectionModule] =
    useState<BaziFortuneSelectionModule | null>(null);
  const [mountedTabs, setMountedTabs] = useState<Record<ResultTabKey, boolean>>(() => ({
    bazi: promptState.tab === 'bazi',
    ziwei: promptState.tab === 'ziwei',
    prompt: promptState.tab === 'prompt',
  }));
  const primaryHasUnknownTime = !inputState.useTrueSolarTime && isUnknownTimeIndex(inputState.timeIndex);
  const partnerHasUnknownTime =
    inputState.analysisMode === 'compatibility' &&
    !inputState.partnerUseTrueSolarTime &&
    isUnknownTimeIndex(inputState.partnerTimeIndex);
  const hasUnknownBirthTime = primaryHasUnknownTime || partnerHasUnknownTime;
  const shouldLoadZiweiPromptPayload =
    mountedTabs.prompt && promptState.promptSource === 'ziwei' && !mountedTabs.ziwei;
  const primaryThreePillarsState = useMemo(() => {
    if (!primaryHasUnknownTime) {
      return {
        profile: null as ThreePillarsProfile | null,
        error: '',
      };
    }

    try {
      return {
        profile: buildThreePillarsProfile({
          gender: inputState.gender,
          dateType: inputState.dateType,
          year: inputState.year,
          month: inputState.month,
          day: inputState.day,
          isLeapMonth: inputState.isLeapMonth,
        }),
        error: '',
      };
    } catch (error) {
      return {
        profile: null,
        error: error instanceof Error ? error.message : '三柱排盘失败。',
      };
    }
  }, [
    inputState.dateType,
    inputState.day,
    inputState.gender,
    inputState.isLeapMonth,
    inputState.month,
    inputState.year,
    primaryHasUnknownTime,
  ]);
  const partnerThreePillarsState = useMemo(() => {
    if (!partnerHasUnknownTime) {
      return {
        profile: null as ThreePillarsProfile | null,
        error: '',
      };
    }

    try {
      return {
        profile: buildThreePillarsProfile({
          gender: inputState.partnerGender,
          dateType: inputState.partnerDateType,
          year: inputState.partnerYear,
          month: inputState.partnerMonth,
          day: inputState.partnerDay,
          isLeapMonth: inputState.partnerIsLeapMonth,
        }),
        error: '',
      };
    } catch (error) {
      return {
        profile: null,
        error: error instanceof Error ? error.message : '第二人三柱排盘失败。',
      };
    }
  }, [
    inputState.partnerDateType,
    inputState.partnerDay,
    inputState.partnerGender,
    inputState.partnerIsLeapMonth,
    inputState.partnerMonth,
    inputState.partnerYear,
    partnerHasUnknownTime,
  ]);
  const primaryZiweiInput = useMemo(() => {
    if (primaryHasUnknownTime) {
      return null;
    }

    try {
      return buildZiweiChartInput(inputState);
    } catch {
      return null;
    }
  }, [inputState, primaryHasUnknownTime]);
  const partnerZiweiInput = useMemo(() => {
    if (inputState.analysisMode !== 'compatibility') {
      return null;
    }

    if (partnerHasUnknownTime) {
      return null;
    }

    try {
      return buildZiweiChartInput({
        name: inputState.partnerName,
        gender: inputState.partnerGender,
        dateType: inputState.partnerDateType,
        year: inputState.partnerYear,
        month: inputState.partnerMonth,
        day: inputState.partnerDay,
        timeIndex: inputState.partnerTimeIndex,
        isLeapMonth: inputState.partnerIsLeapMonth,
        useTrueSolarTime: inputState.partnerUseTrueSolarTime,
        birthHour: inputState.partnerBirthHour,
        birthMinute: inputState.partnerBirthMinute,
        birthLongitude: inputState.partnerBirthLongitude,
      });
    } catch {
      return null;
    }
  }, [inputState, partnerHasUnknownTime]);

  useEffect(() => {
    if (primaryHasUnknownTime) {
      setBaziResult(null);
      setBaziError(primaryThreePillarsState.error);
      return;
    }

    try {
      const person = buildPersonFromInput(inputState);
      setBaziResult(calculateFullBaziChart(person));
      setBaziError('');
    } catch (error) {
      setBaziResult(null);
      setBaziError(error instanceof Error ? error.message : '八字排盘失败。');
    }
  }, [inputState, primaryHasUnknownTime, primaryThreePillarsState.error]);

  useEffect(() => {
    if (inputState.analysisMode !== 'compatibility') {
      setPartnerBaziResult(null);
      return;
    }

    if (partnerHasUnknownTime) {
      setPartnerBaziResult(null);
      setBaziError(partnerThreePillarsState.error);
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
  }, [inputState, partnerHasUnknownTime, partnerThreePillarsState.error]);

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
    setMountedTabs((current) => {
      if (current[promptState.tab]) {
        return current;
      }

      return {
        ...current,
        [promptState.tab]: true,
      };
    });
  }, [promptState.tab]);

  useEffect(() => {
    if (!hasUnknownBirthTime || promptState.promptSource !== 'ziwei') {
      return;
    }

    updatePromptState({
      promptSource: 'bazi',
    });
  }, [hasUnknownBirthTime, promptState.promptSource]);

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
    const nextMode = resolveBaziShortcutMode(promptState, inputState.analysisMode);
    setActiveBaziShortcutMode(nextMode);
    if (nextMode === '自定义') {
      setBaziQuestionDraft(readPromptDraft(baziDraftStorageKey));
      return;
    }

    setBaziQuestionDraft(findBaziShortcutByMode(nextMode, inputState.analysisMode)?.question ?? '');
  }, [
    baziDraftStorageKey,
    inputState.analysisMode,
    promptState.baziPresetId,
    promptState.baziShortcutMode,
    promptState.baziQuickQuestion,
  ]);

  useEffect(() => {
    const nextMode = resolveZiweiShortcutMode(promptState, inputState.analysisMode);
    setActiveZiweiShortcutMode(nextMode);
    if (nextMode === '自定义') {
      setZiweiQuestionDraft(readPromptDraft(ziweiDraftStorageKey));
      return;
    }

    setZiweiQuestionDraft(findZiweiShortcutByMode(nextMode, inputState.analysisMode)?.question ?? '');
  }, [
    inputState.analysisMode,
    promptState.ziweiQuickQuestion,
    promptState.ziweiShortcutMode,
    promptState.ziweiTopic,
    ziweiDraftStorageKey,
  ]);

  useEffect(() => {
    if (activeBaziShortcutMode !== '自定义') {
      return;
    }

    writePromptDraft(baziDraftStorageKey, baziQuestionDraft);
  }, [activeBaziShortcutMode, baziDraftStorageKey, baziQuestionDraft]);

  useEffect(() => {
    if (activeZiweiShortcutMode !== '自定义') {
      return;
    }

    writePromptDraft(ziweiDraftStorageKey, ziweiQuestionDraft);
  }, [activeZiweiShortcutMode, ziweiDraftStorageKey, ziweiQuestionDraft]);

  useEffect(() => {
    if (!shouldLoadZiweiPromptPayload || !primaryZiweiInput) {
      return;
    }

    const worker = new Worker(new URL('../workers/ziwei-payload.worker.ts', import.meta.url), {
      type: 'module',
    });
    const requestId = `${Date.now()}-primary`;

    setZiweiPayloadByScope(null);

    worker.onmessage = (event: MessageEvent<{
      id: string;
      ok: boolean;
      payloadByScope?: Record<ScopeType, AnalysisPayloadV1>;
      error?: string;
    }>) => {
      if (event.data.id !== requestId) {
        return;
      }

      if (event.data.ok && event.data.payloadByScope) {
        setZiweiPayloadByScope(event.data.payloadByScope);
        setZiweiError('');
      } else {
        setZiweiPayloadByScope(null);
        setZiweiError(event.data.error || '紫微排盘失败。');
      }

      worker.terminate();
    };

    worker.postMessage({
      id: requestId,
      input: primaryZiweiInput,
    });

    return () => {
      worker.terminate();
    };
  }, [primaryZiweiInput, shouldLoadZiweiPromptPayload]);

  useEffect(() => {
    if (!shouldLoadZiweiPromptPayload || !partnerZiweiInput) {
      return;
    }

    const worker = new Worker(new URL('../workers/ziwei-payload.worker.ts', import.meta.url), {
      type: 'module',
    });
    const requestId = `${Date.now()}-partner`;

    setPartnerZiweiPayloadByScope(null);

    worker.onmessage = (event: MessageEvent<{
      id: string;
      ok: boolean;
      payloadByScope?: Record<ScopeType, AnalysisPayloadV1>;
      error?: string;
    }>) => {
      if (event.data.id !== requestId) {
        return;
      }

      if (event.data.ok && event.data.payloadByScope) {
        setPartnerZiweiPayloadByScope(event.data.payloadByScope);
        setZiweiError('');
      } else {
        setPartnerZiweiPayloadByScope(null);
        setZiweiError(event.data.error || '第二人紫微排盘失败。');
      }

      worker.terminate();
    };

    worker.postMessage({
      id: requestId,
      input: partnerZiweiInput,
    });

    return () => {
      worker.terminate();
    };
  }, [partnerZiweiInput, shouldLoadZiweiPromptPayload]);

  useEffect(() => {
    if (!mountedTabs.ziwei || !primaryZiweiInput) {
      return;
    }

    let cancelled = false;

    async function run() {
      const chartInput = primaryZiweiInput;
      if (!chartInput) {
        return;
      }

      try {
        const runtime = await calculateFullZiweiChart(chartInput);
        if (!cancelled) {
          setZiweiRuntime(runtime);
          setZiweiPayloadByScope(runtime.payloadByScope);
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
  }, [mountedTabs.ziwei, primaryZiweiInput]);

  useEffect(() => {
    if (!mountedTabs.ziwei || !partnerZiweiInput) {
      setPartnerZiweiRuntime(null);
      return;
    }

    let cancelled = false;

    async function run() {
      const chartInput = partnerZiweiInput;
      if (!chartInput) {
        return;
      }

      try {
        const runtime = await calculateFullZiweiChart(chartInput);
        if (!cancelled) {
          setPartnerZiweiRuntime(runtime);
          setPartnerZiweiPayloadByScope(runtime.payloadByScope);
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
  }, [mountedTabs.ziwei, partnerZiweiInput]);

  const activeZiweiPayloadByScope = ziweiRuntime?.payloadByScope ?? ziweiPayloadByScope;
  const activePartnerZiweiPayloadByScope =
    partnerZiweiRuntime?.payloadByScope ?? partnerZiweiPayloadByScope;

  const ziweiPromptScopeType = promptState.ziweiScope as ScopeType;
  const shouldUseCustomZiweiPromptPayload =
    promptState.tab === 'prompt' &&
    promptState.promptSource === 'ziwei' &&
    Boolean(promptState.ziweiScopeDate);

  useEffect(() => {
    if (!shouldUseCustomZiweiPromptPayload || !primaryZiweiInput || !promptState.ziweiScopeDate) {
      setPromptZiweiPayload(null);
      return;
    }

    const worker = new Worker(new URL('../workers/ziwei-display.worker.ts', import.meta.url), {
      type: 'module',
    });
    const requestId = `prompt-primary-${ziweiPromptScopeType}-${promptState.ziweiScopeDate}-${Date.now()}`;
    const { hourIndex } = getDefaultHoroscopeContext();

    worker.onmessage = (event: MessageEvent<{
      id: string;
      ok: boolean;
      payload?: AnalysisPayloadV1;
    }>) => {
      if (event.data.id !== requestId) {
        return;
      }

      if (event.data.ok && event.data.payload) {
        setPromptZiweiPayload(event.data.payload);
      } else {
        setPromptZiweiPayload(null);
      }

      worker.terminate();
    };

    worker.postMessage({
      id: requestId,
      input: primaryZiweiInput,
      dateStr: promptState.ziweiScopeDate,
      hourIndex,
      scope: ziweiPromptScopeType,
    });

    return () => {
      worker.terminate();
    };
  }, [primaryZiweiInput, promptState.promptSource, promptState.tab, promptState.ziweiScopeDate, shouldUseCustomZiweiPromptPayload, ziweiPromptScopeType]);

  useEffect(() => {
    if (
      !shouldUseCustomZiweiPromptPayload ||
      inputState.analysisMode !== 'compatibility' ||
      !partnerZiweiInput ||
      !promptState.ziweiScopeDate
    ) {
      setPromptPartnerZiweiPayload(null);
      return;
    }

    const worker = new Worker(new URL('../workers/ziwei-display.worker.ts', import.meta.url), {
      type: 'module',
    });
    const requestId = `prompt-partner-${ziweiPromptScopeType}-${promptState.ziweiScopeDate}-${Date.now()}`;
    const { hourIndex } = getDefaultHoroscopeContext();

    worker.onmessage = (event: MessageEvent<{
      id: string;
      ok: boolean;
      payload?: AnalysisPayloadV1;
    }>) => {
      if (event.data.id !== requestId) {
        return;
      }

      if (event.data.ok && event.data.payload) {
        setPromptPartnerZiweiPayload(event.data.payload);
      } else {
        setPromptPartnerZiweiPayload(null);
      }

      worker.terminate();
    };

    worker.postMessage({
      id: requestId,
      input: partnerZiweiInput,
      dateStr: promptState.ziweiScopeDate,
      hourIndex,
      scope: ziweiPromptScopeType,
    });

    return () => {
      worker.terminate();
    };
  }, [inputState.analysisMode, partnerZiweiInput, promptState.promptSource, promptState.tab, promptState.ziweiScopeDate, shouldUseCustomZiweiPromptPayload, ziweiPromptScopeType]);

  const defaultZiweiPayload = useMemo(() => {
    if (!activeZiweiPayloadByScope) return null;
    return activeZiweiPayloadByScope[promptState.ziweiScope as ScopeType];
  }, [activeZiweiPayloadByScope, promptState.ziweiScope]);

  const defaultPartnerZiweiPayload = useMemo(() => {
    if (!activePartnerZiweiPayloadByScope) return null;
    return activePartnerZiweiPayloadByScope[promptState.ziweiScope as ScopeType];
  }, [activePartnerZiweiPayloadByScope, promptState.ziweiScope]);

  const currentZiweiPayload = promptZiweiPayload ?? defaultZiweiPayload;
  const partnerZiweiPayload = promptPartnerZiweiPayload ?? defaultPartnerZiweiPayload;

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

  const effectiveBaziQuickQuestion =
    activeBaziShortcutMode === '自定义'
      ? baziQuestionDraft
      : findBaziShortcutByMode(activeBaziShortcutMode, inputState.analysisMode)?.question || '';
  const effectiveZiweiQuickQuestion =
    activeZiweiShortcutMode === '自定义'
      ? ziweiQuestionDraft
      : findZiweiShortcutByMode(activeZiweiShortcutMode, inputState.analysisMode)?.question || '';
  const deferredBaziQuickQuestion = useDeferredValue(effectiveBaziQuickQuestion);
  const deferredZiweiQuickQuestion = useDeferredValue(effectiveZiweiQuickQuestion);

  const finalBaziQuestion = useMemo(() => {
    const baseQuestion = effectiveBaziQuickQuestion.trim() || '请先做整体解读。';
    if (baziFortuneContext) {
      return `请结合${baziFortuneContext.displayLabel}重点回答：${baseQuestion}`;
    }

    return baseQuestion;
  }, [baziFortuneContext, effectiveBaziQuickQuestion]);
  const deferredFinalBaziQuestion = useMemo(() => {
    const baseQuestion = deferredBaziQuickQuestion.trim() || '请先做整体解读。';
    if (baziFortuneContext) {
      return `请结合${baziFortuneContext.displayLabel}重点回答：${baseQuestion}`;
    }

    return baseQuestion;
  }, [baziFortuneContext, deferredBaziQuickQuestion]);

  const latestBaziPromptText = useMemo(() => {
    if (promptState.tab !== 'prompt') return '';
    if (inputState.analysisMode === 'compatibility') {
      if (primaryHasUnknownTime || partnerHasUnknownTime) {
        const firstText = primaryHasUnknownTime
          ? primaryThreePillarsState.profile?.promptText || ''
          : baziResult
            ? formatBaziForPrompt(baziResult, null, 'compatibility')
            : '';
        const secondText = partnerHasUnknownTime
          ? partnerThreePillarsState.profile?.promptText || ''
          : partnerBaziResult
            ? formatBaziForPrompt(partnerBaziResult, null, 'compatibility')
            : '';

        if (!firstText || !secondText) return '';

        return buildCompatibilityPromptWithUnknownTime({
          firstName: inputState.name || '第一人',
          firstText,
          secondName: inputState.partnerName || '第二人',
          secondText,
          question: effectiveBaziQuickQuestion.trim() || '请先从婚恋匹配角度做整体解读。',
        });
      }

      if (promptState.tab !== 'prompt' || !promptEngine) return '';
      if (!baziResult || !partnerBaziResult) return '';
      const compatibilityPrompt = promptEngine.getCompatibilityPrompt(
        effectiveBaziQuickQuestion.trim() || '请先从婚恋匹配角度做整体解读。',
        baziResult,
        partnerBaziResult,
        resolveCompatType(promptState.baziPresetId),
      );
      return buildCombinedPromptText(compatibilityPrompt.system, compatibilityPrompt.user);
    }
    if (primaryHasUnknownTime) {
      if (!primaryThreePillarsState.profile) return '';
      return buildUnknownTimeBaziPrompt(
        primaryThreePillarsState.profile,
        effectiveBaziQuickQuestion.trim() || '请先做整体解读。',
      );
    }
    if (promptState.tab !== 'prompt' || !promptEngine) return '';
    if (!baziResult) return '';
    if (!baziFortuneSelectionModule) return '';
    if (!selectedBaziPreset) return '';
    const { system, user } = promptEngine.buildPromptFromConfig(
      finalBaziQuestion,
      selectedBaziPreset,
      baziResult,
      baziFortuneContext,
    );
    return buildCombinedPromptText(system, user);
  }, [baziFortuneContext, baziFortuneSelectionModule, baziResult, effectiveBaziQuickQuestion, finalBaziQuestion, inputState.analysisMode, inputState.name, inputState.partnerName, partnerBaziResult, partnerHasUnknownTime, partnerThreePillarsState.profile, primaryHasUnknownTime, primaryThreePillarsState.profile, promptEngine, promptState.tab, selectedBaziPreset]);
  const previewBaziPromptText = useMemo(() => {
    if (promptState.tab !== 'prompt') return '';
    if (inputState.analysisMode === 'compatibility') {
      if (primaryHasUnknownTime || partnerHasUnknownTime) {
        const firstText = primaryHasUnknownTime
          ? primaryThreePillarsState.profile?.promptText || ''
          : baziResult
            ? formatBaziForPrompt(baziResult, null, 'compatibility')
            : '';
        const secondText = partnerHasUnknownTime
          ? partnerThreePillarsState.profile?.promptText || ''
          : partnerBaziResult
            ? formatBaziForPrompt(partnerBaziResult, null, 'compatibility')
            : '';

        if (!firstText || !secondText) return '';

        return buildCompatibilityPromptWithUnknownTime({
          firstName: inputState.name || '第一人',
          firstText,
          secondName: inputState.partnerName || '第二人',
          secondText,
          question: deferredBaziQuickQuestion.trim() || '请先从婚恋匹配角度做整体解读。',
        });
      }

      if (promptState.tab !== 'prompt' || !promptEngine) return '';
      if (!baziResult || !partnerBaziResult) return '';
      const compatibilityPrompt = promptEngine.getCompatibilityPrompt(
        deferredBaziQuickQuestion.trim() || '请先从婚恋匹配角度做整体解读。',
        baziResult,
        partnerBaziResult,
        resolveCompatType(promptState.baziPresetId),
      );
      return buildCombinedPromptText(compatibilityPrompt.system, compatibilityPrompt.user);
    }
    if (primaryHasUnknownTime) {
      if (!primaryThreePillarsState.profile) return '';
      return buildUnknownTimeBaziPrompt(
        primaryThreePillarsState.profile,
        deferredBaziQuickQuestion.trim() || '请先做整体解读。',
      );
    }
    if (promptState.tab !== 'prompt' || !promptEngine) return '';
    if (!baziResult) return '';
    if (!baziFortuneSelectionModule) return '';
    if (!selectedBaziPreset) return '';
    const { system, user } = promptEngine.buildPromptFromConfig(
      deferredFinalBaziQuestion,
      selectedBaziPreset,
      baziResult,
      baziFortuneContext,
    );
    return buildCombinedPromptText(system, user);
  }, [baziFortuneContext, baziFortuneSelectionModule, baziResult, deferredBaziQuickQuestion, deferredFinalBaziQuestion, inputState.analysisMode, inputState.name, inputState.partnerName, partnerBaziResult, partnerHasUnknownTime, partnerThreePillarsState.profile, primaryHasUnknownTime, primaryThreePillarsState.profile, promptEngine, promptState.tab, selectedBaziPreset]);

  const latestZiweiPromptText = useMemo(() => {
    if (promptState.tab !== 'prompt') return '';
    if (inputState.analysisMode === 'compatibility') {
      if (!currentZiweiPayload || !partnerZiweiPayload) return '';
      return buildCombinedZiweiCompatibilityPrompt({
        primaryPayload: currentZiweiPayload,
        partnerPayload: partnerZiweiPayload,
        topic: promptState.ziweiTopic,
        question:
          effectiveZiweiQuickQuestion || '请先分析双方关系匹配度、互动模式和相处建议。',
      });
    }
    if (!currentZiweiPayload) return '';
    return buildCombinedZiweiPrompt(
      currentZiweiPayload,
      promptState.ziweiTopic,
      effectiveZiweiQuickQuestion || '请先做整体解读。',
    );
  }, [currentZiweiPayload, effectiveZiweiQuickQuestion, inputState.analysisMode, partnerZiweiPayload, promptState.tab, promptState.ziweiTopic]);
  const previewZiweiPromptText = useMemo(() => {
    if (promptState.tab !== 'prompt') return '';
    if (inputState.analysisMode === 'compatibility') {
      if (!currentZiweiPayload || !partnerZiweiPayload) return '';
      return buildCombinedZiweiCompatibilityPrompt({
        primaryPayload: currentZiweiPayload,
        partnerPayload: partnerZiweiPayload,
        topic: promptState.ziweiTopic,
        question:
          deferredZiweiQuickQuestion || '请先分析双方关系匹配度、互动模式和相处建议。',
      });
    }
    if (!currentZiweiPayload) return '';
    return buildCombinedZiweiPrompt(
      currentZiweiPayload,
      promptState.ziweiTopic,
      deferredZiweiQuickQuestion || '请先做整体解读。',
    );
  }, [currentZiweiPayload, deferredZiweiQuickQuestion, inputState.analysisMode, partnerZiweiPayload, promptState.tab, promptState.ziweiTopic]);

  const latestActivePromptText =
    promptState.promptSource === 'bazi' ? latestBaziPromptText : latestZiweiPromptText;
  const previewActivePromptText =
    promptState.promptSource === 'bazi' ? previewBaziPromptText : previewZiweiPromptText;
  const isBaziFortuneSummaryLoading =
    shouldLoadBaziPromptModules && !baziFortuneSelectionModule;
  const baziFortuneSummaryText = baziFortuneContext?.displayText ?? '仅使用本命信息';
  const ziweiScopeSummaryText =
    promptState.ziweiScope === 'origin'
      ? '仅使用本命信息'
      : formatZiweiPromptScopeSummary(
          promptState.ziweiScope,
          promptState.ziweiScopeDate,
          promptState.ziweiScopeDate ? currentZiweiPayload?.active_scope.label : undefined,
        );
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
  const filteredQuestionInspirationSections = useMemo(
    () => [
      {
        id: 'common',
        items: filteredQuestionInspirations.map((item) => ({
          id: `${item.category}-${item.question}`,
          question: item.question,
          tag: item.category,
        })),
      },
    ],
    [filteredQuestionInspirations],
  );

  function updatePromptState(next: Partial<QueryPromptState>) {
    const merged = {
      ...promptState,
      ...next,
    };
    setSearchParams(buildResultSearch(inputState, merged), { replace: true });
  }

  function switchTab(tab: ResultTabKey) {
    updatePromptState({ tab });
  }

  function applyBaziShortcutMode(mode: PromptShortcutMode) {
    setActiveBaziShortcutMode(mode);
    if (mode === '自定义') {
      setBaziQuestionDraft('');
      updatePromptState(buildBaziCustomPromptPatch());
      return;
    }

    const matched = findBaziShortcutByMode(mode, inputState.analysisMode);
    if (!matched) {
      return;
    }

    setBaziQuestionDraft(matched.question);
    updatePromptState({
      baziShortcutMode: mode,
      baziPresetId: matched.promptId,
    });
  }

  function applyZiweiShortcutMode(mode: PromptShortcutMode) {
    setActiveZiweiShortcutMode(mode);
    if (mode === '自定义') {
      setZiweiQuestionDraft('');
      updatePromptState(buildZiweiCustomPromptPatch());
      return;
    }

    const matched = findZiweiShortcutByMode(mode, inputState.analysisMode);
    if (!matched) {
      return;
    }

    setZiweiQuestionDraft(matched.question);
    updatePromptState({
      ziweiShortcutMode: mode,
      ziweiTopic: matched.topic,
    });
  }

  function applyInspiredQuestion(question: string) {
    if (promptState.promptSource === 'bazi') {
      setActiveBaziShortcutMode('自定义');
      setBaziQuestionDraft(question);
      updatePromptState({
        baziShortcutMode: '自定义',
        baziPresetId: 'ai-mingge-zonglun',
      });
    } else {
      setActiveZiweiShortcutMode('自定义');
      setZiweiQuestionDraft(question);
      updatePromptState({
        ziweiShortcutMode: '自定义',
        ziweiTopic: 'chat',
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
    if (!latestActivePromptText) {
      setShareState('暂无内容');
      return;
    }

    try {
      const ok = await shareText(latestActivePromptText);
      setShareState(ok ? '已调起系统分享' : '当前设备不支持系统分享');
    } catch {
      setShareState('分享失败');
    }
  }

  async function handleCopy() {
    if (!latestActivePromptText) {
      setCopyState('暂无内容');
      return;
    }

    try {
      await navigator.clipboard.writeText(latestActivePromptText);
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
          提示词
        </button>
      </div>

      <div className="result-tab-stage">
        <div
          className={`result-tab-pane ${promptState.tab === 'bazi' ? 'is-active' : 'is-inactive'}`}
          aria-hidden={promptState.tab !== 'bazi'}
        >
          {mountedTabs.bazi ? (
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
                    ) : primaryThreePillarsState.profile ? (
                      <ThreePillarsBoard
                        title="第一人三柱"
                        name={inputState.name || '第一人'}
                        profile={primaryThreePillarsState.profile}
                      />
                    ) : null}
                    {partnerBaziResult ? (
                      <BaziChartBoard
                        title="第二人八字"
                        name={inputState.partnerName || '第二人'}
                        result={partnerBaziResult}
                      />
                    ) : partnerThreePillarsState.profile ? (
                      <ThreePillarsBoard
                        title="第二人三柱"
                        name={inputState.partnerName || '第二人'}
                        profile={partnerThreePillarsState.profile}
                      />
                    ) : null}
                  </div>
                ) : baziResult ? (
                  <BaziChartBoard
                    title="八字总览"
                    name={inputState.name || '当前命盘'}
                    result={baziResult}
                  />
                ) : primaryThreePillarsState.profile ? (
                  <ThreePillarsBoard
                    title="三柱总览"
                    name={inputState.name || '当前命盘'}
                    profile={primaryThreePillarsState.profile}
                  />
                ) : null}
              </section>
            </div>
          ) : null}
        </div>

        <div
          className={`result-tab-pane ${promptState.tab === 'ziwei' ? 'is-active' : 'is-inactive'}`}
          aria-hidden={promptState.tab !== 'ziwei'}
        >
          {mountedTabs.ziwei ? (
            <div className="single-panel-shell">
              <section className="panel result-panel result-panel-ziwei">
                {ziweiError ? <p className="error-text">{ziweiError}</p> : null}
                {hasUnknownBirthTime ? (
                  <div className="prompt-send-tip">
                    当前存在未知时辰。紫微排盘必须先确定出生时辰，请先使用“反推时辰”确认后再看紫微结果。
                  </div>
                ) : null}
                {inputState.analysisMode === 'compatibility' && currentZiweiPayload && partnerZiweiPayload ? (
                  <div className="result-dual-layout">
                    {ziweiRuntime && primaryZiweiInput ? (
                      <ZiweiBoard
                        title="第一人紫微"
                        name={inputState.name || '第一人'}
                        payload={currentZiweiPayload}
                        chartInput={primaryZiweiInput}
                        runtime={ziweiRuntime}
                      />
                    ) : (
                      <ZiweiBoardSkeleton
                        title="第一人紫微"
                        name={inputState.name || '第一人'}
                      />
                    )}
                    {partnerZiweiRuntime && partnerZiweiInput ? (
                      <ZiweiBoard
                        title="第二人紫微"
                        name={inputState.partnerName || '第二人'}
                        payload={partnerZiweiPayload}
                        chartInput={partnerZiweiInput}
                        runtime={partnerZiweiRuntime}
                      />
                    ) : (
                      <ZiweiBoardSkeleton
                        title="第二人紫微"
                        name={inputState.partnerName || '第二人'}
                      />
                    )}
                  </div>
                ) : null}
                {inputState.analysisMode !== 'compatibility' && currentZiweiPayload ? (
                  ziweiRuntime && primaryZiweiInput ? (
                    <ZiweiBoard
                      title="紫微总览"
                      name={inputState.name || '当前命盘'}
                      payload={currentZiweiPayload}
                      chartInput={primaryZiweiInput}
                      runtime={ziweiRuntime}
                    />
                  ) : (
                    <ZiweiBoardSkeleton
                      title="紫微总览"
                      name={inputState.name || '当前命盘'}
                    />
                  )
                ) : null}
              </section>
            </div>
          ) : null}
        </div>

        <div
          className={`result-tab-pane ${promptState.tab === 'prompt' ? 'is-active' : 'is-inactive'}`}
          aria-hidden={promptState.tab !== 'prompt'}
        >
          {mountedTabs.prompt ? (
          <div className="workspace-grid">
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2 className="prompt-settings-title">提示词设置</h2>
                  <p>选择基于八字或紫微，再用快捷按钮生成问题。</p>
                </div>
              </div>

              <div className="field-list">
                <div className="prompt-compact-grid">
                  <label className="field-card">
                    <div className="field-header">
                      <span className="prompt-source-title">提示词来源</span>
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
                      <option value="ziwei" disabled={hasUnknownBirthTime}>
                        {hasUnknownBirthTime ? '基于紫微（未知时辰不可用）' : '基于紫微'}
                      </option>
                    </select>
                  </label>

                  {promptState.promptSource === 'bazi' &&
                  inputState.analysisMode === 'single' &&
                  !primaryHasUnknownTime ? (
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
                        disabled={!primaryZiweiInput || !activeZiweiPayloadByScope}
                      >
                        {!primaryZiweiInput || !activeZiweiPayloadByScope ? (
                          <InlineSkeleton className="inline-skeleton inline-skeleton-medium" />
                        ) : (
                          <span>{ziweiScopeSummaryText}</span>
                        )}
                      </button>
                    </div>
                  ) : null}
                </div>

                {promptState.promptSource === 'bazi' ? (
                  <>
                    <div className="quick-grid">
                      {getBaziShortcutActions(inputState.analysisMode).map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          className={`quick-chip ${
                            activeBaziShortcutMode === item.label
                              ? 'is-active'
                              : ''
                          }`}
                          onClick={() => applyBaziShortcutMode(item.label)}
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
                          value={baziQuestionDraft}
                          placeholder="例如：我近期适合换工作还是稳住？"
                          onChange={(event) => setBaziQuestionDraft(event.target.value)}
                        />
                      </label>
                    ) : null}
                  </>
                ) : null}

                {promptState.promptSource === 'ziwei' ? (
                  <>
                    <div className="quick-grid">
                      {getZiweiShortcutActions(inputState.analysisMode).map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          className={`quick-chip ${
                            activeZiweiShortcutMode === item.label
                              ? 'is-active'
                              : ''
                          }`}
                          onClick={() => applyZiweiShortcutMode(item.label)}
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
                          value={ziweiQuestionDraft}
                          placeholder="例如：请重点分析我这段时间该主动还是先稳住。"
                          onChange={(event) => setZiweiQuestionDraft(event.target.value)}
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
              <div className="prompt-send-tip">
                点击复制后，发送到你常用的在线 AI 软件继续提问。
              </div>
              {hasUnknownBirthTime && promptState.promptSource === 'bazi' ? (
                <div className="prompt-send-tip">
                  当前存在未知时辰，已自动改为三柱保守提示词，不会假定时柱。
                </div>
              ) : null}
              {previewActivePromptText ? (
                <pre className="result-pre">{previewActivePromptText}</pre>
              ) : (
                <PromptPreSkeleton />
              )}
            </section>
          </div>
          ) : null}
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

      {isZiweiScopeModalOpen && primaryZiweiInput && activeZiweiPayloadByScope ? (
        <ZiweiScopeModal
          chartInput={primaryZiweiInput}
          payloadByScope={activeZiweiPayloadByScope}
          selectedScope={promptState.ziweiScope}
          selectedDateStr={promptState.ziweiScopeDate}
          onClose={() => setIsZiweiScopeModalOpen(false)}
          onApply={(scope, dateStr) =>
            updatePromptState({
              ziweiScope: scope,
              ziweiScopeDate: scope === 'origin' ? '' : dateStr,
            })
          }
        />
      ) : null}

      {isQuestionInspirationModalOpen && inputState.analysisMode === 'single' ? (
        <QuestionInspirationModal
          filters={inspirationCategories.map((category) => ({
            label: category,
            value: category,
          }))}
          activeFilter={activeInspirationCategory}
          onFilterChange={(value) => setActiveInspirationCategory(value as InspirationCategory)}
          searchValue={inspirationSearch}
          onSearchChange={setInspirationSearch}
          sections={filteredQuestionInspirationSections}
          emptyText="没有找到匹配的问题，请换个关键词或分类。"
          onSelect={applyInspiredQuestion}
          onClose={() => setIsQuestionInspirationModalOpen(false)}
        />
      ) : null}
    </div>
  );
}
