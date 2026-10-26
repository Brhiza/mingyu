# 排查复现方法与实际验证结果

日期：2026-10-26。基线：`6d0aaa10730ad156bb73a053a6e04b67b26d8c91`。

本文复现修复前的审计问题，样例中的旧预期仅适用于该基线。后续实现已经修复，正确行为、现行命令和最终验证见 [修复记录](2026-10-26-remediation.md)。

主文档：[维护复杂度系统排查报告](2026-10-26-maintainability-review.md)。覆盖：[系统地图与覆盖记录](2026-10-26-coverage.md)。安装后的完整结果见 [第二阶段运行验证](2026-10-26-runtime-validation.md)，可执行命令见本文第 7 节。

## 1. 两阶段执行环境与边界

- Node `v24.21.0`，pnpm `11.9.0`，macOS arm64；第二阶段另以 Node `v22.23.4` 验证产物/包运行。
- 开始工作区干净；受控内容仅新增 `docs/audits/` 文档。
- 第一阶段没有依赖或 dist，先以零依赖探针固定问题；下文第 2—5 节保留该阶段结果与复现方式。
- 用户要求深入后已按锁安装、完成各运行面构建和完整回归，新增证据脚本/日志存于被忽略的 `.local/audits/2026-10-26-runtime/`。没有改源码、配置或锁文件，没有发布或调用真实模型。
- 下述内存 TypeScript loader 仅是第一阶段审计手段，依赖 Node 24；第二阶段已用正常 tsx、真实包与 SDK 复核，不代表已验证 Node 18 支持。

## 2. 第一阶段已实际执行的检查

| 检查 | 实际结果 | 能证明与不能证明的内容 |
| --- | --- | --- |
| 包体积/Pages 体积/构建信号定向测试 | 8 passed，0 failed | 验证门禁辅助函数及构建失败退出；未构建真实产物或测真实大小 |
| JS 构建/验证/工具脚本语法 | 23 文件，0 失败 | 只证明语法完整，不证明运行时路径可执行 |
| AI 代理损坏 JSON 探针 | HTTP 200，保留部分正文和 DONE，没有 error | 真实代理在 mock 上游下丢掉损坏事件；没有浏览器/真实模型验证 |
| 核心错误分类探针 | 两条真实八宅输入错误均变 calculation/CORE_EXECUTION_FAILED | 真实分类器与真实源消息组合；未执行完整八宅/client 链 |
| MCP 类型错误探针 | RANDOM_REPLAY_EXHAUSTED/field replay 变 MCP_TOOL_ERROR/无字段 | 执行真实 random、错误提取和 MCP mapper；未启动 SDK transport |
| 合参自定义 patch 探针 | 八字主题清空、紫微主题残留；有效主题仍 career | 执行真实 patch 并按真实 fallback 表达式组合；没有页面点击验证 |
| 静态导入/测试选择统计 | src 151 包导入/0源码；tests 301源码/142包/50混用；核心文本选取363/422 | 定位双轨依赖与分类规则；含类型/字面量导入，不是运行时模块实例证明 |

上表仅是第一阶段执行记录。第二阶段已补齐全量回归、类型检查、各运行面构建、穷举、选定浏览器主题交互、有限 Worker 宿主、Android debug/JVM、隔离 tarball 消费与本机测量。外部 npm 使用情况、线上性能、真实设备和真实模型仍未验证；不能把第一阶段限制当作当前状态。

### 已执行定向测试命令

在仓库根目录执行：

```bash
node --test --test-concurrency=1 \
  tests/package-size-budget.test.ts \
  tests/pages-functions-size-budget.test.ts \
  tests/run-vite-build.test.ts
```

实际汇总：

```text
tests 8
pass 8
fail 0
cancelled 0
skipped 0
```

JS 语法检查：

```bash
python3 - <<'PY'
from pathlib import Path
import subprocess
root = Path.cwd()
files = sorted(
    p for base in ['scripts', 'packages/core/scripts']
    for p in (root / base).rglob('*')
    if p.suffix in ('.js', '.mjs', '.cjs')
)
failed = []
for path in files:
    result = subprocess.run(['node', '--check', str(path)], capture_output=True, text=True)
    if result.returncode:
        failed.append((str(path.relative_to(root)), result.stderr.strip()))
print('checked:', len(files), 'failed:', len(failed))
for item in failed:
    print(item)
PY
```

结果为 `checked: 23 failed: 0`。

## 3. 零依赖真实模块探针

下面将本轮分别执行的三个内存探针合并为一个可复现命令。所有网络入口均由 `runtime.fetch` mock；不会安装包或写仓库文件。需要在仓库根目录使用本轮 Node 24 环境执行。

它使用真实 `proxy.ts`、`shared/result.ts`、`shared/random.ts`、`tool-results.ts` 和 `prompt-page-rules.ts`；TS 仅在内存去类型。它不把完整界面/SDK 端到端测试替换掉。

```bash
node --disable-warning=ExperimentalWarning --input-type=module <<'NODE'
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const auditRoot = process.cwd();
const prefix = pathToFileURL(auditRoot + '/').href;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('.') && context.parentURL?.startsWith(prefix)) {
      const base = resolve(dirname(fileURLToPath(context.parentURL)), specifier);
      for (const candidate of [base.replace(/\.js$/, '.ts'), base + '.ts', base + '/index.ts']) {
        if (existsSync(candidate) && statSync(candidate).isFile()) {
          return { url: pathToFileURL(candidate).href, shortCircuit: true };
        }
      }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith(prefix) && url.endsWith('.ts')) {
      return {
        format: 'module',
        source: stripTypeScriptTypes(readFileSync(fileURLToPath(url), 'utf8'), { mode: 'transform' }),
        shortCircuit: true,
      };
    }
    return next(url, context);
  },
});

const { handleAiAnalyze } = await import(prefix + 'src/lib/ai/proxy.ts');
const upstream = 'data: {"choices":[{"delta":{"content":"半段正文"}}]}\n\ndata: {"choices":\n\ndata: [DONE]\n\n';
const response = await handleAiAnalyze(
  new Request('https://app.example/api/v1/ai/analyze', {
    method: 'POST',
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'mock' }],
      aiConfig: {
        mode: 'custom', apiKey: 'mock',
        baseUrl: 'https://provider.example/v1', model: 'mock',
      },
    }),
  }),
  {},
  { fetch: async () => new Response(upstream) },
);
const body = await response.text();
assert.equal(response.status, 200);
assert.match(body, /半段正文/);
assert.match(body, /data: \[DONE\]/);
assert.doesNotMatch(body, /"error"/);

const { normalizeCoreError } = await import(prefix + 'packages/core/src/shared/result.ts');
const source = readFileSync(auditRoot + '/packages/core/src/ba_zhai/index.ts', 'utf8');
const messages = [...source.matchAll(/throw new Error\('([^']+)'\)/g)]
  .map(item => item[1])
  .filter(text => text.startsWith('只有 northReference') || text.startsWith('提供出生分钟'));
assert.equal(messages.length, 2);
const coreErrors = messages.map(message => {
  const error = normalizeCoreError(new Error(message));
  return { message, category: error.category, code: error.code, recoverable: error.recoverable };
});
assert.ok(coreErrors.every(error => error.category === 'calculation'));

const { createRandomContext } = await import(prefix + 'packages/core/src/shared/random.ts');
const { createErrorToolResult, getErrorMessage } = await import(prefix + 'mcp/src/tool-results.ts');
let replayError;
try {
  const replay = createRandomContext({ replay: [0.5] });
  replay.random();
  replay.random();
} catch (error) {
  replayError = error;
}
assert.equal(replayError?.code, 'RANDOM_REPLAY_EXHAUSTED');
const mapped = createErrorToolResult(getErrorMessage(replayError, 'failed')).structuredContent;
assert.equal(mapped.code, 'MCP_TOOL_ERROR');
assert.equal(mapped.missingFields, undefined);
const cursor = createErrorToolResult('startIndex 超出资料范围。').structuredContent;
assert.equal(cursor.code, 'RESOURCE_LIMIT');

const { buildBaziCustomPromptPatch } = await import(prefix + 'src/lib/prompt-page-rules.ts');
const selection = {
  baziTopicId: 'career', baziSubtopicId: 'job-change',
  ziweiTopicId: 'career', ziweiSubtopicId: 'job-change',
  ...buildBaziCustomPromptPatch(),
};
const effectiveTopic = selection.baziTopicId || selection.ziweiTopicId;
assert.equal(selection.baziTopicId, '');
assert.equal(effectiveTopic, 'career');

console.log(JSON.stringify({
  aiProxy: { httpStatus: response.status, body },
  coreErrors,
  replay: {
    originalCode: replayError.code,
    originalField: replayError.field,
    mapped,
  },
  cursor,
  selection,
  effectiveTopic,
}, null, 2));
NODE
```

关键观测：

```text
AI proxy: data: {"content":"半段正文"} ... data: [DONE]，无 error
八宅源消息 1: calculation / CORE_EXECUTION_FAILED / recoverable false
八宅源消息 2: calculation / CORE_EXECUTION_FAILED / recoverable false
随机重放: RANDOM_REPLAY_EXHAUSTED / replay -> MCP_TOOL_ERROR / 无 missingFields
游标越界文本: RESOURCE_LIMIT / retryable true
合参自定义后有效主题: career，细项残留 job-change
```

这些探针刻意断言当前问题存在，用于证据复现。实施修复后断言应随正确契约更新，不能把它们原样当作长期“通过即正确”的测试。

## 4. 静态导入与测试范围复现

下面按 literal `from/import()` 路径统计文件，包含类型导入，忽略字符串拼接和注释等复杂语法精确性。用于定位，不是 AST 模块依赖证明。

```bash
python3 - <<'PY'
from pathlib import Path
import re
root = Path.cwd()
import_prefix = r'''(?:from\s+|import\s*\()["']'''
source_import = re.compile(import_prefix + r'''(?:@core/|[^"']*packages/core/src/)''')
package_import = re.compile(import_prefix + r'''mingyu-core(?:/|["'])''')
for folder in ['src', 'tests', 'scripts']:
    count_source = count_package = count_mixed = 0
    for path in (root / folder).rglob('*'):
        if path.suffix not in ('.ts', '.tsx', '.js', '.mjs'):
            continue
        text = path.read_text(errors='replace')
        a = bool(source_import.search(text))
        b = bool(package_import.search(text))
        count_source += a
        count_package += b
        count_mixed += a and b
    print(folder, {'source': count_source, 'package': count_package, 'mixed': count_mixed})
files = [path for path in (root / 'tests').glob('*.test.*') if path.suffix in ('.ts', '.tsx')]
selected = [path for path in files if re.search(r'packages/core/src|mingyu-core|@core/', path.read_text())]
print('core test runner textual selections:', len(selected), '/', len(files))
PY
```

实际结果：

```text
src     source 0    package 151  mixed 0
tests   source 301  package 142  mixed 50
scripts source 4    package 4    mixed 1
core test runner textual selections: 363 / 422
```

同一文件可以计入两组，不能把 301+142 当成不同文件总数。`scripts/generate-prompt-audit.ts` 是混用样本；测试源码和包契约可以分轨保留，问题是职责和新鲜度边界不清晰。

## 5. 历史窗口复现

首先固定提交集合：

```bash
git log -200 --no-merges \
  --format='%H %cI %aI %s' \
  6d0aaa10730ad156bb73a053a6e04b67b26d8c91
```

本轮热点统计按这些提交逐个 `diff-tree`，排除文档、测试、数据、生成和 vendor，含构建/部署。以下 Python 版本表达相同筛选意图，不依赖 shell 分隔输出：

```bash
python3 - <<'PY'
from collections import Counter
from pathlib import Path
import re
import subprocess
root = Path.cwd()
tip = '6d0aaa10730ad156bb73a053a6e04b67b26d8c91'
def git(*args):
    return subprocess.check_output(['git', '-C', str(root), '-c', 'core.quotepath=false', *args], text=True)
include = re.compile(r'^((src|mcp/src|server|functions|scripts|build|\.github|deploy)/|packages/core/(src|scripts)/|packages/(core|mcp)/package\.json$|package\.json$|Dockerfile$|docker-compose\.yml$|capacitor\.config\.ts$|tsconfig[^/]*\.json$|vite[^/]*\.ts$|pnpm-workspace\.yaml$)')
exclude = re.compile(r'(^|/)(data|generated|vendor|node_modules|dist|assets|public|resources|ssgw-data)/|(^|/)(generated-[^/]*|[^/]*lock[^/]*)$|\.(md|css|scss|svg|png|jpg|webp|woff2?|map|snap)$|\.generated\.|(^|/)([^/]*[-.]data|[^/]*[-.]content|[^/]*Data)\.ts$')
classics = re.compile(r'^packages/core/src/classics/(almanac-classics|bazi-ditiansui|bazi-qiongtong|bazi-ziping|fengshui-classics|huangji-classics|jinkoujue-rules|liuren-rules|liuyao-rules|meihua-rules|prompt-references|qimen-patterns|qizheng-classics|taiyi-classics|wuyun-liuqi-classics|xiaoliuren-classics|zhouyi|ziwei-classics)\.ts$|^packages/core/src/huangji-jingshi/historical-source-texts\.ts$')
commits = git('rev-list', '--no-merges', '-200', tip).splitlines()
counts = Counter()
for commit in commits:
    for path in git('diff-tree', '--no-commit-id', '--name-only', '--root', '-r', '--no-renames', commit).splitlines():
        if include.search(path) and not exclude.search(path) and not classics.search(path):
            counts[path] += 1
print('commits:', len(commits), 'files:', len(counts), 'file_commit_touches:', sum(counts.values()))
for path, count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))[:15]:
    print(count, path)
PY
```

原始统计结果：200 提交、598 文件、1487 次文件×提交触达。第 15 位并列；完整表及 squash/分支重复的限制见覆盖文档。

普通变更样本和部署/构建历史：

```bash
git show --format=fuller --stat fc5392e5 d2aea04e 6d0aaa10
git show --format=fuller --stat 7d14001f 44a5fb08 d2cfad18 117b7f25
```

## 6. 后续实施的验收约束

本轮不额外添加源码形状测试或全仓“复杂度框架”。实施各批次时，应先固定相关行为契约，再减少维护点，并执行该批对应的领域/接口/包/异步测试。必须保留独立真值、历史回归、输入预算、时间边界、随机身份与发布消费检查。

第二阶段已补构建耗时、实际包/Worker/Pages 体积、运行模块/调用计数和有限基准。尚未测量线上业务性能、取消后浏览器 CPU、所有首屏请求和修改前后收益。不能把调用次数或单机基线推算成实施后的加速。

## 7. 第二阶段构建与重点问题复现

以下在仓库根目录执行；顺序展示依赖关系，不要求重新运行所有昂贵步骤。完整结果、计时和失败边界见 [第二阶段运行验证](2026-10-26-runtime-validation.md)。没有使用真实出生资料、模型密钥或付费上游。

### 安装、类型和回归

```bash
pnpm install --frozen-lockfile
pnpm core:build
pnpm typecheck:app
pnpm typecheck:node
pnpm mcp:check
pnpm lint
pnpm format:check
pnpm test:ci:run
pnpm test:exhaustive:run
pnpm prompt:audit:run
```

实际最终 4085/4085、穷举 9/9，通过；lint 0 error、3 warning。核心先构建一次，其余直接用现有 run 入口，避免并发清理同一 dist。

### 构建与消费契约

```bash
pnpm skill:sync
node scripts/run-vite-build.mjs
pnpm build:pages-discovery
node scripts/run-vite-build.mjs --server
pnpm exec vite build --config vite.mcp.config.ts
pnpm build:pages-functions
node scripts/verify-docker-runtime.mjs
node scripts/verify-mcp-package-runtime.mjs
node scripts/test-browser-contracts.mjs
```

前三类构建消费前面生成的核心。verify-docker-runtime 名称保留历史，但此次直接测 Node 产物，不在容器中执行。Pages 命令需要临时下载工具。Android 构建另要求工程指定的 Java/SDK：

```bash
pnpm exec cap sync android
bash android/gradlew -p android --no-daemon :app:testDebugUnitTest :app:assembleDebug
```

Android 实际通过 8 个 JVM 用例，生成 debug APK，未做真机和正式 release。现有正常核心包门禁命令如下；本机原生 pnpm 环境下实际失败，不要当作成功命令：

```bash
pnpm package:check
```

失败位置是验证器用 Node 解析 `npm_execpath` 原生二进制。替代验证下载同版本 JS 发行包到本地，不修改全局 pnpm。新 checkout 可准备以下目录及入口；本机已保留下载与校验后的内容，无需覆盖：

```bash
mkdir -p .local/audits/2026-10-26-runtime/pnpm-js-11.9.0
npm pack pnpm@11.9.0 --pack-destination .local/audits/2026-10-26-runtime
tar -xzf .local/audits/2026-10-26-runtime/pnpm-11.9.0.tgz \
  -C .local/audits/2026-10-26-runtime/pnpm-js-11.9.0
npm_execpath="$PWD/.local/audits/2026-10-26-runtime/pnpm-js-11.9.0/package/bin/pnpm.mjs" \
  node scripts/test-package-tarballs.mjs
```

该替代入口在 Node 24/22 通过，不改项目包管理器配置，也不修复正常入口。Node 22 的三项兼容命令如下，需已安装相应 fnm 运行时及前述 JS pnpm：

```bash
fnm exec --using=22 -- node scripts/verify-docker-runtime.mjs
fnm exec --using=22 -- node scripts/verify-mcp-package-runtime.mjs
npm_execpath="$PWD/.local/audits/2026-10-26-runtime/pnpm-js-11.9.0/package/bin/pnpm.mjs" \
  fnm exec --using=22 -- node scripts/test-package-tarballs.mjs
```

核心包检查包含消费者类型检查和 Vite 示例构建；未在 Node 22 重新构建项目各目标或跑全量回归。

### F01：真实 REST/MCP 冲突输入

下面是现有协议探针中同一有效输入的自包含版本；用正常 tsx 和 SDK，不读取 `.local` 脚本。`example.test` 只是直接 handler 的 Request 地址，不会发外网。

```bash
TZ=Asia/Shanghai pnpm exec tsx --tsconfig tsconfig.app.json --input-type=module <<'TS'
import { handlePublicApiRequest } from './src/lib/public-api/handler.ts';
import { createMingyuMcpServer } from './mcp/src/create-server.ts';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

const input = {
  gender: 'female', dateType: 'solar', year: '1992', month: '8', day: '21',
  timeIndex: 4, timezone: 8, useTrueSolarTime: false,
  scopeDate: '2026-10-26', scopeHourIndex: 4,
  question: '审计固定问题：请解读2026年的事业变化。',
  promptMode: 'custom', responseMode: 'full',
  scope: 'yearly', promptScope: 'origin',
};
const server = createMingyuMcpServer({ preset: 'full', defaultResponseMode: 'full' });
const client = new Client({ name: 'runtime-repro', version: '1.0.0' });
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
try {
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  const response = await handlePublicApiRequest(new Request('https://example.test/api/v1/ziwei/prompt', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  }), undefined, undefined, undefined, { preset: 'full' });
  const rest = await response.json();
  const mcp = await client.callTool({ name: 'ziwei_prompt', arguments: input });
  console.log({ rest: rest.data.result.scopeNames, mcp: mcp.structuredContent.result.scopeNames });
  console.log(rest.data.prompt);
} finally {
  await client.close();
  await server.close();
}
TS
```

已观察 REST 为 `origin`，MCP 为 `origin,yearly`。REST 提示词内部也同时出现本命和流年范围。分别删除 scope 或 promptScope 作单字段对照，两端范围对齐。

### F02：生产页面主题残留

需要已有 Web/Node 产物；启动本地服务时关闭内置 AI：

```bash
HOST=127.0.0.1 PORT=4174 AI_BUILTIN_ENABLED=false node server-dist/docker-server.mjs
```

在本地页面使用以下合成样本路径：

```text
/result/assistant?n=%E5%AE%A1%E8%AE%A1%E5%90%88%E5%8F%82%E6%A0%B7%E6%9C%AC&g=female&y=1992&m=8&d=21&ti=4&bh=8&bm=23&ps=bazi-ziwei&bid=ai-career&bsm=%E4%BA%8B%E4%B8%9A&bfs=natal&zs=origin
```

在解读主题实际选择“事业”，观察 URL 的 btid/ztid 均为 career；再在输入问题填写“审计自定义问题：请重点看家庭沟通。”。快捷模式变自定义，但 ztid 残留，主题及任务仍为事业。本轮生产浏览器已完成该路径。审计使用的服务已停止；复核者结束后关闭自己启动的进程。

### F12：新进程确认窄入口加载耦合

下面记录实际执行的模块 load URL，不靠文件名扫描；Node 24 环境、先 core build。叶模块路径仅为仓库内诊断对照，不是建议外部绕 exports 导入。

```bash
node --input-type=module <<'JS'
import { spawnSync } from 'node:child_process';
const cases = [
  ['calendar', "const m = await import('mingyu-core/calendar'); m.isValidClockTime(8, 23);"],
  ['profile/input', "await import('mingyu-core/profile/input');"],
  ['date-validation leaf', "const m = await import('./packages/core/dist/calendar/date-validation.js'); m.isValidClockTime(8, 23);"],
];
for (const [label, action] of cases) {
  const code = `
    import { registerHooks } from 'node:module';
    const urls = new Set();
    registerHooks({ load(url, context, next) { urls.add(url); return next(url, context); } });
    ${action}
    console.log(JSON.stringify({ count: urls.size, engine: [...urls].filter(url => /astrology|caelus|embedded-data|asteroid/i.test(url)) }));
  `;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' });
  if (child.status !== 0) throw new Error(child.stderr);
  console.log(label, child.stdout.trim());
}
JS
```

原带有效日期校验的探针计数为 77/78/2；加载依赖在静态 import 时发生，以上 profile/input 仅导入便可观察同一依赖链。列表为 Node 模块加载，不是 Web 首屏或排盘次数。

### F13：类型闭包和扫描工作量

分别枚举四项目，再检查目标文件是否在输出里；该命令不执行语义诊断：

```bash
pnpm exec tsc -p tsconfig.app.json --listFilesOnly --noEmit --incremental false
pnpm exec tsc -p tsconfig.node.json --listFilesOnly --noEmit --incremental false
pnpm exec tsc -p mcp/tsconfig.json --listFilesOnly --noEmit --incremental false
pnpm exec tsc -p packages/core/tsconfig.json --listFilesOnly --noEmit --incremental false
```

旧基准与单年扫描的真实包对照如下。它刻意保留旧额外字段，仅新增 periodRange 来隔离扫描开关；正式修复经度还应迁入 location.longitude。

```bash
node --input-type=module <<'JS'
import { calculateQimenLifetime } from 'mingyu-core/divination/qimen';
const oldInput = {
  birthDateTime: '1990-05-15T14:30:00', calendarType: 'solar', gender: 'male',
  longitude: 116.4, timeZoneId: 'Asia/Shanghai', dynamicRange: { startYear: 2026, endYear: 2028 },
};
for (const input of [oldInput, {
  ...oldInput, periodRange: { startDate: '2026-01-01', endDate: '2026-12-31' },
}]) {
  const data = calculateQimenLifetime(input);
  console.log({
    clusters: data.eventClusters?.length ?? null,
    dynamicFacts: data.evidenceAnalysis.dynamicClusterFacts?.length ?? null,
    stages: data.stages.length,
  });
}
JS
```

已观察旧输入为 null/null/4，单年输入为 6/6/4。原始 benchmark 仍可用 `pnpm benchmark:core` 重跑；其“动态扫描”样本和黄历预算解读必须遵守上述限制。

### 原始证据与文档交付检查

本机忽略目录保留每命令日志/JSON、protocol/worker/AI/计数探针、页面观测和汇总。Worker 门控与 React effect 宿主依赖当前内部实现，不在此再复制一套长期测试框架；其观察、限制和源码入口已写入运行验证/主报告。上述自包含命令便于在没有本机证据目录的新 checkout 重现关键结论。

纯文档收尾检查：

```bash
pnpm exec tsx --tsconfig tsconfig.app.json --test tests/skill-mirrors.test.ts
git diff --check
```

文档检查不替代前述完整回归，也不需要因纯文字更新再次跑全部算法穷举。
