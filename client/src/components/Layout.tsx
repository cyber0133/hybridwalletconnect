import { useState, useEffect } from "react";
import { Menu, Zap, Wallet, DollarSign, TrendingUp, Home, X } from "lucide-react";
import Web3NodeMerger from "./Web3NodeMerger";
import PortfolioSection from "./PortfolioSection";
import AnalyticsSection from "./AnalyticsSection";
import PlatformSection from "./PlatformSection";
import FooterSection from "./FooterSection";
import { ThemeToggle } from "./theme-toggle";
import { useWeb3 } from "../hooks/useWeb3";

export default function Layout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("web3-merger");
  const { walletConnected, connecting, openWalletSelector } = useWeb3();

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setIsMobileMenuOpen(false);
      }
    };

    const handleScroll = () => {
      const sections = ['web3-merger', 'portfolio', 'analytics', 'platform', 'footer'];
      let currentSection = '';
      
      sections.forEach(sectionId => {
        const section = document.getElementById(sectionId);
        if (section) {
          const rect = section.getBoundingClientRect();
          if (rect.top <= 100 && rect.bottom >= 100) {
            currentSection = sectionId;
          }
        }
      });
      
      if (currentSection) {
        setActiveSection(currentSection);
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
      setActiveSection(sectionId);
      if (window.innerWidth <= 768) {
        setIsMobileMenuOpen(false);
      }
    }
  };

  const getWalletStatus = () => {
    if (walletConnected) {
      return {
        className: "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-black bg-green-500 bg-opacity-20 text-green-500",
        text: "Connected",
        dotColor: "bg-green-500"
      };
    } else if (connecting) {
      return {
        className: "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-black bg-blue-500 bg-opacity-20 text-blue-500",
        text: "Connecting",
        dotColor: "bg-blue-500 animate-pulse"
      };
    } else {
      return {
        className: "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-black bg-red-500 bg-opacity-20 text-red-500",
        text: "Disconnected",
        dotColor: "bg-red-500"
      };
    }
  };

  const walletStatus = getWalletStatus();

  return (
    <div className="bg-background text-foreground overflow-x-hidden selection:bg-primary/20">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="fixed top-5 left-5 z-50 bg-white text-dark-navy border border-border p-3 rounded-2xl md:hidden shadow-xl"
      >
        <Menu size={20} />
      </button>

      {/* Sidebar */}
      <div className={`fixed left-0 top-0 h-screen w-72 bg-card border-r border-border/50 z-40 transform transition-all duration-500 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Sidebar Header */}
        <div className="p-8 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
              <Zap size={20} className="text-white" />
            </div>
            <h2 className="text-xl font-black tracking-tight text-foreground">Blockchain</h2>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden text-muted-foreground hover:text-foreground p-2 rounded-xl hover:bg-accent transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-2">
          <button
            onClick={() => scrollToSection('web3-merger')}
            className={`nav-item w-full ${activeSection === 'web3-merger' ? 'bg-primary text-white shadow-lg shadow-primary/20 hover:text-white' : ''}`}
          >
            <Wallet size={18} />
            Dashboard
          </button>
          <button
            onClick={() => scrollToSection('portfolio')}
            className={`nav-item w-full ${activeSection === 'portfolio' ? 'bg-primary text-white shadow-lg shadow-primary/20 hover:text-white' : ''}`}
          >
            <DollarSign size={18} />
            Portfolio
          </button>
          <button
            onClick={() => scrollToSection('analytics')}
            className={`nav-item w-full ${activeSection === 'analytics' ? 'bg-primary text-white shadow-lg shadow-primary/20 hover:text-white' : ''}`}
          >
            <TrendingUp size={18} />
            Analytics
          </button>
          <button
            onClick={() => scrollToSection('platform')}
            className={`nav-item w-full ${activeSection === 'platform' ? 'bg-primary text-white shadow-lg shadow-primary/20 hover:text-white' : ''}`}
          >
            <Home size={18} />
            Platform
          </button>
        </nav>

        {/* Account Section */}
        <div className="p-3 sm:p-6 mt-4 sm:mt-8">
          <h3 className="text-xs sm:text-sm font-black text-muted-foreground mb-3 sm:mb-4 uppercase tracking-widest">ACCOUNTS</h3>
          <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-xl cursor-pointer mb-2 bg-accent/30 hover:bg-accent/50 transition-all duration-300 border border-border/50">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-black text-xs shadow-sm">
              A1
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black truncate text-foreground">Account 1</div>
              <div className="text-xs text-muted-foreground font-black">0.00 ETH</div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-xl cursor-pointer mb-2 bg-accent/30 hover:bg-accent/50 transition-all duration-300 border border-border/50">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-black text-xs shadow-sm">
              A2
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black truncate text-foreground">Account 2</div>
              <div className="text-xs text-muted-foreground font-black">0.00 BNB</div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="lg:ml-72 min-h-screen transition-all duration-300">
        {/* Header */}
        <header className="bg-background/80 backdrop-blur-xl p-6 border-b border-border/50 flex justify-between items-center sticky top-0 z-30">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold tracking-tight force-visible-text">BLOCKCHAIN WEB3 PRO </h1>
            <p className="text-sm force-visible-muted">Manage your digital assets securely</p>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-accent-foreground text-sm font-black border border-border/50">
              <div className={`w-2 h-2 ${walletStatus.dotColor} rounded-full`}></div>
              {walletStatus.text}
            </div>
            <button
              onClick={() => {
                if (!walletConnected) {
                  scrollToSection('web3-merger');
                }
              }}
              className="premium-button"
            >
              <Zap size={18} />
              <span>{walletConnected ? 'Connected' : 'Connect'}</span>
            </button>
          </div>
        </header>

        {/* Sections */}
        <Web3NodeMerger />
        <PortfolioSection scrollToSection={scrollToSection} />
        <AnalyticsSection scrollToSection={scrollToSection} />
        <PlatformSection scrollToSection={scrollToSection} />
        <FooterSection />
      </div>
    </div>
  );
}
