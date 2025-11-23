import { useNavigate } from "react-router-dom";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { MessageSquare, Store, ShoppingBag, Lock } from "lucide-react";
import "./HomeNew.css";

const HomeNew = () => {
  const navigate = useNavigate();
  const currentAccount = useCurrentAccount();

  const features = [
    {
      icon: MessageSquare,
      title: "AI Chat",
      description: "Chat with your documents using local AI models",
      action: "Start Chatting",
      path: "/chat",
      color: "purple"
    },
    {
      icon: Lock,
      title: "Vault",
      description: "Encrypt and mint your documents as NFTs",
      action: "Open Vault",
      path: "/vault",
      color: "blue"
    },
    {
      icon: Store,
      title: "Marketplace",
      description: "Browse and purchase encrypted knowledge",
      action: "Browse",
      path: "/marketplace",
      color: "green"
    },
    {
      icon: ShoppingBag,
      title: "My Purchases",
      description: "Access your purchased content",
      action: "View Purchases",
      path: "/my-purchases",
      color: "orange"
    }
  ];

  return (
    <div className="home-new-container">
      <div className="home-new-content">
        <div className="home-new-header">
          <h1 className="home-new-title">Welcome to GhostContext</h1>
          <p className="home-new-subtitle">
            Your decentralized platform for encrypted AI knowledge
          </p>
        </div>

        <div className="home-new-grid">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.path} className={`home-new-card card-${feature.color}`}>
                <div className="card-icon-wrapper">
                  <Icon size={32} />
                </div>
                <h3 className="card-title">{feature.title}</h3>
                <p className="card-description">{feature.description}</p>
                <button
                  className="card-action-btn"
                  onClick={() => navigate(feature.path)}
                >
                  {feature.action}
                </button>
              </div>
            );
          })}
        </div>

        {!currentAccount && (
          <div className="home-new-notice">
            <p>💡 Connect your wallet to unlock all features</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomeNew;
