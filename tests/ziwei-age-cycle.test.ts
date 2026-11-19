import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';

const baseBirth = {
  year: 1950,
  month: 5,
  day: 15,
  clock: { kind: 'exact' as const, hour: 14, minute: 30, second: 0 },
  timezone: 8,
};

test('nominalAge = 121 时小限按 12 岁循环续行，大限仍落末限 [112, 121]', async () => {
  const [res1, res120, res121] = await Promise.all([
    calculate('ziwei', {
      question: '1岁运限',
      birth: baseBirth,
      gender: 'female',
      referenceTime: '1950-05-15T14:30:00+08:00',
    }),
    calculate('ziwei', {
      question: '120岁运限',
      birth: baseBirth,
      gender: 'female',
      referenceTime: '2069-05-15T14:30:00+08:00',
    }),
    calculate('ziwei', {
      question: '121岁运限',
      birth: baseBirth,
      gender: 'female',
      referenceTime: '2070-05-15T14:30:00+08:00',
    }),
  ]);

  assert.equal(res121.data.reference?.layers.age.nominalAge, 121);
  assert.equal(res121.data.reference?.layers.age.index, res1.data.reference?.layers.age.index);
  assert.equal(res121.data.reference?.layers.age.heavenlyStem, res1.data.reference?.layers.age.heavenlyStem);
  assert.equal(res121.data.reference?.layers.age.earthlyBranch, res1.data.reference?.layers.age.earthlyBranch);
  assert.deepEqual(res121.data.reference?.layers.age.palaceNames, res1.data.reference?.layers.age.palaceNames);
  assert.deepEqual(res121.data.reference?.layers.age.mutagen, res1.data.reference?.layers.age.mutagen);

  assert.equal(res121.data.reference?.layers.decadal.index, res120.data.reference?.layers.decadal.index);
  assert.equal(res121.data.reference?.layers.decadal.name, '大限');
  assert.deepEqual(res121.data.reference?.layers.decadal.stars, res120.data.reference?.layers.decadal.stars);
  assert.match(res121.prompt.text, /虚岁121/);
});

test('nominalAge = 125 时小限按 12 岁循环、大限按 120 岁循环，且支持 reprompt', async () => {
  const [res5, res125] = await Promise.all([
    calculate('ziwei', {
      question: '5岁运限',
      birth: baseBirth,
      gender: 'female',
      referenceTime: '1954-05-15T14:30:00+08:00',
    }),
    calculate('ziwei', {
      question: '125岁运限',
      birth: baseBirth,
      gender: 'female',
      referenceTime: '2074-05-15T14:30:00+08:00',
    }),
  ]);

  const layers5 = res5.data.reference!.layers;
  const layers125 = res125.data.reference!.layers;

  assert.equal(layers125.age.nominalAge, 125);
  assert.equal(layers125.age.index, layers5.age.index);
  assert.equal(layers125.age.heavenlyStem, layers5.age.heavenlyStem);
  assert.equal(layers125.age.earthlyBranch, layers5.age.earthlyBranch);
  assert.deepEqual(layers125.age.palaceNames, layers5.age.palaceNames);
  assert.deepEqual(layers125.age.mutagen, layers5.age.mutagen);

  assert.equal(layers125.decadal.index, layers5.decadal.index);
  assert.equal(layers125.decadal.name, '大限');
  assert.equal(layers125.decadal.heavenlyStem, layers5.decadal.heavenlyStem);
  assert.equal(layers125.decadal.earthlyBranch, layers5.decadal.earthlyBranch);
  assert.deepEqual(layers125.decadal.palaceNames, layers5.decadal.palaceNames);
  assert.deepEqual(layers125.decadal.mutagen, layers5.decadal.mutagen);
  assert.deepEqual(layers125.decadal.stars, layers5.decadal.stars);

  assert.ok(res125.data.limitations.every((line: string) => !line.includes('限 1 至 120 岁')));

  const saved = JSON.parse(JSON.stringify(res125));
  const followed = await reprompt({ method: 'ziwei', result: saved, question: '追问125岁大限与小限' });
  assert.match(followed.prompt.text, /虚岁125/);
  assert.match(followed.prompt.text, /大限：/);

  const tampered = structuredClone(saved);
  tampered.data.reference.layers.age.index = (tampered.data.reference.layers.age.index + 1) % 12;
  await assert.rejects(() => reprompt({ method: 'ziwei', result: tampered, question: '追问篡改' }), /不一致/);
});

test('nominalAge < 1 时明确拒绝', async () => {
  await assert.rejects(
    () =>
      calculate('ziwei', {
        question: '小于1岁运限',
        birth: {
          year: 1990,
          month: 1,
          day: 26,
          clock: { kind: 'exact', hour: 23, minute: 30, second: 0 },
          timezone: 8,
        },
        gender: 'female',
        rules: { dayDivide: 'forward' },
        referenceTime: '1990-01-26T23:45:00+08:00',
      }),
    /1 岁及以上/,
  );
});

test('ageDivide: birthday 在公历生日前虚岁减 1 并重算大小限，生日当天起与 normal 一致且支持 reprompt', async () => {
  const [normalBefore, birthdayBefore, birthdayOnDay, normalAge12] = await Promise.all([
    calculate('ziwei', {
      question: 'normal 生日前',
      birth: baseBirth,
      gender: 'female',
      referenceTime: '1962-05-14T14:30:00+08:00',
    }),
    calculate('ziwei', {
      question: 'birthday 生日前',
      birth: baseBirth,
      gender: 'female',
      rules: { ageDivide: 'birthday' },
      referenceTime: '1962-05-14T14:30:00+08:00',
    }),
    calculate('ziwei', {
      question: 'birthday 生日当天',
      birth: baseBirth,
      gender: 'female',
      rules: { ageDivide: 'birthday' },
      referenceTime: '1962-05-15T14:30:00+08:00',
    }),
    calculate('ziwei', {
      question: 'normal 12岁对照',
      birth: baseBirth,
      gender: 'female',
      referenceTime: '1961-05-15T14:30:00+08:00',
    }),
  ]);

  assert.equal(normalBefore.data.basis.rules.ageDivide, 'normal');
  assert.equal(normalBefore.data.reference?.layers.age.nominalAge, 13);

  assert.equal(birthdayBefore.data.basis.rules.ageDivide, 'birthday');
  assert.equal(birthdayBefore.data.reference?.layers.age.nominalAge, 12);
  assert.equal(birthdayBefore.data.reference?.layers.age.index, normalAge12.data.reference?.layers.age.index);
  assert.equal(birthdayBefore.data.reference?.layers.decadal.index, normalAge12.data.reference?.layers.decadal.index);
  assert.deepEqual(birthdayBefore.data.reference?.layers.decadal.stars, normalAge12.data.reference?.layers.decadal.stars);
  assert.ok(birthdayBefore.data.limitations.some((line: string) => line.includes('birthday 口径')));
  assert.match(birthdayBefore.prompt.text, /虚岁12/);
  assert.match(birthdayBefore.prompt.text, /年龄分界birthday/);

  assert.equal(birthdayOnDay.data.reference?.layers.age.nominalAge, 13);
  assert.equal(birthdayOnDay.data.reference?.layers.age.index, normalBefore.data.reference?.layers.age.index);
  assert.equal(birthdayOnDay.data.reference?.layers.decadal.index, normalBefore.data.reference?.layers.decadal.index);

  const saved = JSON.parse(JSON.stringify(birthdayBefore));
  const followed = await reprompt({ method: 'ziwei', result: saved, question: '追问birthday口径运限' });
  assert.match(followed.prompt.text, /虚岁12/);
});
