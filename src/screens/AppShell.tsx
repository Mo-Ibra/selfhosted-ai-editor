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
  const {
    folderPath, settings, updateSetting,
    zoomIn, zoomOut, resetZoom,
    editorRef, openFolder, openFile, saveFile, saveAll, closeFile
  } = useApp()
  const [showSettings, setShowSettings] = useState(false)
  const [showAIConfig, setShowAIConfig] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)

  const toggleSidebar = useCallback(() => {
    updateSetting('showSidebar', !settings.showSidebar)
  }, [settings.showSidebar, updateSetting])

  const toggleChat = useCallback(() => {
    updateSetting('showChat', !settings.showChat)
  }, [settings.showChat, updateSetting])

  const handleAction = useCallback(async (action: string) => {
    const editor = editorRef.current;

    switch (action) {
      // File Actions
      case 'openFolder': await openFolder(); break;
      case 'openFile': 
        const filePath = await window.electronAPI.selectFile();
        if (filePath) await openFile(filePath);
        break;
      case 'saveFile': await saveFile(); break;
      case 'saveAll': await saveAll(); break;
      case 'closeFile': closeFile(); break;
      case 'exit': window.electronAPI.windowClose(); break;

      // Edit Actions
      case 'undo': editor?.focus(); editor?.getModel()?.undo(); break;
      case 'redo': editor?.focus(); editor?.getModel()?.redo(); break;
      case 'cut': editor?.focus(); document.execCommand('cut'); break;
      case 'copy': editor?.focus(); document.execCommand('copy'); break;
      case 'paste': editor?.focus(); document.execCommand('paste'); break;
      case 'find': editor?.focus(); editor?.getAction('actions.find')?.run(); break;
      case 'replace': editor?.focus(); editor?.getAction('editor.action.startFindReplaceAction')?.run(); break;
      case 'selectAll': editor?.focus(); editor?.getAction('editor.action.selectAll')?.run(); break;

      // Layout Actions
      case 'toggleSidebar': toggleSidebar(); break;
      case 'toggleChat': toggleChat(); break;

      // View/Zoom Actions
      case 'zoomIn': zoomIn(); break;
      case 'zoomOut': zoomOut(); break;
      case 'resetZoom': resetZoom(); break;

      // Overlay Actions
      case 'openSettings': setShowSettings(true); break;
      case 'openAIConfig': setShowAIConfig(true); break;
      case 'openShortcuts': setShowShortcuts(true); break;

      default: console.warn('Unhandled action:', action);
    }
  }, [editorRef, toggleSidebar, toggleChat, zoomIn, zoomOut, resetZoom]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;

      if (e.key === "Escape") {
        setShowSettings(false)
        setShowAIConfig(false)
        setShowShortcuts(false)
        return
      }

      if (ctrl) {
        if (e.key.toLowerCase() === 'b') { e.preventDefault(); handleAction('toggleSidebar'); }
        if (e.key.toLowerCase() === 'j') { e.preventDefault(); handleAction('toggleChat'); }
        if (e.key.toLowerCase() === 'o') { e.preventDefault(); handleAction('openFile'); }
        if (e.key.toLowerCase() === 's') {
          e.preventDefault();
          if (e.shiftKey) handleAction('saveAll');
          else handleAction('saveFile');
        }
        if (e.key.toLowerCase() === 'w') { e.preventDefault(); handleAction('closeFile'); }
        if (e.key === ',') { e.preventDefault(); handleAction('openSettings'); }
        if (e.key === '/') { e.preventDefault(); handleAction('openShortcuts'); }
        if (e.shiftKey && e.key.toLowerCase() === 'm') { e.preventDefault(); handleAction('openAIConfig'); }
        if (e.key === '=' || e.key === '+') { e.preventDefault(); handleAction('zoomIn'); }
        if (e.key === '-') { e.preventDefault(); handleAction('zoomOut'); }
        if (e.key === '0') { e.preventDefault(); handleAction('resetZoom'); }

        // Let the editor handle Ctrl+Z, Ctrl+Y, Ctrl+C, etc. naturally if focused
        // But for menu consistency, we have handleAction for the mouse clicks
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [handleAction])

  return (
    <div className="app" data-theme={settings.theme}>
      <TitleBar />
      <MenuBar onAction={handleAction} />

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
