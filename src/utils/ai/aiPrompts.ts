/**
 * AI 提示配置模块
 * 专项追问保持重点导向，综合分析允许使用固定总览模板。
 */

import type { BaziChartResult } from '@/utils/bazi/baziTypes'
import { formatBaziForDisplay, formatBaziForPrompt, formatHoroscopeSelectionForAI } from '@/utils/bazi/baziAnalysisFormatter'

interface AIPromptOption {
  id: string;
  text: string;
  prompt: string;
  dataset?: DOMStringMap;
}

const COMPREHENSIVE_SECTION_BREAKDOWN = [
  '命局总貌（先天底色 / 最大优势 / 核心短板）',
  '性格特点（做事风格 / 人际表现 / 情绪盲点）',
  '事业财运（适合路线 / 赚钱方式 / 当前提醒）',
  '感情婚姻（感情模式 / 相处隐患 / 关系建议）',
  '健康家庭（身体倾向 / 家庭责任 / 生活建议）',
  '当前阶段与近年提醒（当前大运主线 / 近两三年节奏 / 决策重点）',
  '综合建议（最该放大的优势 / 最该回避的风险 / 一条行动建议）'
].join('、')

const COMPREHENSIVE_OUTPUT_STRUCTURE = [
  '- 核心判断',
  '- 命局总貌',
  '  - 先天底色',
  '  - 最大优势',
  '  - 核心短板',
  '- 性格特点',
  '  - 做事风格',
  '  - 人际表现',
  '  - 情绪盲点',
  '- 事业财运',
  '  - 适合路线',
  '  - 赚钱方式',
  '  - 当前提醒',
  '- 感情婚姻',
  '  - 感情模式',
  '  - 相处隐患',
  '  - 关系建议',
  '- 健康家庭',
  '  - 身体倾向',
  '  - 家庭责任',
  '  - 生活建议',
  '- 当前阶段与近年提醒',
  '  - 当前大运主线',
  '  - 近两三年节奏',
  '  - 决策重点',
  '- 综合建议',
  '  - 最该放大的优势',
  '  - 最该回避的风险',
  '  - 一条行动建议'
].join('\n')

const BASE_SYSTEM_ROLE = '你是资深八字命理师，熟悉《渊海子平》《滴天髓》《三命通会》。'
const BASE_SYSTEM_RULES = [
  '只基于提供的命盘、岁运和问题作答',
  '先给判断，再讲依据和建议',
  '依据落到旺衰、格局、十神、用忌或岁运互动',
  '若命盘信息中已给出喜神五行、忌神五行、喜用十神、忌神十神与取用路径，应把它们当作待校验结论，结合旺衰、格局、十神、调候与取用路径逐项复核后再下判断',
  '普通格局先看身强身弱与扶抑，不要只按偏财格、正官格等普通格名直接反推喜忌；只有专旺格、从格等特殊格局才按顺势或从势解释',
  '若命盘中已给出的喜忌结论与推理结果不一致，必须明确指出冲突点，并说明是哪一步规则出现分歧，不得跳过冲突直接下结论',
  '解释喜忌时，先引用命盘信息中的旺衰、格局、喜神五行、忌神五行、喜用十神、忌神十神与取用路径，再说明为什么会这样',
  '用通俗中文，不写套话，不复述无关背景'
]

const MODE_SYSTEM_ADDONS = {
  detailed: [
    '围绕最关键的2到4个重点展开'
  ],
  concise: [
    '直接回答当前问题',
    '只讲最相关的1到2点',
    '判断明确，建议具体',
    '依据用一句白话点明'
  ],
  comprehensive: [
    '第一段直接写“核心判断：……”',
    '固定覆盖命局总貌、性格特点、事业财运、感情婚姻、健康家庭、当前阶段与近年提醒、综合建议',
    '不能只停留在大类标题',
    '每个模块下请拆成2到3个更具体的小点',
    '每个小点只写一句话或两三句话',
    '判断要落到命局结构、十神关系、旺衰变化或岁运互动，并说明现实意义',
    '信息不明显的模块可以少写'
  ]
} as const

const SCENE_SYSTEM_ADDONS = {
  default: [] as string[],
  compatibility: [
    '只基于提供的双方命盘和问题作答',
    '先判断关系主基调',
    '再讲2到4个关键点',
    '重点说相处模式、互补点、冲突点和建议'
  ]
} as const

type PromptMode = keyof typeof MODE_SYSTEM_ADDONS
type PromptScene = keyof typeof SCENE_SYSTEM_ADDONS

function buildSystemPrompt(mode: PromptMode, scene: PromptScene = 'default', intro?: string): string {
  const lines = [
    BASE_SYSTEM_ROLE
  ]

  if (intro) {
    lines.push(intro)
  }

  lines.push(
    '要求：',
    ...BASE_SYSTEM_RULES.map(line => `- ${line}`),
    ...MODE_SYSTEM_ADDONS[mode].map(line => `- ${line}`),
    ...SCENE_SYSTEM_ADDONS[scene].map(line => `- ${line}`)
  )

  if (mode === 'comprehensive') {
    lines.push('', '推荐输出结构：', COMPREHENSIVE_OUTPUT_STRUCTURE)
  }

  return lines.join('\n')
}

export const PROMPT_BUILDER = {
  baseSystem: buildSystemPrompt('detailed'),
  detailedSystem: buildSystemPrompt('detailed'),
  conciseSystem: buildSystemPrompt('concise'),
  comprehensiveSystem: buildSystemPrompt('comprehensive', 'default', '请输出一份适合快速总览的综合分析。'),
  compatibilitySystem: buildSystemPrompt('detailed', 'compatibility'),
  buildSystemPrompt,

  build: (chartData: string, question: string | undefined, requirements: string = ''): { system: string; user: string } => {
    const normalizedQuestion = (question ?? '').trim()
    const normalizedRequirements = requirements.trim()

    const sections: string[] = [`命盘信息：\n${chartData}`]

    if (normalizedQuestion) {
      sections.push(`问题：${normalizedQuestion}`)
    } else {
      sections.push('问题：未提供具体问题，请先做整体判断。')
    }

    if (normalizedRequirements) {
      sections.push(`任务：${normalizedRequirements}`)
    }

    sections.push('输出：先给结论，再展开关键依据与建议。')

    return {
      system: PROMPT_BUILDER.detailedSystem,
      user: sections.join('\n\n')
    }
  }
}

export const BAZI_AI_PROMPTS = {
  single: [
    {
      id: 'ai-mingge-zonglun',
      text: '命格总论',
      prompt: '判断日主旺衰、格局层次、用神喜忌，抓2到3个最有辨识度的影响，讲清命局的病与药，并给出调整建议。'
    },
    {
      id: 'ai-current-luck',
      text: '当前大运',
      prompt: '判断当前大运是助力期还是承压期，结合命局展开2到3类重点事项，并点出近几年的应期与决策建议。'
    },
    {
      id: 'ai-this-year',
      text: '今年运势',
      prompt: '判断今年最明显的机会与风险，展开2到3件重点事项，并给出一条该抓住的行动和一条该回避的底线。'
    },
    {
      id: 'ai-fortune-detail',
      text: '年限解析',
      prompt: '先做简短总结，再按明细逐项展开；每项说明主题、机会风险与建议。'
    },
    {
      id: 'ai-fortune-overview',
      text: '年限概论',
      prompt: '先给简短总结，再说明主线、结构变化、机会、风险和建议。'
    },
    {
      id: 'ai-career',
      text: '事业财运',
      prompt: '判断命局更适合守成、开拓、技术、管理还是经营，再说明当前阶段的赚钱方式、职业方向和风险点。'
    },
    {
      id: 'ai-marriage',
      text: '感情婚姻',
      prompt: '围绕配偶星、夫妻宫和相处模式，判断感情优势、隐患与关系节奏，再说明适合的对象、容易推进的阶段和经营建议。'
    },
    {
      id: 'ai-health',
      text: '健康状况',
      prompt: '判断最需要注意的身体倾向与生活习惯问题，说明风险主要落在哪些系统或体质失衡上，再给出饮食、作息、运动建议。'
    },
    {
      id: 'ai-parents-health',
      text: '父母健康',
      prompt: '从父母宫、父母星和当前岁运切入，判断父母健康最需要注意的1到2个方向，说明风险来源、时间点和现实建议。'
    },
    {
      id: 'ai-lifetime-fortune',
      text: '一生运势',
      prompt: '概括人生阶段走势，判断是先扬后抑、先难后易还是中年转强，再展开2到3个转折阶段，说明各阶段的主线任务与提醒。'
    },
    {
      id: 'ai-children-fate',
      text: '子女缘分',
      prompt: '判断子女缘分深浅、子女性格倾向和教育相处方式，说明更该关注生育时机、子女互动还是教育重点。'
    },
    {
      id: 'ai-wealth-timing',
      text: '财运时机',
      prompt: '判断财运应期，说明财更容易在哪些阶段、年份或环境里起来，再指出机会点和破财情形。'
    },
    {
      id: 'ai-noble-person',
      text: '贵人运',
      prompt: '判断贵人运的实际作用，说明贵人更可能出现的场景、介入方式，以及当前更该经营哪类人脉。'
    }
  ] as AIPromptOption[],
  combined: [
    {
      id: 'ai-compat-marriage',
      text: '婚恋匹配',
      prompt: '判断两人的婚恋匹配度是互补、互耗还是强吸引强摩擦，再说明相处优势、冲突来源、长期走向和相处建议。'
    },
    {
      id: 'ai-compat-career',
      text: '事业合作',
      prompt: '判断合作是否顺手、谁主导、谁执行、谁控风险，再说明最强互补点、最大利益冲突点和是否适合长期合伙。'
    },
    {
      id: 'ai-compat-friendship',
      text: '友情/合作',
      prompt: '判断两人的相处模式是容易投缘、容易互补还是容易暗中较劲，再说明适合的距离和相处提醒。'
    },
    {
      id: 'ai-compat-custom',
      text: '自定义...',
      prompt: ''
    }
  ] as AIPromptOption[]
}

export function getAIPrompt(questionText: string, selectedOption: AIPromptOption, baziResult1: BaziChartResult | null, horoscopeState: { year: number; month: number; day: number; hour: number; minute: number } | null = null): { system: string; user: string } {
  const baziData = baziResult1 ? formatBaziForPrompt(baziResult1, selectedOption, 'general') : '无法获取命盘数据。'
  const promptTemplate = selectedOption.prompt
  const optionId = selectedOption.id

  if (optionId === 'ask-ai-with-date') {
    if (!horoscopeState) {
      return PROMPT_BUILDER.build(baziData, '请选择一个具体日期进行分析。', '日期信息缺失')
    }

    const formattedHoroscopeState: { selectedDate: Date; selectedTime: string; } = {
      selectedDate: new Date(horoscopeState.year, horoscopeState.month - 1, horoscopeState.day),
      selectedTime: `${String(horoscopeState.hour).padStart(2, '0')}:${String(horoscopeState.minute).padStart(2, '0')}`
    }

    const dateInfo = formatHoroscopeSelectionForAI(formattedHoroscopeState)
    const customQuestion = (document.getElementById('customQuestion') as HTMLInputElement)?.value?.trim() || ''
    const userQuestion = (questionText && questionText !== '选定日期...') ? questionText : customQuestion
    const finalQuestion = userQuestion ? `在${dateInfo}这个时间点，${userQuestion}` : `请分析${dateInfo}这个时间点的运势重点。`
    return PROMPT_BUILDER.build(baziData, finalQuestion, '请结合用户提供的具体日期进行分析，优先回答最值得关注的重点。')
  }

  const focus = promptTemplate || '请根据用户问题抓住最关键的重点展开。'
  return PROMPT_BUILDER.build(baziData, questionText, focus)
}

export function buildBaziPrompt(baziData: string, question: string, requirements: string = ''): { system: string; user: string } {
  return PROMPT_BUILDER.build(baziData, question, requirements)
}

export function buildComprehensivePrompt(baziResult: BaziChartResult): { system: string; user: string } {
  const chartData = formatBaziForPrompt(baziResult, null, 'comprehensive')

  return {
    system: PROMPT_BUILDER.comprehensiveSystem,
    user: [
      `当前时间：${new Date().toLocaleString('zh-CN')}`,
      `命盘信息：\n${chartData}`,
      '任务：输出综合总览。第一段直接写“核心判断：……”，后续按固定模块展开。',
      `模块：${COMPREHENSIVE_SECTION_BREAKDOWN}。`
    ].join('\n\n')
  }
}

function buildChartCopyText(sections: string[]): string {
  return [
    ...sections,
    '',
    '【解读需求】',
    ''
  ].join('\n')
}

export function buildSingleChartCopyText(baziResult: BaziChartResult): string {
  return buildChartCopyText([
    '【排盘信息】',
    formatBaziForDisplay(baziResult)
  ])
}

export function buildCompatibilityPrompt(baziData1: string, baziData2: string, question: string): { system: string; user: string } {
  const currentTime = new Date().toLocaleString('zh-CN')

  const systemPrompt = PROMPT_BUILDER.compatibilitySystem

  const userPrompt = `当前时间：${currentTime}

甲方命盘：
${baziData1}

乙方命盘：
${baziData2}

问题：${question}

输出：先给关系结论，再展开重点。`

  return {
    system: systemPrompt,
    user: userPrompt
  }
}

export function buildCompatibilityChartCopyText(baziResult1: BaziChartResult, baziResult2: BaziChartResult): string {
  return buildChartCopyText([
    '【第一人排盘信息】',
    formatBaziForDisplay(baziResult1),
    '',
    '【第二人排盘信息】',
    formatBaziForDisplay(baziResult2)
  ])
}

export function getCompatibilityPrompt(questionText: string, baziResult1: BaziChartResult | null, baziResult2: BaziChartResult | null): { system: string; user: string } {
  const baziData1 = baziResult1 ? formatBaziForPrompt(baziResult1, null, 'compatibility') : '无法获取第一人命盘数据。'
  const baziData2 = baziResult2 ? formatBaziForPrompt(baziResult2, null, 'compatibility') : '无法获取第二人命盘数据。'

  return buildCompatibilityPrompt(baziData1, baziData2, questionText)
}
