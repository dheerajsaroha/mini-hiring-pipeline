import { CandidateWithHistory, Stage } from "shared";

interface CandidateDrawerProps {
  candidate: CandidateWithHistory;
  onClose: () => void;
  onMove: (candidateId: number, to: Stage, expectedStage: Stage, note?: string) => void;
  getStageClass: (stage: Stage) => string;
  formatDate: (dateString: string) => string;
}

const STAGE_ICONS: Record<Stage, React.ReactNode> = {
  Applied: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>,
  Screening: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>,
  Interview: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>,
  Offer: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>,
  Hired: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>,
  Rejected: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
};

const NEXT_STAGE: Record<Stage, Stage | null> = {
  Applied: "Screening",
  Screening: "Interview",
  Interview: "Offer",
  Offer: "Hired",
  Hired: null,
  Rejected: null,
};

export default function CandidateDrawer({
  candidate,
  onClose,
  onMove,
  getStageClass,
  formatDate,
}: CandidateDrawerProps) {
  const nextStage = NEXT_STAGE[candidate.currentStage];
  const canReject = candidate.currentStage !== "Hired" && candidate.currentStage !== "Rejected";

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  return (
    <>
      <div className="drawer-overlay" onClick={onClose}></div>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <h2 className="drawer-title">{candidate.name}</h2>
            <div style={{ marginTop: 8 }}>
              <span className={`stage-badge ${getStageClass(candidate.currentStage)}`}>
                {STAGE_ICONS[candidate.currentStage]}
                {candidate.currentStage}
              </span>
            </div>
          </div>
          <button className="drawer-close" onClick={handleClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="drawer-content">
          <div className="drawer-section">
            <div className="drawer-section-title">Details</div>
            <div className="detail-row">
              <span className="detail-label">Email</span>
              <span className="detail-value">{candidate.email || "—"}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Created</span>
              <span className="detail-value">{formatDate(candidate.createdAt)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Current Stage</span>
              <span className="detail-value">
                <span className={`stage-badge ${getStageClass(candidate.currentStage)}`}>
                  {candidate.currentStage}
                </span>
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Time in Stage</span>
              <span className="detail-value">{candidate.timeInStageDays.toFixed(1)} days</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Entered Stage</span>
              <span className="detail-value">
                {candidate.history.length > 0
                  ? formatDate(candidate.history[candidate.history.length - 1].occurredAt)
                  : formatDate(candidate.createdAt)}
              </span>
            </div>
          </div>

          <div className="drawer-section">
            <div className="drawer-section-title">Timeline</div>
            <div className="timeline">
              {candidate.history.map((event) => {
                const eventType = event.fromStage === null ? "created" :
                                  event.toStage === "Hired" ? "hired" :
                                  event.toStage === "Rejected" ? "rejected" : "moved";
                return (
                  <div
                    key={event.id}
                    className={`timeline-item ${event.toStage === "Rejected" ? "rejected" : ""} ${event.toStage === "Hired" ? "hired" : ""}`}
                  >
                    <div className="timeline-dot" />
                    <div className="timeline-content">
                      <div className="timeline-event">
                        {eventType === "created" && "Candidate added"}
                        {eventType === "moved" && `Moved: ${event.fromStage} → ${event.toStage}`}
                        {eventType === "hired" && "Hired"}
                        {eventType === "rejected" && `Rejected from ${event.fromStage}`}
                      </div>
                      {event.note && <div className="timeline-note">{event.note}</div>}
                      <div className="timeline-time">{formatDate(event.occurredAt)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ padding: "16px 20px", borderTop: "1px solid #e0e0e0", display: "flex", gap: 8 }}>
          {nextStage && (
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={(e) => {
                e.stopPropagation();
                onMove(candidate.id, nextStage, candidate.currentStage, `Moved to ${nextStage}`);
              }}
            >
              Move to {nextStage}
            </button>
          )}
          {canReject && (
            <button
              className="btn btn-danger"
              style={{ flex: 1 }}
              onClick={(e) => {
                e.stopPropagation();
                onMove(candidate.id, "Rejected", candidate.currentStage, "Rejected");
              }}
            >
              Reject
            </button>
          )}
        </div>
      </div>
    </>
  );
}