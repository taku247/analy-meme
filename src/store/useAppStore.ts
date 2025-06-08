import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppConfig, TokenConfig, WalletAddress, TokenAnalysis } from '../types';

interface AppState {
  config: AppConfig;
  currentAnalysis: TokenAnalysis | null;
  
  // Actions
  addToken: (token: TokenConfig) => void;
  updateToken: (id: string, updates: Partial<TokenConfig>) => void;
  deleteToken: (id: string) => void;
  
  addWallet: (wallet: WalletAddress) => void;
  deleteWallet: (id: string) => void;
  getWalletsForToken: (tokenId: string) => WalletAddress[];
  
  setCurrentAnalysis: (analysis: TokenAnalysis | null) => void;
  
  updateApiKeys: (keys: Partial<AppConfig['apiKeys']>) => void;
  
  // Export/Import config
  exportConfig: () => string;
  importConfig: (configJson: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      config: {
        tokens: [],
        wallets: [],
        apiKeys: {}
      },
      currentAnalysis: null,
      
      addToken: (token) => set((state) => ({
        config: {
          ...state.config,
          tokens: [...state.config.tokens, token]
        }
      })),
      
      updateToken: (id, updates) => set((state) => ({
        config: {
          ...state.config,
          tokens: state.config.tokens.map(token => 
            token.id === id ? { ...token, ...updates } : token
          )
        }
      })),
      
      deleteToken: (id) => set((state) => ({
        config: {
          ...state.config,
          tokens: state.config.tokens.filter(token => token.id !== id),
          wallets: state.config.wallets.filter(wallet => wallet.tokenId !== id)
        }
      })),
      
      addWallet: (wallet) => set((state) => ({
        config: {
          ...state.config,
          wallets: [...state.config.wallets, wallet]
        }
      })),
      
      deleteWallet: (id) => set((state) => ({
        config: {
          ...state.config,
          wallets: state.config.wallets.filter(wallet => wallet.id !== id)
        }
      })),
      
      getWalletsForToken: (tokenId) => {
        return get().config.wallets.filter(wallet => wallet.tokenId === tokenId);
      },
      
      setCurrentAnalysis: (analysis) => set({ currentAnalysis: analysis }),
      
      updateApiKeys: (keys) => set((state) => ({
        config: {
          ...state.config,
          apiKeys: { ...state.config.apiKeys, ...keys }
        }
      })),
      
      exportConfig: () => {
        return JSON.stringify(get().config, null, 2);
      },
      
      importConfig: (configJson) => {
        try {
          const config = JSON.parse(configJson);
          set({ config });
        } catch (error) {
          console.error('Failed to import config:', error);
          throw new Error('Invalid configuration format');
        }
      }
    }),
    {
      name: 'meme-coin-tracker-storage',
      partialize: (state) => ({ config: state.config })
    }
  )
);