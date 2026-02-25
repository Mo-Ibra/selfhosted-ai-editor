import { useEffect, useState } from "react";

/**
 * Terminal Hook
 * 
 * Manages the terminal visibility and keyboard shortcuts.
 */
export function useTerminal() {
  const [showTerminal, setShowTerminal] = useState(false);

  // ── Ctrl+` Shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Toggle Terminal on click CTRL + '`'
      if (e.ctrlKey && e.key === '`') setShowTerminal((prev) => !prev);
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])


  return {
    showTerminal,
    openTerminal: () => setShowTerminal(true),
    closeTerminal: () => setShowTerminal(false),
    toggleTerminal: () => setShowTerminal((prev) => !prev),
  }
}