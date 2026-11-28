import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { calculate, inputSchemas } from '../src/core';
import { createServer } from '../src/mcp';
import { methodIds } from '../src/schema';
import { METHOD_CATEGORY_GROUPS } from '../src/method-registry';
import {
  applyPromptProfileToPrompt,
  distillPromptForAgent,
  distillPromptForBrief,
  distillPromptForUser,
  resolveEffectivePromptProfile,
  splitPromptIntoSystemAndUser,
} from '../src/prompt-profile';
import { webExamples } from '../src/web-examples';
import { mergeFrameworkIntoPrompt } from '../src/prompt-guidance';
import { parseQuestionContext } from '../src/systems/question-context';
import { resolveAutoFrameworkForPrompt } from '../src/router-model/frameworks';
import { formatFrameworkPromptBlock } from '../src/router-model/local-agent';
import { promptFormSchema, schoolOptionLabels } from '../src/web-prompt-schema';

test('全量 39 术数精炼器无吞问题、无病句截断、无英文字段漏网、保留秒级精度', async () => {
  for (const method of methodIds) {
    const ex = webExamples[method];
    const res = (await calculate(method, ex, {
      promptGuidance: { enableContract: true, replyStyle: 'standard', topTaskAnchor: true },
    })) as { prompt: { text: string } };
    const raw = res.prompt.text;
    const dist = distillPromptForUser(raw, { includeClassics: false });

    if (raw.includes('【问题】') || raw.includes('【用户具体问题】')) {
      assert.ok(
        dist.includes('【问题】') || dist.includes('【用户具体问题】'),
        `${method}: 精炼后不应丢失用户问题段落`,
      );
    }
    assert.equal(dist.includes('并或喜忌'), false, `${method}: 不应截断成病句“并或喜忌”`);
    assert.equal(dist.includes('applyChinaDst'), false, `${method}: 不应漏出英文键 applyChinaDst`);
    assert.equal(/基准\s*true/i.test(dist), false, `${method}: 不应漏出 基准true`);
    assert.equal(/\bplacidus\b/i.test(dist), false, `${method}: 不应漏出英文宫位制 placidus`);
    assert.equal(/\btyme4ts\b/i.test(dist), false, `${method}: 不应漏出内部库名 tyme4ts`);
    assert.equal(/属公版（）/.test(dist), false, `${method}: 删链接后不应残留空括号`);
    assert.equal(/性别：[男女]出生时间/.test(dist), false, `${method}: 性别与出生时间之间不应缺少分隔符`);
  }

  // 历法节气应保留秒数且不再左右重复
  const cal = (await calculate('calendar', webExamples.calendar, {
    promptGuidance: { enableContract: true, replyStyle: 'standard', topTaskAnchor: true },
  })) as { prompt: { text: string } };
  const calDist = distillPromptForUser(cal.prompt.text, { includeClassics: false });
  assert.match(calDist, /北京时间 \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/, '历法节气应保留精确到秒的北京时间');
  assert.doesNotMatch(calDist, /(\d{4}-\d{2}-\d{2} \d{2}:\d{2})｜北京时间 \1/, '历法节气不应左右重复写同一分钟时间');
  assert.match(calDist, /2024年为甲辰年/, '查 2024 年历法时顶部锚点应使用 2024 年基准而非写死当年');

  // 七政出生范围应保留秒级起止区间
  const qzr = (await calculate('qizheng-range', webExamples['qizheng-range'])) as { prompt: { text: string } };
  const qzrDist = distillPromptForUser(qzr.prompt.text, { includeClassics: false });
  assert.match(qzrDist, /11:24:48 至 .*11:24:52/, '七政出生范围应保留秒级起止时间');
});

test('主题隔离：买房搬家归入家宅焦点不误当看病，单术数提示词零跨术数串台', async () => {
  const houseCtx = parseQuestionContext('今年适合买房搬家装修吗？');
  assert.equal(houseCtx.inferredTopic, 'house');
  assert.equal(houseCtx.liuyaoCategory, 'house');

  const baziHouse = (await calculate('bazi', {
    ...webExamples.bazi,
    question: '今年适合买房搬家吗？',
  })) as { prompt: { text: string } };
  assert.match(baziHouse.prompt.text, /家宅置业焦点/);
  assert.doesNotMatch(baziHouse.prompt.text, /疾厄宫|作息与生活节律调养/);

  const baziCareer = (await calculate('bazi', {
    ...webExamples.bazi,
    question: '我今年事业和升职机会如何？',
  })) as { prompt: { text: string } };
  assert.match(baziCareer.prompt.text, /事业焦点/);
  assert.doesNotMatch(baziCareer.prompt.text, /星盘十宫|官禄宫/, '八字事业焦点不应串入紫微官禄宫或西洋星盘十宫');

  const liuyaoWealth = (await calculate('liuyao', {
    ...webExamples.liuyao,
    question: '这笔投资财运怎么样？',
  })) as { prompt: { text: string } };
  assert.match(liuyaoWealth.prompt.text, /财运焦点/);
  assert.doesNotMatch(liuyaoWealth.prompt.text, /生门|甲子戊/, '六爻财运焦点不应串入奇门生门或甲子戊');

  const liuyaoHealth = (await calculate('liuyao', {
    ...webExamples.liuyao,
    question: '最近身体不舒服生病了，恢复情况如何？',
  })) as { prompt: { text: string } };
  assert.match(liuyaoHealth.prompt.text, /身心焦点/);
});

test('框架自动过滤与融合：查询类免硬套算命框架，契约与指定框架合一不打架', async () => {
  assert.equal(resolveAutoFrameworkForPrompt('zhouyi', '这卦的经文如何理解？', 'event-verdict'), null);
  assert.equal(resolveAutoFrameworkForPrompt('calendar', '请解释这一年的节气。', 'period-roadmap'), null);
  assert.equal(resolveAutoFrameworkForPrompt('character-query', '查“知”和“远”的字义', 'naming-aesthetic'), null);
  assert.equal(resolveAutoFrameworkForPrompt('bazi', '事业如何？', 'natal-panorama'), null);
  assert.equal(resolveAutoFrameworkForPrompt('bazi', '帮我综合看下本命格局和未来大运路线', 'natal-panorama'), 'natal-panorama');

  const fortuneRes = (await calculate('fortune', webExamples.fortune)) as { prompt: { text: string } };
  const merged = mergeFrameworkIntoPrompt(
    distillPromptForUser(fortuneRes.prompt.text, { includeClassics: false }),
    formatFrameworkPromptBlock('period-roadmap'),
  );
  assert.equal(merged.includes('【AI 报告输出规范】'), false, '附加指定解读框架时应移除冲突的内置报告规范');
  assert.match(merged, /输出格式：严格按下方【指定解读框架】分步结构输出/);
  assert.equal((merged.match(/【指定解读框架：/g) ?? []).length, 1);
});

test('站内 Agent 精炼与单盘 AI system/user 拆分正常工作', async () => {
  const baziRes = (await calculate('bazi', webExamples.bazi, {
    promptGuidance: { enableContract: true, replyStyle: 'standard', topTaskAnchor: true },
  })) as { prompt: { text: string } };
  const agentText = distillPromptForAgent(baziRes.prompt.text, { includeClassics: false });
  assert.equal(agentText.includes('【顶部任务锚点】'), false);
  assert.equal(agentText.includes('【解读与交付契约】'), false);
  assert.equal(agentText.includes('【已迁移路线的格局排序】'), false);
  assert.ok(agentText.includes('【四柱】') && agentText.includes('【用神裁定与落位】'));
  assert.ok(agentText.length < baziRes.prompt.text.length * 0.85, `Agent 精炼应进一步压缩八字提示词（实际 ${agentText.length}/${baziRes.prompt.text.length}）`);

  const userText = distillPromptForUser(baziRes.prompt.text, { includeClassics: false });
  const split = splitPromptIntoSystemAndUser(userText);
  assert.ok(split.system?.includes('【解读与交付契约】'));
  assert.equal(split.user.includes('【解读与交付契约】'), false);
  assert.equal(split.user.includes('【顶部任务锚点】'), false);
  assert.ok(split.user.includes('【四柱】') && split.user.includes('【问题】'));
});

test('源头去重：住宅双层合参仅输出 1 次理气制衡，七政范围多分支折叠重复段', async () => {
  const res = (await calculate('residential', webExamples.residential)) as { prompt: { text: string } };
  assert.equal(
    (res.prompt.text.match(/【方位格局与理气制衡关系】/g) ?? []).length,
    1,
    '住宅双层合参不应连续出现 3 次同名【方位格局与理气制衡关系】',
  );

  const qzr = (await calculate('qizheng-range', webExamples['qizheng-range'])) as { prompt: { text: string } };
  assert.equal((qzr.prompt.text.match(/【问题】/g) ?? []).length, 1, '七政范围应在文末统一只输出 1 次【问题】');
  assert.match(qzr.prompt.text, /与分支 1 相同项已折叠/);
  assert.match(qzr.prompt.text, /【十一星（仅列变化项）】/);
});

test('流派中文标签全覆盖 39 术数 schema，且 MCP router 目录包含 fortune', async () => {
  for (const method of methodIds) {
    const js = z.toJSONSchema(inputSchemas[method]) as {
      properties?: { prompt?: { properties?: Record<string, { items?: { enum?: string[] } }> } };
    };
    const promptSchema = js.properties?.prompt;
    if (!promptSchema?.properties) continue;
    const form = promptFormSchema(method, promptSchema, {}) as {
      properties: Record<string, { optionLabels?: Record<string, string> }>;
    };
    for (const key of ['schools', 'baziSchools', 'ziweiSchools'] as const) {
      const enums = promptSchema.properties[key]?.items?.enum;
      if (!Array.isArray(enums)) continue;
      for (const s of enums) {
        assert.ok(s in schoolOptionLabels, `${method}.${key} 缺少流派标签: ${s}`);
        assert.ok(form.properties[key]?.optionLabels?.[s], `${method}.${key} 未挂接 optionLabels: ${s}`);
      }
    }
  }

  const [ct, st] = InMemoryTransport.createLinkedPair();
  const server = createServer(methodIds, undefined, { mode: 'router' });
  const client = new Client({ name: 'audit-test', version: '1' });
  await Promise.all([server.connect(st), client.connect(ct)]);
  try {
    const listed = await client.callTool({ name: 'list_methods', arguments: { category: 'mingli' } });
    const structured = listed.structuredContent as { categories: Array<{ methods: Array<{ id: string }> }> };
    const ids = structured.categories.flatMap((c) => c.methods.map((m) => m.id));
    assert.ok(ids.includes('fortune'), 'MCP router 的 mingli 分类应包含 fortune');
  } finally {
    await client.close();
    await server.close();
  }
});

test('SSOT 方法注册表完整覆盖全部 39 种术数且无遗漏或重复', () => {
  const registered = METHOD_CATEGORY_GROUPS.flatMap((group) => group.methods);
  const missing = methodIds.filter((id) => !registered.includes(id));
  const extra = registered.filter((id) => !methodIds.includes(id));
  const duplicates = registered.filter((id, idx) => registered.indexOf(id) !== idx);
  assert.deepEqual(missing, []);
  assert.deepEqual(extra, []);
  assert.deepEqual(duplicates, []);
});

test('PromptProfile 源头分档：默认 standard 无损保留，audit 保留原貌，agent 源头直出紧凑纯事实', async () => {
  assert.equal(resolveEffectivePromptProfile(undefined), 'standard');
  assert.equal(resolveEffectivePromptProfile({ detailMode: 'full' }), 'audit');
  assert.equal(resolveEffectivePromptProfile({ detailMode: 'compact' }, 'agent'), 'agent');

  const sample = {
    text: '【任务】\n按盘分析。\n\n【说明】\n排盘采用精密节气历表；完整资料见结构化结果。\n\n【解读与交付契约】\n不要重算。',
  };
  const std = applyPromptProfileToPrompt(sample, 'standard');
  assert.ok(!std.text?.includes('完整资料见结构化结果'));
  assert.ok(std.text?.includes('【任务】'));

  const audit = applyPromptProfileToPrompt(sample, 'audit');
  assert.equal(audit.text, sample.text);

  const agent = applyPromptProfileToPrompt(sample, 'agent');
  assert.ok(!agent.text?.includes('【解读与交付契约】'));

  const agentRes = (await calculate('bazi', webExamples.bazi, {
    promptProfile: 'agent',
    promptGuidance: { enableContract: true, replyStyle: 'standard', topTaskAnchor: true },
  })) as { prompt: { text: string } };
  assert.equal(agentRes.prompt.text.includes('【解读与交付契约】'), false);
  assert.equal(agentRes.prompt.text.includes('【顶部任务锚点】'), false);
  assert.ok(agentRes.prompt.text.includes('【四柱】') && agentRes.prompt.text.includes('【用神裁定与落位】'));
});

test('含古籍切回标准时剥离全部 8 类典籍与来源段落，字数严格下降', async () => {
  const headers = [
    '【典籍片段】',
    '【典籍参考】',
    '【典籍依据参考】',
    '【卦爻辞辅助资料】',
    '【经典依据】',
    '【经典资料摘要】',
    '【传统资料】',
    '【来源说明】',
  ];
  const sampleWithAllClassicsHeaders = [
    '【盘面】\n主卦泽雷随，变卦水雷屯。',
    ...headers.map((header) => `${header}\n${header.slice(1, -1)}示例内容。`),
    '【问题】\n这件事走势如何？',
  ].join('\n\n');

  const withClassics = distillPromptForUser(sampleWithAllClassicsHeaders, { includeClassics: true });
  const standardText = distillPromptForUser(sampleWithAllClassicsHeaders, { includeClassics: false });

  assert.ok(
    standardText.length < withClassics.length,
    `切回标准应严格短于含古籍 (${standardText.length} < ${withClassics.length})`,
  );
  for (const header of headers) {
    assert.ok(withClassics.includes(header), `含古籍档位应保留 ${header}`);
    assert.equal(standardText.includes(header), false, `标准档位应剥离 ${header}`);
  }
  assert.ok(standardText.includes('【盘面】') && standardText.includes('【问题】'));
});

test('distillPromptForBrief 深度精简核心术数至少省 35% 字数且保留核心盘面事实与问题', async () => {
  const keys = ['bazi', 'ziwei', 'xiaoliuren', 'meihua', 'liuyao', 'qimen', 'astrolabe', 'lenormand', 'tarot'] as const;
  const briefs = new Map<string, string>();
  for (const m of keys) {
    const res = (await calculate(m, webExamples[m], {
      promptGuidance: { enableContract: true, replyStyle: 'standard', topTaskAnchor: true },
    })) as { prompt: { text: string } };
    const std = distillPromptForUser(res.prompt.text, { includeClassics: false });
    const brief = distillPromptForBrief(res.prompt.text);
    assert.ok(
      brief.length < std.length * 0.65,
      `${m}: 精简(${brief.length}) 应低于 标准(${std.length}) 的 65%`,
    );
    assert.ok(brief.length > 100, `${m}: 精简结果不应过度截断 (${brief.length})`);
    briefs.set(m, brief);
  }

  const baziBrief = briefs.get('bazi')!;
  assert.ok(baziBrief.includes('【四柱】') && baziBrief.includes('【用神裁定与落位】') && baziBrief.includes('【问题】'));

  const xlrBrief = briefs.get('xiaoliuren')!;
  assert.ok(xlrBrief.includes('【占卜资料】') && xlrBrief.includes('【问题】'));

  const meihuaBrief = briefs.get('meihua')!;
  assert.ok(meihuaBrief.includes('【取数与卦象】') && meihuaBrief.includes('【体用与阶段】') && meihuaBrief.includes('【问题】'));
  assert.equal(meihuaBrief.includes('万物属类'), false, '梅花精简版应裁掉大段万物属类');

  const ziweiBrief = briefs.get('ziwei')!;
  assert.ok(ziweiBrief.includes('【本命十二宫】') && ziweiBrief.includes('【问题】'));
});

test('distillPromptForUser 标准档也自动剥离完全重复的重述段落并保留真实深层分析', async () => {
  const xlrRes = (await calculate('xiaoliuren', webExamples.xiaoliuren)) as { prompt: { text: string } };
  const xlrStd = distillPromptForUser(xlrRes.prompt.text, { includeClassics: false });
  assert.equal(xlrStd.includes('【三宫递进与体用制衡关系】'), false, '标准版小六壬应去掉完全重复的三宫制衡重述');
  assert.equal(xlrStd.includes('历法口径：'), false, '标准版应去掉占卜资料末尾泛用历法口径说明');
  assert.ok(xlrStd.includes('【三宫与体用生克】'));

  const mhRes = (await calculate('meihua', webExamples.meihua)) as { prompt: { text: string } };
  const mhStd = distillPromptForUser(mhRes.prompt.text, { includeClassics: false });
  assert.equal(mhStd.includes('【体用阶段演变与制衡关系】'), false, '标准版梅花应去掉重复的阶段演变重述');
  assert.ok(mhStd.includes('【体用与阶段】') && mhStd.includes('万物属类'));

  for (const cardMethod of ['tarot', 'lenormand'] as const) {
    const res = (await calculate(cardMethod, webExamples[cardMethod])) as { prompt: { text: string } };
    const std = distillPromptForUser(res.prompt.text, { includeClassics: false });
    assert.equal(std.includes('【牌阵结构与牌间呼应关系】'), false, `标准版 ${cardMethod} 应去掉重复的牌阵结构重述`);
    assert.ok(std.includes('【占卜资料】'));
  }

  const bzRes = (await calculate('bazi', webExamples.bazi)) as { prompt: { text: string } };
  const bzStd = distillPromptForUser(bzRes.prompt.text, { includeClassics: false });
  for (const h of ['【普通月令取格候选】', '【格局透干与根气条件】', '【司权、病药与通关候选】']) {
    assert.equal(bzStd.includes(h), false, `标准版八字应去掉重复中间段落 ${h}`);
  }
  assert.ok(bzStd.includes('【日主旺衰条件模型】') && bzStd.includes('【用神裁定与落位】'));

  const qmRes = (await calculate('qimen', webExamples.qimen)) as { prompt: { text: string } };
  assert.ok(distillPromptForUser(qmRes.prompt.text, { includeClassics: false }).includes('【格局叠加与吉凶制衡关系】'));

  const astroRes = (await calculate('astrolabe', webExamples.astrolabe)) as { prompt: { text: string } };
  assert.ok(distillPromptForUser(astroRes.prompt.text, { includeClassics: false }).includes('【相位格局与能量制衡关系】'));
});
