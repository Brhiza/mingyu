import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getToolCatalog,
  findTool,
  getToolsByCategory,
  getToolAnnotations,
} from '../../mcp/src/catalog/tool-catalog.js';
import { birthInputSchema } from '../../mcp/src/schemas.js';
import { createErrorToolResult, createStructuredToolResult } from '../../mcp/src/tool-results.js';

test('统一 Tool Catalog 应包含所有核心工具并声明元数据注解', () => {
  const catalog = getToolCatalog();
  assert.equal(catalog.length >= 40, true);

  const baziTool = findTool('bazi_calculate');
  assert.ok(baziTool);
  assert.equal(baziTool.category, 'bazi');
  assert.equal(baziTool.type, 'calculate');
  assert.equal(baziTool.annotations.readOnlyHint, true);
  assert.equal(baziTool.annotations.idempotentHint, true);

  const baziTools = getToolsByCategory('bazi');
  assert.equal(baziTools.length >= 4, true);

  const promptTool = findTool('ziwei_prompt');
  assert.ok(promptTool);
  assert.equal(promptTool.type, 'prompt');

  const annotations = getToolAnnotations('foundation_capabilities');
  assert.equal(annotations.readOnlyHint, true);
});

test('BirthInputSchema 应支持标准出生参数及三柱降级缺省时辰', () => {
  // 完整参数校验
  const fullInput = {
    year: 1990,
    month: 5,
    day: 15,
    gender: 'male',
    timeIndex: 6,
    dateType: 'solar',
    useTrueSolarTime: true,
    birthLongitude: 116.4,
  };
  const parsedFull = birthInputSchema.safeParse(fullInput);
  assert.equal(parsedFull.success, true);

  // 缺少时辰（三柱降级）
  const threePillarsInput = {
    year: 1990,
    month: 5,
    day: 15,
    gender: 'female',
    dateType: 'solar',
  };
  const parsedThree = birthInputSchema.safeParse(threePillarsInput);
  assert.equal(parsedThree.success, true);
  assert.equal(parsedThree.data.timeIndex, undefined);
});

test('结构化错误应返回扩展错误字段 (code, missingFields, retryable, fallback)', () => {
  const errorResult = createErrorToolResult('缺少必要出生时辰', {
    code: 'MISSING_BIRTH_TIME',
    missingFields: ['timeIndex'],
    retryable: true,
    fallback: '可选择三柱降级模式仅排年月日柱',
  });

  assert.equal(errorResult.isError, true);
  const structured = errorResult.structuredContent as Record<string, unknown>;
  assert.equal(structured.error, '缺少必要出生时辰');
  assert.equal(structured.code, 'MISSING_BIRTH_TIME');
  assert.deepEqual(structured.missingFields, ['timeIndex']);
  assert.equal(structured.retryable, true);
  assert.equal(structured.fallback, '可选择三柱降级模式仅排年月日柱');

  // content 兼容输出
  assert.equal(errorResult.content[0].type, 'text');
  const parsedContent = JSON.parse(errorResult.content[0].text);
  assert.equal(parsedContent.code, 'MISSING_BIRTH_TIME');
});

test('结构化结果 Envelope 应支持元数据与预警信息 (data, meta, warnings)', () => {
  const result = createStructuredToolResult({ result: { chart: '八字排盘数据' } }, 'compact', {
    meta: { tool: 'bazi_calculate', durationMs: 12, system: 'mingyu-mcp' },
    warnings: ['由于未输入精确时辰，时柱已降级为基准占位，仅供参考年月日三柱'],
  });

  assert.equal(result.isError, undefined);
  const structured = result.structuredContent as Record<string, unknown>;
  assert.ok(structured.result);
  assert.deepEqual(structured.meta, {
    tool: 'bazi_calculate',
    durationMs: 12,
    system: 'mingyu-mcp',
  });
  assert.deepEqual(structured.warnings, [
    '由于未输入精确时辰，时柱已降级为基准占位，仅供参考年月日三柱',
  ]);
});

test('createMingyuMcpServer 应自动为所有工具注入 annotations 元数据', async () => {
  const { createMingyuMcpServer } = await import('../../mcp/src/create-server.js');
  const server = createMingyuMcpServer();
  const registered = (
    server as unknown as {
      _registeredTools: Record<
        string,
        { annotations?: { readOnlyHint?: boolean; idempotentHint?: boolean } }
      >;
    }
  )._registeredTools;

  const baziTool = registered['bazi_calculate'];
  assert.ok(baziTool);
  assert.equal(baziTool.annotations?.readOnlyHint, true);
  assert.equal(baziTool.annotations?.idempotentHint, true);

  const liuyaoTool = registered['divine_liuyao'];
  assert.ok(liuyaoTool);
  assert.equal(liuyaoTool.annotations?.readOnlyHint, true);
  assert.equal(liuyaoTool.annotations?.idempotentHint, false);

  const thematicTool = registered['thematic_consultation_prompt'];
  assert.ok(thematicTool);
  assert.equal(thematicTool.annotations?.readOnlyHint, true);
  assert.equal(thematicTool.annotations?.idempotentHint, true);

  for (const name of [
    'name_generate',
    'name_analyze',
    'name_generate_prompt',
    'name_analyze_prompt',
    'character_analyze',
    'character_select',
    'number_analyze',
    'number_energy_prompt',
    'divine_zhuge',
    'divine_kongming',
  ]) {
    assert.ok(registered[name], `${name} 应完成注册`);
    assert.equal(registered[name].annotations?.readOnlyHint, true);
  }
});
