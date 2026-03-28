import { useApp } from "../AppProvider";
import FileExplorer from "./FileExplorer";

function Sidebar() {
  const { fileTree, activeFilePath, gitStatus, openFile, openFolder } = useApp()

  return (
    <FileExplorer
      tree={fileTree}
      activeFile={activeFilePath}
      gitStatus={gitStatus}
      onFileClick={openFile}
      onOpenFolder={openFolder}
    />
  )
}

export default Sidebar;