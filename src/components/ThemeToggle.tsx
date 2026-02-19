"use client";

import { useTheme } from "./ThemeProvider";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const modes: Array<{ value: "light" | "dark" | "system"; icon: string; label: string }> = [
    { value: "light", icon: "☀️", label: "Light" },
    { value: "dark", icon: "🌙", label: "Dark" },
    { value: "system", icon: "💻", label: "System" },
  ];

  return (
    <div className="theme-toggle">
      {modes.map((mode) => (
        <button
          key={mode.value}
          className={`theme-btn ${theme === mode.value ? "active" : ""}`}
          onClick={() => setTheme(mode.value)}
          title={mode.label}
        >
          <span className="theme-btn-icon">{mode.icon}</span>
          {/* <span className="theme-btn-label">{mode.label}</span> */}
        </button>
      ))}
    </div>
  );
}
