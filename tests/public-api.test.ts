import test from 'node:test';
import assert from 'node:assert/strict';
import { handlePublicApiRequest, isPublicApiRequestPath } from '../src/lib/public-api/handler';
import { onRequest as handleWellKnownApiRequest } from '../functions/.well-known/[[path]]';
import { buildZiweiChartInput, calculateFullZiweiChart } from '../src/lib/full-chart-engine/ziwei';
import {
  buildBaziZiweiPromptForResults,
  buildBaziPromptForResult,
  buildZiweiPromptForRuntime,
  type BaziPromptTopic,
} from '../src/lib/public-api/prompt-builders';
import { baziCalculator } from '@core/bazi/baziCalculator';
import { calculateTrueSolarTime } from '@core/bazi/trueSolarTime';
import { getTimeIndexFromClock } from 'mingyu-core/calendar';
import { generateQimen } from 'mingyu-core/divination/qimen';
import { assertPromptIsPortableTaskText } from './prompt-assertions';

async function callApi(path: string, init?: RequestInit) {
  const request = new Request(`https://aov.cc/api/v1/${path}`, init);
  const response = await handlePublicApiRequest(request);
  const text = await response.text();
  return {
    response,
    body: text ? JSON.parse(text) : null,
  };
}

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

test('公开 API 基础路径本身应返回健康检查', async () => {
  const request = new Request('https://example.pages.dev/api/v1');
  const response = await handlePublicApiRequest(request);
  const body = await response.json();

  assert.equal(isPublicApiRequestPath('/api/v1'), true);
  assert.equal(isPublicApiRequestPath('/api/v1/manifest'), true);
  assert.equal(isPublicApiRequestPath('/api/v10'), false);
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.status, 'ok');
  assert.equal(body.meta.service, 'example.pages.dev');
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
  assert.ok(body.data.endpoints.includes('POST /api/v1/bazi/compatibility'));
  assert.ok(body.data.endpoints.includes('POST /api/v1/bazi/compatibility/prompt'));
  assert.ok(body.data.endpoints.includes('POST /api/v1/ziwei/compatibility'));
  assert.ok(body.data.endpoints.includes('POST /api/v1/ziwei/compatibility/prompt'));
  assert.ok(body.data.endpoints.includes('GET /api/v1/foundation/capabilities'));
  assert.ok(body.data.endpoints.includes('POST /api/v1/calendar/true-solar-time'));
  assert.ok(body.data.endpoints.includes('POST /api/v1/calendar/true-solar-birth'));
  assert.ok(body.data.endpoints.includes('POST /api/v1/foundation/ganzhi'));
  assert.ok(body.data.endpoints.includes('POST /api/v1/foundation/wuxing'));
  assert.ok(body.data.endpoints.includes('POST /api/v1/bazi-ziwei/prompt'));
  assert.ok(body.data.endpoints.includes('POST /api/v1/divination/almanac'));
  assert.ok(body.data.endpoints.includes('POST /api/v1/divination/xiaoliuren/prompt'));
  assert.ok(body.data.endpoints.includes('POST /api/v1/divination/lenormand/prompt'));
  assert.ok(body.data.endpoints.includes('POST /api/v1/divination/astrolabe/prompt'));
  assert.ok(body.data.endpoints.includes('POST /api/v1/ai/analyze'));
  assert.ok(body.data.endpoints.includes('POST /api/v1/ai/models'));
  assert.ok(body.data.endpoints.includes('GET /.well-known/aov-mingyu-api.json'));
});

test('公开 API 八字双盘应返回交叉证据与完整提示词', async () => {
  const person1 = {
    gender: 'female',
    year: 1988,
    month: 1,
    day: 1,
    timeIndex: 0,
    dateType: 'solar',
  };
  const person2 = {
    gender: 'male',
    year: 1990,
    month: 6,
    day: 15,
    timeIndex: 5,
    dateType: 'solar',
  };
  const calculation = await callApi('bazi/compatibility', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ person1, person2, person1Name: '甲方', person2Name: '乙方' }),
  });

  assert.equal(calculation.response.status, 200);
  assert.equal(calculation.body.data.compatibility.people.person1, '甲方');
  assert.ok(calculation.body.data.compatibility.tenGodMappings.length === 8);
  assert.match(calculation.body.data.compatibility.promptText, /【八字双盘结构化证据】/);

  const prompted = await callApi('bazi/compatibility/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      person1,
      person2,
      question: '请分析双方是否适合长期合作。',
      compatType: 'career',
      person1Name: '甲方',
      person2Name: '乙方',
      responseMode: 'full',
    }),
  });

  assert.equal(prompted.response.status, 200);
  assert.match(prompted.body.data.prompt, /【角色与总则】/);
  assert.match(prompted.body.data.prompt, /【八字双盘结构化证据】/);
  assert.match(prompted.body.data.prompt, /请分析双方是否适合长期合作/);
  assert.match(prompted.body.data.prompt, /甲方.*乙方/);
  assertPromptIsPortableTaskText(prompted.body.data.prompt);
});

test('公开 API 元数据应跟随当前访问域名', async () => {
  const request = new Request('https://example.pages.dev/api/v1/manifest');
  const response = await handlePublicApiRequest(request);
  const body = (await response.json()) as {
    ok: boolean;
    meta: { service: string };
    data: { service: string; baseUrl: string; openapiUrl: string; skillUrl: string };
  };

  assert.equal(body.ok, true);
  assert.equal(body.meta.service, 'example.pages.dev');
  assert.equal(body.data.service, 'example.pages.dev');
  assert.equal(body.data.baseUrl, 'https://example.pages.dev/api/v1');
  assert.equal(body.data.openapiUrl, 'https://example.pages.dev/api/v1/openapi.json');
  assert.equal(body.data.skillUrl, 'https://example.pages.dev/skills/aov-mingyu-api/SKILL.md');
});

test('公开 API well-known 元数据应跟随当前访问域名', async () => {
  const response = await handleWellKnownApiRequest({
    request: new Request('https://example.pages.dev/.well-known/aov-mingyu-api.json'),
    params: { path: 'aov-mingyu-api.json' },
  });
  const body = (await response.json()) as {
    service: string;
    baseUrl: string;
    openapiUrl: string;
    skillUrl: string;
    endpoints: string[];
  };

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(body.service, 'example.pages.dev');
  assert.equal(body.baseUrl, 'https://example.pages.dev/api/v1');
  assert.equal(body.openapiUrl, 'https://example.pages.dev/api/v1/openapi.json');
  assert.equal(body.skillUrl, 'https://example.pages.dev/skills/aov-mingyu-api/SKILL.md');
  assert.ok(body.endpoints.includes('POST /api/v1/bazi-ziwei/prompt'));
  assert.ok(body.endpoints.includes('POST /api/v1/ai/analyze'));
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
  assert.ok(body.data.paths['/bazi-ziwei/prompt']);
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
  const spreadTypeSchema =
    body.data.components.schemas.DivinationPromptRequest.properties.spreadType;
  for (const spreadType of ['five', 'element', 'grandTableau', 'nine']) {
    assert.ok(spreadTypeSchema.enum.includes(spreadType), `spreadType 应包含 ${spreadType}`);
  }
  assert.match(spreadTypeSchema.description, /grandTableau/);
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
  assert.equal(divinationRequestProperties.responseMode.enum.includes('full'), true);
  assert.equal(divinationRequestProperties.responseMode.enum.includes('summary'), true);
  assert.equal(divinationRequestProperties.detailMode.enum.includes('compact'), true);
  assert.equal(divinationRequestProperties.page.minimum, 1);
  assert.equal(divinationRequestProperties.pageSize.maximum, 31);
  assert.equal(divinationRequestProperties.participants.items.type, 'object');
  assert.equal(divinationRequestProperties.participants.maxItems, 30);
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
    'family',
    'social',
    'health',
    'recent',
    'job-change',
    'startup-partnership',
    'relationship-decision',
    'children',
    'home-move',
    'study',
    'study-advance',
    'investment-partnership',
    'reconciliation-decision',
    'settle-relocate',
    'exam-landing',
  ]) {
    assert.match(ziweiTopicSchema, new RegExp(topic), `紫微 promptTopic 应包含 ${topic}`);
  }
  const baziTopicSchema = JSON.stringify(
    body.data.components.schemas.BaziPromptRequest.allOf[1].properties.promptTopic,
  );
  for (const topic of [
    'recent',
    'talent',
    'relationship-push',
    'startup-partnership',
    'relationship-decision',
    'home-move',
    'study-advance',
    'investment-partnership',
    'reconciliation-decision',
    'settle-relocate',
    'exam-landing',
  ]) {
    assert.match(baziTopicSchema, new RegExp(topic), `八字 promptTopic 应包含 ${topic}`);
  }
  assert.ok(body.data.components.schemas.ZiweiRequest.properties.promptScope);
  assert.ok(body.data.components.schemas.BaziZiweiPromptRequest);
  assert.deepEqual(
    body.data.components.schemas.BaziZiweiPromptRequest.allOf[1].properties.baziPromptTopic.enum,
    body.data.components.schemas.BaziPromptRequest.allOf[1].properties.promptTopic.enum,
  );
  assert.deepEqual(
    body.data.components.schemas.BaziZiweiPromptRequest.allOf[1].properties.ziweiPromptTopic.enum,
    body.data.components.schemas.ZiweiPromptRequest.allOf[1].properties.promptTopic.enum,
  );
  assert.match(
    body.data.components.schemas.ZiweiRequest.properties.promptScope.description,
    /full 会返回本命、大限、流年、流月、流日、流时/,
  );
  assert.equal(
    body.data.components.schemas.BaziRequest.properties.shenShaVariants.$ref,
    '#/components/schemas/ShenShaVariants',
  );
  assert.match(body.data.components.schemas.ShenShaVariants.description, /默认主流口径/);
  assert.deepEqual(body.data.components.schemas.ShenShaVariants.properties.kongWangBasis.enum, [
    'day',
    'day-and-year',
  ]);
});

test('公开 API 应提供便捷真太阳时换算接口', async () => {
  const { response, body } = await callApi('calendar/true-solar-time', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      localDateTime: '1990-05-15T10:30:20',
      longitude: '116.4074',
    }),
  });
  assert.equal(response.status, 200);
  assert.equal(body.data.standardDateTime, '1990-05-15T10:30:20');
  assert.equal(body.data.timezone, 8);
  assert.equal(body.data.standardMeridian, 120);
  assert.equal(body.data.shichen.name, '巳时');
  assert.equal(typeof body.data.totalCorrectionMinutes, 'number');

  const chinaDst = await callApi('calendar/true-solar-time', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      localDateTime: '1988-07-15T12:00',
      longitude: 116.4074,
      applyChinaDst: true,
    }),
  });
  assert.equal(chinaDst.response.status, 200);
  assert.equal(chinaDst.body.data.standardDateTime, '1988-07-15T11:00:00');
  assert.equal(chinaDst.body.data.chinaDst.applied, true);

  for (const payload of [
    { localDateTime: '1990-05-15T10:30:20+08:00', longitude: 116.4074 },
    { localDateTime: '1990-02-30T10:30', longitude: 116.4074 },
    { localDateTime: '1990-05-15T10:30', longitude: 181 },
    { localDateTime: '1990-05-15T10:30', longitude: 116.4074, timezone: 15 },
    { localDateTime: '1990-05-15T10:30', longitude: 116.4074, applyChinaDst: 'yes' },
  ]) {
    const invalid = await callApi('calendar/true-solar-time', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(invalid.response.status, 400);
  }
});

test('公开 API 应提供统一公历农历出生真太阳时接口', async () => {
  const { response, body } = await callApi('calendar/true-solar-birth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dateType: 'lunar',
      year: 1990,
      month: 5,
      day: 23,
      hour: 12,
      minute: 0,
      longitude: 116.4074,
      timezone: 8,
    }),
  });
  assert.equal(response.status, 200);
  assert.equal(body.data.inputDateType, 'lunar');
  assert.match(body.data.solarClockDateTime, /^1990-\d{2}-\d{2}T12:00:00$/);
  assert.equal(typeof body.data.timeIndex, 'number');
  assert.equal(typeof body.data.correctedDateTime, 'string');
});

test('公开 API 应提供公共地基能力、六十甲子与五行接口', async () => {
  const capabilities = await callApi('foundation/capabilities');
  assert.equal(capabilities.response.status, 200);
  assert.equal(capabilities.body.data.constants.sixtyCycle.length, 60);
  assert.equal(capabilities.body.data.constants.sixtyCycle[0], '甲子');
  assert.deepEqual(capabilities.body.data.constants.sixXunHeads, [
    '甲子',
    '甲戌',
    '甲申',
    '甲午',
    '甲辰',
    '甲寅',
  ]);
  assert.equal(capabilities.body.data.constants.shichenPeriods.length, 13);

  const ganZhi = await callApi('foundation/ganzhi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ganZhi: '甲子' }),
  });
  assert.equal(ganZhi.response.status, 200);
  assert.equal(ganZhi.body.data.nayin, '海中金');
  assert.equal(ganZhi.body.data.branch.clash, '午');

  const wuxing = await callApi('foundation/wuxing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: ['甲', '子', '丙', '午'], weightHidden: true }),
  });
  assert.equal(wuxing.response.status, 200);
  assert.equal(wuxing.body.data.weightHidden, true);
  assert.ok(wuxing.body.data.counts.火 > 0);

  for (const payload of [{ ganZhi: '甲丑' }, { ganZhi: '' }]) {
    const invalid = await callApi('foundation/ganzhi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(invalid.response.status, 400);
  }

  const invalidWuxing = await callApi('foundation/wuxing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: ['甲子'] }),
  });
  assert.equal(invalidWuxing.response.status, 400);
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

test('公开 API 八字排盘支持轻量模式，避免默认拉取大流年明细', async () => {
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
      detailMode: 'compact',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.gender, 'female');
  assert.equal(body.data.liunian, undefined);
  assert.ok(body.data.luckInfo.cycles.length > 0);
  assert.equal(body.data.luckInfo.cycles[0].years, undefined);
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

test('公开 API 八字提示词接口默认返回轻量摘要和提示词', async () => {
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
  assert.equal(body.data.result, undefined);
  assert.equal(body.data.resultSummary.gender, 'male');
  assert.equal(body.data.resultSummary.liunian, undefined);
  const prompt = body.data.prompt;
  assert.match(prompt, /【排盘信息】/);
  assert.match(prompt, /我适合创业还是上班/);
  assertPromptIsPortableTaskText(prompt);
});

test('公开 API 八字提示词接口可显式请求完整排盘', async () => {
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
      responseMode: 'full',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.result.gender, 'male');
  assert.ok(Array.isArray(body.data.result.liunian));
  assert.match(body.data.prompt, /我适合创业还是上班/);
});

test('公开 API 提示词接口支持只返回提示词，避免下游重复传大排盘', async () => {
  const bazi = await callApi('bazi/prompt', {
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
      responseMode: 'prompt-only',
    }),
  });

  assert.equal(bazi.response.status, 200);
  assert.equal(bazi.body.ok, true);
  assert.deepEqual(Object.keys(bazi.body.data).sort(), ['prompt']);
  assert.match(bazi.body.data.prompt, /【排盘信息】/);

  const qimen = await callApi('divination/qimen/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customDate: '2025-01-01T08:30:00+08:00',
      question: '这个项目现在适合推进吗？',
      responseMode: 'prompt-only',
    }),
  });

  assert.equal(qimen.response.status, 200);
  assert.equal(qimen.body.ok, true);
  assert.deepEqual(Object.keys(qimen.body.data).sort(), ['prompt']);
  assert.match(qimen.body.data.prompt, /【占卜信息】/);
});

test('公开 API 应支持八字紫微合参提示词', async () => {
  const { response, body } = await callApi('bazi-ziwei/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: '测试',
      gender: 'female',
      year: 1992,
      month: 8,
      day: 21,
      timeIndex: 4,
      dateType: 'solar',
      question: '我现在适合换工作还是继续等待？',
      baziPromptTopic: 'job-change',
      ziweiPromptTopic: 'job-change',
      promptScope: 'yearly',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.result, undefined);
  assert.equal(body.data.resultSummary.bazi.gender, 'female');
  assert.equal(body.data.resultSummary.ziwei.scopeNames.includes('yearly'), true);
  assert.match(body.data.prompt, /【八字排盘信息】/);
  assert.match(body.data.prompt, /【紫微盘面信息】/);
  assert.match(body.data.prompt, /【任务】/);
  assert.match(body.data.prompt, /结论总览/);
  assert.match(body.data.prompt, /八字主线/);
  assert.match(body.data.prompt, /紫微校验/);
  assert.match(body.data.prompt, /应期触发/);
  assert.match(body.data.prompt, /我现在适合换工作还是继续等待/);
  assertPromptIsPortableTaskText(body.data.prompt);
});

test('八字紫微合参提示词自定义模式不额外拼接任务框架', async () => {
  const person = {
    gender: 'male' as const,
    year: 1990,
    month: 5,
    day: 15,
    timeIndex: 1,
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  };
  const baziResult = baziCalculator.calculateBazi(person);
  const ziweiResult = await calculateFullZiweiChart(
    buildZiweiChartInput({
      name: '测试',
      gender: 'male',
      dateType: 'solar',
      year: '1990',
      month: '5',
      day: '15',
      timeIndex: 1,
      isLeapMonth: false,
      useTrueSolarTime: false,
    }),
  );

  const prompt = buildBaziZiweiPromptForResults({
    baziResult,
    ziweiResult,
    question: '只看今年是否适合跳槽。',
    baziTopic: 'job-change',
    ziweiTopic: 'job-change',
    ziweiScope: 'yearly',
    mode: 'custom',
  });

  assert.match(prompt, /【八字排盘信息】/);
  assert.match(prompt, /【紫微盘面信息】/);
  assert.match(prompt, /【问题】\n只看今年是否适合跳槽。/);
  assert.doesNotMatch(prompt, /【任务】/);
  assert.doesNotMatch(prompt, /【输出要求】/);
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

test('八字公开 API prompt builder 空问题走通用问题，不复用本地固定任务', () => {
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

  assert.match(prompt, /【问题】\n请先做整体解读。/);
  assert.match(
    prompt,
    /【任务】\n主题范围：事业。请围绕【问题】和该主题范围直接判断重点；若【问题】未限定具体事项，按通用八字口径先做整体分析，再结合该主题提示重点。/,
  );
  assert.doesNotMatch(prompt, /【问题】\n判断命局更适合守成/);
  assert.doesNotMatch(prompt, /【任务】\n判断命局更适合守成/);
});

test('八字公开 API 不同主题只切换范围，空问题仍使用通用任务', () => {
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

  const cases: BaziPromptTopic[] = [
    'recent',
    'job-change',
    'startup-partnership',
    'relationship-decision',
    'home-move',
    'study-advance',
    'investment-partnership',
    'reconciliation-decision',
    'settle-relocate',
    'exam-landing',
  ];

  for (const topic of cases) {
    const prompt = buildBaziPromptForResult({ result, question: '', topic });
    assert.match(prompt, /【问题】\n请先做整体解读。/, `${topic} 应使用通用默认问题`);
    assert.match(
      prompt,
      /【任务】\n主题范围：[^。]+。请围绕【问题】和该主题范围直接判断重点；若【问题】未限定具体事项，按通用八字口径先做整体分析，再结合该主题提示重点。/,
      `${topic} 应只把主题作为范围`,
    );
  }
});

test('八字公开 API 提示词支持完整输出版命限范围', () => {
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
    question: '整体事业阶段怎么判断？',
    topic: 'career',
    fortuneScope: 'full',
  });

  assert.match(prompt, /【分析对象】\n分析对象：本命盘与完整大运流年/);
  assert.match(prompt, /【命限资料】/);
  assert.match(prompt, /完整大运流年：/);
  assert.doesNotMatch(prompt, /详细命限资料|资料量|聚焦当前分析对象/);
});

test('公开 API 八字年限提示词返回逐层岁运触发结构化证据', async () => {
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
      question: '这一年的事业触发有哪些？',
      promptTopic: 'career',
      baziFortuneScope: 'year',
      baziFortuneCycleIndex: 1,
    }),
  });

  assert.equal(response.status, 200);
  const triggerEvidence = body.data.resultSummary.fortuneSelection.promptPayload.triggerEvidence;
  assert.ok(triggerEvidence.layers.some((item: { type: string }) => item.type === 'dayun'));
  assert.ok(triggerEvidence.layers.some((item: { type: string }) => item.type === 'year'));
  assert.ok(triggerEvidence.relations.length > 0);
  assert.match(body.data.prompt, /【八字岁运触发结构化证据】/);
  assert.match(body.data.prompt, /岁运触发解释边界/);
});

test('公开 API 返回八字出生时间敏感性候选盘与提示词证据', async () => {
  const input = {
    gender: 'male',
    year: 1990,
    month: 5,
    day: 15,
    dateType: 'solar',
    useTrueSolarTime: true,
    birthHour: 4,
    birthMinute: 0,
    birthLongitude: 120,
    birthTimeUncertaintyMinutes: 5,
  };
  const sensitivityResponse = await callApi('bazi/time-sensitivity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  assert.equal(sensitivityResponse.response.status, 200);
  assert.equal(sensitivityResponse.body.data.samples.length, 3);
  assert.ok(sensitivityResponse.body.data.changedPillars.includes('hour'));

  const promptResponse = await callApi('bazi/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, question: '出生时间误差会影响哪些结论？' }),
  });
  assert.equal(promptResponse.response.status, 200);
  assert.ok(promptResponse.body.data.resultSummary.timeSensitivity.isSensitive);
  assert.match(promptResponse.body.data.prompt, /【八字出生时间敏感性结构化证据】/);
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

test('公开 API 紫微提示词接口默认返回轻量摘要和提示词', async () => {
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
  assert.equal(body.data.result, undefined);
  assert.deepEqual(body.data.resultSummary.scopeNames, ['origin']);
  assert.equal(body.data.resultSummary.activeScopes.origin.active_scope.scope, 'origin');
  const prompt = body.data.prompt;
  assert.match(prompt, /【问题】/);
  assert.match(prompt, /我的感情关系要注意什么/);
  assertPromptIsPortableTaskText(prompt);
});

test('公开 API 紫微双盘返回宫位叠盘、四化证据并保留双方称呼', async () => {
  const person1 = {
    name: '甲方',
    gender: 'female',
    dateType: 'solar',
    year: '1992',
    month: '8',
    day: '21',
    timeIndex: 4,
  };
  const person2 = {
    name: '乙方',
    gender: 'male',
    dateType: 'solar',
    year: '1990',
    month: '5',
    day: '15',
    timeIndex: 1,
  };
  const calculation = await callApi('ziwei/compatibility', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ person1, person2 }),
  });

  assert.equal(calculation.response.status, 200);
  assert.deepEqual(calculation.body.data.compatibility.people, {
    person1: '甲方',
    person2: '乙方',
  });
  assert.ok(calculation.body.data.compatibility.palaceOverlays.length > 0);
  assert.ok(calculation.body.data.compatibility.evidence.items.length > 0);
  assert.equal(calculation.body.data.charts.person1.scopeNames[0], 'origin');

  const prompted = await callApi('ziwei/compatibility/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      person1,
      person2,
      question: '双方长期合作关系应注意什么？',
      promptTopic: 'career-wealth',
    }),
  });

  assert.equal(prompted.response.status, 200);
  assert.equal(prompted.body.data.result, undefined);
  assert.equal(prompted.body.data.resultSummary.people.person1, '甲方');
  assert.match(prompted.body.data.prompt, /【甲方盘面】/);
  assert.match(prompted.body.data.prompt, /【紫微双盘结构化证据】/);
  assert.match(prompted.body.data.prompt, /双方长期合作关系应注意什么/);
  assert.doesNotMatch(prompted.body.data.prompt, /匹配总分：/);
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
  assert.deepEqual(body.data.resultSummary.scopeNames, ['origin', 'yearly']);
  assert.equal(body.data.resultSummary.activeScopes.yearly.active_scope.scope, 'yearly');
  assert.equal(body.data.resultSummary.activeScopes.decadal, undefined);
  const prompt = body.data.prompt;
  assert.match(prompt, /分析范围：流年/);
  assert.match(prompt, /【任务】/);
  assertPromptIsPortableTaskText(prompt);
});

test('公开 API 紫微提示词支持完整输出版范围', async () => {
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
      question: '整体人生和近期重点怎么看？',
      promptTopic: 'life',
      promptScope: 'full',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.deepEqual(body.data.resultSummary.scopeNames, [
    'origin',
    'decadal',
    'yearly',
    'monthly',
    'daily',
    'hourly',
  ]);
  assert.match(body.data.prompt, /分析范围：完整输出/);
  assert.match(body.data.prompt, /【完整运限资料】/);
  assert.match(body.data.prompt, /完整紫微运限资料：/);
  assert.match(body.data.prompt, /流时：分析对象：/);
  assertPromptIsPortableTaskText(body.data.prompt);
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

test('紫微公开 API prompt builder 空问题走通用问题，主题只作为范围', async () => {
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

  assert.match(prompt, /分析主题：事业财运/);
  assert.match(prompt, /【问题】\n请先做整体解读。/);
  assert.match(prompt, /若【问题】已限定主题，只把主题作为回答范围，不额外套用固定题目/);
});

test('紫微公开 API 工作变动主题只切换范围，不补固定问题', async () => {
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
  assert.match(prompt, /【问题】\n请先做整体解读。/);
  assert.match(prompt, /主题只作为问题范围；重点宫位由【问题】与盘面证据决定。/);
  assert.match(prompt, /若【问题】已限定主题，只把主题作为回答范围，不额外套用固定题目/);
  assert.doesNotMatch(prompt, /重点参考宫位：官禄宫、迁移宫、财帛宫、命宫/);
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
  assert.match(
    body.data.prompt,
    /若【问题】未限定主题，按通用口径处理；若【问题】已限定主题，只把主题作为问题范围/,
  );
  assert.match(body.data.prompt, /【重点宫位】/);
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

test('公开 API 紫微排盘支持轻量模式，减少默认响应体积', async () => {
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
      detailMode: 'compact',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.deepEqual(body.data.scopeNames, ['origin', 'monthly']);
  assert.equal(body.data.payloadByScope, undefined);
  assert.equal(body.data.gongList, undefined);
  assert.equal(body.data.activeScopes.monthly.active_scope.scope, 'monthly');
  assert.equal(body.data.activeScopes.monthly.palaces.length, 12);
  assert.ok(body.data.activeScopes.monthly.palaces[0].major_stars);
});

test('公开 API 紫微排盘应提供 agent 易解析的四化和宫位列表', async () => {
  const ziweiInput = {
    name: '吴丹蕾',
    gender: 'female',
    dateType: 'solar',
    year: '1998',
    month: '8',
    day: '13',
    timeIndex: 0,
    isLeapMonth: false,
  } as const;
  const { response, body } = await callApi('ziwei/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ziweiInput),
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
  assert.ok(
    body.data.gongList.some((palace: { name: string; stars: string[] }) => {
      return palace.name === '命宫' && palace.stars.length > 0;
    }),
  );

  const publicPalaces = body.data.payloadByScope.origin.palaces as Array<{
    index: number;
    name: string;
    opposite_palace_index: number;
    surrounded_palace_indexes: number[];
  }>;
  const fullRuntime = await calculateFullZiweiChart(buildZiweiChartInput(ziweiInput), true);
  const fullPalaces = fullRuntime.payloadByScope.origin.palaces;

  assert.equal(publicPalaces.length, fullPalaces.length);
  publicPalaces.forEach((palace) => {
    const fullPalace = fullPalaces.find((item) => item.index === palace.index);
    assert.ok(fullPalace, `${palace.name} 应存在于完整紫微 payload`);
    assert.equal(palace.opposite_palace_index, fullPalace.opposite_palace_index);
    assert.deepEqual(palace.surrounded_palace_indexes, fullPalace.surrounded_palace_indexes);
    assert.equal(new Set(palace.surrounded_palace_indexes).size, 4);
    assert.ok(palace.surrounded_palace_indexes.includes(palace.index));
    assert.ok(palace.surrounded_palace_indexes.includes(palace.opposite_palace_index));
  });
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
  assert.equal(body.data.meta.algorithm, 'tarot.single');
});

test('公开 API 六爻支持模拟三钱投掷并可按随机轨迹重放', async () => {
  const input = {
    customDate: '2025-01-01T08:00:00+08:00',
    liuyaoMethod: 'coins',
    seed: '公开接口固定样例',
  };
  const first = await callApi('divination/liuyao', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  assert.equal(first.response.status, 200);
  assert.equal(first.body.data.generation.method, 'coins');
  assert.equal(first.body.data.generation.coinThrows.length, 6);
  assert.ok(first.body.data.evidenceAnalysis.candidates.length > 0);
  assert.match(first.body.data.evidenceAnalysis.promptText, /【六爻用神作用链结构化证据】/);
  assert.doesNotMatch(first.body.data.evidenceAnalysis.promptText, /权重[：=]?\d/);

  const replay = await callApi('divination/liuyao', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customDate: input.customDate,
      liuyaoMethod: 'coins',
      replay: first.body.data.meta.random.samples,
    }),
  });
  assert.equal(replay.response.status, 200);
  assert.deepEqual(replay.body.data.yaoArray, first.body.data.yaoArray);
  assert.equal(replay.body.data.meta.resultId, first.body.data.meta.resultId);

  const conflict = await callApi('divination/liuyao', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, replay: [0.5] }),
  });
  assert.equal(conflict.response.status, 400);
  assert.match(conflict.body.error.message, /seed 与 replay 只能提供一个/);
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
    defaultResult.body.data.jiuGongGe.map(
      (gong: { tianPan: { star: string } }) => gong.tianPan.star,
    ),
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
    feipanResult.body.data.jiuGongGe.map(
      (gong: { tianPan: { star: string } }) => gong.tianPan.star,
    ),
    feipanStars,
  );
  assert.notDeepEqual(feipanStars, zhuanpanStars);

  const unsupportedRandom = await callApi('divination/qimen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customDate, seed: '不应被静默忽略' }),
  });
  assert.equal(unsupportedRandom.response.status, 400);
  assert.match(unsupportedRandom.body.error.message, /确定性排盘/);

  const feipanPrompt = await callApi('divination/qimen/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customDate,
      qimenMethod: 'feipan',
      question: '我近期事业应该注意什么？',
      responseMode: 'full',
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

test('公开 API 奇门排盘支持轻量模式，便于调用方按需拆分请求', async () => {
  const customDate = '2025-01-01T08:00:00+08:00';
  const fullResult = await callApi('divination/qimen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customDate }),
  });
  const compactResult = await callApi('divination/qimen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customDate, detailMode: 'compact' }),
  });

  assert.equal(fullResult.response.status, 200);
  assert.equal(compactResult.response.status, 200);
  assert.equal(compactResult.body.ok, true);
  assert.equal(compactResult.body.data.zhiFu, fullResult.body.data.zhiFu);
  assert.equal(compactResult.body.data.zhiShi, fullResult.body.data.zhiShi);
  assert.equal(compactResult.body.data.jiuGongGe.length, 9);
  assert.ok(compactResult.body.data.seasonality);
  assert.ok(Array.isArray(compactResult.body.data.patternCombos));
  assert.ok(compactResult.body.data.patternCombos.length <= 10);
  assert.ok(
    compactResult.body.data.patternComboTotal >= compactResult.body.data.patternCombos.length,
  );
  assert.equal(compactResult.body.data.patternCombos[0]?.sources, undefined);
  assert.ok(Array.isArray(compactResult.body.data.palaceInsights));
  assert.ok(compactResult.body.data.palaceInsights.length <= 9);
  assert.ok(
    JSON.stringify(compactResult.body.data).length <
      JSON.stringify(fullResult.body.data).length * 0.75,
  );

  const compactDirections = [
    ...(compactResult.body.data.directions?.goodDirections ?? []),
    ...(compactResult.body.data.directions?.avoidDirections ?? []),
  ];
  if (compactDirections.length > 0) {
    assert.equal(compactDirections[0].reasons, undefined);
  }
});

test('公开 API 占卜提示词默认只返回摘要和提示词', async () => {
  const { response, body } = await callApi('divination/qimen/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customDate: '2025-01-01T08:00:00+08:00',
      question: '我近期事业应该注意什么？',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.result, undefined);
  assert.equal(body.data.summary.title, '奇门起局结果');
  assert.ok(Array.isArray(body.data.summary.lines));
  assert.match(body.data.prompt, /我近期事业应该注意什么/);
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

test('公开 API 星盘提示词支持完整输出版行运资料', async () => {
  const { response, body } = await callApi('divination/astrolabe/prompt', {
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
      question: '整体人生和近期重点怎么看？',
      astrolabeTopic: 'life',
      astrolabeScope: 'full',
      responseMode: 'prompt-only',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.match(body.data.prompt, /【分析对象】/);
  assert.match(body.data.prompt, /完整星盘行运资料：/);
  assert.match(body.data.prompt, /分析对象：本命盘与完整行运资料。/);
  assert.match(body.data.prompt, /分析对象：流年\d{4}。/);
  assert.match(body.data.prompt, /分析对象：流月\d{4}-\d{2}。/);
  assert.match(body.data.prompt, /分析对象：流日\d{4}-\d{2}-\d{2}。/);
  assertPromptIsPortableTaskText(body.data.prompt);
});

test('公开 API 西占双盘应返回跨盘相位、落宫和结构化证据', async () => {
  const { response, body } = await callApi('divination/astrolabe/synastry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
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
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.deepEqual(body.data.synastry.people, ['甲', '乙']);
  assert.ok(body.data.synastry.aspects.length > 0);
  assert.ok(body.data.synastry.houseOverlays.length > 0);
  assert.ok(
    body.data.synastry.evidence.items.some((item: { level: string }) => item.level === '限制'),
  );
});

test('公开 API 西占双盘提示词应携带双方本命盘与可复核证据', async () => {
  const { response, body } = await callApi('divination/astrolabe/synastry/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
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
      question: '我们在长期合作中最需要注意什么？',
      responseMode: 'prompt-only',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.match(body.data.prompt, /【第一人本命盘】/);
  assert.match(body.data.prompt, /【第二人本命盘】/);
  assert.match(body.data.prompt, /【西占双盘结构化证据】/);
  assert.match(body.data.prompt, /实际夹角 \d+\.\d{2}°，偏差 \d+\.\d{2}°/);
  assert.match(body.data.prompt, /不得输出缺乏统一依据的关系匹配总分/);
  assertPromptIsPortableTaskText(body.data.prompt);
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

test('公开 API 黄历择日支持分页和轻量模式', async () => {
  const { response, body } = await callApi('divination/almanac', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic: 'contract',
      startDate: '2026-06-01',
      endDate: '2026-06-30',
      page: 2,
      pageSize: 5,
      detailMode: 'compact',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.days.length, 5);
  assert.equal(body.data.pagination.page, 2);
  assert.equal(body.data.pagination.pageSize, 5);
  assert.equal(body.data.pagination.total, 30);
  assert.equal(body.data.days[0].twentyEightStarDetail, undefined);
  assert.ok(body.data.days[0].date);
});

test('公开 API 黄历提示词支持按页生成，便于调用方拆分大范围请求', async () => {
  const { response, body } = await callApi('divination/almanac/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic: 'contract',
      startDate: '2026-06-01',
      endDate: '2026-06-30',
      page: 2,
      pageSize: 5,
      responseMode: 'full',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.result.days.length, 5);
  assert.equal(body.data.result.pagination.page, 2);
  assert.match(body.data.prompt, /候选日期：2026-06-01 至 2026-06-30/);
  assert.equal((body.data.prompt.match(/第\d+候选：/g) ?? []).length, 5);
  body.data.result.days.forEach((day: { date: string }) => {
    assert.match(body.data.prompt, new RegExp(day.date));
  });
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

test('公开 API 梅花排盘与提示词应返回主互变体用推进证据', async () => {
  const chart = await callApi('divination/meihua', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'number',
      number: 123,
      customDate: '2025-01-01T08:00:00+08:00',
    }),
  });
  assert.equal(chart.response.status, 200);
  assert.deepEqual(
    chart.body.data.evidenceAnalysis.stages.map((item: { stage: string }) => item.stage),
    ['origin', 'process', 'result'],
  );
  assert.match(chart.body.data.evidenceAnalysis.promptText, /【梅花体用阶段推进结构化证据】/);

  const prompt = await callApi('divination/meihua/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'number',
      number: 123,
      customDate: '2025-01-01T08:00:00+08:00',
      question: '这件事应如何推进？',
    }),
  });
  assert.equal(prompt.response.status, 200);
  assert.match(prompt.body.data.prompt, /【梅花体用阶段推进结构化证据】/);
  assert.doesNotMatch(prompt.body.data.prompt, /体用评分：|类象权重：|\d+日内|\d+月左右/);
});

test('公开 API 六爻与大六壬提示词接口保留用户模板范围', async () => {
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
  assert.doesNotMatch(liuyao.body.data.prompt, /鬼神怪异：以官鬼为取用参考|官鬼与子孙制鬼/);

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
  assert.match(liuren.body.data.prompt, /【断课要点】/);
  assert.match(liuren.body.data.prompt, /断课类型：事业断课/);
  assert.doesNotMatch(liuren.body.data.prompt, /【分析思路】/);
  assert.doesNotMatch(liuren.body.data.prompt, /关注重点：|岗位路径、协作阻力、窗口时机/);
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

test('公开 API 拆分和轻量参数非法时应返回 400，避免生成空页或大响应', async () => {
  const cases = [
    {
      path: 'bazi/prompt',
      payload: {
        gender: 'male',
        year: 1990,
        month: 1,
        day: 1,
        timeIndex: 0,
        dateType: 'solar',
        question: '测试',
        responseMode: 'everything',
      },
      message: /responseMode 必须是以下值之一/,
    },
    {
      path: 'bazi/calculate',
      payload: {
        gender: 'male',
        year: 1990,
        month: 1,
        day: 1,
        timeIndex: 0,
        dateType: 'solar',
        detailMode: 'tiny',
      },
      message: /detailMode 必须是以下值之一/,
    },
    {
      path: 'divination/almanac',
      payload: {
        topic: 'move',
        startDate: '2026-06-01',
        endDate: '2026-06-30',
        page: 0,
        pageSize: 5,
      },
      message: /page 不能小于 1/,
    },
    {
      path: 'divination/almanac',
      payload: {
        topic: 'move',
        startDate: '2026-06-01',
        endDate: '2026-06-30',
        page: 1,
        pageSize: 32,
      },
      message: /pageSize 不能大于 31/,
    },
    {
      path: 'divination/almanac/prompt',
      payload: {
        topic: 'move',
        startDate: '2026-06-01',
        endDate: '2026-06-30',
        page: 7,
        pageSize: 5,
      },
      message: /page 不能超过总页数 6/,
    },
  ];

  for (const item of cases) {
    const { response, body } = await callApi(item.path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item.payload),
    });

    assert.equal(response.status, 400, item.path);
    assert.equal(body.ok, false, item.path);
    assert.equal(body.error.code, 'BAD_REQUEST', item.path);
    assert.match(body.error.message, item.message, item.path);
  }
});

test('公开 API 应拒绝过大的请求体', async () => {
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
      note: '测'.repeat(512 * 1024),
    }),
  });

  assert.equal(response.status, 413);
  assert.equal(body.ok, false);
  assert.equal(body.error.code, 'REQUEST_BODY_TOO_LARGE');
});

test('公开 API 应拒绝过长文本字段，避免提示词响应失控', async () => {
  const { response, body } = await callApi('bazi/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gender: 'male',
      year: 1990,
      month: 1,
      day: 1,
      timeIndex: 0,
      dateType: 'solar',
      question: '测'.repeat(5001),
    }),
  });

  assert.equal(response.status, 400);
  assert.equal(body.ok, false);
  assert.equal(body.error.code, 'BAD_REQUEST');
  assert.match(body.error.message, /question 不能超过 5000 个字符/);
});

test('公开 API 梅花未知起卦方式应返回 400 而不是内部错误', async () => {
  const { response, body } = await callApi('divination/meihua', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method: 'external' }),
  });

  assert.equal(response.status, 400);
  assert.equal(body.ok, false);
  assert.equal(body.error.code, 'BAD_REQUEST');
  assert.doesNotMatch(body.error.message, /内部错误/);
});

test('公开 API 黄历参与人过多应返回 400，引导调用方拆分请求', async () => {
  const participants = Array.from({ length: 31 }, (_, index) => ({
    id: `p${index + 1}`,
    name: `测试${index + 1}`,
    gender: index % 2 === 0 ? '男' : '女',
    year: 1980 + (index % 30),
    month: (index % 12) + 1,
    day: (index % 28) + 1,
    timeIndex: index % 13,
    dateType: 'solar',
  }));
  const { response, body } = await callApi('divination/almanac', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic: 'move',
      startDate: '2026-06-01',
      endDate: '2026-06-05',
      participants,
    }),
  });

  assert.equal(response.status, 400);
  assert.equal(body.ok, false);
  assert.equal(body.error.code, 'BAD_REQUEST');
  assert.match(body.error.message, /participants 一次最多传 30 位参与人/);
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

test('公开 API 新增术数提示词应包含用户问题和统一章节', async () => {
  const { response, body } = await callApi('metaphysics/bazhai/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      birthYear: 1990,
      gender: 'male',
      doorToInteriorDegree: 0,
      question: '住宅办公方位怎么安排？',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.match(body.data.prompt, /【八宅风水排盘】/);
  assert.match(body.data.prompt, /【测量换算】/);
  assert.match(body.data.prompt, /站在大门处面向屋内/);
  assert.match(body.data.prompt, /【当前时间】/);
  assert.match(body.data.prompt, /【问题】\n住宅办公方位怎么安排？/);
  assert.match(body.data.prompt, /【任务】/);
  assert.match(body.data.prompt, /【输出要求】/);
  assert.match(body.data.prompt, /主证、辅证、反证或限制/);
  assert.match(body.data.prompt, /每个关键结论都要紧跟对应盘面依据/);
});

test('公开 API 七政四余应只返回《七政算内篇》紫炁模型与完整位置元数据', async () => {
  const { response, body } = await callApi('metaphysics/qizheng/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      year: 1995,
      month: 12,
      day: 31,
      hour: 8,
      timezone: 8,
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.ziqiModel.id, 'qizhengsuan-naepyeon-mean-motion');
  assert.equal(body.data.ziqiModel.direction, '顺行');
  assert.equal(body.data.ziqiModel.periodDays, 10227.1792);
  assert.ok(Math.abs(body.data.ziqi.tropicalLongitude - 237.038993) < 1e-9);
  assert.equal(body.data.stars.filter((star: { kind: string }) => star.kind === '四余').length, 4);
  assert.equal(
    body.data.ziqiModel.sources.filter((source: { usage: string }) => source.usage === '未采用')
      .length,
    2,
  );
});

test('公开 API 太乙应返回年计七十二局立成结果', async () => {
  const { response, body } = await callApi('metaphysics/taiyi/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ year: 2004, scope: 'year' }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.ganZhi, '甲申');
  assert.equal(body.data.bureau, 33);
  assert.equal(body.data.taiyiPosition, '艮');
  assert.equal(body.data.wenChangPosition, '午');
  assert.equal(body.data.shiJiPosition, '艮');
  assert.equal(body.data.lordCount, 24);
  assert.equal(body.data.guestCount, 3);
  assert.equal(body.data.sixteenGods.length, 16);
  assert.equal(body.data.model.id, 'taiyi-tongzong-five-calculations-72-table');
});

test('公开 API 太乙应支持月日时分四种计式', async () => {
  for (const scope of ['month', 'day', 'hour', 'minute']) {
    const { response, body } = await callApi('metaphysics/taiyi/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope, year: 2026, month: 7, day: 11, hour: 14, minute: 35 }),
    });
    assert.equal(response.status, 200, scope);
    assert.equal(body.data.scope, scope);
    assert.ok(body.data.accumulatedValue > 0);
  }
});

test('公开 API 新增术数应拒绝缺失组合和无效日期坐标', async () => {
  const cases = [
    ['metaphysics/bazhai/calculate', { birthYear: 1990 }],
    ['metaphysics/bazhai/calculate', { mingGua: '未知卦' }],
    ['metaphysics/bazhai/calculate', { mingGua: '坎', sitMountain: '未知山' }],
    ['metaphysics/zodiac/calculate', { zodiac: '猴', yearGanZhi: '甲丑' }],
    ['metaphysics/taiyi/calculate', { year: 2004, scope: 'month' }],
    ['metaphysics/qizheng/calculate', { year: 2026, month: 2, day: 30, hour: 12 }],
    ['metaphysics/qizheng/calculate', { year: 2026, month: 1, day: 1, hour: 12, latitude: 120 }],
    ['metaphysics/qizheng/calculate', { year: 2026, month: 1, day: 1, hour: 12, timezone: 15 }],
  ] as const;

  for (const [path, payload] of cases) {
    const { response, body } = await callApi(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(response.status, 400, path);
    assert.equal(body.error.code, 'BAD_REQUEST', path);
  }
});

test('公开 API 不应继续暴露已移除的铁板神数端点', async () => {
  const { response, body } = await callApi('metaphysics/tieban/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ year: 2026, month: 1, day: 1, hour: 12 }),
  });

  assert.equal(response.status, 404);
  assert.equal(body.error.code, 'NOT_FOUND');
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
