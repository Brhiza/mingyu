import { useMemo, useState } from 'react';
import {
  queryHuangjiReference,
  type HuangjiAnimalPlantReference,
  type HuangjiHistoricalEraReference,
  type HuangjiReferenceResult,
  type HuangjiReferenceSource,
  type HuangjiReferenceTableId,
  type HuangjiSoundRhythmReference,
} from 'mingyu-core/huangji-jingshi';

const MIN_SHI_INDEX = 2149;
const MAX_SHI_INDEX = 2208;

const TABLE_OPTIONS: readonly {
  value: HuangjiReferenceTableId;
  label: string;
}[] = [
  { value: 'sound-rhythm', label: '声音律吕' },
  { value: 'animal-plant', label: '动植物数' },
  { value: 'historical-era', label: '经辰历史纪年原表' },
];

function parseShiIndex(value: string) {
  if (!/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function ReferenceSources({ sources }: { sources: readonly HuangjiReferenceSource[] }) {
  return (
    <div className="traditional-huangji-reference-sources">
      <span>底本：</span>
      {sources.map((source) => (
        <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
          {source.title}（{source.edition}，修订{source.revision}）
        </a>
      ))}
    </div>
  );
}

function ReferenceNotes({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <section className="traditional-huangji-reference-notes">
      <h4>{title}</h4>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function SoundRhythmReference({ reference }: { reference: HuangjiSoundRhythmReference }) {
  return (
    <>
      <ReferenceSources sources={reference.source} />
      <div className="traditional-huangji-reference-grid" aria-label="声音律吕数目">
        <div>
          <dt>天之体数</dt>
          <dd>{reference.bodyCounts.heavenlyBody}</dd>
        </div>
        <div>
          <dt>地之体数</dt>
          <dd>{reference.bodyCounts.earthlyBody}</dd>
        </div>
        <div>
          <dt>天之用声数</dt>
          <dd>{reference.bodyCounts.heavenlyUseSound}</dd>
        </div>
        <div>
          <dt>地之用音数</dt>
          <dd>{reference.bodyCounts.earthlyUseTone}</dd>
        </div>
      </div>
      <div className="traditional-huangji-reference-facts">
        <p>
          <strong>声类：</strong>
          {reference.soundCategories.join('、')}
        </p>
        <p>
          <strong>音类：</strong>
          {reference.toneCategories.join('、')}
        </p>
      </div>
      <div className="traditional-huangji-reference-table-wrap">
        <table className="traditional-huangji-reference-table">
          <caption>四象声音关系</caption>
          <thead>
            <tr>
              <th scope="col">取象</th>
              <th scope="col">声</th>
              <th scope="col">音</th>
              <th scope="col">五行</th>
            </tr>
          </thead>
          <tbody>
            {reference.pairings.map((pairing) => (
              <tr key={pairing.image}>
                <th scope="row">{pairing.image}</th>
                <td>{pairing.sound}</td>
                <td>{pairing.tone}</td>
                <td>{pairing.element}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ReferenceNotes title="取用规则" items={reference.rules} />
      <ReferenceNotes title="底本说明" items={reference.limitations} />
    </>
  );
}

function AnimalPlantReference({ reference }: { reference: HuangjiAnimalPlantReference }) {
  return (
    <>
      <ReferenceSources sources={reference.source} />
      <div className="traditional-huangji-reference-table-wrap">
        <table className="traditional-huangji-reference-table">
          <caption>动植物数目</caption>
          <thead>
            <tr>
              <th scope="col">项目</th>
              <th scope="col">数目</th>
              <th scope="col">取数</th>
            </tr>
          </thead>
          <tbody>
            {reference.counts.map((count) => (
              <tr key={count.name}>
                <th scope="row">{count.name}</th>
                <td>{count.value.toLocaleString('zh-CN')}</td>
                <td>{count.formula}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ReferenceNotes title="底本说明" items={reference.limitations} />
    </>
  );
}

function HistoricalEraReference({ reference }: { reference: HuangjiHistoricalEraReference }) {
  return (
    <>
      <ReferenceSources sources={[reference.source]} />
      <div className="traditional-huangji-reference-grid" aria-label="经辰区块信息">
        <div>
          <dt>经辰序号</dt>
          <dd>{reference.shiIndex}</dd>
        </div>
        <div>
          <dt>原表地支</dt>
          <dd>{reference.sourceBranch}</dd>
        </div>
        <div>
          <dt>经辰地支</dt>
          <dd>{reference.branch}</dd>
        </div>
      </div>
      {reference.sourceBranchNote ? (
        <p className="traditional-huangji-reference-note">{reference.sourceBranchNote}</p>
      ) : null}
      <div className="traditional-huangji-reference-table-wrap">
        <table className="traditional-huangji-reference-table">
          <caption>三十年甲子序列</caption>
          <thead>
            <tr>
              <th scope="col">序</th>
              <th scope="col">干支</th>
              <th scope="col">原表标记</th>
            </tr>
          </thead>
          <tbody>
            {reference.rows.map((row) => (
              <tr key={`${row.rowIndex}-${row.ganzhi}`}>
                <th scope="row">{row.rowIndex}</th>
                <td>{row.ganzhi}</td>
                <td>{row.historicalLabel ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {reference.namedEntries.length ? (
        <div className="traditional-huangji-reference-events">
          <h4>原表纪年标记</h4>
          <ul>
            {reference.namedEntries.map((entry) => (
              <li key={`${entry.rowIndex}-${entry.ganzhi}-${entry.label}`}>
                第{entry.rowIndex}年 {entry.ganzhi} · {entry.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <ReferenceNotes title="底本说明" items={reference.limitations} />
    </>
  );
}

function ReferenceResultView({ result }: { result: HuangjiReferenceResult }) {
  switch (result.table) {
    case 'sound-rhythm':
      return <SoundRhythmReference reference={result} />;
    case 'animal-plant':
      return <AnimalPlantReference reference={result} />;
    case 'historical-era':
      return <HistoricalEraReference reference={result} />;
  }
}

export interface HuangjiReferenceTableProps {
  initialTable?: HuangjiReferenceTableId;
  initialShiIndex?: number;
}

export function HuangjiReferenceTable({
  initialTable = 'sound-rhythm',
  initialShiIndex,
}: HuangjiReferenceTableProps = {}) {
  const [table, setTable] = useState<HuangjiReferenceTableId>(initialTable);
  const [shiIndexText, setShiIndexText] = useState(
    initialShiIndex === undefined ? '' : String(initialShiIndex),
  );
  const shiIndex = parseShiIndex(shiIndexText);
  const validHistoricalIndex =
    shiIndex !== undefined && shiIndex >= MIN_SHI_INDEX && shiIndex <= MAX_SHI_INDEX;
  const result = useMemo(() => {
    if (table === 'historical-era') {
      if (!validHistoricalIndex || shiIndex === undefined) return undefined;
      return queryHuangjiReference({ table, shiIndex });
    }
    return queryHuangjiReference({ table });
  }, [shiIndex, table, validHistoricalIndex]);

  return (
    <details className="traditional-classic-card traditional-huangji-reference-card" open>
      <summary className="traditional-classic-head">
        <div>
          <span className="traditional-classic-badge">皇极经世</span>
          <strong>皇极资料表</strong>
        </div>
        <span className="traditional-classic-toggle">展开或收起资料</span>
      </summary>
      <div className="traditional-classic-body traditional-huangji-reference-body">
        <div className="traditional-huangji-reference-controls">
          <label>
            <span>选择资料</span>
            <select
              value={table}
              onChange={(event) => setTable(event.target.value as HuangjiReferenceTableId)}
            >
              {TABLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {table === 'historical-era' ? (
            <label>
              <span>经辰序号</span>
              <input
                type="number"
                min={MIN_SHI_INDEX}
                max={MAX_SHI_INDEX}
                step={1}
                inputMode="numeric"
                value={shiIndexText}
                onChange={(event) => setShiIndexText(event.target.value)}
                aria-describedby="huangji-reference-shi-index-help"
              />
              <small id="huangji-reference-shi-index-help">请输入2149—2208之间的整数</small>
            </label>
          ) : null}
        </div>
        {table === 'historical-era' && !validHistoricalIndex ? (
          <p className="traditional-huangji-reference-validation" role="alert">
            请输入2149—2208之间的整数后查询经辰历史纪年原表。
          </p>
        ) : result ? (
          <div className="traditional-huangji-reference-result">
            <h4>{result.title}</h4>
            <ReferenceResultView result={result} />
          </div>
        ) : null}
      </div>
    </details>
  );
}
