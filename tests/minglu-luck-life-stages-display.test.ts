import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type {
  MingluLifeStagesSectionData,
  MingluLuckChronicleSectionData,
} from '../packages/core/src/minglu/types';
import { MingluLifeStagesSection } from '../src/pages/ResultPage/components/MingluWiki/MingluLifeStagesSection';
import { MingluLuckChronicleSection } from '../src/pages/ResultPage/components/MingluWiki/MingluLuckChronicleSection';

test('命录童限按实际流年数展示，不套用十年大运与虚构太岁标签', () => {
  const data = {
    startAge: 3,
    startYear: 2028,
    handoverInfo: '2028 年交入大运',
    direction: '顺行',
    cycles: [
      {
        cycleIndex: 1,
        entryType: '小运',
        isXiaoyun: true,
        startAge: 0,
        endAge: 2,
        startYear: 2025,
        endYear: 2027,
        startDateTime: '2025-06-01 08:00:00',
        endDateTime: '2028-02-04 12:00:00',
        ganZhi: '小运',
        tenGod: '—',
        zhiTenGod: '—',
        nayin: '—',
        lifeStage: '—',
        lifeStageDesc: '童限期',
        interactionWithNatal: [],
        lifeTheme: '',
        careerAdvice: '运中作用待核对',
        annualYears: [
          {
            year: 2025,
            ganZhi: '乙巳',
            age: 0,
            startDateTime: '2025-06-01 08:00:00',
            endDateTime: '2026-02-04 04:00:00',
            tenGod: '偏财',
            zhiTenGod: '食神',
            nayin: '覆灯火',
            taiSuiShensha: [],
            interactionWithNatal: [],
            interactionWithLuck: [],
            specialEvents: [],
            yearTheme: '',
            xiaoyun: { ganZhi: '丙午', tenGod: '正财', tenGodZhi: '伤官' },
            months: [
              {
                monthIndex: 1,
                monthName: '芒种月',
                solarTerm: '芒种',
                ganZhi: '壬午',
                ganTenGod: '偏印',
                zhiTenGod: '伤官',
                nayin: '杨柳木',
                commander: '午火',
                startDateTime: '2025-06-01 08:00:00',
                endDateTime: '2025-06-05 17:00:00',
              },
              {
                monthIndex: 2,
                monthName: '芒种后',
                solarTerm: '芒种',
                ganZhi: '癸未',
                ganTenGod: '正印',
                zhiTenGod: '正财',
                nayin: '杨柳木',
                commander: '未土',
                startDateTime: '2025-06-05 17:00:00',
                endDateTime: '2025-07-07 00:00:00',
              },
            ],
          },
          {
            year: 2026,
            ganZhi: '丙午',
            age: 1,
            startDateTime: '2026-02-04 04:00:00',
            endDateTime: '2027-02-04 09:00:00',
            tenGod: '正财',
            zhiTenGod: '伤官',
            nayin: '天河水',
            taiSuiShensha: [],
            interactionWithNatal: [],
            interactionWithLuck: [],
            specialEvents: [],
            yearTheme: '',
            months: [],
          },
        ],
      },
    ],
  } satisfies MingluLuckChronicleSectionData;

  const html = renderToStaticMarkup(createElement(MingluLuckChronicleSection, { data }));
  assert.match(html, /童限（小运）/);
  assert.match(html, /所列 2 个流年/);
  assert.match(html, /查看 2 个流月/);
  assert.match(html, /童限小运：丙午/);
  assert.match(html, /2025-06-01 08:00:00 起，至 2028-02-04 12:00:00 前/);
  assert.doesNotMatch(html, /小运运|十年总领|十个流年|太岁临门|太岁神煞：|原局交互：/);
  assert.doesNotMatch(html, /查看 12 流月|运势：|运势:|运中作用待核对/);
});

test('命录十二长生只称阶段，原数据中的运势措辞不扩展为断语', () => {
  const data: MingluLifeStagesSectionData = {
    tableMatrix: [],
    natalStages: [
      {
        pillar: 'year',
        pillarLabel: '年柱',
        stem: '甲',
        branch: '子',
        dayMasterStage: '沐浴',
        dayMasterStageDesc: '日主甲行至子为【沐浴】运势',
        ziZuoStage: '沐浴',
        ziZuoStageDesc: '天干甲自坐子为【沐浴】之位',
      },
    ],
  };

  const html = renderToStaticMarkup(createElement(MingluLifeStagesSection, { data }));
  assert.match(html, /日主在子支：沐浴/);
  assert.match(html, /甲干自坐子支：沐浴/);
  assert.doesNotMatch(html, /沐浴.*运势|自坐星运|十天干十二长生阶段对照/);
});

test('正式大运将十二长生标为阶段，并在没有流年时省略空列表', () => {
  const data: MingluLuckChronicleSectionData = {
    startAge: 3,
    startYear: 2028,
    handoverInfo: '2028 年交运',
    direction: '顺行',
    cycles: [
      {
        cycleIndex: 2,
        entryType: '大运',
        isXiaoyun: false,
        startDateTime: '2028-02-04 12:00:00',
        endDateTime: '2038-02-04 12:00:00',
        startAge: 3,
        endAge: 12,
        startYear: 2028,
        endYear: 2037,
        ganZhi: '甲子',
        tenGod: '正财',
        zhiTenGod: '食神',
        nayin: '海中金',
        lifeStage: '沐浴',
        lifeStageDesc: '运势',
        interactionWithNatal: [],
        lifeTheme: '',
        careerAdvice: '',
        annualYears: [],
      },
    ],
  };
  const html = renderToStaticMarkup(createElement(MingluLuckChronicleSection, { data }));
  assert.match(html, /【甲子大运】/);
  assert.match(html, /日主十二长生：沐浴/);
  assert.doesNotMatch(html, /运势|所列 0 个流年|展开全部流月明细/);
});

test('出生时分不足时不把空周期显示成零岁起运', () => {
  const data: MingluLuckChronicleSectionData = {
    startAge: 0,
    startYear: 2025,
    handoverInfo: '待补出生时分',
    direction: '待补时',
    cycles: [],
  };
  const html = renderToStaticMarkup(createElement(MingluLuckChronicleSection, { data }));
  assert.match(html, /待补出生时分/);
  assert.doesNotMatch(html, /0 岁起运|童限与大运（点击切换）|所列 0 个流年/);
});

test('出生时分不足时不拼接空干支的长生状态', () => {
  const data: MingluLifeStagesSectionData = {
    tableMatrix: [],
    natalStages: [
      {
        pillar: 'hour',
        pillarLabel: '时柱',
        stem: '',
        branch: '',
        dayMasterStage: '待补时',
        dayMasterStageDesc: '日主旺衰及十二长生待出生时分确定。',
        ziZuoStage: '待补时',
        ziZuoStageDesc: '出生时辰待补。',
      },
    ],
  };
  const html = renderToStaticMarkup(createElement(MingluLifeStagesSection, { data }));
  assert.match(html, /时柱 （待补时）/);
  assert.doesNotMatch(html, /日主在支|干自坐支|运势/);
});
