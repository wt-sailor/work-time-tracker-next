import SettingsClient from "./_components/SettingsClient";

export const metadata = {
  title: "Settings - WorkTracker",
  description: "Manage your profile, password, and notification preferences.",
};

export default function SettingsPage() {
  return (
    <div className="main-content dashboard-page">
      <SettingsClient />
    </div>
  );
}
