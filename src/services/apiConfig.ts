// API設定管理

export const API_CONFIG = {
  BIRDEYE: {
    BASE_URL: 'https://public-api.birdeye.so',
    API_KEY: import.meta.env.VITE_BIRDEYE_API_KEY || '',
  },
  QUICKNODE: {
    SOLANA_ENDPOINT: import.meta.env.VITE_QUICKNODE_SOLANA_ENDPOINT || '',
    ETHEREUM_ENDPOINT: import.meta.env.VITE_QUICKNODE_ETHEREUM_ENDPOINT || '',
  },
  DUNE: {
    API_KEY: import.meta.env.VITE_DUNE_API_KEY || '',
  }
};

// APIキーが設定されているかチェック
export const checkApiConfig = () => {
  const config = {
    birdeye: !!API_CONFIG.BIRDEYE.API_KEY,
    quicknode_solana: !!API_CONFIG.QUICKNODE.SOLANA_ENDPOINT,
    quicknode_ethereum: !!API_CONFIG.QUICKNODE.ETHEREUM_ENDPOINT,
    dune: !!API_CONFIG.DUNE.API_KEY && API_CONFIG.DUNE.API_KEY !== 'your_dune_api_key_here',
  };
  
  console.log('📊 API Configuration Status:', config);
  
  return config;
};