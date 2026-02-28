import { useApp } from "../AppProvider";
import { useEffect, useState } from "react";
import MainLayout from "./MainLayout";
import MenuBar from "./MenuBar";
import SettingsPage from "./SettingsPage";
import TitleBar from "./TitleBar";
import WelcomeScreen from "./WelcomeScreen";

function AppShell() {
  const { folderPath, settings } = useApp()
  const [showSettings, setShowSettings] = useState(false)

  // Close settings on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowSettings(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <div className="app" data-theme={settings.theme}>

      <TitleBar />
      <MenuBar onOpenSettings={() => setShowSettings(true)} />

      <div style={{ flex: 1, overflow: "hidden", position: "relative", display: "flex", flexDirection: "column" }}>
        {folderPath ? <MainLayout /> : <WelcomeScreen />}
        {showSettings && <SettingsPage onClose={() => setShowSettings(false)} />}
      </div>
    </div>
  )
}

export default AppShell;
