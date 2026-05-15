import { useState, useEffect } from 'react';
import { X, Wallet, Copy, Check } from 'lucide-react';

interface WalletHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WalletHelpModal({ isOpen, onClose }: WalletHelpModalProps) {
  const [copied, setCopied] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');

  useEffect(() => {
    if (isOpen) {
      setCurrentUrl(window.location.href);
    }
  }, [isOpen]);

  const handleCopy = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-card border border-border rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center">
              <Wallet size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-black text-foreground">No Wallet Detected</h2>
              <p className="text-xs text-muted-foreground font-black">How to connect your wallet</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-accent text-muted-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground font-black text-center">
            No wallet extension found in this browser.
          </p>

          {/* Method 1: Copy URL */}
          <div className="bg-accent/50 p-4 rounded-2xl">
            <p className="text-xs text-muted-foreground font-black mb-2">
              Open this link inside your wallet's browser:
            </p>
            <div className="bg-background p-2 rounded-xl border border-border">
              <p className="text-xs text-foreground font-black break-all">{currentUrl}</p>
            </div>
            <button
              onClick={handleCopy}
              className="mt-2 w-full flex items-center justify-center gap-1 p-2 rounded-xl bg-primary/10 text-primary font-black text-xs hover:bg-primary/20 transition-all"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy URL'}
            </button>
          </div>

          {/* Method 2: QR Code */}
          <div className="bg-accent/50 p-4 rounded-2xl text-center">
            <p className="text-xs text-muted-foreground font-black mb-2">
              Scan with your mobile wallet:
            </p>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(currentUrl)}`}
              alt="QR Code"
              className="mx-auto rounded-xl"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>

          {/* Popular wallets */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground font-black mb-2">
              Popular wallets:
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {['MetaMask', 'Trust Wallet', 'Coinbase', 'Phantom'].map(name => (
                <span key={name} className="text-xs bg-accent px-2 py-1 rounded-lg text-foreground font-black">
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
