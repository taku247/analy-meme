import React from 'react';

export const TestApp: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold text-center mb-8">
        ミームコイン検知サイト - テスト画面
      </h1>
      <div className="max-w-md mx-auto bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">動作確認</h2>
        <p className="text-gray-600 mb-4">
          この画面が表示されていれば、基本的なReact + TailwindCSSの動作は正常です。
        </p>
        <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          テストボタン
        </button>
      </div>
    </div>
  );
};