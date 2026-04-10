import type { AnalysisPayloadV1, PalaceFact, ScopeType, StarFact } from '@/types/analysis';
import type { AiAnalysisPayload, AiReportContext, ChatTurn } from '@/types/ai';
import { isSynastryAnalysisPayload } from '@/types/synastry';
import { buildSynastryAnalysisMessages } from './synastry-prompts';
import { ZIWEI_ANALYSIS_REQUIREMENT, ZIWEI_ANALYST_ROLE } from './ziwei-prompt-copy';

function stringify(value: unknown) {
  return JSON.stringify(value, null, 2);
}

const markdownReportRules = [
  '输出简体中文 Markdown 正文。',
  '使用 `## 标题` 分段。',
  '正文使用短段落或 `-` 列表。',
].join('\n');

function buildZiweiTaskText(reportContext: AiReportContext) {
  const scopeLabel = reportContext.scope_label;
  const topicLabel = mapTopicLabel(reportContext.selected_topic);

  switch (reportContext.selected_topic) {
    case 'relationship':
      return `请围绕${scopeLabel}盘面，重点分析感情模式、关系推进、相处隐患与建议。`;
    case 'career-wealth':
      return `请围绕${scopeLabel}盘面，重点分析事业路径、财运抓手、风险点与建议。`;
    case 'life':
      return `请围绕${scopeLabel}盘面，概括人生主线、阶段重点与现实提醒。`;
    case 'chat':
      return `请围绕当前问题，结合${scopeLabel}盘面给出最相关的判断、依据与建议。`;
    default:
      return `请围绕${topicLabel}，结合${scopeLabel}盘面给出核心判断、关键依据与建议。`;
  }
}

function buildZiweiOutputText() {
  return '先给结论，再展开最关键的 2 到 4 个重点；每个重点都要写明盘面依据与建议。';
}

function formatScalarValue(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return '暂无';
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '暂无';
    }

    if (value.every((item) => ['string', 'number', 'boolean'].includes(typeof item))) {
      return value.join('、');
    }
  }

  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }

  return String(value);
}

function formatKeyValueBlock(record: Record<string, unknown>) {
  return Object.entries(record)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `- ${key}：${formatScalarValue(value)}`)
    .join('\n');
}

function formatObjectList(items: Array<Record<string, unknown>>) {
  if (items.length === 0) {
    return '- 暂无';
  }

  return items
    .map((item, index) => {
      const body = formatKeyValueBlock(item);
      return [`${index + 1}.`, body].join('\n');
    })
    .join('\n\n');
}

function buildZiweiReadableSnapshot(params: {
  payload: AnalysisPayloadV1;
  reportContext: AiReportContext;
}) {
  const snapshot = buildPromptContextSnapshot(params);

  return [
    '【分析背景】',
    formatKeyValueBlock({
      分析主题: mapTopicLabel(params.reportContext.selected_topic),
      分析范围: params.reportContext.scope_label,
      报告标题: params.reportContext.report_title,
      重点宫位: params.reportContext.palace_name
        ? formatPalaceName(params.reportContext.palace_name)
        : undefined,
    }),
    '',
    '【基础信息】',
    formatKeyValueBlock(snapshot.用户基础信息),
    '',
    '【当前运限】',
    formatKeyValueBlock(snapshot.当前运限信息),
    '',
    '【重点宫位摘要】',
    formatObjectList(snapshot.重点宫位摘要),
    '',
    '【关键证据摘要】',
    formatObjectList(snapshot.关键证据摘要),
    '',
    '【全盘宫位索引】',
    formatObjectList(snapshot.全盘宫位索引),
  ].join('\n');
}

function formatPalaceName(name: string) {
  return name.endsWith('宫') ? name : `${name}宫`;
}

function normalizePalaceName(name: string) {
  return name.endsWith('宫') ? name.slice(0, -1) : name;
}

function mapTopicLabel(selectedTopic: string) {
  switch (selectedTopic) {
    case 'destiny':
      return '命局解读';
    case 'relationship':
      return '婚姻感情';
    case 'career-wealth':
      return '事业财运';
    case 'life':
      return '人生解析';
    case 'chat':
      return '自由聊天';
    default:
      return 'AI 解读';
  }
}

function mapReportTypeLabel(reportType: string) {
  switch (reportType) {
    case 'destiny-overview':
      return '命局综述';
    case 'palace':
      return '宫位详解';
    case 'scope':
      return '阶段报告';
    case 'relationship':
      return '婚姻感情专题';
    case 'career-wealth':
      return '事业财运专题';
    case 'life':
      return '人生解析专题';
    case 'chat':
      return '自由问答';
    default:
      return 'AI 解读报告';
  }
}

function mapScopeLabel(scope: ScopeType) {
  switch (scope) {
    case 'origin':
      return '本命';
    case 'decadal':
      return '大限';
    case 'yearly':
      return '流年';
    case 'monthly':
      return '流月';
    case 'daily':
      return '流日';
    case 'hourly':
      return '流时';
  }
}

function getAllStars(palace: PalaceFact) {
  return [...palace.major_stars, ...palace.minor_stars, ...palace.other_stars];
}

function getPalaceByName(payload: AnalysisPayloadV1, palaceName: string) {
  const normalized = normalizePalaceName(palaceName);

  return (
    payload.palaces.find((item) => normalizePalaceName(item.name) === normalized) ?? null
  );
}

function getPalaceByIndex(payload: AnalysisPayloadV1, palaceIndex?: number) {
  if (palaceIndex === undefined) {
    return null;
  }

  return payload.palaces.find((item) => item.index === palaceIndex) ?? null;
}

function getBodyPalace(payload: AnalysisPayloadV1) {
  return payload.palaces.find((item) => item.is_body_palace) ?? null;
}

function getOppositePalace(payload: AnalysisPayloadV1, palace: PalaceFact | null) {
  if (!palace) return null;
  return getPalaceByIndex(payload, palace.opposite_palace_index);
}

function getSurroundedPalaces(payload: AnalysisPayloadV1, palace: PalaceFact | null) {
  if (!palace) return [];

  return palace.surrounded_palace_indexes
    .map((index) => getPalaceByIndex(payload, index))
    .filter((item): item is PalaceFact => !!item && item.index !== palace.index);
}

function dedupePalaces(palaces: Array<PalaceFact | null | undefined>) {
  const map = new Map<number, PalaceFact>();

  palaces.forEach((item) => {
    if (item) {
      map.set(item.index, item);
    }
  });

  return Array.from(map.values());
}

function collectMutagenStars(
  stars: StarFact[],
  key: 'birth_mutagen' | 'active_scope_mutagen',
) {
  return stars
    .filter((star) => !!star[key])
    .map((star) => `${star.name}化${star[key]}`);
}

function buildScopeFocusPalaces(payload: AnalysisPayloadV1) {
  const activePalace = getPalaceByIndex(payload, payload.active_scope.palace_index);
  const hitPalaces = [...payload.palaces]
    .filter((item) => item.scope_hits.length > 0)
    .sort((left, right) => {
      const scoreLeft =
        left.scope_hits.length * 10 +
        (left.dynamic_scope_name ? 3 : 0) +
        left.summary_tags.length;
      const scoreRight =
        right.scope_hits.length * 10 +
        (right.dynamic_scope_name ? 3 : 0) +
        right.summary_tags.length;
      return scoreRight - scoreLeft;
    });

  return dedupePalaces([
    activePalace,
    ...hitPalaces,
    getPalaceByName(payload, '命宫'),
    getBodyPalace(payload),
    getPalaceByName(payload, '福德'),
  ]).slice(0, 6);
}

function buildFocusTaskBundle(payload: AnalysisPayloadV1, reportContext: AiReportContext) {
  const activePalace = getPalaceByIndex(payload, payload.active_scope.palace_index);
  const bodyPalace = getBodyPalace(payload);
  const mingPalace = getPalaceByName(payload, '命宫');
  const spousePalace = getPalaceByName(payload, '夫妻');
  const childrenPalace = getPalaceByName(payload, '子女');
  const wealthPalace = getPalaceByName(payload, '财帛');
  const travelPalace = getPalaceByName(payload, '迁移');
  const careerPalace = getPalaceByName(payload, '官禄');
  const housePalace = getPalaceByName(payload, '田宅');
  const fortunePalace = getPalaceByName(payload, '福德');

  switch (`${reportContext.selected_topic}:${reportContext.report_type}`) {
    case 'destiny:destiny-overview':
      return {
        focusSummary: '概括命盘底色、核心驱动力、主要优势与人生主线。',
        focusPalaces: dedupePalaces([
          mingPalace,
          bodyPalace,
          fortunePalace,
          careerPalace,
          wealthPalace,
          travelPalace,
        ]),
        outputFocus: [
          '先判断整张命盘的底色与主导力量。',
          '再提炼最值得优先关注的 1 到 3 条人生主轴。',
          '每个结论都要能对应到具体宫位、主星、四化或运限触发。',
        ],
        avoid: [
          '保持命局综述视角，围绕主线组织内容。',
        ],
      };
    case 'destiny:palace': {
      const selectedPalace = reportContext.palace_name
        ? getPalaceByName(payload, reportContext.palace_name)
        : null;
      return {
        focusSummary: `只解读${formatPalaceName(
          selectedPalace?.name ?? reportContext.palace_name ?? '当前宫位',
        )}本身，以及它的对宫与三方四正如何共同作用。`,
        focusPalaces: dedupePalaces([
          selectedPalace,
          getOppositePalace(payload, selectedPalace),
          ...getSurroundedPalaces(payload, selectedPalace),
        ]),
        outputFocus: [
          '先说明当前宫位的核心主题、主导星曜和关键标签。',
          '再结合对宫、三方四正说明支持、放大或牵制关系。',
          '建议只能围绕这一组宫位结构，不要跳去别的专题。',
        ],
        avoid: [
          '围绕当前宫位及其关联结构给出结论与建议。',
        ],
      };
    }
    case 'destiny:scope':
      return {
        focusSummary: `聚焦${payload.active_scope.label}对本命主线的实际触发，判断这一阶段的重点变化与优先级。`,
        focusPalaces: dedupePalaces([
          activePalace,
          ...buildScopeFocusPalaces(payload),
          mingPalace,
          fortunePalace,
          careerPalace,
          travelPalace,
        ]).slice(0, 6),
        outputFocus: [
          '先判断这一阶段最强的触发点。',
          '说明它如何影响本命主线和原有格局。',
          '把结论落到阶段机会、阻力与行动优先级。',
        ],
        avoid: [
          '聚焦当前阶段触发，围绕阶段变化与优先级作答。',
        ],
      };
    case 'relationship:relationship':
      return {
        focusSummary: '只解读婚姻感情、亲密关系、相处模式与当前阶段触发。',
        focusPalaces: dedupePalaces([
          spousePalace,
          mingPalace,
          fortunePalace,
          childrenPalace,
          travelPalace,
          activePalace,
        ]),
        outputFocus: [
          '优先判断关系模式、推进阻力与情绪互动。',
          '说明哪些结论来自夫妻宫、命宫、福德宫、子女宫或当前运限触发。',
          '建议要贴合当前阶段，不要空泛劝说。',
        ],
        avoid: [
          '围绕关系议题作答，并保持证据对应。',
        ],
      };
    case 'career-wealth:career-wealth':
      return {
        focusSummary: '只解读事业路径、财运抓手、资源配置与执行节奏。',
        focusPalaces: dedupePalaces([
          careerPalace,
          wealthPalace,
          mingPalace,
          fortunePalace,
          housePalace,
          travelPalace,
          activePalace,
        ]),
        outputFocus: [
          '区分事业发展、赚钱方式和资源落点。',
          '说明当前运限在哪些宫位形成机会或阻力。',
          '建议要体现先后顺序和风险控制。',
        ],
        avoid: [
          '围绕事业与财务议题作答，财务判断用趋势与条件表述。',
        ],
      };
    case 'life:life':
      return {
        focusSummary: '聚焦人生主线、阶段重点、长期方向与短期动作的衔接。',
        focusPalaces: dedupePalaces([
          mingPalace,
          bodyPalace,
          fortunePalace,
          careerPalace,
          wealthPalace,
          travelPalace,
          activePalace,
        ]),
        outputFocus: [
          '先概括主线，再区分长期与短期重点。',
          '如果当前有运限触发，要说明它如何改变节奏。',
          '建议必须能够落到当前阶段的行动次序。',
        ],
        avoid: [
          '围绕人生主线作答，并体现当前运限对节奏的影响。',
        ],
      };
    case 'chat:chat':
      return {
        focusSummary: '以用户问题为中心，在全盘范围内自由问答，必要时结合当前运限给出可执行建议。',
        focusPalaces: dedupePalaces([
          mingPalace,
          bodyPalace,
          fortunePalace,
          careerPalace,
          wealthPalace,
          spousePalace,
          travelPalace,
          activePalace,
        ]).slice(0, 8),
        outputFocus: [
          '先直接回答问题，再补充关键依据。',
          '优先使用宫位、主星、四化、运限命中、证据摘要来支撑结论。',
          '建议要具体可执行，避免空泛表述。',
        ],
        avoid: [
          '以用户问题为中心，结论基于盘面证据。',
        ],
      };
    default:
      return {
        focusSummary: '根据用户问题，结合盘面与运限进行问答与建议。',
        focusPalaces: dedupePalaces([
          mingPalace,
          bodyPalace,
          careerPalace,
          wealthPalace,
          spousePalace,
          activePalace,
        ]).slice(0, 6),
        outputFocus: [
          '先回答用户问题，再说明盘面依据。',
          '给出可操作建议，并区分短期与中期。',
        ],
        avoid: [
          '保持证据驱动，建议具体可执行。',
        ],
      };
  }
}

function buildPalaceSummary(payload: AnalysisPayloadV1, palace: PalaceFact) {
  const oppositePalace = getOppositePalace(payload, palace);
  const surroundedPalaces = getSurroundedPalaces(payload, palace);
  const allStars = getAllStars(palace);

  return {
    宫位: formatPalaceName(palace.name),
    宫干支: `${palace.heavenly_stem}${palace.earthly_branch}`,
    当前动态宫名: palace.dynamic_scope_name || undefined,
    主星: palace.major_stars.map((item) => item.name),
    辅星: palace.minor_stars.map((item) => item.name),
    杂曜: palace.other_stars.map((item) => item.name),
    当前运限加临星曜: palace.scope_stars.map((item) => item.name),
    生年四化: collectMutagenStars(allStars, 'birth_mutagen'),
    当前运限四化: collectMutagenStars(allStars, 'active_scope_mutagen'),
    关键词: palace.summary_tags,
    运限命中: palace.scope_hits,
    对宫: oppositePalace ? formatPalaceName(oppositePalace.name) : '无',
    三方四正: surroundedPalaces.map((item) => formatPalaceName(item.name)),
    大限范围: `${palace.decadal_range[0]}-${palace.decadal_range[1]}岁`,
    长生十二神: palace.changsheng12,
  };
}

function buildEvidenceSummary(
  payload: AnalysisPayloadV1,
  focusPalaces: PalaceFact[],
  reportContext: AiReportContext,
) {
  const focusIndexes = new Set(focusPalaces.map((item) => item.index));
  const focusNames = new Set(focusPalaces.map((item) => normalizePalaceName(item.name)));
  const fallbackList =
    reportContext.selected_topic === 'risk'
      ? payload.evidence_pool.filter((item) => item.mutagens.includes('忌'))
      : payload.evidence_pool;
  const matchedEvidence = payload.evidence_pool.filter(
    (item) =>
      item.palace_indexes.some((index) => focusIndexes.has(index)) ||
      item.palace_names.some((name) => focusNames.has(normalizePalaceName(name))) ||
      (reportContext.selected_topic === 'risk' && item.mutagens.includes('忌')),
  );
  const evidencePool = (matchedEvidence.length > 0 ? matchedEvidence : fallbackList).sort(
    (left, right) => right.priority - left.priority,
  );

  const picked: typeof evidencePool = [];
  const seen = new Set<string>();

  evidencePool.forEach((item) => {
    const key = item.stable_key || item.id;
    if (seen.has(key) || picked.length >= 8) {
      return;
    }
    seen.add(key);
    picked.push(item);
  });

  return picked.map((item) => ({
    证据标题: item.title,
    作用范围: mapScopeLabel(item.scope),
    关联宫位: item.palace_names.map((name) => formatPalaceName(name)),
    关联星曜: item.star_names,
    关联四化: item.mutagens,
    说明: item.description,
  }));
}

function buildPalaceIndex(payload: AnalysisPayloadV1) {
  return payload.palaces.map((item) => ({
    宫位: formatPalaceName(item.name),
    主星: item.major_stars.map((star) => star.name),
    当前动态宫名: item.dynamic_scope_name || undefined,
    关键标签: [...item.summary_tags, ...item.scope_hits].slice(0, 4),
  }));
}

export function buildPromptContextSnapshot(params: {
  payload: AnalysisPayloadV1;
  reportContext: AiReportContext;
}) {
  const { payload, reportContext } = params;
  const focusTaskBundle = buildFocusTaskBundle(payload, reportContext);
  const currentPalace = getPalaceByIndex(payload, payload.active_scope.palace_index);

  return {
    当前报告任务: {
      报告标题: reportContext.report_title,
      解读主题: mapTopicLabel(reportContext.selected_topic),
      报告类型: mapReportTypeLabel(reportContext.report_type),
      解读目标: focusTaskBundle.focusSummary,
      重点参考宫位: focusTaskBundle.focusPalaces.map((item) => formatPalaceName(item.name)),
      输出重点: focusTaskBundle.outputFocus,
      严格边界: focusTaskBundle.avoid,
      焦点提示: reportContext.focus_notes,
      推荐追问: reportContext.suggested_questions,
    },
    用户基础信息: {
      性别: payload.basic_info.gender,
      阳历生日: payload.basic_info.solar_date,
      农历生日: payload.basic_info.lunar_date,
      出生时辰: `${payload.basic_info.birth_time_label}（${payload.basic_info.birth_time_range}）`,
      命主: payload.basic_info.soul,
      身主: payload.basic_info.body,
      五行局: payload.basic_info.five_elements_class,
    },
    当前运限信息: {
      时限类型: mapScopeLabel(payload.active_scope.scope),
      时限标签: payload.active_scope.label,
      参考日期: payload.active_scope.solar_date,
      虚岁: payload.active_scope.nominal_age,
      当前落宫: currentPalace ? formatPalaceName(currentPalace.name) : '未标注',
      当前四化: payload.active_scope.mutagen_map.map(
        (item) => `${item.star}化${item.mutagen}`,
      ),
    },
    重点宫位摘要: focusTaskBundle.focusPalaces.map((item) =>
      buildPalaceSummary(payload, item),
    ),
    关键证据摘要: buildEvidenceSummary(
      payload,
      focusTaskBundle.focusPalaces,
      reportContext,
    ),
    全盘宫位索引: buildPalaceIndex(payload),
  };
}

export function buildPortablePromptPack(params: {
  payload: AnalysisPayloadV1;
  reportContext: AiReportContext;
}) {
  const { payload, reportContext } = params;

  return [
    buildZiweiReadableSnapshot({ payload, reportContext }),
  ].join('\n');
}

export function buildAnalysisSystemPrompt() {
  return [
    ZIWEI_ANALYST_ROLE,
    ZIWEI_ANALYSIS_REQUIREMENT,
    '若输入缺少直接证据，写“当前盘面未显示该项直接证据”。',
    markdownReportRules,
  ].join('\n');
}

export function buildAnalysisUserPrompt(params: {
  payload: AnalysisPayloadV1;
  reportContext: AiReportContext;
}) {
  const { payload, reportContext } = params;
  const portablePromptPack = buildPortablePromptPack({
    payload,
    reportContext,
  });

  return [
    `当前时间：${new Date().toLocaleString('zh-CN')}`,
    portablePromptPack,
    `问题：请围绕“${reportContext.report_title}”做分析。`,
    `任务：${buildZiweiTaskText(reportContext)}`,
    `输出：${buildZiweiOutputText()}`,
  ].join('\n\n');
}

export function buildChatSystemPrompt() {
  return [
    ZIWEI_ANALYST_ROLE,
    ZIWEI_ANALYSIS_REQUIREMENT,
    '若输入缺少直接证据，写“当前盘面未显示该项直接证据”。',
    markdownReportRules,
  ].join('\n');
}

export function buildChatUserPrompt(params: {
  payload: AnalysisPayloadV1;
  reportContext: AiReportContext;
  reportMarkdown: string;
  history: ChatTurn[];
  question: string;
}) {
  const { payload, reportContext, reportMarkdown, history, question } = params;
  const portablePromptPack = buildPortablePromptPack({
    payload,
    reportContext,
  });

  return [
    `当前时间：${new Date().toLocaleString('zh-CN')}`,
    portablePromptPack,
    `问题：${question}`,
    '任务：先直接回答当前问题，再说明对应的盘面依据；若已有报告与当前问题相关，可延续其结论。',
    '当前报告正文：',
    reportMarkdown,
    '最近对话：',
    stringify(history),
    `输出：${buildZiweiOutputText()}`,
  ].join('\n');
}

export function buildAnalysisMessages(params: {
  payload: AiAnalysisPayload;
  reportContext: AiReportContext;
}) {
  if (isSynastryAnalysisPayload(params.payload)) {
    return buildSynastryAnalysisMessages();
  }

  return [
    { role: 'system', content: buildAnalysisSystemPrompt() },
    {
      role: 'user',
      content: buildAnalysisUserPrompt({
        payload: params.payload,
        reportContext: params.reportContext,
      }),
    },
  ] as const;
}

export function buildChatMessages(params: {
  payload: AnalysisPayloadV1;
  reportContext: AiReportContext;
  reportMarkdown: string;
  history: ChatTurn[];
  question: string;
}) {
  return [
    { role: 'system', content: buildChatSystemPrompt() },
    { role: 'user', content: buildChatUserPrompt(params) },
  ] as const;
}
