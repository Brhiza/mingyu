import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { sameJsonValue } from '../src/json-value';

type Prompt = { text: string };
type Collection<D> = { data: D; summary: unknown; prompt: Prompt };
type RangeInput = { question: string; currentTime?: string; prompt?: unknown };
type RangeData = { input: object };
type Adapter<I extends RangeInput, D extends RangeData> = {
  method: 'qizheng-range' | 'astrolabe-range';
  parse: (value: unknown) => I;
  calculate: (input: I) => Promise<D>;
  collect: (input: I, fetchPage: (input: I, signal?: AbortSignal) => Promise<D>, options: { onProgress: (completed: number, total: number) => void }) => Promise<Collection<D>>;
  render: (data: D, question: string, options: unknown) => Prompt;
};

/** 本地或远程收集完整范围；追问前按相同输入重算核验。 */
export async function runRangeCli<I extends RangeInput, D extends RangeData>(adapter: Adapter<I, D>) {
  const args = process.argv.slice(2), reprompt = args[0] === '--reprompt';
  const [file, question, endpoint] = reprompt ? [args[1], args[2], args[3]] : [args[0], undefined, args[1]];
  if (!file || (reprompt && !question) || args.length > (reprompt ? 4 : 2)) {
    process.stderr.write(`用法：pnpm ${adapter.method} 输入.json [HTTP计算接口URL] > 结果.json\n追问：pnpm ${adapter.method} --reprompt 结果.json '新问题' [HTTP计算接口URL] > 新结果.json\n`);
    process.exitCode = 1; return;
  }
  try {
    if (endpoint && !['http:', 'https:'].includes(new URL(endpoint).protocol)) throw new Error('HTTP计算接口URL必须使用 http 或 https。');
    const raw: unknown = JSON.parse(await readFile(file, 'utf8'));
    const kind = `${adapter.method}-collection`;
    let previous: { version: string; method: string; kind: string; currentTime: string; data: D; promptOptions?: unknown } | undefined;
    if (reprompt) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('范围结果格式无效。');
      const value = raw as Record<string, unknown>;
      if ((value.version !== '2.0.0' && value.version !== '2-preview') || value.method !== adapter.method || value.kind !== kind || !z.iso.datetime({ offset: true }).safeParse(value.currentTime).success || !value.data || typeof value.data !== 'object' || Array.isArray(value.data) || !('input' in value.data)) throw new Error('范围结果类型或起始资料无效。');
      previous = value as typeof previous;
    }
    const input = adapter.parse(reprompt ? { ...previous!.data.input, question } : raw);
    const currentTime = previous?.currentTime ?? input.currentTime ?? new Date().toISOString();
    const fetchPage = async (page: I, signal?: AbortSignal): Promise<D> => {
      if (!endpoint) return adapter.calculate(page);
      const token = process.env.MINGYU_ACCESS_TOKEN;
      const response = await fetch(endpoint, { method: 'POST', signal, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ method: adapter.method, input: page }) });
      const payload = await response.json() as { data?: D; error?: unknown };
      if (!response.ok || !payload.data) throw new Error(`分页请求失败（HTTP ${response.status}）：${JSON.stringify(payload.error ?? '缺少盘面')}`);
      return payload.data;
    };
    const result = await adapter.collect(input, fetchPage, { onProgress: (completed, total) => { process.stderr.write(`\r已收集 ${completed}/${total} 秒`); } });
    if (previous && !sameJsonValue(previous.data, result.data, 1e-9)) throw new Error('出生范围结果与原始输入不一致。');
    const promptOptions = previous?.promptOptions ?? input.prompt;
    const prompt = reprompt ? adapter.render(result.data, input.question, promptOptions) : result.prompt;
    const output = { version: '2.0.0', method: adapter.method, kind, currentTime,
      data: result.data, summary: result.summary, prompt, ...(promptOptions === undefined ? {} : { promptOptions }) };
    process.stderr.write('\n');
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`\n${error instanceof Error ? error.message : '收集失败'}\n`);
    process.exitCode = 1;
  }
}
