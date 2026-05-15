import { EthereumProvider } from '@walletconnect/ethereum-provider';

// Replace with your own from https://cloud.walletconnect.com
const PROJECT_ID = 'a6cc7ec21ac8472ebc861c3c63f2290c';

let providerInstance: EthereumProvider | null = null;

export async function getWalletConnectProvider(): Promise<EthereumProvider> {
  if (providerInstance) return providerInstance;

  providerInstance = await EthereumProvider.init({
    projectId: PROJECT_ID,
    chains: [1, 56, 137, 43114], // Ethereum, BSC, Polygon, Avalanche
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

  return providerInstance;
}

export function resetWalletConnectProvider() {
  providerInstance = null;
}

export { PROJECT_ID };
