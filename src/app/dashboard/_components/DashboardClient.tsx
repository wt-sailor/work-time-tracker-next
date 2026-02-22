"use client";

import { useEffect, useState } from "react";
import {
  useWorkTimer,
  formatShortTime,
  TimerState,
} from "@/hooks/useWorkTimer";
import Navbar from "@/components/Navbar";

interface DashboardClientProps {
  initialTimerState: TimerState | null;
}

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

  useEffect(() => {
    const updateTime = () => {
      const now = Date.now();
      setTimeStr(new Date(now).toLocaleTimeString());

      if (remainingWork) {
        const targetTime = now + remainingWork;
        setLeaveTimeStr(
          new Date(targetTime).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        );
        setEarlyLeaveTimeStr(
          new Date(targetTime - 29 * 60000).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        );
      }

      // Format startTime and lastSynced safely on client
      if (state.startTime) {
        setStartTimeStr(
          new Date(state.startTime).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        );
      } else {
        setStartTimeStr("--:--");
      }

      if (lastSynced) {
        setLastSyncedStr(
          lastSynced.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntryTime(`${h}:${m}`);
    setEntryTime(`${h}:${m}`);
  }, []);

  const [manualMode, setManualMode] = useState(false);
  const [manualTime, setManualTime] = useState("");
  const [manualError, setManualError] = useState("");

  // Initialize manual time with current time
  useEffect(() => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, "0");
    const m = String(now.getMinutes()).padStart(2, "0");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setManualTime(`${h}:${m}`);
  }, []);

  const handlePunch = (
    toggleFn: (time?: number) => { success: boolean; error?: string },
  ) => {
    let punchTimeMs: number | undefined;

    if (manualMode) {
      if (!manualTime) {
        setManualError("Please select a time");
        return;
      }
      const [h, m] = manualTime.split(":").map(Number);
      const date = new Date();
      date.setHours(h, m, 0, 0);
      punchTimeMs = date.getTime();
    }

    const result = toggleFn(punchTimeMs);
    if (result && !result.success && result.error) {
      setManualError(result.error);
      // Clear error after 3 seconds
      setTimeout(() => setManualError(""), 3000);
    } else {
      setManualError("");
      setManualMode(false);
    }
  };

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



  return (
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
                    min="0"
                    max="24"
                  />
                </div>
                <div className="input-half">
                  <span className="input-label-small">Minutes</span>
                  <input
                    type="number"
                    id="workMinutes"
                    value={workMinutes}
                    onChange={(e) => setWorkMinutes(Number(e.target.value))}
                    min="0"
                    max="59"
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
              <span
                className={`status-badge ${state.status === "working" ? "working" : "on-break"}`}
              >
                {state.status === "working" ? "● Working" : "◉ On Break"}
              </span>
              <span className="clock-display mono">{timeStr}</span>
            </div>

            <div className="timer-hero">
              <span className="timer-label">
                {isOvertime ? "Overtime" : "Remaining work"}
              </span>
              <span
                className={`timer-value mono ${isOvertime ? "overtime" : ""}`}
              >
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

            {/* Sync Status */}
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
                <span className="stat-value mono">
                  {formatShortTime(totalWork)}
                </span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Break Used</span>
                <span className="stat-value mono">
                  {formatShortTime(totalBreak)}
                </span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Break Left</span>
                <span
                  className={`stat-value mono ${remainingBreak <= 0 ? "danger" : ""}`}
                >
                  {formatShortTime(Math.max(0, remainingBreak))}
                </span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Entry Time</span>
                <span className="stat-value mono">{startTimeStr}</span>
              </div>
            </div>

            {/* Manual Entry Toggle */}
            <div className="manual-entry-section">
              <label className="manual-toggle-label">
                <input
                  type="checkbox"
                  checked={manualMode}
                  onChange={(e) => setManualMode(e.target.checked)}
                />
                Enable Manual Entry
              </label>

              {manualMode && (
                <div className="manual-input-group">
                  <input
                    type="time"
                    value={manualTime}
                    onChange={(e) => setManualTime(e.target.value)}
                    className="manual-time-input"
                  />
                  {manualError && (
                    <span className="error-text">{manualError}</span>
                  )}
                </div>
              )}
            </div>

            {state.status === "working" ? (
              <button
                onClick={() => handlePunch(punchToggle)}
                className="btn-punch-out btn-full"
              >
                ⏸ Punch Out
              </button>
            ) : (
              <button
                onClick={() => handlePunch(punchToggle)}
                className="btn-punch-in btn-full"
              >
                ▶ Punch In
              </button>
            )}

            {/* Activity Log */}
            {state.logs.length > 0 && (
              <div className="activity-section">
                <h3>Activity</h3>
                <ul className="activity-list">
                  {state.logs.slice(0, 10).map((log, i) => (
                    <li key={i} className="activity-item">
                      <span>{log.type}</span>
                      <span className="log-time mono" suppressHydrationWarning>
                        {new Date(log.time).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button onClick={resetDay} className="btn-danger">
              ↺ Reset Day
            </button>
          </div>
        )}
      </div>
  );
}
