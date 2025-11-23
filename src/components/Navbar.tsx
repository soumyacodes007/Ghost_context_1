import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ConnectButton } from "@mysten/dapp-kit";
import { MessageSquare, Lock, Store, ShoppingBag, Menu, X } from "lucide-react";
import "./Navbar.css";

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { name: "Chat", path: "/chat", icon: MessageSquare },
  { name: "Vault", path: "/vault", icon: Lock },
  { name: "Marketplace", path: "/marketplace", icon: Store },
  { name: "My Purchases", path: "/my-purchases", icon: ShoppingBag },
];

export const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav 
      className={`navbar ${scrolled ? "navbar-scrolled" : ""}`}
      style={{
        background: scrolled 
          ? 'rgba(255, 255, 255, 0.85)' 
          : 'rgba(255, 255, 255, 0.7)',
        backdropFilter: scrolled ? 'blur(24px) saturate(200%)' : 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: scrolled ? 'blur(24px) saturate(200%)' : 'blur(20px) saturate(180%)',
        boxShadow: scrolled 
          ? '0 4px 24px rgba(108, 99, 255, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)' 
          : '0 2px 16px rgba(108, 99, 255, 0.04)',
        borderBottom: scrolled 
          ? '1px solid rgba(108, 99, 255, 0.15)' 
          : '1px solid rgba(108, 99, 255, 0.1)',
      }}
    >
      <div className="navbar-container">
        {/* Logo - Left Side */}
        <Link to="/" className="navbar-logo">
          <svg className="navbar-logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C8.13 2 5 5.13 5 9C5 12.17 6.84 14.87 9.5 15.7V22L12 20L14.5 22V15.7C17.16 14.87 19 12.17 19 9C19 5.13 15.87 2 12 2Z" fill="url(#ghost-gradient)"/>
            <circle cx="9" cy="9" r="1.5" fill="white"/>
            <circle cx="15" cy="9" r="1.5" fill="white"/>
            <defs>
              <linearGradient id="ghost-gradient" x1="5" y1="2" x2="19" y2="22" gradientUnits="userSpaceOnUse">
                <stop stopColor="#8B7FFF"/>
                <stop offset="1" stopColor="#6C63FF"/>
              </linearGradient>
            </defs>
          </svg>
          <span className="navbar-logo-text">GhostContext</span>
        </Link>

        {/* Desktop Navigation - Center */}
        <div className="navbar-menu">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`navbar-link ${isActive(item.path) ? "navbar-link-active" : ""}`}
              >
                <Icon size={16} strokeWidth={2.5} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>

        {/* Wallet Connect - Right Side */}
        <div className="navbar-actions">
          <div style={{
            background: 'linear-gradient(135deg, #6C63FF 0%, #8B7FFF 100%)',
            borderRadius: '12px',
            boxShadow: '0 4px 16px rgba(108, 99, 255, 0.25)',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(108, 99, 255, 0.35)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(108, 99, 255, 0.25)';
          }}>
            <ConnectButton />
          </div>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="navbar-mobile-toggle"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle menu"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      <div className={`navbar-mobile-menu ${isOpen ? "navbar-mobile-menu-open" : ""}`}>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`navbar-mobile-link ${isActive(item.path) ? "navbar-mobile-link-active" : ""}`}
            >
              <Icon size={20} />
              <span>{item.name}</span>
            </Link>
          );
        })}
        <div className="navbar-mobile-wallet">
          <ConnectButton />
        </div>
      </div>
    </nav>
  );
};
