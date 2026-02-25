import { useApp } from "../AppContext";
import FileExplorer from "./FileExplorer";

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

export default Sidebar;