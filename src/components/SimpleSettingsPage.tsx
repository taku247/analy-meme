import React, { useState, useEffect } from 'react';
import { checkApiConfig } from '../services/apiConfig';
import { QuickNodeAPI } from '../services/quicknodeApi';
import { BirdeyeAPI } from '../services/birdeyeApi';
import { DuneAPI } from '../services/duneApi';
import { FirestoreService, type FirebaseTokenConfig, type FirebasePromisingAddress } from '../firebase/firestoreService';

// 型定義をコンポーネント内に直接定義
interface TokenConfig {
  id: string;
  symbol: string;
  address: string;
  startTime?: string;
  endTime?: string;
  marketCapLimit?: number;
  chain: 'ethereum' | 'solana';
  currentPrice?: number;
  priceUpdateTime?: string;
  buyersCount?: number;
  buyersLastUpdated?: string;
}

export const SimpleSettingsPage: React.FC = () => {
  const [tokens, setTokens] = useState<FirebaseTokenConfig[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<Partial<TokenConfig>>({
    symbol: '',
    address: '',
    startTime: '',
    endTime: '',
    marketCapLimit: undefined,
    chain: 'solana'
  });
  const [apiStatus, setApiStatus] = useState<{
    birdeye: 'not_set' | 'set' | 'testing' | 'success' | 'error';
    quicknode_solana: 'not_set' | 'set' | 'testing' | 'success' | 'error';
    quicknode_ethereum: 'not_set' | 'set' | 'testing' | 'success' | 'error';
    dune: 'not_set' | 'set' | 'testing' | 'success' | 'error';
  }>({
    birdeye: 'not_set',
    quicknode_solana: 'not_set',
    quicknode_ethereum: 'not_set',
    dune: 'not_set'
  });

  const [firebaseUsage, setFirebaseUsage] = useState({ writes: 0, reads: 0 });

  // API設定状況をチェック & Firestoreからデータ読み込み
  useEffect(() => {
    const config = checkApiConfig();
    setApiStatus({
      birdeye: config.birdeye ? 'set' : 'not_set',
      quicknode_solana: config.quicknode_solana ? 'set' : 'not_set',
      quicknode_ethereum: config.quicknode_ethereum ? 'set' : 'not_set',
      dune: config.dune ? 'set' : 'not_set'
    });

    // Firestoreからトークンデータを読み込み
    const loadTokens = async () => {
      try {
        const firestoreTokens = await FirestoreService.getAllTokens();
        setTokens(firestoreTokens);
        console.log('🔥 Firestore: トークンデータ読み込み完了', firestoreTokens.length + '件');
      } catch (error) {
        console.error('❌ Firestore: トークンデータ読み込み失敗', error);
      }
    };

    loadTokens();

    // Firebase使用量を定期更新
    const updateUsage = () => {
      const usage = FirestoreService.getDailyUsage();
      setFirebaseUsage(usage);
    };

    updateUsage();
    const usageInterval = setInterval(updateUsage, 10000); // 10秒ごと

    return () => clearInterval(usageInterval);
  }, []);

  const handleAddToken = async () => {
    if (!formData.symbol || !formData.address) {
      alert('シンボルとアドレスは必須項目です');
      return;
    }
    
    // Ethereumアドレスの形式チェック
    if (formData.chain === 'ethereum') {
      const addressRegex = /^0x[a-fA-F0-9]{40}$/;
      if (!addressRegex.test(formData.address)) {
        alert('Ethereumアドレスの形式が正しくありません。\n0xで始まる42文字（0x + 40文字）を入力してください。');
        return;
      }
    }
    
    // 日付またはMC上限のどちらかは必要
    if (!formData.startTime && !formData.endTime && !formData.marketCapLimit) {
      alert('監視期間またはMarket Cap上限のどちらかを設定してください');
      return;
    }

    // フォームデータを保存（リセット前に）
    const tokenData = {
      address: formData.address!,
      startTime: formData.startTime,
      endTime: formData.endTime,
      chain: formData.chain!
    };

    // newTokenを関数スコープで定義（後の非同期処理でアクセスするため）
    let newToken: FirebaseTokenConfig;

    // Firestoreにトークンを追加
    try {
      // Firestoreはundefined値を受け入れないため、条件付きでオブジェクトを構築
      const tokenDataForFirestore: any = {
        symbol: formData.symbol!,
        address: tokenData.address,
        startTime: tokenData.startTime || '',
        endTime: tokenData.endTime || '',
        chain: tokenData.chain
      };
      
      // marketCapLimitが設定されている場合のみ追加
      if (formData.marketCapLimit !== undefined) {
        tokenDataForFirestore.marketCapLimit = formData.marketCapLimit;
      }
      
      const tokenId = await FirestoreService.addToken(tokenDataForFirestore);

      // ローカルstateも更新（Firestoreから再読み込みでも可）
      newToken = {
        id: tokenId,
        symbol: formData.symbol!,
        address: tokenData.address,
        startTime: tokenData.startTime || '',
        endTime: tokenData.endTime || '',
        chain: tokenData.chain,
        createdAt: new Date() as any,
        updatedAt: new Date() as any,
        ...(formData.marketCapLimit !== undefined && { marketCapLimit: formData.marketCapLimit })
      };

      setTokens(prev => [newToken, ...prev]);
      console.log('🔥 Firestore: トークン追加成功', tokenId);
    
      // フォームリセット
      setFormData({
        symbol: '',
        address: '',
        startTime: '',
        endTime: '',
        marketCapLimit: undefined,
        chain: 'solana'
      });
      setShowAddForm(false);
    } catch (error) {
      console.error('❌ Firestore: トークン追加失敗', error);
      alert('トークンの追加に失敗しました: ' + (error instanceof Error ? error.message : 'Unknown error'));
      return;
    }

    // 購入者データを非同期で取得（Ethereumのみ対応）
    console.log('🔍 Checking conditions for buyer data fetch:', {
      chain: tokenData.chain,
      isEthereum: tokenData.chain === 'ethereum',
      duneStatus: apiStatus.dune,
      isDuneSuccess: apiStatus.dune === 'success',
      shouldFetch: tokenData.chain === 'ethereum' && (apiStatus.dune === 'success' || apiStatus.dune === 'set')
    });

    if (tokenData.chain === 'ethereum' && (apiStatus.dune === 'success' || apiStatus.dune === 'set')) {
      // setTimeoutで次のイベントループで実行（state更新を確実に待つ）
      setTimeout(async () => {
        try {
          console.log('🚀 購入者データ取得開始...', {
            address: tokenData.address,
            startTime: tokenData.startTime,
            endTime: tokenData.endTime,
            timestamp: new Date().toISOString()
          });
          
          const buyers = await DuneAPI.getEthereumTokenBuyers(
            tokenData.address,
            tokenData.startTime,
            tokenData.endTime
          );
          
          console.log(`✅ 購入者データ取得完了: ${buyers.length}件`);
          
          // 取得したデータでトークン情報を更新
          setTokens(prev => prev.map(token => 
            token.id === newToken.id 
              ? {
                  ...token,
                  buyersCount: buyers.length,
                  buyersLastUpdated: new Date().toLocaleString()
                }
              : token
          ));

          // 有望アドレスリストにFirestore経由で自動追加
          try {
            console.log(`📊 購入者データ: ${buyers.length}件をFirestoreに追加中...`);
            
            // 重複チェック用に既存アドレスを取得
            const existingAddresses = await FirestoreService.getAllPromisingAddresses();
            const existingAddressSet = new Set(existingAddresses.map(a => a.address.toLowerCase()));
            
            const newPromisingAddresses: Omit<FirebasePromisingAddress, 'id' | 'createdAt' | 'updatedAt'>[] = buyers
              .filter(buyer => !existingAddressSet.has(buyer.wallet_address.toLowerCase()))
              .map(buyer => ({
                address: buyer.wallet_address,
                tokenId: newToken.id!,
                tokenSymbol: newToken.symbol,
                purchaseTime: buyer.block_time,
                blockNumber: buyer.block_number,
                txHash: buyer.tx_signature,
                relatedTokens: [],
                isMarkedPromising: true
              }));

            if (newPromisingAddresses.length > 0) {
              await FirestoreService.addPromisingAddresses(newPromisingAddresses);
              console.log(`🔥 Firestore: 有望アドレス追加成功 ${newPromisingAddresses.length}件`);
            }

            // TODO: 既存アドレスの関連トークン更新（後で実装）
            
          } catch (error) {
            console.error('❌ Firestore: 有望アドレス追加失敗', error);
          }

          // Firestoreでトークン情報を更新（購入者数など）
          try {
            await FirestoreService.updateToken(newToken.id!, {
              buyersCount: buyers.length,
              buyersLastUpdated: new Date().toLocaleString()
            });
            console.log('🔥 Firestore: トークン情報更新成功');
          } catch (error) {
            console.error('❌ Firestore: トークン情報更新失敗', error);
          }
          
          alert(`✅ トークン追加完了！\n購入者データ: ${buyers.length}件取得\n有望アドレスリストにも追加されました`);
        } catch (error) {
          console.error('❌ 購入者データ取得失敗:', error);
          alert(`⚠️ トークンは追加されましたが、購入者データの取得に失敗しました:\n${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }, 100); // 100ms遅延
    } else {
      console.log('⏩ 購入者データ取得スキップ:', {
        chain: tokenData.chain,
        duneStatus: apiStatus.dune,
        reason: tokenData.chain !== 'ethereum' ? 'Not Ethereum' : 'Dune API not ready'
      });
    }
  };

  const handleDeleteToken = async (id: string) => {
    try {
      await FirestoreService.deleteToken(id);
      setTokens(tokens.filter(token => token.id !== id));
      console.log('🔥 Firestore: トークン削除成功', id);
    } catch (error) {
      console.error('❌ Firestore: トークン削除失敗', error);
      alert('トークンの削除に失敗しました');
    }
  };

  // トークンの価格を更新
  const updateTokenPrices = async () => {
    if (tokens.length === 0) return;
    
    try {
      const updatedTokens = [...tokens];
      
      for (let i = 0; i < updatedTokens.length; i++) {
        const token = updatedTokens[i];
        try {
          const priceData = await BirdeyeAPI.getTokenPrice(token.address, token.chain);
          updatedTokens[i] = {
            ...token,
            currentPrice: priceData.value,
            priceUpdateTime: priceData.updateHumanTime
          };
          
          // レート制限を避けるため少し待機
          if (i < updatedTokens.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        } catch (error) {
          console.error(`Failed to update price for ${token.symbol}:`, error);
        }
      }
      
      setTokens(updatedTokens);
      alert(`✅ ${updatedTokens.filter(t => t.currentPrice).length}/${tokens.length} のトークンの価格を更新しました`);
    } catch (error) {
      console.error('Price update failed:', error);
      alert('❌ 価格更新に失敗しました');
    }
  };

  // Birdeye API接続テスト（サンプルコードベース）
  const testBirdeyeConnection = async () => {
    setApiStatus(prev => ({ ...prev, birdeye: 'testing' }));
    
    const currentApiKey = import.meta.env.VITE_BIRDEYE_API_KEY || '';
    const sampleApiKey = 'e716eb65fc0348659738912ccfebe12a'; // サンプルコードのAPIキー
    
    // WIFトークンのテストパラメータ（サンプルコードと同じ）
    const testParams = {
      address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // WIF
      type: '1h',
      time_from: Math.floor(new Date('2024-12-01T00:00:00').getTime() / 1000),
      time_to: Math.floor(new Date('2024-12-01T10:59:59').getTime() / 1000)
    };
    
    const testConfigs = [
      // 1. サンプルコードと全く同じ設定
      {
        name: 'サンプルコード形式',
        url: 'https://public-api.birdeye.so/defi/ohlcv',
        headers: {
          'accept': 'application/json',
          'x-chain': 'solana',
          'X-API-KEY': sampleApiKey
        },
        params: testParams
      },
      // 2. 現在のAPIキーでサンプル形式
      {
        name: '現在のAPIキー',
        url: 'https://public-api.birdeye.so/defi/ohlcv',
        headers: {
          'accept': 'application/json',
          'x-chain': 'solana',
          'X-API-KEY': currentApiKey
        },
        params: testParams
      },
      // 3. 現在のAPIキーで価格エンドポイント
      {
        name: '価格エンドポイント',
        url: 'https://public-api.birdeye.so/defi/price',
        headers: {
          'accept': 'application/json',
          'x-chain': 'solana',
          'X-API-KEY': currentApiKey
        },
        params: { address: testParams.address }
      }
    ];
    
    for (let i = 0; i < testConfigs.length; i++) {
      try {
        const config = testConfigs[i];
        
        // URLパラメータを追加
        const urlParams = new URLSearchParams();
        Object.entries(config.params).forEach(([key, value]) => {
          urlParams.append(key, value.toString());
        });
        const fullUrl = `${config.url}?${urlParams.toString()}`;
        
        console.log(`Testing config ${i + 1} (${config.name}):`, fullUrl);
        console.log(`Headers:`, config.headers);
        console.log(`Params:`, config.params);
        
        const response = await fetch(fullUrl, {
          headers: config.headers as Record<string, string>
        });

        console.log(`Config ${i + 1} Response Status:`, response.status);
        console.log(`Config ${i + 1} Response Headers:`, Object.fromEntries(response.headers.entries()));

        if (response.status === 401) {
          console.log(`Config ${i + 1} authentication failed, trying next...`);
          continue;
        }

        if (response.status === 404) {
          console.log(`Config ${i + 1} endpoint not found, trying next...`);
          continue;
        }

        const responseText = await response.text();
        console.log(`Config ${i + 1} Raw Response:`, responseText);

        if (!response.ok) {
          console.log(`Config ${i + 1} Error Response:`, responseText);
          continue;
        }

        const data = JSON.parse(responseText);
        console.log(`Config ${i + 1} Success Response:`, data);
        
        if (data && (data.success !== false || data.data || data.value !== undefined)) {
          setApiStatus(prev => ({ ...prev, birdeye: 'success' }));
          alert(`✅ Birdeye API接続成功！${config.name}が動作しています。\n${data.data?.items ? `${data.data.items.length}件のデータを取得` : '接続確認完了'}`);
          return;
        }
      } catch (error) {
        console.error(`Config ${i + 1} failed:`, error);
        continue;
      }
    }
    
    // 全てのエンドポイントが失敗した場合
    setApiStatus(prev => ({ ...prev, birdeye: 'error' }));
    alert(`❌ Birdeye API接続失敗: 全てのエンドポイントがアクセスできませんでした。APIキーまたはサービス状況を確認してください。`);
  };


  // QuickNode Solana API接続テスト
  const testQuickNodeSolana = async () => {
    setApiStatus(prev => ({ ...prev, quicknode_solana: 'testing' }));
    
    try {
      // テスト用パラメータ（Solanaブロック情報取得）
      const result = await QuickNodeAPI.callRPC({
        method: 'getSlot',
        params: [],
        chain: 'solana'
      });
      
      if (typeof result === 'number' && result > 0) {
        setApiStatus(prev => ({ ...prev, quicknode_solana: 'success' }));
        alert(`✅ QuickNode Solana API接続成功！現在のスロット: ${result}`);
      } else {
        throw new Error('Invalid response');
      }
    } catch (error) {
      setApiStatus(prev => ({ ...prev, quicknode_solana: 'error' }));
      console.error('QuickNode Solana API test failed:', error);
      alert(`❌ QuickNode Solana API接続失敗: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // QuickNode Ethereum API接続テスト
  const testQuickNodeEthereum = async () => {
    setApiStatus(prev => ({ ...prev, quicknode_ethereum: 'testing' }));
    
    try {
      // テスト用パラメータ（Ethereumブロック番号取得）
      const result = await QuickNodeAPI.callRPC({
        method: 'eth_blockNumber',
        params: [],
        chain: 'ethereum'
      });
      
      if (result) {
        const blockNumber = parseInt(result, 16);
        setApiStatus(prev => ({ ...prev, quicknode_ethereum: 'success' }));
        alert(`✅ QuickNode Ethereum API接続成功！現在のブロック: ${blockNumber}`);
      } else {
        throw new Error('Invalid response');
      }
    } catch (error) {
      setApiStatus(prev => ({ ...prev, quicknode_ethereum: 'error' }));
      console.error('QuickNode Ethereum API test failed:', error);
      alert(`❌ QuickNode Ethereum API接続失敗: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Dune API接続テスト
  const testDuneConnection = async () => {
    setApiStatus(prev => ({ ...prev, dune: 'testing' }));
    
    try {
      // まず基本的な認証テストを行う
      const apiKey = import.meta.env.VITE_DUNE_API_KEY;
      
      if (!apiKey || apiKey === 'your_dune_api_key_here') {
        throw new Error('Dune API key not configured');
      }

      // 事前に作成されたクエリIDを使って接続テスト
      const testQueryId = 4396790; // 事前に作成されたクエリ
      
      const response = await fetch(`https://api.dune.com/api/v1/query/${testQueryId}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Dune-API-Key': apiKey
        },
        body: JSON.stringify({})
      });

      console.log('Dune API Response Status:', response.status);
      console.log('Dune API Response Headers:', Object.fromEntries(response.headers.entries()));
      
      const responseText = await response.text();
      console.log('Dune API Raw Response:', responseText);

      if (response.status === 401) {
        throw new Error('API Key認証に失敗しました。Dune APIキーを確認してください。');
      }

      if (response.status === 404) {
        throw new Error(`クエリID ${testQueryId} が見つかりません。クエリが存在するか確認してください。`);
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${responseText}`);
      }

      try {
        const data = JSON.parse(responseText);
        console.log('Dune API Parsed Response:', data);
        
        if (data.execution_id) {
          setApiStatus(prev => ({ ...prev, dune: 'success' }));
          alert(`✅ Dune API接続成功！\nクエリID: ${testQueryId}\n実行ID: ${data.execution_id}`);
        } else {
          throw new Error(`予期しないレスポンス形式: ${JSON.stringify(data)}`);
        }
      } catch (parseError) {
        throw new Error(`JSONパースエラー: ${responseText}`);
      }
    } catch (error) {
      setApiStatus(prev => ({ ...prev, dune: 'error' }));
      console.error('Dune API test failed:', error);
      alert(`❌ Dune API接続失敗: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'not_set': return 'bg-gray-100 text-gray-600';
      case 'set': return 'bg-blue-100 text-blue-700';
      case 'testing': return 'bg-yellow-100 text-yellow-700';
      case 'success': return 'bg-green-100 text-green-700';
      case 'error': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'not_set': return '未設定';
      case 'set': return '設定済み';
      case 'testing': return 'テスト中...';
      case 'success': return '接続成功';
      case 'error': return '接続失敗';
      default: return '不明';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">API設定状況</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <h3 className="font-medium text-gray-900">Birdeye API</h3>
              <p className="text-sm text-gray-500">.envファイルでVITE_BIRDEYE_API_KEYを設定してください</p>
            </div>
            <div className="flex items-center space-x-3">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(apiStatus.birdeye)}`}>
                {getStatusText(apiStatus.birdeye)}
              </span>
              {apiStatus.birdeye !== 'not_set' && (
                <button
                  onClick={testBirdeyeConnection}
                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                  disabled={apiStatus.birdeye === 'testing'}
                >
                  接続テスト
                </button>
              )}
            </div>
          </div>
          
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <h3 className="font-medium text-gray-900">QuickNode Solana API</h3>
              <p className="text-sm text-gray-500">.envファイルでVITE_QUICKNODE_SOLANA_ENDPOINTを設定してください</p>
            </div>
            <div className="flex items-center space-x-3">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(apiStatus.quicknode_solana)}`}>
                {getStatusText(apiStatus.quicknode_solana)}
              </span>
              {apiStatus.quicknode_solana !== 'not_set' && (
                <button
                  onClick={testQuickNodeSolana}
                  className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700"
                  disabled={apiStatus.quicknode_solana === 'testing'}
                >
                  接続テスト
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <h3 className="font-medium text-gray-900">QuickNode Ethereum API</h3>
              <p className="text-sm text-gray-500">.envファイルでVITE_QUICKNODE_ETHEREUM_ENDPOINTを設定してください</p>
            </div>
            <div className="flex items-center space-x-3">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(apiStatus.quicknode_ethereum)}`}>
                {getStatusText(apiStatus.quicknode_ethereum)}
              </span>
              {apiStatus.quicknode_ethereum !== 'not_set' && (
                <button
                  onClick={testQuickNodeEthereum}
                  className="bg-indigo-600 text-white px-3 py-1 rounded text-sm hover:bg-indigo-700"
                  disabled={apiStatus.quicknode_ethereum === 'testing'}
                >
                  接続テスト
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <h3 className="font-medium text-gray-900">Dune Analytics API</h3>
              <p className="text-sm text-gray-500">.envファイルでVITE_DUNE_API_KEYを設定してください</p>
            </div>
            <div className="flex items-center space-x-3">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(apiStatus.dune)}`}>
                {getStatusText(apiStatus.dune)}
              </span>
              {apiStatus.dune !== 'not_set' && (
                <button
                  onClick={testDuneConnection}
                  className="bg-orange-600 text-white px-3 py-1 rounded text-sm hover:bg-orange-700"
                  disabled={apiStatus.dune === 'testing'}
                >
                  接続テスト
                </button>
              )}
            </div>
          </div>
        </div>
        
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">設定方法</h4>
          <ol className="text-sm text-blue-800 space-y-1">
            <li>1. .envファイルでAPIキーを設定</li>
            <li>2. 開発サーバーを再起動（yarn dev）</li>
            <li>3. 「接続テスト」ボタンでAPIキーを確認</li>
            <li>4. Dune APIは購入者データ取得に必要です</li>
          </ol>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-medium text-gray-900">トークン設定</h2>
            <p className="text-sm text-orange-600 mt-1">🔥 Firebase Blazeプラン推奨: 大量データの完全保存対応。月額コスト目安: $1-5</p>
            <div className="mt-2 text-xs text-gray-600">
              <span className="mr-4">📊 Firebase使用量: 書き込み {firebaseUsage.writes} | 読み取り {firebaseUsage.reads}</span>
              <span className="text-blue-600">💡 Blazeプランなら制限なし</span>
            </div>
          </div>
          <div className="flex space-x-3">
            {tokens.length > 0 && apiStatus.birdeye === 'success' && (
              <button
                onClick={updateTokenPrices}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                価格更新
              </button>
            )}
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
            >
              トークンを追加
            </button>
          </div>
        </div>

        {showAddForm && (
          <div className="border border-gray-200 rounded-lg p-4 mb-4">
            <h3 className="font-medium text-gray-900 mb-3">新しいトークンを追加</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                type="text"
                placeholder="シンボル (例: WIF)"
                value={formData.symbol}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="text"
                placeholder="トークンアドレス (0x...)"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
              <div className="col-span-2">
                <div className="mb-2">
                  <span className="text-sm text-gray-600 mr-2">期間プリセット:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const start = new Date(now.getTime() - 6 * 60 * 60 * 1000);
                      setFormData({
                        ...formData,
                        startTime: start.toISOString().slice(0, 16),
                        endTime: now.toISOString().slice(0, 16)
                      });
                    }}
                    className="px-2 py-1 text-xs bg-green-200 hover:bg-green-300 rounded mr-2"
                  >
                    過去6時間 (推奨)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                      setFormData({
                        ...formData,
                        startTime: start.toISOString().slice(0, 16),
                        endTime: now.toISOString().slice(0, 16)
                      });
                    }}
                    className="px-2 py-1 text-xs bg-blue-200 hover:bg-blue-300 rounded mr-2"
                  >
                    過去24時間
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const start = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
                      setFormData({
                        ...formData,
                        startTime: start.toISOString().slice(0, 16),
                        endTime: now.toISOString().slice(0, 16)
                      });
                    }}
                    className="px-2 py-1 text-xs bg-yellow-200 hover:bg-yellow-300 rounded mr-2"
                  >
                    過去3日間 (自動短縮)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                      setFormData({
                        ...formData,
                        startTime: start.toISOString().slice(0, 16),
                        endTime: now.toISOString().slice(0, 16)
                      });
                    }}
                    className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded mr-2"
                  >
                    過去30日間
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const start = new Date(now.getFullYear(), 0, 1);
                      setFormData({
                        ...formData,
                        startTime: start.toISOString().slice(0, 16),
                        endTime: now.toISOString().slice(0, 16)
                      });
                    }}
                    className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded"
                  >
                    今年
                  </button>
                </div>
              </div>
              <input
                type="datetime-local"
                placeholder="開始日時 (オプション)"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="datetime-local"
                placeholder="終了日時 (オプション)"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="number"
                placeholder="Market Cap上限 (オプション)"
                value={formData.marketCapLimit || ''}
                onChange={(e) => setFormData({ ...formData, marketCapLimit: e.target.value ? Number(e.target.value) : undefined })}
                className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
              <select
                value={formData.chain}
                onChange={(e) => setFormData({ ...formData, chain: e.target.value as 'ethereum' | 'solana' })}
                className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="solana">Solana</option>
                <option value="ethereum">Ethereum</option>
              </select>
            </div>
            <div className="mt-3 flex space-x-3">
              <button
                onClick={handleAddToken}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                追加
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {tokens.map((token) => (
            <div key={token.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{token.symbol}</div>
                  {token.currentPrice && (
                    <div className="text-right">
                      <div className="font-bold text-green-600">${token.currentPrice.toLocaleString()}</div>
                      <div className="text-xs text-gray-400">{token.priceUpdateTime}</div>
                    </div>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  {token.chain.toUpperCase()}
                  {token.startTime && token.endTime && ` | ${token.startTime} ~ ${token.endTime}`}
                  {token.marketCapLimit && ` | MC上限: $${token.marketCapLimit.toLocaleString()}`}
                  {token.buyersCount !== undefined && ` | 購入者: ${token.buyersCount}件`}
                </div>
                <div className="text-xs text-gray-400">
                  {token.address}
                  {token.buyersLastUpdated && (
                    <span className="ml-2 text-blue-400">購入者データ更新: {token.buyersLastUpdated}</span>
                  )}
                </div>
              </div>
              <div className="ml-4">
                <button
                  onClick={() => handleDeleteToken(token.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};