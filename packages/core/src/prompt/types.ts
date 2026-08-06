export interface PromptDocument {
  /** 可直接交给支持 system/user 分层模型的系统指令。 */
  system: string;
  /** 可直接交给模型的完整任务书正文。 */
  user: string;
  /** 将 system 与 user 合并后的便携文本。 */
  text: string;
}

export interface PromptBuildOptions {
  /** 当前时间；不传时使用运行环境当前时间。 */
  currentTime?: Date;
  /** 用户问题。 */
  question?: string;
}
