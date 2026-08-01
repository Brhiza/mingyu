import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { baziCalculator } from '@core/bazi/baziCalculator';
import { TIME_MAP } from '@core/bazi/baziDisplayData';
import { calculateTrueSolarTime } from '@core/bazi/trueSolarTime';
import { getTimeIndexFromClock } from 'mingyu-core/calendar';
import { assertPromptHasSingleRole, assertPromptIsPortableTaskText } from '../prompt-assertions';
import { PROMPT_GUIDANCE_TEXT as PROMPT_ROLE_TEXT } from '../../src/lib/prompt-guidance';

const AUTOMATIC_DIRECTION_CONCLUSION =
  /四吉方[:：]|四凶方[:：]|(?:吉方|凶方)[:：]|较利方位[:：]|命宅相合|命宅相冲|(?:建议)?优先利用|(?:布置|布局|行动)建议[:：]/;
const AUTOMATIC_ZODIAC_CONCLUSION =
  /有利关系[:：]|风险关系[:：]|行动信号[:：]|六合贵人|三合贵人|重大变动前|重要决定多做|合同、规则和沟通内容尽量留痕|优先看对方/;

function assertEvidenceOwnerReferences(evidence: unknown) {
  const data = evidence as {
    summaryFact?: { key?: string; factKeys?: string[] };
    relationSummaryFact?: { key?: string; factKeys?: string[] };
    counterEvidenceFacts?: Array<{ key?: string; ownerFactKeys?: string[] }>;
    limitationFacts?: Array<{ ownerFactKeys?: string[] }>;
  };
  const summary = data.summaryFact ?? data.relationSummaryFact;
  assert.ok(summary?.key);
  assert.ok(summary.factKeys?.length);
  const factKeys = new Set([
    summary.key,
    ...(summary.factKeys ?? []),
    ...(data.counterEvidenceFacts ?? []).flatMap((item) => (item.key ? [item.key] : [])),
  ]);
  assert.ok(
    (data.counterEvidenceFacts ?? []).every(
      (item) =>
        (item.ownerFactKeys?.length ?? 0) > 0 &&
        item.ownerFactKeys?.every((key) => factKeys.has(key)),
    ),
  );
  assert.ok(
    (data.limitationFacts ?? []).every(
      (item) =>
        (item.ownerFactKeys?.length ?? 0) > 0 &&
        item.ownerFactKeys?.every((key) => factKeys.has(key)),
    ),
  );
}

function assertUsefulGodDecisionOutput(usefulGod: unknown) {
  const data = usefulGod as {
    strategyTrace?: string[];
    matchedRules?: Array<Record<string, unknown>>;
    favorable?: string[];
    unfavorable?: string[];
    favorableWuxing?: string[];
    unfavorableWuxing?: string[];
    primaryFavorableWuxing?: string;
    primaryUnfavorableWuxing?: string;
    useful?: string;
    avoid?: string;
    primaryReason?: string;
  };
  const realWorldOutcomePattern =
    /富贵|贫贱|贫寒|贫苦|孤贫|孤苦|科甲|功名|鼎甲|金榜|衣锦|衣禄|显达|发达|荣华|恩荣|廪贡|生员|秀才|仕途|官位|禄位|夭折|寿夭|遭凶|僧道|常人|平人|下流|下品|愚顽|愚懦|奸诈|仁义|劳碌|奔波|漂泊|安乐|聪明|艺术|才略|名臣|一生|荣显|成名|题名|云程|雁塔|衣食|千金|虚名|虚利|名利|显贵|清贵|浊富|略富|家富|困顿|发福|减贵|定主|必主|多主|可期|堪图|可许|极品|之人|之士|之客|之流/;

  assert.deepEqual(data.strategyTrace, [
    '自动用神规则尚未完成逐条来源、版本与适用边界校勘，底层保留待定',
  ]);
  assert.doesNotMatch(data.strategyTrace?.join('\n') || '', realWorldOutcomePattern);
  assert.equal(data.primaryReason, '取用待定');
  assert.deepEqual(data.matchedRules, []);
  assert.deepEqual(data.favorable, []);
  assert.deepEqual(data.unfavorable, []);
  assert.deepEqual(data.favorableWuxing, []);
  assert.deepEqual(data.unfavorableWuxing, []);
  assert.equal(data.primaryFavorableWuxing, '');
  assert.equal(data.primaryUnfavorableWuxing, '');
  assert.equal(data.useful, '');
  assert.equal(data.avoid, '');
}

const toolCalls: Array<[string, Record<string, unknown>]> = [
  ['foundation_capabilities', {}],
  ['foundation_ganzhi', { ganZhi: '甲子' }],
  ['foundation_wuxing', { items: ['甲', '子', '丙', '午'], weightHidden: true }],
  ['foundation_direction', { degree: 180 }],
  [
    'foundation_shensha',
    {
      yearGanZhi: '甲子',
      monthGanZhi: '丙寅',
      dayGanZhi: '戊辰',
      hourGanZhi: '丁酉',
    },
  ],
  [
    'calendar_true_solar_time',
    { localDateTime: '1990-05-15T10:30:00', longitude: 116.4074, timezone: 8 },
  ],
  [
    'calendar_true_solar_birth',
    {
      dateType: 'solar',
      year: 1990,
      month: 5,
      day: 15,
      hour: 10,
      minute: 30,
      longitude: 116.4074,
      timezone: 8,
    },
  ],
  [
    'calendar_solar_illumination',
    {
      year: 2024,
      month: 6,
      day: 21,
      hour: 12,
      latitude: 39.9042,
      longitude: 116.4074,
      timezone: 8,
    },
  ],
  ['calendar_astronomical_time', { year: 2000, month: 1, day: 1, hour: 12, timezone: 0 }],
  ['calendar_moon_phase', { utcDateTime: '2024-06-21T12:00:00Z' }],
  ['calendar_solar_term', { year: 2024, index: 12 }],
  ['divine_qimen', {}],
  [
    'divine_almanac',
    {
      topic: 'move',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      participants: [
        {
          id: 'self',
          name: '本人',
          gender: '男',
          year: 1990,
          month: 1,
          day: 1,
          timeIndex: 12,
          dateType: 'solar',
        },
      ],
    },
  ],
  [
    'bazi_calculate',
    { gender: 'male', year: 1990, month: 5, day: 15, timeIndex: 1, dateType: 'solar' },
  ],
  [
    'bazi_compatibility',
    {
      person1: {
        name: '甲方',
        gender: 'female',
        year: 1988,
        month: 1,
        day: 1,
        timeIndex: 0,
        dateType: 'solar',
      },
      person2: {
        name: '乙方',
        gender: 'male',
        year: 1990,
        month: 6,
        day: 15,
        timeIndex: 5,
        dateType: 'solar',
      },
    },
  ],
  [
    'ziwei_compatibility',
    {
      person1: {
        name: '甲方',
        gender: 'female',
        dateType: 'solar',
        year: '1992',
        month: '8',
        day: '21',
        timeIndex: 4,
      },
      person2: {
        name: '乙方',
        gender: 'male',
        dateType: 'solar',
        year: '1990',
        month: '5',
        day: '15',
        timeIndex: 1,
      },
    },
  ],
  ['metaphysics_bazhai', { birthYear: 1990, gender: 'male', doorToInteriorDegree: 0 }],
  [
    'metaphysics_residential',
    { birthYear: 1990, gender: 'male', year: 2024, doorToInteriorDegree: 0 },
  ],
  ['metaphysics_xuankong', { year: 2024, facingDegree: 0 }],
  ['metaphysics_zodiac', { zodiac: '鼠', year: 2024 }],
  ['metaphysics_taiyi', { year: 2004, scope: 'year' }],
  [
    'astrolabe_synastry',
    {
      person1: {
        name: '甲',
        gender: '女',
        year: 1995,
        month: 5,
        day: 20,
        hour: 12,
        minute: 30,
        latitude: 39.9042,
        longitude: 116.4074,
        timezone: 8,
      },
      person2: {
        name: '乙',
        gender: '男',
        year: 1992,
        month: 8,
        day: 21,
        hour: 8,
        minute: 15,
        latitude: 31.2304,
        longitude: 121.4737,
        timezone: 8,
      },
    },
  ],
];

const promptToolCalls: Array<[string, Record<string, unknown>, RegExp]> = [
  [
    'bazi_compatibility_prompt',
    {
      person1: {
        name: '甲方',
        gender: 'female',
        year: 1988,
        month: 1,
        day: 1,
        timeIndex: 0,
        dateType: 'solar',
      },
      person2: {
        name: '乙方',
        gender: 'male',
        year: 1990,
        month: 6,
        day: 15,
        timeIndex: 5,
        dateType: 'solar',
      },
      question: '请分析双方长期合作关系。',
      compatType: 'career',
    },
    /【双盘关系资料】/,
  ],
  [
    'bazi_prompt',
    {
      gender: 'male',
      year: 1990,
      month: 5,
      day: 15,
      timeIndex: 1,
      dateType: 'solar',
      question: '我适合创业还是上班？',
      promptTopic: 'career',
    },
    /【排盘信息】[\s\S]*【核心判断依据】[\s\S]*【四柱】/,
  ],
  [
    'ziwei_prompt',
    {
      gender: 'female',
      dateType: 'solar',
      year: '1992',
      month: '8',
      day: '21',
      timeIndex: 4,
      question: '我的感情关系要注意什么？',
      promptTopic: 'relationship',
      promptScope: 'origin',
    },
    /【问题】/,
  ],
  [
    'ziwei_compatibility_prompt',
    {
      person1: {
        name: '甲方',
        gender: 'female',
        dateType: 'solar',
        year: '1992',
        month: '8',
        day: '21',
        timeIndex: 4,
      },
      person2: {
        name: '乙方',
        gender: 'male',
        dateType: 'solar',
        year: '1990',
        month: '5',
        day: '15',
        timeIndex: 1,
      },
      question: '双方长期合作关系应注意什么？',
      promptTopic: 'career-wealth',
    },
    /【双盘关系资料】/,
  ],
  [
    'bazi_ziwei_prompt',
    {
      gender: 'female',
      dateType: 'solar',
      year: 1992,
      month: 8,
      day: 21,
      timeIndex: 4,
      question: '我现在适合换工作还是继续等待？',
      baziPromptTopic: 'job-change',
      ziweiPromptTopic: 'job-change',
      promptScope: 'yearly',
    },
    /【八字排盘信息】/,
  ],
  [
    'liuyao_prompt',
    { customDate: '2025-01-01T08:00:00+08:00', question: '今年事业如何？' },
    /【占卜信息】/,
  ],
  [
    'xiaoliuren_prompt',
    { customDate: '2025-01-01T08:00:00+08:00', question: '这件事接下来如何推进？' },
    /顺数轨迹：[\s\S]*占得宫：小吉[\s\S]*【问题】\n这件事接下来如何推进？[\s\S]*不得自行补造[\s\S]*固定应期/,
  ],
  [
    'qimen_prompt',
    { customDate: '2025-01-01T06:00:00+08:00', question: '这件事何时出现转机？' },
    /占法：奇门遁甲[\s\S]*值符值使与时干：[\s\S]*【问题】\n这件事何时出现转机？/,
  ],
  [
    'bazhai_prompt',
    {
      birthYear: 1990,
      gender: 'male',
      doorToInteriorDegree: 64,
      northReference: 'magnetic',
      magneticDeclinationDegrees: 1,
      measurementUncertaintyDegrees: 3,
      question: '办公桌朝向怎么选？',
    },
    /【八宅风水排盘】[\s\S]*命卦：[\s\S]*命卦八宫传统标签：[\s\S]*【问题】\n办公桌朝向怎么选？/,
  ],
  [
    'residential_prompt',
    {
      birthYear: 1990,
      gender: 'male',
      year: 2024,
      doorToInteriorDegree: 0,
      question: '这套房怎么看？',
    },
    /【住宅风水排盘】[\s\S]*资料与复核提示：[\s\S]*【问题】\n这套房怎么看？/,
  ],
  [
    'xuankong_prompt',
    {
      year: 2024,
      facingDegree: 0,
      question: '这套宅的飞星怎么看？',
    },
    /【玄空飞星排盘】[\s\S]*【问题】\n这套宅的飞星怎么看？/,
  ],
  [
    'zodiac_prompt',
    { zodiac: '马', yearGanZhi: '庚子', question: '今年应注意什么？' },
    /【生肖与流年关系简析】[\s\S]*马（午）遇庚子年[\s\S]*【问题】\n今年应注意什么？/,
  ],
];

const promptToolNames = [
  'bazi_prompt',
  'bazi_compatibility_prompt',
  'ziwei_prompt',
  'ziwei_compatibility_prompt',
  'bazi_ziwei_prompt',
  'liuyao_prompt',
  'meihua_prompt',
  'xiaoliuren_prompt',
  'jinkoujue_prompt',
  'qimen_prompt',
  'liuren_prompt',
  'tarot_prompt',
  'ssgw_prompt',
  'almanac_prompt',
  'lenormand_prompt',
  'astrolabe_prompt',
  'astrolabe_synastry_prompt',
  'bazhai_prompt',
  'residential_prompt',
  'zodiac_prompt',
  'taiyi_prompt',
];

async function withMcpClient<T>(callback: (client: Client) => Promise<T>) {
  const client = new Client({ name: 'mcp-structured-output-test', version: '0.0.1' });
  const transport = new StdioClientTransport({
    command: 'npm',
    args: ['run', 'mcp'],
    cwd: process.cwd(),
    stderr: 'pipe',
  });

  await client.connect(transport);

  try {
    return await callback(client);
  } finally {
    await client.close();
  }
}

test('MCP 工具列表应声明输出结构', async () => {
  await withMcpClient(async (client) => {
    const { tools } = await client.listTools();

    assert.equal(tools.length, 56);
    tools.forEach((tool) => {
      assert.equal(tool.outputSchema?.type, 'object', `${tool.name} 缺少 outputSchema`);
    });

    const ziweiTool = tools.find((tool) => tool.name === 'ziwei_calculate');
    assert.ok(ziweiTool?.outputSchema?.properties?.payloadByScope);
    assert.ok(tools.find((tool) => tool.name === 'ziwei_compatibility'));
    assert.ok(tools.find((tool) => tool.name === 'ziwei_compatibility_prompt'));
    assert.equal(
      tools.find((tool) => tool.name === 'bazi_time_sensitivity'),
      undefined,
    );
    assert.ok(tools.find((tool) => tool.name === 'calendar_solar_illumination'));
    assert.ok(tools.find((tool) => tool.name === 'calendar_astronomical_time'));
    assert.ok(tools.find((tool) => tool.name === 'calendar_moon_phase'));
    assert.ok(tools.find((tool) => tool.name === 'calendar_solar_term'));
    assert.ok(tools.find((tool) => tool.name === 'foundation_direction'));
    assert.ok(tools.find((tool) => tool.name === 'foundation_shensha'));
    assert.ok(tools.find((tool) => tool.name === 'divine_jinkoujue'));
    assert.ok(tools.find((tool) => tool.name === 'jinkoujue_prompt'));
    assert.ok(tools.find((tool) => tool.name === 'metaphysics_residential'));
    assert.ok(tools.find((tool) => tool.name === 'residential_prompt'));
    assert.ok(tools.find((tool) => tool.name === 'metaphysics_xuankong'));
    assert.ok(tools.find((tool) => tool.name === 'xuankong_prompt'));

    assert.equal(
      tools.some((tool) => tool.name === 'build_divination_prompt'),
      false,
    );
    for (const name of promptToolNames) {
      assert.ok(tools.find((tool) => tool.name === name)?.outputSchema?.properties?.result);
      assert.ok(tools.find((tool) => tool.name === name)?.outputSchema?.properties?.prompt);
    }
  });
});

test('通用神煞 MCP 输入应拒绝重复编号', async () => {
  await withMcpClient(async (client) => {
    const result = await client.callTool({
      name: 'foundation_shensha',
      arguments: {
        yearGanZhi: '甲子',
        monthGanZhi: '丙寅',
        dayGanZhi: '戊辰',
        hourGanZhi: '丁酉',
        ids: ['yima', 'yima'],
      },
    });

    assert.equal(result.isError, true);
  });
});

test('MCP 工具调用应同时返回 structuredContent 和文本 JSON', async () => {
  await withMcpClient(async (client) => {
    for (const [name, args] of toolCalls) {
      const result = await client.callTool({ name, arguments: args });
      assert.equal(result.isError, undefined, `${name} 不应返回错误`);
      assert.ok(result.structuredContent, `${name} 缺少 structuredContent`);
      assert.equal(result.content[0]?.type, 'text', `${name} 缺少文本兼容输出`);
      assert.equal(
        'prompt' in result.structuredContent,
        false,
        `${name} 不应通过旧排盘工具返回提示词`,
      );
      if (name === 'foundation_capabilities') {
        const capabilities = result.structuredContent.result as {
          key: string;
          status: string;
          capabilityFacts: Array<{
            key: string;
            status: string;
            provides: string[];
            sources: string[];
          }>;
          summaryFact: {
            moduleFactCount: number;
            evidenceReadyModuleCount: number;
            catalogOnlyModuleCount: number;
            commonShenshaCount: number;
          };
          limitationFacts: Array<{ ownerFactKeys: string[] }>;
          commonShensha: unknown[];
          promptText: string;
        };
        assert.equal(capabilities.key, 'foundation:capabilities');
        assert.equal(capabilities.status, '已登记');
        assert.equal(capabilities.capabilityFacts.length, 5);
        assert.equal(capabilities.summaryFact.moduleFactCount, capabilities.capabilityFacts.length);
        assert.equal(capabilities.summaryFact.evidenceReadyModuleCount, 5);
        assert.equal(capabilities.summaryFact.catalogOnlyModuleCount, 0);
        assert.equal(
          capabilities.summaryFact.commonShenshaCount,
          capabilities.commonShensha.length,
        );
        assert.ok(
          capabilities.capabilityFacts.every(
            (fact) => fact.key.startsWith('foundation:capability:') && fact.provides.length > 0,
          ),
        );
        assert.ok(capabilities.limitationFacts.every((fact) => fact.ownerFactKeys.length > 0));
        assert.match(capabilities.promptText, /能力目录证据汇总：目录完整/);
        assertPromptIsPortableTaskText(capabilities.promptText);
      }
      if (name === 'foundation_ganzhi') {
        const profile = result.structuredContent.result as {
          key: string;
          status: string;
          calculationSteps: Array<{ promptText: string }>;
          calculationChain: string[];
          sourceFacts: Array<{ ownerStepKeys: string[] }>;
          summaryFact: { sourceFactCount: number; limitationFactCount: number };
          limitationFacts: unknown[];
          promptText: string;
        };
        assert.equal(profile.key, 'foundation:ganzhi:甲子');
        assert.equal(profile.status, '已查询');
        assert.equal(profile.calculationSteps.length, 5);
        assert.deepEqual(
          profile.calculationChain,
          profile.calculationSteps.map((item) => item.promptText),
        );
        assert.equal(profile.summaryFact.sourceFactCount, profile.sourceFacts.length);
        assert.equal(profile.summaryFact.limitationFactCount, profile.limitationFacts.length);
        assert.ok(profile.sourceFacts.every((fact) => fact.ownerStepKeys.length > 0));
        assert.match(profile.promptText, /固定资料查询/);
      }
      if (name === 'foundation_wuxing') {
        const analysis = result.structuredContent.result as {
          key: string;
          status: string;
          calculationSteps: Array<{ promptText: string }>;
          calculationChain: string[];
          itemFacts: Array<{
            item: string;
            primaryContribution: number;
            hiddenContributions: Array<{ stem: string; wuxing: string; weight: number }>;
          }>;
          counts: Record<string, number>;
          dominantElements: string[];
          weakestElements: string[];
          summaryFact: { itemFactCount: number; limitationFactCount: number };
          limitationFacts: unknown[];
          promptText: string;
        };
        assert.equal(analysis.key, 'foundation:wuxing:with-hidden:甲-子-丙-午');
        assert.equal(analysis.status, '已统计');
        assert.equal(analysis.calculationSteps.length, 4);
        assert.deepEqual(
          analysis.calculationChain,
          analysis.calculationSteps.map((item) => item.promptText),
        );
        assert.equal(analysis.itemFacts.length, 4);
        assert.deepEqual(analysis.itemFacts[1]?.hiddenContributions, [
          { stem: '癸', wuxing: '水', weight: 1, rank: '本气' },
        ]);
        assert.equal(analysis.itemFacts[1]?.primaryContribution, 0);
        assert.deepEqual(analysis.counts, { 木: 1, 火: 2, 土: 1, 金: 0, 水: 1 });
        assert.deepEqual(analysis.dominantElements, ['火']);
        assert.deepEqual(analysis.weakestElements, ['金']);
        assert.equal(analysis.summaryFact.itemFactCount, analysis.itemFacts.length);
        assert.equal(analysis.summaryFact.limitationFactCount, analysis.limitationFacts.length);
        assert.match(analysis.promptText, /不是命理吉凶评分/);
        assert.doesNotMatch(analysis.promptText, /0\.5|0\.3|本气1、中气|加权汇总/);
      }
      if (name === 'foundation_direction') {
        const direction = result.structuredContent.result as {
          key: string;
          status: string;
          label: string;
          facingBagua: string;
          sitBagua: string;
          calculationSteps: Array<{ promptText: string }>;
          calculationChain: string[];
          directionFacts: unknown[];
          summaryFact: {
            status: string;
            directionFactCount: number;
            limitationFactCount: number;
          };
          limitationFacts: unknown[];
          promptText: string;
        };
        assert.equal(direction.key, 'foundation:direction:180');
        assert.equal(direction.status, '已换算');
        assert.equal(direction.label, '子山午向');
        assert.equal(direction.facingBagua, '离');
        assert.equal(direction.sitBagua, '坎');
        assert.equal(direction.calculationSteps.length, 4);
        assert.deepEqual(
          direction.calculationChain,
          direction.calculationSteps.map((item) => item.promptText),
        );
        assert.equal(direction.summaryFact.status, '映射稳定');
        assert.equal(direction.summaryFact.directionFactCount, direction.directionFacts.length);
        assert.equal(direction.summaryFact.limitationFactCount, direction.limitationFacts.length);
        assert.match(direction.promptText, /不自动推断或补造磁偏角/);
      }
      if (name === 'foundation_shensha') {
        const analysis = result.structuredContent.result as {
          key: string;
          status: string;
          pillarFacts: unknown[];
          calculationSteps: Array<{ promptText: string }>;
          calculationChain: string[];
          matchFacts: Array<{
            id: string;
            status: string;
            evidenceStatus: string;
            matchedPillars: Array<{ label: string }>;
          }>;
          summaryFact: {
            status: string;
            matchedRuleCount: number;
            matchFactCount: number;
            limitationFactCount: number;
          };
          limitationFacts: unknown[];
          promptText: string;
        };
        assert.match(analysis.key, /^foundation:shensha:/);
        assert.equal(analysis.status, '已核验');
        assert.equal(analysis.pillarFacts.length, 4);
        assert.equal(analysis.calculationSteps.length, 8);
        assert.deepEqual(
          analysis.calculationChain,
          analysis.calculationSteps.map((item) => item.promptText),
        );
        assert.equal(analysis.summaryFact.status, '证据链完整');
        assert.equal(analysis.summaryFact.matchedRuleCount, 2);
        assert.equal(analysis.summaryFact.matchFactCount, analysis.matchFacts.length);
        assert.equal(analysis.summaryFact.limitationFactCount, analysis.limitationFacts.length);
        assert.deepEqual(analysis.matchFacts.find((item) => item.id === 'yima')?.matchedPillars, [
          { pillar: 'monthGanZhi', label: '月柱', ganZhi: '丙寅', branch: '寅' },
        ]);
        assert.ok(analysis.matchFacts.every((item) => item.evidenceStatus === '来源已声明'));
        assert.match(analysis.promptText, /不得凭单项神煞定吉凶/);
        assertPromptIsPortableTaskText(analysis.promptText);
      }
      if (name === 'calendar_astronomical_time') {
        const evidence = result.structuredContent.result as {
          julianDayUtc: number;
          calculationSteps: Array<{ promptText: string }>;
          calculationChain: string[];
          summaryFact: { calculationStepCount: number };
          counterEvidenceFacts: unknown[];
          limitationFacts: unknown[];
          promptText: string;
        };
        assert.equal(evidence.julianDayUtc, 2451545);
        assert.equal(evidence.calculationSteps.length, 5);
        assert.deepEqual(
          evidence.calculationChain,
          evidence.calculationSteps.map((item) => item.promptText),
        );
        assert.equal(evidence.summaryFact.calculationStepCount, evidence.calculationSteps.length);
        assert.equal(evidence.counterEvidenceFacts.length, 2);
        assert.equal(evidence.limitationFacts.length, 2);
        assert.match(evidence.promptText, /UT1≈UTC/);
      }
      if (name === 'calendar_moon_phase') {
        const evidence = result.structuredContent.result as {
          status: string;
          calculationSteps: unknown[];
          summaryFact: { principalEventCount: number; limitationFactCount: number };
          limitationFacts: unknown[];
          previousPrincipalPhase: { utcDateTime: string };
          nextPrincipalPhase: { utcDateTime: string };
          promptText: string;
        };
        assert.equal(evidence.status, '已计算');
        assert.equal(evidence.calculationSteps.length, 4);
        assert.equal(evidence.summaryFact.principalEventCount, 2);
        assert.equal(evidence.summaryFact.limitationFactCount, evidence.limitationFacts.length);
        assert.ok(evidence.previousPrincipalPhase.utcDateTime);
        assert.ok(evidence.nextPrincipalPhase.utcDateTime);
        assert.match(evidence.promptText, /前一四正相位/);
      }
      if (name === 'calendar_solar_term') {
        const evidence = result.structuredContent.result as {
          name: string;
          targetLongitudeDegrees: number;
          calculationSteps: unknown[];
          verificationFact: { status: string };
          summaryFact: { verificationFactCount: number; limitationFactCount: number };
          limitationFacts: unknown[];
          promptText: string;
        };
        assert.equal(evidence.name, '夏至');
        assert.equal(evidence.targetLongitudeDegrees, 90);
        assert.equal(evidence.calculationSteps.length, 4);
        assert.equal(evidence.verificationFact.status, '已记录差值');
        assert.equal(evidence.summaryFact.verificationFactCount, 1);
        assert.equal(evidence.summaryFact.limitationFactCount, evidence.limitationFacts.length);
        assert.match(evidence.promptText, /独立模型求根/);
      }
      if (name === 'bazi_calculate') {
        const chart = result.structuredContent as {
          result?: {
            generation?: {
              input: {
                year: number;
                month: number;
                day: number;
                timeIndex: number;
                gender: string;
                shenShaVariants: { kongWangBasis: string; yangRenMode: string };
              };
              timestamp: number;
            };
            seasonInfo?: {
              previousTermEvidence?: {
                calculationSteps: unknown[];
                calculationChain: string[];
                limitationFacts: unknown[];
                summaryFact: {
                  verificationFactCount: number;
                  limitationFactCount: number;
                };
              };
            };
            evidenceAnalysis?: {
              key?: string;
              status?: string;
              calculationSteps?: Array<{ key: string }>;
              pillarFacts?: Array<{ key?: string; calculationStepKeys?: string[] }>;
              analysisFacts?: Array<{ key?: string; calculationStepKeys?: string[] }>;
              relationFacts?: Array<{ key?: string; calculationStepKeys?: string[] }>;
              counterEvidenceFacts?: Array<{ key?: string; ownerFactKeys?: string[] }>;
              summaryFact?: {
                key?: string;
                factKeys?: string[];
                pillarFactCount?: number;
                analysisFactCount?: number;
              };
              limitationFacts?: Array<{ ownerFactKeys?: string[] }>;
            };
            analysis?: { usefulGod?: unknown };
          };
        };
        const analysis = chart.result?.evidenceAnalysis;
        const previousTermEvidence = chart.result?.seasonInfo?.previousTermEvidence;
        const stepKeys = new Set(analysis?.calculationSteps?.map((item) => item.key));
        assert.equal(chart.result?.generation?.input.year, 1990);
        assert.equal(chart.result?.generation?.input.gender, 'male');
        assert.equal(chart.result?.generation?.input.shenShaVariants.kongWangBasis, 'day');
        assert.ok(Number.isSafeInteger(chart.result?.generation?.timestamp));
        assert.equal(
          previousTermEvidence?.calculationChain.length,
          previousTermEvidence?.calculationSteps.length,
        );
        assert.equal(previousTermEvidence?.summaryFact.verificationFactCount, 1);
        assert.equal(
          previousTermEvidence?.summaryFact.limitationFactCount,
          previousTermEvidence?.limitationFacts.length,
        );
        assert.equal(analysis?.key, 'bazi:natal:evidence');
        assert.equal(analysis?.calculationSteps?.length, 5);
        assertUsefulGodDecisionOutput(chart.result?.analysis?.usefulGod);
        assert.equal(analysis?.pillarFacts?.length, 4);
        assert.equal(analysis?.analysisFacts?.length, 3);
        assert.equal(analysis?.summaryFact?.pillarFactCount, analysis?.pillarFacts?.length);
        assert.equal(analysis?.summaryFact?.analysisFactCount, analysis?.analysisFacts?.length);
        assert.ok(
          [
            ...(analysis?.pillarFacts ?? []),
            ...(analysis?.analysisFacts ?? []),
            ...(analysis?.relationFacts ?? []),
          ].every((item) => item.calculationStepKeys?.every((key) => stepKeys.has(key))),
        );
        assertEvidenceOwnerReferences(analysis);
      }
      if (name === 'ziwei_calculate') {
        const chart = result.structuredContent as {
          payloadByScope?: {
            origin?: {
              evidence_pool?: Array<{
                key?: string;
                status?: string;
                calculationStepKey?: string;
                level?: unknown;
                priority?: unknown;
              }>;
              evidence_analysis?: {
                key?: string;
                status?: string;
                calculationSteps?: Array<{ key: string }>;
                counterEvidenceFacts?: Array<{ key?: string; ownerFactKeys?: string[] }>;
                summaryFact?: {
                  key?: string;
                  factKeys?: string[];
                  evidenceFactCount?: number;
                  primaryFactCount?: unknown;
                  supportingFactCount?: unknown;
                };
                limitationFacts?: Array<{ ownerFactKeys?: string[] }>;
              };
              patterns?: Array<{
                key?: string;
                status?: string;
                calculationStepKey?: string;
              }>;
              pattern_analysis?: {
                key?: string;
                status?: string;
                calculationSteps?: Array<{ key: string }>;
                counterEvidenceFacts?: Array<{ key?: string; ownerFactKeys?: string[] }>;
                summaryFact?: {
                  key?: string;
                  factKeys?: string[];
                  registeredRuleCount?: number;
                  evaluatedRuleCount?: number;
                  matchedPatternCount?: number;
                };
                limitationFacts?: Array<{ ownerFactKeys?: string[] }>;
              };
            };
          };
        };
        const origin = chart.payloadByScope?.origin;
        assert.ok(origin?.evidence_pool?.length);
        assert.ok(
          origin?.evidence_pool?.every(
            (item) =>
              !('priority' in item) &&
              !('level' in item) &&
              item.key?.startsWith('ziwei:evidence:') &&
              item.status &&
              origin.evidence_analysis?.calculationSteps?.some(
                (step) => step.key === item.calculationStepKey,
              ),
          ),
        );
        assert.equal(origin?.evidence_analysis?.key, 'ziwei:evidence');
        assert.equal(origin?.evidence_analysis?.calculationSteps?.length, 4);
        assert.equal(
          origin?.evidence_analysis?.summaryFact?.evidenceFactCount,
          origin?.evidence_pool?.length,
        );
        assert.ok(!('primaryFactCount' in (origin?.evidence_analysis?.summaryFact ?? {})));
        assert.ok(!('supportingFactCount' in (origin?.evidence_analysis?.summaryFact ?? {})));
        assertEvidenceOwnerReferences(origin?.evidence_analysis);
        assert.equal(origin?.pattern_analysis?.key, 'ziwei:patterns');
        assert.equal(origin?.pattern_analysis?.calculationSteps?.length, 4);
        assert.equal(
          origin?.pattern_analysis?.summaryFact?.evaluatedRuleCount,
          origin?.pattern_analysis?.summaryFact?.registeredRuleCount,
        );
        assert.equal(
          origin?.pattern_analysis?.summaryFact?.matchedPatternCount,
          origin?.patterns?.length,
        );
        assert.ok(
          origin?.patterns?.every(
            (item) =>
              item.key?.startsWith('ziwei:verified-pattern:') &&
              item.status === '已命中' &&
              origin.pattern_analysis?.calculationSteps?.some(
                (step) => step.key === item.calculationStepKey,
              ),
          ),
        );
        assertEvidenceOwnerReferences(origin?.pattern_analysis);
      }
      if (name === 'metaphysics_bazhai') {
        assert.doesNotMatch(
          JSON.stringify((result.structuredContent as { result?: unknown }).result),
          AUTOMATIC_DIRECTION_CONCLUSION,
        );
        const chart = (
          result.structuredContent as {
            result?: {
              generation?: {
                method: string;
                person: Record<string, unknown>;
                doorToInteriorDegree?: number;
                northReference?: string;
                magneticDeclinationDegrees?: number | null;
                measurementUncertaintyDegrees?: number;
              };
              evidenceAnalysis?: {
                calculationFact?: {
                  status: string;
                  steps: Array<{
                    key: string;
                    dependsOnStepKeys: string[];
                    promptText: string;
                    sources: string[];
                    limitation: string;
                  }>;
                };
                calculationSteps?: Array<{
                  key: string;
                  dependsOnStepKeys: string[];
                  promptText: string;
                  sources: string[];
                  limitation: string;
                }>;
                measurementFact?: {
                  status: string;
                  referenceStatus: string;
                  candidateFactKeys: string[];
                  candidates: Array<{
                    key: string;
                    status: string;
                    measurementFactKey: string;
                    calculationStepKeys: string[];
                    limitation: string;
                  }>;
                };
                directionFacts?: Array<{
                  key: string;
                  status: string;
                  calculationStepKeys: string[];
                  sources: string[];
                  calculation: string;
                  limitation: string;
                }>;
                counterEvidenceFacts?: Array<{
                  type: string;
                  status: string;
                  ownerFactKeys: string[];
                }>;
                counterSummaryFact?: { status: string; factKeys: string[] };
                summaryFact?: {
                  key: string;
                  status: string;
                  factKeys: string[];
                  directionFactCount: number;
                  measurementCandidateCount: number;
                  counterEvidenceCount: number;
                  limitationFactCount: number;
                };
                limitations?: string[];
                limitationFacts?: Array<{
                  key: string;
                  status: string;
                  ownerFactKeys: string[];
                  sources: string[];
                }>;
                promptText?: string;
              };
            };
          }
        ).result;
        assert.deepEqual(chart?.generation, {
          method: 'door-measurement',
          person: { source: 'birth', birthYear: 1990, gender: 'male' },
          doorToInteriorDegree: 0,
          northReference: 'unspecified',
          magneticDeclinationDegrees: null,
          measurementUncertaintyDegrees: 0,
        });
        assert.equal(chart?.evidenceAnalysis?.key, 'bazhai:evidence');
        assert.equal(chart?.evidenceAnalysis?.status, '已计算');
        assert.equal(chart?.evidenceAnalysis?.calculationFact?.status, '命宅完整');
        assert.equal(chart?.evidenceAnalysis?.calculationFact?.steps.length, 5);
        assert.deepEqual(
          chart?.evidenceAnalysis?.calculationSteps,
          chart?.evidenceAnalysis?.calculationFact?.steps,
        );
        assert.ok(
          chart?.evidenceAnalysis?.calculationFact?.steps.every(
            (item) =>
              item.key &&
              Array.isArray(item.dependsOnStepKeys) &&
              item.promptText &&
              item.sources.length > 0 &&
              item.limitation.includes('不得把步骤完整度解释为住宅适用度'),
          ),
        );
        assert.equal(chart?.evidenceAnalysis?.measurementFact?.status, '稳定');
        assert.equal(chart?.evidenceAnalysis?.measurementFact?.referenceStatus, '未声明');
        assert.ok(
          chart?.evidenceAnalysis?.measurementFact?.candidates.every(
            (item) =>
              item.key.startsWith('measurement:bazhai:candidate:') &&
              item.status === '候选' &&
              item.measurementFactKey === 'measurement:bazhai:door' &&
              item.calculationStepKeys.includes('bazhai:calculation:house-gua') &&
              item.limitation.includes('不代表现场真实坐向'),
          ),
        );
        assert.equal(chart?.evidenceAnalysis?.measurementFact?.candidateFactKeys.length, 1);
        assert.equal(chart?.evidenceAnalysis?.directionFacts?.length, 8);
        assert.ok(
          chart?.evidenceAnalysis?.directionFacts?.every(
            (item) =>
              item.key.startsWith('方位:') &&
              item.status === '已计算' &&
              item.calculationStepKeys.length > 0 &&
              item.sources.length >= 2 &&
              item.calculation.includes('查大游年表') &&
              item.limitation.includes('不证明房间适用性'),
          ),
        );
        assert.equal(chart?.evidenceAnalysis?.counterEvidenceFacts?.length, 6);
        assert.equal(
          chart?.evidenceAnalysis?.counterEvidenceFacts?.find((item) => item.type === '命卦年界')
            ?.status,
          '待复核',
        );
        assert.equal(
          chart?.evidenceAnalysis?.counterEvidenceFacts?.find((item) => item.type === '北向基准')
            ?.status,
          '未声明',
        );
        assert.equal(chart?.evidenceAnalysis?.counterSummaryFact?.status, '存在需保留反证');
        assert.equal(chart?.evidenceAnalysis?.limitationFacts?.length, 6);
        assert.equal(chart?.evidenceAnalysis?.summaryFact?.key, 'bazhai:evidence-summary');
        assert.equal(chart?.evidenceAnalysis?.summaryFact?.status, '证据链有缺口');
        assert.equal(chart?.evidenceAnalysis?.summaryFact?.directionFactCount, 8);
        assert.equal(chart?.evidenceAnalysis?.summaryFact?.measurementCandidateCount, 1);
        assert.equal(chart?.evidenceAnalysis?.summaryFact?.counterEvidenceCount, 6);
        assert.equal(chart?.evidenceAnalysis?.summaryFact?.limitationFactCount, 6);
        const bazhaiFactKeys = new Set([
          chart?.evidenceAnalysis?.summaryFact?.key,
          ...(chart?.evidenceAnalysis?.summaryFact?.factKeys ?? []),
        ]);
        assert.ok(
          chart?.evidenceAnalysis?.counterEvidenceFacts?.every(
            (item) =>
              item.ownerFactKeys.length > 0 &&
              item.ownerFactKeys.every((key) => bazhaiFactKeys.has(key)),
          ),
        );
        assert.ok(
          chart?.evidenceAnalysis?.limitationFacts?.every(
            (item) =>
              item.ownerFactKeys.length > 0 &&
              item.ownerFactKeys.every((key) => bazhaiFactKeys.has(key)),
          ),
        );
        assert.equal(
          chart?.evidenceAnalysis?.limitations?.length,
          chart?.evidenceAnalysis?.limitationFacts?.length,
        );
        assert.doesNotMatch(
          chart?.evidenceAnalysis?.promptText ?? '',
          /命语|本项目|项目统一|调用方|当前调用|工程|接口|API|MCP/,
        );
        assertPromptIsPortableTaskText(chart?.evidenceAnalysis?.promptText ?? '');
      }
      if (name === 'metaphysics_residential') {
        const residential = (result.structuredContent as { result?: Record<string, unknown> })
          .result;
        assert.ok(residential?.generation);
        assert.ok(Array.isArray(residential?.reviewNotes));
        assert.equal('agreements' in (residential ?? {}), false);
        assert.equal('advice' in (residential ?? {}), false);
        assert.doesNotMatch(JSON.stringify(residential), AUTOMATIC_DIRECTION_CONCLUSION);
      }
      if (name === 'ziwei_compatibility') {
        const compatibility = (
          result.structuredContent as {
            compatibility?: {
              key?: string;
              status?: string;
              calculationSteps?: Array<{ key: string; dependsOnStepKeys: string[] }>;
              palaceOverlays?: Array<{
                key: string;
                status?: string;
                calculationStepKey?: string;
                sources: string[];
                limitation: string;
              }>;
              crossMutagenPlacements?: Array<{
                key: string;
                status?: string;
                calculationStepKey?: string;
                sources: string[];
                limitation: string;
              }>;
              counterEvidenceFacts?: unknown[];
              summaryFact?: {
                palaceOverlayCount?: number;
                crossMutagenPlacementCount?: number;
              };
              limitationFacts?: Array<{ type?: string }>;
              promptText?: string;
            };
          }
        ).compatibility;
        assert.equal(compatibility?.key, 'ziwei:compatibility:evidence');
        assert.equal(compatibility?.status, '已计算');
        assert.equal(compatibility?.calculationSteps?.length, 6);
        assert.ok(
          compatibility?.palaceOverlays?.every(
            (item) =>
              item.key.startsWith('宫位叠盘:') &&
              item.status === '已命中' &&
              compatibility.calculationSteps?.some(
                (step) => step.key === item.calculationStepKey,
              ) &&
              item.sources.length >= 2 &&
              item.limitation.includes('不单独证明关系吉凶'),
          ),
        );
        assert.ok(
          compatibility?.crossMutagenPlacements?.every(
            (item) =>
              item.key.startsWith('跨盘四化:') &&
              item.status === '已命中' &&
              compatibility.calculationSteps?.some(
                (step) => step.key === item.calculationStepKey,
              ) &&
              item.sources.length >= 2 &&
              item.limitation.includes('不直接等于关系吉凶'),
          ),
        );
        assert.equal(
          compatibility?.summaryFact?.palaceOverlayCount,
          compatibility?.palaceOverlays?.length,
        );
        assert.equal(
          compatibility?.summaryFact?.crossMutagenPlacementCount,
          compatibility?.crossMutagenPlacements?.length,
        );
        assert.equal(compatibility?.counterEvidenceFacts?.length, 5);
        assert.ok(compatibility?.limitationFacts?.some((item) => item.type === '高风险输出边界'));
        assertEvidenceOwnerReferences(compatibility);
        assert.doesNotMatch(
          compatibility?.promptText ?? '',
          /analysis_payload_v1|命语|本项目|项目统一|工程|接口|API|MCP|ziwei:compatibility:/,
        );
        assertPromptIsPortableTaskText(compatibility?.promptText ?? '');
      }

      const text = result.content[0]?.type === 'text' ? result.content[0].text : '';
      assert.deepEqual(JSON.parse(text), result.structuredContent);
    }
  });
});

test('MCP 真太阳时工具应返回换算资料并拒绝带时区后缀的钟表时间', async () => {
  await withMcpClient(async (client) => {
    const success = await client.callTool({
      name: 'calendar_true_solar_time',
      arguments: { localDateTime: '1990-05-15T10:30:20', longitude: 116.4074 },
    });
    assert.equal(success.isError, undefined);
    assert.equal(success.structuredContent?.result.standardMeridian, 120);
    assert.equal(success.structuredContent?.result.shichen.name, '巳时');
    assert.equal(success.structuredContent?.result.status, '已计算');
    assert.equal(success.structuredContent?.result.calculationSteps.length, 6);
    assert.deepEqual(
      success.structuredContent?.result.calculationChain,
      success.structuredContent?.result.calculationSteps.map(
        (item: { promptText: string }) => item.promptText,
      ),
    );
    assert.equal(
      success.structuredContent?.result.summaryFact.calculationStepCount,
      success.structuredContent?.result.calculationSteps.length,
    );
    assert.equal(
      success.structuredContent?.result.summaryFact.correctionFactCount,
      success.structuredContent?.result.correctionFacts.length,
    );
    assert.equal(
      success.structuredContent?.result.summaryFact.limitationFactCount,
      success.structuredContent?.result.limitationFacts.length,
    );
    assert.match(success.structuredContent?.result.promptText, /计算链：/);
    assert.doesNotMatch(
      success.structuredContent?.result.promptText,
      /候选时辰为|出生时间敏感性|缺少时柱/,
    );

    const chinaDst = await client.callTool({
      name: 'calendar_true_solar_time',
      arguments: {
        localDateTime: '1988-07-15T12:00:00',
        longitude: 116.4074,
        applyChinaDst: true,
      },
    });
    assert.equal(chinaDst.isError, undefined);
    assert.equal(chinaDst.structuredContent?.result.standardDateTime, '1988-07-15T11:00:00');
    assert.equal(chinaDst.structuredContent?.result.chinaDst.applied, true);

    const invalid = await client.callTool({
      name: 'calendar_true_solar_time',
      arguments: { localDateTime: '1990-05-15T10:30:20+08:00', longitude: 116.4074 },
    });
    assert.equal(invalid.isError, true);
    const text = invalid.content[0]?.type === 'text' ? invalid.content[0].text : '';
    assert.match(text, /不要附带时区偏移/);
  });
});

test('MCP 统一出生真太阳时工具应支持农历与跨日资料', async () => {
  await withMcpClient(async (client) => {
    const result = await client.callTool({
      name: 'calendar_true_solar_birth',
      arguments: {
        dateType: 'lunar',
        year: 1990,
        month: 5,
        day: 23,
        hour: 12,
        minute: 0,
        longitude: 116.4074,
        timezone: 8,
      },
    });
    assert.equal(result.isError, undefined);
    assert.equal(result.structuredContent?.result.inputDateType, 'lunar');
    assert.equal(typeof result.structuredContent?.result.solarClockDateTime, 'string');
    assert.equal(typeof result.structuredContent?.result.timeIndex, 'number');
    assert.equal(result.structuredContent?.result.calculationSteps.length, 7);
    assert.equal(result.structuredContent?.result.calculationSteps[0].stage, '历法输入换算');
    assert.equal(result.structuredContent?.result.correctionFacts[0].type, '历法输入');
    assert.equal(result.structuredContent?.result.summaryFact.status, '证据链完整');
  });
});

test('MCP 太阳光照工具应返回日出日落与曙暮光结构化证据', async () => {
  await withMcpClient(async (client) => {
    const result = await client.callTool({
      name: 'calendar_solar_illumination',
      arguments: {
        year: 2024,
        month: 6,
        day: 21,
        hour: 12,
        latitude: 39.9042,
        longitude: 116.4074,
        timezone: 8,
      },
    });
    assert.equal(result.isError, undefined);
    assert.equal(result.structuredContent?.result.sunriseSunset.status, '正常交点');
    assert.match(String(result.structuredContent?.result.sunriseSunset.key), /^光照交点:/);
    assert.ok(result.structuredContent?.result.sunriseSunset.sources.length >= 2);
    assert.match(
      String(result.structuredContent?.result.sunriseSunset.limitation),
      /不代表实际可见性/,
    );
    assert.equal(result.structuredContent?.result.status, '已计算');
    assert.equal(result.structuredContent?.result.astronomicalTime.status, '已计算');
    assert.equal(result.structuredContent?.result.calculationSteps.length, 4);
    assert.equal(result.structuredContent?.result.calculationChain.length, 4);
    assert.equal(
      result.structuredContent?.result.sunriseSunset.calculationStepKeys[0],
      result.structuredContent?.result.calculationSteps[3].key,
    );
    assert.equal(result.structuredContent?.result.assumptions.length, 2);
    assert.equal(result.structuredContent?.result.assumptionFacts.length, 2);
    assert.equal(result.structuredContent?.result.crossingSummaryFact.status, '均有正常交点');
    assert.equal(result.structuredContent?.result.crossingSummaryFact.crossingFactKeys.length, 4);
    assert.equal(
      result.structuredContent?.result.summaryFact.key,
      'solar-illumination:evidence-summary',
    );
    assert.equal(result.structuredContent?.result.summaryFact.status, '证据链完整');
    assert.equal(result.structuredContent?.result.summaryFact.normalCrossingCount, 4);
    assert.equal(
      result.structuredContent?.result.limitations.length,
      result.structuredContent?.result.limitationFacts.length,
    );
    assert.match(String(result.structuredContent?.result.promptText), /太阳光照证据：/);
    assertPromptIsPortableTaskText(String(result.structuredContent?.result.promptText));
  });
});

test('MCP 一站式提示词工具应同时返回结果和 prompt', async () => {
  await withMcpClient(async (client) => {
    for (const [name, args, promptPattern] of promptToolCalls) {
      const result = await client.callTool({ name, arguments: args });

      assert.equal(result.isError, undefined, `${name} 不应返回错误`);
      assert.ok(result.structuredContent?.result, `${name} 应返回 result`);
      const prompt = String(result.structuredContent?.prompt);
      assert.match(prompt, promptPattern, `${name} prompt 格式不正确`);
      if (name === 'xiaoliuren_prompt') {
        assert.doesNotMatch(prompt, /应期触发条件：|换算固定日数/);
      }
      if (name === 'bazhai_prompt' || name === 'residential_prompt') {
        assert.doesNotMatch(
          JSON.stringify(result.structuredContent),
          AUTOMATIC_DIRECTION_CONCLUSION,
        );
      }
      assertPromptIsPortableTaskText(prompt);

      const text = result.content[0]?.type === 'text' ? result.content[0].text : '';
      assert.deepEqual(JSON.parse(text), result.structuredContent);
    }
  });
});

test('MCP 八字年限提示词应返回逐层岁运触发证据', async () => {
  await withMcpClient(async (client) => {
    const response = await client.callTool({
      name: 'bazi_prompt',
      arguments: {
        gender: 'male',
        year: 1990,
        month: 5,
        day: 15,
        timeIndex: 1,
        dateType: 'solar',
        question: '这一年的事业触发有哪些？',
        promptTopic: 'career',
        baziFortuneScope: 'year',
        baziFortuneCycleIndex: 1,
      },
    });

    assert.equal(response.isError, undefined);
    const result = response.structuredContent?.result as {
      fortuneSelection?: {
        promptPayload?: {
          triggerEvidence?: {
            key?: string;
            status?: string;
            layers?: Array<{ key?: string; status?: string }>;
            layerStructureFacts?: Array<{
              stem?: { symbol?: string; tenGod?: string; directPreference?: string };
              branch?: { symbol?: string; hiddenStems?: unknown[] };
            }>;
            hiddenStemRevealFacts?: unknown[];
            officerPatternRuleFacts?: unknown[];
            wealthPatternRuleFacts?: unknown[];
            resourcePatternRuleFacts?: unknown[];
            foodPatternRuleFacts?: unknown[];
            killerPatternRuleFacts?: unknown[];
            hurtPatternRuleFacts?: unknown[];
            bladePatternRuleFacts?: unknown[];
            luPatternRuleFacts?: unknown[];
            miscPatternRuleFacts?: unknown[];
            relations?: Array<{
              key?: string;
              status?: string;
              sourceLayerKey?: string;
              targetLayerKey?: string;
              calculationStepKey?: string;
            }>;
            calculationSteps?: Array<{ key: string; dependsOnStepKeys: string[] }>;
            relationSummaryFact?: { relationCount?: number };
            counterEvidenceFacts?: unknown[];
            limitationFacts?: Array<{ type?: string }>;
          };
        };
      };
    };
    const triggerEvidence = result.fortuneSelection?.promptPayload?.triggerEvidence;
    assert.equal(triggerEvidence?.key, 'bazi:fortune-trigger:evidence');
    assert.equal(triggerEvidence?.status, '已计算');
    assert.ok(triggerEvidence?.layers?.every((item) => item.key && item.status === '已计算'));
    assert.equal(triggerEvidence?.layerStructureFacts?.length, 2);
    assert.ok(
      triggerEvidence?.layerStructureFacts?.every(
        (item) =>
          item.stem?.symbol &&
          item.stem.tenGod &&
          item.stem.directPreference === '自动喜忌规则已关闭' &&
          item.branch?.symbol &&
          item.branch.hiddenStems?.length,
      ),
    );
    assert.ok(Array.isArray(triggerEvidence?.hiddenStemRevealFacts));
    assert.ok(Array.isArray(triggerEvidence?.officerPatternRuleFacts));
    assert.ok(Array.isArray(triggerEvidence?.wealthPatternRuleFacts));
    assert.ok(Array.isArray(triggerEvidence?.resourcePatternRuleFacts));
    assert.ok(Array.isArray(triggerEvidence?.foodPatternRuleFacts));
    assert.ok(Array.isArray(triggerEvidence?.killerPatternRuleFacts));
    assert.ok(Array.isArray(triggerEvidence?.hurtPatternRuleFacts));
    assert.ok(Array.isArray(triggerEvidence?.bladePatternRuleFacts));
    assert.ok(Array.isArray(triggerEvidence?.luPatternRuleFacts));
    assert.ok(Array.isArray(triggerEvidence?.miscPatternRuleFacts));
    assert.ok(triggerEvidence?.relations?.length);
    assert.ok(
      triggerEvidence?.relations?.every(
        (item) =>
          item.key &&
          item.status === '已命中' &&
          item.sourceLayerKey &&
          item.targetLayerKey &&
          triggerEvidence.calculationSteps?.some((step) => step.key === item.calculationStepKey),
      ),
    );
    assert.equal(
      triggerEvidence?.relationSummaryFact?.relationCount,
      triggerEvidence?.relations?.length,
    );
    assert.ok(triggerEvidence?.counterEvidenceFacts?.length);
    assert.ok(triggerEvidence?.limitationFacts?.some((item) => item.type === '层级应期边界'));
    assert.ok(triggerEvidence?.limitationFacts?.some((item) => item.type === '干支分看边界'));
    assert.ok(triggerEvidence?.limitationFacts?.some((item) => item.type === '成格变格边界'));
    assertEvidenceOwnerReferences(triggerEvidence);
    const prompt = String(response.structuredContent?.prompt);
    assert.match(prompt, /【分析对象】[\s\S]*分析对象：1997年流年/);
    assert.match(prompt, /【岁运重点】[\s\S]*主要触发：/);
    assert.doesNotMatch(prompt, /结构化证据|计算链|证据汇总|解释限制|证据边界/);
  });
});

test('MCP 八字双盘应返回计算链、反证、汇总与限制对象', async () => {
  await withMcpClient(async (client) => {
    const response = await client.callTool({
      name: 'bazi_compatibility_prompt',
      arguments: {
        person1: {
          name: '甲方',
          gender: 'female',
          year: 1988,
          month: 1,
          day: 1,
          timeIndex: 0,
          dateType: 'solar',
        },
        person2: {
          name: '乙方',
          gender: 'male',
          year: 1990,
          month: 6,
          day: 15,
          timeIndex: 5,
          dateType: 'solar',
        },
        question: '双方适合长期合作吗？',
        compatType: 'career',
      },
    });

    assert.equal(response.isError, undefined);
    const compatibility = (
      response.structuredContent?.result as {
        compatibility?: {
          key?: string;
          status?: string;
          calculationSteps?: Array<{ key: string; dependsOnStepKeys: string[] }>;
          crossPillarRelations?: Array<{
            key?: string;
            status?: string;
            calculationStepKey?: string;
          }>;
          counterEvidenceFacts?: unknown[];
          summaryFact?: { crossPillarRelationCount?: number };
          limitationFacts?: Array<{ type?: string }>;
        };
      }
    )?.compatibility;
    assert.equal(compatibility?.key, 'bazi:compatibility:evidence');
    assert.equal(compatibility?.status, '存在资料缺口');
    assert.equal(compatibility?.calculationSteps?.length, 7);
    assert.ok(
      compatibility?.crossPillarRelations?.every(
        (item) =>
          item.key &&
          item.status === '已命中' &&
          compatibility.calculationSteps?.some((step) => step.key === item.calculationStepKey),
      ),
    );
    assert.equal(
      compatibility?.summaryFact?.crossPillarRelationCount,
      compatibility?.crossPillarRelations?.length,
    );
    assert.ok(compatibility?.counterEvidenceFacts?.length);
    assert.ok(compatibility?.limitationFacts?.some((item) => item.type === '高风险输出边界'));
    assertEvidenceOwnerReferences(compatibility);
    const prompt = String(response.structuredContent?.prompt);
    assert.match(prompt, /【双盘关系资料】[\s\S]*日主关系：[\s\S]*四柱关系：/);
    assert.doesNotMatch(prompt, /结构化证据|计算链|证据汇总|解释限制|bazi:compatibility:/);
  });
});

test('MCP 黄历择日提示词应允许省略问题', async () => {
  await withMcpClient(async (client) => {
    const result = await client.callTool({
      name: 'almanac_prompt',
      arguments: {
        topic: 'contract',
        startDate: '2026-06-01',
        endDate: '2026-06-03',
      },
    });

    assert.equal(result.isError, undefined, 'almanac_prompt 不填 question 不应返回错误');
    assert.ok(result.structuredContent?.result, 'almanac_prompt 应返回 result');
    const chart = (
      result.structuredContent as {
        result: {
          days: Array<{
            score?: number;
            hours?: Array<{ score?: number }>;
            bestHours?: Array<{ score?: number }>;
          }>;
          evidenceAnalysis: {
            key: string;
            status: string;
            key: string;
            status: string;
            calculationSteps: Array<{
              key: string;
              dependsOnStepKeys: string[];
              sources: string[];
              limitation: string;
            }>;
            calculationChain: string[];
            candidates: Array<{
              date: string;
              calendarFact: {
                key: string;
                promptText: string;
                sources: string[];
                limitation: string;
              };
              rawTabooFact: { key: string; status: string };
              godFacts: Array<{ key: string; status: string; sources: string[] }>;
              topicMatchFacts: Array<{ key: string; sources: string[]; limitation: string }>;
              participantRelationFacts: Array<{ key: string }>;
              decisionFact: {
                key: string;
                status: string;
                steps: Array<{ key: string; result: string }>;
                limitation: string;
              };
              moonPhaseFact: {
                previousPrincipalPhase: { sources: string[] };
                nextPrincipalPhase: { calculation: string };
              };
              usableHours: Array<{
                key: string;
                promptText: string;
                sources: string[];
                limitation: string;
                rawTabooFact: { key: string };
                topicMatchFacts: Array<{ key: string; scope: string }>;
              }>;
            }>;
            cautionDates: string[];
            counterEvidenceFacts: Array<{ ownerFactKeys: string[] }>;
            counterSummaryFact: { factKeys: string[] };
            limitations: string[];
            limitationFacts: Array<{ ownerFactKeys: string[] }>;
            summaryFact: {
              key: string;
              status: string;
              factKeys: string[];
              candidateCount: number;
              traditionalFactCount: number;
              counterEvidenceCount: number;
            };
            traditionalFacts: Array<{
              kind: string;
              originalText: string;
              promptText: string;
              sources: string[];
              limitation: string;
            }>;
          };
        };
      }
    ).result;
    assert.equal(chart.evidenceAnalysis.key, 'almanac:evidence');
    assert.equal(chart.evidenceAnalysis.status, '已计算');
    assert.equal(chart.evidenceAnalysis.calculationSteps.length, 7);
    assert.equal(
      chart.evidenceAnalysis.calculationChain.length,
      chart.evidenceAnalysis.calculationSteps.length,
    );
    const calculationStepKeys = new Set(
      chart.evidenceAnalysis.calculationSteps.map((item) => item.key),
    );
    assert.ok(
      chart.evidenceAnalysis.calculationSteps.every(
        (item) =>
          item.dependsOnStepKeys.every((key) => calculationStepKeys.has(key)) &&
          item.sources.length > 0 &&
          item.limitation.includes('不证明现实吉凶'),
      ),
    );
    assert.ok(chart.evidenceAnalysis.candidates.length > 0);
    assert.ok(Array.isArray(chart.evidenceAnalysis.cautionDates));
    assert.ok(
      chart.evidenceAnalysis.candidates.every(
        (item) =>
          item.calendarFact.key === `${item.date}:calendar` &&
          item.calendarFact.promptText &&
          item.calendarFact.sources.length >= 2 &&
          item.calendarFact.limitation.includes('不单独证明现实吉凶') &&
          item.rawTabooFact.key === `${item.date}:raw-taboo` &&
          item.rawTabooFact.status !== '均未列' &&
          item.godFacts.length > 0 &&
          item.godFacts.every(
            (fact) =>
              fact.key.startsWith(`${item.date}:god:`) &&
              fact.status === '已读取' &&
              fact.sources.length >= 2,
          ) &&
          item.topicMatchFacts.length === 2 &&
          item.topicMatchFacts.some((fact) => fact.key === `${item.date}:topic:day-recommends`) &&
          item.topicMatchFacts.some((fact) => fact.key === `${item.date}:topic:day-avoids`) &&
          item.topicMatchFacts.every(
            (fact) =>
              fact.key.startsWith(`${item.date}:topic:`) &&
              fact.sources.length >= 2 &&
              fact.limitation.includes('不证明事项必然成功'),
          ) &&
          item.participantRelationFacts.length === 0 &&
          item.decisionFact.key === `${item.date}:decision` &&
          item.decisionFact.steps.length === 7 &&
          item.decisionFact.steps.at(-1)?.result === item.decisionFact.status &&
          item.decisionFact.limitation.includes('不设置吉凶总分') &&
          item.moonPhaseFact.previousPrincipalPhase.sources.length >= 2 &&
          item.moonPhaseFact.nextPrincipalPhase.calculation.includes('二分求根') &&
          item.usableHours.every(
            (hour) =>
              hour.key.startsWith(`${item.date}:hour:`) &&
              hour.promptText &&
              hour.sources.length >= 2 &&
              hour.rawTabooFact.key.startsWith(hour.key) &&
              hour.topicMatchFacts.length === 3 &&
              hour.topicMatchFacts.every(
                (fact) => fact.key.startsWith(hour.key) && fact.scope === '时辰',
              ) &&
              hour.limitation.includes('不证明该时辰必然成功'),
          ),
      ),
    );
    assert.ok(chart.evidenceAnalysis.traditionalFacts.length > 0);
    assert.ok(
      chart.evidenceAnalysis.traditionalFacts.every(
        (item) =>
          item.originalText &&
          item.promptText &&
          item.sources.length > 0 &&
          item.limitation.includes('不证明现实中'),
      ),
    );
    assert.equal(chart.evidenceAnalysis.summaryFact.status, '证据链完整');
    assert.equal(
      chart.evidenceAnalysis.summaryFact.candidateCount,
      chart.evidenceAnalysis.candidates.length,
    );
    assert.equal(
      chart.evidenceAnalysis.summaryFact.traditionalFactCount,
      chart.evidenceAnalysis.traditionalFacts.length,
    );
    assert.equal(
      chart.evidenceAnalysis.summaryFact.counterEvidenceCount,
      chart.evidenceAnalysis.counterEvidenceFacts.length,
    );
    assert.equal(
      chart.evidenceAnalysis.counterSummaryFact.factKeys.length,
      chart.evidenceAnalysis.counterEvidenceFacts.length,
    );
    assert.equal(chart.evidenceAnalysis.limitationFacts.length, 6);
    assert.equal(
      chart.evidenceAnalysis.limitations.length,
      chart.evidenceAnalysis.limitationFacts.length,
    );
    const factKeys = new Set([
      chart.evidenceAnalysis.summaryFact.key,
      ...chart.evidenceAnalysis.summaryFact.factKeys,
    ]);
    assert.ok(
      chart.evidenceAnalysis.counterEvidenceFacts.every(
        (item) =>
          item.ownerFactKeys.length > 0 && item.ownerFactKeys.every((key) => factKeys.has(key)),
      ),
    );
    assert.ok(
      chart.evidenceAnalysis.limitationFacts.every(
        (item) =>
          item.ownerFactKeys.length > 0 && item.ownerFactKeys.every((key) => factKeys.has(key)),
      ),
    );
    for (const day of chart.days) {
      assert.equal(day.score, undefined);
      for (const hour of [...(day.hours ?? []), ...(day.bestHours ?? [])]) {
        assert.equal(hour.score, undefined);
      }
    }
    const prompt = String(result.structuredContent?.prompt);
    assert.match(prompt, /【占卜信息】/);
    assert.match(prompt, /占法：黄历择日/);
    assert.match(prompt, /候选日期明细：/);
    assert.doesNotMatch(prompt, /结构化证据|计算链|证据汇总|解释限制|证据边界/);
    assert.doesNotMatch(prompt, /评分[：=]?\d|（\d+分|成功率[：=]?\d/);
    assert.doesNotMatch(
      prompt,
      /主疾病|主死丧|主灾病死亡|主哭泣死亡|必见灾殃|毒气入肠|大凶|辅助加分/,
    );
    assertPromptIsPortableTaskText(prompt);
  });
});

test('MCP 星盘提示词应透传分析对象文本', async () => {
  await withMcpClient(async (client) => {
    const result = await client.callTool({
      name: 'astrolabe_prompt',
      arguments: {
        name: '本人',
        gender: '女',
        year: 1995,
        month: 5,
        day: 20,
        hour: 12,
        minute: 30,
        latitude: 39.9042,
        longitude: 116.4074,
        timezone: 8,
        timeZoneId: 'Asia/Shanghai',
        locationName: '北京',
        question: '请看我 2028 年事业机会。',
        astrolabeTopic: 'job-change',
        astrolabeScopeText:
          '分析对象：流年2028。\n行运证据：土星□太阳（刑相，实际夹角89.50°，精确角90.00°，偏差0.50°，采用容许度7.00°）。',
      },
    });

    assert.equal(result.isError, undefined, 'astrolabe_prompt 不应返回错误');
    const chart = (
      result.structuredContent as {
        result?: {
          generation?: {
            input: {
              name: string;
              timezone?: string;
              timeZoneId?: string;
              useTrueSolarTime?: boolean;
            };
            timestamp: number;
          };
          timestamp?: number;
          birth?: {
            timezoneEvidence?: {
              key: string;
              status: string;
              calculationSteps: unknown[];
              calculationChain: string[];
              diagnosticFacts: unknown[];
              diagnosticSummaryFact: { status: string; factKeys: string[] };
              summaryFact: {
                key: string;
                status: string;
                calculationStepCount: number;
                diagnosticFactCount: number;
                limitationFactCount: number;
              };
              limitations: string[];
              limitationFacts: unknown[];
              promptText: string;
            };
          };
          planets?: unknown[];
          angles?: unknown[];
          houses?: unknown[];
          aspects?: Array<{
            strength?: number;
            closeness?: string;
            normalizedOrbRatio?: number;
            actualAngle?: number;
            exactAngle?: number;
            allowedOrb?: number;
          }>;
          aspectCalculation?: {
            selectedPointNames: string[];
            aspectDefinitions: unknown[];
            evaluatedPairCount: number;
            matchedAspectCount: number;
            enumeration: string;
          };
          evidenceAnalysis?: {
            key?: string;
            status?: string;
            evidence?: { title?: string };
            timezoneFact?: { key: string; diagnosticSummaryFact: { status: string } };
            calculationFact?: {
              status: string;
              steps: Array<{
                key: string;
                stage: string;
                promptText: string;
                sources: string[];
                dependsOnStepKeys: string[];
                limitation: string;
              }>;
            };
            calculationSteps?: Array<{
              key: string;
              stage: string;
              promptText: string;
              sources: string[];
              dependsOnStepKeys: string[];
              limitation: string;
            }>;
            calculationChain?: string[];
            primaryCoverageFact?: { status: string; positionFactKeys: string[] };
            primaryPointFacts?: Array<{ key: string; positionFactKey: string }>;
            positionFacts?: unknown[];
            illuminationFact?: { status: string; crossingFactKeys: string[] };
            counterEvidenceFacts?: Array<{
              type: string;
              status: string;
              ownerFactKeys: string[];
            }>;
            counterSummaryFact?: { status: string; factKeys: string[] };
            summaryFact?: {
              key: string;
              status: string;
              factKeys: string[];
              primaryFactCount: number;
              positionFactCount: number;
              aspectFactCount: number;
              distributionFactCount: number;
              counterEvidenceCount: number;
              limitationFactCount: number;
            };
            limitations?: string[];
            limitationFacts?: Array<{ key: string; type: string; ownerFactKeys: string[] }>;
            distributionEvidenceFacts?: Array<{
              key: string;
              count: number;
              members: string[];
              memberPositionFactKeys: string[];
              limitation: string;
            }>;
            aspectFacts?: Array<{
              actualAngle?: number;
              exactAngle?: number;
              allowedOrb?: number;
              status?: string;
              positionFactKeys?: string[];
              sources?: string[];
              limitation?: string;
            }>;
          };
        };
      }
    ).result;
    assert.equal(chart?.generation?.input.name, '本人');
    assert.equal(chart?.generation?.input.timezone, '8');
    assert.equal(chart?.generation?.input.timeZoneId, 'Asia/Shanghai');
    assert.equal(chart?.generation?.input.useTrueSolarTime, false);
    assert.equal(chart?.generation?.timestamp, chart?.timestamp);
    for (const aspect of chart?.aspects ?? []) {
      assert.equal(aspect.strength, undefined);
      assert.equal(aspect.closeness, undefined);
      assert.equal(aspect.normalizedOrbRatio, undefined);
      assert.equal(typeof aspect.actualAngle, 'number');
      assert.equal(typeof aspect.exactAngle, 'number');
      assert.equal(typeof aspect.allowedOrb, 'number');
    }
    assert.equal(chart?.aspectCalculation?.enumeration, '完整穷举');
    assert.equal(chart?.aspectCalculation?.selectedPointNames.length, 24);
    assert.equal(chart?.aspectCalculation?.evaluatedPairCount, 276);
    assert.equal(chart?.aspectCalculation?.matchedAspectCount, chart?.aspects?.length);
    assert.equal(chart?.evidenceAnalysis?.evidence?.title, '西方星盘位置与相位结构化证据');
    assert.equal(chart?.evidenceAnalysis?.key, 'astrolabe:evidence');
    assert.equal(chart?.evidenceAnalysis?.status, '已计算');
    assert.equal(chart?.birth?.timezoneEvidence?.status, 'unique');
    assert.equal(chart?.birth?.timezoneEvidence?.calculationSteps.length, 4);
    assert.equal(chart?.birth?.timezoneEvidence?.calculationChain.length, 4);
    assert.equal(chart?.birth?.timezoneEvidence?.diagnosticFacts.length, 2);
    assert.equal(chart?.birth?.timezoneEvidence?.diagnosticSummaryFact.status, '唯一且无冲突');
    assert.equal(
      chart?.birth?.timezoneEvidence?.summaryFact.status,
      chart?.birth?.timezoneEvidence?.diagnosticSummaryFact.status,
    );
    assert.equal(chart?.birth?.timezoneEvidence?.summaryFact.calculationStepCount, 4);
    assert.equal(chart?.birth?.timezoneEvidence?.summaryFact.diagnosticFactCount, 2);
    assert.equal(
      chart?.birth?.timezoneEvidence?.summaryFact.limitationFactCount,
      chart?.birth?.timezoneEvidence?.limitationFacts.length,
    );
    assert.equal(
      chart?.birth?.timezoneEvidence?.limitations.length,
      chart?.birth?.timezoneEvidence?.limitationFacts.length,
    );
    assertPromptIsPortableTaskText(chart?.birth?.timezoneEvidence?.promptText ?? '');
    assert.equal(chart?.evidenceAnalysis?.timezoneFact?.key, chart?.birth?.timezoneEvidence?.key);
    assert.equal(chart?.evidenceAnalysis?.calculationFact?.status, '完整');
    assert.equal(chart?.evidenceAnalysis?.calculationFact?.steps.length, 5);
    assert.deepEqual(
      chart?.evidenceAnalysis?.calculationSteps,
      chart?.evidenceAnalysis?.calculationFact?.steps,
    );
    assert.ok(
      chart?.evidenceAnalysis?.calculationFact?.steps.every(
        (item) =>
          item.key &&
          item.stage &&
          item.promptText &&
          item.sources.length > 0 &&
          Array.isArray(item.dependsOnStepKeys) &&
          item.limitation.includes('单个计算步骤'),
      ),
    );
    assert.equal(chart?.evidenceAnalysis?.primaryCoverageFact?.status, '完整');
    assert.equal(chart?.evidenceAnalysis?.primaryPointFacts?.length, 4);
    assert.equal(chart?.evidenceAnalysis?.primaryCoverageFact?.positionFactKeys.length, 4);
    assert.ok((chart?.evidenceAnalysis?.calculationChain?.length ?? 0) >= 5);
    assert.equal(
      chart?.evidenceAnalysis?.positionFacts?.length,
      (chart?.planets?.length ?? 0) + (chart?.angles?.length ?? 0) + (chart?.houses?.length ?? 0),
    );
    assert.equal(chart?.evidenceAnalysis?.aspectFacts?.length, chart?.aspects?.length);
    assert.ok(
      chart?.evidenceAnalysis?.distributionEvidenceFacts?.every(
        (item) =>
          item.key.startsWith('distribution:') &&
          item.count === item.members.length &&
          Array.isArray(item.memberPositionFactKeys) &&
          item.limitation.includes('不代表能量分数'),
      ),
    );
    assert.ok(
      chart?.evidenceAnalysis?.aspectFacts?.every(
        (item) =>
          typeof item.actualAngle === 'number' &&
          typeof item.exactAngle === 'number' &&
          typeof item.allowedOrb === 'number' &&
          (item.status === '几何完整' || item.status === '旧记录缺几何量') &&
          Array.isArray(item.positionFactKeys) &&
          Array.isArray(item.sources) &&
          item.limitation?.includes('不代表事件概率'),
      ),
    );
    assert.equal(chart?.evidenceAnalysis?.illuminationFact?.status, '可用');
    assert.equal(chart?.evidenceAnalysis?.illuminationFact?.crossingFactKeys.length, 4);
    assert.equal(chart?.evidenceAnalysis?.counterEvidenceFacts?.length, 3);
    assert.ok(
      ['有未见项', '全部有可列资料'].includes(
        chart?.evidenceAnalysis?.counterSummaryFact?.status ?? '',
      ),
    );
    assert.equal(
      chart?.evidenceAnalysis?.limitationFacts?.length,
      chart?.evidenceAnalysis?.limitations?.length,
    );
    assert.equal(chart?.evidenceAnalysis?.summaryFact?.key, 'astrolabe:evidence-summary');
    assert.equal(chart?.evidenceAnalysis?.summaryFact?.status, '证据链完整');
    assert.ok(
      chart?.evidenceAnalysis?.summaryFact?.factKeys.includes(
        chart?.birth?.timezoneEvidence?.summaryFact.key ?? '',
      ),
    );
    assert.equal(
      chart?.evidenceAnalysis?.summaryFact?.primaryFactCount,
      chart?.evidenceAnalysis?.primaryPointFacts?.length,
    );
    assert.equal(
      chart?.evidenceAnalysis?.summaryFact?.positionFactCount,
      chart?.evidenceAnalysis?.positionFacts?.length,
    );
    assert.equal(
      chart?.evidenceAnalysis?.summaryFact?.aspectFactCount,
      chart?.evidenceAnalysis?.aspectFacts?.length,
    );
    assert.equal(
      chart?.evidenceAnalysis?.summaryFact?.distributionFactCount,
      chart?.evidenceAnalysis?.distributionEvidenceFacts?.length,
    );
    assert.equal(
      chart?.evidenceAnalysis?.summaryFact?.counterEvidenceCount,
      chart?.evidenceAnalysis?.counterEvidenceFacts?.length,
    );
    assert.equal(
      chart?.evidenceAnalysis?.summaryFact?.limitationFactCount,
      chart?.evidenceAnalysis?.limitationFacts?.length,
    );
    const astrolabeFactKeys = new Set([
      chart?.evidenceAnalysis?.summaryFact?.key,
      ...(chart?.evidenceAnalysis?.summaryFact?.factKeys ?? []),
    ]);
    assert.ok(
      chart?.evidenceAnalysis?.counterEvidenceFacts?.every(
        (item) =>
          item.ownerFactKeys.length > 0 &&
          item.ownerFactKeys.every((key) => astrolabeFactKeys.has(key)),
      ),
    );
    assert.ok(
      chart?.evidenceAnalysis?.limitationFacts?.every(
        (item) =>
          item.ownerFactKeys.length > 0 &&
          item.ownerFactKeys.every((key) => astrolabeFactKeys.has(key)),
      ),
    );
    const prompt = String(result.structuredContent?.prompt);
    assert.match(prompt, /占法：星盘/);
    assert.match(prompt, /星体位置：[\s\S]*宫头位置：[\s\S]*相位明细：/);
    assert.match(prompt, /【分析对象】\n分析对象：流年2028。/);
    assert.match(prompt, /行运证据：土星□太阳/);
    assert.doesNotMatch(prompt, /强度\d+%/);
    assert.doesNotMatch(prompt, /结构化证据|计算链|证据汇总|解释限制|必须以该范围/);
    assertPromptIsPortableTaskText(prompt);

    const yearlyResult = await client.callTool({
      name: 'astrolabe_prompt',
      arguments: {
        name: '本人',
        gender: '女',
        year: 1995,
        month: 5,
        day: 20,
        hour: 12,
        minute: 30,
        latitude: 39.9042,
        longitude: 116.4074,
        timezone: 8,
        question: '请看2028年的阶段重点。',
        astrolabeScope: 'yearly',
        astrolabeScopeDate: '2028',
      },
    });
    const scopeEvidence = (
      yearlyResult.structuredContent as {
        result?: {
          scopeEvidence?: {
            scope: string;
            solarReturnEvidence?: {
              key: string;
              calculationSteps: unknown[];
              calculationChain: string[];
              aspectFacts: Array<{ ownerFactKeys: string[] }>;
              summaryFact: {
                key: string;
                factKeys: string[];
                calculationStepCount: number;
                aspectFactCount: number;
                limitationFactCount: number;
              };
              limitationFacts: Array<{ ownerFactKeys: string[] }>;
              limitations: string[];
              promptText: string;
            };
            secondaryProgressionEvidence?: {
              key: string;
              calculationSteps: unknown[];
              calculationChain: string[];
              aspectFacts: Array<{ ownerFactKeys: string[] }>;
              summaryFact: {
                key: string;
                factKeys: string[];
                calculationStepCount: number;
                aspectFactCount: number;
                limitationFactCount: number;
              };
              limitationFacts: Array<{ ownerFactKeys: string[] }>;
              promptText: string;
            };
            solarArcEvidence?: {
              key: string;
              calculationSteps: unknown[];
              calculationChain: string[];
              aspectFacts: Array<{ ownerFactKeys: string[] }>;
              summaryFact: {
                key: string;
                factKeys: string[];
                calculationStepCount: number;
                aspectFactCount: number;
                limitationFactCount: number;
              };
              limitationFacts: Array<{ ownerFactKeys: string[] }>;
              promptText: string;
            };
          };
        };
      }
    ).result?.scopeEvidence;
    assert.equal(scopeEvidence?.scope, 'yearly');
    assert.equal(scopeEvidence?.solarReturnEvidence?.key, 'solar-return:2028');
    assert.equal(scopeEvidence?.secondaryProgressionEvidence?.key, 'secondary-progression:2028');
    assert.equal(scopeEvidence?.solarArcEvidence?.key, 'solar-arc:2028');
    assert.equal(
      scopeEvidence?.solarReturnEvidence?.limitations.length,
      scopeEvidence?.solarReturnEvidence?.limitationFacts.length,
    );
    for (const evidence of [
      scopeEvidence?.solarReturnEvidence,
      scopeEvidence?.secondaryProgressionEvidence,
      scopeEvidence?.solarArcEvidence,
    ]) {
      assert.ok(evidence);
      assert.equal(evidence.calculationChain.length, evidence.calculationSteps.length);
      assert.equal(evidence.summaryFact.calculationStepCount, evidence.calculationSteps.length);
      assert.equal(evidence.summaryFact.aspectFactCount, evidence.aspectFacts.length);
      assert.equal(evidence.summaryFact.limitationFactCount, evidence.limitationFacts.length);
      const factKeys = new Set([evidence.summaryFact.key, ...evidence.summaryFact.factKeys]);
      assert.ok(
        [...evidence.aspectFacts, ...evidence.limitationFacts].every(
          (item) =>
            item.ownerFactKeys.length > 0 && item.ownerFactKeys.every((key) => factKeys.has(key)),
        ),
      );
      assert.match(evidence.promptText, /证据汇总：/);
    }
  });
});

test('MCP 西占双盘提示词应返回跨盘资料和简明任务', async () => {
  await withMcpClient(async (client) => {
    const result = await client.callTool({
      name: 'astrolabe_synastry_prompt',
      arguments: {
        person1: {
          name: '甲',
          gender: '女',
          year: 1995,
          month: 5,
          day: 20,
          hour: 12,
          minute: 30,
          latitude: 39.9042,
          longitude: 116.4074,
          timezone: 8,
        },
        person2: {
          name: '乙',
          gender: '男',
          year: 1992,
          month: 8,
          day: 21,
          hour: 8,
          minute: 15,
          latitude: 31.2304,
          longitude: 121.4737,
          timezone: 8,
        },
        question: '我们的长期合作关系有哪些互补和张力？',
      },
    });

    assert.equal(result.isError, undefined);
    assert.ok(result.structuredContent?.result);
    const chart = (
      result.structuredContent as {
        result?: {
          synastry?: {
            generation?: {
              chart1: { input: { name: string } };
              chart2: { input: { name: string } };
              options: {
                pointNames: string[];
                aspectOrbs: Record<string, number>;
                includeHouseOverlays: boolean;
              };
              timestamp: number;
            };
            timestamp?: number;
            key?: string;
            status?: string;
            calculationSteps?: Array<{ key: string }>;
            aspects?: Array<{
              key: string;
              status: string;
              calculationStepKey: string;
              strength?: number;
              closeness?: string;
              orbRatio?: number;
              tendency?: string;
            }>;
            houseOverlays?: Array<{ key: string; status: string; calculationStepKey: string }>;
            summary?: { strongAspects?: number };
            counterEvidenceFacts?: unknown[];
            summaryFact?: { returnedAspectCount: number; houseOverlayCount: number };
            limitationFacts?: unknown[];
            promptText?: string;
          };
        };
      }
    ).result;
    assert.equal(chart?.synastry?.generation?.chart1.input.name, '甲');
    assert.equal(chart?.synastry?.generation?.chart2.input.name, '乙');
    assert.equal(chart?.synastry?.generation?.options.pointNames.length, 18);
    assert.equal(Object.keys(chart?.synastry?.generation?.options.aspectOrbs ?? {}).length, 5);
    assert.equal(chart?.synastry?.generation?.options.includeHouseOverlays, true);
    assert.equal(chart?.synastry?.generation?.timestamp, chart?.synastry?.timestamp);
    assert.equal(chart?.synastry?.key, 'astrolabe:synastry:evidence');
    assert.equal(chart?.synastry?.status, '已计算');
    assert.equal(chart?.synastry?.calculationSteps?.length, 7);
    for (const aspect of chart?.synastry?.aspects ?? []) {
      assert.match(aspect.key, /^astrolabe:synastry:aspect:/);
      assert.equal(aspect.status, '已命中');
      assert.equal(aspect.calculationStepKey, 'astrolabe:synastry:calculation:aspect-filter');
      assert.equal(aspect.strength, undefined);
      assert.equal(aspect.closeness, undefined);
      assert.equal(aspect.orbRatio, undefined);
      assert.equal(aspect.tendency, undefined);
    }
    for (const overlay of chart?.synastry?.houseOverlays ?? []) {
      assert.match(overlay.key, /^astrolabe:synastry:house-overlay:/);
      assert.equal(overlay.status, '已定位');
      assert.equal(overlay.calculationStepKey, 'astrolabe:synastry:calculation:house-overlays');
    }
    assert.equal(chart?.synastry?.summary?.strongAspects, undefined);
    assert.equal(chart?.synastry?.counterEvidenceFacts?.length, 3);
    assert.equal(chart?.synastry?.limitationFacts?.length, 5);
    assertEvidenceOwnerReferences(chart?.synastry);
    assert.equal(
      chart?.synastry?.summaryFact?.returnedAspectCount,
      chart?.synastry?.aspects?.length,
    );
    assert.equal(
      chart?.synastry?.summaryFact?.houseOverlayCount,
      chart?.synastry?.houseOverlays?.length,
    );
    assert.doesNotMatch(
      chart?.synastry?.promptText ?? '',
      /本项目|项目统一|工程|接口|API|MCP|astrolabe:synastry:/,
    );
    assertPromptIsPortableTaskText(chart?.synastry?.promptText ?? '');
    const prompt = String(result.structuredContent?.prompt);
    assert.match(prompt, /【第一人本命盘】/);
    assert.match(prompt, /【跨盘相位】/);
    assert.match(prompt, /【跨盘落宫】/);
    assert.match(
      prompt,
      /实际夹角\d+\.\d{2}°，精确角\d+\.\d{2}°，偏差\d+\.\d{2}°，采用容许度\d+\.\d{2}°/,
    );
    const crossAspectSection = prompt.match(/【跨盘相位】([\s\S]*?)【跨盘落宫】/)?.[1];
    assert.ok(crossAspectSection);
    assert.doesNotMatch(
      crossAspectSection,
      /紧密等级|中等等级|宽松等级|和谐相位|紧张相位|最近相位|最强相位|截断/,
    );
    assert.match(prompt, /分析互动主轴、互补点、张力点与现实触发条件/);
    assert.doesNotMatch(prompt, /不得输出|不得编造|只依据/);
    assert.doesNotMatch(prompt, /结构化证据|计算链概览|证据汇总|解释限制/);
    assert.doesNotMatch(prompt, /本项目|项目统一|工程|接口|API|MCP|astrolabe:synastry:/);
    assertPromptIsPortableTaskText(prompt);
  });
});

test('MCP 提示词工具应支持 custom 模式，并与页面和 API 保持一致口径', async () => {
  await withMcpClient(async (client) => {
    const baziResult = await client.callTool({
      name: 'bazi_prompt',
      arguments: {
        gender: 'male',
        year: 1990,
        month: 5,
        day: 15,
        timeIndex: 1,
        dateType: 'solar',
        question: '我更适合继续现在的工作，还是主动换方向？',
        promptMode: 'custom',
      },
    });
    assert.equal(baziResult.isError, undefined, 'bazi_prompt custom 不应返回错误');
    const baziPrompt = String(baziResult.structuredContent?.prompt);
    assert.doesNotMatch(baziPrompt, /【任务】/);
    assert.doesNotMatch(baziPrompt, /【输出要求】/);
    assertPromptIsPortableTaskText(baziPrompt);

    const tarotResult = await client.callTool({
      name: 'tarot_prompt',
      arguments: {
        spreadType: 'single',
        question: '这件事我现在该不该继续推进？',
        promptMode: 'custom',
      },
    });
    assert.equal(tarotResult.isError, undefined, 'tarot_prompt custom 不应返回错误');
    const tarotPrompt = String(tarotResult.structuredContent?.prompt);
    assert.doesNotMatch(tarotPrompt, /【任务】/);
    assert.doesNotMatch(tarotPrompt, /【输出要求】/);
    assertPromptIsPortableTaskText(tarotPrompt);

    const ziweiFrameworkResult = await client.callTool({
      name: 'ziwei_prompt',
      arguments: {
        gender: 'female',
        dateType: 'solar',
        year: '1992',
        month: '8',
        day: '21',
        timeIndex: 4,
        question: '请先做整体解读。',
        promptMode: 'framework',
      },
    });
    assert.equal(ziweiFrameworkResult.isError, undefined, 'ziwei_prompt framework 不应返回错误');
    const ziweiFrameworkPrompt = String(ziweiFrameworkResult.structuredContent?.prompt);
    assert.match(ziweiFrameworkPrompt, /分析主题：人生解析/);
    assert.match(ziweiFrameworkPrompt, /【重点宫位资料】/);
    assert.match(ziweiFrameworkPrompt, /基础十二宫、星曜、四化与运限由 iztro 排盘资料提供/);
    assert.match(ziweiFrameworkPrompt, /【任务】[\s\S]*请结合宫位、星曜、四化和三方四正/);
    assert.doesNotMatch(ziweiFrameworkPrompt, /四化、格局和三方四正/);
    assert.doesNotMatch(ziweiFrameworkPrompt, /自由问答先判断问题落在哪些宫位/);
    assertPromptIsPortableTaskText(ziweiFrameworkPrompt);
  });
});

test('MCP 塔罗与雷诺曼应返回分层结构化证据并写入提示词', async () => {
  await withMcpClient(async (client) => {
    const tarot = await client.callTool({
      name: 'divine_tarot',
      arguments: { spreadType: 'three', seed: 'MCP塔罗证据样例' },
    });
    const tarotData = tarot.structuredContent?.result as Record<string, any>;
    assert.equal(tarot.isError, undefined);
    assert.equal(tarotData.evidenceAnalysis.key, 'tarot:evidence');
    assert.equal(tarotData.evidenceAnalysis.status, '已计算');
    assert.equal(tarotData.evidenceAnalysis.calculationSteps.length, 7);
    const tarotStepKeys = new Set(
      tarotData.evidenceAnalysis.calculationSteps.map((item: Record<string, unknown>) => item.key),
    );
    assert.ok(
      tarotData.evidenceAnalysis.calculationSteps.every(
        (item: Record<string, any>) =>
          ['已计算', '资料不足'].includes(item.status) &&
          item.promptText &&
          Array.isArray(item.sources) &&
          item.sources.length > 0 &&
          item.dependsOnStepKeys.every((key: string) => tarotStepKeys.has(key)),
      ),
    );
    assert.equal(
      tarotData.evidenceAnalysis.calculationChain.length,
      tarotData.evidenceAnalysis.calculationSteps.length,
    );
    assert.equal(tarotData.evidenceAnalysis.cards.length, 3);
    assert.equal(tarotData.evidenceAnalysis.spreadCoverageFact.status, '完整');
    assert.equal(tarotData.evidenceAnalysis.spreadCoverageFact.cardFactKeys.length, 3);
    assert.equal(tarotData.evidenceAnalysis.drawFact.status, '可核验');
    assert.equal(tarotData.evidenceAnalysis.drawFact.deckSize, 78);
    assert.equal(tarotData.evidenceAnalysis.drawFact.order.length, 3);
    assert.equal(tarotData.evidenceAnalysis.drawOrderFacts.length, 3);
    assert.ok(
      tarotData.evidenceAnalysis.drawOrderFacts.every(
        (item: Record<string, unknown>) => item.status === '一致' && item.cardFactKey,
      ),
    );
    assert.deepEqual(
      tarotData.evidenceAnalysis.drawFact.orderFactKeys,
      tarotData.evidenceAnalysis.drawOrderFacts.map((item: Record<string, unknown>) => item.key),
    );
    assert.ok(tarotData.evidenceAnalysis.drawFact.sources.length >= 2);
    assert.equal(tarotData.evidenceAnalysis.sequenceFacts.length, 2);
    assert.ok(
      tarotData.evidenceAnalysis.sequenceFacts.every(
        (item: Record<string, unknown>) =>
          item.fromCardKey && item.toCardKey && String(item.limitation).includes('不得把牌阵顺序'),
      ),
    );
    assert.equal(tarotData.evidenceAnalysis.themeFacts.length, 0);
    assert.equal(
      tarotData.evidenceAnalysis.recurringThemes.length,
      tarotData.evidenceAnalysis.recurringThemeFacts.length,
    );
    assert.equal(
      tarotData.evidenceAnalysis.counterEvidence.length,
      tarotData.evidenceAnalysis.counterEvidenceFacts.length,
    );
    assert.equal(tarotData.evidenceAnalysis.limitationFacts.length, 6);
    assert.ok(
      tarotData.evidenceAnalysis.limitationFacts.every(
        (item: Record<string, any>) =>
          Array.isArray(item.ownerFactKeys) &&
          item.ownerFactKeys.length > 0 &&
          item.ownerFactKeys.every(
            (key: string) =>
              key === tarotData.evidenceAnalysis.summaryFact.key ||
              tarotData.evidenceAnalysis.summaryFact.factKeys.includes(key),
          ),
      ),
    );
    assert.equal(
      tarotData.evidenceAnalysis.limitations.length,
      tarotData.evidenceAnalysis.limitationFacts.length,
    );
    assert.equal(tarotData.evidenceAnalysis.randomFact.status, '可重放');
    assert.equal(
      tarotData.evidenceAnalysis.randomFact.sampleCount,
      tarotData.meta.random.samples.length,
    );
    assert.doesNotMatch(tarotData.evidenceAnalysis.randomFact.promptText, /MCP塔罗证据样例/);
    assert.equal(tarotData.evidenceAnalysis.elementInteractionFacts.length, 0);
    assert.equal(tarotData.evidenceAnalysis.counterEvidenceFacts.length, 0);
    assert.equal(tarotData.evidenceAnalysis.counterSummaryFact.status, '解释规则待校');
    assert.equal(tarotData.evidenceAnalysis.traditionalFacts.length, 0);
    assert.equal(tarotData.evidenceAnalysis.summaryFact.key, 'tarot:evidence-summary');
    assert.equal(tarotData.evidenceAnalysis.summaryFact.status, '证据链有缺口');
    assert.equal(
      tarotData.evidenceAnalysis.summaryFact.cardFactCount,
      tarotData.evidenceAnalysis.cards.length,
    );
    assert.equal(
      tarotData.evidenceAnalysis.summaryFact.drawOrderFactCount,
      tarotData.evidenceAnalysis.drawOrderFacts.length,
    );
    assert.equal(
      tarotData.evidenceAnalysis.summaryFact.sequenceFactCount,
      tarotData.evidenceAnalysis.sequenceFacts.length,
    );
    assert.equal(
      tarotData.evidenceAnalysis.summaryFact.themeFactCount,
      tarotData.evidenceAnalysis.themeFacts.length,
    );
    assert.equal(
      tarotData.evidenceAnalysis.summaryFact.recurringThemeFactCount,
      tarotData.evidenceAnalysis.recurringThemeFacts.length,
    );
    assert.equal(
      tarotData.evidenceAnalysis.summaryFact.counterEvidenceCount,
      tarotData.evidenceAnalysis.counterEvidenceFacts.length,
    );
    assert.equal(
      tarotData.evidenceAnalysis.summaryFact.traditionalFactCount,
      tarotData.evidenceAnalysis.traditionalFacts.length,
    );
    assert.ok(
      tarotData.evidenceAnalysis.cards.every(
        (item: Record<string, unknown>) =>
          item.traditionalFactKey === null &&
          Array.isArray(item.keywords) &&
          item.keywords.length === 0,
      ),
    );

    const tarotPromptResult = await client.callTool({
      name: 'tarot_prompt',
      arguments: { spreadType: 'three', seed: 'MCP塔罗证据样例', question: '如何推进？' },
    });
    const tarotPrompt = String(tarotPromptResult.structuredContent?.prompt);
    assert.match(tarotPrompt, /占法：塔罗/);
    assert.match(tarotPrompt, /核心结构：牌阵[\s\S]*牌位明细：/);
    assert.match(tarotPrompt, /牌义状态：.*尚未完成校勘/);
    assert.doesNotMatch(tarotPrompt, /结构化证据|计算链|证据汇总|解释限制|解释边界/);
    assert.doesNotMatch(tarotPrompt, /关键词：|牌义：|元素主题：|牌阶主题：|表示这些能量正在直接发挥作用|信息被隐藏/);
    assertPromptIsPortableTaskText(tarotPrompt);

    const lenormand = await client.callTool({
      name: 'divine_lenormand',
      arguments: { spreadType: 'nine', seed: 'MCP雷诺曼证据样例' },
    });
    const lenormandData = lenormand.structuredContent?.result as Record<string, any>;
    assert.equal(lenormand.isError, undefined);
    assert.equal(lenormandData.evidenceAnalysis.key, 'lenormand:evidence');
    assert.equal(lenormandData.evidenceAnalysis.status, '已计算');
    assert.equal(lenormandData.evidenceAnalysis.calculationSteps.length, 8);
    const lenormandStepKeys = new Set(
      lenormandData.evidenceAnalysis.calculationSteps.map(
        (item: Record<string, unknown>) => item.key,
      ),
    );
    assert.ok(
      lenormandData.evidenceAnalysis.calculationSteps.every(
        (item: Record<string, any>) =>
          ['已计算', '资料不足'].includes(item.status) &&
          item.promptText &&
          Array.isArray(item.sources) &&
          item.sources.length > 0 &&
          item.dependsOnStepKeys.every((key: string) => lenormandStepKeys.has(key)),
      ),
    );
    assert.equal(
      lenormandData.evidenceAnalysis.calculationChain.length,
      lenormandData.evidenceAnalysis.calculationSteps.length,
    );
    assert.ok(Array.isArray(lenormandData.evidenceAnalysis.fixedCombinations));
    assert.ok(Array.isArray(lenormandData.evidenceAnalysis.adjacentReadings));
    assert.equal(lenormandData.evidenceAnalysis.spreadCoverageFact.status, '完整');
    assert.equal(lenormandData.evidenceAnalysis.spreadCoverageFact.cardFactKeys.length, 9);
    assert.equal(lenormandData.evidenceAnalysis.drawFact.status, '可核验');
    assert.equal(lenormandData.evidenceAnalysis.drawFact.deckSize, 36);
    assert.equal(lenormandData.evidenceAnalysis.drawFact.order.length, 9);
    assert.equal(lenormandData.evidenceAnalysis.drawOrderFacts.length, 9);
    assert.ok(
      lenormandData.evidenceAnalysis.drawOrderFacts.every(
        (item: Record<string, unknown>) => item.status === '一致' && item.cardFactKey,
      ),
    );
    assert.equal(lenormandData.evidenceAnalysis.sequenceFacts.length, 8);
    assert.equal(lenormandData.evidenceAnalysis.layoutCoverageFact.status, '结构缺失');
    assert.equal(lenormandData.evidenceAnalysis.counterEvidenceFacts.length, 2);
    assert.equal(lenormandData.evidenceAnalysis.limitationFacts.length, 6);
    assert.ok(
      lenormandData.evidenceAnalysis.limitationFacts.every(
        (item: Record<string, any>) =>
          Array.isArray(item.ownerFactKeys) &&
          item.ownerFactKeys.length > 0 &&
          item.ownerFactKeys.every(
            (key: string) =>
              key === lenormandData.evidenceAnalysis.summaryFact.key ||
              lenormandData.evidenceAnalysis.summaryFact.factKeys.includes(key),
          ),
      ),
    );
    assert.ok(lenormandData.evidenceAnalysis.drawFact.sources.length >= 2);
    assert.equal(lenormandData.evidenceAnalysis.randomFact.status, '可重放');
    assert.equal(lenormandData.evidenceAnalysis.randomFact.seed, 'MCP雷诺曼证据样例');
    assert.doesNotMatch(lenormandData.evidenceAnalysis.randomFact.promptText, /MCP雷诺曼证据样例/);
    assert.deepEqual(lenormandData.evidenceAnalysis.traditionalFacts, []);
    assert.deepEqual(lenormandData.evidenceAnalysis.structuredLayoutFacts, []);
    assert.equal(lenormandData.evidenceAnalysis.summaryFact.key, 'lenormand:evidence-summary');
    assert.equal(lenormandData.evidenceAnalysis.summaryFact.status, '证据链有缺口');
    assert.equal(
      lenormandData.evidenceAnalysis.summaryFact.cardFactCount,
      lenormandData.evidenceAnalysis.cards.length,
    );
    assert.equal(
      lenormandData.evidenceAnalysis.summaryFact.drawOrderFactCount,
      lenormandData.evidenceAnalysis.drawOrderFacts.length,
    );
    assert.equal(
      lenormandData.evidenceAnalysis.summaryFact.sequenceFactCount,
      lenormandData.evidenceAnalysis.sequenceFacts.length,
    );
    assert.equal(
      lenormandData.evidenceAnalysis.summaryFact.fixedCombinationCount,
      lenormandData.evidenceAnalysis.fixedCombinations.length,
    );
    assert.equal(
      lenormandData.evidenceAnalysis.summaryFact.adjacentReadingCount,
      lenormandData.evidenceAnalysis.adjacentReadings.length,
    );
    assert.equal(
      lenormandData.evidenceAnalysis.summaryFact.structuredLayoutFactCount,
      lenormandData.evidenceAnalysis.structuredLayoutFacts.length,
    );
    assert.equal(
      lenormandData.evidenceAnalysis.summaryFact.counterEvidenceCount,
      lenormandData.evidenceAnalysis.counterEvidenceFacts.length,
    );
    assert.equal(
      lenormandData.evidenceAnalysis.summaryFact.traditionalFactCount,
      lenormandData.evidenceAnalysis.traditionalFacts.length,
    );
    assert.ok(
      lenormandData.evidenceAnalysis.traditionalFacts.every(
        (item: Record<string, unknown>) =>
          item.status === '已映射' &&
          Array.isArray(item.cardFactKeys) &&
          item.cardFactKeys.length > 0 &&
          item.originalText &&
          item.promptText &&
          Array.isArray(item.verificationTargets) &&
          item.verificationTargets.length > 0 &&
          Array.isArray(item.sources) &&
          item.sources.length > 0 &&
          String(item.limitation).includes('不证明现实事件'),
      ),
    );
    assert.ok(
      lenormandData.evidenceAnalysis.structuredLayoutFacts.every(
        (item: Record<string, unknown>) =>
          item.status === '已计算' &&
          Array.isArray(item.cardFactKeys) &&
          Array.isArray(item.sources),
      ),
    );

    const lenormandPromptResult = await client.callTool({
      name: 'lenormand_prompt',
      arguments: { spreadType: 'nine', seed: 'MCP雷诺曼证据样例', question: '有哪些线索？' },
    });
    const lenormandPrompt = String(lenormandPromptResult.structuredContent?.prompt);
    assert.match(lenormandPrompt, /占法：雷诺曼/);
    assert.match(lenormandPrompt, /牌位顺序：[\s\S]*牌位明细：/);
    assert.match(lenormandPrompt, /牌义状态：关键词、单牌牌义、固定组合、相邻合读和布局解释均待具体版本校勘/);
    assert.doesNotMatch(lenormandPrompt, /关键词：|牌义：|组合明细：/);
    assert.doesNotMatch(lenormandPrompt, /结构化证据|计算链|证据汇总|解释限制|解释边界/);
    assert.doesNotMatch(
      lenormandPrompt,
      /感情的承诺或婚约|家庭添丁|通过网络\/远程获利|隐藏在迷雾中的欺骗/,
    );
    assert.doesNotMatch(
      `${tarotPrompt}\n${lenormandPrompt}`,
      /成功率为\d|成功率提升至|吉凶总分[：=]\d/,
    );
    assertPromptIsPortableTaskText(lenormandPrompt);
  });
});

test('MCP 灵签应输出仪式证据，并在拒签时不泄露未确认签文', async () => {
  await withMcpClient(async (client) => {
    const confirmed = await client.callTool({
      name: 'ssgw_prompt',
      arguments: {
        question: '这件事应该怎样核实现实条件？',
        replay: [0.1, 0.1, 0.9],
      },
    });
    assert.equal(confirmed.isError, undefined);
    assert.equal(confirmed.structuredContent?.result.ritual.confirmed, true);
    assert.equal(confirmed.structuredContent?.result.evidenceAnalysis.key, 'ssgw:evidence');
    assert.equal(confirmed.structuredContent?.result.evidenceAnalysis.status, '已计算');
    assert.equal(confirmed.structuredContent?.result.evidenceAnalysis.calculationSteps.length, 8);
    const ssgwStepKeys = new Set(
      confirmed.structuredContent?.result.evidenceAnalysis.calculationSteps.map(
        (item: Record<string, unknown>) => item.key,
      ),
    );
    assert.ok(
      confirmed.structuredContent?.result.evidenceAnalysis.calculationSteps.every(
        (item: Record<string, any>) =>
          item.status === '已计算' &&
          item.promptText &&
          Array.isArray(item.sources) &&
          item.sources.length > 0 &&
          item.dependsOnStepKeys.every((key: string) => ssgwStepKeys.has(key)),
      ),
    );
    assert.equal(
      confirmed.structuredContent?.result.evidenceAnalysis.calculationChain.length,
      confirmed.structuredContent?.result.evidenceAnalysis.calculationSteps.length,
    );
    assert.equal(confirmed.structuredContent?.result.evidenceAnalysis.drawFact.status, '可核验');
    assert.equal(confirmed.structuredContent?.result.evidenceAnalysis.signFact.status, '签诗为空');
    assert.equal(
      confirmed.structuredContent?.result.evidenceAnalysis.coverageFact.key,
      'ssgw:interpretation-coverage',
    );
    assert.equal(confirmed.structuredContent?.result.evidenceAnalysis.interpretationFacts.length, 0);
    assert.equal(confirmed.structuredContent?.result.evidenceAnalysis.coverageFact.status, '存在缺口');
    assert.equal(confirmed.structuredContent?.result.evidenceAnalysis.ritualFact.status, '已确认');
    assert.equal(
      confirmed.structuredContent?.result.evidenceAnalysis.ritualThrowFacts[0].key,
      'ssgw:ritual-throw:1',
    );
    assert.equal(
      confirmed.structuredContent?.result.evidenceAnalysis.ritualThrowFacts[0].status,
      '已记录',
    );
    assert.equal(
      confirmed.structuredContent?.result.evidenceAnalysis.ritualThrowFacts[0].ritualFactKey,
      '仪式:掷筊确认',
    );
    assert.equal(confirmed.structuredContent?.result.evidenceAnalysis.randomFact.sampleCount, 3);
    assert.match(
      String(confirmed.structuredContent?.result.evidenceAnalysis.randomFact.limitation),
      /不表示可信度/,
    );
    const confirmedPrompt = String(confirmed.structuredContent?.prompt);
    assert.match(confirmedPrompt, /占法：三山国王灵签/);
    assert.match(confirmedPrompt, /掷筊记录：/);
    assert.match(confirmedPrompt, /签谱状态：来源尚未完成校勘/);
    assert.doesNotMatch(confirmedPrompt, /签题：|签诗：|典故：|签意：/);
    assert.doesNotMatch(confirmedPrompt, /结构化证据|计算链|证据汇总|解释限制|解释边界/);
    assert.equal(
      confirmed.structuredContent?.result.evidenceAnalysis.counterEvidenceFacts.length,
      6,
    );
    assert.equal(
      confirmed.structuredContent?.result.evidenceAnalysis.counterSummaryFact.status,
      '未见额外反证',
    );
    assert.equal(
      confirmed.structuredContent?.result.evidenceAnalysis.counterSummaryFact.factKeys.length,
      0,
    );
    assert.equal(confirmed.structuredContent?.result.evidenceAnalysis.limitationFacts.length, 6);
    assert.equal(
      confirmed.structuredContent?.result.evidenceAnalysis.summaryFact.key,
      'ssgw:evidence-summary',
    );
    assert.equal(
      confirmed.structuredContent?.result.evidenceAnalysis.summaryFact.status,
      '证据链有缺口',
    );
    assert.equal(
      confirmed.structuredContent?.result.evidenceAnalysis.summaryFact.interpretationFactCount,
      confirmed.structuredContent?.result.evidenceAnalysis.interpretationFacts.length,
    );
    assert.equal(
      confirmed.structuredContent?.result.evidenceAnalysis.summaryFact.missingFieldFactCount,
      confirmed.structuredContent?.result.evidenceAnalysis.missingFieldFacts.length,
    );
    assert.equal(
      confirmed.structuredContent?.result.evidenceAnalysis.summaryFact.ritualThrowFactCount,
      confirmed.structuredContent?.result.evidenceAnalysis.ritualThrowFacts.length,
    );
    assert.equal(
      confirmed.structuredContent?.result.evidenceAnalysis.summaryFact.counterEvidenceCount,
      confirmed.structuredContent?.result.evidenceAnalysis.counterEvidenceFacts.length,
    );
    assert.equal(
      confirmed.structuredContent?.result.evidenceAnalysis.summaryFact.sourceFactCount,
      confirmed.structuredContent?.result.evidenceAnalysis.sourceFacts.length,
    );
    assert.ok(
      confirmed.structuredContent?.result.evidenceAnalysis.limitationFacts.every(
        (item: Record<string, any>) =>
          Array.isArray(item.ownerFactKeys) &&
          item.ownerFactKeys.length > 0 &&
          item.ownerFactKeys.every(
            (key: string) =>
              key === confirmed.structuredContent?.result.evidenceAnalysis.summaryFact.key ||
              confirmed.structuredContent?.result.evidenceAnalysis.summaryFact.factKeys.includes(
                key,
              ),
          ),
      ),
    );
    assert.equal(
      confirmed.structuredContent?.result.evidenceAnalysis.limitations.length,
      confirmed.structuredContent?.result.evidenceAnalysis.limitationFacts.length,
    );
    assert.doesNotMatch(
      confirmedPrompt,
      /项目模拟|项目资料|按项目仪式规则|命语|本项目|项目统一|工程|算法结果/,
    );
    assertPromptIsPortableTaskText(confirmedPrompt);

    const rejected = await client.callTool({
      name: 'ssgw_prompt',
      arguments: {
        question: '这件事应该怎样核实现实条件？',
        replay: [0.1, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9],
      },
    });
    assert.equal(rejected.isError, undefined);
    assert.equal(rejected.structuredContent?.result.rejected, true);
    assert.equal(rejected.structuredContent?.result.poem, undefined);
    assert.doesNotMatch(String(rejected.structuredContent?.prompt), /签诗：/);
    assert.match(String(rejected.structuredContent?.prompt), /连续三次阴杯|拒绝起签/);
  });
});

test('MCP 八字与紫微工具应支持真太阳时入参', async () => {
  await withMcpClient(async (client) => {
    const baziPerson = {
      gender: 'male' as const,
      year: 1990,
      month: 5,
      day: 15,
      timeIndex: 1,
      isLunar: false,
      useTrueSolarTime: true,
      birthHour: 1,
      birthMinute: 20,
      birthLongitude: 73.5,
    };
    const baziExpected = baziCalculator.calculateBazi(baziPerson);
    const baziResult = await client.callTool({
      name: 'bazi_calculate',
      arguments: {
        gender: baziPerson.gender,
        year: baziPerson.year,
        month: baziPerson.month,
        day: baziPerson.day,
        dateType: 'solar',
        useTrueSolarTime: true,
        birthHour: baziPerson.birthHour,
        birthMinute: baziPerson.birthMinute,
        birthLongitude: baziPerson.birthLongitude,
      },
    });

    assert.equal(baziResult.isError, undefined, 'bazi_calculate 真太阳时不应返回错误');
    const baziChart = baziResult.structuredContent?.result as {
      timing?: {
        correctedTime?: { hour?: number; minute?: number };
        dstCorrectionMinutes?: number;
        evidence?: {
          status: string;
          calculationSteps: unknown[];
          summaryFact: { calculationStepCount: number };
          promptText: string;
        };
      };
      warningFacts?: Array<{ key: string; sources: string[]; referenceKeys: string[] }>;
      warningSummaryFact?: { status: string; factKeys: string[] };
    };
    assert.equal(baziChart.timing?.correctedTime?.hour, baziExpected.timing?.correctedTime.hour);
    assert.equal(
      baziChart.timing?.correctedTime?.minute,
      baziExpected.timing?.correctedTime.minute,
    );
    assert.equal(baziChart.timing?.dstCorrectionMinutes, baziExpected.timing?.dstCorrectionMinutes);
    assert.equal(baziChart.timing?.evidence?.status, '已计算');
    assert.equal(baziChart.timing?.evidence?.calculationSteps.length, 7);
    assert.equal(
      baziChart.timing?.evidence?.summaryFact.calculationStepCount,
      baziChart.timing?.evidence?.calculationSteps.length,
    );
    assert.match(baziChart.timing?.evidence?.promptText ?? '', /唯一映射为/);
    assert.equal(baziChart.warningFacts?.length, baziExpected.warningFacts.length);
    assert.equal(baziChart.warningSummaryFact?.status, baziExpected.warningSummaryFact.status);
    assert.ok(
      baziChart.warningFacts?.every(
        (fact) =>
          fact.key.startsWith('bazi:warning:') &&
          fact.sources.length > 0 &&
          fact.referenceKeys.length > 0,
      ),
    );

    const ziweiCorrected = calculateTrueSolarTime(
      {
        year: 1992,
        month: 8,
        day: 21,
        hour: 1,
        minute: 20,
      },
      73.5,
    ).correctedTime;
    const ziweiTimeIndex = getTimeIndexFromClock(ziweiCorrected.hour, ziweiCorrected.minute);
    const ziweiTimeInfo = TIME_MAP[ziweiTimeIndex];
    const ziweiResult = await client.callTool({
      name: 'ziwei_calculate',
      arguments: {
        gender: 'female',
        dateType: 'solar',
        year: '1992',
        month: '8',
        day: '21',
        useTrueSolarTime: true,
        birthHour: '1',
        birthMinute: '20',
        birthLongitude: '73.5',
      },
    });

    assert.equal(ziweiResult.isError, undefined, 'ziwei_calculate 真太阳时不应返回错误');
    const ziweiChart = ziweiResult.structuredContent as {
      basicInfo?: { birth_time_label?: string; birth_time_range?: string };
      trueSolarEvidence?: {
        status: string;
        calculationSteps: unknown[];
        summaryFact: { status: string };
      };
    };
    assert.equal(ziweiChart.basicInfo?.birth_time_label, ziweiTimeInfo.name);
    assert.equal(ziweiChart.basicInfo?.birth_time_range, ziweiTimeInfo.range.replace('-', '~'));
    assert.equal(ziweiChart.trueSolarEvidence?.status, '已计算');
    assert.equal(ziweiChart.trueSolarEvidence?.calculationSteps.length, 7);
    assert.equal(ziweiChart.trueSolarEvidence?.summaryFact.status, '证据链完整');

    const ziweiPromptResult = await client.callTool({
      name: 'ziwei_prompt',
      arguments: {
        gender: 'female',
        dateType: 'solar',
        year: '1992',
        month: '8',
        day: '21',
        useTrueSolarTime: true,
        birthHour: '1',
        birthMinute: '20',
        birthLongitude: '73.5',
        question: '请分析整体命盘。',
      },
    });
    assert.equal(ziweiPromptResult.isError, undefined);
    const ziweiPrompt = String(ziweiPromptResult.structuredContent?.prompt ?? '');
    assert.match(ziweiPrompt, /【出生时间校正】/);
    assert.match(ziweiPrompt, /钟表时间|真太阳时/);
    assert.doesNotMatch(ziweiPrompt, /结构化证据|计算步骤|出生时间敏感性|候选时辰|缺时柱/);

    const astrolabePromptResult = await client.callTool({
      name: 'astrolabe_prompt',
      arguments: {
        name: '本人',
        gender: '女',
        year: 1995,
        month: 5,
        day: 20,
        hour: 1,
        minute: 20,
        latitude: 39.9042,
        longitude: 73.5,
        timezone: 8,
        timeZoneId: 'Asia/Shanghai',
        locationName: '喀什',
        useTrueSolarTime: true,
        question: '请分析整体星盘。',
      },
    });
    assert.equal(astrolabePromptResult.isError, undefined);
    const astrolabePromptResultData = astrolabePromptResult.structuredContent as {
      result?: {
        birth?: { trueSolarEvidence?: { status: string; calculationSteps: unknown[] } };
        evidenceAnalysis?: { trueSolarTimeFact?: { key: string } };
      };
      prompt?: string;
    };
    assert.equal(astrolabePromptResultData.result?.birth?.trueSolarEvidence?.status, '已计算');
    assert.equal(
      astrolabePromptResultData.result?.birth?.trueSolarEvidence?.calculationSteps.length,
      7,
    );
    assert.ok(astrolabePromptResultData.result?.evidenceAnalysis?.trueSolarTimeFact?.key);
    assert.match(
      astrolabePromptResultData.prompt ?? '',
      /出生时间参考：民用时间.*进入现代星历计算；真太阳时.*仅作传统时间参考/,
    );
    assert.doesNotMatch(astrolabePromptResultData.prompt ?? '', /采用真太阳时排盘/);
    assert.doesNotMatch(
      astrolabePromptResultData.prompt ?? '',
      /结构化证据|计算链|证据汇总|解释限制/,
    );
  });
});

test('MCP 紫微真太阳时参数缺失或越界时应返回明确错误', async () => {
  await withMcpClient(async (client) => {
    const invalidCalls: Array<[string, Record<string, unknown>, RegExp]> = [
      [
        'ziwei_calculate',
        {
          gender: 'female',
          dateType: 'solar',
          year: '1992',
          month: '8',
          day: '21',
          useTrueSolarTime: true,
          birthHour: '1',
          birthMinute: '20',
        },
        /birthLongitude 必须是数字/,
      ],
      [
        'ziwei_prompt',
        {
          gender: 'female',
          dateType: 'solar',
          year: '1992',
          month: '8',
          day: '21',
          useTrueSolarTime: true,
          birthHour: '24',
          birthMinute: '20',
          birthLongitude: '73.5',
          question: '看看整体。',
        },
        /birthHour 不能大于 23/,
      ],
      [
        'ziwei_calculate',
        {
          gender: 'female',
          dateType: 'solar',
          year: '1992',
          month: '8',
          day: '21',
          useTrueSolarTime: true,
          birthHour: '1',
          birthMinute: '60',
          birthLongitude: '73.5',
        },
        /birthMinute 不能大于 59/,
      ],
      [
        'ziwei_prompt',
        {
          gender: 'female',
          dateType: 'solar',
          year: '1992',
          month: '8',
          day: '21',
          useTrueSolarTime: true,
          birthHour: '1',
          birthMinute: '20',
          birthLongitude: '181',
          question: '看看整体。',
        },
        /birthLongitude 不能大于 180/,
      ],
    ];

    for (const [name, args, messagePattern] of invalidCalls) {
      const result = await client.callTool({ name, arguments: args });
      assert.equal(result.isError, true, `${name} 应返回真太阳时参数错误`);
      assert.match(
        String((result.structuredContent as { error?: string } | undefined)?.error),
        messagePattern,
        `${name} 应返回明确的真太阳时参数错误`,
      );
    }
  });
});

test('MCP 数值范围错误应返回结构化业务错误', async () => {
  await withMcpClient(async (client) => {
    const invalidCalls: Array<[string, Record<string, unknown>, RegExp]> = [
      [
        'bazi_calculate',
        { gender: 'male', year: 1990, month: 5, day: 15, timeIndex: 99, dateType: 'solar' },
        /timeIndex 不能大于 12/,
      ],
      [
        'bazi_prompt',
        {
          gender: 'male',
          year: 1990,
          month: 5,
          day: 15,
          dateType: 'solar',
          useTrueSolarTime: true,
          birthHour: 24,
          birthMinute: 20,
          birthLongitude: 116.4,
          question: '看看整体。',
        },
        /birthHour 不能大于 23/,
      ],
      [
        'divine_almanac',
        {
          topic: 'move',
          startDate: '2026-06-01',
          endDate: '2026-06-03',
          participants: [
            {
              id: 'self',
              gender: '男',
              year: 1990,
              month: 1,
              day: 1,
              timeIndex: 99,
              dateType: 'solar',
            },
          ],
        },
        /timeIndex 不能大于 12/,
      ],
      [
        'divine_astrolabe',
        {
          year: 1995,
          month: 5,
          day: 20,
          hour: 12,
          minute: 30,
          latitude: 39.9042,
          longitude: 181,
          timezone: 8,
        },
        /longitude 不能大于 180/,
      ],
    ];

    for (const [name, args, messagePattern] of invalidCalls) {
      const result = await client.callTool({ name, arguments: args });
      assert.equal(result.isError, true, `${name} 应返回数值参数错误`);
      assert.match(
        String((result.structuredContent as { error?: string } | undefined)?.error),
        messagePattern,
        `${name} 应返回结构化业务错误`,
      );
    }
  });
});

test('MCP 八字与紫微工具应拒绝不存在的出生日期', async () => {
  await withMcpClient(async (client) => {
    const invalidCalls: Array<[string, Record<string, unknown>, RegExp]> = [
      [
        'bazi_calculate',
        { gender: 'male', year: 2024, month: 2, day: 31, timeIndex: 0, dateType: 'solar' },
        /日期需在 1-29 之间/,
      ],
      [
        'bazi_prompt',
        {
          gender: 'male',
          year: 2024,
          month: 2,
          day: 31,
          timeIndex: 0,
          dateType: 'solar',
          question: '看看事业。',
        },
        /日期需在 1-29 之间/,
      ],
      [
        'bazi_calculate',
        {
          gender: 'male',
          year: 2024,
          month: 1,
          day: 1,
          timeIndex: 0,
          dateType: 'lunar',
          isLeapMonth: true,
        },
        /农历日期不存在/,
      ],
      [
        'ziwei_calculate',
        { gender: 'male', dateType: 'solar', year: '2024', month: '2', day: '31', timeIndex: 0 },
        /日期需在 1-29 之间/,
      ],
      [
        'ziwei_prompt',
        {
          gender: 'male',
          dateType: 'lunar',
          year: '2024',
          month: '1',
          day: '1',
          timeIndex: 0,
          isLeapMonth: true,
          question: '看看事业。',
        },
        /农历日期不存在/,
      ],
    ];

    for (const [name, args, messagePattern] of invalidCalls) {
      const result = await client.callTool({ name, arguments: args });
      assert.equal(result.isError, true, `${name} 应返回错误`);
      assert.match(
        String((result.structuredContent as { error?: string } | undefined)?.error),
        messagePattern,
        `${name} 应返回明确的出生日期错误`,
      );
    }
  });
});

test('MCP 七政四余应返回十一星、真实距星宿界、证据链与提示词', async () => {
  await withMcpClient(async (client) => {
    const arguments_ = {
      year: 2024,
      month: 6,
      day: 15,
      hour: 12,
      minute: 0,
      latitude: 39.9,
      longitude: 116.4,
      timezone: 8,
    };
    const chartResponse = await client.callTool({
      name: 'metaphysics_qizheng',
      arguments: arguments_,
    });
    assert.equal(chartResponse.isError, undefined);
    const chart = (
      chartResponse.structuredContent as {
        result: {
          generation: {
            input: Record<string, unknown>;
            timestamp: number;
          };
          stars: Array<{
            precisionClass: string;
            tropicalZodiac: string;
            branch: string;
            branchIndex: number;
          }>;
          pairwiseAngles: unknown[];
          geometryCalculation: { complete: boolean };
          traditionalRuleAudit: {
            chart: { status: string };
            dignity: { status: string };
            aspects: { status: string };
          };
          traditionalChartRuleCatalog: unknown[];
          traditionalChartFacts: unknown[];
          traditionalYearBasis: { status: string; adoptedYearGanZhi?: string };
          shenshaFacts: Array<{
            name: string;
            basis: string;
            sourceQuote: string;
            limitation: string;
          }>;
          aspects: unknown[];
          mansionBoundaries: unknown[];
          mansionModel: { id: string };
          evidenceAnalysis: {
            status: string;
            pairGeometryFacts: unknown[];
            traditionalChartFacts: unknown[];
            summaryFact: { status: string };
          };
        };
      }
    ).result;
    assert.deepEqual(chart.generation.input, arguments_);
    assert.ok(Number.isSafeInteger(chart.generation.timestamp));
    assert.equal(chart.stars.length, 11);
    assert.equal(chart.mansionBoundaries.length, 28);
    assert.equal(chart.pairwiseAngles.length, 55);
    assert.equal(chart.evidenceAnalysis.pairGeometryFacts.length, 55);
    assert.equal(chart.geometryCalculation.complete, true);
    assert.deepEqual(chart.aspects, []);
    assert.equal(chart.traditionalRuleAudit.chart.status, '已校勘');
    assert.equal(chart.traditionalRuleAudit.dignity.status, '未采用');
    assert.equal(chart.traditionalRuleAudit.aspects.status, '未采用');
    assert.equal(chart.traditionalChartRuleCatalog.length, 5);
    assert.equal(chart.traditionalChartFacts.length, 5);
    assert.equal(chart.evidenceAnalysis.traditionalChartFacts.length, 5);
    assert.ok(
      chart.stars.every(
        (star) =>
          star.tropicalZodiac.length > 0 && star.branch.length === 1 && star.branchIndex >= 0,
      ),
    );
    assert.equal(chart.traditionalYearBasis.status, '年干支口径一致');
    assert.equal(chart.traditionalYearBasis.adoptedYearGanZhi, '甲辰');
    assert.equal(chart.shenshaFacts.length, 8);
    assert.deepEqual(
      chart.shenshaFacts.map((fact) => fact.name),
      ['天乙（昼贵）', '玉堂（夜贵）', '驿马', '华盖', '劫煞', '咸池', '孤辰', '寡宿'],
    );
    assert.ok(
      chart.shenshaFacts.every(
        (fact) =>
          ['年干', '年支'].includes(fact.basis) &&
          fact.sourceQuote.length > 0 &&
          fact.limitation.includes('目标支不等于已经落入'),
      ),
    );
    assert.equal(chart.mansionModel.id, 'qizheng-mansion-stars-simbad-astronomy-engine');
    assert.ok(chart.stars.some((star) => star.precisionClass === '现代天文计算'));
    assert.ok(chart.stars.some((star) => star.precisionClass === '传统均速模型'));
    assert.equal(chart.evidenceAnalysis.status, '已计算');
    assert.equal(chart.evidenceAnalysis.summaryFact.status, '可用事实链完整');

    const promptResponse = await client.callTool({
      name: 'qizheng_prompt',
      arguments: { ...arguments_, question: '请分析本命结构。' },
    });
    assert.equal(promptResponse.isError, undefined);
    const prompt = String(promptResponse.structuredContent?.prompt);
    assertPromptHasSingleRole(prompt, PROMPT_ROLE_TEXT.qizheng);
    assert.match(
      prompt,
      /【七政四余 · 果老星宗】[\s\S]*共55组无序星对[\s\S]*天乙（昼贵）[\s\S]*玉堂（夜贵）[\s\S]*第568卷[\s\S]*目标支不等于已经落入[\s\S]*【问题】\n请分析本命结构。/,
    );
    assert.match(prompt, /白羊戌/);
    assert.match(prompt, /《五行精纪》[\s\S]*《灵台经》/);
    assert.doesNotMatch(prompt, /天乙.*日干|神煞定位/);
    assert.doesNotMatch(prompt, /黄道第\s*\d+宫|生时加太阴|逆数见酉|身宫已按真太阳时校正/);
    assertPromptIsPortableTaskText(prompt);

    const yearBoundaryResponse = await client.callTool({
      name: 'metaphysics_qizheng',
      arguments: { ...arguments_, month: 2, day: 5 },
    });
    assert.equal(yearBoundaryResponse.isError, undefined);
    const yearBoundary = (
      yearBoundaryResponse.structuredContent as {
        result: { traditionalYearBasis: { status: string }; shenshaFacts: unknown[] };
      }
    ).result;
    assert.equal(yearBoundary.traditionalYearBasis.status, '年界口径分歧');
    assert.deepEqual(yearBoundary.shenshaFacts, []);
  });
});

test('MCP 七政四余应拒绝不存在日期和越界坐标时区', async () => {
  await withMcpClient(async (client) => {
    const invalidCalls: Array<[Record<string, unknown>, RegExp | null]> = [
      [{ year: 2024, month: 6, day: 31, hour: 12 }, /日期需在 1-30 之间/],
      [{ year: 2024, month: 6, day: 15, hour: 12, latitude: 91 }, null],
      [{ year: 2024, month: 6, day: 15, hour: 12, longitude: 181 }, null],
      [{ year: 2024, month: 6, day: 15, hour: 12, timezone: 15 }, null],
    ];

    for (const [args, messagePattern] of invalidCalls) {
      const result = await client.callTool({ name: 'metaphysics_qizheng', arguments: args });
      assert.equal(result.isError, true, 'metaphysics_qizheng 应拒绝越界参数');
      if (messagePattern) {
        assert.match(
          String((result.structuredContent as { error?: string } | undefined)?.error),
          messagePattern,
        );
      }
    }
  });
});

test('MCP 七政、太乙和玄空不得补造缺失必填参数', async () => {
  await withMcpClient(async (client) => {
    const calls: Array<[string, Record<string, unknown>, RegExp | null]> = [
      ['metaphysics_qizheng', { month: 6, day: 15, hour: 12 }, null],
      ['metaphysics_qizheng', { year: 2024, day: 15, hour: 12 }, null],
      ['metaphysics_qizheng', { year: 2024, month: 6, hour: 12 }, null],
      ['metaphysics_qizheng', { year: 2024, month: 6, day: 15 }, null],
      ['metaphysics_taiyi', { scope: 'year' }, /年计必须提供公历年份/],
      ['metaphysics_taiyi', { scope: 'month', year: 2026 }, null],
      ['metaphysics_taiyi', { scope: 'day', year: 2026 }, null],
      ['metaphysics_taiyi', { scope: 'hour', year: 2026 }, null],
      ['taiyi_prompt', { scope: 'month', year: 2026 }, null],
      ['taiyi_prompt', { scope: 'day', year: 2026 }, null],
      ['taiyi_prompt', { scope: 'hour', year: 2026 }, null],
      ['metaphysics_xuankong', { sitMountain: '子' }, null],
    ];

    for (const [name, args, messagePattern] of calls) {
      const result = await client.callTool({ name, arguments: args });
      assert.equal(result.isError, true, `${name} 应拒绝不完整或不支持的参数`);
      if (messagePattern) {
        assert.match(
          String((result.structuredContent as { error?: string } | undefined)?.error),
          messagePattern,
        );
      }
    }
  });
});

test('MCP 玄空应返回可核验替卦和替星过程', async () => {
  await withMcpClient(async (client) => {
    const response = await client.callTool({
      name: 'metaphysics_xuankong',
      arguments: { year: 2008, sitMountain: '子', guaType: '替卦' },
    });
    assert.equal(response.isError, undefined);
    const chart = (
      response.structuredContent as {
        result: {
          guaType: string;
          replacementApplied: boolean;
          replacement: {
            mountain: {
              originalCenterStar: number;
              referenceMountain: string;
              replacementStar: number;
              direction: string;
            };
            facing: {
              originalCenterStar: number;
              referenceMountain: string;
              replacementStar: number;
              direction: string;
            };
            verificationSourceUrl: string;
          };
          engine: { name: string; version: string; mode: string };
          generation: {
            year: number;
            orientation: {
              source: string;
              sitMountain: string | null;
              facingMountain: string | null;
            };
            guaType: string | null;
          };
          evidenceAnalysis: { promptText: string };
        };
      }
    ).result;
    assert.equal(chart.guaType, '替卦');
    assert.equal(chart.replacementApplied, true);
    assert.deepEqual(chart.replacement.mountain, {
      originalCenterStar: 4,
      referenceMountain: '巽',
      replacementStar: 6,
      direction: '顺飞',
    });
    assert.deepEqual(chart.replacement.facing, {
      originalCenterStar: 3,
      referenceMountain: '卯',
      replacementStar: 2,
      direction: '逆飞',
    });
    assert.match(
      chart.replacement.verificationSourceUrl,
      /324623c5460b035d537a8ff2da6b6567f9b85e9e/,
    );
    assert.equal('combinations' in chart, false);
    assert.equal(chart.engine.name, 'mingyu-core');
    assert.equal(chart.engine.version, '玄空三盘规则-v2');
    assert.equal(chart.engine.mode, '替卦');
    assert.deepEqual(chart.generation, {
      year: 2008,
      orientation: {
        source: 'mountain',
        sitMountain: '子',
        facingMountain: null,
      },
      guaType: '替卦',
    });
    assert.match(chart.evidenceAnalysis.promptText, /替星|巽山替为6顺飞|卯山替为2逆飞/);

    const ambiguous = await client.callTool({
      name: 'metaphysics_xuankong',
      arguments: { year: 2024, sitDegree: 3.5 },
    });
    assert.equal(ambiguous.isError, true);
    const errorText = ambiguous.content[0]?.type === 'text' ? ambiguous.content[0].text : '';
    assert.match(errorText, /3° 至 4\.5°.*异说区间.*guaType/);

    const mixed = await client.callTool({
      name: 'metaphysics_xuankong',
      arguments: { year: 2024, sitMountain: '子', sitDegree: 0 },
    });
    assert.equal(mixed.isError, true);
    const mixedText = mixed.content[0]?.type === 'text' ? mixed.content[0].text : '';
    assert.match(mixedText, /山名与度数测量.*不能混用/);
  });
});

test('MCP 住宅风水应返回可信来源、校正磁北并拒绝来源混用', async () => {
  await withMcpClient(async (client) => {
    const corrected = await client.callTool({
      name: 'metaphysics_residential',
      arguments: {
        year: 2024,
        doorToInteriorDegree: 0,
        northReference: 'magnetic',
        magneticDeclinationDegrees: 10,
        guaType: '下卦',
      },
    });
    assert.equal(corrected.isError, undefined);
    const result = (
      corrected.structuredContent as {
        result: {
          generation: Record<string, unknown>;
          xuankong: {
            generation: {
              orientation: { source: string; sitDegree: number; facingDegree: number };
            };
          };
        };
      }
    ).result;
    assert.deepEqual(result.generation, {
      person: null,
      orientation: {
        source: 'door-measurement',
        doorToInteriorDegree: 0,
        northReference: 'magnetic',
        magneticDeclinationDegrees: 10,
        measurementUncertaintyDegrees: 0,
      },
      year: 2024,
      guaType: '下卦',
    });
    assert.equal(result.xuankong.generation.orientation.source, 'degree');
    assert.equal(result.xuankong.generation.orientation.sitDegree, 10);
    assert.equal(result.xuankong.generation.orientation.facingDegree, 190);

    const direct = await client.callTool({
      name: 'metaphysics_residential',
      arguments: {
        mingGua: '坎',
        facingDegree: 245,
        measurementUncertaintyDegrees: 3,
      },
    });
    assert.equal(direct.isError, undefined);
    const directResult = (
      direct.structuredContent as {
        result: {
          bazhai: {
            generation: { method: string };
            directionMeasurement: {
              stability: string;
              candidateDirections: Array<{ label: string }>;
            };
          };
          xuankong: null;
        };
      }
    ).result;
    assert.equal(directResult.bazhai.generation.method, 'true-north-degree');
    assert.equal(directResult.bazhai.directionMeasurement.stability, '宅卦不稳定');
    assert.deepEqual(
      directResult.bazhai.directionMeasurement.candidateDirections.map((item) => item.label),
      ['寅山申向', '甲山庚向'],
    );
    assert.equal(directResult.xuankong, null);

    const invalidCalls = [
      { year: 2024, sitMountain: '子', sitDegree: 0 },
      { year: 2024, facingDegree: 180, doorToInteriorDegree: 0 },
      { year: 2024, sitMountain: '子', birthYear: 1990 },
      { year: 2024, sitMountain: '子', birthYear: 1990, gender: 'unknown' },
      { mingGua: '坎', year: 2024 },
      { year: 2024, sitMountain: '子', northReference: 'true' },
    ];
    for (const args of invalidCalls) {
      const invalid = await client.callTool({
        name: 'metaphysics_residential',
        arguments: args,
      });
      assert.equal(invalid.isError, true, JSON.stringify(args));
    }
  });
});

test('MCP 黄历择日工具应拒绝越界日期范围', async () => {
  await withMcpClient(async (client) => {
    const invalidCalls: Array<[string, Record<string, unknown>, RegExp]> = [
      [
        'divine_almanac',
        { topic: 'move', startDate: '2026/06/01', endDate: '2026-06-03' },
        /startDate 需要使用 YYYY-MM-DD 格式/,
      ],
      [
        'divine_almanac',
        { topic: 'move', startDate: '0000-01-01', endDate: '0000-01-02' },
        /startDate 年份需在 1900-2100 之间/,
      ],
      [
        'almanac_prompt',
        { topic: 'move', startDate: '9999-01-01', endDate: '9999-01-02' },
        /startDate 年份需在 1900-2100 之间/,
      ],
      [
        'almanac_prompt',
        { topic: 'move', startDate: '2026-06-05', endDate: '2026-06-01' },
        /endDate 不能早于 startDate/,
      ],
      [
        'divine_almanac',
        { topic: 'move', startDate: '2026-06-01', endDate: '2026-07-10' },
        /黄历择日一次最多比较 31 天/,
      ],
    ];

    for (const [name, args, messagePattern] of invalidCalls) {
      const result = await client.callTool({ name, arguments: args });
      assert.equal(result.isError, true, `${name} 应返回黄历日期参数错误`);
      assert.match(
        String((result.structuredContent as { error?: string } | undefined)?.error),
        messagePattern,
        `${name} 应返回明确的黄历日期错误`,
      );
    }
  });
});

test('MCP 梅花工具应拒绝未知起卦方式', async () => {
  await withMcpClient(async (client) => {
    for (const name of ['divine_meihua', 'meihua_prompt']) {
      const args =
        name === 'meihua_prompt'
          ? { method: 'external', question: '今年事业如何？' }
          : { method: 'external' };
      const result = await client.callTool({ name, arguments: args });
      assert.equal(result.isError, true, `${name} 应返回参数错误`);
    }
  });
});

test('MCP 梅花排盘与提示词应返回主互变体用推进证据', async () => {
  await withMcpClient(async (client) => {
    const chart = await client.callTool({
      name: 'divine_meihua',
      arguments: {
        method: 'number',
        number: 123,
        customDate: '2025-01-01T08:00:00+08:00',
      },
    });
    const result = (
      chart.structuredContent as {
        result: {
          evidenceAnalysis: {
            key: string;
            status: string;
            calculationSteps: Array<{
              key: string;
              stage: string;
              status: string;
              dependsOnStepKeys: string[];
            }>;
            calculationChain: string[];
            stages: Array<{
              key: string;
              status: string;
              stage: string;
              support: string[];
              constraints: string[];
              promptText: string;
              sources: string[];
              limitation: string;
            }>;
            stageCoverageFact: { status: string };
            yaoCoverageFact: { status: string };
            hexagramStructureFacts: unknown[];
            yaoStructureFacts: unknown[];
            interResponseFacts: Array<{
              role: string;
              relation: string;
              support: string[];
              constraints: string[];
              originalTi: { name: string };
            }>;
            responseReferences: Array<{
              role: string;
              relationToOriginalTi: string;
            }>;
            partyFact: {
              status: string;
              classification: string;
              tiPartyCount: number;
              yongPartyCount: number;
            };
            responseInteractionFacts: Array<{
              status: string;
              effectDirection: string;
              promptText: string;
            }>;
            internalMotionFact: {
              status: string;
              movingYaoPosition: number;
              references: Array<{ role: string; motion: string }>;
              movingRoles: string[];
              stillRoles: string[];
            };
            externalMotionFact: {
              status: string;
              requiredObservationFields: string[];
              availableObservationFields: string[];
              missingObservationFields: string[];
            };
            spatialOmenFact: {
              status: string;
              requiredObservationFields: string[];
              availableObservationFields: string[];
              missingObservationFields: string[];
              promptText: string;
            };
            sensoryOmenFact: {
              status: string;
              requiredObservationFields: string[];
              availableObservationFields: string[];
              missingObservationFields: string[];
              promptText: string;
            };
            foodContextFact: {
              status: string;
              requiredContextFields: string[];
              availableContextFields: string[];
              missingContextFields: string[];
              availableChartFields: string[];
              promptText: string;
            };
            objectContextFact: {
              status: string;
              requiredContextFields: string[];
              availableContextFields: string[];
              missingContextFields: string[];
              availableChartFields: string[];
              selectionOrderFields: string[];
              relationRuleFields: string[];
              quantityRuleFields: string[];
              bodySelectionRuleFields: string[];
              lineStructureRuleFields: string[];
              changeObservationRuleFields: string[];
              responseOmenRuleFields: string[];
              seasonalObservationRuleFields: string[];
              usageExampleFields: string[];
              handGuessRuleFields: string[];
              sourceLineFields: string[];
              unresolvedRuleFields: string[];
              promptText: string;
            };
            topicResponseContextFact: {
              status: string;
              requiredContextFields: string[];
              availableContextFields: string[];
              missingContextFields: string[];
              availableChartFields: string[];
              topicScopes: string[];
              crossTopicConflictFields: string[];
              highRiskRuleFields: string[];
              unresolvedRuleFields: string[];
              promptText: string;
            };
            tenResponseContextFact: {
              status: string;
              responseCatalogFields: string[];
              reusedInternalResponseFields: string[];
              requiredContextFields: string[];
              availableContextFields: string[];
              missingContextFields: string[];
              availableChartFields: string[];
              sourceLineFields: string[];
              unresolvedRuleFields: string[];
              highRiskRuleFields: string[];
              promptText: string;
            };
            matterTenResponseContextFact: {
              status: string;
              responseCatalogFields: string[];
              requiredContextFields: string[];
              availableContextFields: string[];
              missingContextFields: string[];
              availableChartFields: string[];
              sourceLineFields: string[];
              unresolvedRuleFields: string[];
              highRiskRuleFields: string[];
              promptText: string;
            };
            trigramResponseCatalogFact: {
              key: string;
              status: string;
              trigramCatalogFields: string[];
              qianDetailCategoryFields: string[];
              requiredContextFields: string[];
              availableContextFields: string[];
              missingContextFields: string[];
              availableChartFields: string[];
              sourceLineFields: string[];
              canonicalCrosscheckFields: string[];
              unresolvedRuleFields: string[];
              highRiskRuleFields: string[];
              promptText: string;
            };
            hexagramDispositionFacts: Array<{
              status: string;
              stage: string;
              label: string;
              hexagram: string;
              binarySymbol: string;
              reversedHexagram: string;
              reversedRelation: string;
              oppositeHexagram: string;
              dispositionGloss: string;
              limitation: string;
            }>;
            hexagramDispositionVersionFact: {
              status: string;
              canonicalGlossCount: number;
              reversedGroupCount: number;
              sourceLineFields: string[];
              unresolvedRuleFields: string[];
              limitation: string;
            };
            transitionFacts: Array<{
              key: string;
              status: string;
              fromStageKey: string;
              toStageKey: string;
              sources: string[];
              limitation: string;
            }>;
            timingFacts: Array<{
              key: string;
              type: string;
              sourceStatus: string;
              promptText: string;
              sources: string[];
              limitation: string;
            }>;
            timingSummaryFact: { status: string; factKeys: string[] };
            counterEvidenceFacts: Array<{
              key: string;
              type: string;
              status: string;
              ownerStageKey: string;
              sources: string[];
              limitation: string;
            }>;
            counterSummaryFact: { factKeys: string[] };
            summaryFact: {
              status: string;
              factKeys: string[];
              hexagramFactCount: number;
              yaoFactCount: number;
              stageFactCount: number;
              interResponseFactCount: number;
              partyFactCount: number;
              responseInteractionFactCount: number;
              motionFactCount: number;
              sensoryOmenFactCount: number;
              foodContextFactCount: number;
              objectContextFactCount: number;
              topicResponseContextFactCount: number;
              tenResponseContextFactCount: number;
              matterTenResponseContextFactCount: number;
              trigramResponseCatalogFactCount: number;
              hexagramDispositionFactCount: number;
              hexagramDispositionVersionFactCount: number;
              transitionFactCount: number;
              traditionalFactCount: number;
              counterEvidenceCount: number;
              timingFactCount: number;
            };
            limitations: string[];
            limitationFacts: Array<{
              key: string;
              status: string;
              ownerFactKeys: string[];
              promptText: string;
              sources: string[];
              limitation: string;
            }>;
            promptText: string;
            calculationFact: {
              status: string;
              methodKey: string;
              steps: Array<{
                key: string;
                target: string;
                expression: string;
                result?: number;
                promptText: string;
              }>;
            };
            randomFact: { status: string };
            traditionalFacts: Array<Record<string, unknown>>;
          };
        };
      }
    ).result;
    assert.equal(result.evidenceAnalysis.key, 'meihua:evidence');
    assert.equal(result.evidenceAnalysis.status, '已计算');
    assert.equal(result.evidenceAnalysis.calculationSteps.length, 7);
    assert.equal(result.evidenceAnalysis.calculationChain.length, 7);
    assert.ok(
      result.evidenceAnalysis.calculationSteps.every((step) =>
        step.dependsOnStepKeys.every((key) =>
          result.evidenceAnalysis.calculationSteps.some((candidate) => candidate.key === key),
        ),
      ),
    );
    assert.deepEqual(
      result.evidenceAnalysis.stages.map((item) => item.stage),
      ['origin', 'process', 'result'],
    );
    assert.equal(result.evidenceAnalysis.stageCoverageFact.status, '完整');
    assert.equal(result.evidenceAnalysis.yaoCoverageFact.status, '完整');
    assert.equal(result.evidenceAnalysis.hexagramStructureFacts.length, 3);
    assert.equal(result.evidenceAnalysis.yaoStructureFacts.length, 6);
    assert.deepEqual(
      result.evidenceAnalysis.interResponseFacts.map((item) => item.role),
      ['体互', '用互'],
    );
    assert.deepEqual(
      result.evidenceAnalysis.responseReferences.map((item) => item.role),
      ['主卦用卦', '体互', '用互', '变卦用卦'],
    );
    assert.equal(result.evidenceAnalysis.partyFact.status, '已计算');
    assert.equal(result.evidenceAnalysis.partyFact.classification, '体用党均未达多项');
    assert.equal(result.evidenceAnalysis.partyFact.tiPartyCount, 0);
    assert.equal(result.evidenceAnalysis.partyFact.yongPartyCount, 1);
    assert.equal(result.evidenceAnalysis.responseInteractionFacts.length, 4);
    assert.ok(
      result.evidenceAnalysis.responseInteractionFacts.every(
        (item) =>
          item.status === '路径成立' &&
          item.effectDirection === '克体之患受制' &&
          item.promptText.includes('实际效力仍须合看旺衰与其他应卦路径'),
      ),
    );
    assert.equal(result.evidenceAnalysis.internalMotionFact.status, '已计算');
    assert.deepEqual(
      result.evidenceAnalysis.internalMotionFact.references.map((item) => [item.role, item.motion]),
      [
        ['原体', '静'],
        ['主卦用卦', '动'],
        ['体互', '静'],
        ['用互', '静'],
        ['变卦用卦', '动'],
      ],
    );
    assert.deepEqual(result.evidenceAnalysis.internalMotionFact.movingRoles, [
      '主卦用卦',
      '变卦用卦',
    ]);
    assert.deepEqual(result.evidenceAnalysis.internalMotionFact.stillRoles, [
      '原体',
      '体互',
      '用互',
    ]);
    assert.equal(result.evidenceAnalysis.externalMotionFact.status, '资料不足');
    assert.deepEqual(result.evidenceAnalysis.externalMotionFact.availableObservationFields, []);
    assert.deepEqual(
      result.evidenceAnalysis.externalMotionFact.missingObservationFields,
      result.evidenceAnalysis.externalMotionFact.requiredObservationFields,
    );
    assert.equal(result.evidenceAnalysis.spatialOmenFact.status, '资料不足');
    assert.deepEqual(result.evidenceAnalysis.spatialOmenFact.availableObservationFields, []);
    assert.deepEqual(
      result.evidenceAnalysis.spatialOmenFact.missingObservationFields,
      result.evidenceAnalysis.spatialOmenFact.requiredObservationFields,
    );
    assert.match(
      result.evidenceAnalysis.spatialOmenFact.promptText,
      /不得把主卦、互卦、变卦、体用、数字、时间、问题文本、设备方位或行政地名补写成坐端八方应兆/,
    );
    assert.equal(result.evidenceAnalysis.sensoryOmenFact.status, '资料不足');
    assert.deepEqual(result.evidenceAnalysis.sensoryOmenFact.availableObservationFields, []);
    assert.deepEqual(
      result.evidenceAnalysis.sensoryOmenFact.missingObservationFields,
      result.evidenceAnalysis.sensoryOmenFact.requiredObservationFields,
    );
    assert.equal(result.evidenceAnalysis.sensoryOmenFact.requiredObservationFields.length, 7);
    for (const key of ['eventPhase', 'omen', 'date', 'score', 'weight', 'probability']) {
      assert.equal(key in result.evidenceAnalysis.sensoryOmenFact, false);
    }
    assert.equal(result.evidenceAnalysis.foodContextFact.status, '资料不足');
    assert.deepEqual(result.evidenceAnalysis.foodContextFact.availableContextFields, []);
    assert.deepEqual(
      result.evidenceAnalysis.foodContextFact.missingContextFields,
      result.evidenceAnalysis.foodContextFact.requiredContextFields,
    );
    assert.equal(result.evidenceAnalysis.foodContextFact.requiredContextFields.length, 5);
    assert.equal(result.evidenceAnalysis.foodContextFact.availableChartFields.length, 4);
    for (const key of [
      'food',
      'dish',
      'taste',
      'cookingMethod',
      'guest',
      'host',
      'canEat',
      'illness',
      'score',
      'weight',
      'probability',
    ]) {
      assert.equal(key in result.evidenceAnalysis.foodContextFact, false);
    }
    assert.equal(result.evidenceAnalysis.objectContextFact.status, '资料不足');
    assert.deepEqual(result.evidenceAnalysis.objectContextFact.availableContextFields, []);
    assert.deepEqual(
      result.evidenceAnalysis.objectContextFact.missingContextFields,
      result.evidenceAnalysis.objectContextFact.requiredContextFields,
    );
    assert.equal(result.evidenceAnalysis.objectContextFact.requiredContextFields.length, 3);
    assert.equal(result.evidenceAnalysis.objectContextFact.availableChartFields.length, 4);
    assert.equal(result.evidenceAnalysis.objectContextFact.selectionOrderFields.length, 4);
    assert.equal(result.evidenceAnalysis.objectContextFact.relationRuleFields.length, 5);
    assert.equal(result.evidenceAnalysis.objectContextFact.quantityRuleFields.length, 6);
    assert.equal(result.evidenceAnalysis.objectContextFact.bodySelectionRuleFields.length, 5);
    assert.equal(result.evidenceAnalysis.objectContextFact.lineStructureRuleFields.length, 3);
    assert.equal(result.evidenceAnalysis.objectContextFact.changeObservationRuleFields.length, 5);
    assert.equal(result.evidenceAnalysis.objectContextFact.responseOmenRuleFields.length, 6);
    assert.equal(result.evidenceAnalysis.objectContextFact.seasonalObservationRuleFields.length, 7);
    assert.equal(result.evidenceAnalysis.objectContextFact.usageExampleFields.length, 7);
    assert.equal(result.evidenceAnalysis.objectContextFact.handGuessRuleFields.length, 10);
    assert.equal(result.evidenceAnalysis.objectContextFact.sourceLineFields.length, 11);
    assert.equal(result.evidenceAnalysis.objectContextFact.unresolvedRuleFields.length, 48);
    assert.match(
      result.evidenceAnalysis.objectContextFact.promptText,
      /万物戏验.*第951至952行.*手中物目录/,
    );
    for (const key of [
      'handObject',
      'matchedHistoricalExample',
      'predictedObject',
      'revealedObject',
      'observedObject',
      'externalObject',
      'object',
      'material',
      'shape',
      'color',
      'root',
      'sound',
      'smell',
      'hardness',
      'wetness',
      'decay',
      'burned',
      'motion',
      'position',
      'damage',
      'damaged',
      'opening',
      'value',
      'use',
      'utility',
      'edible',
      'count',
      'bodyCandidate',
      'dominantTrigram',
      'dominantElement',
      'changedObservation',
      'seasonalCandidate',
      'hasQi',
      'emptyHand',
      'yangCount',
      'yinCount',
      'flying',
      'success',
      'failure',
      'result',
      'score',
      'weight',
      'probability',
    ]) {
      assert.equal(key in result.evidenceAnalysis.objectContextFact, false);
    }
    const topicResponse = result.evidenceAnalysis.topicResponseContextFact;
    assert.equal(topicResponse.status, '资料不足');
    assert.deepEqual(topicResponse.availableContextFields, []);
    assert.deepEqual(topicResponse.missingContextFields, topicResponse.requiredContextFields);
    assert.equal(topicResponse.requiredContextFields.length, 4);
    assert.equal(topicResponse.availableChartFields.length, 4);
    assert.equal(topicResponse.topicScopes.length, 17);
    assert.equal(topicResponse.crossTopicConflictFields.length, 4);
    assert.equal(topicResponse.highRiskRuleFields.length, 5);
    assert.equal(topicResponse.unresolvedRuleFields.length, 1);
    assert.match(topicResponse.unresolvedRuleFields[0] ?? '', /比和凶则有救星/);
    for (const key of [
      'topic',
      'target',
      'fetalSex',
      'diagnosis',
      'prescription',
      'lawsuitResult',
      'marriageResult',
      'financialResult',
      'score',
      'weight',
      'probability',
    ]) {
      assert.equal(key in topicResponse, false);
    }
    const tenResponse = result.evidenceAnalysis.tenResponseContextFact;
    assert.equal(tenResponse.status, '资料不足');
    assert.deepEqual(tenResponse.availableContextFields, []);
    assert.deepEqual(tenResponse.missingContextFields, tenResponse.requiredContextFields);
    assert.equal(tenResponse.responseCatalogFields.length, 10);
    assert.equal(tenResponse.reusedInternalResponseFields.length, 3);
    assert.equal(tenResponse.requiredContextFields.length, 8);
    assert.equal(tenResponse.availableChartFields.length, 5);
    assert.equal(tenResponse.sourceLineFields.length, 25);
    assert.equal(tenResponse.unresolvedRuleFields.length, 8);
    assert.equal(tenResponse.highRiskRuleFields.length, 4);
    assert.match(tenResponse.promptText, /日支虽已记录，但不能自动生成日应吉凶/);
    for (const key of [
      'direction',
      'visitorDirection',
      'dayResponse',
      'timeOmen',
      'externalOmen',
      'weatherOmen',
      'geographyOmen',
      'humanOmen',
      'illnessOutcome',
      'recovery',
      'death',
      'auspicious',
      'score',
      'weight',
      'probability',
    ]) {
      assert.equal(key in tenResponse, false);
    }
    const matterTenResponse = result.evidenceAnalysis.matterTenResponseContextFact;
    assert.equal(matterTenResponse.status, '资料不足');
    assert.deepEqual(matterTenResponse.availableContextFields, []);
    assert.deepEqual(
      matterTenResponse.missingContextFields,
      matterTenResponse.requiredContextFields,
    );
    assert.deepEqual(matterTenResponse.responseCatalogFields, [
      '行',
      '立',
      '坐',
      '卧',
      '担',
      '券',
      '裹头',
      '跣足',
      '喜',
      '怒',
    ]);
    assert.equal(matterTenResponse.requiredContextFields.length, 8);
    assert.equal(matterTenResponse.availableChartFields.length, 3);
    assert.equal(matterTenResponse.sourceLineFields.length, 11);
    assert.equal(matterTenResponse.unresolvedRuleFields.length, 10);
    assert.equal(matterTenResponse.highRiskRuleFields.length, 6);
    assert.match(matterTenResponse.promptText, /现有日干支、月令旺衰、主互变卦/);
    for (const key of [
      'matterResponse',
      'observedResponse',
      'dayElement',
      'dayStrength',
      'legalOutcome',
      'financialOutcome',
      'visitorArrival',
      'documentArrival',
      'illness',
      'fever',
      'treatment',
      'prognosis',
      'spiritCause',
      'mourning',
      'auspicious',
      'score',
      'weight',
      'probability',
    ]) {
      assert.equal(key in matterTenResponse, false);
    }
    const trigramResponseCatalog = result.evidenceAnalysis.trigramResponseCatalogFact;
    assert.equal(trigramResponseCatalog.key, 'meihua:trigram-response-catalog');
    assert.equal(trigramResponseCatalog.status, '资料不足');
    assert.deepEqual(trigramResponseCatalog.availableContextFields, []);
    assert.deepEqual(
      trigramResponseCatalog.missingContextFields,
      trigramResponseCatalog.requiredContextFields,
    );
    assert.equal(trigramResponseCatalog.trigramCatalogFields.length, 8);
    assert.equal(trigramResponseCatalog.qianDetailCategoryFields.length, 11);
    assert.equal(trigramResponseCatalog.sourceLineFields.length, 21);
    assert.equal(trigramResponseCatalog.canonicalCrosscheckFields.length, 8);
    assert.equal(trigramResponseCatalog.unresolvedRuleFields.length, 12);
    assert.equal(trigramResponseCatalog.highRiskRuleFields.length, 7);
    assert.match(trigramResponseCatalog.promptText, /不自动匹配或补齐类象/);
    for (const key of [
      'matchedTrigram',
      'weatherForecast',
      'personIdentity',
      'personality',
      'bodyPart',
      'diagnosis',
      'medicine',
      'objectAttribute',
      'auspicious',
      'score',
      'weight',
      'probability',
      'timing',
    ]) {
      assert.equal(key in trigramResponseCatalog, false);
    }
    const dispositionFacts = result.evidenceAnalysis.hexagramDispositionFacts;
    const dispositionVersion = result.evidenceAnalysis.hexagramDispositionVersionFact;
    assert.equal(dispositionFacts.length, 3);
    assert.deepEqual(
      dispositionFacts.map((item) => item.label),
      ['主卦', '互卦', '变卦'],
    );
    assert.ok(
      dispositionFacts.every(
        (item) =>
          item.status === '已计算' &&
          item.binarySymbol.length === 6 &&
          item.reversedHexagram &&
          item.oppositeHexagram &&
          item.dispositionGloss &&
          item.limitation.includes('不等同于现实人物性格'),
      ),
    );
    assert.equal(dispositionVersion.status, '底本异文待校');
    assert.equal(dispositionVersion.canonicalGlossCount, 64);
    assert.equal(dispositionVersion.reversedGroupCount, 36);
    assert.equal(dispositionVersion.sourceLineFields.length, 18);
    assert.equal(dispositionVersion.unresolvedRuleFields.length, 8);
    for (const fact of [...dispositionFacts, dispositionVersion]) {
      for (const key of [
        'personality',
        'motive',
        'psychology',
        'event',
        'result',
        'score',
        'weight',
        'probability',
      ]) {
        assert.equal(key in fact, false);
      }
    }
    assert.ok(
      result.evidenceAnalysis.interResponseFacts.every(
        (item) => item.originalTi.name === result.tiGua.name && item.relation.includes('原体'),
      ),
    );
    const resultStage = result.evidenceAnalysis.stages.find((item) => item.stage === 'result');
    assert.ok(resultStage?.constraints.includes('用卦克体且月令旺，克体之气有力'));
    assert.ok(!resultStage?.support.includes('用卦得月令旺'));
    const tiInterResponse = result.evidenceAnalysis.interResponseFacts.find(
      (item) => item.role === '体互',
    );
    assert.ok(tiInterResponse?.constraints.includes('体互克原体且月令旺，克体之气有力'));
    assert.ok(!tiInterResponse?.support.includes('体互得月令旺'));
    const bodyStateEvidence = [
      ...result.evidenceAnalysis.stages.flatMap((item) => [...item.support, ...item.constraints]),
      ...result.evidenceAnalysis.interResponseFacts.flatMap((item) => [
        ...item.support,
        ...item.constraints,
      ]),
    ].filter((item) => /^(体卦得月令|体卦月令|原体得月令|原体月令)/.test(item));
    assert.deepEqual(bodyStateEvidence, ['体卦月令死']);
    assert.equal(
      result.evidenceAnalysis.counterEvidenceFacts.filter((item) => item.type === '体卦月令限制')
        .length,
      1,
    );
    assert.ok(
      result.evidenceAnalysis.stages.every(
        (item) =>
          item.key.startsWith('meihua:stage:') &&
          item.status === '已计算' &&
          item.promptText &&
          item.sources.length > 0 &&
          item.limitation.includes('不得直接解释为现实起因'),
      ),
    );
    assert.equal(result.evidenceAnalysis.transitionFacts.length, 2);
    assert.ok(
      result.evidenceAnalysis.transitionFacts.every(
        (item) =>
          item.key.startsWith('meihua:transition:') &&
          item.status === '连续' &&
          item.fromStageKey &&
          item.toStageKey &&
          item.sources.length > 0 &&
          item.limitation.includes('现实事件必然按同样顺序'),
      ),
    );
    assert.equal(
      result.evidenceAnalysis.timingSummaryFact.factKeys.length,
      result.evidenceAnalysis.timingFacts.length,
    );
    assert.equal(result.evidenceAnalysis.timingSummaryFact.status, '资料不足');
    assert.ok(
      result.evidenceAnalysis.timingFacts.some(
        (item) => item.type === '克应资料覆盖' && item.sourceStatus === '资料不足',
      ),
    );
    const wholeHexagramTiming = result.evidenceAnalysis.timingFacts.find(
      (item) => item.type === '全卦克应关系',
    );
    const timingContext = result.evidenceAnalysis.timingFacts.find(
      (item) => item.type === '克应资料覆盖',
    );
    assert.deepEqual(wholeHexagramTiming.actualResponseRoles, [
      '主卦用卦',
      '体互',
      '用互',
      '变卦用卦',
    ]);
    assert.equal(wholeHexagramTiming.relationCandidates.length, 4);
    assert.equal(timingContext.requiredContextFields.length, 6);
    assert.deepEqual(timingContext.missingContextFields, timingContext.requiredContextFields);
    assert.ok(
      result.evidenceAnalysis.timingFacts.every(
        (item) =>
          item.key.startsWith('meihua:timing:') &&
          item.promptText &&
          item.sources.length > 0 &&
          item.limitation.includes('不得把爻位'),
      ),
    );
    assert.equal(
      result.evidenceAnalysis.counterSummaryFact.factKeys.length,
      result.evidenceAnalysis.counterEvidenceFacts.length,
    );
    assert.equal(result.evidenceAnalysis.summaryFact.status, '证据链完整');
    assert.equal(
      result.evidenceAnalysis.summaryFact.hexagramFactCount,
      result.evidenceAnalysis.hexagramStructureFacts.length,
    );
    assert.equal(
      result.evidenceAnalysis.summaryFact.stageFactCount,
      result.evidenceAnalysis.stages.length,
    );
    assert.equal(
      result.evidenceAnalysis.summaryFact.interResponseFactCount,
      result.evidenceAnalysis.interResponseFacts.length,
    );
    assert.equal(result.evidenceAnalysis.summaryFact.partyFactCount, 1);
    assert.equal(
      result.evidenceAnalysis.summaryFact.responseInteractionFactCount,
      result.evidenceAnalysis.responseInteractionFacts.length,
    );
    assert.equal(result.evidenceAnalysis.summaryFact.motionFactCount, 2);
    assert.equal(result.evidenceAnalysis.summaryFact.sensoryOmenFactCount, 1);
    assert.equal(result.evidenceAnalysis.summaryFact.foodContextFactCount, 1);
    assert.equal(result.evidenceAnalysis.summaryFact.objectContextFactCount, 1);
    assert.equal(result.evidenceAnalysis.summaryFact.topicResponseContextFactCount, 1);
    assert.equal(result.evidenceAnalysis.summaryFact.tenResponseContextFactCount, 1);
    assert.equal(result.evidenceAnalysis.summaryFact.matterTenResponseContextFactCount, 1);
    assert.equal(result.evidenceAnalysis.summaryFact.trigramResponseCatalogFactCount, 1);
    assert.equal(
      result.evidenceAnalysis.summaryFact.hexagramDispositionFactCount,
      dispositionFacts.length,
    );
    assert.equal(result.evidenceAnalysis.summaryFact.hexagramDispositionVersionFactCount, 1);
    assert.equal(
      result.evidenceAnalysis.summaryFact.transitionFactCount,
      result.evidenceAnalysis.transitionFacts.length,
    );
    assert.equal(
      result.evidenceAnalysis.summaryFact.counterEvidenceCount,
      result.evidenceAnalysis.counterEvidenceFacts.length,
    );
    assert.equal(
      result.evidenceAnalysis.summaryFact.timingFactCount,
      result.evidenceAnalysis.timingFacts.length,
    );
    assert.equal(result.evidenceAnalysis.limitationFacts.length, 16);
    assert.equal(
      result.evidenceAnalysis.limitations.length,
      result.evidenceAnalysis.limitationFacts.length,
    );
    const factKeys = new Set([
      'meihua:evidence-summary',
      ...result.evidenceAnalysis.summaryFact.factKeys,
    ]);
    assert.ok(
      result.evidenceAnalysis.limitationFacts.every(
        (item) =>
          item.key.startsWith('meihua:limitation:') &&
          item.status === '适用' &&
          item.ownerFactKeys.every((key) => factKeys.has(key)) &&
          item.promptText &&
          item.sources.length > 0 &&
          item.limitation.includes('不得被反向当作现实吉凶'),
      ),
    );
    assert.ok(
      result.evidenceAnalysis.counterEvidenceFacts.every(
        (item) =>
          item.key.startsWith('meihua:counter:') &&
          item.status === '已触发' &&
          item.ownerStageKey &&
          item.sources.length > 0 &&
          item.limitation.includes('不得把单项反证直接写成现实失败'),
      ),
    );
    assert.match(result.evidenceAnalysis.promptText, /【梅花主互变关系推进结构化证据】/);
    assert.match(result.evidenceAnalysis.promptText, /证据汇总：/);
    assert.match(result.evidenceAnalysis.promptText, /体用党与应卦制化：/);
    assert.match(result.evidenceAnalysis.promptText, /体用动静：/);
    assert.match(result.evidenceAnalysis.promptText, /万物外应：/);
    assert.match(result.evidenceAnalysis.promptText, /占卜十应：/);
    assert.match(result.evidenceAnalysis.promptText, /论事十大应：/);
    assert.match(result.evidenceAnalysis.promptText, /卦应八卦目录：/);
    assert.match(result.evidenceAnalysis.promptText, /反对性情资料：/);
    assert.match(result.evidenceAnalysis.promptText, /解释限制：/);
    assertPromptIsPortableTaskText(result.evidenceAnalysis.promptText);
    assert.equal(result.evidenceAnalysis.calculationFact.status, '完整');
    assert.equal(result.evidenceAnalysis.calculationFact.methodKey, 'number');
    assert.equal(result.evidenceAnalysis.calculationFact.steps.length, 3);
    assert.ok(
      result.evidenceAnalysis.calculationFact.steps.every(
        (item) =>
          item.key &&
          item.target &&
          item.expression &&
          typeof item.result === 'number' &&
          item.promptText,
      ),
    );
    assert.equal(result.evidenceAnalysis.randomFact.status, '不适用');
    assert.ok(result.evidenceAnalysis.traditionalFacts.length >= 21);
    assert.ok(
      result.evidenceAnalysis.traditionalFacts.every(
        (item) =>
          item.status === '已映射' &&
          item.originalText &&
          item.promptText &&
          Array.isArray(item.traditionalSignals) &&
          Array.isArray(item.topicTags) &&
          Array.isArray(item.sources) &&
          item.sources.length > 0 &&
          String(item.limitation).includes('不证明现实吉凶'),
      ),
    );

    const prompt = await client.callTool({
      name: 'meihua_prompt',
      arguments: {
        method: 'number',
        number: 123,
        customDate: '2025-01-01T08:00:00+08:00',
        question: '这件事应如何推进？',
      },
    });
    const promptText = String(prompt.structuredContent?.prompt);
    assert.match(promptText, /占法：梅花易数/);
    assert.match(promptText, /核心结构：主卦[\s\S]*体用：[\s\S]*结构明细：/);
    assert.match(promptText, /体用动静：卦内动静分工/);
    assert.match(promptText, /外应动静：当前输入未记录起卦现场/);
    assert.match(promptText, /坐端应兆：当前输入未记录以求测者所在处为中心/);
    assert.match(promptText, /万物外应：当前输入未记录耳闻目见的现场原始事实/);
    assert.match(promptText, /占卜十应：《占卜十应诀》第954至978行/);
    assert.match(promptText, /疾病末段不得生成诊断、痊愈或生死结论/);
    assert.match(promptText, /论事十大应：《论事十大应（论日辰秘文）》第979至989行/);
    assert.match(promptText, /卦应八卦目录：《卦应》第990至1018行/);
    assert.match(promptText, /坤至兑没有乾卦同类分项/);
    assert.match(promptText, /反对性情资料：/);
    assert.match(promptText, /应期资料：应期状态：待补充事项情境/);
    assert.match(promptText, /全卦克应候选：/);
    assert.match(promptText, /资料未齐时不能计算传统克应/);
    assert.doesNotMatch(promptText, /结构化证据|计算链|证据汇总|解释限制|解释边界/);
    assert.doesNotMatch(promptText, /妇三岁不孕|焚如，死如|至于八月有凶/);
    assert.doesNotMatch(
      promptText,
      /体用评分：|类象权重：|事情刚开始|内部配合|核心决策|应期快于常规|应期迟缓|\d+日内|\d+月左右/,
    );
  });
});

test('MCP 小六壬排盘与提示词只返回原始时间事实和待校边界', async () => {
  await withMcpClient(async (client) => {
    const chart = await client.callTool({
      name: 'divine_xiaoliuren',
      arguments: {
        xiaoliurenMethod: 'time',
        customDate: '2025-06-29T08:00:00+08:00',
      },
    });
    const result = (chart.structuredContent as { result: any }).result;
    assert.equal(result.lunarMonth, 6);
    assert.equal(result.lunarDay, 5);
    assert.equal(result.hourLabel, '辰时');
    assert.equal(result.calculation.hourNumber, 5);
    assert.equal(result.sequence, undefined);
    assert.equal(result.primary, undefined);
    assert.equal(result.evidenceAnalysis.key, 'xiaoliuren:evidence');
    assert.equal(result.evidenceAnalysis.status, '资料不足');
    assert.equal(result.evidenceAnalysis.calculationSteps.length, 0);
    const calculationStepKeys = new Set(
      result.evidenceAnalysis.calculationSteps.map((item) => item.key),
    );
    assert.ok(
      result.evidenceAnalysis.calculationSteps.every((item) =>
        item.dependsOnStepKeys.every((key) => calculationStepKeys.has(key)),
      ),
    );
    assert.deepEqual(result.evidenceAnalysis.palaceFacts, []);
    assert.equal(result.evidenceAnalysis.primaryFact, null);
    assert.equal(result.evidenceAnalysis.calculationFact.status, '规则待校');
    assert.equal(result.evidenceAnalysis.calculationFact.steps.length, 0);
    assert.equal(result.evidenceAnalysis.summaryFact.status, '证据链有缺口');
    assert.equal(
      result.evidenceAnalysis.summaryFact.calculationStepCount,
      result.evidenceAnalysis.calculationSteps.length,
    );
    assert.equal(
      result.evidenceAnalysis.summaryFact.palaceFactCount,
      result.evidenceAnalysis.palaceFacts.length,
    );
    assert.equal(result.evidenceAnalysis.limitationFacts.length, 4);
    assert.equal(
      result.evidenceAnalysis.limitations.length,
      result.evidenceAnalysis.limitationFacts.length,
    );
    const factKeys = new Set([
      result.evidenceAnalysis.calculationFact.key,
      ...result.evidenceAnalysis.calculationSteps.map((item) => item.key),
      ...result.evidenceAnalysis.palaceFacts.map((item) => item.key),
    ]);
    assert.ok(
      result.evidenceAnalysis.limitationFacts.every(
        (item) =>
          item.ownerFactKeys.length > 0 && item.ownerFactKeys.every((key) => factKeys.has(key)),
      ),
    );
    assert.match(result.evidenceAnalysis.promptText, /固定底本、具体版本和页码/);

    const promptResult = await client.callTool({
      name: 'xiaoliuren_prompt',
      arguments: {
        xiaoliurenMethod: 'time',
        customDate: '2025-06-29T08:00:00+08:00',
        question: '这件事应如何推进？',
      },
    });
    const prompt = String(promptResult.structuredContent?.prompt);
    assert.match(prompt, /占法：小六壬/);
    assert.match(prompt, /时辰序号：5（子1至亥12）/);
    assert.match(prompt, /证据链有缺口/);
    assert.match(prompt, /必须先说明采用的具体底本、版本与完整起数规则/);
    assert.doesNotMatch(prompt, /顺数轨迹：|占得宫：|歌诀原文：|留连事难成/);
    assert.doesNotMatch(prompt, /核心结构：起因|五行推进：|月令旺衰：|日干六亲：/);
    assert.doesNotMatch(prompt, /\d+(?:\.\d+)?%|成功率(?:为|：)|吉凶总分(?:为|：)|\d+日内|\d+周内/);
    assertPromptIsPortableTaskText(prompt);
  });
});

test('MCP 时间型占卜工具应拒绝无效 customDate', async () => {
  await withMcpClient(async (client) => {
    const invalidDateCalls: Array<[string, Record<string, unknown>]> = [
      ['divine_liuyao', { customDate: 'not-a-date' }],
      ['divine_liuyao', { customDate: 'May 1 2025 08:00:00' }],
      ['liuyao_prompt', { customDate: '2025-01-01T08:00:00', question: '今年事业如何？' }],
      ['divine_meihua', { customDate: '2025-02-30T08:00:00+08:00' }],
      ['meihua_prompt', { customDate: '2025-02-30T08:00:00+08:00', question: '今年事业如何？' }],
      ['divine_xiaoliuren', { customDate: '2025-01-01T24:00:00+00:00' }],
      [
        'xiaoliuren_prompt',
        { customDate: '2025-01-01T24:00:00+00:00', question: '今年事业如何？' },
      ],
      ['qimen_prompt', { customDate: '2025-02-30T08:00:00+08:00', question: '今年事业如何？' }],
      ['divine_liuren', { customDate: '2025-01-01T24:00:00+00:00' }],
    ];

    for (const [name, args] of invalidDateCalls) {
      const result = await client.callTool({ name, arguments: args });
      assert.equal(result.isError, true, `${name} 应返回错误`);
      assert.equal(
        (result.structuredContent as { error?: string } | undefined)?.error,
        'customDate 不是有效时间。',
        `${name} 应返回明确的 customDate 错误`,
      );
    }
  });
});

test('MCP 梅花数字起卦应要求提供对应数字', async () => {
  await withMcpClient(async (client) => {
    for (const name of ['divine_meihua', 'meihua_prompt']) {
      const result = await client.callTool({
        name,
        arguments: {
          method: 'number',
          ...(name.endsWith('_prompt') ? { question: '今年事业如何？' } : {}),
        },
      });
      assert.equal(result.isError, true, `${name} 缺少数字时应返回错误`);
      assert.equal(
        (result.structuredContent as { error?: string } | undefined)?.error,
        'number 必须是正整数。',
      );
    }
  });
});

test('MCP 梅花数字起卦应拒绝超出安全整数范围的数字', async () => {
  await withMcpClient(async (client) => {
    const unsafeInteger = Number.MAX_SAFE_INTEGER + 1;
    const cases: Array<[string, Record<string, unknown>, string]> = [
      ['divine_meihua', { method: 'number', number: unsafeInteger }, 'number 必须是正整数。'],
    ];

    for (const [name, args, message] of cases) {
      const result = await client.callTool({ name, arguments: args });
      assert.equal(result.isError, true, `${name} 超出安全整数范围时应返回错误`);
      assert.equal((result.structuredContent as { error?: string } | undefined)?.error, message);
    }
  });
});

test('MCP 小六壬应拒绝已移除的数字起课方式', async () => {
  await withMcpClient(async (client) => {
    for (const name of ['divine_xiaoliuren', 'xiaoliuren_prompt']) {
      const result = await client.callTool({
        name,
        arguments: {
          xiaoliurenMethod: 'number',
          xiaoliurenNumber: 18,
          ...(name.endsWith('_prompt') ? { question: '今年事业如何？' } : {}),
        },
      });
      assert.equal(result.isError, true, `${name} 应拒绝已移除的数字起课方式`);
    }
  });
});

test('MCP 六爻与大六壬提示词工具保留用户模板范围', async () => {
  await withMcpClient(async (client) => {
    const liuyaoResult = await client.callTool({
      name: 'liuyao_prompt',
      arguments: {
        customDate: '2025-01-01T08:00:00+08:00',
        question: '最近家里总觉得不安，这是不是鬼神怪异或冲犯？',
        liuyaoTemplate: 'guaishen',
      },
    });
    assert.equal(liuyaoResult.isError, undefined, 'liuyao_prompt 不应返回错误');
    const liuyaoPrompt = String(liuyaoResult.structuredContent?.prompt);
    assert.match(liuyaoPrompt, /占法：六爻/);
    assert.match(liuyaoPrompt, /六亲持世：[\s\S]*世应动变：[\s\S]*月日触发：/);
    assert.match(liuyaoPrompt, /【问题范围】\n鬼神怪异/);
    assert.doesNotMatch(liuyaoPrompt, /结构化证据|计算链|证据汇总|解释限制|断卦要点/);
    assertPromptIsPortableTaskText(liuyaoPrompt);

    const liurenResult = await client.callTool({
      name: 'liuren_prompt',
      arguments: {
        customDate: '2025-01-01T08:00:00+08:00',
        question: '我现在要不要换工作？',
        liurenTemplate: 'shiye',
      },
    });
    assert.equal(liurenResult.isError, undefined, 'liuren_prompt 不应返回错误');
    const liurenPrompt = String(liurenResult.structuredContent?.prompt);
    assert.match(liurenPrompt, /占法：大六壬/);
    assert.match(liurenPrompt, /课传主线：[\s\S]*四课：[\s\S]*三传：/);
    assert.match(liurenPrompt, /【问题范围】\n事业工作/);
    assert.doesNotMatch(liurenPrompt, /结构化证据|计算链|证据汇总|解释限制|断课要点/);
    assert.doesNotMatch(liurenPrompt, /取用候选：.*权重\d|吉凶总分[：=]?\d/);
    const liurenData = (
      liurenResult.structuredContent as {
        result: {
          evidenceAnalysis: {
            key: string;
            status: string;
            calculationSteps: Array<{ key: string; dependsOnStepKeys: string[] }>;
            calculationChain: string[];
            transmissionRuleFact: {
              key: string;
              status: string;
              rule: string;
              initialSourceLessonKeys: string[];
              sources: string[];
              limitation: string;
            };
            lessons: Array<{
              key: string;
              relationFacts: Array<{ key: string; ownerKey: string; sources: string[] }>;
              promptText: string;
              sources: string[];
              limitation: string;
            }>;
            transmissions: Array<{
              key: string;
              relationFacts: Array<{ key: string; ownerKey: string; sources: string[] }>;
              promptText: string;
              sources: string[];
              limitation: string;
            }>;
            transitionFacts: Array<{
              key: string;
              fromTransmissionKey: string;
              toTransmissionKey: string;
              promptText: string;
              sources: string[];
            }>;
            counterEvidenceFacts: Array<{ key: string; status: string; limitation: string }>;
            counterSummaryFact: { key: string; factKeys: string[]; limitation: string };
            timingFacts: Array<{
              key: string;
              sourceStatus: string;
              promptText: string;
              sources: string[];
              limitation: string;
            }>;
            focusFacts: Array<{ key: string }>;
            focusSummaryFact: { key: string; status: string; limitation: string };
            calculationFact: {
              key: string;
              monthLeader: string;
              sources: string[];
              limitation: string;
            };
            foundationConventionFact: {
              key: string;
              status: string;
              monthLeaderRules: Array<{ zhongqi: string; monthLeader: string }>;
              noblemanRules: Array<{ dayStems: string[]; dayBranch: string; nightBranch: string }>;
              generalOrder: string[];
              forwardGroundBranches: string[];
              reverseGroundBranches: string[];
              alternativeVersionFields: string[];
              textualVariantFields: string[];
              promptText: string;
              sources: string[];
              limitation: string;
            };
            transmissionConventionFact: {
              key: string;
              status: string;
              lessonRules: Array<{ lesson: string; lowerRule: string; upperRule: string }>;
              methodOrder: string[];
              sheHaiRule: { depthRule: string; tieBreakRule: string; useZeBi: boolean };
              remoteKeRule: string;
              specialMethodRules: Array<{ method: string; rule: string }>;
              alternativeVersionFields: string[];
              promptText: string;
              sources: string[];
              limitation: string;
            };
            plateFact: { key: string; status: string; actualCount: number; limitation: string };
            platePositionFacts: Array<{
              key: string;
              earthBranch: string;
              heavenBranch: string;
              god: string;
              promptText: string;
              sources: string[];
              limitation: string;
            }>;
            traditionalFacts: Array<{
              key: string;
              kind: string;
              originalText: string;
              promptText: string;
              sources: string[];
              limitation: string;
            }>;
            limitations: string[];
            limitationFacts: Array<{ ownerFactKeys: string[] }>;
            summaryFact: {
              key: string;
              status: string;
              platePositionFactCount: number;
              lessonFactCount: number;
              transmissionFactCount: number;
              transitionFactCount: number;
              foundationConventionFactCount: number;
              transmissionConventionFactCount: number;
            };
          };
        };
      }
    ).result;
    assert.equal(liurenData.evidenceAnalysis.key, 'liuren:evidence');
    assert.equal(liurenData.evidenceAnalysis.status, '已计算');
    assert.equal(liurenData.evidenceAnalysis.calculationSteps.length, 7);
    assert.equal(
      liurenData.evidenceAnalysis.calculationChain.length,
      liurenData.evidenceAnalysis.calculationSteps.length,
    );
    const calculationStepKeys = new Set(
      liurenData.evidenceAnalysis.calculationSteps.map((item) => item.key),
    );
    assert.ok(
      liurenData.evidenceAnalysis.calculationSteps.every((item) =>
        item.dependsOnStepKeys.every((key) => calculationStepKeys.has(key)),
      ),
    );
    assert.equal(liurenData.evidenceAnalysis.lessons.length, 4);
    assert.equal(liurenData.evidenceAnalysis.transmissions.length, 3);
    assert.equal(liurenData.evidenceAnalysis.transmissionRuleFact.status, '已确定');
    assert.ok(liurenData.evidenceAnalysis.transmissionRuleFact.rule);
    assert.ok(liurenData.evidenceAnalysis.transmissionRuleFact.initialSourceLessonKeys.length > 0);
    assert.ok(liurenData.evidenceAnalysis.transmissionRuleFact.sources.length >= 2);
    assert.match(
      liurenData.evidenceAnalysis.transmissionRuleFact.limitation,
      /不得按结果反推九宗门名称/,
    );
    assert.ok(
      liurenData.evidenceAnalysis.lessons.every(
        (item) =>
          item.key.startsWith('liuren:lesson:') &&
          item.relationFacts.length > 0 &&
          item.relationFacts.every(
            (fact) => fact.ownerKey === item.key && fact.sources.length > 0,
          ) &&
          item.promptText &&
          item.sources.length >= 2 &&
          item.limitation.includes('不单独证明现实事件'),
      ),
    );
    assert.ok(
      liurenData.evidenceAnalysis.transmissions.every(
        (item) =>
          item.key.startsWith('liuren:transmission:') &&
          item.relationFacts.length >= 6 &&
          item.relationFacts.every(
            (fact) => fact.ownerKey === item.key && fact.sources.length > 0,
          ) &&
          item.promptText &&
          item.sources.length > 0 &&
          item.limitation.includes('阶段顺序不证明现实事件必然'),
      ),
    );
    assert.equal(liurenData.evidenceAnalysis.transitionFacts.length, 2);
    assert.ok(
      liurenData.evidenceAnalysis.transitionFacts.every(
        (item) =>
          item.key.startsWith('liuren:transition:') &&
          item.fromTransmissionKey &&
          item.toTransmissionKey &&
          item.promptText &&
          item.sources.length > 0,
      ),
    );
    assert.equal(
      liurenData.evidenceAnalysis.counterSummaryFact.factKeys.length,
      liurenData.evidenceAnalysis.counterEvidenceFacts.length,
    );
    assert.ok(
      liurenData.evidenceAnalysis.counterEvidenceFacts.every(
        (item) =>
          item.key.startsWith('liuren:counter:') &&
          item.status === '已触发' &&
          item.limitation.includes('不得把单项反证直接写成现实失败'),
      ),
    );
    assert.equal(liurenData.evidenceAnalysis.timingFacts.length, 4);
    assert.ok(
      liurenData.evidenceAnalysis.timingFacts.every(
        (item) =>
          item.key.startsWith('liuren:timing:') &&
          item.sourceStatus === '原结果提供' &&
          item.promptText &&
          item.sources.length >= 2 &&
          item.limitation.includes('不得判断确定快慢'),
      ),
    );
    assert.equal(liurenData.evidenceAnalysis.focusSummaryFact.status, '已提供焦点');
    assert.ok(liurenData.evidenceAnalysis.calculationFact.monthLeader);
    assert.ok(liurenData.evidenceAnalysis.calculationFact.sources.length >= 3);
    assert.match(liurenData.evidenceAnalysis.calculationFact.limitation, /不单独证明现实事件/);
    assert.equal(
      liurenData.evidenceAnalysis.foundationConventionFact.key,
      'liuren:foundation-convention',
    );
    assert.equal(liurenData.evidenceAnalysis.foundationConventionFact.status, '已登记版本边界');
    assert.equal(liurenData.evidenceAnalysis.foundationConventionFact.monthLeaderRules.length, 12);
    assert.equal(
      new Set(
        liurenData.evidenceAnalysis.foundationConventionFact.noblemanRules.flatMap(
          (item) => item.dayStems,
        ),
      ).size,
      10,
    );
    assert.equal(liurenData.evidenceAnalysis.foundationConventionFact.generalOrder.length, 12);
    assert.deepEqual(liurenData.evidenceAnalysis.foundationConventionFact.forwardGroundBranches, [
      '亥',
      '子',
      '丑',
      '寅',
      '卯',
      '辰',
    ]);
    assert.deepEqual(liurenData.evidenceAnalysis.foundationConventionFact.reverseGroundBranches, [
      '巳',
      '午',
      '未',
      '申',
      '酉',
      '戌',
    ]);
    assert.ok(
      liurenData.evidenceAnalysis.foundationConventionFact.alternativeVersionFields.some((item) =>
        item.includes('《六壬寻源》'),
      ),
    );
    assert.ok(
      liurenData.evidenceAnalysis.foundationConventionFact.textualVariantFields.some((item) =>
        item.includes('大雪'),
      ),
    );
    assert.match(
      liurenData.evidenceAnalysis.foundationConventionFact.limitation,
      /异说不得与主版本拼接使用.*整体重排/,
    );
    const transmissionConventionFact = liurenData.evidenceAnalysis.transmissionConventionFact;
    assert.equal(transmissionConventionFact.key, 'liuren:transmission-convention');
    assert.equal(transmissionConventionFact.status, '已登记版本边界');
    assert.equal(transmissionConventionFact.lessonRules.length, 4);
    assert.deepEqual(transmissionConventionFact.methodOrder, [
      '贼克',
      '比用',
      '涉害',
      '遥克',
      '昴星',
      '别责',
      '八专',
      '伏吟',
      '返吟',
    ]);
    assert.equal(transmissionConventionFact.sheHaiRule.useZeBi, false);
    assert.match(transmissionConventionFact.sheHaiRule.depthRule, /实际受克深浅/);
    assert.match(transmissionConventionFact.remoteKeRule, /二、三、四课/);
    assert.ok(
      transmissionConventionFact.specialMethodRules.some(
        (item) => item.method === '八专' && item.rule.includes('癸丑'),
      ),
    );
    assert.ok(
      transmissionConventionFact.alternativeVersionFields.some((item) => item.includes('择比')),
    );
    assert.match(transmissionConventionFact.limitation, /初传发用到中末传整体重排/);
    assert.equal(liurenData.evidenceAnalysis.plateFact.status, '完整');
    assert.equal(liurenData.evidenceAnalysis.plateFact.actualCount, 12);
    assert.equal(liurenData.evidenceAnalysis.platePositionFacts.length, 12);
    assert.ok(
      liurenData.evidenceAnalysis.platePositionFacts.every(
        (item) =>
          item.key &&
          item.earthBranch &&
          item.heavenBranch &&
          item.god &&
          item.promptText &&
          item.sources.length >= 2 &&
          item.limitation.includes('只证明月将加时'),
      ),
    );
    assert.equal(liurenData.evidenceAnalysis.summaryFact.status, '证据链完整');
    assert.equal(
      liurenData.evidenceAnalysis.summaryFact.platePositionFactCount,
      liurenData.evidenceAnalysis.platePositionFacts.length,
    );
    assert.equal(
      liurenData.evidenceAnalysis.summaryFact.lessonFactCount,
      liurenData.evidenceAnalysis.lessons.length,
    );
    assert.equal(
      liurenData.evidenceAnalysis.summaryFact.transmissionFactCount,
      liurenData.evidenceAnalysis.transmissions.length,
    );
    assert.equal(
      liurenData.evidenceAnalysis.summaryFact.transitionFactCount,
      liurenData.evidenceAnalysis.transitionFacts.length,
    );
    assert.equal(liurenData.evidenceAnalysis.summaryFact.foundationConventionFactCount, 1);
    assert.equal(liurenData.evidenceAnalysis.summaryFact.transmissionConventionFactCount, 1);
    assert.equal(liurenData.evidenceAnalysis.limitationFacts.length, 6);
    assert.equal(
      liurenData.evidenceAnalysis.limitations.length,
      liurenData.evidenceAnalysis.limitationFacts.length,
    );
    const factKeys = new Set([
      liurenData.evidenceAnalysis.calculationFact.key,
      liurenData.evidenceAnalysis.foundationConventionFact.key,
      liurenData.evidenceAnalysis.transmissionConventionFact.key,
      liurenData.evidenceAnalysis.plateFact.key,
      ...liurenData.evidenceAnalysis.platePositionFacts.map((item) => item.key),
      liurenData.evidenceAnalysis.transmissionRuleFact.key,
      ...liurenData.evidenceAnalysis.lessons.flatMap((item) => [
        item.key,
        ...item.relationFacts.map((fact) => fact.key),
      ]),
      ...liurenData.evidenceAnalysis.transmissions.flatMap((item) => [
        item.key,
        ...item.relationFacts.map((fact) => fact.key),
      ]),
      ...liurenData.evidenceAnalysis.transitionFacts.map((item) => item.key),
      liurenData.evidenceAnalysis.counterSummaryFact.key,
      ...liurenData.evidenceAnalysis.counterEvidenceFacts.map((item) => item.key),
      ...liurenData.evidenceAnalysis.timingFacts.map((item) => item.key),
      liurenData.evidenceAnalysis.focusSummaryFact.key,
      ...liurenData.evidenceAnalysis.focusFacts.map((item) => item.key),
      ...liurenData.evidenceAnalysis.traditionalFacts.map((item) => item.key),
      liurenData.evidenceAnalysis.summaryFact.key,
    ]);
    assert.ok(
      liurenData.evidenceAnalysis.limitationFacts.every(
        (item) =>
          item.ownerFactKeys.length > 0 && item.ownerFactKeys.every((key) => factKeys.has(key)),
      ),
    );
    assert.ok(liurenData.evidenceAnalysis.traditionalFacts.length > 0);
    assert.ok(
      liurenData.evidenceAnalysis.traditionalFacts.every(
        (item) =>
          item.originalText &&
          item.promptText &&
          item.sources.length > 0 &&
          item.limitation.includes('不证明现实事件'),
      ),
    );
    assert.deepEqual(
      new Set(liurenData.evidenceAnalysis.traditionalFacts.map((item) => item.kind)),
      new Set(['经典取传规则', '课体', '天将属性', '神煞']),
    );
    assert.doesNotMatch(liurenPrompt, /主婚姻|主官非|主疾病|主死丧|主虚而不实/);
    assert.match(liurenPrompt, /古籍依据：/);
    assert.match(liurenPrompt, /应期资料：/);
    assert.match(liurenPrompt, /起盘口径：/);
    assert.match(liurenPrompt, /四课取传口径：/);
    assert.doesNotMatch(liurenPrompt, /【分析思路】/);
    assert.doesNotMatch(liurenPrompt, /关注重点：|岗位路径、协作阻力、窗口时机/);
    assertPromptIsPortableTaskText(liurenPrompt);
  });
});

test('MCP 奇门工具返回位置索引与九宫宫对结构化证据', async () => {
  await withMcpClient(async (client) => {
    const result = await client.callTool({
      name: 'qimen_prompt',
      arguments: {
        customDate: '2025-01-01T08:00:00+08:00',
        question: '我现在要不要推进这个项目？',
      },
    });
    assert.equal(result.isError, undefined, 'qimen_prompt 不应返回错误');
    const prompt = String(result.structuredContent?.prompt);
    const chart = (
      result.structuredContent as {
        result: {
          method: string;
          jiuGongGe: unknown[];
          evidenceAnalysis: {
            key: string;
            status: string;
            calculationEvidenceFacts: Array<{
              key: string;
              status: string;
              sourceKeys: string[];
              limitation: string;
            }>;
            calculationSteps: Array<{ key: string }>;
            calculationChain: string[];
            ruleSourceFacts: Array<{
              key: string;
              status: string;
              rule: string;
              sources: string[];
              promptText: string;
              limitation: string;
            }>;
            palaceCoverageFact: {
              status: string;
              actualGongs: number[];
              missingGongs: number[];
            };
            positionIndexes: Array<{ palaceFactKey: string; indexSources: string[] }>;
            palaceRelations: Array<{
              key: string;
              fromPalaceFactKey: string;
              toPalaceFactKey: string;
              promptText: string;
              sources: string[];
              limitation: string;
            }>;
            counterEvidenceFacts: Array<{
              key: string;
              status: string;
              ownerPalaceFactKey: string;
              sources: string[];
              limitation: string;
            }>;
            counterSummaryFact: { factKeys: string[] };
            timingFacts: Array<{
              key: string;
              promptText: string;
              sources: string[];
              limitation: string;
            }>;
            timingSummaryFact: { factKeys: string[] };
            directionBoundaryFact: { status: string; promptText: string };
            summaryFact: {
              status: string;
              factKeys: string[];
              palaceFactCount: number;
              positionIndexCount: number;
              palaceRelationCount: number;
              patternCount: number;
              counterEvidenceCount: number;
              timingFactCount: number;
            };
            limitations: string[];
            limitationFacts: Array<{
              key: string;
              status: string;
              ownerFactKeys: string[];
              promptText: string;
              sources: string[];
              limitation: string;
            }>;
            patternFacts: Array<{ key: string; status: string }>;
            palaceFacts: Array<{
              key: string;
              status: string;
              patternFactKeys: string[];
              stemRelationFacts: Array<{
                ownerPalaceFactKey: string;
                status: string;
                sources: string[];
                limitation: string;
              }>;
              sources: string[];
              limitation: string;
            }>;
          };
          classicPatterns: Array<Record<string, unknown>>;
          patternCombos: Array<Record<string, unknown>>;
        };
      }
    ).result;
    assert.equal(chart.method, 'zhuanpan');
    assert.equal(chart.evidenceAnalysis.key, 'qimen:evidence');
    assert.equal(chart.evidenceAnalysis.status, '已计算');
    assert.equal(chart.evidenceAnalysis.calculationEvidenceFacts.length, 6);
    assert.equal(chart.evidenceAnalysis.calculationSteps.length, 6);
    assert.equal(chart.evidenceAnalysis.calculationChain.length, 6);
    assert.deepEqual(
      chart.evidenceAnalysis.ruleSourceFacts.map((item) => item.key),
      [
        'rule:qimen:setup',
        'rule:qimen:leaders',
        'rule:qimen:layout',
        'rule:qimen:relations',
        'rule:qimen:day-stem-context-patterns',
        'rule:qimen:year-stem-context-patterns',
        'rule:qimen:geng-value-symbol-pattern',
        'rule:qimen:san-qi-sheng-dian-position',
        'rule:qimen:san-zha-position',
        'rule:qimen:audited-wu-jia-position',
        'rule:qimen:nine-escapes-version-boundary',
        'rule:qimen:san-qi-de-shi-version-boundary',
        'rule:qimen:classic-pattern-audit-boundary',
        'rule:qimen:retained-combo-versions',
        'rule:qimen:special-context-boundary',
        'rule:qimen:direction-boundary',
      ],
    );
    assert.equal(chart.evidenceAnalysis.palaceCoverageFact.status, '完整');
    assert.deepEqual(
      chart.evidenceAnalysis.palaceCoverageFact.actualGongs,
      [1, 2, 3, 4, 5, 6, 7, 8, 9],
    );
    assert.ok(
      chart.evidenceAnalysis.calculationEvidenceFacts.every(
        (item) =>
          item.key.startsWith('qimen:calculation:') &&
          item.status === '已确定' &&
          item.sourceKeys.length > 0 &&
          item.limitation.includes('不证明现实吉凶'),
      ),
    );
    assert.ok(
      chart.evidenceAnalysis.ruleSourceFacts.every(
        (item) =>
          item.key.startsWith('rule:qimen:') &&
          item.status === '已声明' &&
          item.rule &&
          item.sources.length > 0 &&
          item.limitation.includes('不等于现代实证验证'),
      ),
    );
    assert.ok(
      chart.evidenceAnalysis.ruleSourceFacts.some((item) =>
        item.promptText.includes('转盘法九宫规则'),
      ),
    );
    assert.ok(chart.evidenceAnalysis.positionIndexes.length > 0);
    assert.equal(chart.evidenceAnalysis.palaceRelations.length, 36);
    assert.ok(
      chart.evidenceAnalysis.palaceRelations.every(
        (item) =>
          item.key.startsWith('qimen:relation:') &&
          item.fromPalaceFactKey &&
          item.toPalaceFactKey &&
          item.promptText &&
          item.sources.length > 0 &&
          item.limitation.includes('不证明现实中的支持'),
      ),
    );
    assert.equal(
      chart.evidenceAnalysis.counterSummaryFact.factKeys.length,
      chart.evidenceAnalysis.counterEvidenceFacts.length,
    );
    assert.ok(
      chart.evidenceAnalysis.counterEvidenceFacts.every(
        (item) =>
          item.key.startsWith('qimen:counter:') &&
          item.status === '已触发' &&
          item.ownerPalaceFactKey &&
          item.sources.length > 0 &&
          item.limitation.includes('不得把单项位置限制直接写成现实失败'),
      ),
    );
    assert.ok(
      chart.evidenceAnalysis.timingFacts.every(
        (item) =>
          item.key.startsWith('qimen:timing:') &&
          item.promptText &&
          item.sources.length > 0 &&
          item.limitation.includes('不生成相对节奏'),
      ),
    );
    assert.equal(
      chart.evidenceAnalysis.timingSummaryFact.factKeys.length,
      chart.evidenceAnalysis.timingFacts.length,
    );
    assert.equal(chart.evidenceAnalysis.summaryFact.status, '盘面资料完整');
    assert.equal(
      chart.evidenceAnalysis.summaryFact.palaceFactCount,
      chart.evidenceAnalysis.palaceFacts.length,
    );
    assert.equal(
      chart.evidenceAnalysis.summaryFact.positionIndexCount,
      chart.evidenceAnalysis.positionIndexes.length,
    );
    assert.equal(
      chart.evidenceAnalysis.summaryFact.palaceRelationCount,
      chart.evidenceAnalysis.palaceRelations.length,
    );
    assert.equal(
      chart.evidenceAnalysis.summaryFact.patternCount,
      chart.evidenceAnalysis.patternFacts.length,
    );
    assert.equal(
      chart.evidenceAnalysis.summaryFact.counterEvidenceCount,
      chart.evidenceAnalysis.counterEvidenceFacts.length,
    );
    assert.equal(
      chart.evidenceAnalysis.summaryFact.timingFactCount,
      chart.evidenceAnalysis.timingFacts.length,
    );
    assert.equal(chart.evidenceAnalysis.limitationFacts.length, 6);
    assert.equal(
      chart.evidenceAnalysis.limitations.length,
      chart.evidenceAnalysis.limitationFacts.length,
    );
    const factKeys = new Set([
      'qimen:evidence-summary',
      ...chart.evidenceAnalysis.summaryFact.factKeys,
    ]);
    assert.ok(
      chart.evidenceAnalysis.limitationFacts.every(
        (item) =>
          item.key.startsWith('qimen:limitation:') &&
          item.status === '适用' &&
          item.ownerFactKeys.every((key) => factKeys.has(key)) &&
          item.promptText &&
          item.sources.length > 0 &&
          item.limitation.includes('不得被反向当作现实吉凶'),
      ),
    );
    assert.match(
      chart.evidenceAnalysis.directionBoundaryFact.promptText,
      /不生成吉方、避方或候选方向/,
    );
    assert.equal((chart as unknown as Record<string, unknown>).yingQi, undefined);
    assert.doesNotMatch(
      JSON.stringify({ chart, prompt }),
      /天网四张|宜静不宜动|判断人事状态、方向和时机|吉门吉星需|凶象也要看|方向和时机均从/,
    );
    assert.equal(chart.evidenceAnalysis.palaceFacts.length, chart.jiuGongGe.length);
    assert.ok(
      chart.evidenceAnalysis.palaceFacts.every(
        (item) =>
          item.status === '已计算' &&
          item.patternFactKeys.every((key) =>
            chart.evidenceAnalysis.patternFacts.some((fact) => fact.key === key),
          ) &&
          item.stemRelationFacts.every(
            (fact) =>
              fact.ownerPalaceFactKey === item.key &&
              fact.status === '已计算' &&
              fact.sources.length > 0 &&
              fact.limitation.includes('不单独证明现实吉凶'),
          ) &&
          item.sources.length >= 3 &&
          item.limitation.includes('不单独证明现实吉凶'),
      ),
    );
    assert.ok(
      chart.evidenceAnalysis.positionIndexes.every((item) =>
        chart.evidenceAnalysis.palaceFacts.some((fact) => fact.key === item.palaceFactKey),
      ),
    );
    assert.ok(chart.classicPatterns.every((item) => item.score === undefined));
    assert.ok(chart.patternCombos.every((item) => item.score === undefined));
    assert.equal((chart as unknown as Record<string, unknown>).directions, undefined);
    assert.match(prompt, /占法：奇门遁甲/);
    assert.match(prompt, /核心结构：[\s\S]*值符值使与时干：[\s\S]*旬空与马星：/);
    assert.match(prompt, /九宫原始盘：[\s\S]*九宫宫对五行关系（全部36组无序宫对）/);
    assert.match(prompt, /节气交接：[\s\S]*月相：/);
    assert.doesNotMatch(prompt, /结构化证据|计算链|证据汇总|解释限制|证据边界/);
    assert.doesNotMatch(prompt, /主宫评分|辅宫评分|评分-?\d+|（-?\d+分|应期范围\d/);
    assert.doesNotMatch(prompt, /大吉格|大凶格|显著加快|显著延迟/);
    assert.doesNotMatch(prompt, /项目以|项目规则|项目计算|命语|本项目|项目统一|工程|算法结果/);
    assertPromptIsPortableTaskText(prompt);
  });
});

test('MCP 生肖工具只返回逐项关系证据，不返回综合吉凶等级', async () => {
  await withMcpClient(async (client) => {
    const result = await client.callTool({
      name: 'metaphysics_zodiac',
      arguments: { zodiac: '马', yearGanZhi: '庚子' },
    });
    assert.equal(result.isError, undefined, 'metaphysics_zodiac 不应返回错误');
    const chart = (
      result.structuredContent as {
        result: Record<string, unknown> & {
          evidenceAnalysis: {
            calculationSteps: Array<{
              key: string;
              status: string;
              dependsOnStepKeys: string[];
              promptText: string;
              sources: string[];
              dependsOnStepKeys: string[];
              limitation: string;
            }>;
            relations: Array<{
              key: string;
              status: string;
              sources: string[];
              promptText: string;
              limitation: string;
            }>;
            counterEvidenceFacts: Array<{
              type: string;
              status: string;
              ownerRelationKeys: string[];
              ownerFactKeys: string[];
            }>;
            counterSummaryFact: { status: string; factKeys: string[] };
            summaryFact: {
              key: string;
              status: string;
              factKeys: string[];
              relationFactCount: number;
              primaryEvidenceCount: number;
              supportingEvidenceCount: number;
              counterEvidenceCount: number;
              limitationFactCount: number;
            };
            limitations: string[];
            limitationFacts: Array<{
              key: string;
              status: string;
              ownerFactKeys: string[];
              sources: string[];
            }>;
            promptText: string;
          };
        };
      }
    ).result;
    assert.deepEqual(chart.generation, {
      zodiacBranch: '午',
      yearGanZhi: '庚子',
    });
    assert.equal(chart.interpretationBoundary, '仅限生肖与流年关系');
    assert.equal(chart.evidenceAnalysis.key, 'zodiac:evidence');
    assert.equal(chart.evidenceAnalysis.status, '已计算');
    assert.equal(chart.level, undefined);
    assert.equal(chart.confidence, undefined);
    assert.equal(chart.evidenceAnalysis.calculationSteps.length, 4);
    assert.ok(
      chart.evidenceAnalysis.calculationSteps.every(
        (item) =>
          item.key.startsWith('zodiac:calculation:') &&
          item.status === '已计算' &&
          Array.isArray(item.dependsOnStepKeys) &&
          item.promptText &&
          item.sources.length >= 2 &&
          item.limitation.includes('不证明个人现实事件'),
      ),
    );
    assert.ok(
      chart.evidenceAnalysis.relations.every(
        (item) =>
          item.key.startsWith('关系:') &&
          item.status === '已命中' &&
          item.sources.length >= 2 &&
          item.promptText.length > 0 &&
          item.limitation.includes('不证明现实事件'),
      ),
    );
    assert.equal(chart.evidenceAnalysis.counterEvidenceFacts.length, 3);
    assert.equal(
      chart.evidenceAnalysis.counterEvidenceFacts.find((item) => item.type === '太岁关系覆盖')
        ?.status,
      '有可用证据',
    );
    assert.equal(chart.evidenceAnalysis.counterSummaryFact.status, '有未命中关系');
    assert.equal(chart.evidenceAnalysis.limitationFacts.length, 5);
    assert.equal(chart.evidenceAnalysis.summaryFact.key, 'zodiac:evidence-summary');
    assert.equal(chart.evidenceAnalysis.summaryFact.status, '证据链完整');
    assert.equal(
      chart.evidenceAnalysis.summaryFact.relationFactCount,
      chart.evidenceAnalysis.relations.length,
    );
    assert.equal(
      chart.evidenceAnalysis.summaryFact.counterEvidenceCount,
      chart.evidenceAnalysis.counterEvidenceFacts.length,
    );
    assert.equal(
      chart.evidenceAnalysis.summaryFact.limitationFactCount,
      chart.evidenceAnalysis.limitationFacts.length,
    );
    const zodiacFactKeys = new Set([
      chart.evidenceAnalysis.summaryFact.key,
      ...chart.evidenceAnalysis.summaryFact.factKeys,
    ]);
    assert.ok(
      chart.evidenceAnalysis.counterEvidenceFacts.every(
        (item) =>
          item.ownerFactKeys.length > 0 &&
          item.ownerFactKeys.every((key) => zodiacFactKeys.has(key)),
      ),
    );
    assert.ok(
      chart.evidenceAnalysis.limitationFacts.every(
        (item) =>
          item.ownerFactKeys.length > 0 &&
          item.ownerFactKeys.every((key) => zodiacFactKeys.has(key)),
      ),
    );
    assert.equal(
      chart.evidenceAnalysis.limitations.length,
      chart.evidenceAnalysis.limitationFacts.length,
    );
    assert.doesNotMatch(
      chart.evidenceAnalysis.promptText,
      /命语|本项目|项目统一|工程|接口|API|MCP/,
    );
    assert.match(chart.evidenceAnalysis.promptText, /证据汇总：[\s\S]*解释限制：/);
    assert.doesNotMatch(JSON.stringify(chart), AUTOMATIC_ZODIAC_CONCLUSION);
    assertPromptIsPortableTaskText(chart.evidenceAnalysis.promptText);
  });
});

test('MCP 生肖工具返回三会固定关系且不生成贵人、利弊或行动字段', async () => {
  await withMcpClient(async (client) => {
    const result = await client.callTool({
      name: 'metaphysics_zodiac',
      arguments: { zodiac: '虎', yearGanZhi: '丁卯' },
    });
    assert.equal(result.isError, undefined, 'metaphysics_zodiac 不应返回错误');
    const chart = (result.structuredContent as { result: Record<string, any> }).result;
    assert.equal(chart.meeting, '三会组成员关系（东方木）');
    assert.equal(chart.harmony, null);
    for (const removedField of ['noble', 'favorableRelations', 'riskRelations', 'actionSignals']) {
      assert.equal(removedField in chart, false);
    }
    assert.ok(
      chart.evidenceAnalysis.relations.some(
        (item: { category: string; relation: string }) =>
          item.category === '地支组成员' && item.relation === '三会组成员关系（东方木）',
      ),
    );
    assert.match(chart.evidenceAnalysis.promptText, /十二地支三会组成员表/);
    assert.doesNotMatch(JSON.stringify(chart), AUTOMATIC_ZODIAC_CONCLUSION);
  });
});

test('MCP 太乙工具返回年计七十二局结构化证据', async () => {
  await withMcpClient(async (client) => {
    const result = await client.callTool({
      name: 'taiyi_prompt',
      arguments: {
        year: 2004,
        scope: 'year',
        question: '请分析这一年适合采取什么行动。',
      },
    });
    assert.equal(result.isError, undefined, 'taiyi_prompt 不应返回错误');
    const prompt = String(result.structuredContent?.prompt);
    const chart = (
      result.structuredContent as {
        result: {
          year: number;
          evidenceAnalysis: {
            key: string;
            status: string;
            calculationChain: unknown[];
            calculationSteps: Array<{
              key: string;
              status: string;
              promptText: string;
              sources: string[];
              limitation: string;
            }>;
            primaryFacts: unknown[];
            counterEvidence: string[];
            counterEvidenceFacts: Array<{
              key: string;
              type: string;
              status: string;
              ownerConditionKey: string;
              ownerFactKeys: string[];
              sources: string[];
            }>;
            counterSummaryFact: { status: string; factKeys: string[] };
            summaryFact: {
              key: string;
              status: string;
              factKeys: string[];
              positionFactCount: number;
              forceFactCount: number;
              sixteenGodFactCount: number;
              conditionFactCount: number;
              counterEvidenceCount: number;
              limitationFactCount: number;
            };
            limitations: string[];
            limitationFacts: Array<{
              key: string;
              status: string;
              ownerFactKeys: string[];
              sources: string[];
            }>;
            positionFacts: unknown[];
            forceFacts: Array<{
              status: string;
              calculationStepKeys: string[];
              promptText: string;
              sources: string[];
              limitation: string;
            }>;
            sixteenGodFacts: unknown[];
            conditionFacts: unknown[];
          };
        };
      }
    ).result;
    assert.equal(chart.year, 2004);
    assert.equal(chart.evidenceAnalysis.key, 'taiyi:evidence');
    assert.equal(chart.evidenceAnalysis.status, '已计算');
    assert.ok(chart.evidenceAnalysis.calculationChain.length >= 5);
    assert.equal(chart.evidenceAnalysis.calculationSteps.length, 4);
    assert.ok(
      chart.evidenceAnalysis.calculationSteps.every(
        (item) =>
          item.key.startsWith('taiyi:calculation:') &&
          item.status === '已复算' &&
          Array.isArray(item.dependsOnStepKeys) &&
          item.promptText &&
          item.sources.length >= 2 &&
          item.limitation.includes('不证明传统解释有效性'),
      ),
    );
    assert.ok(chart.evidenceAnalysis.primaryFacts.length >= 4);
    assert.equal(chart.evidenceAnalysis.positionFacts.length, 4);
    assert.equal(chart.evidenceAnalysis.forceFacts.length, 3);
    assert.equal(chart.evidenceAnalysis.sixteenGodFacts.length, 16);
    assert.equal(chart.evidenceAnalysis.conditionFacts.length, 4);
    assert.equal(chart.evidenceAnalysis.counterEvidenceFacts.length, 4);
    assert.equal(chart.evidenceAnalysis.counterSummaryFact.status, '存在未命中条件');
    assert.equal(chart.evidenceAnalysis.counterSummaryFact.factKeys.length, 2);
    assert.equal(chart.evidenceAnalysis.limitationFacts.length, 5);
    assert.equal(chart.evidenceAnalysis.summaryFact.key, 'taiyi:evidence-summary');
    assert.equal(chart.evidenceAnalysis.summaryFact.status, '证据链完整');
    assert.equal(
      chart.evidenceAnalysis.summaryFact.positionFactCount,
      chart.evidenceAnalysis.positionFacts.length,
    );
    assert.equal(
      chart.evidenceAnalysis.summaryFact.forceFactCount,
      chart.evidenceAnalysis.forceFacts.length,
    );
    assert.equal(
      chart.evidenceAnalysis.summaryFact.sixteenGodFactCount,
      chart.evidenceAnalysis.sixteenGodFacts.length,
    );
    assert.equal(
      chart.evidenceAnalysis.summaryFact.conditionFactCount,
      chart.evidenceAnalysis.conditionFacts.length,
    );
    assert.equal(
      chart.evidenceAnalysis.summaryFact.counterEvidenceCount,
      chart.evidenceAnalysis.counterEvidenceFacts.length,
    );
    assert.equal(
      chart.evidenceAnalysis.summaryFact.limitationFactCount,
      chart.evidenceAnalysis.limitationFacts.length,
    );
    const taiyiFactKeys = new Set([
      chart.evidenceAnalysis.summaryFact.key,
      ...chart.evidenceAnalysis.summaryFact.factKeys,
    ]);
    assert.ok(
      chart.evidenceAnalysis.counterEvidenceFacts.every(
        (item) =>
          item.ownerFactKeys.length > 0 &&
          item.ownerFactKeys.every((key) => taiyiFactKeys.has(key)),
      ),
    );
    assert.ok(
      chart.evidenceAnalysis.limitationFacts.every(
        (item) =>
          item.ownerFactKeys.length > 0 &&
          item.ownerFactKeys.every((key) => taiyiFactKeys.has(key)),
      ),
    );
    assert.equal(
      chart.evidenceAnalysis.limitations.length,
      chart.evidenceAnalysis.limitationFacts.length,
    );
    assert.ok(
      chart.evidenceAnalysis.forceFacts.every(
        (item) =>
          item.status === '已计算' &&
          item.calculationStepKeys.includes('taiyi:calculation:bureau') &&
          item.promptText &&
          item.sources.length >= 2 &&
          item.limitation.includes('不直接证明现实胜负'),
      ),
    );
    assert.ok(
      chart.evidenceAnalysis.conditionFacts.some(
        (item) => item.kind === '囚' && item.status === '已命中',
      ),
    );
    assertPromptHasSingleRole(prompt, PROMPT_ROLE_TEXT.taiyi);
    assert.match(prompt, /【太乙神数 · 年计】/);
    assert.match(prompt, /核心宫位：[\s\S]*主客定算：[\s\S]*将参：/);
    assert.doesNotMatch(prompt, /结构化证据|计算链|证据汇总|解释限制|证据边界/);
    assert.doesNotMatch(prompt, /宜先守后动|不宜轻进/);
    assert.doesNotMatch(prompt, /\d+(?:\.\d+)?%|成功率(?:为|：)|匹配率(?:为|：)|吉凶总分(?:为|：)/);
    assert.doesNotMatch(prompt, /命语|本项目|项目统一|当前结果|工程|接口|API|MCP/);
    assertPromptIsPortableTaskText(prompt);
  });
});

test('MCP 六爻支持模拟三钱投掷与随机轨迹重放', async () => {
  await withMcpClient(async (client) => {
    const first = await client.callTool({
      name: 'divine_liuyao',
      arguments: {
        customDate: '2025-01-01T08:00:00+08:00',
        method: 'coins',
        seed: 'MCP 固定样例',
      },
    });
    assert.equal(first.isError, undefined);
    type LiuyaoReplayResult = {
      generation: { method: string; source: string; coinThrows: unknown[] };
      yaoArray: number[];
      evidenceAnalysis: {
        key: string;
        status: string;
        calculationSteps: Array<{
          key: string;
          stage: string;
          status: string;
          dependsOnStepKeys: string[];
        }>;
        calculationChain: string[];
        candidates: Array<{
          key: string;
          status: string;
          sourceStatus: string;
          candidateRole: string;
          matchingTier: string | null;
          referenceKeys: string[];
          promptText: string;
          sources: string[];
          limitation: string;
        }>;
        selectionFact: {
          status: string;
          targetRelative: string | null;
          selectedCandidateKey: string | null;
          selectedReferenceKey: string | null;
        };
        selectedCandidate: unknown | null;
        godChain: unknown[];
        godInteractionFacts: unknown[];
        lineCoverageFact: { status: string; actualPositions: number[] };
        lineFacts: Array<{ status: string; sources: string[]; limitation: string }>;
        counterEvidenceFacts: Array<{
          key: string;
          status: string;
          ownerCandidateKey: string;
          sources: string[];
          limitation: string;
        }>;
        counterSummaryFact: { factKeys: string[] };
        timingFacts: Array<{
          key: string;
          promptText: string;
          sources: string[];
          limitation: string;
        }>;
        timingSummaryFact: { factKeys: string[] };
        summaryFact: {
          status: string;
          factKeys: string[];
          lineFactCount: number;
          hiddenSpiritFactCount: number;
          candidateCount: number;
          matchedCandidateCount: number;
          godChainFactCount: number;
          godInteractionFactCount: number;
          structureFactCount: number;
          counterEvidenceCount: number;
          timingFactCount: number;
        };
        limitations: string[];
        limitationFacts: Array<{
          key: string;
          status: string;
          ownerFactKeys: string[];
          promptText: string;
          sources: string[];
          limitation: string;
        }>;
        hiddenSpiritFacts: unknown[];
        generationFact: {
          status: string;
          method: string;
          coinThrows: unknown[];
          recordedLineCount: number;
          sources: string[];
        };
        promptText: string;
      };
      hiddenSpirits?: unknown[];
      meta: { resultId: string; random: { samples: number[] } };
    };
    const firstResult = (first.structuredContent as { result: LiuyaoReplayResult }).result;
    assert.equal(firstResult.generation.method, 'coins');
    assert.equal(firstResult.generation.source, 'random-coin-simulation');
    assert.equal(firstResult.generation.coinThrows.length, 6);
    assert.equal(firstResult.evidenceAnalysis.key, 'liuyao:evidence');
    assert.equal(firstResult.evidenceAnalysis.status, '已计算');
    assert.equal(firstResult.evidenceAnalysis.calculationSteps.length, 7);
    assert.equal(firstResult.evidenceAnalysis.calculationChain.length, 7);
    assert.ok(
      firstResult.evidenceAnalysis.calculationSteps.every((step) =>
        step.dependsOnStepKeys.every((key) =>
          firstResult.evidenceAnalysis.calculationSteps.some((candidate) => candidate.key === key),
        ),
      ),
    );
    assert.ok(firstResult.evidenceAnalysis.candidates.length > 0);
    assert.equal(firstResult.evidenceAnalysis.selectionFact.status, '取用范围待定');
    assert.equal(firstResult.evidenceAnalysis.selectionFact.targetRelative, null);
    assert.equal(firstResult.evidenceAnalysis.selectionFact.selectedCandidateKey, null);
    assert.equal(firstResult.evidenceAnalysis.selectionFact.selectedReferenceKey, null);
    assert.equal(firstResult.evidenceAnalysis.selectedCandidate, null);
    assert.equal(firstResult.evidenceAnalysis.godChain.length, 0);
    assert.equal(firstResult.evidenceAnalysis.godInteractionFacts.length, 0);
    assert.equal(firstResult.evidenceAnalysis.summaryFact.godInteractionFactCount, 0);
    assert.equal(firstResult.evidenceAnalysis.lineCoverageFact.status, '完整');
    assert.deepEqual(
      firstResult.evidenceAnalysis.lineCoverageFact.actualPositions,
      [1, 2, 3, 4, 5, 6],
    );
    assert.equal(firstResult.evidenceAnalysis.lineFacts.length, 6);
    assert.equal(firstResult.evidenceAnalysis.generationFact.status, '可核验');
    assert.equal(firstResult.evidenceAnalysis.generationFact.method, 'coins');
    assert.equal(firstResult.evidenceAnalysis.generationFact.coinThrows.length, 6);
    assert.equal(firstResult.evidenceAnalysis.generationFact.recordedLineCount, 6);
    assert.ok(firstResult.evidenceAnalysis.generationFact.sources.length >= 2);
    assert.equal(
      firstResult.evidenceAnalysis.hiddenSpiritFacts.length,
      firstResult.hiddenSpirits?.length ?? 0,
    );
    assert.ok(
      firstResult.evidenceAnalysis.lineFacts.every(
        (item) =>
          item.status === '已计算' &&
          item.sources.length >= 3 &&
          item.limitation.includes('不单独证明现实吉凶'),
      ),
    );
    assert.ok(
      firstResult.evidenceAnalysis.candidates.every(
        (item) =>
          item.key.startsWith('liuyao:candidate:') &&
          item.status &&
          item.sourceStatus &&
          item.candidateRole === '辅助观察' &&
          item.matchingTier === null &&
          item.referenceKeys.length >= 0 &&
          item.promptText &&
          item.sources.length > 0 &&
          item.limitation.includes('候选不等于已证明现实事项'),
      ),
    );
    assert.equal(
      firstResult.evidenceAnalysis.counterSummaryFact.factKeys.length,
      firstResult.evidenceAnalysis.counterEvidenceFacts.length,
    );
    assert.ok(
      firstResult.evidenceAnalysis.counterEvidenceFacts.every(
        (item) =>
          item.key.startsWith('liuyao:counter:') &&
          item.status === '已触发' &&
          item.ownerCandidateKey &&
          item.sources.length > 0 &&
          item.limitation.includes('不得把单项反证直接写成现实失败'),
      ),
    );
    assert.equal(
      firstResult.evidenceAnalysis.timingSummaryFact.factKeys.length,
      firstResult.evidenceAnalysis.timingFacts.length,
    );
    assert.equal(firstResult.evidenceAnalysis.summaryFact.status, '用神取用待定');
    assert.equal(
      firstResult.evidenceAnalysis.summaryFact.lineFactCount,
      firstResult.evidenceAnalysis.lineFacts.length,
    );
    assert.equal(
      firstResult.evidenceAnalysis.summaryFact.hiddenSpiritFactCount,
      firstResult.evidenceAnalysis.hiddenSpiritFacts.length,
    );
    assert.equal(
      firstResult.evidenceAnalysis.summaryFact.candidateCount,
      firstResult.evidenceAnalysis.candidates.length,
    );
    assert.equal(
      firstResult.evidenceAnalysis.summaryFact.counterEvidenceCount,
      firstResult.evidenceAnalysis.counterEvidenceFacts.length,
    );
    assert.equal(firstResult.evidenceAnalysis.limitationFacts.length, 6);
    assert.equal(
      firstResult.evidenceAnalysis.limitations.length,
      firstResult.evidenceAnalysis.limitationFacts.length,
    );
    const factKeys = new Set([
      'liuyao:evidence-summary',
      ...firstResult.evidenceAnalysis.summaryFact.factKeys,
    ]);
    assert.ok(
      firstResult.evidenceAnalysis.limitationFacts.every(
        (item) =>
          item.key.startsWith('liuyao:limitation:') &&
          item.status === '适用' &&
          item.ownerFactKeys.every((key) => factKeys.has(key)) &&
          item.promptText &&
          item.sources.length > 0 &&
          item.limitation.includes('不得被反向当作现实吉凶'),
      ),
    );
    assert.ok(
      firstResult.evidenceAnalysis.timingFacts.every(
        (item) =>
          item.key.startsWith('liuyao:timing:') &&
          item.promptText &&
          item.sources.length > 0 &&
          item.limitation.includes('不得把爻位'),
      ),
    );
    assert.match(firstResult.evidenceAnalysis.promptText, /【六爻用神作用链结构化证据】/);
    assert.match(firstResult.evidenceAnalysis.promptText, /六爻逐爻计算事实/);
    assert.match(firstResult.evidenceAnalysis.promptText, /证据汇总：/);
    assert.match(firstResult.evidenceAnalysis.promptText, /解释限制：/);
    assertPromptIsPortableTaskText(firstResult.evidenceAnalysis.promptText);

    const replay = await client.callTool({
      name: 'divine_liuyao',
      arguments: {
        customDate: '2025-01-01T08:00:00+08:00',
        method: 'coins',
        replay: firstResult.meta.random.samples,
      },
    });
    assert.equal(replay.isError, undefined);
    const replayResult = (replay.structuredContent as { result: LiuyaoReplayResult }).result;
    assert.deepEqual(replayResult.yaoArray, firstResult.yaoArray);
    assert.equal(replayResult.meta.resultId, firstResult.meta.resultId);

    const coinThrows = [
      { coins: [2, 2, 2], total: 6 },
      { coins: [2, 2, 3], total: 7 },
      { coins: [2, 3, 3], total: 8 },
      { coins: [3, 3, 3], total: 9 },
      { coins: [2, 2, 3], total: 7 },
      { coins: [2, 3, 3], total: 8 },
    ];
    const recorded = await client.callTool({
      name: 'divine_liuyao',
      arguments: {
        customDate: '2025-01-01T08:00:00+08:00',
        coinThrows,
      },
    });
    assert.equal(recorded.isError, undefined);
    const recordedResult = (recorded.structuredContent as { result: LiuyaoReplayResult }).result;
    assert.equal(recordedResult.generation.method, 'coins');
    assert.equal(recordedResult.generation.source, 'provided-coin-throws');
    assert.deepEqual(recordedResult.yaoArray, [6, 7, 8, 9, 7, 8]);
    assert.equal(recordedResult.meta.random, undefined);
    assert.notEqual(recordedResult.meta.resultId, firstResult.meta.resultId);
  });
});
