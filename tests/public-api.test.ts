import test from 'node:test';
import assert from 'node:assert/strict';
import { handlePublicApiRequest } from '../src/lib/public-api/handler';
import { buildZiweiChartInput, calculateFullZiweiChart } from '../src/lib/full-chart-engine/ziwei';
import {
  buildBaziPromptForResult,
  buildZiweiPromptForRuntime,
} from '../src/lib/public-api/prompt-builders';
import { baziCalculator } from '../src/utils/bazi/baziCalculator';
import { calculateTrueSolarTime } from '../src/utils/bazi/trueSolarTime';
import { getTimeIndexFromClock } from 'mingyu-core/calendar';
import { generateQimen } from 'mingyu-core/divination/qimen';

async function callApi(path: string, init?: RequestInit) {
  const request = new Request(`https://aov.cc/api/v1/${path}`, init);
  const response = await handlePublicApiRequest(request);
  const text = await response.text();
  return {
    response,
    body: text ? JSON.parse(text) : null,
  };
}

const divinationPromptCases: Array<[string, Record<string, unknown>]> = [
  ['liuyao', { customDate: '2025-01-01T08:00:00+08:00' }],
  ['meihua', { method: 'number', number: 42 }],
  ['xiaoliuren', { xiaoliurenMethod: 'number', xiaoliurenNumber: 18 }],
  ['qimen', { customDate: '2025-01-01T08:00:00+08:00' }],
  ['liuren', { customDate: '2025-01-01T08:00:00+08:00', liurenTemplate: 'shiye' }],
  ['tarot', { spreadType: 'single' }],
  ['ssgw', {}],
  [
    'almanac',
    {
      topic: 'move',
      startDate: '2026-06-01',
      endDate: '2026-06-05',
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
  ['lenormand', { spreadType: 'relationship' }],
  [
    'astrolabe',
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
];

const timeIndexRangeMap: Record<number, string> = {
  0: '00:00~01:00',
  1: '01:00~03:00',
  2: '03:00~05:00',
  3: '05:00~07:00',
  4: '07:00~09:00',
  5: '09:00~11:00',
  6: '11:00~13:00',
  7: '13:00~15:00',
  8: '15:00~17:00',
  9: '17:00~19:00',
  10: '19:00~21:00',
  11: '21:00~23:00',
  12: '23:00~24:00',
};

test('公开 API 健康检查应返回统一成功结构', async () => {
  const { response, body } = await callApi('health');

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
  assert.equal(body.ok, true);
  assert.equal(body.data.status, 'ok');
  assert.equal(body.meta.service, 'aov.cc');
});

test('公开 API OPTIONS 应返回 CORS 预检响应', async () => {
  const { response, body } = await callApi('bazi/calculate', { method: 'OPTIONS' });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'GET,POST,OPTIONS');
  assert.equal(body, null);
});

test('公开 API manifest 应暴露 OpenAPI 和 skill 地址', async () => {
  const { body } = await callApi('manifest');

  assert.equal(body.ok, true);
  assert.equal(body.data.openapiUrl, 'https://aov.cc/api/v1/openapi.json');
  assert.equal(body.data.skillUrl, 'https://aov.cc/skills/aov-mingyu-api/SKILL.md');
  assert.ok(body.data.endpoints.includes('POST /api/v1/bazi/calculate'));
  assert.ok(body.data.endpoints.includes('POST /api/v1/divination/almanac'));
  assert.ok(body.data.endpoints.includes('POST /api/v1/divination/xiaoliuren/prompt'));
  assert.ok(body.data.endpoints.includes('POST /api/v1/divination/lenormand/prompt'));
  assert.ok(body.data.endpoints.includes('POST /api/v1/divination/astrolabe/prompt'));
});

test('公开 API OpenAPI 文档应标明占卜提示词接口返回摘要', async () => {
  const { response, body } = await callApi('openapi.json');

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.match(body.data.info.description, /黄历择日/);
  assert.match(body.data.info.description, /小六壬/);
  assert.match(body.data.info.description, /雷诺曼/);
  assert.match(body.data.info.description, /星盘/);
  assert.equal(
    body.data.paths['/divination/{method}/prompt'].post.summary,
    '起卦、抽牌或求签并生成 AI 解读提示词',
  );
  assert.deepEqual(body.data.paths['/divination/{method}/prompt'].post.parameters, [
    {
      name: 'method',
      in: 'path',
      required: true,
      schema: {
        enum: [
          'liuyao',
          'meihua',
          'xiaoliuren',
          'qimen',
          'liuren',
          'tarot',
          'ssgw',
          'almanac',
          'lenormand',
          'astrolabe',
        ],
      },
      description: '占卜方法。',
    },
  ]);
  assert.match(
    body.data.paths['/divination/{method}/prompt'].post.responses['200'].description,
    /摘要/,
  );
  assert.ok(body.data.paths['/divination/almanac']);
  assert.ok(body.data.paths['/divination/xiaoliuren']);
  assert.ok(body.data.paths['/divination/lenormand']);
  assert.ok(body.data.paths['/divination/astrolabe']);
  for (const path of [
    '/divination/liuyao',
    '/divination/meihua',
    '/divination/xiaoliuren',
    '/divination/qimen',
    '/divination/liuren',
    '/divination/tarot',
    '/divination/ssgw',
    '/divination/almanac',
    '/divination/lenormand',
    '/divination/astrolabe',
  ]) {
    assert.ok(body.data.paths[path].post.requestBody, `${path} 应声明请求体`);
    assert.equal(
      body.data.paths[path].post.requestBody.content['application/json'].schema.$ref,
      '#/components/schemas/DivinationRequest',
      `${path} 应复用占卜请求 schema`,
    );
  }
  assert.ok(body.data.components.schemas.DivinationPromptRequest.properties.topic);
  assert.ok(body.data.components.schemas.DivinationPromptRequest.properties.xiaoliurenMethod);
  assert.ok(body.data.components.schemas.DivinationPromptRequest.properties.participants);
  assert.ok(body.data.components.schemas.DivinationPromptRequest.properties.latitude);
  assert.ok(body.data.components.schemas.DivinationPromptRequest.properties.liuyaoTemplate);
  assert.ok(body.data.components.schemas.DivinationPromptRequest.properties.liurenTemplate);
  assert.ok(body.data.components.schemas.DivinationPromptRequest.properties.externalOmens);
  assert.match(
    JSON.stringify(body.data.components.schemas.DivinationPromptRequest.properties.spreadType),
    /nine/,
  );
  assert.match(
    JSON.stringify(body.data.components.schemas.DivinationPromptRequest.properties.externalOmens),
    /火电文书/,
  );
  assert.ok(body.data.components.schemas.DivinationPromptRequest.properties.astrolabeTopic);
  assert.equal(
    Boolean(body.data.components.schemas.DivinationPromptRequest.properties.template),
    false,
  );
  assert.match(
    JSON.stringify(body.data.components.schemas.DivinationPromptRequest.properties.liuyaoTemplate),
    /guaishen/,
  );
  const divinationRequestProperties = body.data.components.schemas.DivinationRequest.properties;
  assert.equal(divinationRequestProperties.customDate.format, 'date-time');
  assert.deepEqual(divinationRequestProperties.year, {
    type: 'integer',
    minimum: 1900,
    maximum: 2100,
  });
  assert.deepEqual(divinationRequestProperties.month, {
    type: 'integer',
    minimum: 1,
    maximum: 12,
  });
  assert.deepEqual(divinationRequestProperties.hour, {
    type: 'integer',
    minimum: 0,
    maximum: 23,
  });
  assert.deepEqual(divinationRequestProperties.minute, {
    type: 'integer',
    minimum: 0,
    maximum: 59,
  });
  assert.deepEqual(divinationRequestProperties.latitude, {
    type: 'number',
    minimum: -90,
    maximum: 90,
  });
  assert.deepEqual(divinationRequestProperties.longitude, {
    type: 'number',
    minimum: -180,
    maximum: 180,
  });
  assert.deepEqual(divinationRequestProperties.timezone, {
    type: 'number',
    minimum: -12,
    maximum: 14,
  });
  assert.deepEqual(divinationRequestProperties.useTrueSolarTime, { type: 'boolean' });
  assert.equal(divinationRequestProperties.startDate.format, 'date');
  assert.equal(divinationRequestProperties.endDate.format, 'date');
  assert.equal(divinationRequestProperties.participants.items.type, 'object');
  assert.deepEqual(divinationRequestProperties.participants.items.properties.timeIndex, {
    type: 'integer',
    minimum: 0,
    maximum: 12,
  });
  assert.equal(divinationRequestProperties.participants.items.properties.dateType.enum.length, 2);
  const ziweiTopicSchema = JSON.stringify(
    body.data.components.schemas.ZiweiPromptRequest.allOf[1].properties.promptTopic,
  );
  for (const topic of [
    'family', 'social', 'health', 'recent', 'job-change', 'startup-partnership',
    'relationship-decision', 'children', 'home-move', 'study', 'study-advance',
    'investment-partnership', 'reconciliation-decision', 'settle-relocate', 'exam-landing',
  ]) {
    assert.match(ziweiTopicSchema, new RegExp(topic), `紫微 promptTopic 应包含 ${topic}`);
  }
  const baziTopicSchema = JSON.stringify(
    body.data.components.schemas.BaziPromptRequest.allOf[1].properties.promptTopic,
  );
  for (const topic of [
    'recent', 'talent', 'relationship-push', 'startup-partnership', 'relationship-decision',
    'home-move', 'study-advance', 'investment-partnership', 'reconciliation-decision',
    'settle-relocate', 'exam-landing',
  ]) {
    assert.match(baziTopicSchema, new RegExp(topic), `八字 promptTopic 应包含 ${topic}`);
  }
  assert.ok(body.data.components.schemas.ZiweiRequest.properties.promptScope);
  assert.match(
    body.data.components.schemas.ZiweiRequest.properties.promptScope.description,
    /避免一次性生成全部运限/,
  );
  assert.equal(
    body.data.components.schemas.BaziRequest.properties.shenShaVariants.$ref,
    '#/components/schemas/ShenShaVariants',
  );
  assert.match(
    body.data.components.schemas.ShenShaVariants.description,
    /默认主流口径/,
  );
  assert.deepEqual(body.data.components.schemas.ShenShaVariants.properties.kongWangBasis.enum, [
    'day',
    'day-and-year',
  ]);
});

test('公开 API 应支持八字排盘', async () => {
  const { response, body } = await callApi('bazi/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gender: 'male',
      year: 1990,
      month: 5,
      day: 15,
      timeIndex: 1,
      dateType: 'solar',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.pillars.day.ganZhi.length, 2);
  assert.equal(body.data.gender, 'male');
});

test('公开 API 八字神煞默认使用主流口径', async () => {
  const { response, body } = await callApi('bazi/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gender: 'male',
      year: 1980,
      month: 1,
      day: 1,
      timeIndex: 0,
      dateType: 'solar',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.deepEqual(body.data.kongWang.year, ['子', '丑']);
  assert.deepEqual(body.data.kongWang.day, ['戌', '亥']);
  assert.ok(!body.data.shensha.month.includes('空亡'));
  assert.ok(!body.data.shensha.hour.includes('空亡'));
});

test('公开 API 八字可通过 shenShaVariants 请求兼容争议口径', async () => {
  const { response, body } = await callApi('bazi/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gender: 'male',
      year: 1980,
      month: 1,
      day: 1,
      timeIndex: 0,
      dateType: 'solar',
      shenShaVariants: {
        kongWangBasis: 'day-and-year',
      },
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.ok(body.data.shensha.month.includes('空亡'));
  assert.ok(body.data.shensha.hour.includes('空亡'));
});

test('公开 API 八字 shenShaVariants 非法值应返回参数错误', async () => {
  const { response, body } = await callApi('bazi/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gender: 'male',
      year: 1980,
      month: 1,
      day: 1,
      timeIndex: 0,
      dateType: 'solar',
      shenShaVariants: {
        kongWangBasis: 'year',
      },
    }),
  });

  assert.equal(response.status, 400);
  assert.equal(body.ok, false);
  assert.equal(body.error.code, 'BAD_REQUEST');
  assert.match(body.error.message, /kongWangBasis 必须是以下值之一/);
});

test('公开 API 八字排盘接口只返回排盘结果', async () => {
  const { response, body } = await callApi('bazi/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gender: 'female',
      year: 1987,
      month: 7,
      day: 5,
      timeIndex: 6,
      dateType: 'solar',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.gender, 'female');
  assert.equal('prompt' in body.data, false);
  assert.equal('result' in body.data, false);
});

test('公开 API 八字排盘应支持真太阳时精确时分和经度', async () => {
  const corrected = calculateTrueSolarTime(
    {
      year: 1990,
      month: 4,
      day: 15,
      hour: 1,
      minute: 20,
    },
    73.5,
  ).correctedTime;
  const { response, body } = await callApi('bazi/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gender: 'male',
      year: 1990,
      month: 4,
      day: 15,
      dateType: 'solar',
      useTrueSolarTime: true,
      birthHour: 1,
      birthMinute: 20,
      birthLongitude: 73.5,
      birthPlace: '新疆喀什',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.timing.enabled, true);
  assert.equal(body.data.timing.correctedTime.year, corrected.year);
  assert.equal(body.data.timing.correctedTime.month, corrected.month);
  assert.equal(body.data.timing.correctedTime.day, corrected.day);
  assert.equal(body.data.timing.correctedTime.hour, corrected.hour);
  assert.equal(body.data.timing.correctedTime.minute, corrected.minute);
  assert.equal(body.data.timing.birthPlace, '新疆喀什');
});

test('公开 API 八字公历日期不存在时应返回参数错误', async () => {
  const { response, body } = await callApi('bazi/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gender: 'male',
      year: 2024,
      month: 2,
      day: 31,
      timeIndex: 0,
      dateType: 'solar',
    }),
  });

  assert.equal(response.status, 400);
  assert.equal(body.ok, false);
  assert.equal(body.error.code, 'BAD_REQUEST');
  assert.match(body.error.message, /日期需在 1-29 之间/);
});

test('公开 API 八字农历闰月不存在时应返回参数错误', async () => {
  const { response, body } = await callApi('bazi/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gender: 'male',
      year: 2024,
      month: 1,
      day: 1,
      timeIndex: 0,
      dateType: 'lunar',
      isLeapMonth: true,
    }),
  });

  assert.equal(response.status, 400);
  assert.equal(body.ok, false);
  assert.equal(body.error.code, 'BAD_REQUEST');
  assert.match(body.error.message, /农历日期不存在/);
});

test('公开 API 八字提示词接口应一次返回排盘和提示词', async () => {
  const { response, body } = await callApi('bazi/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gender: 'male',
      year: 1990,
      month: 5,
      day: 15,
      timeIndex: 1,
      dateType: 'solar',
      question: '我适合创业还是上班？',
      promptTopic: 'career',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.result.gender, 'male');
  assert.match(body.data.prompt, /【排盘信息】/);
  assert.match(body.data.prompt, /我适合创业还是上班/);
});

test('公开 API 八字空问题应返回 400，保持 question 必填契约', async () => {
  const { response, body } = await callApi('bazi/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gender: 'male',
      year: 1990,
      month: 5,
      day: 15,
      timeIndex: 1,
      dateType: 'solar',
      question: '',
      promptTopic: 'career',
    }),
  });

  assert.equal(response.status, 400);
  assert.equal(body.ok, false);
  assert.match(body.error.message, /question 不能为空/);
});

test('八字公开 API prompt builder 空问题会按所选方向补默认问题，不复用内置任务说明', () => {
  const result = baziCalculator.calculateBazi({
    gender: 'male',
    year: 1990,
    month: 5,
    day: 15,
    timeIndex: 1,
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

  const prompt = buildBaziPromptForResult({
    result,
    question: '',
    topic: 'career',
  });

  assert.match(prompt, /【问题】\n请先从事业方向、工作模式和当前风险开始分析。/);
  assert.match(
    prompt,
    /【任务】\n判断命局更适合守成、开拓、技术、管理还是经营，再说明当前阶段的赚钱方式、职业方向和风险点。/,
  );
  assert.doesNotMatch(prompt, /【问题】\n判断命局更适合守成、开拓、技术、管理还是经营/);
});

test('八字公开 API 近期专项会输出对应默认问题与任务主题', () => {
  const result = baziCalculator.calculateBazi({
    gender: 'male',
    year: 1990,
    month: 5,
    day: 15,
    timeIndex: 1,
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

  const prompt = buildBaziPromptForResult({
    result,
    question: '',
    topic: 'recent',
  });

  assert.match(prompt, /【问题】\n请先从当前阶段主线、近期节奏变化和风险提醒开始分析。/);
  assert.match(prompt, /【任务】\n结合当前大运、流年、流月与命局主线/);
});

test('八字公开 API 决策型跳槽专项会输出对应默认问题与任务主题', () => {
  const result = baziCalculator.calculateBazi({
    gender: 'male',
    year: 1990,
    month: 5,
    day: 15,
    timeIndex: 1,
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

  const prompt = buildBaziPromptForResult({
    result,
    question: '',
    topic: 'job-change',
  });

  assert.match(prompt, /【问题】\n请先从现在适不适合换工作、转方向和如何判断时机开始分析。/);
  assert.match(prompt, /【任务】\n结合当前大运、流年、流月与命局主线，判断现在更适合留在原岗位/);
});

test('八字公开 API 第二批专项会输出对应默认问题与任务主题', () => {
  const result = baziCalculator.calculateBazi({
    gender: 'male',
    year: 1990,
    month: 5,
    day: 15,
    timeIndex: 1,
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

  const startupPrompt = buildBaziPromptForResult({
    result,
    question: '',
    topic: 'startup-partnership',
  });
  assert.match(
    startupPrompt,
    /【问题】\n请先从适不适合创业、单干还是合作，以及如何判断当前时机开始分析。/,
  );
  assert.match(
    startupPrompt,
    /【任务】\n结合当前大运、流年、流月与命局主线，判断现在更适合创业、找人合作、小范围试跑、继续上班积累还是暂缓，并说明方向选择、资源来源、合作分工、现金流压力和现实风险。/,
  );

  const relationshipPrompt = buildBaziPromptForResult({
    result,
    question: '',
    topic: 'relationship-decision',
  });
  assert.match(
    relationshipPrompt,
    /【问题】\n请先从这段关系该继续投入、放手止损还是保持观察开始分析。/,
  );
  assert.match(
    relationshipPrompt,
    /【任务】\n围绕配偶星、夫妻宫、桃花与当前岁运引动，判断这段关系现在更适合继续投入、放慢观察、重新建立边界还是及时止损，并说明继续投入的条件、止损信号、现实代价和接下来的判断标准。/,
  );

  const homePrompt = buildBaziPromptForResult({
    result,
    question: '',
    topic: 'home-move',
  });
  assert.match(
    homePrompt,
    /【问题】\n请先从现在适不适合搬家、换城市、买房置业和居住调整开始分析。/,
  );
  assert.match(
    homePrompt,
    /【任务】\n围绕搬家、换城市、买房置业与居住调整做整体分析，判断现在更适合行动还是继续观望，并说明居住稳定性、资金压力、家庭牵动、行动时机和风险控制重点。/,
  );

  const studyPrompt = buildBaziPromptForResult({
    result,
    question: '',
    topic: 'study-advance',
  });
  assert.match(studyPrompt, /【问题】\n请先从我适不适合考证、读研进修或跨领域学习开始分析。/);
  assert.match(
    studyPrompt,
    /【任务】\n围绕考证、读研进修、跨领域学习与当前岁运引动做整体分析，判断现在更适合冲刺、长期准备、换赛道学习还是暂缓，并说明投入产出、执行压力和现实代价。/,
  );
});

test('八字公开 API 第三批专项会输出对应默认问题与任务主题', () => {
  const result = baziCalculator.calculateBazi({
    gender: 'male',
    year: 1990,
    month: 5,
    day: 15,
    timeIndex: 1,
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

  const investmentPrompt = buildBaziPromptForResult({
    result,
    question: '',
    topic: 'investment-partnership',
  });
  assert.match(
    investmentPrompt,
    /【问题】\n请先从我现在适不适合投资、跟人合作求财还是继续观望开始分析。/,
  );
  assert.match(
    investmentPrompt,
    /【任务】\n围绕财星、官杀、印星、食伤、比劫与当前岁运引动，判断现在更适合独立投资、合作求财、继续观望还是先守财，并说明资金压力、收益模式、合作分工、风险边界和现实代价。/,
  );

  const reconciliationPrompt = buildBaziPromptForResult({
    result,
    question: '',
    topic: 'reconciliation-decision',
  });
  assert.match(
    reconciliationPrompt,
    /【问题】\n请先从这段旧关系现在还有没有复合空间，以及更适合争取、观察还是放下开始分析。/,
  );
  assert.match(
    reconciliationPrompt,
    /【任务】\n围绕配偶星、夫妻宫、桃花、旧缘信号与当前岁运引动，判断这段旧关系现在更适合争取复合、保持观察、先立边界还是及时放下，并说明复合条件、现实阻力、风险信号和接下来的判断标准。/,
  );

  const settlePrompt = buildBaziPromptForResult({
    result,
    question: '',
    topic: 'settle-relocate',
  });
  assert.match(
    settlePrompt,
    /【问题】\n请先从我现在适不适合长期定居、换城市发展还是留在当前城市开始分析。/,
  );
  assert.match(
    settlePrompt,
    /【任务】\n围绕长期定居、换城市发展与居住根基做整体分析，判断现在更适合留在当前城市、换城发展、两地过渡还是暂缓决定，并说明稳定性、事业机会、家庭牵动、成本压力和行动顺序。/,
  );

  const examPrompt = buildBaziPromptForResult({
    result,
    question: '',
    topic: 'exam-landing',
  });
  assert.match(
    examPrompt,
    /【问题】\n请先从这次考试、面试或申请更适合冲刺、稳住发挥还是调整预期开始分析。/,
  );
  assert.match(
    examPrompt,
    /【任务】\n围绕印星、食伤、官杀、文凭考试与当前岁运引动做整体分析，判断这次考试、面试或申请更适合冲刺上岸、稳住发挥、调整目标还是暂缓重来，并说明发挥短板、竞争压力、准备重点和现实风险。/,
  );
});

test('公开 API 八字自定义提示词不强塞专项框架', async () => {
  const { response, body } = await callApi('bazi/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gender: 'male',
      year: 1990,
      month: 5,
      day: 15,
      timeIndex: 1,
      dateType: 'solar',
      question: '只看我问的这个具体问题。',
      promptMode: 'custom',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.match(body.data.prompt, /【排盘信息】/);
  assert.match(body.data.prompt, /只看我问的这个具体问题/);
  assert.doesNotMatch(body.data.prompt, /【问题研判框架】/);
  assert.doesNotMatch(body.data.prompt, /【任务】/);
  assert.doesNotMatch(body.data.prompt, /【输出要求】/);
});

test('公开 API 紫微提示词接口应一次返回排盘和提示词', async () => {
  const { response, body } = await callApi('ziwei/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: '测试',
      gender: 'female',
      dateType: 'solar',
      year: '1992',
      month: '8',
      day: '21',
      timeIndex: 4,
      question: '我的感情关系要注意什么？',
      promptTopic: 'relationship',
      promptScope: 'origin',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.deepEqual(body.data.result.scopeNames, ['origin']);
  assert.equal(body.data.result.payloadByScope.origin.evidence_pool.length, 0);
  assert.match(body.data.prompt, /【问题】/);
  assert.match(body.data.prompt, /我的感情关系要注意什么/);
});

test('公开 API 紫微提示词接口只生成所需范围，避免线上函数超时', async () => {
  const { response, body } = await callApi('ziwei/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: '测试',
      gender: 'female',
      dateType: 'solar',
      year: '1992',
      month: '8',
      day: '21',
      timeIndex: 4,
      question: '今年适合换工作吗？',
      promptTopic: 'job-change',
      promptScope: 'yearly',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.deepEqual(body.data.result.scopeNames, ['origin', 'yearly']);
  assert.equal(body.data.result.payloadByScope.yearly.active_scope.scope, 'yearly');
  assert.equal(body.data.result.payloadByScope.yearly.evidence_pool.length, 0);
  assert.equal(body.data.result.payloadByScope.yearly.patterns.length, 0);
  assert.equal(body.data.result.payloadByScope.decadal, undefined);
  assert.match(body.data.prompt, /分析范围：流年/);
  assert.match(body.data.prompt, /【任务】/);
});

test('公开 API 紫微空问题应返回 400，保持 question 必填契约', async () => {
  const { response, body } = await callApi('ziwei/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: '测试',
      gender: 'female',
      dateType: 'solar',
      year: '1992',
      month: '8',
      day: '21',
      timeIndex: 4,
      question: '',
      promptTopic: 'career-wealth',
      promptScope: 'origin',
    }),
  });

  assert.equal(response.status, 400);
  assert.equal(body.ok, false);
  assert.match(body.error.message, /question 不能为空/);
});

test('紫微公开 API prompt builder 空问题会按所选方向补默认问题', async () => {
  const runtime = await calculateFullZiweiChart(
    buildZiweiChartInput({
      name: '测试',
      gender: 'female',
      dateType: 'solar',
      year: '1992',
      month: '8',
      day: '21',
      timeIndex: 4,
      isLeapMonth: false,
      useTrueSolarTime: false,
    }),
  );

  const prompt = buildZiweiPromptForRuntime({
    result: runtime,
    question: '',
    topic: 'career-wealth',
    scope: 'origin',
  });

  assert.match(prompt, /【问题】\n请先从事业路径、财富方式和当前风险开始分析。/);
  assert.doesNotMatch(prompt, /【问题】\n请先做整体解读。/);
});

test('紫微公开 API 新增专项主题应输出对应分析主题与框架', async () => {
  const runtime = await calculateFullZiweiChart(
    buildZiweiChartInput({
      name: '测试',
      gender: 'female',
      dateType: 'solar',
      year: '1992',
      month: '8',
      day: '21',
      timeIndex: 4,
      isLeapMonth: false,
      useTrueSolarTime: false,
    }),
  );

  const prompt = buildZiweiPromptForRuntime({
    result: runtime,
    question: '',
    topic: 'health',
    scope: 'origin',
  });

  assert.match(prompt, /分析主题：健康养护/);
  assert.match(prompt, /【问题】\n请先从身心压力、健康隐患和日常养护重点开始分析。/);
  assert.match(prompt, /健康养护先看疾厄宫、福德宫、命宫、身宫、迁移宫和当前运限触发。/);
});

test('紫微公开 API 子女专项主题应输出对应分析主题与框架', async () => {
  const runtime = await calculateFullZiweiChart(
    buildZiweiChartInput({
      name: '测试',
      gender: 'female',
      dateType: 'solar',
      year: '1992',
      month: '8',
      day: '21',
      timeIndex: 4,
      isLeapMonth: false,
      useTrueSolarTime: false,
    }),
  );

  const prompt = buildZiweiPromptForRuntime({
    result: runtime,
    question: '',
    topic: 'children',
    scope: 'origin',
  });

  assert.match(prompt, /分析主题：子女亲缘/);
  assert.match(prompt, /【问题】\n请先从子女缘分、亲子互动和教育陪伴重点开始分析。/);
  assert.match(prompt, /子女亲缘先看子女宫、夫妻宫、命宫、福德宫、田宅宫与当前运限牵动。/);
  assert.match(prompt, /涉及子女数量和性别只能给倾向与证据限制/);
});

test('紫微公开 API 人际专项主题应输出对应分析主题与框架', async () => {
  const runtime = await calculateFullZiweiChart(
    buildZiweiChartInput({
      name: '测试',
      gender: 'female',
      dateType: 'solar',
      year: '1992',
      month: '8',
      day: '21',
      timeIndex: 4,
      isLeapMonth: false,
      useTrueSolarTime: false,
    }),
  );

  const prompt = buildZiweiPromptForRuntime({
    result: runtime,
    question: '',
    topic: 'social',
    scope: 'origin',
  });

  assert.match(prompt, /分析主题：人际合作/);
  assert.match(prompt, /【问题】\n请先从人际互动、合作模式和贵人阻力开始分析。/);
  assert.match(prompt, /人际合作先看兄弟宫、迁移宫、福德宫、命宫、官禄宫和财帛宫的联动。/);
});

test('紫微公开 API 近期专项主题应输出对应分析主题与框架', async () => {
  const runtime = await calculateFullZiweiChart(
    buildZiweiChartInput({
      name: '测试',
      gender: 'female',
      dateType: 'solar',
      year: '1992',
      month: '8',
      day: '21',
      timeIndex: 4,
      isLeapMonth: false,
      useTrueSolarTime: false,
    }),
  );

  const prompt = buildZiweiPromptForRuntime({
    result: runtime,
    question: '',
    topic: 'recent',
    scope: 'origin',
  });

  assert.match(prompt, /分析主题：近期趋势/);
  assert.match(prompt, /【问题】\n请先从当前阶段重点、推进节奏和风险提醒开始分析。/);
  assert.match(
    prompt,
    /近期趋势先看当前运限落宫、命宫、身宫、官禄宫、财帛宫、迁移宫与福德宫的联动。/,
  );
});

test('紫微公开 API 工作变动专项主题应输出对应分析主题与框架', async () => {
  const runtime = await calculateFullZiweiChart(
    buildZiweiChartInput({
      name: '测试',
      gender: 'female',
      dateType: 'solar',
      year: '1992',
      month: '8',
      day: '21',
      timeIndex: 4,
      isLeapMonth: false,
      useTrueSolarTime: false,
    }),
  );

  const prompt = buildZiweiPromptForRuntime({
    result: runtime,
    question: '',
    topic: 'job-change',
    scope: 'origin',
  });

  assert.match(prompt, /分析主题：工作变动/);
  assert.match(prompt, /【问题】\n请先从现在适不适合换工作、转方向和如何判断时机开始分析。/);
  assert.match(prompt, /工作变动先看官禄宫、迁移宫、财帛宫、命宫、田宅宫与福德宫/);
});

test('紫微公开 API 第二批专项主题应输出对应分析主题与框架', async () => {
  const runtime = await calculateFullZiweiChart(
    buildZiweiChartInput({
      name: '测试',
      gender: 'female',
      dateType: 'solar',
      year: '1992',
      month: '8',
      day: '21',
      timeIndex: 4,
      isLeapMonth: false,
      useTrueSolarTime: false,
    }),
  );

  const startupPrompt = buildZiweiPromptForRuntime({
    result: runtime,
    question: '',
    topic: 'startup-partnership',
    scope: 'origin',
  });
  assert.match(startupPrompt, /分析主题：创业合作/);
  assert.match(
    startupPrompt,
    /【问题】\n请先从适不适合创业、单干还是合作，以及如何判断当前时机开始分析。/,
  );
  assert.match(startupPrompt, /创业合作先看官禄宫、财帛宫、迁移宫、命宫、福德宫与兄弟宫/);

  const relationshipPrompt = buildZiweiPromptForRuntime({
    result: runtime,
    question: '',
    topic: 'relationship-decision',
    scope: 'origin',
  });
  assert.match(relationshipPrompt, /分析主题：关系去留/);
  assert.match(
    relationshipPrompt,
    /【问题】\n请先从这段关系该继续投入、放手止损还是保持观察开始分析。/,
  );
  assert.match(relationshipPrompt, /关系去留先看夫妻宫、命宫、福德宫、迁移宫与当前运限牵动/);

  const homePrompt = buildZiweiPromptForRuntime({
    result: runtime,
    question: '',
    topic: 'home-move',
    scope: 'origin',
  });
  assert.match(homePrompt, /分析主题：搬家置业/);
  assert.match(
    homePrompt,
    /【问题】\n请先从现在适不适合搬家、换城市、买房置业和居住调整开始分析。/,
  );
  assert.match(homePrompt, /搬家置业先看田宅宫、迁移宫、财帛宫、福德宫、命宫与父母宫/);

  const studyPrompt = buildZiweiPromptForRuntime({
    result: runtime,
    question: '',
    topic: 'study-advance',
    scope: 'origin',
  });
  assert.match(studyPrompt, /分析主题：考证进修/);
  assert.match(studyPrompt, /【问题】\n请先从我适不适合考证、读研进修或跨领域学习开始分析。/);
  assert.match(studyPrompt, /考证进修先看命宫、福德宫、官禄宫、父母宫、迁移宫和当前运限联动/);
});

test('紫微公开 API 第三批专项主题应输出对应分析主题与框架', async () => {
  const runtime = await calculateFullZiweiChart(
    buildZiweiChartInput({
      name: '测试',
      gender: 'female',
      dateType: 'solar',
      year: '1992',
      month: '8',
      day: '21',
      timeIndex: 4,
      isLeapMonth: false,
      useTrueSolarTime: false,
    }),
  );

  const investmentPrompt = buildZiweiPromptForRuntime({
    result: runtime,
    question: '',
    topic: 'investment-partnership',
    scope: 'origin',
  });
  assert.match(investmentPrompt, /分析主题：投资合作/);
  assert.match(
    investmentPrompt,
    /【问题】\n请先从我现在适不适合投资、跟人合作求财还是继续观望开始分析。/,
  );
  assert.match(
    investmentPrompt,
    /投资合作先看财帛宫、官禄宫、福德宫、兄弟宫、迁移宫与命宫的联动。/,
  );

  const reconciliationPrompt = buildZiweiPromptForRuntime({
    result: runtime,
    question: '',
    topic: 'reconciliation-decision',
    scope: 'origin',
  });
  assert.match(reconciliationPrompt, /分析主题：复合判断/);
  assert.match(
    reconciliationPrompt,
    /【问题】\n请先从这段旧关系现在还有没有复合空间，以及更适合争取、观察还是放下开始分析。/,
  );
  assert.match(
    reconciliationPrompt,
    /复合判断先看夫妻宫、命宫、福德宫、迁移宫、子女宫与当前运限牵动/,
  );

  const settlePrompt = buildZiweiPromptForRuntime({
    result: runtime,
    question: '',
    topic: 'settle-relocate',
    scope: 'origin',
  });
  assert.match(settlePrompt, /分析主题：定居换城/);
  assert.match(
    settlePrompt,
    /【问题】\n请先从我现在适不适合长期定居、换城市发展还是留在当前城市开始分析。/,
  );
  assert.match(settlePrompt, /定居换城先看田宅宫、迁移宫、官禄宫、财帛宫、福德宫、命宫与父母宫/);

  const examPrompt = buildZiweiPromptForRuntime({
    result: runtime,
    question: '',
    topic: 'exam-landing',
    scope: 'origin',
  });
  assert.match(examPrompt, /分析主题：考试上岸/);
  assert.match(
    examPrompt,
    /【问题】\n请先从这次考试、面试或申请更适合冲刺、稳住发挥还是调整预期开始分析。/,
  );
  assert.match(examPrompt, /考试上岸先看命宫、福德宫、官禄宫、父母宫、迁移宫与当前运限联动/);
});

test('公开 API 紫微未指定方向时应默认走综合框架而不是自由问答', async () => {
  const { response, body } = await callApi('ziwei/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: '测试',
      gender: 'female',
      dateType: 'solar',
      year: '1992',
      month: '8',
      day: '21',
      timeIndex: 4,
      question: '请先做整体解读。',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.match(body.data.prompt, /【分析背景】/);
  assert.match(body.data.prompt, /分析主题：人生解析/);
  assert.match(body.data.prompt, /围绕人生解析，优先看命身定位、长期课题、能力资源/);
  assert.match(body.data.prompt, /【输出要求】/);
  assert.doesNotMatch(body.data.prompt, /自由问答先判断问题落在哪些宫位/);
});

test('公开 API 紫微排盘应支持真太阳时精确时分和经度', async () => {
  const corrected = calculateTrueSolarTime(
    {
      year: 1990,
      month: 4,
      day: 15,
      hour: 1,
      minute: 20,
    },
    73.5,
  ).correctedTime;
  const expectedTimeIndex = getTimeIndexFromClock(corrected.hour, corrected.minute);
  const { response, body } = await callApi('ziwei/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: '测试',
      gender: 'male',
      dateType: 'solar',
      year: '1990',
      month: '4',
      day: '15',
      useTrueSolarTime: true,
      birthHour: '1',
      birthMinute: '20',
      birthLongitude: '73.5',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.deepEqual(body.data.scopeNames, ['origin']);
  assert.equal(
    body.data.basicInfo.solar_date,
    `${corrected.year}-${String(corrected.month).padStart(2, '0')}-${String(corrected.day).padStart(2, '0')}`,
  );
  assert.equal(body.data.basicInfo.birth_time_range, timeIndexRangeMap[expectedTimeIndex]);
});

test('公开 API 紫微排盘接口支持按需返回指定范围', async () => {
  const { response, body } = await callApi('ziwei/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: '测试',
      gender: 'female',
      dateType: 'solar',
      year: '1992',
      month: '8',
      day: '21',
      timeIndex: 4,
      promptScope: 'monthly',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.deepEqual(body.data.scopeNames, ['origin', 'monthly']);
  assert.equal(body.data.payloadByScope.monthly.active_scope.scope, 'monthly');
  assert.equal(body.data.payloadByScope.yearly, undefined);
});

test('公开 API 紫微排盘应提供 agent 易解析的四化和宫位列表', async () => {
  const { response, body } = await callApi('ziwei/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: '吴丹蕾',
      gender: 'female',
      dateType: 'solar',
      year: '1998',
      month: '8',
      day: '13',
      timeIndex: 0,
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.deepEqual(body.data.四化, {
    禄: '贪狼',
    权: '太阴',
    科: '右弼',
    忌: '天机',
  });
  assert.deepEqual(body.data.fourMutagens, body.data.四化);
  assert.equal(body.data.五行局, body.data.basicInfo.five_elements_class);
  assert.equal(body.data.gongList.length, 12);
  assert.ok(body.data.gongList.some((palace: { name: string; stars: string[] }) => {
    return palace.name === '命宫' && palace.stars.length > 0;
  }));
});

test('公开 API 紫微真太阳时参数缺失或越界时应返回 400', async () => {
  for (const payload of [
    {
      name: '测试',
      gender: 'male',
      dateType: 'solar',
      year: '1990',
      month: '4',
      day: '15',
      useTrueSolarTime: true,
      birthHour: '1',
      birthMinute: '20',
    },
    {
      name: '测试',
      gender: 'male',
      dateType: 'solar',
      year: '1990',
      month: '4',
      day: '15',
      useTrueSolarTime: true,
      birthHour: '24',
      birthMinute: '20',
      birthLongitude: '73.5',
    },
    {
      name: '测试',
      gender: 'male',
      dateType: 'solar',
      year: '1990',
      month: '4',
      day: '15',
      useTrueSolarTime: true,
      birthHour: '1',
      birthMinute: '60',
      birthLongitude: '73.5',
    },
    {
      name: '测试',
      gender: 'male',
      dateType: 'solar',
      year: '1990',
      month: '4',
      day: '15',
      useTrueSolarTime: true,
      birthHour: '1',
      birthMinute: '20',
      birthLongitude: '181',
    },
  ]) {
    const { response, body } = await callApi('ziwei/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(response.status, 400, JSON.stringify(payload));
    assert.equal(body.ok, false);
    assert.equal(body.error.code, 'BAD_REQUEST');
    assert.doesNotMatch(body.error.message, /内部错误/);
  }
});

test('公开 API 紫微公历日期不存在时应返回参数错误', async () => {
  const { response, body } = await callApi('ziwei/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: '测试',
      gender: 'male',
      dateType: 'solar',
      year: '2024',
      month: '2',
      day: '31',
      timeIndex: 0,
    }),
  });

  assert.equal(response.status, 400);
  assert.equal(body.ok, false);
  assert.equal(body.error.code, 'BAD_REQUEST');
  assert.match(body.error.message, /日期需在 1-29 之间/);
});

test('公开 API 紫微农历闰月不存在时应返回参数错误', async () => {
  const { response, body } = await callApi('ziwei/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: '测试',
      gender: 'male',
      dateType: 'lunar',
      year: '2024',
      month: '1',
      day: '1',
      timeIndex: 0,
      isLeapMonth: true,
    }),
  });

  assert.equal(response.status, 400);
  assert.equal(body.ok, false);
  assert.equal(body.error.code, 'BAD_REQUEST');
  assert.match(body.error.message, /农历日期不存在/);
});

test('公开 API 紫微自定义提示词不强塞分析思路', async () => {
  const { response, body } = await callApi('ziwei/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: '测试',
      gender: 'female',
      dateType: 'solar',
      year: '1992',
      month: '8',
      day: '21',
      timeIndex: 4,
      question: '只回答我这个具体问题。',
      promptMode: 'custom',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.match(body.data.prompt, /【问题】/);
  assert.match(body.data.prompt, /只回答我这个具体问题/);
  assert.match(body.data.prompt, /分析主题：自由聊天/);
  assert.doesNotMatch(body.data.prompt, /【分析思路】/);
  assert.doesNotMatch(body.data.prompt, /【任务】/);
  assert.doesNotMatch(body.data.prompt, /【输出要求】/);
});

test('公开 API 不再保留旧的占卜提示词接口', async () => {
  const { response, body } = await callApi('divination/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method: 'tarot', question: '我近期事业应该注意什么？', data: {} }),
  });

  assert.equal(response.status, 404);
  assert.equal(body.ok, false);
  assert.equal(body.error.code, 'NOT_FOUND');
});

test('公开 API 单牌塔罗接口应返回结构化牌面', async () => {
  const { response, body } = await callApi('divination/tarot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spreadType: 'single' }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.spreadType, 'single');
  assert.equal(body.data.cards.length, 1);
  assert.equal(typeof body.data.cards[0].name, 'string');
});

test('公开 API 奇门默认转盘，可通过 qimenMethod 请求飞盘', async () => {
  const customDate = '2025-01-01T08:00:00+08:00';
  const zhuanpanStars = generateQimen(new Date(customDate), 'zhuanpan').jiuGongGe.map(
    (gong) => gong.tianPan.star,
  );
  const feipanStars = generateQimen(new Date(customDate), 'feipan').jiuGongGe.map(
    (gong) => gong.tianPan.star,
  );

  const defaultResult = await callApi('divination/qimen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customDate }),
  });
  assert.equal(defaultResult.response.status, 200);
  assert.equal(defaultResult.body.ok, true);
  assert.deepEqual(
    defaultResult.body.data.jiuGongGe.map((gong: { tianPan: { star: string } }) => gong.tianPan.star),
    zhuanpanStars,
  );

  const feipanResult = await callApi('divination/qimen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customDate, qimenMethod: 'feipan' }),
  });
  assert.equal(feipanResult.response.status, 200);
  assert.equal(feipanResult.body.ok, true);
  assert.deepEqual(
    feipanResult.body.data.jiuGongGe.map((gong: { tianPan: { star: string } }) => gong.tianPan.star),
    feipanStars,
  );
  assert.notDeepEqual(feipanStars, zhuanpanStars);

  const feipanPrompt = await callApi('divination/qimen/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customDate,
      qimenMethod: 'feipan',
      question: '我近期事业应该注意什么？',
    }),
  });
  assert.equal(feipanPrompt.response.status, 200);
  assert.equal(feipanPrompt.body.ok, true);
  assert.deepEqual(
    feipanPrompt.body.data.result.jiuGongGe.map(
      (gong: { tianPan: { star: string } }) => gong.tianPan.star,
    ),
    feipanStars,
  );
});

test('公开 API 奇门 qimenMethod 非法值应返回参数错误', async () => {
  const { response, body } = await callApi('divination/qimen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customDate: '2025-01-01T08:00:00+08:00',
      qimenMethod: 'unknown',
    }),
  });

  assert.equal(response.status, 400);
  assert.equal(body.ok, false);
  assert.equal(body.error.code, 'BAD_REQUEST');
  assert.match(body.error.message, /qimenMethod 必须是以下值之一/);
});

test('公开 API 可选请求体接口无请求体时仍应使用默认参数', async () => {
  const { response, body } = await callApi('divination/tarot', {
    method: 'POST',
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.spreadType, 'single');
  assert.equal(body.data.cards.length, 1);
});

test('公开 API 可选请求体接口只有 JSON 请求头但无请求体时仍应使用默认参数', async () => {
  const { response, body } = await callApi('divination/tarot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.spreadType, 'single');
  assert.equal(body.data.cards.length, 1);
});

test('公开 API 可选请求体接口收到空字符串请求体时仍应使用默认参数', async () => {
  const { response, body } = await callApi('divination/tarot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '',
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.spreadType, 'single');
  assert.equal(body.data.cards.length, 1);
});

test('公开 API 可选请求体接口收到非法 JSON 时应返回参数错误', async () => {
  const { response, body } = await callApi('divination/tarot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{bad',
  });

  assert.equal(response.status, 400);
  assert.equal(body.ok, false);
  assert.equal(body.error.code, 'BAD_REQUEST');
  assert.match(body.error.message, /合法 JSON/);
});

test('公开 API customDate 不应接受非 ISO 或会被 JS 自动进位的无效日期', async () => {
  const paths = [
    'divination/liuyao',
    'divination/meihua',
    'divination/xiaoliuren',
    'divination/qimen',
    'divination/liuren',
  ];
  const invalidValues = [
    'May 1 2025 08:00:00',
    '2025-01-01T08:00:00',
    '2025-02-30T08:00:00+08:00',
    '2025-01-01T24:00:00+00:00',
  ];

  for (const path of paths) {
    for (const customDate of invalidValues) {
      const { response, body } = await callApi(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customDate }),
      });

      assert.equal(response.status, 400, `${path} 应拒绝无效日期 ${customDate}`);
      assert.equal(body.ok, false);
      assert.equal(body.error.code, 'BAD_REQUEST');
      assert.equal(body.error.message, 'customDate 不是有效时间。');
    }
  }
});

test('公开 API 黄历择日、小六壬、雷诺曼和星盘接口应返回结构化结果', async () => {
  const almanac = await callApi('divination/almanac', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic: 'move',
      startDate: '2026-06-01',
      endDate: '2026-06-05',
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
    }),
  });
  assert.equal(almanac.response.status, 200);
  assert.equal(almanac.body.ok, true);
  assert.equal(almanac.body.data.topic, 'move');
  assert.equal(almanac.body.data.days.length, 5);
  assert.equal(almanac.body.data.participants.length, 1);

  const xiaoliuren = await callApi('divination/xiaoliuren', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ xiaoliurenMethod: 'number', xiaoliurenNumber: 18 }),
  });
  assert.equal(xiaoliuren.response.status, 200);
  assert.equal(xiaoliuren.body.ok, true);
  assert.equal(xiaoliuren.body.data.method, 'number');
  assert.equal(xiaoliuren.body.data.sequence.result.name.length > 0, true);

  const lenormand = await callApi('divination/lenormand', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spreadType: 'relationship' }),
  });
  assert.equal(lenormand.response.status, 200);
  assert.equal(lenormand.body.ok, true);
  assert.equal(lenormand.body.data.spreadType, 'relationship');
  assert.ok(lenormand.body.data.cards.length >= 5);

  const astrolabe = await callApi('divination/astrolabe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
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
    }),
  });
  assert.equal(astrolabe.response.status, 200);
  assert.equal(astrolabe.body.ok, true);
  assert.ok(astrolabe.body.data.planets.length >= 10);
  assert.ok(astrolabe.body.data.aspects.length >= 1);
  assert.match(astrolabe.body.data.birth.location, /北京/);
});

test('公开 API 数字起卦起课应拒绝超出安全整数范围的数字', async () => {
  const unsafeInteger = Number.MAX_SAFE_INTEGER + 1;
  const cases: Array<[string, Record<string, unknown>, string]> = [
    ['divination/meihua', { method: 'number', number: unsafeInteger }, 'number 必须是整数。'],
    [
      'divination/xiaoliuren',
      { xiaoliurenMethod: 'number', xiaoliurenNumber: unsafeInteger },
      'xiaoliurenNumber 必须是整数。',
    ],
  ];

  for (const [path, body, message] of cases) {
    const result = await callApi(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    assert.equal(result.response.status, 400);
    assert.equal(result.body.ok, false);
    assert.equal(result.body.error.message, message);
  }
});

test('公开 API 星盘应支持真太阳时校正', async () => {
  const corrected = calculateTrueSolarTime(
    {
      year: 1995,
      month: 5,
      day: 20,
      hour: 1,
      minute: 20,
    },
    73.5,
  ).correctedTime;
  const { response, body } = await callApi('divination/astrolabe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
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
      locationName: '喀什',
      useTrueSolarTime: true,
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.birth.isTrueSolarTime, true);
  assert.equal(
    body.data.birth.trueSolarDateTime,
    `${corrected.year}-${String(corrected.month).padStart(2, '0')}-${String(corrected.day).padStart(2, '0')} ${String(corrected.hour).padStart(2, '0')}:${String(corrected.minute).padStart(2, '0')}`,
  );
});

test('公开 API 各占卜提示词接口应一次返回占卜结果、摘要和提示词', async () => {
  for (const [method, payload] of divinationPromptCases) {
    const { response, body } = await callApi(`divination/${method}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        question: '我近期事业应该注意什么？',
      }),
    });

    assert.equal(response.status, 200, `${method} prompt 接口应返回 200`);
    assert.equal(body.ok, true, `${method} prompt 接口应成功`);
    assert.ok(body.data.result, `${method} prompt 接口应返回 result`);
    assert.ok(body.data.summary, `${method} prompt 接口应返回 summary`);
    assert.equal(typeof body.data.summary.title, 'string', `${method} summary 应有标题`);
    assert.ok(Array.isArray(body.data.summary.tags), `${method} summary 应有标签数组`);
    assert.ok(Array.isArray(body.data.summary.lines), `${method} summary 应有摘要行数组`);
    assert.match(
      body.data.prompt,
      method === 'liuren' ? /【排盘信息】/ : /【占卜信息】/,
      `${method} prompt 应包含排盘或占卜信息`,
    );
    assert.match(
      body.data.prompt,
      method === 'almanac' ? /择日补充：我近期事业应该注意什么/ : /我近期事业应该注意什么/,
      `${method} prompt 应包含问题或择日补充`,
    );
  }
});

test('公开 API 黄历择日提示词不强制填写问题', async () => {
  const { response, body } = await callApi('divination/almanac/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic: 'contract',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.match(body.data.prompt, /【占卜信息】/);
  assert.match(body.data.prompt, /【任务】/);
  assert.doesNotMatch(body.data.prompt, /【问题】/);
  assert.match(body.data.prompt, /先直接给出首选日期、备选日期与慎用日期/);
  assert.doesNotMatch(body.data.prompt, /先直接回答【问题】/);
});

test('公开 API 占卜自定义提示词不强塞任务和输出要求', async () => {
  const { response, body } = await callApi('divination/meihua/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'number',
      number: 42,
      question: '只看这件具体事。',
      promptMode: 'custom',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.match(body.data.prompt, /【占卜信息】/);
  assert.match(body.data.prompt, /只看这件具体事/);
  assert.doesNotMatch(body.data.prompt, /【任务】/);
  assert.doesNotMatch(body.data.prompt, /【输出要求】/);
});

test('公开 API 六爻与大六壬提示词接口应区分专项模板字段', async () => {
  const liuyao = await callApi('divination/liuyao/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customDate: '2025-01-01T08:00:00+08:00',
      question: '最近家里总觉得不安，这是不是鬼神怪异或冲犯？',
      liuyaoTemplate: 'guaishen',
    }),
  });

  assert.equal(liuyao.response.status, 200);
  assert.equal(liuyao.body.ok, true);
  assert.match(liuyao.body.data.prompt, /【断卦要点】/);
  assert.match(liuyao.body.data.prompt, /断卦类型：鬼神怪异/);

  const liuren = await callApi('divination/liuren/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customDate: '2025-01-01T08:00:00+08:00',
      question: '我现在要不要换工作？',
      liurenTemplate: 'shiye',
    }),
  });

  assert.equal(liuren.response.status, 200);
  assert.equal(liuren.body.ok, true);
  assert.match(liuren.body.data.prompt, /【分析思路】/);
  assert.match(liuren.body.data.prompt, /分析类型：事业断课/);
});

test('公开 API 参数错误应返回统一错误结构', async () => {
  const { response, body } = await callApi('bazi/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gender: 'male' }),
  });

  assert.equal(response.status, 400);
  assert.equal(body.ok, false);
  assert.equal(body.error.code, 'BAD_REQUEST');
  assert.match(body.error.message, /year/);
});

test('公开 API 梅花外应参数错误应返回 400 而不是内部错误', async () => {
  for (const payload of [
    { method: 'external' },
    { method: 'external', externalOmens: { direction: '南', count: 3 } },
    { method: 'external', externalOmens: { direction: '无效方位', object: '火电文书', count: 3 } },
  ]) {
    const { response, body } = await callApi('divination/meihua', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(response.status, 400, JSON.stringify(payload));
    assert.equal(body.ok, false);
    assert.equal(body.error.code, 'BAD_REQUEST');
    assert.doesNotMatch(body.error.message, /内部错误/);
  }
});

test('公开 API 黄历日期参数错误应返回 400 而不是内部错误', async () => {
  for (const payload of [
    { topic: 'move', startDate: '2026/06/01', endDate: '2026-06-05' },
    { topic: 'move', startDate: '2026-06-31', endDate: '2026-07-02' },
    { topic: 'move', startDate: '0000-01-01', endDate: '0000-01-02' },
    { topic: 'move', startDate: '9999-01-01', endDate: '9999-01-02' },
    { topic: 'move', startDate: '2026-06-05', endDate: '2026-06-01' },
    { topic: 'move', startDate: '2026-06-01', endDate: '2026-07-10' },
  ]) {
    const { response, body } = await callApi('divination/almanac', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(response.status, 400, JSON.stringify(payload));
    assert.equal(body.ok, false);
    assert.equal(body.error.code, 'BAD_REQUEST');
    assert.doesNotMatch(body.error.message, /内部错误/);
  }
});

test('公开 API 未知异常不应向调用方暴露内部错误细节', async () => {
  const originalCalculateBazi = baziCalculator.calculateBazi.bind(baziCalculator);
  const originalConsoleError = console.error;
  const errorLogs: unknown[][] = [];
  baziCalculator.calculateBazi = () => {
    throw new Error('internal stack detail');
  };
  console.error = (...args: unknown[]) => {
    errorLogs.push(args);
  };

  try {
    const { response, body } = await callApi('bazi/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gender: 'male',
        year: 1990,
        month: 1,
        day: 1,
        timeIndex: 0,
        dateType: 'solar',
      }),
    });

    assert.equal(response.status, 500);
    assert.equal(body.ok, false);
    assert.equal(body.error.code, 'INTERNAL_ERROR');
    assert.equal(body.error.message, '服务内部错误。');
    assert.doesNotMatch(body.error.message, /internal stack detail/i);
    assert.equal(errorLogs.length, 1);
  } finally {
    baziCalculator.calculateBazi = originalCalculateBazi;
    console.error = originalConsoleError;
  }
});
