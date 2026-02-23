"use client";

import { useState, useMemo } from "react";

interface WorkSession {
  id: string;
  punchIn: string; // "HH:mm"
  punchOut: string; // "HH:mm"
}

interface Props {
  onRefresh: () => void;
}

function genId() {
  return Math.random().toString(36).slice(2);
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function msToDur(ms: number): string {
  if (ms <= 0) return "0m";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function ManualEntryPanel({ onRefresh }: Props) {
  const [date, setDate] = useState(todayStr());
  const [sessions, setSessions] = useState<WorkSession[]>([
    { id: genId(), punchIn: "09:00", punchOut: "18:00" },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const addSession = () => {
    const last = sessions[sessions.length - 1];
    // Default new session starts at last punchOut + 30m
    const lastOutMin = timeToMinutes(last?.punchOut || "18:00");
    const newInMin = lastOutMin + 30;
    const newInH = Math.floor(newInMin / 60);
    const newInM = newInMin % 60;
    const newInStr = `${String(newInH).padStart(2, "0")}:${String(newInM).padStart(2, "0")}`;
    const newOutMin = newInMin + 60;
    const newOutH = Math.floor(newOutMin / 60);
    const newOutM = newOutMin % 60;
    const newOutStr = `${String(Math.min(newOutH, 23)).padStart(2, "0")}:${String(newOutM % 60).padStart(2, "0")}`;
    setSessions([
      ...sessions,
      { id: genId(), punchIn: newInStr, punchOut: newOutStr },
    ]);
  };

  const removeSession = (id: string) => {
    if (sessions.length === 1) return;
    setSessions(sessions.filter((s) => s.id !== id));
  };

  const updateSession = (
    id: string,
    field: "punchIn" | "punchOut",
    value: string,
  ) => {
    setSessions(
      sessions.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    );
  };

  const summary = useMemo(() => {
    let workMs = 0;
    let breakMs = 0;
    sessions.forEach((s, i) => {
      const inMin = timeToMinutes(s.punchIn);
      const outMin = timeToMinutes(s.punchOut);
      if (outMin > inMin) workMs += (outMin - inMin) * 60000;
      const next = sessions[i + 1];
      if (next) {
        const gap = timeToMinutes(next.punchIn) - outMin;
        if (gap > 0) breakMs += gap * 60000;
      }
    });
    return { workMs, breakMs };
  }, [sessions]);

  const handleSubmit = async () => {
    setError("");
    setSuccess(false);

    // Validate
    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];
      if (timeToMinutes(s.punchOut) <= timeToMinutes(s.punchIn)) {
        setError(`Session ${i + 1}: punch-out must be after punch-in.`);
        return;
      }
      if (i > 0) {
        const prev = sessions[i - 1];
        if (timeToMinutes(s.punchIn) < timeToMinutes(prev.punchOut)) {
          setError(`Session ${i + 1} overlaps with session ${i}.`);
          return;
        }
      }
    }

    setLoading(true);
    try {
      const sessionData = sessions.map((s) => {
        const punchIn = new Date(`${date}T${s.punchIn}:00`);
        const punchOut = new Date(`${date}T${s.punchOut}:00`);
        const totalHours = (punchOut.getTime() - punchIn.getTime()) / 3600000;
        return {
          punchIn: punchIn.toISOString(),
          punchOut: punchOut.toISOString(),
          totalHours,
        };
      });

      const res = await fetch("/api/worklog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "bulk", date, sessions: sessionData }),
      });

      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Failed to save record.");
        return;
      }

      setSuccess(true);
      onRefresh();
      setSessions([{ id: genId(), punchIn: "09:00", punchOut: "18:00" }]);
      setDate(todayStr());
      setTimeout(() => setSuccess(false), 4000);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="manual-entry-panel animate-in">
      {/* Panel Header */}
      <div className="mep-header">
        <div className="mep-header-icon">📋</div>
        <div>
          <h2 className="mep-title">Add Past Day Record</h2>
          <p className="mep-subtitle">
            Record previous days&apos; work sessions manually
          </p>
        </div>
      </div>

      {/* Date Picker */}
      <div className="form-group">
        <label htmlFor="mep-date">Date</label>
        <input
          id="mep-date"
          type="date"
          value={date}
          max={todayStr()}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {/* Session Builder */}
      <div className="mep-sessions-label">Work Sessions</div>
      <div className="mep-sessions">
        {sessions.map((session, i) => (
          <div key={session.id}>
            {/* Session Row */}
            <div className="mep-session-row">
              <div className="mep-session-num">{i + 1}</div>
              <div className="mep-time-pair">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>In</label>
                  <input
                    type="time"
                    value={session.punchIn}
                    onChange={(e) =>
                      updateSession(session.id, "punchIn", e.target.value)
                    }
                  />
                </div>
                <span className="mep-arrow">→</span>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Out</label>
                  <input
                    type="time"
                    value={session.punchOut}
                    onChange={(e) =>
                      updateSession(session.id, "punchOut", e.target.value)
                    }
                  />
                </div>
              </div>
              {sessions.length > 1 && (
                <button
                  className="mep-remove-btn"
                  onClick={() => removeSession(session.id)}
                  title="Remove session"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Break Indicator Between Sessions */}
            {i < sessions.length - 1 &&
              (() => {
                const breakMin =
                  timeToMinutes(sessions[i + 1].punchIn) -
                  timeToMinutes(session.punchOut);
                return (
                  <div className="mep-break-indicator">
                    <div className="mep-break-line" />
                    <span className="mep-break-label">
                      ☕ Break ·{" "}
                      {breakMin > 0 ? msToDur(breakMin * 60000) : "⚠ invalid"}
                    </span>
                    <div className="mep-break-line" />
                  </div>
                );
              })()}
          </div>
        ))}
      </div>

      <button className="mep-add-session-btn" onClick={addSession}>
        + Add Another Session
      </button>

      {/* Summary */}
      {summary.workMs > 0 && (
        <div className="mep-summary">
          <div className="mep-summary-chip work">
            <span>⏱ Work</span>
            <strong className="mono">{msToDur(summary.workMs)}</strong>
          </div>
          {summary.breakMs > 0 && (
            <div className="mep-summary-chip break">
              <span>☕ Break</span>
              <strong className="mono">{msToDur(summary.breakMs)}</strong>
            </div>
          )}
        </div>
      )}

      {error && <div className="auth-error">{error}</div>}
      {success && (
        <div className="mep-success">✅ Record saved! Calendar updated.</div>
      )}

      <button
        className="btn-primary btn-full"
        onClick={handleSubmit}
        disabled={loading}
        style={{ marginTop: 8 }}
      >
        {loading ? (
          <span className="btn-loading">
            <span className="spinner" />
            Saving...
          </span>
        ) : (
          "💾 Save Day Record"
        )}
      </button>
    </div>
  );
}
