import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerBaziTool } from './tools/bazi.js';
import { registerZiweiTool } from './tools/ziwei.js';
import { registerBaziZiweiTool } from './tools/bazi-ziwei.js';
import { registerThematicTool } from './tools/thematic.js';
import { registerLiuyaoTool } from './tools/liuyao.js';
import { registerMeihuaTool } from './tools/meihua.js';
import { registerXiaoliurenTool } from './tools/xiaoliuren.js';
import { registerJinkoujueTool } from './tools/jinkoujue.js';
import { registerQimenTool } from './tools/qimen.js';
import { registerLiurenTool } from './tools/liuren.js';
import { registerTarotTool } from './tools/tarot.js';
import { registerSsgwTool } from './tools/ssgw.js';
import { registerAlmanacTool } from './tools/almanac.js';
import { registerLenormandTool } from './tools/lenormand.js';
import { registerAstrolabeTool } from './tools/astrolabe.js';
import { registerBaZhaiTool } from './tools/ba_zhai.js';
import { registerZodiacTool } from './tools/zodiac.js';
import { registerTaiyiTool } from './tools/taiyi.js';
import { registerWuyunLiuqiTool } from './tools/wuyun-liuqi.js';
import { registerHuangjiJingshiTool } from './tools/huangji-jingshi.js';
import { registerQizhengTool } from './tools/qi_zheng.js';
import { registerXuanKongTool } from './tools/xuan_kong.js';
import { registerResidentialFengshuiTool } from './tools/residential_fengshui.js';
import { registerFoundationTools } from './tools/foundation.js';
import { registerCalendarTools } from './tools/calendar.js';
import { registerInstantTool } from './tools/instant.js';
import { registerNameNumberTools } from './tools/name-number.js';
import { registerYilinTool } from './tools/yilin.js';
import {
  getToolAnnotations,
  getToolDescription,
  getToolExample,
  getToolMetadata,
  getToolTitle,
} from './catalog/tool-catalog.js';
import { promptOutputSchema, promptResponseModeShape, type PromptResponseMode } from './schemas.js';
import { applyPromptResponseMode, createErrorToolResult, getErrorMessage } from './tool-results.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import packageJson from '../../package.json';

export const SERVER_INFO = {
  name: 'mingyu-mcp-server',
  version: packageJson.version,
} as const;

export type MingyuMcpPreset = 'full' | 'online';

export interface MingyuMcpServerOptions {
  preset?: MingyuMcpPreset;
  defaultResponseMode?: PromptResponseMode;
  astrolabeDefaultScope?: 'natal' | 'yearly';
}

export const SERVER_INSTRUCTIONS = [
  '命语 MCP Server 提供命理排盘、运势、占卜、风水、择日、起名、历法与天文工具。先根据用户目的选择一个首选工具，再调用并回答。',
  '调用规则：需要直接解读时优先调用名称以 _prompt 结尾的工具；它会自行计算并返回完整 prompt，可用时还会同步返回 result，不要先调用同类排盘工具。只要结构化盘面、表格或二次计算时，使用 *_calculate、divine_*、metaphysics_* 或基础查询工具。随机起卦、抽牌、求签同一问题只调用一次，继续分析时复用返回的重放参数或固定结果。',
  '参数规则：只传用户已提供或工具 schema 能可靠默认的值。不得猜测出生时辰、日期、地点、经纬度、时区或指定运限坐标；不明确时读取工具描述和默认范围，缺少必填资料则向用户补问。当前时间只用于明确的即时盘或时间起卦，历史复盘必须传用户指定时刻。',
  '结果读取：成功时按 outputSchema 读取 structuredContent 中的计算字段（通常为 result，部分工具使用具名字段），以 prompt 为完整解读任务书，并检查 warnings、时间口径、分析范围和资料限制。失败时读取 error、missingFields、retryable 与 fallback，只补充缺失参数后重试，不用另一套算法静默替代。',
  '解读规则：先说明采用的方法、时间和范围，再提炼主要证据、相反证据与限制，最后直接回答用户问题。计算事实与传统取义分开表达；只从返回资料推导，不补造盘面、古籍依据或确定性事件。',
].join('\n');

const ONLINE_INSTRUCTIONS =
  '当前连接采用在线轻量模式：长范围命理与择日提示词默认返回盘面摘要；一次性起卦、抽牌与求签提示词默认保留完整结果，便于复用同一次占卜。星盘默认本命；长日期、长年份查询请按工具范围分段，遇 RESOURCE_LIMIT 按 fallback 调整。';
const FULL_INSTRUCTIONS =
  '当前连接采用本地完整模式：提示词默认返回完整结构化结果，星盘默认包含当前年度行运；需要完整计算证据时可指定 detailMode=full。';

type RegisterToolConfig = {
  title?: string;
  annotations?: ToolAnnotations;
  description?: string;
  inputSchema?: unknown;
  outputSchema?: unknown;
  _meta?: Record<string, unknown>;
  [key: string]: unknown;
};

type RegisterToolCallback = (
  args: Record<string, unknown>,
  extra: unknown,
) => CallToolResult | Promise<CallToolResult>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasSchemaExtend(
  value: unknown,
): value is { extend: (shape: Record<string, unknown>) => unknown } {
  return isRecord(value) && typeof value.extend === 'function';
}

function hasSchemaMeta(value: unknown): value is {
  meta: (metadata?: Record<string, unknown>) => Record<string, unknown> | undefined;
} {
  return isRecord(value) && typeof value.meta === 'function';
}

function addPromptResponseMode(inputSchema: unknown): unknown {
  if (hasSchemaExtend(inputSchema)) {
    const extendedSchema = inputSchema.extend(promptResponseModeShape);
    const metadata = hasSchemaMeta(inputSchema) ? inputSchema.meta() : undefined;
    return metadata && hasSchemaMeta(extendedSchema)
      ? extendedSchema.meta(metadata)
      : extendedSchema;
  }
  if (isRecord(inputSchema) && isRecord(inputSchema.shape)) {
    return { ...inputSchema.shape, ...promptResponseModeShape };
  }
  if (isRecord(inputSchema)) {
    return { ...inputSchema, ...promptResponseModeShape };
  }
  return promptResponseModeShape;
}

function extractPublicMetadata(
  name: string,
  args: Record<string, unknown>,
  durationMs: number,
): Record<string, unknown> {
  const meta: Record<string, unknown> = {
    tool: name,
    version: SERVER_INFO.version,
    durationMs,
  };

  if (typeof args.startDate === 'string' && typeof args.endDate === 'string') {
    meta.range = { startDate: args.startDate, endDate: args.endDate };
  } else if (
    args.periodRange &&
    typeof args.periodRange === 'object' &&
    typeof (args.periodRange as Record<string, unknown>).startDate === 'string' &&
    typeof (args.periodRange as Record<string, unknown>).endDate === 'string'
  ) {
    const pr = args.periodRange as Record<string, unknown>;
    meta.range = { startDate: pr.startDate, endDate: pr.endDate };
  }

  if (typeof args.timeZoneId === 'string' && args.timeZoneId.trim()) {
    meta.timeZone = args.timeZoneId.trim();
  } else if (typeof args.timezone === 'number' && Number.isFinite(args.timezone)) {
    meta.timeZone = args.timezone >= 0 ? `UTC+${args.timezone}` : `UTC${args.timezone}`;
  }

  if (typeof args.customDate === 'string' && args.customDate.trim()) {
    meta.actualTime = args.customDate.trim();
  } else if (typeof args.birthDateTime === 'string' && args.birthDateTime.trim()) {
    meta.actualTime = args.birthDateTime.trim();
  } else if (typeof args.localDateTime === 'string' && args.localDateTime.trim()) {
    meta.actualTime = args.localDateTime.trim();
  }

  return meta;
}

/**
 * 创建并配置命语 MCP 服务器实例
 */
export function createMingyuMcpServer(options: MingyuMcpServerOptions = {}): McpServer {
  const preset = options.preset ?? 'full';
  const defaultResponseMode: PromptResponseMode =
    options.defaultResponseMode ?? (preset === 'online' ? 'summary' : 'full');
  const astrolabeDefaultScope: 'natal' | 'yearly' =
    options.astrolabeDefaultScope ?? (preset === 'online' ? 'natal' : 'yearly');

  const server = new McpServer(SERVER_INFO, {
    capabilities: {
      tools: {},
    },
    instructions: `${preset === 'online' ? ONLINE_INSTRUCTIONS : FULL_INSTRUCTIONS}\n${SERVER_INSTRUCTIONS}`,
  });

  // 自动从统一工具契约注入元数据注解 (readOnlyHint, idempotentHint)
  const originalRegisterTool = server.registerTool.bind(server) as unknown as (
    name: string,
    config: RegisterToolConfig,
    cb: RegisterToolCallback,
  ) => unknown;
  server.registerTool = ((name: string, config: RegisterToolConfig, cb: RegisterToolCallback) => {
    const title = config.title ?? getToolTitle(name);
    const annotations = config.annotations ?? getToolAnnotations(name);
    const isPromptTool = config.outputSchema === promptOutputSchema;
    const toolDefaultResponseMode: PromptResponseMode =
      options.defaultResponseMode === undefined &&
      preset === 'online' &&
      isPromptTool &&
      annotations.idempotentHint === false
        ? 'full'
        : defaultResponseMode;
    const description = getToolDescription(name, config.description, toolDefaultResponseMode);
    const toolMeta = getToolMetadata(name);
    const example = getToolExample(name);
    const metaRecord = {
      ...(toolMeta ?? {}),
      ...(example ? { example } : {}),
      ...((config._meta as Record<string, unknown> | undefined) ?? {}),
    };
    const _meta = Object.keys(metaRecord).length ? metaRecord : undefined;

    const inputSchema = isPromptTool
      ? addPromptResponseMode(config.inputSchema)
      : config.inputSchema;

    const wrappedCallback = async (args: Record<string, unknown>, extra: unknown) => {
      const startTime = performance.now();
      let result: CallToolResult;
      try {
        result = await cb(args, extra);
      } catch (error) {
        result = createErrorToolResult(getErrorMessage(error, '工具执行失败'));
      }
      const durationMs = Math.round((performance.now() - startTime) * 100) / 100;

      if (isPromptTool) {
        const responseMode = (args as { responseMode?: PromptResponseMode }).responseMode;
        const effectiveResponseMode: PromptResponseMode =
          responseMode === 'prompt-only' || responseMode === 'summary' || responseMode === 'full'
            ? responseMode
            : toolDefaultResponseMode;
        result = applyPromptResponseMode(result, effectiveResponseMode);
      }

      const reliableMeta = extractPublicMetadata(name, args, durationMs);
      result._meta = {
        ...reliableMeta,
        ...(result._meta ?? {}),
      };

      return result;
    };

    return originalRegisterTool(
      name,
      { ...config, title, inputSchema, annotations, description, _meta },
      wrappedCallback,
    );
  }) as unknown as typeof server.registerTool;

  registerBaziTool(server);
  registerZiweiTool(server);
  registerBaziZiweiTool(server);
  registerThematicTool(server);
  registerLiuyaoTool(server);
  registerMeihuaTool(server);
  registerXiaoliurenTool(server);
  registerJinkoujueTool(server);
  registerQimenTool(server);
  registerLiurenTool(server);
  registerTarotTool(server);
  registerSsgwTool(server);
  registerAlmanacTool(server);
  registerLenormandTool(server);
  registerAstrolabeTool(server, { defaultPromptScope: astrolabeDefaultScope });
  registerBaZhaiTool(server);
  registerZodiacTool(server);
  registerTaiyiTool(server);
  registerWuyunLiuqiTool(server);
  registerHuangjiJingshiTool(server);
  registerQizhengTool(server);
  registerXuanKongTool(server);
  registerResidentialFengshuiTool(server);
  registerFoundationTools(server);
  registerCalendarTools(server);
  registerInstantTool(server);
  registerNameNumberTools(server);
  registerYilinTool(server);

  return server;
}
