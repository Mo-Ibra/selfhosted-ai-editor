import { useApp } from "../AppProvider";
import Editor from "./Editor";
import EditorTabs from "./EditorTabs";
import Terminal from "./Terminal";

function EditorPane() {
  const {
    folderPath, activeFilePath, activeContent,
    fileContents, pendingEdits, showTerminal,
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

export default EditorPane;