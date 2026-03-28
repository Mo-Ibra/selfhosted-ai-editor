import { useApp } from "../AppProvider";
import FileExplorer from "./FileExplorer";

function Sidebar() {
  const { fileTree, activeFilePath, pinnedFiles, gitStatus, openFile, togglePin, openFolder } = useApp()

  return (
    <FileExplorer
      tree={fileTree}
      activeFile={activeFilePath}
      pinnedFiles={pinnedFiles}
      gitStatus={gitStatus}
      onFileClick={openFile}
      onPinToggle={togglePin}
      onOpenFolder={openFolder}
    />
  )
}

export default Sidebar;