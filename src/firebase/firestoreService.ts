import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
  Timestamp 
} from 'firebase/firestore';
import { db } from './config';

// Firestore用の型定義
export interface FirebaseTokenConfig {
  id?: string;
  symbol: string;
  address: string;
  startTime: string;
  endTime: string;
  marketCapLimit?: number;
  chain: 'ethereum' | 'solana';
  buyersCount?: number;
  buyersLastUpdated?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirebasePromisingAddress {
  id?: string;
  address: string;
  tokenId: string;
  tokenSymbol: string;
  purchaseTime: string;
  blockNumber?: number;
  txHash?: string;
  relatedTokens: string[];
  isMarkedPromising: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export class FirestoreService {
  
  // === トークン管理 ===
  
  // トークン追加
  static async addToken(tokenData: Omit<FirebaseTokenConfig, 'id' | 'createdAt' | 'updatedAt'>) {
    try {
      const now = Timestamp.now();
      const docRef = await addDoc(collection(db, 'tokens'), {
        ...tokenData,
        createdAt: now,
        updatedAt: now
      });
      console.log('🔥 Firestore: トークン追加成功', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Firestore: トークン追加失敗', error);
      throw error;
    }
  }

  // トークン更新
  static async updateToken(tokenId: string, updates: Partial<FirebaseTokenConfig>) {
    try {
      const tokenRef = doc(db, 'tokens', tokenId);
      await updateDoc(tokenRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });
      console.log('🔥 Firestore: トークン更新成功', tokenId);
    } catch (error) {
      console.error('❌ Firestore: トークン更新失敗', error);
      throw error;
    }
  }

  // トークン削除
  static async deleteToken(tokenId: string) {
    try {
      await deleteDoc(doc(db, 'tokens', tokenId));
      console.log('🔥 Firestore: トークン削除成功', tokenId);
    } catch (error) {
      console.error('❌ Firestore: トークン削除失敗', error);
      throw error;
    }
  }

  // 全トークン取得
  static async getAllTokens(): Promise<FirebaseTokenConfig[]> {
    try {
      const q = query(collection(db, 'tokens'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const tokens: FirebaseTokenConfig[] = [];
      
      querySnapshot.forEach((doc) => {
        tokens.push({
          id: doc.id,
          ...doc.data()
        } as FirebaseTokenConfig);
      });
      
      console.log('🔥 Firestore: トークン取得成功', tokens.length + '件');
      return tokens;
    } catch (error) {
      console.error('❌ Firestore: トークン取得失敗', error);
      throw error;
    }
  }

  // トークンの変更をリアルタイム監視
  static subscribeToTokens(callback: (tokens: FirebaseTokenConfig[]) => void) {
    const q = query(collection(db, 'tokens'), orderBy('createdAt', 'desc'));
    
    return onSnapshot(q, (querySnapshot) => {
      const tokens: FirebaseTokenConfig[] = [];
      querySnapshot.forEach((doc) => {
        tokens.push({
          id: doc.id,
          ...doc.data()
        } as FirebaseTokenConfig);
      });
      console.log('🔥 Firestore: トークンリアルタイム更新', tokens.length + '件');
      callback(tokens);
    });
  }

  // === 有望アドレス管理 ===

  // 有望アドレス一括追加（バッチ処理で制限回避）
  static async addPromisingAddresses(addresses: Omit<FirebasePromisingAddress, 'id' | 'createdAt' | 'updatedAt'>[]) {
    try {
      const now = Timestamp.now();
      const BATCH_SIZE = 50; // Firebase無料プラン制限を考慮（より小さなバッチ）
      const MAX_DAILY_WRITES = 10000; // 日次制限の半分を目安に
      let totalAdded = 0;
      
      // 制限チェック
      if (addresses.length > MAX_DAILY_WRITES) {
        console.warn(`⚠️ 警告: ${addresses.length}件は日次制限を超える可能性があります。最初の${MAX_DAILY_WRITES}件のみ処理します。`);
        addresses = addresses.slice(0, MAX_DAILY_WRITES);
      }
      
      // バッチごとに処理
      for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
        const batch = addresses.slice(i, i + BATCH_SIZE);
        
        try {
          const promises = batch.map(address => 
            addDoc(collection(db, 'promising-addresses'), {
              ...address,
              createdAt: now,
              updatedAt: now
            })
          );
          
          await Promise.all(promises);
          totalAdded += batch.length;
          
          console.log(`🔥 Firestore: バッチ ${Math.floor(i / BATCH_SIZE) + 1} 完了 (${batch.length}件), 合計: ${totalAdded}/${addresses.length}件`);
          
          // 次のバッチまで待機（制限回避）
          if (i + BATCH_SIZE < addresses.length) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒待機
          }
        } catch (batchError: any) {
          if (batchError?.code === 'resource-exhausted') {
            console.error(`❌ Firebase日次制限に到達しました。${totalAdded}件を追加後、処理を停止します。`);
            break;
          }
          throw batchError;
        }
      }
      
      console.log('🔥 Firestore: 有望アドレス一括追加完了', totalAdded + '件');
      
      if (totalAdded < addresses.length) {
        console.warn(`⚠️ ${addresses.length - totalAdded}件は制限により追加されませんでした。`);
      }
      
      return totalAdded;
    } catch (error) {
      console.error('❌ Firestore: 有望アドレス追加失敗', error);
      throw error;
    }
  }

  // 有望アドレス更新
  static async updatePromisingAddress(addressId: string, updates: Partial<FirebasePromisingAddress>) {
    try {
      const addressRef = doc(db, 'promising-addresses', addressId);
      await updateDoc(addressRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });
      console.log('🔥 Firestore: 有望アドレス更新成功', addressId);
    } catch (error) {
      console.error('❌ Firestore: 有望アドレス更新失敗', error);
      throw error;
    }
  }

  // 有望アドレス削除
  static async deletePromisingAddress(addressId: string) {
    try {
      await deleteDoc(doc(db, 'promising-addresses', addressId));
      console.log('🔥 Firestore: 有望アドレス削除成功', addressId);
    } catch (error) {
      console.error('❌ Firestore: 有望アドレス削除失敗', error);
      throw error;
    }
  }

  // 全有望アドレス取得
  static async getAllPromisingAddresses(): Promise<FirebasePromisingAddress[]> {
    try {
      const q = query(collection(db, 'promising-addresses'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const addresses: FirebasePromisingAddress[] = [];
      
      querySnapshot.forEach((doc) => {
        addresses.push({
          id: doc.id,
          ...doc.data()
        } as FirebasePromisingAddress);
      });
      
      console.log('🔥 Firestore: 有望アドレス取得成功', addresses.length + '件');
      return addresses;
    } catch (error) {
      console.error('❌ Firestore: 有望アドレス取得失敗', error);
      throw error;
    }
  }

  // 有望アドレスの変更をリアルタイム監視
  static subscribeToPromisingAddresses(callback: (addresses: FirebasePromisingAddress[]) => void) {
    const q = query(collection(db, 'promising-addresses'), orderBy('createdAt', 'desc'));
    
    return onSnapshot(q, (querySnapshot) => {
      const addresses: FirebasePromisingAddress[] = [];
      querySnapshot.forEach((doc) => {
        addresses.push({
          id: doc.id,
          ...doc.data()
        } as FirebasePromisingAddress);
      });
      console.log('🔥 Firestore: 有望アドレスリアルタイム更新', addresses.length + '件');
      callback(addresses);
    });
  }

  // 特定のトークンの有望アドレス取得
  static async getPromisingAddressesByToken(tokenId: string): Promise<FirebasePromisingAddress[]> {
    try {
      const q = query(
        collection(db, 'promising-addresses'), 
        where('tokenId', '==', tokenId),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const addresses: FirebasePromisingAddress[] = [];
      
      querySnapshot.forEach((doc) => {
        addresses.push({
          id: doc.id,
          ...doc.data()
        } as FirebasePromisingAddress);
      });
      
      console.log('🔥 Firestore: トークン別有望アドレス取得成功', addresses.length + '件');
      return addresses;
    } catch (error) {
      console.error('❌ Firestore: トークン別有望アドレス取得失敗', error);
      throw error;
    }
  }

  // 重複アドレスチェック
  static async checkDuplicateAddress(address: string): Promise<boolean> {
    try {
      const q = query(
        collection(db, 'promising-addresses'), 
        where('address', '==', address.toLowerCase())
      );
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error('❌ Firestore: 重複チェック失敗', error);
      return false;
    }
  }
}