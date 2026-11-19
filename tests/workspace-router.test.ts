import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWorkspaceUrl,
  parseWorkspaceLocation,
  resolveResultFallbackTarget,
  resolveWorkspaceDocumentTitle,
  type WorkspaceRouterDefaults,
} from '../src/app/workspace-router';

const defaults: WorkspaceRouterDefaults = {
  defaultChartFeature: 'bazi',
  defaultDivinationFeature: 'liuyao',
};

describe('workspace-router', () => {
  it('解析首页与各主功能路径并保持规范化往返一致', () => {
    const cases = [
      { input: '/', expectedRoute: 'home', expectedCanonical: '/' },
      { input: '/fortune', expectedRoute: 'fortune', expectedCanonical: '/fortune' },
      { input: '/fortune/daily', expectedRoute: 'fortune', expectedCanonical: '/fortune' },
      { input: '/fortune/monthly', expectedRoute: 'fortune', expectedCanonical: '/fortune/monthly' },
      { input: '/fortune/yearly', expectedRoute: 'fortune', expectedCanonical: '/fortune/yearly' },
      { input: '/chart', expectedRoute: 'chart-input', expectedCanonical: '/chart' },
      { input: '/chart/compat', expectedRoute: 'chart-input', expectedCanonical: '/chart/compat' },
      { input: '/chart/compatibility', expectedRoute: 'chart-input', expectedCanonical: '/chart/compat' },
      { input: '/chart/range', expectedRoute: 'chart-input', expectedCanonical: '/chart/range' },
      { input: '/chart/time-reverse', expectedRoute: 'time-reverse', expectedCanonical: '/chart/time-reverse' },
      { input: '/divination/qimen', expectedRoute: 'divination-input', expectedCanonical: '/divination/qimen' },
      { input: '/divination/taiyi', expectedRoute: 'divination-input', expectedCanonical: '/divination/taiyi' },
      { input: '/divination/kongming', expectedRoute: 'divination-input', expectedCanonical: '/divination/zhuge' },
      { input: '/divination/number-energy', expectedRoute: 'utilities', expectedCanonical: '/utilities/number-energy' },
      { input: '/utilities', expectedRoute: 'utilities', expectedCanonical: '/utilities/almanac' },
      { input: '/utilities/calendar', expectedRoute: 'utilities', expectedCanonical: '/utilities/calendar' },
      { input: '/utilities/residential', expectedRoute: 'utilities', expectedCanonical: '/utilities/residential' },
      { input: '/utilities/name-char', expectedRoute: 'utilities', expectedCanonical: '/utilities/chinese-name' },
      { input: '/utilities/zhouyi', expectedRoute: 'utilities', expectedCanonical: '/utilities/zhouyi' },
      { input: '/history', expectedRoute: 'history', expectedCanonical: '/history' },
      { input: '/connect', expectedRoute: 'connect', expectedCanonical: '/connect' },
      { input: '/chat?session=abc123&from=history', expectedRoute: 'chat', expectedCanonical: '/chat?session=abc123&from=history' },
      { input: '/unknown/foo/bar', expectedRoute: 'home', expectedCanonical: '/' },
    ] as const;

    for (const tc of cases) {
      const url = new URL(`https://example.com${tc.input}`);
      const parsed = parseWorkspaceLocation(url.pathname, url.search, defaults);
      assert.equal(parsed.route, tc.expectedRoute, `route mismatch for ${tc.input}`);
      assert.equal(parsed.canonicalPath, tc.expectedCanonical, `canonicalPath mismatch for ${tc.input}`);
    }
  });

  it('区分专项数术的首页归属与常规占卜归属', () => {
    const taiyi = parseWorkspaceLocation('/divination/taiyi', '', defaults);
    assert.equal(taiyi.domainHint, 'home');
    assert.equal(taiyi.method, 'taiyi');

    const qimen = parseWorkspaceLocation('/divination/qimen', '', defaults);
    assert.equal(qimen.domainHint, 'divination');
    assert.equal(qimen.method, 'qimen');
  });

  it('解析并构建结果页路径与参数（个人命盘 / 合盘 / 占卜 / 即时起盘 / 实用工具）', () => {
    const personal = parseWorkspaceLocation('/result/bazi', '?case=case_1', defaults);
    assert.equal(personal.route, 'result');
    assert.equal(personal.resultRef?.mode, 'personal');
    assert.equal(personal.resultRef?.caseId, 'case_1');
    assert.equal(personal.canonicalPath, '/result/bazi?case=case_1');

    const instant = parseWorkspaceLocation('/result/bazi', '?mode=divination&feature=instant&record=rec_9', defaults);
    assert.equal(instant.resultRef?.mode, 'divination');
    assert.equal(instant.featureId, 'instant');
    assert.equal(instant.resultRef?.recordId, 'rec_9');
    assert.equal(instant.canonicalPath, '/result/bazi?mode=divination&feature=instant&record=rec_9');

    const compat = parseWorkspaceLocation('/result/ziwei-synastry', '?record=cmp_1', defaults);
    assert.equal(compat.resultRef?.mode, 'compatibility');
    assert.equal(compat.domainHint, 'personal-chart');
    assert.equal(compat.canonicalPath, '/result/ziwei-synastry?record=cmp_1');

    const utilBazhai = parseWorkspaceLocation('/result/bazhai', '?domain=utilities&record=rec_2', defaults);
    assert.equal(utilBazhai.resultRef?.mode, 'divination');
    assert.equal(utilBazhai.domainHint, 'utilities');
    assert.equal(utilBazhai.canonicalPath, '/result/bazhai?domain=utilities&record=rec_2');

    const invalidMethod = parseWorkspaceLocation('/result/not-a-method', '', defaults);
    assert.equal(invalidMethod.route, 'home');
    assert.equal(invalidMethod.canonicalPath, '/');
  });

  it('构建临时档案结果页 URL 时不包含 temporary 占位 ID', () => {
    const built = buildWorkspaceUrl({
      route: 'result',
      method: 'bazi',
      domainHint: 'personal-chart',
      featureId: 'bazi',
      resultRef: { mode: 'personal', caseId: 'temporary' },
    });
    assert.equal(built, '/result/bazi');
  });

  it('当结果页无法从本地记录恢复时回退到对应输入页', () => {
    assert.equal(
      resolveResultFallbackTarget({ method: 'qimen', mode: 'divination' }).route,
      'divination-input',
    );
    assert.equal(
      resolveResultFallbackTarget({ method: 'bazi', mode: 'personal' }).route,
      'chart-input',
    );
    assert.equal(
      resolveResultFallbackTarget({ method: 'bazi-synastry', mode: 'compatibility' }).featureId,
      'compatibility',
    );
    assert.equal(
      resolveResultFallbackTarget({ method: 'astrolabe-range', mode: 'divination', featureId: 'range' }).featureId,
      'range',
    );
    assert.equal(
      resolveResultFallbackTarget({ method: 'zhouyi', mode: 'divination' }).utilityMainTab,
      'name-char',
    );
  });

  it('根据当前路由生成清晰可读的页面标题', () => {
    assert.equal(
      resolveWorkspaceDocumentTitle({
        route: 'home',
        activeDomain: 'home',
        activeFeatureId: 'home',
        activeMethod: 'bazi',
        currentUtilityMainTab: 'almanac',
        currentNameCharSubTab: 'chinese-name',
      }),
      '命语',
    );
    assert.equal(
      resolveWorkspaceDocumentTitle({
        route: 'fortune',
        activeDomain: 'fortune',
        activeFeatureId: 'fortune',
        activeMethod: 'fortune',
        fortuneScope: 'monthly',
        currentUtilityMainTab: 'almanac',
        currentNameCharSubTab: 'chinese-name',
      }),
      '月运 · 命语',
    );
    assert.equal(
      resolveWorkspaceDocumentTitle({
        route: 'divination-input',
        activeDomain: 'divination',
        activeFeatureId: 'qimen',
        activeMethod: 'qimen',
        currentUtilityMainTab: 'almanac',
        currentNameCharSubTab: 'chinese-name',
      }),
      '奇门遁甲 · 命语',
    );
    assert.equal(
      resolveWorkspaceDocumentTitle({
        route: 'utilities',
        activeDomain: 'utilities',
        activeFeatureId: 'zhouyi',
        activeMethod: 'zhouyi',
        currentUtilityMainTab: 'name-char',
        currentNameCharSubTab: 'zhouyi',
      }),
      '周易经文 · 命语',
    );
  });
});
