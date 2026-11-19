import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CLASSICAL_REFERENCES_BY_METHOD,
  getClassicalReferences,
  supportsClassicalReferences,
} from '../src/systems/classics-references';

const CANONICAL_METHODS = [
  'bazi',
  'ziwei',
  'bazi-ziwei',
  'liuyao',
  'meihua',
  'jinkoujue',
  'qimen',
  'liuren',
  'almanac',
  'taiyi',
  'wuyun-liuqi',
  'huangji-jingshi',
  'bazhai',
  'xuankong',
  'residential',
  'qizheng',
  'xiaoliuren',
] as const;

const ALIAS_METHODS: Record<string, string> = {
  huangji: 'huangji-jingshi',
  wuyun: 'wuyun-liuqi',
  'qimen-lifetime': 'qimen',
  'bazi-compatibility': 'bazi',
  'ziwei-compatibility': 'ziwei',
};

test('17 种标准术数均提供精简古籍依据且结构完整不可变', () => {
  assert.deepEqual(Object.keys(CLASSICAL_REFERENCES_BY_METHOD).sort(), [...CANONICAL_METHODS].sort());
  assert.equal(Object.isFrozen(CLASSICAL_REFERENCES_BY_METHOD), true);

  for (const method of CANONICAL_METHODS) {
    assert.equal(supportsClassicalReferences(method), true, method);
    const references = getClassicalReferences(method);
    assert.ok(references.length > 0, method);

    for (const ref of references) {
      assert.ok(ref.id.length > 0, `${method} id`);
      assert.ok(ref.book.length > 0, `${method} book`);
      assert.ok(ref.chapter.length > 0, `${method} chapter`);
      assert.ok(ref.summary.length > 0, `${method} summary`);
      assert.ok(ref.application.length > 0, `${method} application`);
      assert.match(ref.sourceUrl, /^https:\/\//, `${method} sourceUrl`);
      assert.equal(ref.textType, 'summary', `${method} textType`);
    }

    const originalBook = CLASSICAL_REFERENCES_BY_METHOD[method][0].book;
    references[0].book = '被修改的书名';
    assert.equal(CLASSICAL_REFERENCES_BY_METHOD[method][0].book, originalBook);
  }
});

test('别名映射与未知方法、原型属性处理正确', () => {
  for (const [alias, canonical] of Object.entries(ALIAS_METHODS)) {
    assert.equal(supportsClassicalReferences(alias), true, alias);
    assert.deepEqual(getClassicalReferences(alias), getClassicalReferences(canonical), alias);
  }

  for (const unknown of ['', 'unknown-method', 'toString', 'constructor', '__proto__']) {
    assert.equal(supportsClassicalReferences(unknown), false, unknown);
    assert.deepEqual(getClassicalReferences(unknown), [], unknown);
  }
});
