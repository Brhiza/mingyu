import assert from 'node:assert/strict';
import { gunzipSync, gzipSync } from 'node:zlib';

// 十进制字节；按完整功能基线预留约 15%～18%，不随每次构建自动抬高。
// 压缩包基线：总量 4.252 MB、代码 2.265 MB、字典 1.953 MB。
export const CORE_PACKAGE_SIZE_LIMITS = {
  total: 5_000_000,
  code: 2_650_000,
  dictionary: 2_300_000,
};

// Vite 生产构建全部 JS 的未压缩总量，不代表网站首屏或网络传输体积。
// 完整客户端基线 4.000 MB；生肖子路径基线 0.235 MB，独立防止按需导入退化。
export const BROWSER_SIZE_LIMITS = {
  full: 4_600_000,
  zodiac: 300_000,
};

export function assertSizeBudget(bytes, limit, label, warn = console.warn) {
  assert.ok(Number.isSafeInteger(bytes) && bytes >= 0, `${label}体积无效`);
  assert.ok(Number.isSafeInteger(limit) && limit > 0, `${label}预算无效`);
  assert.ok(bytes <= limit, `${label}超过预算：${bytes}/${limit} 字节`);
  if (bytes >= limit * 0.9) {
    warn(
      `${label}已使用 ${((bytes / limit) * 100).toFixed(1)}% 预算：${bytes}/${limit} 字节，请检查增长原因。`,
    );
  }
}

const dictionaryPaths = new Set([
  'package/dist/name-number/generated-data.js',
  'package/dist/name-number/generated-data.d.ts',
  'package/dist/name-number/generated-character-references.js',
  'package/dist/name-number/generated-character-references.d.ts',
  'package/dist/name-number/generated-character-strokes.js',
  'package/dist/name-number/generated-character-strokes.d.ts',
  'package/dist/name-number/kongming-interpretations.js',
  'package/dist/name-number/kongming-interpretations.d.ts',
]);

export function measureCorePackageSize(archive) {
  const tar = gunzipSync(archive);
  const code = [];
  const dictionary = [];
  const seen = new Set();
  let cursor = 0;
  while (cursor + 512 <= tar.length) {
    const header = tar.subarray(cursor, cursor + 512);
    if (header.every((value) => value === 0)) break;
    const readText = (start, end) => header.subarray(start, end).toString('utf8').split('\0')[0];
    const name = readText(0, 100);
    const prefix = readText(345, 500);
    const path = prefix ? `${prefix}/${name}` : name;
    const size = parseInt(readText(124, 136).trim(), 8);
    const checksum = parseInt(readText(148, 156).trim(), 8);
    const actualChecksum = header.reduce(
      (sum, value, index) => sum + (index >= 148 && index < 156 ? 32 : value),
      0,
    );
    assert.equal(checksum, actualChecksum, '发布归档头部校验失败');
    assert.ok(Number.isSafeInteger(size) && size >= 0, '发布归档包含无效长度');
    const end = cursor + 512 + Math.ceil(size / 512) * 512;
    assert.ok(end <= tar.length, '发布归档条目不完整');
    const block = tar.subarray(cursor, end);
    if (dictionaryPaths.has(path)) {
      assert.ok(header[156] === 0 || header[156] === 48, '字典资料必须为普通文件');
      assert.ok(!seen.has(path), `字典资料重复：${path}`);
      seen.add(path);
      dictionary.push(block);
    } else {
      code.push(block);
    }
    cursor = end;
  }
  assert.ok(
    tar.subarray(cursor).every((value) => value === 0),
    '发布归档尾部包含未计量内容',
  );
  assert.deepEqual(
    [...seen].sort(),
    [...dictionaryPaths].sort(),
    '发布归档需完整包含字典及类型声明',
  );
  const compressedSize = (blocks) =>
    gzipSync(Buffer.concat([...blocks, Buffer.alloc(1024)]), { level: 9 }).length;
  return {
    total: archive.length,
    code: compressedSize(code),
    dictionary: compressedSize(dictionary),
  };
}

export function assertCorePackageSize(archive) {
  const sizes = measureCorePackageSize(archive);
  for (const [section, limit] of Object.entries(CORE_PACKAGE_SIZE_LIMITS)) {
    assertSizeBudget(
      sizes[section],
      limit,
      `核心包${section === 'total' ? '总量' : section === 'code' ? '代码' : '字典'}压缩体积`,
    );
  }
  return sizes;
}
