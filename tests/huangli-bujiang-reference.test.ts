import test from 'node:test';
import assert from 'node:assert/strict';
import { getHuangliDayGods } from '../packages/core/src/shensha';

test('不将覆盖完整月日组合', () => {
  // 《协纪辨方书》阴阳不将十二月立成表。
  // https://www.shidianguji.com/book/SK1619/chapter/1l9llprtui2pg
  const tables = {
    不将: [
      '辛亥辛丑辛卯庚子庚寅己亥己丑己卯丁亥丁丑丁卯丙子丙寅',
      '庚戌庚子庚寅己亥己丑丁亥丁丑丙戌丙子丙寅乙亥乙丑',
      '己酉己亥己丑丁酉丁亥丁丑丙戌丙子乙酉乙亥乙丑甲戌甲子',
      '丁酉丁亥丙申丙戌丙子乙酉乙亥甲申甲戌甲子戊申戊戌戊子',
      '丙申丙戌乙未乙酉乙亥甲申甲戌戊申戊戌癸未癸酉癸亥',
      '乙未乙酉甲午甲申甲戌戊午戊申戊戌癸未癸酉壬午壬申壬戌',
      '乙巳乙未乙酉甲午甲申戊午戊申癸巳癸未癸酉壬午壬申',
      '甲辰甲午甲申戊辰戊午戊申癸巳癸未壬辰壬午壬申辛巳辛未',
      '戊辰戊午癸卯癸巳癸未壬辰壬午辛卯辛巳辛未庚辰庚午',
      '癸卯癸巳壬寅壬辰壬午辛卯辛巳庚寅庚辰庚午己卯己巳',
      '壬寅壬辰辛丑辛卯辛巳庚寅庚辰己丑己卯己巳丁丑丁卯丁巳',
      '辛丑辛卯庚子庚寅庚辰己丑己卯丁丑丁卯丙子丙寅丙辰',
    ],
  };
  const stems = [...'甲乙丙丁戊己庚辛壬癸'];
  const branches = [...'子丑寅卯辰巳午未申酉戌亥'];
  const pillar = (index: number) => stems[index % 10] + branches[index % 12];
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const names = getHuangliDayGods(pillar(month + 2), pillar(day)).map((god) => god.getName());
      for (const [name, targets] of Object.entries(tables)) {
        assert.equal(
          names.includes(name),
          targets[month].includes(pillar(day)),
          `${month + 1}月/${pillar(day)}/${name}`,
        );
      }
    }
});

test('厌对按正月辰逆行十二辰', () => {
  const stems = [...'甲乙丙丁戊己庚辛壬癸'];
  const branches = [...'子丑寅卯辰巳午未申酉戌亥'];
  const targets = [...'辰卯寅丑子亥戌酉申未午巳'];
  const pillar = (index: number) => stems[index % 10] + branches[index % 12];
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const names = getHuangliDayGods(pillar(month + 2), pillar(day)).map((god) => god.getName());
      assert.equal(
        names.includes('厌对'),
        targets[month] === branches[day % 12],
        `${month + 1}月/${pillar(day)}`,
      );
    }
});
