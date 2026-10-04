import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateQimenLifetime,
  buildLifetimePrompt,
  generateQimen,
} from 'mingyu-core/divination/qimen';
import { TimeManager } from 'mingyu-core/calendar';
import { generateMeihua } from 'mingyu-core/divination/meihua';
import { generateLiuyao } from 'mingyu-core/divination/liuyao';
import { generateLiuren } from 'mingyu-core/divination/liuren';
import { generateJinkoujue } from 'mingyu-core/divination/jinkoujue';
import { buildDivinationPrompt as buildCorePrompt } from 'mingyu-core/prompt';
import { buildTimeInfoText, buildSolarTimeInfoText } from 'mingyu-core/prompt/formatters';
import { buildDivinationPrompt as buildAppPrompt } from '../src/lib/divination/engine/index.ts';

test('奇门终身局当前时间与所标北京时间一致，不受全局占卜时区覆盖影响', () => {
  const data = calculateQimenLifetime({
    birthDateTime: '2024-03-20T10:00:00',
    timezone: 8,
  });
  const beijingMinute = () => {
    const time = TimeManager.getWallClockParts(new Date(), 480);
    return `${time.year}-${String(time.month).padStart(2, '0')}-${String(time.day).padStart(2, '0')} ${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`;
  };

  TimeManager.setTimezoneOffsetMinutesOverride(-300);
  try {
    const before = beijingMinute();
    const prompt = buildLifetimePrompt(data);
    const after = beijingMinute();
    const displayed = prompt.match(/【当前时间】\n([^\n]+)（UTC\+08:00）/)?.[1];
    assert.ok(displayed === before || displayed === after, prompt.slice(0, 80));
  } finally {
    TimeManager.setTimezoneOffsetMinutesOverride(480);
  }
});

test('奇门与易占四法保留默认和显式起课时区，重开提示词时钟表与四柱保持一致', () => {
  const date = new Date('2025-06-18T02:30:00Z');
  const currentTime = new Date('2026-01-01T00:00:00Z');
  const cases = [
    {
      offset: 480,
      solar: '公历：2025年6月18日 10时30分',
      zone: '+08:00',
      day: '戊午',
      hour: '丁巳',
    },
    { offset: 0, solar: '公历：2025年6月18日 2时30分', zone: '+00:00', day: '戊午', hour: '癸丑' },
    {
      offset: -720,
      solar: '公历：2025年6月17日 14时30分',
      zone: '-12:00',
      day: '丁巳',
      hour: '丁未',
    },
  ];
  try {
    for (const expected of cases) {
      TimeManager.setTimezoneOffsetMinutesOverride(expected.offset);
      for (const method of ['qimen', 'meihua', 'liuyao', 'liuren', 'jinkoujue'] as const) {
        if (expected.offset === -720 && method !== 'qimen' && method !== 'meihua') continue;
        const generate = (timezoneOffsetMinutes?: number) => {
          switch (method) {
            case 'qimen':
              return generateQimen(date, 'zhuanpan', 'hour', 'chaibu', timezoneOffsetMinutes);
            case 'meihua':
              return generateMeihua(
                date,
                { method: 'number', number: 123 },
                {
                  timezoneOffsetMinutes,
                },
              );
            case 'liuyao':
              return generateLiuyao(date, { method: 'time', timezoneOffsetMinutes });
            case 'liuren':
              return generateLiuren(date, { timezoneOffsetMinutes });
            case 'jinkoujue':
              return generateJinkoujue({
                method: 'branch',
                branch: '酉',
                customDate: date,
                timezoneOffsetMinutes,
              });
          }
        };
        const data = generate();
        assert.equal(data.timestamp, date.getTime());
        assert.deepEqual(data.ganzhi, {
          year: '乙巳',
          month: '壬午',
          day: expected.day,
          hour: expected.hour,
        });
        if ('mainHexagram' in data)
          assert.equal(data.calculation?.timezoneOffsetMinutes, expected.offset);
        else assert.equal(data.timezoneOffsetMinutes, expected.offset);
        TimeManager.setTimezoneOffsetMinutesOverride(expected.offset === 480 ? 0 : 480);
        if (method !== 'qimen' && expected.offset !== -720) {
          const explicit = generate(expected.offset);
          assert.deepEqual(explicit, data, `${method}显式${expected.offset}须覆盖全局时区`);
        }
        assert.equal(buildSolarTimeInfoText(data), expected.solar);
        assert.ok(
          buildTimeInfoText(data).includes(
            `干支：乙巳年 壬午月 ${expected.day}日 ${expected.hour}时`,
          ),
        );
        const prompt = buildCorePrompt({ method, data, question: '进展如何？', currentTime });
        assert.equal(
          prompt.match(/【起课时间】\n([^\n]+)/u)?.[1],
          `${expected.solar}（UTC${expected.zone}）`,
        );
        assert.equal(
          prompt.match(/【当前时间】\n([^\n]+)/u)?.[1],
          '公历：2026年1月1日 8时0分（UTC+08:00）',
        );
        assert.ok(buildAppPrompt(method, '进展如何？', data).includes(expected.solar));
        const sameInstant = buildCorePrompt({
          method,
          data,
          question: '进展如何？',
          currentTime: date,
        });
        assert.equal(sameInstant.includes('【起课时间】'), expected.offset !== 480);
        TimeManager.setTimezoneOffsetMinutesOverride(expected.offset);
      }
    }
    const corrected = generateQimen(
      new Date('2025-06-18T01:30:00Z'),
      'zhuanpan',
      'hour',
      'chaibu',
      0,
      undefined,
      date,
    );
    const prompt = buildCorePrompt({
      method: 'qimen',
      data: corrected,
      question: '进展如何？',
      currentTime,
    });
    assert.equal(
      prompt.match(/【起课时间】\n([\s\S]*?)(?:\n\n|$)/u)?.[1],
      '公历：2025年6月18日 2时30分（UTC+00:00）\n真太阳时校正时刻：2025年6月18日 1时30分（UTC+00:00）（用于排盘）',
    );
  } finally {
    TimeManager.setTimezoneOffsetMinutesOverride(480);
  }
});
