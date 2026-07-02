import type {
  AlmanacData,
  AlmanacParticipantInput,
  AlmanacTopic,
  AstrolabeBirthInput,
  DivinationData,
  LenormandSpreadType,
  LiuyaoTemplateType,
  LiurenData,
  LiurenTemplateType,
  SupplementaryInfo,
  XiaoliurenDivinationMethod,
} from '../../../types/divination';
import type { DivinationMethodId } from '../config';
import { daysInSolarMonth } from '../../date-validation';
import {
  buildAstrolabeTopicGuidanceSection,
  buildAstrolabeTopicOutputRequirement,
  buildAstrolabeTopicTask,
  getAstrolabeDefaultQuestion,
  type AstrolabePromptTopic,
} from '../../astrolabe-prompts';
import {
  buildSection,
  buildSolarTimeInfoText,
  buildTimeInfoText,
  formatDivinationInfo,
  formatSupplementaryInfoSection,
} from './formatters';
import {
  buildMethodOutputRequirementText,
  buildMethodRequirementText,
  buildRoleText,
  buildTaskText,
} from './method-text';
import { buildLiurenTemplateText } from './liuren-template';
import { buildLiuyaoTemplateText } from './liuyao-template';

const CONCRETE_DIVINATION_METHODS: Array<Exclude<DivinationMethodId, 'random'>> = [
  'liuyao',
  'meihua',
  'xiaoliuren',
  'qimen',
  'liuren',
  'tarot',
  'ssgw',
  'lenormand',
];

function buildAstrolabeTransitScaleText(hasScopeText: boolean) {
  return [
    hasScopeText
      ? '【分析对象】已经给出本命、流年、流月或流日范围时，必须以该范围作为本次回答主范围。'
      : '未提供具体行运范围时，只能按本命盘长期结构作答，不得自行指定流年、月份、日期或绝对应期。',
    '本命盘：只定长期人格结构、人生主题、稳定倾向、天赋短板和长期调整方向，不能单独推出具体年份。',
    '流年：看年度主题、阶段转向和全年最容易被触发的议题；外行星、木星、土星对本命太阳、月亮、上升、天顶及关键宫主星的相位是阶段主证。',
    '流月：看一个月内的推进窗口、情绪波动、沟通节奏和短期机会；太阳、月亮、水星、金星、火星对本命点的触发是短期主证，必须承接流年背景。',
    '流日：看当天或极短期的执行、会面、沟通、签约、出行和避险；只能作为临门触发，不改写本命结构或年度趋势。',
    '应期写法：先讲本命底色，再讲所选行运层级如何触发；没有行运证据时只能给倾向和条件，不能给绝对日期。',
  ].join('\n');
}

function buildDivinationEvidenceTerms(method: Exclude<DivinationMethodId, 'random'>) {
  switch (method) {
    case 'liuyao':
      return {
        facts: '卦名、六亲、六神、世应、用神、动变、伏神、空亡、日月建或生克冲合',
        timing: '日月建、动变、空亡、冲合、伏神透出、用神旺衰或问题限定范围',
      };
    case 'meihua':
      return {
        facts: '本卦、互卦、变卦、体用、动爻、五行生克、卦气、外应或现实补充',
        timing: '动爻、体用生克、卦气、互变推进、外应条件或问题限定范围',
      };
    case 'xiaoliuren':
      return {
        facts: '三宫落点、六神、事项宫、三段过程、空亡、宫位关系或现实补充',
        timing: '三宫推进、事项宫、空亡、宫位迟速、问题限定范围或现实触发条件',
      };
    case 'qimen':
      return {
        facts: '值符值使、九宫、门星神干、用神宫、格局、空亡、马星、伏吟反吟或方位时机',
        timing: '值使门、用神宫、门星神干、空亡填实、马星、伏吟反吟、庚格或问题限定范围',
      };
    case 'liuren':
      return {
        facts: '四课、三传、发用、天将、课体、神煞、空亡或类神取用',
        timing: '发用、三传推进、空亡出空、明确神煞、类神状态或问题限定范围',
      };
    case 'tarot':
    case 'tarot_single':
      return {
        facts: '牌面、牌阵位置、正逆位、相邻组合、元素数字、人物姿态或问题限定范围',
        timing: '牌阵位置、牌面节奏、正逆位状态、牌面组合或问题限定范围',
      };
    case 'ssgw':
      return {
        facts: '签诗、签题、典故、解签、吉凶语气、宜忌或现实处境',
        timing: '签诗迟速、典故处境、签文宜忌、解签语气或问题限定范围',
      };
    case 'lenormand':
      return {
        facts: '核心牌、相邻组合、镜像关系、人物牌、事件牌、时间牌、牌阵位置或问题限定范围',
        timing: '时间牌、事件链顺序、相邻组合、镜像关系、牌阵位置或问题限定范围',
      };
    case 'almanac':
      return {
        facts: '黄历宜忌、冲煞、神煞、执日、星宿、候选日期或参与人八字适配信息',
        timing: '候选日期、黄历宜忌、冲煞、神煞、执日、星宿或现实约束',
      };
    case 'astrolabe':
      return {
        facts: '星体、宫位、角点、相位、格局或行运范围',
        timing: '本命结构、行运相位、落宫触发或分析对象范围',
      };
    default:
      return {
        facts: '已提供资料中的本体系事实、关键结构、辅助信息或现实补充',
        timing: '已提供资料中的时机线索、结构触发、问题限定范围或现实条件',
      };
  }
}

function buildLiurenAnalysisObjectText(data: LiurenData) {
  const initial = data.threeTransmissions[0];
  return [
    '分析对象：大六壬起课盘',
    `起课范围：${data.dayNight || '昼夜未标注'}；月将${data.monthLeader}加占时${data.divinationBranch}`,
    `主线对象：${data.transmissionRule || '取传法未标注'}；${initial ? `初传${initial.branch}乘${initial.god}` : '初传未标注'}`,
    '资料说明：本次只提供起课盘面，不包含外部事实；问题涉及具体日期时，只能按课传应期条件判断。',
  ].join('\n');
}

function buildLiurenScopeText() {
  return [
    '解读范围：只判断本课对应问题的当前走势、阻力、转机、应对动作与条件式应期。',
    '推断顺序：先看古籍取传法与发用，再看三传推进，随后看四课背景，最后用天将、空亡、课体和神煞作旁证。',
    '证据边界：课体、神煞和天将不得盖过发用与三传主线；已提供资料没有给出的现实条件不得编造。',
  ].join('\n');
}

function buildDivinationTimingBoundaryText(method: Exclude<DivinationMethodId, 'random'>) {
  switch (method) {
    case 'liuyao':
      return [
        '六爻应期必须来自用神旺衰、世应生克、动爻变爻、冲合、空亡出空、伏神透出等卦内证据。',
        '卦名、六神、直觉类象只能作辅助说明，不得单凭卦名或六神给具体年月日。',
        '若已提供资料未给月建、日辰或目标期限，只能给“快慢、先后、待冲合填实”等条件式应期，不得硬断绝对日期。',
      ].join('\n');
    case 'meihua':
      return [
        '梅花应期必须来自体用生克、动爻数、卦数、互卦过程、变卦结果、四时旺衰和外应之间的互证。',
        '体卦定自身承受力，用卦定外部事象，互卦看过程，变卦看结果；应期要说明落在哪一层证据。',
        '外应只能作辅证，不能独立决定绝对应期；起卦资料不足时只能给阶段与条件，不得凭单一象意给日期。',
      ].join('\n');
    case 'xiaoliuren':
      return [
        '小六壬应期先看结果宫定主趋势，再用起因宫与过程宫判断推进节奏、阻力和转机。',
        '大安偏稳，留连偏拖，速喜偏快，赤口偏冲突，小吉偏渐进，空亡偏落空；这些只能描述节奏倾向。',
        '不得把六宫名称直接等同具体日期；若用户没有提供目标期限，只能给快慢、宜等宜动和触发条件。',
      ].join('\n');
    case 'qimen':
      return [
        '奇门应期必须来自用神宫、值符值使、门星神干、空亡、马星、伏吟反吟、门迫击刑、宫位方位与时令。',
        '先判断用神宫能不能动、被谁制约、是否逢空逢冲，再给宜动、宜守或等待的时间窗口。',
        '不得只因吉门就断必成，也不得只因凶格就断必败；吉凶必须回到宫位组合和问题用神。',
      ].join('\n');
    case 'liuren':
      return [
        '大六壬应期必须来自发用、三传递进、四课关系、空亡填实、冲合墓绝、课体与神煞互证。',
        '初传看发端，中传看过程，末传看归结；三传能承接时才可给推进链路和阶段窗口。',
        '神煞只作辅证，不能压过三传主线；资料不足时只能给触发条件，不得随口指定日期。',
      ].join('\n');
    case 'tarot':
      return [
        '塔罗时间判断只能来自牌阵位置、牌面节奏、正逆位状态、牌面组合和提问本身限定的时间范围。',
        '单张牌不能独立推出绝对日期；只能说明“目前、近期、拖延、转折、先整理后推进”等节奏。',
        '若问题没有限定期限，回答应给现实行动窗口与观察信号，不得把牌义硬翻译成某年某月某日。',
      ].join('\n');
    case 'lenormand':
      return [
        '雷诺曼时间判断必须来自牌位位置、邻近牌组合、现实事件链、人物与消息流向，以及提问范围。',
        '核心牌看事件主轴，左右邻牌看触发与阻碍；日期只能在牌阵明确支持或用户限定范围内给出。',
        '不得孤立牌义硬断日期；没有期限证据时，只能给事件先后顺序、推进节奏和可观察信号。',
      ].join('\n');
    case 'ssgw':
      return [
        '灵签应期必须来自签诗迟速、典故处境、签文宜忌、解签语气和问题本身限定的范围。',
        '签诗通常更适合判断宜进宜守、可为不可为、待时或避险，不宜硬给精确日期。',
        '若签文只见守待、周旋或云开月明之象，应写清“条件成熟后再动”，不得改写成绝对年月日。',
      ].join('\n');
    case 'almanac':
      return [
        '择日结论只能在候选日期范围内产生，不得推荐候选范围外日期，也不得编造未给出的时辰吉凶。',
        '首选、备选、慎用必须说明黄历宜忌、冲煞、神煞、星宿、执日、参与人八字适配和现实约束。',
        '若候选日期整体都不理想，只能在范围内给相对较优和避险条件；现实刚性约束可以压过黄历分数，但必须说明取舍。',
      ].join('\n');
    case 'astrolabe':
      return '';
  }
}

export type DivinationDraft = {
  method: DivinationMethodId;
  question: string;
  questionSource?: 'custom' | 'inspiration';
  gender: '' | '男' | '女';
  birthYear: string;
  divinationTimeMode?: 'current' | 'custom';
  customDivinationDate?: string;
  customDivinationTime?: string;
  meihuaMethod: 'time' | 'number' | 'random' | 'external' | 'timeTrigram';
  meihuaNumber: string;
  xiaoliurenMethod: XiaoliurenDivinationMethod;
  xiaoliurenNumber: string;
  meihuaFocus?: 'general' | 'trend' | 'relationship' | 'decision';
  xiaoliurenFocus?: 'general' | 'emotion' | 'career' | 'wealth' | 'social' | 'trend';
  qimenFocus?: 'general' | 'timing' | 'strategy' | 'competition';
  liuyaoTemplate: LiuyaoTemplateType;
  liurenTemplate: LiurenTemplateType;
  tarotSpread: 'single' | 'three' | 'love' | 'career' | 'decision';
  almanacTopic: AlmanacTopic;
  almanacStartDate: string;
  almanacEndDate: string;
  almanacParticipants: AlmanacParticipantInput[];
  lenormandSpread: LenormandSpreadType;
  astrolabeName: string;
  astrolabeGender: '' | '男' | '女';
  astrolabeYear: string;
  astrolabeMonth: string;
  astrolabeDay: string;
  astrolabeHour: string;
  astrolabeMinute: string;
  astrolabeLatitude: string;
  astrolabeLongitude: string;
  astrolabeTimezone: string;
  astrolabeTopic?: AstrolabePromptTopic;
};

export type DivinationSession = {
  method: Exclude<DivinationMethodId, 'random'>;
  requestedMethod: DivinationMethodId;
  question: string;
  prompt: string;
  data: DivinationData;
};

export type BuildDivinationPromptOptions = {
  isCustomQuestion?: boolean;
  liuyaoTemplate?: LiuyaoTemplateType;
  liurenTemplate?: LiurenTemplateType;
  meihuaFocus?: NonNullable<DivinationDraft['meihuaFocus']>;
  xiaoliurenFocus?: NonNullable<DivinationDraft['xiaoliurenFocus']>;
  qimenFocus?: NonNullable<DivinationDraft['qimenFocus']>;
  astrolabeTopic?: AstrolabePromptTopic;
  astrolabeScopeText?: string;
};

export function buildDivinationPrompt(
  method: Exclude<DivinationMethodId, 'random'>,
  question: string,
  data: DivinationData,
  supplementaryInfo?: SupplementaryInfo,
  options: BuildDivinationPromptOptions = {},
) {
  const isCustomQuestion = Boolean(options.isCustomQuestion);
  const liuyaoTemplate = options.liuyaoTemplate ?? 'general';
  const liurenTemplate = options.liurenTemplate ?? 'general';
  const meihuaFocus = options.meihuaFocus ?? 'general';
  const xiaoliurenFocus = options.xiaoliurenFocus ?? 'general';
  const qimenFocus = options.qimenFocus ?? 'general';
  const isAlmanac = method === 'almanac';
  const astrolabeTopic =
    method === 'astrolabe' ? (options.astrolabeTopic ?? (isCustomQuestion ? 'chat' : 'life')) : '';
  const astrolabeScopeText = method === 'astrolabe' ? options.astrolabeScopeText?.trim() || '' : '';
  const normalizedQuestion =
    method === 'astrolabe'
      ? question.trim() || getAstrolabeDefaultQuestion(astrolabeTopic, { isCustomQuestion })
      : question;
  const timeInfo = method === 'astrolabe' ? buildSolarTimeInfoText(data) : buildTimeInfoText(data);
  const supplementarySection = formatSupplementaryInfoSection(method, supplementaryInfo);
  const infoText = formatDivinationInfo(method, data, normalizedQuestion, supplementaryInfo);
  const isAstrolabe = method === 'astrolabe';
  const evidenceTerms = buildDivinationEvidenceTerms(method);
  const requirementText = [
    isAlmanac
      ? '- 只基于提供的择日信息、补充信息与现实约束作答。'
      : isAstrolabe
        ? '- 只基于提供的星盘信息、分析对象与问题作答。'
        : '- 只基于提供的占卜信息与问题作答。',
    isAlmanac
      ? '- 不得编造已提供资料没有给出的现实约束、参与人信息或择日条件；允许基于候选日期、黄历、冲煞、神煞、星宿和参与人八字参考做择日推理。'
      : isAstrolabe
        ? '- 不得编造已提供资料没有给出的星体、宫位、角点、相位、格局或行运范围；允许基于已提供资料做星盘推理，但必须标明证据来源。'
        : `- 不得编造已提供资料没有给出的${evidenceTerms.facts}；允许基于已提供资料做本体系推理，但必须标明证据来源。`,
    ...(isCustomQuestion
      ? []
      : [
          '- 每个关键判断都要区分主证、辅证、反证或限制；若证据不足，只能给倾向和条件，不得强行下绝对结论。',
          isAstrolabe
            ? '- 涉及应期、日期或时间窗口时，必须说明来自本命结构、行运相位、落宫触发或分析对象范围中的哪一类证据。'
            : `- 涉及应期、日期或时间窗口时，必须说明来自${evidenceTerms.timing}中的哪一类证据。`,
        ]),
    ...(isAstrolabe
      ? [
          '- 不要泛泛讲星座性格，必须把相关星体、宫位、守护星和相位连到问题。',
          '- 本命盘只定长期结构；若【分析对象】提供流年、流月或流日，必须把所选时间段作为当前回答的主范围。',
          '- 没有行运证据支持时，不得自行硬断具体年份、月份、日期或绝对应期。',
        ]
      : []),
    ...(isCustomQuestion
      ? []
      : isAlmanac
        ? [
            '- 先直接给出择日结论，再讲主证据、条件限制和建议。',
            '- 优先抓最能影响筛选结果的 2 到 4 个证据点，不要平均复述全部候选日期资料。',
            '- 依据必须尽量落到黄历宜忌、冲煞、神煞、执日、星宿和参与人八字适配信息。',
          ]
        : isAstrolabe
          ? [
              '- 先直接回答【问题】，再讲主证据、条件限制和建议。',
              '- 优先抓最能决定判断方向的 2 到 4 个证据点，不要平均复述全部星盘资料。',
              '- 依据必须尽量落到星体、宫位、角点、相位、格局或行运信息。',
            ]
          : [
              '- 先直接回答【问题】，再讲主证据、条件限制和建议。',
              '- 优先抓最能决定判断方向的 2 到 4 个证据点，不要平均复述全部材料。',
              `- 依据必须尽量落到${evidenceTerms.facts}。`,
            ]),
    '- 使用简体中文，不写空话，不重复抄写原始信息。',
    isCustomQuestion ? '' : buildMethodRequirementText(method),
    isCustomQuestion
      ? ''
      : buildDivinationFocusRequirementText(method, meihuaFocus, xiaoliurenFocus, qimenFocus),
  ].join('\n');
  const outputRequirementText = isAlmanac
    ? [
        '先直接给出首选日期、备选日期与慎用日期，再展开最关键的 2 到 4 个筛选重点；每个重点都要写明择日依据、适用条件与现实建议。',
        '每个筛选重点都要区分主证、辅证、反证或限制；若现实约束压过黄历分数，必须说明取舍。',
        '如果信息不足或存在不确定性，需要明确说明，不要强行下绝对判断。',
        '最后补一条最值得执行的提醒。',
        buildMethodOutputRequirementText(method),
      ].join('\n')
    : method === 'liuren'
      ? [
          '先直接回答【问题】，再列最关键的 2 到 4 个判断点。',
          '每个判断点只写必要课传依据、触发条件与现实建议。',
          '应期必须来自发用、三传、空亡或明确神煞；证据不足就写条件，不硬给日期。',
          '如果信息不足或存在不确定性，需要明确说明，不要强行下绝对判断。',
          '最后补一条最值得执行的提醒。',
          buildMethodOutputRequirementText(method),
        ].join('\n')
      : [
          isAstrolabe
            ? '先直接回答【问题】，再展开最关键的 2 到 4 个重点；每个重点都要写明星盘依据、触发条件与现实建议。'
            : '先直接回答【问题】，再展开最关键的 2 到 4 个重点；每个重点都要写明占卜依据、触发条件与现实建议。',
          isAstrolabe
            ? '每个重点都要区分主证、辅证、反证或限制；涉及应期时必须说明来自本命结构、行运相位、落宫触发或分析对象范围中的哪一层。'
            : `每个重点都要区分主证、辅证、反证或限制；涉及应期时必须说明来自${evidenceTerms.timing}中的哪一层。`,
          '如果信息不足或存在不确定性，需要明确说明，不要强行下绝对判断。',
          '最后补一条最值得执行的提醒。',
          buildDivinationFocusOutputRequirementText(
            method,
            meihuaFocus,
            xiaoliurenFocus,
            qimenFocus,
          ),
          ...(method === 'astrolabe' ? [buildAstrolabeTopicOutputRequirement(astrolabeTopic)] : []),
          ...(method === 'astrolabe'
            ? [
                '星盘回答必须区分本命底色与行运触发：先讲本命结构如何形成长期倾向，再讲所选流年、流月或流日具体触发了哪些议题。',
              ]
            : []),
          buildMethodOutputRequirementText(method),
        ].join('\n');
  const liurenTemplateSection =
    method === 'liuren'
      ? buildSection('【分析思路】', buildLiurenTemplateText(liurenTemplate, data as LiurenData))
      : '';
  const liuyaoTemplateSection =
    method === 'liuyao'
      ? buildSection('【断卦要点】', buildLiuyaoTemplateText(liuyaoTemplate, question))
      : '';
  const astrolabeGuidanceSection =
    method === 'astrolabe' && !isCustomQuestion
      ? buildSection('【分析思路】', buildAstrolabeTopicGuidanceSection(astrolabeTopic))
      : '';
  const astrolabeTransitScaleSection =
    method === 'astrolabe' && !isCustomQuestion
      ? buildSection(
          '【行运时间尺度】',
          buildAstrolabeTransitScaleText(Boolean(astrolabeScopeText)),
        )
      : '';
  const timingBoundarySection =
    method !== 'astrolabe' && !isCustomQuestion
      ? buildSection('【应期判断方法】', buildDivinationTimingBoundaryText(method))
      : '';
  const divinationFocusGuidanceSection = isCustomQuestion
    ? ''
    : buildSection(
        '【分析思路】',
        buildDivinationFocusGuidanceText(method, meihuaFocus, xiaoliurenFocus, qimenFocus),
      );
  const taskText =
    method === 'astrolabe' && !isCustomQuestion
      ? buildAstrolabeTopicTask(astrolabeTopic)
      : method === 'liuren'
        ? [
            '请先围绕【问题】给出判断，再按古籍取传法、发用、三传推进、四课背景和辅证说明理由。',
            '需要明确事情会如何演变、卡点在哪、下一步先做什么；应期只能写课传支持的触发条件。',
          ].join('\n')
        : buildDivinationFocusTaskText(method, meihuaFocus, xiaoliurenFocus, qimenFocus);

  if (method === 'liuren') {
    return [
      buildRoleText(method),
      buildSection('【要求】', requirementText),
      buildSection('【当前时间】', timeInfo),
      supplementarySection ? buildSection('【补充信息】', supplementarySection) : '',
      buildSection('【排盘信息】', infoText),
      buildSection('【分析对象】', buildLiurenAnalysisObjectText(data as LiurenData)),
      buildSection('【解读范围】', buildLiurenScopeText()),
      timingBoundarySection,
      buildSection('【问题】', normalizedQuestion),
      isCustomQuestion ? '' : liurenTemplateSection,
      isCustomQuestion ? '' : buildSection('【任务】', taskText),
      isCustomQuestion ? '' : buildSection('【输出要求】', outputRequirementText),
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  return [
    buildRoleText(method),
    buildSection('【要求】', requirementText),
    buildSection('【当前时间】', timeInfo),
    supplementarySection ? buildSection('【补充信息】', supplementarySection) : '',
    astrolabeScopeText ? buildSection('【分析对象】', astrolabeScopeText) : '',
    astrolabeTransitScaleSection,
    buildSection('【占卜信息】', infoText),
    timingBoundarySection,
    isAlmanac ? '' : buildSection('【问题】', normalizedQuestion),
    isCustomQuestion ? '' : astrolabeGuidanceSection,
    isCustomQuestion || astrolabeGuidanceSection ? '' : divinationFocusGuidanceSection,
    isCustomQuestion ? '' : buildSection('【任务】', taskText),
    isCustomQuestion ? '' : liuyaoTemplateSection,
    isCustomQuestion ? '' : liurenTemplateSection,
    isCustomQuestion ? '' : buildSection('【输出要求】', outputRequirementText),
  ]
    .filter(Boolean)
    .join('\n\n');
}

function buildSupplementaryInfo(draft: DivinationDraft): SupplementaryInfo | undefined {
  const birthYear = draft.birthYear.trim()
    ? readOptionalPositiveIntegerText(draft.birthYear)
    : undefined;
  const hasBirthYear = typeof birthYear === 'number' && Number.isFinite(birthYear);

  const info: SupplementaryInfo = {};

  if (draft.gender) {
    info.gender = draft.gender;
  }
  if (hasBirthYear) {
    info.birthYear = birthYear;
  }
  if (draft.method === 'meihua') {
    info.meihuaSettings = {
      method: draft.meihuaMethod,
      ...(draft.meihuaMethod === 'number' && draft.meihuaNumber.trim()
        ? { number: readPositiveIntegerText(draft.meihuaNumber, '数字起卦') }
        : {}),
    };
  }
  if (draft.method === 'almanac' && draft.question.trim()) {
    info.userSupplement = draft.question.trim();
  }

  return Object.keys(info).length > 0 ? info : undefined;
}

function validateDraft(draft: DivinationDraft) {
  if (draft.method !== 'almanac' && !draft.question.trim()) {
    throw new Error('请输入你想占卜的问题');
  }

  if (draft.method === 'meihua' && draft.meihuaMethod === 'number') {
    readPositiveIntegerText(draft.meihuaNumber, '数字起卦');
  }

  if (draft.method === 'xiaoliuren' && draft.xiaoliurenMethod === 'number') {
    readPositiveIntegerText(draft.xiaoliurenNumber, '小六壬数字起课');
  }

  if (draft.method === 'almanac') {
    if (!draft.almanacStartDate || !draft.almanacEndDate) {
      throw new Error('黄历择日需要选择开始日期和结束日期');
    }
    validateDateRange(draft.almanacStartDate, draft.almanacEndDate);
  }

  if (draft.method === 'astrolabe') {
    const requiredFields = [
      draft.astrolabeYear,
      draft.astrolabeMonth,
      draft.astrolabeDay,
      draft.astrolabeHour,
      draft.astrolabeMinute,
      draft.astrolabeLatitude,
      draft.astrolabeLongitude,
      draft.astrolabeTimezone,
    ];
    if (requiredFields.some((value) => !value.trim())) {
      throw new Error('星盘需要填写出生时间、经纬度和时区');
    }
    validateAstrolabeDraft(draft);
  }
}

function readIntegerText(value: string, label: string) {
  const text = value.trim();
  if (!/^\d+$/.test(text)) {
    throw new Error(`${label}必须是整数`);
  }
  return Number(text);
}

function readOptionalPositiveIntegerText(value: string) {
  const text = value.trim();
  if (!/^\d+$/.test(text)) {
    return undefined;
  }
  const number = Number(text);
  return Number.isSafeInteger(number) && number > 0 ? number : undefined;
}

function readPositiveIntegerText(value: string, label: string) {
  const text = value.trim();
  if (!/^\d+$/.test(text)) {
    throw new Error(`${label}需要填写正整数`);
  }
  const number = Number(text);
  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new Error(`${label}需要填写正整数`);
  }
  return number;
}

function readNumberText(value: string, label: string) {
  const text = value.trim();
  if (!/^[-+]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) {
    throw new Error(`${label}必须是数字`);
  }
  const number = Number(text);
  if (!Number.isFinite(number)) {
    throw new Error(`${label}必须是数字`);
  }
  return number;
}

function assertNumberRange(value: number, label: string, min: number, max: number) {
  if (value < min) {
    throw new Error(`${label}不能小于 ${min}`);
  }
  if (value > max) {
    throw new Error(`${label}不能大于 ${max}`);
  }
}

function readDateText(value: string, fieldName: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`${fieldName} 需要使用 YYYY-MM-DD 格式`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || year > 2100) {
    throw new Error(`${fieldName} 年份需在 1900-2100 之间`);
  }
  if (month < 1 || month > 12) {
    throw new Error(`${fieldName} 不是有效日期`);
  }

  const maxDay = daysInSolarMonth(year, month);
  if (day < 1 || day > maxDay) {
    throw new Error(`${fieldName} 不是有效日期`);
  }

  return {
    date: new Date(Date.UTC(year, month - 1, day)),
  };
}

function isTimeBasedDivinationMethod(method: Exclude<DivinationMethodId, 'random'>) {
  if (method === 'liuyao' || method === 'qimen' || method === 'liuren') {
    return true;
  }

  if (method === 'meihua' || method === 'xiaoliuren') {
    return true;
  }

  return false;
}

function readCustomDivinationDate(draft: DivinationDraft): Date {
  const dateText = draft.customDivinationDate?.trim() || '';
  const timeText = draft.customDivinationTime?.trim() || '';

  if (!dateText || !timeText) {
    throw new Error('自定起卦时间需要填写日期和时间');
  }

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText);
  if (!dateMatch) {
    throw new Error('自定起卦日期需要使用 YYYY-MM-DD 格式');
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  if (year < 1900 || year > 2100) {
    throw new Error('自定起卦日期年份需在 1900-2100 之间');
  }
  if (month < 1 || month > 12) {
    throw new Error('自定起卦日期不是有效日期');
  }

  const maxDay = daysInSolarMonth(year, month);
  if (day < 1 || day > maxDay) {
    throw new Error('自定起卦日期不是有效日期');
  }

  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeText);
  if (!timeMatch) {
    throw new Error('自定起卦时间需要使用 HH:mm 格式');
  }

  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error('自定起卦时间不是有效时间');
  }

  const date = new Date(`${dateText}T${timeText}:00+08:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error('自定起卦时间不是有效时间');
  }

  return date;
}

function resolveCustomDivinationDate(
  method: Exclude<DivinationMethodId, 'random'>,
  draft: DivinationDraft,
): Date | undefined {
  if (draft.divinationTimeMode !== 'custom' || !isTimeBasedDivinationMethod(method)) {
    return undefined;
  }

  return readCustomDivinationDate(draft);
}

function validateDateRange(startDate: string, endDate: string) {
  const start = readDateText(startDate, 'startDate');
  const end = readDateText(endDate, 'endDate');
  const diffDays = Math.round((end.date.getTime() - start.date.getTime()) / 86400000);

  if (diffDays < 0) {
    throw new Error('endDate 不能早于 startDate');
  }
  if (diffDays > 30) {
    throw new Error('黄历择日一次最多比较 31 天，请缩小日期范围');
  }
}

function validateAstrolabeDraft(draft: DivinationDraft) {
  const year = readIntegerText(draft.astrolabeYear, '出生年份');
  const month = readIntegerText(draft.astrolabeMonth, '出生月份');
  const day = readIntegerText(draft.astrolabeDay, '出生日期');
  assertNumberRange(year, '出生年份', 1900, 2100);
  assertNumberRange(month, '出生月份', 1, 12);
  const maxDay = daysInSolarMonth(year, month);
  if (day < 1 || day > maxDay) {
    throw new Error(`日期需在 1-${maxDay} 之间`);
  }

  const hour = readIntegerText(draft.astrolabeHour, '出生小时');
  const minute = readIntegerText(draft.astrolabeMinute, '出生分钟');
  const latitude = readNumberText(draft.astrolabeLatitude, '出生地纬度');
  const longitude = readNumberText(draft.astrolabeLongitude, '出生地经度');
  const timezone = readNumberText(draft.astrolabeTimezone, '时区');
  assertNumberRange(hour, '出生小时', 0, 23);
  assertNumberRange(minute, '出生分钟', 0, 59);
  assertNumberRange(latitude, '出生地纬度', -90, 90);
  assertNumberRange(longitude, '出生地经度', -180, 180);
  assertNumberRange(timezone, '时区', -12, 14);
}

function buildAlmanacSessionTitle(data: AlmanacData) {
  return `黄历择日：${data.topicLabel}（${data.startDate} 至 ${data.endDate}）`;
}

function resolveMethod(method: DivinationMethodId): Exclude<DivinationMethodId, 'random'> {
  if (method !== 'random') {
    return method;
  }

  const index = Math.floor(Math.random() * CONCRETE_DIVINATION_METHODS.length);
  return CONCRETE_DIVINATION_METHODS[index];
}

export async function generateDivinationSession(
  draft: DivinationDraft,
): Promise<DivinationSession> {
  validateDraft(draft);
  const method = resolveMethod(draft.method);
  const customDate = resolveCustomDivinationDate(method, draft);
  const supplementaryInfo = buildSupplementaryInfo({
    ...draft,
    method,
  });
  const inputQuestion = draft.question.trim();

  let data: DivinationData;
  switch (method) {
    case 'liuyao': {
      const module = await import('mingyu-core/divination/liuyao');
      data = module.generateLiuyao(customDate);
      break;
    }
    case 'meihua': {
      const module = await import('mingyu-core/divination/meihua');
      data = module.generateMeihua(customDate, supplementaryInfo?.meihuaSettings);
      break;
    }
    case 'xiaoliuren': {
      const module = await import('mingyu-core/divination/xiaoliuren');
      data = module.generateXiaoliuren({
        method: draft.xiaoliurenMethod,
        customDate,
        ...(draft.xiaoliurenMethod === 'number' && draft.xiaoliurenNumber.trim()
          ? { number: readPositiveIntegerText(draft.xiaoliurenNumber, '小六壬数字起课') }
          : {}),
      });
      break;
    }
    case 'qimen': {
      const module = await import('mingyu-core/divination/qimen');
      data = module.generateQimen(customDate);
      break;
    }
    case 'liuren': {
      const module = await import('mingyu-core/divination/liuren');
      data = module.generateLiuren(customDate);
      break;
    }
    case 'tarot': {
      const module = await import('mingyu-core/divination/tarot');
      if (draft.tarotSpread === 'single') {
        const result = module.drawSingleCard();
        data = {
          spreadType: 'single',
          spreadName: '单牌指引',
          cards: [
            {
              id: result.card.number,
              name: result.card.name,
              position: result.position,
              reversed: result.isReversed,
              keywords: module.getCardKeywords(result.card.name).split(','),
            },
          ],
          timestamp: result.timestamp,
        };
      } else {
        const result = module.drawSpreadCards(draft.tarotSpread);
        data = {
          spreadType: draft.tarotSpread,
          spreadName: module.tarotSpreads[draft.tarotSpread].name,
          cards: result.cards.map((item) => ({
            id: item.card.number,
            name: item.card.name,
            position: item.position,
            reversed: item.isReversed,
            keywords: module.getCardKeywords(item.card.name).split(','),
          })),
          timestamp: result.timestamp,
        };
      }
      break;
    }
    case 'ssgw': {
      const module = await import('mingyu-core/divination/ssgw');
      data = module.drawRandomSign(customDate);
      break;
    }
    case 'almanac': {
      const module = await import('mingyu-core/divination/almanac');
      data = module.generateAlmanacSelection({
        topic: draft.almanacTopic,
        startDate: draft.almanacStartDate,
        endDate: draft.almanacEndDate,
        participants: draft.almanacParticipants,
      });
      break;
    }
    case 'lenormand': {
      const module = await import('mingyu-core/divination/lenormand');
      data = module.drawLenormandSpread(draft.lenormandSpread);
      break;
    }
    case 'astrolabe': {
      const module = await import('mingyu-core/divination/astrolabe');
      const input: AstrolabeBirthInput = {
        name: draft.astrolabeName,
        gender: draft.astrolabeGender,
        year: draft.astrolabeYear,
        month: draft.astrolabeMonth,
        day: draft.astrolabeDay,
        hour: draft.astrolabeHour,
        minute: draft.astrolabeMinute,
        latitude: draft.astrolabeLatitude,
        longitude: draft.astrolabeLongitude,
        timezone: draft.astrolabeTimezone,
      };
      data = module.generateAstrolabe(input);
      break;
    }
    default:
      throw new Error('暂不支持当前占卜方式');
  }

  const question =
    method === 'almanac' && !inputQuestion
      ? buildAlmanacSessionTitle(data as AlmanacData)
      : inputQuestion;
  const prompt = buildDivinationPrompt(method, question, data, supplementaryInfo, {
    isCustomQuestion: method === 'almanac' ? false : draft.questionSource === 'custom',
    liuyaoTemplate: draft.liuyaoTemplate,
    liurenTemplate: draft.liurenTemplate,
    meihuaFocus: draft.meihuaFocus,
    xiaoliurenFocus: draft.xiaoliurenFocus,
    qimenFocus: draft.qimenFocus,
    astrolabeTopic: draft.astrolabeTopic,
  });
  return {
    method,
    requestedMethod: draft.method,
    question,
    prompt,
    data,
  };
}

function buildDivinationFocusGuidanceText(
  method: Exclude<DivinationMethodId, 'random'>,
  meihuaFocus: NonNullable<DivinationDraft['meihuaFocus']>,
  xiaoliurenFocus: NonNullable<DivinationDraft['xiaoliurenFocus']>,
  qimenFocus: NonNullable<DivinationDraft['qimenFocus']>,
) {
  if (method === 'meihua') {
    switch (meihuaFocus) {
      case 'trend':
        return '先定体用强弱与当前主轴，再看互卦呈现过程变化，最后用变卦判断后续走势、转折点与顺势动作。';
      case 'relationship':
        return '重点判断双方关系当前是靠近、僵持还是疏离，再看主要阻力在自身、对方还是外部环境，最后落到短期互动趋势与沟通建议。';
      case 'decision':
        return '重点比较当前选择是否顺势、最容易忽略的风险在哪里，以及眼下更适合推进、观望还是调整路径。';
      default:
        return '';
    }
  }

  if (method === 'xiaoliuren') {
    switch (xiaoliurenFocus) {
      case 'emotion':
        return '先以结果宫位定关系走向，再回看起因、过程解释情绪和沟通卡点，最后给出主动、等待、缓和或止损建议。';
      case 'career':
        return '先看结果宫位定事情能否推进，再结合起因与过程判断阻力、节奏、是否宜动，以及下一步更稳的动作。';
      case 'wealth':
        return '重点判断见财可能、破财风险、投入节奏，以及当下更适合先守、先看还是先动。';
      case 'social':
        return '重点判断对方态度、沟通风险、是否适合请托协作，以及关系后续更容易缓和还是生变。';
      case 'trend':
        return '重点判断整体走势、反复点、关键卡点，以及当下先等、先动还是先调整更顺。';
      default:
        return '';
    }
  }

  if (method === 'qimen') {
    switch (qimenFocus) {
      case 'timing':
        return '先看值符值使与用门落宫判断当前时机，再结合空亡、马星和门星神干判断宜动宜守与更合适的时间窗口。';
      case 'strategy':
        return '重点看用门、关键宫位和门星神干组合，判断该怎么布局、借势、绕阻，以及优先做哪一步成功率更高。';
      case 'competition':
        return '重点看己方与对方对应宫位的强弱、生克和门星神干状态，判断谁更占上风、风险点在哪，以及该主动还是后手应对。';
      default:
        return '';
    }
  }

  return '';
}

function buildDivinationFocusTaskText(
  method: Exclude<DivinationMethodId, 'random'>,
  meihuaFocus: NonNullable<DivinationDraft['meihuaFocus']>,
  xiaoliurenFocus: NonNullable<DivinationDraft['xiaoliurenFocus']>,
  qimenFocus: NonNullable<DivinationDraft['qimenFocus']>,
) {
  if (method === 'meihua') {
    switch (meihuaFocus) {
      case 'trend':
        return '请围绕体用关系、互卦过程、变卦结果和四时旺衰，判断事情走势、转折点与顺势动作，直接回答问题。';
      case 'relationship':
        return '请围绕体用关系、互卦过程、变卦结果和四时旺衰，判断关系状态、阻力来源、短期互动趋势与沟通建议，直接回答问题。';
      case 'decision':
        return '请围绕体用关系、互卦过程、变卦结果和四时旺衰，判断当前选择是否顺势、风险点在哪、下一步更适合怎么走，直接回答问题。';
      default:
        return buildTaskText(method);
    }
  }

  if (method === 'xiaoliuren') {
    switch (xiaoliurenFocus) {
      case 'emotion':
        return '请围绕起因、过程、结果三段宫位变化，判断关系走向、沟通卡点与该主动、缓和还是止损，直接回答问题。';
      case 'career':
        return '请围绕起因、过程、结果三段宫位变化，判断事情能否推进、节奏是否顺、阻力在哪，以及下一步更稳的动作，直接回答问题。';
      case 'wealth':
        return '请围绕起因、过程、结果三段宫位变化，判断见财机会、破财风险、投入节奏与先守先动的取舍，直接回答问题。';
      case 'social':
        return '请围绕起因、过程、结果三段宫位变化，判断对方态度、沟通风险、是否适合请托协作，以及关系后续变化，直接回答问题。';
      case 'trend':
        return '请围绕起因、过程、结果三段宫位变化，判断整体走势、关键卡点与当前先等还是先动更顺，直接回答问题。';
      default:
        return buildTaskText(method);
    }
  }

  if (method === 'qimen') {
    switch (qimenFocus) {
      case 'timing':
        return '请围绕值符值使、用门落宫、门星神干组合、空亡与马星变化，判断当前时机、宜动宜守与更合适的时间窗口，直接回答问题。';
      case 'strategy':
        return '请围绕值符值使、用门落宫、门星神干组合、格局强弱与可用宫位，判断布局路径、借势方向、优先动作和绕开阻力的方法，直接回答问题。';
      case 'competition':
        return '请围绕值符值使、己方与对方对应宫位、门星神干生克与格局强弱，判断双方态势、胜算、风险与先手策略，直接回答问题。';
      default:
        return buildTaskText(method);
    }
  }

  return buildTaskText(method);
}

function buildDivinationFocusRequirementText(
  method: Exclude<DivinationMethodId, 'random'>,
  meihuaFocus: NonNullable<DivinationDraft['meihuaFocus']>,
  xiaoliurenFocus: NonNullable<DivinationDraft['xiaoliurenFocus']>,
  qimenFocus: NonNullable<DivinationDraft['qimenFocus']>,
) {
  if (method === 'meihua') {
    switch (meihuaFocus) {
      case 'relationship':
        return '- 不要把关系题泛讲成性格题，必须交代关系现状、阻力位置和短期互动变化。';
      case 'decision':
        return '- 不要只说吉凶，要明确当前选择更顺的方向、风险点和行动顺序。';
      default:
        return '';
    }
  }

  if (method === 'xiaoliuren') {
    switch (xiaoliurenFocus) {
      case 'emotion':
        return '- 不要只给感情吉凶词，必须落到关系走向、沟通卡点和现实动作。';
      case 'wealth':
        return '- 不要空泛说财运好坏，必须区分见财机会、破财风险和投入节奏。';
      default:
        return '';
    }
  }

  if (method === 'qimen') {
    switch (qimenFocus) {
      case 'timing':
        return '- 不要把时机题写成泛化趋势题，必须明确现在宜动、宜守还是宜等。';
      case 'strategy':
        return '- 不要只列格局名词，必须交代该借什么势、先做什么、避开什么。';
      case 'competition':
        return '- 不要只说谁强谁弱，必须交代胜负关键点和应对顺序。';
      default:
        return '';
    }
  }

  return '';
}

function buildDivinationFocusOutputRequirementText(
  method: Exclude<DivinationMethodId, 'random'>,
  meihuaFocus: NonNullable<DivinationDraft['meihuaFocus']>,
  xiaoliurenFocus: NonNullable<DivinationDraft['xiaoliurenFocus']>,
  qimenFocus: NonNullable<DivinationDraft['qimenFocus']>,
) {
  if (method === 'meihua') {
    switch (meihuaFocus) {
      case 'trend':
        return '要明确写出当前走势、关键转折点和最顺势的一步。';
      case 'relationship':
        return '要明确写出关系现状、主要阻力、短期互动趋势和沟通建议。';
      case 'decision':
        return '要明确写出哪个方向更顺、最大风险点在哪里，以及下一步先做什么。';
      default:
        return '';
    }
  }

  if (method === 'xiaoliuren') {
    switch (xiaoliurenFocus) {
      case 'emotion':
        return '要明确写出关系走向、沟通风险，以及现在更适合主动、缓和、等待还是止损。';
      case 'career':
        return '要明确写出事情能否推进、哪里最卡，以及现在更适合推进、观察还是调整。';
      case 'wealth':
        return '要明确写出钱的机会点、风险点，以及现在更适合先守还是先动。';
      case 'social':
        return '要明确写出对方态度、沟通风险，以及是否适合请托协作。';
      case 'trend':
        return '要明确写出整体走势、关键卡点，以及现在先等还是先动更顺。';
      default:
        return '';
    }
  }

  if (method === 'qimen') {
    switch (qimenFocus) {
      case 'timing':
        return '要明确写出现在是否宜动、宜守或宜等，以及对应的时机依据。';
      case 'strategy':
        return '要明确写出最值得先做的一步、可借的势与需要绕开的阻力。';
      case 'competition':
        return '要明确写出双方态势、胜负关键点，以及该主动出击还是后手应对。';
      default:
        return '';
    }
  }

  return '';
}
