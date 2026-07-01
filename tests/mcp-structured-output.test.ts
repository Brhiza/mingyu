import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { TIME_MAP } from '../src/utils/bazi/baziDisplayData';
import { calculateTrueSolarTime } from '../src/utils/bazi/trueSolarTime';
import { getTimeIndexFromClock } from 'mingyu-core/calendar';

const toolCalls: Array<[string, Record<string, unknown>]> = [
  ['divine_liuyao', {}],
  ['divine_meihua', { method: 'number', number: 42 }],
  ['divine_xiaoliuren', { xiaoliurenMethod: 'number', xiaoliurenNumber: 18 }],
  ['divine_qimen', {}],
  ['divine_liuren', {}],
  ['divine_tarot', { spreadType: 'single' }],
  ['divine_ssgw', {}],
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
  ['divine_lenormand', { spreadType: 'relationship' }],
  [
    'divine_astrolabe',
    {
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
      locationName: '北京',
    },
  ],
  [
    'bazi_calculate',
    { gender: 'male', year: 1990, month: 5, day: 15, timeIndex: 1, dateType: 'solar' },
  ],
  [
    'ziwei_calculate',
    { gender: 'male', dateType: 'solar', year: '1990', month: '5', day: '15', timeIndex: 1 },
  ],
];

const promptToolCalls: Array<[string, Record<string, unknown>, RegExp]> = [
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
    'liuyao_prompt',
    {
      customDate: '2025-01-01T08:00:00+08:00',
      liuyaoTemplate: 'shiye',
      question: '今年事业如何？',
    },
    /【占卜信息】/,
  ],
  ['meihua_prompt', { method: 'number', number: 42, question: '今年事业如何？' }, /【占卜信息】/],
  [
    'xiaoliuren_prompt',
    { xiaoliurenMethod: 'number', xiaoliurenNumber: 18, question: '今年事业如何？' },
    /【占卜信息】/,
  ],
  [
    'qimen_prompt',
    { customDate: '2025-01-01T08:00:00+08:00', question: '今年事业如何？' },
    /【占卜信息】/,
  ],
  [
    'liuren_prompt',
    {
      customDate: '2025-01-01T08:00:00+08:00',
      liurenTemplate: 'shiye',
      question: '今年事业如何？',
    },
    /【排盘信息】/,
  ],
  ['tarot_prompt', { spreadType: 'single', question: '今年事业如何？' }, /【占卜信息】/],
  ['ssgw_prompt', { question: '今年事业如何？' }, /【占卜信息】/],
  [
    'almanac_prompt',
    {
      topic: 'contract',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      question: '这几天哪天更适合签约？',
    },
    /【占卜信息】/,
  ],
  [
    'lenormand_prompt',
    { spreadType: 'relationship', question: '这段关系下一步如何？' },
    /【占卜信息】/,
  ],
  [
    'astrolabe_prompt',
    {
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
      locationName: '北京',
      question: '请看我的事业发展。',
      astrolabeTopic: 'career',
    },
    /【占卜信息】/,
  ],
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

    assert.equal(tools.length, 24);
    tools.forEach((tool) => {
      assert.equal(tool.outputSchema?.type, 'object', `${tool.name} 缺少 outputSchema`);
    });

    const ziweiTool = tools.find((tool) => tool.name === 'ziwei_calculate');
    assert.ok(ziweiTool?.outputSchema?.properties?.payloadByScope);

    assert.equal(
      tools.some((tool) => tool.name === 'build_divination_prompt'),
      false,
    );
    for (const [name] of promptToolCalls) {
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

      const text = result.content[0]?.type === 'text' ? result.content[0].text : '';
      assert.deepEqual(JSON.parse(text), result.structuredContent);
    }
  });
});

test('MCP 一站式提示词工具应同时返回结果和 prompt', async () => {
  await withMcpClient(async (client) => {
    for (const [name, args, promptPattern] of promptToolCalls) {
      const result = await client.callTool({ name, arguments: args });

      assert.equal(result.isError, undefined, `${name} 不应返回错误`);
      assert.ok(result.structuredContent?.result, `${name} 应返回 result`);
      assert.match(
        String(result.structuredContent?.prompt),
        promptPattern,
        `${name} prompt 格式不正确`,
      );

      const text = result.content[0]?.type === 'text' ? result.content[0].text : '';
      assert.deepEqual(JSON.parse(text), result.structuredContent);
    }
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
    assert.match(String(result.structuredContent?.prompt), /【占卜信息】/);
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
        locationName: '北京',
        question: '请看我 2028 年事业机会。',
        astrolabeTopic: 'job-change',
        astrolabeScopeText:
          '分析对象：流年2028。\n行运证据：土星□太阳（刑相，偏差0.50°，强度92%，入相）。',
      },
    });

    assert.equal(result.isError, undefined, 'astrolabe_prompt 不应返回错误');
    const prompt = String(result.structuredContent?.prompt);
    assert.match(prompt, /【分析对象】\n分析对象：流年2028。/);
    assert.match(prompt, /行运证据：土星□太阳/);
    assert.match(prompt, /【行运时间尺度】/);
    assert.match(
      prompt,
      /【分析对象】已经给出本命、流年、流月或流日范围时，必须以该范围作为本次回答主范围/,
    );
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
    assert.doesNotMatch(String(baziResult.structuredContent?.prompt), /【任务】/);
    assert.doesNotMatch(String(baziResult.structuredContent?.prompt), /【输出要求】/);

    const tarotResult = await client.callTool({
      name: 'tarot_prompt',
      arguments: {
        spreadType: 'single',
        question: '这件事我现在该不该继续推进？',
        promptMode: 'custom',
      },
    });
    assert.equal(tarotResult.isError, undefined, 'tarot_prompt custom 不应返回错误');
    assert.doesNotMatch(String(tarotResult.structuredContent?.prompt), /【任务】/);
    assert.doesNotMatch(String(tarotResult.structuredContent?.prompt), /【输出要求】/);

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
    assert.match(
      String(ziweiFrameworkResult.structuredContent?.prompt),
      /人生解析按“命身定位、长期课题、能力资源、关系模式、关键转折、当前阶段策略”展开。/,
    );
    assert.doesNotMatch(
      String(ziweiFrameworkResult.structuredContent?.prompt),
      /自由问答先判断问题落在哪些宫位/,
    );
  });
});

test('MCP 八字与紫微工具应支持真太阳时入参', async () => {
  await withMcpClient(async (client) => {
    const baziCorrected = calculateTrueSolarTime(
      {
        year: 1990,
        month: 5,
        day: 15,
        hour: 1,
        minute: 20,
      },
      73.5,
    ).correctedTime;
    const baziResult = await client.callTool({
      name: 'bazi_calculate',
      arguments: {
        gender: 'male',
        year: 1990,
        month: 5,
        day: 15,
        dateType: 'solar',
        useTrueSolarTime: true,
        birthHour: 1,
        birthMinute: 20,
        birthLongitude: 73.5,
      },
    });

    assert.equal(baziResult.isError, undefined, 'bazi_calculate 真太阳时不应返回错误');
    const baziChart = baziResult.structuredContent?.result as {
      timing?: { correctedTime?: { hour?: number; minute?: number } };
    };
    assert.equal(baziChart.timing?.correctedTime?.hour, baziCorrected.hour);
    assert.equal(baziChart.timing?.correctedTime?.minute, baziCorrected.minute);

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

test('MCP 梅花工具应支持外应起卦入参', async () => {
  await withMcpClient(async (client) => {
    const result = await client.callTool({
      name: 'divine_meihua',
      arguments: {
        method: 'external',
        externalOmens: {
          direction: '南',
          object: '火电文书',
          count: 3,
        },
      },
    });

    assert.equal(result.isError, undefined, 'divine_meihua 外应起卦不应返回错误');
    const meihua = result.structuredContent?.result as {
      calculation?: {
        methodKey?: string;
        externalSummary?: string;
        externalMappedOmens?: Array<{ label?: string; trigram?: string }>;
        movingYaoIndex?: number;
      };
    };
    assert.equal(meihua.calculation?.methodKey, 'external');
    assert.match(String(meihua.calculation?.externalSummary), /方位：南（离）/);
    assert.match(String(meihua.calculation?.externalSummary), /物件：火电文书（离）/);
    assert.equal(meihua.calculation?.movingYaoIndex, 3);
    assert.deepEqual(meihua.calculation?.externalMappedOmens, [
      { source: 'direction', label: '南', trigram: '离', trigramIndex: 3 },
      { source: 'object', label: '火电文书', trigram: '离', trigramIndex: 3 },
    ]);
  });
});

test('MCP 梅花外应起卦应前置校验外应数量和动爻数量', async () => {
  await withMcpClient(async (client) => {
    const invalidCases: Array<[string, Record<string, unknown>, string]> = [
      ['divine_meihua', { method: 'external' }, 'externalOmens 必须是对象。'],
      [
        'meihua_prompt',
        { method: 'external', question: '今年事业如何？' },
        'externalOmens 必须是对象。',
      ],
      [
        'divine_meihua',
        { method: 'external', externalOmens: { direction: '南', count: 3 } },
        '外应起卦至少需要两项可映射的外应。',
      ],
      [
        'meihua_prompt',
        {
          method: 'external',
          question: '今年事业如何？',
          externalOmens: { direction: '南', object: '火电文书' },
        },
        'count 必须是正整数。',
      ],
    ];

    for (const [name, args, expectedError] of invalidCases) {
      const result = await client.callTool({ name, arguments: args });
      assert.equal(result.isError, true, `${name} 应返回外应参数错误`);
      assert.equal(
        (result.structuredContent as { error?: string } | undefined)?.error,
        expectedError,
      );
    }
  });
});

test('MCP 时间型占卜工具应拒绝无效 customDate', async () => {
  await withMcpClient(async (client) => {
    const invalidDateCalls: Array<[string, Record<string, unknown>]> = [
      ['divine_liuyao', { customDate: 'not-a-date' }],
      ['divine_liuyao', { customDate: 'May 1 2025 08:00:00' }],
      ['divine_liuyao', { customDate: '2025-01-01T08:00:00' }],
      ['divine_liuyao', { customDate: '2025-02-30T08:00:00+08:00' }],
      ['divine_liuyao', { customDate: '2025-01-01T24:00:00+00:00' }],
      ['liuyao_prompt', { customDate: 'not-a-date', question: '今年事业如何？' }],
      ['liuyao_prompt', { customDate: 'May 1 2025 08:00:00', question: '今年事业如何？' }],
      ['liuyao_prompt', { customDate: '2025-01-01T08:00:00', question: '今年事业如何？' }],
      ['liuyao_prompt', { customDate: '2025-02-30T08:00:00+08:00', question: '今年事业如何？' }],
      ['liuyao_prompt', { customDate: '2025-01-01T24:00:00+00:00', question: '今年事业如何？' }],
      ['divine_meihua', { customDate: 'not-a-date' }],
      ['divine_meihua', { customDate: 'May 1 2025 08:00:00' }],
      ['divine_meihua', { customDate: '2025-01-01T08:00:00' }],
      ['divine_meihua', { customDate: '2025-02-30T08:00:00+08:00' }],
      ['divine_meihua', { customDate: '2025-01-01T24:00:00+00:00' }],
      ['meihua_prompt', { customDate: 'not-a-date', question: '今年事业如何？' }],
      ['meihua_prompt', { customDate: 'May 1 2025 08:00:00', question: '今年事业如何？' }],
      ['meihua_prompt', { customDate: '2025-01-01T08:00:00', question: '今年事业如何？' }],
      ['meihua_prompt', { customDate: '2025-02-30T08:00:00+08:00', question: '今年事业如何？' }],
      ['meihua_prompt', { customDate: '2025-01-01T24:00:00+00:00', question: '今年事业如何？' }],
      ['divine_xiaoliuren', { customDate: 'not-a-date' }],
      ['divine_xiaoliuren', { customDate: 'May 1 2025 08:00:00' }],
      ['divine_xiaoliuren', { customDate: '2025-01-01T08:00:00' }],
      ['divine_xiaoliuren', { customDate: '2025-02-30T08:00:00+08:00' }],
      ['divine_xiaoliuren', { customDate: '2025-01-01T24:00:00+00:00' }],
      ['xiaoliuren_prompt', { customDate: 'not-a-date', question: '今年事业如何？' }],
      ['xiaoliuren_prompt', { customDate: 'May 1 2025 08:00:00', question: '今年事业如何？' }],
      ['xiaoliuren_prompt', { customDate: '2025-01-01T08:00:00', question: '今年事业如何？' }],
      [
        'xiaoliuren_prompt',
        { customDate: '2025-02-30T08:00:00+08:00', question: '今年事业如何？' },
      ],
      [
        'xiaoliuren_prompt',
        { customDate: '2025-01-01T24:00:00+00:00', question: '今年事业如何？' },
      ],
      ['divine_qimen', { customDate: 'not-a-date' }],
      ['divine_qimen', { customDate: 'May 1 2025 08:00:00' }],
      ['divine_qimen', { customDate: '2025-01-01T08:00:00' }],
      ['divine_qimen', { customDate: '2025-02-30T08:00:00+08:00' }],
      ['divine_qimen', { customDate: '2025-01-01T24:00:00+00:00' }],
      ['qimen_prompt', { customDate: 'not-a-date', question: '今年事业如何？' }],
      ['qimen_prompt', { customDate: 'May 1 2025 08:00:00', question: '今年事业如何？' }],
      ['qimen_prompt', { customDate: '2025-01-01T08:00:00', question: '今年事业如何？' }],
      ['qimen_prompt', { customDate: '2025-02-30T08:00:00+08:00', question: '今年事业如何？' }],
      ['qimen_prompt', { customDate: '2025-01-01T24:00:00+00:00', question: '今年事业如何？' }],
      ['divine_liuren', { customDate: 'not-a-date' }],
      ['divine_liuren', { customDate: 'May 1 2025 08:00:00' }],
      ['divine_liuren', { customDate: '2025-01-01T08:00:00' }],
      ['divine_liuren', { customDate: '2025-02-30T08:00:00+08:00' }],
      ['divine_liuren', { customDate: '2025-01-01T24:00:00+00:00' }],
      ['liuren_prompt', { customDate: 'not-a-date', question: '今年事业如何？' }],
      ['liuren_prompt', { customDate: 'May 1 2025 08:00:00', question: '今年事业如何？' }],
      ['liuren_prompt', { customDate: '2025-01-01T08:00:00', question: '今年事业如何？' }],
      ['liuren_prompt', { customDate: '2025-02-30T08:00:00+08:00', question: '今年事业如何？' }],
      ['liuren_prompt', { customDate: '2025-01-01T24:00:00+00:00', question: '今年事业如何？' }],
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

test('MCP 六爻与大六壬提示词工具应区分专项模板字段', async () => {
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
    assert.match(String(liuyaoResult.structuredContent?.prompt), /【断卦要点】/);
    assert.match(String(liuyaoResult.structuredContent?.prompt), /断卦类型：鬼神怪异/);

    const liurenResult = await client.callTool({
      name: 'liuren_prompt',
      arguments: {
        customDate: '2025-01-01T08:00:00+08:00',
        question: '我现在要不要换工作？',
        liurenTemplate: 'shiye',
      },
    });
    assert.equal(liurenResult.isError, undefined, 'liuren_prompt 不应返回错误');
    assert.match(String(liurenResult.structuredContent?.prompt), /【分析思路】/);
    assert.match(String(liurenResult.structuredContent?.prompt), /分析类型：事业断课/);
  });
});
