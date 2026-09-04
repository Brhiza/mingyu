import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const sourceUrl = 'https://www.lamjinlab.com/blog/zgss-full-text';
const outputUrl = new URL('../packages/core/src/name-number/zhuge-signs.ts', import.meta.url);
const response = await fetch(sourceUrl);
if (!response.ok) throw new Error(`下载诸葛神数签文失败：HTTP ${response.status}`);
const html = await response.text();

function decodeHtml(value) {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

const sectionPattern =
  /<h3 id="第-(\d+)-签"[^>]*>.*?<\/h3>\s*<blockquote[^>]*><span>(.*?)<\/span><\/blockquote>\s*<p[^>]*>.*?<strong[^>]*>解一<\/strong><span>：(.*?)<\/span><\/p>\s*<p[^>]*>.*?<strong[^>]*>解二<\/strong><span>：(.*?)<\/span><\/p>/gs;
const signs = [...html.matchAll(sectionPattern)].map((match) => ({
  number: Number(match[1]),
  poem: decodeHtml(match[2]),
  summary: decodeHtml(match[3]),
}));
if (signs.length !== 384 || signs.some((sign, index) => sign.number !== index + 1)) {
  throw new Error(`诸葛神数签文应为连续 384 条，实际解析到 ${signs.length} 条`);
}
const source = `export interface ZhugeSign {\n  number: number;\n  poem: string;\n  summary: string;\n}\n\nexport const ZHUGE_SIGNS: readonly ZhugeSign[] = ${JSON.stringify(signs, null, 2)};\n`;
await writeFile(fileURLToPath(outputUrl), source, 'utf8');
console.log(`已生成 ${signs.length} 条诸葛神数签文：${fileURLToPath(outputUrl)}`);
