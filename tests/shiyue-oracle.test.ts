import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  SHIYUE_ORACLE_BACK_IMAGE_URL,
  SHIYUE_ORACLE_CARDS,
  buildShiyueOraclePrompt,
  drawShiyueOracleCards,
  getShiyueOracleImageUrl,
} from '../src/systems/shiyue-oracle';

test('时月神谕具备完整 60 干支牌且抽牌、手动选牌与提示词输出正确', () => {
  assert.equal(SHIYUE_ORACLE_CARDS.length, 60);
  assert.equal(SHIYUE_ORACLE_CARDS[0]?.ganzhi, '甲子');
  assert.equal(SHIYUE_ORACLE_CARDS[59]?.ganzhi, '癸亥');

  const randomThree = drawShiyueOracleCards('three');
  assert.equal(randomThree.length, 3);
  assert.equal(new Set(randomThree.map((c) => c.id)).size, 3);

  const manualThree = drawShiyueOracleCards('three', [1, 15, 60]);
  assert.deepEqual(
    manualThree.map((c) => c.ganzhi),
    ['甲子', '戊寅', '癸亥'],
  );

  const prompt = buildShiyueOraclePrompt('项目能否顺利上线？', '三牌脉络', manualThree);
  assert.ok(prompt.includes('项目能否顺利上线？'));
  assert.ok(prompt.includes('海藏新生'));
  assert.ok(prompt.includes('沧海归一'));
});

test('时月神谕的 60 张牌面和牌背随应用一起提供', async () => {
  const cycle = SHIYUE_ORACLE_CARDS.map(({ ganzhi }) => ganzhi);
  const stems = '甲乙丙丁戊己庚辛壬癸';
  const branches = '子丑寅卯辰巳午未申酉戌亥';
  assert.deepEqual(cycle, Array.from({ length: 60 }, (_, i) => stems[i % 10]! + branches[i % 12]!));

  const publicDir = new URL('../public/', import.meta.url);
  const faces = SHIYUE_ORACLE_CARDS.map(({ id }) => getShiyueOracleImageUrl(id));
  assert.equal(new Set(faces).size, 60);
  for (const path of [...faces, SHIYUE_ORACLE_BACK_IMAGE_URL]) {
    assert.ok(path.startsWith('/cards/oracle/'), path);
    const file = await readFile(new URL(path.slice(1), publicDir));
    assert.equal(file.toString('ascii', 8, 12), 'WEBP', path);
  }
});
