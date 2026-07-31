import { memo } from 'react';
import type { QizhengResult, QizhengStar } from '@core/qi_zheng';

const EARTHLY_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const STAR_STYLES: Array<{ match: string; symbol: string; color: string }> = [
  { match: '太阳', symbol: '日', color: '#d97706' },
  { match: '太阴', symbol: '月', color: '#64748b' },
  { match: '岁星', symbol: '木', color: '#15803d' },
  { match: '荧惑', symbol: '火', color: '#dc2626' },
  { match: '镇星', symbol: '土', color: '#a16207' },
  { match: '太白', symbol: '金', color: '#ca8a04' },
  { match: '辰星', symbol: '水', color: '#2563eb' },
  { match: '罗睺', symbol: '罗', color: '#7c3aed' },
  { match: '计都', symbol: '计', color: '#9333ea' },
  { match: '月孛', symbol: '孛', color: '#db2777' },
  { match: '紫炁', symbol: '炁', color: '#0891b2' },
];

function getStarStyle(name: string) {
  return (
    STAR_STYLES.find((item) => name.startsWith(item.match)) ?? {
      match: name,
      symbol: name.slice(0, 1),
      color: '#475569',
    }
  );
}

function polarPoint(longitude: number, radius: number) {
  const angle = ((longitude - 90) * Math.PI) / 180;
  return { x: 200 + Math.cos(angle) * radius, y: 200 + Math.sin(angle) * radius };
}

function starPoint(star: QizhengStar) {
  return polarPoint(star.longitude, star.kind === '七政' ? 132 : 105);
}

function QizhengChart({ data }: { data: QizhengResult }) {
  const palaceBySign = new Map(data.twelvePalaces.map((item) => [item.signIndex, item.palace]));
  return (
    <svg
      className="qizheng-chart-svg"
      viewBox="0 0 400 400"
      role="img"
      aria-label="七政四余十二宫圆盘"
    >
      <circle cx="200" cy="200" r="184" className="qizheng-ring" />
      <circle cx="200" cy="200" r="148" className="qizheng-ring" />
      <circle cx="200" cy="200" r="78" className="qizheng-ring qizheng-ring-core" />
      {EARTHLY_BRANCHES.map((branch, index) => {
        const line = polarPoint(index * 30, 184);
        const inner = polarPoint(index * 30, 78);
        const label = polarPoint(index * 30 + 15, 166);
        return (
          <g key={branch}>
            <line
              x1={inner.x}
              y1={inner.y}
              x2={line.x}
              y2={line.y}
              className="qizheng-sector-line"
            />
            <text x={label.x} y={label.y} className="qizheng-palace-label">
              <tspan>{branch}</tspan>
              <tspan x={label.x} dy="11">
                {palaceBySign.get(index)}
              </tspan>
            </text>
          </g>
        );
      })}
      {data.stars.map((star) => {
        const point = starPoint(star);
        return (
          <g key={star.name} transform={`translate(${point.x} ${point.y})`}>
            <circle
              r={star.kind === '七政' ? 13 : 12}
              fill={getStarStyle(star.name).color}
              className="qizheng-star-dot"
            />
            <text className="qizheng-star-label">{getStarStyle(star.name).symbol}</text>
            {star.retrograde ? (
              <text y="22" className="qizheng-retrograde-label">
                逆
              </text>
            ) : null}
          </g>
        );
      })}
      <text x="200" y="184" className="qizheng-core-title">
        命宫 {EARTHLY_BRANCHES[data.mingGong]}
      </text>
      <text x="200" y="202" className="qizheng-core-title">
        身宫 {EARTHLY_BRANCHES[data.shenGong]}
      </text>
      <text x="200" y="220" className="qizheng-core-subtitle">
        命主 {data.mingZhu}
      </text>
    </svg>
  );
}

export const QizhengBoard = memo(function QizhengBoard({
  title,
  name,
  data,
}: {
  title: string;
  name: string;
  data: QizhengResult;
}) {
  const ziqiStar = data.stars.find((star) => star.name.startsWith('紫炁'));
  return (
    <section className="result-showcase-card qizheng-showcase-card">
      <div className="result-showcase-head">
        <div>
          <p className="result-section-kicker">{title}</p>
          <h2>{name}</h2>
        </div>
        <div className="result-chip-row">
          <span className="result-chip">七政四余 {data.stars.length} 星</span>
          <span className="result-chip">星对夹角 {data.pairwiseAngles.length} 组</span>
        </div>
      </div>
      <div className="result-summary-grid">
        <div className="result-stat-card result-stat-card-accent">
          <span>命宫</span>
          <strong>{EARTHLY_BRANCHES[data.mingGong]}宫</strong>
          <small>
            {data.twelvePalaces.find((item) => item.signIndex === data.mingGong)?.palace}
          </small>
        </div>
        <div className="result-stat-card">
          <span>身宫</span>
          <strong>{EARTHLY_BRANCHES[data.shenGong]}宫</strong>
          <small>
            {data.twelvePalaces.find((item) => item.signIndex === data.shenGong)?.palace}
          </small>
        </div>
        <div className="result-stat-card">
          <span>命主</span>
          <strong>{data.mingZhu}</strong>
          <small>按命宫十二支取主星</small>
        </div>
        <div className="result-stat-card">
          <span>紫炁</span>
          <strong>{ziqiStar ? `${ziqiStar.xiu}${ziqiStar.xiuDegree.toFixed(2)}°` : '—'}</strong>
          <small>周期进度 {(data.ziqi.cycleProgress * 100).toFixed(1)}%</small>
        </div>
      </div>
      <div className="astrolabe-board-layout">
        <div className="astrolabe-board-main">
          <div className="result-side-card astrolabe-chart-shell">
            <div className="result-side-head">
              <h3>十二宫星盘</h3>
              <p>外圈为十二支宫位，星体位置按目标日期黄经标注。</p>
            </div>
            <QizhengChart data={data} />
          </div>
        </div>
        <div className="astrolabe-board-side">
          <div className="result-side-card">
            <div className="result-side-head">
              <h3>星曜落点</h3>
            </div>
            <div className="qizheng-star-list">
              {data.stars.map((star) => (
                <div className="qizheng-star-item" key={star.name}>
                  <span
                    className="qizheng-star-name"
                    style={{ color: getStarStyle(star.name).color }}
                  >
                    {star.name}
                  </span>
                  <strong>
                    {star.palace} · {star.xiu}
                    {star.xiuDegree.toFixed(2)}°
                  </strong>
                  <small>
                    {star.kind}
                    {star.retrograde ? ' · 逆行' : ' · 顺行'}
                  </small>
                </div>
              ))}
            </div>
          </div>
          <div className="result-side-card">
            <div className="result-side-head">
              <h3>星对实际夹角</h3>
              <p>十一星共 55 组无序星对，按稳定星序完整列出。</p>
            </div>
            <details>
              <summary>查看全部 {data.pairwiseAngles.length} 组</summary>
              <div className="astrolabe-aspect-list">
                {data.pairwiseAngles.map((pair) => (
                  <div className="astrolabe-aspect-item" key={`${pair.star1}-${pair.star2}`}>
                    <strong>
                      {pair.star1}－{pair.star2}
                    </strong>
                    <span>
                      实际最小夹角 {pair.actualAngle.toFixed(2)}° · {pair.precisionClass}
                    </span>
                  </div>
                ))}
              </div>
            </details>
            <div className="result-meta-lines">
              <div>
                <span>庙旺</span>
                <strong>{data.traditionalRuleAudit.dignity.status}</strong>
              </div>
              <div>
                <span>吊照</span>
                <strong>{data.traditionalRuleAudit.aspects.status}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="qizheng-detail-grid">
        <div className="result-side-card">
          <div className="result-side-head">
            <h3>传统神煞起例</h3>
            <p>只列《张果星宗》目标支，不代表已经落入具体宫位或形成吉凶。</p>
          </div>
          <div className="result-tag-cloud">
            {data.shenshaFacts.map((item) => (
              <span className="result-soft-tag" key={item.id}>
                {item.name} · 生{item.basis}
                {item.basisValue} → {item.targetBranch}
              </span>
            ))}
          </div>
          {data.shenshaFacts.length === 0 ? (
            <p>农历年干支与立春年柱存在分歧，当前没有替你自动选择年界口径。</p>
          ) : null}
        </div>
        <div className="result-side-card">
          <div className="result-side-head">
            <h3>紫炁位置</h3>
          </div>
          <div className="result-meta-lines">
            <div>
              <span>恒星黄经</span>
              <strong>{data.ziqi.siderealLongitude.toFixed(4)}°</strong>
            </div>
            <div>
              <span>回归黄经</span>
              <strong>{data.ziqi.tropicalLongitude.toFixed(4)}°</strong>
            </div>
            <div>
              <span>运行方向</span>
              <strong>{data.ziqi.direction}</strong>
            </div>
            <div>
              <span>一周周期</span>
              <strong>{data.ziqiModel.periodDays.toFixed(4)} 日</strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});
