// Node.js 22.12+，无需安装依赖。结果保留在变量中，追问不会再次抽牌。
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const base = new URL(process.env.MINGYU_BASE_URL || 'http://127.0.0.1:18788');
if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
  throw new Error('MINGYU_BASE_URL 必须是不含账号、查询参数或片段的 HTTP(S) 地址。');
}
const token = process.env.MINGYU_ACCESS_TOKEN?.trim();
if (token && /\s/.test(token)) throw new Error('MINGYU_ACCESS_TOKEN 不能包含空白字符。');

async function post(path, body) {
  const url = new URL(base);
  url.pathname = `${base.pathname.replace(/\/+$/, '')}${path}`;
  const response = await fetch(url, {
    method: 'POST', redirect: 'error',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`HTTP ${response.status}：${JSON.stringify(result.error)}`);
  return result;
}

export function calculate(method, input) {
  return post('/api/calculate', { method, input });
}

export function reprompt(method, result, question, { currentTime, prompt } = {}) {
  return post('/api/prompt', { method, result, question, ...(currentTime === undefined ? {} : { currentTime }), ...(prompt === undefined ? {} : { prompt }) });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const question = process.argv[2] || '近期工作应注意什么？';
  const followupQuestion = process.argv[3] || '针对这组牌，接下来可以如何行动？';
  const result = await calculate('tarot', { question, tarot: { spread: 'three' } });
  const followup = await reprompt('tarot', result, followupQuestion);
  process.stdout.write(`${JSON.stringify({ result, followup }, null, 2)}\n`);
}
