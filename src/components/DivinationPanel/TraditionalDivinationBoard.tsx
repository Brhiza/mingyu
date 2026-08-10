import type { ReactNode } from 'react';
import { AstrolabeChart } from '@/components/AstrolabeChart';
import type { DivinationSession } from '@/lib/divination/engine';
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
const TAIYI_LO_SHU_ORDER = QIMEN_LO_SHU_ORDER;

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
          <span className="traditional-board-kicker">传统盘</span>
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

  return (
    <TraditionalBoardShell
      title={`${data.originalName}${data.changedName ? ` · 变${data.changedName}` : ''}`}
      subtitle="纳甲六爻盘 · 上爻在上，初爻在下"
      className="traditional-liuyao-board"
    >
      <TraditionalMeta
        items={[
          ['卦宫', data.palace?.name ? `${data.palace.name}宫` : undefined],
          ['卦序', data.palaceStage],
          ['互卦', data.interName || '无'],
          ['动爻', changing?.length ? changing.join('、') : '无'],
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
          <span>状态</span>
        </div>
        {rows.map((yao) => {
          const state = [
            yao.isWorld ? '世' : '',
            yao.isResponse ? '应' : '',
            yao.isVoid ? '空' : '',
            yao.isMonthBreak ? '月破' : '',
            yao.isHiddenMove
              ? '暗动'
              : yao.isDayBreak
                ? '日破'
                : yao.isChanging && yao.isDayClash
                  ? '日辰冲动'
                  : '',
          ].filter(Boolean);
          const relation = yao.changeRelations?.join('、') || yao.changeRelation || '';
          return (
            <div className="traditional-liuyao-row" role="row" key={yao.position}>
              <span className="traditional-yao-position">
                {yao.position === 1 ? '初爻' : `${yao.position}爻`}
              </span>
              <span>{yao.sixGod || '—'}</span>
              <span>{yao.sixRelative || '—'}</span>
              <YaoLine yaoType={yao.yaoType} changing={yao.isChanging} />
              <span>
                {yao.najiaDizhi || '—'}
                <small>{yao.wuxing || ''}</small>
              </span>
              <span className="traditional-yao-status">
                {state.length ? state.join(' · ') : '—'}
                {relation ? <small>{relation}</small> : null}
                {yao.changedYao ? (
                  <small>
                    化{yao.changedYao.dizhi}
                    {yao.changedYao.wuxing}
                  </small>
                ) : null}
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
                (item) => `${item.sixRelative}伏${item.position}爻${item.najiaDizhi}${item.wuxing}`,
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
      subtitle="梅花易数三卦体用盘 · 主卦为本，互卦为过程，变卦为结果"
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
  return (
    <TraditionalBoardShell
      title="奇门遁甲九宫盘"
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
      subtitle={`塔罗牌阵 · ${data.cards.length}张 · 牌位按传统顺序展开`}
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
      subtitle={`${data.ganzhi.day}日签 · 传统签谱盘面`}
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
      subtitle={`${data.startDate} 至 ${data.endDate} · 以候选日干支、建除、星宿和宜忌并列展示`}
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
  const markers = new Map<number, string[]>();
  const addMarker = (palace: number, label: string) => {
    const current = markers.get(palace) || [];
    markers.set(palace, [...current, label]);
  };
  addMarker(data.taiyiPalace, '太乙');
  addMarker(data.wenChangPalace, '文昌');
  addMarker(data.shiJiPalace, '始击');
  addMarker(data.jiShenPalace, '计神');
  return (
    <TraditionalBoardShell
      title={`太乙神数${data.scope === 'year' ? '年计' : data.scope}`}
      subtitle={`${data.ganZhi} · ${data.yinYang}第${data.bureau}局 · ${data.accumulatedLabel}${data.accumulatedValue}`}
      className="traditional-taiyi-board"
    >
      <TraditionalMeta
        items={[
          ['太乙', data.taiyiPosition],
          ['文昌', data.wenChangPosition],
          ['始击', data.shiJiPosition],
          ['主算', data.lordCount],
          ['客算', data.guestCount],
          ['定算', data.setCount],
        ]}
      />
      <div className="traditional-taiyi-grid" role="img" aria-label="太乙神数九宫盘">
        {TAIYI_LO_SHU_ORDER.map((palace) => (
          <div className={`traditional-taiyi-cell${palace === 5 ? ' is-center' : ''}`} key={palace}>
            <span>{palace}宫</span>
            <strong>{markers.get(palace)?.join(' · ') || '—'}</strong>
            {palace === data.taiyiPalace ? (
              <small>
                {data.taiyiGua} · {data.taiyiDir}
              </small>
            ) : null}
          </div>
        ))}
      </div>
      <div className="traditional-sixteen-gods">
        {data.sixteenGods.map((item) => (
          <span key={`${item.branch}-${item.god}`}>
            <b>{item.branch}</b>
            {item.god}
          </span>
        ))}
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
          subtitle="黄道十二宫与主要相位盘面"
          className="traditional-astrolabe-board"
        >
          <AstrolabeChart data={session.data as AstrolabeData} />
        </TraditionalBoardShell>
      );
    case 'taiyi':
      return <TaiyiTraditionalBoard data={session.data as TaiyiResult} />;
    case 'liuren':
      return null;
    default:
      return null;
  }
}
