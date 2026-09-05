import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  analyzeChineseCharactersWithReferences,
  analyzeChineseName,
  analyzeNumber,
  buildChineseCharacterPrompt,
  buildChineseNameAnalysisPrompt,
  buildChineseNamingPrompt,
  buildNumberEnergyPrompt,
  calculateZhugeNumber,
  castKongmingHexagram,
  generateChineseNames,
  selectNamingCharacters,
} from 'mingyu-core/name-number';
import { buildDivinationPrompt } from '../src/lib/divination/engine';

export interface CulturePromptSample {
  name: string;
  prompt: string;
  required: string[];
}

export async function buildCulturePromptSamples(): Promise<CulturePromptSample[]> {
  const birth = {
    gender: 'male' as const,
    year: 2000,
    month: 1,
    day: 1,
    timeIndex: 0,
    dateType: 'solar' as const,
    useTrueSolarTime: true,
    birthHour: 0,
    birthMinute: 30,
    birthLongitude: 75,
    birthPlace: '喀什',
  };
  const preferences = {
    surname: '曾',
    preferredCharacters: '清宁',
    forbiddenCharacters: '乐',
    generationCharacter: '清',
  };
  const candidates = generateChineseNames({ ...preferences, birth, limit: 3 });
  assert.equal(candidates.length, 3);
  const suitableCharacters = selectNamingCharacters({ ...preferences, birth, limit: 12 });
  const name = analyzeChineseName({ fullName: '曾清和', birth });
  const characters = await analyzeChineseCharactersWithReferences('万乐');
  const number = analyzeNumber('粤Ｚ·１０５Ａ', 'plate');
  const zhuge = calculateZhugeNumber('顺其然');
  const kongming = castKongmingHexagram('10000');
  const question = '下个月的合作适合继续推进吗？';
  return [
    {
      name: '起名',
      prompt: buildChineseNamingPrompt({ ...preferences, candidates, suitableCharacters }),
      required: [
        '偏好字：清、宁',
        '回避用字：乐',
        '辈分字：清',
        '可以重新组合适配字',
        '曾姓氏读音参考：zēng',
        ...candidates.map((item) => item.analysis.given),
        name.birthContext!.pillars.join(' '),
      ],
    },
    {
      name: '姓名解析',
      prompt: buildChineseNameAnalysisPrompt({ analysis: name }),
      required: [
        '曾姓氏读音参考：zēng',
        '真太阳时',
        '喀什',
        '00:30',
        name.birthContext!.pillars.join(' '),
        ...name.gridDerivations.map((item) => item.expression),
      ],
    },
    {
      name: '汉字与选字',
      prompt: buildChineseCharacterPrompt({ analysis: characters }),
      required: [
        '音义用法',
        'yào',
        '笔画用法',
        ...characters.characters.flatMap(({ detail }) => {
          assert.ok(detail?.kangxiText);
          return [detail.definition!, detail.kangxiText];
        }),
      ],
    },
    {
      name: '数字能量',
      prompt: buildNumberEnergyPrompt({ analysis: number }),
      required: [
        'Z=26',
        '能量序列：261051',
        '【磁场顺序】',
        '大游年原为宅卦相配之法',
        ...number.energyPairs.map((item) => item.trigramEvidence.explanation),
      ],
    },
    {
      name: '数字能量独立0与5',
      prompt: buildNumberEnergyPrompt({ analysis: analyzeNumber('050') }),
      required: ['不足以形成八星磁场组合', '独立', '两端有效数字不足'],
    },
    {
      name: '诸葛神数',
      prompt: buildDivinationPrompt('zhuge', question, zhuge),
      required: [
        question,
        zhuge.sign.poem,
        zhuge.interpretation!.interpretation,
        zhuge.interpretation!.condition,
      ],
    },
    {
      name: '孔明神卦',
      prompt: buildDivinationPrompt('kongming', question, kongming),
      required: [
        question,
        kongming.poem,
        kongming.interpretation.interpretation,
        kongming.interpretation.condition,
      ],
    },
  ];
}

export function assertCulturePromptSamples(samples: CulturePromptSample[]) {
  assert.deepEqual(
    samples.map((item) => item.name),
    ['起名', '姓名解析', '汉字与选字', '数字能量', '数字能量独立0与5', '诸葛神数', '孔明神卦'],
  );
  for (const sample of samples) {
    assert.ok(sample.required.length > 0, `${sample.name}缺少资料检查项`);
    for (const field of sample.required) {
      assert.ok(field && sample.prompt.includes(field), `${sample.name}缺少资料：${field}`);
    }
    assert.match(sample.prompt, /【任务】/, `${sample.name}缺少任务`);
    assert.doesNotMatch(
      sample.prompt,
      /\b(?:undefined|null|NaN|API|MCP)\b|\[object Object\]|本项目|本仓库|内部字段|实现状态|来源状态|签谱状态|行动建议|风险提醒/,
      `${sample.name}混入无关内容`,
    );
    const task = /【任务】([\s\S]*?)(?=【|$)/.exec(sample.prompt)?.[1] ?? '';
    assert.doesNotMatch(task, /不得|不要/, `${sample.name}任务需正面描述`);
  }
}

async function main() {
  const samples = await buildCulturePromptSamples();
  assertCulturePromptSamples(samples);
  const output = resolve('.local/reports/prompt-audit/culture-tools.md');
  mkdirSync(resolve('.local/reports/prompt-audit'), { recursive: true });
  writeFileSync(
    output,
    samples.map((sample) => `# ${sample.name}\n\n${sample.prompt}`).join('\n\n---\n\n'),
    'utf8',
  );
  console.log(`已核对${samples.length}份文字与数理、占问提示词：${output}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await main();
