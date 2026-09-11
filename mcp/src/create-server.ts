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
import { getToolAnnotations, getToolDescription } from './catalog/tool-catalog.js';
import packageJson from '../../package.json';

export const SERVER_INFO = {
  name: 'mingyu-mcp-server',
  version: packageJson.version,
} as const;

export const SERVER_INSTRUCTIONS = [
  '命语 MCP Server 提供命理排盘、运势、占卜、风水、择日、起名、历法与天文工具。先根据用户目的选择一个首选工具，再调用并回答。',
  '调用规则：需要直接解读时优先调用名称以 _prompt 结尾的工具；它会自行计算并返回完整 prompt，可用时还会同步返回 result，不要先调用同类排盘工具。只要结构化盘面、表格或二次计算时，使用 *_calculate、divine_*、metaphysics_* 或基础查询工具。随机起卦、抽牌、求签同一问题只调用一次，继续分析时复用返回的重放参数或固定结果。',
  '参数规则：只传用户已提供或工具 schema 能可靠默认的值。不得猜测出生时辰、日期、地点、经纬度、时区或指定运限坐标；不明确时读取工具描述和默认范围，缺少必填资料则向用户补问。当前时间只用于明确的即时盘或时间起卦，历史复盘必须传用户指定时刻。',
  '结果读取：成功时按 outputSchema 读取 structuredContent 中的计算字段（通常为 result，部分工具使用具名字段），以 prompt 为完整解读任务书，并检查 warnings、时间口径、分析范围和资料限制。失败时读取 error、missingFields、retryable 与 fallback，只补充缺失参数后重试，不用另一套算法静默替代。',
  '解读规则：先说明采用的方法、时间和范围，再提炼主要证据、相反证据与限制，最后直接回答用户问题。计算事实与传统取义分开表达；只从返回资料推导，不补造盘面、古籍依据或确定性事件。',
].join('\n');

/**
 * 创建并配置命语 MCP 服务器实例
 */
export function createMingyuMcpServer(): McpServer {
  const server = new McpServer(SERVER_INFO, {
    capabilities: {
      tools: {},
    },
    instructions: SERVER_INSTRUCTIONS,
  });

  // 自动从统一工具契约注入元数据注解 (readOnlyHint, idempotentHint)
  const originalRegisterTool = server.registerTool.bind(server);
  server.registerTool = (name, config, cb) => {
    const annotations = config.annotations ?? getToolAnnotations(name);
    const description = getToolDescription(name, config.description);
    return originalRegisterTool(name, { ...config, annotations, description }, cb);
  };

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
  registerAstrolabeTool(server);
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
