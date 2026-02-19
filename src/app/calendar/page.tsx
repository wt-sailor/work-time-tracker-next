"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { EventClickArg } from "@fullcalendar/core";
import Navbar from "@/components/Navbar";

// Lazy-load FullCalendar with SSR disabled — prevents blocking the initial render
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

// These must be imported after FullCalendar is loaded — dynamic import handles this
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
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
  };
}

export default function CalendarPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<{
    id: string;
    title: string;
    type: "work" | "break";
    isActive?: boolean;
    start?: Date;
    end?: Date;
    previousLogId?: string;
    nextLogId?: string;
  } | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const fetchedRef = useRef(false);

  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute to keep active bars moving
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // 1 minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const fetchLogs = useCallback(async (startDate?: string, endDate?: string) => {
    try {
      setDataLoading(true);
      let url = "/api/worklog";
      if (startDate && endDate) {
        url += `?startDate=${startDate}&endDate=${endDate}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const events = await res.json();
        setEvents(events);
      }
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setDataLoading(false);
    }
  }, []);

  // Update "active" event end time every minute
  useEffect(() => {
    if (!events.some(e => e.extendedProps.isActive)) return;

    const now = currentTime;
    
    setEvents(prevEvents => prevEvents.map(event => {
      if (event.extendedProps.isActive) {
        // Calculate new title duration
        const start = new Date(event.start as string).getTime();
        const durationMs = now.getTime() - start;
        const hoursDisplay = (durationMs / 3600000).toFixed(1);
        
        return {
          ...event,
          end: now.toISOString(),
          title: `Work: ${hoursDisplay}h 🟢`
        };
      }
      return event;
    }));
  }, [currentTime]); // currentTime updates every minute

  useEffect(() => {
    if (session && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchLogs();
    }
  }, [session, fetchLogs]);

  const handleEventClick = (info: EventClickArg) => {
    const log = info.event.extendedProps.log as WorkLog;
    const type = info.event.extendedProps.type as "work" | "break";
    const isActive = info.event.extendedProps.isActive as boolean | undefined;
    
    // For breaks, we need prev/next IDs
    const previousLogId = info.event.extendedProps.previousLogId as string | undefined;
    const nextLogId = info.event.extendedProps.nextLogId as string | undefined;

    setSelectedEvent({ 
      id: log.id, 
      title: info.event.title, 
      type, 
      isActive,
      start: info.event.start || undefined,
      end: info.event.end || undefined,
      previousLogId,
      nextLogId
    });
    setModalOpen(true);
  };
  
  const formatTime = (date?: Date) => {
    if (!date) return "Active";
    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleDatesSet = (dateInfo: { startStr: string; endStr: string }) => {
    fetchLogs(dateInfo.startStr, dateInfo.endStr);
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const handleDelete = async () => {
    if (!selectedEvent) return;

    // Special handling for Break deletion (Merge)
    if (selectedEvent.type === "break" && selectedEvent.previousLogId && selectedEvent.nextLogId) {
       if (confirm("This will merge the two work sessions, effectively deleting the break. Continue?")) {
        try {
          const res = await fetch("/api/worklog/merge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              previousLogId: selectedEvent.previousLogId,
              nextLogId: selectedEvent.nextLogId
            })
          });
          if (res.ok) {
            setModalOpen(false);
            fetchLogs(); // Refresh calendar
          } else {
            alert("Failed to merge sessions");
          }
        } catch (err) {
          console.error("Merge error:", err);
          alert("Error merging sessions");
        }
       }
       return;
    }

    // Standard Work Log Deletion
    if (confirm("Are you sure you want to delete this log?")) {
      try {
        const res = await fetch(`/api/worklog/${selectedEvent.id}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setModalOpen(false);
          fetchLogs();
        } else {
          alert("Failed to delete log");
        }
      } catch (err) {
        console.error("Failed to delete log:", err);
      }
    }
  };

  // Aggregate daily stats
  const dailyStats = logs.reduce(
    (acc, log) => {
      const day = new Date(log.date).toLocaleDateString();
      if (!acc[day]) {
        acc[day] = { totalHours: 0, sessions: 0, breakMinutes: 0 };
      }
      acc[day].sessions++;
      acc[day].totalHours += log.totalHours || 0;
      acc[day].breakMinutes += log.breakMinutes || 0;
      return acc;
    },
    {} as Record<string, { totalHours: number; sessions: number; breakMinutes: number }>
  );

  const totalMonthHours = Object.values(dailyStats).reduce(
    (sum, d) => sum + d.totalHours,
    0
  );
  const totalDaysWorked = Object.keys(dailyStats).length;

  const modalTitle = selectedEvent?.type === "break" ? "Break Details" : "Work Log Details";
  const deleteBtnText = selectedEvent?.type === "break" ? "Delete Break (Merge)" : "Delete Log";

  // Only block render while auth is resolving
  if (status === "loading") {
    return (
      <div className="page-loader">
        <div className="loader-spinner" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="app-shell">
      <Navbar />
      <main className="main-content calendar-page">
        <div className="calendar-header">
          <h1 className="gradient-text">Work Calendar</h1>
          <div className="calendar-stats">
            <div className="mini-stat">
              <span className="mini-stat-value mono">
                {totalMonthHours.toFixed(1)}h
              </span>
              <span className="mini-stat-label">Total Hours</span>
            </div>
            <div className="mini-stat">
              <span className="mini-stat-value mono">{totalDaysWorked}</span>
              <span className="mini-stat-label">Days Worked</span>
            </div>
            <div className="mini-stat">
              <span className="mini-stat-value mono">
                {totalDaysWorked > 0
                  ? (totalMonthHours / totalDaysWorked).toFixed(1) + "h"
                  : "0h"}
              </span>
              <span className="mini-stat-label">Avg / Day</span>
            </div>
          </div>
        </div>

        <div className="glass-card calendar-wrapper animate-in delay-1">
          {dataLoading && (
            <div className="loading-overlay">
              <div className="spinner"></div>
            </div>
          )}
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridDay"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay",
            }}
            events={events}
            eventClick={handleEventClick}
            datesSet={handleDatesSet}
            height="auto"
            dayMaxEvents={3}
            eventDisplay="block"
            nowIndicator={true}
            slotMinTime="06:00:00"
            slotMaxTime="22:00:00"
            allDaySlot={false}
          />
        </div>

        {/* Day Detail Modal */}
        {modalOpen && selectedEvent && (
          <div className="modal-overlay" onClick={() => setModalOpen(false)}>
            <div
              className="modal-card glass-card animate-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2>{modalTitle}</h2>
                <button
                  className="modal-close"
                  onClick={() => setModalOpen(false)}
                >
                  ✕
                </button>
              </div>

              <div className="modal-body">
                <p><strong>{selectedEvent.title}</strong></p>
                <div className="time-details" style={{ marginTop: "10px", marginBottom: "15px", fontSize: "0.9em", color: "#ccc" }}>
                  <div className="detail-row">
                    <span className="label">Start:</span> <span className="value mono">{formatTime(selectedEvent.start)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">End:</span> <span className="value mono">{formatTime(selectedEvent.end)}</span>
                  </div>
                </div>
                {selectedEvent.isActive && <p className="status-active">Currently Active</p>}
              </div>

              <div className="modal-actions">
                <button 
                  onClick={handleDelete} 
                  className="btn-danger-small"
                >
                  {deleteBtnText}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
