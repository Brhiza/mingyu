import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const PRESETS = {
  bazi: ['bazi', 'bazi-synastry', 'bazi-reverse'],
  ziwei: ['ziwei', 'ziwei-synastry'],
  'bazi-ziwei': ['bazi', 'bazi-synastry', 'bazi-reverse', 'ziwei', 'ziwei-synastry', 'bazi-ziwei'],
  divination: ['liuyao', 'meihua', 'qimen', 'liuren', 'xiaoliuren', 'jinkoujue', 'tarot', 'lenormand'],
  fengshui: ['bazhai', 'xuankong', 'residential', 'almanac'],
  astrology: ['astrolabe', 'astrolabe-synastry', 'astrolabe-range', 'qizheng', 'qizheng-range'],
};

function parseCliArgs(argv) {
  let methodsRaw = '';
  let preset = '';
  let name = '';
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--methods' && argv[i + 1]) {
      methodsRaw = argv[++i];
    } else if (token === '--preset' && argv[i + 1]) {
      preset = argv[++i];
    } else if (token === '--name' && argv[i + 1]) {
      name = argv[++i];
    } else if (token === '--list-presets') {
      console.log('可用预设分组：');
      for (const [k, v] of Object.entries(PRESETS)) {
        console.log(`  ${k}: ${v.join(', ')}`);
      }
      process.exit(0);
    }
  }
  const methods = preset
    ? PRESETS[preset]
    : methodsRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
  if (!methods || !methods.length) {
    console.error('用法：node scripts/build-cli-variant.mjs --preset <预设名> 或 --methods <方法1,方法2> [--name <输出后缀>]');
    console.error('查看预设：node scripts/build-cli-variant.mjs --list-presets');
    process.exit(1);
  }
  const suffix = name || preset || methods[0];
  return { methods: new Set(methods), suffix };
}

function pruneCalculatePlugin(keepSet) {
  const normalized = (p) => p.replaceAll('\\', '/');
  return {
    name: 'mingyu-prune-calculators',
    transform(code, id) {
      const file = normalized(id);
      if (file.endsWith('/src/calculate.ts')) {
        const lines = code.split('\n');
        let inCalculators = false;
        const out = lines.map((line) => {
          if (line.startsWith('const calculators = {')) {
            inCalculators = true;
            return line;
          }
          if (inCalculators && line.startsWith('} satisfies Calculators;')) {
            inCalculators = false;
            return line;
          }
          if (inCalculators) {
            const match = line.match(/^\s*(?:'([^']+)'|([a-zA-Z0-9_-]+)):\s*async\b/);
            if (match) {
              const methodId = match[1] ?? match[2];
              if (!keepSet.has(methodId)) {
                const keyText = match[1] ? `'${methodId}'` : methodId;
                return `  ${keyText}: async () => { throw new Error('当前单科精简包未包含术数：${methodId}'); },`;
              }
            }
          }
          return line;
        });
        return { code: out.join('\n'), map: null };
      }

      if (file.includes('/src/reprompt/') && !file.endsWith('/shared.ts')) {
        const systemToMethod = new Map([
          ['astrolabe-range', 'astrolabe-range'],
          ['astrolabe-synastry', 'astrolabe-synastry'],
          ['astrolabe', 'astrolabe'],
          ['bazi-ziwei', 'bazi-ziwei'],
          ['ziwei-synastry', 'ziwei-synastry'],
          ['ziwei', 'ziwei'],
          ['qizheng-range', 'qizheng-range'],
          ['qizheng', 'qizheng'],
          ['minglu', 'minglu'],
          ['fortune', 'fortune'],
          ['bazi-synastry', 'bazi-synastry'],
          ['bazi', 'bazi'],
          ['qimen-lifetime', 'qimen-lifetime'],
          ['qimen', 'qimen'],
          ['taiyi', 'taiyi'],
          ['liuyao-range', 'liuyao'],
          ['liuyao', 'liuyao'],
          ['meihua', 'meihua'],
          ['liuren', 'liuren'],
          ['jinkoujue', 'jinkoujue'],
          ['wuyun', 'wuyun-liuqi'],
          ['xiaoliuren', 'xiaoliuren'],
          ['tarot', 'tarot'],
          ['lenormand', 'lenormand'],
          ['ssgw', 'ssgw'],
          ['zhuge', 'zhuge'],
          ['chinese-name', 'chinese-name'],
          ['chinese-naming', 'chinese-naming'],
          ['zhouyi', 'zhouyi'],
          ['calendar-tool', 'calendar'],
          ['bazi-reverse', 'bazi-reverse'],
          ['character-query', 'character-query'],
          ['number-energy', 'number-energy'],
          ['instant', 'instant'],
          ['almanac', 'almanac'],
          ['huangji-chart', 'huangji-jingshi'],
          ['huangji-tables', 'huangji-jingshi'],
          ['residential', 'residential'],
          ['xuankong', 'xuankong'],
          ['bazhai', 'bazhai'],
        ]);
        const replaced = code.replace(/import\((['"])\.\.\/systems\/([^'"]+)\1\)/g, (full, _q, sysName) => {
          const methodId = systemToMethod.get(sysName);
          if (methodId && !keepSet.has(methodId)) {
            return `Promise.reject(new Error('当前单科精简包未包含术数：${methodId}'))`;
          }
          return full;
        });
        return { code: replaced, map: null };
      }

      if (file.endsWith('/src/cli.ts')) {
        const allowList = JSON.stringify([...keepSet]);
        const replaced = code.replace(
          "import { enabledMethods } from './mcp';",
          `const enabledMethods = ${allowList};`,
        );
        return { code: replaced, map: null };
      }

      return null;
    },
  };
}

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const { methods, suffix } = parseCliArgs(process.argv.slice(2));
const outDir = join(rootDir, 'dist-cli');
mkdirSync(outDir, { recursive: true });
const fileName = `mingyu-${suffix}.mjs`;

await build({
  root: rootDir,
  configFile: false,
  publicDir: false,
  logLevel: 'warn',
  define: { __MINGYU_BROWSER_ASSETS__: 'false', __MINGYU_WORKER_ASSETS__: 'false' },
  ssr: { target: 'node', noExternal: true },
  plugins: [pruneCalculatePlugin(methods)],
  build: {
    ssr: 'src/cli.ts',
    outDir: 'dist-cli',
    emptyOutDir: false,
    target: 'node20',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        entryFileNames: fileName,
        inlineDynamicImports: true,
      },
    },
  },
});

const outPath = join(outDir, fileName);
const sizeBytes = statSync(outPath).size;
console.log(`已生成单科精简包：${outPath} (${(sizeBytes / 1024).toFixed(1)} KiB, 包含方法: ${[...methods].join(', ')})`);
