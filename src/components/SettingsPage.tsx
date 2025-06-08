import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore.simple';
import { TokenConfig } from '../types.js';

export const SettingsPage: React.FC = () => {
  const { config, addToken, deleteToken, updateApiKeys, exportConfig, importConfig } = useAppStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<Partial<TokenConfig>>({
    symbol: '',
    address: '',
    startTime: '',
    endTime: '',
    marketCapLimit: undefined,
    chain: 'solana'
  });
  const [apiKeys, setApiKeys] = useState({
    birdeye: config.apiKeys.birdeye || '',
    quicknode: config.apiKeys.quicknode || ''
  });

  const handleAddToken = () => {
    if (!formData.symbol || !formData.address || !formData.startTime || !formData.endTime) {
      alert('必須項目を入力してください');
      return;
    }

    const newToken: TokenConfig = {
      id: Date.now().toString(),
      symbol: formData.symbol!,
      address: formData.address!,
      startTime: formData.startTime!,
      endTime: formData.endTime!,
      marketCapLimit: formData.marketCapLimit,
      chain: formData.chain!
    };

    addToken(newToken);
    setFormData({
      symbol: '',
      address: '',
      startTime: '',
      endTime: '',
      marketCapLimit: undefined,
      chain: 'solana'
    });
    setShowAddForm(false);
  };

  const handleExport = () => {
    const configJson = exportConfig();
    const blob = new Blob([configJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'meme-coin-tracker-config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const configJson = e.target?.result as string;
        importConfig(configJson);
        alert('設定をインポートしました');
      } catch (error) {
        alert('設定ファイルの形式が正しくありません');
      }
    };
    reader.readAsText(file);
  };

  const handleSaveApiKeys = () => {
    updateApiKeys(apiKeys);
    alert('APIキーを保存しました');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">APIキー設定</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Birdeye API Key
            </label>
            <input
              type="password"
              value={apiKeys.birdeye}
              onChange={(e) => setApiKeys({ ...apiKeys, birdeye: e.target.value })}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Birdeye APIキーを入力"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              QuickNode API Key
            </label>
            <input
              type="password"
              value={apiKeys.quicknode}
              onChange={(e) => setApiKeys({ ...apiKeys, quicknode: e.target.value })}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="QuickNode APIキーを入力"
            />
          </div>
        </div>
        <button
          onClick={handleSaveApiKeys}
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          APIキーを保存
        </button>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-gray-900">トークン設定</h2>
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
          >
            トークンを追加
          </button>
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
                placeholder="トークンアドレス"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="datetime-local"
                placeholder="開始日時"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="datetime-local"
                placeholder="終了日時"
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
          {config.tokens.map((token) => (
            <div key={token.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div>
                <div className="font-medium">{token.symbol}</div>
                <div className="text-sm text-gray-500">
                  {token.chain.toUpperCase()} | {token.startTime} ~ {token.endTime}
                </div>
                <div className="text-xs text-gray-400">{token.address}</div>
              </div>
              <button
                onClick={() => deleteToken(token.id)}
                className="text-red-600 hover:text-red-800"
              >
                削除
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">設定の管理</h2>
        <div className="flex space-x-4">
          <button
            onClick={handleExport}
            className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
          >
            設定をエクスポート
          </button>
          <label className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 cursor-pointer">
            設定をインポート
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </div>
  );
};