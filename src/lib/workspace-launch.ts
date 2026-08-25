export type WorkspaceLaunchState = {
  workspaceNew: boolean;
  initialQuestion: string;
  initialSupplementaryInfo: string;
  autoSubmit: boolean;
};

export function readWorkspaceLaunchState(value: unknown): WorkspaceLaunchState {
  const state = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

  return {
    workspaceNew: state.workspaceNew === true,
    initialQuestion: typeof state.initialQuestion === 'string' ? state.initialQuestion.trim() : '',
    initialSupplementaryInfo:
      typeof state.initialSupplementaryInfo === 'string'
        ? state.initialSupplementaryInfo.trim()
        : '',
    autoSubmit: state.autoSubmit === true,
  };
}

export function buildWorkspaceLaunchState(
  question?: string,
  options?: { autoSubmit?: boolean; supplementaryInfo?: string },
): WorkspaceLaunchState {
  return {
    workspaceNew: true,
    initialQuestion: question?.trim() ?? '',
    initialSupplementaryInfo: options?.supplementaryInfo?.trim() ?? '',
    autoSubmit: options?.autoSubmit === true,
  };
}

export function buildWorkspaceLaunchQuestion(question?: string, supplementaryInfo?: string) {
  const normalizedQuestion = question?.trim() ?? '';
  const normalizedSupplementaryInfo = supplementaryInfo?.trim() ?? '';
  if (!normalizedSupplementaryInfo) return normalizedQuestion;
  if (!normalizedQuestion) return `补充信息：${normalizedSupplementaryInfo}`;
  return `${normalizedQuestion}\n\n补充信息：${normalizedSupplementaryInfo}`;
}
