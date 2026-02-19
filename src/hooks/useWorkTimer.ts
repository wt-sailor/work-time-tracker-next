"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const MS_PER_HOUR = 3600000;
const MS_PER_MINUTE = 60000;
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export type TimerStatus = "idle" | "working" | "break" | "completed";

export interface TimerLog {
    type: string;
    time: number;
}

export interface TimerState {
    isActive: boolean;
    startTime: number | null;
    targetWorkMs: number;
    targetBreakMs: number;
    accumulatedWorkMs: number;
    accumulatedBreakMs: number;
    lastStatusChange: number | null;
    status: TimerStatus;
    logs: TimerLog[];
}

const defaultState: TimerState = {
    isActive: false,
    startTime: null,
    targetWorkMs: 0,
    targetBreakMs: 0,
    accumulatedWorkMs: 0,
    accumulatedBreakMs: 0,
    lastStatusChange: null,
    status: "idle",
    logs: [],
};

export function formatTime(ms: number): string {
    const absMs = Math.abs(ms);
    const totalSeconds = Math.floor(absMs / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatShortTime(ms: number): string {
    const totalMinutes = Math.floor(Math.abs(ms) / 60000);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}h ${m}m`;
}

async function sendLogToBackend(
    type: "punch-in" | "punch-out",
    time: string,
    totalHours?: string
) {
    try {
        await fetch("/api/worklog", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                type,
                time,
                date: new Date().toISOString().split("T")[0],
                totalHours,
            }),
        });
    } catch (err) {
        console.error("Failed to log to backend:", err);
    }
}

async function syncTimerStateToBackend(state: TimerState) {
    try {
        await fetch("/api/timer-sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(state),
        });
    } catch (err) {
        console.error("Failed to sync timer state:", err);
    }
}

async function loadTimerStateFromBackend(): Promise<TimerState | null> {
    try {
        const res = await fetch("/api/timer-sync");
        if (res.ok) {
            const data = await res.json();
            if (data && data.isActive) {
                return {
                    isActive: data.isActive,
                    startTime: data.startTime,
                    targetWorkMs: data.targetWorkMs,
                    targetBreakMs: data.targetBreakMs,
                    accumulatedWorkMs: data.accumulatedWorkMs,
                    accumulatedBreakMs: data.accumulatedBreakMs,
                    lastStatusChange: data.lastStatusChange,
                    status: data.status as TimerStatus,
                    logs: Array.isArray(data.logs) ? data.logs : [],
                };
            }
        }
    } catch (err) {
        console.error("Failed to load timer state from backend:", err);
    }
    return null;
}

async function clearTimerStateFromBackend() {
    try {
        await fetch("/api/timer-sync", { method: "DELETE" });
    } catch (err) {
        console.error("Failed to clear timer state:", err);
    }
}

export function useWorkTimer() {
    const [state, setState] = useState<TimerState>(defaultState);
    const [currentTime, setCurrentTime] = useState(Date.now());
    const [lastSynced, setLastSynced] = useState<Date | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Load state: try backend first, then localStorage fallback
    useEffect(() => {
        async function loadState() {
            const backendState = await loadTimerStateFromBackend();
            if (backendState) {
                setState(backendState);
                localStorage.setItem("wtt_state_next", JSON.stringify(backendState));
            } else {
                const saved = localStorage.getItem("wtt_state_next");
                if (saved) {
                    try {
                        setState(JSON.parse(saved));
                    } catch {
                        // Invalid state
                    }
                }
            }
            setIsLoaded(true);
        }
        loadState();
    }, []);

    // Save state to localStorage on change
    useEffect(() => {
        if (state.isActive) {
            localStorage.setItem("wtt_state_next", JSON.stringify(state));
        }
    }, [state]);

    // Timer interval
    useEffect(() => {
        if (state.isActive) {
            intervalRef.current = setInterval(() => {
                setCurrentTime(Date.now());
            }, 1000);
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [state.isActive]);

    // Auto-sync every 5 minutes to PostgreSQL
    useEffect(() => {
        if (state.isActive) {
            // Sync immediately when starting
            syncTimerStateToBackend(state);
            setLastSynced(new Date());

            syncIntervalRef.current = setInterval(() => {
                syncTimerStateToBackend(state);
                setLastSynced(new Date());
            }, SYNC_INTERVAL_MS);
        }

        return () => {
            if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
        };
    }, [state.isActive, state.status, state.accumulatedWorkMs, state.accumulatedBreakMs]);

    // Computed values
    const now = currentTime;
    let currentSessionWork = 0;
    let currentSessionBreak = 0;

    if (state.status === "working" && state.lastStatusChange) {
        currentSessionWork = now - state.lastStatusChange;
    } else if (state.status === "break" && state.lastStatusChange) {
        currentSessionBreak = now - state.lastStatusChange;
    }

    const totalWork = state.accumulatedWorkMs + currentSessionWork;
    const totalBreak = state.accumulatedBreakMs + currentSessionBreak;
    const remainingWork = state.targetWorkMs - totalWork;
    const remainingBreak = state.targetBreakMs - totalBreak;
    const isOvertime = remainingWork <= 0;

    const startDay = useCallback(
        (workHours: number, workMinutes: number, breakMinutes: number, entryTimeStr: string) => {
            const totalWorkHours = workHours + workMinutes / 60;
            const nowMs = Date.now();

            const [h, m] = entryTimeStr.split(":").map(Number);
            const entryDate = new Date();
            entryDate.setHours(h, m, 0, 0);

            const currentDate = new Date();
            if (h === currentDate.getHours() && m === currentDate.getMinutes()) {
                entryDate.setTime(nowMs);
            }

            const newState: TimerState = {
                isActive: true,
                startTime: entryDate.getTime(),
                targetWorkMs: totalWorkHours * MS_PER_HOUR,
                targetBreakMs: breakMinutes * MS_PER_MINUTE,
                accumulatedWorkMs: 0,
                accumulatedBreakMs: 0,
                lastStatusChange: entryDate.getTime(),
                status: "working",
                logs: [{ type: "Start", time: entryDate.getTime() }],
            };

            setState(newState);
            sendLogToBackend("punch-in", entryDate.toISOString());
            syncTimerStateToBackend(newState);
            setLastSynced(new Date());
        },
        []
    );

    const stateRef = useRef(state);
    useEffect(() => { stateRef.current = state; }, [state]);

    const punchToggle = useCallback((manualTimeMs?: number) => {
        const nowMs = Date.now();
        const punchTime = manualTimeMs || nowMs;

        if (punchTime > nowMs) {
            return { success: false, error: "Cannot punch in the future." };
        }

        const prevState = stateRef.current;
        if (prevState.lastStatusChange && punchTime <= prevState.lastStatusChange) {
            return { success: false, error: "New punch time must be after the last action." };
        }

        setState((prev) => {
            let newState: TimerState;
            const effectiveNow = punchTime;

            if (prev.status === "working") {
                const sessionDuration = effectiveNow - (prev.lastStatusChange || effectiveNow);
                const newAccWork = prev.accumulatedWorkMs + sessionDuration;

                sendLogToBackend(
                    "punch-out",
                    new Date(effectiveNow).toISOString(),
                    formatShortTime(newAccWork)
                );

                newState = {
                    ...prev,
                    accumulatedWorkMs: newAccWork,
                    status: "break" as TimerStatus,
                    lastStatusChange: effectiveNow,
                    logs: [
                        { type: "Punch Out (Break)", time: effectiveNow },
                        ...prev.logs,
                    ].slice(0, 50),
                };
            } else if (prev.status === "break") {
                const sessionDuration = effectiveNow - (prev.lastStatusChange || effectiveNow);
                const newAccBreak = prev.accumulatedBreakMs + sessionDuration;

                sendLogToBackend("punch-in", new Date(effectiveNow).toISOString());

                newState = {
                    ...prev,
                    accumulatedBreakMs: newAccBreak,
                    status: "working" as TimerStatus,
                    lastStatusChange: effectiveNow,
                    logs: [
                        { type: "Punch In (Work)", time: effectiveNow },
                        ...prev.logs,
                    ].slice(0, 50),
                };
            } else {
                return prev;
            }

            // Sync immediately on punch toggle
            syncTimerStateToBackend(newState);
            setLastSynced(new Date());
            return newState;
        });
        
        return { success: true };
    }, []);

    const resetDay = useCallback(() => {
        localStorage.removeItem("wtt_state_next");
        setState(defaultState);
        clearTimerStateFromBackend();
    }, []);

    return {
        state,
        totalWork,
        totalBreak,
        remainingWork,
        remainingBreak,
        isOvertime,
        currentTime,
        lastSynced,
        isLoaded,
        startDay,
        punchToggle,
        resetDay,
        formatTime,
        formatShortTime,
    };
}
