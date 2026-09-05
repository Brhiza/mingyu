import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import {
  assertCorePackageSize,
  CORE_PACKAGE_SIZE_LIMITS,
  assertSizeBudget,
  BROWSER_SIZE_LIMITS,
} from '../scripts/package-size-budget.mjs';

const paths = [
  'package/dist/name-number/generated-data.js',
  'package/dist/name-number/generated-data.d.ts',
  'package/dist/name-number/generated-character-references.js',
  'package/dist/name-number/generated-character-references.d.ts',
  'package/dist/name-number/generated-character-strokes.js',
  'package/dist/name-number/generated-character-strokes.d.ts',
  'package/dist/name-number/kongming-interpretations.js',
  'package/dist/name-number/kongming-interpretations.d.ts',
];

function entry(name: string, data = Buffer.from('export {};')) {
  const header = Buffer.alloc(512);
  header.write(name, 0, 100);
  header.write(`${data.length.toString(8).padStart(11, '0')}\0`, 124, 12);
  header.fill(32, 148, 156);
  header[156] = 48;
  header.write(
    `${header
      .reduce((sum, value) => sum + value, 0)
      .toString(8)
      .padStart(6, '0')}\0 `,
    148,
    8,
  );
  return Buffer.concat([header, data, Buffer.alloc((512 - (data.length % 512)) % 512)]);
}

function archive(entries = paths.map((path) => entry(path)), level = 9) {
  return gzipSync(Buffer.concat([...entries, Buffer.alloc(1024)]), { level });
}

function variedBytes(size: number) {
  const result = Buffer.alloc(size);
  let state = 123456789;
  for (let index = 0; index < size; index++) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    result[index] = state & 255;
  }
  return result;
}

test('包体积分项预算要求完整的字典与静态释义资料', () => {
  assert.equal(CORE_PACKAGE_SIZE_LIMITS.code, 2_650_000);
  assert.equal(CORE_PACKAGE_SIZE_LIMITS.dictionary, 2_300_000);
  assert.equal(CORE_PACKAGE_SIZE_LIMITS.total, 5_000_000);
  const result = assertCorePackageSize(archive());
  assert.ok(result.total > 0 && result.code > 0 && result.dictionary > 0);
  assert.throws(
    () => assertCorePackageSize(archive(paths.slice(1).map((path) => entry(path)))),
    /完整包含字典/,
  );
  assert.throws(
    () => assertCorePackageSize(archive([...paths, paths[0]].map((path) => entry(path)))),
    /字典资料重复/,
  );
});

test('代码和字典独立超额均失败，额外字典副本计入代码额度', () => {
  const payload = variedBytes(CORE_PACKAGE_SIZE_LIMITS.code + 100_000);
  assert.throws(
    () =>
      assertCorePackageSize(
        archive([...paths.map((path) => entry(path)), entry('package/dist/extra.js', payload)]),
      ),
    /代码压缩体积超过预算/,
  );
  assert.throws(
    () =>
      assertCorePackageSize(
        archive(paths.map((path, index) => entry(path, index === 0 ? payload : undefined))),
      ),
    /字典压缩体积超过预算/,
  );
  assert.throws(
    () =>
      assertCorePackageSize(
        archive([
          ...paths.map((path) => entry(path)),
          entry('package/dist/name-number/dictionary-copy.js', payload),
        ]),
      ),
    /代码压缩体积超过预算/,
  );
});

test('总包大小和归档完整性仍独立检查', () => {
  assert.throws(
    () =>
      assertCorePackageSize(
        archive(
          [
            ...paths.map((path) => entry(path)),
            entry('package/dist/large.js', Buffer.alloc(CORE_PACKAGE_SIZE_LIMITS.total + 100_000)),
          ],
          0,
        ),
      ),
    /总量压缩体积超过预算/,
  );
  const broken = entry(paths[0]);
  broken[0] ^= 1;
  assert.throws(() => assertCorePackageSize(archive([broken])), /头部校验失败/);
  assert.throws(() => assertCorePackageSize(gzipSync(Buffer.from('不完整归档'))), /未计量内容/);
});

test('体积预算在九成时提醒、超限时失败，按需导入独立受限', () => {
  for (const limit of [
    ...Object.values(CORE_PACKAGE_SIZE_LIMITS),
    ...Object.values(BROWSER_SIZE_LIMITS),
  ]) {
    const warnings: string[] = [];
    const warn = (message: string) => warnings.push(message);
    assertSizeBudget(limit * 0.9 - 1, limit, '产物', warn);
    assert.equal(warnings.length, 0);
    assertSizeBudget(limit * 0.9, limit, '产物', warn);
    assert.match(warnings[0], /90.0%/);
    assertSizeBudget(limit, limit, '产物', warn);
    assert.throws(() => assertSizeBudget(limit + 1, limit, '产物', warn), /超过预算/);
  }
  assert.throws(() => assertSizeBudget(NaN, 100, '产物'), /体积无效/);
  assert.throws(() => assertSizeBudget(1, 0, '产物'), /预算无效/);
  assert.throws(
    () => assertSizeBudget(400_000, BROWSER_SIZE_LIMITS.zodiac, '生肖子路径'),
    /超过预算/,
  );
});
