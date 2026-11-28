import {
  asArray,
  asNumber,
  asRecord,
  asString,
  createBoardDetailBar,
  createBoardHeader,
  createBoardModalTrigger,
  createMetaGrid,
  el,
} from './dom';

const FORTUNE_CATEGORY_LABELS: Record<string, string> = {
  bazi: '八字',
  ziwei: '紫微',
  astrolabe: '星盘',
  almanac: '黄历',
  wuyun: '五运六气',
};

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
    ...(mode === 'personalized'
      ? [{ text: `定制 · ${caseName || '已选档案'}`, tone: 'good' as const }]
      : []),
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
  const actionGuide = asRecord(overview.actionGuide);
  const lucky = asRecord(actionGuide?.luckyElements);
  const luckySummary = lucky
    ? [
        asArray(lucky.wuxing).map(asString).filter(Boolean).join('/') ? `五行:${asArray(lucky.wuxing).map(asString).filter(Boolean).join('/')}` : '',
        asArray(lucky.directions).map(asString).filter(Boolean).join('/') ? `方位:${asArray(lucky.directions).map(asString).filter(Boolean).join('/')}` : '',
        asArray(lucky.colors).map(asString).filter(Boolean).join('/') ? `色系:${asArray(lucky.colors).map(asString).filter(Boolean).join('/')}` : '',
        asArray(lucky.hours).map(asString).filter(Boolean).join('、') ? `吉时:${asArray(lucky.hours).map(asString).filter(Boolean).join('、')}` : '',
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined;
  const suitableStr = asArray(actionGuide?.suitable).map(asString).filter(Boolean).slice(0, 6).join('、') || undefined;
  const cautionStr = asArray(actionGuide?.caution).map(asString).filter(Boolean).slice(0, 4).join('、') || undefined;

  const meta = createMetaGrid([
    ['公历 / 农历', `${asString(calendar.targetDate) ?? ''} · ${asString(calendar.lunarDate) ?? ''}（${asString(calendar.weekday) ?? ''}）`],
    ['流时干支', gz ? `${asString(gz.year) ?? ''}年 ${asString(gz.month) ?? ''}月 ${asString(gz.day) ?? ''}日` : undefined],
    ['节气 / 值神', `${asString(calendar.solarTerm) ?? ''} · ${asString(calendar.dayOfficer) ?? ''}日 · ${asString(calendar.twelveStar) ?? ''}`],
    ['冲煞 / 二十八宿', `${asString(calendar.clash) ?? ''} · ${asString(calendar.twentyEightStar) ?? ''}宿`],
    ['开运吉象', luckySummary || undefined],
    ['趋吉 / 避谨', [suitableStr ? `宜:${suitableStr}` : '', cautionStr ? `慎:${cautionStr}` : ''].filter(Boolean).join(' ｜ ') || undefined],
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

  const scoreFactors = asArray(overview.scoreFactors).map(asRecord).filter((x): x is NonNullable<typeof x> => Boolean(x));
  const focusTip = asString(lucky?.focusTip);
  if (scoreFactors.length > 0 || focusTip) {
    const fBar = createBoardDetailBar([
      createBoardModalTrigger(
        '运势评分依据',
        '运势评分因子与合参依据',
        () => {
          const frag = document.createDocumentFragment();
          if (focusTip) frag.append(el('p', 'wb-note-box', focusTip));
          if (scoreFactors.length > 0) {
            const list = el('div', 'wb-computed-list');
            for (const f of scoreFactors) {
              const sent = asString(f.sentiment);
              const impact = asNumber(f.impact);
              const cat = FORTUNE_CATEGORY_LABELS[asString(f.category) ?? ''] ?? asString(f.category) ?? '';
              const card = el(
                'div',
                `wb-computed-item ${sent === 'positive' ? 'is-good' : sent === 'caution' ? 'is-bad' : ''}`.trim(),
              );
              card.append(
                el(
                  'strong',
                  'wb-computed-title',
                  `${cat ? `${cat} · ` : ''}${asString(f.label) ?? ''}${impact !== undefined ? `（${impact >= 0 ? `+${impact}` : impact}）` : ''}`,
                ),
              );
              if (asString(f.detail)) card.append(el('p', 'wb-computed-desc', asString(f.detail)));
              list.append(card);
            }
            frag.append(list);
          }
          return frag;
        },
        scoreFactors.length > 0 ? `${scoreFactors.length}项` : undefined,
      ),
    ]);
    if (fBar) shell.append(fBar);
  }

  return true;
}
