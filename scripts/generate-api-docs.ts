import { z } from 'zod';
import { getPromptCatalog } from '../src/catalog';
import { inputSchemas, methodIds, methodLabels, type Method } from '../src/schema';
import { calendarExamples, methodExamples } from './method-examples.mjs';

type JsonSchemaNode = Record<string, unknown>;

interface MethodCategoryGroup {
  id: string;
  label: string;
  methods: Method[];
}

interface FieldRow {
  path: string;
  type: string;
  required: boolean;
  description: string;
}

const METHOD_CATEGORY_GROUPS: readonly MethodCategoryGroup[] = [
  {
    id: 'mingli',
    label: '命理合参',
    methods: ['bazi', 'bazi-synastry', 'bazi-ziwei', 'bazi-reverse', 'minglu', 'fortune', 'instant'],
  },
  {
    id: 'ziwei-astro',
    label: '紫微星象',
    methods: ['ziwei', 'ziwei-synastry', 'qizheng', 'qizheng-range', 'astrolabe', 'astrolabe-range', 'astrolabe-synastry'],
  },
  {
    id: 'qimen-liuren',
    label: '奇门六壬',
    methods: ['qimen', 'qimen-lifetime', 'liuren', 'jinkoujue', 'xiaoliuren', 'taiyi'],
  },
  {
    id: 'divination',
    label: '占卜灵签',
    methods: ['liuyao', 'meihua', 'tarot', 'lenormand', 'random-divination', 'ssgw', 'zhuge', 'number-energy'],
  },
  {
    id: 'fengshui',
    label: '风水择日',
    methods: ['bazhai', 'xuankong', 'residential', 'almanac', 'calendar'],
  },
  {
    id: 'name-classics',
    label: '姓名典籍',
    methods: ['chinese-name', 'chinese-naming', 'zhouyi', 'character-query', 'wuyun-liuqi', 'huangji-jingshi'],
  },
];

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeMdCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
}

function summarizeType(node: JsonSchemaNode): string {
  if ('const' in node) return `const ${JSON.stringify(node.const)}`;
  if (Array.isArray(node.enum)) {
    const preview = node.enum.slice(0, 8).map((v) => JSON.stringify(v)).join(' | ');
    return node.enum.length > 8 ? `enum(${preview} ...共${node.enum.length}项)` : `enum(${preview})`;
  }
  const union = (node.oneOf ?? node.anyOf) as JsonSchemaNode[] | undefined;
  if (Array.isArray(union)) {
    const parts = union.map((branch) => {
      if (branch.type === 'object' && branch.properties && typeof branch.properties === 'object') {
        const props = branch.properties as Record<string, JsonSchemaNode>;
        const discriminator = props.kind?.const ?? props.mode?.const ?? props.method?.const;
        if (discriminator !== undefined) return `object(kind/mode=${JSON.stringify(discriminator)})`;
      }
      return summarizeType(branch);
    });
    return [...new Set(parts)].join(' | ');
  }
  if (node.type === 'array') {
    const items = node.items as JsonSchemaNode | undefined;
    return items ? `array<${summarizeType(items)}>` : 'array';
  }
  if (typeof node.type === 'string') {
    const bounds: string[] = [];
    if (typeof node.minimum === 'number') bounds.push(`>=${node.minimum}`);
    if (typeof node.maximum === 'number') bounds.push(`<=${node.maximum}`);
    if (node.format) bounds.push(String(node.format));
    return bounds.length ? `${node.type} (${bounds.join(', ')})` : node.type;
  }
  return 'unknown';
}

function collectFields(
  node: JsonSchemaNode,
  prefix = '',
  required = false,
  depth = 0,
  out: FieldRow[] = [],
): FieldRow[] {
  if (depth > 4) return out;
  const union = (node.oneOf ?? node.anyOf) as JsonSchemaNode[] | undefined;

  if (node.type === 'object' && node.properties && typeof node.properties === 'object') {
    const props = node.properties as Record<string, JsonSchemaNode>;
    const reqSet = new Set(Array.isArray(node.required) ? (node.required as string[]) : []);
    for (const [key, child] of Object.entries(props)) {
      const childPath = prefix ? `${prefix}.${key}` : key;
      const isReq = reqSet.has(key);
      const descParts: string[] = [];
      if (typeof child.description === 'string') descParts.push(child.description);
      if (Array.isArray(child.enum) && child.enum.length > 8) {
        descParts.push(`全部枚举：${child.enum.map((v) => `\`${String(v)}\``).join(' / ')}`);
      }
      out.push({
        path: childPath,
        type: summarizeType(child),
        required: isReq,
        description: descParts.join('；') || '-',
      });
      if (child.type === 'object' && child.properties) {
        collectFields(child, childPath, isReq, depth + 1, out);
      } else if (child.type === 'array' && child.items && typeof child.items === 'object') {
        const itemSchema = child.items as JsonSchemaNode;
        if (itemSchema.type === 'object' && itemSchema.properties) {
          collectFields(itemSchema, `${childPath}[]`, false, depth + 1, out);
        }
      } else if (Array.isArray(child.oneOf ?? child.anyOf)) {
        const branches = (child.oneOf ?? child.anyOf) as JsonSchemaNode[];
        for (const branch of branches) {
          if (branch.type === 'object' && branch.properties) {
            const branchProps = branch.properties as Record<string, JsonSchemaNode>;
            const tag = branchProps.kind?.const ?? branchProps.mode?.const ?? branchProps.method?.const;
            const branchPrefix = tag !== undefined ? `${childPath}[${String(tag)}]` : `${childPath}[分支]`;
            collectFields(branch, branchPrefix, false, depth + 1, out);
          }
        }
      }
    }
    return out;
  }

  if (Array.isArray(union)) {
    for (const branch of union) {
      if (branch.type === 'object' && branch.properties) {
        const branchProps = branch.properties as Record<string, JsonSchemaNode>;
        const tag = branchProps.kind?.const ?? branchProps.mode?.const ?? branchProps.method?.const;
        const branchPrefix = tag !== undefined
          ? `${prefix ? `${prefix}` : ''}[${String(tag)}]`
          : `${prefix ? `${prefix}` : ''}[分支]`;
        collectFields(branch, branchPrefix, required, depth + 1, out);
      }
    }
  }
  return out;
}

function formatPromptCatalogSummary(entry: unknown): string {
  if (!entry || typeof entry !== 'object') return '无额外提示词选项。';
  const parts: string[] = [];
  for (const [k, v] of Object.entries(entry as Record<string, unknown>)) {
    if (k === 'note' && typeof v === 'string') {
      parts.push(`说明：${v}`);
      continue;
    }
    if (Array.isArray(v)) {
      const items = v.map((item) => {
        if (typeof item === 'string') return `\`${item}\``;
        if (item && typeof item === 'object' && 'id' in item) {
          const obj = item as { id: string; label?: string };
          return obj.label ? `\`${obj.id}\`(${obj.label})` : `\`${obj.id}\``;
        }
        return JSON.stringify(item);
      });
      parts.push(`\`${k}\`: ${items.join('、')}`);
    } else if (v && typeof v === 'object') {
      parts.push(`\`${k}\`: ${JSON.stringify(v)}`);
    } else {
      parts.push(`\`${k}\`: \`${String(v)}\``);
    }
  }
  return parts.join('；') || '无额外提示词选项。';
}

function verifyCategoryCoverage(): void {
  const listed = METHOD_CATEGORY_GROUPS.flatMap((g) => g.methods);
  const missing = methodIds.filter((m) => !listed.includes(m));
  if (missing.length) {
    throw new Error(`API 文档分类遗漏方法：${missing.join(', ')}`);
  }
}

export function generateApiDocsMarkdown(baseUrl = 'https://your-mingyu-domain.example'): string {
  verifyCategoryCoverage();
  const catalog = getPromptCatalog(methodIds) as Record<string, unknown>;
  const lines: string[] = [];

  lines.push('# 命语 V2 HTTP REST API 完整接入文档');
  lines.push('');
  lines.push(`> 本文档由当前服务真实的 Schema、提示词目录与可用示例自动生成，覆盖全部 ${methodIds.length} 种术数方法，供开发者与 AI Agent 直接阅读和接入。`);
  lines.push('');
  lines.push(`- **服务基础地址（示例）**：\`${baseUrl}\`（接入时请替换为实际部署域名，例如本地开发通常为 \`http://127.0.0.1:18788\`）`);
  lines.push('- **数据格式与跨域**：全接口使用 `application/json; charset=utf-8`，支持标准浏览器跨域（CORS 与 `OPTIONS` 预检）。');
  lines.push('- **OpenAPI 3.1 规范**：`/openapi.json`（可直接导入 Dify、Coze、FastGPT、n8n、Swagger）。');
  lines.push('- **MCP 极简路由模式**：`/mcp?mode=router` 仅注册 4 个核心工具（`list_methods` / `get_method_schema` / `calculate` / `reprompt`），比全量 42 个工具节省约 97% 上下文 Token。');
  lines.push('- **访问令牌（可选）**：若服务端配置了 `ACCESS_TOKEN` 环境变量，所有 `/api/*` 与 `/mcp` 请求须附带请求头 `Authorization: Bearer <你的令牌>`；未配置时公开访问。');
  lines.push('- **请求体上限**：单次请求体最大 1 MiB（1,048,576 字节）。');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 一、核心端点总览');
  lines.push('');
  lines.push('| 方法 | 路径 | 用途 | 关键参数 / 请求体 |');
  lines.push('| --- | --- | --- | --- |');
  lines.push('| `GET` | `/api/health` | 健康检查，返回运行状态与开放方法数量 | 无 |');
  lines.push('| `GET` | `/api/methods` | 查询当前服务开放的所有术数方法 ID | 无 |');
  lines.push('| `GET` | `/api/schema` | 获取所有（或指定）术数的输入 JSON Schema 与追问 Schema | 可选 `?method=bazi`（不传则返回全部） |');
  lines.push('| `GET` | `/api/prompts` | 获取所有（或指定）术数的提示词主题、流派与范围选项 | 可选 `?method=bazi` |');
  lines.push('| `POST` | `/api/calculate` | 执行排盘/占卜计算；可选 `responseMode: "compact"` 仅返摘要与追问令牌 | `{ "method": "方法名", "input": { ... }, "responseMode"?: "full" | "compact" }` |');
  lines.push('| `POST` | `/api/prompt` | 基于 `repromptToken` 或完整 `result` 生成追问提示词（免重排） | `{ "repromptToken": "...", "question": "新问题" }` 或完整 `result` |');
  lines.push('| `GET` | `/openapi.json` | 导出标准 OpenAPI 3.1 规范文件（静态资产） | 无 |');
  lines.push('');
  lines.push('## 二、标准接入三步走（AI 与后端必读）');
  lines.push('');
  lines.push('1. **确认方法与参数**：先调用 `GET /api/methods` 确认目标服务启用了哪些方法；如不确定字段，可拉取 `GET /api/schema?method=<方法名>` 和 `GET /api/prompts?method=<方法名>`。');
  lines.push('2. **首次计算并保存结果（推荐 AI Agent 使用 `compact` 省 Token 模式）**：');
  lines.push('   - 向 `POST /api/calculate` 发送 `{ "method": "<方法名>", "input": { ... }, "responseMode": "compact" }`。');
  lines.push('   - `compact` 模式只返回 `summary`、`prompt.text` 与压缩的 `repromptToken`，省略数十至数百 KB 的 `data` 原始树，避免大模型上下文溢出或截断。');
  lines.push('   - 若省略 `responseMode` 或传 `"full"`，则返回完整 `data` 结构供前端渲染与业务入库。');
  lines.push('3. **多轮追问（复用原盘，切勿重新抽牌/起卦）**：');
  lines.push('   - 针对同一命盘或同一卦象继续提问时，直接传入第 2 步拿到的 `repromptToken` 与新 `question`：`POST /api/prompt` 提交 `{ "repromptToken": "<令牌>", "question": "<新问题>" }`（也可传完整 `result` 对象）。');
  lines.push('   - 追问可选传 `prompt`（省略时沿用原结果中的 `promptOptions`；传 `{}` 可恢复默认）和带时区的 `currentTime`（仅改变提示词参考时间，不改变原盘）。');
  lines.push('   - 多数术数会在追问时根据保存的输入重算核对盘面，若篡改 `data` 会返回 `400` 校验失败。');
  lines.push('');
  lines.push('### 分页、时间范围与错误码约定');
  lines.push('');
  lines.push('- **游标分页**：`almanac`、`zhouyi`（检索）、`character-query`（筛选）、`bazi-synastry` / `ziwei-synastry`（变化事实比较）通过 `data.page.nextOffset` 或 `nextOffset` 续取；`astrolabe-range`、`qizheng-range` 通过 `nextIndex` / `nextCursor` 逐秒分页。');
  lines.push('- **时间与地理精度**：出生盘若涉及真太阳时、西洋星盘或七政四余，须提供准确 `timezone`（或 `timeZoneId`）与经纬度（`latitude` / `longitude`）；不确定的出生时间请使用 `birthRange` 或对应 `-range` 方法，不要自行猜测。');
  lines.push('- **常见 HTTP 状态码**：`200` 成功；`400` 方法未启用或参数校验失败（返回 `error` 详情）；`401` 缺少或无效 `Bearer` 令牌；`404` 路径不存在；`413` 请求体超过 1 MiB。');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(`## 三、全部 ${methodIds.length} 种术数方法参数与示例清单`);
  lines.push('');

  for (const group of METHOD_CATEGORY_GROUPS) {
    lines.push(`### 分类：${group.label}`);
    lines.push('');
    for (const method of group.methods) {
      const schema = z.toJSONSchema(inputSchemas[method]) as JsonSchemaNode;
      const desc = inputSchemas[method].description ?? methodLabels[method];
      const fields = collectFields(schema);
      const examplePayload = { method, input: methodExamples[method] };

      lines.push(`#### \`${method}\` · ${methodLabels[method]}`);
      lines.push('');
      lines.push(`- **用途说明**：${desc}`);
      lines.push(`- **提示词选项（\`prompt\`）**：${formatPromptCatalogSummary(catalog[method])}`);
      lines.push('');
      if (fields.length) {
        lines.push('| 参数路径 | 类型 | 必填 | 说明 |');
        lines.push('| --- | --- | --- | --- |');
        for (const row of fields) {
          lines.push(`| \`${row.path}\` | \`${escapeMdCell(row.type)}\` | ${row.required ? '是' : '否'} | ${escapeMdCell(row.description)} |`);
        }
        lines.push('');
      }
      lines.push('请求示例（`POST /api/calculate`）：');
      lines.push('');
      lines.push('```json');
      lines.push(JSON.stringify(examplePayload, null, 2));
      lines.push('```');
      lines.push('');
      if (method === 'calendar') {
        lines.push('其他 `calendar.kind` 示例：`solar-term`、`moon-phase`、`time-scales`、`true-solar`、`solar-illumination`：');
        lines.push('');
        lines.push('```json');
        lines.push(JSON.stringify(calendarExamples, null, 2));
        lines.push('```');
        lines.push('');
      }
    }
  }

  lines.push('---');
  lines.push('');
  lines.push('## 四、可运行客户端代码范例（零外部依赖）');
  lines.push('');
  lines.push('### Node.js (22.12+，原生 `fetch`)');
  lines.push('');
  lines.push('```javascript');
  lines.push(`const BASE_URL = '${baseUrl}';`);
  lines.push(`const ACCESS_TOKEN = ''; // 若服务端启用了 ACCESS_TOKEN 请填写`);
  lines.push('');
  lines.push('async function postApi(path, body) {');
  lines.push('  const res = await fetch(`${BASE_URL}${path}`, {');
  lines.push("    method: 'POST',");
  lines.push('    headers: {');
  lines.push("      'content-type': 'application/json',");
  lines.push("      ...(ACCESS_TOKEN ? { authorization: `Bearer ${ACCESS_TOKEN}` } : {}),");
  lines.push('    },');
  lines.push('    body: JSON.stringify(body),');
  lines.push('  });');
  lines.push('  const data = await res.json();');
  lines.push('  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(data.error)}`);');
  lines.push('  return data;');
  lines.push('}');
  lines.push('');
  lines.push("// 1. 首次排盘/抽牌（推荐传入 responseMode: 'compact' 节省上下文与流量）");
  lines.push("const first = await postApi('/api/calculate', {");
  lines.push("  method: 'tarot',");
  lines.push("  input: { question: '近期工作应注意什么？', tarot: { spread: 'three' } },");
  lines.push("  responseMode: 'compact',");
  lines.push('});');
  lines.push('console.log(first.prompt.text);');
  lines.push('');
  lines.push('// 2. 原盘追问（直接复用 repromptToken，不重新抽牌，也无需回传大体积 data）');
  lines.push("const followup = await postApi('/api/prompt', {");
  lines.push('  repromptToken: first.repromptToken,');
  lines.push("  question: '针对这组牌，接下来可以如何行动？',");
  lines.push('});');
  lines.push('console.log(followup.prompt.text);');
  lines.push('```');
  lines.push('');
  lines.push('### Python (3.9+，标准库 `urllib`)');
  lines.push('');
  lines.push('```python');
  lines.push('import json');
  lines.push('from urllib.request import Request, urlopen');
  lines.push('');
  lines.push(`BASE_URL = '${baseUrl}'`);
  lines.push("ACCESS_TOKEN = ''  # 可选");
  lines.push('');
  lines.push('def post_api(path, payload):');
  lines.push("    headers = {'content-type': 'application/json'}");
  lines.push('    if ACCESS_TOKEN:');
  lines.push("        headers['authorization'] = f'Bearer {ACCESS_TOKEN}'");
  lines.push("    req = Request(f'{BASE_URL}{path}', data=json.dumps(payload, ensure_ascii=False).encode('utf-8'), headers=headers, method='POST')");
  lines.push('    with urlopen(req, timeout=30) as resp:');
  lines.push('        return json.load(resp)');
  lines.push('');
  lines.push("# 1. 首次计算（compact 模式仅返回摘要、prompt.text 与 repromptToken）");
  lines.push("first = post_api('/api/calculate', {");
  lines.push("    'method': 'tarot',");
  lines.push("    'input': {'question': '近期工作应注意什么？', 'tarot': {'spread': 'three'}},");
  lines.push("    'responseMode': 'compact',");
  lines.push('})');
  lines.push("print(first['prompt']['text'])");
  lines.push('');
  lines.push('# 2. 基于 repromptToken 原盘追问');
  lines.push("followup = post_api('/api/prompt', {");
  lines.push("    'repromptToken': first['repromptToken'],");
  lines.push("    'question': '针对这组牌，接下来可以如何行动？',");
  lines.push('})');
  lines.push("print(followup['prompt']['text'])");
  lines.push('```');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 五、远程 MCP 与工作流平台对接指引');
  lines.push('');
  lines.push('- **AI Agent 远程 MCP（强烈推荐极简路由模式）**：');
  lines.push(`  - 端点地址：\`${baseUrl}/mcp?mode=router\`（Streamable HTTP）`);
  lines.push('  - 该模式仅暴露 4 个工具：`list_methods`、`get_method_schema`、`calculate`（默认 `compact` 并返 `repromptToken`）、`reprompt`，相比全量 42 工具模式节省约 97% 上下文 Token。');
  lines.push(`  - 全量兼容端点：\`${baseUrl}/mcp\`（直接注册全部方法名与 \`reprompt\` / \`prompt_catalog\`）。`);
  lines.push(`- **Dify / Coze / FastGPT / n8n 工作流导入**：直接填入 \`${baseUrl}/openapi.json\` 导入标准 OpenAPI 3.1 规范。`);
  lines.push('');

  return lines.join('\n');
}

export function generateApiDocsHtml(): string {
  verifyCategoryCoverage();
  const catalog = getPromptCatalog(methodIds) as Record<string, unknown>;
  const markdownContent = generateApiDocsMarkdown('https://your-mingyu-domain.example');

  const navGroupsHtml = METHOD_CATEGORY_GROUPS.map((group) => {
    const links = group.methods
      .map(
        (m) =>
          `<a class="doc-nav-item" href="#method-${m}" data-search-target="${escapeHtml(`${m} ${methodLabels[m]}`)}"><code>${m}</code><span>${escapeHtml(methodLabels[m])}</span></a>`,
      )
      .join('');
    return `<div class="doc-nav-group"><div class="doc-nav-group-title">${escapeHtml(group.label)}</div>${links}</div>`;
  }).join('');

  const methodsHtml = METHOD_CATEGORY_GROUPS.map((group) => {
    const cards = group.methods
      .map((method) => {
        const schema = z.toJSONSchema(inputSchemas[method]) as JsonSchemaNode;
        const desc = inputSchemas[method].description ?? methodLabels[method];
        const fields = collectFields(schema);
        const examplePayload = JSON.stringify({ method, input: methodExamples[method] }, null, 2);
        const rowsHtml = fields.length
          ? `<div class="doc-table-wrap"><table class="doc-table"><thead><tr><th>参数路径</th><th>类型</th><th>必填</th><th>说明</th></tr></thead><tbody>${fields
              .map(
                (f) =>
                  `<tr><td><code>${escapeHtml(f.path)}</code></td><td><code>${escapeHtml(f.type)}</code></td><td>${
                    f.required ? '<span class="req-yes">是</span>' : '<span class="req-no">否</span>'
                  }</td><td>${escapeHtml(f.description)}</td></tr>`,
              )
              .join('')}</tbody></table></div>`
          : '';
        const calendarExtra =
          method === 'calendar'
            ? `<details class="doc-details"><summary>查看全部 5 种 calendar.kind 请求示例</summary><div class="code-box"><div class="code-head"><span>JSON · calendar 示例集</span><button type="button" class="copy-btn" data-copy-target="next">复制 JSON</button></div><pre>${escapeHtml(
                JSON.stringify(calendarExamples, null, 2),
              )}</pre></div></details>`
            : '';

        return `
<article class="method-card" id="method-${method}" data-method-card data-search="${escapeHtml(`${method} ${methodLabels[method]} ${desc}`.toLowerCase())}">
  <div class="method-head">
    <div class="method-title-row">
      <code class="method-id">${method}</code>
      <h3>${escapeHtml(methodLabels[method])}</h3>
      <span class="cat-badge">${escapeHtml(group.label)}</span>
    </div>
    <p class="method-desc">${escapeHtml(desc)}</p>
    <p class="method-prompt-note"><strong>提示词选项 (prompt)：</strong>${escapeHtml(formatPromptCatalogSummary(catalog[method]))}</p>
  </div>
  ${rowsHtml}
  <div class="code-box">
    <div class="code-head"><span>POST /api/calculate · 示例请求体</span><button type="button" class="copy-btn" data-copy-target="next">复制 JSON</button></div>
    <pre>${escapeHtml(examplePayload)}</pre>
  </div>
  <div class="code-box">
    <div class="code-head"><span>cURL · 直接调用</span><button type="button" class="copy-btn" data-copy-target="next">复制 cURL</button></div>
    <pre class="curl-snippet" data-curl-json="${escapeHtml(JSON.stringify({ method, input: methodExamples[method] }))}">curl -X POST 'https://your-mingyu-domain.example/api/calculate' -H 'content-type: application/json' -d '${escapeHtml(
          JSON.stringify({ method, input: methodExamples[method] }).replace(/'/g, `'\\''`),
        )}'</pre>
  </div>
  ${calendarExtra}
</article>`;
      })
      .join('');

    return `<section class="category-section" id="cat-${group.id}"><h2 class="section-heading">${escapeHtml(group.label)}</h2>${cards}</section>`;
  }).join('');

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>命语 V2 · HTTP REST API 完整接入文档</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #f8f6f2;
      --surface: #ffffff;
      --surface-soft: #f2efe9;
      --border: rgba(28, 25, 23, 0.12);
      --text: #1c1917;
      --muted: #57534e;
      --accent: #b83b2b;
      --accent-soft: rgba(184, 59, 43, 0.1);
      --code-bg: #1e1b18;
      --code-text: #f5f2eb;
      --ok: #15803d;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #141210;
        --surface: #1d1a17;
        --surface-soft: #26221e;
        --border: rgba(245, 242, 235, 0.14);
        --text: #f3efe8;
        --muted: #a8a29e;
        --accent: #e06352;
        --accent-soft: rgba(224, 99, 82, 0.16);
        --code-bg: #110f0d;
        --code-text: #efeae0;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.65;
    }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .topbar {
      position: sticky;
      top: 0;
      z-index: 20;
      background: color-mix(in srgb, var(--surface) 92%, transparent);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--border);
    }
    .topbar-inner {
      max-width: 1360px;
      margin: 0 auto;
      padding: 12px 20px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 16px; color: var(--text); }
    .seal {
      width: 28px; height: 28px; border-radius: 7px; display: inline-grid; place-items: center;
      background: var(--accent); color: #fff; font-size: 14px;
    }
    .top-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .btn {
      display: inline-flex; align-items: center; gap: 6px; padding: 7px 13px; border-radius: 8px;
      border: 1px solid var(--border); background: var(--surface); color: var(--text);
      font-size: 13px; cursor: pointer; font-weight: 500;
    }
    .btn:hover { border-color: var(--accent); text-decoration: none; }
    .btn-primary { background: var(--accent); border-color: var(--accent); color: #fff; }
    .btn-primary:hover { opacity: 0.92; }
    .layout {
      max-width: 1360px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 270px minmax(0, 1fr);
      gap: 24px;
      padding: 24px 20px 64px;
    }
    .sidebar {
      position: sticky;
      top: 72px;
      max-height: calc(100vh - 92px);
      overflow: auto;
      padding: 14px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
    }
    .search-input {
      width: 100%;
      padding: 8px 11px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--surface-soft);
      color: var(--text);
      font-size: 13px;
      margin-bottom: 12px;
    }
    .doc-nav-group { margin-bottom: 14px; }
    .doc-nav-group-title { font-size: 12px; font-weight: 700; color: var(--muted); margin: 6px 4px; }
    .doc-nav-item {
      display: flex; justify-content: space-between; align-items: center; gap: 8px;
      padding: 5px 8px; border-radius: 7px; font-size: 12.5px; color: var(--text);
    }
    .doc-nav-item:hover { background: var(--surface-soft); text-decoration: none; }
    .doc-nav-item code { color: var(--accent); font-size: 11.5px; }
    .doc-nav-item span { color: var(--muted); font-size: 11.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .content { min-width: 0; display: flex; flex-direction: column; gap: 24px; }
    .hero, .doc-card, .method-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 22px 24px;
    }
    .hero h1 { margin: 0 0 8px; font-size: 24px; }
    .hero p { margin: 0 0 14px; color: var(--muted); }
    .ai-banner {
      background: var(--surface-soft);
      border: 1px dashed var(--accent);
      border-radius: 12px;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .ai-banner-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
    .ai-prompt-pre {
      margin: 0; padding: 12px; border-radius: 8px; background: var(--code-bg); color: var(--code-text);
      font-size: 12.5px; white-space: pre-wrap; word-break: break-word;
    }
    .section-heading { font-size: 20px; margin: 8px 0 14px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }
    .doc-table-wrap { overflow-x: auto; margin: 12px 0; }
    .doc-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .doc-table th, .doc-table td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); vertical-align: top; }
    .doc-table th { background: var(--surface-soft); font-weight: 600; white-space: nowrap; }
    .req-yes { color: var(--accent); font-weight: 700; }
    .req-no { color: var(--muted); }
    .method-card { margin-bottom: 16px; }
    .method-title-row { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 6px; }
    .method-title-row h3 { margin: 0; font-size: 17px; }
    .method-id { background: var(--accent-soft); color: var(--accent); padding: 2px 8px; border-radius: 6px; font-weight: 700; font-size: 13px; }
    .cat-badge { font-size: 12px; color: var(--muted); background: var(--surface-soft); padding: 2px 8px; border-radius: 999px; }
    .method-desc { margin: 4px 0; color: var(--text); font-size: 14px; }
    .method-prompt-note { margin: 6px 0 0; color: var(--muted); font-size: 13px; }
    .code-box { margin-top: 12px; border-radius: 10px; overflow: hidden; border: 1px solid var(--border); }
    .code-head {
      display: flex; justify-content: space-between; align-items: center; padding: 6px 12px;
      background: var(--surface-soft); font-size: 12px; color: var(--muted);
    }
    .copy-btn {
      border: 1px solid var(--border); background: var(--surface); color: var(--text);
      padding: 3px 9px; border-radius: 6px; font-size: 12px; cursor: pointer;
    }
    .copy-btn.is-copied { border-color: var(--ok); color: var(--ok); }
    .code-box pre {
      margin: 0; padding: 12px 14px; background: var(--code-bg); color: var(--code-text);
      font-size: 12.5px; overflow-x: auto;
    }
    .doc-details { margin-top: 10px; }
    .doc-details summary { cursor: pointer; font-size: 13px; color: var(--accent); font-weight: 500; }
    .hidden { display: none !important; }
    @media (max-width: 920px) {
      .layout { grid-template-columns: 1fr; }
      .sidebar { position: static; max-height: none; }
    }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="topbar-inner">
      <div class="brand">
        <span class="seal">语</span>
        <span>命语 V2 · HTTP REST API 完整接入文档</span>
      </div>
      <div class="top-actions">
        <a class="btn" href="/">← 返回工作台</a>
        <a class="btn" href="/openapi.json" target="_blank" rel="noopener">OpenAPI 3.1 (.json)</a>
        <a class="btn" href="/api-docs.md" target="_blank" rel="noopener">查看纯文本版 (.md)</a>
        <button type="button" class="btn" id="copy-md-url-btn">复制 AI 文档直链</button>
        <button type="button" class="btn btn-primary" id="copy-full-md-btn">复制完整 Markdown</button>
      </div>
    </div>
  </header>

  <div class="layout">
    <aside class="sidebar" aria-label="文档目录">
      <input type="search" id="doc-search" class="search-input" placeholder="搜索术数（如 bazi / 紫微 / 塔罗）">
      <div class="doc-nav-group">
        <div class="doc-nav-group-title">接入指南</div>
        <a class="doc-nav-item" href="#overview"><span>接口总览与三步流程</span></a>
        <a class="doc-nav-item" href="#rules"><span>分页、时区与错误码</span></a>
        <a class="doc-nav-item" href="#sdk-examples"><span>Node.js / Python 示例</span></a>
      </div>
      ${navGroupsHtml}
    </aside>

    <main class="content">
      <section class="hero" id="overview">
        <h1>命语 V2 HTTP REST API 接口文档</h1>
        <p>无状态 JSON 协议，覆盖全部 ${methodIds.length} 种传统术数与历法典籍工具。人类开发者可直接查阅下方字段与示例；使用 AI Agent 接入时，直接把下方提示词复制发给 AI 即可。</p>
        <div class="ai-banner">
          <div class="ai-banner-head">
            <strong>给 AI Agent 的一键接入指令（含 Markdown 文档直链）</strong>
            <button type="button" class="btn btn-primary copy-btn" id="copy-ai-prompt-btn">复制指令给 AI</button>
          </div>
          <pre class="ai-prompt-pre" id="ai-prompt-text"></pre>
        </div>
      </section>

      <section class="doc-card" id="endpoints">
        <h2 class="section-heading">一、核心 HTTP 端点</h2>
        <p>当前检测到的服务地址：<code id="live-origin-label">https://your-mingyu-domain.example</code>（若部署了 <code>ACCESS_TOKEN</code>，所有请求须加 <code>Authorization: Bearer &lt;令牌&gt;</code> 请求头）。</p>
        <div class="doc-table-wrap">
          <table class="doc-table">
            <thead><tr><th>方法</th><th>路径</th><th>用途</th><th>参数 / 请求体</th></tr></thead>
            <tbody>
              <tr><td><code>GET</code></td><td><code>/api/health</code></td><td>健康检查，返回运行状态与开放方法数量</td><td>无</td></tr>
              <tr><td><code>GET</code></td><td><code>/api/methods</code></td><td>获取当前开放的所有术数方法 ID</td><td>无</td></tr>
              <tr><td><code>GET</code></td><td><code>/api/schema</code></td><td>获取输入参数 JSON Schema 与追问 Schema</td><td>可选 <code>?method=bazi</code></td></tr>
              <tr><td><code>GET</code></td><td><code>/api/prompts</code></td><td>获取提示词主题、流派与范围选项</td><td>可选 <code>?method=bazi</code></td></tr>
              <tr><td><code>POST</code></td><td><code>/api/calculate</code></td><td>执行排盘；支持 <code>responseMode: "compact"</code> 仅返摘要与追问令牌</td><td><code>{ "method": "bazi", "input": { ... }, "responseMode": "compact" }</code></td></tr>
              <tr><td><code>POST</code></td><td><code>/api/prompt</code></td><td>基于 <code>repromptToken</code> 或完整 <code>result</code> 追问，不重排</td><td><code>{ "repromptToken": "...", "question": "新问题" }</code></td></tr>
              <tr><td><code>GET</code></td><td><code>/openapi.json</code></td><td>标准 OpenAPI 3.1 规范（支持 Dify/Coze/FastGPT 直接导入）</td><td>无</td></tr>
              <tr><td><code>POST</code></td><td><code>/mcp?mode=router</code></td><td>极简 4 工具远程 MCP 模式（节省约 97% 工具定义上下文）</td><td>Streamable HTTP</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="doc-card" id="rules">
        <h2 class="section-heading">二、接入规范与注意事项</h2>
        <ul>
          <li><strong>首次算盘与追问分离</strong>：调用 <code>POST /api/calculate</code> 后完整保存返回的 JSON；用户追问时调用 <code>POST /api/prompt</code> 传回完整 <code>result</code> 与新 <code>question</code>，随机类术数（六爻、塔罗、灵签等）严禁追问时重新算盘。</li>
          <li><strong>提示词读取</strong>：直接把返回对象中的 <code>prompt.text</code> 交给大模型，里面已包含完整盘面事实与理法约束。</li>
          <li><strong>分页续取</strong>：黄历（<code>almanac</code>）、周易检索（<code>zhouyi</code>）、汉字筛选（<code>character-query</code>）和合盘变化比较通过 <code>nextOffset</code> 续页；七政与星盘出生范围（<code>qizheng-range</code> / <code>astrolabe-range</code>）按 <code>nextIndex</code> / <code>nextCursor</code> 逐秒分页。</li>
          <li><strong>错误码</strong>：<code>400</code> 参数或方法无效；<code>401</code> 缺少或错误 Bearer Token；<code>404</code> 路由不存在；<code>413</code> 请求体超出 1 MiB。</li>
        </ul>
      </section>

      ${methodsHtml}

      <section class="doc-card" id="sdk-examples">
        <h2 class="section-heading">三、零依赖客户端代码范例（compact + repromptToken）</h2>
        <div class="code-box">
          <div class="code-head"><span>Node.js (22.12+) · compact + repromptToken</span><button type="button" class="copy-btn" data-copy-target="next">复制 JS 代码</button></div>
          <pre class="origin-replace-pre">const BASE_URL = 'https://your-mingyu-domain.example';
const res = await fetch(\`\${BASE_URL}/api/calculate\`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    method: 'tarot',
    input: { question: '近期工作应注意什么？', tarot: { spread: 'three' } },
    responseMode: 'compact',
  }),
});
const first = await res.json();
console.log(first.prompt.text);

const followRes = await fetch(\`\${BASE_URL}/api/prompt\`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ repromptToken: first.repromptToken, question: '接下来可以如何行动？' }),
});
const followup = await followRes.json();
console.log(followup.prompt.text);</pre>
        </div>
        <div class="code-box">
          <div class="code-head"><span>Python (3.9+) · 标准库 urllib</span><button type="button" class="copy-btn" data-copy-target="next">复制 Python 代码</button></div>
          <pre class="origin-replace-pre">import json
from urllib.request import Request, urlopen

BASE_URL = 'https://your-mingyu-domain.example'

def post_api(path, payload):
    req = Request(f'{BASE_URL}{path}', data=json.dumps(payload, ensure_ascii=False).encode('utf-8'),
                  headers={'content-type': 'application/json'}, method='POST')
    with urlopen(req, timeout=30) as resp:
        return json.load(resp)

first = post_api('/api/calculate', {
    'method': 'tarot',
    'input': {'question': '近期工作应注意什么？', 'tarot': {'spread': 'three'}},
    'responseMode': 'compact',
})
print(first['prompt']['text'])
followup = post_api('/api/prompt', {'repromptToken': first['repromptToken'], 'question': '接下来可以如何行动？'})
print(followup['prompt']['text'])</pre>
        </div>
      </section>
    </main>
  </div>

  <script id="raw-markdown-data" type="application/json">${JSON.stringify(markdownContent).replace(/</g, '\\u003c')}</script>
  <script>
    (function () {
      const origin = (window.location.origin && window.location.origin !== 'null')
        ? window.location.origin
        : 'https://your-mingyu-domain.example';
      const mdUrl = origin + '/api-docs.md';
      const openApiUrl = origin + '/openapi.json';
      const mcpRouterUrl = origin + '/mcp?mode=router';
      document.getElementById('live-origin-label').textContent = origin;

      const aiPrompt = [
        '请先完整阅读这份命语 V2 API 接口文档（纯 Markdown 版）：',
        mdUrl,
        '',
        '补充可用资源：',
        '- OpenAPI 3.1 规范：' + openApiUrl,
        '- 极简远程 MCP（仅 4 个核心工具，最省 Token）：' + mcpRouterUrl,
        '',
        '阅读后请优先采用 responseMode: "compact" 与 repromptToken（或 /mcp?mode=router）完成接入与调用，避免大体积 JSON 占满上下文。',
      ].join('\\n');
      document.getElementById('ai-prompt-text').textContent = aiPrompt;

      document.querySelectorAll('.curl-snippet').forEach(function (node) {
        const raw = node.getAttribute('data-curl-json');
        if (!raw) return;
        node.textContent = "curl -X POST '" + origin + "/api/calculate' \\\\\\n  -H 'content-type: application/json' \\\\\\n  -d '" + raw.replace(/'/g, "'\\\\''") + "'";
      });

      document.querySelectorAll('.origin-replace-pre').forEach(function (node) {
        node.textContent = node.textContent.replaceAll('https://your-mingyu-domain.example', origin);
      });

      function copyWithFeedback(btn, text) {
        const prev = btn.textContent;
        navigator.clipboard.writeText(text).then(function () {
          btn.textContent = '✓ 已复制';
          btn.classList.add('is-copied');
          setTimeout(function () {
            btn.textContent = prev;
            btn.classList.remove('is-copied');
          }, 1600);
        });
      }

      document.getElementById('copy-md-url-btn').addEventListener('click', function () {
        copyWithFeedback(this, mdUrl);
      });
      document.getElementById('copy-ai-prompt-btn').addEventListener('click', function () {
        copyWithFeedback(this, aiPrompt);
      });
      document.getElementById('copy-full-md-btn').addEventListener('click', function () {
        const rawMd = JSON.parse(document.getElementById('raw-markdown-data').textContent || '""');
        copyWithFeedback(this, rawMd.replaceAll('https://your-mingyu-domain.example', origin));
      });
      document.querySelectorAll('.copy-btn[data-copy-target="next"]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const pre = btn.closest('.code-box').querySelector('pre');
          if (pre) copyWithFeedback(btn, pre.textContent || '');
        });
      });

      const searchInput = document.getElementById('doc-search');
      const cards = Array.from(document.querySelectorAll('[data-method-card]'));
      const navItems = Array.from(document.querySelectorAll('.doc-nav-item[data-search-target]'));
      searchInput.addEventListener('input', function () {
        const kw = searchInput.value.trim().toLowerCase();
        cards.forEach(function (card) {
          const matched = !kw || (card.getAttribute('data-search') || '').includes(kw);
          card.classList.toggle('hidden', !matched);
        });
        navItems.forEach(function (item) {
          const matched = !kw || (item.getAttribute('data-search-target') || '').toLowerCase().includes(kw);
          item.classList.toggle('hidden', !matched);
        });
        document.querySelectorAll('.category-section').forEach(function (sec) {
          const hasVisible = sec.querySelector('[data-method-card]:not(.hidden)');
          sec.classList.toggle('hidden', Boolean(kw) && !hasVisible);
        });
      });
    })();
  </script>
</body>
</html>
`;
}
