import { useApp } from "../AppContext";

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


export default TitleBar;