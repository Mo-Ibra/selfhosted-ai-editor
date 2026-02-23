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
  const [isOpen, setIsOpen] = useState(false)
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
          className="file-tree-item directory"
          style={{ paddingLeft: `${8 + depth * 18}px` }}
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
                pinnedFiles={pinnedFiles}
                onFileClick={onFileClick}
                onPinToggle={onPinToggle}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={`file-tree-item ${isActive ? 'active' : ''} ${isPinned ? 'pinned' : ''}`}
      style={{ paddingLeft: `${8 + depth * 18}px` }}
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

interface FileExplorerProps {
  tree: FileNode[]
  activeFile: string | null
  pinnedFiles: string[]
  onFileClick: (path: string) => void
  onPinToggle: (path: string) => void
  onOpenFolder: () => void
  aiModel: string
  onModelChange: (model: string) => void
}

export default function FileExplorer({
  tree,
  activeFile,
  pinnedFiles,
  onFileClick,
  onPinToggle,
  onOpenFolder,
  aiModel,
  onModelChange,
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

      <div className="model-selector-box">
        <label className="model-label">OLLAMA MODEL</label>
        <input
          className="model-input"
          value={aiModel}
          onChange={(e) => onModelChange(e.target.value)}
          placeholder="e.g. qwen:7b"
          spellCheck={false}
        />
      </div>

      <div className="explorer-body">
        {pinnedFiles.length > 0 && (
          <>
            <div className="explorer-section-label">📌 Pinned</div>
            {pinnedFiles.map((path) => {
              const node = findNodeByPath(tree, path) || {
                name: path.split(/[\\/]/).pop() || path,
                path: path,
                isDir: false
              }
              return (
                <FileItem
                  key={`pinned-${path}`}
                  node={node}
                  depth={0}
                  activeFile={activeFile}
                  pinnedFiles={pinnedFiles}
                  onFileClick={onFileClick}
                  onPinToggle={onPinToggle}
                />
              )
            })}
          </>
        )}

        <div className="explorer-section-label" style={{ marginTop: 12 }}>PROJECT</div>
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
