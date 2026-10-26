import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBaziCustomPromptPatch,
  buildZiweiCustomPromptPatch,
  applyPromptStatePatch,
  getResultPromptSelection,
  getCombinedResultPromptSelection,
  resolveBaziSelection,
} from '../src/lib/prompt-page-rules';
import {
  baziSingleShortcutActions,
  baziCompatibilityShortcutActions,
} from '../src/pages/ResultPage/ResultPage.constants';
import {
  buildResultSearch,
  defaultInputState,
  defaultPromptState,
  parsePromptState,
} from '../src/lib/query-state';
import {
  applyResultPromptSelection,
  buildBaziZiweiEnhancedPrompt,
  buildBaziZiweiCompatibilityPrompt,
} from '../src/pages/ResultPage/ResultPage.helpers';
import { getCompatibilityPrompt } from '../src/lib/prompt-engine';
import { buildPersonFromInput, calculateFullBaziChart } from '../src/lib/full-chart-engine/bazi';
import { shouldUsePhoneLayout } from '../src/lib/responsive-layout';

test('折叠屏展开时使用桌面布局，普通手机和矮横屏使用手机布局', () => {
  assert.equal(shouldUsePhoneLayout({ viewportWidth: 390, viewportHeight: 844 }), true);
  assert.equal(shouldUsePhoneLayout({ viewportWidth: 673, viewportHeight: 841 }), false);
  assert.equal(shouldUsePhoneLayout({ viewportWidth: 720, viewportHeight: 900 }), false);
  assert.equal(shouldUsePhoneLayout({ viewportWidth: 844, viewportHeight: 390 }), true);
  assert.equal(shouldUsePhoneLayout({ viewportWidth: 1024, viewportHeight: 500 }), false);
});

test('八字与紫微切换到自定义时都会清空旧快捷状态', () => {
  assert.deepEqual(
    {
      bazi: buildBaziCustomPromptPatch(),
      ziwei: buildZiweiCustomPromptPatch(),
    },
    {
      bazi: {
        baziShortcutMode: '自定义',
        baziPresetId: 'ai-mingge-zonglun',
        baziTopicId: '',
        baziSubtopicId: '',
        baziQuickQuestion: '',
      },
      ziwei: {
        ziweiShortcutMode: '自定义',
        ziweiTopic: 'chat',
        ziweiTopicId: '',
        ziweiSubtopicId: '',
        ziweiQuickQuestion: '',
      },
    },
  );
});

test('合参事业细项切自定义：应用完整 patch 后 URL、selection 和最终任务一起清除旧主题', () => {
  const previous = {
    ...defaultPromptState,
    promptSource: 'bazi-ziwei' as const,
    baziPresetId: 'ai-job-change',
    baziShortcutMode: '换工作',
    ziweiShortcutMode: '换工作',
    baziTopicId: 'career',
    baziSubtopicId: 'job-change',
    ziweiTopicId: 'career',
    ziweiSubtopicId: 'job-change',
    ziweiTopic: 'job-change',
    baziFortuneScope: 'natal' as const,
    ziweiScope: 'origin' as const,
  };
  const custom = applyPromptStatePatch(previous, buildBaziCustomPromptPatch('bazi-ziwei'));
  assert.equal(custom.baziTopicId, '');
  assert.equal(custom.ziweiTopicId, '');
  assert.equal(custom.ziweiSubtopicId, '');
  assert.equal(custom.ziweiTopic, 'chat');
  const search = buildResultSearch(defaultInputState, custom);
  assert.doesNotMatch(search, /btid=|ztid=|bts=|zts=|job-change|career/);
  const restored = parsePromptState(new URLSearchParams(search));
  const selection = getResultPromptSelection(restored);
  assert.equal(selection.topicId, 'general');
  assert.equal(selection.subtopicId, undefined);
  const result = calculateFullBaziChart(
    buildPersonFromInput({
      ...defaultInputState,
      year: '1990',
      month: '5',
      day: '15',
      timeIndex: 1,
    }),
  );
  const prompt = buildBaziZiweiEnhancedPrompt({
    baziResult: result,
    baziText: '当前八字资料',
    ziweiText: '当前紫微资料',
    question: '请重点看家庭沟通。',
    isCustomQuestion: true,
    selection,
  });
  assert.match(prompt, /解读主题：通用/);
  assert.match(prompt, /【问题】\n请重点看家庭沟通。/);
  assert.doesNotMatch(prompt, /围绕事业|工作变动|job-change/);
  const family = applyPromptStatePatch(restored, {
    baziTopicId: 'family',
    baziSubtopicId: 'parents',
  });
  assert.equal(family.ziweiTopicId, 'family');
  assert.equal(family.ziweiSubtopicId, 'parents');
  const combined = buildBaziZiweiCompatibilityPrompt({
    primaryBaziText: '甲八字',
    partnerBaziText: '乙八字',
    primaryZiweiText: '甲紫微',
    partnerZiweiText: '乙紫微',
    baziCompatibilityText: '八字关系',
    ziweiCompatibilityText: '紫微关系',
    question: '如何沟通？',
    selection: getResultPromptSelection(family, 'bazi-ziwei', true),
  });
  assert.match(combined, /主题细项：父母长辈/);
  assert.match(combined, /围绕家庭（父母长辈）展开/);
});

test('合参旧链接只在读取边界转换，成对主题不按字段拼接', () => {
  const legacyBazi = parsePromptState(new URLSearchParams('ps=bazi-ziwei&bid=ai-job-change'));
  assert.equal(legacyBazi.baziTopicId, 'career');
  assert.equal(legacyBazi.ziweiTopicId, 'career');
  assert.equal(legacyBazi.baziSubtopicId, 'job-change');
  const legacyZiwei = parsePromptState(new URLSearchParams('ps=bazi-ziwei&zt=home-move'));
  assert.equal(legacyZiwei.baziTopicId, 'family');
  assert.equal(legacyZiwei.baziSubtopicId, 'home');
  const explicitZiwei = parsePromptState(
    new URLSearchParams('ps=bazi-ziwei&ztid=career&zts=job-change'),
  );
  assert.equal(getResultPromptSelection(explicitZiwei).topicId, 'career');
  const conflicting = parsePromptState(
    new URLSearchParams('ps=bazi-ziwei&btid=family&ztid=career&zts=job-change'),
  );
  assert.equal(conflicting.ziweiTopicId, 'family');
  assert.equal(conflicting.ziweiSubtopicId, '');
  const emptyPrimary = parsePromptState(
    new URLSearchParams('ps=bazi-ziwei&btid=&ztid=career&zts=job-change'),
  );
  assert.equal(getResultPromptSelection(emptyPrimary).topicId, 'general');
  const roundTrip = parsePromptState(
    new URLSearchParams(buildResultSearch(defaultInputState, conflicting)),
  );
  assert.deepEqual(getResultPromptSelection(roundTrip), getResultPromptSelection(conflicting));
});

test('双人八字主题与细项进入最终任务，旧合伙 preset 关系范围仍保留', () => {
  const previous = parsePromptState(new URLSearchParams('a=compatibility&bid=ai-compat-career'));
  const themed = applyPromptStatePatch(previous, {
    baziTopicId: 'family',
    baziSubtopicId: 'children',
  });
  const selection = getResultPromptSelection(themed, 'bazi', true);
  const legacyPrompt = getCompatibilityPrompt('如何共同照顾孩子？', null, null, 'career');
  const prompt = applyResultPromptSelection(legacyPrompt.user, selection);
  assert.match(prompt, /关系范围：合伙/);
  assert.match(prompt, /解读主题：家庭/);
  assert.match(prompt, /主题细项：子女亲缘/);
  assert.match(prompt, /围绕家庭（子女亲缘）展开/);
  assert.match(prompt, /分析范围：本命/);
});

test('所有八字快捷 preset 转成合法主题细项，复合判断保留关系修复重点', () => {
  for (const action of [...baziSingleShortcutActions, ...baziCompatibilityShortcutActions]) {
    const resolved = resolveBaziSelection(action.promptId, action.label);
    const state = applyPromptStatePatch(defaultPromptState, {
      baziPresetId: action.promptId,
      baziShortcutMode: action.label,
      baziTopicId: resolved.topicId,
      baziSubtopicId: resolved.subtopicId,
    });
    const selection = getResultPromptSelection(state, 'bazi', true);
    assert.ok(selection.topicId, action.promptId);
  }
  const reconciliation = resolveBaziSelection('ai-reconciliation-decision', '复合判断');
  assert.deepEqual(reconciliation, { topicId: 'relationship', subtopicId: 'reconciliation' });
  const state = {
    ...defaultPromptState,
    baziTopicId: reconciliation.topicId,
    baziSubtopicId: reconciliation.subtopicId,
  };
  const prompt = applyResultPromptSelection(
    '【任务】\n请分析关系。\n\n【问题】\n是否适合修复？',
    getResultPromptSelection(state, 'bazi'),
  );
  assert.match(prompt, /围绕感情（复合与修复）展开/);
});

test('显式八字自定义与非默认 preset 的 parse-build-parse 保持稳定，切 tab/经典开关不恢复旧主题', () => {
  for (const source of ['bazi', 'bazi-ziwei'] as const) {
    const state = parsePromptState(
      new URLSearchParams({ ps: source, bid: 'ai-job-change', bsm: '自定义' }),
    );
    for (const patch of [{}, { tab: 'bazi' as const }, { includeClassics: true }]) {
      const next = applyPromptStatePatch(state, patch);
      const search = buildResultSearch(defaultInputState, next);
      assert.equal(new URLSearchParams(search).get('bsm'), '自定义');
      const restored = parsePromptState(new URLSearchParams(search));
      assert.deepEqual(restored, next);
      assert.equal(restored.baziShortcutMode, '自定义');
      assert.equal(getResultPromptSelection(restored, source).topicId, 'general');
      assert.equal(getResultPromptSelection(restored, source).subtopicId, undefined);
    }
  }
});

test('旧合参链接显式紫微主题优先于八字快捷，整对转换且写回稳定', () => {
  const state = parsePromptState(
    new URLSearchParams('ps=bazi-ziwei&bsm=事业&ztid=family&zts=parents'),
  );
  assert.equal(state.baziTopicId, 'family');
  assert.equal(state.baziSubtopicId, 'parents');
  assert.equal(state.ziweiTopicId, 'family');
  const selection = getResultPromptSelection(state);
  assert.equal(selection.subtopicId, 'parents');
  const restored = parsePromptState(
    new URLSearchParams(buildResultSearch(defaultInputState, state)),
  );
  assert.deepEqual(getResultPromptSelection(restored), selection);
});

test('单紫微流时不会进入合参校验，实际紫微 selection 与任务保留流时', () => {
  const state = parsePromptState(new URLSearchParams('ps=ziwei&bfs=natal&zs=hourly'));
  assert.equal(getCombinedResultPromptSelection(state), undefined);
  const selection = getResultPromptSelection(state, 'ziwei');
  assert.equal(selection.scope, 'hourly');
  const prompt = applyResultPromptSelection('【任务】\n请依据紫微盘面回答。', selection);
  assert.match(prompt, /分析范围：流时/);
});
