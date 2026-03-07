import { useApp } from "../AppProvider";
import FileExplorer from "./FileExplorer";

function Sidebar() {
  const { fileTree, activeFilePath, pinnedFiles, gitStatus, aiModel, openFile, togglePin, openFolder, setAiModel } = useApp()

  return (
    <FileExplorer
      tree={fileTree}
      activeFile={activeFilePath}
      pinnedFiles={pinnedFiles}
      gitStatus={gitStatus}
      onFileClick={openFile}
      onPinToggle={togglePin}
      onOpenFolder={openFolder}
      aiModel={aiModel}
      onModelChange={setAiModel}
    />
  )
}

export default Sidebar;