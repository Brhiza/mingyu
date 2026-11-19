import { z } from 'zod';
import {
  streamAgentCompletion,
  type AgentApiMessage,
  type AgentToolCall,
  type AgentToolDefinition,
  type AiConfig,
} from './ai';
import { getPromptCatalog } from './catalog';
import { resolveRepromptPayload, toCompactResult, unpackRepromptToken, type CompactableCalculationResult } from './compact';
import { calculate, inputSchemas, reprompt, repromptInput, type Method } from './core';
import { methodIds, methodLabels } from './schema';
import {
  BIRTH_TIME_OPTIONS,
  getActiveCaseId,
  loadPersonalCases,
  toV2BirthPayload,
  type PersonalCase,
} from './v2-ui/cases-store';
import {
  buildPersonalChartPayload,
  isPersonalChartMethod,
  type PersonalChartTabId,
} from './v2-ui/result-page';
import { readWebAiConfig } from './web-ai';
import { webExamples } from './web-examples';
import { formatInputError } from './input-error';
import { applyGlobalRulesToPayload, loadGlobalRules } from './web-settings';

export const AGENT_SESSIONS_STORAGE_KEY = 'mingyu.v2.agent.sessions';
export const AGENT_ACTIVE_SESSION_KEY = 'mingyu.v2.agent.activeSessionId';
const MAX_STORED_SESSIONS = 25;
const MAX_TOOL_ROUNDS = 8;

export const AGENT_METHOD_CATEGORIES: ReadonlyArray<{
  id: string;
  label: string;
  methods: readonly Method[];
}> = [
  { id: 'mingli', label: '命理合参', methods: ['bazi', 'bazi-synastry', 'bazi-ziwei', 'bazi-reverse', 'minglu', 'fortune', 'instant'] },
  { id: 'ziwei-astro', label: '紫微星象', methods: ['ziwei', 'ziwei-synastry', 'qizheng', 'qizheng-range', 'astrolabe', 'astrolabe-range', 'astrolabe-synastry'] },
  { id: 'qimen-liuren', label: '奇门六壬', methods: ['qimen', 'qimen-lifetime', 'liuren', 'jinkoujue', 'xiaoliuren', 'taiyi'] },
  { id: 'divination', label: '占卜灵签', methods: ['liuyao', 'meihua', 'tarot', 'lenormand', 'random-divination', 'ssgw', 'zhuge', 'number-energy'] },
  { id: 'fengshui', label: '风水择日', methods: ['bazhai', 'xuankong', 'residential', 'almanac', 'calendar'] },
  { id: 'name-classics', label: '姓名典籍', methods: ['chinese-name', 'chinese-naming', 'zhouyi', 'character-query', 'wuyun-liuqi', 'huangji-jingshi'] },
];

export interface AgentResultSummary {
  title?: string;
  tags?: string[];
  lines?: string[];
}

export interface AgentToolTrace {
  id: string;
  name: string;
  label: string;
  status: 'running' | 'success' | 'error';
  argsText: string;
  method?: Method;
  methodLabel?: string;
  question?: string;
  summary?: AgentResultSummary;
  repromptToken?: string;
  payload?: Record<string, unknown>;
  fullResult?: unknown;
  outputPreview?: string;
  errorMessage?: string;
}

export interface AgentChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  attachedCaseName?: string;
  toolTraces?: AgentToolTrace[];
  status?: 'streaming' | 'done' | 'stopped' | 'error';
  errorMessage?: string;
}

export interface AgentChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  attachedCaseId: string | null;
  messages: AgentChatMessage[];
  apiHistory: AgentApiMessage[];
}

export const AGENT_TOOLS: readonly AgentToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'list_methods',
      description: '列出命语项目里所有可调用的算命、占卜、命盘、风水、择吉、姓名与典籍工具（method 标识与中文名称）。',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['mingli', 'ziwei-astro', 'qimen-liuren', 'divination', 'fengshui', 'name-classics'],
            description: '可选，按分类筛选：mingli(命理合参)、ziwei-astro(紫微星象)、qimen-liuren(奇门六壬)、divination(占卜灵签)、fengshui(风水择日)、name-classics(姓名典籍)',
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_method_schema',
      description: '获取指定术数方法的入参示例（example）、完整 JSON Schema 与提示词选项。在不确定某工具需要什么参数时优先调用。',
      parameters: {
        type: 'object',
        properties: {
          method: {
            type: 'string',
            description: '术数方法标识，例如 bazi, ziwei, liuyao, meihua, qimen, liuren, xiaoliuren, tarot, lenormand, ssgw, zhuge, almanac, number-energy, chinese-name, chinese-naming, random-divination 等',
          },
        },
        required: ['method'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculate',
      description: '在本地执行算命、占卜或排盘计算工具，返回结构化摘要（summary）、解析依据文本（promptText）和用于后续追问的 repromptToken。',
      parameters: {
        type: 'object',
        properties: {
          method: {
            type: 'string',
            description: '术数方法标识（如 liuyao, bazi, ziwei, tarot, qimen, liuren, meihua, xiaoliuren, almanac 等）',
          },
          input: {
            type: 'object',
            description: '传给该术数方法的 JSON 参数对象，通常含 question（想问的问题）及该术数所需字段',
            additionalProperties: true,
          },
        },
        required: ['method', 'input'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reprompt',
      description: '基于已有 calculate 返回的 repromptToken 对同一盘面/卦象继续追问，不重新起卦或抽牌。',
      parameters: {
        type: 'object',
        properties: {
          repromptToken: {
            type: 'string',
            description: '上一次 calculate 返回的 repromptToken',
          },
          question: {
            type: 'string',
            description: '用户的追问问题',
          },
          prompt: {
            type: 'object',
            description: '可选的提示词选项（如流派或焦点主题）',
            additionalProperties: true,
          },
        },
        required: ['repromptToken', 'question'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_personal_cases',
      description: '读取用户当前浏览器中保存的「个人档案」（命造列表：姓名、性别、公历/农历生日、时辰、出生地点及经纬度）。若指定 method（如 bazi, ziwei, bazi-ziwei, astrolabe, qizheng, qimen-lifetime, minglu, bazhai），还会直接附带可直接传给 calculate 的 suggestedInput。',
      parameters: {
        type: 'object',
        properties: {
          method: {
            type: 'string',
            description: '可选的目标命盘方法，用于生成可直接用于 calculate 的 suggestedInput',
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_current_time',
      description: '获取当前本地日期时间、ISO 时间戳、时区以及用户在全局设置中配置的默认时间口径与参考地点。',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
  },
];

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyAgentSession(attachedCaseId: string | null = null): AgentChatSession {
  const now = new Date().toISOString();
  return {
    id: makeId('chat'),
    title: '新算命对话',
    createdAt: now,
    updatedAt: now,
    attachedCaseId,
    messages: [],
    apiHistory: [],
  };
}

function sanitizeTraceForStorage(trace: AgentToolTrace): AgentToolTrace {
  const { fullResult: _drop, ...rest } = trace;
  return rest;
}

export function loadAgentSessions(): AgentChatSession[] {
  try {
    const raw = window.localStorage.getItem(AGENT_SESSIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is AgentChatSession =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as AgentChatSession).id === 'string' &&
        Array.isArray((item as AgentChatSession).messages) &&
        Array.isArray((item as AgentChatSession).apiHistory),
    );
  } catch {
    return [];
  }
}

export function saveAgentSessions(sessions: readonly AgentChatSession[]): void {
  const trimmed = sessions.slice(0, MAX_STORED_SESSIONS).map((session) => ({
    ...session,
    messages: session.messages.map((msg) => ({
      ...msg,
      ...(msg.status === 'streaming' ? { status: 'stopped' as const } : {}),
      ...(msg.toolTraces ? { toolTraces: msg.toolTraces.map(sanitizeTraceForStorage) } : {}),
    })),
  }));

  for (let limit = trimmed.length; limit >= 1; limit--) {
    try {
      window.localStorage.setItem(AGENT_SESSIONS_STORAGE_KEY, JSON.stringify(trimmed.slice(0, limit)));
      return;
    } catch {
      // Storage quota exceeded: prune oldest sessions and retry
    }
  }
}

export function loadActiveAgentSessionId(): string | null {
  try {
    return window.localStorage.getItem(AGENT_ACTIVE_SESSION_KEY);
  } catch {
    return null;
  }
}

export function saveActiveAgentSessionId(id: string): void {
  try {
    window.localStorage.setItem(AGENT_ACTIVE_SESSION_KEY, id);
  } catch {}
}

function summarizeCaseForAgent(record: PersonalCase, activeId: string | null, method?: string) {
  const timeOption =
    typeof record.timeIndex === 'number'
      ? BIRTH_TIME_OPTIONS.find((item) => item.index === record.timeIndex)?.label
      : record.timeIndex === 'unknown'
        ? '未知时辰'
        : undefined;
  const clockLabel =
    typeof record.birthHour === 'number' && typeof record.birthMinute === 'number'
      ? `${String(record.birthHour).padStart(2, '0')}:${String(record.birthMinute).padStart(2, '0')}`
      : timeOption ?? '未知时间';

  let suggestedInput: Record<string, unknown> | undefined;
  if (method === 'fortune') {
    try {
      const hasKnownTime = record.timeIndex !== 'unknown';
      const birth = toV2BirthPayload(record, {
        method: 'bazi',
        forcePreciseBirthPlace: hasKnownTime,
      });
      suggestedInput = {
        question: '请结合个人命局推演运势重点。',
        scope: 'daily',
        birth,
        gender: record.gender,
        ...(record.name ? { caseName: record.name } : {}),
        ...(record.latitude !== undefined && record.longitude !== undefined
          ? {
              location: {
                latitude: record.latitude,
                longitude: record.longitude,
                ...(record.birthPlace ? { locationName: record.birthPlace } : {}),
              },
            }
          : {}),
      };
    } catch {}
  } else if (method && isPersonalChartMethod(method)) {
    try {
      suggestedInput = buildPersonalChartPayload(record, method as PersonalChartTabId);
    } catch {}
  }

  return {
    id: record.id,
    name: record.name,
    gender: record.gender,
    calendar: record.calendar ?? record.dateType ?? 'solar',
    isLeapMonth: Boolean(record.isLeapMonth),
    year: record.year,
    month: record.month,
    day: record.day,
    timeLabel: clockLabel,
    birthPlace: record.birthPlace || undefined,
    useTrueSolarTime: Boolean(record.useTrueSolarTime),
    isActive: record.id === activeId,
    ...(suggestedInput ? { suggestedInput } : {}),
  };
}

function formatToolDisplayLabel(name: string, args: Record<string, unknown>): string {
  const method = typeof args.method === 'string' && methodIds.includes(args.method as Method)
    ? (args.method as Method)
    : undefined;
  const methodName = method ? methodLabels[method] : undefined;

  if (name === 'list_methods') return '浏览可用术数工具';
  if (name === 'get_method_schema') return methodName ? `查看「${methodName}」参数格式` : '查看术数参数格式';
  if (name === 'calculate') return methodName ? `调用「${methodName}」` : '执行排盘占卜';
  if (name === 'reprompt') return '基于原盘重新推演';
  if (name === 'list_personal_cases') return '读取个人档案命造';
  if (name === 'get_current_time') return '获取当前时间与历法口径';
  return name;
}

function buildResultSummary(raw: unknown): AgentResultSummary | undefined {
  if (!raw || typeof raw !== 'object' || !('summary' in raw)) return undefined;
  const summary = (raw as { summary?: unknown }).summary;
  if (!summary || typeof summary !== 'object') return undefined;
  const rec = summary as Record<string, unknown>;
  const title = typeof rec.title === 'string' ? rec.title : undefined;
  const tags = Array.isArray(rec.tags)
    ? rec.tags.filter((item): item is string => typeof item === 'string')
    : undefined;
  const lines = Array.isArray(rec.lines)
    ? rec.lines.filter((item): item is string => typeof item === 'string')
    : undefined;
  if (!title && !tags?.length && !lines?.length) return undefined;
  return { title, tags, lines };
}

function resolveSupportsIncludeClassics(method: Method): boolean {
  try {
    const schema = z.toJSONSchema(inputSchemas[method]) as {
      properties?: { prompt?: { properties?: Record<string, unknown> } };
    };
    const promptProps = schema.properties?.prompt?.properties;
    return Boolean(promptProps && 'includeClassics' in promptProps);
  } catch {
    return false;
  }
}

export async function restoreToolTraceResult(trace: AgentToolTrace): Promise<{
  method: Method;
  payload: Record<string, unknown>;
  result: { summary?: unknown; prompt?: { text: string }; data?: unknown };
} | null> {
  if (!trace.method) return null;
  const method = trace.method;
  const payload = trace.payload ?? {};
  if (trace.fullResult && typeof trace.fullResult === 'object') {
    return {
      method,
      payload,
      result: trace.fullResult as { summary?: unknown; prompt?: { text: string }; data?: unknown },
    };
  }
  if (trace.repromptToken) {
    const unpacked = await unpackRepromptToken(trace.repromptToken);
    const question =
      trace.question?.trim() ||
      (typeof payload.question === 'string' && payload.question.trim()) ||
      '请综合解读当前盘面重点。';
    const reprompted = await reprompt({
      method: unpacked.method as Method,
      result: unpacked,
      question,
      ...(unpacked.promptOptions !== undefined ? { prompt: unpacked.promptOptions } : {}),
    });
    return {
      method,
      payload,
      result: {
        ...unpacked,
        ...(trace.summary ? { summary: trace.summary } : {}),
        prompt: reprompted.prompt,
      },
    };
  }
  if (Object.keys(payload).length > 0) {
    const recalculated = await calculate(method, payload);
    return {
      method,
      payload,
      result: recalculated as { summary?: unknown; prompt?: { text: string }; data?: unknown },
    };
  }
  return null;
}

async function executeAgentToolCall(
  toolCall: AgentToolCall,
): Promise<{ contentForModel: string; tracePatch: Partial<AgentToolTrace> }> {
  const name = toolCall.function.name;
  let parsedArgs: Record<string, unknown> = {};
  try {
    const raw = toolCall.function.arguments.trim();
    const val = raw ? (JSON.parse(raw) as unknown) : {};
    if (!val || typeof val !== 'object' || Array.isArray(val)) {
      throw new Error('工具参数必须是 JSON 对象。');
    }
    parsedArgs = val as Record<string, unknown>;
  } catch (err) {
    const message = err instanceof Error ? err.message : '参数 JSON 解析失败';
    return {
      contentForModel: JSON.stringify({ error: `工具参数格式错误：${message}` }),
      tracePatch: { status: 'error', errorMessage: `参数解析失败：${message}` },
    };
  }

  const displayLabel = formatToolDisplayLabel(name, parsedArgs);

  try {
    if (name === 'list_methods') {
      const category = typeof parsedArgs.category === 'string' ? parsedArgs.category : undefined;
      const groups = AGENT_METHOD_CATEGORIES.filter((g) => !category || g.id === category).map((g) => ({
        id: g.id,
        label: g.label,
        methods: g.methods.map((id) => ({
          id,
          label: methodLabels[id],
          description: inputSchemas[id].description ?? methodLabels[id],
        })),
      }));
      const out = { count: methodIds.length, categories: groups };
      return {
        contentForModel: JSON.stringify(out),
        tracePatch: {
          label: displayLabel,
          status: 'success',
          outputPreview: `已列出 ${groups.reduce((acc, g) => acc + g.methods.length, 0)} 项术数工具`,
        },
      };
    }

    if (name === 'get_method_schema') {
      const method = parsedArgs.method as Method;
      if (!methodIds.includes(method)) {
        return {
          contentForModel: JSON.stringify({
            error: `未知的术数方法：${String(parsedArgs.method)}`,
            availableMethods: methodIds,
          }),
          tracePatch: {
            label: displayLabel,
            status: 'error',
            errorMessage: `未知术数：${String(parsedArgs.method)}`,
          },
        };
      }
      const out = {
        method,
        label: methodLabels[method],
        description: inputSchemas[method].description ?? methodLabels[method],
        example: webExamples[method],
        inputSchema: z.toJSONSchema(inputSchemas[method]),
        promptCatalog: getPromptCatalog([method])[method] ?? null,
      };
      return {
        contentForModel: JSON.stringify(out),
        tracePatch: {
          label: displayLabel,
          status: 'success',
          method,
          methodLabel: methodLabels[method],
          outputPreview: `已获取「${methodLabels[method]}」参数格式与示例`,
        },
      };
    }

    if (name === 'list_personal_cases') {
      const cases = loadPersonalCases();
      const activeId = getActiveCaseId();
      const targetMethod = typeof parsedArgs.method === 'string' ? parsedArgs.method : undefined;
      const items = cases.map((item) => summarizeCaseForAgent(item, activeId, targetMethod));
      return {
        contentForModel: JSON.stringify({
          count: items.length,
          activeCaseId: activeId,
          cases: items,
        }),
        tracePatch: {
          label: displayLabel,
          status: 'success',
          outputPreview: items.length ? `读取到 ${items.length} 份已保存命造` : '当前暂无已保存个人档案',
        },
      };
    }

    if (name === 'get_current_time') {
      const rules = loadGlobalRules();
      const now = new Date();
      const out = {
        iso: now.toISOString(),
        localString: now.toLocaleString('zh-CN', { hour12: false }),
        defaultTimeStandard: rules.time.defaultTimeStandard,
        defaultPlace: {
          displayName: rules.time.defaultPlaceDisplayName,
          longitude: rules.time.defaultPlaceLongitude,
          latitude: rules.time.defaultPlaceLatitude,
        },
      };
      return {
        contentForModel: JSON.stringify(out),
        tracePatch: {
          label: displayLabel,
          status: 'success',
          outputPreview: `当前时间：${out.localString}`,
        },
      };
    }

    if (name === 'calculate') {
      const method = parsedArgs.method as Method;
      if (!methodIds.includes(method)) {
        return {
          contentForModel: JSON.stringify({
            error: `未知术数方法：${String(parsedArgs.method)}`,
            availableMethods: methodIds,
          }),
          tracePatch: {
            label: displayLabel,
            status: 'error',
            errorMessage: `未知术数：${String(parsedArgs.method)}`,
          },
        };
      }
      const rawInput =
        parsedArgs.input && typeof parsedArgs.input === 'object' && !Array.isArray(parsedArgs.input)
          ? (parsedArgs.input as Record<string, unknown>)
          : {};
      const supportsClassics = resolveSupportsIncludeClassics(method);
      const appliedPayload = applyGlobalRulesToPayload(
        method,
        rawInput,
        supportsClassics,
      ) as Record<string, unknown>;

      try {
        const fullResult = (await calculate(method, appliedPayload)) as CompactableCalculationResult;
        const compact = await toCompactResult(fullResult);
        const summary = buildResultSummary(compact);
        const question =
          typeof appliedPayload.question === 'string' ? appliedPayload.question.trim() : undefined;
        const modelPayload = {
          version: compact.version,
          method: compact.method,
          label: methodLabels[method],
          currentTime: compact.currentTime,
          summary: compact.summary ?? null,
          promptText: compact.prompt.text,
          repromptToken: compact.repromptToken,
        };
        return {
          contentForModel: JSON.stringify(modelPayload),
          tracePatch: {
            label: displayLabel,
            status: 'success',
            method,
            methodLabel: methodLabels[method],
            ...(question ? { question } : {}),
            ...(summary ? { summary } : {}),
            repromptToken: compact.repromptToken,
            payload: appliedPayload,
            fullResult,
            outputPreview: summary?.title ?? `${methodLabels[method]}计算完成`,
          },
        };
      } catch (err) {
        const formatted = formatInputError(err);
        return {
          contentForModel: JSON.stringify({
            error: formatted,
            method,
            exampleInput: webExamples[method],
            hint: '请对照 exampleInput 或调用 get_method_schema 检查参数格式后重试。',
          }),
          tracePatch: {
            label: displayLabel,
            status: 'error',
            method,
            methodLabel: methodLabels[method],
            errorMessage: formatted,
          },
        };
      }
    }

    if (name === 'reprompt') {
      const { payload } = await resolveRepromptPayload(parsedArgs);
      const parsed = repromptInput.parse(payload);
      const res = await reprompt(parsed);
      const method = parsed.method;
      return {
        contentForModel: JSON.stringify({
          method,
          label: methodLabels[method],
          currentTime: res.currentTime,
          promptText: res.prompt.text,
        }),
        tracePatch: {
          label: `追问重排「${methodLabels[method]}」`,
          status: 'success',
          method,
          methodLabel: methodLabels[method],
          question: parsed.question,
          outputPreview: `已基于原盘生成新追问依据`,
        },
      };
    }

    return {
      contentForModel: JSON.stringify({ error: `未注册的工具：${name}` }),
      tracePatch: {
        label: displayLabel,
        status: 'error',
        errorMessage: `未知工具：${name}`,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '工具执行失败';
    return {
      contentForModel: JSON.stringify({ error: msg }),
      tracePatch: {
        label: displayLabel,
        status: 'error',
        errorMessage: msg,
      },
    };
  }
}

function buildAgentSystemPrompt(attachedCase: PersonalCase | null): string {
  const now = new Date();
  const rules = loadGlobalRules();
  const lines = [
    '你是「命语」网页工作台的算命与占卜 AI Agent。你的职责是以自然、通俗、有温度的中文对话方式，主动调用项目内置的本地术数排盘与占卜工具，帮用户完成排盘、起卦、合盘、择吉、起名与解读。',
    '',
    `当前本地时间：${now.toLocaleString('zh-CN', { hour12: false })}（ISO: ${now.toISOString()}）`,
    `用户默认时间口径：${rules.time.defaultTimeStandard === 'true-solar' ? `真太阳时（参考地：${rules.time.defaultPlaceDisplayName}，经度 ${rules.time.defaultPlaceLongitude}）` : '北京时间'}`,
    '',
    '【工作规则】',
    '1. 遇到算命、占卜、排盘、合盘、择吉、起名、字典查字、数字能量等问题，必须调用本地工具计算，严禁凭空编造卦象、牌面、四柱、宫位或吉日。',
    '2. 常用术数速查：',
    '   - 占卜类（可即时起卦/抽牌，无需反复向用户确认）：liuyao（六爻）、meihua（梅花易数）、xiaoliuren（小六壬）、qimen（奇门遁甲）、liuren（大六壬）、jinkoujue（金口诀）、tarot（塔罗）、lenormand（雷诺曼）、ssgw（三山灵签）、zhuge（诸葛神数）、taiyi（太乙神数）、random-divination（随机起卦）。',
    '   - 个人命盘类（需出生日期时间与性别；若用户已附加档案或提到保存的档案，先调用 list_personal_cases）：bazi（八字）、ziwei（紫微斗数）、bazi-ziwei（星平合参）、astrolabe（西洋星盘）、qizheng（七政四余）、qimen-lifetime（奇门终身）、minglu（综合命录）、fortune（日运/月运/年运，可传个人档案也可不传看通用运势）。',
    '   - 实用类：almanac（择吉万年历）、residential/bazhai/xuankong（风水）、chinese-name（姓名分析）、chinese-naming（起名方案）、character-query（汉字字典）、number-energy（数字能量）、zhouyi（周易经文查询）、calendar（节气月相历法）。',
    '3. 在不熟悉某个工具的具体入参结构时，先调用 get_method_schema（它会返回 example 和 schema），再调用 calculate。若 calculate 返回参数错误，请对照返回的 exampleInput 修正参数后重试。',
    '4. 同一盘面/卦象在多轮对话中继续追问不同方向时，优先用上次 calculate 返回的 repromptToken 调用 reprompt，不要重新起卦或重抽牌，除非用户明确要求重新占卜。',
    '5. 拿到工具返回的 summary 与 promptText 后，严格基于其中的真实排盘结果与证据进行解读：结论清晰、分点有条理、用大白话解释专业术语，并在最后给出务实温和的参考建议。',
  ];

  if (attachedCase) {
    const activeSummary = summarizeCaseForAgent(attachedCase, attachedCase.id);
    lines.push(
      '',
      '【用户当前附加的个人档案】',
      `当用户提到“帮我算算”“看看我的命盘”等本人测算需求时，可优先使用该档案（可调用 list_personal_cases 获取对应术数的 suggestedInput）：`,
      JSON.stringify(activeSummary),
    );
  }

  return lines.join('\n');
}

export interface RunAgentTurnCallbacks {
  onAssistantUpdate: (patch: {
    content: string;
    toolTraces: AgentToolTrace[];
    statusText?: string;
  }) => void;
}

export interface RunAgentTurnResult {
  finalContent: string;
  toolTraces: AgentToolTrace[];
  nextApiHistory: AgentApiMessage[];
  finishReason: string;
}

export async function runAgentTurn(params: {
  userText: string;
  priorApiHistory: readonly AgentApiMessage[];
  attachedCase: PersonalCase | null;
  config?: AiConfig;
  signal?: AbortSignal;
  callbacks: RunAgentTurnCallbacks;
}): Promise<RunAgentTurnResult> {
  const cfg = params.config ?? readWebAiConfig();
  const systemPrompt = buildAgentSystemPrompt(params.attachedCase);
  const workingHistory: AgentApiMessage[] = [
    ...params.priorApiHistory,
    { role: 'user', content: params.userText },
  ];

  let latestContent = '';
  const allTraces: AgentToolTrace[] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    if (params.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    params.callbacks.onAssistantUpdate({
      content: latestContent,
      toolTraces: [...allTraces],
      statusText: round === 0 ? '正在思考并选择合适工具…' : '正在整理排盘结果并继续推演…',
    });

    let roundText = '';
    const baseContentBeforeRound = latestContent;
    const roundStartTraceIndex = allTraces.length;

    const turn = await streamAgentCompletion(
      cfg,
      [{ role: 'system', content: systemPrompt }, ...workingHistory],
      AGENT_TOOLS,
      {
        onText: (chunk) => {
          roundText += chunk;
          const prefix =
            baseContentBeforeRound && !baseContentBeforeRound.endsWith('\n')
              ? `${baseContentBeforeRound}\n\n`
              : baseContentBeforeRound;
          latestContent = `${prefix}${roundText}`;
          params.callbacks.onAssistantUpdate({
            content: latestContent,
            toolTraces: [...allTraces],
            statusText: '正在生成回复…',
          });
        },
        onToolCallDelta: (partialCalls) => {
          const previewTraces: AgentToolTrace[] = partialCalls.map((tc, idx) => {
            let parsedName = tc.function.name || 'tool';
            let previewLabel = `准备调用工具 ${parsedName}…`;
            try {
              const argsObj = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
              if (argsObj && typeof argsObj === 'object' && !Array.isArray(argsObj)) {
                previewLabel = formatToolDisplayLabel(parsedName, argsObj as Record<string, unknown>);
              }
            } catch {}
            return {
              id: tc.id || `pending_${round}_${idx}`,
              name: parsedName,
              label: previewLabel,
              status: 'running',
              argsText: tc.function.arguments,
            };
          });
          allTraces.splice(roundStartTraceIndex, allTraces.length - roundStartTraceIndex, ...previewTraces);
          params.callbacks.onAssistantUpdate({
            content: latestContent,
            toolTraces: [...allTraces],
            statusText: previewTraces[0]?.label ?? '正在准备调用工具…',
          });
        },
      },
      params.signal,
    );

    if (turn.toolCalls.length === 0) {
      workingHistory.push({
        role: 'assistant',
        content: turn.content,
      });
      return {
        finalContent: latestContent || turn.content,
        toolTraces: allTraces,
        nextApiHistory: workingHistory,
        finishReason: turn.finishReason,
      };
    }

    // Record assistant tool_calls message
    workingHistory.push({
      role: 'assistant',
      content: turn.content || null,
      tool_calls: turn.toolCalls,
    });

    // Execute each tool call locally in the browser
    const roundTraces: AgentToolTrace[] = turn.toolCalls.map((tc, idx) => {
      let argsObj: Record<string, unknown> = {};
      try {
        argsObj = tc.function.arguments ? (JSON.parse(tc.function.arguments) as Record<string, unknown>) : {};
      } catch {}
      return {
        id: tc.id || `call_${round}_${idx}`,
        name: tc.function.name,
        label: formatToolDisplayLabel(tc.function.name, argsObj),
        status: 'running',
        argsText: tc.function.arguments,
      };
    });
    allTraces.splice(roundStartTraceIndex, allTraces.length - roundStartTraceIndex, ...roundTraces);

    for (let i = 0; i < turn.toolCalls.length; i++) {
      if (params.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      const tc = turn.toolCalls[i];
      const trace = roundTraces[i];
      params.callbacks.onAssistantUpdate({
        content: latestContent,
        toolTraces: [...allTraces],
        statusText: `正在执行：${trace.label}…`,
      });

      const executed = await executeAgentToolCall(tc);
      Object.assign(trace, executed.tracePatch);
      params.callbacks.onAssistantUpdate({
        content: latestContent,
        toolTraces: [...allTraces],
        statusText: trace.status === 'success' ? `已完成：${trace.label}` : `工具提示：${trace.label}`,
      });

      workingHistory.push({
        role: 'tool',
        tool_call_id: tc.id,
        name: tc.function.name,
        content: executed.contentForModel,
      });
    }
  }

  // Fallback if max tool rounds reached: ask model for final answer without tools
  const finalTurn = await streamAgentCompletion(
    cfg,
    [
      { role: 'system', content: systemPrompt },
      ...workingHistory,
      { role: 'user', content: '请根据以上已经调用并取得的工具结果，直接为用户做出完整清晰的总结与解答。' },
    ],
    [],
    {
      onText: (chunk) => {
        latestContent += chunk;
        params.callbacks.onAssistantUpdate({
          content: latestContent,
          toolTraces: [...allTraces],
          statusText: '正在生成最终回复…',
        });
      },
    },
    params.signal,
  );
  workingHistory.push({ role: 'assistant', content: finalTurn.content });
  return {
    finalContent: latestContent || finalTurn.content,
    toolTraces: allTraces,
    nextApiHistory: workingHistory,
    finishReason: finalTurn.finishReason,
  };
}
