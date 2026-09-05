import test from 'node:test';
import assert from 'node:assert/strict';
import { getHuangliDayGods } from '../packages/core/src/shensha';

test('要安至续世九神逐月起例覆盖十二月六十日', () => {
  // 《御定星历考原》卷三分别列要安、敬安，二者起例不同。
  // https://www.shidianguji.com/zh/book/NGJ892412000003528227963/chapter/1lukjyerwxn9i
  // 玉宇、金堂、益后以完整逐月表互证。
  // https://www.shidianguji.com/mid-page/7619449118268588041
  // https://www.shidianguji.com/book/SK1618/chapter/1jurstsg7ao85
  // https://www.shidianguji.com/book/SK1618/chapter/1jurstsg7cffp
  const tables = {
    要安: [...'寅申卯酉辰戌巳亥午子未丑'],
    敬安: [...'未丑申寅酉卯戌辰亥巳子午'],
    普护: [...'申寅酉卯戌辰亥巳子午丑未'],
    福生: [...'酉卯戌辰亥巳子午丑未寅申'],
    圣心: [...'亥巳子午丑未寅申卯酉辰戌'],
    续世: [...'丑未寅申卯酉辰戌巳亥午子'],
    玉宇: [...'卯酉辰戌巳亥午子未丑申寅'],
    金堂: [...'辰戌巳亥午子未丑申寅酉卯'],
    益后: [...'子午丑未寅申卯酉辰戌巳亥'],
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
          targets[month] === branches[day % 12],
          `${month + 1}月/${pillar(day)}/${name}`,
        );
      }
    }
});
