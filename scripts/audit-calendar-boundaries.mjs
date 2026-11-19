/**
 * 1900–2100 年节气与合朔（农历初一）跨日边界自动巡检脚本。
 * 对比 tyme4ts 历表与天文主星历（Astronomy Engine），自动识别：
 * 1. 交节时刻距离北京时间 00:00（换日线）较近的高风险节气；
 * 2. 新月合朔时刻距离北京时间 00:00 较近、可能造成不同天文台农历差一日的朔日（如 2057 年 9 月）。
 */
import * as Astronomy from 'astronomy-engine';
import { SolarTerm } from 'tyme4ts';

const BEIJING_OFFSET_MS = 8 * 3_600_000;
const DAY_MS = 86_400_000;

function formatBeijing(utcMs) {
  return new Date(utcMs + BEIJING_OFFSET_MS).toISOString().replace('T', ' ').slice(0, 19);
}

function secondsFromBeijingMidnight(utcMs) {
  const bj = new Date(utcMs + BEIJING_OFFSET_MS);
  const sec = bj.getUTCHours() * 3600 + bj.getUTCMinutes() * 60 + bj.getUTCSeconds();
  return Math.min(sec, 86400 - sec);
}

function auditSolarTerms(startYear, endYear, thresholdSeconds = 300) {
  const midnightNearTerms = [];
  let maxDiffSeconds = 0;
  let maxDiffDetail = null;

  for (let year = startYear; year <= endYear; year++) {
    for (let index = 0; index < 24; index++) {
      const term = SolarTerm.fromIndex(year, index);
      const st = term.getJulianDay().getSolarTime();
      const tymeUtcMs = Date.UTC(
        st.getYear(),
        st.getMonth() - 1,
        st.getDay(),
        st.getHour() - 8,
        st.getMinute(),
        st.getSecond(),
      );
      const targetLon = (270 + index * 15) % 360;
      const searched = Astronomy.SearchSunLongitude(targetLon, new Date(tymeUtcMs - 2 * DAY_MS), 5);
      const astroUtcMs = searched ? searched.date.getTime() : tymeUtcMs;
      const diffSeconds = Math.abs(astroUtcMs - tymeUtcMs) / 1000;
      if (diffSeconds > maxDiffSeconds) {
        maxDiffSeconds = diffSeconds;
        maxDiffDetail = { year, name: term.getName(), tymeUtc: new Date(tymeUtcMs).toISOString(), diffSeconds };
      }

      const distMidnight = secondsFromBeijingMidnight(tymeUtcMs);
      if (distMidnight <= thresholdSeconds) {
        midnightNearTerms.push({
          year,
          name: term.getName(),
          beijingTime: formatBeijing(tymeUtcMs),
          secondsFromMidnight: distMidnight,
          astroDiffSeconds: Number(((astroUtcMs - tymeUtcMs) / 1000).toFixed(1)),
        });
      }
    }
  }
  return { maxDiffSeconds, maxDiffDetail, midnightNearTerms };
}

function auditNewMoons(startYear, endYear, thresholdSeconds = 300) {
  const midnightNearNewMoons = [];
  let cursor = new Date(Date.UTC(startYear, 0, 1));
  const endMs = Date.UTC(endYear + 1, 0, 1);

  while (cursor.getTime() < endMs) {
    const found = Astronomy.SearchMoonPhase(0, cursor, 40);
    if (!found) break;
    const utcMs = found.date.getTime();
    if (utcMs >= endMs) break;
    const distMidnight = secondsFromBeijingMidnight(utcMs);
    if (distMidnight <= thresholdSeconds) {
      midnightNearNewMoons.push({
        beijingTime: formatBeijing(utcMs),
        utcTime: new Date(utcMs).toISOString(),
        secondsFromMidnight: distMidnight,
      });
    }
    cursor = new Date(utcMs + 20 * DAY_MS);
  }
  return midnightNearNewMoons;
}

const termAudit = auditSolarTerms(1900, 2100, 300);
const newMoonAudit = auditNewMoons(1900, 2100, 300);

console.log('=== 1900–2100 节气与合朔跨日边界巡检 ===');
console.log(`节气历表 vs 天文星历最大差值: ${termAudit.maxDiffSeconds.toFixed(1)} 秒`, termAudit.maxDiffDetail);
console.log(`距北京时间午夜 5 分钟内的交节 (${termAudit.midnightNearTerms.length} 项):`);
for (const item of termAudit.midnightNearTerms.slice(0, 10)) {
  console.log(`  - ${item.beijingTime} (${item.name}, 距午夜 ${item.secondsFromMidnight}s, 星历差 ${item.astroDiffSeconds}s)`);
}
console.log(`距北京时间午夜 5 分钟内的新月合朔 (${newMoonAudit.length} 项):`);
for (const item of newMoonAudit) {
  console.log(`  - ${item.beijingTime} (UTC ${item.utcTime}, 距午夜 ${item.secondsFromMidnight}s)`);
}
