import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import packageJson from '../../package.json';

export const SERVER_INFO = {
  name: 'mingyu-mcp-server',
  version: packageJson.version,
} as const;

export type MingyuMcpPreset = 'full' | 'online';

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

/** 创建仅包含协议与服务信息的独立实例，工具按请求加载。 */
export function createMingyuMcpBaseServer(preset: MingyuMcpPreset = 'full'): McpServer {
  return new McpServer(SERVER_INFO, {
    capabilities: { tools: { listChanged: true } },
    instructions: `${preset === 'online' ? ONLINE_INSTRUCTIONS : FULL_INSTRUCTIONS}\n${SERVER_INSTRUCTIONS}`,
  });
}
