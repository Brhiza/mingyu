import type { PalaceFact } from '@/types/analysis';

type ChartStarTone = 'major' | 'minor' | 'other' | 'scope';

function getMutagenToneClass(mutagen: string): string {
  if (mutagen === '禄') return 'is-lu';
  if (mutagen === '权') return 'is-quan';
  if (mutagen === '科') return 'is-ke';
  return 'is-ji';
}

export function ChartStar(props: { star: PalaceFact['major_stars'][number]; tone: ChartStarTone }) {
  const { star, tone } = props;

  return (
    <span
      className={`chart-star chart-star-${tone} ${
        star.birth_mutagen ? 'has-birth-mutagen' : ''
      } ${star.active_scope_mutagen ? 'has-active-mutagen' : ''}`}
    >
      <span className="chart-star-name">{star.name}</span>
      {star.brightness ? (
        <span className="chart-star-brightness" aria-label={`亮度${star.brightness}`}>
          {star.brightness}
        </span>
      ) : null}
      {star.birth_mutagen ? (
        <span
          className={`chart-star-mark chart-star-mark-birth ${getMutagenToneClass(star.birth_mutagen)}`}
          aria-label={`生年四化${star.birth_mutagen}`}
        >
          {star.birth_mutagen}
        </span>
      ) : null}
      {star.horoscope_mutagen ? (
        <span
          className={`chart-star-mark chart-star-mark-horoscope ${getMutagenToneClass(star.horoscope_mutagen)}`}
          aria-label={`运限星曜四化${star.horoscope_mutagen}`}
        >
          {star.horoscope_mutagen}
        </span>
      ) : null}
      {star.active_scope_mutagen ? (
        <span
          className={`chart-star-mark chart-star-mark-active ${getMutagenToneClass(star.active_scope_mutagen)}`}
          aria-label={`当前时限四化${star.active_scope_mutagen}`}
        >
          {star.active_scope_mutagen}
        </span>
      ) : null}
    </span>
  );
}

export function ChartStarLine(props: {
  stars: PalaceFact['major_stars'];
  tone: ChartStarTone;
  fallback?: string;
  limit?: number;
  layout?: 'wrap' | 'column';
}) {
  const stars = props.limit ? props.stars.slice(0, props.limit) : props.stars;
  const layoutClassName = props.layout === 'column' ? 'is-column' : 'is-wrap';

  if (stars.length === 0) {
    return props.fallback ? (
      <div className={`chart-cell-stars chart-cell-stars-${props.tone} ${layoutClassName}`}>
        <span className="chart-star-empty">{props.fallback}</span>
      </div>
    ) : null;
  }

  return (
    <div className={`chart-cell-stars chart-cell-stars-${props.tone} ${layoutClassName}`}>
      {stars.map((star, index) => (
        <ChartStar
          key={`${props.tone}-${star.name}-${star.birth_mutagen ?? 'n'}-${star.horoscope_mutagen ?? 'n'}-${star.active_scope_mutagen ?? 'n'}-${index}`}
          star={star}
          tone={props.tone}
        />
      ))}
    </div>
  );
}
