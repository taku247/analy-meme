import { API_CONFIG } from './apiConfig';

export interface QuickNodeRPCParams {
  method: string;
  params: any[];
  chain: 'solana' | 'ethereum';
}

export interface QuickNodeResponse {
  jsonrpc: string;
  id: number;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

export class QuickNodeAPI {
  static async callRPC(params: QuickNodeRPCParams): Promise<any> {
    const { QUICKNODE } = API_CONFIG;
    
    const endpoint = params.chain === 'solana' 
      ? QUICKNODE.SOLANA_ENDPOINT 
      : QUICKNODE.ETHEREUM_ENDPOINT;
    
    if (!endpoint) {
      throw new Error(`QuickNode ${params.chain} endpoint not configured. Please set VITE_QUICKNODE_${params.chain.toUpperCase()}_ENDPOINT in .env file`);
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: params.method,
          params: params.params
        })
      });

      if (!response.ok) {
        throw new Error(`QuickNode API error: ${response.status} - ${response.statusText}`);
      }

      const data: QuickNodeResponse = await response.json();
      
      if (data.error) {
        throw new Error(`QuickNode RPC error: ${data.error.code} - ${data.error.message}`);
      }

      return data.result;
    } catch (error) {
      console.error('QuickNode API call failed:', error);
      throw error;
    }
  }

  // Solana用メソッド
  static async getSignaturesForAddress(address: string, limit: number = 1000) {
    return this.callRPC({
      method: 'getSignaturesForAddress',
      params: [address, { limit }],
      chain: 'solana'
    });
  }

  // Ethereum用メソッド  
  static async getWalletTokenTransactions(address: string, page: number = 1, perPage: number = 100) {
    return this.callRPC({
      method: 'qn_getWalletTokenTransactions',
      params: [{ address, page, perPage }],
      chain: 'ethereum'
    });
  }
}