import { API_CONFIG } from './apiConfig';

// 型定義をここに直接定義
export interface OHLCVData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface BirdeyeOHLCVParams {
  address: string;
  type: '1m' | '5m' | '1h' | '1d';
  timeFrom: number;
  timeTo: number;
  chain?: 'ethereum' | 'solana';
}

export interface BirdeyeOHLCVResponse {
  success: boolean;
  data: {
    items: Array<{
      unixTime: number;
      o: number;
      h: number;
      l: number;
      c: number;
      v: number;
    }>;
  };
}

export interface BirdeyePriceData {
  value: number;
  updateUnixTime: number;
  updateHumanTime: string;
}

export interface BirdeyePriceResponse {
  success: boolean;
  data: BirdeyePriceData;
}

export class BirdeyeAPI {
  static async fetchOHLCV(params: BirdeyeOHLCVParams): Promise<OHLCVData[]> {
    const { BIRDEYE } = API_CONFIG;
    
    if (!BIRDEYE.API_KEY) {
      throw new Error('Birdeye API key not configured. Please set VITE_BIRDEYE_API_KEY in .env file');
    }

    const url = `${BIRDEYE.BASE_URL}/defi/ohlcv`;
    
    const requestParams = new URLSearchParams({
      address: params.address,
      type: params.type,
      time_from: params.timeFrom.toString(),
      time_to: params.timeTo.toString()
    });

    try {
      const response = await fetch(`${url}?${requestParams}`, {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'x-chain': params.chain || 'solana',
          'X-API-KEY': BIRDEYE.API_KEY
        }
      });

      if (!response.ok) {
        throw new Error(`Birdeye API error: ${response.status} - ${response.statusText}`);
      }

      const data: BirdeyeOHLCVResponse = await response.json();
      
      if (!data.success || !data.data?.items) {
        throw new Error('Invalid response from Birdeye API');
      }

      return data.data.items.map(item => ({
        timestamp: item.unixTime,
        open: item.o,
        high: item.h,
        low: item.l,
        close: item.c,
        volume: item.v
      }));
    } catch (error) {
      console.error('Error fetching OHLCV data:', error);
      throw error;
    }
  }

  // Validate date range based on interval (max 1000 candles)
  static validateDateRange(startTime: string, endTime: string, interval: string): boolean {
    const intervalSeconds: Record<string, number> = {
      '1m': 60,
      '5m': 300,
      '1h': 3600,
      '1d': 86400
    };

    if (!intervalSeconds[interval]) {
      throw new Error(`Unsupported interval: ${interval}`);
    }

    const startTimestamp = Math.floor(new Date(startTime).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(endTime).getTime() / 1000);
    const maxRange = 1000 * intervalSeconds[interval];
    
    return (endTimestamp - startTimestamp) <= maxRange;
  }

  // Helper to convert ISO string to timestamp
  static isoToTimestamp(isoString: string): number {
    return Math.floor(new Date(isoString).getTime() / 1000);
  }

  // 価格API（動作確認済み）
  static async getTokenPrice(address: string, chain: 'solana' | 'ethereum' = 'solana'): Promise<BirdeyePriceData> {
    const { BIRDEYE } = API_CONFIG;
    
    if (!BIRDEYE.API_KEY) {
      throw new Error('Birdeye API key not configured. Please set VITE_BIRDEYE_API_KEY in .env file');
    }

    try {
      const url = `${BIRDEYE.BASE_URL}/defi/price?address=${address}`;
      
      const response = await fetch(url, {
        headers: {
          'accept': 'application/json',
          'x-chain': chain,
          'X-API-KEY': BIRDEYE.API_KEY
        }
      });

      if (!response.ok) {
        throw new Error(`Birdeye API error: ${response.status} - ${response.statusText}`);
      }

      const data: BirdeyePriceResponse = await response.json();
      
      if (!data.success) {
        throw new Error('Birdeye API returned error response');
      }

      return data.data;
    } catch (error) {
      console.error('Birdeye API call failed:', error);
      throw error;
    }
  }

  // 複数トークンの価格を取得
  static async getMultipleTokenPrices(addresses: string[], chain: 'solana' | 'ethereum' = 'solana'): Promise<{[address: string]: BirdeyePriceData}> {
    const results: {[address: string]: BirdeyePriceData} = {};
    
    // 並列で価格を取得（レート制限を考慮して少し遅延を入れる）
    for (let i = 0; i < addresses.length; i++) {
      try {
        results[addresses[i]] = await this.getTokenPrice(addresses[i], chain);
        // 短い遅延を入れてレート制限を回避
        if (i < addresses.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`Failed to get price for ${addresses[i]}:`, error);
        // エラーの場合は結果に含めない
      }
    }
    
    return results;
  }
}