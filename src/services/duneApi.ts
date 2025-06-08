import { API_CONFIG } from './apiConfig';

// Dune API型定義
export interface DuneQueryParams {
  query_id?: number;
  query_sql?: string;
  parameters?: Record<string, any>;
}

export interface DuneExecutionResponse {
  execution_id: string;
}

export interface DuneResultResponse {
  execution_id: string;
  query_id: number;
  state: 'QUERY_STATE_PENDING' | 'QUERY_STATE_EXECUTING' | 'QUERY_STATE_COMPLETED' | 'QUERY_STATE_FAILED';
  is_execution_finished?: boolean;
  result?: {
    rows: any[];
    metadata: {
      column_names: string[];
      result_set_bytes: number;
      total_row_count: number;
    };
  };
  error?: {
    type: string;
    message: string;
  } | string;
}

export interface TokenBuyer {
  wallet_address: string;
  tx_signature: string;
  block_time: string;
  amount: number;
  price_usd?: number;
}

export class DuneAPI {
  private static readonly BASE_URL = 'https://api.dune.com/api/v1';
  
  // 既存のクエリを実行（新しいクエリエンジン対応）
  static async executeQuery(queryId: number, parameters?: Record<string, any>): Promise<string> {
    console.log('🔥 DuneAPI.executeQuery called with:', {
      queryId,
      parameters,
      timestamp: new Date().toISOString()
    });
    
    const apiKey = import.meta.env.VITE_DUNE_API_KEY;
    
    if (!apiKey || apiKey === 'your_dune_api_key_here') {
      throw new Error('Dune API key not configured. Please set VITE_DUNE_API_KEY in .env file');
    }

    const endpoint = `${this.BASE_URL}/query/${queryId}/execute`;
    const body = parameters ? { query_parameters: parameters } : {};

    console.log('📡 Calling Dune execute endpoint:', {
      endpoint,
      body,
      body_stringified: JSON.stringify(body),
      parameters_detail: parameters ? Object.entries(parameters).map(([key, value]) => ({
        key,
        value,
        type: typeof value,
        length: typeof value === 'string' ? value.length : 'N/A'
      })) : 'No parameters',
      headers: { 'X-Dune-API-Key': apiKey.substring(0, 10) + '...' }
    });

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Dune-API-Key': apiKey
        },
        body: JSON.stringify(body)
      });

      console.log('📨 Dune execute response:', {
        status: response.status,
        statusText: response.statusText
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Dune API error: ${response.status} - ${errorText}`);
      }

      const data: DuneExecutionResponse = await response.json();
      console.log('✅ Execution started:', data);
      return data.execution_id;
    } catch (error) {
      console.error('❌ Dune query execution failed:', error);
      throw error;
    }
  }

  // 実行結果を取得
  static async getExecutionResult(executionId: string): Promise<DuneResultResponse> {
    const apiKey = import.meta.env.VITE_DUNE_API_KEY;
    
    const response = await fetch(`${this.BASE_URL}/execution/${executionId}/results`, {
      headers: {
        'X-Dune-API-Key': apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get execution result: ${response.status}`);
    }

    return response.json();
  }

  // 実行完了まで待機して結果を取得（レート制限対応）
  static async executeAndWaitForResult(queryId: number, parameters?: Record<string, any>, maxWaitTime = 300000): Promise<any[]> {
    const executionId = await this.executeQuery(queryId, parameters);
    const startTime = Date.now();
    const initialWait = 60000; // 最初は60秒待機
    const pollInterval = 20000; // その後は20秒間隔
    let checkCount = 0;
    
    console.log(`🚀 Dune query execution started. ID: ${executionId}`);
    console.log(`⏳ Waiting ${initialWait/1000} seconds for initial processing...`);
    
    // 最初の確認まで60秒待機（クエリ実行の初期処理時間）
    await new Promise(resolve => setTimeout(resolve, initialWait));
    
    while (Date.now() - startTime < maxWaitTime) {
      checkCount++;
      
      try {
        const result = await this.getExecutionResult(executionId);
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        console.log(`📊 Check #${checkCount} after ${elapsedSeconds}s - State: ${result.state}`, {
          is_execution_finished: result.is_execution_finished,
          error: result.error
        });
        
        // 実行が完了している場合（成功または失敗）
        if (result.is_execution_finished) {
          if (result.state === 'QUERY_STATE_COMPLETED') {
            console.log(`✅ Query completed successfully. Rows: ${result.result?.rows?.length || 0}`);
            return result.result?.rows || [];
          } else if (result.state === 'QUERY_STATE_FAILED') {
            const errorMessage = typeof result.error === 'object' 
              ? result.error.message 
              : result.error || 'Unknown error';
            console.error(`❌ Query execution failed:`, result.error);
            throw new Error(`Dune query failed: ${errorMessage}`);
          }
        }
        
        // まだ実行中の場合のみポーリングを続ける
        if (!result.is_execution_finished) {
          console.log(`⏳ Query still ${result.state}. Waiting ${pollInterval/1000} seconds for next check...`);
          
          // 次のチェックまで待機
          if (Date.now() - startTime + pollInterval < maxWaitTime) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
          }
        } else {
          // is_execution_finishedがtrueなのに、COMPLETED/FAILED以外の状態
          console.warn(`⚠️ Unexpected state: execution finished but state is ${result.state}`);
          break;
        }
      } catch (error) {
        // API呼び出し自体のエラー（ネットワークエラーなど）
        console.warn(`⚠️ Check #${checkCount} failed:`, error);
        
        // リトライするかどうか判断
        if (error instanceof Error && error.message.includes('Dune query failed')) {
          // クエリ実行エラーの場合はリトライしない
          throw error;
        }
        
        // その他のエラーの場合は次のチェックまで待機
        if (Date.now() - startTime + pollInterval < maxWaitTime) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
      }
    }
    
    throw new Error(`Query execution timeout after ${maxWaitTime/1000} seconds`);
  }

  // Ethereumトークンの購入者を取得（作成済みクエリID: 5233698を使用）
  static async getEthereumTokenBuyers(
    tokenAddress: string, 
    startTime?: string, 
    endTime?: string
  ): Promise<TokenBuyer[]> {
    console.log('🎯 getEthereumTokenBuyers called with:', {
      tokenAddress,
      tokenAddress_length: tokenAddress?.length,
      tokenAddress_type: typeof tokenAddress,
      startTime,
      endTime,
      timestamp: new Date().toISOString()
    });
    
    // Ethereumアドレスの購入者取得用クエリID
    // 高品質な初回購入者抽出クエリ（WITH句・ROW_NUMBER使用）
    const TOKEN_BUYERS_QUERY_ID = 5233698;
    
    // Duneクエリではfrom_hex()を使うので0xを除いた40文字で送信
    const formattedAddress = tokenAddress.toLowerCase().startsWith('0x') 
      ? tokenAddress.toLowerCase().slice(2)  // 0xを除去
      : tokenAddress.toLowerCase();
    
    // アドレスの長さをチェック（0xなしで40文字）
    if (formattedAddress.length !== 40) {
      throw new Error(`Invalid token address length: ${formattedAddress.length} (expected 40 without 0x). Address: ${tokenAddress}`);
    }
    
    // 日時形式を変換（YYYY-MM-DDTHH:mm → YYYY-MM-DD HH:mm:ss）
    const formatDateTime = (dateTimeStr?: string): string => {
      if (!dateTimeStr) return '';
      
      // datetime-localの値をDune SQLの期待する形式に変換
      // 例: "2024-12-01T10:30" → "2024-12-01 10:30:00"
      let formatted: string;
      
      if (dateTimeStr.includes('T')) {
        // ISO形式（T区切り）の場合
        formatted = dateTimeStr.replace('T', ' ') + ':00';
      } else {
        // 既にスペース区切りの場合
        formatted = dateTimeStr.includes(':') && dateTimeStr.split(':').length === 2 
          ? dateTimeStr + ':00'  // 秒を追加
          : dateTimeStr;
      }
      
      // 最低限の長さチェック（YYYY-MM-DD HH:MM:SS = 19文字）
      if (formatted.length < 19) {
        console.warn(`⚠️ DateTime format may be invalid: "${formatted}" (length: ${formatted.length})`);
      }
      
      console.log(`🕐 DateTime conversion: "${dateTimeStr}" (length: ${dateTimeStr.length}) → "${formatted}" (length: ${formatted.length})`);
      return formatted;
    };
    
    // パラメータ作成時にデフォルト値を明確に定義
    const defaultStartTime = '2020-01-01 00:00:00';
    const defaultEndTime = '2030-12-31 23:59:59';
    
    const formattedStartTime = startTime ? formatDateTime(startTime) : defaultStartTime;
    const formattedEndTime = endTime ? formatDateTime(endTime) : defaultEndTime;
    
    // 最終的なパラメータの長さチェック
    if (formattedStartTime.length !== 19) {
      console.warn(`⚠️ start_time length invalid: "${formattedStartTime}" (${formattedStartTime.length})`);
    }
    if (formattedEndTime.length !== 19) {
      console.warn(`⚠️ end_time length invalid: "${formattedEndTime}" (${formattedEndTime.length})`);
    }

    const parameters: Record<string, any> = {
      token_address: formattedAddress,
      start_time: formattedStartTime,
      end_time: formattedEndTime
    };
    
    console.log('📋 Query parameters:', {
      ...parameters,
      address_length: formattedAddress.length,
      original_address: tokenAddress,
      formatted_address: formattedAddress,
      detailed_analysis: {
        token_address: {
          value: parameters.token_address,
          length: parameters.token_address?.length,
          type: typeof parameters.token_address,
          first_10_chars: parameters.token_address?.substring(0, 10),
          last_10_chars: parameters.token_address?.substring(parameters.token_address.length - 10),
          is_exactly_13_chars: parameters.token_address?.length === 13
        },
        start_time: {
          value: parameters.start_time,
          length: parameters.start_time?.length,
          type: typeof parameters.start_time,
          is_exactly_13_chars: parameters.start_time?.length === 13
        },
        end_time: {
          value: parameters.end_time,
          length: parameters.end_time?.length,
          type: typeof parameters.end_time,
          is_exactly_13_chars: parameters.end_time?.length === 13
        }
      },
      // 各パラメータで13文字のものを探す
      length_13_check: Object.entries(parameters).filter(([key, value]) => 
        typeof value === 'string' && value.length === 13
      ),
      // 全パラメータの長さ詳細
      all_param_lengths: Object.entries(parameters).map(([key, value]) => ({
        key,
        value,
        length: typeof value === 'string' ? value.length : 'not string',
        type: typeof value
      }))
    });

    try {
      console.log('🎯 Final parameters being sent to Dune:', {
        queryId: TOKEN_BUYERS_QUERY_ID,
        parameters: parameters,
        parameterStringified: JSON.stringify(parameters),
        parameterStringLength: JSON.stringify(parameters).length,
        address_detail: {
          original: tokenAddress,
          formatted: formattedAddress,
          formatted_length: formattedAddress.length,
          is_empty: formattedAddress === '',
          char_analysis: formattedAddress.split('').map((char, i) => `${i}:${char}`)
        }
      });
      
      const rows = await this.executeAndWaitForResult(TOKEN_BUYERS_QUERY_ID, parameters);
      
      console.log('✅ Raw response from Dune:', {
        rowCount: rows.length,
        sampleRow: rows[0] || 'No rows returned',
        allRows: rows
      });

      return rows.map(row => ({
        wallet_address: row.buyer_address,
        tx_signature: row.first_purchase_tx,
        block_time: row.first_purchase_time,
        block_number: row.first_purchase_block,
        amount: 0, // このクエリにはamountフィールドがない
        price_usd: undefined
      }));
    } catch (error) {
      console.error('❌ Failed to get Ethereum token buyers:', error);
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        queryId: TOKEN_BUYERS_QUERY_ID,
        parameters: parameters
      });
      throw error;
    }
  }

}