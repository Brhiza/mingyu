import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildFocusTaskBundle } from '../src/lib/ziwei-prompts/focus-bundle.ts';
import type { AnalysisPayloadV1 } from '../packages/core/src/types/analysis.ts';

function makePalace(index: number, name: string, mutagen?: string) {
  return {
    index,
    name,
    major_stars: mutagen
      ? [
          {
            name: '紫微',
            type: '主星',
            brightness: '庙',
            birth_mutagen: mutagen,
          },
        ]
      : [{ name: '天机', type: '主星', brightness: '得' }],
    minor_stars: [],
    other_stars: [],
    self_mutagens: mutagen ? [mutagen] : [],
  };
}

test('紫微飞星四化专题应优先聚焦四化落宫并给出专题主线', () => {
  const payload = {
    active_scope: { scope: 'origin', palace_index: 0, label: '本命' },
    palaces: [
      makePalace(0, '命宫'),
      makePalace(1, '兄弟', '禄'),
      makePalace(2, '夫妻', '忌'),
      makePalace(3, '子女'),
    ],
  } as unknown as AnalysisPayloadV1;

  const bundle = buildFocusTaskBundle(payload, {
    report_key: 'feixing-sihua',
    report_title: '飞星四化专题',
    report_type: 'mutagen',
    selected_topic: '飞星四化',
    scope_type: 'origin',
    scope_label: '本命',
    focus_notes: [],
  });

  assert.match(bundle.focusSummary, /四化/);
  assert.ok(bundle.focusPalaces.some((item) => item.name === '兄弟'));
  assert.ok(bundle.focusPalaces.some((item) => item.name === '夫妻'));
});
