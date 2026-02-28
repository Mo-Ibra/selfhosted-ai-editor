import { useState, useRef, useEffect, useCallback } from "react";
import { menuItems } from "../utils/menu-items";
import { useApp } from "../AppProvider";

function MenuBar() {
  const { zoomIn, zoomOut, resetZoom } = useApp();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // ── Map of action name → handler ─────────────────────────────────
  const actionHandlers: Record<string, () => void> = {
    zoomIn,
    zoomOut,
    resetZoom,
  };

  // ── Dispatch a named action ───────────────────────────────────────
  const dispatch = useCallback(
    (action?: string) => {
      if (action && actionHandlers[action]) {
        actionHandlers[action]();
      }
    },
    [zoomIn, zoomOut, resetZoom]
  );

  // ── Close dropdown when clicking outside ─────────────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Global keyboard shortcuts ─────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;

      // Zoom In: Ctrl+= or Ctrl++
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        zoomIn();
        return;
      }
      // Zoom Out: Ctrl+-
      if (e.key === "-") {
        e.preventDefault();
        zoomOut();
        return;
      }
      // Reset Zoom: Ctrl+0
      if (e.key === "0") {
        e.preventDefault();
        resetZoom();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [zoomIn, zoomOut, resetZoom]);

  // ── Menu open/hover handlers ──────────────────────────────────────
  const handleMenuClick = (label: string) => {
    setOpenMenu((prev) => (prev === label ? null : label));
  };

  const handleMenuHover = (label: string) => {
    if (openMenu !== null) setOpenMenu(label);
  };

  return (
    <div className="menubar" ref={barRef}>
      {menuItems.map((menu) => (
        <div
          key={menu.label}
          className={`menubar-item ${openMenu === menu.label ? "open" : ""}`}
          onClick={() => handleMenuClick(menu.label)}
          onMouseEnter={() => handleMenuHover(menu.label)}
        >
          <span className="menubar-item-label">{menu.label}</span>

          {openMenu === menu.label && (
            <div className="menubar-dropdown">
              {menu.items.map((item, idx) =>
                item.divider ? (
                  <div key={idx} className="menubar-divider" />
                ) : (
                  <div
                    key={idx}
                    className={`menubar-dropdown-item ${item.disabled ? "disabled" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch(item.action);
                      setOpenMenu(null);
                    }}
                  >
                    {item.icon && (
                      <span className="menubar-dropdown-icon">{item.icon}</span>
                    )}
                    <span className="menubar-dropdown-label">{item.label}</span>
                    {item.shortcut && (
                      <span className="menubar-dropdown-shortcut">
                        {item.shortcut}
                      </span>
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default MenuBar;
