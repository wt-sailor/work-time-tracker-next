"use client";

import { useState, useEffect } from "react";
import {
  RiShieldStarLine,
  RiNotification3Line,
  RiCalendarLine,
  RiUserAddLine,
  RiCheckLine,
  RiErrorWarningLine,
} from "@remixicon/react";
import CalendarClient from "@/app/calendar/_components/CalendarClient";

type Tab = "timelogs" | "notifications" | "admins";

type AdminUser = {
  id: string;
  name: string | null;
  email: string;
  isAdmin: boolean;
  createdAt: string;
};

export default function AdminClient({
  currentUserId,
}: {
  currentUserId: string;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("timelogs");

  return (
    <div className="admin-container">
      <div className="admin-header" style={{ marginBottom: "24px" }}>
        <h1>
          <RiShieldStarLine
            style={{
              display: "inline",
              verticalAlign: "bottom",
              marginRight: "8px",
            }}
            size={28}
          />
          Admin Panel
        </h1>
        <p className="text-muted">
          Manage users, view timelogs, and send notifications.
        </p>
      </div>

      <div
        className="admin-tabs"
        style={{
          display: "flex",
          gap: "10px",
          marginBottom: "24px",
          borderBottom: "1px solid var(--card-border)",
          paddingBottom: "12px",
        }}
      >
        <button
          className={`tab-btn ${activeTab === "timelogs" ? "active" : ""}`}
          onClick={() => setActiveTab("timelogs")}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            background:
              activeTab === "timelogs"
                ? "var(--accent-primary)"
                : "transparent",
            color: activeTab === "timelogs" ? "#fff" : "var(--text-main)",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontWeight: 600,
          }}
        >
          <RiCalendarLine size={18} /> User Timelogs
        </button>
        <button
          className={`tab-btn ${activeTab === "notifications" ? "active" : ""}`}
          onClick={() => setActiveTab("notifications")}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            background:
              activeTab === "notifications"
                ? "var(--accent-primary)"
                : "transparent",
            color: activeTab === "notifications" ? "#fff" : "var(--text-main)",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontWeight: 600,
          }}
        >
          <RiNotification3Line size={18} /> Announcements
        </button>
        <button
          className={`tab-btn ${activeTab === "admins" ? "active" : ""}`}
          onClick={() => setActiveTab("admins")}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            background:
              activeTab === "admins" ? "var(--accent-primary)" : "transparent",
            color: activeTab === "admins" ? "#fff" : "var(--text-main)",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontWeight: 600,
          }}
        >
          <RiUserAddLine size={18} /> Access Control
        </button>
      </div>

      <div className="admin-content">
        {activeTab === "timelogs" && <UserTimelogsTab />}
        {activeTab === "notifications" && <PushNotificationsTab />}
        {activeTab === "admins" && <AdminsTab currentUserId={currentUserId} />}
      </div>
    </div>
  );
}

function UserTimelogsTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((res) => res.json())
      .then((data) => {
        setUsers(data);
        setLoading(false);
      });
  }, []);

  if (loading)
    return (
      <div className="page-loader">
        <div className="loader-spinner" />
      </div>
    );

  return (
    <div className="glass-card animate-in">
      <h2>Select User to View Timelogs</h2>
      {selectedUserId ? (
        <div className="admin-calendar-view" style={{ marginTop: "16px" }}>
          <button
            className="btn-secondary"
            onClick={() => setSelectedUserId(null)}
            style={{ marginBottom: "16px" }}
          >
            ← Back to Users
          </button>
          <div style={{ margin: "0 -20px" }}>
            <CalendarClient initialEvents={[]} adminUserId={selectedUserId} />
          </div>
        </div>
      ) : (
        <table className="session-table" style={{ marginTop: "16px" }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Joined</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  {u.name || "N/A"}{" "}
                  {u.isAdmin && (
                    <span
                      className="status-badge working"
                      style={{
                        marginLeft: "8px",
                        padding: "2px 6px",
                        fontSize: "0.6rem",
                      }}
                    >
                      Admin
                    </span>
                  )}
                </td>
                <td>{u.email}</td>
                <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                <td>
                  <button
                    className="btn-primary"
                    style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                    onClick={() => setSelectedUserId(u.id)}
                  >
                    View Logs
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function PushNotificationsTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [targetUserId, setTargetUserId] = useState("all");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"ONE_TIME" | "ALL_TIME">("ONE_TIME");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: "", text: "" });

  useEffect(() => {
    fetch("/api/admin/users")
      .then((res) => res.json())
      .then((data) => setUsers(data));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: "", text: "" });

    try {
      const uids =
        targetUserId === "all" ? users.map((u) => u.id) : [targetUserId];

      const promises = uids.map((uid) =>
        fetch("/api/admin/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: uid, message, type }),
        }),
      );

      await Promise.all(promises);
      setStatus({
        type: "success",
        text: `Notification sent to ${uids.length} user(s)!`,
      });
      setMessage("");
    } catch {
      setStatus({ type: "error", text: "Failed to send notification." });
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = async () => {
    if (
      !confirm(
        "Are you sure you want to clear ALL past announcements for ALL users? This action cannot be undone.",
      )
    ) {
      return;
    }

    setLoading(true);
    setStatus({ type: "", text: "" });

    try {
      const res = await fetch("/api/admin/notifications", {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to clear");

      setStatus({
        type: "success",
        text: "All past announcements have been cleared!",
      });
    } catch {
      setStatus({ type: "error", text: "Failed to clear announcements." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="glass-card animate-in"
      style={{ padding: "32px", maxWidth: "700px" }}
    >
      <div style={{ marginBottom: "24px" }}>
        <h2
          style={{
            fontSize: "1.5rem",
            marginBottom: "8px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <RiNotification3Line size={24} color="var(--accent-primary)" /> Send
          Announcement
        </h2>
        <p className="text-muted">
          Push a real-time notification to your team members.
        </p>
      </div>

      {status.text && (
        <div
          className={`dm-message dm-message-${status.type}`}
          style={{ marginBottom: "24px" }}
        >
          {status.type === "error" ? (
            <RiErrorWarningLine size={20} />
          ) : (
            <RiCheckLine size={20} />
          )}
          {status.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="settings-form">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "20px",
            marginBottom: "20px",
          }}
        >
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label
              style={{
                fontWeight: 600,
                fontSize: "0.9rem",
                color: "var(--text-main)",
              }}
            >
              Target User
            </label>
            <select
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid var(--card-border)",
                background: "var(--input-bg)",
                color: "var(--text-main)",
                fontSize: "0.95rem",
              }}
            >
              <option value="all">Everyone (All Users)</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label
              style={{
                fontWeight: 600,
                fontSize: "0.9rem",
                color: "var(--text-main)",
              }}
            >
              Notification Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "ONE_TIME" | "ALL_TIME")}
              required
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid var(--card-border)",
                background: "var(--input-bg)",
                color: "var(--text-main)",
                fontSize: "0.95rem",
              }}
            >
              <option value="ONE_TIME">
                One-Time (Dismissible, fires Web Push)
              </option>
              <option value="ALL_TIME">
                Persistent (Stays until dismissed explicitly)
              </option>
            </select>
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: "24px" }}>
          <label
            style={{
              fontWeight: 600,
              fontSize: "0.9rem",
              color: "var(--text-main)",
            }}
          >
            Message Content
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            rows={5}
            placeholder="Type your announcement here... It will show up instantly for users."
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: "12px",
              border: "1px solid var(--card-border)",
              background: "var(--input-bg)",
              color: "var(--text-main)",
              resize: "vertical",
              fontSize: "1rem",
              lineHeight: 1.5,
            }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="submit"
            className="btn-primary"
            disabled={loading || !message}
            style={{
              padding: "12px 24px",
              fontSize: "1rem",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {loading ? (
              <span
                className="spinner"
                style={{ width: "20px", height: "20px" }}
              ></span>
            ) : (
              <>
                <RiNotification3Line size={20} /> Send Notification
              </>
            )}
          </button>
        </div>
      </form>

      <div
        style={{
          marginTop: "40px",
          paddingTop: "24px",
          borderTop: "1px solid var(--card-border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h3 style={{ fontSize: "1.1rem", marginBottom: "4px" }}>
            Danger Zone
          </h3>
          <p className="text-muted" style={{ fontSize: "0.85rem" }}>
            Clear the entire notification history for all users.
          </p>
        </div>
        <button
          className="btn-secondary"
          onClick={handleClearAll}
          disabled={loading}
          style={{
            color: "var(--danger)",
            borderColor: "rgba(229,77,77,0.3)",
            padding: "10px 20px",
          }}
        >
          {loading ? "Processing..." : "Clear All Announcements"}
        </button>
      </div>
    </div>
  );
}

function AdminsTab({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = () => {
    fetch("/api/admin/users")
      .then((res) => res.json())
      .then((data) => {
        setUsers(data);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleGrantAdmin = async (id: string, name: string) => {
    if (
      !confirm(
        `Are you sure you want to grant Admin privileges to ${name || "this user"}?`,
      )
    )
      return;

    try {
      await fetch(`/api/admin/users/${id}/grant`, { method: "PUT" });
      fetchUsers(); // refresh
    } catch {
      alert("Failed to grant admin");
    }
  };

  const handleRevokeAdmin = async (id: string, name: string) => {
    if (id === currentUserId) {
      alert("You cannot revoke your own admin access.");
      return;
    }

    if (
      !confirm(
        `Are you sure you want to revoke Admin privileges from ${name || "this user"}?`,
      )
    )
      return;

    try {
      await fetch(`/api/admin/users/${id}/revoke`, { method: "PUT" });
      fetchUsers(); // refresh
    } catch {
      alert("Failed to revoke admin");
    }
  };

  if (loading)
    return (
      <div className="page-loader">
        <div className="loader-spinner" />
      </div>
    );

  return (
    <div className="glass-card animate-in">
      <h2>Access Control</h2>
      <p className="text-muted" style={{ marginBottom: "20px" }}>
        Manage which users have access to this Admin Panel.
      </p>

      <table className="session-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>
                <div style={{ fontWeight: 600 }}>{u.name || "Unknown"}</div>
                <div className="text-muted" style={{ fontSize: "0.8rem" }}>
                  {u.email}
                </div>
              </td>
              <td>
                {u.isAdmin ? (
                  <span className="status-badge working">Admin</span>
                ) : (
                  <span
                    className="status-badge on-break"
                    style={{
                      background: "var(--slate-bg)",
                      color: "var(--text-muted)",
                    }}
                  >
                    User
                  </span>
                )}
              </td>
              <td>
                <div
                  style={{ display: "flex", gap: "8px", alignItems: "center" }}
                >
                  {!u.isAdmin && (
                    <button
                      className="btn-secondary"
                      style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                      onClick={() => handleGrantAdmin(u.id, u.name || u.email)}
                    >
                      Grant Admin
                    </button>
                  )}
                  {u.isAdmin && u.id !== currentUserId && (
                    <button
                      className="btn-secondary"
                      style={{
                        padding: "6px 12px",
                        fontSize: "0.8rem",
                        color: "var(--danger)",
                        borderColor: "rgba(229,77,77,0.3)",
                      }}
                      onClick={() => handleRevokeAdmin(u.id, u.name || u.email)}
                    >
                      Revoke
                    </button>
                  )}
                  {u.id === currentUserId && (
                    <span
                      className="text-muted"
                      style={{ fontSize: "0.8rem", fontStyle: "italic" }}
                    >
                      {" "}
                      (You)
                    </span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
