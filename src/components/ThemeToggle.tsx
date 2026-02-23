"use client";

import { useTheme } from "./ThemeProvider";
import { RiSunLine, RiMoonClearLine, RiComputerLine } from "@remixicon/react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const modes: Array<{
    value: "light" | "dark" | "system";
    icon: React.ReactNode;
    label: string;
  }> = [
    {
      value: "light",
      icon: <RiSunLine className="theme-btn-icon" size={16} />,
      label: "Light",
    },
    {
      value: "dark",
      icon: <RiMoonClearLine className="theme-btn-icon" size={16} />,
      label: "Dark",
    },
    {
      value: "system",
      icon: <RiComputerLine className="theme-btn-icon" size={16} />,
      label: "System",
    },
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
          {mode.icon}
          {/* <span className="theme-btn-label">{mode.label}</span> */}
        </button>
      ))}
    </div>
  );
}
