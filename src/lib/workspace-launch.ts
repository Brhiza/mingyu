export type WorkspaceLaunchState = {
  workspaceNew: boolean;
  initialQuestion: string;
  autoSubmit: boolean;
};

export function readWorkspaceLaunchState(value: unknown): WorkspaceLaunchState {
  const state = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

  return {
    workspaceNew: state.workspaceNew === true,
    initialQuestion: typeof state.initialQuestion === 'string' ? state.initialQuestion.trim() : '',
    autoSubmit: state.autoSubmit === true,
  };
}

export function buildWorkspaceLaunchState(
  question?: string,
  options?: { autoSubmit?: boolean },
): WorkspaceLaunchState {
  return {
    workspaceNew: true,
    initialQuestion: question?.trim() ?? '',
    autoSubmit: options?.autoSubmit === true,
  };
}
