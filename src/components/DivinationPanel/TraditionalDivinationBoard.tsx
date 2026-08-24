import type { ReactNode } from 'react';
import { AstrolabeChart } from '@/components/AstrolabeChart';
import type { DivinationSession } from '@/lib/divination/engine';
import {
  formatHuangjiCivilYear,
  type HuangjiJingshiResult,
  type HuangjiPeriodHexagram,
} from 'mingyu-core/huangji-jingshi';
import { TAIYI_PALACES } from 'mingyu-core/taiyi';
import type {
  AlmanacData,
  AstrolabeData,
  JinkoujueData,
  LenormandData,
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

function TraditionalBoardShell(props: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  const { title, subtitle, children, className = '' } = props;
  return (
    <section className={`traditional-board ${className}`.trim()}>
      <div className="traditional-board-head">
        <div>
          <h3>{title}</h3>
        </div>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function TraditionalMeta(props: { items: Array<[string, string | number | undefined]> }) {
  return (
    <div className="traditional-meta-row">
      {props.items
        .filter(([, value]) => value !== undefined && value !== '')
        .map(([label, value]) => (
          <span key={label}>
            <b>{label}</b>
            {value}
          </span>
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

function LiuyaoTraditionalBoard({ data }: { data: LiuyaoData }) {
  const rows = [...data.yaosDetail].sort((a, b) => b.position - a.position);
  const changing = data.changingYaos
    ?.filter((item) => item.isChanging)
    .map((item) => item.position);
  const changedTitle =
    changing?.length && data.changedName && data.changedName !== data.originalName
      ? ` · 之${data.changedName}`
      : '';
  return (
    <TraditionalBoardShell
      title={`${data.originalName}${changedTitle}`}
      subtitle="纳甲六爻"
      className="traditional-liuyao-board"
    >
      <TraditionalMeta
        items={[
          ['卦宫', data.palace?.name ? `${data.palace.name}宫` : undefined],
          ['月建', data.ganzhi.month],
          ['日辰', data.ganzhi.day],
          ['世序', data.palaceStage],
          ['动爻', changing?.length ? changing.map(formatYaoPosition).join('、') : '静卦'],
          ['旬空', data.voidBranches?.join('、') || '无'],
        ]}
      />
      <div className="traditional-liuyao-table" role="table" aria-label="六爻纳甲盘">
        <div className="traditional-liuyao-head" role="row">
          <span>爻位</span>
          <span>六神</span>
          <span>六亲</span>
          <span>爻象</span>
          <span>纳甲</span>
          <span>化爻</span>
          <span>状态</span>
        </div>
        {rows.map((yao) => {
          const state = [
            [yao.isWorld, '世', 'is-primary'],
            [yao.isResponse, '应', 'is-primary'],
            [yao.isVoid, '空', 'is-muted'],
            [yao.isMonthBreak, '月破', 'is-warning'],
            [yao.isHiddenMove, '暗动', 'is-changing'],
            [yao.isDayBreak, '日破', 'is-warning'],
            [yao.isChanging && yao.isDayClash, '日辰冲动', 'is-changing'],
          ].filter(([visible]) => visible) as Array<[boolean, string, string]>;
          const relation = yao.changeRelations?.join('、') || yao.changeRelation || '';
          return (
            <div className="traditional-liuyao-row" role="row" key={yao.position}>
              <span className="traditional-yao-position">{formatYaoPosition(yao.position)}</span>
              <span>{yao.sixGod || '—'}</span>
              <span>{yao.sixRelative || '—'}</span>
              <YaoLine yaoType={yao.yaoType} changing={yao.isChanging} />
              <span>
                {yao.najiaDizhi || '—'}
                <small>{yao.wuxing || ''}</small>
              </span>
              <span className="traditional-changed-yao">
                {yao.changedYao ? (
                  <>
                    化{yao.changedYao.dizhi}
                    <small>
                      {yao.changedYao.wuxing}
                      {relation ? ` · ${relation}` : ''}
                    </small>
                  </>
                ) : (
                  '—'
                )}
              </span>
              <span className="traditional-yao-status">
                {state.length ? (
                  <span className="traditional-yao-status-tags">
                    {state.map(([, label, tone]) => (
                      <span className={tone} key={label}>
                        {label}
                      </span>
                    ))}
                  </span>
                ) : (
                  '—'
                )}
              </span>
            </div>
          );
        })}
      </div>
      {data.hiddenSpirits?.length ? (
        <div className="traditional-note-row">
          <b>伏神</b>
          <span>
            {data.hiddenSpirits
              .map(
                (item) =>
                  `${item.sixRelative}伏${formatYaoPosition(item.position)}${item.najiaDizhi}${item.wuxing}`,
              )
              .join('；')}
          </span>
        </div>
      ) : null}
    </TraditionalBoardShell>
  );
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
}) {
  const { label, hexagram, active = false } = props;
  return (
    <article className={`traditional-mini-hexagram${active ? ' is-active' : ''}`}>
      <span>{label}</span>
      {hexagram ? (
        <>
          <strong>{hexagram.symbol}</strong>
          <b>{hexagram.name}</b>
          <small>
            {hexagram.upper}上 · {hexagram.lower}下
          </small>
          <p>{hexagram.description}</p>
        </>
      ) : (
        <em>无</em>
      )}
    </article>
  );
}

function MeihuaTraditionalBoard({ data }: { data: MeihuaData }) {
  const rows = [...data.yaosDetail].sort((a, b) => b.position - a.position);
  return (
    <TraditionalBoardShell
      title={data.mainHexagram.name}
      subtitle="梅花易数 · 体用、互卦与变卦"
      className="traditional-meihua-board"
    >
      <TraditionalMeta
        items={[
          ['起卦法', data.calculation?.method],
          ['体卦', `${data.tiGua.name}（${data.tiGua.element}）`],
          ['用卦', `${data.yongGua.name}（${data.yongGua.element}）`],
          ['动爻', `第${data.movingYao.position}爻`],
          [
            '月令',
            data.analysis.monthBranch ? `${data.analysis.monthBranch}月` : data.analysis.season,
          ],
        ]}
      />
      <div className="traditional-hexagram-triad">
        <MiniHexagram label="主卦·本" hexagram={data.mainHexagram} active />
        <MiniHexagram label="互卦·过程" hexagram={data.interHexagram} />
        <MiniHexagram label="变卦·结果" hexagram={data.changedHexagram} />
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
        {rows.map((yao) => (
          <div
            key={yao.position}
            className={yao.position === data.movingYao.position ? 'is-moving' : ''}
          >
            <span>{yao.position}爻</span>
            <YaoLine yaoType={yao.yaoType} changing={yao.isChanging} />
            <b>{yao.tiYong}</b>
          </div>
        ))}
      </div>
    </TraditionalBoardShell>
  );
}

function XiaoliurenTraditionalBoard({ data }: { data: XiaoliurenData }) {
  const positions = [
    { row: 1, column: 2 },
    { row: 1, column: 3 },
    { row: 2, column: 3 },
    { row: 3, column: 3 },
    { row: 3, column: 2 },
    { row: 3, column: 1 },
  ];
  return (
    <TraditionalBoardShell
      title="小六壬六宫盘"
      subtitle={`农历${data.isLeapMonth ? '闰' : ''}${data.lunarMonth}月${data.lunarDay}日 · ${data.hourLabel}`}
      className="traditional-xiaoliuren-board"
    >
      <TraditionalMeta
        items={[
          ['月宫', data.sequence.month.name],
          ['日宫', data.sequence.day.name],
          ['时宫', data.sequence.hour.name],
          ['占得', data.primary.name],
        ]}
      />
      <div className="traditional-six-palace" role="img" aria-label="小六壬六宫盘">
        {data.palaceOrder.map((palace, index) => {
          const position = positions[index] || positions[0];
          const sequenceLabels = [
            data.sequence.month.name,
            data.sequence.day.name,
            data.sequence.hour.name,
          ];
          const sequenceCount = sequenceLabels.filter((item) => item === palace.name).length;
          return (
            <div
              className={`traditional-six-palace-cell${palace.name === data.primary.name ? ' is-primary' : ''}`}
              style={{ gridColumn: position.column, gridRow: position.row }}
              key={palace.name}
            >
              <span>{palace.index + 1}</span>
              <strong>{palace.name}</strong>
              <small>{sequenceCount ? `月日时${sequenceCount}中` : palace.verse}</small>
            </div>
          );
        })}
        <div className="traditional-six-palace-center">
          <span>月 → 日 → 时</span>
          <strong>{data.primary.name}</strong>
        </div>
      </div>
    </TraditionalBoardShell>
  );
}

function JinkoujueTraditionalBoard({ data }: { data: JinkoujueData }) {
  const positions = [
    ['人元', data.positions.renYuan],
    ['贵神', data.positions.guiShen],
    ['将神', data.positions.jiangShen],
    ['地分', data.positions.diFen],
  ] as const;
  return (
    <TraditionalBoardShell
      title="金口诀四位盘"
      subtitle={`${data.ganzhi.day}日${data.ganzhi.hour}时 · 月将${data.monthLeader}加${data.divinationBranch}`}
      className="traditional-jinkoujue-board"
    >
      <TraditionalMeta
        items={[
          ['昼夜', data.dayNight],
          ['贵人', data.noblemanBranch],
          ['旬空', data.xunKong.join('、') || '无'],
          ['发用', data.yinYangUse.usePosition],
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
    </TraditionalBoardShell>
  );
}

function QimenTraditionalBoard({ data }: { data: QimenData }) {
  const palaceMap = new Map(data.jiuGongGe.map((item) => [item.gong, item]));
  const scopeLabel = { hour: '时家', day: '日家', month: '月家', year: '年家' }[data.scope];
  return (
    <TraditionalBoardShell
      title={`${scopeLabel}奇门九宫盘`}
      subtitle={`${data.isYangDun ? '阳遁' : '阴遁'}${data.juShu}局 · ${data.method === 'feipan' ? '飞盘' : '转盘'}${data.juMethod === 'zhirun' ? ' · 置闰' : ' · 拆补'}`}
      className="traditional-qimen-board"
    >
      <TraditionalMeta
        items={[
          ['值符', data.zhiFu],
          ['值使', data.zhiShi],
          ['节气', data.timeInfo.solarTerm],
          ['旬空', data.voidBranches?.join('、') || '无'],
          ['驿马', data.horseStar ? `${data.horseStar.branch}·${data.horseStar.name}` : '无'],
        ]}
      />
      <div className="traditional-qimen-grid" role="img" aria-label="奇门遁甲九宫盘">
        {QIMEN_LO_SHU_ORDER.map((gong) => {
          const palace = palaceMap.get(gong);
          if (!palace) return <div className="traditional-qimen-cell is-empty" key={gong} />;
          const isVoid = data.voidPalaces?.some((item) => item.palace === gong);
          const isHorse = data.horseStar?.palace === gong;
          const isZhiFu =
            palace.tianPan.star === data.zhiFu || palace.tianPan.companionStar === data.zhiFu;
          const isZhiShi = palace.renPan.door === data.zhiShi;
          return (
            <div
              className={`traditional-qimen-cell${gong === 5 ? ' is-center' : ''}${isVoid ? ' is-void' : ''}${isHorse ? ' is-horse' : ''}`}
              key={gong}
            >
              <div className="traditional-qimen-cell-head">
                <span>{palace.name}</span>
                <b>{palace.direction}</b>
              </div>
              <div className="traditional-qimen-god">{palace.shenPan.god}</div>
              <div className="traditional-qimen-star">
                {palace.tianPan.star}
                {isZhiFu ? ' · 值符' : ''}
              </div>
              <div className="traditional-qimen-door">
                {palace.renPan.door}
                {isZhiShi ? ' · 值使' : ''}
              </div>
              <div className="traditional-qimen-stems">
                <span>
                  天 {palace.tianPan.stem}
                  {palace.tianPan.companionStem ? `/${palace.tianPan.companionStem}` : ''}
                </span>
                <span>地 {palace.diPan.stem}</span>
              </div>
              {isVoid ? <em>空</em> : null}
              {isHorse ? <em>马</em> : null}
            </div>
          );
        })}
      </div>
    </TraditionalBoardShell>
  );
}

function getTarotSpreadClass(spreadType: string) {
  return `is-${spreadType.replace(/[^a-z0-9-]/gi, '-')}`;
}

function TarotTraditionalBoard({ data }: { data: TarotData }) {
  return (
    <TraditionalBoardShell
      title={data.spreadName}
      subtitle={`塔罗牌阵 · ${data.cards.length}张`}
      className="traditional-tarot-board"
    >
      <div className={`traditional-tarot-spread ${getTarotSpreadClass(data.spreadType)}`}>
        {data.cards.map((card, index) => (
          <article
            className={`traditional-tarot-card${card.reversed ? ' is-reversed' : ''}`}
            key={`${card.position}-${card.id}`}
          >
            <span className="traditional-card-index">{index + 1}</span>
            <span className="traditional-card-position">{card.position}</span>
            <strong>{card.name}</strong>
            <b>{card.reversed ? '逆位' : '正位'}</b>
            <small>{card.keywords.slice(0, 3).join(' · ')}</small>
          </article>
        ))}
      </div>
    </TraditionalBoardShell>
  );
}

function LenormandTraditionalBoard({ data }: { data: LenormandData }) {
  const hasCoordinates = data.cards.some((card) => card.row && card.column);
  const isGrandTableau = data.spreadType === 'grandTableau';
  return (
    <TraditionalBoardShell
      title={data.spreadName}
      subtitle={`雷诺曼牌阵 · ${data.cards.length}张${isGrandTableau ? ' · 大 Tableau 牌阵' : ''}`}
      className="traditional-lenormand-board"
    >
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
            <span>{card.position}</span>
            <strong>{card.id}</strong>
            <b>{card.name}</b>
            {card.house ? <small>宫：{card.house}</small> : null}
            <p>{card.keywords.slice(0, 2).join(' · ')}</p>
          </article>
        ))}
      </div>
      {data.combinations?.length ? (
        <div className="traditional-note-row">
          <b>组合牌义</b>
          <span>
            {data.combinations
              .slice(0, 3)
              .map((item) => `${item.card1}＋${item.card2}：${item.meaning}`)
              .join('；')}
          </span>
        </div>
      ) : null}
    </TraditionalBoardShell>
  );
}

function SsgwTraditionalBoard({ data }: { data: SsgwData }) {
  const poemLines = data.poem.split(/\s*[|\n]\s*/).filter(Boolean);
  return (
    <TraditionalBoardShell
      title={`第${data.number}签 · ${data.title}`}
      subtitle={`${data.ganzhi.day}日签`}
      className="traditional-ssgw-board"
    >
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

function AlmanacTraditionalBoard({ data }: { data: AlmanacData }) {
  return (
    <TraditionalBoardShell
      title={`${data.topicLabel}择日盘`}
      subtitle={`${data.startDate} 至 ${data.endDate}`}
      className="traditional-almanac-board"
    >
      <div className="traditional-almanac-grid" role="table" aria-label="黄历择日盘">
        {data.days.map((day) => (
          <article className="traditional-almanac-day" key={day.date}>
            <div className="traditional-almanac-day-head">
              <strong>{day.date.slice(5)}</strong>
              <span>{day.weekday}</span>
            </div>
            <b>
              {day.ganzhi.day}日 · {day.dayOfficer}
            </b>
            <span>
              {day.lunarDate} · {day.zodiac}年
            </span>
            <span>
              {day.twelveStar} · {day.twentyEightStar}
            </span>
            <div className="traditional-almanac-gods">
              {day.gods.slice(0, 3).map((god) => (
                <em key={god}>{god}</em>
              ))}
            </div>
            <div className="traditional-almanac-goodbad">
              <p>
                <b>宜</b>
                {day.recommends.slice(0, 3).join('、') || '未标注'}
              </p>
              <p>
                <b>忌</b>
                {day.avoids.slice(0, 3).join('、') || '未标注'}
              </p>
            </div>
            <small>{day.clash}</small>
          </article>
        ))}
      </div>
    </TraditionalBoardShell>
  );
}

function TaiyiTraditionalBoard({ data }: { data: TaiyiResult }) {
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

  return (
    <TraditionalBoardShell
      title={`太乙神数${scopeLabel}`}
      subtitle={`${data.ganZhi} · ${data.yinYang}第${data.bureau}局 · ${data.accumulatedLabel}${data.accumulatedValue}`}
      className="traditional-taiyi-board"
    >
      <TraditionalMeta
        items={[
          ['太乙', `${data.taiyiPosition} · 第${data.taiyiPalace}宫`],
          ['文昌', `${data.wenChangPosition} · 第${data.wenChangPalace}宫`],
          ['始击', `${data.shiJiPosition} · 第${data.shiJiPalace}宫`],
          ['计神', `${data.jiShenPosition} · 第${data.jiShenPalace}宫`],
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

function HuangjiTraditionalBoard({ data }: { data: HuangjiJingshiResult }) {
  const forecast = data.forecast;
  if (!forecast) return null;

  const { governing, yun, sixtyYear, decade, annual } = forecast.hexagrams;
  const related = [
    ['互卦', forecast.relatedHexagrams.mutual],
    ['错卦', forecast.relatedHexagrams.opposite],
    ['综卦', forecast.relatedHexagrams.reversed],
  ] as const;

  return (
    <TraditionalBoardShell
      title="皇极经世值年盘"
      subtitle={`${formatHuangjiCivilYear(annual.year)} · ${annual.ganzhi} · ${forecast.hui.branch}会`}
      className="traditional-huangji-board"
    >
      <TraditionalMeta
        items={[
          ['元', `第${data.position.yuan.indexFromEpoch + 1}元`],
          ['会', `第${forecast.hui.indexInYuan}会 · ${forecast.hui.branch}`],
          ['运', `会内第${data.position.yun.indexInHui}运`],
          ['世', `运内第${data.position.shi.indexInYun}世`],
          ['年位', `世内第${data.position.year.indexInShi}年`],
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
    </TraditionalBoardShell>
  );
}

export function TraditionalDivinationBoard({ session }: { session: DivinationSession }) {
  switch (session.method) {
    case 'liuyao':
      return <LiuyaoTraditionalBoard data={session.data as LiuyaoData} />;
    case 'meihua':
      return <MeihuaTraditionalBoard data={session.data as MeihuaData} />;
    case 'xiaoliuren':
      return <XiaoliurenTraditionalBoard data={session.data as XiaoliurenData} />;
    case 'jinkoujue':
      return <JinkoujueTraditionalBoard data={session.data as JinkoujueData} />;
    case 'qimen':
      return <QimenTraditionalBoard data={session.data as QimenData} />;
    case 'tarot':
      return <TarotTraditionalBoard data={session.data as TarotData} />;
    case 'ssgw':
      return <SsgwTraditionalBoard data={session.data as SsgwData} />;
    case 'almanac':
      return <AlmanacTraditionalBoard data={session.data as AlmanacData} />;
    case 'lenormand':
      return <LenormandTraditionalBoard data={session.data as LenormandData} />;
    case 'astrolabe':
      return (
        <TraditionalBoardShell
          title="本命星盘"
          subtitle="黄道十二宫 · 主要相位"
          className="traditional-astrolabe-board"
        >
          <AstrolabeChart data={session.data as AstrolabeData} />
        </TraditionalBoardShell>
      );
    case 'taiyi':
      return <TaiyiTraditionalBoard data={session.data as TaiyiResult} />;
    case 'huangji':
      return <HuangjiTraditionalBoard data={session.data as HuangjiJingshiResult} />;
    case 'liuren':
      return null;
    default:
      return null;
  }
}
