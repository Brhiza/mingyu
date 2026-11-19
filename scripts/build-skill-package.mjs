import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function createZipBuffer(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const raw = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data);
    const deflated = deflateRawSync(raw);
    const useDeflate = deflated.length < raw.length;
    const payload = useDeflate ? deflated : raw;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(raw);
    const flags = 0x0800; // UTF-8 filename
    const mode = entry.executable ? 0o100755 : 0o100644;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10); // mod time
    local.writeUInt16LE(0x5421, 12); // mod date (2022-01-01)
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);

    localParts.push(local, nameBuf, payload);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x031e, 4); // version made by: Unix
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x5421, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE((mode << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);

    centralParts.push(central, nameBuf);
    offset += local.length + nameBuf.length + payload.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, eocd]);
}

export function ensureCliBundle(rootDir) {
  const cliEntry = join(rootDir, 'dist-cli', 'mingyu.mjs');
  const viteBin = join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');
  if (!existsSync(viteBin)) {
    throw new Error(`未找到 Vite 可执行文件：${viteBin}`);
  }
  execFileSync(process.execPath, [viteBin, 'build', '--config', 'vite.cli.config.ts'], {
    cwd: rootDir,
    stdio: 'pipe',
  });
  return readFileSync(cliEntry);
}

export function buildSkillZipBuffer(rootDir, { rebuildCli = true } = {}) {
  const cliPath = join(rootDir, 'dist-cli', 'mingyu.mjs');
  const cliBytes = rebuildCli || !existsSync(cliPath) ? ensureCliBundle(rootDir) : readFileSync(cliPath);
  const skillDir = join(rootDir, 'skills', 'mingyu');
  const refDir = join(skillDir, 'references');
  const refFiles = readdirSync(refDir)
    .filter((name) => name.endsWith('.md'))
    .sort();

  const mcpConfigPath = join(skillDir, '.mcp.json');
  const entries = [
    { name: 'mingyu/SKILL.md', data: readFileSync(join(skillDir, 'SKILL.md')) },
    ...(existsSync(mcpConfigPath)
      ? [{ name: 'mingyu/.mcp.json', data: readFileSync(mcpConfigPath) }]
      : []),
    ...refFiles.map((name) => ({
      name: `mingyu/references/${name}`,
      data: readFileSync(join(refDir, name)),
    })),
    { name: 'mingyu/scripts/mingyu.mjs', data: cliBytes, executable: true },
  ];

  return createZipBuffer(entries);
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
  const outPath = join(rootDir, 'dist-cli', 'mingyu-skill.zip');
  mkdirSync(dirname(outPath), { recursive: true });
  const zipBuffer = buildSkillZipBuffer(rootDir, { rebuildCli: true });
  writeFileSync(outPath, zipBuffer);
  console.log(`已生成 Skill 压缩包：${outPath} (${(zipBuffer.length / (1024 * 1024)).toFixed(2)} MiB)`);
}
