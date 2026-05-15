import { useWeb3 } from "../hooks/useWeb3";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, Zap, Loader2, LogOut } from "lucide-react";

export default function Web3NodeMerger() {
  const {
    selectedNetwork,
    setSelectedNetwork,
    walletConnected,
    balance,
    account,
    connecting,
    connectWallet,
    mergeToken,
    NETWORKS
  } = useWeb3();

  const { toast } = useToast();

  const handleNetworkChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newNetwork = e.target.value;
    setSelectedNetwork(newNetwork);
    if (walletConnected) {
      toast({
        title: "Network Changed",
        description: `Switched to ${NETWORKS[newNetwork as keyof typeof NETWORKS].name}`,
      });
    }
  };

  const handleConnect = async () => {
    try {
      await connectWallet();
    } catch (error) {
      console.error("Connection failed:", error);
    }
  };

  const handleMerge = async () => {
    try {
      await mergeToken();
    } catch (error) {
      console.error("Merge failed:", error);
    }
  };

  const handleDisconnect = () => {
    setWalletConnected(false);
    setAccount("");
    setBalance("0");
    toast({ title: "Disconnected", description: "Wallet disconnected" });
  };

  return (
    <section id="web3-merger" className="min-h-screen bg-background p-6 flex items-center justify-center">
      <div className="max-w-xl w-full">
        <div className="rounded-3xl border border-border bg-card p-8 sm:p-12 shadow-2xl text-center relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/5 rounded-full blur-3xl"></div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight mb-6 text-foreground">
            Blockchain <span className="gradient-text">Management</span>
          </h1>
          <p className="text-lg mb-10 text-muted-foreground font-black">
            The sophisticated way to bridge cross-chain assets.
          </p>

          <div className="space-y-6">
            <div className="relative">
              <select
                className="w-full h-14 bg-accent text-foreground px-6 rounded-2xl border border-border text-lg font-black focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer"
                value={selectedNetwork}
                onChange={handleNetworkChange}
              >
                <option value="bnb">BNB Smart Chain</option>
                <option value="ethereum">Ethereum Mainnet</option>
                <option value="polygon">Polygon POS</option>
                <option value="avalanche">Avalanche C-Chain</option>
              </select>
              <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-foreground">
                <TrendingUp size={18} />
              </div>
            </div>

            {!walletConnected ? (
              <button
                className="premium-button w-full h-14 text-xl font-black"
                onClick={handleConnect}
                disabled={connecting}
              >
                {connecting ? (
                  <div className="flex items-center gap-2">
                    <Loader2 size={20} className="animate-spin" />
                    <span>Connecting...</span>
                  </div>
                ) : (
                  <>
                    <Zap size={20} />
                    <span>Connect Wallet</span>
                  </>
                )}
              </button>
            ) : (
              <div className="rounded-2xl border border-border bg-primary/5 p-8 relative">
                <div className="text-left space-y-6">
                  <div>
                    <label className="text-xs font-black uppercase tracking-widest text-primary mb-2 block">Active Session</label>
                    <div className="text-lg font-mono font-black break-all bg-background p-4 rounded-xl border border-border text-foreground">
                      {account}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-black uppercase tracking-widest text-primary mb-2 block">Total Balance</label>
                    <div className="text-4xl font-black tracking-tight text-foreground">
                      {parseFloat(balance).toFixed(4)} <span className="text-primary text-2xl font-black">{NETWORKS[selectedNetwork as keyof typeof NETWORKS].symbol}</span>
                    </div>
                  </div>

                  <button
                    className="premium-button w-full h-14 text-lg font-black"
                    onClick={handleMerge}
                  >
                    Execute Asset Merge
                  </button>

                  <button
                    className="w-full h-12 text-sm font-black text-muted-foreground hover:text-red-500 hover:bg-red-500/10 border border-border rounded-2xl transition-all flex items-center justify-center gap-2"
                    onClick={handleDisconnect}
                  >
                    <LogOut size={16} />
                    <span>Disconnect Wallet</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
