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
  
  // 日次使用量追跡（簡易版）
  private static dailyUsage = {
    date: new Date().toDateString(),
    writes: 0,
    reads: 0
  };
  
  // 使用量をリセット（日付変更時）
  private static checkDailyReset() {
    const today = new Date().toDateString();
    if (this.dailyUsage.date !== today) {
      this.dailyUsage = { date: today, writes: 0, reads: 0 };
      console.log('🔄 Firebase使用量カウンターをリセットしました');
    }
  }
  
  // 使用量を追跡
  private static trackUsage(operation: 'read' | 'write', count: number = 1) {
    this.checkDailyReset();
    this.dailyUsage[operation === 'read' ? 'reads' : 'writes'] += count;
    
    const remaining = 20000 - this.dailyUsage.writes;
    if (remaining < 1000) {
      console.warn(`⚠️ Firebase書き込み制限接近: 残り${remaining}回`);
    }
  }
  
  // 使用量確認
  static getDailyUsage() {
    this.checkDailyReset();
    return { ...this.dailyUsage };
  }
  
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
      this.trackUsage('write');
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

  // 有望アドレス一括追加（全データ確実保存）
  static async addPromisingAddresses(addresses: Omit<FirebasePromisingAddress, 'id' | 'createdAt' | 'updatedAt'>[]) {
    try {
      const now = Timestamp.now();
      const BATCH_SIZE = 500; // Firestore Blazeプラン想定（高速処理）
      let totalAdded = 0;
      
      console.log(`🚀 ${addresses.length}件の有望アドレスを全て保存開始...`);
      
      // バッチごとに処理（全データ保存）
      for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
        const batch = addresses.slice(i, i + BATCH_SIZE);
        
        const promises = batch.map(address => 
          addDoc(collection(db, 'promising-addresses'), {
            ...address,
            createdAt: now,
            updatedAt: now
          })
        );
        
        await Promise.all(promises);
        totalAdded += batch.length;
        this.trackUsage('write', batch.length);
        
        console.log(`🔥 Firestore: バッチ ${Math.floor(i / BATCH_SIZE) + 1} 完了 (${batch.length}件), 合計: ${totalAdded}/${addresses.length}件`);
        
        // パフォーマンス維持のため短い待機
        if (i + BATCH_SIZE < addresses.length) {
          await new Promise(resolve => setTimeout(resolve, 100)); // 0.1秒待機
        }
      }
      
      console.log('✅ Firestore: 有望アドレス一括追加完了', totalAdded + '件 - 全データ保存成功');
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