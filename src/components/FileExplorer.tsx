import { useState } from 'react'
import { FileNode } from '../types'

interface FileExplorerProps {
  tree: FileNode[]
  activeFile: string | null
  pinnedFiles: string[]
  onFileClick: (path: string) => void
  onPinToggle: (path: string) => void
  onOpenFolder: () => void
}

function FileItem({
  node,
  depth,
  activeFile,
  pinnedFiles,
  onFileClick,
  onPinToggle,
}: {
  node: FileNode
  depth: number
  activeFile: string | null
  pinnedFiles: string[]
  onFileClick: (path: string) => void
  onPinToggle: (path: string) => void
}) {
  const [isOpen, setIsOpen] = useState(true)
  const isPinned = pinnedFiles.includes(node.path)
  const isActive = activeFile === node.path

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
          className="file-tree-item"
          style={{ paddingLeft: `${8 + depth * 12}px` }}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className={`file-tree-chevron ${isOpen ? 'open' : ''}`}>▶</span>
          <span className="file-tree-icon">📁</span>
          <span className="file-tree-name">{node.name}</span>
        </div>
        {isOpen && node.children?.map((child) => (
          <FileItem
            key={child.path}
            node={child}
            depth={depth + 1}
            activeFile={activeFile}
            pinnedFiles={pinnedFiles}
            onFileClick={onFileClick}
            onPinToggle={onPinToggle}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className={`file-tree-item ${isActive ? 'active' : ''} ${isPinned ? 'pinned' : ''}`}
      style={{ paddingLeft: `${8 + depth * 12}px` }}
      onClick={() => onFileClick(node.path)}
    >
      <span className="file-tree-icon">{getFileIcon(node.name, false)}</span>
      <span className="file-tree-name">{node.name}</span>
      <button
        className={`file-tree-pin-btn ${isPinned ? 'pinned' : ''}`}
        onClick={(e) => { e.stopPropagation(); onPinToggle(node.path) }}
        title={isPinned ? 'Unpin file' : 'Pin file (always in AI context)'}
      >
        {isPinned ? '📌' : '📍'}
      </button>
    </div>
  )
}

export default function FileExplorer({
  tree,
  activeFile,
  pinnedFiles,
  onFileClick,
  onPinToggle,
  onOpenFolder,
}: FileExplorerProps) {
  const pinnedNodes = tree
    .flatMap(function flatten(n: FileNode): FileNode[] {
      return n.isDir ? [n, ...(n.children ?? []).flatMap(flatten)] : [n]
    })
    .filter((n) => pinnedFiles.includes(n.path))

  return (
    <aside className="explorer">
      <div className="explorer-header">
        <h2>Explorer</h2>
        <button className="btn-open-folder" onClick={onOpenFolder}>
          <span>📂</span> Open Folder
        </button>
      </div>

      <div className="explorer-body">
        {pinnedNodes.length > 0 && (
          <>
            <div className="explorer-section-label">📌 Pinned</div>
            {pinnedNodes.map((node) => (
              <FileItem
                key={`pinned-${node.path}`}
                node={node}
                depth={0}
                activeFile={activeFile}
                pinnedFiles={pinnedFiles}
                onFileClick={onFileClick}
                onPinToggle={onPinToggle}
              />
            ))}
            <div className="explorer-section-label" style={{ marginTop: 8 }}>Files</div>
          </>
        )}

        {tree.map((node) => (
          <FileItem
            key={node.path}
            node={node}
            depth={0}
            activeFile={activeFile}
            pinnedFiles={pinnedFiles}
            onFileClick={onFileClick}
            onPinToggle={onPinToggle}
          />
        ))}
      </div>
    </aside>
  )
}
