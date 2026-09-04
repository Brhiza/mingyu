import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  analyzeChineseCharacters,
  analyzeChineseName,
  analyzeNumber,
  buildChineseNameAnalysisPrompt,
  buildChineseNamingPrompt,
  generateChineseNames,
  selectChineseCharacters,
  selectNamingCharacters,
  type GenerationCharacterPosition,
  type NamingBirthInput,
  type NamingGender,
  type Wuxing,
} from 'mingyu-core/name-number';
import { PromptDeliveryPanel } from '@/components/PromptPreview';
import { usePromptCopyShare } from '@/hooks/usePromptCopyShare';
import { BIRTH_TIME_OPTIONS } from '@/lib/birth-time';

type ToolId = 'naming' | 'name' | 'hanzi' | 'number';
type BirthDraft = {
  enabled: boolean;
  date: string;
  gender: '' | 'male' | 'female';
  timeIndex: number | '';
};

const tools: Array<{ id: ToolId; label: string; description: string; mark: string }> = [
  { id: 'naming', label: '起名', description: '结合出生取用筛选姓名', mark: '名' },
  { id: 'name', label: '姓名解析', description: '从命局到音形义完整比较', mark: '姓' },
  { id: 'hanzi', label: '汉字与选字', description: '查笔画、五行、读音与释义', mark: '字' },
  { id: 'number', label: '数字解析', description: '手机号、车牌号与一般号码', mark: '数' },
];
const wuxingOptions: Array<'' | Wuxing> = ['', '金', '木', '水', '火', '土'];
const gridLabels: Record<string, string> = {
  tian: '天格',
  ren: '人格',
  di: '地格',
  wai: '外格',
  zong: '总格',
};

function createBirthInput(birth: BirthDraft): NamingBirthInput | undefined {
  if (!birth.enabled) return undefined;
  if (!birth.date || !birth.gender || birth.timeIndex === '') {
    throw new Error('请填写完整的出生日期、性别和时辰');
  }
  const [year, month, day] = birth.date.split('-').map(Number);
  return {
    gender: birth.gender,
    year,
    month,
    day,
    timeIndex: birth.timeIndex,
    dateType: 'solar',
  };
}

export function CultureToolsPage() {
  const [activeTool, setActiveTool] = useState<ToolId>('naming');
  const [error, setError] = useState('');
  const [surname, setSurname] = useState('李');
  const [gender, setGender] = useState<NamingGender>('通用');
  const [preferredCharacters, setPreferredCharacters] = useState('');
  const [forbiddenCharacters, setForbiddenCharacters] = useState('');
  const [generationCharacter, setGenerationCharacter] = useState('');
  const [generationPosition, setGenerationPosition] =
    useState<GenerationCharacterPosition>('first');
  const [namingBirth, setNamingBirth] = useState<BirthDraft>({
    enabled: true,
    date: '',
    gender: '',
    timeIndex: '',
  });
  const [nameCandidates, setNameCandidates] = useState<ReturnType<typeof generateChineseNames>>([]);
  const [namingCharacterPool, setNamingCharacterPool] = useState<
    ReturnType<typeof selectNamingCharacters>
  >([]);
  const [selectedCandidate, setSelectedCandidate] = useState(0);
  const [fullName, setFullName] = useState('李清和');
  const [surnameLength, setSurnameLength] = useState<1 | 2>(1);
  const [nameQuestion, setNameQuestion] = useState('');
  const [analysisBirth, setAnalysisBirth] = useState<BirthDraft>({
    enabled: true,
    date: '',
    gender: '',
    timeIndex: '',
  });
  const [nameResult, setNameResult] = useState<ReturnType<typeof analyzeChineseName> | null>(null);
  const [hanziText, setHanziText] = useState('清和');
  const [hanziResult, setHanziResult] = useState<ReturnType<
    typeof analyzeChineseCharacters
  > | null>(null);
  const [selectStrokes, setSelectStrokes] = useState('');
  const [selectElement, setSelectElement] = useState<'' | Wuxing>('');
  const [selectPinyin, setSelectPinyin] = useState('');
  const [selectedChars, setSelectedChars] = useState<ReturnType<typeof selectChineseCharacters>>(
    [],
  );
  const [numberText, setNumberText] = useState('13800138000');
  const [numberPurpose, setNumberPurpose] = useState<'phone' | 'plate' | 'general'>('phone');
  const [numberResult, setNumberResult] = useState<ReturnType<typeof analyzeNumber> | null>(null);

  const namingPrompt = useMemo(
    () =>
      nameCandidates.length
        ? buildChineseNamingPrompt({
            surname,
            gender,
            candidates: nameCandidates,
            suitableCharacters: namingCharacterPool,
            preferredCharacters,
            forbiddenCharacters,
            generationCharacter,
            generationPosition,
          })
        : '',
    [
      forbiddenCharacters,
      gender,
      generationCharacter,
      generationPosition,
      nameCandidates,
      namingCharacterPool,
      preferredCharacters,
      surname,
    ],
  );
  const namePrompt = useMemo(
    () =>
      nameResult
        ? buildChineseNameAnalysisPrompt({ analysis: nameResult, question: nameQuestion })
        : '',
    [nameQuestion, nameResult],
  );
  const namingDelivery = usePromptCopyShare(namingPrompt);
  const nameDelivery = usePromptCopyShare(namePrompt);

  function run(event: FormEvent, action: () => void) {
    event.preventDefault();
    setError('');
    try {
      action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '暂时无法完成，请检查输入');
    }
  }

  function changeTool(tool: ToolId) {
    setActiveTool(tool);
    setError('');
  }

  return (
    <main className="culture-tools-page">
      <header className="culture-tools-hero">
        <div>
          <span className="culture-tools-eyebrow">文字与数理</span>
          <h1>从资料出发，得到可以比较的结果</h1>
          <p>先看清字、名与数字本身，再把完整资料交给 AI 做综合解读。</p>
        </div>
        <nav className="culture-divination-links" aria-label="相关占问">
          <span>想问一件具体的事？</span>
          <Link to="/divination/zhuge">诸葛神数</Link>
          <Link to="/divination/kongming">孔明神卦</Link>
        </nav>
      </header>

      <nav className="culture-tools-tabs" aria-label="文字与数理工具">
        {tools.map((tool) => (
          <button
            key={tool.id}
            type="button"
            className={activeTool === tool.id ? 'is-active' : ''}
            onClick={() => changeTool(tool.id)}
          >
            <span>{tool.mark}</span>
            <strong>{tool.label}</strong>
            <small>{tool.description}</small>
          </button>
        ))}
      </nav>

      {error ? <div className="culture-tools-error">{error}</div> : null}

      {activeTool === 'naming' ? (
        <section className="culture-tools-workspace">
          <form
            className="culture-tools-input-panel"
            onSubmit={(event) =>
              run(event, () => {
                const birth = createBirthInput(namingBirth);
                const options = {
                  surname,
                  gender,
                  givenNameLength: 2,
                  preferredCharacters,
                  forbiddenCharacters,
                  generationCharacter,
                  generationPosition,
                  birth,
                  limit: 12,
                } as const;
                const candidates = generateChineseNames(options);
                setNameCandidates(candidates);
                setNamingCharacterPool(selectNamingCharacters({ ...options, limit: 24 }));
                setSelectedCandidate(0);
              })
            }
          >
            <SectionHeading step="01" title="基础偏好" hint="姓氏和名字气质" />
            <div className="culture-tools-fields is-two">
              <Field label="姓氏">
                <input value={surname} onChange={(event) => setSurname(event.target.value)} />
              </Field>
              <Field label="名字气质">
                <select
                  value={gender}
                  onChange={(event) => setGender(event.target.value as NamingGender)}
                >
                  <option value="通用">自然通用</option>
                  <option value="男">偏阳刚</option>
                  <option value="女">偏柔和</option>
                </select>
              </Field>
            </div>
            <div className="culture-tools-fields is-two">
              <Field label="偏好字" hint="优先进入候选与适配字池">
                <input
                  value={preferredCharacters}
                  onChange={(event) => setPreferredCharacters(event.target.value)}
                  placeholder="例如：清 宁 和"
                />
              </Field>
              <Field label="忌用字" hint="本地候选会直接排除">
                <input
                  value={forbiddenCharacters}
                  onChange={(event) => setForbiddenCharacters(event.target.value)}
                  placeholder="例如：乐"
                />
              </Field>
              <Field label="辈分字" hint="填写一个固定用字">
                <input
                  value={generationCharacter}
                  onChange={(event) => setGenerationCharacter(event.target.value)}
                  placeholder="例如：承"
                />
              </Field>
              <Field label="辈分字位置">
                <select
                  value={generationPosition}
                  onChange={(event) =>
                    setGenerationPosition(event.target.value as GenerationCharacterPosition)
                  }
                >
                  <option value="first">名字首字</option>
                  <option value="second">名字末字</option>
                </select>
              </Field>
            </div>
            <BirthSection value={namingBirth} onChange={setNamingBirth} />
            <button className="culture-tools-primary" type="submit">
              生成姓名候选
            </button>
          </form>

          <section className="culture-tools-result-panel">
            <SectionHeading
              step="02"
              title="候选比较"
              hint={
                nameCandidates.length
                  ? '已生成 ' + nameCandidates.length + ' 个可继续推敲的名字'
                  : '生成后可逐个查看'
              }
            />
            {nameCandidates.length ? (
              <>
                <NamingCharacterPool items={namingCharacterPool} />
                <div className="culture-name-grid">
                  {nameCandidates.map((item, index) => (
                    <button
                      key={item.fullName}
                      type="button"
                      className={selectedCandidate === index ? 'is-selected' : ''}
                      onClick={() => setSelectedCandidate(index)}
                    >
                      <strong>{item.fullName}</strong>
                      <small>
                        {item.analysis.sancai.combo} · {item.analysis.sancai.level}
                      </small>
                    </button>
                  ))}
                </div>
                {nameCandidates[selectedCandidate] ? (
                  <NameReport result={nameCandidates[selectedCandidate]!.analysis} />
                ) : null}
              </>
            ) : (
              <Empty
                mark="名"
                title="候选会在这里集中比较"
                text="出生取用会形成适配字池，偏好、忌用与辈分规则会直接作用于候选。"
              />
            )}
          </section>

          {nameCandidates.length ? (
            <div className="culture-tools-prompt">
              <PromptDeliveryPanel
                promptText={namingPrompt}
                copyState={namingDelivery.copyState}
                shareState={namingDelivery.shareState}
                onCopy={namingDelivery.handleCopy}
                onShare={namingDelivery.handleShare}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      {activeTool === 'name' ? (
        <section className="culture-tools-workspace">
          <form
            className="culture-tools-input-panel"
            onSubmit={(event) =>
              run(event, () =>
                setNameResult(
                  analyzeChineseName({
                    fullName,
                    surnameLength,
                    birth: createBirthInput(analysisBirth),
                  }),
                ),
              )
            }
          >
            <SectionHeading step="01" title="姓名资料" hint="复姓请选择两个姓氏字" />
            <div className="culture-tools-fields is-two">
              <Field label="完整姓名">
                <input value={fullName} onChange={(event) => setFullName(event.target.value)} />
              </Field>
              <Field label="姓氏长度">
                <select
                  value={surnameLength}
                  onChange={(event) => setSurnameLength(Number(event.target.value) as 1 | 2)}
                >
                  <option value={1}>单姓</option>
                  <option value={2}>复姓</option>
                </select>
              </Field>
            </div>
            <BirthSection value={analysisBirth} onChange={setAnalysisBirth} />
            <Field label="想重点了解什么" hint="会写入完整提示词">
              <textarea
                value={nameQuestion}
                onChange={(event) => setNameQuestion(event.target.value)}
                placeholder="例如：这个名字适合长期用于职场和公开表达吗？"
                rows={3}
              />
            </Field>
            <button className="culture-tools-primary" type="submit">
              开始综合解析
            </button>
          </form>

          <section className="culture-tools-result-panel">
            <SectionHeading step="02" title="综合结果" hint="算法结果用于建立可核对的分析底稿" />
            {nameResult ? (
              <NameReport result={nameResult} />
            ) : (
              <Empty
                mark="姓"
                title="姓名与出生信息会一起计算"
                text="结果包含逐字资料、五格三才和出生喜用方向。"
              />
            )}
          </section>

          {nameResult ? (
            <div className="culture-tools-prompt">
              <PromptDeliveryPanel
                promptText={namePrompt}
                copyState={nameDelivery.copyState}
                shareState={nameDelivery.shareState}
                onCopy={nameDelivery.handleCopy}
                onShare={nameDelivery.handleShare}
                question={nameQuestion.trim() || undefined}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      {activeTool === 'hanzi' ? (
        <section className="culture-tools-workspace">
          <div className="culture-tools-input-panel">
            <form
              onSubmit={(event) =>
                run(event, () => setHanziResult(analyzeChineseCharacters(hanziText)))
              }
            >
              <SectionHeading step="01" title="查字" hint="一次可解析 1 至 20 个汉字" />
              <Field label="汉字">
                <input value={hanziText} onChange={(event) => setHanziText(event.target.value)} />
              </Field>
              <button className="culture-tools-primary" type="submit">
                解析汉字
              </button>
            </form>
            <div className="culture-tools-divider" />
            <form
              onSubmit={(event) =>
                run(event, () =>
                  setSelectedChars(
                    selectChineseCharacters({
                      strokes: selectStrokes ? Number(selectStrokes) : undefined,
                      wuxing: selectElement || undefined,
                      pinyin: selectPinyin || undefined,
                      limit: 80,
                    }),
                  ),
                )
              }
            >
              <SectionHeading step="02" title="按条件选字" hint="条件可以组合使用" />
              <div className="culture-tools-fields is-three">
                <Field label="康熙笔画">
                  <input
                    type="number"
                    min={1}
                    value={selectStrokes}
                    onChange={(event) => setSelectStrokes(event.target.value)}
                    placeholder="不限"
                  />
                </Field>
                <Field label="五行">
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
                </Field>
                <Field label="拼音">
                  <input
                    value={selectPinyin}
                    onChange={(event) => setSelectPinyin(event.target.value)}
                    placeholder="如 qing"
                  />
                </Field>
              </div>
              <button className="culture-tools-primary is-secondary" type="submit">
                筛选可用字
              </button>
            </form>
          </div>

          <section className="culture-tools-result-panel">
            <SectionHeading step="03" title="字典结果" hint="简繁体统一按康熙笔画展示" />
            {hanziResult ? (
              <CharacterCards items={hanziResult.characters} />
            ) : (
              <Empty
                mark="字"
                title="字义和数理资料会在这里展开"
                text="也可以直接按笔画、五行或拼音筛选常用字。"
              />
            )}
            {selectedChars.length ? (
              <div className="culture-character-pool">
                <h3>符合条件的字</h3>
                <div>
                  {selectedChars.map((item) => (
                    <button
                      key={item.char}
                      type="button"
                      title={item.definition}
                      onClick={() => {
                        setHanziText(item.char);
                        setHanziResult(analyzeChineseCharacters(item.char));
                      }}
                    >
                      <strong>{item.char}</strong>
                      <small>
                        {item.kangxiStrokes}画 · {item.wuxing ?? '待定'}
                      </small>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </section>
      ) : null}

      {activeTool === 'number' ? (
        <section className="culture-tools-workspace">
          <form
            className="culture-tools-input-panel"
            onSubmit={(event) =>
              run(event, () => setNumberResult(analyzeNumber(numberText, numberPurpose)))
            }
          >
            <SectionHeading step="01" title="输入号码" hint="空格和短横线会自动忽略" />
            <Field label="号码">
              <input value={numberText} onChange={(event) => setNumberText(event.target.value)} />
            </Field>
            <Field label="号码类型">
              <select
                value={numberPurpose}
                onChange={(event) =>
                  setNumberPurpose(event.target.value as 'phone' | 'plate' | 'general')
                }
              >
                <option value="phone">手机号</option>
                <option value="plate">车牌号</option>
                <option value="general">一般号码</option>
              </select>
            </Field>
            <button className="culture-tools-primary" type="submit">
              解析号码
            </button>
            <p className="culture-tools-footnote">
              数理只适合作为文化参考，不替代号码价格、安全性或实际使用体验。
            </p>
          </form>

          <section className="culture-tools-result-panel">
            <SectionHeading step="02" title="数理结果" hint="同时展示主数理与数字结构" />
            {numberResult ? (
              <NumberReport result={numberResult} />
            ) : (
              <Empty
                mark="数"
                title="号码结构会在这里清晰展开"
                text="手机号按完整数字取数，车牌号会同时计算字母序号。"
              />
            )}
          </section>
        </section>
      ) : null}
    </main>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="culture-tools-field">
      <span>
        {label}
        {hint ? <small>{hint}</small> : null}
      </span>
      {children}
    </label>
  );
}

function SectionHeading({ step, title, hint }: { step: string; title: string; hint: string }) {
  return (
    <header className="culture-tools-section-heading">
      <span>{step}</span>
      <div>
        <h2>{title}</h2>
        <p>{hint}</p>
      </div>
    </header>
  );
}

function BirthSection({
  value,
  onChange,
}: {
  value: BirthDraft;
  onChange: (next: BirthDraft) => void;
}) {
  return (
    <section className={'culture-birth-card' + (value.enabled ? ' is-enabled' : '')}>
      <header>
        <div>
          <strong>结合出生资料</strong>
          <small>用于判断命局喜用方向</small>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={value.enabled}
          onClick={() => onChange({ ...value, enabled: !value.enabled })}
        >
          <span />
        </button>
      </header>
      {value.enabled ? (
        <div className="culture-tools-fields is-three">
          <Field label="公历生日">
            <input
              type="date"
              required
              value={value.date}
              onChange={(event) => onChange({ ...value, date: event.target.value })}
            />
          </Field>
          <Field label="性别">
            <select
              required
              value={value.gender}
              onChange={(event) =>
                onChange({
                  ...value,
                  gender: event.target.value as BirthDraft['gender'],
                })
              }
            >
              <option value="">请选择</option>
              <option value="male">男</option>
              <option value="female">女</option>
            </select>
          </Field>
          <Field label="出生时辰">
            <select
              required
              value={value.timeIndex}
              onChange={(event) =>
                onChange({
                  ...value,
                  timeIndex: event.target.value === '' ? '' : Number(event.target.value),
                })
              }
            >
              <option value="">请选择</option>
              {BIRTH_TIME_OPTIONS.map((item) => (
                <option key={item.index} value={item.index}>
                  {item.label} · {item.range}
                </option>
              ))}
            </select>
          </Field>
        </div>
      ) : null}
    </section>
  );
}

function Empty({ mark, title, text }: { mark: string; title: string; text: string }) {
  return (
    <div className="culture-tools-empty">
      <span>{mark}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function NameReport({ result }: { result: ReturnType<typeof analyzeChineseName> }) {
  return (
    <article className="culture-name-report">
      <header>
        <div>
          <h3>
            {result.surname}
            {result.given}
          </h3>
          <p>
            {result.sancai.combo} · {result.sancai.level}
          </p>
        </div>
      </header>
      {result.birthContext ? (
        <div className="culture-birth-summary">
          <span>出生适配</span>
          <strong>{result.birthContext.pillars.join(' ')}</strong>
          <p>
            日主 {result.birthContext.dayMaster} · 喜用{' '}
            {result.birthContext.favorableElements.join('、') || '需综合复核'}
          </p>
        </div>
      ) : null}
      <div className="culture-character-list">
        {result.chars.map((item) => (
          <div key={item.char + '-' + item.isSurname}>
            <strong>{item.char}</strong>
            <span>{item.pinyin ?? '读音待补充'}</span>
            <small>
              康熙 {item.kangxiStrokes} 画 · {item.wuxing ?? '五行待定'}
            </small>
            <p>{item.definition}</p>
          </div>
        ))}
      </div>
      <div className="culture-grid-list">
        {Object.entries(result.grids).map(([key, item]) => (
          <div key={key}>
            <span>{gridLabels[key] ?? key}</span>
            <strong>{item.num}</strong>
            <small>
              {item.wuxing} · {item.level}
            </small>
            <p>{item.keywords}</p>
          </div>
        ))}
      </div>
      <div className="culture-sancai">
        <strong>三才配置 · {result.sancai.combo}</strong>
        <span>{result.sancai.text}</span>
      </div>
    </article>
  );
}

function NamingCharacterPool({ items }: { items: ReturnType<typeof selectNamingCharacters> }) {
  if (!items.length) return null;
  return (
    <section className="culture-naming-pool">
      <header>
        <h3>适配选字</h3>
        <p>偏好字优先，随后结合出生取用与常用字整理；可继续交给 AI 重新组合。</p>
      </header>
      <div>
        {items.map((item) => (
          <span key={item.char} title={item.definition}>
            <strong>{item.char}</strong>
            <small>
              {item.wuxing ?? '待定'} · {item.pinyin ?? '读音待补'}
            </small>
          </span>
        ))}
      </div>
    </section>
  );
}

function CharacterCards({
  items,
}: {
  items: ReturnType<typeof analyzeChineseCharacters>['characters'];
}) {
  return (
    <div className="culture-character-list is-analysis">
      {items.map((item, index) => (
        <div key={item.char + '-' + index}>
          <strong>{item.char}</strong>
          {item.detail ? (
            <>
              <span>{item.detail.pinyin ?? '读音待补充'}</span>
              <small>
                繁体 {item.detail.traditional} · 康熙 {item.detail.kangxiStrokes} 画 ·{' '}
                {item.detail.wuxing ?? '五行待定'}
              </small>
              <p>{item.detail.definition}</p>
            </>
          ) : (
            <p>字典暂未收录这个字。</p>
          )}
        </div>
      ))}
    </div>
  );
}

function NumberReport({ result }: { result: ReturnType<typeof analyzeNumber> }) {
  return (
    <article className="culture-number-report">
      <div className="culture-number-main">
        <span>主数理</span>
        <strong>{result.primaryIndex}</strong>
        <h3>
          {result.primaryNumerology.level} · {result.primaryNumerology.keywords}
        </h3>
        <p>{result.primaryNumerology.text}</p>
      </div>
      <div className="culture-number-stats">
        <div>
          <span>数字和</span>
          <strong>{result.digitSum}</strong>
        </div>
        <div>
          <span>奇数 / 偶数</span>
          <strong>
            {result.oddCount} / {result.evenCount}
          </strong>
        </div>
        <div>
          <span>和数理</span>
          <strong>{result.sumIndex}</strong>
        </div>
      </div>
      <div className="culture-sancai">
        <strong>计算方式</strong>
        <span>{result.formula}</span>
      </div>
      {result.repeatedGroups.length ? (
        <p className="culture-number-repeats">重复组合：{result.repeatedGroups.join('、')}</p>
      ) : null}
    </article>
  );
}
