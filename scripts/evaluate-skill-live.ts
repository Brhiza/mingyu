import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { SKILL_SCENARIOS } from '../tests/fixtures/skill/scenarios.js';
import { MockProviderRegistry } from '../tests/fixtures/skill/mock-providers.js';
import { evaluateModelOutput } from './evaluate-skill.js';
import {
  SkillScenario,
  ModelExecutionArtifact,
  EvaluationResult,
  ProviderMode,
} from '../tests/fixtures/skill/types.js';

export interface CleanModelInputBundle {
  systemPrompt: string;
  referenceDocs: Record<string, string>;
  userMessage: string;
  confirmedFacts: Record<string, unknown>;
  providerFact: Record<string, unknown> | null;
  sanitizedDigest: string;
}

export interface LiveModelConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  format?: 'chat' | 'gemini';
  timeoutMs?: number;
}

/**
 * 读取环境变量或命令行参数获取在线模型配置
 */
export function resolveLiveModelConfig(): LiveModelConfig {
  const env = process.env;
  const apiKey = env.AI_API_KEY || env.OPENAI_API_KEY || env.GEMINI_API_KEY;
  const baseUrl = env.AI_BASE_URL || env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const model = env.AI_MODEL || env.OPENAI_MODEL || env.GEMINI_MODEL;
  const format = (env.AI_FORMAT as 'chat' | 'gemini') || (env.GEMINI_API_KEY ? 'gemini' : 'chat');

  return {
    apiKey,
    baseUrl,
    model,
    format,
    timeoutMs: 30000,
  };
}

/**
 * 构建严格脱敏的纯净模型输入包：
 * 绝不包含 expectedRoute、requiredChecks、forbiddenLeakage、isBoundary 等任何评测判定元数据！
 */
export function buildCleanModelInputBundle(
  scenario: SkillScenario,
  mode: ProviderMode,
): CleanModelInputBundle {
  const baseDir = join(process.cwd(), 'public/skills/aov-mingyu-api');
  const skillPrompt = readFileSync(join(baseDir, 'SKILL.md'), 'utf8');

  const refNames = [
    'intake.md',
    'routing.md',
    'evidence.md',
    'interpretation.md',
    'timing.md',
    'synthesis.md',
    'output.md',
    'safety.md',
  ];

  const referenceDocs: Record<string, string> = {};
  for (const name of refNames) {
    const fullPath = join(baseDir, 'references', name);
    if (existsSync(fullPath)) {
      referenceDocs[name] = readFileSync(fullPath, 'utf8');
    }
  }

  const providerResp = MockProviderRegistry.execute(scenario, mode);
  const confirmedFacts = { ...scenario.providedFacts };

  // 严格检查：确保不包含隐藏标签
  const forbiddenKeys = [
    'expectedRoute',
    'requiredChecks',
    'forbiddenLeakage',
    'isBoundary',
    'notes',
  ];
  for (const k of forbiddenKeys) {
    if (k in confirmedFacts) {
      delete (confirmedFacts as Record<string, unknown>)[k];
    }
  }

  const hash = createHash('sha256')
    .update(scenario.userMessage + JSON.stringify(confirmedFacts))
    .digest('hex')
    .slice(0, 12);

  return {
    systemPrompt: skillPrompt,
    referenceDocs,
    userMessage: scenario.userMessage,
    confirmedFacts,
    providerFact: providerResp.success ? (providerResp.data ?? null) : null,
    sanitizedDigest: hash,
  };
}

/**
 * 轻量级模型 HTTP 传输器：
 * 支持标准 OpenAI 兼容 Chat Completions 与 Gemini API，代码紧凑、点到为止
 */
export async function callRealModel(
  cleanBundle: CleanModelInputBundle,
  config: LiveModelConfig,
): Promise<{ text: string; durationMs: number }> {
  if (!config.apiKey || !config.model) {
    throw new Error('缺失在线模型凭据或模型名配置');
  }

  const startTime = Date.now();
  const timeout = config.timeoutMs || 30000;

  // 组合输入为提示词
  const userContent = [
    `【本次解读参考资料】\n${Object.entries(cleanBundle.referenceDocs)
      .map(([name, text]) => `【${name}】\n${text}`)
      .join('\n\n')}`,
    `【求测者问题】\n${cleanBundle.userMessage}`,
    `【求测者主动提供的资料】\n${JSON.stringify(cleanBundle.confirmedFacts, null, 2)}`,
    cleanBundle.providerFact
      ? `【脱敏排盘事实数据】\n${JSON.stringify(cleanBundle.providerFact, null, 2)}`
      : '【排盘服务状态】当前排盘计算超时或中断，请优雅降级。',
  ].join('\n\n');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    if (config.format === 'gemini') {
      const endpoint = `${config.baseUrl?.replace(/\/+$/, '')}/models/${config.model}:generateContent?key=${config.apiKey}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: cleanBundle.systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userContent }] }],
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`Gemini API 响应异常: ${res.status} ${await res.text()}`);
      }
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = (data.candidates?.[0]?.content?.parts ?? [])
        .map((part) => part.text ?? '')
        .join('');
      if (!text.trim()) throw new Error('在线模型返回空正文');
      return { text, durationMs: Date.now() - startTime };
    }

    // 默认标准 OpenAI-compatible Chat Completions
    const endpoint = `${config.baseUrl?.replace(/\/+$/, '')}/chat/completions`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: cleanBundle.systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.3,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Chat API 响应异常: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content || '';
    if (typeof text !== 'string' || !text.trim()) throw new Error('在线模型返回空正文');
    return { text, durationMs: Date.now() - startTime };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 执行单场景的双通道评测 runner
 */
export async function runScenarioLive(
  scenario: SkillScenario,
  mode: ProviderMode,
  config: LiveModelConfig,
): Promise<{ artifact: ModelExecutionArtifact; evaluation: EvaluationResult }> {
  const cleanBundle = buildCleanModelInputBundle(scenario, mode);
  const isOnline = Boolean(config.apiKey && config.model);

  let userReply = '';
  let prompt: string | undefined;
  let durationMs = 0;
  let executionError = false;
  const startedAt = Date.now();

  if (isOnline) {
    try {
      const response = await callRealModel(cleanBundle, config);
      userReply = response.text;
      durationMs = response.durationMs;

      // 若模型输出了下游提示词（包含【当前时间】），则提取提示词部分
      if (userReply.includes('【当前时间】')) {
        prompt = userReply.slice(userReply.indexOf('【当前时间】'));
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      executionError = true;
      durationMs = Date.now() - startedAt;
      console.warn(`[Live 请求失败 - 未生成评测答案] ${errorMsg}`);
    }
  } else {
    // 离线基准模式
    const startTime = Date.now();
    const fallback = MockProviderRegistry.generateStandardArtifact(scenario, mode);
    userReply = fallback.userReply;
    prompt = fallback.prompt;
    durationMs = Date.now() - startTime;
  }

  const artifact: ModelExecutionArtifact = {
    userReply,
    prompt,
    identifiedMethods: isOnline ? [] : [...scenario.expectedRoute.primary],
    telemetry: {
      modelName: isOnline ? config.model : 'offline-reference-runner',
      isLiveOnline: isOnline && !executionError,
      docsRead: Object.keys(cleanBundle.referenceDocs),
      docsSent: isOnline ? Object.keys(cleanBundle.referenceDocs) : [],
      referenceChars: Object.values(cleanBundle.referenceDocs).reduce(
        (sum, text) => sum + text.length,
        0,
      ),
      isDegraded: mode === 'unavailable' || executionError,
      providerErrorReceived: mode === 'unavailable' || executionError,
      durationMs,
      requestDigest: cleanBundle.sanitizedDigest,
    },
  };

  // 由独立评测器进行严格 L0—L5 证据评审
  const evaluation = evaluateModelOutput(scenario, artifact, mode);
  if (executionError) {
    evaluation.passed = false;
    evaluation.status = 'fail';
    evaluation.errors.unshift('在线模型调用失败，未生成可评测结果。');
    for (const score of Object.values(evaluation.scoreLevels)) {
      score.passed = false;
      score.status = 'needs_review';
      score.details = '模型调用未完成，缺少可评测正文。';
    }
  }

  return { artifact, evaluation };
}

/**
 * 运行五个重点场景的实战评测，并输出清晰分层的 Live 评测报告
 */
export async function runLiveEvaluation() {
  const config = resolveLiveModelConfig();
  const isOnline = Boolean(config.apiKey && config.model);

  console.log('=== 通用算命 Skill 真实模型接入与可信评测 ===\n');
  if (isOnline) {
    console.log(
      `[在线执行模式] 正在调用真实公网模型: ${config.model} (${config.format || 'chat'})`,
    );
    console.log(`服务地址: ${config.baseUrl?.replace(/\/\/.*@/, '//***@')}`);
  } else {
    console.log('[离线基准演练模式] 未检测到在线模型凭据 (AI_API_KEY/OPENAI_API_KEY)。');
    console.log('当前执行离线高保真推演演练，绝不冒充公网在线模型结果。');
    console.log(
      '提示：若需发起公网模型真实调用，请配置环境变量: AI_API_KEY, AI_MODEL, AI_BASE_URL\n',
    );
  }

  // 五个重点核心场景
  const priorityScenarioIds = [
    'SCENARIO-03-longterm-startup-normal', // 长期创业
    'SCENARIO-05-missing-hour-normal', // 缺出生时辰
    'SCENARIO-13-astrology-transit-normal', // 西占动态周期
    'SCENARIO-15-qimen-lifetime-normal', // 奇门终身局
    'SCENARIO-24-fault-and-safety-boundary', // 服务超时与优雅降级
  ];

  const targetScenarios = SKILL_SCENARIOS.filter((s) => priorityScenarioIds.includes(s.id));

  const liveReportDir = join(process.cwd(), '.local/reports/skill-evaluation/live');
  if (!existsSync(liveReportDir)) {
    mkdirSync(liveReportDir, { recursive: true });
  }

  const liveResults: Array<{
    scenarioId: string;
    title: string;
    mode: ProviderMode;
    telemetry: ModelExecutionArtifact['telemetry'];
    evaluation: EvaluationResult;
    userReplySnippet: string;
    promptSnippet: string;
  }> = [];

  for (const scenario of targetScenarios) {
    for (const mode of scenario.providerModes) {
      const modeLabel = isOnline ? '在线真实调用' : '离线基准演练';
      console.log(`- 评测场景: ${scenario.title} [${mode}] (${modeLabel})...`);
      const { artifact, evaluation } = await runScenarioLive(scenario, mode, config);
      liveResults.push({
        scenarioId: scenario.id,
        title: scenario.title,
        mode,
        telemetry: artifact.telemetry,
        evaluation,
        userReplySnippet: artifact.userReply.slice(0, 120) + '...',
        promptSnippet: artifact.prompt ? artifact.prompt.slice(0, 80) + '...' : '（无）',
      });
    }
  }

  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const reportJson = join(liveReportDir, `live-eval-${timestamp}.json`);
  const reportMd = join(liveReportDir, `live-eval-${timestamp}.md`);
  const latestMd = join(liveReportDir, `latest.md`);

  writeFileSync(reportJson, JSON.stringify(liveResults, null, 2), 'utf8');

  const mdLines = [
    '# 通用算命 Skill 真实模型与可信评测报告',
    '',
    `- 运行环境模式：${isOnline ? `【真实在线模型：${config.model}】` : '【离线高保真基准演练】'}`,
    `- 评测时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`,
    `- 核心场景数：${liveResults.length}`,
    `- 输入内容：用户问题、已提供资料、参考正文与固定排盘样例`,
    `- 判定方式：按文本规则检查资料、路由与输出结构；解读质量需结合完整回答复核`,
    '',
    '## 核心场景双通道评测结果',
    '',
    '| 场景ID | 场景名称 | 提供方模式 | 模型名 | L0 资料 | L1 路由 | L2 证据 | L3 动态 | L4 提示词 | L5 安全 | 最终结果 |',
    '| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |',
  ];

  for (const r of liveResults) {
    const sc = r.evaluation.scoreLevels;
    const modelTag = r.telemetry?.isLiveOnline
      ? r.telemetry.modelName
      : r.telemetry?.modelName === 'offline-reference-runner'
        ? '离线样例'
        : `${r.telemetry?.modelName ?? '在线模型'}（请求失败）`;
    mdLines.push(
      `| ${r.scenarioId} | ${r.title} | ${r.mode} | ${modelTag} | ${sc.l0Intake.passed ? '✔' : '✖'} | ${sc.l1Routing.passed ? '✔' : '✖'} | ${sc.l2Evidence.passed ? '✔' : '✖'} | ${sc.l3DynamicSynthesis.passed ? '✔' : '✖'} | ${sc.l4OutputPrompt.passed ? '✔' : '✖'} | ${sc.l5SafetyPrivacy.passed ? '✔' : '✖'} | ${r.evaluation.passed ? 'PASS' : 'FAIL'} |`,
    );
  }

  mdLines.push('', '## 双通道输出采样与审计摘要', '');

  for (const r of liveResults) {
    mdLines.push(
      `### ${r.title} (${r.scenarioId} / ${r.mode})`,
      `- **执行模型**：${r.telemetry?.modelName || 'offline-reference'} (在线模式: ${r.telemetry?.isLiveOnline ? '是' : '否'})`,
      `- **耗时**：${r.telemetry?.durationMs}ms`,
      `- **请求脱敏摘要哈希**：\`${r.telemetry?.requestDigest}\``,
      `- **读取参考文档**：${r.telemetry?.docsRead?.join(', ')}`,
      `- **用户回答摘录**：${r.userReplySnippet}`,
      `- **下游任务书摘录**：${r.promptSnippet}`,
      '',
    );
  }

  const mdContent = mdLines.join('\n');
  writeFileSync(reportMd, mdContent, 'utf8');
  writeFileSync(latestMd, mdContent, 'utf8');

  console.log(`\n✔ 评测执行完毕！`);
  console.log(`✔ 报告已保存至：${reportMd}`);
  console.log(`✔ 软链最新报告：${latestMd}`);
  if (liveResults.some((result) => !result.evaluation.passed)) process.exitCode = 1;
}

if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('evaluate-skill-live')) {
  runLiveEvaluation().catch((err) => {
    console.error('Live 评测执行失败:', err);
    process.exit(1);
  });
}
