import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Cloudflare Pages Functions 的限制按未压缩 bundle 字节数计算，MiB 以 1024 为基数。
export const PAGES_FUNCTIONS_BUNDLE_LIMIT_BYTES = 25 * 1024 * 1024;

function collectJavaScriptFiles(inputPath) {
  const files = [];
  const visit = (currentPath) => {
    const stat = fs.lstatSync(currentPath);
    if (stat.isSymbolicLink()) return;
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(currentPath)) {
        visit(path.join(currentPath, entry));
      }
      return;
    }
    if (stat.isFile() && /\.(?:c|m)?js$/u.test(currentPath)) {
      files.push({ path: currentPath, bytes: stat.size });
    }
  };
  visit(inputPath);
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

export function measurePagesFunctionsBundle(inputPath) {
  const resolvedPath = path.resolve(inputPath);
  assert.ok(fs.existsSync(resolvedPath), `Pages Functions bundle 路径不存在：${resolvedPath}`);
  const files = collectJavaScriptFiles(resolvedPath);
  assert.ok(files.length > 0, `Pages Functions bundle 未找到 JavaScript 文件：${resolvedPath}`);
  return {
    bytes: files.reduce((total, file) => total + file.bytes, 0),
    files,
  };
}

export function assertPagesFunctionsBundleSize(bytes, warn = console.warn) {
  assert.ok(Number.isSafeInteger(bytes) && bytes >= 0, 'Pages Functions bundle 体积无效');
  assert.ok(
    bytes <= PAGES_FUNCTIONS_BUNDLE_LIMIT_BYTES,
    `Pages Functions 未压缩 bundle 超过 Cloudflare 25 MiB 限制：${bytes}/${PAGES_FUNCTIONS_BUNDLE_LIMIT_BYTES} 字节`,
  );
  if (bytes >= PAGES_FUNCTIONS_BUNDLE_LIMIT_BYTES * 0.9) {
    warn(
      `Pages Functions 未压缩 bundle 已使用 ${((bytes / PAGES_FUNCTIONS_BUNDLE_LIMIT_BYTES) * 100).toFixed(1)}% 限制：${bytes}/${PAGES_FUNCTIONS_BUNDLE_LIMIT_BYTES} 字节，请保留发布余量。`,
    );
  }
}

export function checkPagesFunctionsBundle(inputPath) {
  const result = measurePagesFunctionsBundle(inputPath);
  assertPagesFunctionsBundleSize(result.bytes);
  return result;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : undefined;
if (invokedPath === import.meta.url) {
  const inputPath = process.argv[2] ?? '.local/pages-functions-build';
  try {
    const result = checkPagesFunctionsBundle(inputPath);
    console.log(
      `Pages Functions 未压缩 bundle：${result.bytes}/${PAGES_FUNCTIONS_BUNDLE_LIMIT_BYTES} 字节（${result.files.length} 个 JavaScript 文件）`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
