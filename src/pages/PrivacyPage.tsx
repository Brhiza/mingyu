import { useNavigate } from 'react-router-dom';
import { PageTopbar } from '@/components/PageTopbar';

const policySections = [
  {
    title: '我们收集什么',
    body: [
      '命语在本地浏览器中保存你主动填写的信息，例如姓名、出生日期、出生时间与出生地，用于生成排盘结果与历史记录。',
      '若你启用了站点内置 AI 解读，相关出生信息会按你的设置发送到所配置的服务端进行处理；具体以 AI 设置面板中的开关与配置为准。',
    ],
  },
  {
    title: '数据存在哪里',
    body: [
      '常规排盘所需的姓名、出生日期等信息默认仅保存在你的本地浏览器（localStorage / IndexedDB），不会自动上传到任何服务器。',
      '你可以随时在首页或记录页清除本地记录；清除后数据将无法恢复。',
    ],
  },
  {
    title: '如何删除你的数据',
    body: [
      '在浏览器中清除本站点的本地存储，或直接使用站点内的「清除记录」操作，即可删除保存在本设备上的全部个人数据。',
      '若你曾使用服务端 AI 功能，请一并退出对应服务并联系我们删除相关处理记录。',
    ],
  },
  {
    title: 'Cookie 与本地存储',
    body: [
      '本站使用浏览器本地存储来记住你的偏好（如关闭提示、AI 设置）。我们不通过第三方 Cookie 跨站追踪你。',
    ],
  },
  {
    title: '联系方式',
    body: [
      '如对本隐私政策有任何疑问，或希望删除服务端处理记录，请通过站点设置中的反馈入口联系我们。',
    ],
  },
] as const;

export function PrivacyPage() {
  const navigate = useNavigate();

  return (
    <div className="page-shell input-page-shell">
      <div className="tutorial-topbar-shell">
        <PageTopbar title="隐私政策" wide onBack={() => navigate('/')} />
      </div>

      <div className="bazi-view-container tutorial-page-container">
        <section className="history-page-section tutorial-page-section">
          <div className="tutorial-intro-card">
            <p>最后更新：2026-08-08。本政策说明命语如何处理你的信息，以及你如何管理自己的数据。</p>
          </div>

          <div className="tutorial-section-heading">
            <h3>核心原则</h3>
          </div>
          <article className="tutorial-ai-card">
            <ul className="tutorial-bullet-list">
              <li>姓名、出生日期等常规排盘信息默认仅保存在你的本地浏览器，不会自动上传。</li>
              <li>我们尽力减少数据收集，不做跨站追踪，不向第三方出售你的个人数据。</li>
            </ul>
          </article>

          {policySections.map((section) => (
            <div key={section.title}>
              <div className="tutorial-section-heading">
                <h3>{section.title}</h3>
              </div>
              <article className="tutorial-faq-card">
                {section.body.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </article>
            </div>
          ))}

          <div className="tutorial-section-heading">
            <h3>免责声明</h3>
          </div>
          <article className="tutorial-ai-card">
            <p>
              For entertainment and self-reflection purposes only. Not a substitute for professional
              advice.
            </p>
            <p>
              命语提供的排盘与解读内容仅用于文化娱乐与自我反思，不构成任何医疗、法律、财务或人生决策建议。人生重大选择请咨询具备资质的专业人士。
            </p>
          </article>
        </section>
      </div>
    </div>
  );
}
