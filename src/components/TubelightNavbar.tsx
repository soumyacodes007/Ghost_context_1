import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { LucideIcon } from "lucide-react";
import "./TubelightNavbar.css";

interface NavItem {
  name: string;
  url: string;
  icon: LucideIcon;
}

interface NavBarProps {
  items: NavItem[];
  className?: string;
}

export function TubelightNavbar({ items, className = "" }: NavBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(items[0].name);

  // Update active tab based on current route
  useEffect(() => {
    const currentItem = items.find(item => item.url === location.pathname);
    if (currentItem) {
      setActiveTab(currentItem.name);
    }
  }, [location.pathname, items]);

  const handleClick = (item: NavItem) => {
    setActiveTab(item.name);
    navigate(item.url);
  };

  return (
    <div className={`tubelight-navbar-container ${className}`}>
      <div className="tubelight-navbar">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.name;
          
          return (
            <button
              key={item.name}
              onClick={() => handleClick(item)}
              className={`nav-item ${isActive ? "active" : ""}`}
            >
              <span className="nav-item-text">{item.name}</span>
              <span className="nav-item-icon">
                <Icon size={18} strokeWidth={2.5} />
              </span>
              
              {isActive && (
                <motion.div
                  layoutId="lamp"
                  className="active-indicator"
                  initial={false}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                  }}
                >
                  <div className="lamp-glow">
                    <div className="glow-large" />
                    <div className="glow-medium" />
                    <div className="glow-small" />
                  </div>
                </motion.div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
