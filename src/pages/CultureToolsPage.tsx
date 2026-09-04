import { useState, type FormEvent } from 'react';
import {
  analyzeChineseCharacters,
  analyzeChineseName,
  analyzeNumber,
  calculateZhugeNumber,
  castKongmingHexagram,
  generateChineseNames,
  selectChineseCharacters,
  type NamingGender,
  type Wuxing,
} from 'mingyu-core/name-number';

type ToolId = 'naming' | 'name' | 'hanzi' | 'number' | 'zhuge' | 'kongming';
const tools: Array<{ id: ToolId; label: string; mark: string }> = [
  { id: 'naming', label: '起名', mark: '名' },
  { id: 'name', label: '姓名解析', mark: '姓' },
  { id: 'hanzi', label: '汉字与选字', mark: '字' },
  { id: 'number', label: '数字解析', mark: '数' },
  { id: 'zhuge', label: '诸葛神数', mark: '诸' },
  { id: 'kongming', label: '孔明神卦', mark: '孔' },
];
const wuxingOptions: Array<'' | Wuxing> = ['', '金', '木', '水', '火', '土'];
const gridLabels: Record<string, string> = {
  tian: '天格',
  ren: '人格',
  di: '地格',
  wai: '外格',
  zong: '总格',
};

export function CultureToolsPage() {
  const [activeTool, setActiveTool] = useState<ToolId>('naming');
  const [error, setError] = useState('');
  const [surname, setSurname] = useState('李');
  const [gender, setGender] = useState<NamingGender>('通用');
  const [preferredElement, setPreferredElement] = useState<'' | Wuxing>('');
  const [nameCandidates, setNameCandidates] = useState<ReturnType<typeof generateChineseNames>>([]);
  const [fullName, setFullName] = useState('李清和');
  const [surnameLength, setSurnameLength] = useState<1 | 2>(1);
  const [nameResult, setNameResult] = useState<ReturnType<typeof analyzeChineseName> | null>(null);
  const [hanziText, setHanziText] = useState('清和');
  const [hanziResult, setHanziResult] = useState<ReturnType<
    typeof analyzeChineseCharacters
  > | null>(null);
  const [selectStrokes, setSelectStrokes] = useState('');
  const [selectElement, setSelectElement] = useState<'' | Wuxing>('');
  const [selectedChars, setSelectedChars] = useState<ReturnType<typeof selectChineseCharacters>>(
    [],
  );
  const [numberText, setNumberText] = useState('13800138000');
  const [numberPurpose, setNumberPurpose] = useState<'phone' | 'plate' | 'general'>('phone');
  const [numberResult, setNumberResult] = useState<ReturnType<typeof analyzeNumber> | null>(null);
  const [zhugeText, setZhugeText] = useState('顺其然');
  const [zhugeResult, setZhugeResult] = useState<ReturnType<typeof calculateZhugeNumber> | null>(
    null,
  );
  const [coins, setCoins] = useState<Array<'●' | '○'>>(['●', '○', '●', '○', '○']);
  const [kongmingResult, setKongmingResult] = useState<ReturnType<
    typeof castKongmingHexagram
  > | null>(null);

  function run(event: FormEvent, action: () => void) {
    event.preventDefault();
    setError('');
    try {
      action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '暂时无法完成，请检查输入');
    }
  }

  return (
    <div className="culture-tools-page">
      <header className="culture-tools-heading">
        <div>
          <span className="culture-tools-eyebrow">文字与数理</span>
          <h1>{tools.find((item) => item.id === activeTool)?.label}</h1>
          <p>按明确的字典与数理口径计算，结果适合用来筛选和比较。</p>
        </div>
      </header>

      <nav className="culture-tools-tabs" aria-label="文字与数理工具">
        {tools.map((tool) => (
          <button
            key={tool.id}
            type="button"
            className={activeTool === tool.id ? 'is-active' : ''}
            onClick={() => {
              setActiveTool(tool.id);
              setError('');
            }}
          >
            <span>{tool.mark}</span>
            {tool.label}
          </button>
        ))}
      </nav>

      {error ? <div className="culture-tools-error">{error}</div> : null}

      {activeTool === 'naming' ? (
        <section className="culture-tools-panel">
          <form
            onSubmit={(event) =>
              run(event, () =>
                setNameCandidates(
                  generateChineseNames({
                    surname,
                    gender,
                    preferredElements: preferredElement ? [preferredElement] : undefined,
                    limit: 24,
                  }),
                ),
              )
            }
          >
            <div className="culture-tools-fields">
              <label>
                姓氏
                <input
                  value={surname}
                  maxLength={2}
                  onChange={(event) => setSurname(event.target.value)}
                />
              </label>
              <label>
                取向
                <select
                  value={gender}
                  onChange={(event) => setGender(event.target.value as NamingGender)}
                >
                  <option>通用</option>
                  <option>男</option>
                  <option>女</option>
                </select>
              </label>
              <label>
                偏好五行
                <select
                  value={preferredElement}
                  onChange={(event) => setPreferredElement(event.target.value as '' | Wuxing)}
                >
                  {wuxingOptions.map((item) => (
                    <option key={item || 'all'} value={item}>
                      {item || '不限'}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button className="culture-tools-primary" type="submit">
              生成候选名
            </button>
          </form>
          {nameCandidates.length ? (
            <div className="culture-name-grid">
              {nameCandidates.map((candidate) => (
                <button
                  key={candidate.fullName}
                  type="button"
                  onClick={() => {
                    setFullName(candidate.fullName);
                    setSurnameLength([...surname].length as 1 | 2);
                    setNameResult(candidate.score);
                    setActiveTool('name');
                  }}
                >
                  <strong>{candidate.fullName}</strong>
                  <span>综合 {candidate.score.scores.total}</span>
                  <small>
                    {candidate.score.sancai.combo} · {candidate.score.sancai.level}
                  </small>
                </button>
              ))}
            </div>
          ) : (
            <Empty text="填写姓氏后生成候选名，可点开任一名字查看完整结构。" />
          )}
        </section>
      ) : null}

      {activeTool === 'name' ? (
        <section className="culture-tools-panel">
          <form
            onSubmit={(event) =>
              run(event, () =>
                setNameResult(
                  analyzeChineseName({
                    fullName,
                    surnameLength,
                    xiYong: preferredElement ? [preferredElement] : undefined,
                  }),
                ),
              )
            }
          >
            <div className="culture-tools-fields">
              <label>
                完整姓名
                <input
                  value={fullName}
                  maxLength={4}
                  onChange={(event) => setFullName(event.target.value)}
                />
              </label>
              <label>
                姓氏字数
                <select
                  value={surnameLength}
                  onChange={(event) => setSurnameLength(Number(event.target.value) as 1 | 2)}
                >
                  <option value="1">单姓</option>
                  <option value="2">复姓</option>
                </select>
              </label>
              <label>
                喜用五行
                <select
                  value={preferredElement}
                  onChange={(event) => setPreferredElement(event.target.value as '' | Wuxing)}
                >
                  {wuxingOptions.map((item) => (
                    <option key={item || 'all'} value={item}>
                      {item || '暂不指定'}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button className="culture-tools-primary" type="submit">
              解析姓名
            </button>
          </form>
          {nameResult ? (
            <NameReport result={nameResult} />
          ) : (
            <Empty text="解析康熙笔画、五格、三才、字义与五行。" />
          )}
        </section>
      ) : null}

      {activeTool === 'hanzi' ? (
        <section className="culture-tools-panel culture-tools-split">
          <div>
            <h2>汉字解析</h2>
            <form
              onSubmit={(event) =>
                run(event, () => setHanziResult(analyzeChineseCharacters(hanziText)))
              }
            >
              <label>
                汉字
                <input
                  value={hanziText}
                  maxLength={20}
                  onChange={(event) => setHanziText(event.target.value)}
                />
              </label>
              <button className="culture-tools-primary" type="submit">
                查字
              </button>
            </form>
            {hanziResult ? <CharacterCards items={hanziResult.characters} /> : null}
          </div>
          <div>
            <h2>选字</h2>
            <form
              onSubmit={(event) =>
                run(event, () =>
                  setSelectedChars(
                    selectChineseCharacters({
                      strokes: selectStrokes ? Number(selectStrokes) : undefined,
                      wuxing: selectElement || undefined,
                      limit: 60,
                    }),
                  ),
                )
              }
            >
              <div className="culture-tools-fields">
                <label>
                  康熙笔画
                  <input
                    type="number"
                    min="1"
                    max="64"
                    value={selectStrokes}
                    onChange={(event) => setSelectStrokes(event.target.value)}
                  />
                </label>
                <label>
                  五行
                  <select
                    value={selectElement}
                    onChange={(event) => setSelectElement(event.target.value as '' | Wuxing)}
                  >
                    {wuxingOptions.map((item) => (
                      <option key={item || 'all'} value={item}>
                        {item || '不限'}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button className="culture-tools-primary" type="submit">
                筛选汉字
              </button>
            </form>
            <div className="culture-char-pool">
              {selectedChars.map((item) => (
                <button
                  key={item.char}
                  type="button"
                  title={`${item.pinyin ?? '读音未录'} · ${item.definition ?? '暂无释义'}`}
                  onClick={() => {
                    setHanziText(item.char);
                    setHanziResult(analyzeChineseCharacters(item.char));
                  }}
                >
                  {item.char}
                  <small>
                    {item.kangxiStrokes}画 · {item.wuxing ?? '未定'}
                  </small>
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {activeTool === 'number' ? (
        <section className="culture-tools-panel">
          <form
            onSubmit={(event) =>
              run(event, () => setNumberResult(analyzeNumber(numberText, numberPurpose)))
            }
          >
            <div className="culture-tools-fields">
              <label>
                号码
                <input
                  value={numberText}
                  maxLength={64}
                  onChange={(event) => setNumberText(event.target.value)}
                />
              </label>
              <label>
                用途
                <select
                  value={numberPurpose}
                  onChange={(event) => setNumberPurpose(event.target.value as typeof numberPurpose)}
                >
                  <option value="phone">手机号</option>
                  <option value="plate">车牌号</option>
                  <option value="general">其他号码</option>
                </select>
              </label>
            </div>
            <button className="culture-tools-primary" type="submit">
              解析号码
            </button>
          </form>
          {numberResult ? (
            <div className="culture-report">
              <div className="culture-score">
                <strong>{numberResult.primaryIndex}</strong>
                <span>{numberResult.primaryNumerology.level}</span>
              </div>
              <h2>{numberResult.primaryNumerology.keywords}</h2>
              <p>{numberResult.primaryNumerology.poem}</p>
              <p>{numberResult.primaryNumerology.text}</p>
              <dl>
                <div>
                  <dt>数字合计</dt>
                  <dd>{numberResult.digitSum}</dd>
                </div>
                <div>
                  <dt>奇偶数量</dt>
                  <dd>
                    {numberResult.oddCount} / {numberResult.evenCount}
                  </dd>
                </div>
                <div>
                  <dt>重复组合</dt>
                  <dd>{numberResult.repeatedGroups.join('、') || '无'}</dd>
                </div>
              </dl>
              <small>{numberResult.formula}</small>
            </div>
          ) : (
            <Empty text="支持手机号、车牌号以及其他数字或字母编号。" />
          )}
        </section>
      ) : null}

      {activeTool === 'zhuge' ? (
        <section className="culture-tools-panel">
          <form
            onSubmit={(event) => run(event, () => setZhugeResult(calculateZhugeNumber(zhugeText)))}
          >
            <label>
              随念写下三个字
              <input
                value={zhugeText}
                maxLength={3}
                onChange={(event) => setZhugeText(event.target.value)}
              />
            </label>
            <button className="culture-tools-primary" type="submit">
              取签
            </button>
          </form>
          {zhugeResult ? (
            <div className="culture-report">
              <div className="culture-score">
                <strong>{zhugeResult.number}</strong>
                <span>第 {zhugeResult.number} 签</span>
              </div>
              <h2>{zhugeResult.sign.poem}</h2>
              <p>{zhugeResult.sign.summary}</p>
              <small>
                {zhugeResult.chars
                  .map(
                    (char, index) =>
                      `${char} ${zhugeResult.strokes[index]}画→${zhugeResult.digits[index]}`,
                  )
                  .join('，')}
                ；组成 {zhugeResult.rawNumber}，按 384 循环取签。
              </small>
            </div>
          ) : (
            <Empty text="按三个字的康熙笔画取个位，组成签数后对应 384 签。" />
          )}
        </section>
      ) : null}

      {activeTool === 'kongming' ? (
        <section className="culture-tools-panel">
          <div className="culture-coins" aria-label="五枚硬币结果">
            {coins.map((coin, index) => (
              <button
                key={index}
                type="button"
                className={coin === '●' ? 'is-yang' : ''}
                onClick={() =>
                  setCoins((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? (item === '●' ? '○' : '●') : item,
                    ),
                  )
                }
              >
                <strong>{coin}</strong>
                <span>{coin === '●' ? '阳' : '阴'}</span>
              </button>
            ))}
          </div>
          <div className="culture-tools-actions">
            <button
              className="culture-tools-primary"
              type="button"
              onClick={() => {
                setError('');
                try {
                  setKongmingResult(castKongmingHexagram(coins.join('')));
                } catch (cause) {
                  setError(cause instanceof Error ? cause.message : '起卦失败');
                }
              }}
            >
              按当前结果查卦
            </button>
            <button
              type="button"
              onClick={() => {
                const result = castKongmingHexagram();
                setKongmingResult(result);
                setCoins([...result.symbol] as Array<'●' | '○'>);
              }}
            >
              随机起卦
            </button>
          </div>
          {kongmingResult ? (
            <div className="culture-report">
              <div className="culture-score">
                <strong>{kongmingResult.number}</strong>
                <span>{kongmingResult.grade}</span>
              </div>
              <h2>{kongmingResult.name}</h2>
              <p>{kongmingResult.poem}</p>
              <small>
                {kongmingResult.symbol
                  .split('')
                  .map((item) => (item === '●' ? '阳' : '阴'))
                  .join(' · ')}
              </small>
            </div>
          ) : (
            <Empty text="依次记录五枚硬币的正反面，或使用随机起卦。" />
          )}
        </section>
      ) : null}

      <p className="culture-tools-footnote">
        姓名与数字数理属于文化参考体系，不用于替代医疗、法律、财务或其他重大决定。
      </p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="culture-tools-empty">{text}</div>;
}

function NameReport({ result }: { result: ReturnType<typeof analyzeChineseName> }) {
  return (
    <div className="culture-report">
      <div className="culture-score">
        <strong>{result.scores.total}</strong>
        <span>综合参考</span>
      </div>
      <h2>
        {result.surname}
        {result.given}
      </h2>
      <div className="culture-grid-list">
        {Object.entries(result.grids).map(([key, grid]) => (
          <article key={key}>
            <span>{gridLabels[key]}</span>
            <strong>
              {grid.num} · {grid.wuxing}
            </strong>
            <small>
              {grid.level} · {grid.keywords}
            </small>
          </article>
        ))}
      </div>
      <p>
        {result.sancai.combo}三才 · {result.sancai.level}：{result.sancai.text}
      </p>
      <CharacterCards items={result.chars.map((item) => ({ char: item.char, detail: item }))} />
    </div>
  );
}

function CharacterCards({
  items,
}: {
  items: ReturnType<typeof analyzeChineseCharacters>['characters'];
}) {
  return (
    <div className="culture-character-list">
      {items.map((item, index) => (
        <article key={`${item.char}-${index}`}>
          <strong>{item.char}</strong>
          {item.detail ? (
            <div>
              <span>
                {item.detail.pinyin ?? '读音未录'} · {item.detail.kangxiStrokes} 画 ·{' '}
                {item.detail.wuxing ?? '五行未定'}
              </span>
              <small>
                {item.detail.radical ? `${item.detail.radical}部` : '部首未录'} ·{' '}
                {item.detail.traditional !== item.detail.simplified
                  ? `繁体 ${item.detail.traditional}`
                  : '简繁同形'}
              </small>
              <p>{item.detail.definition ?? '暂无现代释义'}</p>
            </div>
          ) : (
            <span>字典暂未收录</span>
          )}
        </article>
      ))}
    </div>
  );
}
