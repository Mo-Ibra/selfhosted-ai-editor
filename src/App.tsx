import './App.css'
import { AppProvider, useApp } from './AppContext'
import FileExplorer from './components/FileExplorer'
import Editor from './components/Editor'
import AIChat from './components/AIChat'
import Terminal from './components/Terminal'

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  )
}

// ─── App Shell ────────────────────────────────────────────────────────────────

function AppShell() {
  const { folderPath } = useApp()

  return (
    <div className="app">
      <TitleBar />
      {folderPath ? <MainLayout /> : <WelcomeScreen />}
    </div>
  )
}

// ─── Title Bar ────────────────────────────────────────────────────────────────

function TitleBar() {
  const { folderName, activeFileName } = useApp()

  return (
    <div className="titlebar">
      {folderName && <div className="titlebar-folder">📁 {folderName}</div>}

      <div className="titlebar-title">
        AI Editor {activeFileName ? `— ${activeFileName}` : ''}
      </div>

      <div className="titlebar-controls">
        <button className="control-btn minimize" onClick={() => window.electronAPI.windowMinimize()}>
          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M0 5h10v1H0z" fill="currentColor" /></svg>
        </button>
        <button className="control-btn maximize" onClick={() => window.electronAPI.windowMaximize()}>
          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M0 0h10v10H0V0zm1 1v8h8V1H1z" fill="currentColor" /></svg>
        </button>
        <button className="control-btn close" onClick={() => window.electronAPI.windowClose()}>
          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M0 0l10 10M10 0L0 10" stroke="currentColor" strokeWidth="1.2" /></svg>
        </button>
      </div>
    </div>
  )
}

// ─── Welcome Screen ───────────────────────────────────────────────────────────

function WelcomeScreen() {
  const { openFolder } = useApp()

  return (
    <div className="welcome-screen">
      <div className="welcome-icon">⚡</div>
      <h1>AI Editor</h1>
      <p>Open a project folder to start editing with AI assistance powered by Ollama.</p>
      <button className="btn-primary" onClick={openFolder}>
        📂 Open Folder
      </button>
    </div>
  )
}

// ─── Main Layout ──────────────────────────────────────────────────────────────

function MainLayout() {
  return (
    <div className="main-layout">
      <Sidebar />
      <EditorPane />
      <ChatPane />
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar() {
  const { fileTree, activeFilePath, pinnedFiles, aiModel, openFile, togglePin, openFolder, setAiModel } = useApp()

  return (
    <FileExplorer
      tree={fileTree}
      activeFile={activeFilePath}
      pinnedFiles={pinnedFiles}
      onFileClick={openFile}
      onPinToggle={togglePin}
      onOpenFolder={openFolder}
      aiModel={aiModel}
      onModelChange={setAiModel}
    />
  )
}

// ─── Editor Pane ─────────────────────────────────────────────────────────────

function EditorPane() {
  const {
    folderPath, activeFilePath, activeContent,
    fileContents, dirtyFiles, pendingEdits, showTerminal,
    changeContent, saveFile,
    acceptEdit, rejectEdit, acceptAllEdits, rejectAllEdits,
    setSelectedCode, closeTerminal,
  } = useApp()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <EditorTabs />

      <Editor
        content={activeContent}
        filePath={activeFilePath}
        fileContents={fileContents}
        pendingEdits={pendingEdits}
        onContentChange={changeContent}
        onAcceptEdit={acceptEdit}
        onRejectEdit={rejectEdit}
        onAcceptAll={acceptAllEdits}
        onRejectAll={rejectAllEdits}
        onSave={saveFile}
        onSelectionChange={setSelectedCode}
      />

      {showTerminal && folderPath && (
        <Terminal cwd={folderPath} onClose={closeTerminal} />
      )}
    </div>
  )
}

// ─── Editor Tabs ──────────────────────────────────────────────────────────────

function EditorTabs() {
  const { activeFilePath, activeFileName, dirtyFiles, closeFile } = useApp()

  if (!activeFilePath) return <div className="editor-tabs" />

  return (
    <div className="editor-tabs">
      <div className={`editor-tab active ${dirtyFiles.has(activeFilePath) ? 'dirty' : ''}`}>
        {activeFileName}
        <button className="tab-close-btn" onClick={closeFile}>
          {dirtyFiles.has(activeFilePath) ? '●' : '×'}
        </button>
      </div>
    </div>
  )
}

// ─── Chat Pane ───────────────────────────────────────────────────────────────

function ChatPane() {
  const {
    messages, isStreaming, aiModel, selectedCode,
    acceptedEdits, rejectedEdits,
    sendMessage, acceptEdit, rejectEdit,
  } = useApp()

  return (
    <AIChat
      messages={messages}
      isStreaming={isStreaming}
      onSend={sendMessage}
      onAcceptEdit={acceptEdit}
      onRejectEdit={rejectEdit}
      acceptedEdits={acceptedEdits}
      rejectedEdits={rejectedEdits}
      aiModel={aiModel}
      selectedCode={selectedCode}
    />
  )
}