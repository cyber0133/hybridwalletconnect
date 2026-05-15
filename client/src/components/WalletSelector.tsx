import { useState, useEffect, useCallback } from 'react';
import { X, Wallet, Smartphone, ExternalLink } from 'lucide-react';

interface WalletInfo {
  name: string;
  icon?: string;
  rdns?: string;
  uuid?: string;
  provider: any;
}

interface WalletSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (provider: any) => void;
}

const POPULAR_MOBILE_WALLETS = [
  {
    name: 'Trust Wallet',
    icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/info/logo.png',
    deepLink: (url: string) => `https://link.trustwallet.com/open_url?coin_id=20000714&url=${encodeURIComponent(url)}`,
    installLink: 'https://trustwallet.com/download',
  },
  {
    name: 'MetaMask',
    icon: 'https://raw.githubusercontent.com/MetaMask/brand-resources/master/SVG/metamask-fox.svg',
    deepLink: (url: string) => `https://metamask.app.link/dapp/${encodeURIComponent(url.replace(/^https?:\/\//, ''))}`,
    installLink: 'https://metamask.io/download/',
  },
  {
    name: 'Rainbow',
    icon: 'https://avatars.githubusercontent.com/u/72315087',
    deepLink: (url: string) => `https://rnbwapp.com/${encodeURIComponent(url)}`,
    installLink: 'https://rainbow.me/',
  },
  {
    name: 'Coinbase Wallet',
    icon: 'https://avatars.githubusercontent.com/u/18060234',
    deepLink: (url: string) => `https://go.cb-w.com/dapp?url=${encodeURIComponent(url)}`,
    installLink: 'https://www.coinbase.com/wallet',
  },
  {
    name: 'Phantom',
    icon: 'https://avatars.githubusercontent.com/u/79587810',
    deepLink: (url: string) => `https://phantom.app/ul/browse/${encodeURIComponent(url)}`,
    installLink: 'https://phantom.app/download',
  },
  {
    name: 'OKX Wallet',
    icon: 'https://avatars.githubusercontent.com/u/120148817',
    deepLink: (url: string) => `https://www.okx.com/download?deeplink=${encodeURIComponent(url)}`,
    installLink: 'https://www.okx.com/download',
  },
];

export default function WalletSelector({ isOpen, onClose, onConnect }: WalletSelectorProps) {
  const [detectedWallets, setDetectedWallets] = useState<WalletInfo[]>([]);
  const [activeTab, setActiveTab] = useState<'detected' | 'mobile'>('detected');

  useEffect(() => {
    if (!isOpen) return;

    const wallets: WalletInfo[] = [];
    const seen = new Set<string>();

    // Listen for EIP-6963 wallet announcements
    const handleAnnounce = (event: any) => {
      const detail = event.detail;
      if (!detail || !detail.info || !detail.provider) return;

      const key = detail.info.uuid || detail.info.rdns || detail.info.name;
      if (seen.has(key)) return;
      seen.add(key);

      wallets.push({
        name: detail.info.name,
        icon: detail.info.icon,
        rdns: detail.info.rdns,
        uuid: detail.info.uuid,
        provider: detail.provider,
      });

      setDetectedWallets([...wallets]);
    };

    window.addEventListener('eip6963:announceProvider', handleAnnounce);

    // Trigger wallets to announce (spec-compliant with callback)
    window.dispatchEvent(new CustomEvent('eip6963:requestProvider', {
      detail: {
        callback: (announcement: any) => {
          if (!announcement?.info || !announcement?.provider) return;
          const key = announcement.info.uuid || announcement.info.rdns || announcement.info.name;
          if (seen.has(key)) return;
          seen.add(key);
          wallets.push({
            name: announcement.info.name,
            icon: announcement.info.icon,
            rdns: announcement.info.rdns,
            uuid: announcement.info.uuid,
            provider: announcement.provider,
          });
          setDetectedWallets([...wallets]);
        },
      },
    }));

    // Also check for legacy window.ethereum
    if (window.ethereum && !seen.has('legacy-ethereum')) {
      seen.add('legacy-ethereum');
      const name = window.ethereum.isMetaMask ? 'MetaMask' :
                   window.ethereum.isTrust ? 'Trust Wallet' :
                   window.ethereum.isCoinbaseWallet ? 'Coinbase Wallet' :
                   'Browser Wallet';
      wallets.push({
        name,
        provider: window.ethereum,
      });
      setDetectedWallets([...wallets]);
    }

    // Give wallets time to respond
    const timeout = setTimeout(() => {
      window.removeEventListener('eip6963:announceProvider', handleAnnounce);
    }, 2000);

    return () => {
      window.removeEventListener('eip6963:announceProvider', handleAnnounce);
      clearTimeout(timeout);
    };
  }, [isOpen]);

  const handleConnect = useCallback((provider: any) => {
    onConnect(provider);
    onClose();
  }, [onConnect, onClose]);

  const handleMobileDeepLink = useCallback((wallet: typeof POPULAR_MOBILE_WALLETS[0]) => {
    const currentUrl = window.location.href;
    const deepLink = wallet.deepLink(currentUrl);
    window.open(deepLink, '_blank');
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-card border border-border rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center">
              <Wallet size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-black text-foreground">Connect Wallet</h2>
              <p className="text-xs text-muted-foreground font-black">Choose your preferred wallet</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-accent transition-colors text-muted-foreground"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('detected')}
            className={`flex-1 py-3 text-sm font-black transition-colors ${
              activeTab === 'detected'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <Wallet size={16} />
              Detected ({detectedWallets.length})
            </span>
          </button>
          <button
            onClick={() => setActiveTab('mobile')}
            className={`flex-1 py-3 text-sm font-black transition-colors ${
              activeTab === 'mobile'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <Smartphone size={16} />
              Mobile Wallets
            </span>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {activeTab === 'detected' && (
            <div className="space-y-2">
              {detectedWallets.length === 0 ? (
                <div className="text-center py-8">
                  <Wallet size={40} className="mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground font-black text-sm">No wallets detected in browser</p>
                  <p className="text-xs text-muted-foreground mt-1">Switch to "Mobile Wallets" tab on mobile</p>
                </div>
              ) : (
                detectedWallets.map((wallet, i) => (
                  <button
                    key={wallet.uuid || wallet.name || i}
                    onClick={() => handleConnect(wallet.provider)}
                    className="w-full flex items-center gap-3 p-4 rounded-2xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 text-left group"
                  >
                    {wallet.icon ? (
                      <img
                        src={wallet.icon}
                        alt={wallet.name}
                        className="w-10 h-10 rounded-xl object-contain bg-accent p-1"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Wallet size={20} className="text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-foreground text-sm truncate">{wallet.name}</div>
                      <div className="text-xs text-muted-foreground font-black">Click to connect</div>
                    </div>
                    <ExternalLink size={16} className="text-muted-foreground/50 group-hover:text-primary transition-colors" />
                  </button>
                ))
              )}
            </div>
          )}

          {activeTab === 'mobile' && (
            <div className="space-y-2">
              {POPULAR_MOBILE_WALLETS.map((wallet) => (
                <button
                  key={wallet.name}
                  onClick={() => handleMobileDeepLink(wallet)}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 text-left group"
                >
                  <img
                    src={wallet.icon}
                    alt={wallet.name}
                    className="w-10 h-10 rounded-xl object-contain bg-accent p-1"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '';
                      (e.target as HTMLImageElement).style.display = 'none';
                      const parent = (e.target as HTMLImageElement).parentElement;
                      if (parent) {
                        parent.innerHTML = '<div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-primary"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"></path></svg></div>';
                      }
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-foreground text-sm truncate">{wallet.name}</div>
                    <div className="text-xs text-muted-foreground font-black">Open in app</div>
                  </div>
                  <ExternalLink size={16} className="text-muted-foreground/50 group-hover:text-primary transition-colors" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-accent/30">
          <p className="text-xs text-center text-muted-foreground font-black">
            New to Web3?{' '}
            <a
              href="https://ethereum.org/en/wallets/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-black"
            >
              Learn about wallets
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
