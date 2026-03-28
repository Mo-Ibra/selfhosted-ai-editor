import { useApp } from "../AppProvider";
import { useEffect, useState } from "react";
import MainLayout from "./MainLayout";
import MenuBar from "../components/MenuBar";
import SettingsScreen from "./SettingsScreen";
import AIModelConfigScreen from "./AIModelConfigScreen";
import TitleBar from "../components/TitleBar";
import WelcomeScreen from "./WelcomeScreen";

function AppShell() {
  const { folderPath, settings } = useApp()
  const [showSettings, setShowSettings] = useState(false)
  const [showAIConfig, setShowAIConfig] = useState(false)

  // Close overlays on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowSettings(false)
        setShowAIConfig(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <div className="app" data-theme={settings.theme}>

      <TitleBar />
      <MenuBar
        onOpenSettings={() => setShowSettings(true)}
        onOpenAIConfig={() => setShowAIConfig(true)}
      />

      <div style={{ flex: 1, overflow: "hidden", position: "relative", display: "flex", flexDirection: "column" }}>
        {folderPath ? <MainLayout /> : <WelcomeScreen />}
        {showSettings && <SettingsScreen onClose={() => setShowSettings(false)} />}
        {showAIConfig && <AIModelConfigScreen onClose={() => setShowAIConfig(false)} />}
      </div>
    </div>
  )
}

export default AppShell;
