import { asArray, asNumber, asRecord, asString, createBoardHeader, createMetaGrid, el } from './dom';

export function renderFortuneBoard(shell: HTMLElement, raw: unknown): boolean {
  const rec = asRecord(raw);
  const overview = asRecord(rec?.overview);
  const calendar = asRecord(rec?.calendar);
  if (!rec || !overview || !calendar) return false;

  const targetLabel = asString(rec.targetLabel) ?? '';
  const scopeLabel = asString(rec.scopeLabel) ?? '运势';
  const mode = asString(rec.mode);
  const caseName = asString(rec.caseName);
  const overallScore = asNumber(overview.overallScore) ?? 70;
  const overallTier = asString(overview.overallTier) ?? '平稳';
  const headline = asString(overview.headline) ?? '';

  const badges: Array<{ text: string; tone?: 'accent' | 'neutral' | 'good' | 'warn' }> = [
    { text: scopeLabel, tone: 'accent' },
    {
      text: mode === 'personalized' ? `定制 · ${caseName || '已选档案'}` : '通用流时',
      tone: mode === 'personalized' ? 'good' : 'neutral',
    },
    {
      text: `${overallTier} · ${overallScore}分`,
      tone: overallScore >= 75 ? 'good' : overallScore >= 60 ? 'neutral' : 'warn',
    },
  ];

  shell.append(
    createBoardHeader(
      `${targetLabel}${scopeLabel}`,
      headline,
      badges,
    ),
  );

  const gz = asRecord(calendar.ganzhi);
  const meta = createMetaGrid([
    ['公历 / 农历', `${asString(calendar.targetDate) ?? ''} · ${asString(calendar.lunarDate) ?? ''}（${asString(calendar.weekday) ?? ''}）`],
    ['流时干支', gz ? `${asString(gz.year) ?? ''}年 ${asString(gz.month) ?? ''}月 ${asString(gz.day) ?? ''}日` : undefined],
    ['节气 / 值神', `${asString(calendar.solarTerm) ?? ''} · ${asString(calendar.dayOfficer) ?? ''}日 · ${asString(calendar.twelveStar) ?? ''}`],
    ['冲煞 / 二十八宿', `${asString(calendar.clash) ?? ''} · ${asString(calendar.twentyEightStar) ?? ''}宿`],
  ]);
  if (meta) shell.append(meta);

  const dims = asArray(overview.dimensions).map(asRecord).filter((x): x is NonNullable<typeof x> => Boolean(x));
  if (dims.length > 0) {
    const sec = el('div', 'lr-section');
    sec.append(el('h4', 'lr-section-title', '五维运势趋势速览'));
    const grid = el('div', 'al-hours-grid');
    for (const dim of dims) {
      const trend = asString(dim.trend) ?? '平';
      const score = asNumber(dim.score) ?? 68;
      const card = el('div', `al-hour-card ${trend === '旺' ? 'is-good' : trend === '谨' ? 'is-bad' : ''}`);
      const top = el('div', 'al-hour-top');
      top.append(el('strong', 'al-hour-name', asString(dim.label) ?? '维度'));
      top.append(
        el(
          'span',
          `wb-badge ${trend === '旺' ? 'wb-badge-good' : trend === '谨' ? 'wb-badge-warn' : 'wb-badge-neutral'}`,
          `${trend} · ${score}分`,
        ),
      );
      card.append(top);
      const summary = asString(dim.summary);
      if (summary) card.append(el('div', 'al-hour-range', summary));
      grid.append(card);
    }
    sec.append(grid);
    shell.append(sec);
  }

  return true;
}
