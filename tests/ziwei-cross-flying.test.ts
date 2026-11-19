import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import { locateCrossFlying } from '../src/systems/ziwei-cross-flying';
import { buildZiweiAstrolabe, getMutagensByStem, type HeavenlyStem } from '../src/systems/ziwei/index';
import worker from '../src/worker';

const first = { name: '甲', gender: 'female', birth: { year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 }, timezone: 8 } } as const;
const second = { name: '乙', gender: 'male', birth: { year: 1992, month: 8, day: 12, clock: { kind: 'exact', hour: 9, minute: 0, second: 0 }, timezone: 8 } } as const;
const input = { question: '怎样合作？', person1: first, person2: second, relationship: 'career', prompt: { schools: ['feixing'] } } as const;

test('双向十二宫四化按各自宫干和对方实际星曜落宫定位', async () => {
  for (const [a, b] of [['default', 'default'], ['zhongzhou', 'default'], ['default', 'zhongzhou']] as const) {
    const result = await calculate('ziwei-synastry', { ...input, person1: { ...first, rules: { algorithm: a } }, person2: { ...second, rules: { algorithm: b } } });
    const flying = result.data.selected!.evidence.crossFlying!;
    assert.equal(flying.paths.length, 96); assert.equal(flying.gaps.length, 0);
    const chart = (person: typeof first | typeof second, algorithm: typeof a) => buildZiweiAstrolabe({
      solarDate: `${person.birth.year}-${String(person.birth.month).padStart(2, '0')}-${String(person.birth.day).padStart(2, '0')}`,
      timeIndex: Math.floor((person.birth.clock.hour + 1) / 2), gender: person.gender,
      rules: { algorithm, yearDivide: 'normal', horoscopeDivide: 'normal', ageDivide: 'normal', dayDivide: 'forward', fixLeap: true },
    });
    const expected = (source: ReturnType<typeof chart>, target: ReturnType<typeof chart>, from: string, to: string) => {
      for (const palace of source.palaces) {
        const stars = getMutagensByStem(palace.heavenlyStem as HeavenlyStem);
        for (const [index, mutagen] of ['禄', '权', '科', '忌'].entries()) {
          const actual = flying.paths.find((path) => path.sourcePerson === from && path.sourceBranch === palace.earthlyBranch && path.mutagen === mutagen);
          const matches = target.palaces.filter((item) => [...item.majorStars, ...item.minorStars].some((star) => star.name === stars[index]));
          assert.equal(matches.length, 1);
          assert.ok(actual); assert.equal(actual.targetPerson, to); assert.equal(actual.sourceStem, palace.heavenlyStem); assert.equal(actual.star, stars[index]);
          assert.deepEqual([actual.targetPalace, actual.targetBranch, actual.targetBody], [matches[0].name, matches[0].earthlyBranch, matches[0].isBodyPalace]);
        }
      }
    };
    const chart1 = chart(first, a), chart2 = chart(second, b);
    expected(chart1, chart2, 'person1', 'person2'); expected(chart2, chart1, 'person2', 'person1');
    assert.match(result.prompt.text, /【宫干化星跨盘定位】/);
    assert.match(result.prompt.text, /不判断跨盘自化，也不计算运限/);
    const switched = await reprompt({ method: 'ziwei-synastry', result, question: '只看四化', prompt: { schools: ['sihua'] } });
    assert.doesNotMatch(switched.prompt.text, /【宫干化星跨盘定位】/);
  }
});

test('未知时辰不虚构选盘，选定候选后可查看并校验跨盘结果', async () => {
  const unknown = { ...first, birth: { ...first.birth, clock: { kind: 'unknown' } } };
  const pending = await calculate('ziwei-synastry', { ...input, person1: unknown });
  assert.equal(pending.data.selected, null); assert.match(pending.prompt.text, /尚未选定双方出生候选/);
  assert.match(pending.prompt.text, /全部候选比较不汇总此项/);
  const selected = await calculate('ziwei-synastry', { ...input, person1: { ...unknown, candidateIndex: 0 }, compareCandidates: false });
  assert.equal(selected.data.selected!.evidence.crossFlying!.paths.length, 96);
  assert.match((await reprompt({ method: 'ziwei-synastry', result: selected, question: '接着问' })).prompt.text, /【宫干化星跨盘定位】/);
  const altered = structuredClone(selected); altered.data.selected!.evidence.crossFlying!.paths[0].targetPalace = '伪造';
  await assert.rejects(() => reprompt({ method: 'ziwei-synastry', result: altered, question: '继续问' }), /不一致/);
});

test('未选择飞星时不返回跨盘明细，追问切换口径后仍可计算', async () => {
  const saved = await calculate('ziwei-synastry', { ...input, prompt: { schools: ['sihua'] } });
  assert.equal(saved.data.selected!.evidence.crossFlying, undefined);
  assert.doesNotMatch(saved.prompt.text, /【宫干化星跨盘定位】/);
  const next = await reprompt({ method: 'ziwei-synastry', result: saved, question: '换飞星口径', prompt: { schools: ['feixing'] } });
  assert.match(next.prompt.text, /【宫干化星跨盘定位】/);
  assert.match(next.prompt.text, /甲.*→乙/);
});

test('缺失和重复化星作为定位缺口返回', async () => {
  const result = await calculate('ziwei-synastry', input);
  const { person1, person2 } = structuredClone(result.data.selected!.natal);
  const star = person1.palaces[0].flyingTransformations[0].star;
  const original = person2.palaces.find((palace) => [...palace.majorStars, ...palace.minorStars].some((item) => item.name === star))!;
  const sample = [...original.majorStars, ...original.minorStars].find((item) => item.name === star)!;
  original.majorStars = original.majorStars.filter((item) => item.name !== star);
  original.minorStars = original.minorStars.filter((item) => item.name !== star);
  assert.ok(locateCrossFlying(person1, person2).gaps.some((item) => item.star === star && item.reason === '目标盘缺少同名星曜'));
  person2.palaces[0].minorStars.push(sample); person2.palaces[1].minorStars.push(sample);
  assert.ok(locateCrossFlying(person1, person2).gaps.some((item) => item.star === star && item.reason === '目标盘同名星曜落宫不唯一'));
});

test('HTTP 和 MCP 返回相同跨盘定位并支持追问', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'ziwei-synastry' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const http = await send('/api/calculate', { method: 'ziwei-synastry', input }); assert.equal(http.status, 200);
  const saved: any = await http.json();
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'ziwei-synastry', arguments: input } });
  assert.equal(mcp.status, 200);
  const response: any = await mcp.json();
  assert.deepEqual(response.result.structuredContent.data.selected.evidence.crossFlying, saved.data.selected.evidence.crossFlying);
  const follow = await send('/api/prompt', { method: 'ziwei-synastry', result: saved, question: '继续问' });
  assert.equal(follow.status, 200); assert.match((await follow.json() as any).prompt.text, /【宫干化星跨盘定位】/);
});
