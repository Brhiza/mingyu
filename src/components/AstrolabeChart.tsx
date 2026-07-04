import type { AstrolabeData } from '@/types/divination';

function toChartPoint(longitude: number, radius: number) {
  const angle = ((longitude - 90) * Math.PI) / 180;
  return {
    x: 150 + Math.cos(angle) * radius,
    y: 150 + Math.sin(angle) * radius,
  };
}

export function AstrolabeChart({
  data,
  showHeader = true,
}: {
  data: AstrolabeData;
  showHeader?: boolean;
}) {
  const majorPlanetNames = new Set([
    'Sun',
    'Moon',
    'Mercury',
    'Venus',
    'Mars',
    'Jupiter',
    'Saturn',
    'Uranus',
    'Neptune',
    'Pluto',
  ]);
  const visiblePlanets = data.planets.filter((planet) => majorPlanetNames.has(planet.name));
  const zodiacSigns = [
    '白羊',
    '金牛',
    '双子',
    '巨蟹',
    '狮子',
    '处女',
    '天秤',
    '天蝎',
    '射手',
    '摩羯',
    '水瓶',
    '双鱼',
  ];

  return (
    <div className="astrolabe-chart-panel">
      {showHeader ? (
        <div className="astrolabe-chart-head">
          <strong>星盘图</strong>
          <span>{data.birth.dateTime}</span>
        </div>
      ) : null}
      <svg className="astrolabe-chart-svg" viewBox="0 0 300 300" role="img" aria-label="星盘图">
        <circle cx="150" cy="150" r="132" className="astrolabe-ring-outer" />
        <circle cx="150" cy="150" r="104" className="astrolabe-ring-inner" />
        <circle cx="150" cy="150" r="58" className="astrolabe-ring-core" />
        {Array.from({ length: 12 }, (_, index) => {
          const start = toChartPoint(index * 30, 58);
          const end = toChartPoint(index * 30, 132);
          const label = toChartPoint(index * 30 + 15, 118);
          return (
            <g key={zodiacSigns[index]}>
              <line
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                className="astrolabe-zodiac-line"
              />
              <text x={label.x} y={label.y} className="astrolabe-zodiac-label">
                {zodiacSigns[index]}
              </text>
            </g>
          );
        })}
        {data.houses.map((house) => {
          const start = toChartPoint(house.longitude, 58);
          const end = toChartPoint(house.longitude, 104);
          return (
            <line
              key={house.label}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              className="astrolabe-house-line"
            />
          );
        })}
        {data.aspects.slice(0, 10).map((aspect, index) => {
          const body1 = data.planets.find((planet) => planet.label === aspect.body1);
          const body2 = data.planets.find((planet) => planet.label === aspect.body2);
          if (!body1 || !body2) {
            return null;
          }
          const p1 = toChartPoint(body1.longitude, 58);
          const p2 = toChartPoint(body2.longitude, 58);
          return (
            <line
              key={`${aspect.body1}-${aspect.body2}-${index}`}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              className={
                aspect.type === '刑相' || aspect.type === '冲相'
                  ? 'astrolabe-aspect-line is-tense'
                  : 'astrolabe-aspect-line'
              }
            />
          );
        })}
        {visiblePlanets.map((planet) => {
          const point = toChartPoint(planet.longitude, 78);
          return (
            <g key={planet.name}>
              <circle cx={point.x} cy={point.y} r="8" className="astrolabe-planet-dot" />
              <text x={point.x} y={point.y + 3} className="astrolabe-planet-label">
                {planet.label.slice(0, 1)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
