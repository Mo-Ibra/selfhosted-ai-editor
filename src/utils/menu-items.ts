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
      { label: "Open Folder…", shortcut: "Ctrl+K Ctrl+O", icon: "📂", action: "openFolder" },
      { label: "Open File…", shortcut: "Ctrl+O", icon: "📄" },
      { divider: true, label: "" },
      { label: "Save", shortcut: "Ctrl+S", icon: "💾", action: "saveFile" },
      { label: "Save All", shortcut: "Ctrl+Shift+S", icon: "💾", action: "saveAll" },
      { divider: true, label: "" },
      { label: "Close Editor", shortcut: "Ctrl+W", icon: "✕", action: "closeFile" },
      { divider: true, label: "" },
      { label: "Exit", shortcut: "Alt+F4", icon: "⏻", action: "exit" },
    ],
  },
  {
    label: "Edit",
    items: [
      { label: "Undo", shortcut: "Ctrl+Z", icon: "↩", action: "undo" },
      { label: "Redo", shortcut: "Ctrl+Y", icon: "↪", action: "redo" },
      { divider: true, label: "" },
      { label: "Cut", shortcut: "Ctrl+X", icon: "✂", action: "cut" },
      { label: "Copy", shortcut: "Ctrl+C", icon: "⎘", action: "copy" },
      { label: "Paste", shortcut: "Ctrl+V", icon: "📋", action: "paste" },
      { divider: true, label: "" },
      { label: "Find", shortcut: "Ctrl+F", icon: "🔍", action: "find" },
      { label: "Replace", shortcut: "Ctrl+H", icon: "🔄", action: "replace" },
      { divider: true, label: "" },
      { label: "Select All", shortcut: "Ctrl+A", icon: "⬜", action: "selectAll" },
    ],
  },
  {
    label: "View",
    items: [
      { label: "Explorer", shortcut: "Ctrl+B", icon: "📁", action: "toggleSidebar" },
      { label: "AI Chat", shortcut: "Ctrl+J", icon: "🤖", action: "toggleChat" },
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
      { label: "AI Model Config", shortcut: "Ctrl+Shift+M", icon: "🧠", action: "openAIConfig" },
      { divider: true, label: "" },
      { label: "Keyboard Shortcuts", shortcut: "Ctrl+/", icon: "⌨", action: "openShortcuts" },
      { divider: true, label: "" },
      { label: "About AI Editor", icon: "ℹ" },
    ],
  },
];