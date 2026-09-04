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
import { getToolAnnotations } from './catalog/tool-catalog.js';

export const SERVER_INFO = {
  name: 'mingyu-mcp-server',
  version: '0.1.0',
} as const;

export const SERVER_INSTRUCTIONS =
  '命语 MCP Server：处理算命、看运势、占卜、玄学排盘、合婚、抽牌、求签、风水和择日等日常请求，也提供真太阳时、八字、紫微斗数、六爻、梅花易数、小六壬、金口诀、奇门遁甲、大六壬、五运六气、皇极经世、塔罗、雷诺曼、灵签、黄历择日、星盘等专业工具。AI 可获取结构化排盘，也可直接获得完整的 AI 解读提示词。';

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
    return originalRegisterTool(name, { ...config, annotations }, cb);
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

  return server;
}
