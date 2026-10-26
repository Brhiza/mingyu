import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import React, { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DropdownSelect } from '../src/components/DropdownSelect';
import { MeihuaFields, MeihuaMethodField } from '../src/components/DivinationPanel/MeihuaFields';
import { defaultDraft } from '../src/components/DivinationPanel/constants';
import { generateDivinationSession, type DivinationDraft } from '../src/lib/divination/engine';
import type { MeihuaData } from 'mingyu-core/types';

// BaziReverseInput imports CSS; keep real form rendering while ignoring styles in Node.
const styles = registerHooks({
  load(url, context, nextLoad) {
    return url.endsWith('.css')
      ? { format: 'module', source: '', shortCircuit: true }
      : nextLoad(url, context);
  },
});
const { DivinationForm } = await import('../src/components/DivinationPanel/DivinationForm');
styles.deregister();

type Layout = React.ComponentProps<typeof MeihuaFields>['layout'];
const layouts: Layout[] = ['desktop', 'mobile'];
const helperValues = {
  meihuaCharacterTones: '1,2,3,4',
  meihuaCharacterStrokeCounts: '7,8',
  meihuaCharacterLeftStrokes: '4',
  meihuaCharacterRightStrokes: '8',
};
const emptyHelpers = Object.fromEntries(Object.keys(helperValues).map((key) => [key, '']));

function findElement<P>(tree: ReactNode, matches: (element: ReactElement) => boolean) {
  let found: ReactElement<P> | undefined;
  function visit(node: ReactNode) {
    Children.forEach(node, (child) => {
      if (found || !isValidElement<{ children?: ReactNode }>(child)) return;
      if (matches(child)) found = child as ReactElement<P>;
      else visit(child.props.children);
    });
  }
  visit(tree);
  assert.ok(found, 'Expected a rendered field');
  return found;
}

function fieldId(name: string, layout: Layout) {
  return `meihua-${name}${layout === 'mobile' ? '-mobile' : ''}`;
}

function createForm(overrides: Partial<DivinationDraft> = {}) {
  let draft: DivinationDraft = {
    ...defaultDraft,
    method: 'meihua',
    question: '这件事接下来该怎么推进？',
    divinationTimeMode: 'custom',
    customDivinationDate: '2026-10-26',
    customDivinationTime: '09:00:00',
    ...overrides,
  };
  const updates: Array<[keyof DivinationDraft, DivinationDraft[keyof DivinationDraft]]> = [];
  // Match DivinationPanel.updateDraft's field updates; it adds no method-dependent resets.
  function updateDraft<K extends keyof DivinationDraft>(key: K, value: DivinationDraft[K]) {
    updates.push([key, value]);
    draft = { ...draft, [key]: value };
  }
  function fields(layout: Layout) {
    return MeihuaFields({ draft, updateDraft, layout });
  }
  function input(layout: Layout, name: string) {
    return findElement<React.InputHTMLAttributes<HTMLInputElement>>(
      fields(layout),
      (element) =>
        element.type === 'input' && (element.props as { id?: string }).id === fieldId(name, layout),
    ).props;
  }
  function select(tree: ReactNode, id?: string) {
    return findElement<React.ComponentProps<typeof DropdownSelect>>(
      tree,
      (element) =>
        element.type === DropdownSelect &&
        (id === undefined || (element.props as { id?: string }).id === id),
    ).props;
  }

  return {
    get draft() {
      return draft;
    },
    updates,
    fields,
    input,
    changeInput(layout: Layout, name: string, value: string) {
      const onChange = input(layout, name).onChange;
      assert.ok(onChange);
      onChange({ target: { value } } as React.ChangeEvent<HTMLInputElement>);
    },
    changeMethod(layout: Layout, value: DivinationDraft['meihuaMethod']) {
      select(MeihuaMethodField({ draft, updateDraft, layout })).onChange(value);
    },
    changeSelection(layout: Layout, name: string, value: string) {
      select(fields(layout), fieldId(name, layout)).onChange(value);
    },
    html() {
      return renderToStaticMarkup(
        <DivinationForm
          draft={draft}
          updateDraft={updateDraft}
          isSubmitting={false}
          error=""
          onSubmit={() => {}}
          onOpenInspiration={() => {}}
          onOpenBirthPlace={() => {}}
          questionInputRef={React.createRef<HTMLTextAreaElement>()}
        />,
      );
    },
  };
}

function inputTag(html: string, id: string) {
  const tag = html.match(new RegExp(`<input(?=[^>]*\\bid="${id}")[^>]*>`))?.[0];
  assert.ok(tag, `Expected input #${id}`);
  return tag;
}

function assertControlledValue(form: ReturnType<typeof createForm>, name: string, value: string) {
  const html = form.html();
  for (const layout of layouts) {
    assert.equal(form.input(layout, name).value, value);
    assert.ok(inputTag(html, fieldId(name, layout)).includes(`value="${value}"`));
  }
}

for (const layout of layouts) {
  test(`${layout}: Meihua inputs clean changes and control the values in both form trees`, () => {
    const form = createForm({ meihuaMethod: 'number' });
    form.changeInput(layout, 'number-input', ' 12a３.4-5 ');
    assert.deepEqual(form.updates, [['meihuaNumber', '1245']]);
    assertControlledValue(form, 'number-input', '1245');

    form.changeMethod(layout, 'sound');
    form.changeInput(layout, 'sound-count-input', '3声.４2');
    assert.equal(form.draft.meihuaSoundCount, '32');
    assertControlledValue(form, 'sound-count-input', '32');
    form.changeInput(layout, 'sound-count-input', '清空');
    assertControlledValue(form, 'sound-count-input', '');

    form.changeMethod(layout, 'character');
    form.changeInput(layout, 'character-text-input', '明');
    form.changeInput(layout, 'character-left-strokes-input', '4左0５');
    form.changeInput(layout, 'character-right-strokes-input', '日4-8');
    assertControlledValue(form, 'character-left-strokes-input', '40');
    assertControlledValue(form, 'character-right-strokes-input', '48');

    form.changeInput(layout, 'character-text-input', '西林');
    form.changeInput(layout, 'character-strokes-input', '7笔,8，9、10 11x');
    assert.equal(form.draft.meihuaCharacterStrokeCounts, '7,8，9、10 11');
    assertControlledValue(form, 'character-strokes-input', '7,8，9、10 11');

    form.changeInput(layout, 'character-text-input', '今日动静');
    form.changeInput(layout, 'character-tones-input', '平 1,4，3、3x');
    assert.equal(form.draft.meihuaCharacterTones, '平 1,4，3、3x');
    assertControlledValue(form, 'character-tones-input', '平 1,4，3、3x');
  });

  test(`${layout}: character count changes clear every helper, including within a length branch`, () => {
    for (const [previousText, nextText] of [
      ['明', '西林'],
      ['西林', '西林山'],
      ['西林山', '今日动静'],
      ['今日动静', '春风得意马蹄疾一日看'],
      ['春风得意马蹄疾一日看', '春风得意马蹄疾一日看花'],
      ['春风得意马蹄疾一日看花', '  '],
    ]) {
      const form = createForm({
        meihuaMethod: 'character',
        meihuaCharacterText: previousText,
        ...helperValues,
      });
      form.changeInput(layout, 'character-text-input', nextText);
      assert.deepEqual(form.updates, [
        ['meihuaCharacterText', nextText],
        ...Object.entries(emptyHelpers),
      ]);
      assert.deepEqual(
        Object.fromEntries(
          Object.keys(helperValues).map((key) => [key, form.draft[key as keyof DivinationDraft]]),
        ),
        emptyHelpers,
      );
      assertControlledValue(form, 'character-text-input', nextText);
    }
  });

  test(`${layout}: same Unicode length and surrounding whitespace preserve helper drafts`, () => {
    const form = createForm({
      meihuaMethod: 'character',
      meihuaCharacterText: '明',
      ...helperValues,
    });
    form.changeInput(layout, 'character-text-input', ' 𠮷 ');
    assert.deepEqual(form.updates, [['meihuaCharacterText', ' 𠮷 ']]);
    assertControlledValue(form, 'character-text-input', ' 𠮷 ');
    assertControlledValue(form, 'character-left-strokes-input', '4');
    assertControlledValue(form, 'character-right-strokes-input', '8');
    for (const [key, value] of Object.entries(helperValues)) {
      assert.equal(form.draft[key as keyof DivinationDraft], value);
    }
  });

  test(`${layout}: method switches retain prior values and direction selections update both trees`, () => {
    const form = createForm({
      meihuaMethod: 'character',
      meihuaCharacterText: '西林',
      meihuaNumber: '123',
      meihuaSoundCount: '3',
      ...helperValues,
    });
    const initial = form.draft;
    for (const method of ['number', 'sound', 'time', 'random', 'direction', 'character'] as const) {
      form.updates.length = 0;
      form.changeMethod(layout, method);
      assert.deepEqual(form.updates, [['meihuaMethod', method]]);
      assert.deepEqual(form.draft, { ...initial, meihuaMethod: method });
    }
    assertControlledValue(form, 'character-strokes-input', '7,8');

    form.changeMethod(layout, 'direction');
    form.changeSelection(layout, 'direction-select', 'south');
    form.changeSelection(layout, 'object-type-select', 'fire');
    assert.equal(form.draft.meihuaDirection, 'south');
    assert.equal(form.draft.meihuaObjectType, 'fire');
    const html = form.html();
    for (const variant of layouts) {
      assert.match(
        html,
        new RegExp(`id="${fieldId('direction-select', variant)}"[^>]*>.*?正南（离）`),
      );
      assert.match(
        html,
        new RegExp(`id="${fieldId('object-type-select', variant)}"[^>]*>.*?火（离）`),
      );
    }
  });
}

test('full form renders unique labels, IDs and the existing desktop/mobile field wrappers at each character boundary', () => {
  for (const [text, helperNames] of [
    ['', []],
    [' 𠮷 ', ['left-strokes', 'right-strokes']],
    ['西林', ['strokes']],
    ['西林山', ['strokes']],
    ['今日动静', ['tones']],
    ['春风得意马蹄疾一日看', ['tones']],
    ['春风得意马蹄疾一日看花', []],
  ] as const) {
    const form = createForm({ meihuaMethod: 'character', meihuaCharacterText: text });
    const html = form.html();
    const ids = Array.from(html.matchAll(/\bid="([^"]+)"/g), (match) => match[1]);
    assert.equal(new Set(ids).size, ids.length);
    for (const layout of layouts) {
      const id = fieldId('character-text-input', layout);
      const fieldClass = layout === 'desktop' ? 'form-item divination-inline-field' : 'form-item';
      assert.ok(html.includes(`<div class="${fieldClass}"><label for="${id}">起卦文字</label>`));
      for (const name of ['left-strokes', 'right-strokes', 'strokes', 'tones']) {
        const helperId = fieldId(`character-${name}-input`, layout);
        assert.equal(ids.includes(helperId), (helperNames as readonly string[]).includes(name));
        if (ids.includes(helperId)) assert.ok(html.includes(`<label for="${helperId}">`));
      }
    }
    assert.ok(
      html.includes(
        '<div class="form-row divination-mobile-only"><div class="form-item"><label for="meihua-character-text-input-mobile">',
      ),
    );
    assert.match(html, /id="meihua-method-select"[^>]*role="combobox"/);
    assert.match(html, /role="combobox" aria-label="起卦方式"/);
    if ((helperNames as readonly string[]).includes('left-strokes')) {
      assert.ok(
        inputTag(html, 'meihua-character-left-strokes-input').includes('placeholder="单字分笔"'),
      );
      assert.ok(
        !inputTag(html, 'meihua-character-left-strokes-input-mobile').includes('placeholder='),
      );
      assert.ok(
        html.includes(
          '<div class="form-row-flex"><div class="form-item"><label for="meihua-character-left-strokes-input-mobile">',
        ),
      );
    }
  }
});

test('shared field interactions feed equivalent applicable inputs to the real engine from either layout', async () => {
  const drafts: DivinationDraft[] = [];
  const calculations: Array<MeihuaData['calculation'][]> = [];
  for (const layout of layouts) {
    const form = createForm({ meihuaMethod: 'character' });
    const results: MeihuaData['calculation'][] = [];
    async function calculate() {
      const session = await generateDivinationSession(form.draft);
      const calculation = (session.data as MeihuaData).calculation;
      assert.ok(calculation);
      results.push(calculation);
      return calculation;
    }

    form.changeInput(layout, 'character-text-input', '明');
    form.changeInput(layout, 'character-left-strokes-input', '4笔');
    form.changeInput(layout, 'character-right-strokes-input', '8划');
    const single = await calculate();
    assert.equal(single.characterLeftStrokes, 4);
    assert.equal(single.characterRightStrokes, 8);

    form.changeInput(layout, 'character-text-input', '西林');
    form.changeInput(layout, 'character-strokes-input', '7，8字');
    const short = await calculate();
    assert.deepEqual(short.characterStrokeCounts, [7, 8]);
    assert.equal(short.characterLeftStrokes, undefined);
    assert.equal(short.characterRightStrokes, undefined);
    assert.equal(short.characterTones, undefined);

    form.changeMethod(layout, 'number');
    form.changeInput(layout, 'number-input', '12.3a');
    const number = await calculate();
    assert.equal(number.methodKey, 'number');
    assert.equal(number.number, 123);
    assert.equal(number.characterText, undefined);
    assert.equal(number.characterStrokeCounts, undefined);
    form.changeMethod(layout, 'character');
    assert.equal(form.draft.meihuaCharacterStrokeCounts, '7，8');
    assert.deepEqual(await calculate(), short);

    form.changeInput(layout, 'character-text-input', '今日动静如何');
    form.changeInput(layout, 'character-tones-input', '1,4,3,3,1,1');
    const tones = await calculate();
    assert.deepEqual(tones.characterTones, [1, 4, 3, 3, 1, 1]);
    assert.equal(tones.characterStrokeCounts, undefined);

    form.changeInput(layout, 'character-text-input', '春风得意马蹄疾一日看花');
    const long = await calculate();
    assert.equal(long.characterCount, 11);
    assert.equal(long.characterTones, undefined);
    assert.equal(long.characterStrokeCounts, undefined);
    drafts.push(form.draft);
    calculations.push(results);
  }
  assert.deepEqual(drafts[0], drafts[1]);
  assert.deepEqual(calculations[0], calculations[1]);
});
