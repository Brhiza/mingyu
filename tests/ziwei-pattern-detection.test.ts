import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { detectPatterns } from '../packages/core/src/ziwei/iztro/pattern-detection.ts';
import type { PalaceFact, StarFact } from '../packages/core/src/types/analysis.ts';

const branches = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];

function star(name: string, birthMutagen?: StarFact['birth_mutagen']): StarFact {
  return {
    name,
    kind: 'major',
    scope: 'origin',
    birth_mutagen: birthMutagen,
  };
}

function createPalaces(mingBranch: string, mingStars: StarFact[]): PalaceFact[] {
  const mingIndex = branches.indexOf(mingBranch);
  if (mingIndex < 0) {
    throw new Error(`未知地支：${mingBranch}`);
  }

  return branches.map((branch, index) => {
    const isMing = index === mingIndex;
    const oppositeIndex = (index + 6) % 12;
    const surroundedIndexes = Array.from(
      new Set([index, oppositeIndex, (index + 4) % 12, (index + 8) % 12]),
    );

    return {
      index,
      name: isMing ? '命宫' : `宫${index}`,
      is_body_palace: false,
      is_original_palace: false,
      heavenly_stem: '',
      earthly_branch: branch,
      major_stars: isMing ? mingStars : [],
      minor_stars: [],
      other_stars: [],
      scope_stars: [],
      changsheng12: '',
      boshi12: '',
      base_jiangqian12: '',
      base_suiqian12: '',
      decadal_range: [0, 0],
      ages: [],
      scope_hits: [],
      empty_state: mingStars.length === 0,
      opposite_palace_index: oppositeIndex,
      surrounded_palace_indexes: surroundedIndexes,
      summary_tags: [],
    };
  });
}

test('紫微格局：按实际地支判断月朗天门和日照雷门，不依赖宫位数字索引', () => {
  const yueLang = detectPatterns({ palaces: createPalaces('亥', [star('太阴')]) });
  assert.ok(yueLang.some((item) => item.name === '月朗天门'));

  const wrongYueLang = detectPatterns({ palaces: createPalaces('丑', [star('太阴')]) });
  assert.equal(
    wrongYueLang.some((item) => item.name === '月朗天门'),
    false,
  );

  const riZhao = detectPatterns({ palaces: createPalaces('卯', [star('太阳')]) });
  assert.ok(riZhao.some((item) => item.name === '日照雷门'));

  const wrongRiZhao = detectPatterns({ palaces: createPalaces('巳', [star('太阳')]) });
  assert.equal(
    wrongRiZhao.some((item) => item.name === '日照雷门'),
    false,
  );
});

test('紫微格局：天罗地网和日月反背按辰戌地支判断', () => {
  const tianLuo = detectPatterns({ palaces: createPalaces('辰', []) });
  assert.ok(tianLuo.some((item) => item.name === '天罗地网'));

  const diWang = detectPatterns({ palaces: createPalaces('戌', []) });
  assert.ok(diWang.some((item) => item.name === '天罗地网'));

  const riFanBei = detectPatterns({ palaces: createPalaces('戌', [star('太阳')]) });
  assert.ok(riFanBei.some((item) => item.name === '日月反背'));

  const yueFanBei = detectPatterns({ palaces: createPalaces('辰', [star('太阴')]) });
  assert.ok(yueFanBei.some((item) => item.name === '日月反背'));
});

test('紫微格局：子午寅申亥未等地支规则不受 iztro 索引起点影响', () => {
  const shiZhong = createPalaces('子', [star('巨门')]);
  shiZhong[10].major_stars[0].birth_mutagen = '禄';
  assert.ok(detectPatterns({ palaces: shiZhong }).some((item) => item.name === '石中隐玉'));

  const maTou = createPalaces('午', [star('天同')]);
  maTou[0].minor_stars.push(star('擎羊'));
  assert.ok(detectPatterns({ palaces: maTou }).some((item) => item.name === '马头带箭'));

  const qiShaYin = detectPatterns({ palaces: createPalaces('寅', [star('七杀')]) });
  assert.ok(qiShaYin.some((item) => item.name === '七杀朝斗'));

  const qiShaShen = detectPatterns({ palaces: createPalaces('申', [star('七杀')]) });
  assert.ok(qiShaShen.some((item) => item.name === '七杀朝斗'));

  const xiongSu = detectPatterns({ palaces: createPalaces('亥', [star('廉贞')]) });
  assert.ok(xiongSu.some((item) => item.name === '雄宿乾元'));

  const mingZhu = createPalaces('未', []);
  mingZhu[11].name = '迁移';
  mingZhu[1].major_stars.push(star('太阳'));
  mingZhu[9].major_stars.push(star('太阴'));
  assert.ok(detectPatterns({ palaces: mingZhu }).some((item) => item.name === '明珠出海'));

  const mingZhuWithMinorStar = createPalaces('未', []);
  mingZhuWithMinorStar[11].name = '迁移';
  mingZhuWithMinorStar[5].minor_stars.push(star('文昌'));
  mingZhuWithMinorStar[1].major_stars.push(star('太阳'));
  mingZhuWithMinorStar[9].major_stars.push(star('太阴'));
  assert.ok(
    detectPatterns({ palaces: mingZhuWithMinorStar }).some((item) => item.name === '明珠出海'),
  );
});
