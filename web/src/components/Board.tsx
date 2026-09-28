import { CandidateWithHistory, Stage } from "shared";

interface BoardProps {
  columns: Record<string, CandidateWithHistory[]>;
  onCardClick: (id: number) => void;
  onMove: (candidateId: number, to: Stage, expectedStage: Stage, note?: string) => void;
  getStageClass: (stage: Stage) => string;
}

const STAGE_ORDER: Stage[] = ["Applied", "Screening", "Interview", "Offer", "Hired", "Rejected"];

const NEXT_STAGE: Record<Stage, Stage | null> = {
  Applied: "Screening",
  Screening: "Interview",
  Interview: "Offer",
  Offer: "Hired",
  Hired: null,
  Rejected: null,
};

const STAGE_ICONS: Record<Stage, React.ReactNode> = {
  Applied: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>,
  Screening: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>,
  Interview: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>,
  Offer: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>,
  Hired: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>,
  Rejected: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
};

function CandidateCard({
  candidate,
  onClick,
  onMove,
  getStageClass,
}: {
  candidate: CandidateWithHistory;
  onClick: () => void;
  onMove: (to: Stage, expectedStage: Stage, note?: string) => void;
  getStageClass: (stage: Stage) => string;
}) {
  const nextStage = NEXT_STAGE[candidate.currentStage];
  const canReject = candidate.currentStage !== "Hired" && candidate.currentStage !== "Rejected";

  return (
    <div className="candidate-card" onClick={onClick}>
      <div className="candidate-name">{candidate.name}</div>
      <div className="candidate-meta">
        <span className="candidate-time">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          {candidate.timeInStageDays.toFixed(1)} days
        </span>
        {candidate.email && (
          <span className="candidate-email">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
            {candidate.email}
          </span>
        )}
      </div>
      <div style={{ marginTop: 8 }}>
        <span className={`stage-badge ${getStageClass(candidate.currentStage)}`}>
          {STAGE_ICONS[candidate.currentStage]}
          {candidate.currentStage}
        </span>
      </div>
      <div className="card-actions">
        {nextStage && (
          <button
            className="btn btn-primary"
            onClick={(e) => {
              e.stopPropagation();
              onMove(nextStage, candidate.currentStage, `Moved to ${nextStage}`);
            }}
          >
            Move to {nextStage}
          </button>
        )}
        {canReject && (
          <button
            className="btn btn-danger"
            onClick={(e) => {
              e.stopPropagation();
              onMove("Rejected", candidate.currentStage, "Rejected");
            }}
          >
            Reject
          </button>
        )}
        {!nextStage && !canReject && (
          <span style={{ color: "#666", fontSize: 13, padding: "8px 0" }}>Terminal stage</span>
        )}
      </div>
    </div>
  );
}

function Column({
  stage,
  candidates,
  onCardClick,
  onMove,
  getStageClass,
}: {
  stage: Stage;
  candidates: CandidateWithHistory[];
  onCardClick: (id: number) => void;
  onMove: (candidateId: number, to: Stage, expectedStage: Stage, note?: string) => void;
  getStageClass: (stage: Stage) => string;
}) {
  return (
    <div className="column">
      <div className="column-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {STAGE_ICONS[stage]}
          <span className="column-title">{stage}</span>
        </div>
        <span className="column-count">{candidates.length}</span>
      </div>
      <div className="candidates">
        {candidates.length === 0 ? (
          <div className="empty-column">
            {STAGE_ICONS[stage]}
            <p>No candidates in {stage.toLowerCase()}</p>
          </div>
        ) : (
          candidates.map((candidate) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              onClick={() => onCardClick(candidate.id)}
              onMove={(to, expected, note) => onMove(candidate.id, to, expected, note)}
              getStageClass={getStageClass}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function Board({
  columns,
  onCardClick,
  onMove,
  getStageClass,
}: BoardProps) {
  return (
    <div className="board">
      {STAGE_ORDER.map((stage) => (
        <Column
          key={stage}
          stage={stage}
          candidates={columns[stage] || []}
          onCardClick={onCardClick}
          onMove={onMove}
          getStageClass={getStageClass}
        />
      ))}
    </div>
  );
}