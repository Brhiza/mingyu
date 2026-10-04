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
import { assertPromptFactCoverage, type PromptFactExpectation } from './prompt-audit/facts';

export interface CulturePromptSample {
  name: string;
  prompt: string;
  required: string[];
  facts: PromptFactExpectation[];
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
  const sparseNumber = analyzeNumber('050');
  const zhuge = calculateZhugeNumber('顺其然');
  const kongming = castKongmingHexagram('10000');
  const zhugeReading = zhuge.interpretation;
  assert.ok(zhugeReading);
  const kongmingReading = kongming.interpretation;
  assert.ok(kongmingReading);
  const question = '下个月的合作适合继续推进吗？';
  return [
    {
      name: '起名',
      prompt: buildChineseNamingPrompt({ ...preferences, candidates, suitableCharacters }),
      facts: [
        ...birthFacts(candidates[0].analysis.birthContext),
        { id: '起名.姓氏', owner: '姓氏：', values: [preferences.surname] },
        { id: '起名.偏好', owner: '偏好字：', values: ['清、宁'] },
        { id: '起名.回避', owner: '回避用字：', values: [preferences.forbiddenCharacters] },
        {
          id: '起名.辈分',
          owner: '辈分字：',
          values: [`${preferences.generationCharacter}（名字首字）`],
        },
        ...candidates.flatMap((candidate, index) => {
          const scope = {
            start: `${index + 1}. ${candidate.fullName}`,
            end:
              index + 1 < candidates.length
                ? `${index + 2}. ${candidates[index + 1].fullName}`
                : '【传统依据】',
          };
          return [
            ...candidate.analysis.gridDerivations.map((grid) => ({
              id: `起名.${index}.${grid.key}`,
              owner: '五格算式：',
              values: [`${grid.name}${grid.expression}`],
              scope,
            })),
            {
              id: `起名.${index}.三才`,
              owner: '三才：',
              values: [candidate.analysis.sancai.combo],
              scope,
            },
            ...candidate.analysis.chars
              .filter((char) => !char.isSurname)
              .map((char) => ({
                id: `起名.${index}.字.${char.char}`,
                owner: '名字用字：',
                values: [
                  `${char.char}（${[char.wuxing ? `${char.wuxing}行` : '', char.pinyin || '', `康熙${char.kangxiStrokes}画`].filter(Boolean).join('、')}）`,
                ],
                scope,
              })),
          ];
        }),
      ],
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
      facts: [
        ...birthFacts(name.birthContext),
        { id: '姓名.全名', owner: '姓名：', values: [`${name.surname}${name.given}`] },
        ...name.chars.map((char) => ({
          id: `姓名.字.${char.char}`,
          owner: '逐字：',
          values: [
            `${char.char}（康熙${char.kangxiStrokes}画、${char.wuxing ?? '五行未定'}、${char.pinyin ?? '读音未录'}）`,
          ],
        })),
        ...name.gridDerivations.map((grid) => ({
          id: `姓名.${grid.key}`,
          owner: '五格数理参考：',
          values: [
            `${grid.name}${name.grids[grid.key].num}（${name.grids[grid.key].wuxing}、${name.grids[grid.key].keywords}）；${grid.rule}：${grid.expression}`,
          ],
        })),
        {
          id: '姓名.三才',
          owner: '三才取象（姓名学数理参考）：',
          values: [name.sancai.combo, name.sancai.text],
        },
      ],
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
      facts: characters.characters.flatMap(({ char, detail }, index) => {
        assert.ok(detail);
        const scope = {
          start: `【${char}】`,
          end:
            index + 1 < characters.characters.length
              ? `【${characters.characters[index + 1].char}】`
              : '【问题】',
        };
        return [
          {
            id: `汉字.${char}.字形`,
            owner: '简体：',
            values: [detail.simplified, `繁体：${detail.traditional}`],
            scope,
          },
          { id: `汉字.${char}.读音`, owner: '读音：', values: [detail.pinyin || '待考'], scope },
          {
            id: `汉字.${char}.笔画`,
            owner: '简体笔画：',
            values: [
              `${detail.simplifiedStrokes ?? '待考'}；繁体笔画：${detail.traditionalStrokes ?? '待考'}；姓名学康熙笔画：${detail.kangxiStrokes}`,
            ],
            scope,
          },
          {
            id: `汉字.${char}.字义`,
            owner: '字义：',
            values: [detail.definition || '待考'],
            scope,
          },
        ];
      }),
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
      facts: numberFacts(number),
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
      prompt: buildNumberEnergyPrompt({ analysis: sparseNumber }),
      facts: numberFacts(sparseNumber),
      required: ['不足以形成八星磁场组合', '独立', '两端有效数字不足'],
    },
    {
      name: '诸葛神数',
      prompt: buildDivinationPrompt('zhuge', question, zhuge),
      facts: [
        { id: '诸葛.签号', owner: '签号：', values: [`第${zhuge.number}签`] },
        { id: '诸葛.签诗', owner: '签诗：', values: [zhuge.sign.poem] },
        ...(zhugeReading.classicalImage
          ? [{ id: '诸葛.典故', owner: '典故：', values: [zhugeReading.classicalImage] }]
          : []),
        {
          id: '诸葛.基础解签',
          owner: '基础解签：',
          values: [zhugeReading.quote, zhugeReading.imageMeaning, zhugeReading.interpretation],
        },
        { id: '诸葛.条件', owner: '补充解释：', values: [zhugeReading.condition] },
      ],
      required: [
        question,
        zhuge.sign.poem,
        zhugeReading.quote,
        zhugeReading.imageMeaning,
        zhugeReading.interpretation,
        zhugeReading.condition,
        ...(zhugeReading.classicalImage ? [zhugeReading.classicalImage] : []),
      ],
    },
    {
      name: '孔明神卦',
      prompt: buildDivinationPrompt('kongming', question, kongming),
      facts: [
        { id: '孔明.签号', owner: '签号：', values: [`第${kongming.number}签`] },
        { id: '孔明.签题', owner: '签题：', values: [kongming.name] },
        { id: '孔明.签诗', owner: '签诗：', values: [kongming.poem] },
        { id: '孔明.吉凶', owner: '吉凶级别：', values: [kongming.grade] },
        ...(kongmingReading.classicalImage
          ? [
              {
                id: '孔明.典故',
                owner: '典故：',
                values: [
                  kongmingReading.classicalImage.title,
                  kongmingReading.classicalImage.quote,
                  kongmingReading.classicalImage.meaning,
                ],
              },
            ]
          : []),
        {
          id: '孔明.基础解签',
          owner: '基础解签：',
          values: [
            kongmingReading.quote,
            kongmingReading.imageMeaning,
            kongmingReading.interpretation,
          ],
        },
        { id: '孔明.条件', owner: '补充解释：', values: [kongmingReading.condition] },
      ],
      required: [
        question,
        kongming.poem,
        kongming.name,
        kongming.grade,
        kongmingReading.quote,
        kongmingReading.imageMeaning,
        kongmingReading.interpretation,
        kongmingReading.condition,
        ...(kongmingReading.classicalImage
          ? [
              kongmingReading.classicalImage.title,
              kongmingReading.classicalImage.quote,
              kongmingReading.classicalImage.meaning,
            ]
          : []),
      ],
    },
  ];
}

function birthFacts(
  context: ReturnType<typeof analyzeChineseName>['birthContext'],
): PromptFactExpectation[] {
  assert.ok(context);
  return [
    {
      id: '出生.记录',
      owner: '出生记录：',
      values: [context.timeBasis.inputDate, context.timeBasis.inputTime],
    },
    {
      id: '出生.口径',
      owner: '时间口径：',
      values: [
        context.timeBasis.mode,
        ...(context.timeBasis.longitude === null
          ? []
          : [`真太阳时校正经度：${context.timeBasis.longitude}°`]),
      ],
    },
    {
      id: '出生.排盘',
      owner: '排盘公历：',
      values: [context.solarDate, context.timeBasis.calculatedTime],
    },
    { id: '出生.四柱', owner: '四柱：', values: [context.pillars.join(' ')] },
    ...context.pillarDetails.map((pillar) => ({
      id: `出生.${pillar.label}.藏干`,
      owner: `${pillar.label}${pillar.ganZhi}藏干：`,
      values: [
        pillar.hiddenStems
          .map((item) => `${item.stem}${item.tenGod ? `（${item.tenGod}）` : ''}`)
          .join('、'),
      ],
    })),
    { id: '出生.取用', owner: '取用依据：', values: [context.usefulGodReason] },
  ];
}

function numberFacts(number: ReturnType<typeof analyzeNumber>): PromptFactExpectation[] {
  return [
    { id: '数字.原文', owner: '原始内容：', values: [number.input] },
    { id: '数字.序列', owner: '能量序列：', values: [number.energySequence] },
    ...number.energyPairs.flatMap((pair, index) => [
      {
        id: `数字.组合.${index}`,
        owner: `${index + 1}. ${pair.span} → ${pair.pair}：`,
        values: [`${pair.name}（${pair.nature}）`, pair.meaning],
      },
      {
        id: `数字.位置.${index}`,
        owner: `位置：能量序列第${pair.start + 1}—${pair.end + 1}位`,
        values: [
          `对应数字字母第${pair.sourceStart + 1}—${pair.sourceEnd + 1}位「${pair.sourceText}」`,
        ],
      },
    ]),
    ...number.modifiers.map((modifier) => ({
      id: `数字.修饰.${modifier.position}`,
      owner: `能量序列第${modifier.position + 1}位：`,
      values: [`${modifier.digit}`, modifier.placement, modifier.meaning],
    })),
  ];
}

export function assertCulturePromptSamples(samples: CulturePromptSample[]) {
  assert.deepEqual(
    samples.map((item) => item.name),
    ['起名', '姓名解析', '汉字与选字', '数字能量', '数字能量独立0与5', '诸葛神数', '孔明神卦'],
  );
  const taskTexts = samples.map(
    (sample) => /【任务】\n([\s\S]*?)(?=\n\n【|$)/u.exec(sample.prompt)?.[1]?.trim() ?? '',
  );
  assert.equal(new Set(taskTexts).size, taskTexts.length, '各样本任务文本应保持唯一');
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
    if (sample.name === '诸葛神数' || sample.name === '孔明神卦') {
      assert.doesNotMatch(
        sample.prompt,
        /【当前时间】|占法：|所写三字|康熙笔画|五枚硬币|取数过程|基础解意：|基础解卦：|卦序：|卦名：|等第：|卦诗：|诗句取象：|典故取象：/u,
        `${sample.name}混入签谱外字段`,
      );
    }
  }
  assertPromptFactCoverage(samples);
}

async function main() {
  const samples = await buildCulturePromptSamples();
  assertCulturePromptSamples(samples);
  const coverage = assertPromptFactCoverage(samples);
  const output = resolve('.local/reports/prompt-audit/culture-tools.md');
  mkdirSync(resolve('.local/reports/prompt-audit'), { recursive: true });
  writeFileSync(
    resolve('.local/reports/prompt-audit/culture-fact-coverage.json'),
    JSON.stringify(coverage, null, 2),
    'utf8',
  );
  writeFileSync(
    output,
    samples.map((sample) => `# ${sample.name}\n\n${sample.prompt}`).join('\n\n---\n\n'),
    'utf8',
  );
  console.log(`已核对${samples.length}份文字与数理、占问提示词：${output}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await main();
