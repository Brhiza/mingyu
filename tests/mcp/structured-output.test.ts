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
  ['metaphysics_taiyi', { year: 2004, scope: 'year' }],
  ['metaphysics_zodiac', { zodiac: '鼠', year: 2026 }],
  ['metaphysics_wuyun_liuqi', { year: 2026, yearGanZhi: '丙午' }],
  ['metaphysics_huangji_jingshi', { epochYear: 1000, year: 2026 }],
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
    /【排盘信息】[\s\S]*【核心判断】[\s\S]*【四柱】/,
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
    /【八宅风水排盘】[\s\S]*命卦：[\s\S]*四吉方：[\s\S]*【问题】\n办公桌朝向怎么选？/,
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
    /【住宅风水排盘】[\s\S]*八宅：[\s\S]*【问题】\n这套房怎么看？/,
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
    { zodiac: '鼠', yearGanZhi: '丙午', question: '请解释本年的生肖关系。' },
    /【生肖与流年关系简析】[\s\S]*【问题】\n请解释本年的生肖关系。/,
  ],
  [
    'wuyun_liuqi_prompt',
    { yearGanZhi: '丙午', question: '请解释本年的气候节律。' },
    /【问题】\n请解释本年的气候节律。[\s\S]*【盘面资料】[\s\S]*年干支：丙午/,
  ],
  [
    'huangji_jingshi_prompt',
    { epochYear: 1000, year: 2026, question: '请解释目标年的周期位置。' },
    /【问题】\n请解释目标年的周期位置。[\s\S]*【周期资料】[\s\S]*目标年坐标：2026/,
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
  'qimen_prompt',
  'liuren_prompt',
  'tarot_prompt',
  'ssgw_prompt',
  'almanac_prompt',
  'astrolabe_prompt',
  'astrolabe_synastry_prompt',
  'bazhai_prompt',
  'residential_prompt',
  'taiyi_prompt',
  'wuyun_liuqi_prompt',
  'huangji_jingshi_prompt',
  'xiaoliuren_prompt',
  'jinkoujue_prompt',
  'lenormand_prompt',
  'zodiac_prompt',
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

    assert.equal(tools.length, 60);
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
    assert.ok(tools.find((tool) => tool.name === 'metaphysics_residential'));
    assert.ok(tools.find((tool) => tool.name === 'residential_prompt'));
    assert.ok(tools.find((tool) => tool.name === 'metaphysics_xuankong'));
    assert.ok(tools.find((tool) => tool.name === 'xuankong_prompt'));
    assert.ok(tools.find((tool) => tool.name === 'divine_xiaoliuren'));
    assert.ok(tools.find((tool) => tool.name === 'divine_jinkoujue'));
    assert.ok(tools.find((tool) => tool.name === 'divine_lenormand'));
    assert.ok(tools.find((tool) => tool.name === 'metaphysics_zodiac'));
    assert.ok(tools.find((tool) => tool.name === 'metaphysics_wuyun_liuqi'));
    assert.ok(tools.find((tool) => tool.name === 'wuyun_liuqi_prompt'));
    assert.ok(tools.find((tool) => tool.name === 'metaphysics_huangji_jingshi'));
    assert.ok(tools.find((tool) => tool.name === 'huangji_jingshi_prompt'));

    assert.equal(
      tools.some((tool) => tool.name === 'build_divination_prompt'),
      false,
    );
    for (const name of promptToolNames) {
      assert.equal(
        tools.find((tool) => tool.name === name)?.outputSchema?.properties?.result,
        undefined,
      );
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

test('MCP 排盘工具应返回 structuredContent，文本兼容输出不重复完整 JSON', async () => {
  await withMcpClient(async (client) => {
    for (const [name, args] of toolCalls) {
      const arguments_ =
        name.startsWith('foundation_') || name.startsWith('calendar_')
          ? args
          : { ...args, detailMode: 'full' };
      const result = await client.callTool({ name, arguments: arguments_ });
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
            hiddenContributions: Array<{ stem: string; wuxing: string; weight: number }>;
          }>;
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
        assert.deepEqual(analysis.dominantElements, ['火']);
        assert.deepEqual(analysis.weakestElements, ['金']);
        assert.equal(analysis.summaryFact.itemFactCount, analysis.itemFacts.length);
        assert.equal(analysis.summaryFact.limitationFactCount, analysis.limitationFacts.length);
        assert.match(analysis.promptText, /不是命理吉凶评分/);
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
        assert.match(analysis.promptText, /【神煞】/);
        assert.doesNotMatch(analysis.promptText, /不得凭单项神煞定吉凶/);
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
          };
        };
        const analysis = chart.result?.evidenceAnalysis;
        const previousTermEvidence = chart.result?.seasonInfo?.previousTermEvidence;
        const stepKeys = new Set(analysis?.calculationSteps?.map((item) => item.key));
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
              }>;
              evidence_analysis?: {
                key?: string;
                status?: string;
                calculationSteps?: Array<{ key: string }>;
                counterEvidenceFacts?: Array<{ key?: string; ownerFactKeys?: string[] }>;
                summaryFact?: { key?: string; factKeys?: string[]; evidenceFactCount?: number };
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
        const chart = (
          result.structuredContent as {
            result?: {
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
      assert.equal(text, '结构化结果已返回，请读取 structuredContent。');
      assert.ok(text.length < 100);
    }
  });
});

test('MCP 排盘工具默认保留盘面并省略冗长证据', async () => {
  await withMcpClient(async (client) => {
    const calls: Array<[string, Record<string, unknown>, string]> = [
      ['divine_tarot', { spreadType: 'single', seed: '默认精简样例' }, 'cards'],
      [
        'bazi_calculate',
        { gender: 'male', year: 1990, month: 5, day: 15, timeIndex: 1, dateType: 'solar' },
        'pillars',
      ],
      [
        'metaphysics_residential',
        { birthYear: 1990, gender: 'male', year: 2024, doorToInteriorDegree: 0 },
        'bazhai',
      ],
    ];

    for (const [name, arguments_, coreKey] of calls) {
      const response = await client.callTool({ name, arguments: arguments_ });
      assert.equal(response.isError, undefined, `${name} 不应返回错误`);
      const result = (response.structuredContent as { result?: Record<string, unknown> }).result;
      assert.ok(result?.[coreKey], `${name} 应保留核心盘面字段 ${coreKey}`);
      assert.doesNotMatch(
        JSON.stringify(response.structuredContent),
        /"(?:prompt|evidenceAnalysis|evidence_analysis|evidencePromptText|calculationChain|calculationSteps|trueSolarEvidence|timezoneEvidence)"/,
        `${name} 默认结果不应混入完整证据链`,
      );
    }
  });
});

test('MCP 生肖流年应拒绝缺失或互相冲突的年份依据', async () => {
  await withMcpClient(async (client) => {
    for (const [name, arguments_] of [
      ['metaphysics_zodiac', { zodiac: '鼠' }],
      ['zodiac_prompt', { zodiac: '鼠', year: 1900, yearGanZhi: '甲子' }],
    ] as const) {
      const result = await client.callTool({ name, arguments: arguments_ });
      assert.equal(result.isError, true, `${name} 应拒绝不完整或冲突年份`);
      assert.match(
        String((result.structuredContent as { error?: string } | undefined)?.error),
        /必须提供 year 或 yearGanZhi|不一致/,
      );
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

    const iana = await client.callTool({
      name: 'calendar_true_solar_time',
      arguments: {
        localDateTime: '2024-07-01T12:00:00',
        longitude: -74.006,
        timeZoneId: 'America/New_York',
      },
    });
    assert.equal(iana.isError, undefined);
    assert.equal(iana.structuredContent?.result.timezone, -4);
    assert.equal(iana.structuredContent?.result.timezoneEvidence.timeZoneId, 'America/New_York');

    const ambiguous = await client.callTool({
      name: 'calendar_true_solar_time',
      arguments: {
        localDateTime: '2024-11-03T01:30:00',
        longitude: -74.006,
        timeZoneId: 'America/New_York',
      },
    });
    assert.equal(ambiguous.isError, true);
    const ambiguousText = ambiguous.content[0]?.type === 'text' ? ambiguous.content[0].text : '';
    assert.match(ambiguousText, /回拨歧义.*timezone/);

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

test('MCP 一站式提示词工具应只返回 prompt，避免混入完整排盘', async () => {
  await withMcpClient(async (client) => {
    for (const [name, args, promptPattern] of promptToolCalls) {
      const result = await client.callTool({ name, arguments: args });

      assert.equal(result.isError, undefined, `${name} 不应返回错误`);
      assert.deepEqual(Object.keys(result.structuredContent ?? {}), ['prompt']);
      const prompt = String(result.structuredContent?.prompt);
      assert.match(prompt, promptPattern, `${name} prompt 格式不正确`);
      assertPromptIsPortableTaskText(prompt);

      const text = result.content[0]?.type === 'text' ? result.content[0].text : '';
      assert.equal(text, prompt);
      assert.ok(JSON.stringify(result).length < prompt.length * 3 + 1000);
    }
  });
});

test('MCP 五运六气与皇极经世应返回可复核结构并严格拒绝冲突输入', async () => {
  await withMcpClient(async (client) => {
    const wuyun = await client.callTool({
      name: 'metaphysics_wuyun_liuqi',
      arguments: { year: 2026, yearGanZhi: '丙午' },
    });
    const wuyunResult = wuyun.structuredContent?.result as {
      input: { yearGanZhi: string };
      annualMovement: { name: string; strength: string };
      sitian: { name: string };
      zaiquan: { name: string };
      annualRelation: { kind: string };
      annualConformities: {
        names: string[];
        sourceReconciliation: { distinctYearsByListedRules: number };
      };
      movementSteps: Array<{
        hostMovement: { toneName: string };
        guestMovement: { toneName: string };
        startBoundary: { description: string };
      }>;
      qiSteps: Array<{
        guestRole?: string;
        solarTerms: string[];
        hostGuestRelation: { kind: string };
      }>;
    };
    assert.equal(wuyun.isError, undefined);
    assert.equal(wuyunResult.input.yearGanZhi, '丙午');
    assert.deepEqual(
      [wuyunResult.annualMovement.name, wuyunResult.annualMovement.strength],
      ['水运', '太过'],
    );
    assert.deepEqual([wuyunResult.sitian.name, wuyunResult.zaiquan.name], ['少阴君火', '阳明燥金']);
    assert.equal(wuyunResult.annualRelation.kind, '不和');
    assert.deepEqual(wuyunResult.annualConformities.names, []);
    assert.equal(
      wuyunResult.annualConformities.sourceReconciliation.distinctYearsByListedRules,
      26,
    );
    assert.equal(wuyunResult.movementSteps.length, 5);
    assert.deepEqual(
      wuyunResult.movementSteps.map((step) => step.hostMovement.toneName),
      ['太角', '少徵', '太宫', '少商', '太羽'],
    );
    assert.equal(wuyunResult.movementSteps[0].guestMovement.toneName, '太羽');
    assert.equal(wuyunResult.movementSteps[1].startBoundary.description, '春分后第13日起');
    assert.deepEqual(wuyunResult.qiSteps[0].solarTerms, ['大寒', '立春', '雨水', '惊蛰']);
    assert.equal(typeof wuyunResult.qiSteps[0].hostGuestRelation.kind, 'string');
    assert.equal(wuyunResult.qiSteps[2].guestRole, '司天');
    assert.equal(wuyunResult.qiSteps[5].guestRole, '在泉');

    const huangjiStandard = await client.callTool({
      name: 'metaphysics_huangji_jingshi',
      arguments: { year: 2026 },
    });
    const huangjiStandardResult = huangjiStandard.structuredContent?.result as {
      input: { mode: string };
      forecast: {
        hui: { branch: string };
        hexagrams: {
          sixtyYear: { hexagram: { name: string } };
          decade: { hexagram: { name: string } };
          annual: { name: string; ganzhi: string };
        };
      };
    };
    assert.equal(huangjiStandard.isError, undefined);
    assert.equal(huangjiStandardResult.input.mode, '通行公元年');
    assert.equal(huangjiStandardResult.forecast.hui.branch, '午');
    assert.equal(huangjiStandardResult.forecast.hexagrams.sixtyYear.hexagram.name, '火风鼎');
    assert.equal(huangjiStandardResult.forecast.hexagrams.decade.hexagram.name, '天风姤');
    assert.equal(huangjiStandardResult.forecast.hexagrams.annual.name, '天火同人');
    assert.equal(huangjiStandardResult.forecast.hexagrams.annual.ganzhi, '丙午');

    const huangji = await client.callTool({
      name: 'metaphysics_huangji_jingshi',
      arguments: { epochYear: 1000, elapsedYears: 1026 },
    });
    const huangjiResult = huangji.structuredContent?.result as {
      input: { year: number; elapsedYears: number };
      position: {
        yun: { indexInYuan: number };
        shi: { indexInYun: number };
        year: { indexInShi: number };
      };
      progress: {
        shi: {
          currentYearIndex: number;
          completedYears: number;
          remainingYearsAfterCurrent: number;
          nextCycleStartYear: number;
        };
      };
    };
    assert.equal(huangji.isError, undefined);
    assert.equal(huangjiResult.input.year, 2026);
    assert.equal(huangjiResult.input.elapsedYears, 1026);
    assert.equal(huangjiResult.position.yun.indexInYuan, 3);
    assert.equal(huangjiResult.position.shi.indexInYun, 11);
    assert.equal(huangjiResult.position.year.indexInShi, 7);
    assert.deepEqual(huangjiResult.progress.shi, {
      currentYearIndex: 7,
      completedYears: 6,
      remainingYearsAfterCurrent: 23,
      nextCycleStartYear: 2050,
    });

    const invalidCalls: Array<[string, Record<string, unknown>, RegExp | null]> = [
      ['metaphysics_wuyun_liuqi', {}, /必须提供 year 或 yearGanZhi/],
      ['metaphysics_wuyun_liuqi', { year: 2026, yearGanZhi: '乙巳' }, /year 与 yearGanZhi 不一致/],
      ['metaphysics_wuyun_liuqi', { yearGanZhi: '甲丑' }, null],
      ['metaphysics_huangji_jingshi', { elapsedYears: 1026 }, /必须只提供 year/],
      ['metaphysics_huangji_jingshi', { year: 0 }, /非零安全整数/],
      ['metaphysics_huangji_jingshi', { epochYear: 1000 }, /必须且只能提供一个/],
      [
        'metaphysics_huangji_jingshi',
        { epochYear: 1000, year: 2026, elapsedYears: 1026 },
        /必须且只能提供一个/,
      ],
      ['metaphysics_huangji_jingshi', { epochYear: 1000, year: 999 }, /不能早于 epochYear/],
    ];

    for (const [name, arguments_, errorPattern] of invalidCalls) {
      const result = await client.callTool({ name, arguments: arguments_ });
      assert.equal(result.isError, true, `${name} 应拒绝无效或冲突输入`);
      if (errorPattern) {
        assert.match(
          String((result.structuredContent as { error?: string } | undefined)?.error),
          errorPattern,
        );
      }
    }
  });
});

test('MCP 八字年限提示词应保留岁运重点且不返回内部证据对象', async () => {
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
        baziFortuneYear: 1998,
      },
    });

    assert.equal(response.isError, undefined);
    assert.equal(response.structuredContent?.result, undefined);
    const prompt = String(response.structuredContent?.prompt);
    assert.match(prompt, /【分析对象】[\s\S]*分析对象：1998年流年/);
    assert.match(prompt, /【岁运重点】[\s\S]*主要触发：/);
    assert.doesNotMatch(prompt, /结构化证据|计算链|证据汇总|解释限制|证据边界/);
  });
});

test('MCP 八字和星盘年限缺少明确层级参数时应返回业务错误', async () => {
  await withMcpClient(async (client) => {
    const bazi = await client.callTool({
      name: 'bazi_prompt',
      arguments: {
        gender: 'male',
        year: 1990,
        month: 5,
        day: 15,
        timeIndex: 1,
        dateType: 'solar',
        question: '请分析指定流年。',
        baziFortuneScope: 'year',
        baziFortuneCycleIndex: 1,
      },
    });
    assert.equal(bazi.isError, true);
    const baziText = bazi.content[0]?.type === 'text' ? bazi.content[0].text : '';
    assert.match(baziText, /baziFortuneYear/);

    const astrolabe = await client.callTool({
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
        question: '请分析完整行运。',
        astrolabeScope: 'full',
      },
    });
    assert.equal(astrolabe.isError, true);
    const astrolabeText = astrolabe.content[0]?.type === 'text' ? astrolabe.content[0].text : '';
    assert.match(astrolabeText, /astrolabeScopeDate/);
  });
});

test('MCP 八字双盘排盘工具应返回计算链、反证、汇总与限制对象', async () => {
  await withMcpClient(async (client) => {
    const response = await client.callTool({
      name: 'bazi_compatibility',
      arguments: {
        detailMode: 'full',
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
    assert.equal(compatibility?.status, '已计算');
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
  });
});

test('MCP 黄历择日排盘保留证据，提示词允许省略问题且只返回 prompt', async () => {
  await withMcpClient(async (client) => {
    const result = await client.callTool({
      name: 'divine_almanac',
      arguments: {
        detailMode: 'full',
        topic: 'contract',
        startDate: '2026-06-01',
        endDate: '2026-06-03',
      },
    });

    assert.equal(result.isError, undefined, 'divine_almanac 不应返回错误');
    const chart = (
      result.structuredContent as {
        result: {
          days: Array<{
            score?: number;
            hours?: Array<{ score?: number }>;
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
                participantRelationFacts: Array<{ key: string }>;
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
              Array.isArray(hour.participantRelationFacts) &&
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
      for (const hour of day.hours ?? []) {
        assert.equal(hour.score, undefined);
      }
    }
    const promptResult = await client.callTool({
      name: 'almanac_prompt',
      arguments: {
        topic: 'contract',
        startDate: '2026-06-01',
        endDate: '2026-06-03',
      },
    });
    assert.equal(promptResult.isError, undefined, 'almanac_prompt 不填 question 不应返回错误');
    assert.deepEqual(Object.keys(promptResult.structuredContent ?? {}), ['prompt']);
    const prompt = String(promptResult.structuredContent?.prompt);
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
          '分析对象：流年2028。\n行运证据：土星□太阳（刑相，偏差0.50°，紧密等级，归一化容许度位置0.08，入相）。',
      },
    });

    assert.equal(result.isError, undefined, 'astrolabe_prompt 不应返回错误');
    const calculation = await client.callTool({
      name: 'divine_astrolabe',
      arguments: {
        detailMode: 'full',
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
      },
    });
    assert.equal(calculation.isError, undefined, 'divine_astrolabe 不应返回错误');
    const chart = (
      calculation.structuredContent as {
        result?: {
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
            actualAngle?: number;
            exactAngle?: number;
            allowedOrb?: number;
          }>;
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
    for (const aspect of chart?.aspects ?? []) {
      assert.equal(aspect.strength, undefined);
      assert.equal(typeof aspect.actualAngle, 'number');
      assert.equal(typeof aspect.exactAngle, 'number');
      assert.equal(typeof aspect.allowedOrb, 'number');
    }
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
    assert.match(prompt, /星体位置：[\s\S]*相位明细：/);
    assert.doesNotMatch(prompt, /宫头位置：/);
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
    assert.equal(yearlyResult.isError, undefined);
    assert.equal(yearlyResult.structuredContent?.result, undefined);
    assert.match(String(yearlyResult.structuredContent?.prompt), /2028/);
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
        schools: ['modern', 'timing'],
      },
    });

    assert.equal(result.isError, undefined);
    const calculation = await client.callTool({
      name: 'astrolabe_synastry',
      arguments: {
        detailMode: 'full',
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
    });
    assert.equal(calculation.isError, undefined);
    const chart = (
      calculation.structuredContent as {
        result?: {
          synastry?: {
            key?: string;
            status?: string;
            calculationSteps?: Array<{ key: string }>;
            aspects?: Array<{
              key: string;
              status: string;
              calculationStepKey: string;
              strength?: number;
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
    assert.equal(chart?.synastry?.key, 'astrolabe:synastry:evidence');
    assert.equal(chart?.synastry?.status, '已计算');
    assert.equal(chart?.synastry?.calculationSteps?.length, 7);
    for (const aspect of chart?.synastry?.aspects ?? []) {
      assert.match(aspect.key, /^astrolabe:synastry:aspect:/);
      assert.equal(aspect.status, '已命中');
      assert.equal(aspect.calculationStepKey, 'astrolabe:synastry:calculation:aspect-filter');
      assert.equal(aspect.strength, undefined);
    }
    for (const overlay of chart?.synastry?.houseOverlays ?? []) {
      assert.match(overlay.key, /^astrolabe:synastry:house-overlay:/);
      assert.equal(overlay.status, '已定位');
      assert.equal(overlay.calculationStepKey, 'astrolabe:synastry:calculation:house-overlays');
    }
    assert.equal(chart?.synastry?.summary?.strongAspects, undefined);
    assert.equal(chart?.synastry?.counterEvidenceFacts?.length, 4);
    assert.equal(chart?.synastry?.limitationFacts?.length, 6);
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
    assert.match(prompt, /容许度/);
    assert.match(prompt, /【多口径合参】/);
    assert.match(prompt, /流派1：现代心理占星/);
    assert.match(prompt, /断法2：时限触发法/);
    assert.match(prompt, /分析互动主轴、互补点与张力点/);
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
    assert.doesNotMatch(ziweiFrameworkPrompt, /iztro|排盘资料提供/);
    assert.match(ziweiFrameworkPrompt, /【当前时间】/);
    assert.match(ziweiFrameworkPrompt, /【本命资料】/);
    assert.match(ziweiFrameworkPrompt, /【任务】[\s\S]*请依据紫微盘面完成解读/);
    assert.doesNotMatch(ziweiFrameworkPrompt, /四化、格局和三方四正/);
    assert.doesNotMatch(ziweiFrameworkPrompt, /自由问答先判断问题落在哪些宫位/);
    assertPromptIsPortableTaskText(ziweiFrameworkPrompt);
  });
});

test('MCP 塔罗应返回分层结构化证据并写入提示词', async () => {
  await withMcpClient(async (client) => {
    const tarot = await client.callTool({
      name: 'divine_tarot',
      arguments: { spreadType: 'three', seed: 'MCP塔罗证据样例', detailMode: 'full' },
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
          item.status === '已计算' &&
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
    assert.ok(tarotData.evidenceAnalysis.themeFacts.length > 0);
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
    assert.equal(tarotData.evidenceAnalysis.traditionalFacts.length, 3);
    assert.equal(tarotData.evidenceAnalysis.summaryFact.key, 'tarot:evidence-summary');
    assert.equal(tarotData.evidenceAnalysis.summaryFact.status, '证据链完整');
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
        (item: Record<string, unknown>, index: number) =>
          item.traditionalFactKey === tarotData.evidenceAnalysis.traditionalFacts[index].key,
      ),
    );
    assert.ok(
      tarotData.evidenceAnalysis.traditionalFacts.every(
        (item: Record<string, unknown>) =>
          item.originalText &&
          item.promptText &&
          Array.isArray(item.sources) &&
          item.sources.length > 0 &&
          String(item.limitation).includes('不证明现实事件'),
      ),
    );

    const tarotPromptResult = await client.callTool({
      name: 'tarot_prompt',
      arguments: {
        spreadType: 'three',
        seed: 'MCP塔罗证据样例',
        question: '如何推进？',
        schools: ['rws', 'yuansu'],
      },
    });
    const tarotPrompt = String(tarotPromptResult.structuredContent?.prompt);
    assert.match(tarotPrompt, /占法：塔罗/);
    assert.match(tarotPrompt, /核心结构：牌阵[\s\S]*牌位明细：/);
    assert.match(tarotPrompt, /【多口径合参】/);
    assert.match(tarotPrompt, /流派1：RWS 图像法/);
    assert.match(tarotPrompt, /断法2：元素与数序法/);
    assert.doesNotMatch(tarotPrompt, /结构化证据|计算链|证据汇总|解释限制|解释边界/);
    assert.doesNotMatch(tarotPrompt, /表示这些能量正在直接发挥作用|信息被隐藏/);
    assertPromptIsPortableTaskText(tarotPrompt);
  });
});

test('MCP 灵签应返回签号、签题与签诗', async () => {
  await withMcpClient(async (client) => {
    const drawn = await client.callTool({
      name: 'divine_ssgw',
      arguments: { seed: 'MCP灵签样例' },
    });
    assert.equal(drawn.isError, undefined);
    assert.equal(typeof drawn.structuredContent?.result.number, 'number');
    assert.ok(drawn.structuredContent?.result.title);
    assert.ok(drawn.structuredContent?.result.poem);
    assert.equal(typeof drawn.structuredContent?.result.timestamp, 'number');
    assert.ok(drawn.structuredContent?.result.ganzhi.year);
    assert.equal(drawn.structuredContent?.result.ritual, undefined);
    assert.equal(drawn.structuredContent?.result.evidenceAnalysis, undefined);

    const prompted = await client.callTool({
      name: 'ssgw_prompt',
      arguments: {
        question: '这件事接下来该怎么推进？',
        seed: 'MCP灵签样例',
      },
    });
    assert.equal(prompted.isError, undefined);
    assert.equal(prompted.structuredContent?.result, undefined);
    const prompt = String(prompted.structuredContent?.prompt);
    assert.match(prompt, /占法：三山国王灵签/);
    assert.match(prompt, /签号：第\d+签/);
    assert.match(prompt, /签题：《.+》/);
    assert.match(prompt, /签诗：/);
    assert.doesNotMatch(
      prompt,
      /掷筊|仪式|证据|限制|阴杯|rejected|使用简体中文|中文输出|【输出要求】/,
    );
    assertPromptIsPortableTaskText(prompt);
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
        detailMode: 'full',
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
        detailMode: 'full',
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
    assert.match(ziweiPrompt, /真太阳时：[\s\S]*时辰：/);
    assert.doesNotMatch(
      ziweiPrompt,
      /已核验|未请求|经度时差|均时差|总校正|校正后唯一时辰|结构化证据|计算步骤|出生时间敏感性|候选时辰|缺时柱/,
    );

    const astrolabeArguments = {
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
    };
    const astrolabeResult = await client.callTool({
      name: 'divine_astrolabe',
      arguments: { ...astrolabeArguments, detailMode: 'full' },
    });
    assert.equal(astrolabeResult.isError, undefined);
    const astrolabeResultData = astrolabeResult.structuredContent as {
      result?: {
        birth?: {
          trueSolarEvidence?: { status: string; calculationSteps: Array<{ stage: string }> };
        };
        evidenceAnalysis?: { trueSolarTimeFact?: { key: string } };
      };
    };
    assert.equal(astrolabeResultData.result?.birth?.trueSolarEvidence?.status, '已计算');
    assert.equal(astrolabeResultData.result?.birth?.trueSolarEvidence?.calculationSteps.length, 8);
    assert.ok(
      astrolabeResultData.result?.birth?.trueSolarEvidence?.calculationSteps.some(
        (item) => item.stage === '历史时区解析',
      ),
    );
    assert.ok(astrolabeResultData.result?.evidenceAnalysis?.trueSolarTimeFact?.key);

    const astrolabePromptResult = await client.callTool({
      name: 'astrolabe_prompt',
      arguments: { ...astrolabeArguments, question: '请分析整体星盘。' },
    });
    assert.equal(astrolabePromptResult.isError, undefined);
    assert.equal(astrolabePromptResult.structuredContent?.result, undefined);
    const astrolabePrompt = String(astrolabePromptResult.structuredContent?.prompt ?? '');
    assert.match(astrolabePrompt, /出生时间校正：[\s\S]*真太阳时/);
    assert.doesNotMatch(
      astrolabePrompt,
      /已核验|未请求|经度时差|均时差|总校正|校正后唯一时辰|结构化证据|计算链|证据汇总|解释限制/,
    );
  });
});

test('MCP 八字神煞默认精简，显式 all 返回全部', async () => {
  await withMcpClient(async (client) => {
    const input = {
      gender: 'male' as const,
      year: 1988,
      month: 7,
      day: 15,
      timeIndex: 6,
      dateType: 'solar' as const,
    };
    const common = await client.callTool({ name: 'bazi_calculate', arguments: input });
    const all = await client.callTool({
      name: 'bazi_calculate',
      arguments: { ...input, shenShaScope: 'all' },
    });
    const commonChart = common.structuredContent?.result as {
      shensha: Record<string, string[]>;
    };
    const allChart = all.structuredContent?.result as {
      shensha: Record<string, string[]>;
    };
    const commonNames = Object.values(commonChart.shensha).flat();
    const allNames = Object.values(allChart.shensha).flat();

    assert.equal(common.isError, undefined);
    assert.equal(all.isError, undefined);
    assert.ok(!commonNames.includes('马财库'));
    assert.ok(allNames.includes('马财库'));
    assert.ok(allNames.length > commonNames.length);
  });
});

test('MCP 八字神煞默认采用问真口径，并可切换原有传统口径', async () => {
  await withMcpClient(async (client) => {
    const input = {
      gender: 'male' as const,
      year: 1980,
      month: 1,
      day: 1,
      timeIndex: 0,
      dateType: 'solar' as const,
    };
    const wenzhen = await client.callTool({ name: 'bazi_calculate', arguments: input });
    const classical = await client.callTool({
      name: 'bazi_calculate',
      arguments: {
        ...input,
        shenShaVariants: { referenceProfile: 'classical' },
      },
    });
    const wenzhenChart = wenzhen.structuredContent?.result as {
      shensha: Record<string, string[]>;
    };
    const classicalChart = classical.structuredContent?.result as {
      shensha: Record<string, string[]>;
    };

    assert.equal(wenzhen.isError, undefined);
    assert.equal(classical.isError, undefined);
    assert.ok(wenzhenChart.shensha.month.includes('空亡'));
    assert.ok(wenzhenChart.shensha.hour.includes('空亡'));
    assert.ok(!classicalChart.shensha.month.includes('空亡'));
    assert.ok(!classicalChart.shensha.hour.includes('空亡'));
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
      arguments: { ...arguments_, detailMode: 'full' },
    });
    assert.equal(chartResponse.isError, undefined);
    const chart = (
      chartResponse.structuredContent as {
        result: {
          stars: Array<{ precisionClass: string }>;
          mansionBoundaries: unknown[];
          mansionModel: { id: string };
          evidenceAnalysis: { status: string; summaryFact: { status: string } };
        };
      }
    ).result;
    assert.equal(chart.stars.length, 11);
    assert.equal(chart.mansionBoundaries.length, 28);
    assert.equal(chart.mansionModel.id, 'qizheng-mansion-stars-simbad-astronomy-engine');
    assert.ok(chart.stars.some((star) => star.precisionClass === '现代天文计算'));
    assert.ok(chart.stars.some((star) => star.precisionClass === '传统均速模型'));
    assert.equal(chart.evidenceAnalysis.status, '已计算');
    assert.equal(chart.evidenceAnalysis.summaryFact.status, '证据链完整');

    const promptResponse = await client.callTool({
      name: 'qizheng_prompt',
      arguments: { ...arguments_, question: '请分析本命结构。' },
    });
    assert.equal(promptResponse.isError, undefined);
    const prompt = String(promptResponse.structuredContent?.prompt);
    assertPromptHasSingleRole(prompt, PROMPT_ROLE_TEXT.qizheng);
    assert.match(
      prompt,
      /【七政四余 · 果老星宗】[\s\S]*七政 太阳：[\s\S]*【问题】\n请分析本命结构。/,
    );
    assert.doesNotMatch(prompt, /宿界模型/);
    assertPromptIsPortableTaskText(prompt);
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

test('MCP 玄空应只返回可核验下卦盘', async () => {
  await withMcpClient(async (client) => {
    const response = await client.callTool({
      name: 'metaphysics_xuankong',
      arguments: { year: 2008, sitMountain: '子', detailMode: 'full' },
    });
    assert.equal(response.isError, undefined);
    const chart = (
      response.structuredContent as {
        result: {
          engine: { mode: string };
          evidenceAnalysis: { promptText: string };
        };
      }
    ).result;
    assert.equal(chart.engine.mode, '下卦');
    assert.match(chart.evidenceAnalysis.promptText, /下卦|元龙阴阳|双星到向/);
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
        detailMode: 'full',
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
              promptText: string;
              sources: string[];
              limitation: string;
            }>;
            stageCoverageFact: { status: string };
            yaoCoverageFact: { status: string };
            hexagramStructureFacts: unknown[];
            yaoStructureFacts: unknown[];
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
              promptText: string;
              sources: string[];
              limitation: string;
            }>;
            timingSummaryFact: { factKeys: string[] };
            counterEvidenceFacts: Array<{
              key: string;
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
    assert.equal(result.evidenceAnalysis.limitationFacts.length, 6);
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
    assert.match(result.evidenceAnalysis.promptText, /【梅花体用阶段推进结构化证据】/);
    assert.match(result.evidenceAnalysis.promptText, /证据汇总：/);
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
    assert.match(promptText, /核心结构：主卦[\s\S]*体用：[\s\S]*互卦：[\s\S]*变卦：/);
    assert.doesNotMatch(promptText, /结构明细：|静爻/);
    assert.doesNotMatch(promptText, /结构化证据|计算链|证据汇总|解释限制|解释边界/);
    assert.doesNotMatch(promptText, /妇三岁不孕|焚如，死如|至于八月有凶/);
    assert.doesNotMatch(promptText, /体用评分：|类象权重：|\d+日内|\d+月左右/);
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
    assert.match(liuyaoPrompt, /世应：[\s\S]*动变：[\s\S]*月日触发：/);
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
    const liurenChart = await client.callTool({
      name: 'divine_liuren',
      arguments: {
        detailMode: 'full',
        customDate: '2025-01-01T08:00:00+08:00',
        liurenTemplate: 'shiye',
      },
    });
    assert.equal(liurenChart.isError, undefined, 'divine_liuren 不应返回错误');
    const liurenData = (
      liurenChart.structuredContent as {
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
          item.relationFacts.length === 4 &&
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
          item.limitation.includes('不得换算唯一日期'),
      ),
    );
    assert.equal(liurenData.evidenceAnalysis.focusSummaryFact.status, '已提供焦点');
    assert.ok(liurenData.evidenceAnalysis.calculationFact.monthLeader);
    assert.ok(liurenData.evidenceAnalysis.calculationFact.sources.length >= 3);
    assert.match(liurenData.evidenceAnalysis.calculationFact.limitation, /不单独证明现实事件/);
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
    assert.equal(liurenData.evidenceAnalysis.limitationFacts.length, 6);
    assert.equal(
      liurenData.evidenceAnalysis.limitations.length,
      liurenData.evidenceAnalysis.limitationFacts.length,
    );
    const factKeys = new Set([
      liurenData.evidenceAnalysis.calculationFact.key,
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
    assert.doesNotMatch(liurenPrompt, /取传依据：/);
    assert.doesNotMatch(liurenPrompt, /应期线索：/);
    assert.doesNotMatch(liurenPrompt, /【分析思路】/);
    assert.doesNotMatch(liurenPrompt, /关注重点：|岗位路径、协作阻力、窗口时机/);
    assertPromptIsPortableTaskText(liurenPrompt);
  });
});

test('MCP 奇门工具返回用神宫与宫间作用结构化证据', async () => {
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
    const chartResult = await client.callTool({
      name: 'divine_qimen',
      arguments: {
        customDate: '2025-01-01T08:00:00+08:00',
        detailMode: 'full',
      },
    });
    assert.equal(chartResult.isError, undefined, 'divine_qimen 不应返回错误');
    const chart = (
      chartResult.structuredContent as {
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
            candidates: Array<{ palaceFactKey: string }>;
            relations: Array<{
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
            directionFacts: Array<{
              key: string;
              palaceFactKey: string;
              promptText: string;
              sources: string[];
              limitation: string;
            }>;
            summaryFact: {
              status: string;
              factKeys: string[];
              palaceFactCount: number;
              candidateCount: number;
              relationCount: number;
              patternCount: number;
              counterEvidenceCount: number;
              timingFactCount: number;
              directionFactCount: number;
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
              insights: Array<{
                ownerPalaceFactKey: string;
                status: string;
                originalText: string;
                promptText: string;
                sources: string[];
              }>;
              sources: string[];
              limitation: string;
            }>;
          };
          classicPatterns: Array<Record<string, unknown>>;
          patternCombos: Array<Record<string, unknown>>;
          directions: {
            goodDirections: Array<Record<string, unknown>>;
            avoidDirections: Array<Record<string, unknown>>;
          };
        };
      }
    ).result;
    assert.equal(chart.method, 'zhuanpan');
    assert.equal(chart.evidenceAnalysis.key, 'qimen:evidence');
    assert.equal(chart.evidenceAnalysis.status, '已计算');
    assert.equal(chart.evidenceAnalysis.calculationEvidenceFacts.length, 5);
    assert.equal(chart.evidenceAnalysis.calculationSteps.length, 5);
    assert.equal(chart.evidenceAnalysis.calculationChain.length, 5);
    assert.equal(chart.evidenceAnalysis.ruleSourceFacts.length, 4);
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
    assert.ok(chart.evidenceAnalysis.candidates.length > 0);
    assert.equal(
      chart.evidenceAnalysis.relations.length,
      Math.max(0, chart.evidenceAnalysis.candidates.length - 1),
    );
    assert.ok(
      chart.evidenceAnalysis.relations.every(
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
          item.limitation.includes('不得把单项限制直接写成现实失败'),
      ),
    );
    assert.ok(
      chart.evidenceAnalysis.timingFacts.every(
        (item) =>
          item.key.startsWith('qimen:timing:') &&
          item.promptText &&
          item.sources.length > 0 &&
          item.limitation.includes('不得换算唯一日期'),
      ),
    );
    assert.equal(
      chart.evidenceAnalysis.timingSummaryFact.factKeys.length,
      chart.evidenceAnalysis.timingFacts.length,
    );
    assert.equal(chart.evidenceAnalysis.summaryFact.status, '证据链完整');
    assert.equal(
      chart.evidenceAnalysis.summaryFact.palaceFactCount,
      chart.evidenceAnalysis.palaceFacts.length,
    );
    assert.equal(
      chart.evidenceAnalysis.summaryFact.candidateCount,
      chart.evidenceAnalysis.candidates.length,
    );
    assert.equal(
      chart.evidenceAnalysis.summaryFact.relationCount,
      chart.evidenceAnalysis.relations.length,
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
    assert.equal(
      chart.evidenceAnalysis.summaryFact.directionFactCount,
      chart.evidenceAnalysis.directionFacts.length,
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
    assert.ok(
      chart.evidenceAnalysis.directionFacts.every(
        (item) =>
          item.key.startsWith('qimen:direction:') &&
          item.palaceFactKey &&
          item.promptText &&
          item.sources.length > 0 &&
          item.limitation.includes('必须核实现实路线'),
      ),
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
          item.insights.every(
            (fact) =>
              fact.ownerPalaceFactKey === item.key &&
              fact.status === '已命中' &&
              fact.originalText &&
              fact.promptText &&
              fact.sources.length > 0,
          ) &&
          item.sources.length >= 3 &&
          item.limitation.includes('不单独证明现实吉凶'),
      ),
    );
    assert.ok(
      chart.evidenceAnalysis.candidates.every((item) =>
        chart.evidenceAnalysis.palaceFacts.some((fact) => fact.key === item.palaceFactKey),
      ),
    );
    assert.ok(chart.classicPatterns.every((item) => item.score === undefined));
    assert.ok(chart.patternCombos.every((item) => item.score === undefined));
    assert.ok(
      [...chart.directions.goodDirections, ...chart.directions.avoidDirections].every(
        (item) => item.score === undefined,
      ),
    );
    assert.match(prompt, /占法：奇门遁甲/);
    assert.match(prompt, /核心结构：[\s\S]*值符值使与时干：[\s\S]*旬空与马星：/);
    assert.match(prompt, /节令：[\s\S]*值符值使与时干：/);
    assert.doesNotMatch(prompt, /节气交接：|完整天地盘|四柱互动/);
    assert.doesNotMatch(prompt, /结构化证据|计算链|证据汇总|解释限制|证据边界/);
    assert.doesNotMatch(prompt, /主宫评分|辅宫评分|评分-?\d+|（-?\d+分|应期范围\d/);
    assert.doesNotMatch(prompt, /大吉格|大凶格|显著加快|显著延迟/);
    assert.doesNotMatch(prompt, /项目以|项目规则|项目计算|命语|本项目|项目统一|工程|算法结果/);
    assertPromptIsPortableTaskText(prompt);
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
    const chartResult = await client.callTool({
      name: 'metaphysics_taiyi',
      arguments: { year: 2004, scope: 'year', detailMode: 'full' },
    });
    assert.equal(chartResult.isError, undefined, 'metaphysics_taiyi 不应返回错误');
    const chart = (
      chartResult.structuredContent as {
        result: {
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
        detailMode: 'full',
      },
    });
    assert.equal(first.isError, undefined);
    type LiuyaoReplayResult = {
      generation: { method: string; coinThrows: unknown[] };
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
          referenceKeys: string[];
          promptText: string;
          sources: string[];
          limitation: string;
        }>;
        selectionFact: { status: string; selectedCandidateKey: string | null };
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
    assert.equal(firstResult.evidenceAnalysis.selectionFact.status, '已选定候选');
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
    assert.equal(firstResult.evidenceAnalysis.summaryFact.status, '证据链完整');
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
  });
});
