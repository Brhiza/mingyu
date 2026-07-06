// Smoke test: verify extracted modules produce correct results
import { calculateMingGua } from '../dist/bazi/mingGua.js';
import { analyzeNayinProfile } from '../dist/bazi/nayinAnalysis.js';
import { analyzeKongWangProfile } from '../dist/bazi/kongWangAnalysis.js';
import { buildLuckDirectionProfile } from '../dist/bazi/luckDetails.js';

let pass = 0,
  fail = 0;
function check(name, cond) {
  console.log((cond ? '✓ ' : '✗ ') + name);
  if (cond) pass++;
  else fail++;
}

// Test 1: 命卦 - 1990 male: 1990%9=1, 11-1=10→normalize=1 → 坎卦
const mg = calculateMingGua(1990, 'male');
check('1990男命卦=1坎水东四命', mg.number === 1 && mg.gua === '坎' && mg.eastWest === '东四命');

// Test 2: 2000 male: 2000%9=2, 11-2=9 → 离卦
const mg2 = calculateMingGua(2000, 'male');
check('2000男命卦=9离', mg2.number === 9 && mg2.gua === '离');

// Test 3: 逢5寄宫 - 1990女: 4+1=5 → 寄艮8
const mg3 = calculateMingGua(1990, 'female');
check('1990女命卦逢5寄艮=8艮', mg3.number === 8 && mg3.gua === '艮');

// Test 4: 纳音
const nayin = analyzeNayinProfile([
  { gan: '甲', zhi: '子' },
  { gan: '乙', zhi: '丑' },
  { gan: '丙', zhi: '寅' },
  { gan: '丁', zhi: '卯' },
]);
check('纳音甲子=海中金', nayin.items[0].nayin === '海中金');
check('纳音丙寅=炉中火', nayin.items[2].nayin === '炉中火');

// Test 5: 空亡 - 甲子日旬空戌亥
const kw = analyzeKongWangProfile(
  [
    { gan: '甲', zhi: '子' },
    { gan: '丁', zhi: '卯' },
    { gan: '甲', zhi: '子' },
    { gan: '丁', zhi: '卯' },
  ],
  '甲',
);
check('甲子日旬空=戌亥', kw.items[0].emptyBranches.join('') === '戌亥');

// Test 6: 大运方向
check('阳男(甲)顺行', buildLuckDirectionProfile('male', '甲').direction === '顺行');
check('阳女(甲)逆行', buildLuckDirectionProfile('female', '甲').direction === '逆行');
check('阴男(乙)逆行', buildLuckDirectionProfile('male', '乙').direction === '逆行');
check('阴女(乙)顺行', buildLuckDirectionProfile('female', '乙').direction === '顺行');

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
