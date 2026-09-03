export type WorkspaceLaunchState = {
  workspaceNew: boolean;
  initialQuestion: string;
  initialSupplementaryInfo: string;
  autoSubmit: boolean;
  initialGender?: '男' | '女' | '';
  initialBirthYear?: string;
};

export function readWorkspaceLaunchState(value: unknown): WorkspaceLaunchState {
  const state = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const rawGender = state.initialGender;
  const initialGender = rawGender === '男' || rawGender === '女' ? rawGender : '';
  const initialBirthYear =
    typeof state.initialBirthYear === 'string'
      ? state.initialBirthYear.replace(/[^\d]/g, '').slice(0, 4)
      : '';

  return {
    workspaceNew: state.workspaceNew === true,
    initialQuestion: typeof state.initialQuestion === 'string' ? state.initialQuestion.trim() : '',
    initialSupplementaryInfo:
      typeof state.initialSupplementaryInfo === 'string'
        ? state.initialSupplementaryInfo.trim()
        : '',
    autoSubmit: state.autoSubmit === true,
    initialGender,
    initialBirthYear,
  };
}

export function buildWorkspaceLaunchState(
  question?: string,
  options?: {
    autoSubmit?: boolean;
    supplementaryInfo?: string;
    gender?: '男' | '女' | '';
    birthYear?: string;
  },
): WorkspaceLaunchState {
  const rawGender = options?.gender;
  return {
    workspaceNew: true,
    initialQuestion: question?.trim() ?? '',
    initialSupplementaryInfo: options?.supplementaryInfo?.trim() ?? '',
    autoSubmit: options?.autoSubmit === true,
    initialGender: rawGender === '男' || rawGender === '女' ? rawGender : '',
    initialBirthYear: options?.birthYear ? options.birthYear.replace(/[^\d]/g, '').slice(0, 4) : '',
  };
}

export function buildWorkspaceLaunchQuestion(question?: string, supplementaryInfo?: string) {
  const normalizedQuestion = question?.trim() ?? '';
  const normalizedSupplementaryInfo = supplementaryInfo?.trim() ?? '';
  if (!normalizedSupplementaryInfo) return normalizedQuestion;
  if (!normalizedQuestion) return `补充信息：${normalizedSupplementaryInfo}`;
  return `${normalizedQuestion}\n\n补充信息：${normalizedSupplementaryInfo}`;
}
