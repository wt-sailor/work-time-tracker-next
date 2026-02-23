"use client";

import { useEffect, useState } from "react";
import { RiNotification3Line, RiCloseLine } from "@remixicon/react";
import { useSession } from "next-auth/react";

interface AppNotification {
  id: string;
  message: string;
  type: "ONE_TIME" | "ALL_TIME";
  isRead: boolean;
}

export default function NotificationBanner() {
  const [persistentAnns, setPersistentAnns] = useState<AppNotification[]>([]);
  const [toasts, setToasts] = useState<AppNotification[]>([]);
  const { status } = useSession();

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;

      const { notifications, notificationsEnabled } = await res.json();

      const newAllTime = notifications.filter(
        (n: AppNotification) => n.type === "ALL_TIME",
      );
      const newOneTime = notifications.filter(
        (n: AppNotification) => n.type === "ONE_TIME",
      );

      setPersistentAnns(newAllTime);

      if (newOneTime.length > 0) {
        // Add to toasts
        setToasts((prev) => [
          ...prev,
          ...newOneTime.filter(
            (n: AppNotification) =>
              !prev.find((p: AppNotification) => p.id === n.id),
          ),
        ]);

        // Trigger desktop notifications if permitted, page is not in view, and user enabled them
        if (
          "Notification" in window &&
          Notification.permission === "granted" &&
          document.visibilityState !== "visible" &&
          notificationsEnabled
        ) {
          newOneTime.forEach((n: AppNotification) => {
            new Notification("WorkTracker Alert", { body: n.message });
          });
        }

        // Mark them as read in the DB so they don't fetch again
        await fetch("/api/notifications", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ids: newOneTime.map((n: AppNotification) => n.id),
          }),
        });
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  };

  useEffect(() => {
    if (status !== "authenticated") return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotifications();
    // Poll every 10 seconds for near-instant notifications
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [status]);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const dismissPersistent = async (id: string) => {
    // Optimistic UI update
    setPersistentAnns((prev) =>
      prev.filter((n: AppNotification) => n.id !== id),
    );
    // Update DB
    await fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
  };

  if (status !== "authenticated") return null;

  return (
    <>
      {/* Persistent Announcements at top of screen */}
      {persistentAnns.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            zIndex: 50,
          }}
        >
          {persistentAnns.map((ann) => (
            <div
              key={ann.id}
              style={{
                background: "var(--accent-primary)",
                color: "white",
                padding: "10px 20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "0.9rem",
                fontWeight: 500,
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <RiNotification3Line size={18} />
                {ann.message}
              </div>
              <button
                onClick={() => dismissPersistent(ann.id)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "white",
                  cursor: "pointer",
                  display: "flex",
                  padding: "4px",
                }}
              >
                <RiCloseLine size={20} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Stackable Toasts for ONE_TIME notifications (bottom right) */}
      {toasts.length > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            zIndex: 9999,
          }}
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="glass-card animate-in"
              style={{
                padding: "16px",
                minWidth: "300px",
                maxWidth: "400px",
                boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
                borderLeft: "4px solid var(--accent-primary)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{ color: "var(--accent-primary)", marginTop: "2px" }}
                >
                  <RiNotification3Line size={20} />
                </div>
                <div>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: "0.95rem",
                      marginBottom: "4px",
                    }}
                  >
                    New Notification
                  </div>
                  <div
                    style={{
                      fontSize: "0.85rem",
                      color: "var(--text-secondary)",
                      lineHeight: 1.4,
                    }}
                  >
                    {toast.message}
                  </div>
                </div>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  padding: "4px",
                  marginTop: "-4px",
                  marginRight: "-8px",
                }}
              >
                <RiCloseLine size={20} />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
