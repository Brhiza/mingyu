/**
 * TrustEngine T2 — 隐私安全
 * 
 * 隐私政策页，展示完整的隐私承诺
 * 不显示横幅，信任在此沉淀，避免自我指涉
 */

import { Link } from 'react-router-dom';

/**
 * T2 信任引擎组件
 * 
 * 展示完整的隐私政策和数据处理承诺。
 * 这是信任漏斗中"信任沉淀"的阶段——用户主动查阅隐私政策。
 * 
 * 注意：T2 不显示信任横幅，避免自我指涉。
 * 
 * 使用方式：
 * - 挂载在 '/privacy' 路由
 */
export function TrustEngineT2() {
  return (
    <div className="trust-engine trust-engine--t2">
      <div className="trust-engine__content">
        <h1 className="trust-engine__title">隐私政策</h1>
        
        <section className="trust-engine__section">
          <h2 className="trust-engine__section-title">数据收集</h2>
          <div className="trust-engine__section-content">
            <p>我们不收集您的任何个人信息。</p>
            <p>所有计算均在您的设备上本地完成，不会上传到服务器。</p>
            <p>仅将输入的信息存储在您设备的浏览器本地存储中。</p>
          </div>
        </section>

        <section className="trust-engine__section">
          <h2 className="trust-engine__section-title">数据使用</h2>
          <div className="trust-engine__section-content">
            <p>我们不会出售、分享或以任何方式泄露您的个人信息。</p>
            <p>我们不使用任何第三方跟踪工具。</p>
          </div>
        </section>

        <section className="trust-engine__section">
          <h2 className="trust-engine__section-title">您的权利</h2>
          <div className="trust-engine__section-content">
            <p>您可以随时在记录页删除所有本地存储的数据。</p>
            <p>您可以导出您的数据，随时带走。</p>
          </div>
        </section>

        <div className="trust-engine__action">
          <Link to="/" className="trust-engine__btn trust-engine__btn--secondary">
            返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}
