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
import { assertPromptHasSingleRole, assertPromptIsPortableTaskText } from './prompt-assertions';
import { PROMPT_GUIDANCE_TEXT as PROMPT_ROLE_TEXT } from '../src/lib/prompt-guidance';

async function callApi(path: string, init?: RequestInit) {
  const request = new Request(`https://aov.cc/api/v1/${path}`, init);
  const response = await handlePublicApiRequest(request);
  const text = await response.text();
  return {
    response,
    body: text ? JSON.parse(text) : null,
  };
}

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
  assert.ok(body.data.endpoints.includes('POST /api/v1/calendar/astronomical-time'));
  assert.ok(body.data.endpoints.includes('POST /api/v1/calendar/moon-phase'));
  assert.ok(body.data.endpoints.includes('POST /api/v1/calendar/solar-term'));
  assert.ok(body.data.endpoints.includes('POST /api/v1/foundation/ganzhi'));
  assert.ok(body.data.endpoints.includes('POST /api/v1/foundation/wuxing'));
  assert.ok(body.data.endpoints.includes('POST /api/v1/foundation/direction'));
  assert.ok(body.data.endpoints.includes('POST /api/v1/foundation/shensha'));
  assert.ok(body.data.endpoints.includes('POST /api/v1/bazi-ziwei/prompt'));
  assert.ok(body.data.endpoints.includes('POST /api/v1/divination/almanac'));
  assert.ok(body.data.endpoints.includes('POST /api/v1/divination/astrolabe/prompt'));
  assert.ok(body.data.endpoints.includes('POST /api/v1/metaphysics/wuyun-liuqi/calculate'));
  assert.ok(body.data.endpoints.includes('POST /api/v1/metaphysics/wuyun-liuqi/prompt'));
  assert.ok(body.data.endpoints.includes('POST /api/v1/metaphysics/huangji-jingshi/calculate'));
  assert.ok(body.data.endpoints.includes('POST /api/v1/metaphysics/huangji-jingshi/prompt'));
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
    body: JSON.stringify({
      person1,
      person2,
      person1Name: '甲方',
      person2Name: '乙方',
      detailMode: 'full',
    }),
  });

  assert.equal(calculation.response.status, 200);
  const compatibility = calculation.body.data.compatibility;
  assert.equal(compatibility.people.person1, '甲方');
  assert.equal(compatibility.key, 'bazi:compatibility:evidence');
  assert.equal(compatibility.status, '已计算');
  assert.equal(compatibility.calculationSteps.length, 7);
  assert.ok(compatibility.tenGodMappings.length === 8);
  assert.ok(
    compatibility.crossPillarRelations.every(
      (item: { key?: string; status?: string; calculationStepKey?: string }) =>
        item.key &&
        item.status === '已命中' &&
        compatibility.calculationSteps.some(
          (step: { key: string }) => step.key === item.calculationStepKey,
        ),
    ),
  );
  assert.equal(
    compatibility.summaryFact.crossPillarRelationCount,
    compatibility.crossPillarRelations.length,
  );
  assert.ok(compatibility.counterEvidenceFacts.length >= 4);
  assert.ok(
    compatibility.limitationFacts.some((item: { type: string }) => item.type === '高风险输出边界'),
  );
  assertEvidenceOwnerReferences(compatibility);
  assert.match(compatibility.promptText, /【八字双盘结构化证据】/);
  assert.doesNotMatch(compatibility.promptText, /bazi:compatibility:/);

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
      schools: ['ziping', 'mangpai', 'xinpai'],
      responseMode: 'full',
    }),
  });

  assert.equal(prompted.response.status, 200);
  assert.match(prompted.body.data.prompt, /【双盘关系资料】/);
  assert.match(prompted.body.data.prompt, /请分析双方是否适合长期合作/);
  assert.match(prompted.body.data.prompt, /甲方.*乙方/);
  assert.match(prompted.body.data.prompt, /【多派合参】/);
  assert.match(prompted.body.data.prompt, /子平派/);
  assert.match(prompted.body.data.prompt, /盲派/);
  assert.match(prompted.body.data.prompt, /新派/);
  assert.doesNotMatch(
    prompted.body.data.prompt,
    /【角色与总则】|结构化证据|证据汇总|解释边界|计算链/,
  );
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
  assert.match(body.data.info.description, /星盘/);
  assert.equal(
    body.data.paths['/divination/{method}/prompt'].post.summary,
    '起卦、抽牌或排盘并生成 AI 解读提示词',
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
          'jinkoujue',
          'qimen',
          'liuren',
          'tarot',
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
  assert.equal(
    body.data.paths['/divination/ssgw/prompt'].post.requestBody.content['application/json'].schema
      .$ref,
    '#/components/schemas/SsgwPromptRequest',
  );
  assert.equal(body.data.components.schemas.SsgwPromptRequest.properties.schools, undefined);
  assert.ok(body.data.paths['/bazi-ziwei/prompt']);
  assert.ok(body.data.paths['/divination/astrolabe']);
  assert.ok(body.data.paths['/foundation/shensha']);
  assert.equal(
    body.data.paths['/metaphysics/qizheng/calculate'].post.responses['200'].description,
    '十一星、真实距星宿界与结构化证据',
  );
  assert.equal(
    body.data.paths['/metaphysics/qizheng/prompt'].post.responses['200'].description,
    '七政四余盘与结构化提示词',
  );
  assert.equal(
    body.data.paths['/metaphysics/wuyun-liuqi/calculate'].post.requestBody.content[
      'application/json'
    ].schema.$ref,
    '#/components/schemas/WuyunLiuqiRequest',
  );
  assert.equal(
    body.data.paths['/metaphysics/huangji-jingshi/prompt'].post.requestBody.content[
      'application/json'
    ].schema.$ref,
    '#/components/schemas/HuangjiJingshiRequest',
  );
  assert.deepEqual(body.data.components.schemas.WuyunLiuqiRequest.anyOf, [
    { required: ['year'] },
    { required: ['yearGanZhi'] },
  ]);
  assert.deepEqual(body.data.components.schemas.HuangjiJingshiRequest.oneOf, [
    { required: ['year'], not: { required: ['elapsedYears'] } },
    { required: ['epochYear', 'elapsedYears'], not: { required: ['year'] } },
  ]);
  assert.equal(body.data.components.schemas.HuangjiJingshiRequest.required, undefined);
  assert.equal(
    body.data.components.schemas.BaziCompatibilityRequest.properties.schools.maxItems,
    3,
  );
  assert.equal(
    body.data.components.schemas.ZiweiCompatibilityRequest.properties.schools.uniqueItems,
    true,
  );
  assert.deepEqual(
    body.data.components.schemas.AstrolabeSynastryPromptRequest.allOf[1].properties.schools.items
      .enum,
    ['modern', 'traditional', 'timing'],
  );
  assert.equal(body.data.paths['/metaphysics/qizheng/calculate'].post.responses['400'], undefined);
  assert.equal(
    body.data.paths['/foundation/shensha'].post.requestBody.content['application/json'].schema.$ref,
    '#/components/schemas/FoundationShenshaRequest',
  );
  assert.deepEqual(body.data.components.schemas.FoundationShenshaRequest.required, [
    'yearGanZhi',
    'monthGanZhi',
    'dayGanZhi',
    'hourGanZhi',
  ]);
  assert.deepEqual(
    body.data.components.schemas.FoundationShenshaRequest.properties.ids.items.enum,
    ['kongwang', 'yima', 'taohua'],
  );
  for (const path of [
    '/divination/liuyao',
    '/divination/meihua',
    '/divination/qimen',
    '/divination/liuren',
    '/divination/tarot',
    '/divination/ssgw',
    '/divination/almanac',
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
  assert.ok(body.data.components.schemas.DivinationPromptRequest.properties.participants);
  assert.ok(body.data.components.schemas.DivinationPromptRequest.properties.latitude);
  assert.ok(body.data.components.schemas.DivinationPromptRequest.properties.liuyaoTemplate);
  assert.ok(body.data.components.schemas.DivinationPromptRequest.properties.liurenTemplate);
  const spreadTypeSchema =
    body.data.components.schemas.DivinationPromptRequest.properties.spreadType;
  for (const spreadType of [
    'single',
    'three',
    'love',
    'career',
    'decision',
    'celtic',
    'chakra',
    'year',
    'mindBodySpirit',
    'horseshoe',
    'five',
    'relationship',
    'nine',
    'element',
    'grandTableau',
  ]) {
    assert.ok(spreadTypeSchema.enum.includes(spreadType), `spreadType 应包含 ${spreadType}`);
  }
  assert.match(spreadTypeSchema.description, /horseshoe/);
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
  assert.equal(divinationRequestProperties.responseMode.default, 'prompt-only');
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
  assert.deepEqual(body.data.components.schemas.ZiweiRequest.properties.algorithm.enum, [
    'default',
    'zhongzhou',
  ]);
  assert.match(
    body.data.components.schemas.ZiweiRequest.properties.algorithm.description,
    /中州派安星法.*不等同于提示词解读流派/,
  );
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
  assert.deepEqual(body.data.components.schemas.BaziRequest.properties.shenShaScope.enum, [
    'common',
    'all',
  ]);
  assert.equal(body.data.components.schemas.BaziRequest.properties.shenShaScope.default, 'common');
  assert.match(body.data.components.schemas.ShenShaVariants.description, /问真学堂整理口径/);
  assert.deepEqual(body.data.components.schemas.ShenShaVariants.properties.referenceProfile.enum, [
    'wenzhen',
    'classical',
  ]);
  assert.equal(
    body.data.components.schemas.ShenShaVariants.properties.referenceProfile.default,
    'wenzhen',
  );
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
  assert.equal(body.data.key, 'true-solar-time:1990-05-15T10:30:20:116.4074:8');
  assert.equal(body.data.status, '已计算');
  assert.equal(body.data.calculationSteps.length, 6);
  assert.deepEqual(
    body.data.calculationChain,
    body.data.calculationSteps.map((item: { promptText: string }) => item.promptText),
  );
  assert.equal(body.data.summaryFact.calculationStepCount, body.data.calculationSteps.length);
  assert.equal(body.data.summaryFact.correctionFactCount, body.data.correctionFacts.length);
  assert.equal(body.data.summaryFact.limitationFactCount, body.data.limitationFacts.length);
  assert.ok(
    body.data.correctionFacts.every(
      (fact: { ownerStepKeys: string[]; sources: string[] }) =>
        fact.ownerStepKeys.length > 0 && fact.sources.length > 0,
    ),
  );
  assert.ok(
    body.data.limitationFacts.every(
      (fact: { ownerStepKeys: string[]; ownerFactKeys: string[] }) =>
        fact.ownerStepKeys.length > 0 && fact.ownerFactKeys.length > 0,
    ),
  );
  assert.match(body.data.promptText, /计算链：/);
  assert.doesNotMatch(body.data.promptText, /候选时辰为|出生时间敏感性|缺少时柱/);

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

  const iana = await callApi('calendar/true-solar-time', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      localDateTime: '2024-07-01T12:00:00',
      longitude: -74.006,
      timeZoneId: 'America/New_York',
    }),
  });
  assert.equal(iana.response.status, 200);
  assert.equal(iana.body.data.timezone, -4);
  assert.equal(iana.body.data.timeZoneId, 'America/New_York');
  assert.equal(iana.body.data.timezoneEvidence.resolvedOffsetHours, -4);

  const ambiguous = await callApi('calendar/true-solar-time', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      localDateTime: '2024-11-03T01:30:00',
      longitude: -74.006,
      timeZoneId: 'America/New_York',
    }),
  });
  assert.equal(ambiguous.response.status, 400);
  assert.match(ambiguous.body.error.message, /回拨歧义.*timezone/);

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
  assert.equal(body.data.calculationSteps.length, 7);
  assert.equal(body.data.calculationSteps[0].stage, '历法输入换算');
  assert.equal(body.data.correctionFacts[0].type, '历法输入');
  assert.equal(body.data.summaryFact.status, '证据链完整');

  const iana = await callApi('calendar/true-solar-birth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dateType: 'solar',
      year: 2024,
      month: 7,
      day: 1,
      hour: 12,
      minute: 0,
      longitude: -74.006,
      timeZoneId: 'America/New_York',
    }),
  });
  assert.equal(iana.response.status, 200);
  assert.equal(iana.body.data.timezone, -4);
  assert.equal(iana.body.data.timezoneEvidence.timeZoneId, 'America/New_York');
});

test('公开 API 应提供太阳高度、日出日落与曙暮光证据接口', async () => {
  const { response, body } = await callApi('calendar/solar-illumination', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      year: 2024,
      month: 6,
      day: 21,
      hour: 12,
      latitude: 39.9042,
      longitude: 116.4074,
      timezone: 8,
    }),
  });
  assert.equal(response.status, 200);
  assert.equal(body.data.sunriseSunset.status, '正常交点');
  assert.match(body.data.sunriseSunset.morningLocalDateTime, /2024-06-21 04:4\d:/);
  assert.match(body.data.sunriseSunset.key, /^光照交点:日出\/日落$/);
  assert.ok(body.data.sunriseSunset.sources.length >= 2);
  assert.match(body.data.sunriseSunset.calculation, /求时角交点/);
  assert.match(body.data.sunriseSunset.limitation, /不代表实际可见性/);
  assert.equal(body.data.key, 'solar-illumination:2024-06-21:39.9042:116.4074');
  assert.equal(body.data.status, '已计算');
  assert.equal(body.data.astronomicalTime.status, '已计算');
  assert.deepEqual(
    body.data.calculationSteps.map((item: { stage: string }) => item.stage),
    ['天文时间', '参考太阳位置', '视太阳正午', '阈值交点'],
  );
  assert.deepEqual(
    body.data.calculationChain,
    body.data.calculationSteps.map((item: { promptText: string }) => item.promptText),
  );
  assert.equal(body.data.sunriseSunset.calculationStepKeys[0], body.data.calculationSteps[3].key);
  assert.equal(body.data.assumptions.length, body.data.assumptionFacts.length);
  assert.equal(body.data.crossingSummaryFact.status, '均有正常交点');
  assert.equal(body.data.crossingSummaryFact.crossingFactKeys.length, 4);
  assert.equal(body.data.summaryFact.key, 'solar-illumination:evidence-summary');
  assert.equal(body.data.summaryFact.status, '证据链完整');
  assert.equal(body.data.summaryFact.normalCrossingCount, 4);
  assert.ok(body.data.summaryFact.factKeys.length > 0);
  assert.equal(body.data.limitations.length, body.data.limitationFacts.length);
  assert.match(body.data.promptText, /太阳光照证据：/);
  assertPromptIsPortableTaskText(body.data.promptText);

  const invalid = await callApi('calendar/solar-illumination', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      year: 2024,
      month: 6,
      day: 21,
      latitude: 39.9042,
      longitude: 116.4074,
    }),
  });
  assert.equal(invalid.response.status, 400);
  assert.match(invalid.body.error.message, /timezone 与 timeZoneId 至少需要提供一项/);
});

test('公开 API 应提供天文时间、月相与节气公共证据接口', async () => {
  const astronomicalTime = await callApi('calendar/astronomical-time', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      year: 2000,
      month: 1,
      day: 1,
      hour: 12,
      timezone: 0,
    }),
  });
  assert.equal(astronomicalTime.response.status, 200);
  assert.equal(astronomicalTime.body.data.julianDayUtc, 2451545);
  assert.equal(astronomicalTime.body.data.calculationSteps.length, 5);
  assert.deepEqual(
    astronomicalTime.body.data.calculationChain,
    astronomicalTime.body.data.calculationSteps.map(
      (item: { promptText: string }) => item.promptText,
    ),
  );
  assert.equal(
    astronomicalTime.body.data.summaryFact.calculationStepCount,
    astronomicalTime.body.data.calculationSteps.length,
  );
  assert.match(astronomicalTime.body.data.promptText, /UT1≈UTC/);

  const moonPhase = await callApi('calendar/moon-phase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ utcDateTime: '2024-06-21T12:00:00Z' }),
  });
  assert.equal(moonPhase.response.status, 200);
  assert.equal(moonPhase.body.data.status, '已计算');
  assert.equal(moonPhase.body.data.calculationSteps.length, 4);
  assert.equal(moonPhase.body.data.summaryFact.principalEventCount, 2);
  assert.equal(typeof moonPhase.body.data.illuminationPercent, 'number');
  assert.ok(moonPhase.body.data.previousPrincipalPhase.utcDateTime);
  assert.ok(moonPhase.body.data.nextPrincipalPhase.utcDateTime);
  assert.match(moonPhase.body.data.promptText, /前一四正相位/);

  const solarTerm = await callApi('calendar/solar-term', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ year: 2024, index: 12 }),
  });
  assert.equal(solarTerm.response.status, 200);
  assert.equal(solarTerm.body.data.name, '夏至');
  assert.equal(solarTerm.body.data.targetLongitudeDegrees, 90);
  assert.equal(solarTerm.body.data.calculationSteps.length, 4);
  assert.equal(solarTerm.body.data.summaryFact.verificationFactCount, 1);
  assert.equal(solarTerm.body.data.verificationFact.status, '已记录差值');
  assert.match(solarTerm.body.data.promptText, /独立模型求根/);

  const invalidCalls: Array<[string, Record<string, unknown>]> = [
    ['calendar/astronomical-time', { year: 2000, month: 1, day: 1 }],
    ['calendar/moon-phase', { utcDateTime: '2024-02-30T12:00:00Z' }],
    ['calendar/moon-phase', { utcDateTime: '2024-06-21T12:00:00' }],
    ['calendar/solar-term', { year: 2024, index: 24 }],
  ];
  for (const [path, payload] of invalidCalls) {
    const invalid = await callApi(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(invalid.response.status, 400);
  }
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
  assert.ok(capabilities.body.data.evidenceOutputs.ganzhi.includes('来源事实'));
  assert.ok(capabilities.body.data.evidenceOutputs.wuxing.includes('并列最高最低项'));
  assert.ok(capabilities.body.data.evidenceOutputs.direction.includes('分界线状态'));
  assert.equal(capabilities.body.data.key, 'foundation:capabilities');
  assert.equal(capabilities.body.data.status, '已登记');
  assert.equal(capabilities.body.data.capabilityFacts.length, 5);
  assert.equal(capabilities.body.data.summaryFact.moduleFactCount, 5);
  assert.equal(capabilities.body.data.summaryFact.evidenceReadyModuleCount, 5);
  assert.equal(capabilities.body.data.summaryFact.catalogOnlyModuleCount, 0);
  assert.equal(
    capabilities.body.data.summaryFact.commonShenshaCount,
    capabilities.body.data.commonShensha.length,
  );
  assert.equal(
    capabilities.body.data.summaryFact.constantGroupCount,
    Object.keys(capabilities.body.data.constants).length,
  );
  assert.equal(capabilities.body.data.limitationFacts.length, 4);
  assert.equal(
    capabilities.body.data.limitations.length,
    capabilities.body.data.limitationFacts.length,
  );
  assert.ok(capabilities.body.data.evidenceOutputs.calendar.includes('真太阳时计算链'));
  assert.ok(capabilities.body.data.evidenceOutputs.shensha.includes('稳定编号'));
  assert.ok(capabilities.body.data.evidenceOutputs.shensha.includes('逐柱命中事实'));
  assert.match(capabilities.body.data.promptText, /能力目录证据汇总：目录完整/);
  assert.match(capabilities.body.data.promptText, /不得把目录数量/);
  assert.doesNotMatch(
    capabilities.body.data.promptText,
    /命语|mingyu-core|本项目|当前项目|工程|接口|API|MCP/,
  );

  const ganZhi = await callApi('foundation/ganzhi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ganZhi: '甲子' }),
  });
  assert.equal(ganZhi.response.status, 200);
  assert.equal(ganZhi.body.data.nayin, '海中金');
  assert.equal(ganZhi.body.data.branch.clash, '午');
  assert.equal(ganZhi.body.data.key, 'foundation:ganzhi:甲子');
  assert.equal(ganZhi.body.data.calculationSteps.length, 5);
  assert.deepEqual(
    ganZhi.body.data.calculationChain,
    ganZhi.body.data.calculationSteps.map((item: { promptText: string }) => item.promptText),
  );
  assert.equal(ganZhi.body.data.summaryFact.sourceFactCount, ganZhi.body.data.sourceFacts.length);
  assert.match(ganZhi.body.data.promptText, /关系对象/);

  const wuxing = await callApi('foundation/wuxing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: ['甲', '子', '丙', '午'], weightHidden: true }),
  });
  assert.equal(wuxing.response.status, 200);
  assert.equal(wuxing.body.data.weightHidden, true);
  assert.ok(wuxing.body.data.counts.火 > 0);
  assert.equal(wuxing.body.data.status, '已统计');
  assert.equal(wuxing.body.data.calculationSteps.length, 4);
  assert.equal(wuxing.body.data.itemFacts.length, 4);
  assert.deepEqual(wuxing.body.data.dominantElements, ['火']);
  assert.deepEqual(wuxing.body.data.weakestElements, ['金']);
  assert.equal(wuxing.body.data.summaryFact.itemFactCount, wuxing.body.data.itemFacts.length);
  assert.match(wuxing.body.data.promptText, /不包含月令司权、季节旺衰、日主、格局/);

  const direction = await callApi('foundation/direction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ degree: 180 }),
  });
  assert.equal(direction.response.status, 200);
  assert.equal(direction.body.data.key, 'foundation:direction:180');
  assert.equal(direction.body.data.label, '子山午向');
  assert.equal(direction.body.data.facingBagua, '离');
  assert.equal(direction.body.data.sitBagua, '坎');
  assert.equal(direction.body.data.calculationSteps.length, 4);
  assert.equal(direction.body.data.summaryFact.status, '映射稳定');
  assert.match(direction.body.data.promptText, /不自动推断或补造磁偏角/);

  const boundaryDirection = await callApi('foundation/direction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ degree: 7.5 }),
  });
  assert.equal(boundaryDirection.response.status, 200);
  assert.equal(boundaryDirection.body.data.status, '存在分界线');
  assert.equal(boundaryDirection.body.data.summaryFact.status, '坐向均位于分界线');

  const shensha = await callApi('foundation/shensha', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      yearGanZhi: '甲子',
      monthGanZhi: '丙寅',
      dayGanZhi: '戊辰',
      hourGanZhi: '丁酉',
    }),
  });
  assert.equal(shensha.response.status, 200);
  assert.equal(shensha.body.data.status, '已核验');
  assert.equal(shensha.body.data.pillarFacts.length, 4);
  assert.equal(shensha.body.data.matchFacts.length, 3);
  assert.equal(shensha.body.data.summaryFact.status, '证据链完整');
  assert.equal(shensha.body.data.summaryFact.matchedRuleCount, 2);
  assert.deepEqual(
    shensha.body.data.matchFacts.find((item: { id: string }) => item.id === 'yima').matchedPillars,
    [{ pillar: 'monthGanZhi', label: '月柱', ganZhi: '丙寅', branch: '寅' }],
  );
  assert.match(shensha.body.data.promptText, /通用神煞资料/);
  assert.doesNotMatch(
    shensha.body.data.promptText,
    /命语|mingyu-core|本项目|当前项目|工程|接口|API|MCP/,
  );

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

  for (const degree of [-0.1, 360.1, '180']) {
    const invalidDirection = await callApi('foundation/direction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ degree }),
    });
    assert.equal(invalidDirection.response.status, 400);
  }

  for (const payload of [
    { yearGanZhi: '甲丑', monthGanZhi: '丙寅', dayGanZhi: '戊辰', hourGanZhi: '丁酉' },
    {
      yearGanZhi: '甲子',
      monthGanZhi: '丙寅',
      dayGanZhi: '戊辰',
      hourGanZhi: '丁酉',
      ids: ['unknown'],
    },
    {
      yearGanZhi: '甲子',
      monthGanZhi: '丙寅',
      dayGanZhi: '戊辰',
      hourGanZhi: '丁酉',
      ids: ['yima', 'yima'],
    },
  ]) {
    const invalidShensha = await callApi('foundation/shensha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(invalidShensha.response.status, 400);
  }
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
      detailMode: 'full',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.pillars.day.ganZhi.length, 2);
  assert.equal(body.data.gender, 'male');
  assert.equal(body.data.warningFacts.length, body.data.warnings.length);
  assert.equal(body.data.warningSummaryFact.status, '无预警');
  assert.equal(
    body.data.seasonInfo.previousTermEvidence.calculationChain.length,
    body.data.seasonInfo.previousTermEvidence.calculationSteps.length,
  );
  assert.equal(body.data.seasonInfo.previousTermEvidence.summaryFact.verificationFactCount, 1);
  assert.equal(
    body.data.seasonInfo.previousTermEvidence.summaryFact.limitationFactCount,
    body.data.seasonInfo.previousTermEvidence.limitationFacts.length,
  );
  assert.equal(body.data.evidenceAnalysis.key, 'bazi:natal:evidence');
  assert.equal(body.data.evidenceAnalysis.calculationSteps.length, 5);
  assert.equal(body.data.evidenceAnalysis.pillarFacts.length, 4);
  assert.equal(body.data.evidenceAnalysis.analysisFacts.length, 3);
  assert.equal(body.data.evidenceAnalysis.counterEvidenceFacts.length, 4);
  assert.equal(body.data.evidenceAnalysis.limitationFacts.length, 6);
  assert.equal(body.data.evidenceAnalysis.summaryFact.status, '证据链完整');
  assert.equal(
    body.data.evidenceAnalysis.summaryFact.warningFactCount,
    body.data.warningFacts.length,
  );
  assertEvidenceOwnerReferences(body.data.evidenceAnalysis);
});

test('公开 API 八字神煞默认使用问真口径', async () => {
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
  assert.ok(body.data.shensha.month.includes('空亡'));
  assert.ok(body.data.shensha.hour.includes('空亡'));
});

test('公开 API 八字神煞默认精简，显式 all 返回全部', async () => {
  const input = {
    gender: 'male',
    year: 1988,
    month: 7,
    day: 15,
    timeIndex: 6,
    dateType: 'solar',
  };
  const common = await callApi('bazi/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const all = await callApi('bazi/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, shenShaScope: 'all' }),
  });
  const commonNames = Object.values(common.body.data.shensha).flat() as string[];
  const allNames = Object.values(all.body.data.shensha).flat() as string[];

  assert.equal(common.response.status, 200);
  assert.equal(all.response.status, 200);
  assert.ok(!commonNames.includes('马财库'));
  assert.ok(allNames.includes('马财库'));
  assert.ok(allNames.length > commonNames.length);
});

test('公开 API 八字 shenShaScope 非法值应返回参数错误', async () => {
  const { response, body } = await callApi('bazi/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gender: 'male',
      year: 1988,
      month: 7,
      day: 15,
      timeIndex: 6,
      dateType: 'solar',
      shenShaScope: 'extended',
    }),
  });

  assert.equal(response.status, 400);
  assert.equal(body.ok, false);
  assert.equal(body.error.code, 'BAD_REQUEST');
  assert.match(body.error.message, /shenShaScope 必须是以下值之一/);
});

test('公开 API 八字可通过 referenceProfile 请求原有传统兼容口径', async () => {
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
        referenceProfile: 'classical',
      },
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.ok(!body.data.shensha.month.includes('空亡'));
  assert.ok(!body.data.shensha.hour.includes('空亡'));
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
        referenceProfile: 'modern',
      },
    }),
  });

  assert.equal(response.status, 400);
  assert.equal(body.ok, false);
  assert.equal(body.error.code, 'BAD_REQUEST');
  assert.match(body.error.message, /referenceProfile 必须是以下值之一/);
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
  assert.equal(body.data.evidenceAnalysis, undefined);
  assert.equal(body.data.shensha, undefined);
  assert.equal(body.data.shenShaAnalysis, undefined);
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
      detailMode: 'full',
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
  assert.equal(body.data.timing.evidence.status, '已计算');
  assert.equal(body.data.timing.evidence.calculationSteps.length, 7);
  assert.equal(
    body.data.timing.evidence.summaryFact.calculationStepCount,
    body.data.timing.evidence.calculationSteps.length,
  );
  assert.match(body.data.timing.evidence.promptText, /唯一映射为/);

  const iana = await callApi('bazi/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gender: 'male',
      year: 2024,
      month: 7,
      day: 1,
      dateType: 'solar',
      useTrueSolarTime: true,
      birthHour: 12,
      birthMinute: 0,
      birthLongitude: -74.006,
      timeZoneId: 'America/New_York',
      detailMode: 'full',
    }),
  });
  assert.equal(iana.response.status, 200);
  assert.equal(iana.body.data.timing.timezone, -4);
  assert.equal(iana.body.data.timing.timeZoneId, 'America/New_York');
  assert.equal(iana.body.data.timing.evidence.timezoneEvidence.resolvedOffsetHours, -4);
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

test('公开 API 八字提示词接口默认只返回提示词', async () => {
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
  assert.deepEqual(Object.keys(body.data), ['prompt']);
  const prompt = body.data.prompt;
  assertPromptHasSingleRole(prompt, PROMPT_ROLE_TEXT.bazi);
  assert.match(prompt, /【排盘信息】/);
  assert.match(prompt, /核心判断/);
  assert.match(prompt, /【四柱】/);
  assert.match(prompt, /我适合创业还是上班/);
  assert.doesNotMatch(prompt, /结构化证据|证据汇总|解释边界|计算链/);
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
      responseMode: 'summary',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.result, undefined);
  assert.equal(body.data.resultSummary.bazi.gender, 'female');
  assert.equal(body.data.resultSummary.ziwei.scopeNames.includes('yearly'), true);
  assert.ok(JSON.stringify(body.data.resultSummary).length < 50000);
  assertPromptHasSingleRole(body.data.prompt, PROMPT_ROLE_TEXT['bazi-ziwei']);
  assert.match(body.data.prompt, /【八字排盘信息】/);
  assert.match(body.data.prompt, /【紫微盘面信息】/);
  assert.match(body.data.prompt, /【任务】/);
  assert.match(body.data.prompt, /我现在适合换工作还是继续等待/);
  assert.doesNotMatch(body.data.prompt, /结构化证据|证据汇总|解释边界|计算链/);
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
  assert.match(prompt, /【任务】\n请重点分析事业，并直接回答【问题】。/);
  assert.doesNotMatch(prompt, /若【问题】|按通用.*口径|问题未限定/);
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
      /【任务】\n请重点分析[^，]+，并直接回答【问题】。/,
      `${topic} 应只把主题作为范围`,
    );
    assert.doesNotMatch(prompt, /若【问题】|按通用.*口径|问题未限定/);
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

test('八字提示词按流派输出不同任务、依据与盘面证据', () => {
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

  const ziping = buildBaziPromptForResult({
    result,
    question: '整体命局如何判断？',
    school: 'ziping',
  });
  assert.match(ziping, /八字流派：子平派（传统）/);
  assert.match(ziping, /月令与节候：/);
  assert.match(ziping, /《子平真诠》/);
  assert.match(ziping, /流派任务：先以月令定格/);

  const mangpai = buildBaziPromptForResult({
    result,
    question: '整体命局如何判断？',
    school: 'mangpai',
  });
  assert.match(mangpai, /八字流派：盲派/);
  assert.match(mangpai, /四柱宫位与十神/);
  assert.match(mangpai, /四柱组合与做功线索：/);
  assert.match(mangpai, /主宾定位：/);
  assert.match(mangpai, /主位为日柱.+与时柱/);
  assert.match(mangpai, /十神显隐：/);
  assert.match(mangpai, /墓库与空亡：/);
  assert.match(mangpai, /分柱年限：年柱约对应1至16岁/);
  assert.match(mangpai, /《渊海子平》/);
  assert.notEqual(ziping, mangpai);

  const xinpai = buildBaziPromptForResult({
    result,
    question: '整体命局如何判断？',
    school: 'xinpai',
  });
  assert.match(xinpai, /八字流派：新派/);
  assert.match(xinpai, /旺衰判定：/);
  assert.match(xinpai, /旺衰依据：/);
  assert.match(xinpai, /十神流通：/);
  assert.match(xinpai, /喜忌落位：/);
  assert.match(xinpai, /动态岁运：/);
  assert.doesNotMatch(xinpai, /不把旺相休囚死|限制事实|工程上下文/);
  assert.notEqual(mangpai, xinpai);
  assert.doesNotMatch(`${mangpai}\n${xinpai}`, /undefined|\[object Object\]/);

  const legacy = buildBaziPromptForResult({
    result,
    question: '整体命局如何判断？',
    school: 'traditional',
  });
  assert.match(legacy, /八字流派：子平派（传统）/);
});

test('公开 API 八字年限提示词保留岁运资料但不拼接工程证据话术', async () => {
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
      baziFortuneYear: 1998,
      responseMode: 'summary',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.data.resultSummary.fortuneSelection, undefined);
  assert.ok(JSON.stringify(body.data.resultSummary).length < 20000);
  assert.match(body.data.prompt, /【分析对象】/);
  assert.match(body.data.prompt, /【岁运重点】/);
  assert.match(body.data.prompt, /这一年的事业触发有哪些/);
  assert.doesNotMatch(body.data.prompt, /结构化证据|证据汇总|解释边界|计算链/);
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

test('公开 API 紫微提示词接口默认只返回提示词', async () => {
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
  assert.deepEqual(Object.keys(body.data), ['prompt']);
  const prompt = body.data.prompt;
  assertPromptHasSingleRole(prompt, PROMPT_ROLE_TEXT.ziwei);
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
    body: JSON.stringify({ person1, person2, detailMode: 'full' }),
  });

  assert.equal(calculation.response.status, 200);
  assert.deepEqual(calculation.body.data.compatibility.people, {
    person1: '甲方',
    person2: '乙方',
  });
  const compatibility = calculation.body.data.compatibility;
  assert.equal(compatibility.key, 'ziwei:compatibility:evidence');
  assert.equal(compatibility.status, '已计算');
  assert.equal(compatibility.calculationSteps.length, 6);
  assert.ok(compatibility.palaceOverlays.length > 0);
  assert.ok(
    compatibility.palaceOverlays.every(
      (item: Record<string, unknown>) =>
        String(item.key).startsWith('宫位叠盘:') &&
        item.status === '已命中' &&
        Array.isArray(item.sources) &&
        item.sources.length >= 2 &&
        String(item.calculation).length > 0 &&
        String(item.limitation).includes('不单独证明关系吉凶'),
    ),
  );
  assert.ok(
    compatibility.crossMutagenPlacements.every(
      (item: Record<string, unknown>) =>
        String(item.key).startsWith('跨盘四化:') &&
        item.status === '已命中' &&
        Array.isArray(item.sources) &&
        item.sources.length >= 2 &&
        String(item.promptText).length > 0 &&
        String(item.limitation).includes('不直接等于关系吉凶'),
    ),
  );
  assert.equal(compatibility.summaryFact.palaceOverlayCount, compatibility.palaceOverlays.length);
  assert.equal(
    compatibility.summaryFact.crossMutagenPlacementCount,
    compatibility.crossMutagenPlacements.length,
  );
  assert.equal(compatibility.counterEvidenceFacts.length, 5);
  assert.ok(
    compatibility.limitationFacts.some((item: { type: string }) => item.type === '高风险输出边界'),
  );
  assertEvidenceOwnerReferences(compatibility);
  assert.ok(compatibility.evidence.items.length > 0);
  assert.doesNotMatch(
    compatibility.promptText,
    /analysis_payload_v1|命语|本项目|项目统一|工程|接口|API|MCP|ziwei:compatibility:/,
  );
  assertPromptIsPortableTaskText(compatibility.promptText);
  assert.equal(calculation.body.data.charts.person1.scopeNames[0], 'origin');

  const prompted = await callApi('ziwei/compatibility/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      person1,
      person2,
      question: '双方长期合作关系应注意什么？',
      promptTopic: 'career-wealth',
      schools: ['sanhe', 'feixing', 'sihua'],
      responseMode: 'summary',
    }),
  });

  assert.equal(prompted.response.status, 200);
  assert.equal(prompted.body.data.result, undefined);
  assert.equal(prompted.body.data.resultSummary.people.person1, '甲方');
  assert.equal(prompted.body.data.resultSummary.key, 'ziwei:compatibility:evidence');
  assert.equal(prompted.body.data.resultSummary.summaryFact.palaceOverlayCount > 0, true);
  assert.ok(JSON.stringify(prompted.body.data.resultSummary).length < 5000);
  assert.match(prompted.body.data.prompt, /【甲方盘面】/);
  assert.match(prompted.body.data.prompt, /【双盘关系资料】/);
  assert.match(prompted.body.data.prompt, /宫位对应：/);
  assert.match(prompted.body.data.prompt, /双方长期合作关系应注意什么/);
  assert.match(prompted.body.data.prompt, /【多派合参】/);
  assert.match(prompted.body.data.prompt, /三合派/);
  assert.match(prompted.body.data.prompt, /飞星派/);
  assert.match(prompted.body.data.prompt, /四化派/);
  assert.doesNotMatch(
    prompted.body.data.prompt,
    /结构化证据|证据汇总|解释边界|计算链|边界：宫位叠盘/,
  );
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
      responseMode: 'summary',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.deepEqual(body.data.resultSummary.scopeNames, ['origin', 'yearly']);
  assert.equal(body.data.resultSummary.activeScopes.yearly.active_scope.scope, 'yearly');
  assert.equal(body.data.resultSummary.activeScopes.decadal, undefined);
  assert.equal(body.data.resultSummary.evidenceSummaryByScope.yearly.status, '已计算');
  assert.ok(body.data.resultSummary.evidenceSummaryByScope.yearly.summaryFact);
  assert.equal(body.data.resultSummary.patternSummaryByScope.yearly.status, '已计算');
  assert.ok(body.data.resultSummary.patternSummaryByScope.yearly.summaryFact);
  const prompt = body.data.prompt;
  assert.match(prompt, /分析范围：流年/);
  assert.match(prompt, /【重点宫位资料】/);
  assert.match(prompt, /【任务】/);
  assert.doesNotMatch(prompt, /结构化证据|证据汇总|解释边界|计算链/);
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
      responseMode: 'summary',
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
  assert.ok(JSON.stringify(body.data.resultSummary).length < 50000);
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
  assert.match(prompt, /【任务】/);
  assert.doesNotMatch(prompt, /主题只作为|不额外套用|解读方法|推断顺序/);
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
  assert.match(prompt, /【任务】/);
  assert.doesNotMatch(prompt, /主题只作为|不额外套用|解读方法|推断顺序/);
  assert.doesNotMatch(prompt, /重点参考宫位：官禄宫、迁移宫、财帛宫、命宫/);
});

test('紫微提示词按三合、飞星、四化流派输出对应任务与依据', async () => {
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

  const prompts = {
    sanhe: buildZiweiPromptForRuntime({
      result: runtime,
      question: '整体命局如何判断？',
      school: 'sanhe',
    }),
    feixing: buildZiweiPromptForRuntime({
      result: runtime,
      question: '整体命局如何判断？',
      school: 'feixing',
    }),
    sihua: buildZiweiPromptForRuntime({
      result: runtime,
      question: '整体命局如何判断？',
      school: 'sihua',
    }),
  };

  assert.match(prompts.sanhe, /紫微流派：三合派/);
  assert.match(prompts.sanhe, /命宫、身宫/);
  assert.match(prompts.sanhe, /《紫微斗数全书》/);
  assert.match(prompts.feixing, /紫微流派：飞星派/);
  assert.match(prompts.feixing, /生年四化/);
  assert.match(prompts.feixing, /飞化落宫/);
  assert.match(prompts.feixing, /后世飞星派读法/);
  assert.match(prompts.sihua, /紫微流派：四化派/);
  assert.match(prompts.sihua, /禄、权、科、忌落宫/);
  assert.match(prompts.sihua, /十干四化/);
  Object.values(prompts).forEach((prompt) => {
    assert.match(prompt, /【流派】/);
    assert.doesNotMatch(prompt, /排盘口径|项目|API|MCP|工程/);
    assertPromptIsPortableTaskText(prompt);
  });
});

test('紫微中州派安星口径进入底层排盘与可复制提示词', async () => {
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
      algorithm: 'zhongzhou',
    }),
  );

  assert.equal(runtime.payloadByScope.origin.calculation_config.algorithm, 'zhongzhou');
  const prompt = buildZiweiPromptForRuntime({
    result: runtime,
    question: '整体命局如何判断？',
  });
  assert.match(prompt, /安星口径：中州派安星法/);
  assert.doesNotMatch(prompt, /iztro|项目|API|MCP|工程/);
  assertPromptIsPortableTaskText(prompt);
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
  assert.match(body.data.prompt, /【重点宫位资料】/);
  assert.doesNotMatch(body.data.prompt, /【输出要求】/);
  assert.doesNotMatch(body.data.prompt, /主题只作为|自由问答|解读方法|推断顺序/);
});

test('公开 API 紫微支持中州派底层安星口径', async () => {
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
      algorithm: 'zhongzhou',
      question: '请先做整体解读。',
      responseMode: 'full',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.result.payloadByScope.origin.calculation_config.algorithm, 'zhongzhou');
  assert.match(body.data.prompt, /安星口径：中州派安星法/);
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
      detailMode: 'full',
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
  assert.equal(body.data.trueSolarEvidence.status, '已计算');
  assert.equal(body.data.trueSolarEvidence.calculationSteps.length, 7);
  assert.equal(body.data.trueSolarEvidence.summaryFact.status, '证据链完整');

  const iana = await callApi('ziwei/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: '纽约测试',
      gender: 'male',
      dateType: 'solar',
      year: '2024',
      month: '7',
      day: '1',
      useTrueSolarTime: true,
      birthHour: '12',
      birthMinute: '0',
      birthLongitude: '-74.006',
      timeZoneId: 'America/New_York',
      detailMode: 'full',
    }),
  });
  assert.equal(iana.response.status, 200);
  assert.equal(iana.body.data.trueSolarEvidence.timezoneEvidence.resolvedOffsetHours, -4);

  const promptResult = await callApi('ziwei/prompt', {
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
      question: '请分析整体命盘。',
      responseMode: 'full',
    }),
  });
  assert.equal(promptResult.response.status, 200);
  assert.equal(promptResult.body.data.result.trueSolarEvidence.status, '已计算');
  assert.match(promptResult.body.data.prompt, /【出生时间校正】/);
  assert.match(promptResult.body.data.prompt, /真太阳时：[\s\S]*时辰：/);
  assert.doesNotMatch(
    promptResult.body.data.prompt,
    /已核验|未请求|经度时差|均时差|总校正|校正后唯一时辰|计算步骤：|候选时辰|敏感性结果|缺时柱命盘/,
  );
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
      detailMode: 'full',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.deepEqual(body.data.scopeNames, ['origin', 'monthly']);
  assert.equal(body.data.payloadByScope.monthly.active_scope.scope, 'monthly');
  assert.equal(body.data.payloadByScope.yearly, undefined);
  const monthlyPalaces = body.data.payloadByScope.monthly.palaces as Array<{
    index: number;
    name: string;
    dynamic_scope_name?: string;
    scope_stars: unknown[];
    scope_hits: string[];
    mutaged_palaces?: unknown[];
    self_mutagens?: string[];
  }>;
  assert.ok(monthlyPalaces.every((palace) => palace.dynamic_scope_name));
  assert.ok(monthlyPalaces.some((palace) => palace.scope_stars.length > 0));
  assert.ok(monthlyPalaces.some((palace) => palace.scope_hits.includes('流月落宫')));
  assert.ok(monthlyPalaces.every((palace) => palace.mutaged_palaces?.length === 4));
  assert.ok(monthlyPalaces.every((palace) => Array.isArray(palace.self_mutagens)));
  const activeMonthlyPalace = monthlyPalaces.find(
    (palace) => palace.index === body.data.payloadByScope.monthly.active_scope.palace_index,
  );
  assert.equal(activeMonthlyPalace?.dynamic_scope_name, '命宫');
  assert.equal(
    body.data.payloadByScope.monthly.active_scope.palace_name,
    activeMonthlyPalace?.name,
  );
  assert.ok(
    body.data.payloadByScope.monthly.evidence_pool.every(
      (item: Record<string, unknown>) =>
        !('priority' in item) &&
        String(item.key).startsWith('ziwei:evidence:') &&
        (item.status === '已记录' || item.status === '资料缺口') &&
        Array.isArray(item.sources) &&
        item.sources.length > 0 &&
        String(item.calculationStepKey).startsWith('ziwei:evidence:calculation:'),
    ),
  );
  const evidenceAnalysis = body.data.payloadByScope.monthly.evidence_analysis;
  assert.equal(evidenceAnalysis.key, 'ziwei:evidence');
  assert.equal(evidenceAnalysis.calculationSteps.length, 4);
  assert.equal(
    evidenceAnalysis.summaryFact.evidenceFactCount,
    body.data.payloadByScope.monthly.evidence_pool.length,
  );
  assert.equal(evidenceAnalysis.counterEvidenceFacts.length, 3);
  assert.equal(evidenceAnalysis.limitationFacts.length, 5);
  assertEvidenceOwnerReferences(evidenceAnalysis);
  assert.ok(
    body.data.payloadByScope.monthly.patterns.every(
      (item: Record<string, unknown>) =>
        !('priority' in item) &&
        String(item.key).startsWith('ziwei:verified-pattern:') &&
        item.status === '已命中' &&
        Array.isArray(item.sources) &&
        item.sources.length > 0 &&
        item.calculationStepKey === 'ziwei:pattern:calculation:matched-facts',
    ),
  );
  const patternAnalysis = body.data.payloadByScope.monthly.pattern_analysis;
  assert.equal(patternAnalysis.key, 'ziwei:patterns');
  assert.equal(patternAnalysis.calculationSteps.length, 4);
  assert.equal(
    patternAnalysis.summaryFact.evaluatedRuleCount,
    patternAnalysis.summaryFact.registeredRuleCount,
  );
  assert.equal(
    patternAnalysis.summaryFact.matchedPatternCount,
    body.data.payloadByScope.monthly.patterns.length,
  );
  assert.equal(patternAnalysis.counterEvidenceFacts.length, 3);
  assert.equal(patternAnalysis.limitationFacts.length, 4);
  assertEvidenceOwnerReferences(patternAnalysis);
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
  assert.equal(body.data.evidenceSummaryByScope.monthly.status, '已计算');
  assert.ok(body.data.evidenceSummaryByScope.monthly.summaryFact.evidenceFactCount > 0);
  assert.equal(body.data.patternSummaryByScope.monthly.status, '已计算');
  assert.equal(
    body.data.patternSummaryByScope.monthly.summaryFact.evaluatedRuleCount,
    body.data.patternSummaryByScope.monthly.summaryFact.registeredRuleCount,
  );
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
    body: JSON.stringify({ spreadType: 'single', detailMode: 'full' }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.spreadType, 'single');
  assert.equal(body.data.cards.length, 1);
  assert.equal(typeof body.data.cards[0].name, 'string');
  assert.equal(body.data.meta.algorithm, 'tarot.single');
  assert.equal(body.data.evidenceAnalysis.key, 'tarot:evidence');
  assert.equal(body.data.evidenceAnalysis.status, '已计算');
  assert.equal(body.data.evidenceAnalysis.calculationSteps.length, 7);
  const tarotStepKeys = new Set(
    body.data.evidenceAnalysis.calculationSteps.map((item: Record<string, unknown>) => item.key),
  );
  assert.ok(
    body.data.evidenceAnalysis.calculationSteps.every(
      (item: Record<string, any>) =>
        item.status === '已计算' &&
        item.promptText &&
        Array.isArray(item.sources) &&
        item.sources.length > 0 &&
        Array.isArray(item.dependsOnStepKeys) &&
        item.dependsOnStepKeys.every((key: string) => tarotStepKeys.has(key)),
    ),
  );
  assert.equal(
    body.data.evidenceAnalysis.calculationChain.length,
    body.data.evidenceAnalysis.calculationSteps.length,
  );
  assert.equal(body.data.evidenceAnalysis.cards.length, 1);
  assert.equal(body.data.evidenceAnalysis.evidence.title, '塔罗牌位与牌面结构化证据');
  assert.equal(body.data.evidenceAnalysis.spreadCoverageFact.status, '完整');
  assert.deepEqual(body.data.evidenceAnalysis.spreadCoverageFact.cardFactKeys, [
    body.data.evidenceAnalysis.cards[0].key,
  ]);
  assert.equal(body.data.evidenceAnalysis.drawFact.status, '可核验');
  assert.equal(body.data.evidenceAnalysis.drawFact.deckSize, 78);
  assert.equal(body.data.evidenceAnalysis.drawFact.order.length, 1);
  assert.equal(body.data.evidenceAnalysis.drawOrderFacts.length, 1);
  assert.equal(body.data.evidenceAnalysis.drawOrderFacts[0].status, '一致');
  assert.deepEqual(body.data.evidenceAnalysis.drawFact.orderFactKeys, [
    body.data.evidenceAnalysis.drawOrderFacts[0].key,
  ]);
  assert.ok(body.data.evidenceAnalysis.drawFact.sources.length >= 2);
  assert.deepEqual(body.data.evidenceAnalysis.sequenceFacts, []);
  assert.deepEqual(body.data.evidenceAnalysis.elementInteractionFacts, []);
  assert.deepEqual(body.data.evidenceAnalysis.elementInteractions, []);
  assert.ok(body.data.evidenceAnalysis.themeFacts.length > 0);
  assert.equal(
    body.data.evidenceAnalysis.recurringThemes.length,
    body.data.evidenceAnalysis.recurringThemeFacts.length,
  );
  assert.equal(
    body.data.evidenceAnalysis.counterEvidence.length,
    body.data.evidenceAnalysis.counterEvidenceFacts.length,
  );
  assert.ok(
    ['有逆位约束', '未见逆位约束'].includes(body.data.evidenceAnalysis.counterSummaryFact.status),
  );
  assert.equal(body.data.evidenceAnalysis.limitationFacts.length, 6);
  assert.ok(
    body.data.evidenceAnalysis.limitationFacts.every(
      (item: Record<string, any>) =>
        Array.isArray(item.ownerFactKeys) &&
        item.ownerFactKeys.length > 0 &&
        item.ownerFactKeys.every(
          (key: string) =>
            key === body.data.evidenceAnalysis.summaryFact.key ||
            body.data.evidenceAnalysis.summaryFact.factKeys.includes(key),
        ),
    ),
  );
  assert.equal(
    body.data.evidenceAnalysis.limitations.length,
    body.data.evidenceAnalysis.limitationFacts.length,
  );
  assert.equal(body.data.evidenceAnalysis.randomFact.status, '可重放');
  assert.equal(
    body.data.evidenceAnalysis.randomFact.sampleCount,
    body.data.meta.random.samples.length,
  );
  assert.ok(body.data.evidenceAnalysis.randomFact.sources.length >= 2);
  assert.equal(body.data.evidenceAnalysis.traditionalFacts.length, 1);
  assert.equal(
    body.data.evidenceAnalysis.cards[0].traditionalFactKey,
    body.data.evidenceAnalysis.traditionalFacts[0].key,
  );
  assert.equal(body.data.evidenceAnalysis.summaryFact.key, 'tarot:evidence-summary');
  assert.equal(body.data.evidenceAnalysis.summaryFact.status, '证据链完整');
  assert.equal(
    body.data.evidenceAnalysis.summaryFact.cardFactCount,
    body.data.evidenceAnalysis.cards.length,
  );
  assert.equal(
    body.data.evidenceAnalysis.summaryFact.drawOrderFactCount,
    body.data.evidenceAnalysis.drawOrderFacts.length,
  );
  assert.equal(
    body.data.evidenceAnalysis.summaryFact.sequenceFactCount,
    body.data.evidenceAnalysis.sequenceFacts.length,
  );
  assert.equal(
    body.data.evidenceAnalysis.summaryFact.elementInteractionFactCount,
    body.data.evidenceAnalysis.elementInteractionFacts.length,
  );
  assert.equal(
    body.data.evidenceAnalysis.summaryFact.themeFactCount,
    body.data.evidenceAnalysis.themeFacts.length,
  );
  assert.equal(
    body.data.evidenceAnalysis.summaryFact.recurringThemeFactCount,
    body.data.evidenceAnalysis.recurringThemeFacts.length,
  );
  assert.equal(
    body.data.evidenceAnalysis.summaryFact.counterEvidenceCount,
    body.data.evidenceAnalysis.counterEvidenceFacts.length,
  );
  assert.equal(
    body.data.evidenceAnalysis.summaryFact.traditionalFactCount,
    body.data.evidenceAnalysis.traditionalFacts.length,
  );
  assert.ok(
    body.data.evidenceAnalysis.traditionalFacts.every(
      (item: Record<string, unknown>) =>
        item.originalText &&
        item.promptText &&
        Array.isArray(item.sources) &&
        item.sources.length > 0 &&
        String(item.limitation).includes('不证明现实事件'),
    ),
  );
  const tarotPromptResponse = await callApi('divination/tarot/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      spreadType: 'single',
      seed: '公开接口塔罗证据链',
      question: '当前有哪些可核验线索？',
      schools: ['rws', 'yuansu'],
    }),
  });
  assert.equal(tarotPromptResponse.response.status, 200);
  assert.match(tarotPromptResponse.body.data.prompt, /占法：塔罗/);
  assert.match(tarotPromptResponse.body.data.prompt, /核心结构：牌阵/);
  assert.match(tarotPromptResponse.body.data.prompt, /正位|逆位/);
  assert.match(tarotPromptResponse.body.data.prompt, /【多口径合参】/);
  assert.match(tarotPromptResponse.body.data.prompt, /流派1：RWS 图像法/);
  assert.match(tarotPromptResponse.body.data.prompt, /断法2：元素与数序法/);
  assert.doesNotMatch(
    tarotPromptResponse.body.data.prompt,
    /结构化证据|计算链|证据汇总|解释限制|解释边界/,
  );
  assertPromptIsPortableTaskText(tarotPromptResponse.body.data.prompt);
  assert.doesNotMatch(JSON.stringify(body.data), /成功率为\d|吉凶总分[：=]\d|能量分数[：=]\d/);
});

test('公开 API 灵签应返回签号、签题与签诗', async () => {
  const drawn = await callApi('divination/ssgw', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ replay: [0.1, 0.1, 0.9] }),
  });
  assert.equal(drawn.response.status, 200);
  assert.equal(typeof drawn.body.data.number, 'number');
  assert.ok(drawn.body.data.title);
  assert.ok(drawn.body.data.poem);
  assert.equal(typeof drawn.body.data.timestamp, 'number');
  assert.ok(drawn.body.data.ganzhi.year);
  assert.equal(drawn.body.data.draw.method, 'random');
  assert.equal(drawn.body.data.ritual, undefined);
  assert.equal(drawn.body.data.evidenceAnalysis, undefined);

  const prompt = await callApi('divination/ssgw/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: '这件事接下来该怎么推进？',
      replay: [0.1, 0.1, 0.9],
    }),
  });
  assert.equal(prompt.response.status, 200);
  assert.match(prompt.body.data.prompt, /占法：三山国王灵签/);
  assert.match(prompt.body.data.prompt, /签号：第\d+签/);
  assert.match(prompt.body.data.prompt, /签题：《.+》/);
  assert.match(prompt.body.data.prompt, /签诗：/);
  assert.doesNotMatch(
    prompt.body.data.prompt,
    /掷筊|仪式|证据|限制|阴杯|rejected|使用简体中文|中文输出|【输出要求】|解读派系|多派合参/,
  );
  assertPromptIsPortableTaskText(prompt.body.data.prompt);

  const unsupportedSchools = await callApi('divination/ssgw/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: '这件事接下来该怎么推进？',
      schools: ['任意值'],
    }),
  });
  assert.equal(unsupportedSchools.response.status, 400);
  assert.equal(unsupportedSchools.body.error.code, 'BAD_REQUEST');
  assert.match(unsupportedSchools.body.error.message, /不提供解读流派或断法选择/);
});

test('公开 API 应拒绝空、重复、超量和非法的派系数组', async () => {
  for (const schools of [[], ['rws', 'rws'], ['rws', 'yuansu', 'narrative', 'rws'], ['unknown']]) {
    const { response, body } = await callApi('divination/tarot/prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: '近期重点是什么？', schools }),
    });
    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'BAD_REQUEST');
  }
});

test('公开 API 六爻支持模拟三钱投掷并可按随机轨迹重放', async () => {
  const input = {
    customDate: '2025-01-01T08:00:00+08:00',
    liuyaoMethod: 'coins',
    seed: '公开接口固定样例',
    detailMode: 'full',
  };
  const first = await callApi('divination/liuyao', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  assert.equal(first.response.status, 200);
  assert.equal(first.body.data.generation.method, 'coins');
  assert.equal(first.body.data.generation.coinThrows.length, 6);
  assert.equal(first.body.data.evidenceAnalysis.key, 'liuyao:evidence');
  assert.equal(first.body.data.evidenceAnalysis.status, '已计算');
  assert.equal(first.body.data.evidenceAnalysis.calculationSteps.length, 7);
  assert.equal(first.body.data.evidenceAnalysis.calculationChain.length, 7);
  assert.ok(first.body.data.evidenceAnalysis.candidates.length > 0);
  assert.equal(first.body.data.evidenceAnalysis.selectionFact.status, '已选定候选');
  assert.equal(first.body.data.evidenceAnalysis.lineCoverageFact.status, '完整');
  assert.deepEqual(
    first.body.data.evidenceAnalysis.lineCoverageFact.actualPositions,
    [1, 2, 3, 4, 5, 6],
  );
  assert.equal(first.body.data.evidenceAnalysis.lineFacts.length, 6);
  assert.equal(
    first.body.data.evidenceAnalysis.hiddenSpiritFacts.length,
    first.body.data.hiddenSpirits?.length ?? 0,
  );
  assert.ok(
    first.body.data.evidenceAnalysis.lineFacts.every(
      (item: Record<string, unknown>) =>
        item.status === '已计算' &&
        item.promptText &&
        Array.isArray(item.sources) &&
        item.sources.length >= 3 &&
        String(item.limitation).includes('不单独证明现实吉凶'),
    ),
  );
  assert.ok(
    first.body.data.evidenceAnalysis.candidates.every(
      (item: Record<string, unknown>) =>
        String(item.key).startsWith('liuyao:candidate:') &&
        item.status &&
        item.sourceStatus &&
        Array.isArray(item.referenceKeys) &&
        item.promptText &&
        Array.isArray(item.sources) &&
        String(item.limitation).includes('候选不等于已证明现实事项'),
    ),
  );
  assert.equal(
    first.body.data.evidenceAnalysis.counterSummaryFact.factKeys.length,
    first.body.data.evidenceAnalysis.counterEvidenceFacts.length,
  );
  assert.ok(
    first.body.data.evidenceAnalysis.counterEvidenceFacts.every(
      (item: Record<string, unknown>) =>
        String(item.key).startsWith('liuyao:counter:') &&
        item.status === '已触发' &&
        item.ownerCandidateKey &&
        Array.isArray(item.sources) &&
        String(item.limitation).includes('不得把单项反证直接写成现实失败'),
    ),
  );
  assert.equal(
    first.body.data.evidenceAnalysis.timingSummaryFact.factKeys.length,
    first.body.data.evidenceAnalysis.timingFacts.length,
  );
  assert.equal(first.body.data.evidenceAnalysis.summaryFact.status, '证据链完整');
  assert.equal(
    first.body.data.evidenceAnalysis.summaryFact.lineFactCount,
    first.body.data.evidenceAnalysis.lineFacts.length,
  );
  assert.equal(
    first.body.data.evidenceAnalysis.summaryFact.counterEvidenceCount,
    first.body.data.evidenceAnalysis.counterEvidenceFacts.length,
  );
  assert.equal(first.body.data.evidenceAnalysis.limitationFacts.length, 6);
  assert.equal(
    first.body.data.evidenceAnalysis.limitations.length,
    first.body.data.evidenceAnalysis.limitationFacts.length,
  );
  assert.ok(
    first.body.data.evidenceAnalysis.timingFacts.every(
      (item: Record<string, unknown>) =>
        String(item.key).startsWith('liuyao:timing:') &&
        item.promptText &&
        Array.isArray(item.sources) &&
        String(item.limitation).includes('不得把爻位'),
    ),
  );
  assert.match(first.body.data.evidenceAnalysis.promptText, /【六爻用神作用链结构化证据】/);
  assert.match(first.body.data.evidenceAnalysis.promptText, /六爻逐爻计算事实/);
  assert.match(first.body.data.evidenceAnalysis.promptText, /证据汇总：/);
  assert.match(first.body.data.evidenceAnalysis.promptText, /解释限制：/);
  assert.doesNotMatch(first.body.data.evidenceAnalysis.promptText, /权重[：=]?\d/);
  assertPromptIsPortableTaskText(first.body.data.evidenceAnalysis.promptText);
  assert.equal(first.body.data.evidenceAnalysis.generationFact.status, '可核验');
  assert.equal(first.body.data.evidenceAnalysis.generationFact.method, 'coins');
  assert.equal(first.body.data.evidenceAnalysis.generationFact.coinThrows.length, 6);
  assert.equal(first.body.data.evidenceAnalysis.generationFact.recordedLineCount, 6);
  assert.ok(first.body.data.evidenceAnalysis.generationFact.sources.length >= 2);
  assert.equal(first.body.data.evidenceAnalysis.randomFact.status, '可重放');
  assert.equal(first.body.data.evidenceAnalysis.randomFact.seed, '公开接口固定样例');
  assert.equal(first.body.data.evidenceAnalysis.randomFact.sampleCount, 18);
  assert.doesNotMatch(first.body.data.evidenceAnalysis.randomFact.promptText, /公开接口固定样例/);

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
    body: JSON.stringify({ customDate, detailMode: 'full' }),
  });
  assert.equal(defaultResult.response.status, 200);
  assert.equal(defaultResult.body.ok, true);
  assert.equal(defaultResult.body.data.method, 'zhuanpan');
  assert.equal(defaultResult.body.data.evidenceAnalysis.key, 'qimen:evidence');
  assert.equal(defaultResult.body.data.evidenceAnalysis.status, '已计算');
  assert.ok(defaultResult.body.data.evidenceAnalysis.candidates.length > 0);
  assert.equal(defaultResult.body.data.evidenceAnalysis.calculationEvidenceFacts.length, 5);
  assert.equal(defaultResult.body.data.evidenceAnalysis.calculationSteps.length, 5);
  assert.equal(defaultResult.body.data.evidenceAnalysis.calculationChain.length, 5);
  assert.equal(defaultResult.body.data.evidenceAnalysis.ruleSourceFacts.length, 4);
  assert.equal(defaultResult.body.data.evidenceAnalysis.palaceCoverageFact.status, '完整');
  assert.deepEqual(
    defaultResult.body.data.evidenceAnalysis.palaceCoverageFact.actualGongs,
    [1, 2, 3, 4, 5, 6, 7, 8, 9],
  );
  assert.ok(
    defaultResult.body.data.evidenceAnalysis.calculationEvidenceFacts.every(
      (item: Record<string, unknown>) =>
        String(item.key).startsWith('qimen:calculation:') &&
        item.status === '已确定' &&
        item.promptText &&
        Array.isArray(item.sourceKeys) &&
        String(item.limitation).includes('不证明现实吉凶'),
    ),
  );
  assert.ok(
    defaultResult.body.data.evidenceAnalysis.ruleSourceFacts.every(
      (item: Record<string, unknown>) =>
        String(item.key).startsWith('rule:qimen:') &&
        item.status === '已声明' &&
        item.rule &&
        Array.isArray(item.sources) &&
        item.sources.length > 0 &&
        item.promptText &&
        String(item.limitation).includes('不等于现代实证验证'),
    ),
  );
  assert.equal(
    defaultResult.body.data.evidenceAnalysis.palaceFacts.length,
    defaultResult.body.data.jiuGongGe.length,
  );
  assert.ok(
    defaultResult.body.data.evidenceAnalysis.palaceFacts.every(
      (item: Record<string, unknown>) =>
        item.status === '已计算' &&
        item.promptText &&
        Array.isArray(item.sources) &&
        item.sources.length >= 3 &&
        Array.isArray(item.patternFactKeys) &&
        Array.isArray(item.stemRelationFacts) &&
        Array.isArray(item.insights) &&
        String(item.limitation).includes('不单独证明现实吉凶'),
    ),
  );
  assert.ok(
    defaultResult.body.data.evidenceAnalysis.candidates.every((item: { palaceFactKey: string }) =>
      defaultResult.body.data.evidenceAnalysis.palaceFacts.some(
        (fact: { key: string }) => fact.key === item.palaceFactKey,
      ),
    ),
  );
  assert.equal(
    defaultResult.body.data.evidenceAnalysis.relations.length,
    Math.max(0, defaultResult.body.data.evidenceAnalysis.candidates.length - 1),
  );
  assert.ok(
    defaultResult.body.data.evidenceAnalysis.relations.every(
      (item: Record<string, unknown>) =>
        String(item.key).startsWith('qimen:relation:') &&
        item.fromPalaceFactKey &&
        item.toPalaceFactKey &&
        item.promptText &&
        Array.isArray(item.sources) &&
        String(item.limitation).includes('不证明现实中的支持'),
    ),
  );
  assert.equal(
    defaultResult.body.data.evidenceAnalysis.counterSummaryFact.factKeys.length,
    defaultResult.body.data.evidenceAnalysis.counterEvidenceFacts.length,
  );
  assert.ok(
    defaultResult.body.data.evidenceAnalysis.counterEvidenceFacts.every(
      (item: Record<string, unknown>) =>
        String(item.key).startsWith('qimen:counter:') &&
        item.status === '已触发' &&
        item.ownerPalaceFactKey &&
        Array.isArray(item.sources) &&
        String(item.limitation).includes('不得把单项限制直接写成现实失败'),
    ),
  );
  assert.ok(
    defaultResult.body.data.evidenceAnalysis.timingFacts.every(
      (item: Record<string, unknown>) =>
        String(item.key).startsWith('qimen:timing:') &&
        item.promptText &&
        Array.isArray(item.sources) &&
        String(item.limitation).includes('不得换算唯一日期'),
    ),
  );
  assert.equal(
    defaultResult.body.data.evidenceAnalysis.timingSummaryFact.factKeys.length,
    defaultResult.body.data.evidenceAnalysis.timingFacts.length,
  );
  assert.equal(defaultResult.body.data.evidenceAnalysis.summaryFact.status, '证据链完整');
  assert.equal(
    defaultResult.body.data.evidenceAnalysis.summaryFact.palaceFactCount,
    defaultResult.body.data.evidenceAnalysis.palaceFacts.length,
  );
  assert.equal(defaultResult.body.data.evidenceAnalysis.limitationFacts.length, 6);
  assert.equal(
    defaultResult.body.data.evidenceAnalysis.limitations.length,
    defaultResult.body.data.evidenceAnalysis.limitationFacts.length,
  );
  assert.ok(
    defaultResult.body.data.evidenceAnalysis.directionFacts.every(
      (item: Record<string, unknown>) =>
        String(item.key).startsWith('qimen:direction:') &&
        item.palaceFactKey &&
        item.promptText &&
        Array.isArray(item.sources) &&
        String(item.limitation).includes('必须核实现实路线'),
    ),
  );
  assert.match(
    defaultResult.body.data.evidenceAnalysis.promptText,
    /【奇门用神宫与宫间作用结构化证据】/,
  );
  assert.match(defaultResult.body.data.evidenceAnalysis.promptText, /奇门九宫逐宫计算事实/);
  assert.match(defaultResult.body.data.evidenceAnalysis.promptText, /证据汇总：/);
  assert.doesNotMatch(
    defaultResult.body.data.evidenceAnalysis.promptText,
    /主宫评分|辅宫评分|评分-?\d+|（-?\d+分|成功率[：=]?\d|项目以|项目规则|项目计算|命语|本项目|项目统一|工程|算法结果/,
  );
  assertPromptIsPortableTaskText(defaultResult.body.data.evidenceAnalysis.promptText);
  assert.deepEqual(
    defaultResult.body.data.jiuGongGe.map(
      (gong: { tianPan: { star: string } }) => gong.tianPan.star,
    ),
    zhuanpanStars,
  );

  const feipanResult = await callApi('divination/qimen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customDate, qimenMethod: 'feipan', detailMode: 'full' }),
  });
  assert.equal(feipanResult.response.status, 200);
  assert.equal(feipanResult.body.ok, true);
  assert.equal(feipanResult.body.data.method, 'feipan');
  assert.ok(
    feipanResult.body.data.evidenceAnalysis.ruleSourceFacts.some((item: { promptText: string }) =>
      item.promptText.includes('飞盘法九宫规则'),
    ),
  );
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
  assert.equal(feipanPrompt.body.data.result.evidenceAnalysis.key, 'qimen:evidence');
  assert.equal(feipanPrompt.body.data.result.evidenceAnalysis.limitationFacts.length, 6);
  assert.deepEqual(
    feipanPrompt.body.data.result.jiuGongGe.map(
      (gong: { tianPan: { star: string } }) => gong.tianPan.star,
    ),
    feipanStars,
  );
});

test('公开 API 八字年限范围缺少必要层级参数时应拒绝而非套用第一项', async () => {
  const base = {
    gender: 'male',
    year: 1990,
    month: 5,
    day: 15,
    timeIndex: 1,
    dateType: 'solar',
    question: '请分析指定年限。',
  };
  const cases = [
    { ...base, baziFortuneScope: 'dayun' },
    { ...base, baziFortuneScope: 'year', baziFortuneCycleIndex: 1 },
    { ...base, baziFortuneScope: 'month', baziFortuneYear: 1998 },
    {
      ...base,
      baziFortuneScope: 'day',
      baziFortuneYear: 1998,
      baziFortuneMonth: 1,
    },
  ];

  for (const payload of cases) {
    const { response, body } = await callApi('bazi/prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(response.status, 400, JSON.stringify(payload));
    assert.equal(body.error.code, 'BAD_REQUEST');
  }
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
  assert.ok(
    fullResult.body.data.classicPatterns.every(
      (pattern: Record<string, unknown>) => pattern.score === undefined,
    ),
  );
  assert.ok(
    fullResult.body.data.patternCombos.every(
      (combo: Record<string, unknown>) => combo.score === undefined,
    ),
  );
  assert.ok(
    [
      ...(fullResult.body.data.directions?.goodDirections ?? []),
      ...(fullResult.body.data.directions?.avoidDirections ?? []),
    ].every((direction: Record<string, unknown>) => direction.score === undefined),
  );
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
  assert.ok(
    compactResult.body.data.patternCombos.every(
      (combo: Record<string, unknown>) => combo.score === undefined,
    ),
  );
  assert.ok(
    compactResult.body.data.classicPatterns.every(
      (pattern: Record<string, unknown>) => pattern.score === undefined,
    ),
  );
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
  for (const direction of compactDirections) {
    assert.equal(direction.score, undefined);
    assert.ok(Array.isArray(direction.reasons));
    assert.ok(direction.reasons.length > 0);
  }
});

test('公开 API 占卜提示词默认只返回提示词', async () => {
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
  assert.deepEqual(Object.keys(body.data), ['prompt']);
  assert.match(body.data.prompt, /我近期事业应该注意什么/);
});

test('公开 API 占卜提示词显式摘要不应包含完整证据长文', async () => {
  const { response, body } = await callApi('divination/qimen/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customDate: '2025-01-01T08:00:00+08:00',
      question: '我近期事业应该注意什么？',
      responseMode: 'summary',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.data.summary.title, '奇门起局结果');
  assert.ok(Array.isArray(body.data.summary.lines));
  assert.doesNotMatch(body.data.summary.lines.join('\n'), /证据：/);
  assert.ok(JSON.stringify(body.data.summary).length < 5000);
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
  const paths = ['divination/liuyao', 'divination/meihua', 'divination/qimen', 'divination/liuren'];
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

test('公开 API 奇门应期只输出触发条件，不输出主观加快或延迟结论', async () => {
  const qimen = await callApi('divination/qimen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customDate: '2025-01-01T06:00:00+08:00' }),
  });
  assert.equal(qimen.response.status, 200);
  assert.equal(qimen.body.data.yingQi.minDays, undefined);
  assert.equal(qimen.body.data.yingQi.maxDays, undefined);
  assert.ok(qimen.body.data.yingQi.triggerConditions.length > 0);
  assert.doesNotMatch(
    JSON.stringify(qimen.body.data.yingQi),
    /加快约\d+%|延迟约\d+%|大吉格|大凶格|显著加快|显著延迟/,
  );
});

test('公开 API 梅花数字起卦应拒绝超出安全整数范围的数字', async () => {
  const unsafeInteger = Number.MAX_SAFE_INTEGER + 1;
  const cases: Array<[string, Record<string, unknown>, string]> = [
    ['divination/meihua', { method: 'number', number: unsafeInteger }, 'number 必须是整数。'],
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

test('公开 API 星盘应附带真太阳时参考且不改写现代星历时刻', async () => {
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
      timeZoneId: 'Asia/Shanghai',
      locationName: '喀什',
      useTrueSolarTime: true,
      detailMode: 'full',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.birth.isTrueSolarTime, true);
  assert.equal(body.data.birth.dateTime, '1995-05-20 01:20');
  assert.equal(body.data.birth.trueSolarEvidence.status, '已计算');
  assert.equal(body.data.birth.trueSolarEvidence.calculationSteps.length, 8);
  assert.ok(
    body.data.birth.trueSolarEvidence.calculationSteps.some(
      (item: { stage: string }) => item.stage === '历史时区解析',
    ),
  );
  assert.equal(body.data.birth.timezoneEvidence.status, 'unique');
  assert.equal(body.data.birth.timezoneEvidence.calculationSteps.length, 4);
  assert.deepEqual(
    body.data.birth.timezoneEvidence.calculationChain,
    body.data.birth.timezoneEvidence.calculationSteps.map(
      (item: { promptText: string }) => item.promptText,
    ),
  );
  assert.equal(body.data.birth.timezoneEvidence.diagnosticSummaryFact.status, '唯一且无冲突');
  assert.equal(
    body.data.birth.timezoneEvidence.summaryFact.status,
    body.data.birth.timezoneEvidence.diagnosticSummaryFact.status,
  );
  assert.equal(
    body.data.birth.timezoneEvidence.summaryFact.calculationStepCount,
    body.data.birth.timezoneEvidence.calculationSteps.length,
  );
  assert.equal(
    body.data.birth.timezoneEvidence.summaryFact.diagnosticFactCount,
    body.data.birth.timezoneEvidence.diagnosticFacts.length,
  );
  assert.equal(
    body.data.birth.timezoneEvidence.summaryFact.limitationFactCount,
    body.data.birth.timezoneEvidence.limitationFacts.length,
  );
  assert.equal(
    body.data.birth.timezoneEvidence.limitations.length,
    body.data.birth.timezoneEvidence.limitationFacts.length,
  );
  assertPromptIsPortableTaskText(body.data.birth.timezoneEvidence.promptText);
  assert.equal(body.data.evidenceAnalysis.timezoneFact.key, body.data.birth.timezoneEvidence.key);
  assert.equal(
    body.data.evidenceAnalysis.trueSolarTimeFact.key,
    body.data.birth.trueSolarEvidence.key,
  );
  assert.equal(body.data.evidenceAnalysis.key, 'astrolabe:evidence');
  assert.equal(body.data.evidenceAnalysis.status, '已计算');
  assert.match(body.data.evidenceAnalysis.promptText, /历史时区映射与诊断/);
  assert.match(body.data.evidenceAnalysis.promptText, /真太阳时校正证据/);
  assert.match(
    body.data.evidenceAnalysis.promptText,
    /民用出生时间.*进入现代星历.*仅作为传统时间参考/,
  );
  assert.ok(body.data.aspects.length > 0);
  assert.equal(body.data.evidenceAnalysis.evidence.title, '西方星盘位置与相位结构化证据');
  assert.equal(body.data.evidenceAnalysis.calculationFact.status, '完整');
  assert.equal(body.data.evidenceAnalysis.calculationFact.steps.length, 5);
  assert.deepEqual(
    body.data.evidenceAnalysis.calculationSteps,
    body.data.evidenceAnalysis.calculationFact.steps,
  );
  assert.ok(
    body.data.evidenceAnalysis.calculationFact.steps.every(
      (item: Record<string, unknown>) =>
        String(item.key).startsWith('astrolabe:calculation:') &&
        item.stage &&
        item.promptText &&
        Array.isArray(item.sources) &&
        Array.isArray(item.dependsOnStepKeys) &&
        String(item.limitation).includes('单个计算步骤'),
    ),
  );
  assert.equal(body.data.evidenceAnalysis.primaryCoverageFact.status, '完整');
  assert.equal(body.data.evidenceAnalysis.primaryPointFacts.length, 4);
  assert.equal(body.data.evidenceAnalysis.primaryCoverageFact.positionFactKeys.length, 4);
  assert.ok(body.data.evidenceAnalysis.calculationChain.length >= 5);
  assert.equal(
    body.data.evidenceAnalysis.positionFacts.length,
    body.data.planets.length + body.data.angles.length + body.data.houses.length,
  );
  assert.equal(body.data.evidenceAnalysis.aspectFacts.length, body.data.aspects.length);
  assert.ok(
    body.data.evidenceAnalysis.distributionEvidenceFacts.every(
      (item: Record<string, unknown>) =>
        String(item.key).startsWith('distribution:') &&
        typeof item.count === 'number' &&
        Array.isArray(item.members) &&
        Array.isArray(item.memberPositionFactKeys) &&
        item.promptText &&
        String(item.limitation).includes('不代表能量分数'),
    ),
  );
  assert.ok(
    body.data.evidenceAnalysis.aspectFacts.every(
      (item: Record<string, unknown>) =>
        (item.status === '几何完整' || item.status === '旧记录缺几何量') &&
        Array.isArray(item.positionFactKeys) &&
        Array.isArray(item.sources) &&
        typeof item.actualAngle === 'number' &&
        typeof item.exactAngle === 'number' &&
        typeof item.allowedOrb === 'number' &&
        item.promptText &&
        String(item.limitation).includes('不代表事件概率'),
    ),
  );
  assert.equal(body.data.evidenceAnalysis.illuminationFact.status, '可用');
  assert.equal(body.data.evidenceAnalysis.illuminationFact.crossingFactKeys.length, 4);
  assert.equal(body.data.evidenceAnalysis.counterEvidenceFacts.length, 3);
  assert.ok(
    ['有未见项', '全部有可列资料'].includes(body.data.evidenceAnalysis.counterSummaryFact.status),
  );
  assert.equal(
    body.data.evidenceAnalysis.limitations.length,
    body.data.evidenceAnalysis.limitationFacts.length,
  );
  assert.ok(
    body.data.evidenceAnalysis.limitations.some((item: string) => item.includes('不代表事件概率')),
  );
  assert.equal(body.data.evidenceAnalysis.summaryFact.key, 'astrolabe:evidence-summary');
  assert.equal(body.data.evidenceAnalysis.summaryFact.status, '证据链完整');
  assert.ok(
    body.data.evidenceAnalysis.summaryFact.factKeys.includes(
      body.data.birth.timezoneEvidence.summaryFact.key,
    ),
  );
  assert.equal(
    body.data.evidenceAnalysis.summaryFact.primaryFactCount,
    body.data.evidenceAnalysis.primaryPointFacts.length,
  );
  assert.equal(
    body.data.evidenceAnalysis.summaryFact.positionFactCount,
    body.data.evidenceAnalysis.positionFacts.length,
  );
  assert.equal(
    body.data.evidenceAnalysis.summaryFact.aspectFactCount,
    body.data.evidenceAnalysis.aspectFacts.length,
  );
  assert.equal(
    body.data.evidenceAnalysis.summaryFact.distributionFactCount,
    body.data.evidenceAnalysis.distributionEvidenceFacts.length,
  );
  assert.equal(
    body.data.evidenceAnalysis.summaryFact.counterEvidenceCount,
    body.data.evidenceAnalysis.counterEvidenceFacts.length,
  );
  assert.equal(
    body.data.evidenceAnalysis.summaryFact.limitationFactCount,
    body.data.evidenceAnalysis.limitationFacts.length,
  );
  const astrolabeFactKeys = new Set([
    body.data.evidenceAnalysis.summaryFact.key,
    ...body.data.evidenceAnalysis.summaryFact.factKeys,
  ]);
  assert.ok(
    body.data.evidenceAnalysis.counterEvidenceFacts.every(
      (item: Record<string, any>) =>
        item.ownerFactKeys.length > 0 &&
        item.ownerFactKeys.every((key: string) => astrolabeFactKeys.has(key)),
    ),
  );
  assert.ok(
    body.data.evidenceAnalysis.limitationFacts.every(
      (item: Record<string, any>) =>
        item.ownerFactKeys.length > 0 &&
        item.ownerFactKeys.every((key: string) => astrolabeFactKeys.has(key)),
    ),
  );
  assert.match(body.data.evidenceAnalysis.promptText, /证据汇总：[\s\S]*解释限制（方法限制）：/);
  body.data.aspects.forEach(
    (aspect: {
      strength?: number;
      actualAngle?: number;
      exactAngle?: number;
      allowedOrb?: number;
    }) => {
      assert.equal(aspect.strength, undefined);
      assert.equal(typeof aspect.actualAngle, 'number');
      assert.equal(typeof aspect.exactAngle, 'number');
      assert.equal(typeof aspect.allowedOrb, 'number');
    },
  );
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
      astrolabeScopeDate: '2028-06-12',
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

  const detailed = await callApi('divination/astrolabe/prompt', {
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
      question: '请看2028年的阶段重点。',
      astrolabeScope: 'yearly',
      astrolabeScopeDate: '2028',
      responseMode: 'full',
    }),
  });
  assert.equal(detailed.response.status, 200);
  assert.equal(detailed.body.data.result.scopeEvidence.scope, 'yearly');
  assert.equal(
    detailed.body.data.result.scopeEvidence.solarReturnEvidence.key,
    'solar-return:2028',
  );
  assert.equal(
    detailed.body.data.result.scopeEvidence.secondaryProgressionEvidence.key,
    'secondary-progression:2028',
  );
  assert.equal(detailed.body.data.result.scopeEvidence.solarArcEvidence.key, 'solar-arc:2028');
  assert.equal(
    detailed.body.data.result.scopeEvidence.solarReturnEvidence.limitations.length,
    detailed.body.data.result.scopeEvidence.solarReturnEvidence.limitationFacts.length,
  );
  for (const evidence of [
    detailed.body.data.result.scopeEvidence.solarReturnEvidence,
    detailed.body.data.result.scopeEvidence.secondaryProgressionEvidence,
    detailed.body.data.result.scopeEvidence.solarArcEvidence,
  ]) {
    assert.equal(evidence.calculationChain.length, evidence.calculationSteps.length);
    assert.equal(evidence.summaryFact.calculationStepCount, evidence.calculationSteps.length);
    assert.equal(evidence.summaryFact.aspectFactCount, evidence.aspectFacts.length);
    assert.equal(evidence.summaryFact.limitationFactCount, evidence.limitationFacts.length);
    const factKeys = new Set([evidence.summaryFact.key, ...evidence.summaryFact.factKeys]);
    assert.ok(
      [...evidence.aspectFacts, ...evidence.limitationFacts].every(
        (item: { ownerFactKeys: string[] }) =>
          item.ownerFactKeys.length > 0 && item.ownerFactKeys.every((key) => factKeys.has(key)),
      ),
    );
    assert.match(evidence.promptText, /证据汇总：/);
  }
});

test('公开 API 星盘非本命范围必须提供匹配范围的明确日期', async () => {
  const base = {
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
    question: '请分析指定行运。',
  };
  const cases = [
    { ...base, astrolabeScope: 'full' },
    { ...base, astrolabeScope: 'yearly', astrolabeScopeDate: '2028-06' },
    { ...base, astrolabeScope: 'monthly', astrolabeScopeDate: '2028-13' },
    { ...base, astrolabeScope: 'daily', astrolabeScopeDate: '2028-02-31' },
  ];

  for (const payload of cases) {
    const { response, body } = await callApi('divination/astrolabe/prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(response.status, 400, JSON.stringify(payload));
    assert.equal(body.error.code, 'BAD_REQUEST');
  }
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
      detailMode: 'full',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  const synastry = body.data.synastry;
  assert.equal(synastry.key, 'astrolabe:synastry:evidence');
  assert.equal(synastry.status, '已计算');
  assert.deepEqual(synastry.people, ['甲', '乙']);
  assert.equal(synastry.calculationSteps.length, 7);
  assert.ok(synastry.aspects.length > 0);
  synastry.aspects.forEach(
    (aspect: { key: string; status: string; calculationStepKey: string; strength?: number }) => {
      assert.match(aspect.key, /^astrolabe:synastry:aspect:/);
      assert.equal(aspect.status, '已命中');
      assert.equal(aspect.calculationStepKey, 'astrolabe:synastry:calculation:aspect-filter');
      assert.equal(aspect.strength, undefined);
    },
  );
  assert.equal(synastry.summary.strongAspects, undefined);
  assert.ok(synastry.houseOverlays.length > 0);
  synastry.houseOverlays.forEach(
    (overlay: { key: string; status: string; calculationStepKey: string }) => {
      assert.match(overlay.key, /^astrolabe:synastry:house-overlay:/);
      assert.equal(overlay.status, '已定位');
      assert.equal(overlay.calculationStepKey, 'astrolabe:synastry:calculation:house-overlays');
    },
  );
  assert.equal(synastry.summaryFact.returnedAspectCount, synastry.aspects.length);
  assert.equal(synastry.summaryFact.houseOverlayCount, synastry.houseOverlays.length);
  assert.equal(synastry.counterEvidenceFacts.length, 4);
  assert.equal(synastry.limitationFacts.length, 6);
  assertEvidenceOwnerReferences(synastry);
  assert.doesNotMatch(synastry.promptText, /本项目|项目统一|工程|接口|API|MCP|astrolabe:synastry:/);
  assertPromptIsPortableTaskText(synastry.promptText);
  assert.ok(synastry.evidence.items.some((item: { level: string }) => item.level === '限制'));
});

test('公开 API 西占双盘提示词应携带双方本命盘与简明任务', async () => {
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
      schools: ['modern', 'timing'],
      responseMode: 'summary',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.resultSummary.key, 'astrolabe:synastry:evidence');
  assert.equal(body.data.resultSummary.status, '已计算');
  assert.ok(body.data.resultSummary.summaryFact.returnedAspectCount > 0);
  assert.ok(JSON.stringify(body.data.resultSummary).length < 5000);
  assertPromptHasSingleRole(body.data.prompt, PROMPT_ROLE_TEXT['astrolabe-synastry']);
  assert.match(body.data.prompt, /【第一人本命盘】/);
  assert.match(body.data.prompt, /【第二人本命盘】/);
  assert.match(body.data.prompt, /【跨盘相位】/);
  assert.match(body.data.prompt, /实际夹角\d+\.\d{2}°，容许度\d+\.\d{2}°，(?:紧密|中等|宽松)/);
  assert.match(body.data.prompt, /【跨盘落宫】/);
  assert.match(body.data.prompt, /【多口径合参】/);
  assert.match(body.data.prompt, /流派1：现代心理占星/);
  assert.match(body.data.prompt, /断法2：时限触发法/);
  assert.doesNotMatch(body.data.prompt, /强度\d+%|匹配率\d+%/);
  assert.match(body.data.prompt, /分析互动主轴、互补点与张力点/);
  assert.doesNotMatch(body.data.prompt, /不得输出|不得编造|只依据/);
  assert.doesNotMatch(body.data.prompt, /结构化证据|计算链概览|证据汇总|解释限制/);
  assert.doesNotMatch(body.data.prompt, /本项目|项目统一|工程|接口|API|MCP|astrolabe:synastry:/);
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
  assert.match(body.data.prompt, /占法：黄历择日/);
  assert.match(body.data.prompt, /候选日期明细：/);
  assert.doesNotMatch(body.data.prompt, /评分[：=]?\d|（\d+分|成功率[：=]?\d/);
  assert.doesNotMatch(
    body.data.prompt,
    /主疾病|主死丧|主灾病死亡|主哭泣死亡|必见灾殃|毒气入肠|大凶|辅助加分/,
  );
  assert.doesNotMatch(body.data.prompt, /【问题】/);
  assert.match(body.data.prompt, /给出首选日期、备选日期和慎用日期/);
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
  for (const day of body.data.days) {
    assert.equal(day.score, undefined);
    for (const hour of day.hours ?? []) {
      assert.equal(hour.score, undefined);
    }
  }
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
  assert.equal(body.data.result.evidenceAnalysis.key, 'almanac:evidence');
  assert.equal(body.data.result.evidenceAnalysis.status, '已计算');
  assert.equal(body.data.result.evidenceAnalysis.calculationSteps.length, 7);
  assert.equal(
    body.data.result.evidenceAnalysis.calculationChain.length,
    body.data.result.evidenceAnalysis.calculationSteps.length,
  );
  const almanacCalculationStepKeys = new Set(
    body.data.result.evidenceAnalysis.calculationSteps.map((item: { key: string }) => item.key),
  );
  assert.ok(
    body.data.result.evidenceAnalysis.calculationSteps.every(
      (item: { dependsOnStepKeys: string[]; sources: string[]; limitation: string }) =>
        item.dependsOnStepKeys.every((key) => almanacCalculationStepKeys.has(key)) &&
        item.sources.length > 0 &&
        item.limitation.includes('不证明现实吉凶'),
    ),
  );
  assert.equal(body.data.result.evidenceAnalysis.candidates.length, 5);
  const candidateFacts = body.data.result.evidenceAnalysis.candidates as Array<{
    date: string;
    calendarFact: { key: string; promptText: string; sources: string[]; limitation: string };
    rawTabooFact: { key: string; status: string; recommends: string[]; avoids: string[] };
    godFacts: Array<{ key: string; status: string; classification: string; sources: string[] }>;
    topicMatchFacts: Array<{
      key: string;
      status: string;
      matchedItems: string[];
      sources: string[];
      limitation: string;
    }>;
    participantRelationFacts: Array<{ key: string }>;
    decisionFact: {
      key: string;
      status: string;
      steps: Array<{ key: string; stage: string; result: string; sources: string[] }>;
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
  assert.ok(
    candidateFacts.every(
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
  const traditionalFacts = body.data.result.evidenceAnalysis.traditionalFacts as Array<{
    kind: string;
    originalText: string;
    promptText: string;
    sources: string[];
    limitation: string;
  }>;
  assert.ok(traditionalFacts.length > 0);
  assert.ok(
    traditionalFacts.every(
      (item) =>
        item.originalText &&
        item.promptText &&
        item.sources.length > 0 &&
        item.limitation.includes('不证明现实中'),
    ),
  );
  assert.equal(body.data.result.evidenceAnalysis.summaryFact.status, '证据链完整');
  assert.equal(
    body.data.result.evidenceAnalysis.summaryFact.candidateCount,
    body.data.result.evidenceAnalysis.candidates.length,
  );
  assert.equal(
    body.data.result.evidenceAnalysis.summaryFact.traditionalFactCount,
    body.data.result.evidenceAnalysis.traditionalFacts.length,
  );
  assert.equal(
    body.data.result.evidenceAnalysis.summaryFact.counterEvidenceCount,
    body.data.result.evidenceAnalysis.counterEvidenceFacts.length,
  );
  assert.equal(
    body.data.result.evidenceAnalysis.counterSummaryFact.factKeys.length,
    body.data.result.evidenceAnalysis.counterEvidenceFacts.length,
  );
  assert.equal(body.data.result.evidenceAnalysis.limitationFacts.length, 6);
  assert.equal(
    body.data.result.evidenceAnalysis.limitations.length,
    body.data.result.evidenceAnalysis.limitationFacts.length,
  );
  const almanacFactKeys = new Set([
    body.data.result.evidenceAnalysis.summaryFact.key,
    ...body.data.result.evidenceAnalysis.summaryFact.factKeys,
  ]);
  assert.ok(
    body.data.result.evidenceAnalysis.counterEvidenceFacts.every(
      (item: { ownerFactKeys: string[] }) =>
        item.ownerFactKeys.length > 0 &&
        item.ownerFactKeys.every((key) => almanacFactKeys.has(key)),
    ),
  );
  assert.ok(
    body.data.result.evidenceAnalysis.limitationFacts.every(
      (item: { ownerFactKeys: string[] }) =>
        item.ownerFactKeys.length > 0 &&
        item.ownerFactKeys.every((key) => almanacFactKeys.has(key)),
    ),
  );
  for (const day of body.data.result.days) {
    assert.equal(day.score, undefined);
    for (const hour of day.hours ?? []) {
      assert.equal(hour.score, undefined);
    }
  }
  assert.deepEqual(
    candidateFacts.map((item) => item.date),
    body.data.result.days.map((item: { date: string }) => item.date),
  );
  assert.match(body.data.result.evidenceAnalysis.promptText, /【黄历择日透明约束与候选证据】/);
  assert.match(body.data.result.evidenceAnalysis.promptText, /状态形成链/);
  assert.match(
    body.data.result.evidenceAnalysis.promptText,
    /计算链：[\s\S]*反证汇总：[\s\S]*证据汇总：[\s\S]*解释限制：/,
  );
  assert.match(body.data.prompt, /候选日期：2026-06-01 至 2026-06-30/);
  const promptCandidateDates = Array.from(
    body.data.prompt.matchAll(/第\d+候选：(\d{4}-\d{2}-\d{2})/g),
    (match) => match[1],
  );
  assert.ok(promptCandidateDates.length >= 1 && promptCandidateDates.length <= 3);
  assert.ok(
    promptCandidateDates.every((date) =>
      body.data.result.days.some((day: { date: string }) => day.date === date),
    ),
  );
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
      detailMode: 'full',
    }),
  });
  assert.equal(chart.response.status, 200);
  assert.equal(chart.body.data.evidenceAnalysis.key, 'meihua:evidence');
  assert.equal(chart.body.data.evidenceAnalysis.status, '已计算');
  assert.equal(chart.body.data.evidenceAnalysis.calculationSteps.length, 7);
  assert.equal(chart.body.data.evidenceAnalysis.calculationChain.length, 7);
  assert.deepEqual(
    chart.body.data.evidenceAnalysis.stages.map((item: { stage: string }) => item.stage),
    ['origin', 'process', 'result'],
  );
  assert.equal(chart.body.data.evidenceAnalysis.stageCoverageFact.status, '完整');
  assert.equal(chart.body.data.evidenceAnalysis.yaoCoverageFact.status, '完整');
  assert.equal(chart.body.data.evidenceAnalysis.hexagramStructureFacts.length, 3);
  assert.equal(chart.body.data.evidenceAnalysis.yaoStructureFacts.length, 6);
  assert.ok(
    chart.body.data.evidenceAnalysis.stages.every(
      (item: Record<string, unknown>) =>
        String(item.key).startsWith('meihua:stage:') &&
        item.status === '已计算' &&
        item.promptText &&
        Array.isArray(item.sources) &&
        String(item.limitation).includes('不得直接解释为现实起因'),
    ),
  );
  assert.equal(chart.body.data.evidenceAnalysis.transitionFacts.length, 2);
  assert.ok(
    chart.body.data.evidenceAnalysis.transitionFacts.every(
      (item: Record<string, unknown>) =>
        String(item.key).startsWith('meihua:transition:') &&
        item.status === '连续' &&
        item.fromStageKey &&
        item.toStageKey &&
        Array.isArray(item.sources) &&
        String(item.limitation).includes('现实事件必然按同样顺序'),
    ),
  );
  assert.equal(
    chart.body.data.evidenceAnalysis.timingSummaryFact.factKeys.length,
    chart.body.data.evidenceAnalysis.timingFacts.length,
  );
  assert.ok(
    chart.body.data.evidenceAnalysis.timingFacts.every(
      (item: Record<string, unknown>) =>
        String(item.key).startsWith('meihua:timing:') &&
        item.promptText &&
        Array.isArray(item.sources) &&
        String(item.limitation).includes('不得把爻位'),
    ),
  );
  assert.equal(
    chart.body.data.evidenceAnalysis.counterSummaryFact.factKeys.length,
    chart.body.data.evidenceAnalysis.counterEvidenceFacts.length,
  );
  assert.equal(chart.body.data.evidenceAnalysis.summaryFact.status, '证据链完整');
  assert.equal(
    chart.body.data.evidenceAnalysis.summaryFact.hexagramFactCount,
    chart.body.data.evidenceAnalysis.hexagramStructureFacts.length,
  );
  assert.equal(
    chart.body.data.evidenceAnalysis.summaryFact.stageFactCount,
    chart.body.data.evidenceAnalysis.stages.length,
  );
  assert.equal(
    chart.body.data.evidenceAnalysis.summaryFact.transitionFactCount,
    chart.body.data.evidenceAnalysis.transitionFacts.length,
  );
  assert.equal(chart.body.data.evidenceAnalysis.limitationFacts.length, 6);
  assert.equal(
    chart.body.data.evidenceAnalysis.limitations.length,
    chart.body.data.evidenceAnalysis.limitationFacts.length,
  );
  assert.ok(
    chart.body.data.evidenceAnalysis.counterEvidenceFacts.every(
      (item: Record<string, unknown>) =>
        String(item.key).startsWith('meihua:counter:') &&
        item.status === '已触发' &&
        item.ownerStageKey &&
        Array.isArray(item.sources) &&
        String(item.limitation).includes('不得把单项反证直接写成现实失败'),
    ),
  );
  assert.match(chart.body.data.evidenceAnalysis.promptText, /【梅花体用阶段推进结构化证据】/);
  assert.match(chart.body.data.evidenceAnalysis.promptText, /证据汇总：/);
  assert.match(chart.body.data.evidenceAnalysis.promptText, /解释限制：/);
  assertPromptIsPortableTaskText(chart.body.data.evidenceAnalysis.promptText);
  assert.equal(chart.body.data.evidenceAnalysis.calculationFact.status, '完整');
  assert.equal(chart.body.data.evidenceAnalysis.calculationFact.methodKey, 'number');
  assert.equal(chart.body.data.evidenceAnalysis.calculationFact.steps.length, 3);
  assert.ok(
    chart.body.data.evidenceAnalysis.calculationFact.steps.every(
      (item: Record<string, unknown>) =>
        item.key &&
        item.target &&
        item.expression &&
        typeof item.result === 'number' &&
        item.promptText,
    ),
  );
  assert.equal(chart.body.data.evidenceAnalysis.randomFact.status, '不适用');
  assert.ok(chart.body.data.evidenceAnalysis.traditionalFacts.length >= 21);
  assert.ok(
    chart.body.data.evidenceAnalysis.traditionalFacts.every(
      (item: Record<string, unknown>) =>
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
  assert.match(prompt.body.data.prompt, /占法：梅花易数/);
  assert.match(prompt.body.data.prompt, /核心结构：主卦/);
  assert.match(prompt.body.data.prompt, /互卦/);
  assert.match(prompt.body.data.prompt, /变卦/);
  assert.match(prompt.body.data.prompt, /体用：/);
  assert.doesNotMatch(prompt.body.data.prompt, /结构化证据|计算链|证据汇总|解释边界/);
  assert.doesNotMatch(prompt.body.data.prompt, /妇三岁不孕|焚如，死如|至于八月有凶/);
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
  assert.match(liuyao.body.data.prompt, /【问题范围】\n鬼神怪异/);
  assert.doesNotMatch(liuyao.body.data.prompt, /鬼神怪异：以官鬼为取用参考|官鬼与子孙制鬼/);
  assert.doesNotMatch(liuyao.body.data.prompt, /断卦要点|取证顺序|回答口径|证据边界/);

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
  assert.match(liuren.body.data.prompt, /【问题范围】\n事业工作/);
  assert.doesNotMatch(liuren.body.data.prompt, /取用候选：.*权重\d|吉凶总分[：=]?\d/);
  assert.doesNotMatch(
    liuren.body.data.prompt,
    /【分析思路】|断课要点|取证顺序|回答口径|证据边界|结构化证据/,
  );
  assert.doesNotMatch(liuren.body.data.prompt, /关注重点：|岗位路径、协作阻力、窗口时机/);

  const liurenChart = await callApi('divination/liuren', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customDate: '2025-01-01T08:00:00+08:00',
      detailMode: 'full',
    }),
  });
  assert.equal(liurenChart.response.status, 200);
  assert.equal(liurenChart.body.data.evidenceAnalysis.key, 'liuren:evidence');
  assert.equal(liurenChart.body.data.evidenceAnalysis.status, '已计算');
  assert.equal(liurenChart.body.data.evidenceAnalysis.calculationSteps.length, 7);
  assert.equal(
    liurenChart.body.data.evidenceAnalysis.calculationChain.length,
    liurenChart.body.data.evidenceAnalysis.calculationSteps.length,
  );
  const liurenCalculationStepKeys = new Set(
    liurenChart.body.data.evidenceAnalysis.calculationSteps.map(
      (item: { key: string }) => item.key,
    ),
  );
  assert.ok(
    liurenChart.body.data.evidenceAnalysis.calculationSteps.every(
      (item: { dependsOnStepKeys: string[] }) =>
        item.dependsOnStepKeys.every((key) => liurenCalculationStepKeys.has(key)),
    ),
  );
  assert.equal(liurenChart.body.data.evidenceAnalysis.lessons.length, 4);
  assert.equal(liurenChart.body.data.evidenceAnalysis.transmissions.length, 3);
  assert.equal(liurenChart.body.data.evidenceAnalysis.transmissionRuleFact.status, '已确定');
  assert.equal(
    liurenChart.body.data.evidenceAnalysis.transmissionRuleFact.rule,
    liurenChart.body.data.transmissionRule,
  );
  assert.ok(
    liurenChart.body.data.evidenceAnalysis.transmissionRuleFact.initialSourceLessonKeys.length > 0,
  );
  assert.ok(
    liurenChart.body.data.evidenceAnalysis.lessons.every(
      (item: Record<string, unknown>) =>
        String(item.key).startsWith('liuren:lesson:') &&
        Array.isArray(item.relationFacts) &&
        item.relationFacts.length > 0 &&
        item.promptText &&
        Array.isArray(item.sources) &&
        item.sources.length >= 2 &&
        String(item.limitation).includes('不单独证明现实事件'),
    ),
  );
  assert.ok(
    liurenChart.body.data.evidenceAnalysis.transmissions.every(
      (item: Record<string, unknown>) =>
        String(item.key).startsWith('liuren:transmission:') &&
        Array.isArray(item.relationFacts) &&
        item.relationFacts.length === 4 &&
        item.promptText &&
        Array.isArray(item.sources) &&
        item.sources.length > 0 &&
        String(item.limitation).includes('阶段顺序不证明现实事件必然'),
    ),
  );
  assert.equal(liurenChart.body.data.evidenceAnalysis.transitionFacts.length, 2);
  assert.ok(
    liurenChart.body.data.evidenceAnalysis.transitionFacts.every(
      (item: Record<string, unknown>) =>
        String(item.key).startsWith('liuren:transition:') &&
        item.fromTransmissionKey &&
        item.toTransmissionKey &&
        item.promptText &&
        Array.isArray(item.sources) &&
        item.sources.length > 0,
    ),
  );
  assert.equal(liurenChart.body.data.evidenceAnalysis.timingFacts.length, 4);
  assert.ok(
    liurenChart.body.data.evidenceAnalysis.timingFacts.every(
      (item: Record<string, unknown>) =>
        String(item.key).startsWith('liuren:timing:') &&
        item.sourceStatus === '原结果提供' &&
        item.promptText &&
        Array.isArray(item.sources) &&
        item.sources.length >= 2 &&
        String(item.limitation).includes('不得换算唯一日期'),
    ),
  );
  assert.equal(liurenChart.body.data.evidenceAnalysis.focusSummaryFact.status, '已提供焦点');
  assert.equal(
    liurenChart.body.data.evidenceAnalysis.counterSummaryFact.factKeys.length,
    liurenChart.body.data.evidenceAnalysis.counterEvidenceFacts.length,
  );
  assert.equal(
    liurenChart.body.data.evidenceAnalysis.calculationFact.monthLeader,
    liurenChart.body.data.monthLeader,
  );
  assert.ok(liurenChart.body.data.evidenceAnalysis.calculationFact.sources.length >= 3);
  assert.equal(liurenChart.body.data.evidenceAnalysis.plateFact.status, '完整');
  assert.equal(liurenChart.body.data.evidenceAnalysis.plateFact.actualCount, 12);
  assert.equal(liurenChart.body.data.evidenceAnalysis.platePositionFacts.length, 12);
  assert.ok(
    liurenChart.body.data.evidenceAnalysis.platePositionFacts.every(
      (item: Record<string, unknown>) =>
        item.key &&
        item.earthBranch &&
        item.heavenBranch &&
        item.god &&
        item.promptText &&
        Array.isArray(item.sources) &&
        item.sources.length >= 2 &&
        String(item.limitation).includes('只证明月将加时'),
    ),
  );
  assert.equal(liurenChart.body.data.evidenceAnalysis.summaryFact.status, '证据链完整');
  assert.equal(
    liurenChart.body.data.evidenceAnalysis.summaryFact.platePositionFactCount,
    liurenChart.body.data.evidenceAnalysis.platePositionFacts.length,
  );
  assert.equal(
    liurenChart.body.data.evidenceAnalysis.summaryFact.lessonFactCount,
    liurenChart.body.data.evidenceAnalysis.lessons.length,
  );
  assert.equal(
    liurenChart.body.data.evidenceAnalysis.summaryFact.transmissionFactCount,
    liurenChart.body.data.evidenceAnalysis.transmissions.length,
  );
  assert.equal(
    liurenChart.body.data.evidenceAnalysis.summaryFact.transitionFactCount,
    liurenChart.body.data.evidenceAnalysis.transitionFacts.length,
  );
  assert.equal(liurenChart.body.data.evidenceAnalysis.limitationFacts.length, 6);
  assert.equal(
    liurenChart.body.data.evidenceAnalysis.limitations.length,
    liurenChart.body.data.evidenceAnalysis.limitationFacts.length,
  );
  const liurenFactKeys = new Set([
    liurenChart.body.data.evidenceAnalysis.calculationFact.key,
    liurenChart.body.data.evidenceAnalysis.plateFact.key,
    ...liurenChart.body.data.evidenceAnalysis.platePositionFacts.map(
      (item: { key: string }) => item.key,
    ),
    liurenChart.body.data.evidenceAnalysis.transmissionRuleFact.key,
    ...liurenChart.body.data.evidenceAnalysis.lessons.flatMap(
      (item: { key: string; relationFacts: Array<{ key: string }> }) => [
        item.key,
        ...item.relationFacts.map((fact) => fact.key),
      ],
    ),
    ...liurenChart.body.data.evidenceAnalysis.transmissions.flatMap(
      (item: { key: string; relationFacts: Array<{ key: string }> }) => [
        item.key,
        ...item.relationFacts.map((fact) => fact.key),
      ],
    ),
    ...liurenChart.body.data.evidenceAnalysis.transitionFacts.map(
      (item: { key: string }) => item.key,
    ),
    liurenChart.body.data.evidenceAnalysis.counterSummaryFact.key,
    ...liurenChart.body.data.evidenceAnalysis.counterEvidenceFacts.map(
      (item: { key: string }) => item.key,
    ),
    ...liurenChart.body.data.evidenceAnalysis.timingFacts.map((item: { key: string }) => item.key),
    liurenChart.body.data.evidenceAnalysis.focusSummaryFact.key,
    ...liurenChart.body.data.evidenceAnalysis.focusFacts.map((item: { key: string }) => item.key),
    ...liurenChart.body.data.evidenceAnalysis.traditionalFacts.map(
      (item: { key: string }) => item.key,
    ),
    liurenChart.body.data.evidenceAnalysis.summaryFact.key,
  ]);
  assert.ok(
    liurenChart.body.data.evidenceAnalysis.limitationFacts.every(
      (item: { ownerFactKeys: string[] }) =>
        item.ownerFactKeys.length > 0 && item.ownerFactKeys.every((key) => liurenFactKeys.has(key)),
    ),
  );
  const traditionalFacts = liurenChart.body.data.evidenceAnalysis.traditionalFacts as Array<{
    kind: string;
    originalText: string;
    promptText: string;
    sources: string[];
    limitation: string;
  }>;
  assert.ok(traditionalFacts.length > 0);
  assert.ok(
    traditionalFacts.every(
      (item) =>
        item.originalText &&
        item.promptText &&
        item.sources.length > 0 &&
        item.limitation.includes('不证明现实事件'),
    ),
  );
  assert.ok(traditionalFacts.some((item) => item.kind === '经典取传规则'));
  assert.ok(traditionalFacts.some((item) => item.kind === '课体'));
  assert.ok(traditionalFacts.some((item) => item.kind === '天将属性'));
  assert.ok(traditionalFacts.some((item) => item.kind === '神煞'));
  assert.match(liuren.body.data.prompt, /课传主线：/);
  assert.match(liuren.body.data.prompt, /四课：/);
  assert.match(liuren.body.data.prompt, /三传：/);
  assert.doesNotMatch(liuren.body.data.prompt, /应期线索：/);
  assert.doesNotMatch(liuren.body.data.prompt, /结构化证据|计算链|证据汇总|解释边界/);
  assert.doesNotMatch(liuren.body.data.prompt, /主婚姻|主官非|主疾病|主死丧|主虚而不实/);
});

test('公开 API supplementaryInfo 应校验嵌套字段并只保留当前占法会使用的资料', async () => {
  const baseRequest = {
    customDate: '2025-01-01T08:00:00+08:00',
    question: '我现在要不要换工作？',
  };
  const valid = await callApi('divination/liuren/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...baseRequest,
      supplementaryInfo: {
        gender: '男',
        birthYear: 1990,
        currentSituation: '已经拿到一个新机会。',
      },
    }),
  });

  assert.equal(valid.response.status, 200);
  assert.match(valid.body.data.prompt, /【补充信息】/);
  assert.doesNotMatch(valid.body.data.prompt, /性别：男|出生年份：1990/);
  assert.match(valid.body.data.prompt, /当前情况：已经拿到一个新机会。/);

  const qimen = await callApi('divination/qimen/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...baseRequest,
      supplementaryInfo: { birthYear: 1990 },
    }),
  });

  assert.equal(qimen.response.status, 200);
  assert.match(qimen.body.data.prompt, /年命资料：公历1990年/);
  assert.doesNotMatch(qimen.body.data.prompt, /【补充信息】[\s\S]*出生年份/);

  const invalidNestedField = await callApi('divination/liuren/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...baseRequest,
      supplementaryInfo: { currentSituation: 123 },
    }),
  });

  assert.equal(invalidNestedField.response.status, 400);
  assert.equal(invalidNestedField.body.ok, false);
  assert.equal(invalidNestedField.body.error.code, 'BAD_REQUEST');
  assert.match(invalidNestedField.body.error.message, /currentSituation/);

  const invalidObject = await callApi('divination/liuren/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...baseRequest, supplementaryInfo: [] }),
  });

  assert.equal(invalidObject.response.status, 400);
  assert.equal(invalidObject.body.error.code, 'BAD_REQUEST');
  assert.match(invalidObject.body.error.message, /supplementaryInfo/);
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
      doorToInteriorDegree: 64,
      northReference: 'magnetic',
      magneticDeclinationDegrees: 1,
      measurementUncertaintyDegrees: 3,
      responseMode: 'full',
      question: '住宅办公方位怎么安排？',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assertPromptHasSingleRole(body.data.prompt, PROMPT_ROLE_TEXT.bazhai);
  assert.match(body.data.prompt, /【八宅风水排盘】/);
  assert.match(body.data.prompt, /【测量换算】/);
  assert.match(body.data.prompt, /站在大门处面向屋内/);
  assert.match(body.data.prompt, /真北口径入户方向为 65°/);
  assert.match(body.data.prompt, /稳定性为宅卦不稳定/);
  assert.match(
    body.data.prompt,
    /误差候选：寅山申向（艮宅、西四命、命宅相冲）、甲山庚向（震宅、东四命、命宅相合）/,
  );
  assert.match(body.data.prompt, /候选寅山申向：艮宅八宫/);
  assert.match(body.data.prompt, /候选甲山庚向：震宅八宫/);
  assert.equal(body.data.result.directionMeasurement.stability, '宅卦不稳定');
  assert.equal(body.data.result.evidenceAnalysis.evidence.title, '八宅命宅方位与测量结构化证据');
  assert.equal(body.data.result.evidenceAnalysis.key, 'bazhai:evidence');
  assert.equal(body.data.result.evidenceAnalysis.status, '已计算');
  assert.equal(body.data.result.evidenceAnalysis.calculationFact.status, '命宅完整');
  assert.equal(body.data.result.evidenceAnalysis.calculationFact.steps.length, 5);
  assert.deepEqual(
    body.data.result.evidenceAnalysis.calculationSteps,
    body.data.result.evidenceAnalysis.calculationFact.steps,
  );
  assert.ok(
    body.data.result.evidenceAnalysis.calculationFact.steps.every(
      (item: Record<string, unknown>) =>
        Array.isArray(item.dependsOnStepKeys) &&
        String(item.limitation).includes('不得把步骤完整度解释为住宅适用度'),
    ),
  );
  assert.equal(body.data.result.evidenceAnalysis.measurementFact.status, '宅卦不稳定');
  assert.equal(body.data.result.evidenceAnalysis.measurementFact.referenceStatus, '已声明');
  assert.equal(body.data.result.calculationInput.sitMountain, '寅');
  assert.equal(body.data.result.evidenceAnalysis.measurementCandidateFacts.length, 2);
  assert.ok(
    body.data.result.evidenceAnalysis.measurementCandidateFacts.every(
      (item: Record<string, unknown>) =>
        String(item.key).startsWith('measurement:bazhai:candidate:') &&
        item.status === '候选' &&
        item.measurementFactKey === 'measurement:bazhai:door' &&
        Array.isArray(item.calculationStepKeys) &&
        item.promptText &&
        Array.isArray(item.sources) &&
        item.sources.length >= 2 &&
        String(item.limitation).includes('不代表现场真实坐向'),
    ),
  );
  assert.equal(body.data.result.evidenceAnalysis.directionFacts.length, 8);
  assert.ok(
    body.data.result.evidenceAnalysis.directionFacts.every(
      (item: Record<string, unknown>) =>
        item.key &&
        item.status === '已计算' &&
        Array.isArray(item.calculationStepKeys) &&
        item.calculationStepKeys.length > 0 &&
        Array.isArray(item.sources) &&
        item.sources.length >= 2 &&
        String(item.calculation).includes('查大游年表') &&
        String(item.limitation).includes('不证明房间适用性'),
    ),
  );
  assert.equal(body.data.result.evidenceAnalysis.counterEvidenceFacts.length, 6);
  assert.equal(
    body.data.result.evidenceAnalysis.counterEvidenceFacts.find(
      (item: { type: string }) => item.type === '命卦年界',
    ).status,
    '待复核',
  );
  assert.equal(
    body.data.result.evidenceAnalysis.counterEvidenceFacts.find(
      (item: { type: string }) => item.type === '宅卦边界稳定性',
    ).status,
    '不稳定',
  );
  assert.equal(
    body.data.result.evidenceAnalysis.counterEvidenceFacts.find(
      (item: { type: string }) => item.type === '北向基准',
    ).status,
    '已覆盖',
  );
  assert.equal(body.data.result.evidenceAnalysis.counterSummaryFact.status, '存在需保留反证');
  assert.equal(body.data.result.evidenceAnalysis.limitationFacts.length, 6);
  assert.equal(body.data.result.evidenceAnalysis.summaryFact.key, 'bazhai:evidence-summary');
  assert.equal(body.data.result.evidenceAnalysis.summaryFact.status, '证据链有缺口');
  assert.equal(
    body.data.result.evidenceAnalysis.summaryFact.directionFactCount,
    body.data.result.evidenceAnalysis.directionFacts.length,
  );
  assert.equal(
    body.data.result.evidenceAnalysis.summaryFact.alignedDirectionCount,
    body.data.result.evidenceAnalysis.alignedDirections.length,
  );
  assert.equal(
    body.data.result.evidenceAnalysis.summaryFact.conflictingDirectionCount,
    body.data.result.evidenceAnalysis.conflictingDirections.length,
  );
  assert.equal(
    body.data.result.evidenceAnalysis.summaryFact.measurementCandidateCount,
    body.data.result.evidenceAnalysis.measurementCandidateFacts.length,
  );
  assert.equal(
    body.data.result.evidenceAnalysis.summaryFact.counterEvidenceCount,
    body.data.result.evidenceAnalysis.counterEvidenceFacts.length,
  );
  assert.equal(
    body.data.result.evidenceAnalysis.summaryFact.limitationFactCount,
    body.data.result.evidenceAnalysis.limitationFacts.length,
  );
  const bazhaiFactKeys = new Set([
    body.data.result.evidenceAnalysis.summaryFact.key,
    ...body.data.result.evidenceAnalysis.summaryFact.factKeys,
  ]);
  assert.ok(
    body.data.result.evidenceAnalysis.counterEvidenceFacts.every(
      (item: Record<string, any>) =>
        item.ownerFactKeys.length > 0 &&
        item.ownerFactKeys.every((key: string) => bazhaiFactKeys.has(key)),
    ),
  );
  assert.ok(
    body.data.result.evidenceAnalysis.limitationFacts.every(
      (item: Record<string, any>) =>
        item.ownerFactKeys.length > 0 &&
        item.ownerFactKeys.every((key: string) => bazhaiFactKeys.has(key)),
    ),
  );
  assert.equal(
    body.data.result.evidenceAnalysis.limitations.length,
    body.data.result.evidenceAnalysis.limitationFacts.length,
  );
  assert.doesNotMatch(
    body.data.result.evidenceAnalysis.promptText,
    /命语|本项目|项目统一|调用方|当前调用|工程|接口|API|MCP/,
  );
  assertPromptIsPortableTaskText(body.data.result.evidenceAnalysis.promptText);
  assert.match(body.data.prompt, /【八宅风水排盘】/);
  assert.match(body.data.prompt, /【测量换算】/);
  assert.match(body.data.prompt, /误差候选：/);
  assert.match(body.data.prompt, /【当前时间】/);
  assert.match(body.data.prompt, /【问题】\n住宅办公方位怎么安排？/);
  assert.match(body.data.prompt, /【任务】/);
  assert.doesNotMatch(body.data.prompt, /【输出要求】/);
  assert.doesNotMatch(body.data.prompt, /结构化证据|证据汇总|解释限制|计算链|主证、辅证、反证/);
});

test('公开 API 七政四余应返回十一星、真实距星宿界、证据链与提示词', async () => {
  const input = {
    year: 2024,
    month: 6,
    day: 15,
    hour: 12,
    minute: 0,
    latitude: 39.9,
    longitude: 116.4,
    timezone: 8,
    detailMode: 'full',
  };
  const calculate = await callApi('metaphysics/qizheng/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  assert.equal(calculate.response.status, 200);
  assert.equal(calculate.body.data.stars.length, 11);
  assert.equal(calculate.body.data.mansionBoundaries.length, 28);
  assert.equal(
    calculate.body.data.mansionModel.id,
    'qizheng-mansion-stars-simbad-astronomy-engine',
  );
  assert.equal(calculate.body.data.evidenceAnalysis.status, '已计算');
  assert.equal(calculate.body.data.evidenceAnalysis.summaryFact.status, '证据链完整');
  assert.ok(
    calculate.body.data.stars.some(
      (star: { precisionClass: string }) => star.precisionClass === '现代天文计算',
    ),
  );
  assert.ok(
    calculate.body.data.stars.some(
      (star: { precisionClass: string }) => star.precisionClass === '传统均速模型',
    ),
  );

  const promptResponse = await callApi('metaphysics/qizheng/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, question: '请分析本命结构。' }),
  });
  assert.equal(promptResponse.response.status, 200);
  assertPromptHasSingleRole(promptResponse.body.data.prompt, PROMPT_ROLE_TEXT.qizheng);
  assert.match(
    promptResponse.body.data.prompt,
    /【七政四余 · 果老星宗】[\s\S]*七政 太阳：[\s\S]*四余 紫炁\(木余\)：[\s\S]*【问题】\n请分析本命结构。/,
  );
  assert.doesNotMatch(promptResponse.body.data.prompt, /宿界模型/);
  assertPromptIsPortableTaskText(promptResponse.body.data.prompt);
});
test('公开 API 太乙应返回年计七十二局立成结果', async () => {
  const { response, body } = await callApi('metaphysics/taiyi/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ year: 2004, scope: 'year', detailMode: 'full' }),
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
  assert.equal(body.data.model.id, 'taiyi-year-calculation-72-table');
  assert.equal(body.data.evidenceAnalysis.key, 'taiyi:evidence');
  assert.equal(body.data.evidenceAnalysis.status, '已计算');
  assert.equal(body.data.evidenceAnalysis.evidence.title, '太乙年计七十二局结构化证据');
  assert.equal(body.data.evidenceAnalysis.calculationSteps.length, 4);
  assert.ok(
    body.data.evidenceAnalysis.calculationSteps.every(
      (item: Record<string, unknown>) =>
        String(item.key).startsWith('taiyi:calculation:') &&
        item.status === '已复算' &&
        Array.isArray(item.dependsOnStepKeys) &&
        item.promptText &&
        Array.isArray(item.sources) &&
        item.sources.length >= 2 &&
        String(item.limitation).includes('不证明传统解释有效性'),
    ),
  );
  assert.equal(body.data.evidenceAnalysis.positionFacts.length, 4);
  assert.equal(body.data.evidenceAnalysis.forceFacts.length, 3);
  assert.equal(body.data.evidenceAnalysis.sixteenGodFacts.length, 16);
  assert.equal(body.data.evidenceAnalysis.conditionFacts.length, 4);
  assert.equal(body.data.evidenceAnalysis.counterEvidenceFacts.length, 4);
  assert.equal(body.data.evidenceAnalysis.counterSummaryFact.status, '存在未命中条件');
  assert.equal(body.data.evidenceAnalysis.counterSummaryFact.factKeys.length, 2);
  assert.equal(body.data.evidenceAnalysis.limitationFacts.length, 5);
  assert.equal(body.data.evidenceAnalysis.summaryFact.key, 'taiyi:evidence-summary');
  assert.equal(body.data.evidenceAnalysis.summaryFact.status, '证据链完整');
  assert.equal(
    body.data.evidenceAnalysis.summaryFact.positionFactCount,
    body.data.evidenceAnalysis.positionFacts.length,
  );
  assert.equal(
    body.data.evidenceAnalysis.summaryFact.forceFactCount,
    body.data.evidenceAnalysis.forceFacts.length,
  );
  assert.equal(
    body.data.evidenceAnalysis.summaryFact.sixteenGodFactCount,
    body.data.evidenceAnalysis.sixteenGodFacts.length,
  );
  assert.equal(
    body.data.evidenceAnalysis.summaryFact.conditionFactCount,
    body.data.evidenceAnalysis.conditionFacts.length,
  );
  assert.equal(
    body.data.evidenceAnalysis.summaryFact.counterEvidenceCount,
    body.data.evidenceAnalysis.counterEvidenceFacts.length,
  );
  assert.equal(
    body.data.evidenceAnalysis.summaryFact.limitationFactCount,
    body.data.evidenceAnalysis.limitationFacts.length,
  );
  const taiyiFactKeys = new Set([
    body.data.evidenceAnalysis.summaryFact.key,
    ...body.data.evidenceAnalysis.summaryFact.factKeys,
  ]);
  assert.ok(
    body.data.evidenceAnalysis.counterEvidenceFacts.every(
      (item: Record<string, any>) =>
        item.ownerFactKeys.length > 0 &&
        item.ownerFactKeys.every((key: string) => taiyiFactKeys.has(key)),
    ),
  );
  assert.ok(
    body.data.evidenceAnalysis.limitationFacts.every(
      (item: Record<string, any>) =>
        item.ownerFactKeys.length > 0 &&
        item.ownerFactKeys.every((key: string) => taiyiFactKeys.has(key)),
    ),
  );
  assert.equal(
    body.data.evidenceAnalysis.limitations.length,
    body.data.evidenceAnalysis.limitationFacts.length,
  );
  assert.ok(
    body.data.evidenceAnalysis.forceFacts.every(
      (item: Record<string, unknown>) =>
        item.status === '已计算' &&
        Array.isArray(item.calculationStepKeys) &&
        item.promptText &&
        Array.isArray(item.sources) &&
        item.sources.length >= 2 &&
        String(item.limitation).includes('不直接证明现实胜负'),
    ),
  );
  assert.ok(
    body.data.evidenceAnalysis.conditionFacts.some(
      (item: Record<string, unknown>) => item.kind === '囚' && item.status === '已命中',
    ),
  );
  assert.match(body.data.evidenceAnalysis.promptText, /证据汇总：[\s\S]*解释限制（方法限制）：/);
  assert.doesNotMatch(body.data.evidenceAnalysis.promptText, /宜先守后动|不宜轻进/);
  assert.doesNotMatch(
    body.data.evidenceAnalysis.promptText,
    /命语|本项目|项目统一|当前结果|工程|接口|API|MCP/,
  );
  assertPromptIsPortableTaskText(body.data.evidenceAnalysis.promptText);

  const promptResponse = await callApi('metaphysics/taiyi/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      year: 2004,
      scope: 'year',
      question: '请分析这一年适合采取什么行动。',
    }),
  });
  assert.equal(promptResponse.response.status, 200);
  assertPromptHasSingleRole(promptResponse.body.data.prompt, PROMPT_ROLE_TEXT.taiyi);
  assert.doesNotMatch(
    promptResponse.body.data.prompt,
    /系统提示词|回答中不要|取证顺序|证据边界|只依据|只基于/,
  );
});

test('公开 API 生肖流年应要求明确年份并校验年份干支一致', async () => {
  const calculation = await callApi('metaphysics/zodiac/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ zodiac: '鼠', year: 2026 }),
  });

  assert.equal(calculation.response.status, 200);
  assert.equal(calculation.body.data.zodiacBranch, '子');
  assert.equal(calculation.body.data.yearGanZhi, '丙午');

  const prompted = await callApi('metaphysics/zodiac/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      zodiac: '鼠',
      yearGanZhi: '丙午',
      question: '请解释本年的生肖关系。',
      responseMode: 'full',
    }),
  });
  assert.equal(prompted.response.status, 200);
  assert.equal(prompted.body.data.result.yearGanZhi, '丙午');
  assert.match(prompted.body.data.prompt, /【生肖与流年关系简析】/);
  assert.match(prompted.body.data.prompt, /【问题】\n请解释本年的生肖关系。/);
  assertPromptIsPortableTaskText(prompted.body.data.prompt);

  for (const input of [{ zodiac: '鼠' }, { zodiac: '鼠', year: 1900, yearGanZhi: '甲子' }]) {
    const invalid = await callApi('metaphysics/zodiac/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    assert.equal(invalid.response.status, 400);
    assert.equal(invalid.body.error.code, 'BAD_REQUEST');
    assert.match(invalid.body.error.message, /至少提供一个|不一致/);
  }
});

test('公开 API 五运六气应返回年度主客气结构与轻量提示词结果', async () => {
  const calculation = await callApi('metaphysics/wuyun-liuqi/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ year: 2026, yearGanZhi: '丙午' }),
  });

  assert.equal(calculation.response.status, 200);
  assert.equal(calculation.body.data.input.yearGanZhi, '丙午');
  assert.equal(calculation.body.data.annualMovement.name, '水运');
  assert.equal(calculation.body.data.annualMovement.strength, '太过');
  assert.equal(calculation.body.data.sitian.name, '少阴君火');
  assert.equal(calculation.body.data.zaiquan.name, '阳明燥金');
  assert.equal(calculation.body.data.annualRelation.kind, '不和');
  assert.deepEqual(calculation.body.data.annualConformities.names, []);
  assert.equal(
    calculation.body.data.annualConformities.sourceReconciliation.distinctYearsByListedRules,
    26,
  );
  assert.equal(calculation.body.data.movementSteps.length, 5);
  assert.deepEqual(
    calculation.body.data.movementSteps.map(
      (step: { hostMovement: { toneName: string } }) => step.hostMovement.toneName,
    ),
    ['太角', '少徵', '太宫', '少商', '太羽'],
  );
  assert.equal(calculation.body.data.movementSteps[0].guestMovement.toneName, '太羽');
  assert.equal(calculation.body.data.movementSteps[1].startBoundary.description, '春分后第13日起');
  assert.equal(calculation.body.data.qiSteps.length, 6);
  assert.deepEqual(calculation.body.data.qiSteps[0].solarTerms, ['大寒', '立春', '雨水', '惊蛰']);
  assert.equal(typeof calculation.body.data.qiSteps[0].hostGuestRelation.kind, 'string');
  assert.equal(calculation.body.data.qiSteps[2].guestRole, '司天');
  assert.equal(calculation.body.data.qiSteps[5].guestRole, '在泉');

  const prompted = await callApi('metaphysics/wuyun-liuqi/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      yearGanZhi: '丙午',
      question: '请解释本年的气候节律。',
      responseMode: 'summary',
    }),
  });

  assert.equal(prompted.response.status, 200);
  assert.equal(prompted.body.data.result, undefined);
  assert.equal(prompted.body.data.resultSummary.yearGanZhi, '丙午');
  assert.equal(prompted.body.data.resultSummary.annualRelation.kind, '不和');
  assert.equal(
    prompted.body.data.resultSummary.annualConformities.sourceReconciliation.sourceSummaryYears,
    28,
  );
  assert.equal(prompted.body.data.resultSummary.movementSteps.length, 5);
  assert.equal(prompted.body.data.resultSummary.qiSteps.length, 6);
  assert.match(prompted.body.data.prompt, /【盘面资料】[\s\S]*司天与中运：不和/);
  assert.match(prompted.body.data.prompt, /五步主客运：[\s\S]*初运/);
  assert.match(prompted.body.data.prompt, /大寒、立春、雨水、惊蛰/);
  assert.match(prompted.body.data.prompt, /【问题】\n请解释本年的气候节律。/);
  assertPromptIsPortableTaskText(prompted.body.data.prompt);
});

test('公开 API 皇极经世应直接按公元年返回完整值年卦，并保留自定义纪元换算', async () => {
  const standard = await callApi('metaphysics/huangji-jingshi/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ year: 2026 }),
  });

  assert.equal(standard.response.status, 200);
  assert.equal(standard.body.data.input.mode, '通行公元年');
  assert.equal(standard.body.data.forecast.hui.branch, '午');
  assert.equal(standard.body.data.forecast.hexagrams.governing.hexagram.name, '泽风大过');
  assert.equal(standard.body.data.forecast.hexagrams.yun.hexagram.name, '天风姤');
  assert.equal(standard.body.data.forecast.hexagrams.sixtyYear.hexagram.name, '火风鼎');
  assert.equal(standard.body.data.forecast.hexagrams.decade.hexagram.name, '天风姤');
  assert.equal(standard.body.data.forecast.hexagrams.annual.name, '天火同人');

  const calculation = await callApi('metaphysics/huangji-jingshi/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ epochYear: 1000, year: 2026 }),
  });

  assert.equal(calculation.response.status, 200);
  assert.equal(calculation.body.data.input.elapsedYears, 1026);
  assert.equal(calculation.body.data.position.yuan.indexFromEpoch, 1);
  assert.equal(calculation.body.data.position.hui.indexInYuan, 1);
  assert.equal(calculation.body.data.position.yun.indexInYuan, 3);
  assert.equal(calculation.body.data.position.shi.indexInYun, 11);
  assert.equal(calculation.body.data.position.year.indexInShi, 7);
  assert.equal(calculation.body.data.progress.shi.completedYears, 6);
  assert.equal(calculation.body.data.progress.shi.remainingYearsAfterCurrent, 23);
  assert.equal(calculation.body.data.progress.shi.nextCycleStartYear, 2050);
  assert.equal(calculation.body.data.forecast, undefined);

  const prompted = await callApi('metaphysics/huangji-jingshi/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      year: 2026,
      question: '请解释这一年的事业环境。',
      responseMode: 'summary',
    }),
  });

  assert.equal(prompted.response.status, 200);
  assert.equal(prompted.body.data.result, undefined);
  assert.equal(prompted.body.data.resultSummary.input.epochYear, -67017);
  assert.equal(prompted.body.data.resultSummary.position.year.coordinate, 2026);
  assert.equal(prompted.body.data.resultSummary.forecast.hexagrams.annual.name, '天火同人');
  assert.match(prompted.body.data.prompt, /【排盘资料】[\s\S]*目标年份：公元2026年/);
  assert.match(prompted.body.data.prompt, /六十年统卦：火风鼎[\s\S]*十年卦：天风姤/);
  assert.match(prompted.body.data.prompt, /值年卦：天火同人/);
  assert.match(prompted.body.data.prompt, /【问题】\n请解释这一年的事业环境。/);
  assertPromptIsPortableTaskText(prompted.body.data.prompt);
});

test('公开 API 太乙应拒绝尚未校勘的月日时计', async () => {
  for (const path of ['metaphysics/taiyi/calculate', 'metaphysics/taiyi/prompt']) {
    for (const scope of ['month', 'day', 'hour']) {
      const { response, body } = await callApi(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, year: 2026, month: 7, day: 11, hour: 14, minute: 35 }),
      });
      assert.equal(response.status, 400, `${path}:${scope}`);
      assert.equal(body.error.code, 'BAD_REQUEST', `${path}:${scope}`);
    }
  }
});

test('公开 API 玄空飞星应返回真实下卦局型', async () => {
  const valid = await callApi('metaphysics/xuankong/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ year: 2008, sitMountain: '子', detailMode: 'full' }),
  });
  assert.equal(valid.response.status, 200);
  assert.equal(valid.body.data.formation, '双星到向');
  assert.ok(
    valid.body.data.combinations.some((item: { name: string }) => item.name === '七星真打劫'),
  );
  assert.equal(valid.body.data.engine.name, '@soul-atelier/xuankong');
  assert.equal(valid.body.data.engine.mode, '下卦');
  assert.equal(valid.body.data.guaType, undefined);
  assert.equal(valid.body.data.replacementApplied, undefined);
  assert.match(valid.body.data.evidenceAnalysis.promptText, /下卦|元龙阴阳|双星到向/);
});

test('公开 API 新增术数应拒绝缺失组合和无效日期坐标', async () => {
  const cases = [
    ['metaphysics/bazhai/calculate', { birthYear: 1990 }],
    ['metaphysics/bazhai/calculate', { mingGua: '未知卦' }],
    ['metaphysics/bazhai/calculate', { mingGua: '坎', sitMountain: '未知山' }],
    ['metaphysics/taiyi/calculate', { scope: 'year' }],
    ['metaphysics/taiyi/calculate', { year: 2004, scope: 'month' }],
    ['metaphysics/taiyi/calculate', { year: 2026, scope: 'hour', month: 7, day: 11 }],
    ['metaphysics/taiyi/calculate', { year: 2026, scope: 'minute', month: 7, day: 11, hour: 14 }],
    ['metaphysics/wuyun-liuqi/calculate', {}],
    ['metaphysics/wuyun-liuqi/calculate', { yearGanZhi: '甲丑' }],
    ['metaphysics/wuyun-liuqi/calculate', { year: 2026, yearGanZhi: '乙巳' }],
    ['metaphysics/huangji-jingshi/calculate', { elapsedYears: 1026 }],
    ['metaphysics/huangji-jingshi/calculate', { year: 0 }],
    ['metaphysics/huangji-jingshi/calculate', { year: 2026, elapsedYears: 1026 }],
    ['metaphysics/huangji-jingshi/calculate', { epochYear: 1000 }],
    ['metaphysics/huangji-jingshi/calculate', { epochYear: 1000, year: 2026, elapsedYears: 1026 }],
    ['metaphysics/huangji-jingshi/calculate', { epochYear: 1000, year: 999 }],
    ['metaphysics/qizheng/calculate', { month: 1, day: 1, hour: 12 }],
    ['metaphysics/qizheng/calculate', { year: 2026, day: 1, hour: 12 }],
    ['metaphysics/qizheng/calculate', { year: 2026, month: 1, hour: 12 }],
    ['metaphysics/qizheng/calculate', { year: 2026, month: 1, day: 1 }],
    ['metaphysics/qizheng/calculate', { year: 2026, month: 2, day: 30, hour: 12 }],
    ['metaphysics/qizheng/calculate', { year: 2026, month: 1, day: 1, hour: 12, latitude: 120 }],
    ['metaphysics/qizheng/calculate', { year: 2026, month: 1, day: 1, hour: 12, timezone: 15 }],
    ['metaphysics/xuankong/calculate', { sitMountain: '子' }],
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

test('公开 API 住宅风水合参接口返回八宅与玄空分层结果', async () => {
  const { response, body } = await callApi('metaphysics/residential/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      birthYear: 1990,
      birthMonth: 5,
      birthDay: 12,
      gender: 'male',
      year: 2024,
      doorToInteriorDegree: 0,
      responseMode: 'full',
      question: '这套房怎么看？',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.result.key, 'residential-fengshui');
  assert.ok(body.data.result.bazhai);
  assert.ok(body.data.result.xuankong);
  assert.match(body.data.prompt, /【住宅风水排盘】/);
  assert.match(body.data.prompt, /【传统依据】/);
  assert.match(body.data.prompt, /这套房怎么看？/);
});

test('公开 API 住宅风水缺建造或起运年时不得静默生成玄空盘', async () => {
  const withPerson = await callApi('metaphysics/residential/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      birthYear: 1990,
      birthMonth: 5,
      birthDay: 12,
      gender: 'male',
      doorToInteriorDegree: 0,
    }),
  });

  assert.equal(withPerson.response.status, 200);
  assert.equal(withPerson.body.ok, true);
  assert.ok(withPerson.body.data.bazhai);
  assert.equal(withPerson.body.data.xuankong, null);
  assert.equal(withPerson.body.data.inputSummary.houseYear, null);
  assert.equal(withPerson.body.data.inputSummary.xuankongStatus, '缺少建造年或起运年');
  assert.doesNotMatch(
    JSON.stringify(withPerson.body.data),
    /"(?:prompt|evidenceAnalysis|evidence_analysis|evidencePromptText|calculationChain|calculationSteps)"/,
  );

  const orientationOnly = await callApi('metaphysics/residential/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ doorToInteriorDegree: 0 }),
  });
  assert.equal(orientationOnly.response.status, 400);
  assert.equal(orientationOnly.body.ok, false);
  assert.match(orientationOnly.body.error.message, /必须提供住宅建造年或起运年/);
});
