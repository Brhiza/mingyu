import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { baziCalculator } from '@core/bazi/baziCalculator';
import { TIME_MAP } from '@core/bazi/baziDisplayData';
import { calculateTrueSolarTime } from '@core/bazi/trueSolarTime';
import { getTimeIndexFromClock } from 'mingyu-core/calendar';
import { assertPromptIsPortableTaskText } from '../prompt-assertions';

const toolCalls: Array<[string, Record<string, unknown>]> = [
  ['foundation_capabilities', {}],
  ['foundation_ganzhi', { ganZhi: '甲子' }],
  ['foundation_wuxing', { items: ['甲', '子', '丙', '午'], weightHidden: true }],
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
  ['metaphysics_zodiac', { zodiac: '鼠', year: 2024 }],
  ['metaphysics_taiyi', { year: 2004, scope: 'year' }],
  ['metaphysics_qizheng', { year: 2024, month: 6, day: 15, hour: 12 }],
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
    /【八字双盘结构化证据】/,
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
    /【排盘信息】/,
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
    /【紫微双盘结构化证据】/,
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
    /应期触发条件：[\s\S]*不换算固定日数[\s\S]*【问题】\n这件事接下来如何推进？/,
  ],
  [
    'qimen_prompt',
    { customDate: '2025-01-01T06:00:00+08:00', question: '这件事何时出现转机？' },
    /触发条件：[\s\S]*不对应固定日数[\s\S]*【问题】\n这件事何时出现转机？/,
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
    /【八宅命宅方位与测量结构化证据】[\s\S]*中心读数不能作为唯一宅卦主证[\s\S]*稳定性为宅卦不稳定[\s\S]*【问题】\n办公桌朝向怎么选？/,
  ],
  [
    'zodiac_prompt',
    { zodiac: '马', yearGanZhi: '庚子', question: '今年应注意什么？' },
    /【生肖流年关系矩阵结构化证据】[\s\S]*生肖只取出生年支[\s\S]*【问题】\n今年应注意什么？/,
  ],
  [
    'qizheng_prompt',
    {
      year: 2024,
      month: 6,
      day: 15,
      hour: 12,
      latitude: 31.23,
      longitude: 121.47,
      timezone: 8,
      question: '请分析本命结构。',
    },
    /【七政四余计算来源与证据分层】[\s\S]*混合模型[\s\S]*【问题】\n请分析本命结构。/,
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
  'qimen_prompt',
  'liuren_prompt',
  'tarot_prompt',
  'ssgw_prompt',
  'almanac_prompt',
  'lenormand_prompt',
  'astrolabe_prompt',
  'astrolabe_synastry_prompt',
  'bazhai_prompt',
  'zodiac_prompt',
  'taiyi_prompt',
  'qizheng_prompt',
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

    assert.equal(tools.length, 45);
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
      if (name === 'metaphysics_qizheng') {
        const chart = (
          result.structuredContent as {
            result?: {
              stars?: unknown[];
              aspects?: Array<{ strength?: number; allowedOrb?: number }>;
              calculationContext?: {
                astronomicalTime?: {
                  status: string;
                  calculationSteps: unknown[];
                  limitations: string[];
                  limitationFacts: unknown[];
                };
                moonPhase?: {
                  status: string;
                  calculationSteps: unknown[];
                  previousPrincipalPhase?: { key: string; sources: string[] };
                  nextPrincipalPhase?: { key: string; limitation: string };
                  eventSummaryFact: { previousEventKey: string; nextEventKey: string };
                  limitations: string[];
                  limitationFacts: unknown[];
                };
                solarIllumination?: {
                  status: string;
                  calculationSteps: unknown[];
                  astronomicalTime: { status: string };
                  limitations: string[];
                  limitationFacts: unknown[];
                };
              };
              evidenceAnalysis?: {
                calculationFact?: {
                  status: string;
                  defaults: string[];
                  steps: Array<{
                    key: string;
                    status: string;
                    promptText: string;
                    sources: string[];
                  }>;
                };
                positionSourceFacts?: Array<{
                  key: string;
                  status: string;
                  adoptedSources: string[];
                  promptLimitations: string[];
                  limitation: string;
                }>;
                starFacts?: Array<{ sources: string[]; limitation: string }>;
                aspectFacts?: Array<{ allowedOrb: number; limitation: string }>;
              };
            };
          }
        ).result;
        for (const aspect of chart?.aspects ?? []) {
          assert.equal(aspect.strength, undefined);
          assert.equal(typeof aspect.allowedOrb, 'number');
        }
        assert.equal(chart?.evidenceAnalysis?.starFacts?.length, chart?.stars?.length);
        assert.equal(chart?.evidenceAnalysis?.aspectFacts?.length, chart?.aspects?.length);
        assert.equal(chart?.evidenceAnalysis?.calculationFact?.status, '含默认值');
        assert.equal(chart?.evidenceAnalysis?.calculationFact?.steps.length, 7);
        assert.ok(
          chart?.evidenceAnalysis?.calculationFact?.steps.every(
            (item) =>
              item.key.startsWith('qizheng:calculation:') &&
              item.status === '已计算' &&
              item.promptText &&
              item.sources.length > 0,
          ),
        );
        assert.equal(chart?.evidenceAnalysis?.positionSourceFacts?.length, 4);
        assert.ok(
          chart?.evidenceAnalysis?.positionSourceFacts?.every(
            (item) =>
              item.key.startsWith('qizheng:position-source:') &&
              item.status === '已采用' &&
              item.adoptedSources.length > 0 &&
              item.promptLimitations.every((text) => !text.includes('本项目')) &&
              item.limitation.includes('不等于结果达到观测级精度'),
          ),
        );
        assert.doesNotMatch(
          String(chart?.evidenceAnalysis?.promptText ?? ''),
          /本项目|项目统一|项目恒星黄经|命语/,
        );
        assert.match(
          chart?.calculationContext?.moonPhase?.previousPrincipalPhase?.key ?? '',
          /^四正月相:/,
        );
        assert.ok(
          (chart?.calculationContext?.moonPhase?.previousPrincipalPhase?.sources.length ?? 0) >= 2,
        );
        assert.match(
          chart?.calculationContext?.moonPhase?.nextPrincipalPhase?.limitation ?? '',
          /不等于观测级精度/,
        );
        assert.equal(chart?.calculationContext?.astronomicalTime?.status, '已计算');
        assert.equal(chart?.calculationContext?.astronomicalTime?.calculationSteps.length, 5);
        assert.equal(
          chart?.calculationContext?.astronomicalTime?.limitations.length,
          chart?.calculationContext?.astronomicalTime?.limitationFacts.length,
        );
        assert.equal(chart?.calculationContext?.moonPhase?.status, '已计算');
        assert.equal(chart?.calculationContext?.moonPhase?.calculationSteps.length, 4);
        assert.equal(
          chart?.calculationContext?.moonPhase?.eventSummaryFact.previousEventKey,
          chart?.calculationContext?.moonPhase?.previousPrincipalPhase?.key,
        );
        assert.equal(
          chart?.calculationContext?.moonPhase?.eventSummaryFact.nextEventKey,
          chart?.calculationContext?.moonPhase?.nextPrincipalPhase?.key,
        );
        assert.equal(
          chart?.calculationContext?.moonPhase?.limitations.length,
          chart?.calculationContext?.moonPhase?.limitationFacts.length,
        );
        assert.equal(
          chart?.calculationContext?.solarIllumination?.astronomicalTime.status,
          '已计算',
        );
        assert.equal(chart?.calculationContext?.solarIllumination?.calculationSteps.length, 4);
        assert.equal(
          chart?.calculationContext?.solarIllumination?.limitations.length,
          chart?.calculationContext?.solarIllumination?.limitationFacts.length,
        );
        assert.ok(
          chart?.evidenceAnalysis?.starFacts?.every(
            (item) => item.sources.length >= 3 && item.limitation.includes('必须分层使用'),
          ),
        );
        assert.ok(
          chart?.evidenceAnalysis?.aspectFacts?.every(
            (item) => item.allowedOrb > 0 && item.limitation.includes('混合模型不得提升为现代天文'),
          ),
        );
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
        assert.equal(chart?.evidenceAnalysis?.calculationFact?.status, '命宅完整');
        assert.equal(chart?.evidenceAnalysis?.calculationFact?.steps.length, 5);
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
              palaceOverlays?: Array<{
                key: string;
                sources: string[];
                limitation: string;
              }>;
              crossMutagenPlacements?: Array<{
                key: string;
                sources: string[];
                limitation: string;
              }>;
            };
          }
        ).compatibility;
        assert.ok(
          compatibility?.palaceOverlays?.every(
            (item) =>
              item.key.startsWith('宫位叠盘:') &&
              item.sources.length >= 2 &&
              item.limitation.includes('不单独证明关系吉凶'),
          ),
        );
        assert.ok(
          compatibility?.crossMutagenPlacements?.every(
            (item) =>
              item.key.startsWith('跨盘四化:') &&
              item.sources.length >= 2 &&
              item.limitation.includes('不直接等于关系吉凶'),
          ),
        );
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
    assert.equal(
      result.structuredContent?.result.sunriseSunset.calculationStepKeys[0],
      result.structuredContent?.result.calculationSteps[3].key,
    );
    assert.equal(result.structuredContent?.result.assumptions.length, 2);
    assert.equal(result.structuredContent?.result.assumptionFacts.length, 2);
    assert.equal(result.structuredContent?.result.crossingSummaryFact.status, '均有正常交点');
    assert.equal(result.structuredContent?.result.crossingSummaryFact.crossingFactKeys.length, 4);
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
      fortuneSelection?: { promptPayload?: { triggerEvidence?: { relations?: unknown[] } } };
    };
    assert.ok(result.fortuneSelection?.promptPayload?.triggerEvidence?.relations?.length);
    assert.match(String(response.structuredContent?.prompt), /【八字岁运触发结构化证据】/);
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
          item.topicMatchFacts.length >= 4 &&
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
          item.decisionFact.limitation.includes('不公开内部排序分值') &&
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
    for (const day of chart.days) {
      assert.equal(day.score, undefined);
      for (const hour of [...(day.hours ?? []), ...(day.bestHours ?? [])]) {
        assert.equal(hour.score, undefined);
      }
    }
    const prompt = String(result.structuredContent?.prompt);
    assert.match(prompt, /【占卜信息】/);
    assert.match(prompt, /【黄历择日透明约束与候选证据】/);
    assert.match(prompt, /状态形成链/);
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
    const chart = (
      result.structuredContent as {
        result?: {
          birth?: {
            timezoneEvidence?: {
              key: string;
              status: string;
              calculationSteps: unknown[];
              diagnosticFacts: unknown[];
              diagnosticSummaryFact: { status: string; factKeys: string[] };
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
    assert.equal(chart?.birth?.timezoneEvidence?.status, 'unique');
    assert.equal(chart?.birth?.timezoneEvidence?.calculationSteps.length, 4);
    assert.equal(chart?.birth?.timezoneEvidence?.diagnosticFacts.length, 2);
    assert.equal(chart?.birth?.timezoneEvidence?.diagnosticSummaryFact.status, '唯一且无冲突');
    assert.equal(
      chart?.birth?.timezoneEvidence?.limitations.length,
      chart?.birth?.timezoneEvidence?.limitationFacts.length,
    );
    assertPromptIsPortableTaskText(chart?.birth?.timezoneEvidence?.promptText ?? '');
    assert.equal(chart?.evidenceAnalysis?.timezoneFact?.key, chart?.birth?.timezoneEvidence?.key);
    assert.equal(chart?.evidenceAnalysis?.calculationFact?.status, '完整');
    assert.equal(chart?.evidenceAnalysis?.calculationFact?.steps.length, 5);
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
    const prompt = String(result.structuredContent?.prompt);
    assert.match(prompt, /【西方星盘位置与相位结构化证据】/);
    assert.match(prompt, /实际夹角.*精确角.*允许容许度.*距精确角偏差/);
    assert.match(prompt, /【分析对象】\n分析对象：流年2028。/);
    assert.match(prompt, /行运证据：土星□太阳/);
    assert.doesNotMatch(prompt, /强度\d+%/);
    assert.match(prompt, /【行运时间尺度】/);
    assert.match(
      prompt,
      /【分析对象】已经给出本命、流年、流月或流日范围时，必须以该范围作为本次回答主范围/,
    );
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
              limitationFacts: unknown[];
              limitations: string[];
            };
            secondaryProgressionEvidence?: { key: string };
            solarArcEvidence?: { key: string };
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
  });
});

test('MCP 西占双盘提示词应返回跨盘证据和完整任务书', async () => {
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
            aspects?: Array<{ strength?: number }>;
            summary?: { strongAspects?: number };
          };
        };
      }
    ).result;
    for (const aspect of chart?.synastry?.aspects ?? []) {
      assert.equal(aspect.strength, undefined);
    }
    assert.equal(chart?.synastry?.summary?.strongAspects, undefined);
    const prompt = String(result.structuredContent?.prompt);
    assert.match(prompt, /【第一人本命盘】/);
    assert.match(prompt, /【西占双盘结构化证据】/);
    assert.match(prompt, /容许度/);
    assert.match(prompt, /反证限制/);
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
    assert.match(ziweiFrameworkPrompt, /若【问题】未限定具体主题，按通用紫微口径处理/);
    assert.match(ziweiFrameworkPrompt, /【重点宫位资料】/);
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
      arguments: { spreadType: 'three', seed: 'MCP塔罗证据样例', question: '如何推进？' },
    });
    const tarotPrompt = String(tarotPromptResult.structuredContent?.prompt);
    assert.match(tarotPrompt, /【塔罗牌位与牌面结构化证据】/);
    assert.match(tarotPrompt, /条件化牌义|传统牌义/);
    assert.doesNotMatch(tarotPrompt, /表示这些能量正在直接发挥作用|信息被隐藏/);
    assertPromptIsPortableTaskText(tarotPrompt);

    const lenormand = await client.callTool({
      name: 'divine_lenormand',
      arguments: { spreadType: 'nine', seed: 'MCP雷诺曼证据样例' },
    });
    const lenormandData = lenormand.structuredContent?.result as Record<string, any>;
    assert.equal(lenormand.isError, undefined);
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
    assert.equal(lenormandData.evidenceAnalysis.layoutCoverageFact.status, '结构化覆盖');
    assert.equal(lenormandData.evidenceAnalysis.counterEvidenceFacts.length, 2);
    assert.equal(lenormandData.evidenceAnalysis.limitationFacts.length, 6);
    assert.ok(lenormandData.evidenceAnalysis.drawFact.sources.length >= 2);
    assert.equal(lenormandData.evidenceAnalysis.randomFact.status, '可重放');
    assert.equal(lenormandData.evidenceAnalysis.randomFact.seed, 'MCP雷诺曼证据样例');
    assert.doesNotMatch(lenormandData.evidenceAnalysis.randomFact.promptText, /MCP雷诺曼证据样例/);
    assert.ok(lenormandData.evidenceAnalysis.traditionalFacts.length >= 9);
    assert.equal(lenormandData.evidenceAnalysis.structuredLayoutFacts.length, 9);
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
    assert.match(lenormandPrompt, /【雷诺曼牌序组合与布局结构化证据】/);
    assert.match(lenormandPrompt, /条件化牌义|传统单牌|相邻牌/);
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
    assert.equal(confirmed.structuredContent?.result.evidenceAnalysis.drawFact.status, '可核验');
    assert.equal(confirmed.structuredContent?.result.evidenceAnalysis.signFact.status, '完整');
    assert.equal(
      confirmed.structuredContent?.result.evidenceAnalysis.coverageFact.key,
      'ssgw:interpretation-coverage',
    );
    assert.ok(
      confirmed.structuredContent?.result.evidenceAnalysis.interpretationFacts.every(
        (item: Record<string, unknown>) => item.key && item.status === '已收录' && item.promptText,
      ),
    );
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
    assert.match(String(confirmed.structuredContent?.prompt), /三山国王灵签文本与仪式结构化证据/);
    assert.match(String(confirmed.structuredContent?.prompt), /不证明预测有效性/);
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
      confirmed.structuredContent?.result.evidenceAnalysis.limitations.length,
      confirmed.structuredContent?.result.evidenceAnalysis.limitationFacts.length,
    );
    assert.doesNotMatch(
      String(confirmed.structuredContent?.prompt),
      /项目模拟|项目资料|按项目仪式规则|命语|本项目|项目统一|工程|算法结果/,
    );
    assertPromptIsPortableTaskText(String(confirmed.structuredContent?.prompt));

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
    assert.match(String(rejected.structuredContent?.prompt), /本次没有形成可解释签文/);
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
      };
    };
    assert.equal(baziChart.timing?.correctedTime?.hour, baziExpected.timing?.correctedTime.hour);
    assert.equal(
      baziChart.timing?.correctedTime?.minute,
      baziExpected.timing?.correctedTime.minute,
    );
    assert.equal(baziChart.timing?.dstCorrectionMinutes, baziExpected.timing?.dstCorrectionMinutes);

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
    };
    assert.equal(ziweiChart.basicInfo?.birth_time_label, ziweiTimeInfo.name);
    assert.equal(ziweiChart.basicInfo?.birth_time_range, ziweiTimeInfo.range.replace('-', '~'));
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
    assert.match(promptText, /【梅花体用阶段推进结构化证据】/);
    assert.doesNotMatch(promptText, /妇三岁不孕|焚如，死如|至于八月有凶/);
    assert.doesNotMatch(promptText, /体用评分：|类象权重：|\d+日内|\d+月左右/);
  });
});

test('MCP 小六壬排盘与提示词应返回三宫推进结构化证据', async () => {
  await withMcpClient(async (client) => {
    const chart = await client.callTool({
      name: 'divine_xiaoliuren',
      arguments: {
        xiaoliurenMethod: 'number',
        xiaoliurenNumber: 18,
        customDate: '2025-01-01T08:00:00+08:00',
      },
    });
    const result = (
      chart.structuredContent as {
        result: {
          evidenceAnalysis: {
            stages: Array<{
              key: string;
              status: string;
              stage: string;
              promptText: string;
              sources: string[];
              limitation: string;
            }>;
            transitions: string[];
            transitionFacts: Array<{
              key: string;
              fromStageKey: string;
              toStageKey: string;
              sources: string[];
              limitation: string;
            }>;
            counterEvidence: string[];
            counterEvidenceFacts: Array<{ key: string; status: string; limitation: string }>;
            counterSummaryFact: { factKeys: string[] };
            timingBasisFacts: Array<{
              key: string;
              promptText: string;
              sources: string[];
              limitation: string;
            }>;
            triggerConditionFacts: Array<{
              key: string;
              promptText: string;
              sources: string[];
              limitation: string;
            }>;
            timingSummaryFact: { basisFactKeys: string[]; triggerFactKeys: string[] };
            calculationFact: {
              status: string;
              steps: Array<{
                key: string;
                stage: string;
                expression: string;
                modulo: number;
                palaceIndex: number;
                promptText: string;
              }>;
            };
            randomFact: { status: string };
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
    assert.deepEqual(
      result.evidenceAnalysis.stages.map((item) => item.stage),
      ['起因', '过程', '结果'],
    );
    assert.equal(result.evidenceAnalysis.transitions.length, 2);
    assert.ok(
      result.evidenceAnalysis.stages.every(
        (item) =>
          item.key.startsWith('xiaoliuren:stage:') &&
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
          item.key.startsWith('xiaoliuren:transition:') &&
          item.fromStageKey &&
          item.toStageKey &&
          item.sources.length > 0 &&
          item.limitation.includes('现实事件必然顺利'),
      ),
    );
    assert.equal(
      result.evidenceAnalysis.counterSummaryFact.factKeys.length,
      result.evidenceAnalysis.counterEvidenceFacts.length,
    );
    assert.equal(
      result.evidenceAnalysis.timingSummaryFact.basisFactKeys.length,
      result.evidenceAnalysis.timingBasisFacts.length,
    );
    assert.equal(
      result.evidenceAnalysis.timingSummaryFact.triggerFactKeys.length,
      result.evidenceAnalysis.triggerConditionFacts.length,
    );
    assert.ok(
      result.evidenceAnalysis.triggerConditionFacts.every(
        (item) =>
          item.key.startsWith('xiaoliuren:trigger:') &&
          item.promptText &&
          item.sources.length > 0 &&
          item.limitation.includes('不得由宫数'),
      ),
    );
    assert.equal(result.evidenceAnalysis.calculationFact.status, '完整');
    assert.equal(result.evidenceAnalysis.calculationFact.steps.length, 3);
    assert.ok(
      result.evidenceAnalysis.calculationFact.steps.every(
        (item) =>
          item.key &&
          item.stage &&
          item.expression &&
          item.modulo === 6 &&
          typeof item.palaceIndex === 'number' &&
          item.promptText,
      ),
    );
    assert.equal(result.evidenceAnalysis.randomFact.status, '不适用');
    assert.ok(Array.isArray(result.evidenceAnalysis.counterEvidence));
    assert.ok(result.evidenceAnalysis.traditionalFacts.length > 0);
    assert.ok(
      result.evidenceAnalysis.traditionalFacts.every(
        (item) =>
          (item as Record<string, unknown>).status === '已映射' &&
          item.originalText &&
          item.promptText &&
          item.sources.length > 0 &&
          item.limitation.includes('不证明现实中'),
      ),
    );

    const promptResult = await client.callTool({
      name: 'xiaoliuren_prompt',
      arguments: {
        xiaoliurenMethod: 'number',
        xiaoliurenNumber: 18,
        customDate: '2025-01-01T08:00:00+08:00',
        question: '这件事应如何推进？',
      },
    });
    const prompt = String(promptResult.structuredContent?.prompt);
    assert.match(prompt, /【小六壬三宫推进结构化证据】/);
    assert.match(prompt, /现实事件复核/);
    assert.doesNotMatch(prompt, /事情整体可成|容易白忙一场|凶（大凶）/);
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

test('MCP 数字起卦起课应要求提供对应数字', async () => {
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

    for (const name of ['divine_xiaoliuren', 'xiaoliuren_prompt']) {
      const result = await client.callTool({
        name,
        arguments: {
          xiaoliurenMethod: 'number',
          ...(name.endsWith('_prompt') ? { question: '今年事业如何？' } : {}),
        },
      });
      assert.equal(result.isError, true, `${name} 缺少数字时应返回错误`);
      assert.equal(
        (result.structuredContent as { error?: string } | undefined)?.error,
        'xiaoliurenNumber 必须是正整数。',
      );
    }
  });
});

test('MCP 数字起卦起课应拒绝超出安全整数范围的数字', async () => {
  await withMcpClient(async (client) => {
    const unsafeInteger = Number.MAX_SAFE_INTEGER + 1;
    const cases: Array<[string, Record<string, unknown>, string]> = [
      ['divine_meihua', { method: 'number', number: unsafeInteger }, 'number 必须是正整数。'],
      [
        'divine_xiaoliuren',
        { xiaoliurenMethod: 'number', xiaoliurenNumber: unsafeInteger },
        'xiaoliurenNumber 必须是正整数。',
      ],
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
    assert.match(liuyaoPrompt, /【断卦要点】/);
    assert.match(liuyaoPrompt, /断卦类型：鬼神怪异/);
    assert.match(liuyaoPrompt, /【六爻用神作用链结构化证据】/);
    assert.match(liuyaoPrompt, /【主证】怪异事项候选/);
    assert.match(liuyaoPrompt, /不能据此证明超自然原因/);
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
    assert.match(liurenPrompt, /【断课要点】/);
    assert.match(liurenPrompt, /断课类型：事业断课/);
    assert.match(liurenPrompt, /【大六壬四课取传与三传推进结构化证据】/);
    assert.match(liurenPrompt, /四课取传与初传发用/);
    assert.doesNotMatch(liurenPrompt, /取用候选：.*权重\d|吉凶总分[：=]?\d/);
    const liurenData = (
      liurenResult.structuredContent as {
        result: {
          evidenceAnalysis: {
            transmissionRuleFact: {
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
            counterSummaryFact: { factKeys: string[]; limitation: string };
            timingFacts: Array<{
              key: string;
              sourceStatus: string;
              promptText: string;
              sources: string[];
              limitation: string;
            }>;
            focusSummaryFact: { status: string; limitation: string };
            calculationFact: {
              monthLeader: string;
              sources: string[];
              limitation: string;
            };
            plateFact: { status: string; actualCount: number; limitation: string };
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
    assert.match(liurenPrompt, /取传规则事实：/);
    assert.match(liurenPrompt, /类神焦点状态：/);
    assert.match(liurenPrompt, /应期边界：未给期限时不换算唯一日期/);
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
    const chart = (
      result.structuredContent as {
        result: {
          method: string;
          jiuGongGe: unknown[];
          evidenceAnalysis: {
            calculationEvidenceFacts: Array<{
              key: string;
              status: string;
              sourceKeys: string[];
              limitation: string;
            }>;
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
    assert.equal(chart.evidenceAnalysis.calculationEvidenceFacts.length, 5);
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
    assert.match(prompt, /【奇门用神宫与宫间作用结构化证据】/);
    assert.match(prompt, /奇门九宫逐宫计算事实/);
    assert.match(prompt, /不等于已经按具体问题选定用神/);
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
            }>;
            counterSummaryFact: { status: string; factKeys: string[] };
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
    assert.equal(chart.interpretationBoundary, '仅限生肖与流年关系');
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
    assert.equal(
      chart.evidenceAnalysis.limitations.length,
      chart.evidenceAnalysis.limitationFacts.length,
    );
    assert.doesNotMatch(
      chart.evidenceAnalysis.promptText,
      /命语|本项目|项目统一|工程|接口|API|MCP/,
    );
    assertPromptIsPortableTaskText(chart.evidenceAnalysis.promptText);
  });
});

test('MCP 太乙工具返回五计七十二局结构化证据', async () => {
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
          evidenceAnalysis: {
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
              sources: string[];
            }>;
            counterSummaryFact: { status: string; factKeys: string[] };
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
    assert.ok(chart.evidenceAnalysis.calculationChain.length >= 5);
    assert.equal(chart.evidenceAnalysis.calculationSteps.length, 4);
    assert.ok(
      chart.evidenceAnalysis.calculationSteps.every(
        (item) =>
          item.key.startsWith('taiyi:calculation:') &&
          item.status === '已核验' &&
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
    assert.equal(chart.evidenceAnalysis.counterSummaryFact.factKeys.length, 3);
    assert.equal(chart.evidenceAnalysis.limitationFacts.length, 5);
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
    assert.ok(chart.evidenceAnalysis.counterEvidence.some((item) => item.startsWith('未见囚')));
    assert.match(prompt, /【太乙五计七十二局结构化证据】/);
    assert.match(prompt, /传统规则模型/);
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
      generation: { method: string; coinThrows: unknown[] };
      yaoArray: number[];
      evidenceAnalysis: {
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
