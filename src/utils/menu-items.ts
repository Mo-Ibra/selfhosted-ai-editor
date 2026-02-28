export interface MenuItem {
  label: string;
  shortcut?: string;
  divider?: boolean;
  disabled?: boolean;
  icon?: string;
  action?: string;
}

export interface MenuGroup {
  label: string;
  items: MenuItem[];
}

export const menuItems: MenuGroup[] = [
  {
    label: "File",
    items: [
      { label: "Open Folder…", shortcut: "Ctrl+K Ctrl+O", icon: "📂" },
      { label: "Open File…", shortcut: "Ctrl+O", icon: "📄" },
      { divider: true, label: "" },
      { label: "Save", shortcut: "Ctrl+S", icon: "💾" },
      { label: "Save All", shortcut: "Ctrl+Shift+S", icon: "💾" },
      { divider: true, label: "" },
      { label: "Close Editor", shortcut: "Ctrl+W", icon: "✕" },
      { divider: true, label: "" },
      { label: "Exit", shortcut: "Alt+F4", icon: "⏻" },
    ],
  },
  {
    label: "Edit",
    items: [
      { label: "Undo", shortcut: "Ctrl+Z", icon: "↩" },
      { label: "Redo", shortcut: "Ctrl+Y", icon: "↪" },
      { divider: true, label: "" },
      { label: "Cut", shortcut: "Ctrl+X", icon: "✂" },
      { label: "Copy", shortcut: "Ctrl+C", icon: "⎘" },
      { label: "Paste", shortcut: "Ctrl+V", icon: "📋" },
      { divider: true, label: "" },
      { label: "Find", shortcut: "Ctrl+F", icon: "🔍" },
      { label: "Replace", shortcut: "Ctrl+H", icon: "🔄" },
      { divider: true, label: "" },
      { label: "Select All", shortcut: "Ctrl+A", icon: "⬜" },
    ],
  },
  {
    label: "View",
    items: [
      { label: "Explorer", shortcut: "Ctrl+Shift+E", icon: "📁" },
      { label: "AI Chat", shortcut: "Ctrl+Shift+A", icon: "🤖" },
      { divider: true, label: "" },
      { label: "Zoom In", shortcut: "Ctrl+=", icon: "🔍", action: "zoomIn" },
      { label: "Zoom Out", shortcut: "Ctrl+-", icon: "🔎", action: "zoomOut" },
      { label: "Reset Zoom", shortcut: "Ctrl+0", icon: "⊙", action: "resetZoom" },
      { divider: true, label: "" },
      { label: "Toggle Full Screen", shortcut: "F11", icon: "⛶" },
    ],
  },
  {
    label: "Settings",
    items: [
      { label: "Preferences", shortcut: "Ctrl+,", icon: "⚙", action: "openSettings" },
      { label: "AI Model Config", icon: "🧠" },
      { divider: true, label: "" },
      { label: "Keyboard Shortcuts", shortcut: "Ctrl+K Ctrl+S", icon: "⌨" },
      { divider: true, label: "" },
      { label: "About AI Editor", icon: "ℹ" },
    ],
  },
];