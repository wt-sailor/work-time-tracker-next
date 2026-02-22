"use client";

import { useEffect, useState } from "react";
import {
  useWorkTimer,
  formatShortTime,
  TimerLog,
  TimerStatus,
  TimerState,
} from "@/hooks/useWorkTimer";

interface DashboardClientProps {
  initialTimerState: TimerState | null;
}

// ─── Helpers ─────────────────────────────────────────────────
function timeStrToMs(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

function nowTimeStr(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── Build tabular session pairs from log ─────────────────────
interface SessionRow {
  punchIn: number;
  punchOut: number | null; // null = ongoing
}

function buildSessionRows(logs: TimerLog[], status: TimerStatus): SessionRow[] {
  // Sort oldest → newest
  const sorted = [...logs].sort((a, b) => a.time - b.time);
  const rows: SessionRow[] = [];
  let currentIn: number | null = null;

  for (const log of sorted) {
    if (log.type === "Start" || log.type === "Punch In (Work)") {
      currentIn = log.time;
    } else if (log.type === "Punch Out (Break)" && currentIn !== null) {
      rows.push({ punchIn: currentIn, punchOut: log.time });
      currentIn = null;
    }
  }

  // If currently working, the last punch-in hasn't been closed yet
  if (status === "working" && currentIn !== null) {
    rows.push({ punchIn: currentIn, punchOut: null });
  }

  return rows;
}

// ─── Modal: Add Break Entry ───────────────────────────────────
interface AddBreakModalProps {
  onClose: () => void;
  onSubmit: (punchOut: string, punchIn: string) => string | null;
}

function AddBreakModal({ onClose, onSubmit }: AddBreakModalProps) {
  const [punchOut, setPunchOut] = useState(nowTimeStr());
  const [punchIn, setPunchIn] = useState(nowTimeStr());
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const err = onSubmit(punchOut, punchIn);
    if (err) setError(err);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-icon">☕</span>
          <h2>Add Break Entry</h2>
          <p className="modal-subtitle">Manually record a break you already took (any time today)</p>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {error && <div className="auth-error">{error}</div>}

          <div className="modal-time-row">
            <div className="form-group">
              <label htmlFor="breakPunchOut">Break Started</label>
              <input
                id="breakPunchOut"
                type="time"
                value={punchOut}
                onChange={(e) => setPunchOut(e.target.value)}
                required
              />
            </div>
            <div className="modal-time-arrow">→</div>
            <div className="form-group">
              <label htmlFor="breakPunchIn">Break Ended</label>
              <input
                id="breakPunchIn"
                type="time"
                value={punchIn}
                onChange={(e) => setPunchIn(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              ✅ Add Break
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: Late Punch-In ─────────────────────────────────────
interface LatePunchInModalProps {
  onClose: () => void;
  onSubmit: (punchIn: string) => string | null;
}

function LatePunchInModal({ onClose, onSubmit }: LatePunchInModalProps) {
  const [punchIn, setPunchIn] = useState(nowTimeStr());
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const err = onSubmit(punchIn);
    if (err) setError(err);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-icon">▶</span>
          <h2>Resume Work</h2>
          <p className="modal-subtitle">Set the time you actually resumed working</p>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {error && <div className="auth-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="latePunchIn">Punch-In Time</label>
            <input
              id="latePunchIn"
              type="time"
              value={punchIn}
              onChange={(e) => setPunchIn(e.target.value)}
              required
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-punch-in">
              ▶ Start Working
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Session Table ────────────────────────────────────────────
function SessionTable({ logs, status }: { logs: TimerLog[]; status: TimerStatus }) {
  const rows = buildSessionRows(logs, status);
  if (rows.length === 0) return null;

  return (
    <div className="activity-section">
      <h3>Sessions</h3>
      <div className="session-table-wrapper">
        <table className="session-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Punch In</th>
              <th>Punch Out</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const durationMs = row.punchOut
                ? row.punchOut - row.punchIn
                : Date.now() - row.punchIn;
              const h = Math.floor(durationMs / 3600000);
              const m = Math.floor((durationMs % 3600000) / 60000);
              const durationStr = h > 0 ? `${h}h ${m}m` : `${m}m`;

              return (
                <tr key={i} className={row.punchOut === null ? "session-row-active" : ""}>
                  <td className="session-num">{i + 1}</td>
                  <td className="mono">{fmtTime(row.punchIn)}</td>
                  <td className="mono">
                    {row.punchOut ? fmtTime(row.punchOut) : <span className="session-ongoing">ongoing</span>}
                  </td>
                  <td className="mono session-duration">{durationStr}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────
export default function DashboardClient({
  initialTimerState,
}: DashboardClientProps) {
  const {
    state,
    totalWork,
    totalBreak,
    remainingWork,
    remainingBreak,
    isOvertime,
    lastSynced,
    isLoaded,
    startDay,
    punchToggle,
    addHistoricalBreak,
    resetDay,
    formatTime: ft,
  } = useWorkTimer(initialTimerState);

  const [workHours, setWorkHours] = useState(8);
  const [workMinutes, setWorkMinutes] = useState(0);
  const [breakMinutes, setBreakMinutes] = useState(60);
  const [entryTime, setEntryTime] = useState("");
  const [timeStr, setTimeStr] = useState<string>("");
  const [leaveTimeStr, setLeaveTimeStr] = useState<string>("");
  const [earlyLeaveTimeStr, setEarlyLeaveTimeStr] = useState<string>("");
  const [startTimeStr, setStartTimeStr] = useState<string>("--:--");
  const [lastSyncedStr, setLastSyncedStr] = useState<string>("");

  // Modal state
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [showLatePunchInModal, setShowLatePunchInModal] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = Date.now();
      setTimeStr(new Date(now).toLocaleTimeString());

      if (remainingWork) {
        const targetTime = now + remainingWork;
        setLeaveTimeStr(
          new Date(targetTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        );
        setEarlyLeaveTimeStr(
          new Date(targetTime - 29 * 60000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        );
      }

      if (state.startTime) {
        setStartTimeStr(
          new Date(state.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        );
      } else {
        setStartTimeStr("--:--");
      }

      if (lastSynced) {
        setLastSyncedStr(
          lastSynced.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        );
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [remainingWork, state.startTime, lastSynced]);

  useEffect(() => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, "0");
    const m = String(now.getMinutes()).padStart(2, "0");
    setEntryTime(`${h}:${m}`);
  }, []);

  if (!isLoaded) {
    return (
      <div className="page-loader">
        <div className="loader-spinner" />
      </div>
    );
  }

  const handleStartDay = () => {
    startDay(workHours, workMinutes, breakMinutes, entryTime);
  };

  // ── Historical break: inserts at any past time ───────────────
  const handleAddBreak = (punchOutStr: string, punchInStr: string): string | null => {
    const punchOutMs = timeStrToMs(punchOutStr);
    const punchInMs = timeStrToMs(punchInStr);
    const r = addHistoricalBreak(punchOutMs, punchInMs);
    if (!r.success) return r.error ?? "Failed to add break.";
    setShowBreakModal(false);
    return null;
  };

  // ── Late punch-in: resume from a specific past time ──────────
  const handleLatePunchIn = (punchInStr: string): string | null => {
    if (state.status !== "break") return "You are not currently on break.";
    const punchInMs = timeStrToMs(punchInStr);
    if (punchInMs > Date.now()) return "Punch-In time cannot be in the future.";
    const r = punchToggle(punchInMs);
    if (!r.success) return r.error ?? "Failed to punch in.";
    setShowLatePunchInModal(false);
    return null;
  };

  return (
    <>
      {showBreakModal && (
        <AddBreakModal
          onClose={() => setShowBreakModal(false)}
          onSubmit={handleAddBreak}
        />
      )}
      {showLatePunchInModal && (
        <LatePunchInModal
          onClose={() => setShowLatePunchInModal(false)}
          onSubmit={handleLatePunchIn}
        />
      )}

      <div className="main-content">
        {!state.isActive ? (
          /* ─── Setup Form ─── */
          <div className="glass-card setup-card animate-in">
            <div className="card-header">
              <h1 className="gradient-text">Work Time Tracker</h1>
              <p className="subtitle">Plan your day efficiently.</p>
            </div>

            <div className="form-group">
              <label>Work Duration</label>
              <div className="dual-input">
                <div className="input-half">
                  <span className="input-label-small">Hours</span>
                  <input
                    type="number"
                    id="workHours"
                    value={workHours}
                    onChange={(e) => setWorkHours(Number(e.target.value))}
                    min="0" max="24"
                  />
                </div>
                <div className="input-half">
                  <span className="input-label-small">Minutes</span>
                  <input
                    type="number"
                    id="workMinutes"
                    value={workMinutes}
                    onChange={(e) => setWorkMinutes(Number(e.target.value))}
                    min="0" max="59"
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label>Break Time (Minutes)</label>
              <input
                type="number"
                id="breakMinutes"
                value={breakMinutes}
                onChange={(e) => setBreakMinutes(Number(e.target.value))}
                min="0"
              />
            </div>

            <div className="form-group">
              <label>Entry Time</label>
              <input
                type="time"
                id="entryTime"
                value={entryTime}
                onChange={(e) => setEntryTime(e.target.value)}
              />
            </div>

            <button onClick={handleStartDay} className="btn-primary btn-full">
              🚀 Start Day
            </button>
          </div>
        ) : (
          /* ─── Active Timer ─── */
          <div className="glass-card dashboard-card animate-in">
            <div className="dash-header">
              <span className={`status-badge ${state.status === "working" ? "working" : "on-break"}`}>
                {state.status === "working" ? "● Working" : "◉ On Break"}
              </span>
              <span className="clock-display mono">{timeStr}</span>
            </div>

            <div className="timer-hero">
              <span className="timer-label">
                {isOvertime ? "Overtime" : "Remaining work"}
              </span>
              <span className={`timer-value mono ${isOvertime ? "overtime" : ""}`}>
                {isOvertime ? "+" : ""}
                {ft(Math.abs(remainingWork))}
              </span>
            </div>

            {!isOvertime && (
              <div className="leave-time-display">
                <span className="leave-time-label">You can leave at </span>
                <span
                  className="leave-time-value mono"
                  title={`Early leave: ${earlyLeaveTimeStr}`}
                >
                  {leaveTimeStr}
                </span>
              </div>
            )}

            <div className="sync-status">
              <span className="sync-dot" />
              <span>
                Auto-sync active
                {lastSyncedStr && <> · Last synced {lastSyncedStr}</>}
              </span>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-label">Worked</span>
                <span className="stat-value mono">{formatShortTime(totalWork)}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Break Used</span>
                <span className="stat-value mono">{formatShortTime(totalBreak)}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Break Left</span>
                <span className={`stat-value mono ${remainingBreak <= 0 ? "danger" : ""}`}>
                  {formatShortTime(Math.max(0, remainingBreak))}
                </span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Entry Time</span>
                <span className="stat-value mono">{startTimeStr}</span>
              </div>
            </div>

            {/* ─── Action Buttons ─── */}
            <div className="punch-actions">
              {state.status === "working" ? (
                <>
                  <button onClick={() => punchToggle()} className="btn-punch-out btn-full">
                    ⏸ Punch Out
                  </button>
                  <button onClick={() => setShowBreakModal(true)} className="btn-break btn-full">
                    ☕ Add Break Entry
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => punchToggle()} className="btn-punch-in btn-full">
                    ▶ Punch In (Now)
                  </button>
                  <button onClick={() => setShowLatePunchInModal(true)} className="btn-late-punchin btn-full">
                    🕐 I Already Resumed — Set Time
                  </button>
                </>
              )}
            </div>

            {/* ─── Session Table ─── */}
            <SessionTable logs={state.logs} status={state.status} />

            <button onClick={resetDay} className="btn-danger">
              ↺ Reset Day
            </button>
          </div>
        )}
      </div>
    </>
  );
}
