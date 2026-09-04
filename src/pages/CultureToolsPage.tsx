import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  analyzeChineseCharacters,
  analyzeChineseName,
  analyzeNumber,
  buildChineseNameAnalysisPrompt,
  buildChineseNamingPrompt,
  buildNumberEnergyPrompt,
  generateChineseNames,
  selectChineseCharacters,
  selectNamingCharacters,
  type GenerationCharacterPosition,
  type NamingBirthInput,
  type NamingGender,
  type Wuxing,
} from 'mingyu-core/name-number';
import { PromptDeliveryPanel } from '@/components/PromptPreview';
import { DropdownSelect, type DropdownSelectOption } from '@/components/DropdownSelect';
import { SegmentedControl } from '@/components/SegmentedControl';
import { WorkspacePage } from '@/components/workspace/WorkspaceUI';
import { useActivePersonalCase } from '@/hooks/useActivePersonalCase';
import { usePromptCopyShare } from '@/hooks/usePromptCopyShare';
import { BIRTH_TIME_OPTIONS } from '@/lib/birth-time';
import { sortPersonalCasesForQuickSwitch, type PersonalHistoryRecord } from '@/lib/history-records';

type ToolId = 'naming' | 'name' | 'hanzi' | 'number';
type BirthDraft = {
  gender: 'male' | 'female';
  dateType: 'solar' | 'lunar';
  year: string;
  month: string;
  day: string;
  timeIndex: number | '';
  isLeapMonth: boolean;
};

const TEMPORARY_CASE_VALUE = '__temporary_case__';
const emptyBirthDraft: BirthDraft = {
  gender: 'male',
  dateType: 'solar',
  year: '',
  month: '',
  day: '',
  timeIndex: '',
  isLeapMonth: false,
};

const tools: Array<{ id: ToolId; label: string; description: string; mark: string }> = [
  { id: 'naming', label: '起名', description: '结合出生取用筛选姓名', mark: '名' },
  { id: 'name', label: '姓名解析', description: '从命局到音形义完整比较', mark: '姓' },
  { id: 'hanzi', label: '汉字与选字', description: '查笔画、五行、读音与释义', mark: '字' },
  { id: 'number', label: '数字能量', description: '数字、字母与八星磁场', mark: '数' },
];
const wuxingOptions: Array<'' | Wuxing> = ['', '金', '木', '水', '火', '土'];
const birthTimeOptions: DropdownSelectOption<string>[] = [
  { value: '', label: '请选择时辰' },
  ...BIRTH_TIME_OPTIONS.map((item) => ({
    value: String(item.index),
    label: `${item.label}（${item.range}）`,
  })),
];
const gridLabels: Record<string, string> = {
  tian: '天格',
  ren: '人格',
  di: '地格',
  wai: '外格',
  zong: '总格',
};

function createBirthInput(birth: BirthDraft): NamingBirthInput | undefined {
  if (!birth.year || !birth.month || !birth.day || birth.timeIndex === '') {
    throw new Error('请填写完整的出生日期、性别和时辰');
  }
  return {
    gender: birth.gender,
    year: Number(birth.year),
    month: Number(birth.month),
    day: Number(birth.day),
    timeIndex: birth.timeIndex,
    dateType: birth.dateType,
    ...(birth.dateType === 'lunar' ? { isLeapMonth: birth.isLeapMonth } : {}),
  };
}

function getCaseBirthDraft(activeCase: PersonalHistoryRecord | null): BirthDraft {
  if (!activeCase) return { ...emptyBirthDraft };
  const { input } = activeCase;
  return {
    gender: input.gender,
    dateType: input.dateType,
    year: input.year,
    month: input.month,
    day: input.day,
    timeIndex: input.timeIndex,
    isLeapMonth: input.isLeapMonth,
  };
}

export function CultureToolsPage() {
  const { cases, activeCase, activeCaseId, selectCase } = useActivePersonalCase();
  const [activeTool, setActiveTool] = useState<ToolId>('naming');
  const [error, setError] = useState('');
  const [surname, setSurname] = useState('李');
  const [gender, setGender] = useState<NamingGender>('通用');
  const [preferredCharacters, setPreferredCharacters] = useState('');
  const [forbiddenCharacters, setForbiddenCharacters] = useState('');
  const [generationCharacter, setGenerationCharacter] = useState('');
  const [generationPosition, setGenerationPosition] =
    useState<GenerationCharacterPosition>('first');
  const [birth, setBirth] = useState<BirthDraft>(() => getCaseBirthDraft(activeCase));
  const [nameCandidates, setNameCandidates] = useState<ReturnType<typeof generateChineseNames>>([]);
  const [namingCharacterPool, setNamingCharacterPool] = useState<
    ReturnType<typeof selectNamingCharacters>
  >([]);
  const [selectedCandidate, setSelectedCandidate] = useState(0);
  const [fullName, setFullName] = useState('李清和');
  const [surnameLength, setSurnameLength] = useState<1 | 2>(1);
  const [nameQuestion, setNameQuestion] = useState('');
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
  const [numberQuestion, setNumberQuestion] = useState('');
  const [numberResult, setNumberResult] = useState<ReturnType<typeof analyzeNumber> | null>(null);

  const caseOptions = useMemo<DropdownSelectOption<string>[]>(
    () => [
      {
        value: TEMPORARY_CASE_VALUE,
        label: '不指定案例',
        triggerLabel: '临时档案',
      },
      ...sortPersonalCasesForQuickSwitch(cases).map((record) => ({
        value: record.id,
        label: `${record.name} · ${record.birthText}`,
        triggerLabel: record.name,
      })),
    ],
    [cases],
  );

  useEffect(() => {
    setBirth(getCaseBirthDraft(activeCase));
    const caseName = activeCase?.input.name.trim();
    if (caseName) setFullName(caseName);
  }, [activeCase]);

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
  const numberPrompt = useMemo(
    () =>
      numberResult
        ? buildNumberEnergyPrompt({ analysis: numberResult, question: numberQuestion })
        : '',
    [numberQuestion, numberResult],
  );
  const namingDelivery = usePromptCopyShare(namingPrompt);
  const nameDelivery = usePromptCopyShare(namePrompt);
  const numberDelivery = usePromptCopyShare(numberPrompt);

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
    <WorkspacePage title="文字与数理" width="wide" className="culture-tools-page">
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
                const birthInput = createBirthInput(birth);
                const options = {
                  surname,
                  gender,
                  givenNameLength: 2,
                  preferredCharacters,
                  forbiddenCharacters,
                  generationCharacter,
                  generationPosition,
                  birth: birthInput,
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
              <Field label="偏好字" hint="喜欢或希望保留的字">
                <input
                  value={preferredCharacters}
                  onChange={(event) => setPreferredCharacters(event.target.value)}
                  placeholder="例如：清 宁 和"
                />
              </Field>
              <Field label="忌用字" hint="姓名中不会使用的字">
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
            <BirthSection
              value={birth}
              onChange={setBirth}
              caseId={activeCaseId}
              caseOptions={caseOptions}
              onCaseChange={selectCase}
            />
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
                text="填写资料后生成姓名，并逐个查看用字与出生适配。"
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
                    birth: createBirthInput(birth),
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
            <BirthSection
              value={birth}
              onChange={setBirth}
              caseId={activeCaseId}
              caseOptions={caseOptions}
              onCaseChange={selectCase}
            />
            <Field label="想重点了解什么">
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
            <SectionHeading step="02" title="综合结果" hint="查看姓名与出生信息的整体关系" />
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
                      title={item.definition ?? undefined}
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
            <SectionHeading step="01" title="输入内容" hint="支持数字、英文字母和常见分隔符" />
            <Field label="数字或字母">
              <input
                value={numberText}
                onChange={(event) => setNumberText(event.target.value)}
                placeholder="例如：13800138000 或 粤B·A1235"
              />
            </Field>
            <Field label="使用类型">
              <select
                value={numberPurpose}
                onChange={(event) =>
                  setNumberPurpose(event.target.value as 'phone' | 'plate' | 'general')
                }
              >
                <option value="phone">手机号</option>
                <option value="plate">车牌号</option>
                <option value="general">其他编号</option>
              </select>
            </Field>
            <Field label="想重点了解什么">
              <textarea
                value={numberQuestion}
                onChange={(event) => setNumberQuestion(event.target.value)}
                placeholder="例如：这个号码在工作沟通和长期使用上有什么特点？"
                rows={3}
              />
            </Field>
            <button className="culture-tools-primary" type="submit">
              解析数字能量
            </button>
            <p className="culture-tools-footnote">
              数字能量属于传统文化参考，实际选择仍以资费、安全性和使用便利为先。
            </p>
          </form>

          <section className="culture-tools-result-panel">
            <SectionHeading step="02" title="磁场结果" hint="按号码顺序查看相邻组合" />
            {numberResult ? (
              <NumberReport result={numberResult} />
            ) : (
              <Empty
                mark="数"
                title="八星磁场会在这里展开"
                text="字母会先换算为数字，再与号码一起分析相邻磁场。"
              />
            )}
          </section>

          {numberResult ? (
            <div className="culture-tools-prompt">
              <PromptDeliveryPanel
                promptText={numberPrompt}
                copyState={numberDelivery.copyState}
                shareState={numberDelivery.shareState}
                onCopy={numberDelivery.handleCopy}
                onShare={numberDelivery.handleShare}
                question={numberQuestion.trim() || undefined}
              />
            </div>
          ) : null}
        </section>
      ) : null}
    </WorkspacePage>
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
  caseId,
  caseOptions,
  onCaseChange,
}: {
  value: BirthDraft;
  onChange: (next: BirthDraft) => void;
  caseId: string | null;
  caseOptions: readonly DropdownSelectOption<string>[];
  onCaseChange: (caseId: string | null) => void;
}) {
  const isLunar = value.dateType === 'lunar';

  return (
    <section className="workspace-ui-form-surface culture-birth-section">
      <div className="workspace-ui-form-heading">
        <h3>出生资料</h3>
        <DropdownSelect<string>
          value={caseId ?? TEMPORARY_CASE_VALUE}
          options={caseOptions}
          onChange={(next) => onCaseChange(next === TEMPORARY_CASE_VALUE ? null : next)}
          ariaLabel="切换案例"
          prefix="案例"
        />
      </div>
      <div className="workspace-ui-form-body">
        <div className={`workspace-ui-form-row ${isLunar ? 'is-three-column' : 'is-two-column'}`}>
          <div className="workspace-ui-field">
            <label>性别</label>
            <SegmentedControl
              value={value.gender}
              options={[
                { label: '男', value: 'male' as const },
                { label: '女', value: 'female' as const },
              ]}
              onChange={(gender) => onChange({ ...value, gender })}
            />
          </div>
          <div className="workspace-ui-field">
            <label>日历</label>
            <SegmentedControl
              value={isLunar}
              options={[
                { label: '公历', value: false },
                { label: '农历', value: true },
              ]}
              onChange={(next) =>
                onChange({ ...value, dateType: next ? 'lunar' : 'solar', isLeapMonth: false })
              }
            />
          </div>
          {isLunar ? (
            <div className="workspace-ui-field">
              <label>月别</label>
              <SegmentedControl
                value={value.isLeapMonth}
                options={[
                  { label: '平月', value: false },
                  { label: '闰月', value: true },
                ]}
                onChange={(isLeapMonth) => onChange({ ...value, isLeapMonth })}
              />
            </div>
          ) : null}
        </div>
        <div className="workspace-ui-form-row workspace-ui-date-row">
          <div className="workspace-ui-field">
            <label htmlFor="culture-birth-year">年</label>
            <input
              id="culture-birth-year"
              className="workspace-ui-control"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              required
              value={value.year}
              placeholder="2000"
              onChange={(event) => onChange({ ...value, year: event.target.value })}
            />
          </div>
          <div className="workspace-ui-field">
            <label htmlFor="culture-birth-month">月</label>
            <input
              id="culture-birth-month"
              className="workspace-ui-control"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              required
              value={value.month}
              placeholder="1-12"
              onChange={(event) => onChange({ ...value, month: event.target.value })}
            />
          </div>
          <div className="workspace-ui-field">
            <label htmlFor="culture-birth-day">日</label>
            <input
              id="culture-birth-day"
              className="workspace-ui-control"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              required
              value={value.day}
              placeholder="1-31"
              onChange={(event) => onChange({ ...value, day: event.target.value })}
            />
          </div>
        </div>
        <div className="workspace-ui-form-row">
          <div className="workspace-ui-field">
            <label htmlFor="culture-birth-time">时辰</label>
            <DropdownSelect<string>
              id="culture-birth-time"
              value={String(value.timeIndex)}
              options={birthTimeOptions}
              variant="field"
              onChange={(next) =>
                onChange({ ...value, timeIndex: next === '' ? '' : Number(next) })
              }
            />
          </div>
        </div>
      </div>
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
      </header>
      <div>
        {items.map((item) => (
          <span key={item.char} title={item.definition ?? undefined}>
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
        <span>能量序列</span>
        <strong>{result.energySequence}</strong>
        <h3>
          {result.dominantFields.length
            ? `主要磁场 · ${result.dominantFields.join('、')}`
            : '暂无可归类磁场'}
        </h3>
        {result.letterConversions.length ? (
          <p>
            字母换算：
            {result.letterConversions.map((item) => `${item.letter}=${item.value}`).join('、')}
          </p>
        ) : null}
      </div>
      <div className="culture-number-stats">
        <div>
          <span>磁场组合</span>
          <strong>{result.magneticSummary.pairCount}</strong>
        </div>
        <div>
          <span>助益 / 守成</span>
          <strong>{`${result.magneticSummary.supportiveCount} / ${result.magneticSummary.steadyCount}`}</strong>
        </div>
        <div>
          <span>考验组合</span>
          <strong>{result.magneticSummary.challengingCount}</strong>
        </div>
      </div>

      {result.magneticDistribution.length ? (
        <section className="culture-number-distribution">
          <h3>磁场分布</h3>
          <div>
            {result.magneticDistribution.map((item) => (
              <span key={item.name} data-nature={item.nature}>
                <strong>{item.name}</strong>
                <small>{item.count} 组</small>
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {result.modifiers.length ? (
        <section className="culture-number-modifiers">
          <h3>0 与 5 的作用</h3>
          <div>
            {result.modifiers.map((modifier) => (
              <article key={`${modifier.position}-${modifier.digit}`}>
                <strong>{modifier.digit}</strong>
                <div>
                  <span>
                    第 {modifier.position + 1} 位 · {modifier.effect}
                  </span>
                  <small>{modifier.meaning}</small>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {result.energyPairs.length ? (
        <section className="culture-number-pairs">
          <h3>逐组磁场</h3>
          <div>
            {result.energyPairs.map((item, index) => (
              <article key={`${item.start}-${item.end}-${item.pair}`}>
                <div className="culture-number-pair-index">
                  {String(index + 1).padStart(2, '0')}
                </div>
                <div className="culture-number-pair-code">
                  <strong>{item.span}</strong>
                  {item.span !== item.pair ? <small>取 {item.pair}</small> : null}
                </div>
                <div className="culture-number-pair-copy">
                  <header>
                    <strong>{item.name}</strong>
                    <span>{item.group ? `第 ${item.group} 组` : '延续组合'}</span>
                    <span>{item.nature}</span>
                  </header>
                  <p>{item.keywords.join('、')}</p>
                  <small>{item.meaning}</small>
                  {item.modifiers.length ? (
                    <div className="culture-number-pair-modifiers">
                      {item.modifiers.map((modifier, modifierIndex) => (
                        <span key={`${modifier.digit}-${modifierIndex}`}>
                          {modifier.digit} · {modifier.effect}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <div className="culture-number-empty-pairs">当前内容不足以组成八星磁场。</div>
      )}

      <div className="culture-number-rule">
        <strong>换算规则</strong>
        <span>{result.energyFormula}</span>
      </div>
    </article>
  );
}
