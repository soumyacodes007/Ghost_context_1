import { useNavigate } from "react-router-dom";
import { ConnectButton, useCurrentAccount } from "@mysten/dapp-kit";
import { Lock, Bot, DollarSign, Cloud, ArrowRight, Sparkles, Shield, Database, Coins, Cpu } from "lucide-react";
import "./LandingPage.css";

const LandingPage = () => {
  const navigate = useNavigate();
  const currentAccount = useCurrentAccount();

  const features = [
    {
      icon: Shield,
      title: "End-to-End Encryption",
      description: "AES-GCM encryption ensures only you hold the keys.",
      color: "violet"
    },
    {
      icon: Database,
      title: "Decentralized Storage",
      description: "Decentralized blob storage powered by Walrus.",
      color: "blue"
    },
    {
      icon: Coins,
      title: "Instant Commerce",
      description: "Sell access rights instantly via Sui Smart Contracts.",
      color: "emerald"
    },
    {
      icon: Cpu,
      title: "Private Local AI",
      description: "Chat via WebLLM. Data never leaves your browser.",
      color: "pink"
    }
  ];

  return (
    <div className="landing-container">
      {/* Hero Section */}
      <main className="landing-hero">
        {/* Gradient Blob Background */}
        <div className="gradient-blob"></div>
        <div className="gradient-blob-2"></div>
        
        <div className="landing-hero-container">
          <div className="landing-hero-badge">
            <Sparkles size={14} strokeWidth={2.5} />
            <span>Powered by Sui & Walrus</span>
          </div>
          
          <h1 className="landing-hero-title">
            Decentralized Marketplace for
            <br />
            <span className="landing-hero-gradient">Private AI Knowledge</span>
          </h1>
          
          <p className="landing-hero-subtitle">
            Upload, encrypt, and monetize your documents with blockchain-powered access control. 
            Buy and chat with encrypted knowledge contexts using local AI that never leaves your browser.
          </p>

          <div className="landing-hero-actions">
            {currentAccount ? (
              <>
                <button 
                  className="landing-btn-primary"
                  onClick={() => navigate("/home")}
                >
                  <span>Start Creating</span>
                  <ArrowRight size={20} strokeWidth={2.5} />
                </button>
                <button 
                  className="landing-btn-secondary"
                  onClick={() => navigate("/marketplace")}
                >
                  Browse Marketplace
                </button>
              </>
            ) : (
              <div className="landing-connect-prompt">
                <p className="landing-connect-text">Connect your wallet to get started</p>
                <ConnectButton />
              </div>
            )}
          </div>

          {/* Premium Features Grid */}
          <div className="landing-features">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div key={index} className="landing-feature-card">
                  <div className={`landing-feature-icon icon-${feature.color}`}>
                    <Icon size={24} strokeWidth={2} />
                  </div>
                  <h3 className="landing-feature-title">{feature.title}</h3>
                  <p className="landing-feature-text">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-container">
          <div className="landing-footer-content">
            <div className="landing-footer-section">
              <div className="landing-footer-logo">
                <span className="landing-logo-icon">👻</span>
                <span className="landing-logo-text">GhostContext</span>
              </div>
              <p className="landing-footer-description">
                Decentralized encrypted knowledge marketplace powered by blockchain technology
              </p>
            </div>
            
            <div className="landing-footer-section">
              <h4 className="landing-footer-heading">Quick Links</h4>
              <button onClick={() => navigate("/home")} className="landing-footer-link">
                Home
              </button>
              <button onClick={() => navigate("/marketplace")} className="landing-footer-link">
                Marketplace
              </button>
              <button onClick={() => navigate("/my-purchases")} className="landing-footer-link">
                My Purchases
              </button>
            </div>

            <div className="landing-footer-section">
              <h4 className="landing-footer-heading">Technology</h4>
              <a 
                href="https://sui.io" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="landing-footer-link"
              >
                Sui Blockchain
              </a>
              <a 
                href="https://walrus.site" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="landing-footer-link"
              >
                Walrus Storage
              </a>
            </div>
          </div>
          
          <div className="landing-footer-bottom">
            <p>© 2024 GhostContext. Built with ❤️ on Sui</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
