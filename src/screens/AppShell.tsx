import { useApp } from "../AppProvider";
import { useEffect, useState, useCallback } from "react";
import MainLayout from "./MainLayout";
import MenuBar from "../components/MenuBar";
import SettingsScreen from "./SettingsScreen";
import AIModelConfigScreen from "./AIModelConfigScreen";
import ShortcutsScreen from "./ShortcutsScreen";
import TitleBar from "../components/TitleBar";
import WelcomeScreen from "./WelcomeScreen";

function AppShell() {
  const { folderPath, settings, updateSetting, zoomIn, zoomOut, resetZoom } = useApp()
  const [showSettings, setShowSettings] = useState(false)
  const [showAIConfig, setShowAIConfig] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)

  const toggleSidebar = useCallback(() => {
    updateSetting('showSidebar', !settings.showSidebar)
  }, [settings.showSidebar, updateSetting])

  const toggleChat = useCallback(() => {
    updateSetting('showChat', !settings.showChat)
  }, [settings.showChat, updateSetting])

  // Global Keyboard Shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;

      // Escape to close all overlays
      if (e.key === "Escape") {
        setShowSettings(false)
        setShowAIConfig(false)
        setShowShortcuts(false)
        return
      }

      if (ctrl) {
        // Layout: Ctrl+B (Sidebar), Ctrl+J (Chat)
        if (e.key.toLowerCase() === 'b') {
          e.preventDefault()
          toggleSidebar()
        }
        if (e.key.toLowerCase() === 'j') {
          e.preventDefault()
          toggleChat()
        }
        // Overlays: Ctrl+, (Settings), Ctrl+/ (Shortcuts), Ctrl+Shift+M (AI Config)
        if (e.key === ',') {
          e.preventDefault()
          setShowSettings(prev => !prev)
        }
        if (e.key === '/') {
          e.preventDefault()
          setShowShortcuts(prev => !prev)
        }
        if (e.shiftKey && e.key.toLowerCase() === 'm') {
          e.preventDefault()
          setShowAIConfig(prev => !prev)
        }
        // Zoom: Ctrl+=, Ctrl+-, Ctrl+0
        if (e.key === '=' || e.key === '+') {
          e.preventDefault()
          zoomIn()
        }
        if (e.key === '-') {
          e.preventDefault()
          zoomOut()
        }
        if (e.key === '0') {
          e.preventDefault()
          resetZoom()
        }
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [settings.showSidebar, settings.showChat, toggleSidebar, toggleChat, zoomIn, zoomOut, resetZoom])

  return (
    <div className="app" data-theme={settings.theme}>
      <TitleBar />
      <MenuBar
        onOpenSettings={() => setShowSettings(true)}
        onOpenAIConfig={() => setShowAIConfig(true)}
        onOpenShortcuts={() => setShowShortcuts(true)}
        onToggleSidebar={toggleSidebar}
        onToggleChat={toggleChat}
      />

      <div style={{ flex: 1, overflow: "hidden", position: "relative", display: "flex", flexDirection: "column" }}>
        {folderPath ? <MainLayout /> : <WelcomeScreen />}

        {/* Overlays */}
        {showSettings && <SettingsScreen onClose={() => setShowSettings(false)} />}
        {showAIConfig && <AIModelConfigScreen onClose={() => setShowAIConfig(false)} />}
        {showShortcuts && <ShortcutsScreen onClose={() => setShowShortcuts(false)} />}
      </div>
    </div>
  )
}

export default AppShell;
