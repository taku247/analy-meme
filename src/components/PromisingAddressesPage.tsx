import React, { useState, useEffect } from 'react';
import { DuneAPI } from '../services/duneApi';
import { FirestoreService, type FirebaseTokenConfig, type FirebasePromisingAddress } from '../firebase/firestoreService';

// Firebase型定義を使用
type PromisingAddress = FirebasePromisingAddress;
type TokenConfig = FirebaseTokenConfig;

interface PromisingAddressesPageProps {
  onPageChange: (page: 'settings' | 'wallets' | 'analysis' | 'dune-debug') => void;
  currentPage: 'settings' | 'wallets' | 'analysis' | 'dune-debug';
}

export const PromisingAddressesPage: React.FC<PromisingAddressesPageProps> = React.memo(({ onPageChange, currentPage }) => {
  console.log('🚀 PromisingAddressesPage: コンポーネントがレンダリングされました', { currentPage });
  
  const [tokens, setTokens] = useState<TokenConfig[]>([]);
  const [promisingAddresses, setPromisingAddresses] = useState<PromisingAddress[]>([]);
  const [selectedTokenIds, setSelectedTokenIds] = useState<string[]>([]); // 複数選択に変更
  const [loading, setLoading] = useState(false);
  const [importStatus, setImportStatus] = useState<string>('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [displayLimit, setDisplayLimit] = useState(50); // 初期表示数をさらに制限
  const [statsCollapsed, setStatsCollapsed] = useState(true); // 統計カードの折りたたみ状態（デフォルト閉じる）
  const [dataManagementCollapsed, setDataManagementCollapsed] = useState(true); // Data Managementカードの折りたたみ状態
  const [addressSearchQuery, setAddressSearchQuery] = useState(''); // アドレス検索クエリ
  const [promisingFilter, setPromisingFilter] = useState<'marked' | 'unmarked'>('marked'); // 有望マークフィルター

  // Firestoreからデータを読み込み
  useEffect(() => {
    const loadData = async () => {
      try {
        setInitialLoading(true);
        console.log('🔥 Firestore: データ読み込み開始');
        
        // トークンとアドレスを並行取得
        const [firestoreTokens, firestoreAddresses] = await Promise.all([
          FirestoreService.getAllTokens(),
          FirestoreService.getAllPromisingAddresses()
        ]);
        
        setTokens(firestoreTokens);
        setPromisingAddresses(firestoreAddresses);
        
        console.log('🔥 Firestore: データ読み込み完了', {
          tokens: firestoreTokens.length,
          addresses: firestoreAddresses.length
        });
      } catch (error) {
        console.error('❌ Firestore: データ読み込み失敗', error);
        alert('データの読み込みに失敗しました: ' + (error instanceof Error ? error.message : 'Unknown error'));
      } finally {
        setInitialLoading(false);
      }
    };

    loadData();

    // Firestoreのリアルタイム監視を追加
    const unsubscribeTokens = FirestoreService.subscribeToTokens((updatedTokens) => {
      console.log('🔥 トークンリアルタイム更新:', updatedTokens.length);
      setTokens(updatedTokens);
    });

    const unsubscribeAddresses = FirestoreService.subscribeToPromisingAddresses((updatedAddresses) => {
      console.log('🔥 有望アドレスリアルタイム更新:', updatedAddresses.length);
      setPromisingAddresses(updatedAddresses);
    });

    // クリーンアップ
    return () => {
      unsubscribeTokens();
      unsubscribeAddresses();
    };
  }, []);

  // 有望アドレスリストをFirestoreに保存（ローカルstateも更新）
  const updateLocalPromisingAddresses = (addresses: PromisingAddress[]) => {
    setPromisingAddresses(addresses);
    // Firestoreへの保存は個別のCRUD操作で行う
  };

  // Firestoreに有望アドレスを保存
  const savePromisingAddresses = async (addresses: PromisingAddress[]) => {
    try {
      // 既存のアドレスを更新し、新しいアドレスを追加
      await FirestoreService.addPromisingAddresses(addresses);
      setPromisingAddresses(addresses);
    } catch (error) {
      console.error('有望アドレスの保存に失敗:', error);
    }
  };

  // 複数選択ハンドラー
  const handleTokenSelection = (tokenId: string, checked: boolean) => {
    setSelectedTokenIds(prev => {
      if (checked) {
        return [...prev, tokenId];
      } else {
        return prev.filter(id => id !== tokenId);
      }
    });
  };

  // 指定トークンの購入者データをDuneから取得して有望アドレスリストに追加
  const importTokenBuyers = async (tokenId: string) => {
    const token = tokens.find(t => t.id === tokenId);
    if (!token) {
      alert('トークンが見つかりません');
      return;
    }

    if (token.chain !== 'ethereum') {
      alert('現在はEthereumトークンのみ対応しています');
      return;
    }

    if (!token.startTime || !token.endTime) {
      alert('期間が設定されていません');
      return;
    }

    setLoading(true);
    setImportStatus(`${token.symbol} の購入者データを取得中...`);

    try {
      const buyers = await DuneAPI.getEthereumTokenBuyers(
        token.address,
        token.startTime,
        token.endTime
      );

      console.log(`${token.symbol} の購入者データ: ${buyers.length}件取得`);

      // 既存のアドレスと重複チェック
      const existingAddresses = new Set(promisingAddresses.map(a => a.address.toLowerCase()));
      const newAddresses: PromisingAddress[] = [];

      buyers.forEach(buyer => {
        const addressLower = buyer.wallet_address.toLowerCase();
        if (!existingAddresses.has(addressLower)) {
          newAddresses.push({
            id: `${tokenId}-${buyer.wallet_address}-${Date.now()}`,
            address: buyer.wallet_address,
            tokenId: tokenId,
            tokenSymbol: token.symbol,
            purchaseTime: buyer.block_time,
            blockNumber: buyer.block_number,
            txHash: buyer.tx_signature,
            relatedTokens: [],
            isMarkedPromising: true
          });
          existingAddresses.add(addressLower);
        }
      });

      // 関連トークンの更新（既存アドレスが他のトークンも購入している場合）
      const updatedAddresses = promisingAddresses.map(existing => {
        const buyerAddresses = buyers.map(b => b.wallet_address.toLowerCase());
        if (buyerAddresses.includes(existing.address.toLowerCase())) {
          const relatedTokens = [...existing.relatedTokens];
          if (!relatedTokens.includes(tokenId)) {
            relatedTokens.push(tokenId);
          }
          return { ...existing, relatedTokens };
        }
        return existing;
      });

      const finalAddresses = [...updatedAddresses, ...newAddresses];
      savePromisingAddresses(finalAddresses);

      setImportStatus(`✅ 完了: ${newAddresses.length}件の新しい有望アドレスを追加`);
      
      setTimeout(() => setImportStatus(''), 3000);
    } catch (error) {
      console.error('購入者データ取得エラー:', error);
      setImportStatus(`❌ エラー: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setTimeout(() => setImportStatus(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  // アドレスを有望アドレスから除外
  const removeAddress = async (addressId: string) => {
    try {
      await FirestoreService.deletePromisingAddress(addressId);
      const newAddresses = promisingAddresses.filter(a => a.id !== addressId);
      setPromisingAddresses(newAddresses);
    } catch (error) {
      console.error('アドレスの削除に失敗:', error);
    }
  };

  // アドレスの有望マークを切り替え
  const togglePromisingMark = async (addressId: string) => {
    try {
      const address = promisingAddresses.find(a => a.id === addressId);
      if (address) {
        const updatedIsMarkedPromising = !address.isMarkedPromising;
        await FirestoreService.updatePromisingAddress(addressId, { 
          isMarkedPromising: updatedIsMarkedPromising 
        });
        const newAddresses = promisingAddresses.map(a => 
          a.id === addressId ? { ...a, isMarkedPromising: updatedIsMarkedPromising } : a
        );
        setPromisingAddresses(newAddresses);
      }
    } catch (error) {
      console.error('有望マークの切り替えに失敗:', error);
    }
  };

  // useMemoでフィルタリングとソートを最適化
  const { filteredAddresses, sortedAddresses, displayedAddresses } = React.useMemo(() => {
    console.log('🔄 アドレスデータ処理開始...', promisingAddresses.length, '選択トークン:', selectedTokenIds, '検索クエリ:', addressSearchQuery);
    
    // フィルタリング
    let filtered = promisingAddresses;
    
    // トークン選択によるフィルタリング
    if (selectedTokenIds.length > 0) {
      if (selectedTokenIds.length === 1) {
        // 単一選択の場合（従来通り）
        const tokenId = selectedTokenIds[0];
        filtered = filtered.filter(a => 
          a.tokenId === tokenId || a.relatedTokens.includes(tokenId)
        );
      } else {
        // 複数選択の場合：選択されたすべてのトークンを購入したアドレスのみ
        filtered = filtered.filter(address => {
          const addressTokens = [address.tokenId, ...address.relatedTokens];
          // 選択されたすべてのトークンがこのアドレスに含まれているかチェック
          return selectedTokenIds.every(tokenId => addressTokens.includes(tokenId));
        });
      }
    }

    // アドレス検索によるフィルタリング
    if (addressSearchQuery.trim()) {
      const searchQuery = addressSearchQuery.trim().toLowerCase();
      filtered = filtered.filter(address => 
        address.address.toLowerCase().includes(searchQuery)
      );
    }

    // 有望マークフィルタリング
    filtered = filtered.filter(address => 
      promisingFilter === 'marked' ? address.isMarkedPromising : !address.isMarkedPromising
    );

    // ソート（関連トークン数の多い順 → 複数トークン選択時は特に価値が高い）
    const sorted = [...filtered].sort((a, b) => 
      (b.relatedTokens.length + 1) - (a.relatedTokens.length + 1)
    );

    // 表示制限
    const displayed = sorted.slice(0, displayLimit);
    
    console.log('✅ アドレスデータ処理完了', {
      total: promisingAddresses.length,
      filtered: filtered.length,
      displayed: displayed.length,
      selectedTokens: selectedTokenIds.length
    });

    return {
      filteredAddresses: filtered,
      sortedAddresses: sorted,
      displayedAddresses: displayed
    };
  }, [promisingAddresses, selectedTokenIds, displayLimit, addressSearchQuery, promisingFilter]);

  // getRelatedTokenNamesもメモ化
  const getRelatedTokenNames = React.useCallback((address: PromisingAddress) => {
    const allTokenIds = [address.tokenId, ...address.relatedTokens];
    return allTokenIds.map(id => {
      const token = tokens.find(t => t.id === id);
      return token?.symbol || 'Unknown';
    }).join(', ');
  }, [tokens]);

  // 統計情報をメモ化（条件分岐の外で計算）
  const statistics = React.useMemo(() => {
    const markedCount = promisingAddresses.filter(a => a.isMarkedPromising).length;
    const multiTokenCount = promisingAddresses.filter(a => a.relatedTokens.length > 0).length;
    return { markedCount, multiTokenCount };
  }, [promisingAddresses]);

  // 初期読み込み中はローディング表示
  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">データを読み込んでいます...</p>
          <p className="text-sm text-gray-400 mt-2">大量のデータがある場合、少し時間がかかることがあります</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* ヘッダー */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                🎯 Smart Money Tracker
              </h1>
              <p className="text-sm text-gray-600 mt-1">早期成功者のウォレットを追跡してα獲得</p>
            </div>
            <div className="flex items-center space-x-6">
              {/* ナビゲーション */}
              <div className="flex space-x-4">
                <button
                  onClick={() => onPageChange('settings')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    currentPage === 'settings'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  ⚙️ 設定
                </button>
                <button
                  onClick={() => onPageChange('wallets')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    currentPage === 'wallets'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  💎 有望アドレス
                </button>
                <button
                  onClick={() => onPageChange('analysis')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    currentPage === 'analysis'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  📊 分析
                </button>
                <button
                  onClick={() => onPageChange('dune-debug')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    currentPage === 'dune-debug'
                      ? 'bg-orange-100 text-orange-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  🔧 Dune
                </button>
              </div>
              
              {/* ライブデータ */}
              <div className="text-right">
                <div className="text-sm text-gray-500">Live Data</div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-xs font-mono text-gray-700">Connected</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* コンパクト統計カード */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/50 shadow-xl">
            <div 
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50/50 transition-all duration-200"
              onClick={() => setStatsCollapsed(!statsCollapsed)}
            >
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Statistics</h3>
                  <div className="flex items-center space-x-6 text-sm text-gray-600">
                    <span>📊 {promisingAddresses.length.toLocaleString()} total</span>
                    <span>✅ {statistics.markedCount.toLocaleString()} promising</span>
                    <span>🎯 {statistics.multiTokenCount.toLocaleString()} multi-token</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-xs text-gray-500">Live</span>
                </div>
                <svg 
                  className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${statsCollapsed ? 'rotate-180' : ''}`} 
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            
            {!statsCollapsed && (
              <div className="border-t border-gray-100 p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600 mb-2">
                      {promisingAddresses.length.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Total Addresses</div>
                    <div className="text-xs text-green-500 mt-1">↗ Live tracking</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600 mb-2">
                      {statistics.markedCount.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Promising Marked</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {((statistics.markedCount / promisingAddresses.length) * 100).toFixed(1)}% of total
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600 mb-2">
                      {statistics.multiTokenCount.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Multi-Token Buyers</div>
                    <div className="text-xs text-purple-500 mt-1">High value targets</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* コンパクトデータ管理カード */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/50 shadow-xl">
            <div 
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50/50 transition-all duration-200"
              onClick={() => setDataManagementCollapsed(!dataManagementCollapsed)}
            >
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Data Management</h3>
                  {selectedTokenIds.length > 0 ? (
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <span>
                        Selected: {selectedTokenIds.map(id => {
                          const token = tokens.find(t => t.id === id);
                          return token?.symbol || 'Unknown';
                        }).join(', ')}
                      </span>
                      {selectedTokenIds.length > 1 && (
                        <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs font-medium">
                          Smart Money Mode
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">No tokens selected</div>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500">{tokens.length} tokens available</span>
                <svg 
                  className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${dataManagementCollapsed ? 'rotate-180' : ''}`} 
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            
            {!dataManagementCollapsed && (
              <div className="border-t border-gray-100 p-6">
                <div className="space-y-6">
                  {/* トークン選択エリア */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <label className="text-sm font-semibold text-gray-700">
                        🎯 Select Tokens to Find Smart Money
                      </label>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setSelectedTokenIds([])}
                          className="text-xs text-gray-500 hover:text-gray-700 underline"
                        >
                          Clear All
                        </button>
                        <span className="text-xs text-gray-500">
                          ({selectedTokenIds.length} selected)
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {tokens.map(token => {
                        const isSelected = selectedTokenIds.includes(token.id!);
                        const hasAnalysisData = token.buyersCount && token.buyersCount > 0;
                        const isEthereum = token.chain === 'ethereum';
                        
                        return (
                          <label
                            key={token.id}
                            className={`flex items-center p-3 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : hasAnalysisData
                                ? 'border-green-200 bg-green-50 hover:border-green-300'
                                : isEthereum
                                ? 'border-gray-200 bg-white/80 hover:border-gray-300 hover:bg-gray-50'
                                : 'border-orange-200 bg-orange-50 cursor-not-allowed opacity-60'
                            }`}
                            title={!isEthereum ? 'Only Ethereum tokens support buyer analysis' : undefined}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => handleTokenSelection(token.id!, e.target.checked)}
                              disabled={!isEthereum}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                            />
                            <div className="ml-3 flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="font-medium text-sm">
                                  {token.symbol}
                                </span>
                                {hasAnalysisData && (
                                  <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">
                                    ✓ Analyzed
                                  </span>
                                )}
                                {!hasAnalysisData && isEthereum && (
                                  <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full font-medium">
                                    ⏳ Pending
                                  </span>
                                )}
                                {!isEthereum && (
                                  <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full font-medium">
                                    ⚠️ Solana
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500">
                                {token.chain.toUpperCase()}
                                {hasAnalysisData 
                                  ? ` • ${token.buyersCount!.toLocaleString()} buyers`
                                  : isEthereum 
                                  ? ' • No buyer data yet'
                                  : ' • Analysis not supported'
                                }
                              </div>
                              {token.buyersLastUpdated && (
                                <div className="text-xs text-green-600 font-medium">
                                  Updated: {token.buyersLastUpdated}
                                </div>
                              )}
                            </div>
                            {isSelected && (
                              <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </label>
                        );
                      })}
                    </div>
                    
                    {/* 選択状態の説明 */}
                    {selectedTokenIds.length > 1 && (
                      <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-xl">
                        <div className="flex items-center text-purple-700">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                          <span className="text-sm font-medium">
                            Showing addresses that bought ALL {selectedTokenIds.length} selected tokens
                          </span>
                        </div>
                        <p className="text-xs text-purple-600 mt-1">
                          These are the most promising "smart money" addresses with proven track record.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* インポート機能 */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      📊 Import Buyer Data
                    </label>
                    <div className="flex space-x-3">
                      <select
                        className="flex-1 px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 font-medium"
                        onChange={(e) => e.target.value && importTokenBuyers(e.target.value)}
                        value=""
                      >
                        <option value="">Choose token to import buyers...</option>
                        {tokens.filter(token => token.chain === 'ethereum').map(token => (
                          <option key={token.id} value={token.id}>
                            {token.symbol} (Ethereum)
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      💡 Only Ethereum tokens support buyer data import via Dune Analytics
                    </p>

                    {importStatus && (
                      <div className={`mt-6 p-4 rounded-xl border-l-4 ${
                        importStatus.includes('❌') 
                          ? 'bg-red-50 border-red-400 text-red-800' 
                          : importStatus.includes('✅') 
                          ? 'bg-green-50 border-green-400 text-green-800' 
                          : 'bg-blue-50 border-blue-400 text-blue-800'
                      }`}>
                        <div className="flex items-center">
                          <span className="font-medium">{importStatus}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 高度なアドレステーブル */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/50 shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200/50 bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <h3 className="text-xl font-bold text-gray-900">
                    {selectedTokenIds.length > 1 ? '🧠 Smart Money Intersections' : '💎 Premium Addresses'}
                  </h3>
                  <div className="bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full">
                    {sortedAddresses.length.toLocaleString()} 
                    {selectedTokenIds.length > 1 ? ' overlaps' : ' total'}
                  </div>
                  {selectedTokenIds.length > 1 && (
                    <div className="bg-purple-100 text-purple-800 text-xs font-semibold px-3 py-1 rounded-full">
                      {selectedTokenIds.length} tokens required
                    </div>
                  )}
                </div>
                <div className="text-sm text-gray-600 font-mono">
                  Showing {displayedAddresses.length} of {sortedAddresses.length}
                </div>
              </div>
              
              {/* フィルターと検索 */}
              <div className="flex items-center space-x-3">
                {/* 有望マークフィルター */}
                <div className="flex bg-gray-100 rounded-lg p-0.5">
                  <button
                    onClick={() => setPromisingFilter('marked')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                      promisingFilter === 'marked'
                        ? 'bg-white text-green-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    ✅ Marked
                  </button>
                  <button
                    onClick={() => setPromisingFilter('unmarked')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                      promisingFilter === 'unmarked'
                        ? 'bg-white text-gray-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    ⭕ Unmarked
                  </button>
                </div>

                {/* アドレス検索 */}
                <div className="flex-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={addressSearchQuery}
                    onChange={(e) => setAddressSearchQuery(e.target.value)}
                    placeholder="Search addresses (partial match)..."
                    className="w-full pl-10 pr-4 py-2 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm"
                  />
                </div>
                {addressSearchQuery && (
                  <button
                    onClick={() => setAddressSearchQuery('')}
                    className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all duration-200"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            
            <div className="divide-y divide-gray-100">
              {displayedAddresses.map((address, index) => (
                <div 
                  key={address.id} 
                  className={`p-4 hover:bg-gray-50/50 transition-all duration-200 ${
                    address.isMarkedPromising ? 'bg-green-50/50 border-l-4 border-green-400' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {/* アドレス行 */}
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="text-xs text-gray-500 font-mono w-8">
                          #{(index + 1).toString().padStart(2, '0')}
                        </div>
                        <code className="text-sm font-mono bg-gray-900 text-green-400 px-2 py-1 rounded border">
                          {address.address}
                        </code>
                        
                        {/* バッジコレクション */}
                        <div className="flex items-center space-x-2">
                          {address.relatedTokens.length > 0 && (
                            <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center space-x-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                              <span>{address.relatedTokens.length + 1} tokens</span>
                            </div>
                          )}
                          {address.isMarkedPromising && (
                            <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center space-x-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              <span>Promising</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* 詳細情報 - 1行に集約 */}
                      <div className="flex items-center space-x-6 text-xs text-gray-600">
                        <div className="flex items-center space-x-1">
                          <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                          </svg>
                          <span className="font-medium">{getRelatedTokenNames(address)}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-mono">{new Date(address.purchaseTime).toLocaleDateString()}</span>
                        </div>
                        {address.txHash && (
                          <div className="flex items-center space-x-1">
                            <svg className="w-3 h-3 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            <code className="font-mono text-gray-700 bg-gray-100 px-1 py-0.5 rounded text-xs">
                              {address.txHash.slice(0, 12)}...
                            </code>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* アクションボタン */}
                    <div className="flex items-center ml-4">
                      <button
                        onClick={() => togglePromisingMark(address.id!)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 flex items-center space-x-1 ${
                          address.isMarkedPromising 
                            ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border border-yellow-300' 
                            : 'bg-green-100 text-green-700 hover:bg-green-200 border border-green-300'
                        }`}
                      >
                        {address.isMarkedPromising ? (
                          <>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            <span>Unmark</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Mark</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              
              {sortedAddresses.length === 0 && (
                <div className="text-center py-16">
                  <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-600 mb-2">No addresses found</h3>
                  <p className="text-gray-500">
                    {selectedTokenIds.length > 0 ? 'No promising addresses for the selected tokens' : 'Import token buyers to get started'}
                  </p>
                </div>
              )}
            </div>
            
            {/* ページネーション */}
            {displayedAddresses.length < sortedAddresses.length && (
              <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-200/50">
                <div className="flex items-center justify-center">
                  <button
                    onClick={() => setDisplayLimit(prev => prev + 50)}
                    className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-8 py-3 rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all duration-300 flex items-center space-x-3 font-semibold"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    <span>Load More ({(sortedAddresses.length - displayedAddresses.length).toLocaleString()} remaining)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});