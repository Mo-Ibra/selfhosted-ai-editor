import { useApp } from "../AppContext";

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

export default EditorTabs;