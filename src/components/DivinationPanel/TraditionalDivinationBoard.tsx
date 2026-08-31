import React, {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AstrolabeChart } from '@/components/AstrolabeChart';
import { lookupMetaphysicsTerm, type MetaphysicsTerm } from '@/lib/metaphysics-terms';
import {
  TermExplanationContext,
  TermExplanationModal,
  useMetaphysicsTermModal,
} from '@/components/TermExplanationModal';
import { getLiuyaoTermContext } from '@/lib/chart-term-context';
import { ChartShareModal } from '@/components/ChartShareModal';
import type { DivinationSession } from '@/lib/divination/engine';
import {
  formatHuangjiCivilYear,
  type HuangjiDerivedHexagram,
  type HuangjiJingshiResult,
  type HuangjiPeriodHexagram,
} from 'mingyu-core/huangji-jingshi';
import { TAIYI_PALACES } from 'mingyu-core/taiyi';
import { analyzeAlmanacEvidence } from 'mingyu-core/divination/almanac';
import {
  getAllLiuyaoCategoryChapters,
  getHuangjiCycleClassic,
  getJinkoujueMovementClassic,
  getLiurenGeneralClassic,
  getLiurenLessonPatternClassic,
  getLiurenTransmissionClassic,
  getLiuyaoChishiClassic,
  getLiuyaoMovementRule,
  getMeihuaBodyUseJudgement,
  getMeihuaTrigramClassic,
  getQimenDeityClassic,
  getQimenDoorClassic,
  getQimenStarClassic,
  getQimenStemPattern,
  getTaiyiGeneralClassic,
  getXiaoliurenClassic,
  getZhouyiHexagramClassic,
} from 'mingyu-core/classics';
import type {
  AlmanacData,
  AstrolabeData,
  JinkoujueData,
  LenormandData,
  LiurenData,
  LiurenPlateItem,
  LiurenTransmission,
  LiuyaoData,
  MeihuaData,
  QimenData,
  SsgwData,
  TaiyiResult,
  TarotData,
  XiaoliurenData,
} from '@/types/divination';

const QIMEN_LO_SHU_ORDER = [4, 9, 2, 3, 5, 7, 8, 1, 6];
const TAIYI_PALACE_LAYOUT = [
  { palace: 9, row: 2, column: 2 },
  { palace: 2, row: 2, column: 3 },
  { palace: 7, row: 2, column: 4 },
  { palace: 4, row: 3, column: 2 },
  { palace: 5, row: 3, column: 3 },
  { palace: 6, row: 3, column: 4 },
  { palace: 3, row: 4, column: 2 },
  { palace: 8, row: 4, column: 3 },
  { palace: 1, row: 4, column: 4 },
] as const;
const TAIYI_POINT_LAYOUT = [
  { point: '巽', row: 1, column: 1 },
  { point: '巳', row: 1, column: 2 },
  { point: '午', row: 1, column: 3 },
  { point: '未', row: 1, column: 4 },
  { point: '坤', row: 1, column: 5 },
  { point: '辰', row: 2, column: 1 },
  { point: '申', row: 2, column: 5 },
  { point: '卯', row: 3, column: 1 },
  { point: '酉', row: 3, column: 5 },
  { point: '寅', row: 4, column: 1 },
  { point: '戌', row: 4, column: 5 },
  { point: '艮', row: 5, column: 1 },
  { point: '丑', row: 5, column: 2 },
  { point: '子', row: 5, column: 3 },
  { point: '亥', row: 5, column: 4 },
  { point: '乾', row: 5, column: 5 },
] as const;

function formatYaoPosition(position: number) {
  return ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'][position - 1] ?? `${position}爻`;
}

const DivinationActionsContext = createContext<{
  onShare: () => void;
  onRestart?: () => void;
}>({
  onShare: () => {},
});

function TraditionalBoardShell(props: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  const { title, subtitle, children, className = '', actions } = props;
  const { onShare, onRestart } = useContext(DivinationActionsContext);
  return (
    <section className={`traditional-board ${className}`.trim()}>
      <div className="traditional-board-head">
        <div className="traditional-board-title-wrap">
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <div className="traditional-board-head-actions">
          {actions}
          <button type="button" className="traditional-action-btn" onClick={onShare}>
            分享排盘
          </button>
          {onRestart ? (
            <button type="button" className="traditional-action-btn" onClick={onRestart}>
              重新占问
            </button>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function TraditionalMeta(props: { items: Array<[string, string | number | undefined]> }) {
  const { openTerm } = useMetaphysicsTermModal();
  return (
    <div className="traditional-meta-row">
      {props.items
        .filter(([, value]) => value !== undefined && value !== '')
        .map(([label, value]) => (
          <span
            key={label}
            className="is-clickable-term"
            onClick={() => openTerm(label)}
            title={`点击查看【${label}】释义`}
          >
            <b>{label}</b>
            {value}
          </span>
        ))}
    </div>
  );
}

function TraditionalFacts(props: {
  items: Array<[string, string | number | undefined | null]>;
  className?: string;
}) {
  const { openTerm } = useMetaphysicsTermModal();
  const visibleItems = props.items.filter(
    ([, value]) => value !== undefined && value !== null && value !== '',
  );
  if (!visibleItems.length) return null;

  return (
    <div className={`traditional-fact-grid${props.className ? ` ${props.className}` : ''}`}>
      {visibleItems.map(([label, value]) => (
        <div
          key={label}
          className="is-clickable-term"
          onClick={() => openTerm(String(value) || label)}
          title={`点击查看【${value || label}】释义`}
        >
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function YaoLine(props: {
  label?: string;
  yaoType: '阳' | '阴';
  changing?: boolean;
  className?: string;
}) {
  const { label, yaoType, changing = false, className = '' } = props;
  return (
    <div className={`traditional-yao-line ${className}`.trim()}>
      {label ? <span className="traditional-yao-label">{label}</span> : null}
      <span
        className={`traditional-yao-symbol is-${yaoType === '阴' ? 'yin' : 'yang'}${changing ? ' is-changing' : ''}`}
        aria-label={`${yaoType}${changing ? '动爻' : ''}`}
      >
        <i />
        {yaoType === '阴' ? <i /> : null}
      </span>
      {changing ? <em>动</em> : null}
    </div>
  );
}

function ClassicalAnnotationCard(props: {
  title: string;
  source: string;
  verse?: string;
  modernAdvice?: string;
  children?: ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);
  const { title, source, verse, modernAdvice, children } = props;
  return (
    <div className="traditional-classic-card">
      <div
        className="traditional-classic-head"
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setExpanded(!expanded);
        }}
        role="button"
        tabIndex={0}
      >
        <div>
          <span className="traditional-classic-badge">{source}</span>
          <strong>{title}</strong>
        </div>
        <span className="traditional-classic-toggle">{expanded ? '收起典籍 ▴' : '展开典籍 ▾'}</span>
      </div>
      {expanded ? (
        <div className="traditional-classic-body">
          {verse ? <p className="traditional-classic-verse">{verse}</p> : null}
          {modernAdvice ? <p className="traditional-classic-advice">{modernAdvice}</p> : null}
          {children}
        </div>
      ) : null}
    </div>
  );
}

const LIUYAO_WORLD_HOLD_RULES: Record<string, string> = {
  妻财: '妻财持世：预测买卖、男子婚姻、财运、失物等为吉；预测父母、长辈、买房、买地等则不吉。以为吉，则是财运亨通、失物可觅之象；以为不吉，则是契约不成、与父母缘分薄之象。',
  子孙: '子孙持世：预测求医问药、出行平安、买卖求财、避凶趋吉等为吉；预测求官、升学考试、文书诉讼等则不吉。以为吉，则是福德临身、灾消难散之象；以为不吉，则是功名难就、降职罢官之象。',
  官鬼: '官鬼持世：预测求官升职、考公晋升、女子婚姻、功名利禄等为吉；预测疾病、出行、平安求财等则不吉。以为吉，则是官运亨通、贵人提携之象；以为不吉，则是忧患缠身、惊恐灾祸之象。',
  父母: '父母持世：预测升学考试、论文答辩、签约买房、车船长辈等为吉；预测求财、子孙后代、买卖经商等则不吉。以为吉，则是文书有成、得长辈庇佑之象；以为不吉，则是劳碌辛苦、求财耗力之象。',
  兄弟: '兄弟持世：预测交友、合伙谋划、防灾避祸等为吉；预测求财、经商投资、妻子健康等则不吉。以为吉，则是同道相助、人气聚集之象；以为不吉，则是破耗资财、小人争夺之象。',
};

const SYMBOL_TO_TRIGRAM: Record<string, string> = {
  天: '乾',
  乾: '乾',
  地: '坤',
  坤: '坤',
  雷: '震',
  震: '震',
  风: '巽',
  巽: '巽',
  水: '坎',
  坎: '坎',
  火: '离',
  离: '离',
  山: '艮',
  艮: '艮',
  泽: '兑',
  兑: '兑',
};

const TRIGRAM_STEMS: Record<string, { inner: string; outer: string }> = {
  乾: { inner: '甲', outer: '壬' },
  坤: { inner: '乙', outer: '癸' },
  震: { inner: '庚', outer: '庚' },
  巽: { inner: '辛', outer: '辛' },
  坎: { inner: '戊', outer: '戊' },
  离: { inner: '己', outer: '己' },
  艮: { inner: '丙', outer: '丙' },
  兑: { inner: '丁', outer: '丁' },
};

function getHexagramTrigrams(hexName: string): { upper: string; lower: string } {
  if (!hexName) return { upper: '乾', lower: '乾' };
  if (hexName.includes('为')) {
    const pure = hexName[0];
    const tri = SYMBOL_TO_TRIGRAM[pure] || '乾';
    return { upper: tri, lower: tri };
  }
  const upperChar = hexName[0];
  const lowerChar = hexName[1];
  const upper = SYMBOL_TO_TRIGRAM[upperChar] || '乾';
  const lower = SYMBOL_TO_TRIGRAM[lowerChar] || '乾';
  return { upper, lower };
}

function getHexagramYaoStems(hexName: string): string[] {
  const { upper, lower } = getHexagramTrigrams(hexName);
  const innerStem = TRIGRAM_STEMS[lower]?.inner || '';
  const outerStem = TRIGRAM_STEMS[upper]?.outer || '';
  return [innerStem, innerStem, innerStem, outerStem, outerStem, outerStem];
}

function LiuyaoDualHexagramView({ data }: { data: LiuyaoData }) {
  const { openTerm } = useMetaphysicsTermModal();
  const rows = [...data.yaosDetail].sort((a, b) => b.position - a.position);
  const hasChanged = Boolean(data.changedName && data.changedName !== data.originalName);

  const mainStems = useMemo(() => getHexagramYaoStems(data.originalName), [data.originalName]);
  const changedStems = useMemo(
    () => (hasChanged && data.changedName ? getHexagramYaoStems(data.changedName) : []),
    [hasChanged, data.changedName],
  );

  const shortRelative = (name?: string) => {
    if (!name) return '—';
    if (name === '妻财') return '财';
    if (name === '子孙') return '孙';
    if (name === '官鬼') return '官';
    if (name === '父母') return '父';
    if (name === '兄弟') return '兄';
    return name.slice(0, 1);
  };

  return (
    <div className="traditional-liuyao-dual-view">
      <div className="liuyao-hexagram-header">
        <div className="liuyao-hexagram-title-col">
          <span
            className="liuyao-hexagram-title is-clickable-term"
            onClick={() => openTerm(data.originalName)}
            title={`点击查看【${data.originalName}】释义`}
          >
            {data.originalName}
          </span>
          <span className="liuyao-hexagram-palace">({data.palace?.name || ''})</span>
        </div>
        <div className="liuyao-hexagram-title-col">
          {hasChanged && data.changedName ? (
            <>
              <span
                className="liuyao-hexagram-title is-clickable-term"
                onClick={() => openTerm(data.changedName || '')}
                title={`点击查看【${data.changedName}】释义`}
              >
                {data.changedName}
              </span>
              <span className="liuyao-hexagram-palace">({data.palace?.name || ''})</span>
            </>
          ) : (
            <span className="liuyao-muted-title">静卦无变</span>
          )}
        </div>
      </div>

      <div className="liuyao-rows-container">
        {rows.map((yao) => {
          const hidden = data.hiddenSpirits?.find((h) => h.position === yao.position);
          const isGuaShen = data.guaShen?.position === yao.position;
          const changedIsYang = yao.changedYao ? yao.yaoType === '阴' : yao.yaoType === '阳';

          const handleYaoTerm = (t: string) => {
            const ctx = getLiuyaoTermContext(
              t,
              {
                originalName: data.originalName,
                changedName: data.changedName,
                palace: data.palace,
                voidBranches: data.voidBranches,
              },
              {
                position: yao.position,
                sixGod: yao.sixGod,
                sixRelative: yao.sixRelative,
                najia: `${yao.najiaDizhi}${yao.wuxing}`,
                isWorld: yao.isWorld,
                isResponse: yao.isResponse,
                isChanging: yao.isChanging,
              },
            );
            openTerm(t, ctx);
          };

          return (
            <div className="liuyao-row-wrapper" key={yao.position}>
              <div className="liuyao-main-row">
                {/* 1. 本卦左侧 */}
                <div className="liuyao-left-half">
                  <span
                    className="liuyao-six-god is-clickable-term"
                    onClick={() => handleYaoTerm(yao.sixGod || '')}
                    title={yao.sixGod || ''}
                  >
                    {yao.sixGod?.slice(0, 1) || '—'}
                  </span>
                  <span
                    className="liuyao-relative is-clickable-term"
                    onClick={() => handleYaoTerm(yao.sixRelative || '六亲')}
                    title={yao.sixRelative}
                  >
                    {shortRelative(yao.sixRelative)}
                  </span>
                  <span className="liuyao-dizhi-wuxing">
                    {yao.najiaDizhi}
                    {yao.wuxing}
                  </span>
                  <span className="liuyao-najia-stem">{mainStems[yao.position - 1] || ''}</span>
                  <div className="liuyao-bar-container">
                    {yao.yaoType === '阳' ? (
                      <div className="liuyao-bar-yang" />
                    ) : (
                      <div className="liuyao-bar-yin">
                        <div className="liuyao-bar-yin-part" />
                        <div className="liuyao-bar-yin-part" />
                      </div>
                    )}
                  </div>
                  <div className="liuyao-marker-col">
                    {yao.isWorld ? <span className="liuyao-shi-tag">世</span> : null}
                    {yao.isResponse ? <span className="liuyao-ying-tag">应</span> : null}
                    {yao.isChanging ? (
                      <span className="liuyao-moving-tag">
                        {yao.yaoType === '阳' ? 'O →' : 'X →'}
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* 2. 变卦右侧 */}
                <div className="liuyao-right-half">
                  {hasChanged ? (
                    <>
                      <div className="liuyao-bar-container">
                        {changedIsYang ? (
                          <div className="liuyao-bar-yang" />
                        ) : (
                          <div className="liuyao-bar-yin">
                            <div className="liuyao-bar-yin-part" />
                            <div className="liuyao-bar-yin-part" />
                          </div>
                        )}
                      </div>
                      <span
                        className="liuyao-relative is-clickable-term"
                        onClick={() =>
                          handleYaoTerm(yao.changedYao?.liuqin ?? yao.sixRelative ?? '六亲')
                        }
                      >
                        {shortRelative(yao.changedYao?.liuqin ?? yao.sixRelative)}
                      </span>
                      <span className="liuyao-dizhi-wuxing">
                        {yao.changedYao
                          ? `${yao.changedYao.dizhi}${yao.changedYao.wuxing}`
                          : `${yao.najiaDizhi}${yao.wuxing}`}
                      </span>
                      <span className="liuyao-najia-stem">
                        {changedStems[yao.position - 1] || ''}
                      </span>
                    </>
                  ) : (
                    <div className="liuyao-empty-placeholder">—</div>
                  )}
                </div>
              </div>

              {/* 3. 附注子行（伏神 / 卦身） */}
              {hidden || isGuaShen ? (
                <div className="liuyao-subrow-notes">
                  {hidden ? (
                    <span
                      className="liuyao-fushen-note is-clickable-term"
                      onClick={() => handleYaoTerm('伏神')}
                      title={`伏神：${hidden.sixRelative} ${hidden.najiaDizhi}${hidden.wuxing}`}
                    >
                      伏神: {shortRelative(hidden.sixRelative)} {hidden.najiaDizhi}
                      {hidden.wuxing}
                    </span>
                  ) : null}
                  {isGuaShen ? (
                    <span
                      className="liuyao-guashen-note is-clickable-term"
                      onClick={() => handleYaoTerm('卦身')}
                      title={`卦身为${data.guaShen?.branch}`}
                    >
                      卦身为{data.guaShen?.branch}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="liuyao-hexagram-footer">
        <span>本卦：{data.hexagramRelations?.original || '本卦定局'}</span>
        <span>{hasChanged ? `变卦：${data.hexagramRelations?.changed || '变卦定局'}` : ''}</span>
      </div>
    </div>
  );
}

function LiuyaoCategoryClassicsSection() {
  const chapters = getAllLiuyaoCategoryChapters();
  const [activeCat, setActiveCat] = useState<string>('wealth');
  const current = chapters.find((c) => c.category === activeCat) ?? chapters[0];

  return (
    <div className="traditional-classics-category-box">
      <div className="traditional-classics-category-head">
        <strong>《黄金策》分类占验专章</strong>
        <span className="traditional-classic-badge">古籍全览</span>
      </div>
      <div className="traditional-category-tabs">
        {chapters.map((ch) => (
          <button
            key={ch.category}
            type="button"
            className={`traditional-category-tab-btn ${ch.category === activeCat ? 'is-active' : ''}`}
            onClick={() => setActiveCat(ch.category)}
          >
            {ch.title.replace('黄金策 · ', '')}
          </button>
        ))}
      </div>
      <div className="traditional-category-content">
        <p className="traditional-classic-verse">{current.verse}</p>
        <p className="traditional-classic-advice">{current.explanation}</p>
      </div>
    </div>
  );
}

function LiuyaoTraditionalBoard({
  data,
  session,
}: {
  data: LiuyaoData;
  session?: DivinationSession;
}) {
  const changing = data.changingYaos
    ?.filter((item) => item.isChanging)
    .map((item) => item.position);
  const changedTitle =
    changing?.length && data.changedName && data.changedName !== data.originalName
      ? ` · 之${data.changedName}`
      : '';

  const worldYao = data.yaosDetail.find((y) => y.isWorld);
  const worldAdvice = worldYao?.sixRelative
    ? LIUYAO_WORLD_HOLD_RULES[worldYao.sixRelative]
    : undefined;

  const hexagramTips = useMemo(() => {
    const tips: Array<{ title: string; desc: string }> = [];
    if (worldAdvice) {
      tips.push({
        title: `${worldYao?.sixRelative}持世`,
        desc: worldAdvice,
      });
    }
    if (data.hexagramRelations?.original === '六冲卦') {
      tips.push({
        title: '六冲卦',
        desc: '主散，不利于合作、情感，也主脱离，逢冲则动，测忧患得冲为散。',
      });
    } else if (data.hexagramRelations?.original === '六合卦') {
      tips.push({
        title: '六合卦',
        desc: '主合，利于合作、情感，也主羁绊，合则事定，测谋事得合为成。',
      });
    }
    if (data.hexagramRelations?.changed === '六冲卦') {
      tips.push({
        title: '变卦六冲',
        desc: '始合终散，事有反复变化，先顺而后有阻隔。',
      });
    } else if (data.hexagramRelations?.changed === '六合卦') {
      tips.push({
        title: '变卦六合',
        desc: '始难终谐，结局趋于圆满定局，利于长久发展。',
      });
    }
    return tips;
  }, [worldAdvice, worldYao, data.hexagramRelations]);

  const classicHexagram = data.hexagramId ? getZhouyiHexagramClassic(data.hexagramId) : undefined;

  const changingYaoTexts = useMemo(() => {
    if (!classicHexagram) return [];
    return (changing ?? [])
      .map((pos) => {
        const yaoText = classicHexagram.yaos?.find((y) => y.position === pos);
        return {
          pos,
          title: `${classicHexagram.name} · ${formatYaoPosition(pos)} 爻辞`,
          verse: yaoText ? `【爻辞】${yaoText.yaoCi}\n${yaoText.xiaoXiang}` : '',
          advice: yaoText?.explanation || '',
        };
      })
      .filter((item) => Boolean(item.verse));
  }, [classicHexagram, changing]);

  const movementRules = useMemo(() => {
    const rules: Array<{
      key: string;
      trigger: string;
      source: string;
      verse: string;
      advice: string;
    }> = [];
    data.yaosDetail.forEach((yao) => {
      if (yao.isChanging) {
        let key = '';
        if (yao.sixRelative === '父母') key = 'parent_active';
        else if (yao.sixRelative === '子孙') key = 'child_active';
        else if (yao.sixRelative === '官鬼') key = 'officer_active';
        else if (yao.sixRelative === '妻财') key = 'wealth_active';
        else if (yao.sixRelative === '兄弟') key = 'brother_active';

        if (key) {
          const rule = getLiuyaoMovementRule(key);
          if (rule && !rules.some((r) => r.key === rule.key)) {
            rules.push({
              key: rule.key,
              trigger: rule.trigger,
              source: rule.sourceBook,
              verse: rule.originalVerse,
              advice: rule.generalMeaning,
            });
          }
        }

        let godKey = '';
        if (yao.sixGod?.includes('青龙')) godKey = 'dragon_active';
        else if (yao.sixGod?.includes('朱雀')) godKey = 'bird_active';
        else if (yao.sixGod?.includes('勾陈')) godKey = 'gouchen_active';
        else if (yao.sixGod?.includes('螣蛇')) godKey = 'snake_active';
        else if (yao.sixGod?.includes('白虎')) godKey = 'tiger_active';
        else if (yao.sixGod?.includes('玄武')) godKey = 'turtle_active';

        if (godKey) {
          const godRule = getLiuyaoMovementRule(godKey);
          if (godRule && !rules.some((r) => r.key === godRule.key)) {
            rules.push({
              key: godRule.key,
              trigger: godRule.trigger,
              source: godRule.sourceBook,
              verse: godRule.originalVerse,
              advice: godRule.generalMeaning,
            });
          }
        }

        if (yao.changeDirection === '进神' || yao.changeDirection === '化进神') {
          const rule = getLiuyaoMovementRule('change_advance');
          if (rule && !rules.some((r) => r.key === rule.key)) {
            rules.push({
              key: rule.key,
              trigger: rule.trigger,
              source: rule.sourceBook,
              verse: rule.originalVerse,
              advice: rule.generalMeaning,
            });
          }
        } else if (yao.changeDirection === '退神' || yao.changeDirection === '化退神') {
          const rule = getLiuyaoMovementRule('change_retreat');
          if (rule && !rules.some((r) => r.key === rule.key)) {
            rules.push({
              key: rule.key,
              trigger: rule.trigger,
              source: rule.sourceBook,
              verse: rule.originalVerse,
              advice: rule.generalMeaning,
            });
          }
        }

        if (yao.changeRelation === '化回头生' || yao.changeRelations?.includes('化回头生')) {
          const rule = getLiuyaoMovementRule('change_birth');
          if (rule && !rules.some((r) => r.key === rule.key)) {
            rules.push({
              key: rule.key,
              trigger: rule.trigger,
              source: rule.sourceBook,
              verse: rule.originalVerse,
              advice: rule.generalMeaning,
            });
          }
        }
        if (yao.changeRelation === '化回头克' || yao.changeRelations?.includes('化回头克')) {
          const rule = getLiuyaoMovementRule('change_clash');
          if (rule && !rules.some((r) => r.key === rule.key)) {
            rules.push({
              key: rule.key,
              trigger: rule.trigger,
              source: rule.sourceBook,
              verse: rule.originalVerse,
              advice: rule.generalMeaning,
            });
          }
        }
        if (
          yao.changeRelation === '化入墓' ||
          yao.changeRelations?.includes('化入墓') ||
          yao.isRuMu
        ) {
          const rule = getLiuyaoMovementRule('change_grave');
          if (rule && !rules.some((r) => r.key === rule.key)) {
            rules.push({
              key: rule.key,
              trigger: rule.trigger,
              source: rule.sourceBook,
              verse: rule.originalVerse,
              advice: rule.generalMeaning,
            });
          }
        }
        if (yao.changeRelation === '化绝' || yao.changeRelations?.includes('化绝')) {
          const rule = getLiuyaoMovementRule('change_extinct');
          if (rule && !rules.some((r) => r.key === rule.key)) {
            rules.push({
              key: rule.key,
              trigger: rule.trigger,
              source: rule.sourceBook,
              verse: rule.originalVerse,
              advice: rule.generalMeaning,
            });
          }
        }
        if (yao.changeRelation === '化空' || yao.changeRelations?.includes('化空')) {
          const rule = getLiuyaoMovementRule('change_void');
          if (rule && !rules.some((r) => r.key === rule.key)) {
            rules.push({
              key: rule.key,
              trigger: rule.trigger,
              source: rule.sourceBook,
              verse: rule.originalVerse,
              advice: rule.generalMeaning,
            });
          }
        }
      }
    });
    return rules;
  }, [data.yaosDetail]);

  const chishiClassic = useMemo(() => {
    const rel = worldYao?.sixRelative;
    return rel ? getLiuyaoChishiClassic(rel) : undefined;
  }, [worldYao]);

  return (
    <TraditionalBoardShell
      title={`${data.originalName}${changedTitle}`}
      subtitle={`纳甲六爻 · ${data.palace?.name || ''}宫${data.palaceStage || ''}`}
      className="traditional-liuyao-board"
    >
      <TraditionalMeta
        items={[
          ['占事', session?.question],
          [
            '日期',
            session?.createdAt ? new Date(session.createdAt).toLocaleString('zh-CN') : undefined,
          ],
          [
            '四柱',
            `${data.ganzhi.year} ${data.ganzhi.month} ${data.ganzhi.day} ${data.ganzhi.hour}`,
          ],
          ['旬空', data.voidBranches?.join('、') || '无'],
          [
            '卦身',
            data.guaShen?.branch
              ? `${data.guaShen.branch}（第${data.guaShen.position}爻）`
              : undefined,
          ],
          [
            '世序',
            data.palaceStage ? `${data.palace?.name || ''} · ${data.palaceStage}` : undefined,
          ],
        ]}
      />
      <TraditionalFacts
        items={[
          ['本卦定局', data.hexagramRelations?.original || '本卦'],
          ['变卦定局', data.changedName ? data.hexagramRelations?.changed || '之卦' : '静卦无变'],
          ['卦式特征', data.specialPattern || (data.changedName ? '动变卦' : '六爻静卦')],
        ]}
      />

      {/* 2. 双卦并列对齐爻卦区 */}
      <LiuyaoDualHexagramView data={data} />

      {/* 3. 持世与卦象特性速查 */}
      {hexagramTips.length ? (
        <div className="liuyao-quick-insights-box">
          {hexagramTips.map((tip) => (
            <div className="liuyao-insight-item" key={tip.title}>
              <strong className="liuyao-insight-title">{tip.title}：</strong>
              <span className="liuyao-insight-desc">{tip.desc}</span>
            </div>
          ))}
        </div>
      ) : null}

      {/* 本地先贤断语卡：持世与卦态定局 */}
      {chishiClassic ? (
        <ClassicalAnnotationCard
          title={`${chishiClassic.relation}持世 · 卜筮正宗歌诀`}
          source={chishiClassic.sourceBook}
          verse={chishiClassic.verse}
          modernAdvice={chishiClassic.modernAdvice}
        />
      ) : null}

      {worldAdvice && !chishiClassic ? (
        <ClassicalAnnotationCard
          title={`${worldYao?.sixRelative}持世 · 核心决断`}
          source="增删卜易"
          modernAdvice={worldAdvice}
        />
      ) : null}

      {/* 典籍经文：周易卦辞大象 */}
      {classicHexagram ? (
        <ClassicalAnnotationCard
          title={`${classicHexagram.name} · 周易经文`}
          source="周易全本"
          verse={`【卦辞】${classicHexagram.guaCi}\n${classicHexagram.daXiang}`}
          modernAdvice={classicHexagram.tuanCi}
        />
      ) : null}

      {/* 动爻逐爻爻辞与小象传 */}
      {changingYaoTexts.map((yt) => (
        <ClassicalAnnotationCard
          key={yt.pos}
          title={yt.title}
          source="周易全本"
          verse={yt.verse}
          modernAdvice={yt.advice}
        />
      ))}

      {/* 黄金策动变与六神神煞断语 */}
      {movementRules.map((rule) => (
        <ClassicalAnnotationCard
          key={rule.key}
          title={`${rule.trigger} · 先贤动变诗诀`}
          source={rule.sourceBook}
          verse={rule.verse}
          modernAdvice={rule.advice}
        />
      ))}

      {/* 《黄金策》分类占断大全 */}
      <LiuyaoCategoryClassicsSection />
    </TraditionalBoardShell>
  );
}

const TRIGRAM_YAO_LINES: Record<string, [number, number, number]> = {
  乾: [1, 1, 1],
  兑: [1, 1, 0],
  离: [1, 0, 1],
  震: [1, 0, 0],
  巽: [0, 1, 1],
  坎: [0, 1, 0],
  艮: [0, 0, 1],
  坤: [0, 0, 0],
};

function getHexagramSixLines(upper?: string, lower?: string): number[] {
  if (!upper || !lower) return [];
  const lowerLines = TRIGRAM_YAO_LINES[lower] || [1, 1, 1];
  const upperLines = TRIGRAM_YAO_LINES[upper] || [1, 1, 1];
  return [upperLines[2], upperLines[1], upperLines[0], lowerLines[2], lowerLines[1], lowerLines[0]];
}

function MiniHexagram(props: {
  label: string;
  hexagram?: {
    name: string;
    symbol: string;
    upper: string;
    lower: string;
    description: string;
  } | null;
  active?: boolean;
  movingPosition?: number;
}) {
  const { label, hexagram, active = false, movingPosition } = props;
  const lines = hexagram ? getHexagramSixLines(hexagram.upper, hexagram.lower) : [];

  return (
    <article className={`traditional-mini-hexagram${active ? ' is-active' : ''}`}>
      <div className="mini-hexagram-header">
        <span className="mini-hexagram-label">{label}</span>
        {hexagram ? <strong className="mini-hexagram-name">{hexagram.name}</strong> : null}
      </div>

      {hexagram ? (
        <>
          <div className="mini-hexagram-bars-visual" role="img" aria-label={`${hexagram.name}卦象`}>
            {lines.map((isYang, idx) => {
              const pos = 6 - idx;
              const isMoving = pos === movingPosition;
              return (
                <div key={pos} className={`mini-bar-row${isMoving ? ' is-moving-line' : ''}`}>
                  {isYang === 1 ? (
                    <div className="mini-bar-yang" />
                  ) : (
                    <div className="mini-bar-yin">
                      <div className="mini-bar-yin-part" />
                      <div className="mini-bar-yin-part" />
                    </div>
                  )}
                  {isMoving ? <span className="mini-moving-dot">动</span> : null}
                </div>
              );
            })}
          </div>
          <small className="mini-hexagram-trigram-info">
            {hexagram.upper}上 · {hexagram.lower}下
          </small>
          <p className="mini-hexagram-desc">{hexagram.description}</p>
        </>
      ) : (
        <em>无</em>
      )}
    </article>
  );
}

function MeihuaTraditionalBoard({
  data,
  session,
}: {
  data: MeihuaData;
  session?: DivinationSession;
}) {
  const rows = [...data.yaosDetail].sort((a, b) => b.position - a.position);
  const meihuaJudgement = useMemo(() => {
    return getMeihuaBodyUseJudgement(data.analysis.tiYongRelation);
  }, [data.analysis.tiYongRelation]);

  const mainHexagramClassic = useMemo(() => {
    return data.mainHexagram?.id ? getZhouyiHexagramClassic(data.mainHexagram.id) : undefined;
  }, [data.mainHexagram]);

  const changedHexagramClassic = useMemo(() => {
    return data.changedHexagram?.id ? getZhouyiHexagramClassic(data.changedHexagram.id) : undefined;
  }, [data.changedHexagram]);

  const movingYaoText = useMemo(() => {
    if (!mainHexagramClassic || !data.movingYao?.position) return undefined;
    const y = mainHexagramClassic.yaos?.find((item) => item.position === data.movingYao.position);
    return y
      ? {
          title: `${mainHexagramClassic.name} · 第${data.movingYao.position}爻动爻爻辞`,
          verse: `【爻辞】${y.yaoCi}\n${y.xiaoXiang}`,
          advice: y.explanation || '',
        }
      : undefined;
  }, [mainHexagramClassic, data.movingYao]);

  const tiTrigramClassic = useMemo(() => {
    return data.tiGua?.name ? getMeihuaTrigramClassic(data.tiGua.name) : undefined;
  }, [data.tiGua]);

  return (
    <TraditionalBoardShell
      title={data.mainHexagram.name}
      subtitle="梅花易数 · 体用、互卦与变卦"
      className="traditional-meihua-board"
    >
      <TraditionalMeta
        items={[
          ['占事', session?.question],
          [
            '日期',
            session?.createdAt ? new Date(session.createdAt).toLocaleString('zh-CN') : undefined,
          ],
          [
            '四柱',
            `${data.ganzhi.year} ${data.ganzhi.month} ${data.ganzhi.day} ${data.ganzhi.hour}`,
          ],
          ['起卦法', data.calculation?.method || '梅花易数'],
          ['体卦', `${data.tiGua.name}（${data.tiGua.element}）`],
          ['用卦', `${data.yongGua.name}（${data.yongGua.element}）`],
          ['动爻', `第${data.movingYao.position}爻（${data.movingYao.yaoName}）`],
        ]}
      />
      <TraditionalFacts
        items={[
          ['体用生克', `${data.analysis.tiYongRelation} · ${data.analysis.tiSeasonState}`],
          ['变后格局', data.analysis.changedTiYongRelation],
          ['互卦体用', `${data.analysis.inter1Relation} · ${data.analysis.inter2Relation}`],
        ]}
      />

      <div className="traditional-hexagram-triad">
        <MiniHexagram
          label="主卦·本"
          hexagram={data.mainHexagram}
          active
          movingPosition={data.movingYao.position}
        />
        <MiniHexagram label="互卦·中" hexagram={data.interHexagram} />
        <MiniHexagram
          label="变卦·变"
          hexagram={data.changedHexagram}
          movingPosition={data.movingYao.position}
        />
      </div>

      <div className="traditional-meihua-detail">
        <div className="traditional-meihua-relation">
          <span>体用关系</span>
          <strong>{data.analysis.tiYongRelation}</strong>
          <small>
            {data.analysis.tiSeasonState} · {data.analysis.yongSeasonState}
          </small>
        </div>
        <div className="traditional-meihua-relation">
          <span>互卦关系</span>
          <strong>
            {data.analysis.inter1Relation} · {data.analysis.inter2Relation}
          </strong>
          <small>{data.analysis.changedRelation}</small>
        </div>
      </div>

      <div className="traditional-meihua-yaos" role="table" aria-label="梅花六爻体用标记">
        <div className="traditional-meihua-yaos-head" role="row">
          <span>爻位</span>
          <strong>主卦爻象</strong>
          <span>体用</span>
        </div>
        {rows.map((yao) => (
          <div
            key={yao.position}
            className={yao.position === data.movingYao.position ? 'is-moving' : ''}
            role="row"
          >
            <span>{yao.position}爻</span>
            <YaoLine yaoType={yao.yaoType} changing={yao.isChanging} />
            <b>{yao.tiYong}</b>
          </div>
        ))}
      </div>
      {meihuaJudgement ? (
        <ClassicalAnnotationCard
          title={`${meihuaJudgement.relationType} · 定局断语（${meihuaJudgement.auspice}）`}
          source="梅花易数·体用总断"
          verse={meihuaJudgement.classicSummary}
          modernAdvice={`【决策要领】${meihuaJudgement.actionAdvice}\n【求财】${meihuaJudgement.matterCategories.seekingWealth} | 【求事】${meihuaJudgement.matterCategories.wishing} | 【婚姻】${meihuaJudgement.matterCategories.marriage}`}
        />
      ) : null}
      {tiTrigramClassic ? (
        <ClassicalAnnotationCard
          title={`体卦 ${tiTrigramClassic.name} · 八卦万物类象`}
          source={tiTrigramClassic.sourceBook}
          verse={tiTrigramClassic.verse}
          modernAdvice={`【卦象性情】${tiTrigramClassic.nature}\n【家庭人物】${tiTrigramClassic.family} | 【人体部位】${tiTrigramClassic.bodyPart}\n【主事对应】${tiTrigramClassic.matters}`}
        />
      ) : null}
      {mainHexagramClassic ? (
        <ClassicalAnnotationCard
          title={`${mainHexagramClassic.name} · 周易经文`}
          source="周易全本"
          verse={`【卦辞】${mainHexagramClassic.guaCi}\n${mainHexagramClassic.daXiang}`}
          modernAdvice={mainHexagramClassic.tuanCi}
        />
      ) : null}
      {movingYaoText ? (
        <ClassicalAnnotationCard
          title={movingYaoText.title}
          source="周易全本"
          verse={movingYaoText.verse}
          modernAdvice={movingYaoText.advice}
        />
      ) : null}
      {changedHexagramClassic && changedHexagramClassic.id !== mainHexagramClassic?.id ? (
        <ClassicalAnnotationCard
          title={`之卦 ${changedHexagramClassic.name} · 周易经文`}
          source="周易全本"
          verse={`【卦辞】${changedHexagramClassic.guaCi}\n${changedHexagramClassic.daXiang}`}
          modernAdvice={changedHexagramClassic.tuanCi}
        />
      ) : null}
    </TraditionalBoardShell>
  );
}

function XiaoliurenTraditionalBoard({
  data,
  session,
}: {
  data: XiaoliurenData;
  session?: DivinationSession;
}) {
  const sequence = [
    { label: '月宫', palace: data.sequence.month },
    { label: '日宫', palace: data.sequence.day },
    { label: '时宫', palace: data.sequence.hour },
  ];

  const hourPalaceClassic = useMemo(() => {
    return getXiaoliurenClassic(data.sequence.hour.name);
  }, [data.sequence.hour.name]);

  return (
    <TraditionalBoardShell
      title="小六壬三宫课"
      subtitle={`农历${data.isLeapMonth ? '闰' : ''}${data.lunarMonth}月${data.lunarDay}日 · ${data.hourLabel}`}
      className="traditional-xiaoliuren-board"
    >
      <TraditionalMeta
        items={[
          ['占事', session?.question],
          [
            '日期',
            session?.createdAt
              ? new Date(session.createdAt).toLocaleString('zh-CN')
              : `农历${data.isLeapMonth ? '闰' : ''}${data.lunarMonth}月${data.lunarDay}日`,
          ],
          ['干支', `${data.ganzhi.month}月 ${data.ganzhi.day}日 ${data.ganzhi.hour}时`],
          ['起课法', data.methodLabel || '小六壬时宫速断'],
        ]}
      />
      <TraditionalFacts
        items={[
          ['月宫', `${data.sequence.month.name}（${data.sequence.month.element}）`],
          ['日宫', `${data.sequence.day.name}（${data.sequence.day.element}）`],
          [
            '时宫（主断）',
            `${data.sequence.hour.name}（${data.sequence.hour.auspicious} · ${data.sequence.hour.element}）`,
          ],
        ]}
      />
      <div className="traditional-xiaoliuren-sequence" aria-label="小六壬月日时三宫">
        {sequence.map(({ label, palace }, index) => (
          <article className={index === sequence.length - 1 ? 'is-result' : ''} key={label}>
            <span>{label}</span>
            <strong>{palace.name}</strong>
            <small>{palace.verse}</small>
          </article>
        ))}
      </div>
      <div className="traditional-xiaoliuren-reference" aria-label="小六壬六神定位">
        <span>六神定位</span>
        <div>
          {data.palaceOrder.map((palace) => (
            <small key={palace.name}>
              <i>{palace.index + 1}</i>
              {palace.name}
            </small>
          ))}
        </div>
      </div>

      {hourPalaceClassic ? (
        <ClassicalAnnotationCard
          title={`${hourPalaceClassic.name}（${hourPalaceClassic.auspice} · 属${hourPalaceClassic.wuxing}）· 诗诀决断`}
          source={hourPalaceClassic.sourceBook}
          verse={hourPalaceClassic.poem}
          modernAdvice={`【决断指导】${hourPalaceClassic.modernAdvice}\n【方位类象】${hourPalaceClassic.direction} | 【对应身部】${hourPalaceClassic.bodyPart}`}
        />
      ) : null}
    </TraditionalBoardShell>
  );
}

function JinkoujueTraditionalBoard({
  data,
  session,
}: {
  data: JinkoujueData;
  session?: DivinationSession;
}) {
  const positions = [
    ['人元', data.positions.renYuan],
    ['贵神', data.positions.guiShen],
    ['将神', data.positions.jiangShen],
    ['地分', data.positions.diFen],
  ] as const;
  const positionRelations = [
    `贵→将 ${data.relations.guiToJiang}`,
    `贵→人 ${data.relations.guiToRen}`,
    `将→地 ${data.relations.jiangToDi}`,
    `人→地 ${data.relations.renToDi}`,
  ].join('；');
  const movementText = data.movements
    .map((item) => `${item.category}·${item.name}（${item.from}${item.relation}${item.to}）`)
    .join('；');

  const movementClassics = useMemo(() => {
    const list: Array<{ name: string; source: string; verse: string; advice: string }> = [];
    data.movements?.forEach((m) => {
      const c =
        getJinkoujueMovementClassic(m.category) ||
        getJinkoujueMovementClassic(m.name) ||
        getJinkoujueMovementClassic(m.category.replace(/（.*）/u, ''));
      if (c && !list.some((item) => item.name === c.name)) {
        list.push({
          name: c.name,
          source: c.sourceBook,
          verse: c.verse,
          advice: c.modernAdvice,
        });
      }
    });
    return list;
  }, [data.movements]);

  return (
    <TraditionalBoardShell
      title="金口诀四位盘"
      subtitle={`${data.ganzhi.day}日${data.ganzhi.hour}时 · 月将${data.monthLeader}加${data.divinationBranch}`}
      className="traditional-jinkoujue-board"
    >
      <TraditionalMeta
        items={[
          ['占事', session?.question],
          [
            '日期',
            session?.createdAt ? new Date(session.createdAt).toLocaleString('zh-CN') : undefined,
          ],
          [
            '干支',
            `${data.ganzhi.year}年 ${data.ganzhi.month}月 ${data.ganzhi.day}日 ${data.ganzhi.hour}时`,
          ],
          ['旬空', data.xunKong?.join('、') || '无'],
          ['月将', `${data.monthLeader}加${data.divinationBranch}`],
          ['贵人', `${data.dayNight}贵人 · ${data.noblemanBranch}`],
        ]}
      />
      <TraditionalFacts
        items={[
          [
            '阴阳取用',
            `${data.yinYangUse.pattern}（用${data.yinYangUse.usePosition}${data.yinYangUse.isVoid ? '·空' : ''}）`,
          ],
          ['四位生克', positionRelations],
          ['动变格局', movementText || '未见发动'],
        ]}
      />
      <div className="traditional-jinkoujue-table" role="table" aria-label="金口诀四位盘">
        {positions.map(([label, item]) => (
          <div className="traditional-jinkoujue-row" key={label}>
            <span className="traditional-jinkoujue-role">{label}</span>
            <strong>
              {item.stem || ''}
              {item.branch}
            </strong>
            <span>{item.god ? `乘${item.god}` : item.role}</span>
            <span>
              {item.element} · {item.yinYang}
            </span>
            <small>
              {item.seasonState}
              {item.isVoid ? ' · 旬空' : ''}
            </small>
          </div>
        ))}
      </div>
      <div className="traditional-note-row">
        <b>发用</b>
        <span>{data.mainLine}</span>
      </div>

      {movementClassics.map((mc) => (
        <ClassicalAnnotationCard
          key={mc.name}
          title={`${mc.name} · 先贤动变歌诀`}
          source={mc.source}
          verse={mc.verse}
          modernAdvice={mc.advice}
        />
      ))}
    </TraditionalBoardShell>
  );
}

const QIMEN_PALACE_META: Record<
  number,
  {
    gong: number;
    name: string;
    xianTian: string;
    houTian: string;
    luoShuNumber: number;
    branches: string[];
    direction: string;
    element: string;
    guaMeaning: string;
  }
> = {
  1: {
    gong: 1,
    name: '坎一宫',
    xianTian: '坤卦',
    houTian: '坎卦',
    luoShuNumber: 1,
    branches: ['子'],
    direction: '正北',
    element: '水',
    guaMeaning: '坎为水，主险陷、智慧、隐匿、流动，万物归藏之所。',
  },
  2: {
    gong: 2,
    name: '坤二宫',
    xianTian: '巽卦',
    houTian: '坤卦',
    luoShuNumber: 2,
    branches: ['未', '申'],
    direction: '西南',
    element: '土',
    guaMeaning: '坤为地，主厚德载物、静守包容、母道柔顺、蓄势待发。',
  },
  3: {
    gong: 3,
    name: '震三宫',
    xianTian: '离卦',
    houTian: '震卦',
    luoShuNumber: 3,
    branches: ['卯'],
    direction: '正东',
    element: '木',
    guaMeaning: '震为雷，主萌动、奋发、生机、声名扬举、动中求胜。',
  },
  4: {
    gong: 4,
    name: '巽四宫',
    xianTian: '兑卦',
    houTian: '巽卦',
    luoShuNumber: 4,
    branches: ['辰', '巳'],
    direction: '东南',
    element: '木',
    guaMeaning: '巽为风，主进退、利市三倍、文采风华、顺势而为。',
  },
  5: {
    gong: 5,
    name: '中五宫',
    xianTian: '中极',
    houTian: '中宫',
    luoShuNumber: 5,
    branches: [],
    direction: '中央',
    element: '土',
    guaMeaning: '中五太极之枢纽，居中不偏，统领八方，寄于坤艮。',
  },
  6: {
    gong: 6,
    name: '乾六宫',
    xianTian: '艮卦',
    houTian: '乾卦',
    luoShuNumber: 6,
    branches: ['戌', '亥'],
    direction: '西北',
    element: '金',
    guaMeaning: '乾为天，主刚健笃实、领袖决断、开创进取、尊崇高贵。',
  },
  7: {
    gong: 7,
    name: '兑七宫',
    xianTian: '坎卦',
    houTian: '兑卦',
    luoShuNumber: 7,
    branches: ['酉'],
    direction: '正西',
    element: '金',
    guaMeaning: '兑为泽，主喜悦交流、言辞交涉、锋芒展露、收获结算。',
  },
  8: {
    gong: 8,
    name: '艮八宫',
    xianTian: '震卦',
    houTian: '艮卦',
    luoShuNumber: 8,
    branches: ['丑', '寅'],
    direction: '东北',
    element: '土',
    guaMeaning: '艮为山，主止步沉潜、守正待时、根基稳固、成终成始。',
  },
  9: {
    gong: 9,
    name: '离九宫',
    xianTian: '乾卦',
    houTian: '离卦',
    luoShuNumber: 9,
    branches: ['午'],
    direction: '正南',
    element: '火',
    guaMeaning: '离为火，主文明炳赫、名望显达、热情光明、洞察秋毫。',
  },
};

const QIMEN_DOOR_ELEMENTS: Record<string, string> = {
  休门: '水',
  生门: '土',
  伤门: '木',
  杜门: '木',
  景门: '火',
  死门: '土',
  惊门: '金',
  开门: '金',
};

const QIMEN_PALACE_ELEMENTS: Record<number, string> = {
  1: '水',
  2: '土',
  3: '木',
  4: '木',
  5: '土',
  6: '金',
  7: '金',
  8: '土',
  9: '火',
};

function checkQimenKe(a: string, b: string): boolean {
  return (
    (a === '木' && b === '土') ||
    (a === '土' && b === '水') ||
    (a === '水' && b === '火') ||
    (a === '火' && b === '金') ||
    (a === '金' && b === '木')
  );
}

const QIMEN_STEM_JIXING_PALACES: Record<string, number[]> = {
  戊: [3],
  己: [2],
  庚: [8],
  辛: [9],
  壬: [4],
  癸: [4],
};

const QIMEN_STEM_RUMU_PALACES: Record<string, number[]> = {
  乙: [2],
  丙: [6],
  丁: [8],
  戊: [6],
  己: [4],
  庚: [2],
  辛: [8],
  壬: [4],
  癸: [4],
};

const QIMEN_PALACE_BRANCHES: Record<number, string> = {
  1: '子',
  2: '未',
  3: '卯',
  4: '辰',
  6: '戌',
  7: '酉',
  8: '丑',
  9: '午',
};

const CHANG_SHENG_ORDER_LIST = [
  '长生',
  '沐浴',
  '冠带',
  '临官',
  '帝旺',
  '衰',
  '病',
  '死',
  '墓',
  '绝',
  '胎',
  '养',
];

const STEM_CHANG_SHENG_START_CFG: Record<string, { branch: string; isYang: boolean }> = {
  甲: { branch: '亥', isYang: true },
  乙: { branch: '午', isYang: false },
  丙: { branch: '寅', isYang: true },
  丁: { branch: '酉', isYang: false },
  戊: { branch: '寅', isYang: true },
  己: { branch: '酉', isYang: false },
  庚: { branch: '巳', isYang: true },
  辛: { branch: '子', isYang: false },
  壬: { branch: '申', isYang: true },
  癸: { branch: '卯', isYang: false },
};

const DIZHI_CYCLE = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

function getStemChangShengStage(stem: string, gong: number): string {
  const branch = QIMEN_PALACE_BRANCHES[gong];
  const cfg = STEM_CHANG_SHENG_START_CFG[stem];
  if (!branch || !cfg) return '';
  const startIdx = DIZHI_CYCLE.indexOf(cfg.branch);
  const targetIdx = DIZHI_CYCLE.indexOf(branch);
  if (startIdx === -1 || targetIdx === -1) return '';
  const offset = cfg.isYang ? (targetIdx - startIdx + 12) % 12 : (startIdx - targetIdx + 12) % 12;
  return CHANG_SHENG_ORDER_LIST[offset] || '';
}

function calculateQimenAnGanMap(
  jiuGongGe: QimenJiuGongGe[],
  zhiShiDoor: string,
  hourGan: string,
  isYangDun: boolean,
): Map<number, string> {
  const map = new Map<number, string>();
  const zhiShiPalace = jiuGongGe.find((p) => p.renPan.door === zhiShiDoor);
  if (!zhiShiPalace) return map;

  const stemOrder = ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙'];
  const actualStem = hourGan === '甲' ? '戊' : hourGan;
  const startStemIndex = stemOrder.indexOf(actualStem);
  if (startStemIndex === -1) return map;

  const luoShuOrder = isYangDun ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [9, 8, 7, 6, 5, 4, 3, 2, 1];
  const startGongPos = luoShuOrder.indexOf(zhiShiPalace.gong);
  if (startGongPos === -1) return map;

  for (let i = 0; i < 9; i++) {
    const gong = luoShuOrder[(startGongPos + i) % 9];
    const stem = stemOrder[(startStemIndex + i) % 9];
    map.set(gong, stem);
  }
  return map;
}

type QimenYongShenId = 'wealth' | 'career' | 'marriage' | 'health' | 'travel';

interface QimenYongShenInfo {
  id: QimenYongShenId;
  label: string;
  icon: string;
  desc: string;
}

const QIMEN_YONG_SHEN_LIST: QimenYongShenInfo[] = [
  { id: 'wealth', label: '求财', desc: '生门利息利润、戊为资本、六合为交易契约' },
  { id: 'career', label: '事业', desc: '开门官职工作、值符大局贵人、景门文书政令' },
  { id: 'marriage', label: '婚姻', desc: '乙奇女方、庚仪男方、六合婚姻媒妁、休门家庭' },
  { id: 'health', label: '疾病', desc: '天芮病灶、死门危厄、乙奇中医草药、天心良医' },
  { id: 'travel', label: '出行', desc: '驿马动向、九天顺畅、开休生吉门吉向' },
];

function getQimenYongShenMatches(
  yongShenId: QimenYongShenId | null,
  palace: QimenJiuGongGe,
  data: QimenData,
): string[] {
  if (!yongShenId) return [];
  const tags: string[] = [];
  const gong = palace.gong;
  const isHorse = data.horseStar?.palace === gong;

  if (yongShenId === 'wealth') {
    if (palace.renPan.door === '生门') tags.push('生门·利润');
    if (palace.tianPan.stem === '戊' || palace.tianPan.companionStem === '戊')
      tags.push('天盘戊·资本');
    if (palace.shenPan.god === '六合') tags.push('六合·交易');
  } else if (yongShenId === 'career') {
    if (palace.renPan.door === '开门') tags.push('开门·职守/事业');
    if (palace.shenPan.god === '值符') tags.push('值符·领导/大局');
    if (palace.renPan.door === '景门') tags.push('景门·文书/面试');
  } else if (yongShenId === 'marriage') {
    if (palace.tianPan.stem === '乙' || palace.tianPan.companionStem === '乙')
      tags.push('乙奇·女方');
    if (palace.tianPan.stem === '庚' || palace.tianPan.companionStem === '庚')
      tags.push('庚仪·男方');
    if (palace.shenPan.god === '六合') tags.push('六合·媒妁/结合');
    if (palace.renPan.door === '休门') tags.push('休门·家庭');
  } else if (yongShenId === 'health') {
    if (palace.tianPan.star === '天芮' || palace.tianPan.companionStar === '天芮')
      tags.push('天芮·病灶');
    if (palace.renPan.door === '死门') tags.push('死门·危急');
    if (palace.tianPan.stem === '乙' || palace.tianPan.companionStem === '乙')
      tags.push('乙奇·中药/医生');
    if (palace.tianPan.star === '天心' || palace.tianPan.companionStar === '天心')
      tags.push('天心·西医/良方');
  } else if (yongShenId === 'travel') {
    if (isHorse) tags.push('驿马·动向');
    if (palace.shenPan.god === '九天') tags.push('九天·远行');
    if (['开门', '休门', '生门'].includes(palace.renPan.door))
      tags.push(`${palace.renPan.door}·吉方`);
  }
  return tags;
}

function gongName(gong: number) {
  return QIMEN_PALACE_META[gong]?.name || `${gong}宫`;
}

function getQimenYongShenSummary(
  yongShenId: QimenYongShenId,
  data: QimenData,
  _palaceMap: Map<number, QimenJiuGongGe>,
) {
  const dayStem = data.ganzhi?.day?.slice(0, 1) || '戊';
  const dayPalace = data.jiuGongGe.find(
    (p) => p.tianPan.stem === dayStem || p.tianPan.companionStem === dayStem,
  );

  if (yongShenId === 'wealth') {
    const shengDoorPalace = data.jiuGongGe.find((p) => p.renPan.door === '生门');
    const wuPalace = data.jiuGongGe.find(
      (p) => p.tianPan.stem === '戊' || p.tianPan.companionStem === '戊',
    );
    const shengGong = shengDoorPalace ? shengDoorPalace.gong : 8;
    const wuGong = wuPalace ? wuPalace.gong : 6;

    const shengEl = QIMEN_PALACE_ELEMENTS[shengGong] || '';
    const dayEl = dayPalace ? QIMEN_PALACE_ELEMENTS[dayPalace.gong] || '' : '';
    const isWuJiXing = wuGong === 3;
    const isWuRuMu = wuGong === 6;

    let relationText = '生门与日干落宫相生相比，谋财顺畅。';
    if (shengEl && dayEl) {
      if (checkQimenKe(shengEl, dayEl)) relationText = '生门落宫克日干落宫，求财阻力大，谨防破耗。';
      else if (checkQimenKe(dayEl, shengEl))
        relationText = '日干落宫克生门落宫，求财虽得但劳心费力。';
      else relationText = '生门生助或比和日干落宫，财星有气，进财有源。';
    }

    return {
      title: '求财专项合参',
      lead: relationText,
      points: [
        {
          name: '生门（利润/利息）',
          gong: shengDoorPalace ? `${shengDoorPalace.name}（${shengDoorPalace.gong}宫）` : '中宫',
          status: shengDoorPalace
            ? `${shengDoorPalace.tianPan.stem}+${shengDoorPalace.diPan.stem} · 乘${shengDoorPalace.shenPan.god}`
            : '—',
          advice: '生门临吉星吉神主商贾兴隆；逢凶星凶格宜守旧防套。',
        },
        {
          name: '戊（资本/本金）',
          gong: wuPalace ? `${wuPalace.name}（${wuPalace.gong}宫）` : '中宫',
          status: isWuJiXing
            ? '六仪击刑（震3宫）'
            : isWuRuMu
              ? '三奇六仪入墓（乾6宫）'
              : '资本稳固',
          advice: isWuJiXing
            ? '天盘戊击刑，防资本亏折损耗、受合伙人拖累。'
            : isWuRuMu
              ? '天盘戊入墓，资金流动性受阻，不宜重仓押注。'
              : '资本运行平稳，适宜按计划运作。',
        },
      ],
    };
  }

  if (yongShenId === 'marriage') {
    const yiPalace = data.jiuGongGe.find(
      (p) => p.tianPan.stem === '乙' || p.tianPan.companionStem === '乙',
    );
    const gengPalace = data.jiuGongGe.find(
      (p) => p.tianPan.stem === '庚' || p.tianPan.companionStem === '庚',
    );
    const liuHePalace = data.jiuGongGe.find((p) => p.shenPan.god === '六合');

    const yiEl = yiPalace ? QIMEN_PALACE_ELEMENTS[yiPalace.gong] || '' : '';
    const gengEl = gengPalace ? QIMEN_PALACE_ELEMENTS[gengPalace.gong] || '' : '';
    const isLiuHeVoid = liuHePalace
      ? data.voidPalaces?.some((v) => v.palace === liuHePalace.gong)
      : false;

    let matchText = '乙（女）与庚（男）落宫相生相比，感情和谐。';
    if (yiEl && gengEl) {
      if (checkQimenKe(yiEl, gengEl)) matchText = '女方落宫克男方落宫，女方占主动或偶有言语压制。';
      else if (checkQimenKe(gengEl, yiEl))
        matchText = '男方落宫克女方落宫，男方性情强势，宜多沟通包容。';
      else matchText = '双方落宫五行相生，情投意合，琴瑟和鸣。';
    }

    return {
      title: '婚恋情感合参',
      lead: `${matchText}${isLiuHeVoid ? '（注：六合落空亡，主有虚妄、拖延或异地阻隔之象）' : ''}`,
      points: [
        {
          name: '乙奇（女方/妻子）',
          gong: yiPalace ? `${yiPalace.name}（${yiPalace.gong}宫）` : '中宫',
          status: yiPalace ? `${yiPalace.renPan.door} · 乘${yiPalace.shenPan.god}` : '—',
          advice: '看女方落宫星门状态，临吉门吉神温婉持重，临凶门防情绪波动。',
        },
        {
          name: '庚仪（男方/丈夫）',
          gong: gengPalace ? `${gongName(gengPalace.gong)}（${gengPalace.gong}宫）` : '中宫',
          status: gengPalace ? `${gengPalace.renPan.door} · 乘${gengPalace.shenPan.god}` : '—',
          advice: '男方落宫刚健，临值符/开门主有担当；逢击刑需防脾气急躁。',
        },
        {
          name: '六合（婚姻媒妁/结合）',
          gong: liuHePalace ? `${liuHePalace.name}（${liuHePalace.gong}宫）` : '中宫',
          status: isLiuHeVoid ? '落入旬空' : '吉相平稳',
          advice: isLiuHeVoid
            ? '六合逢空，情感沟通宜开诚布公，勿生猜忌。'
            : '六合稳健，利于缔结良缘或感情升温。',
        },
      ],
    };
  }

  if (yongShenId === 'career') {
    const kaiPalace = data.jiuGongGe.find((p) => p.renPan.door === '开门');
    const zhiFuPalace = data.jiuGongGe.find((p) => p.shenPan.god === '值符');

    const kaiGong = kaiPalace ? kaiPalace.gong : 6;
    const kaiEl = QIMEN_PALACE_ELEMENTS[kaiGong] || '';
    const dayEl = dayPalace ? QIMEN_PALACE_ELEMENTS[dayPalace.gong] || '' : '';
    const isKaiMenPo = kaiPalace
      ? Boolean(checkQimenKe(QIMEN_DOOR_ELEMENTS['开门'] || '', kaiEl))
      : false;

    let leadText = '开门职守得地，得值符大局护持，利于建功立业。';
    if (isKaiMenPo)
      leadText = '开门落宫门迫（落震三/巽四宫），事业环境或职位面临摩擦调整，宜稳扎稳打。';
    else if (kaiEl && dayEl && checkQimenKe(kaiEl, dayEl))
      leadText = '开门落宫克日干落宫，工作压力较大或要求严苛，宜以柔克刚。';

    return {
      title: '事业官运合参',
      lead: leadText,
      points: [
        {
          name: '开门（工作/官位/单位）',
          gong: kaiPalace ? `${kaiPalace.name}（${kaiPalace.gong}宫）` : '乾6宫',
          status: kaiPalace
            ? `${kaiPalace.tianPan.stem}+${kaiPalace.diPan.stem} · ${isKaiMenPo ? '门迫' : '得位'}`
            : '—',
          advice: '开门逢吉格利晋升拓展；逢凶格门迫宜稳守本职，防言多必失。',
        },
        {
          name: '值符（领导/贵人/核心）',
          gong: zhiFuPalace ? `${zhiFuPalace.name}（${zhiFuPalace.gong}宫）` : '—',
          status: zhiFuPalace ? `${zhiFuPalace.tianPan.star} · ${zhiFuPalace.renPan.door}` : '—',
          advice: '值符加临之方为贵人方，求见领导或争取支持宜往此方。',
        },
      ],
    };
  }

  if (yongShenId === 'health') {
    const ruiPalace = data.jiuGongGe.find(
      (p) => p.tianPan.star === '天芮' || p.tianPan.companionStar === '天芮',
    );
    const yiPalace = data.jiuGongGe.find(
      (p) => p.tianPan.stem === '乙' || p.tianPan.companionStem === '乙',
    );
    const xinPalace = data.jiuGongGe.find(
      (p) => p.tianPan.star === '天心' || p.tianPan.companionStar === '天心',
    );

    const ruiGong = ruiPalace ? ruiPalace.gong : 2;
    const ruiEl = QIMEN_PALACE_ELEMENTS[ruiGong] || '';
    const yiEl = yiPalace ? QIMEN_PALACE_ELEMENTS[yiPalace.gong] || '' : '';
    const xinEl = xinPalace ? QIMEN_PALACE_ELEMENTS[xinPalace.gong] || '' : '';

    const isYiKeRui = yiEl && ruiEl && checkQimenKe(yiEl, ruiEl);
    const isXinKeRui = xinEl && ruiEl && checkQimenKe(xinEl, ruiEl);

    let leadText: string;
    if (isYiKeRui || isXinKeRui)
      leadText = '医药（乙奇/天心）落宫克制病星天芮落宫，药到病除，遵医嘱调养大吉。';
    else leadText = '病星天芮旺相，需重视身心调理，及早就医检查，防病灶反复。';

    return {
      title: '疾病健康合参',
      lead: leadText,
      points: [
        {
          name: '天芮星（病灶/病情）',
          gong: ruiPalace ? `${ruiPalace.name}（${ruiPalace.gong}宫）` : '坤2宫',
          status: ruiPalace ? `乘${ruiPalace.shenPan.god} · ${ruiPalace.renPan.door}` : '—',
          advice: '芮星落宫对应身体脏腑部位（离心脑、坎泌尿、震巽肝胆、乾兑肺骨、艮坤脾胃）。',
        },
        {
          name: '乙奇与天心（中医/名医）',
          gong: yiPalace ? `乙在${yiPalace.name}，心在${xinPalace ? xinPalace.name : '—'}` : '—',
          status: isYiKeRui || isXinKeRui ? '克制病星（药效显著）' : '常态调和',
          advice: '往医药吉方寻名医求方，积极调养身心。',
        },
      ],
    };
  }

  // travel
  const horseGong = data.horseStar?.palace;
  const jiuTianPalace = data.jiuGongGe.find((p) => p.shenPan.god === '九天');

  return {
    title: '出行迁移合参',
    lead: '动向看驿马与九天，吉向首选三吉门（开、休、生）。',
    points: [
      {
        name: '驿马（动身/交通工具）',
        gong: horseGong
          ? `落${horseGong}宫（${QIMEN_PALACE_META[horseGong]?.name || ''}）`
          : '无马星',
        status: data.horseStar ? `${data.horseStar.branch}·${data.horseStar.name}` : '平稳',
        advice: '马星所临主动身迅速，利于启程出差或迁徙。',
      },
      {
        name: '九天（高远/通达）',
        gong: jiuTianPalace ? `${jiuTianPalace.name}（${jiuTianPalace.gong}宫）` : '—',
        status: jiuTianPalace ? `${jiuTianPalace.renPan.door}` : '—',
        advice: '《奇门秘笈》：九天之上好扬兵。九天之方利于远行腾达、空中交通。',
      },
    ],
  };
}

function QimenTraditionalBoard({
  data,
  session,
}: {
  data: QimenData;
  session?: DivinationSession;
}) {
  const [selectedGong, setSelectedGong] = useState<number | null>(null);
  const [showChangSheng, setShowChangSheng] = useState<boolean>(false);
  const [showAnGan, setShowAnGan] = useState<boolean>(true);
  const [activeYongShen, setActiveYongShen] = useState<QimenYongShenId | null>(null);

  const palaceMap = useMemo(
    () => new Map(data.jiuGongGe.map((item) => [item.gong, item])),
    [data.jiuGongGe],
  );

  const hourStem = data.ganzhi?.hour?.slice(0, 1) || '戊';
  const anGanMap = useMemo(
    () => calculateQimenAnGanMap(data.jiuGongGe, data.zhiShi, hourStem, data.isYangDun),
    [data.jiuGongGe, data.zhiShi, hourStem, data.isYangDun],
  );

  const stemRelationMap = new Map<number, string[]>();
  data.stemRelations?.forEach((item) => {
    const label = item.pattern?.split(/[：:]/u)[0] || item.relation;
    stemRelationMap.set(item.gong, [...(stemRelationMap.get(item.gong) ?? []), label]);
  });
  const scopeLabel = { hour: '时家', day: '日家', month: '月家', year: '年家' }[
    data.scope ?? 'hour'
  ];
  const patternCounts = new Map<string, number>();
  data.patternTags?.forEach((item) => {
    const label = item.split(/[（(]/u)[0]?.trim();
    if (label) patternCounts.set(label, (patternCounts.get(label) ?? 0) + 1);
  });
  const patternNames = Array.from(patternCounts.entries())
    .map(([label, count]) => `${label}${count > 1 ? `×${count}` : ''}`)
    .join(' · ');

  const zhiFuStarClassic = useMemo(() => {
    return data.zhiFu ? getQimenStarClassic(data.zhiFu) : undefined;
  }, [data.zhiFu]);

  const zhiShiDoorClassic = useMemo(() => {
    return data.zhiShi ? getQimenDoorClassic(data.zhiShi) : undefined;
  }, [data.zhiShi]);

  const yongShenSummary = useMemo(() => {
    if (!activeYongShen) return null;
    return getQimenYongShenSummary(activeYongShen, data, palaceMap);
  }, [activeYongShen, data, palaceMap]);

  // Selected palace details for interactive deep inspection
  const inspectorPalace = selectedGong ? palaceMap.get(selectedGong) : null;
  const inspectorMeta = selectedGong ? QIMEN_PALACE_META[selectedGong] : null;

  const inspectorStemPatterns = useMemo(() => {
    if (!inspectorPalace) return [];
    const list: Array<{
      key: string;
      pattern: ReturnType<typeof getQimenStemPattern>;
      isCompanion?: boolean;
    }> = [];

    const primary = getQimenStemPattern(inspectorPalace.tianPan.stem, inspectorPalace.diPan.stem);
    if (primary) {
      list.push({
        key: `${inspectorPalace.tianPan.stem}+${inspectorPalace.diPan.stem}`,
        pattern: primary,
      });
    }

    if (inspectorPalace.tianPan.companionStem) {
      const companion = getQimenStemPattern(
        inspectorPalace.tianPan.companionStem,
        inspectorPalace.diPan.stem,
      );
      if (companion) {
        list.push({
          key: `${inspectorPalace.tianPan.companionStem}+${inspectorPalace.diPan.stem}`,
          pattern: companion,
          isCompanion: true,
        });
      }
    }

    return list;
  }, [inspectorPalace]);

  const inspectorDoorClassic = useMemo(() => {
    if (!inspectorPalace?.renPan.door) return null;
    return getQimenDoorClassic(inspectorPalace.renPan.door);
  }, [inspectorPalace]);

  const inspectorStarClassic = useMemo(() => {
    if (!inspectorPalace?.tianPan.star) return null;
    return getQimenStarClassic(inspectorPalace.tianPan.star);
  }, [inspectorPalace]);

  const inspectorDeityClassic = useMemo(() => {
    if (!inspectorPalace?.shenPan.god) return null;
    return getQimenDeityClassic(inspectorPalace.shenPan.god);
  }, [inspectorPalace]);

  return (
    <TraditionalBoardShell
      title={`${scopeLabel}奇门九宫盘`}
      subtitle={`${data.isYangDun ? '阳遁' : '阴遁'}${data.juShu}局 · ${data.method === 'feipan' ? '飞盘' : '转盘'}${data.juMethod === 'zhirun' ? ' · 置闰' : ' · 拆补'}`}
      className="traditional-qimen-board"
    >
      <TraditionalMeta
        items={[
          ['占事', session?.question],
          [
            '日期',
            session?.createdAt ? new Date(session.createdAt).toLocaleString('zh-CN') : undefined,
          ],
          [
            '干支',
            `${data.ganzhi.year}年 ${data.ganzhi.month}月 ${data.ganzhi.day}日 ${data.ganzhi.hour}时`,
          ],
          ['旬空', data.voidBranches?.join('、') || '无'],
          ['值符', data.zhiFu],
          ['值使', data.zhiShi],
          ['节气', `${data.timeInfo.solarTerm} · ${data.timeInfo.epoch}`],
          ['马星', data.horseStar ? `${data.horseStar.branch}·${data.horseStar.name}` : undefined],
        ]}
      />
      <TraditionalFacts
        items={[
          [
            '定局',
            `${scopeLabel} · ${data.isYangDun ? '阳遁' : '阴遁'}${data.juShu}局（${data.method === 'feipan' ? '飞盘' : '转盘'}·${data.juMethod === 'zhirun' ? '置闰' : '拆补'}）`,
          ],
          ['特殊时格', specialConditions || '常局'],
          ['盘局特征', patternNames || '平局'],
        ]}
      />

      {/* 事类用神快速定位栏 */}
      <div className="traditional-qimen-yongshen-bar">
        <span className="yongshen-bar-label">事类用神快速定位：</span>
        <div className="yongshen-chips">
          {QIMEN_YONG_SHEN_LIST.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`yongshen-chip ${activeYongShen === item.id ? 'is-active' : ''}`}
              onClick={() => setActiveYongShen(activeYongShen === item.id ? null : item.id)}
              title={item.desc}
            >
              <span>{item.icon}</span>
              <strong>{item.label}</strong>
            </button>
          ))}
        </div>
      </div>

      {/* 快捷视图切换与交互引导 */}
      <div className="traditional-qimen-toolbar">
        <div className="traditional-qimen-actions">
          <button
            type="button"
            className={`traditional-qimen-btn ${showChangSheng ? 'is-active' : ''}`}
            onClick={() => setShowChangSheng((prev) => !prev)}
          >
            长生状态
          </button>
          <button
            type="button"
            className={`traditional-qimen-btn ${showAnGan ? 'is-active' : ''}`}
            onClick={() => setShowAnGan((prev) => !prev)}
          >
            暗干排布
          </button>
        </div>
        <span className="traditional-qimen-tip">
          {selectedGong
            ? `已选中 ${QIMEN_PALACE_META[selectedGong]?.name}（点击其他宫切换）`
            : activeYongShen
              ? `已定位「${QIMEN_YONG_SHEN_LIST.find((y) => y.id === activeYongShen)?.label}」用神宫位`
              : '点击九宫格任意宫位查看深度合参'}
        </span>
      </div>

      <div className="traditional-qimen-grid" role="img" aria-label="奇门遁甲九宫盘">
        {QIMEN_LO_SHU_ORDER.map((gong) => {
          const palace = palaceMap.get(gong);
          if (!palace) return <div className="traditional-qimen-cell is-empty" key={gong} />;
          const isVoid = data.voidPalaces?.some((item) => item.palace === gong);
          const isHorse = data.horseStar?.palace === gong;
          const isZhiFu =
            palace.tianPan.star === data.zhiFu || palace.tianPan.companionStar === data.zhiFu;
          const isZhiShi = palace.renPan.door === data.zhiShi;
          const isSelected = selectedGong === gong;

          const yongShenMatches = getQimenYongShenMatches(activeYongShen, palace, data);
          const isYongShenFocus = yongShenMatches.length > 0;

          // 四害判断
          const doorEl = QIMEN_DOOR_ELEMENTS[palace.renPan.door] || '';
          const palaceEl = QIMEN_PALACE_ELEMENTS[gong] || '';
          const isMenPo = Boolean(doorEl && palaceEl && checkQimenKe(doorEl, palaceEl));

          const tianStem = palace.tianPan.stem;
          const isJiXing = Boolean(QIMEN_STEM_JIXING_PALACES[tianStem]?.includes(gong));
          const isRuMu = Boolean(QIMEN_STEM_RUMU_PALACES[tianStem]?.includes(gong));
          const isXingMu = isJiXing && isRuMu;

          const companionStem = palace.tianPan.companionStem;
          const companionIsJiXing = companionStem
            ? Boolean(QIMEN_STEM_JIXING_PALACES[companionStem]?.includes(gong))
            : false;
          const companionIsRuMu = companionStem
            ? Boolean(QIMEN_STEM_RUMU_PALACES[companionStem]?.includes(gong))
            : false;

          const anGan = anGanMap.get(gong);
          const changShengStage = getStemChangShengStage(tianStem, gong);

          const stemRelations = stemRelationMap.get(gong) ?? [];

          let stemColorClass = '';
          if (isXingMu) stemColorClass = 'is-xingmu';
          else if (isJiXing) stemColorClass = 'is-jixing';
          else if (isRuMu) stemColorClass = 'is-rumu';

          return (
            <div
              className={`traditional-qimen-cell${gong === 5 ? ' is-center' : ''}${isVoid ? ' is-void' : ''}${isHorse ? ' is-horse' : ''}${isSelected ? ' is-selected' : ''}${isYongShenFocus ? ' is-yongshen-focus' : ''}`}
              key={gong}
              onClick={() => setSelectedGong(selectedGong === gong ? null : gong)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setSelectedGong(selectedGong === gong ? null : gong);
                }
              }}
              aria-label={`${palace.name}，点击查看深度合参`}
            >
              {/* 宫位顶栏：宫名 + 八神（空亡/马星图标） */}
              <div className="traditional-qimen-cell-head">
                <span className="traditional-qimen-gong-name">{palace.name}</span>
                <span className="traditional-qimen-god-label">
                  {isVoid ? (
                    <b className="traditional-qimen-symbol-void" title="旬空">
                      ○
                    </b>
                  ) : null}
                  {palace.shenPan.god}
                  {isHorse ? (
                    <b className="traditional-qimen-symbol-horse" title="驿马">
                      马
                    </b>
                  ) : null}
                </span>
              </div>

              {/* 九星区：值符青绿高亮 */}
              <div className={`traditional-qimen-star ${isZhiFu ? 'is-zhifu' : ''}`}>
                {showAnGan && anGan ? (
                  <span className="traditional-qimen-angan-badge">{anGan}</span>
                ) : null}
                <span>
                  {palace.tianPan.star}
                  {palace.tianPan.companionStar ? `/${palace.tianPan.companionStar}` : ''}
                </span>
              </div>

              {/* 天盘干 / 地盘干：四害高亮体系 */}
              <div className="traditional-qimen-stems-row">
                <span className={`traditional-qimen-tian-stem ${stemColorClass}`}>
                  {palace.tianPan.stem}
                  {companionStem ? (
                    <em
                      className={
                        companionIsJiXing && companionIsRuMu
                          ? 'is-xingmu'
                          : companionIsJiXing
                            ? 'is-jixing'
                            : companionIsRuMu
                              ? 'is-rumu'
                              : ''
                      }
                    >
                      /{companionStem}
                    </em>
                  ) : null}
                </span>
                <span className="traditional-qimen-di-stem">{palace.diPan.stem}</span>
              </div>

              {/* 八门区：值使青绿，门迫朱红 */}
              <div
                className={`traditional-qimen-door ${isZhiShi ? 'is-zhishi' : ''} ${isMenPo ? 'is-menpo' : ''}`}
              >
                {palace.renPan.door}
              </div>

              {/* 十二长生或格局短标签 */}
              {isYongShenFocus ? (
                <div className="traditional-qimen-yongshen-tag" title={yongShenMatches.join(' · ')}>
                  {yongShenMatches[0]}
                </div>
              ) : showChangSheng && changShengStage ? (
                <div className="traditional-qimen-changsheng-tag">{changShengStage}</div>
              ) : stemRelations.length ? (
                <small className="traditional-qimen-relation" title={stemRelations.join('、')}>
                  {stemRelations[0]}
                </small>
              ) : null}

              {/* 宫位状态角标 */}
              <div className="traditional-qimen-harm-badges">
                {isMenPo ? <span className="harm-badge is-menpo">迫</span> : null}
                {isXingMu ? (
                  <span className="harm-badge is-xingmu">刑墓</span>
                ) : isJiXing ? (
                  <span className="harm-badge is-jixing">刑</span>
                ) : isRuMu ? (
                  <span className="harm-badge is-rumu">墓</span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* 专业颜色图例说明 */}
      <div className="traditional-qimen-legend">
        <span className="legend-item">
          <i className="dot is-zhifu-shi" /> 符使
        </span>
        <span className="legend-item">
          <i className="dot is-rumu" /> 入墓
        </span>
        <span className="legend-item">
          <i className="dot is-jixing" /> 击刑
        </span>
        <span className="legend-item">
          <i className="dot is-menpo" /> 门迫
        </span>
        <span className="legend-item">
          <i className="dot is-xingmu" /> 刑+墓
        </span>
        <span className="legend-item">
          <i className="dot is-void" /> 空亡
        </span>
        <span className="legend-item">
          <i className="dot is-horse" /> 驿马
        </span>
      </div>

      {/* 事类用神专项合参卡片 */}
      {yongShenSummary ? (
        <div className="traditional-qimen-yongshen-inspector">
          <div className="inspector-header">
            <div className="inspector-title">
              <strong>
                {QIMEN_YONG_SHEN_LIST.find((y) => y.id === activeYongShen)?.icon}{' '}
                {yongShenSummary.title}
              </strong>
              <small>（基于天盘六仪、八门、九星与八神落宫生克断诀）</small>
            </div>
            <button
              type="button"
              className="inspector-close-btn"
              onClick={() => setActiveYongShen(null)}
              aria-label="关闭用神合参"
            >
              ✕
            </button>
          </div>

          <div className="inspector-grid">
            <div className="yongshen-lead-box">
              <span className="yongshen-lead-tag">核心局象</span>
              <p className="yongshen-lead-text">{yongShenSummary.lead}</p>
            </div>

            <div className="yongshen-points-list">
              {yongShenSummary.points.map((pt) => (
                <div className="yongshen-point-card" key={pt.name}>
                  <div className="yongshen-point-head">
                    <span className="yongshen-point-name">{pt.name}</span>
                    <span className="yongshen-point-gong">{pt.gong}</span>
                    <span className="yongshen-point-status">{pt.status}</span>
                  </div>
                  <p className="yongshen-point-advice">{pt.advice}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* 宫位深度合参联动展开 */}
      {inspectorPalace && inspectorMeta ? (
        <div className="traditional-qimen-palace-inspector">
          <div className="inspector-header">
            <div className="inspector-title">
              <strong>{inspectorMeta.name} · 深度合参</strong>
              <small>
                （{inspectorMeta.direction} · {inspectorMeta.element} · 洛书
                {inspectorMeta.luoShuNumber}数）
              </small>
            </div>
            <button
              type="button"
              className="inspector-close-btn"
              onClick={() => setSelectedGong(null)}
              aria-label="关闭合参详情"
            >
              ✕
            </button>
          </div>

          <div className="inspector-grid">
            <div className="inspector-meta-row">
              <span className="inspector-chip">先天：{inspectorMeta.xianTian}</span>
              <span className="inspector-chip">后天：{inspectorMeta.houTian}</span>
              {inspectorMeta.branches.length ? (
                <span className="inspector-chip">地支：{inspectorMeta.branches.join('、')}</span>
              ) : null}
              {anGanMap.get(inspectorPalace.gong) ? (
                <span className="inspector-chip is-accent">
                  暗干：{anGanMap.get(inspectorPalace.gong)}
                </span>
              ) : null}
              {getStemChangShengStage(inspectorPalace.tianPan.stem, inspectorPalace.gong) ? (
                <span className="inspector-chip">
                  天盘干长生：
                  {getStemChangShengStage(inspectorPalace.tianPan.stem, inspectorPalace.gong)}
                </span>
              ) : null}
            </div>

            <p className="inspector-gua-meaning">
              <b>【卦意象解】</b>
              {inspectorMeta.guaMeaning}
            </p>

            {/* 十干克应赋文 */}
            {inspectorStemPatterns.map((item) => (
              <div className="inspector-pattern-box" key={item.key}>
                <div className="inspector-pattern-head">
                  <span className="pattern-name">
                    {item.key} {item.pattern.name}
                  </span>
                  <span className={`pattern-auspice auspice-${item.pattern.auspice}`}>
                    {item.pattern.auspice}
                  </span>
                  {item.isCompanion ? <small className="companion-tag">（天禽寄干）</small> : null}
                </div>
                <p className="pattern-verse">{item.pattern.classicVerse}</p>
                <p className="pattern-advice">{item.pattern.modernMeaning}</p>
              </div>
            ))}

            {/* 八门与九星合参 */}
            <div className="inspector-elements-details">
              {inspectorDoorClassic ? (
                <div className="inspector-element-item">
                  <strong>
                    【人盘 · {inspectorDoorClassic.door}（{inspectorDoorClassic.auspice}）】
                  </strong>
                  <p>{inspectorDoorClassic.verse}</p>
                  <small>{inspectorDoorClassic.modernAdvice}</small>
                </div>
              ) : null}

              {inspectorStarClassic ? (
                <div className="inspector-element-item">
                  <strong>
                    【天盘 · {inspectorStarClassic.star}（{inspectorStarClassic.auspice}）】
                  </strong>
                  <p>{inspectorStarClassic.verse}</p>
                  <small>
                    【象意】{inspectorStarClassic.nature}；【方略】
                    {inspectorStarClassic.modernAdvice}
                  </small>
                </div>
              ) : null}

              {inspectorDeityClassic ? (
                <div className="inspector-element-item">
                  <strong>
                    【神盘 · {inspectorDeityClassic.deity}（{inspectorDeityClassic.auspice}）】
                  </strong>
                  <p>{inspectorDeityClassic.verse}</p>
                  <small>{inspectorDeityClassic.modernAdvice}</small>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {zhiFuStarClassic ? (
        <ClassicalAnnotationCard
          title={`值符 ${zhiFuStarClassic.star} · 九星精解（${zhiFuStarClassic.auspice}）`}
          source={zhiFuStarClassic.sourceBook}
          verse={zhiFuStarClassic.verse}
          modernAdvice={`【性情象意】${zhiFuStarClassic.nature}\n【行动决策】${zhiFuStarClassic.modernAdvice}`}
        />
      ) : null}
      {zhiShiDoorClassic ? (
        <ClassicalAnnotationCard
          title={`值使 ${zhiShiDoorClassic.door} · 八门精解（${zhiShiDoorClassic.auspice}）`}
          source={zhiShiDoorClassic.sourceBook}
          verse={zhiShiDoorClassic.verse}
          modernAdvice={zhiShiDoorClassic.modernAdvice}
        />
      ) : null}
    </TraditionalBoardShell>
  );
}

function getTarotSpreadClass(spreadType: string) {
  return `is-${spreadType.replace(/[^a-z0-9-]/gi, '-')}`;
}

function TarotTraditionalBoard({
  data,
  session,
}: {
  data: TarotData;
  session?: DivinationSession;
}) {
  const { openTerm } = useMetaphysicsTermModal();
  const reversedCount = data.cards.filter((c) => c.reversed).length;
  const uprightCount = data.cards.length - reversedCount;
  const elements = data.cards.reduce<Record<string, number>>((acc, card) => {
    const el = card.element?.includes('火')
      ? '火元素'
      : card.element?.includes('水')
        ? '水元素'
        : card.element?.includes('风')
          ? '风元素'
          : card.element?.includes('土')
            ? '土元素'
            : '大阿卡纳';
    acc[el] = (acc[el] || 0) + 1;
    return acc;
  }, {});

  return (
    <TraditionalBoardShell
      title={data.spreadName}
      subtitle={`西方塔罗 · ${data.cards.length}张牌`}
      className="traditional-tarot-board"
    >
      <TraditionalMeta
        items={[
          ['占事', session?.question],
          [
            '日期',
            session?.createdAt ? new Date(session.createdAt).toLocaleString('zh-CN') : undefined,
          ],
          ['牌阵', data.spreadName],
          ['张数', `${data.cards.length}张`],
          ['位态', `正位${uprightCount}张 · 逆位${reversedCount}张`],
        ]}
      />
      <TraditionalFacts
        items={[
          [
            '牌组分布',
            Object.entries(elements)
              .map(([el, count]) => `${el}：${count}张`)
              .join(' · '),
          ],
        ]}
      />
      <div className={`traditional-tarot-spread ${getTarotSpreadClass(data.spreadType)}`}>
        {data.cards.map((card, index) => (
          <article
            className={`traditional-tarot-card${card.reversed ? ' is-reversed' : ''}`}
            key={`${card.position}-${card.id}`}
          >
            <span className="traditional-card-index">#{index + 1}</span>
            <span className="traditional-card-position">{card.position}</span>
            <button
              type="button"
              className="traditional-term-link traditional-card-name"
              onClick={() => openTerm(card.name, { category: '塔罗' })}
              title="点击查看牌义典籍解析"
            >
              {card.name}
            </button>
            <div className="traditional-card-tags">
              <span
                className={`traditional-card-orientation${card.reversed ? ' is-reversed' : ' is-upright'}`}
              >
                {card.reversed ? '逆位' : '正位'}
              </span>
              {card.element ? (
                <span className="traditional-card-element">{card.element.slice(0, 4)}</span>
              ) : null}
            </div>
            {card.keywords?.length ? (
              <small className="traditional-card-keywords">
                {card.keywords.slice(0, 3).join(' · ')}
              </small>
            ) : null}
          </article>
        ))}
      </div>
    </TraditionalBoardShell>
  );
}

function LenormandTraditionalBoard({
  data,
  session,
}: {
  data: LenormandData;
  session?: DivinationSession;
}) {
  const { openTerm } = useMetaphysicsTermModal();
  const hasCoordinates = data.cards.some((card) => card.row && card.column);
  const isGrandTableau = data.spreadType === 'grandTableau';
  return (
    <TraditionalBoardShell
      title={data.spreadName}
      subtitle={`雷诺曼 · ${data.cards.length}张牌${isGrandTableau ? ' · 大 Tableau 牌阵' : ''}`}
      className="traditional-lenormand-board"
    >
      <TraditionalMeta
        items={[
          ['占事', session?.question],
          [
            '日期',
            session?.createdAt ? new Date(session.createdAt).toLocaleString('zh-CN') : undefined,
          ],
          ['牌阵', data.spreadName],
          ['张数', `${data.cards.length}张`],
        ]}
      />
      {data.combinations?.length ? (
        <TraditionalFacts
          items={[
            [
              '核心组合',
              data.combinations
                .slice(0, 3)
                .map((item) => `${item.card1}＋${item.card2}：${item.meaning}`)
                .join('；'),
            ],
          ]}
        />
      ) : null}
      <div
        className={`traditional-lenormand-grid${hasCoordinates ? ' has-coordinates' : ''}`}
        style={isGrandTableau ? { gridTemplateColumns: 'repeat(9, minmax(0, 1fr))' } : undefined}
      >
        {data.cards.map((card) => (
          <article
            className="traditional-lenormand-card"
            key={`${card.position}-${card.id}`}
            style={hasCoordinates ? { gridColumn: card.column, gridRow: card.row } : undefined}
          >
            <div className="traditional-lenormand-card-header">
              <span className="traditional-lenormand-id">#{card.id}</span>
              <span className="traditional-lenormand-pos">{card.position}</span>
            </div>
            <button
              type="button"
              className="traditional-term-link traditional-lenormand-name"
              onClick={() => openTerm(card.name, { category: '雷诺曼' })}
              title="点击查看雷诺曼牌义解析"
            >
              {card.name}
            </button>
            {card.house ? (
              <span className="traditional-lenormand-house">落第{card.house}宫</span>
            ) : null}
            {card.keywords?.length ? (
              <p className="traditional-lenormand-keywords">
                {card.keywords.slice(0, 2).join(' · ')}
              </p>
            ) : null}
            {card.meaning ? (
              <small className="traditional-lenormand-meaning">{card.meaning}</small>
            ) : null}
          </article>
        ))}
      </div>
    </TraditionalBoardShell>
  );
}

function SsgwTraditionalBoard({ data, session }: { data: SsgwData; session?: DivinationSession }) {
  const poemLines = data.poem.split(/\s*[|\n]\s*/).filter(Boolean);
  return (
    <TraditionalBoardShell
      title={`第${data.number}签 · ${data.title}`}
      subtitle={`${data.ganzhi.day}日签 · ${data.auspice || ''}`}
      className="traditional-ssgw-board"
    >
      <TraditionalMeta
        items={[
          ['占事', session?.question],
          [
            '日期',
            session?.createdAt ? new Date(session.createdAt).toLocaleString('zh-CN') : undefined,
          ],
          [
            '干支',
            `${data.ganzhi.year}年 ${data.ganzhi.month}月 ${data.ganzhi.day}日 ${data.ganzhi.hour}时`,
          ],
          ['签号', `第${data.number}签`],
          ['签题', data.title],
          ['吉凶', data.auspice],
        ]}
      />
      <div className="traditional-sign-card">
        <div className="traditional-sign-number">{data.number}</div>
        <div className="traditional-sign-poem">
          {poemLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </div>
      {data.story ? (
        <div className="traditional-sign-story">
          <b>典故</b>
          <span>{data.story}</span>
        </div>
      ) : null}
      {data.details ? (
        <div className="traditional-sign-details">
          {Object.entries(data.details).map(([label, value]) => (
            <div key={label}>
              <b>{label}</b>
              <span>{value}</span>
            </div>
          ))}
        </div>
      ) : null}
    </TraditionalBoardShell>
  );
}

type AlmanacDisplayStatus = '可用候选' | '条件候选' | '慎用候选';
type AlmanacStatusFilter = 'all' | AlmanacDisplayStatus;

const ALMANAC_STATUS_OPTIONS: Array<{ value: AlmanacDisplayStatus; label: string }> = [
  { value: '可用候选', label: '初筛可用' },
  { value: '条件候选', label: '需核对' },
  { value: '慎用候选', label: '初筛慎用' },
];

const ALMANAC_STATUS_LABELS: Record<AlmanacDisplayStatus, string> = {
  可用候选: '初筛可用',
  条件候选: '需核对',
  慎用候选: '初筛慎用',
};

function uniqueAlmanacTexts(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((item): item is string => Boolean(item?.trim()))));
}

function getAlmanacStatusClass(status: AlmanacDisplayStatus) {
  return status === '可用候选'
    ? 'is-usable'
    : status === '慎用候选'
      ? 'is-caution'
      : 'is-conditional';
}

function AlmanacTraditionalBoard({
  data,
  session: _session,
}: {
  data: AlmanacData;
  session?: DivinationSession;
}) {
  const evidenceAnalysis = useMemo(
    () => data.evidenceAnalysis ?? analyzeAlmanacEvidence(data),
    [data],
  );
  const candidateByDate = useMemo(
    () => new Map(evidenceAnalysis.candidates.map((item) => [item.date, item])),
    [evidenceAnalysis],
  );
  const [statusFilter, setStatusFilter] = useState<AlmanacStatusFilter>('all');
  const [selectedDate, setSelectedDate] = useState(data.days[0]?.date ?? '');
  const statusForDate = (date: string): AlmanacDisplayStatus =>
    candidateByDate.get(date)?.status ?? '条件候选';
  const counts = data.days.reduce<Record<AlmanacDisplayStatus, number>>(
    (result, day) => {
      result[statusForDate(day.date)] += 1;
      return result;
    },
    { 可用候选: 0, 条件候选: 0, 慎用候选: 0 },
  );
  const visibleDays =
    statusFilter === 'all'
      ? data.days
      : data.days.filter((day) => statusForDate(day.date) === statusFilter);
  const selectedDay =
    visibleDays.find((day) => day.date === selectedDate) ?? visibleDays[0] ?? data.days[0];
  const selectedEvidence = selectedDay ? candidateByDate.get(selectedDay.date) : undefined;
  const selectedStatus = selectedDay ? statusForDate(selectedDay.date) : '条件候选';
  const supportTexts = selectedDay
    ? uniqueAlmanacTexts([
        ...(selectedEvidence?.topicMatches ?? []),
        ...(selectedEvidence?.traditionalSupport ?? []),
        ...(selectedEvidence?.participantSupport ?? []),
        ...selectedDay.highlights,
      ]).slice(0, 6)
    : [];
  const constraintTexts = selectedDay
    ? uniqueAlmanacTexts([
        ...(selectedEvidence?.traditionalConstraints ?? []),
        ...(selectedEvidence?.participantConflicts ?? []),
        ...(selectedEvidence?.directionConstraints ?? []),
        ...selectedDay.cautions,
      ]).slice(0, 6)
    : [];
  const preferenceLabel =
    data.weekendPreference === 'prefer'
      ? '优先周末'
      : data.weekendPreference === 'avoid'
        ? '避开周末'
        : '';
  const timePreferenceLabel = data.timePreferences?.length
    ? `${[
        data.timePreferences.includes('work-hours') ? '工作时间' : '',
        data.timePreferences.includes('morning') ? '上午优先' : '',
        data.timePreferences.includes('afternoon') ? '下午优先' : '',
      ]
        .filter(Boolean)
        .join('、')}`
    : '';

  function applyStatusFilter(nextFilter: AlmanacStatusFilter) {
    setStatusFilter(nextFilter);
    if (nextFilter === 'all') {
      setSelectedDate(data.days[0]?.date ?? '');
      return;
    }
    setSelectedDate(data.days.find((day) => statusForDate(day.date) === nextFilter)?.date ?? '');
  }

  return (
    <TraditionalBoardShell
      title={`${data.topicLabel}择日`}
      subtitle={`${data.startDate} 至 ${data.endDate}${preferenceLabel ? ` · ${preferenceLabel}` : ''}${timePreferenceLabel ? ` · ${timePreferenceLabel}` : ''}`}
      className="traditional-almanac-board"
    >
      <TraditionalMeta
        items={[
          ['事项', data.topicLabel],
          ['日期范围', `${data.startDate} 至 ${data.endDate}`],
          ['偏好', [preferenceLabel, timePreferenceLabel].filter(Boolean).join(' · ') || undefined],
        ]}
      />
      <div className="traditional-almanac-toolbar">
        <button
          type="button"
          className={statusFilter === 'all' ? 'is-active' : ''}
          onClick={() => applyStatusFilter('all')}
        >
          全部 <span>{data.days.length}</span>
        </button>
        {ALMANAC_STATUS_OPTIONS.map((item) => (
          <button
            key={item.value}
            type="button"
            className={`${getAlmanacStatusClass(item.value)} ${statusFilter === item.value ? 'is-active' : ''}`}
            onClick={() => applyStatusFilter(item.value)}
          >
            {item.label} <span>{counts[item.value]}</span>
          </button>
        ))}
      </div>

      {selectedDay ? (
        <div className="traditional-almanac-workspace">
          <nav className="traditional-almanac-candidates" aria-label="候选日期">
            {visibleDays.map((day) => {
              const evidence = candidateByDate.get(day.date);
              const status = statusForDate(day.date);
              const preview =
                evidence?.topicMatches[0] ??
                evidence?.traditionalSupport[0] ??
                day.highlights[0] ??
                '查看当日资料';
              return (
                <button
                  key={day.date}
                  type="button"
                  className={`${getAlmanacStatusClass(status)} ${day.date === selectedDay.date ? 'is-active' : ''}`}
                  aria-current={day.date === selectedDay.date ? 'date' : undefined}
                  onClick={() => setSelectedDate(day.date)}
                >
                  <span className="traditional-almanac-candidate-date">
                    <strong>{day.date.slice(5)}</strong>
                    <small>{day.weekday.replace('星期', '周')}</small>
                  </span>
                  <span className="traditional-almanac-candidate-main">
                    <b>
                      {day.ganzhi.day}日 · {day.dayOfficer}
                    </b>
                    <small>{preview}</small>
                  </span>
                  <em>{ALMANAC_STATUS_LABELS[status]}</em>
                </button>
              );
            })}
          </nav>

          <article className="traditional-almanac-detail">
            <header className="traditional-almanac-detail-head">
              <div>
                <span>{selectedDay.weekday}</span>
                <h4>{selectedDay.date}</h4>
                <p>
                  {selectedDay.lunarDate} · {selectedDay.ganzhi.day}日
                </p>
              </div>
              <b className={getAlmanacStatusClass(selectedStatus)}>
                {ALMANAC_STATUS_LABELS[selectedStatus]}
              </b>
            </header>

            <div className="traditional-almanac-facts">
              <span>
                <small>建除</small>
                <b>{selectedDay.dayOfficer}</b>
              </span>
              <span>
                <small>十二神</small>
                <b>{selectedDay.twelveStar}</b>
              </span>
              <span>
                <small>二十八宿</small>
                <b>{selectedDay.twentyEightStar}</b>
              </span>
              <span>
                <small>冲煞</small>
                <b>{selectedDay.clash}</b>
              </span>
            </div>

            <div className="traditional-almanac-yi-ji">
              <section>
                <b>宜</b>
                <p>{selectedDay.recommends.slice(0, 8).join('、') || '未列明确宜项'}</p>
              </section>
              <section>
                <b>忌</b>
                <p>{selectedDay.avoids.slice(0, 8).join('、') || '未列明确忌项'}</p>
              </section>
            </div>

            <div className="traditional-almanac-evidence-grid">
              <section>
                <h5>择日依据</h5>
                {supportTexts.length ? (
                  <ul>
                    {supportTexts.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p>未见直接支持项，需结合限制条件比较。</p>
                )}
              </section>
              <section>
                <h5>限制条件</h5>
                {constraintTexts.length ? (
                  <ul>
                    {constraintTexts.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p>当前规则下未见明确限制。</p>
                )}
              </section>
            </div>

            <section className="traditional-almanac-hours">
              <h5>可用时辰</h5>
              {selectedEvidence?.usableHours.length ? (
                <div>
                  {selectedEvidence.usableHours.map((hour) => (
                    <span key={hour.key}>
                      <b>{hour.name}</b>
                      <small>{hour.range}</small>
                      <em>{hour.ganzhi}</em>
                    </span>
                  ))}
                </div>
              ) : (
                <p>当前规则下未筛出无明显冲突的时辰。</p>
              )}
            </section>
          </article>
        </div>
      ) : (
        <p className="traditional-almanac-empty">当前筛选下没有候选日期。</p>
      )}
    </TraditionalBoardShell>
  );
}

function TaiyiTraditionalBoard({
  data,
  session,
}: {
  data: TaiyiResult;
  session?: DivinationSession;
}) {
  const scopeLabel = { year: '年计', month: '月计', day: '日计', hour: '时计' }[data.scope];
  const pointMarkers = new Map<string, string[]>();
  const palaceRoles = new Map<number, string[]>();
  const addPointMarker = (point: string, label: string) => {
    pointMarkers.set(point, [...(pointMarkers.get(point) ?? []), label]);
  };
  const addPalaceRole = (palace: number, label: string) => {
    palaceRoles.set(palace, [...(palaceRoles.get(palace) ?? []), label]);
  };
  addPointMarker(data.taiyiPosition, '太乙');
  addPointMarker(data.wenChangPosition, '文昌');
  addPointMarker(data.shiJiPosition, '始击');
  addPointMarker(data.jiShenPosition, '计神');
  addPalaceRole(data.lordGeneral, '主大');
  addPalaceRole(data.lordAssistant, '主参');
  addPalaceRole(data.guestGeneral, '客大');
  addPalaceRole(data.guestAssistant, '客参');
  addPalaceRole(data.setGeneral, '定大');
  addPalaceRole(data.setAssistant, '定参');

  const godByPoint = new Map(data.sixteenGods.map((item) => [item.branch, item.god]));
  const natureBySide = new Map(
    data.evidenceAnalysis?.forceFacts?.map((item) => [item.side, item.nature]) ?? [],
  );
  const forceRows = [
    {
      side: '主',
      count: data.lordCount,
      general: data.lordGeneral,
      assistant: data.lordAssistant,
    },
    {
      side: '客',
      count: data.guestCount,
      general: data.guestGeneral,
      assistant: data.guestAssistant,
    },
    {
      side: '定',
      count: data.setCount,
      general: data.setGeneral,
      assistant: data.setAssistant,
    },
  ] as const;
  const conditionJudgments = data.judgments.filter(
    (item) => !/^(主算|客算|定算)\s*\d+\s*为/u.test(item),
  );

  const wenChangClassic = useMemo(() => getTaiyiGeneralClassic('文昌'), []);
  const shiJiClassic = useMemo(() => getTaiyiGeneralClassic('始击'), []);

  return (
    <TraditionalBoardShell
      title={`太乙神数${scopeLabel}`}
      subtitle={`${data.ganZhi} · ${data.yinYang}第${data.bureau}局 · ${data.accumulatedLabel}${data.accumulatedValue}`}
      className="traditional-taiyi-board"
    >
      <TraditionalMeta
        items={[
          ['占事', session?.question],
          [
            '日期',
            session?.createdAt
              ? new Date(session.createdAt).toLocaleString('zh-CN')
              : data.dateTime || undefined,
          ],
          ['干支', data.ganZhi],
          ['计式', `太乙${scopeLabel}`],
          ['定局', `${data.yinYang}第${data.bureau}局`],
          ['积年', `${data.accumulatedLabel} ${data.accumulatedValue}`],
        ]}
      />
      <TraditionalFacts
        items={[
          [
            '三宫定位',
            `太乙居${data.taiyiPalace}宫 · 文昌居${data.wenChangPalace}宫 · 始击居${data.shiJiPalace}宫`,
          ],
          [
            '主客大将',
            `主大将居${data.lordGeneral}宫 · 客大将居${data.guestGeneral}宫 · 定大将居${data.setGeneral}宫`,
          ],
        ]}
      />

      <div className="traditional-taiyi-plate" role="group" aria-label="太乙十六神与八宫局式">
        {TAIYI_POINT_LAYOUT.map(({ point, row, column }) => {
          const markers = pointMarkers.get(point) ?? [];
          return (
            <div
              className={`traditional-taiyi-point${markers.length ? ' is-occupied' : ''}`}
              key={point}
              style={{ gridRow: row, gridColumn: column }}
            >
              <div className="traditional-taiyi-point-head">
                <strong>{point}</strong>
                <span>{godByPoint.get(point)}</span>
              </div>
              {markers.length ? (
                <div className="traditional-taiyi-point-markers">
                  {markers.map((marker) => (
                    <b key={marker}>{marker}</b>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
        {TAIYI_PALACE_LAYOUT.map(({ palace, row, column }) => {
          const profile = TAIYI_PALACES[palace];
          const roles = palaceRoles.get(palace) ?? [];
          return (
            <div
              className={`traditional-taiyi-palace${palace === 5 ? ' is-center' : ''}`}
              key={palace}
              style={{ gridRow: row, gridColumn: column }}
            >
              {palace === 5 ? (
                <>
                  <span>中五宫</span>
                  <strong>
                    {data.yinYang} {data.bureau}局
                  </strong>
                </>
              ) : (
                <>
                  <span>
                    {profile.gua}
                    {palace}宫
                  </span>
                  <small>
                    {profile.dir} · {profile.wu}
                  </small>
                </>
              )}
              {roles.length ? (
                <div className="traditional-taiyi-palace-roles">
                  {roles.map((role) => (
                    <b key={role}>{role}</b>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="traditional-taiyi-forces" role="table" aria-label="太乙主客定算将参">
        <div className="traditional-taiyi-force-head" role="row">
          <span role="columnheader">三算</span>
          <span role="columnheader">算数</span>
          <span role="columnheader">大将</span>
          <span role="columnheader">参将</span>
        </div>
        {forceRows.map((row) => (
          <div className="traditional-taiyi-force-row" role="row" key={row.side}>
            <strong role="cell">{row.side}</strong>
            <span role="cell">
              {row.count}
              {natureBySide.get(row.side) ? <small>{natureBySide.get(row.side)}</small> : null}
            </span>
            <span role="cell">第{row.general}宫</span>
            <span role="cell">第{row.assistant}宫</span>
          </div>
        ))}
      </div>
      {conditionJudgments.length ? (
        <div className="traditional-taiyi-conditions">
          {conditionJudgments.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      ) : null}

      {wenChangClassic ? (
        <ClassicalAnnotationCard
          title={`文昌（主算先锋）· ${wenChangClassic.role}`}
          source={wenChangClassic.sourceBook}
          verse={wenChangClassic.verse}
          modernAdvice={`【性情】${wenChangClassic.nature}\n【决策指引】${wenChangClassic.actionAdvice}`}
        />
      ) : null}

      {shiJiClassic ? (
        <ClassicalAnnotationCard
          title={`始击（客算突击）· ${shiJiClassic.role}`}
          source={shiJiClassic.sourceBook}
          verse={shiJiClassic.verse}
          modernAdvice={`【性情】${shiJiClassic.nature}\n【决策指引】${shiJiClassic.actionAdvice}`}
        />
      ) : null}
    </TraditionalBoardShell>
  );
}

function HuangjiPeriodCell(props: {
  label: string;
  period: HuangjiPeriodHexagram;
  active?: boolean;
}) {
  const { label, period, active = false } = props;
  return (
    <article className={`traditional-huangji-period${active ? ' is-active' : ''}`}>
      <div className="traditional-huangji-period-head">
        <span>{label}</span>
        <small>{period.durationYears}年</small>
      </div>
      <div className="traditional-huangji-hexagram">
        <strong>{period.hexagram.symbol}</strong>
        <div>
          <b>{period.hexagram.name}</b>
          <span>
            {period.hexagram.upper}上 · {period.hexagram.lower}下
          </span>
        </div>
      </div>
      <p>
        {formatHuangjiCivilYear(period.startYear)}—{formatHuangjiCivilYear(period.endYear)}
      </p>
      {period.derivedFrom && period.changedLine ? (
        <em>
          {period.derivedFrom}卦第{period.changedLine}爻变
        </em>
      ) : null}
    </article>
  );
}

function HuangjiDateTimeCell(props: {
  label: string;
  hexagram: HuangjiDerivedHexagram;
  note: string;
  active?: boolean;
}) {
  const { label, hexagram, note, active = false } = props;
  return (
    <article className={`traditional-huangji-period${active ? ' is-active' : ''}`}>
      <div className="traditional-huangji-period-head">
        <span>{label}</span>
        <small>{note}</small>
      </div>
      <div className="traditional-huangji-hexagram">
        <strong>{hexagram.symbol}</strong>
        <div>
          <b>{hexagram.name}</b>
          <span>
            {hexagram.upper}上 · {hexagram.lower}下
          </span>
        </div>
      </div>
      {hexagram.changedLine ? (
        <em>
          {hexagram.derivedFrom}卦第{hexagram.changedLine}爻变
        </em>
      ) : (
        <em>六十卦序第{(hexagram.sequenceOffset || 0) + 1}位</em>
      )}
    </article>
  );
}

function HuangjiTraditionalBoard({
  data,
  session,
}: {
  data: HuangjiJingshiResult;
  session?: DivinationSession;
}) {
  const annualCycleClassic = useMemo(() => getHuangjiCycleClassic('年'), []);
  const shiCycleClassic = useMemo(() => getHuangjiCycleClassic('世'), []);

  const forecast = data.forecast;
  if (!forecast) return null;
  const dateTimeForecast = data.dateTimeForecast;

  const { governing, yun, sixtyYear, decade, annual } = forecast.hexagrams;
  const related = [
    ['互卦', forecast.relatedHexagrams.mutual],
    ['错卦', forecast.relatedHexagrams.opposite],
    ['综卦', forecast.relatedHexagrams.reversed],
  ] as const;

  return (
    <TraditionalBoardShell
      title="皇极经世盘"
      subtitle={
        dateTimeForecast
          ? `${dateTimeForecast.civilTime.dateTime} · ${annual.ganzhi} · ${forecast.hui.branch}会`
          : `${formatHuangjiCivilYear(annual.year)} · ${annual.ganzhi} · ${forecast.hui.branch}会`
      }
      className="traditional-huangji-board"
    >
      <TraditionalMeta
        items={[
          ['占事', session?.question],
          [
            '日期',
            session?.createdAt
              ? new Date(session.createdAt).toLocaleString('zh-CN')
              : dateTimeForecast?.civilTime.dateTime || `${formatHuangjiCivilYear(annual.year)}`,
          ],
          [
            '元会运世',
            `第${data.position.yuan.indexFromEpoch + 1}元 · 第${forecast.hui.indexInYuan}会（${forecast.hui.branch}会） · 第${data.position.yun.indexInHui}运 · 第${data.position.shi.indexInYun}世（第${data.position.year.indexInShi}年）`,
          ],
        ]}
      />
      <TraditionalFacts
        items={[
          ['值年卦', `${annual.name}（${annual.ganzhi}）`],
          ['会内统卦', `${governing.hexagram.name}（统${governing.durationYears}年）`],
          ['六十年统卦', `${sixtyYear.hexagram.name}（统${sixtyYear.durationYears}年）`],
        ]}
      />

      <div className="traditional-huangji-cycle" role="list" aria-label="皇极经世卦序层级">
        <HuangjiPeriodCell label="会内统卦" period={governing} />
        <HuangjiPeriodCell label="运卦" period={yun} />
        <HuangjiPeriodCell label="六十年统卦" period={sixtyYear} />
        <HuangjiPeriodCell label="十年卦" period={decade} />
        <article className="traditional-huangji-period is-active">
          <div className="traditional-huangji-period-head">
            <span>值年卦</span>
            <small>{annual.ganzhi}</small>
          </div>
          <div className="traditional-huangji-hexagram">
            <strong>{annual.symbol}</strong>
            <div>
              <b>{annual.name}</b>
              <span>
                {annual.upper}上 · {annual.lower}下
              </span>
            </div>
          </div>
          <p>{formatHuangjiCivilYear(annual.year)}</p>
        </article>
      </div>

      {dateTimeForecast ? (
        <div
          className="traditional-huangji-cycle is-datetime"
          role="list"
          aria-label="皇极经世年月日时卦序"
        >
          <HuangjiDateTimeCell
            label="月经卦"
            hexagram={dateTimeForecast.hexagrams.monthJing}
            note={`第${dateTimeForecast.calendar.monthIndex}月`}
          />
          <HuangjiDateTimeCell
            label="旬纬卦"
            hexagram={dateTimeForecast.hexagrams.xunWei}
            note={`月内${dateTimeForecast.calendar.dayOfMonth}日`}
          />
          <HuangjiDateTimeCell
            label="日卦"
            hexagram={dateTimeForecast.hexagrams.daily}
            note={dateTimeForecast.calendar.activeSolarTerm}
          />
          <HuangjiDateTimeCell
            label="时经卦"
            hexagram={dateTimeForecast.hexagrams.hourJing}
            note={dateTimeForecast.calendar.hourRange}
            active
          />
        </div>
      ) : null}

      <div className="traditional-huangji-focus">
        <div className="traditional-huangji-judgment">
          <span>值年卦辞</span>
          <p>{annual.judgment}</p>
        </div>
        <div className="traditional-huangji-related" aria-label="值年卦互错综">
          {related.map(([label, hexagram]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{hexagram.symbol}</strong>
              <b>{hexagram.name}</b>
              <small>
                {hexagram.upper}上 · {hexagram.lower}下
              </small>
            </div>
          ))}
        </div>
      </div>

      {annualCycleClassic ? (
        <ClassicalAnnotationCard
          title={`${annualCycleClassic.name} · 邵雍《皇极经世》要义`}
          source={annualCycleClassic.sourceBook}
          verse={annualCycleClassic.verse}
          modernAdvice={`【经世原理】${annualCycleClassic.principle}\n【指引】${annualCycleClassic.modernAdvice}`}
        />
      ) : null}

      {shiCycleClassic ? (
        <ClassicalAnnotationCard
          title={`${shiCycleClassic.name} · 三十年世卦要义`}
          source={shiCycleClassic.sourceBook}
          verse={shiCycleClassic.verse}
          modernAdvice={`【经世原理】${shiCycleClassic.principle}\n【指引】${shiCycleClassic.modernAdvice}`}
        />
      ) : null}
    </TraditionalBoardShell>
  );
}

const LIUREN_BRANCH_POSITIONS: Record<string, { row: number; column: number }> = {
  巳: { row: 1, column: 1 },
  午: { row: 1, column: 2 },
  未: { row: 1, column: 3 },
  申: { row: 1, column: 4 },
  酉: { row: 2, column: 4 },
  戌: { row: 3, column: 4 },
  亥: { row: 4, column: 4 },
  子: { row: 4, column: 3 },
  丑: { row: 4, column: 2 },
  寅: { row: 4, column: 1 },
  卯: { row: 3, column: 1 },
  辰: { row: 2, column: 1 },
};

const LIUREN_BRANCH_ORDER = Object.keys(LIUREN_BRANCH_POSITIONS);

function findLiurenTransmissionStage(
  transmissions: LiurenTransmission[],
  branch: string,
): LiurenTransmission['stage'] | null {
  return transmissions.find((item) => item.branch === branch)?.stage || null;
}

function LiurenPlateCell({ data, item }: { data: LiurenData; item: LiurenPlateItem }) {
  const position = LIUREN_BRANCH_POSITIONS[item.under];
  const transmissionStage = findLiurenTransmissionStage(data.threeTransmissions, item.branch);
  const className = [
    'liuren-script-cell',
    item.under === data.divinationBranch ? 'is-hour' : '',
    item.branch === data.monthLeader ? 'is-month-leader' : '',
    item.branch === data.noblemanBranch ? 'is-nobleman' : '',
    data.xunKong?.includes(item.under) ? 'is-empty' : '',
    transmissionStage ? 'is-transmission' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={className}
      style={position ? { gridColumn: position.column, gridRow: position.row } : undefined}
    >
      <span>{item.god}</span>
      <strong>{item.branch}</strong>
      {transmissionStage ? <em>{transmissionStage.replace('传', '')}</em> : null}
    </div>
  );
}

function LiurenPlateGrid({ data }: { data: LiurenData }) {
  const plateMap = new Map(data.heavenlyPlate.map((item) => [item.under, item]));
  const orderedPlate = LIUREN_BRANCH_ORDER.map((branch) => plateMap.get(branch)).filter(
    (item): item is LiurenPlateItem => Boolean(item),
  );

  return (
    <div className="liuren-script-plate">
      {orderedPlate.map((item) => (
        <LiurenPlateCell data={data} item={item} key={item.under} />
      ))}
      <div className="liuren-script-center">
        <span>天地盘</span>
        <strong>
          {data.ganzhi.day}日 {data.ganzhi.hour}时
        </strong>
        <p>
          月将{data.monthLeader}加{data.divinationBranch} · {data.dayNight || '时段未知'}
        </p>
        <p>
          {data.noblemanBranch ? `贵人${data.noblemanBranch}` : '贵人未标注'}
          {data.noblemanGroundBranch ? `临${data.noblemanGroundBranch}` : ''}
          {' · '}
          {data.xunKong?.length ? `旬空${data.xunKong.join('、')}` : '旬空未知'}
        </p>
      </div>
    </div>
  );
}

function LiurenCompactMatrix({ data }: { data: LiurenData }) {
  return (
    <div className="liuren-compact-matrix">
      <section>
        <span className="liuren-matrix-title">四课</span>
        <div className="liuren-matrix-columns">
          {data.fourLessons.map((lesson) => (
            <div className="liuren-matrix-column" key={lesson.name}>
              <span>{lesson.god}</span>
              <strong>{lesson.upper}</strong>
              <b>{lesson.lower}</b>
              <small>{lesson.name}</small>
              <small className="liuren-matrix-detail">
                {[lesson.relation, lesson.note].filter(Boolean).join(' · ')}
              </small>
            </div>
          ))}
        </div>
      </section>

      <section>
        <span className="liuren-matrix-title">三传</span>
        <div className="liuren-matrix-columns">
          {data.threeTransmissions.map((item) => (
            <div className="liuren-matrix-column" key={item.stage}>
              <span>{item.god}</span>
              <strong>{item.branch}</strong>
              <small>{item.stage}</small>
              <small className="liuren-matrix-detail">
                {[
                  item.relation,
                  item.wuxing,
                  item.seasonState,
                  item.dayRelation,
                  item.isVoid ? '空' : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function LiurenTraditionalBoard({
  data,
  session,
}: {
  data: LiurenData;
  session?: DivinationSession;
}) {
  const transmissionText = data.threeTransmissions
    .map((item) => `${item.stage.replace('传', '')}${item.branch}`)
    .join(' → ');
  const transmissionMethod = [data.transmissionRule, data.transmissionPattern]
    .filter(Boolean)
    .join(' · ');
  const lessonPatterns = Array.from(new Set([...(data.guaTi ?? []), ...(data.patternTags ?? [])]))
    .filter(Boolean)
    .join('、');
  const shenShaItems = Array.from(new Set(data.shenShaSummary?.filter(Boolean) ?? []));
  const shenSha = shenShaItems.length
    ? `${shenShaItems.slice(0, 8).join('、')}${shenShaItems.length > 8 ? ` · 另${shenShaItems.length - 8}项` : ''}`
    : undefined;

  const transmissionClassic = useMemo(() => {
    const rule = data.transmissionRule || data.transmissionPattern;
    return rule ? getLiurenTransmissionClassic(rule) : undefined;
  }, [data.transmissionRule, data.transmissionPattern]);

  const patternClassics = useMemo(() => {
    const items = [...(data.guaTi ?? []), ...(data.patternTags ?? [])];
    const results: Array<{ pattern: string; source: string; verse: string; advice: string }> = [];
    items.forEach((p) => {
      const found = getLiurenLessonPatternClassic(p);
      if (found && !results.some((r) => r.pattern === found.pattern)) {
        results.push({
          pattern: found.pattern,
          source: found.sourceBook,
          verse: found.verse,
          advice: found.modernAdvice,
        });
      }
    });
    return results;
  }, [data.guaTi, data.patternTags]);

  const firstGeneralClassic = useMemo(() => {
    const g = data.threeTransmissions[0]?.god;
    return g ? getLiurenGeneralClassic(g) : undefined;
  }, [data.threeTransmissions]);

  return (
    <TraditionalBoardShell
      title={`大六壬${data.transmissionPattern || '天地盘'}`}
      subtitle={`${data.ganzhi.day}日 · ${data.ganzhi.hour}时 · 月将${data.monthLeader}加${data.divinationBranch}`}
      className="traditional-liuren-board"
    >
      <DivinationMetaTable
        question={session?.question}
        dateStr={
          session?.createdAt ? new Date(session.createdAt).toLocaleString('zh-CN') : '起课时间'
        }
        methodLabel="大六壬正时起课"
        ganzhi={data.ganzhi}
        voidBranches={data.xunKong}
        extraRows={[
          {
            label: '课体',
            value: (
              <div className="is-shensha-line">
                <span>
                  月将：<strong>{data.monthLeader}</strong>（加{data.divinationBranch}）
                </span>
                <span>
                  {data.dayNight}贵人：<strong>{data.noblemanBranch}</strong>
                  {data.noblemanGroundBranch ? `临${data.noblemanGroundBranch}` : ''}
                </span>
                <span>
                  日干寄宫：<strong>{data.dayStemResidence}</strong>
                </span>
                <span>
                  课体：<strong>{lessonPatterns || '正象'}</strong>
                </span>
              </div>
            ),
          },
          {
            label: '三传',
            value: (
              <div className="is-shensha-line">
                <span>
                  取传：<strong>{transmissionMethod}</strong>
                </span>
                <span>
                  三传：<strong>{transmissionText}</strong>
                </span>
                {shenSha ? <span>神煞：{shenSha}</span> : null}
              </div>
            ),
          },
        ]}
      />

      <div className="liuren-script-panel">
        <LiurenPlateGrid data={data} />
        <LiurenCompactMatrix data={data} />
      </div>

      {firstGeneralClassic ? (
        <ClassicalAnnotationCard
          title={`初传天将 ${firstGeneralClassic.general} · 天将精解（${firstGeneralClassic.auspice}）`}
          source={firstGeneralClassic.sourceBook}
          verse={firstGeneralClassic.verse}
          modernAdvice={firstGeneralClassic.modernAdvice}
        />
      ) : null}

      {transmissionClassic ? (
        <ClassicalAnnotationCard
          title={`${transmissionClassic.rule} · 九宗门取传法`}
          source={transmissionClassic.sourceBook}
          verse={transmissionClassic.verse}
          modernAdvice={`【法则要领】${transmissionClassic.summary}\n【现代释义】${transmissionClassic.modernAdvice}`}
        />
      ) : null}

      {patternClassics.map((pc) => (
        <ClassicalAnnotationCard
          key={pc.pattern}
          title={`${pc.pattern} · 课体释义`}
          source={pc.source}
          verse={pc.verse}
          modernAdvice={pc.advice}
        />
      ))}
    </TraditionalBoardShell>
  );
}

const DIVINATION_METHOD_LABELS: Record<string, string> = {
  liuyao: '六爻纳甲',
  meihua: '梅花易数',
  xiaoliuren: '小六壬',
  jinkoujue: '大六壬金口诀',
  qimen: '奇门遁甲',
  tarot: '西方塔罗',
  ssgw: '四圣真武灵签',
  almanac: '黄历择吉',
  lenormand: '雷诺曼卡',
  astrolabe: '古典星盘',
  taiyi: '太乙神数',
  huangji: '皇极经世',
  liuren: '大六壬',
};

function formatDivinationSessionShareText(session: DivinationSession): string {
  const lines: string[] = [];
  const label = DIVINATION_METHOD_LABELS[session.method] || session.method.toUpperCase();
  lines.push(`【${label} 排盘】`);
  if (session.question) lines.push(`所问之事：${session.question}`);
  if (session.createdAt)
    lines.push(`起卦时间：${new Date(session.createdAt).toLocaleString('zh-CN')}`);

  if (session.method === 'liuyao') {
    const d = session.data as LiuyaoData;
    lines.push(`本卦：${d.hexagramRelations?.original || d.hexagramName || ''}`);
    if (d.hexagramRelations?.changed) lines.push(`变卦：${d.hexagramRelations.changed}`);
    if (d.worldHolding) lines.push(`世爻：${d.worldHolding}`);
    if (d.monthZhi && d.dayZhi)
      lines.push(
        `日月建：${d.monthZhi}月 ${d.dayZhi}日 (空亡:${d.voidBranches?.join('') || '无'})`,
      );
  } else if (session.method === 'meihua') {
    const d = session.data as MeihuaData;
    lines.push(`本卦：${d.originalGua}  互卦：${d.mutualGua}  变卦：${d.transformedGua}`);
    lines.push(`体卦：${d.bodyTrigram}  用卦：${d.useTrigram}`);
  } else if (session.method === 'qimen') {
    const d = session.data as QimenData;
    lines.push(`局数：${d.juName || ''}`);
    if (d.dutyStar) lines.push(`值符：${d.dutyStar}  值使：${d.dutyDoor || ''}`);
  } else if (session.method === 'liuren') {
    const d = session.data as LiurenData;
    lines.push(
      `三传：初传【${d.threeTransmissions?.initial?.branch || ''}】 中传【${d.threeTransmissions?.middle?.branch || ''}】 末传【${d.threeTransmissions?.final?.branch || ''}】`,
    );
  } else if (session.method === 'xiaoliuren') {
    const d = session.data as XiaoliurenData;
    lines.push(
      `三宫：月宫【${d.monthGong?.name || ''}】 日宫【${d.dayGong?.name || ''}】 时宫【${d.hourGong?.name || ''}】`,
    );
  } else if (session.method === 'jinkoujue') {
    const d = session.data as JinkoujueData;
    lines.push(
      `四位：人元【${d.renYuan}】 贵神【${d.guiShen}】 将神【${d.jiangShen}】 地分【${d.diFen}】`,
    );
  }

  return lines.join('\n');
}

export function TraditionalDivinationBoard({
  session,
  onRestart,
}: {
  session: DivinationSession;
  onRestart?: () => void;
}) {
  const [activeTerm, setActiveTerm] = useState<MetaphysicsTerm | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const handleOpenTerm = useCallback((term: string, context?: TermContextData) => {
    const found = lookupMetaphysicsTerm(term);
    if (found) {
      setActiveTerm({ ...found, context });
    }
  }, []);

  const chartSummaryText = useMemo(() => {
    return formatDivinationSessionShareText(session);
  }, [session]);

  let boardContent: ReactNode;
  switch (session.method) {
    case 'liuyao':
      boardContent = <LiuyaoTraditionalBoard data={session.data as LiuyaoData} session={session} />;
      break;
    case 'meihua':
      boardContent = <MeihuaTraditionalBoard data={session.data as MeihuaData} session={session} />;
      break;
    case 'xiaoliuren':
      boardContent = (
        <XiaoliurenTraditionalBoard data={session.data as XiaoliurenData} session={session} />
      );
      break;
    case 'jinkoujue':
      boardContent = (
        <JinkoujueTraditionalBoard data={session.data as JinkoujueData} session={session} />
      );
      break;
    case 'qimen':
      boardContent = <QimenTraditionalBoard data={session.data as QimenData} session={session} />;
      break;
    case 'tarot':
      boardContent = <TarotTraditionalBoard data={session.data as TarotData} session={session} />;
      break;
    case 'ssgw':
      boardContent = <SsgwTraditionalBoard data={session.data as SsgwData} session={session} />;
      break;
    case 'almanac':
      boardContent = (
        <AlmanacTraditionalBoard data={session.data as AlmanacData} session={session} />
      );
      break;
    case 'lenormand':
      boardContent = (
        <LenormandTraditionalBoard data={session.data as LenormandData} session={session} />
      );
      break;
    case 'astrolabe':
      boardContent = (
        <TraditionalBoardShell
          title="本命星盘"
          subtitle="黄道十二宫 · 主要相位"
          className="traditional-astrolabe-board"
        >
          <AstrolabeChart data={session.data as AstrolabeData} />
        </TraditionalBoardShell>
      );
      break;
    case 'taiyi':
      boardContent = <TaiyiTraditionalBoard data={session.data as TaiyiResult} session={session} />;
      break;
    case 'huangji':
      boardContent = (
        <HuangjiTraditionalBoard data={session.data as HuangjiJingshiResult} session={session} />
      );
      break;
    case 'liuren':
      boardContent = <LiurenTraditionalBoard data={session.data as LiurenData} session={session} />;
      break;
    default:
      return null;
  }

  const methodName = DIVINATION_METHOD_LABELS[session.method] || session.method;

  return (
    <TermExplanationContext.Provider value={{ openTerm: handleOpenTerm }}>
      <DivinationActionsContext.Provider
        value={{
          onShare: () => setIsShareModalOpen(true),
          onRestart,
        }}
      >
        <div className="traditional-board-wrapper">
          {boardContent}

          {isShareModalOpen ? (
            <ChartShareModal
              chartTitle={`${methodName}排盘`}
              chartMethodName={methodName}
              chartText={chartSummaryText}
              question={session.question}
              timeLabel={
                session.createdAt ? new Date(session.createdAt).toLocaleString('zh-CN') : ''
              }
              onClose={() => setIsShareModalOpen(false)}
            />
          ) : null}
          {activeTerm ? (
            <TermExplanationModal termInfo={activeTerm} onClose={() => setActiveTerm(null)} />
          ) : null}
        </div>
      </DivinationActionsContext.Provider>
    </TermExplanationContext.Provider>
  );
}
