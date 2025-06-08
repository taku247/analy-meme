import React, { useState } from 'react';
import { DuneAPI } from '../services/duneApi';

export const DuneDebugPage: React.FC = () => {
  const [queryId, setQueryId] = useState('5233698');
  const [parameters, setParameters] = useState({
    token_address: 'a0b86a33e6776e4a7c01c911c9d6b2462e8cd63e',
    start_time: '2024-01-01 00:00:00',
    end_time: '2024-01-02 00:00:00'
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setExecutionLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const executeQuery = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setExecutionLogs([]);

    try {
      addLog('🚀 クエリ実行開始');
      addLog(`📋 クエリID: ${queryId}`);
      addLog(`📋 パラメータ: ${JSON.stringify(parameters, null, 2)}`);

      // パラメータの準備（空の値は除外）
      const cleanParams: Record<string, any> = {};
      Object.entries(parameters).forEach(([key, value]) => {
        if (value && value.trim()) {
          cleanParams[key] = value.trim();
        }
      });

      addLog(`📋 クリーン後パラメータ: ${JSON.stringify(cleanParams, null, 2)}`);

      // 直接APIを呼び出し
      const executionId = await DuneAPI.executeQuery(parseInt(queryId), cleanParams);
      addLog(`✅ 実行ID取得: ${executionId}`);

      // 結果の取得
      addLog('⏳ 結果取得開始...');
      const resultData = await DuneAPI.executeAndWaitForResult(parseInt(queryId), cleanParams);
      addLog(`✅ 結果取得完了: ${resultData.length}件`);

      setResult(resultData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      addLog(`❌ エラー発生: ${errorMessage}`);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const testBasicConnection = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setExecutionLogs([]);

    try {
      addLog('🔌 基本接続テスト開始');
      
      const apiKey = import.meta.env.VITE_DUNE_API_KEY;
      addLog(`🔑 APIキー確認: ${apiKey ? `${apiKey.substring(0, 10)}...` : '未設定'}`);

      // 単純なHTTP APIテスト
      const testQueryId = 4396790; // テスト用クエリ
      const response = await fetch(`https://api.dune.com/api/v1/query/${testQueryId}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Dune-API-Key': apiKey
        },
        body: JSON.stringify({})
      });

      addLog(`📡 HTTP Response: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      addLog(`✅ 基本接続成功: ${JSON.stringify(data)}`);
      setResult(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      addLog(`❌ 接続エラー: ${errorMessage}`);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = () => {
    setExecutionLogs([]);
    setResult(null);
    setError(null);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Dune API デバッグツール</h2>
        
        {/* APIキー状況 */}
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">API設定状況</h3>
          <p className="text-sm text-blue-800">
            APIキー: {import.meta.env.VITE_DUNE_API_KEY ? 
              '設定済み' : 
              '未設定'
            }
          </p>
        </div>

        {/* クエリ設定 */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              クエリID
            </label>
            <input
              type="text"
              value={queryId}
              onChange={(e) => setQueryId(e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="例: 5236850"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                token_address (0xなし)
              </label>
              <input
                type="text"
                value={parameters.token_address}
                onChange={(e) => setParameters({...parameters, token_address: e.target.value})}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="a0b86a33e6776e4a7c01c911c9d6b2462e8cd63e"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                start_time <span className="text-red-600">TODO UTC調整</span>
              </label>
              <input
                type="text"
                value={parameters.start_time}
                onChange={(e) => setParameters({...parameters, start_time: e.target.value})}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="2024-01-01 00:00:00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                end_time
              </label>
              <input
                type="text"
                value={parameters.end_time}
                onChange={(e) => setParameters({...parameters, end_time: e.target.value})}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="2024-01-02 00:00:00"
              />
            </div>
          </div>
        </div>

        {/* 操作ボタン */}
        <div className="flex space-x-4 mt-6">
          <button
            onClick={executeQuery}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'クエリ実行中...' : 'クエリ実行'}
          </button>
          
          <button
            onClick={testBasicConnection}
            disabled={loading}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            基本接続テスト
          </button>

          <button
            onClick={clearLogs}
            className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
          >
            ログクリア
          </button>
        </div>

        {/* プリセット設定 */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-3">プリセット設定</h3>
          <div className="flex space-x-2">
            <button
              onClick={() => {
                setQueryId('5236850');
                setParameters({
                  token_address: 'a0b86a33e6776e4a7c01c911c9d6b2462e8cd63e',
                  start_time: '2024-01-01 00:00:00',
                  end_time: '2024-01-02 00:00:00'
                });
              }}
              className="px-3 py-1 text-xs bg-blue-200 hover:bg-blue-300 rounded"
            >
              5236850 テスト
            </button>
            <button
              onClick={() => {
                setParameters({
                  token_address: '',
                  start_time: '',
                  end_time: ''
                });
              }}
              className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded"
            >
              パラメータクリア
            </button>
          </div>
        </div>
      </div>

      {/* 実行ログ */}
      {executionLogs.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">実行ログ</h3>
          <div className="bg-gray-100 p-4 rounded-lg max-h-64 overflow-y-auto">
            {executionLogs.map((log, index) => (
              <div key={index} className="text-sm font-mono mb-1">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* エラー表示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-red-900 mb-2">エラー</h3>
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* 結果表示 */}
      {result && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">実行結果</h3>
          <div className="bg-gray-100 p-4 rounded-lg max-h-96 overflow-auto">
            <pre className="text-sm font-mono whitespace-pre-wrap">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};