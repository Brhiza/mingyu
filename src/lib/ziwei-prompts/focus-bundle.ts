import type { AnalysisPayloadV1, PalaceFact } from '../../types/analysis';
import { formatPalaceName } from './labels';
import {
  buildScopeFocusPalaces,
  dedupePalaces,
  getBodyPalace,
  getOppositePalace,
  getPalaceByIndex,
  getPalaceByName,
  getSurroundedPalaces,
} from './palace-helpers';
import type { PromptContext } from './types';

type FocusTaskBundle = {
  focusSummary: string;
  focusPalaces: PalaceFact[];
  avoid: string[];
};

const TOPIC_PALACE_NAMES: Record<string, string[]> = {
  destiny: ['命宫', '身宫', '福德', '官禄', '财帛', '迁移'],
  life: ['命宫', '身宫', '福德', '官禄', '财帛', '迁移'],
  relationship: ['夫妻', '命宫', '福德', '子女', '迁移'],
  'relationship-push': ['夫妻', '命宫', '福德', '子女', '迁移'],
  'relationship-decision': ['夫妻', '命宫', '福德', '子女', '迁移'],
  'reconciliation-decision': ['夫妻', '命宫', '福德', '子女', '迁移'],
  children: ['子女', '夫妻', '命宫', '福德', '田宅'],
  'career-wealth': ['官禄', '财帛', '命宫', '福德', '迁移'],
  'job-change': ['官禄', '迁移', '财帛', '命宫', '福德'],
  'startup-partnership': ['官禄', '财帛', '兄弟', '迁移', '命宫'],
  'investment-partnership': ['财帛', '官禄', '兄弟', '福德', '迁移'],
  recent: ['命宫', '身宫', '官禄', '财帛', '迁移', '福德'],
  family: ['父母', '兄弟', '田宅', '福德', '命宫'],
  'home-move': ['田宅', '迁移', '财帛', '福德', '命宫'],
  'settle-relocate': ['田宅', '迁移', '官禄', '财帛', '福德'],
  social: ['兄弟', '迁移', '福德', '命宫', '官禄'],
  emotion: ['福德', '疾厄', '命宫', '身宫', '田宅'],
  health: ['疾厄', '福德', '命宫', '身宫', '迁移'],
  study: ['命宫', '福德', '官禄', '父母', '迁移'],
  'study-advance': ['命宫', '福德', '官禄', '父母', '迁移'],
  'exam-landing': ['命宫', '福德', '官禄', '父母', '迁移'],
  growth: ['命宫', '身宫', '福德', '官禄', '田宅'],
  talent: ['命宫', '身宫', '官禄', '财帛', '福德'],
  chat: ['命宫', '身宫', '福德', '迁移'],
};

function palacesByName(payload: AnalysisPayloadV1, names: string[]) {
  return names.map((name) => getPalaceByName(payload, name)).filter(Boolean) as PalaceFact[];
}

function buildCommonBoundary() {
  return ['只基于已提供盘面、运限和问题作答；证据不足时直接说明。'];
}

export function buildFocusTaskBundle(
  payload: AnalysisPayloadV1,
  reportContext: PromptContext,
): FocusTaskBundle {
  const activePalace = getPalaceByIndex(payload, payload.active_scope.palace_index);
  const bodyPalace = getBodyPalace(payload);
  const mingPalace = getPalaceByName(payload, '命宫');

  if (reportContext.report_type === 'palace') {
    const selectedPalace = reportContext.palace_name
      ? getPalaceByName(payload, reportContext.palace_name)
      : activePalace;
    const palaceName = formatPalaceName(
      selectedPalace?.name ?? reportContext.palace_name ?? '当前宫位',
    );

    return {
      focusSummary: `围绕${palaceName}及其对宫、三方四正组织证据。`,
      focusPalaces: dedupePalaces([
        selectedPalace,
        getOppositePalace(payload, selectedPalace),
        ...getSurroundedPalaces(payload, selectedPalace),
      ]),
      avoid: buildCommonBoundary(),
    };
  }

  if (reportContext.report_type === 'scope') {
    return {
      focusSummary: `围绕${payload.active_scope.label || '当前运限'}与本命主线的触发关系组织证据。`,
      focusPalaces: dedupePalaces([
        activePalace,
        ...buildScopeFocusPalaces(payload),
        mingPalace,
        bodyPalace,
      ]).slice(0, 6),
      avoid: buildCommonBoundary(),
    };
  }

  const topicPalaces = palacesByName(
    payload,
    TOPIC_PALACE_NAMES[reportContext.selected_topic] ?? TOPIC_PALACE_NAMES.chat,
  );

  return {
    focusSummary:
      reportContext.selected_topic === 'chat'
        ? '按用户问题选择最相关宫位，未明确主题时按通用紫微证据处理。'
        : '按用户选择主题筛选重点宫位，具体判断仍以问题和盘面证据为准。',
    focusPalaces: dedupePalaces([activePalace, ...topicPalaces, mingPalace, bodyPalace]).slice(
      0,
      6,
    ),
    avoid: buildCommonBoundary(),
  };
}
