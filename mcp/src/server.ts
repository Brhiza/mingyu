#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerBaziTool } from './tools/bazi.js';
import { registerZiweiTool } from './tools/ziwei.js';
import { registerBaziZiweiTool } from './tools/bazi-ziwei.js';
import { registerLiuyaoTool } from './tools/liuyao.js';
import { registerMeihuaTool } from './tools/meihua.js';
import { registerXiaoliurenTool } from './tools/xiaoliuren.js';
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
import { registerQizhengTool } from './tools/qi_zheng.js';

const server = new McpServer(
  {
    name: 'mingyu-mcp-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
    instructions:
      '命语 MCP Server：提供八字排盘、紫微斗数、八字紫微合参、六爻、梅花易数、小六壬、奇门遁甲、大六壬、塔罗牌、雷诺曼、灵签、黄历择日、星盘等命理占卜工具。AI 可调用排盘工具获取结构化数据，也可调用一站式提示词工具直接获得排盘结果和结构化 AI 解读提示词。',
  },
);

registerBaziTool(server);
registerZiweiTool(server);
registerBaziZiweiTool(server);
registerLiuyaoTool(server);
registerMeihuaTool(server);
registerXiaoliurenTool(server);
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
registerQizhengTool(server);

const transport = new StdioServerTransport();

server.connect(transport).catch((error) => {
  console.error('MCP Server 启动失败:', error);
  process.exit(1);
});
