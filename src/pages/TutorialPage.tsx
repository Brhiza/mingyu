import { useNavigate } from 'react-router-dom';
import { PageTopbar } from '@/components/PageTopbar';

const workflowSteps = [
  {
    title: '选模式并填写',
    description: '排盘看个人命盘或住宅，合盘看两人，占卜看问题，择日选时间。',
  },
  {
    title: '先看提示词',
    description: '结果页默认打开“提示词”页；想看盘面时再切到八字或紫微。',
  },
  {
    title: '复制后发送',
    description: '发到 DeepSeek、千问、豆包等在线 AI 软件，优先打开专家模式、深度思考、深度推理。',
  },
] as const;

const modeGuides = [
  {
    title: '排盘模式',
    description: '查看个人命盘或住宅风水。',
    bullets: ['八字 / 紫微填写出生信息', '住宅风水填写出生年份、性别和房屋朝向资料'],
  },
  {
    title: '合盘模式',
    description: '看两个人的关系和匹配度。',
    bullets: ['需要填写双方出生信息', '会展示两人的盘面', '常用于感情、合作、磨合'],
  },
  {
    title: '占卜模式',
    description: '围绕一个问题快速起卦。',
    bullets: ['先把问题写具体', '可选六爻、梅花、太乙、塔罗等方式', '结果页也能一键复制提示词'],
  },
  {
    title: '择日模式',
    description: '从日期范围内筛选更合适的行动日。',
    bullets: ['选择要办的事项', '填写候选日期范围', '可补充参与人的出生信息'],
  },
] as const;

const promptUsageTips = [
  '不要只发一句“帮我看看”，直接把整段提示词完整发出。',
  '如果软件支持联网、附件或思考增强功能，先开启再发送。',
  '项目主要负责生成完整提示词，后续追问可直接交给在线 AI 自带的对话能力。',
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
    answer: '可以，首页和占卜页都能进入历史记录。',
  },
] as const;

export function TutorialPage() {
  const navigate = useNavigate();

  return (
    <div className="page-shell input-page-shell">
      <div className="tutorial-topbar-shell">
        <PageTopbar title="使用教程" wide onBack={() => navigate('/')} />
      </div>

      <div className="bazi-view-container tutorial-page-container">
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
            <h3>四种模式怎么选</h3>
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
