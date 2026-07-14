import { formatPromptEvidenceBundle } from '../../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../../prompt-evidence/types';
import type { AnalysisPayloadV1, MutagenName, PalaceFact, StarFact } from '../../types/analysis';

const KEY_PALACES = new Set(['命宫', '身宫', '夫妻', '官禄', '财帛', '福德', '迁移']);

export interface ZiweiCompatibilityOptions {
  person1Name?: string;
  person2Name?: string;
}

export interface ZiweiPalaceOverlay {
  key: string;
  sourcePerson: 'person1' | 'person2';
  targetPerson: 'person1' | 'person2';
  sourcePalace: string;
  earthlyBranch: string;
  targetPalace: string;
  sourceMajorStars: string[];
  targetMajorStars: string[];
  sources: string[];
  calculation: string;
  promptText: string;
  limitation: '宫位叠盘只证明双方宫位位于同一地支轴位；不单独证明关系吉凶、适配程度、他人意图、现实事件或长期结果';
}

export interface ZiweiCrossMutagenPlacement {
  key: string;
  sourcePerson: 'person1' | 'person2';
  targetPerson: 'person1' | 'person2';
  star: string;
  mutagen: MutagenName;
  sourcePalace: string;
  targetPalace: string;
  targetEarthlyBranch: string;
  sources: string[];
  calculation: string;
  promptText: string;
  limitation: '跨盘四化只证明一方生年四化星曜与对方同名星曜落宫之间的定位链路；化禄、权、科、忌均不直接等于关系吉凶、事件结果、匹配程度或应期';
}

export interface ZiweiCompatibilityEvidenceResult {
  people: { person1: string; person2: string };
  palaceOverlays: ZiweiPalaceOverlay[];
  crossMutagenPlacements: ZiweiCrossMutagenPlacement[];
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: { notes: string[] };
}

const PALACE_OVERLAY_LIMITATION =
  '宫位叠盘只证明双方宫位位于同一地支轴位；不单独证明关系吉凶、适配程度、他人意图、现实事件或长期结果' as const;

const CROSS_MUTAGEN_LIMITATION =
  '跨盘四化只证明一方生年四化星曜与对方同名星曜落宫之间的定位链路；化禄、权、科、忌均不直接等于关系吉凶、事件结果、匹配程度或应期' as const;

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
  people: ZiweiCompatibilityEvidenceResult['people'],
) {
  const targetByBranch = new Map(target.palaces.map((palace) => [palace.earthly_branch, palace]));
  return keyPalaces(source).flatMap((sourcePalace): ZiweiPalaceOverlay[] => {
    const targetPalace = targetByBranch.get(sourcePalace.earthly_branch);
    if (!targetPalace) return [];
    const sourcePalaceName = palaceDisplayName(sourcePalace);
    const targetPalaceName = palaceDisplayName(targetPalace);
    return [
      {
        key: `宫位叠盘:${sourcePerson}:${sourcePalace.index}:${sourcePalace.earthly_branch}:${targetPerson}:${targetPalace.index}`,
        sourcePerson,
        targetPerson,
        sourcePalace: sourcePalaceName,
        earthlyBranch: sourcePalace.earthly_branch,
        targetPalace: targetPalaceName,
        sourceMajorStars: sourcePalace.major_stars.map((star) => star.name),
        targetMajorStars: targetPalace.major_stars.map((star) => star.name),
        sources: ['双方 analysis_payload_v1 十二宫地支索引', '命语紫微双盘同支宫位映射规则'],
        calculation: `读取${people[sourcePerson]}${sourcePalaceName}的地支${sourcePalace.earthly_branch}，在${people[targetPerson]}十二宫中按相同地支定位到${targetPalaceName}`,
        promptText: `${people[sourcePerson]}${sourcePalaceName}与${people[targetPerson]}${targetPalaceName}同处${sourcePalace.earthly_branch}支轴位；来源宫主星${sourcePalace.major_stars.map((star) => star.name).join('、') || '无主星'}，目标宫主星${targetPalace.major_stars.map((star) => star.name).join('、') || '无主星'}`,
        limitation: PALACE_OVERLAY_LIMITATION,
      },
    ];
  });
}

function calculateCrossMutagens(
  sourcePerson: 'person1' | 'person2',
  targetPerson: 'person1' | 'person2',
  source: AnalysisPayloadV1,
  target: AnalysisPayloadV1,
  people: ZiweiCompatibilityEvidenceResult['people'],
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
      const sourcePalaceName = palaceDisplayName(sourcePalace);
      const targetPalaceName = palaceDisplayName(targetPalace);
      placements.push({
        key: `跨盘四化:${sourcePerson}:${star.name}:化${star.birth_mutagen}:${targetPerson}:${targetPalace.index}`,
        sourcePerson,
        targetPerson,
        star: star.name,
        mutagen: star.birth_mutagen,
        sourcePalace: sourcePalaceName,
        targetPalace: targetPalaceName,
        targetEarthlyBranch: targetPalace.earthly_branch,
        sources: ['来源方 analysis_payload_v1 生年四化星曜标记', '目标方十二宫同名星曜落宫索引'],
        calculation: `读取${people[sourcePerson]}${sourcePalaceName}的${star.name}生年化${star.birth_mutagen}标记，再于${people[targetPerson]}十二宫星曜索引中定位同名${star.name}到${targetPalaceName}（${targetPalace.earthly_branch}）`,
        promptText: `${people[sourcePerson]}${sourcePalaceName}的${star.name}生年化${star.birth_mutagen}，同名${star.name}在${people[targetPerson]}盘定位于${targetPalaceName}（${targetPalace.earthly_branch}）`,
        limitation: CROSS_MUTAGEN_LIMITATION,
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
      detail: `${item.promptText}；边界：${item.limitation}`,
      source: `${item.sources.join('；')}；计算：${item.calculation}`,
      tags: ['紫微合盘', '宫位叠盘', item.sourcePalace, item.targetPalace],
    })),
    ...mutagens.map((item): PromptEvidenceItem => ({
      level:
        item.sourcePalace.includes('命宫') || item.targetPalace.includes('命宫') ? '主证' : '辅证',
      title: `${personLabel(people, item.sourcePerson)}${item.star}生年化${item.mutagen}落入${personLabel(people, item.targetPerson)}${item.targetPalace}`,
      detail: `${item.promptText}；边界：${item.limitation}`,
      source: `${item.sources.join('；')}；计算：${item.calculation}`,
      tags: ['紫微合盘', '生年四化', `化${item.mutagen}`, item.targetPalace],
    })),
    ...overlays
      .filter((item) => !importantOverlays.includes(item))
      .map((item): PromptEvidenceItem => ({
        level: '辅证',
        title: `${personLabel(people, item.sourcePerson)}${item.sourcePalace}对应${personLabel(people, item.targetPerson)}${item.targetPalace}`,
        detail: `${item.promptText}；边界：${item.limitation}`,
        source: `${item.sources.join('；')}；计算：${item.calculation}`,
        tags: ['紫微合盘', '宫位叠盘'],
      })),
    {
      level: '限制',
      title: '紫微双盘证据边界',
      detail:
        '宫位叠盘和生年四化跨盘落点是可复核的盘面关系，不等于现实关系结果；化禄不等于必然有利，化忌不等于必然不利，不输出匹配总分或必然断语。',
      source: '结构化证据解释规则',
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
    ...calculateOverlays('person1', 'person2', payload1, payload2, people),
    ...calculateOverlays('person2', 'person1', payload2, payload1, people),
  ];
  const crossMutagenPlacements = [
    ...calculateCrossMutagens('person1', 'person2', payload1, payload2, people),
    ...calculateCrossMutagens('person2', 'person1', payload2, payload1, people),
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
