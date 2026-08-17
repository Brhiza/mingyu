import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createInterface } from 'node:readline/promises';
import { pathToFileURL } from 'node:url';

const repoRoot = process.cwd();
const contestDir = path.join(repoRoot, 'benchmarks', 'fortune-contest');
const contestDataDir = path.join(contestDir, 'data');
const contestResultsDir = path.join(contestDir, 'results');

const systemInstruction =
  '你是命理比赛选择题评测助手。请严格只输出 A/B/C/D 组成的答案字母，不要输出理由或解释。';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith('--')) continue;
    const key = item.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = '';
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function parseModelSpecs(value) {
  if (!value?.trim()) return [];
  const raw = value.trim();

  if (raw.startsWith('[')) {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('models JSON 必须是数组。');
    return parsed.map((item) => {
      if (typeof item === 'string') return { label: item, model: item };
      const model = String(item.model || item.Model || '').trim();
      const label = String(item.label || item.Label || model).trim();
      if (!model) throw new Error('models JSON 中每一项都必须包含 model。');
      return { label, model };
    });
  }

  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const separatorIndex = item.indexOf('=');
      if (separatorIndex === -1) return { label: item, model: item };
      const label = item.slice(0, separatorIndex).trim();
      const model = item.slice(separatorIndex + 1).trim();
      if (!model) throw new Error(`模型配置无效：${item}`);
      return { label: label || model, model };
    });
}

function inferFormat(rawUrl, model, requestedFormat) {
  const explicit = requestedFormat?.trim().toLowerCase();
  if (explicit && explicit !== 'auto') {
    if (!['chat', 'responses', 'claude', 'gemini'].includes(explicit)) {
      throw new Error('format 只能是 auto、chat、responses、claude、gemini。');
    }
    return explicit;
  }

  const url = new URL(rawUrl.trim());
  const hostname = url.hostname.toLowerCase();
  const pathname = url.pathname.toLowerCase();
  const modelName = model.trim().toLowerCase();

  if (hostname.includes('anthropic') || modelName.startsWith('claude')) return 'claude';
  if (
    hostname.includes('generativelanguage.googleapis.com') ||
    hostname.includes('googleapis.com') ||
    pathname.includes(':generatecontent') ||
    modelName.startsWith('gemini')
  ) {
    return 'gemini';
  }
  if (pathname.endsWith('/responses')) return 'responses';
  return 'chat';
}

function normalizeOpenAiStyleUrl(rawUrl, finalSegment) {
  const trimmed = rawUrl.trim().replace(/\/+$/, '');
  if (!trimmed) throw new Error('url 不能为空。');
  if (new RegExp(`/${finalSegment.replace('/', '\\/')}$`, 'i').test(trimmed)) return trimmed;

  const url = new URL(trimmed);
  if (url.hostname === 'api.openai.com' && (url.pathname === '' || url.pathname === '/')) {
    url.pathname = `/v1/${finalSegment}`;
    return url.toString();
  }

  url.pathname = `${url.pathname.replace(/\/+$/, '')}/${finalSegment}`;
  return url.toString();
}

function normalizeClaudeUrl(rawUrl) {
  const trimmed = rawUrl.trim().replace(/\/+$/, '');
  if (!trimmed) throw new Error('url 不能为空。');
  if (/\/messages$/i.test(trimmed)) return trimmed;

  const url = new URL(trimmed);
  if (url.hostname.includes('anthropic.com') && (url.pathname === '' || url.pathname === '/')) {
    url.pathname = '/v1/messages';
    return url.toString();
  }

  url.pathname = `${url.pathname.replace(/\/+$/, '')}/messages`;
  return url.toString();
}

function normalizeGeminiUrl(rawUrl, model) {
  const trimmed = rawUrl.trim().replace(/\/+$/, '');
  if (!trimmed) throw new Error('url 不能为空。');

  const url = new URL(trimmed);
  if (url.pathname.toLowerCase().includes(':generatecontent')) {
    return url.toString();
  }

  const modelSegment = encodeURIComponent(model.trim());
  const pathname = url.pathname.replace(/\/+$/, '');
  if (pathname.endsWith('/models')) {
    url.pathname = `${pathname}/${modelSegment}:generateContent`;
  } else if (/\/models\/[^/]+$/i.test(pathname)) {
    url.pathname = `${pathname}:generateContent`;
  } else {
    url.pathname = `${pathname}/models/${modelSegment}:generateContent`;
  }
  return url.toString();
}

function normalizeEndpoint(rawUrl, format, model) {
  if (format === 'responses') return normalizeOpenAiStyleUrl(rawUrl, 'responses');
  if (format === 'claude') return normalizeClaudeUrl(rawUrl);
  if (format === 'gemini') return normalizeGeminiUrl(rawUrl, model);
  return normalizeOpenAiStyleUrl(rawUrl, 'chat/completions');
}

function stripSensitiveQuery(endpoint) {
  const url = new URL(endpoint);
  if (url.searchParams.has('key')) url.searchParams.set('key', '***');
  return url.toString();
}

function sanitizeFilename(value) {
  return value.replace(/[\\/:*?"<>|\s]+/g, '_').replace(/^_+|_+$/g, '') || 'model';
}

function escapeMarkdownCell(value) {
  return String(value ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\|/g, '\\|')
    .trim();
}

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : String(value);
}

function summarizeNoTextResponse(data, format) {
  const choice = data?.choices?.[0];
  const finishReason =
    choice?.finish_reason || choice?.native_finish_reason || data?.finish_reason || '未知';
  const model = data?.model || '未知模型';
  const hasReasoning =
    Boolean(choice?.message?.reasoning) ||
    Boolean(choice?.message?.reasoning_details) ||
    Boolean(data?.reasoning) ||
    Boolean(data?.reasoning_details);

  return `${format} 接口返回中没有正式答案文本：model=${model}，finish_reason=${finishReason}${
    hasReasoning ? '，返回内容只有 reasoning/思考内容，未产生可评分的 content' : ''
  }。`;
}

export function parseCorrectAnswers(markdown) {
  const answers = new Map();
  const rowPattern = /\|\s*Q(\d+)\s*\|\s*([ABCD])\s*\|/g;
  let match = rowPattern.exec(markdown);
  while (match) {
    answers.set(Number(match[1]), match[2]);
    match = rowPattern.exec(markdown);
  }

  if (answers.size !== 40) {
    throw new Error(`正确答案解析失败：预期 40 题，实际 ${answers.size} 题。`);
  }

  return answers;
}

export function parseModelAnswers(text, startQuestion, endQuestion) {
  const answers = new Map();
  const whitespaceOnlyLetters = text.trim().match(/^(?:[ABCD]\s*){5}$/i);
  if (whitespaceOnlyLetters) {
    const letters = text.toUpperCase().match(/[ABCD]/g) || [];
    for (let offset = 0; offset < letters.length; offset += 1) {
      answers.set(startQuestion + offset, letters[offset]);
    }
    return answers;
  }

  const compact = text
    .trim()
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[a-z]*|```/gi, ''))
    .match(/[ABCD]{5}/i);
  if (compact) {
    const letters = compact[0].toUpperCase().split('');
    for (let offset = 0; offset < letters.length; offset += 1) {
      answers.set(startQuestion + offset, letters[offset]);
    }
    return answers;
  }

  for (let q = startQuestion; q <= endQuestion; q += 1) {
    const patterns = [
      new RegExp(`Q\\s*${q}\\s*[:：.、\\-]?\\s*(?:答案)?\\s*[:：]?\\s*([ABCD])`, 'i'),
      new RegExp(`第\\s*${q}\\s*题[\\s\\S]{0,30}?([ABCD])`, 'i'),
      new RegExp(`(?:^|\\n)\\s*${q}\\s*[.、:：\\-]\\s*([ABCD])`, 'i'),
    ];
    const matched = patterns.map((pattern) => text.match(pattern)).find(Boolean);
    if (matched) answers.set(q, matched[1].toUpperCase());
  }

  const missing = [];
  for (let q = startQuestion; q <= endQuestion; q += 1) {
    if (!answers.has(q)) missing.push(q);
  }

  if (missing.length) {
    const fallbackLetters = Array.from(
      text.matchAll(/(?:^|\n)\s*(?:Q?\d+\s*[:：.、\-]\s*)?([ABCD])(?:\s|$|[.。-])/gi),
      (match) => match[1].toUpperCase(),
    );
    const expectedCount = endQuestion - startQuestion + 1;
    if (fallbackLetters.length >= expectedCount) {
      for (let offset = 0; offset < expectedCount; offset += 1) {
        const q = startQuestion + offset;
        if (!answers.has(q)) answers.set(q, fallbackLetters[offset]);
      }
    }
  }

  return answers;
}

export function assertCompleteAnswers(modelAnswers, startQuestion, endQuestion, content) {
  const missing = [];
  for (let q = startQuestion; q <= endQuestion; q += 1) {
    if (!modelAnswers.has(q)) missing.push(q);
  }

  if (missing.length) {
    const preview = content.trim().replace(/\s+/g, ' ').slice(0, 160);
    throw new Error(
      `答案解析失败：Q${startQuestion}-Q${endQuestion} 需要 5 个答案，缺少 Q${missing.join('、Q')}。原始输出预览：${preview}`,
    );
  }
}

async function askForConfig(args) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const hasArg = (key) => Object.prototype.hasOwnProperty.call(args, key);
    const url = hasArg('url')
      ? args.url
      : process.env.MODEL_BASE_URL ||
        (await rl.question('请输入 OpenAI 兼容接口 URL（例如 https://api.openai.com/v1）：'));
    const key = hasArg('key')
      ? args.key
      : process.env.MODEL_API_KEY ||
        process.env.OPENAI_API_KEY ||
        (await rl.question('请输入 API Key：'));
    const model = hasArg('model')
      ? args.model
      : process.env.MODEL_NAME || (await rl.question('请输入模型名称（例如 gpt-4.1-mini）：'));
    const rawFormat = hasArg('format') ? args.format : process.env.MODEL_FORMAT || 'auto';
    const format = inferFormat(url, model, rawFormat);
    const endpoint = normalizeEndpoint(url, format, model);

    return {
      endpoint,
      displayEndpoint: stripSensitiveQuery(endpoint),
      format,
      key: key.trim(),
      model: model.trim(),
      temperature: Number(args.temperature ?? process.env.MODEL_TEMPERATURE ?? 0),
      maxTokens: Number(args.maxTokens ?? process.env.MODEL_MAX_TOKENS ?? 4096),
      reasoningEffort: args.reasoningEffort ?? process.env.MODEL_REASONING_EFFORT ?? '',
      reasoningMaxTokens: args.reasoningMaxTokens ?? process.env.MODEL_REASONING_MAX_TOKENS ?? '',
      excludeReasoning:
        Object.prototype.hasOwnProperty.call(args, 'excludeReasoning') ||
        process.env.MODEL_EXCLUDE_REASONING === '1',
      concurrency: Math.max(1, Number(args.concurrency ?? process.env.MODEL_CONCURRENCY ?? 1)),
      caseConcurrency: Math.max(
        1,
        Number(args.caseConcurrency ?? process.env.MODEL_CASE_CONCURRENCY ?? 1),
      ),
    };
  } finally {
    rl.close();
  }
}

async function askForBatchConfig(args, modelSpecs) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const hasArg = (key) => Object.prototype.hasOwnProperty.call(args, key);
    const url = hasArg('url')
      ? args.url
      : process.env.MODEL_BASE_URL ||
        (await rl.question('请输入接口 URL（例如 https://openrouter.ai/api/v1）：'));
    const key = hasArg('key')
      ? args.key
      : process.env.MODEL_API_KEY ||
        process.env.OPENAI_API_KEY ||
        (await rl.question('请输入 API Key：'));
    const rawFormat = hasArg('format') ? args.format : process.env.MODEL_FORMAT || 'auto';

    return {
      url: url.trim(),
      key: key.trim(),
      rawFormat,
      modelSpecs,
      temperature: Number(args.temperature ?? process.env.MODEL_TEMPERATURE ?? 0),
      maxTokens: Number(args.maxTokens ?? process.env.MODEL_MAX_TOKENS ?? 4096),
      reasoningEffort: args.reasoningEffort ?? process.env.MODEL_REASONING_EFFORT ?? '',
      reasoningMaxTokens: args.reasoningMaxTokens ?? process.env.MODEL_REASONING_MAX_TOKENS ?? '',
      excludeReasoning:
        Object.prototype.hasOwnProperty.call(args, 'excludeReasoning') ||
        process.env.MODEL_EXCLUDE_REASONING === '1',
      concurrency: Math.max(1, Number(args.concurrency ?? process.env.MODEL_CONCURRENCY ?? 3)),
      caseConcurrency: Math.max(
        1,
        Number(args.caseConcurrency ?? process.env.MODEL_CASE_CONCURRENCY ?? 1),
      ),
    };
  } finally {
    rl.close();
  }
}

function buildConfigForModel(batchConfig, model) {
  const format = inferFormat(batchConfig.url, model, batchConfig.rawFormat);
  const endpoint = normalizeEndpoint(batchConfig.url, format, model);
  return {
    endpoint,
    displayEndpoint: stripSensitiveQuery(endpoint),
    format,
    key: batchConfig.key,
    model,
    temperature: batchConfig.temperature,
    maxTokens: batchConfig.maxTokens,
    reasoningEffort: batchConfig.reasoningEffort,
    reasoningMaxTokens: batchConfig.reasoningMaxTokens,
    excludeReasoning: batchConfig.excludeReasoning,
    concurrency: batchConfig.concurrency,
    caseConcurrency: batchConfig.caseConcurrency,
  };
}

function buildUserPrompt(prompt) {
  return prompt;
}

function readTextFromContentParts(parts) {
  if (!Array.isArray(parts)) return '';
  return parts
    .map((part) => {
      if (typeof part === 'string') return part;
      if (typeof part?.text === 'string') return part.text;
      if (typeof part?.content === 'string') return part.content;
      return '';
    })
    .filter(Boolean)
    .join('\n')
    .trim();
}

async function readJsonResponse(response, format) {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${format} 接口请求失败：HTTP ${response.status}\n${text}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${format} 接口返回不是合法 JSON：\n${text}`);
  }
}

async function callChatModel(config, prompt) {
  const { endpoint, key, model, temperature, maxTokens } = config;
  const requestBody = {
    model,
    temperature,
    max_tokens: maxTokens,
    messages: [
      {
        role: 'system',
        content: systemInstruction,
      },
      {
        role: 'user',
        content: buildUserPrompt(prompt),
      },
    ],
  };

  if (config.reasoningEffort || config.reasoningMaxTokens || config.excludeReasoning) {
    requestBody.reasoning = {};
    if (config.reasoningEffort) requestBody.reasoning.effort = config.reasoningEffort;
    if (config.reasoningMaxTokens) {
      requestBody.reasoning.max_tokens = Number(config.reasoningMaxTokens);
    }
    if (config.excludeReasoning) {
      requestBody.reasoning.exclude = true;
      requestBody.include_reasoning = false;
    }
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  const data = await readJsonResponse(response, 'chat');
  const content = data?.choices?.[0]?.message?.content;
  const textContent = typeof content === 'string' ? content : readTextFromContentParts(content);
  if (!textContent) {
    throw new Error(summarizeNoTextResponse(data, 'chat'));
  }
  return textContent.trim();
}

async function callResponsesModel({ endpoint, key, model, temperature, maxTokens }, prompt) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature,
      max_output_tokens: maxTokens,
      instructions: systemInstruction,
      input: buildUserPrompt(prompt),
    }),
  });

  const data = await readJsonResponse(response, 'responses');
  if (typeof data?.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const outputText = Array.isArray(data?.output)
    ? data.output
        .flatMap((item) => item?.content ?? [])
        .map((part) => part?.text || part?.content || '')
        .filter(Boolean)
        .join('\n')
        .trim()
    : '';

  if (!outputText) {
    throw new Error(summarizeNoTextResponse(data, 'responses'));
  }
  return outputText;
}

async function callClaudeModel({ endpoint, key, model, temperature, maxTokens }, prompt) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: maxTokens,
      system: systemInstruction,
      messages: [{ role: 'user', content: buildUserPrompt(prompt) }],
    }),
  });

  const data = await readJsonResponse(response, 'claude');
  const content = readTextFromContentParts(data?.content);
  if (!content) {
    throw new Error(summarizeNoTextResponse(data, 'claude'));
  }
  return content;
}

async function callGeminiModel({ endpoint, key, temperature, maxTokens }, prompt) {
  const url = new URL(endpoint);
  if (key && !url.searchParams.has('key')) {
    url.searchParams.set('key', key);
  }

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: buildUserPrompt(prompt) }],
        },
      ],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    }),
  });

  const data = await readJsonResponse(response, 'gemini');
  const content = readTextFromContentParts(data?.candidates?.[0]?.content?.parts);
  if (!content) {
    throw new Error(summarizeNoTextResponse(data, 'gemini'));
  }
  return content;
}

async function callModel(config, prompt) {
  if (config.format === 'responses') return callResponsesModel(config, prompt);
  if (config.format === 'claude') return callClaudeModel(config, prompt);
  if (config.format === 'gemini') return callGeminiModel(config, prompt);
  return callChatModel(config, prompt);
}

async function runWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await worker(items[currentIndex], currentIndex);
      }
    }),
  );
  return results;
}

function normalizeLegacyCases(dataset) {
  const caseMap = new Map();

  for (const question of dataset.questions || []) {
    const globalNumber = Number(question.question_number);
    const year = 2022 + Math.floor((globalNumber - 1) / 40);
    const number = Number(question.original_number);
    const caseNumber = Math.floor((number - 1) / 5) + 1;
    const caseKey = String(year) + '-case-' + String(caseNumber);
    const item = caseMap.get(caseKey) || {
      id: caseKey,
      year,
      caseNumber,
      birthInfo: String(question.birth_info?.raw || '').trim(),
      questions: [],
    };

    item.questions.push({
      key: String(year) + '-Q' + String(number),
      number,
      category: String(question.category || '未分类').trim(),
      text: String(question.question || '').trim(),
      options: (question.options || []).map((option) => String(option.text || '').trim()),
      answer: String(question.answer || '')
        .trim()
        .toUpperCase(),
    });
    caseMap.set(caseKey, item);
  }

  return [...caseMap.values()];
}

function normalizeCurrentCases(dataset) {
  return (dataset.cases || []).map((item, index) => ({
    id: String(item.id || String(dataset.year) + '-case-' + String(index + 1)),
    year: Number(dataset.year),
    caseNumber: index + 1,
    birthInfo: String(item.birthInfo || '').trim(),
    questions: (item.questions || []).map((question) => ({
      key: String(dataset.year) + '-Q' + String(question.number),
      number: Number(question.number),
      category: String(question.category || '未分类').trim(),
      text: String(question.text || '').trim(),
      options: (question.options || []).map((option) => String(option).trim()),
      answer: String(question.answer || '')
        .trim()
        .toUpperCase(),
    })),
  }));
}

function validateContestCases(cases) {
  const questionKeys = new Set();
  const yearCounts = new Map();

  for (const item of cases) {
    if (!item.birthInfo) throw new Error(item.id + ' 缺少出生资料。');
    if (!item.questions.length) throw new Error(item.id + ' 没有题目。');

    for (const question of item.questions) {
      if (questionKeys.has(question.key)) throw new Error('题号重复：' + question.key + '。');
      questionKeys.add(question.key);
      yearCounts.set(item.year, (yearCounts.get(item.year) || 0) + 1);
      if (!question.text) throw new Error(question.key + ' 缺少题干。');
      if (question.options.length !== 4 || question.options.some((option) => !option)) {
        throw new Error(question.key + ' 必须包含四个非空选项。');
      }
      if (!/^[ABCD]$/.test(question.answer)) {
        throw new Error(question.key + ' 的正确答案无效。');
      }
    }
  }

  for (const [year, count] of yearCounts) {
    if (count !== 40)
      throw new Error(
        String(year) + ' 年题目数量异常：预期 40 题，实际 ' + String(count) + ' 题。',
      );
  }
}

function parseSelectedYears(rawValue, availableYears) {
  const value = String(rawValue || 'latest')
    .trim()
    .toLowerCase();
  if (value === 'all') return availableYears;
  if (value === 'latest') return [availableYears.at(-1)];

  const years = [
    ...new Set(
      value
        .split(',')
        .map((item) => Number(item.trim()))
        .filter(Number.isInteger),
    ),
  ].sort((a, b) => a - b);
  if (!years.length) throw new Error('year/years 必须是年份、逗号分隔年份、latest 或 all。');

  const unavailable = years.filter((year) => !availableYears.includes(year));
  if (unavailable.length) {
    throw new Error(
      '暂不支持年份：' + unavailable.join('、') + '。可用年份：' + availableYears.join('、') + '。',
    );
  }
  return years;
}

function formatYearLabel(years) {
  const isContinuous = years.every((year, index) => index === 0 || year === years[index - 1] + 1);
  if (years.length > 2 && isContinuous) return String(years[0]) + '—' + String(years.at(-1));
  return years.join('、');
}

export async function loadContestData(args = {}) {
  const legacy = JSON.parse(await readFile(path.join(contestDataDir, '2022-2025.json'), 'utf8'));
  const current = JSON.parse(await readFile(path.join(contestDataDir, '2026.json'), 'utf8'));
  const allCases = [...normalizeLegacyCases(legacy), ...normalizeCurrentCases(current)].sort(
    (a, b) => a.year - b.year || a.caseNumber - b.caseNumber,
  );
  validateContestCases(allCases);

  const availableYears = [...new Set(allCases.map((item) => item.year))].sort((a, b) => a - b);
  const years = parseSelectedYears(args.years || args.year, availableYears);
  const allCategories = [
    ...new Set(allCases.flatMap((item) => item.questions.map((question) => question.category))),
  ].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  const categoryValue = String(args.categories || args.category || '').trim();
  const categories = categoryValue
    ? [
        ...new Set(
          categoryValue
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      ]
    : [];
  const unknownCategories = categories.filter((category) => !allCategories.includes(category));
  if (unknownCategories.length) {
    throw new Error(
      '未知类别：' +
        unknownCategories.join('、') +
        '。可用类别：' +
        allCategories.join('、') +
        '。',
    );
  }

  const yearSet = new Set(years);
  const categorySet = new Set(categories);
  const cases = allCases
    .filter((item) => yearSet.has(item.year))
    .map((item) => ({
      ...item,
      questions: item.questions.filter(
        (question) => !categorySet.size || categorySet.has(question.category),
      ),
    }))
    .filter((item) => item.questions.length);
  const totalQuestions = cases.reduce((total, item) => total + item.questions.length, 0);
  if (!totalQuestions) throw new Error('当前筛选条件没有可评测题目。');

  const yearLabel = formatYearLabel(years);
  const categoryLabel = categories.length ? categories.join('、') : '全部类别';
  return {
    availableYears,
    allCategories,
    years,
    categories,
    cases,
    totalQuestions,
    signature:
      'years=' +
      years.join(',') +
      ';categories=' +
      (categories.length ? categories.slice().sort().join(',') : 'all'),
    title: yearLabel + ' 年全球算命师大赛模型评测',
    description: yearLabel + ' 年，' + categoryLabel + '，共 ' + String(totalQuestions) + ' 题',
  };
}

export function buildContestPrompt(item) {
  const questionLines = item.questions.flatMap((question) => [
    'Q' + String(question.number) + '：' + question.text,
    ...question.options.map((option, index) => String.fromCharCode(65 + index) + '. ' + option),
    '',
  ]);
  const answerCount = item.questions.length;
  const example = 'ABCDA'.repeat(Math.ceil(answerCount / 5)).slice(0, answerCount);

  return [
    '【任务】',
    '请根据命例资料回答以下选择题。',
    '',
    '【命例资料】',
    item.birthInfo,
    '',
    '【题目】',
    ...questionLines,
    '【输出要求】',
    '按题目出现顺序，只输出 ' +
      String(answerCount) +
      ' 个大写字母；每题只能从 A、B、C、D 中选择一个。',
    '输出示例：' + example,
  ].join('\n');
}

function buildCaseScore(item, modelAnswers) {
  return item.questions.map((question, index) => {
    const actual = modelAnswers.get(index + 1) || '';
    return {
      key: question.key,
      year: item.year,
      question: question.number,
      category: question.category,
      expected: question.answer,
      actual,
      ok: actual === question.answer,
    };
  });
}

function formatCaseAnswers(rows) {
  return rows.map((row) => row.actual || '?').join('');
}

function buildReport({
  model,
  endpoint,
  format,
  startedAt,
  finishedAt,
  dataset,
  caseResults,
  rawOutputs,
}) {
  const allRows = caseResults.flatMap((item) => item.rows);
  const correctCount = allRows.filter((row) => row.ok).length;
  const totalCount = allRows.length;
  const totalScore = Number(((correctCount / totalCount) * 100).toFixed(1));
  const accuracy = String(totalScore) + '%';

  const lines = [
    '# 评测结果：' + model,
    '',
    '- 数据范围：' + dataset.description,
    '- 接口格式：' + format,
    '- 接口：' + endpoint,
    '- 开始时间：' + startedAt,
    '- 完成时间：' + finishedAt,
    '- 总分：' + String(totalScore) + '/100',
    '- 准确率：' + accuracy + '（' + String(correctCount) + '/' + String(totalCount) + '）',
    '',
    '## 分命例得分',
    '',
    '| 命例 | 模型答案 | 正确题数 | 得分 | 准确率 |',
    '| --- | --- | --- | --- | --- |',
    ...caseResults.map((item) => {
      const caseCorrectCount = item.rows.filter((row) => row.ok).length;
      const caseScore = Number(((caseCorrectCount / item.rows.length) * 100).toFixed(1));
      return (
        '| ' +
        item.label +
        ' | ' +
        formatCaseAnswers(item.rows) +
        ' | ' +
        String(caseCorrectCount) +
        '/' +
        String(item.rows.length) +
        ' | ' +
        String(caseScore) +
        '/100 | ' +
        String(caseScore) +
        '% |'
      );
    }),
    '',
    '## 逐题明细',
    '',
    '| 题号 | 类别 | 标准答案 | 模型答案 | 结果 |',
    '| --- | --- | --- | --- | --- |',
    ...allRows.map(
      (row) =>
        '| ' +
        row.key +
        ' | ' +
        row.category +
        ' | ' +
        row.expected +
        ' | ' +
        (row.actual || '未解析') +
        ' | ' +
        (row.ok ? '正确' : '错误') +
        ' |',
    ),
    '',
    '## 原始输出',
    '',
    ...rawOutputs.flatMap((item) => ['### ' + item.label, '', '~~~text', item.content, '~~~', '']),
  ];

  return { totalScore, accuracy, correctCount, totalCount, markdown: lines.join('\n') };
}

async function evaluateModel(config, dataset) {
  const startedAt = new Date().toLocaleString('zh-CN');

  console.log('开始评测：' + config.model);
  console.log('数据范围：' + dataset.description);
  console.log('接口格式：' + config.format);
  console.log('接口：' + config.displayEndpoint);

  const evaluatedCases = await runWithConcurrency(
    dataset.cases,
    config.caseConcurrency,
    async (item) => {
      const label = String(item.year) + '-命例' + String(item.caseNumber);
      const questionNumbers = item.questions.map((question) => question.number);
      console.log(
        '正在测试 ' + config.model + ' ' + label + '（Q' + questionNumbers.join('、Q') + '）...',
      );
      const content = await callModel(config, buildContestPrompt(item));
      const modelAnswers = parseModelAnswers(content, 1, item.questions.length);
      assertCompleteAnswers(modelAnswers, 1, item.questions.length, content);
      const rows = buildCaseScore(item, modelAnswers);
      const correctCount = rows.filter((row) => row.ok).length;
      const caseScore = Number(((correctCount / rows.length) * 100).toFixed(1));

      console.log(
        config.model +
          ' ' +
          label +
          '：' +
          formatCaseAnswers(rows) +
          '，得分 ' +
          String(caseScore) +
          '/100，准确率 ' +
          String(caseScore) +
          '%（' +
          String(correctCount) +
          '/' +
          String(rows.length) +
          '）',
      );
      return { year: item.year, caseNumber: item.caseNumber, label, rows, content };
    },
  );

  const orderedCases = evaluatedCases.sort(
    (a, b) => a.year - b.year || a.caseNumber - b.caseNumber,
  );
  const caseResults = orderedCases.map((item) => ({ label: item.label, rows: item.rows }));
  const rawOutputs = orderedCases.map((item) => ({ label: item.label, content: item.content }));
  const finishedAt = new Date().toLocaleString('zh-CN');
  const report = buildReport({
    model: config.model,
    endpoint: config.displayEndpoint,
    format: config.format,
    startedAt,
    finishedAt,
    dataset,
    caseResults,
    rawOutputs,
  });

  await mkdir(contestResultsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportFile = path.join(
    contestResultsDir,
    timestamp + '_' + sanitizeFilename(config.model) + '.md',
  );
  await writeFile(reportFile, report.markdown, 'utf8');

  return { report, reportFile };
}

export function buildRankingReport({ endpoint, startedAt, finishedAt, dataset, results }) {
  const successful = results
    .filter((item) => item.Status === '成功')
    .sort(
      (a, b) =>
        b.Score - a.Score || b.Correct - a.Correct || a.Label.localeCompare(b.Label, 'zh-CN'),
    );
  const failed = results
    .filter((item) => item.Status !== '成功')
    .sort((a, b) => a.Label.localeCompare(b.Label, 'zh-CN'));

  const lines = [
    '# ' + dataset.title,
    '',
    '- 数据范围：' + dataset.description,
    '- 接口：' + endpoint,
    '- 开始时间：' + startedAt,
    '- 完成时间：' + finishedAt,
    '- 计分方式：' + String(dataset.totalQuestions) + ' 题选择题，按正确率折算为 100 分制',
    '- 输出约束：每个命例只要求模型按题目顺序输出 A/B/C/D 答案字母，不要求理由',
    '- 说明：失败模型不参与有效排名，错误信息保留在备注。',
    '',
    '## 排名',
    '',
    '| 排名 | 模型简称 | 模型 ID | 状态 | 总分 | 准确率 | 正确题数 | 单模型报告 | 备注 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];

  successful.forEach((item, index) => {
    const reportLink = item.ReportFile
      ? '[' +
        path.basename(item.ReportFile) +
        '](' +
        path.relative(repoRoot, item.ReportFile).replace(/\\/g, '/') +
        ')'
      : '-';
    lines.push(
      '| ' +
        String(index + 1) +
        ' | ' +
        escapeMarkdownCell(item.Label) +
        ' | ' +
        escapeMarkdownCell(item.Model) +
        ' | 成功 | ' +
        formatNumber(item.Score) +
        '/100 | ' +
        formatNumber(item.Accuracy) +
        '% | ' +
        String(item.Correct) +
        '/' +
        String(item.Total) +
        ' | ' +
        reportLink +
        ' |  |',
    );
  });

  failed.forEach((item) => {
    const note = escapeMarkdownCell(item.Error || '评测失败').slice(0, 160);
    lines.push(
      '| - | ' +
        escapeMarkdownCell(item.Label) +
        ' | ' +
        escapeMarkdownCell(item.Model) +
        ' | 失败 | - | - | - | - | ' +
        note +
        (note.length >= 160 ? '...' : '') +
        ' |',
    );
  });

  lines.push(
    '',
    '## 快速结论',
    '',
    successful.length
      ? '本轮有效排名第一名为 ' +
          successful[0].Label +
          '，总分 ' +
          formatNumber(successful[0].Score) +
          '/100，准确率 ' +
          formatNumber(successful[0].Accuracy) +
          '%。'
      : '本轮没有成功完成的模型。',
    failed.length
      ? '未完成模型：' + failed.map((item) => item.Label).join('、') + '。'
      : '所有模型均完成评测。',
    '',
  );
  return lines.join('\n');
}

function parseReportRows(markdown) {
  return [
    ...markdown.matchAll(
      /\|\s*(?:(\d{4})-)?Q(\d+)\s*\|(?:\s*[^|]+\s*\|)?\s*([ABCD])\s*\|\s*([^|]+?)\s*\|\s*(正确|错误)\s*\|/g,
    ),
  ].map((match) => ({
    year: match[1] ? Number(match[1]) : undefined,
    question: Number(match[2]),
    expected: match[3],
    actual: match[4].trim(),
    ok: match[5] === '正确',
  }));
}

function buildFailedExistingResult(item, error) {
  return {
    ...item,
    Status: '失败',
    Score: null,
    Accuracy: null,
    Correct: null,
    Total: null,
    ReportFile: null,
    Error: '历史评测结果自检失败：' + error,
  };
}

export function validateExistingRankingResultFromMarkdown(item, markdown, options = {}) {
  if (item?.Status !== '成功') return item;
  const rows = parseReportRows(markdown);
  const expectedTotal = Number(options.expectedTotal || item.Total || 40);
  if (rows.length !== expectedTotal) {
    return buildFailedExistingResult(
      item,
      '逐题明细应为 ' + String(expectedTotal) + ' 题，实际 ' + String(rows.length) + ' 题。',
    );
  }

  const invalidRows = rows.filter((row) => !/^[ABCD]$/.test(row.actual));
  if (invalidRows.length) {
    return buildFailedExistingResult(
      item,
      '存在未解析或非法答案：' +
        invalidRows
          .map((row) => 'Q' + String(row.question) + '=' + (row.actual || '空'))
          .join('、') +
        '。',
    );
  }

  const correctCount = rows.filter((row) => row.actual === row.expected).length;
  const totalCount = rows.length;
  const totalScore = Number(((correctCount / totalCount) * 100).toFixed(1));
  return {
    ...item,
    Score: totalScore,
    Accuracy: totalScore,
    Correct: correctCount,
    Total: totalCount,
    Error: '',
  };
}

async function validateExistingRankingResult(item, expectedTotal) {
  if (item?.Status !== '成功') return item;
  const reportFile = String(item.ReportFile || '').trim();
  if (!reportFile) return buildFailedExistingResult(item, '缺少单模型报告文件。');

  try {
    const markdown = await readFile(reportFile, 'utf8');
    return validateExistingRankingResultFromMarkdown(item, markdown, { expectedTotal });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return buildFailedExistingResult(item, '无法读取单模型报告：' + message);
  }
}

async function readExistingRankingResults(dataset) {
  const file = path.join(contestResultsDir, '本次排名原始结果.json');
  try {
    const results = JSON.parse(await readFile(file, 'utf8'));
    if (!Array.isArray(results)) return [];
    const matching = results.filter((item) => item.DatasetSignature === dataset.signature);
    return Promise.all(
      matching.map((item) => validateExistingRankingResult(item, dataset.totalQuestions)),
    );
  } catch {
    return [];
  }
}

async function writeRankingResults(results, startedAt, finishedAt, endpoint, dataset) {
  await mkdir(contestResultsDir, { recursive: true });
  const rawResultsFile = path.join(contestResultsDir, '本次排名原始结果.json');
  const rankingFile = path.join(contestResultsDir, '模型评测排名报告.md');
  await writeFile(rawResultsFile, JSON.stringify(results, null, 2) + '\n', 'utf8');
  await writeFile(
    rankingFile,
    buildRankingReport({ endpoint, startedAt, finishedAt, dataset, results }),
    'utf8',
  );
}

async function runSingle(args) {
  const dataset = await loadContestData(args);
  const config = await askForConfig(args);
  if (!config.key) throw new Error('API Key 不能为空。');
  if (!config.model) throw new Error('model 不能为空。');

  const { report, reportFile } = await evaluateModel(config, dataset);
  console.log('');
  console.log('总分：' + String(report.totalScore) + '/100');
  console.log(
    '准确率：' +
      report.accuracy +
      '（' +
      String(report.correctCount) +
      '/' +
      String(report.totalCount) +
      '）',
  );
  console.log('评测报告已保存：' + reportFile);
}

async function runBatch(args, modelSpecs) {
  const dataset = await loadContestData(args);
  const batchConfig = await askForBatchConfig(args, modelSpecs);
  if (!batchConfig.key) throw new Error('API Key 不能为空。');
  if (!batchConfig.modelSpecs.length) throw new Error('models 不能为空。');

  const startedAt = new Date().toLocaleString('zh-CN');
  const existingResults = await readExistingRankingResults(dataset);
  const resultByModel = new Map(existingResults.map((item) => [item.Model, item]));
  console.log(
    '开始批量评测：' +
      String(batchConfig.modelSpecs.length) +
      ' 个模型，并发 ' +
      String(batchConfig.concurrency),
  );
  console.log('数据范围：' + dataset.description);
  console.log('每个模型命例并发：' + String(batchConfig.caseConcurrency));

  const batchResults = await runWithConcurrency(
    batchConfig.modelSpecs,
    batchConfig.concurrency,
    async (spec) => {
      const config = buildConfigForModel(batchConfig, spec.model);
      try {
        const { report, reportFile } = await evaluateModel(config, dataset);
        return {
          Label: spec.label,
          Model: spec.model,
          DatasetSignature: dataset.signature,
          Status: '成功',
          Score: report.totalScore,
          Accuracy: report.totalScore,
          Correct: report.correctCount,
          Total: report.totalCount,
          ReportFile: reportFile,
          Error: '',
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(spec.label + ' 评测失败：' + message);
        return {
          Label: spec.label,
          Model: spec.model,
          DatasetSignature: dataset.signature,
          Status: '失败',
          Score: null,
          Accuracy: null,
          Correct: null,
          Total: dataset.totalQuestions,
          ReportFile: null,
          Error: message,
        };
      }
    },
  );

  for (const result of batchResults) resultByModel.set(result.Model, result);
  const modelOrder = [
    ...existingResults.map((item) => item.Model),
    ...batchConfig.modelSpecs.map((item) => item.model),
  ];
  const uniqueOrder = [...new Set(modelOrder)];
  const mergedResults = uniqueOrder.map((model) => resultByModel.get(model)).filter(Boolean);
  const finishedAt = new Date().toLocaleString('zh-CN');
  const firstConfig = buildConfigForModel(batchConfig, batchConfig.modelSpecs[0].model);
  await writeRankingResults(
    mergedResults,
    startedAt,
    finishedAt,
    firstConfig.displayEndpoint,
    dataset,
  );

  const successful = batchResults.filter((item) => item.Status === '成功');
  console.log('');
  console.log(
    '批量评测完成：成功 ' + String(successful.length) + '/' + String(batchResults.length),
  );
  console.log('排名报告已更新：' + path.join(contestResultsDir, '模型评测排名报告.md'));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const modelSpecs = parseModelSpecs(args.models || '');
  if (modelSpecs.length) {
    await runBatch(args, modelSpecs);
  } else {
    await runSingle(args);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
