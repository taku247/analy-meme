// Types for the meme coin tracker application

export interface TokenConfig {
  id: string;
  symbol: string;
  address: string;
  startTime: string;
  endTime: string;
  marketCapLimit?: number;
  chain: 'ethereum' | 'solana';
}

export interface WalletAddress {
  id: string;
  address: string;
  tokenId: string;
  purchaseTime: string;
  purchasePrice: number;
  marketCap?: number;
  relatedTokens: string[]; // IDs of other tokens this wallet also bought
  isPromising?: boolean; // 有望アドレスとしてマークされているか
  blockNumber?: number;
  txHash?: string;
}

export interface OHLCVData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface WalletAnalysisResult {
  walletAddress: string;
  isHolding: boolean;
  purchaseTime?: string;
  purchasePrice?: number;
  currentValue?: number;
  profitLoss?: number;
}

export interface TokenAnalysis {
  tokenAddress: string;
  symbol: string;
  walletResults: WalletAnalysisResult[];
  hypeScore: number; // 0-100, currently dummy value
  chartData: OHLCVData[];
}

export interface AppConfig {
  tokens: TokenConfig[];
  wallets: WalletAddress[];
  apiKeys: {
    birdeye?: string;
    quicknode?: string;
  };
}