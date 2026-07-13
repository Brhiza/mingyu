import { formatPromptEvidenceBundle } from '../../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../../prompt-evidence/types';
import type { AnalysisPayloadV1, MutagenName, PalaceFact, StarFact } from '../../types/analysis';

const KEY_PALACES = new Set(['命宫', '身宫', '夫妻', '官禄', '财帛', '福德', '迁移']);

export interface ZiweiCompatibilityOptions {
  person1Name?: string;
  person2Name?: string;
}

export interface ZiweiPalaceOverlay {
  sourcePerson: 'person1' | 'person2';
  targetPerson: 'person1' | 'person2';
  sourcePalace: string;
  earthlyBranch: string;
  targetPalace: string;
  sourceMajorStars: string[];
  targetMajorStars: string[];
}

export interface ZiweiCrossMutagenPlacement {
  sourcePerson: 'person1' | 'person2';
  targetPerson: 'person1' | 'person2';
  star: string;
  mutagen: MutagenName;
  sourcePalace: string;
  targetPalace: string;
  targetEarthlyBranch: string;
}

export interface ZiweiCompatibilityEvidenceResult {
  people: { person1: string; person2: string };
  palaceOverlays: ZiweiPalaceOverlay[];
  crossMutagenPlacements: ZiweiCrossMutagenPlacement[];
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: { notes: string[] };
}

function allStars(palace: PalaceFact): StarFact[] {
  return [...palace.major_stars, ...palace.minor_stars, ...palace.other_stars];
}

function assertPayload(payload: AnalysisPayloadV1, label: string) {
  if (!payload || !Array.isArray(payload.palaces) || payload.palaces.length !== 12) {
    throw new Error(`${label}必须包含完整十二宫资料。`);
  }
  for (const palace of payload.palaces) {
    if (!palace.name || !palace.earthly_branch) throw new Error(`${label}宫位名称或地支缺失。`);
  }
}

function keyPalaces(payload: AnalysisPayloadV1) {
  return payload.palaces.filter(
    (palace) => KEY_PALACES.has(palace.name) || palace.name === '命宫' || palace.is_body_palace,
  );
}

function palaceDisplayName(palace: PalaceFact) {
  return palace.is_body_palace && palace.name !== '身宫'
    ? `${palace.name}（身宫同宫）`
    : palace.name;
}

function calculateOverlays(
  sourcePerson: 'person1' | 'person2',
  targetPerson: 'person1' | 'person2',
  source: AnalysisPayloadV1,
  target: AnalysisPayloadV1,
) {
  const targetByBranch = new Map(target.palaces.map((palace) => [palace.earthly_branch, palace]));
  return keyPalaces(source).flatMap((sourcePalace): ZiweiPalaceOverlay[] => {
    const targetPalace = targetByBranch.get(sourcePalace.earthly_branch);
    if (!targetPalace) return [];
    return [
      {
        sourcePerson,
        targetPerson,
        sourcePalace: palaceDisplayName(sourcePalace),
        earthlyBranch: sourcePalace.earthly_branch,
        targetPalace: palaceDisplayName(targetPalace),
        sourceMajorStars: sourcePalace.major_stars.map((star) => star.name),
        targetMajorStars: targetPalace.major_stars.map((star) => star.name),
      },
    ];
  });
}

function calculateCrossMutagens(
  sourcePerson: 'person1' | 'person2',
  targetPerson: 'person1' | 'person2',
  source: AnalysisPayloadV1,
  target: AnalysisPayloadV1,
) {
  const targetStars = new Map<string, PalaceFact>();
  target.palaces.forEach((palace) => {
    allStars(palace).forEach((star) => {
      if (!targetStars.has(star.name)) targetStars.set(star.name, palace);
    });
  });
  const placements: ZiweiCrossMutagenPlacement[] = [];
  source.palaces.forEach((sourcePalace) => {
    allStars(sourcePalace).forEach((star) => {
      if (!star.birth_mutagen) return;
      const targetPalace = targetStars.get(star.name);
      if (!targetPalace) return;
      placements.push({
        sourcePerson,
        targetPerson,
        star: star.name,
        mutagen: star.birth_mutagen,
        sourcePalace: palaceDisplayName(sourcePalace),
        targetPalace: palaceDisplayName(targetPalace),
        targetEarthlyBranch: targetPalace.earthly_branch,
      });
    });
  });
  return placements;
}

function personLabel(
  people: ZiweiCompatibilityEvidenceResult['people'],
  person: 'person1' | 'person2',
) {
  return people[person];
}

function createEvidence(
  people: ZiweiCompatibilityEvidenceResult['people'],
  overlays: ZiweiPalaceOverlay[],
  mutagens: ZiweiCrossMutagenPlacement[],
): PromptEvidenceBundle {
  const importantOverlays = overlays.filter(
    (item) =>
      item.sourcePalace.includes('命宫') ||
      item.sourcePalace.includes('身宫') ||
      item.sourcePalace.includes('夫妻'),
  );
  const items: PromptEvidenceItem[] = [
    ...importantOverlays.map((item): PromptEvidenceItem => ({
      level: '主证',
      title: `${personLabel(people, item.sourcePerson)}${item.sourcePalace}落在${personLabel(people, item.targetPerson)}${item.targetPalace}轴位`,
      detail: `双方该宫同处${item.earthlyBranch}支位置；这是十二宫地支对齐关系，用于确认互动落点，不单独表示吉凶或适配程度。`,
      source: '双方十二宫地支位置交叉映射',
      weight: 88,
      tags: ['紫微合盘', '宫位叠盘', item.sourcePalace, item.targetPalace],
    })),
    ...mutagens.map((item): PromptEvidenceItem => ({
      level:
        item.sourcePalace.includes('命宫') || item.targetPalace.includes('命宫') ? '主证' : '辅证',
      title: `${personLabel(people, item.sourcePerson)}${item.star}生年化${item.mutagen}落入${personLabel(people, item.targetPerson)}${item.targetPalace}`,
      detail: `${item.star}在化星来源方位于${item.sourcePalace}，在对方盘位于${item.targetPalace}（${item.targetEarthlyBranch}）；只记录“化星来源—星曜—对方落宫”链路，化禄、权、科、忌均需结合宫位主轴、星曜状态和现实问题解释。`,
      source: '来源方生年四化星曜与对方同名星曜落宫交叉',
      weight: item.mutagen === '忌' || item.mutagen === '禄' ? 78 : 72,
      tags: ['紫微合盘', '生年四化', `化${item.mutagen}`, item.targetPalace],
    })),
    ...overlays
      .filter((item) => !importantOverlays.includes(item))
      .map((item): PromptEvidenceItem => ({
        level: '辅证',
        title: `${personLabel(people, item.sourcePerson)}${item.sourcePalace}对应${personLabel(people, item.targetPerson)}${item.targetPalace}`,
        detail: `双方宫位在${item.earthlyBranch}支重合，需与命身、夫妻、官禄、财帛、福德、迁移等主轴及四化链路共同解释。`,
        source: '双方十二宫地支位置交叉映射',
        weight: 48,
        tags: ['紫微合盘', '宫位叠盘'],
      })),
    {
      level: '限制',
      title: '紫微双盘证据边界',
      detail:
        '宫位叠盘和生年四化跨盘落点是可复核的盘面关系，不等于现实关系结果；化禄不等于必然有利，化忌不等于必然不利，不输出匹配总分或必然断语。',
      source: '结构化证据解释规则',
      weight: -100,
      tags: ['解释边界'],
    },
  ];
  return {
    title: '紫微双盘结构化证据',
    items,
    emptyText: '当前两盘未生成可定位的宫位或四化交叉证据。',
  };
}

export function analyzeZiweiCompatibility(
  payload1: AnalysisPayloadV1,
  payload2: AnalysisPayloadV1,
  options: ZiweiCompatibilityOptions = {},
): ZiweiCompatibilityEvidenceResult {
  assertPayload(payload1, '第一人紫微盘');
  assertPayload(payload2, '第二人紫微盘');
  const people = {
    person1: options.person1Name?.trim() || '第一人',
    person2: options.person2Name?.trim() || '第二人',
  };
  const palaceOverlays = [
    ...calculateOverlays('person1', 'person2', payload1, payload2),
    ...calculateOverlays('person2', 'person1', payload2, payload1),
  ];
  const crossMutagenPlacements = [
    ...calculateCrossMutagens('person1', 'person2', payload1, payload2),
    ...calculateCrossMutagens('person2', 'person1', payload2, payload1),
  ];
  const evidence = createEvidence(people, palaceOverlays, crossMutagenPlacements);
  return {
    people,
    palaceOverlays,
    crossMutagenPlacements,
    evidence,
    promptText: ['【紫微双盘结构化证据】', ...formatPromptEvidenceBundle(evidence)].join('\n'),
    methodology: {
      notes: [
        '宫位叠盘按十二宫地支位置一一映射，重点保留命宫、身宫、夫妻、官禄、财帛、福德与迁移轴。',
        '跨盘四化由一方本命盘已标注的生年四化星曜出发，定位同名星曜在另一方命盘的宫位。',
        '静态本命双盘只描述长期结构，不生成具体年份应期；应期需要双方大限、流年等同层级资料。',
        '化星与宫位关系不压缩为匹配总分，也不把单一化禄或化忌解释为必然结果。',
      ],
    },
  };
}
