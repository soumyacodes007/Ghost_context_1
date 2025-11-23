import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import HomeNew from './components/HomeNew';
import Chat from './components/Home'; // Rename Home to Chat
import Vault from './components/Vault';
import Marketplace from './components/Marketplace';
import MyPurchases from './components/MyPurchases';
import PrivacyPolicy from './components/PrivacyPolicy';
import CookiePolicy from './components/CookiePolicy';
import LandingPage from './components/landingPage';
import './theme.css';
import './App.css';

function AppContent() {
  return (
    <div className="app-layout">
      <Navbar />
      <main className="app-main app-main-with-nav">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/home" element={<HomeNew />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/vault" element={<Vault />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/my-purchases" element={<MyPurchases />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/cookie-policy" element={<CookiePolicy />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;

