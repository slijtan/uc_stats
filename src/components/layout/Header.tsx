import { useState, useCallback } from "react";
import { Link, NavLink } from "react-router-dom";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = useCallback(() => {
    setMenuOpen((prev) => !prev);
  }, []);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  return (
    <header className="header">
      <div className="header-inner">
        <Link to="/" className="header-brand" onClick={closeMenu}>
          <span className="header-title">UC Stats</span>
        </Link>
        <button
          type="button"
          className="header-menu-toggle"
          onClick={toggleMenu}
          aria-expanded={menuOpen}
          aria-controls="main-nav"
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
        >
          {menuOpen ? "\u2715" : "\u2630"}
        </button>
        <nav
          id="main-nav"
          className={`header-nav${menuOpen ? " open" : ""}`}
          aria-label="Main navigation"
        >
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `header-nav-link${isActive ? " active" : ""}`
            }
            onClick={closeMenu}
          >
            Home
          </NavLink>
          <NavLink
            to="/by-college"
            className={({ isActive }) =>
              `header-nav-link${isActive ? " active" : ""}`
            }
            onClick={closeMenu}
          >
            By College
          </NavLink>
          <NavLink
            to="/multi-compare"
            className={({ isActive }) =>
              `header-nav-link${isActive ? " active" : ""}`
            }
            onClick={closeMenu}
          >
            Compare
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
