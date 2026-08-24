import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { DivinationPanel } from '@/components/DivinationPanel';
import { buildWorkspaceFeaturePath, isDivinationWorkspaceId } from '@/lib/workspace';
import { readWorkspaceLaunchState } from '@/lib/workspace-launch';

function useDivinationMethod() {
  const { method } = useParams();
  return isDivinationWorkspaceId(method) ? method : null;
}

export function DivinationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const launchState = readWorkspaceLaunchState(location.state);
  const method = useDivinationMethod();
  if (!method) {
    return <Navigate to="/divination/random" replace />;
  }

  return (
    <div className="workspace-focused-page workspace-divination-page">
      <DivinationPanel
        key={location.key}
        initialMethod={method}
        lockedMethod={method}
        displayMode="input"
        initialQuestion={launchState.initialQuestion}
        autoSubmit={launchState.autoSubmit}
        onGenerated={(recordId, requestedMethod) =>
          navigate(`/divination/${requestedMethod}/result?record=${encodeURIComponent(recordId)}`)
        }
      />
    </div>
  );
}

type DivinationResultPageProps = {
  assistantOnly?: boolean;
};

export function DivinationResultPage({ assistantOnly = false }: DivinationResultPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const method = useDivinationMethod();
  if (!method) {
    return <Navigate to="/divination/random" replace />;
  }

  return (
    <div className="workspace-focused-page workspace-divination-result-page">
      <DivinationPanel
        initialMethod={method}
        lockedMethod={method}
        displayMode="result"
        assistantOnly={assistantOnly}
        onOpenAssistant={() => navigate(`/divination/${method}/result/assistant${location.search}`)}
        onReturnToBoard={() => navigate(`/divination/${method}/result${location.search}`)}
        onRestart={() => navigate(buildWorkspaceFeaturePath(method))}
      />
    </div>
  );
}
