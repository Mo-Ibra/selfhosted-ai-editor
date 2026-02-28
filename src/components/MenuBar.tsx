import { useState, useRef, useEffect } from "react";
import { menuItems } from "../utils/menu-items";

function MenuBar() {

  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMenuClick = (label: string) => {
    setOpenMenu((prev) => (prev === label ? null : label));
  };

  const handleMenuHover = (label: string) => {
    // If any menu is already open, switch to hovered menu on hover
    if (openMenu !== null) {
      setOpenMenu(label);
    }
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
