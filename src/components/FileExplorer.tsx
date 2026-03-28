import { useState } from 'react'
import { FileNode } from '../types'

interface FileExplorerProps {
  tree: FileNode[]
  activeFile: string | null
  gitStatus: Record<string, string>
  onFileClick: (path: string) => void
  onOpenFolder: () => void
}

function FileItem({
  node,
  depth,
  activeFile,
  gitStatus,
  onFileClick,
}: {
  node: FileNode
  depth: number
  activeFile: string | null
  gitStatus: Record<string, string>
  onFileClick: (path: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const isActive = activeFile === node.path

  // Normalize Windows paths in the map for matching
  const targetPath = node.path.replace(/\\/g, '/');
  // Match path against gitStatus keys (which are relative from the root)
  // Find if any key in gitStatus matches the end of our absolute targetPath
  const statusKey = Object.keys(gitStatus).find(k => targetPath.endsWith(k));
  const statusClass = statusKey ? `git-status-${gitStatus[statusKey]}` : '';

  const getFileIcon = (name: string, isDir: boolean) => {
    if (isDir) return '📁'
    const ext = name.split('.').pop()?.toLowerCase()
    const icons: Record<string, string> = {
      ts: '🔷', tsx: '⚛️', js: '🟨', jsx: '⚛️',
      py: '🐍', rs: '🦀', go: '🐹', java: '☕',
      css: '🎨', scss: '🎨', html: '🌐', json: '📋',
      md: '📝', txt: '📄', sh: '💻', yaml: '⚙️',
      yml: '⚙️', toml: '⚙️', env: '🔒', gitignore: '🙈',
    }
    return icons[ext ?? ''] ?? '📄'
  }

  if (node.isDir) {
    return (
      <div>
        <div
          className={`file-tree-item directory ${statusClass}`}
          style={{ paddingLeft: `${8 + depth * 10}px` }}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className={`file-tree-chevron ${isOpen ? 'open' : ''}`}>▶</span>
          <span className="file-tree-icon">📁</span>
          <span className="file-tree-name">{node.name}</span>
        </div>
        {isOpen && (
          <div className="file-tree-children">
            {node.children?.map((child) => (
              <FileItem
                key={child.path}
                node={child}
                depth={depth + 1}
                activeFile={activeFile}
                gitStatus={gitStatus}
                onFileClick={onFileClick}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={`file-tree-item ${isActive ? 'active' : ''} ${statusClass}`}
      style={{ paddingLeft: `${8 + depth * 10}px` }}
      onClick={() => onFileClick(node.path)}
    >
      <span className="file-tree-icon">{getFileIcon(node.name, false)}</span>
      <span className="file-tree-name">{node.name}</span>
    </div>
  )
}

interface FileExplorerProps {
  tree: FileNode[]
  activeFile: string | null
  gitStatus: Record<string, string>
  onFileClick: (path: string) => void
  onOpenFolder: () => void
}

export default function FileExplorer({
  tree,
  activeFile,
  gitStatus,
  onFileClick,
  onOpenFolder,
}: FileExplorerProps) {
  // Find nodes for pinned files to reuse FileItem
  const findNodeByPath = (nodes: FileNode[], path: string): FileNode | null => {
    for (const node of nodes) {
      if (node.path === path) return node
      if (node.children) {
        const found = findNodeByPath(node.children, path)
        if (found) return found
      }
    }
    return null
  }

  return (
    <aside className="explorer">
      <div className="explorer-header">
        <h2>Explorer</h2>
        <button className="btn-open-folder" onClick={onOpenFolder}>
          <span>📂</span> Open Folder
        </button>
      </div>

      <div className="explorer-body">
        <div className="explorer-section-label" style={{ marginTop: 12 }}>PROJECT</div>
        {tree.map((node) => (
          <FileItem
            key={node.path}
            node={node}
            depth={0}
            activeFile={activeFile}
            gitStatus={gitStatus}
            onFileClick={onFileClick}
          />
        ))}
      </div>
    </aside>
  )
}
