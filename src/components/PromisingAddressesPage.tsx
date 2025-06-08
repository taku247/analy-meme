import React, { useState, useEffect } from 'react';
import { DuneAPI } from '../services/duneApi';

interface PromisingAddress {
  id: string;
  address: string;
  tokenId: string;
  tokenSymbol: string;
  purchaseTime: string;
  blockNumber?: number;
  txHash?: string;
  relatedTokens: string[]; // 他にも購入しているトークンのID
  isMarkedPromising: boolean;
}

interface TokenConfig {
  id: string;
  symbol: string;
  address: string;
  chain: 'ethereum' | 'solana';
  startTime?: string;
  endTime?: string;
  marketCapLimit?: number;
}

export const PromisingAddressesPage: React.FC = () => {
  const [tokens, setTokens] = useState<TokenConfig[]>([]);
  const [promisingAddresses, setPromisingAddresses] = useState<PromisingAddress[]>([]);
  const [selectedTokenId, setSelectedTokenId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [importStatus, setImportStatus] = useState<string>('');

  // ローカルストレージから保存されたデータを読み込み
  useEffect(() => {
    const loadData = () => {
      try {
        const savedTokens = localStorage.getItem('meme-coin-tracker-tokens');
        const savedAddresses = localStorage.getItem('promising-addresses');
        
        if (savedTokens) {
          setTokens(JSON.parse(savedTokens));
        }
        
        if (savedAddresses) {
          setPromisingAddresses(JSON.parse(savedAddresses));
        }
      } catch (error) {
        console.error('データ読み込みエラー:', error);
      }
    };

    // 初回読み込み
    loadData();

    // ローカルストレージの変更を監視（他のページからの更新を反映）
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'promising-addresses' || e.key === 'meme-coin-tracker-tokens') {
        console.log('🔄 他のページからデータが更新されました');
        loadData();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // 有望アドレスリストをローカルストレージに保存
  const savePromisingAddresses = (addresses: PromisingAddress[]) => {
    setPromisingAddresses(addresses);
    localStorage.setItem('promising-addresses', JSON.stringify(addresses));
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
  const removeAddress = (addressId: string) => {
    const newAddresses = promisingAddresses.filter(a => a.id !== addressId);
    savePromisingAddresses(newAddresses);
  };

  // アドレスの有望マークを切り替え
  const togglePromisingMark = (addressId: string) => {
    const newAddresses = promisingAddresses.map(a => 
      a.id === addressId ? { ...a, isMarkedPromising: !a.isMarkedPromising } : a
    );
    savePromisingAddresses(newAddresses);
  };

  // 選択されたトークンでフィルタリング
  const filteredAddresses = selectedTokenId 
    ? promisingAddresses.filter(a => a.tokenId === selectedTokenId || a.relatedTokens.includes(selectedTokenId))
    : promisingAddresses;

  // 関連トークン数でソート
  const sortedAddresses = [...filteredAddresses].sort((a, b) => 
    (b.relatedTokens.length + 1) - (a.relatedTokens.length + 1)
  );

  const getRelatedTokenNames = (address: PromisingAddress) => {
    const allTokenIds = [address.tokenId, ...address.relatedTokens];
    return allTokenIds.map(id => {
      const token = tokens.find(t => t.id === id);
      return token?.symbol || 'Unknown';
    }).join(', ');
  };

  return (
    <div className="space-y-6">
      {/* 有望アドレス取得セクション */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">有望アドレスリスト管理</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            トークンを選択して購入者データを取得
          </label>
          <div className="flex space-x-3">
            <select
              value={selectedTokenId}
              onChange={(e) => setSelectedTokenId(e.target.value)}
              className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">すべて表示</option>
              {tokens.map(token => (
                <option key={token.id} value={token.id}>
                  {token.symbol} ({token.chain})
                </option>
              ))}
            </select>
            <button
              onClick={() => selectedTokenId && importTokenBuyers(selectedTokenId)}
              disabled={loading || !selectedTokenId}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? '取得中...' : '購入者取得'}
            </button>
          </div>
        </div>

        {importStatus && (
          <div className={`p-3 rounded-lg mb-4 ${
            importStatus.includes('❌') ? 'bg-red-50 text-red-800' : 
            importStatus.includes('✅') ? 'bg-green-50 text-green-800' : 
            'bg-blue-50 text-blue-800'
          }`}>
            {importStatus}
          </div>
        )}

        {/* 統計情報 */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-blue-900">総アドレス数</div>
            <div className="text-2xl font-bold text-blue-600">{promisingAddresses.length}</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-green-900">有望マーク済み</div>
            <div className="text-2xl font-bold text-green-600">
              {promisingAddresses.filter(a => a.isMarkedPromising).length}
            </div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-purple-900">複数トークン購入</div>
            <div className="text-2xl font-bold text-purple-600">
              {promisingAddresses.filter(a => a.relatedTokens.length > 0).length}
            </div>
          </div>
        </div>
      </div>

      {/* アドレスリスト */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          有望アドレス一覧 ({sortedAddresses.length}件)
        </h3>
        
        <div className="space-y-3">
          {sortedAddresses.map(address => (
            <div 
              key={address.id} 
              className={`p-4 border rounded-lg ${
                address.isMarkedPromising ? 'border-green-200 bg-green-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                      {address.address}
                    </code>
                    {address.relatedTokens.length > 0 && (
                      <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full">
                        {address.relatedTokens.length + 1}トークン購入
                      </span>
                    )}
                    {address.isMarkedPromising && (
                      <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                        有望
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    <div>購入トークン: {getRelatedTokenNames(address)}</div>
                    <div>初回購入: {address.purchaseTime}</div>
                    {address.txHash && (
                      <div className="truncate">TX: {address.txHash}</div>
                    )}
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => togglePromisingMark(address.id)}
                    className={`px-3 py-1 text-xs rounded ${
                      address.isMarkedPromising 
                        ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' 
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {address.isMarkedPromising ? 'マーク解除' : '有望マーク'}
                  </button>
                  <button
                    onClick={() => removeAddress(address.id)}
                    className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                  >
                    削除
                  </button>
                </div>
              </div>
            </div>
          ))}
          
          {sortedAddresses.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              {selectedTokenId ? '選択されたトークンの有望アドレスがありません' : '有望アドレスがありません'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};