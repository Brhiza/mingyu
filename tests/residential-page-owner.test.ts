import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { appendClassicalReferences } from 'mingyu-core/prompt';
import { AiChatPanel } from '../src/components/AiChatPanel';
import { buildReadingSubject } from '../src/lib/ai/reading-subject';
import React, { createElement, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MetaphysicsPanel } from '../src/components/MetaphysicsPanel';
import {
  buildResidentialReadingResource,
  useResidentialChart,
} from '../src/pages/ResultPage/hooks/useResidentialChart';
import {
  buildResultSearch,
  defaultInputState,
  parsePromptState,
  type QueryPromptState,
} from '../src/lib/query-state';
import type { ResidentialBirthData } from '../src/lib/residential-fengshui-chart';

const birth: ResidentialBirthData = { year: 1990, month: 6, day: 15, gender: 'male' };
const annualUrl = 't=bazhai&ps=bazhai&bhd=0&rhy=2024&rfy=2020';
type Owner = ReturnType<typeof useResidentialChart>;

function serverOwner(search: string, birthData: ResidentialBirthData | null = birth) {
  let owner!: Owner;
  function PageOwner() {
    owner = useResidentialChart(
      birthData,
      parsePromptState(new URLSearchParams(search)),
      () => assert.fail('SSR must not write the URL'),
      search,
    );
    return createElement(MetaphysicsPanel, { birthData, ...owner });
  }
  const html = renderToStaticMarkup(createElement(PageOwner));
  return { owner, html, resource: buildResidentialReadingResource(owner.chart, '住宅如何安排？') };
}

// Run the actual page hook/effect with a bounded timer host, without a DOM scheduler.
// The controlled panel's real handlers below exercise the same owner as the SSR consumers.
function pageOwnerHost(search = annualUrl) {
  type Slot = { value?: unknown; deps?: unknown[]; cleanup?: () => void };
  const slots: Slot[] = [];
  let index = 0;
  let effects: Array<() => void> = [];
  let prompt = parsePromptState(new URLSearchParams(search));
  let birthData: ResidentialBirthData | null = birth;
  let navigationKey = search;
  const commits: Array<QueryPromptState> = [];
  const internals = (
    React as unknown as {
      __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H: unknown };
    }
  ).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const changed = (a?: unknown[], b?: unknown[]) =>
    !a || !b || a.length !== b.length || a.some((value, i) => !Object.is(value, b[i]));
  const dispatcher = {
    useMemo: (create: () => unknown, deps: unknown[]) => {
      const i = index++;
      if (!slots[i] || changed(slots[i].deps, deps)) slots[i] = { value: create(), deps };
      return slots[i].value;
    },
    useState: (initial: unknown) => {
      const i = index++;
      if (!slots[i]) slots[i] = { value: typeof initial === 'function' ? initial() : initial };
      return [
        slots[i].value,
        (value: unknown) => {
          slots[i].value = typeof value === 'function' ? value(slots[i].value) : value;
        },
      ];
    },
    useEffect: (create: () => void | (() => void), deps: unknown[]) => {
      const i = index++;
      if (!slots[i] || changed(slots[i].deps, deps)) {
        const old = slots[i];
        const slot: Slot = { deps };
        slots[i] = slot;
        effects.push(() => {
          old?.cleanup?.();
          slot.cleanup = create() || undefined;
        });
      }
    },
  };
  const onCommit: Parameters<typeof useResidentialChart>[2] = (patch) => {
    prompt = parsePromptState(
      new URLSearchParams(buildResultSearch(defaultInputState, { ...prompt, ...patch })),
    );
    navigationKey = `commit-${commits.length}`;
    commits.push(prompt);
  };
  return {
    commits,
    render() {
      index = 0;
      effects = [];
      const previous = internals.H;
      internals.H = dispatcher;
      let owner: Owner;
      try {
        owner = useResidentialChart(birthData, prompt, onCommit, navigationKey);
      } finally {
        internals.H = previous;
      }
      for (const effect of effects) effect();
      return owner;
    },
    navigate(nextSearch: string, nextBirth = birth, nextKey = nextSearch) {
      prompt = parsePromptState(new URLSearchParams(nextSearch));
      birthData = nextBirth;
      navigationKey = nextKey;
    },
    cleanup() {
      for (const slot of slots) slot.cleanup?.();
    },
  };
}

type ControlProps = {
  id?: string;
  children?: ReactNode;
  onChange?: (event: { target: { value: string } }) => void;
};
function findControl(node: ReactNode, id: string): ControlProps | undefined {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findControl(item, id);
      if (found) return found;
    }
  } else if (isValidElement<ControlProps>(node)) {
    if (node.props.id === id) return node.props;
    return findControl(node.props.children, id);
  }
}
function editControl(owner: Owner, id: string, value: string) {
  const control = findControl(MetaphysicsPanel({ birthData: birth, ...owner }), id);
  assert.ok(control?.onChange, `real panel control ${id} must be connected`);
  control.onChange({ target: { value } });
}
function assertSharedConsumers(owner: Owner) {
  const panel = createElement(MetaphysicsPanel, { birthData: birth, ...owner });
  const resource = buildResidentialReadingResource(owner.chart, '住宅如何安排？');
  assert.ok(resource);
  assert.equal(panel.props.chart.result, resource.structured);
  assert.equal(panel.props.chart.input, owner.chart.input);
  const html = renderToStaticMarkup(panel);
  const target =
    owner.chart.result?.xuankong?.flowStars?.monthPlate ??
    owner.chart.result?.xuankong?.flowStars?.yearPlate;
  if (target) {
    assert.match(html, new RegExp(`目标${target.year}年`));
    assert.match(resource.text, new RegExp(`流年飞星[\\s\\S]*${target.year}`));
  }
  return { html, resource };
}

test('页面住宅workflow向实际AI面板交付同一资源，年度和静态可用，非法输入禁用', () => {
  const page = ts.createSourceFile(
    'ResultPage.tsx',
    readFileSync(new URL('../src/pages/ResultPage/index.tsx', import.meta.url), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const expressions = new Map<string, string>();
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const name = node.name.text;
      if (['workflowPrompt', 'readingResourceSeed', 'readingResourceRequired'].includes(name)) {
        expressions.set(
          name,
          ts.isCallExpression(node.initializer)
            ? `(${node.initializer.arguments[0].getText(page)})()`
            : node.initializer.getText(page),
        );
      }
    }
    if (ts.isJsxAttribute(node) && node.name.getText(page) === 'readingResourceSeed') {
      const value = node.initializer;
      if (value && ts.isJsxExpression(value) && value.expression) {
        expressions.set('passedSeed', value.expression.getText(page));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(page);
  const evaluate = (name: string, bindings: Record<string, unknown>) => {
    const expression = expressions.get(name);
    assert.ok(expression, `actual page ${name} must be present`);
    const javascript = ts.transpileModule(`const value = (${expression});`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;
    return Function(
      ...Object.keys(bindings),
      `${javascript}; return value;`,
    )(...Object.values(bindings));
  };
  const input = { ...defaultInputState, year: '1990', month: '6', day: '15' };
  for (const url of [
    annualUrl,
    annualUrl.replace('rfy=2020', 'rfy='),
    annualUrl.replace('bhd=0', 'bhd=361'),
  ]) {
    const { owner, resource } = serverOwner(url);
    const promptState = parsePromptState(new URLSearchParams(url));
    const subject = buildReadingSubject(input, promptState);
    const bindings = {
      useMemo: (create: () => unknown) => create(),
      isBazhaiPromptSource: true,
      residentialReadingResource: resource,
      promptState,
      appendClassicalReferences,
      isInstantResult: false,
      isAstrolabePromptSource: false,
      isQizhengPromptSource: false,
      isQimenLifetimePromptSource: false,
      rangePromptReadingSubject: subject,
    };
    const workflowPrompt = evaluate('workflowPrompt', bindings) as string;
    const seed = evaluate('readingResourceSeed', bindings);
    const passedSeed = evaluate('passedSeed', { workflowPrompt, readingResourceSeed: seed });
    const required = evaluate('readingResourceRequired', bindings);
    assert.equal(required, true);
    const ready = Boolean(owner.chart.result);
    assert.equal(Boolean(workflowPrompt.trim()), ready);
    assert.equal(Boolean(passedSeed), ready);
    if (ready) assert.equal(passedSeed.resources[0].structured, owner.chart.result);
    const html = renderToStaticMarkup(
      createElement(AiChatPanel, {
        contextPrompt: resource?.text ?? '',
        workflowPrompt: workflowPrompt || undefined,
        readingSubject: subject,
        readingResourceSeed: passedSeed,
        readingResourceRequired: required,
        workspaceMode: true,
      }),
    );
    const textarea = html.match(/<textarea[^>]*class="ai-chat-input"[^>]*>/)?.[0];
    assert.ok(textarea);
    assert.equal(textarea.includes('disabled'), !ready, 'actual panel readiness matches the owner');
    const ordinary = { ...bindings, isBazhaiPromptSource: false };
    assert.equal(
      evaluate('workflowPrompt', ordinary),
      '',
      'ordinary sources keep their workflow routing',
    );
    assert.equal(
      evaluate('passedSeed', { workflowPrompt: '', readingResourceSeed: seed }),
      undefined,
    );
  }
});

test('年度合法URL在SSR首屏保留2020流星，盘面与任务书/阅读资源引用同一owner结果', () => {
  const { owner, html, resource } = serverOwner(annualUrl);
  assert.equal(owner.draft.flowYear, '2020');
  assert.equal(owner.draft.flowMonth, '');
  assert.equal(owner.draft.flowDay, '');
  assert.equal(owner.chart.input?.flowYear, 2020);
  assert.equal(owner.chart.input?.flowMonth, undefined);
  assert.equal(owner.chart.result?.xuankong?.flowStars?.yearPlate?.year, 2020);
  assert.equal(owner.chart.result?.xuankong?.flowStars?.monthPlate, undefined);
  assert.match(html, /目标2020年/);
  assert.match(html, /id="metaphysics-flow-year"[^>]*value="2020"/);
  assert.equal(resource?.structured, owner.chart.result);
  assertSharedConsumers(owner);
});

test('静态、仅年、年月、完整日期各自保留粒度并同时供给盘面与提示词', () => {
  for (const [suffix, year, month, day] of [
    ['&rfy=', undefined, undefined, undefined],
    ['&rfy=2020', 2020, undefined, undefined],
    ['&rfy=2020&rfm=2', 2020, 2, undefined],
    ['&rfy=2020&rfm=2&rfd=10', 2020, 2, 10],
  ] as const) {
    const { owner, html } = serverOwner(`ps=bazhai&bhd=0&rhy=2024${suffix}`);
    assert.equal(owner.chart.error, '');
    assert.equal(owner.chart.input?.flowYear, year);
    assert.equal(owner.chart.input?.flowMonth, month);
    assert.equal(owner.chart.input?.flowDay, day);
    assert.equal(owner.chart.result?.xuankong?.flowStars?.yearPlate?.year, year);
    assert.equal(owner.chart.result?.xuankong?.flowStars?.monthPlate?.month, month);
    assert.equal(
      owner.chart.result?.xuankong?.flowStars?.monthPlate?.day,
      month ? (day ?? 15) : undefined,
      'core keeps its documented month-only midpoint; owner input keeps the requested granularity',
    );
    if (month && !day) {
      assert.match(html, /目标2020年2月<\/p>/);
      assert.doesNotMatch(html, /目标2020年2月15日/);
    }
    assertSharedConsumers(owner);
  }
});

test('实际住宅控件保留编辑draft并250ms提交，URL恢复取代未提交草稿', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const host = pageOwnerHost();
  try {
    let owner = host.render();
    const first = owner.chart.result;
    editControl(owner, 'metaphysics-flow-month', '2');
    owner = host.render();
    assert.equal(owner.draft.flowMonth, '2');
    assert.equal(owner.chart.input?.flowMonth, undefined);
    assert.equal(owner.chart.result, first, 'pending chart and prompt keep the committed identity');
    assertSharedConsumers(owner);
    context.mock.timers.tick(249);
    assert.equal(host.commits.length, 0);
    context.mock.timers.tick(1);
    owner = host.render();
    assert.equal(host.commits.length, 1);
    assert.equal(owner.chart.result?.xuankong?.flowStars?.monthPlate?.month, 2);
    assertSharedConsumers(owner);
    editControl(owner, 'metaphysics-flow-day', '10');
    owner = host.render();
    context.mock.timers.tick(250);
    owner = host.render();
    assert.equal(owner.chart.result?.xuankong?.flowStars?.monthPlate?.day, 10);
    assertSharedConsumers(owner);

    editControl(owner, 'metaphysics-house-year', '2008');
    host.render();
    host.navigate('ps=bazhai&bhd=5&rhy=2024&rgt=替卦&rfy=2030');
    owner = host.render();
    context.mock.timers.tick(250);
    assert.equal(host.commits.length, 2, 'restoring a URL cancels the previous draft timer');
    assert.equal(owner.draft.houseYear, '2024');
    assert.equal(owner.chart.input?.flowYear, 2030);
    assert.equal(owner.chart.result?.xuankong?.guaType, '替卦');
    assert.ok(owner.chart.result?.xuankong?.replacement);
    assertSharedConsumers(owner);

    editControl(owner, 'metaphysics-flow-year', '');
    owner = host.render();
    assert.equal(owner.draft.flowMonth, '');
    assert.equal(owner.draft.flowDay, '');
    context.mock.timers.tick(250);
    owner = host.render();
    assert.equal(owner.chart.input?.flowYear, undefined);
    assert.equal(owner.chart.result?.xuankong?.flowStars, undefined);
    assertSharedConsumers(owner);
  } finally {
    host.cleanup();
  }
});

test('换出生或非住宅URL参数时同住宅值也取消旧草稿，重复URL新location也不复活', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const host = pageOwnerHost();
  try {
    let owner = host.render();
    editControl(owner, 'metaphysics-house-year', '2020');
    host.render();
    host.navigate(`${annualUrl}&y=2024&m=2&d=4`, { year: 2024, month: 2, day: 4, gender: 'male' });
    owner = host.render();
    context.mock.timers.tick(250);
    assert.equal(host.commits.length, 0);
    assert.equal(owner.draft.houseYear, '2024');
    assert.equal(owner.chart.result?.bazhai?.birthYearBoundaryStatus, '待复核');
    host.navigate(annualUrl);
    owner = host.render();
    context.mock.timers.tick(250);
    assert.equal(owner.draft.houseYear, '2024', 'back to A must not revive the abandoned edit');
    assert.equal(host.commits.length, 0);
    editControl(owner, 'metaphysics-house-year', '2008');
    host.render();
    host.navigate(annualUrl, birth, 'replace-current-A');
    owner = host.render();
    context.mock.timers.tick(250);
    assert.equal(owner.draft.houseYear, '2024');
    assert.equal(host.commits.length, 0);
    editControl(owner, 'metaphysics-house-year', '2000');
    host.render();
    host.navigate(annualUrl, birth, 'same-url-new-location-key');
    owner = host.render();
    context.mock.timers.tick(250);
    assert.equal(owner.draft.houseYear, '2024');
    assert.equal(host.commits.length, 0);
  } finally {
    host.cleanup();
  }
});

test('非法角度、分界线、无效日期使盘面与提示词同时失效，纠正草稿后恢复', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const host = pageOwnerHost(`${annualUrl}&rfm=2&rfd=10`);
  try {
    let owner = host.render();
    for (const [id, invalid, pattern, valid] of [
      ['metaphysics-facing-degree', '361', /0-360/, '0'],
      ['metaphysics-facing-degree', '7.5', /分界线.*重新测量/, '0'],
      ['metaphysics-house-year', '0', /建造或起运年/, '2024'],
      ['metaphysics-flow-day', '31', /目标日期无效/, '10'],
    ] as const) {
      editControl(owner, id, invalid);
      owner = host.render();
      assert.match(owner.chart.error, pattern);
      assert.equal(owner.chart.result, null);
      assert.equal(owner.chart.measurement, null);
      assert.equal(buildResidentialReadingResource(owner.chart, ''), undefined);
      assert.match(renderToStaticMarkup(createElement(MetaphysicsPanel, { ...owner })), pattern);
      const commitsBefore = host.commits.length;
      context.mock.timers.tick(250);
      assert.equal(
        host.commits.length,
        commitsBefore,
        'invalid draft is not normalized into a URL',
      );
      editControl(owner, id, valid);
      owner = host.render();
      context.mock.timers.tick(250);
      owner = host.render();
      assert.equal(owner.chart.error, '');
      assertSharedConsumers(owner);
    }
  } finally {
    host.cleanup();
  }
});

test('未知出生、原始北向、立春出生与交运首年提示由同一结果保留', () => {
  const houseOnly = serverOwner(annualUrl, null);
  assert.equal(houseOnly.owner.chart.result?.bazhai, null);
  assert.match(houseOnly.html, /仅宅运/);
  assert.match(houseOnly.html, /坐向按原始读数暂列，待核定北向基准/);
  assert.match(houseOnly.html, /需按建造或起运日期核定/);
  const tentative = serverOwner(annualUrl, {
    year: 2024,
    month: 2,
    day: 4,
    hour: 16,
    gender: 'male',
  });
  assert.match(tentative.html, /待核对出生分钟/);
  assert.match(tentative.resource?.text ?? '', /暂按命卦|候选命卦/);
  const resolved = serverOwner(annualUrl, {
    year: 2024,
    month: 2,
    day: 4,
    hour: 16,
    minute: 30,
    second: 0,
    gender: 'male',
  });
  assert.equal(resolved.owner.chart.result?.bazhai?.birthYearBoundaryStatus, '已核定');
  assert.doesNotMatch(resolved.html, /待核对出生分钟/);
  for (const invalid of ['361', '7.5']) {
    const { owner } = serverOwner(annualUrl.replace('bhd=0', `bhd=${invalid}`));
    assert.ok(owner.chart.error);
    assert.equal(owner.chart.result, null, 'invalid URL is invalid on the initial render too');
  }
});
