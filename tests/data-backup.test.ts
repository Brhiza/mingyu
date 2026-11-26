import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BACKUP_FORMAT_TAG,
  buildLocalDataBackup,
  importLocalDataBackup,
} from '../src/v2-ui/data-backup';

function createMemoryStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
}

test('本地数据备份默认排除 AI 密钥等敏感字段，保留档案、历史与偏好', () => {
  const storage = createMemoryStorage({
    'mingyu.v2.personal.cases': JSON.stringify([{ id: 'c1', name: '张三' }]),
    'mingyu.v2.history.records': JSON.stringify([{ id: 'h1', method: 'liuyao' }]),
    'mingyu-theme-mode': 'dark',
    'mingyu.v2.ai.apiKey': 'sk-secret-do-not-export',
    'mingyu.v2.ai.baseUrl': 'https://api.example.com/v1',
  });

  const backup = buildLocalDataBackup(storage);
  assert.equal(backup.format, BACKUP_FORMAT_TAG);
  assert.ok('mingyu.v2.personal.cases' in backup.items);
  assert.ok('mingyu.v2.history.records' in backup.items);
  assert.equal(backup.items['mingyu-theme-mode'], 'dark');
  assert.equal('mingyu.v2.ai.apiKey' in backup.items, false);
  assert.equal('mingyu.v2.ai.baseUrl' in backup.items, false);
});

test('导入备份支持按 ID 合并去重，不覆盖已有档案且忽略未授权键', () => {
  const source = createMemoryStorage({
    'mingyu.v2.personal.cases': JSON.stringify([
      { id: 'c1', name: '张三' },
      { id: 'c2', name: '李四' },
    ]),
    'mingyu.v2.compatibility.records': JSON.stringify([{ id: 'cmp1', name: '合盘甲' }]),
    'mingyu-theme-mode': 'dark',
  });
  const backup = buildLocalDataBackup(source);
  backup.items['mingyu.v2.ai.apiKey'] = 'sk-injected';

  const target = createMemoryStorage({
    'mingyu.v2.personal.cases': JSON.stringify([{ id: 'c1', name: '张三（本机版）' }]),
  });

  const summary = importLocalDataBackup(JSON.stringify(backup), target);
  assert.equal(summary.personalCasesAdded, 1);
  assert.equal(summary.compatibilityAdded, 1);
  assert.equal(summary.settingsRestored, 1);

  const cases = JSON.parse(target.getItem('mingyu.v2.personal.cases') ?? '[]') as Array<{
    id: string;
    name: string;
  }>;
  assert.equal(cases.length, 2);
  assert.equal(cases[0]?.name, '张三（本机版）');
  assert.equal(cases[1]?.name, '李四');
  assert.equal(target.getItem('mingyu.v2.ai.apiKey'), null);
});

test('无效备份文本抛出明确中文提示', () => {
  const target = createMemoryStorage();
  assert.throws(() => importLocalDataBackup('not-json', target), /格式无效/);
  assert.throws(
    () => importLocalDataBackup(JSON.stringify({ format: 'other', items: {} }), target),
    /不是有效的命语本地备份文件/,
  );
});
