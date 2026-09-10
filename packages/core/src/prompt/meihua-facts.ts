import type { MeihuaData } from '../types/divination';
import { getBranchWuxing, getSeasonState, isSheng, isKe } from '../ganzhi';
import { MEIHUA_DIRECTION_OPTIONS, MEIHUA_OBJECT_OPTIONS } from '../divination/config';

export function formatMeihuaFacts(data: MeihuaData): string[] {
  const lines = [...data.yaosDetail].sort((a, b) => a.position - b.position);
  const moving = lines.find((line) => line.position === data.movingYao.position);
  const facts: string[] = [];
  if (lines.length === 6 && lines.every((line, index) => line.position === index + 1)) {
    facts.push(
      `主卦爻象：上卦${data.mainHexagram.upper}、下卦${data.mainHexagram.lower}；自下而上为${lines.map((line) => `第${line.position}爻${line.yaoType}`).join('、')}`,
    );
    if (data.interHexagram) {
      facts.push(
        `互卦取爻：主卦第2至4爻${lines
          .slice(1, 4)
          .map((line) => line.yaoType)
          .join('')}为下卦${data.interHexagram.lower}；第3至5爻${lines
          .slice(2, 5)
          .map((line) => line.yaoType)
          .join('')}为上卦${data.interHexagram.upper}，合为${data.interHexagram.name}`,
      );
    }
    if (moving && data.changedHexagram) {
      facts.push(
        `动爻变化：主卦第${moving.position}爻${moving.yaoType}变${moving.yaoType === '阳' ? '阴' : '阳'}；动爻位于${moving.position <= 3 ? '下' : '上'}卦，用卦随之变化，体卦保持；变卦上卦${data.changedHexagram.upper}、下卦${data.changedHexagram.lower}，合为${data.changedHexagram.name}`,
      );
    }
  }
  const c = data.calculation;
  if (c) {
    if (
      (c.methodKey === 'time' || c.methodKey === 'timeTrigram') &&
      [c.yearZhiIndex, c.month, c.day, c.timeZhiIndex].every((value) => typeof value === 'number')
    ) {
      facts.push(
        `起卦取数：农历年支${c.yearZhi}序数${c.yearZhiIndex}、农历月数${c.month}、农历日数${c.day}、时支${c.timeZhi}序数${c.timeZhiIndex}；年支序数加月数加日数除8取余得上卦数${c.upperTrigramIndex}，再加时支序数除8取余得下卦数${c.lowerTrigramIndex}，同一总数除6取余得动爻${c.movingYaoIndex}；卦数余0取8，动爻余0取6`,
      );
    } else if (
      c.methodKey === 'number' &&
      typeof c.number === 'number' &&
      typeof c.timeZhiIndex === 'number'
    ) {
      facts.push(
        `起卦取数：数字${c.number}除8取余得上卦数${c.upperTrigramIndex}；数字${c.number}加时支${c.timeZhi}序数${c.timeZhiIndex}，除8取余得下卦数${c.lowerTrigramIndex}，除6取余得动爻${c.movingYaoIndex}；卦数余0取8，动爻余0取6`,
      );
    } else if (
      c.methodKey === 'sound' &&
      typeof c.soundCount === 'number' &&
      typeof c.timeZhiIndex === 'number'
    ) {
      facts.push(
        `起卦取数：所闻声音数${c.soundCount}除8取余得上卦数${c.upperTrigramIndex}；声音数${c.soundCount}加时支${c.timeZhi}序数${c.timeZhiIndex}，除8取余得下卦数${c.lowerTrigramIndex}，除6取余得动爻${c.movingYaoIndex}；卦数余0取8，动爻余0取6`,
      );
    } else if (
      c.methodKey === 'character' &&
      typeof c.characterCount === 'number' &&
      typeof c.characterUpperNumber === 'number' &&
      typeof c.characterLowerNumber === 'number'
    ) {
      const toneText = Array.isArray(c.characterTones)
        ? `，传统声类按平1、上2、去3、入4取数为${c.characterTones.join('、')}`
        : Array.isArray(c.characterStrokeCounts)
          ? `，逐字笔画数为${c.characterStrokeCounts.join('、')}`
          : c.characterCount === 1
            ? `，左右分笔数为${c.characterLeftStrokes}、${c.characterRightStrokes}`
            : '';
      facts.push(
        `起卦取数：${c.characterText ? `文字「${c.characterText}」，` : ''}字数${c.characterCount}${toneText}，上卦取数${c.characterUpperNumber}，下卦取数${c.characterLowerNumber}；分别除8取余得上卦数${c.upperTrigramIndex}、下卦数${c.lowerTrigramIndex}，上下卦取数之和除6取余得动爻${c.movingYaoIndex}；卦数余0取8，动爻余0取6`,
      );
    } else if (
      c.methodKey === 'direction' &&
      typeof c.objectTrigramIndex === 'number' &&
      typeof c.directionTrigramIndex === 'number' &&
      typeof c.timeZhiIndex === 'number'
    ) {
      const objectLabel =
        MEIHUA_OBJECT_OPTIONS.find((item) => item.value === c.objectType)?.label ??
        data.mainHexagram.upper;
      const directionLabel =
        MEIHUA_DIRECTION_OPTIONS.find((item) => item.value === c.direction)?.label ??
        data.mainHexagram.lower;
      facts.push(
        `起卦取数：所见物类${objectLabel}取上卦数${c.objectTrigramIndex}，方位${directionLabel}取下卦数${c.directionTrigramIndex}；上卦数加下卦数及时支${c.timeZhi}序数${c.timeZhiIndex}除6取余得动爻${c.movingYaoIndex}；卦数余0取8，动爻余0取6`,
      );
    }
  }
  const branch = data.analysis.monthBranch;
  if (branch) {
    const month = getBranchWuxing(branch);
    for (const [role, gua] of [
      ['原体', data.tiGua],
      ['原用', data.yongGua],
      ['体互', data.interTiGua],
      ['用互', data.interYongGua],
      ['变后体卦', data.changedTiGua],
      ['变后用卦', data.changedYongGua],
    ] as const) {
      if (!gua) continue;
      const subject = `${role}${gua.name}${gua.element}`;
      const order = `${branch}月令${month}`;
      const relation =
        month === gua.element
          ? `${subject}与${order}同类`
          : isSheng(month, gua.element)
            ? `${order}生${subject}`
            : isSheng(gua.element, month)
              ? `${subject}生${order}，卦气泄出`
              : isKe(month, gua.element)
                ? `${order}克${subject}`
                : isKe(gua.element, month)
                  ? `${subject}克${order}，卦气耗用`
                  : '';
      if (relation)
        facts.push(`月令作用：${relation}，${role}为${getSeasonState(gua.element, branch)}`);
    }
  }
  return facts;
}
