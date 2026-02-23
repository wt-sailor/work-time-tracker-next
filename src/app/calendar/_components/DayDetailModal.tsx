"use client";

import { useState, useCallback } from "react";
import {
  RiBriefcaseLine,
  RiCupLine,
  RiCloseLine,
  RiErrorWarningLine,
  RiCheckboxCircleLine,
  RiDeleteBinLine,
  RiArrowRightLine,
} from "@remixicon/react";

// ─── Types ─────────────────────────────────────────────────────────────────

interface WorkLog {
  id: string;
  date: string;
  punchIn: string;
  punchOut: string | null;
  totalHours: number | null;
  breakMinutes: number;
  status: string;
  notes: string | null;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  extendedProps: {
    log: WorkLog;
    type: "work" | "break";
    isActive?: boolean;
    previousLogId?: string;
    nextLogId?: string;
  };
}

interface TimelineItem {
  key: string;
  type: "work" | "break";
  start: string;
  end: string | null;
  durationMs: number;
  isActive?: boolean;
  logId?: string;
  previousLogId?: string;
  nextLogId?: string;
  position: "first" | "middle" | "last" | "only";
}

interface PendingDelete {
  item: TimelineItem;
}

interface Props {
  date: string; // YYYY-MM-DD
  events: CalendarEvent[];
  onClose: () => void;
  onRefresh: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtT(iso: string | null | undefined): string {
  if (!iso) return "–";
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDur(ms: number): string {
  if (ms <= 0) return "0m";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function DayDetailModal({
  date,
  events,
  onClose,
  onRefresh,
}: Props) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(
    null,
  );
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // ── Build timeline ──────────────────────────────────────────

  const dayEvents = events
    .filter((e) => e.start.startsWith(date))
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const rawTimeline = dayEvents.map((e) => {
    const startMs = new Date(e.start).getTime();
    const endMs = e.end ? new Date(e.end).getTime() : Date.now();
    return {
      key: e.id,
      type: e.extendedProps.type,
      start: e.start,
      end: e.end || null,
      durationMs: Math.max(0, endMs - startMs),
      isActive: e.extendedProps.isActive,
      logId:
        e.extendedProps.type === "work" ? e.extendedProps.log.id : undefined,
      previousLogId: e.extendedProps.previousLogId,
      nextLogId: e.extendedProps.nextLogId,
    };
  });

  const workItems = rawTimeline.filter((t) => t.type === "work");
  const timeline: TimelineItem[] = rawTimeline.map((item) => {
    if (item.type === "break") return { ...item, position: "middle" as const };
    const workIdx = workItems.findIndex((w) => w.key === item.key);
    const total = workItems.length;
    let position: TimelineItem["position"] = "only";
    if (total > 1) {
      if (workIdx === 0) position = "first";
      else if (workIdx === total - 1) position = "last";
      else position = "middle";
    }
    return { ...item, position };
  });

  const totalWork = timeline
    .filter((t) => t.type === "work")
    .reduce((s, t) => s + t.durationMs, 0);
  const totalBreak = timeline
    .filter((t) => t.type === "break")
    .reduce((s, t) => s + t.durationMs, 0);

  // ── Delete handler ───────────────────────────────────────────

  const executeDelete = useCallback(
    async (item: TimelineItem) => {
      setErrorMsg("");
      setSuccessMsg("");
      const deletingKey =
        item.type === "break"
          ? `break-${item.previousLogId}-${item.nextLogId}`
          : item.logId!;
      setDeletingId(deletingKey);

      try {
        const body =
          item.type === "break"
            ? {
                action: "delete-break",
                previousLogId: item.previousLogId,
                nextLogId: item.nextLogId,
              }
            : { action: "delete-work", logId: item.logId };

        const res = await fetch("/api/worklog/delete-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          setSuccessMsg(
            item.type === "break"
              ? "Break removed — sessions merged!"
              : "Session deleted.",
          );
          setPendingDelete(null);
          onRefresh();
          setTimeout(onClose, 900);
        } else {
          const d = await res.json().catch(() => ({}));
          setErrorMsg(d.error || "Something went wrong. Please try again.");
          setPendingDelete(null);
        }
      } catch {
        setErrorMsg("Network error. Please check your connection.");
        setPendingDelete(null);
      } finally {
        setDeletingId(null);
      }
    },
    [onRefresh, onClose],
  );

  const handleDeleteClick = (item: TimelineItem) => {
    setErrorMsg("");
    setSuccessMsg("");
    setPendingDelete({ item });
  };

  const handleConfirm = () => {
    if (pendingDelete) executeDelete(pendingDelete.item);
  };

  const handleCancel = () => {
    setPendingDelete(null);
    setErrorMsg("");
  };

  // ── Confirmation copy ────────────────────────────────────────

  function getConfirmMessage(item: TimelineItem): string {
    if (item.type === "break") {
      const prevWork = timeline.find(
        (t) => t.type === "work" && t.logId === item.previousLogId,
      );
      const nextWork = timeline.find(
        (t) => t.type === "work" && t.logId === item.nextLogId,
      );
      const prevDur = prevWork ? fmtDur(prevWork.durationMs) : "?";
      const nextDur = nextWork
        ? nextWork.isActive
          ? "ongoing"
          : fmtDur(nextWork.durationMs)
        : "?";
      return `Remove this ${fmtDur(item.durationMs)} break and merge the surrounding sessions (${prevDur} + ${nextDur}) into one continuous work block?`;
    }
    if (item.position === "only")
      return `Delete the only work session for this day? All data for ${date} will be removed.`;
    if (item.position === "first")
      return `Delete the first work session (${fmtDur(item.durationMs)})? The day will start from the next session.`;
    if (item.position === "last")
      return item.isActive
        ? `End and delete the active session? This cannot be undone.`
        : `Delete the last work session (${fmtDur(item.durationMs)})? The day's records will be trimmed.`;

    const itemIdx = timeline.findIndex((t) => t.key === item.key);
    const prevBreak = itemIdx > 0 ? timeline[itemIdx - 1] : null;
    const nextBreak =
      itemIdx < timeline.length - 1 ? timeline[itemIdx + 1] : null;
    const newBreakMs =
      (prevBreak?.type === "break" ? prevBreak.durationMs : 0) +
      item.durationMs +
      (nextBreak?.type === "break" ? nextBreak.durationMs : 0);
    return `Delete this ${fmtDur(item.durationMs)} work session? The surrounding breaks will merge into a single ${fmtDur(newBreakMs)} break.`;
  }

  const displayDate = new Date(date + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card day-modal-card animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="day-modal-header">
          <div className="day-modal-title-block">
            <p className="day-modal-date">{displayDate}</p>
            <div className="day-modal-totals">
              {totalWork > 0 && (
                <span className="dmt-chip dmt-work">
                  <RiBriefcaseLine size={16} /> {fmtDur(totalWork)} worked
                </span>
              )}
              {totalBreak > 0 && (
                <span className="dmt-chip dmt-break">
                  <RiCupLine size={16} /> {fmtDur(totalBreak)} break
                </span>
              )}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <RiCloseLine size={20} />
          </button>
        </div>

        {/* Messages */}
        {errorMsg && (
          <div className="dm-message dm-message-error">
            <RiErrorWarningLine className="dm-msg-icon" size={18} />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="dm-message dm-message-success">
            <RiCheckboxCircleLine className="dm-msg-icon" size={18} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Confirmation dialog */}
        {pendingDelete && !deletingId && (
          <div className="dm-confirm-box animate-in">
            <div className="dm-confirm-icon">
              {pendingDelete.item.type === "break" ? (
                <RiCupLine size={20} />
              ) : (
                <RiBriefcaseLine size={20} />
              )}
              <RiDeleteBinLine style={{ marginLeft: 4 }} size={20} />
            </div>
            <p className="dm-confirm-text">
              {getConfirmMessage(pendingDelete.item)}
            </p>
            <div className="dm-confirm-actions">
              <button className="dm-btn-cancel" onClick={handleCancel}>
                <RiCloseLine size={16} /> Cancel
              </button>
              <button className="dm-btn-confirm" onClick={handleConfirm}>
                <RiDeleteBinLine size={16} /> Confirm Delete
              </button>
            </div>
          </div>
        )}

        {/* Timeline */}
        {timeline.length === 0 ? (
          <p className="day-modal-empty">No sessions recorded for this day.</p>
        ) : (
          <div className="day-timeline">
            {timeline.map((item, idx) => {
              const deleteKey =
                item.type === "break"
                  ? `break-${item.previousLogId}-${item.nextLogId}`
                  : item.logId!;
              const isThisDeleting = deletingId === deleteKey;
              const isPendingThis =
                pendingDelete?.item.key === item.key && !isThisDeleting;
              const isLast = idx === timeline.length - 1;

              return (
                <div
                  key={item.key}
                  className={[
                    "timeline-item",
                    `timeline-item-${item.type}`,
                    item.isActive ? "timeline-active" : "",
                    isPendingThis ? "timeline-item-pending" : "",
                    isThisDeleting ? "timeline-item-deleting" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div className="timeline-dot-col">
                    <div className="timeline-dot" />
                    {!isLast && <div className="timeline-connector" />}
                  </div>

                  <div className="timeline-body">
                    <div className="timeline-times mono">
                      <span>{fmtT(item.start)}</span>
                      <RiArrowRightLine className="timeline-arrow" size={14} />
                      <span>
                        {item.isActive ? (
                          <span className="session-ongoing">now</span>
                        ) : (
                          fmtT(item.end)
                        )}
                      </span>
                    </div>
                    <div className="timeline-meta-row">
                      <span className={`tl-badge tl-badge-${item.type}`}>
                        {item.type === "work" ? (
                          <>
                            <RiBriefcaseLine size={14} /> Work
                          </>
                        ) : (
                          <>
                            <RiCupLine size={14} /> Break
                          </>
                        )}
                      </span>
                      <span className="tl-duration mono">
                        {fmtDur(item.durationMs)}
                        {item.isActive && (
                          <span
                            className="tl-active-dot"
                            title="Active session"
                          />
                        )}
                      </span>
                    </div>
                    {item.type === "work" && (
                      <div className="tl-position-label">
                        {item.position === "only" && "only session"}
                        {item.position === "first" && "first session"}
                        {item.position === "middle" && "middle session"}
                        {item.position === "last" &&
                          (item.isActive ? "active" : "last session")}
                      </div>
                    )}
                  </div>

                  {!item.isActive && (
                    <button
                      className={[
                        "tl-delete-btn",
                        isPendingThis ? "tl-delete-btn-pending" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      title={
                        item.type === "break"
                          ? "Remove break (merge surrounding sessions)"
                          : "Delete this work session"
                      }
                      disabled={!!deletingId}
                      onClick={() => {
                        if (isPendingThis) setPendingDelete(null);
                        else handleDeleteClick(item);
                      }}
                    >
                      {isThisDeleting ? (
                        <span
                          className="spinner"
                          style={{ width: 12, height: 12, borderWidth: 2 }}
                        />
                      ) : isPendingThis ? (
                        <RiCloseLine size={16} />
                      ) : (
                        <RiDeleteBinLine size={16} />
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer hint */}
        {timeline.length > 0 && !pendingDelete && !deletingId && (
          <p className="dm-footer-hint">
            <RiDeleteBinLine size={14} /> Click the delete icon on any session
            or break to remove it
          </p>
        )}
      </div>
    </div>
  );
}
