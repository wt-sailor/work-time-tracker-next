"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import DayDetailModal from "./DayDetailModal";
import ManualEntryPanel from "./ManualEntryPanel";

const FullCalendar = dynamic(() => import("@fullcalendar/react"), {
  ssr: false,
  loading: () => (
    <div className="calendar-skeleton">
      <div className="calendar-skeleton-header" />
      <div className="calendar-skeleton-grid">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="calendar-skeleton-cell" />
        ))}
      </div>
    </div>
  ),
});

import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";

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
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  extendedProps: {
    log: WorkLog;
    type: "work" | "break";
    isActive?: boolean;
    previousLogId?: string;
    nextLogId?: string;
  };
}

interface CalendarClientProps {
  initialEvents: CalendarEvent[];
  adminUserId?: string;
}

// ─── Helpers ─────────────────────────────────────────────────
function msFmt(ms: number): string {
  if (ms <= 0) return "";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ─── Main Component ───────────────────────────────────────────
export default function CalendarClient({
  initialEvents,
  adminUserId,
}: CalendarClientProps) {
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [dataLoading, setDataLoading] = useState(false);
  const [dayModalDate, setDayModalDate] = useState<string | null>(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (initialEvents.length > 0 && logs.length === 0) {
      const extracted = initialEvents
        .filter((e) => e.extendedProps.type === "work")
        .map((e) => e.extendedProps.log);
      setLogs(Array.from(new Map(extracted.map((l) => [l.id, l])).values()));
    }
  }, [initialEvents, logs.length]);

  useEffect(() => {
    setCurrentTime(new Date());
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Update active event end every minute
  useEffect(() => {
    if (!currentTime) return;
    setEvents((prev) => {
      if (!prev.some((e) => e.extendedProps.isActive)) return prev;
      return prev.map((event) => {
        if (!event.extendedProps.isActive) return event;
        const start = new Date(event.start as string).getTime();
        const durationMs = currentTime.getTime() - start;
        return {
          ...event,
          end: currentTime.toISOString(),
          title: `Work: ${(durationMs / 3600000).toFixed(1)}h 🟢`,
        };
      });
    });
  }, [currentTime]);

  const fetchLogs = useCallback(
    async (startDate?: string, endDate?: string) => {
      try {
        setDataLoading(true);
        let url = adminUserId
          ? `/api/admin/users/${adminUserId}/logs`
          : `/api/worklog`;

        const queryParams = [];
        if (startDate) queryParams.push(`startDate=${startDate}`);
        if (endDate) queryParams.push(`endDate=${endDate}`);

        if (queryParams.length > 0) {
          url += `?${queryParams.join("&")}`;
        }

        const res = await fetch(url);
        if (res.ok) {
          const fetchedEvents: CalendarEvent[] = await res.json();
          setEvents(fetchedEvents);
          const extracted = fetchedEvents
            .filter((e) => e.extendedProps.type === "work")
            .map((e) => e.extendedProps.log);
          setLogs(
            Array.from(new Map(extracted.map((l) => [l.id, l])).values()),
          );
        }
      } catch (err) {
        console.error("Failed to fetch logs:", err);
      } finally {
        setDataLoading(false);
      }
    },
    [adminUserId],
  );

  const handleDatesSet = (dateInfo: { startStr: string; endStr: string }) => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      return;
    }
    fetchLogs(dateInfo.startStr, dateInfo.endStr);
  };

  const handleDateClick = (arg: { dateStr: string }) =>
    setDayModalDate(arg.dateStr);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEventClick = (info: any) => {
    const dateStr = (info.event.startStr as string).split("T")[0];
    setDayModalDate(dateStr);
  };

  // ── Daily summary map: date → { workMs, breakMs, hasActive } ─
  const dailySummaryMap = useMemo(() => {
    const map: Record<
      string,
      { workMs: number; breakMs: number; hasActive: boolean }
    > = {};
    events.forEach((e) => {
      const dateStr = e.start.split("T")[0];
      if (!map[dateStr])
        map[dateStr] = { workMs: 0, breakMs: 0, hasActive: false };
      const dur = Math.max(
        0,
        (e.end ? new Date(e.end).getTime() : Date.now()) -
          new Date(e.start).getTime(),
      );
      if (e.extendedProps.type === "work") {
        map[dateStr].workMs += dur;
        if (e.extendedProps.isActive) map[dateStr].hasActive = true;
      } else {
        map[dateStr].breakMs += dur;
      }
    });
    return map;
  }, [events]);

  // ── Month stats ──────────────────────────────────────────────
  const [stats, setStats] = useState({
    totalMonthHours: 0,
    totalDaysWorked: 0,
    avgHoursPerDay: 0,
  });
  useEffect(() => {
    const daily: Record<string, number> = {};
    logs.forEach((log) => {
      const day = log.date.split("T")[0];
      daily[day] = (daily[day] || 0) + (log.totalHours || 0);
    });
    const totalHours = Object.values(daily).reduce((s, h) => s + h, 0);
    const totalDays = Object.keys(daily).length;
    setStats({
      totalMonthHours: totalHours,
      totalDaysWorked: totalDays,
      avgHoursPerDay: totalDays > 0 ? totalHours / totalDays : 0,
    });
  }, [logs]);

  return (
    <main className="main-content calendar-page">
      {/* Page Header */}
      <div className="calendar-header">
        <div>
          <h1 className="gradient-text">Work Calendar</h1>
        </div>
        <div className="calendar-header-right">
          <div className="calendar-stats">
            <div className="mini-stat">
              <span className="mini-stat-value mono">
                {stats.totalMonthHours.toFixed(1)}h
              </span>
              <span className="mini-stat-label">Total Hours</span>
            </div>
            <div className="mini-stat">
              <span className="mini-stat-value mono">
                {stats.totalDaysWorked}
              </span>
              <span className="mini-stat-label">Days Worked</span>
            </div>
            <div className="mini-stat">
              <span className="mini-stat-value mono">
                {stats.avgHoursPerDay.toFixed(1)}h
              </span>
              <span className="mini-stat-label">Avg / Day</span>
            </div>
          </div>
          {/* Hide Manual Entry Button for Admins viewing other users */}
          {!adminUserId && (
            <button
              className="btn-add-record"
              onClick={() => setShowManualModal(true)}
            >
              Add Past Day Record
            </button>
          )}
        </div>
      </div>

      {/* Full-width Calendar */}
      <div
        className="glass-card calendar-wrapper animate-in"
        style={{ position: "relative" }}
      >
        {dataLoading && (
          <div className="calendar-data-loading">
            <div className="spinner" />
          </div>
        )}
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{ left: "prev,next", center: "title", right: "today" }}
          dayHeaderFormat={{ weekday: "long" }}
          dayCellClassNames={(arg) => {
            const day = arg.date.getDay();
            if (day === 0) return ["fc-unavailable-day"];
            if (day === 6) {
              const weekNumber = Math.ceil(arg.date.getDate() / 7);
              if ([1, 3, 5].includes(weekNumber)) return ["fc-unavailable-day"];
            }
            return [];
          }}
          // Hide event bars — show only our custom cell content
          eventDisplay="none"
          // Custom cell content: day number + work/break summary only
          dayCellContent={(arg) => {
            const y = arg.date.getFullYear();
            const mo = String(arg.date.getMonth() + 1).padStart(2, "0");
            const d = String(arg.date.getDate()).padStart(2, "0");
            const dateStr = `${y}-${mo}-${d}`;
            const summary = dailySummaryMap[dateStr];
            return (
              <div className="fc-day-cell-inner">
                <span className="fc-daygrid-day-number">
                  {arg.dayNumberText}
                </span>
                {summary && summary.workMs > 60000 && (
                  <div className="day-cell-summary">
                    {summary.hasActive && (
                      <span className="dcs-active">🟢 Active</span>
                    )}
                    <span className="dcs-work">⏱ {msFmt(summary.workMs)}</span>
                    {summary.breakMs > 60000 && (
                      <span className="dcs-break">
                        ☕ {msFmt(summary.breakMs)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          }}
          showNonCurrentDates={false}
          fixedWeekCount={false}
          events={events}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          datesSet={handleDatesSet}
          height="auto"
          nowIndicator={true}
        />
      </div>

      {/* Day Detail Modal (click on any day) */}
      {dayModalDate && (
        <DayDetailModal
          date={dayModalDate}
          events={events}
          onClose={() => setDayModalDate(null)}
          onRefresh={() => {
            fetchLogs();
            setDayModalDate(null);
          }}
        />
      )}

      {/* Manual Past-Day Entry Modal */}
      {showManualModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowManualModal(false)}
        >
          <div
            className="manual-entry-modal-card animate-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="manual-entry-modal-header">
              <span />
              <button
                className="modal-close"
                onClick={() => setShowManualModal(false)}
              >
                ✕
              </button>
            </div>
            <ManualEntryPanel
              onRefresh={() => {
                fetchLogs();
                setShowManualModal(false);
              }}
            />
          </div>
        </div>
      )}
    </main>
  );
}
