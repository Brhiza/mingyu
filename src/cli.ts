import { readFile, writeFile } from 'node:fs/promises';
import { z, ZodError } from 'zod';
import { calculate, inputSchemas, reprompt, repromptInput, type Method } from './core';
import { getPromptCatalog } from './catalog';
import { enabledMethods } from './mcp';
import { createRepromptInput, methodLabels } from './schema';
import { resolveRepromptPayload, toCompactResult, type CompactableCalculationResult } from './compact';
import { normalizeAgentToolInput } from './tool-input-normalizer';

interface ParsedArgs {
  command?: string;
  positionals: string[];
  flags: Map<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags = new Map<string, string | boolean>();

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--') {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (token === '-h' || token === '--help') {
      flags.set('help', true);
      continue;
    }
    if (token.startsWith('--')) {
      const eq = token.indexOf('=');
      if (eq !== -1) {
        flags.set(token.slice(2, eq), token.slice(eq + 1));
      } else {
        const key = token.slice(2);
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith('-')) {
          flags.set(key, next);
          i++;
        } else {
          flags.set(key, true);
        }
      }
      continue;
    }
    positionals.push(token);
  }

  const [command, ...rest] = positionals;
  return { command, positionals: rest, flags };
}

function flagString(flags: Map<string, string | boolean>, name: string): string | undefined {
  const value = flags.get(name);
  return typeof value === 'string' ? value : undefined;
}

function flagBool(flags: Map<string, string | boolean>, name: string): boolean {
  return flags.get(name) === true || flags.get(name) === 'true';
}

async function readStdinText(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function resolveJsonInput(
  flags: Map<string, string | boolean>,
  positionalJson?: string,
  required = true,
): Promise<unknown> {
  const inputFile = flagString(flags, 'input-file');
  if (inputFile) {
    return JSON.parse(await readFile(inputFile, 'utf8'));
  }
  const inline = flagString(flags, 'input') ?? positionalJson;
  if (inline !== undefined) {
    if (inline === '-') {
      return JSON.parse(await readStdinText());
    }
    return JSON.parse(inline);
  }
  if (flagBool(flags, 'stdin') || !process.stdin.isTTY) {
    const text = (await readStdinText()).trim();
    if (text) return JSON.parse(text);
  }
  if (!required) return undefined;
  throw new Error('缺少 JSON 输入，请使用 --input \'...\'、--input-file <路径> 或标准输入传入。');
}

function assertEnabledMethod(value: string | undefined, enabled: readonly Method[]): Method {
  if (!value) {
    throw new Error('缺少术数方法名（例如 bazi、ziwei、liuyao）。');
  }
  if (!enabled.includes(value as Method)) {
    throw new Error(`术数不存在或未启用：${value}`);
  }
  return value as Method;
}

function printHelp() {
  const text = [
    '命语 V2 本地命令行工具 (mingyu.mjs)',
    '',
    '用法:',
    '  node mingyu.mjs methods',
    '  node mingyu.mjs schema [method]',
    '  node mingyu.mjs prompts [method]',
    '  node mingyu.mjs calculate <method> [--input <json> | --input-file <path>] [--output <path>] [--compact] [--pretty]',
    '  node mingyu.mjs reprompt [method] (--result-file <path> | --token <token> | --token-file <path>) --question <text> [--prompt <json>] [--current-time <iso>] [--output <path>] [--pretty]',
    '',
    '说明:',
    '  - calculate 传入 --compact 时，标准输出仅打印摘要、prompt.text 与 repromptToken（省 Token），同时 --output 仍保存完整盘面文件。',
    '  - calculate 与 reprompt 均支持通过管道（stdin）直接传入 JSON。',
    '  - 可通过环境变量 ENABLED_METHODS=bazi,liuyao 限制开放的方法。',
  ].join('\n');
  process.stdout.write(`${text}\n`);
}

async function emitOutput(stdoutData: unknown, flags: Map<string, string | boolean>, fileData: unknown = stdoutData) {
  const pretty = flagBool(flags, 'pretty');
  const outputPath = flagString(flags, 'output');
  if (outputPath) {
    const fileJson = JSON.stringify(fileData, null, pretty ? 2 : undefined);
    await writeFile(outputPath, `${fileJson}\n`, 'utf8');
  }
  const stdoutJson = JSON.stringify(stdoutData, null, pretty ? 2 : undefined);
  process.stdout.write(`${stdoutJson}\n`);
}

async function main() {
  const { command, positionals, flags } = parseArgs(process.argv.slice(2));
  if (!command || command === 'help' || flagBool(flags, 'help')) {
    printHelp();
    return;
  }

  const enabled = enabledMethods(process.env.ENABLED_METHODS);

  if (command === 'methods') {
    const labels = Object.fromEntries(enabled.map((m) => [m, methodLabels[m]]));
    await emitOutput({ methods: enabled, labels }, flags);
    return;
  }

  if (command === 'schema') {
    const target = flagString(flags, 'method') ?? positionals[0];
    const selected = target ? [assertEnabledMethod(target, enabled)] : [...enabled];
    await emitOutput(
      {
        methods: Object.fromEntries(selected.map((m) => [m, z.toJSONSchema(inputSchemas[m])])),
        reprompt: z.toJSONSchema(createRepromptInput(selected)),
      },
      flags,
    );
    return;
  }

  if (command === 'prompts') {
    const target = flagString(flags, 'method') ?? positionals[0];
    const selected = target ? [assertEnabledMethod(target, enabled)] : [...enabled];
    await emitOutput({ methods: getPromptCatalog(selected) }, flags);
    return;
  }

  if (command === 'calculate') {
    const method = assertEnabledMethod(flagString(flags, 'method') ?? positionals[0], enabled);
    const rawInput = await resolveJsonInput(flags, positionals[1]);
    const input = normalizeAgentToolInput(method, rawInput);
    const result = await calculate(method, input, { enabledMethods: enabled }) as CompactableCalculationResult;
    const stdoutData = flagBool(flags, 'compact') ? await toCompactResult(result) : result;
    await emitOutput(stdoutData, flags, result);
    return;
  }

  if (command === 'reprompt') {
    const resultFile = flagString(flags, 'result-file');
    const resultInline = flagString(flags, 'result');
    const tokenInline = flagString(flags, 'token');
    const tokenFile = flagString(flags, 'token-file');
    let rawPayload: unknown;

    if (tokenInline || tokenFile) {
      const repromptToken = tokenFile ? (await readFile(tokenFile, 'utf8')).trim() : tokenInline!;
      const question = flagString(flags, 'question');
      if (!question) {
        throw new Error('缺少追问问题，请提供 --question "<问题>"。');
      }
      const promptRaw = flagString(flags, 'prompt');
      const currentTime = flagString(flags, 'current-time');
      rawPayload = {
        repromptToken,
        question,
        ...(flagString(flags, 'method') ?? positionals[0] ? { method: flagString(flags, 'method') ?? positionals[0] } : {}),
        ...(promptRaw !== undefined ? { prompt: JSON.parse(promptRaw) } : {}),
        ...(currentTime !== undefined ? { currentTime } : {}),
      };
    } else if (resultFile || resultInline) {
      const savedResult = resultFile
        ? (JSON.parse(await readFile(resultFile, 'utf8')) as Record<string, unknown>)
        : (JSON.parse(resultInline!) as Record<string, unknown>);
      const inferredMethod =
        flagString(flags, 'method') ??
        positionals[0] ??
        (typeof savedResult?.method === 'string' ? savedResult.method : undefined);
      const method = assertEnabledMethod(inferredMethod, enabled);
      const question = flagString(flags, 'question');
      if (!question) {
        throw new Error('缺少追问问题，请提供 --question "<问题>"。');
      }
      const promptRaw = flagString(flags, 'prompt');
      const currentTime = flagString(flags, 'current-time');
      rawPayload = {
        method,
        result: savedResult,
        question,
        ...(promptRaw !== undefined ? { prompt: JSON.parse(promptRaw) } : {}),
        ...(currentTime !== undefined ? { currentTime } : {}),
      };
    } else {
      rawPayload = await resolveJsonInput(flags, positionals[0]);
    }

    const { payload } = await resolveRepromptPayload(rawPayload);
    const parsed = repromptInput.parse(payload);
    if (!enabled.includes(parsed.method)) {
      throw new Error(`术数不存在或未启用：${parsed.method}`);
    }
    const result = await reprompt(parsed, { enabledMethods: enabled });
    await emitOutput(result, flags);
    return;
  }

  throw new Error(`未知命令：${command}。运行 --help 查看可用命令。`);
}

main().catch((error) => {
  const payload =
    error instanceof ZodError
      ? { error: '参数校验失败', issues: error.issues }
      : { error: error instanceof Error ? error.message : String(error) };
  process.stderr.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exitCode = 1;
});
