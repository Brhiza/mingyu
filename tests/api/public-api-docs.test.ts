import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const publicApiDocs = readFileSync('docs/api.md', 'utf8');
const publicSkill = readFileSync('public/skills/aov-mingyu-api/SKILL.md', 'utf8');
const aovProviderRef = readFileSync(
  'public/skills/aov-mingyu-api/references/providers/aov-mingyu.md',
  'utf8',
);

test('公开 API 文档和 provider 适配层应写明 AI 接口', () => {
  for (const content of [publicApiDocs, aovProviderRef]) {
    assert.match(content, /POST \/ai\/analyze/);
    assert.match(content, /POST \/ai\/models/);
    assert.match(content, /text\/event-stream/);
    assert.match(content, /aiConfig/);
  }
});

test('公开 API 文档和 provider 适配层应覆盖完整塔罗牌阵参数', () => {
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
    'holyTriangle',
    'universal',
    'fourElements',
    'hexagram',
    'relationship',
    'wealth',
    'problemSolving',
    'twelveHouses',
  ]) {
    assert.match(publicApiDocs, new RegExp(spreadType));
    assert.match(aovProviderRef, new RegExp(spreadType));
  }
});

test('公开 API 文档和 provider 适配层应覆盖完整雷诺曼牌阵与金口诀指定地分', () => {
  for (const content of [publicApiDocs, aovProviderRef]) {
    for (const spreadType of [
      'single',
      'three',
      'five',
      'relationship',
      'decision',
      'nine',
      'element',
      'grandTableau',
    ]) {
      assert.match(content, new RegExp(spreadType));
    }
    assert.match(content, /POST \/divination\/jinkoujue/);
    assert.match(content, /jinkoujueMethod.*branch/);
    assert.match(content, /jinkoujueBranch/);
    assert.match(content, /指定地分/);
  }
});

test('公开 API 文档和 provider 适配层应覆盖五运六气与皇极经世的关键输入口径', () => {
  for (const content of [publicApiDocs, aovProviderRef]) {
    assert.match(content, /POST \/metaphysics\/wuyun-liuqi\/calculate/);
    assert.match(content, /POST \/metaphysics\/wuyun-liuqi\/prompt/);
    assert.match(content, /year.*yearGanZhi|yearGanZhi.*year/);
    assert.match(content, /天符.*岁会/);
    assert.match(content, /sourceReconciliation/);
    assert.match(content, /26 年|26年/);
    assert.match(content, /二十八年/);
    assert.match(content, /POST \/metaphysics\/huangji-jingshi\/calculate/);
    assert.match(content, /POST \/metaphysics\/huangji-jingshi\/prompt/);
    assert.match(content, /customDate.*年月日时|年月日时.*customDate/);
    assert.match(content, /年度研究.*year|year.*年度盘|公元 `year`/);
    assert.match(content, /值年卦/);
    assert.match(content, /1984 年鼎卦|1984年鼎卦/);
    assert.match(content, /epochYear/);
    assert.match(content, /year.*elapsedYears|elapsedYears.*year/);
    assert.match(content, /自定义纪元/);
  }
});

test('公开 API 文档和 provider 适配层应说明统一多派合参与排盘口径边界', () => {
  for (const content of [publicApiDocs, aovProviderRef]) {
    assert.match(content, /`schools`/);
    assert.match(content, /规划内确有合理差异/);
    assert.match(content, /一至三个/);
    assert.match(content, /共同结论|共识/);
    assert.match(content, /ziping.*mangpai.*xinpai/);
    assert.match(content, /huozhulin.*bushizhengzong.*zengshanbuyi/);
    assert.match(content, /modern.*traditional.*timing/);
    assert.match(content, /yuanhui.*guaqi/);
    assert.match(content, /转盘.*飞盘.*实际(?:排)?盘/);
    assert.match(content, /三山国王灵签.*不附加派系.*不接受 `schools`/);
  }
});

test('通用算命 Skill 应具备完整的方法论参考文件与架构引用', () => {
  const referenceFiles = [
    'public/skills/aov-mingyu-api/references/intake.md',
    'public/skills/aov-mingyu-api/references/routing.md',
    'public/skills/aov-mingyu-api/references/evidence.md',
    'public/skills/aov-mingyu-api/references/interpretation.md',
    'public/skills/aov-mingyu-api/references/timing.md',
    'public/skills/aov-mingyu-api/references/synthesis.md',
    'public/skills/aov-mingyu-api/references/output.md',
    'public/skills/aov-mingyu-api/references/safety.md',
    'public/skills/aov-mingyu-api/references/providers.md',
    'public/skills/aov-mingyu-api/references/providers/aov-mingyu.md',
  ];

  for (const file of referenceFiles) {
    assert.ok(existsSync(file), `参考文件 ${file} 应存在`);
    const content = readFileSync(file, 'utf8');
    assert.ok(content.length > 200, `参考文件 ${file} 内容应充实`);
  }

  // 验证主 SKILL.md 引用了核心方法论参考体系与提供方适配层
  assert.match(publicSkill, /references\/intake\.md/);
  assert.match(publicSkill, /references\/routing\.md/);
  assert.match(publicSkill, /references\/evidence\.md/);
  assert.match(publicSkill, /references\/interpretation\.md/);
  assert.match(publicSkill, /references\/timing\.md/);
  assert.match(publicSkill, /references\/synthesis\.md/);
  assert.match(publicSkill, /references\/output\.md/);
  assert.match(publicSkill, /references\/safety\.md/);
  assert.match(publicSkill, /references\/providers\.md/);
  assert.match(publicSkill, /references\/providers\/aov-mingyu\.md/);
});

test('主 Skill 入口应与底层数据提供方解耦，聚焦方法论工作流', () => {
  // 必须包含核心工作流生命周期与首轮判断
  assert.match(publicSkill, /标准任务生命周期/);
  assert.match(publicSkill, /首轮判断规则/);
  assert.match(publicSkill, /术数选择全景引导矩阵/);
  assert.match(publicSkill, /多术数与多流派合参要领/);
  assert.match(publicSkill, /数据提供方适配与调用指引/);
  assert.match(publicSkill, /安全、伦理与专业红线/);

  // 主入口已解耦：不应堆砌 50+ 个完整端点表，而是委托给 provider 适配层
  assert.ok(!publicSkill.includes('POST /calendar/astronomical-time'));
  assert.ok(!publicSkill.includes('POST /foundation/shensha'));
  assert.ok(!publicSkill.includes('POST /divination/tarot/prompt'));
});

test('通用算命 Skill 必须覆盖十类核心业务场景的行为与降级契约', () => {
  const intake = readFileSync('public/skills/aov-mingyu-api/references/intake.md', 'utf8');
  const routing = readFileSync('public/skills/aov-mingyu-api/references/routing.md', 'utf8');
  const evidence = readFileSync('public/skills/aov-mingyu-api/references/evidence.md', 'utf8');
  const timing = readFileSync('public/skills/aov-mingyu-api/references/timing.md', 'utf8');
  const synthesis = readFileSync('public/skills/aov-mingyu-api/references/synthesis.md', 'utf8');
  const safety = readFileSync('public/skills/aov-mingyu-api/references/safety.md', 'utf8');
  const providers = readFileSync('public/skills/aov-mingyu-api/references/providers.md', 'utf8');

  // 1. 长期创业选择：分层合参，不做吉凶总分或投票
  assert.match(synthesis, /多术数合参标准六步法/);
  assert.match(synthesis, /严禁机械打分/);
  assert.match(synthesis, /对齐认知层级与分工维度/);

  // 2. 缺出生时辰：八字前三柱，紫微/终身局严禁盲猜
  assert.match(intake, /缺时辰.*处理/s);
  assert.match(intake, /仅排年月日三柱/);
  assert.match(intake, /紫微斗数.*必须停止排盘/s);

  // 3. 一事一问：六爻为主，无需出生八字
  assert.match(routing, /六爻预测/);
  assert.match(routing, /不需要.*生辰八字/s);

  // 4. 方位谈判：时家奇门主客动静
  assert.match(routing, /时家奇门/);
  assert.match(routing, /动者为客.*静者为主/s);

  // 5. 复杂人事博弈：大六壬四课三传
  assert.match(routing, /大六壬/);
  assert.match(routing, /四课.*三传/s);

  // 6. 动态周期与应期四阶段
  assert.match(timing, /动态节点扫描分辨率/);
  assert.match(timing, /应期四阶段模型/);
  assert.match(timing, /气机萌发.*能量峰值.*动荡平复.*反复回溯/s);

  // 7. 空间住宅风水：八宅与玄空飞星合参，建筑安全优先
  assert.match(routing, /住宅风水合参/);
  assert.match(routing, /八宅.*玄空/s);

  // 8. 象征探索：塔罗/雷诺曼/灵签以反思为主
  assert.match(routing, /象征探索/);
  assert.match(routing, /三山国王灵签/);

  // 9. 高风险红线：医疗、法律、高额投资与人身安全
  assert.match(safety, /高风险领域绝对红线/);
  assert.match(safety, /绝不替代临床诊断/);
  assert.match(safety, /绝不替代执业律师/);
  assert.match(safety, /绝不承诺投资回报/);

  // 10. Provider 故障与降级：保留上下文，不把错误当凶兆
  assert.match(providers, /优雅降级/);
  assert.match(providers, /保留.*已确认资料/);
  assert.match(providers, /严禁将错误信息包装成玄学结论/);
});
