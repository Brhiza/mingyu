import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { DivinationPanel } from '@/components/DivinationPanel';
import { buildWorkspaceFeaturePath, isDivinationWorkspaceId } from '@/lib/workspace';

function useDivinationMethod() {
  const { method } = useParams();
  return isDivinationWorkspaceId(method) ? method : null;
}

export function DivinationPage() {
  const navigate = useNavigate();
  const location = useLocation();
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
        onGenerated={(recordId, requestedMethod) =>
          navigate(`/divination/${requestedMethod}/result?record=${encodeURIComponent(recordId)}`)
        }
      />
    </div>
  );
}

export function DivinationResultPage() {
  const navigate = useNavigate();
  const method = useDivinationMethod();
  if (!method) {
    return <Navigate to="/divination/random" replace />;
  }

  return (
    <div className="workspace-focused-page workspace-divination-result-page">
      <div className="workspace-result-toolbar">
        <button type="button" onClick={() => navigate(buildWorkspaceFeaturePath(method))}>
          再问一次
        </button>
        <button type="button" onClick={() => navigate('/records?tab=divination')}>
          查看占问记录
        </button>
      </div>
      <DivinationPanel initialMethod={method} lockedMethod={method} displayMode="result" />
    </div>
  );
}
