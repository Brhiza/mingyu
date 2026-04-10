import type { PromptTemplate } from '../types';
import { joinSections, safeParseJson, stringifyJson } from './prompt-helpers';
import { ZIWEI_ANALYSIS_REQUIREMENT, ZIWEI_ANALYST_ROLE } from './ziwei-prompt-copy';

function getText(values: Record<string, string>, key: string) {
  return values[key]?.trim() ?? '';
}

function formatTemplateValue(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return '暂无';
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '暂无';
    if (value.every((item) => ['string', 'number', 'boolean'].includes(typeof item))) {
      return value.join('、');
    }
    return value
      .map((item, index) =>
        typeof item === 'object' && item !== null
          ? `${index + 1}. ${Object.entries(item as Record<string, unknown>)
              .map(([key, nestedValue]) => `${key}：${formatTemplateValue(nestedValue)}`)
              .join('；')}`
          : `${index + 1}. ${String(item)}`,
      )
      .join('\n');
  }

  return String(value);
}

function buildTemplateKeyValueSection(title: string, record: Record<string, unknown>): string {
  const body = Object.entries(record)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `- ${key}：${formatTemplateValue(value)}`)
    .join('\n');

  return [`【${title}】`, body || '- 暂无'].join('\n');
}

function buildZiweiTemplatePromptBody(payload: unknown, reportContext: unknown): string {
  const payloadRecord =
    payload && typeof payload === 'object' ? (payload as Record<string, any>) : {};
  const reportContextRecord =
    reportContext && typeof reportContext === 'object'
      ? (reportContext as Record<string, any>)
      : {};

  const basicInfo = payloadRecord.basic_info ?? {};
  const activeScope = payloadRecord.active_scope ?? {};
  const palaces = Array.isArray(payloadRecord.palaces) ? payloadRecord.palaces.slice(0, 12) : [];
  const evidencePool = Array.isArray(payloadRecord.evidence_pool)
    ? payloadRecord.evidence_pool.slice(0, 8)
    : [];

  return [
    buildTemplateKeyValueSection('分析背景', {
      分析主题: reportContextRecord['解读主题'] ?? reportContextRecord.selected_topic,
      报告类型: reportContextRecord['报告类型'] ?? reportContextRecord.report_type,
      分析范围: reportContextRecord['时限'] ?? reportContextRecord.scope_label,
      报告标题: reportContextRecord['报告标题'] ?? reportContextRecord.report_title,
    }),
    buildTemplateKeyValueSection('基础信息', {
      性别: basicInfo.gender,
      阳历生日: basicInfo.solar_date,
      农历生日: basicInfo.lunar_date,
      出生时辰: basicInfo.birth_time_label && basicInfo.birth_time_range
        ? `${basicInfo.birth_time_label}（${basicInfo.birth_time_range}）`
        : basicInfo.birth_time_label,
      命主: basicInfo.soul,
      身主: basicInfo.body,
      五行局: basicInfo.five_elements_class,
    }),
    buildTemplateKeyValueSection('当前运限', {
      时限标签: activeScope.label,
      参考日期: activeScope.solar_date,
      虚岁: activeScope.nominal_age,
      当前四化: Array.isArray(activeScope.mutagen_map)
        ? activeScope.mutagen_map.map((item: any) => `${item.star}化${item.mutagen}`)
        : [],
    }),
    buildTemplateKeyValueSection('重点宫位摘要', {
      宫位: palaces.map((palace: any) => ({
        宫位: palace.name,
        主星: Array.isArray(palace.major_stars)
          ? palace.major_stars.map((star: any) => star.name).join('、')
          : '暂无',
        关键词: Array.isArray(palace.summary_tags) ? palace.summary_tags.join('、') : '暂无',
        运限命中: Array.isArray(palace.scope_hits) ? palace.scope_hits.join('、') : '暂无',
      })),
    }),
    buildTemplateKeyValueSection('关键证据摘要', {
      证据: evidencePool.map((item: any) => ({
        标题: item.title,
        宫位: Array.isArray(item.palace_names) ? item.palace_names.join('、') : '暂无',
        星曜: Array.isArray(item.star_names) ? item.star_names.join('、') : '暂无',
        四化: Array.isArray(item.mutagens) ? item.mutagens.join('、') : '暂无',
      })),
    }),
  ].join('\n\n');
}

function buildBaziSingle(values: Record<string, string>) {
  const system = [
    '你是资深八字命理师，熟悉《渊海子平》《滴天髓》《三命通会》。',
    '要求：',
    '- 只基于提供的命盘、岁运和问题作答。',
    '- 先给判断，再讲依据和建议。',
    '- 依据落到旺衰、格局、十神、用忌或岁运互动。',
    '- 用通俗中文，不写套话，不复述无关背景。',
  ].join('\n');

  const user = joinSections([
    `当前时间：${new Date().toLocaleString('zh-CN')}`,
    `命盘信息：\n${getText(values, 'chartData') || '请在这里粘贴八字命盘内容。'}`,
    `问题：${getText(values, 'question') || '请先做整体判断。'}`,
    `任务：${getText(values, 'task') || '抓住最关键的重点展开分析。'}`,
    '输出：先给结论，再展开关键依据与建议。',
  ]);

  return { system, user };
}

function buildBaziCompatibility(values: Record<string, string>) {
  const system = [
    '你是资深八字合盘分析师。',
    '要求：',
    '- 只基于提供的双方命盘和问题作答。',
    '- 先判断关系主基调，再讲 2 到 4 个关键点。',
    '- 重点说明相处模式、互补点、冲突点和建议。',
    '- 使用简体中文，避免空泛安慰。',
  ].join('\n');

  const user = joinSections([
    `当前时间：${new Date().toLocaleString('zh-CN')}`,
    `甲方命盘：\n${getText(values, 'chartA') || '请粘贴甲方命盘。'}`,
    `乙方命盘：\n${getText(values, 'chartB') || '请粘贴乙方命盘。'}`,
    `问题：${getText(values, 'question') || '请分析两人的婚恋与相处重点。'}`,
    '输出：先给关系结论，再展开重点。',
  ]);

  return { system, user };
}

function buildZiweiAnalysis(values: Record<string, string>) {
  const payloadJson = getText(values, 'payloadJson');
  const reportContextJson = getText(values, 'reportContextJson');
  const reportTitle = getText(values, 'reportTitle');
  const payloadResult = safeParseJson(payloadJson);
  const reportContextResult = safeParseJson(reportContextJson);

  const system = [
    ZIWEI_ANALYST_ROLE,
    ZIWEI_ANALYSIS_REQUIREMENT,
    '若输入缺少直接证据，写“当前盘面未显示该项直接证据”。',
    '输出简体中文 Markdown 正文。',
    '使用 `## 标题` 分段。',
    '正文使用短段落或 `-` 列表。',
  ].join('\n');

  const user = [
    `【当前时间】\n${new Date().toLocaleString('zh-CN')}`,
    buildZiweiTemplatePromptBody(payloadResult.ok ? payloadResult.value : null, reportContextResult.ok ? reportContextResult.value : null),
    `【问题】\n请围绕“${reportTitle || 'AI 解读报告'}”做分析。`,
    '【任务】\n结合盘面结构与当前运限，给出核心判断、关键依据和建议。',
    '【输出要求】\n先给结论，再展开最关键的 2 到 4 个重点；每个重点都要写明盘面依据与建议。',
  ].join('\n\n');

  return { system, user };
}

function buildZiweiChat(values: Record<string, string>) {
  const payloadJson = getText(values, 'payloadJson');
  const reportContextJson = getText(values, 'reportContextJson');
  const historyJson = getText(values, 'historyJson');
  const question = getText(values, 'question');
  const reportMarkdown = getText(values, 'reportMarkdown');
  const payloadResult = safeParseJson(payloadJson);
  const reportContextResult = safeParseJson(reportContextJson);
  const historyResult = safeParseJson(historyJson);

  const historyText = historyResult.ok
    ? stringifyJson(historyResult.value ?? [])
    : historyJson || '[]';

  const system = [
    ZIWEI_ANALYST_ROLE,
    ZIWEI_ANALYSIS_REQUIREMENT,
    '若输入缺少直接证据，写“当前盘面未显示该项直接证据”。',
    '输出简体中文 Markdown 正文。',
    '使用 `## 标题` 分段。',
    '正文使用短段落或 `-` 列表。',
  ].join('\n');

  const user = [
    `【当前时间】\n${new Date().toLocaleString('zh-CN')}`,
    buildZiweiTemplatePromptBody(payloadResult.ok ? payloadResult.value : null, reportContextResult.ok ? reportContextResult.value : null),
    `【问题】\n${question || '请直接回答当前问题。'}`,
    '【任务】\n先直接回答当前问题，再说明对应的盘面依据；若已有报告与当前问题相关，可延续其结论。',
    '【当前报告正文】',
    reportMarkdown || '请在这里粘贴已有报告正文。',
    '【最近对话】',
    historyText,
    '【输出要求】\n先给结论，再展开最关键的 2 到 4 个重点；每个重点都要写明盘面依据与建议。',
  ].join('\n\n');

  return { system, user };
}

function buildUniversal(values: Record<string, string>) {
  const role = getText(values, 'role') || '你是一个专业提示词助手。';
  const rules = getText(values, 'rules')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `- ${line}`)
    .join('\n');

  const system = joinSections([
    role,
    rules ? `要求：\n${rules}` : null,
  ]);

  const user = joinSections([
    getText(values, 'context') ? `背景信息：\n${getText(values, 'context')}` : null,
    `任务：${getText(values, 'task') || '请根据背景信息完成任务。'}`,
    getText(values, 'output') ? `输出要求：${getText(values, 'output')}` : null,
  ]);

  return { system, user };
}

export const promptTemplates: PromptTemplate[] = [
  {
    id: 'bazi-single',
    name: '八字单盘',
    description: '适合单人八字分析，沿用八字项目的 system/user 分离结构。',
    fields: [
      {
        id: 'chartData',
        label: '命盘信息',
        type: 'textarea',
        placeholder: '粘贴整理后的八字命盘、岁运信息、关键信息摘要。',
        required: true,
      },
      {
        id: 'question',
        label: '用户问题',
        type: 'text',
        placeholder: '例如：今年事业发展怎么样？',
      },
      {
        id: 'task',
        label: '任务要求',
        type: 'textarea',
        placeholder: '例如：判断今年最明显的机会与风险，并给出行动建议。',
      },
    ],
    build: buildBaziSingle,
  },
  {
    id: 'bazi-compatibility',
    name: '八字合盘',
    description: '适合两人关系、合作、婚恋等场景。',
    fields: [
      {
        id: 'chartA',
        label: '甲方命盘',
        type: 'textarea',
        placeholder: '粘贴第一人的命盘信息。',
        required: true,
      },
      {
        id: 'chartB',
        label: '乙方命盘',
        type: 'textarea',
        placeholder: '粘贴第二人的命盘信息。',
        required: true,
      },
      {
        id: 'question',
        label: '用户问题',
        type: 'text',
        placeholder: '例如：两个人适合长期发展吗？',
      },
    ],
    build: buildBaziCompatibility,
  },
  {
    id: 'ziwei-analysis',
    name: '紫微报告',
    description: '适合生成一次性的紫微解读报告提示词。',
    fields: [
      {
        id: 'reportTitle',
        label: '报告标题',
        type: 'text',
        placeholder: '例如：命局综述',
      },
      {
        id: 'reportContextJson',
        label: '分析背景 JSON',
        type: 'json',
        placeholder: '{\n  "解读主题": "命局解读",\n  "报告类型": "命局综述",\n  "时限": "本命"\n}',
        required: true,
        helperText: '可填写分析主题、范围等背景信息，项目会转成更自然的提示词文本。',
      },
      {
        id: 'payloadJson',
        label: '排盘数据 JSON',
        type: 'json',
        placeholder: '{\n  "basic_info": {},\n  "active_scope": {},\n  "palaces": []\n}',
        required: true,
      },
    ],
    build: buildZiweiAnalysis,
  },
  {
    id: 'ziwei-chat',
    name: '紫微问答',
    description: '适合在已有报告基础上继续追问。',
    fields: [
      {
        id: 'question',
        label: '用户问题',
        type: 'text',
        placeholder: '例如：这一阶段更适合换工作还是稳住？',
        required: true,
      },
      {
        id: 'reportContextJson',
        label: '分析背景 JSON',
        type: 'json',
        placeholder: '{\n  "解读主题": "人生解析",\n  "报告类型": "自由问答"\n}',
        required: true,
      },
      {
        id: 'payloadJson',
        label: '排盘数据 JSON',
        type: 'json',
        placeholder: '{\n  "basic_info": {},\n  "active_scope": {},\n  "palaces": []\n}',
        required: true,
      },
      {
        id: 'reportMarkdown',
        label: '已有报告正文',
        type: 'textarea',
        placeholder: '粘贴当前已经生成的紫微报告正文。',
      },
      {
        id: 'historyJson',
        label: '最近对话 JSON',
        type: 'json',
        placeholder: '[\n  {\n    "role": "user",\n    "content": "之前的问题"\n  }\n]',
      },
    ],
    build: buildZiweiChat,
  },
  {
    id: 'universal',
    name: '通用模板',
    description: '适合你后续继续扩展，快速拼 system prompt 和 user prompt。',
    fields: [
      {
        id: 'role',
        label: '角色设定',
        type: 'textarea',
        placeholder: '例如：你是一位专业的职业规划顾问。',
      },
      {
        id: 'rules',
        label: '规则清单',
        type: 'textarea',
        placeholder: '每行一条规则，例如：\n只基于提供资料作答\n给出结论和步骤',
      },
      {
        id: 'context',
        label: '背景信息',
        type: 'textarea',
        placeholder: '粘贴背景资料、原始文本、结构化信息。',
      },
      {
        id: 'task',
        label: '任务说明',
        type: 'textarea',
        placeholder: '例如：请根据背景信息生成一份简洁的分析。',
      },
      {
        id: 'output',
        label: '输出要求',
        type: 'text',
        placeholder: '例如：使用简体中文，按标题分段。',
      },
    ],
    build: buildUniversal,
  },
];
