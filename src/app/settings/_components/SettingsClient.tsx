"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  RiUserSettingsLine,
  RiErrorWarningLine,
  RiCheckboxCircleLine,
  RiNotification3Line,
  RiSaveLine,
  RiLockPasswordLine,
  RiEyeOffLine,
  RiEyeLine,
  RiRefreshLine,
} from "@remixicon/react";

export default function SettingsClient() {
  const { data: session } = useSession();

  const [name, setName] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [profileMessage, setProfileMessage] = useState({ type: "", text: "" });
  const [passwordMessage, setPasswordMessage] = useState({
    type: "",
    text: "",
  });

  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      if (!session?.user) return;
      try {
        const res = await fetch("/api/user/profile");
        if (res.ok) {
          const data = await res.json();
          setName(data.name || "");
          setNotificationsEnabled(data.notificationsEnabled ?? true);
        }
      } catch (error) {
        console.error("Failed to load profile:", error);
      } finally {
        setIsLoadingProfile(false);
      }
    }
    fetchProfile();
  }, [session]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileMessage({ type: "", text: "" });

    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, notificationsEnabled }),
      });

      if (res.ok) {
        setProfileMessage({
          type: "success",
          text: "Profile updated successfully!",
        });
        // Ask for permissions if toggled on
        if (notificationsEnabled && "Notification" in window) {
          if (
            Notification.permission !== "granted" &&
            Notification.permission !== "denied"
          ) {
            Notification.requestPermission();
          }
        }
      } else {
        const data = await res.json();
        setProfileMessage({
          type: "error",
          text: data.error || "Failed to update profile.",
        });
      }
    } catch {
      setProfileMessage({ type: "error", text: "Network error occurred." });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPassword(true);
    setPasswordMessage({ type: "", text: "" });

    if (newPassword !== confirmPassword) {
      setPasswordMessage({
        type: "error",
        text: "New passwords do not match.",
      });
      setIsSavingPassword(false);
      return;
    }

    if (newPassword.length < 6) {
      setPasswordMessage({
        type: "error",
        text: "New password must be at least 6 characters.",
      });
      setIsSavingPassword(false);
      return;
    }

    try {
      const res = await fetch("/api/user/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (res.ok) {
        setPasswordMessage({
          type: "success",
          text: "Password changed successfully!",
        });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const data = await res.json();
        setPasswordMessage({
          type: "error",
          text: data.error || "Failed to change password.",
        });
      }
    } catch {
      setPasswordMessage({ type: "error", text: "Network error occurred." });
    } finally {
      setIsSavingPassword(false);
    }
  };

  if (isLoadingProfile) {
    return (
      <div className="page-loader">
        <div className="loader-spinner" />
      </div>
    );
  }

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h1>Account Settings</h1>
        <p>Manage your profile, password, and preferences</p>
      </div>

      <div className="settings-grid">
        {/* Profile Card */}
        <div className="glass-card animate-in">
          <div className="settings-card-title">
            <RiUserSettingsLine size={24} />
            <h2>Profile Details</h2>
          </div>

          <form className="settings-form" onSubmit={handleProfileSubmit}>
            {profileMessage.text && (
              <div className={`dm-message dm-message-${profileMessage.type}`}>
                {profileMessage.type === "error" ? (
                  <RiErrorWarningLine className="dm-msg-icon" size={18} />
                ) : (
                  <RiCheckboxCircleLine className="dm-msg-icon" size={18} />
                )}
                {profileMessage.text}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={session?.user?.email || ""}
                disabled
                className="input-disabled"
              />
              <span className="input-hint">Email cannot be changed</span>
            </div>

            <div className="form-group">
              <label htmlFor="name">Display Name</label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
              />
            </div>

            <div className="settings-divider" />

            <div className="settings-card-title">
              <RiNotification3Line size={24} />
              <h2>Notifications</h2>
            </div>

            <label className="toggle-switch-card">
              <div className="toggle-info">
                <span className="toggle-title">Desktop Notifications</span>
                <span className="toggle-desc">
                  Get alerted when your workday is complete and OT begins.
                </span>
              </div>
              <div className="toggle-wrapper">
                <input
                  type="checkbox"
                  className="toggle-checkbox"
                  checked={notificationsEnabled}
                  onChange={(e) => setNotificationsEnabled(e.target.checked)}
                />
                <div className="toggle-slider"></div>
              </div>
            </label>

            <button
              type="submit"
              className="btn-primary"
              disabled={isSavingProfile}
            >
              {isSavingProfile ? (
                <span className="spinner"></span>
              ) : (
                <>
                  <RiSaveLine size={18} /> Save Profile
                </>
              )}
            </button>
          </form>
        </div>

        {/* Security Card */}
        <div className="glass-card animate-in delay-1">
          <div className="settings-card-title">
            <RiLockPasswordLine size={24} />
            <h2>Security</h2>
          </div>

          <form className="settings-form" onSubmit={handlePasswordSubmit}>
            {passwordMessage.text && (
              <div className={`dm-message dm-message-${passwordMessage.type}`}>
                {passwordMessage.type === "error" ? (
                  <RiErrorWarningLine className="dm-msg-icon" size={18} />
                ) : (
                  <RiCheckboxCircleLine className="dm-msg-icon" size={18} />
                )}
                {passwordMessage.text}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="currentPassword">Current Password</label>
              <div className="password-field-wrapper">
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  id="currentPassword"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  aria-label="Toggle current password visibility"
                >
                  {showCurrentPassword ? (
                    <RiEyeOffLine size={18} />
                  ) : (
                    <RiEyeLine size={18} />
                  )}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="newPassword">New Password</label>
              <div className="password-field-wrapper">
                <input
                  type={showNewPassword ? "text" : "password"}
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  aria-label="Toggle new password visibility"
                >
                  {showNewPassword ? (
                    <RiEyeOffLine size={18} />
                  ) : (
                    <RiEyeLine size={18} />
                  )}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm New Password</label>
              <div className="password-field-wrapper">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label="Toggle confirm password visibility"
                >
                  {showConfirmPassword ? (
                    <RiEyeOffLine size={18} />
                  ) : (
                    <RiEyeLine size={18} />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn-secondary"
              disabled={isSavingPassword}
            >
              {isSavingPassword ? (
                <span className="spinner"></span>
              ) : (
                <>
                  <RiRefreshLine size={18} /> Update Password
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
