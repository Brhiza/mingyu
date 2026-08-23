const workflowSteps = [
  {
    title: '从侧栏选工具',
    description: '命盘、占问和择时工具均有独立入口，手机端点左上角打开侧栏。',
  },
  {
    title: '选择是否使用案例',
    description: '固定使用一个人时选择全局案例；临时排盘时选择“不指定”，每次从空白资料开始。',
  },
  {
    title: '按需使用提示词',
    description: '结果页可复制完整提示词到常用 AI，也可以启用内置 AI 解读作为辅助。',
  },
] as const;

const modeGuides = [
  {
    title: '命盘',
    description: '适合长期保存、反复查看的个人资料。',
    bullets: ['同一个案例可切换八字、紫微、星盘等命盘', '侧栏顶部或手机顶栏可快速切换案例'],
  },
  {
    title: '合盘',
    description: '看两个人的关系和匹配度。',
    bullets: ['当前案例自动作为第一人', '完成后保存为独立合盘记录'],
  },
  {
    title: '占问',
    description: '围绕一个问题快速起卦。',
    bullets: ['先从侧栏选择算法', '可关联当前案例补充出生资料', '结果只进入占问历史'],
  },
  {
    title: '择时',
    description: '从日期范围内筛选更合适的行动日。',
    bullets: ['选择要办的事项', '填写候选日期范围', '按需要补充参与人资料'],
  },
] as const;

const promptUsageTips = [
  '不要只发一句“帮我看看”，直接把整段提示词完整发出。',
  '如果软件支持联网、附件或思考增强功能，先开启再发送。',
  '后续追问可以直接在同一个 AI 对话中继续，不必重新复制盘面。',
] as const;

const commonQuestions = [
  {
    question: '不知道准确出生时间怎么办？',
    answer:
      '知道明确时辰时，可关闭真太阳时并直接选择时辰排盘；只有使用真太阳时才需要精准时分和出生地。连时辰也无法确认时，不应凭大概时间排盘。',
  },
  {
    question: '什么时候用真太阳时？',
    answer: '出生时间和出生地资料完整时可开启。',
  },
  {
    question: '之前做过的内容能不能再看？',
    answer:
      '可以。个人资料用顶部案例选择器切换，占问结果在“历史”中打开，合盘记录可到“案例与历史”管理。',
  },
  {
    question: '怎样固定常用案例？',
    answer:
      '进入“管理案例”置顶个人案例，然后从全局案例中选择。之后切换不同命盘时会继续使用这个人。',
  },
] as const;

export function TutorialPage() {
  return (
    <div className="page-shell input-page-shell workspace-tutorial-page">
      <div className="bazi-view-container tutorial-page-container">
        <header className="workspace-task-header">
          <h1>使用说明</h1>
        </header>
        <section className="history-page-section tutorial-page-section">
          <div className="tutorial-intro-card">
            <p>填写信息，进入结果页，复制提示词，发送到在线 AI 软件继续提问。</p>
          </div>

          <div className="tutorial-section-heading">
            <h3>推荐操作流程</h3>
          </div>

          <div className="tutorial-step-list">
            {workflowSteps.map((step, index) => (
              <article className="tutorial-step-card" key={step.title}>
                <span className="tutorial-step-index">0{index + 1}</span>
                <div className="tutorial-step-copy">
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="tutorial-section-heading">
            <h3>工具类型怎么选</h3>
          </div>

          <div className="tutorial-mode-grid">
            {modeGuides.map((mode) => (
              <article className="tutorial-mode-card" key={mode.title}>
                <h4>{mode.title}</h4>
                <p>{mode.description}</p>
                <ul className="tutorial-bullet-list">
                  {mode.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div className="tutorial-section-heading">
            <h3>提示词怎么发</h3>
          </div>

          <article className="tutorial-ai-card">
            <ul className="tutorial-bullet-list tutorial-bullet-list-compact">
              {promptUsageTips.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>

          <div className="tutorial-section-heading">
            <h3>常见问题</h3>
          </div>

          <div className="tutorial-faq-list">
            {commonQuestions.map((item) => (
              <article className="tutorial-faq-card" key={item.question}>
                <h4>{item.question}</h4>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
