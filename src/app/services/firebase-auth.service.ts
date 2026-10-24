import {Injectable, inject, signal} from '@angular/core';
import {FirebaseApp, getApps, initializeApp} from 'firebase/app';
import {
  Auth,
  GoogleAuthProvider,
  User,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  Firestore,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../../firebase-applet-config.json';
import {ApiService} from './api.service';
import {ProfileStorageService, StudentProfile} from './storage.service';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export interface AuthUserSummary {
  uid: string;
  displayName: string;
  email: string | null;
  photoURL: string | null;
  emailVerified: boolean;
}

@Injectable({providedIn: 'root'})
export class FirebaseAuthService {
  private readonly profileStore = inject(ProfileStorageService);
  private readonly api = inject(ApiService);

  private app: FirebaseApp | null = null;
  private auth: Auth | null = null;
  private db: Firestore | null = null;

  readonly currentUser = signal<AuthUserSummary | null>(null);
  readonly isAuthReady = signal<boolean>(false);
  readonly isSigningIn = signal<boolean>(false);
  readonly isSyncingCloud = signal<boolean>(false);
  readonly lastSyncedAt = signal<string | null>(null);

  constructor() {
    this.initializeClientFirebase();
  }

  private initializeClientFirebase(): void {
    if (typeof window === 'undefined') {
      this.isAuthReady.set(true);
      return;
    }

    try {
      this.app =
        getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
      this.db = getFirestore(this.app, firebaseConfig.firestoreDatabaseId);
      this.auth = getAuth(this.app);

      void this.testConnection();

      onAuthStateChanged(this.auth, (user: User | null) => {
        if (user) {
          const summary: AuthUserSummary = {
            uid: user.uid,
            displayName:
              user.displayName?.trim() ||
              user.email?.split('@')[0] ||
              'Student',
            email: user.email,
            photoURL: user.photoURL,
            emailVerified: user.emailVerified,
          };
          this.currentUser.set(summary);
          if (!this.profileStore.profile().studentName.trim()) {
            this.profileStore.updateProfile({
              studentName: summary.displayName,
            });
          }
          void this.loadOrInitializeCloudProfile(summary);
        } else {
          this.currentUser.set(null);
          this.lastSyncedAt.set(null);
        }
        this.isAuthReady.set(true);
      });
    } catch (error) {
      console.error('Firebase initialization error:', error);
      this.isAuthReady.set(true);
    }
  }

  private async testConnection(): Promise<void> {
    if (!this.db) return;
    try {
      await getDocFromServer(doc(this.db, 'test', 'connection'));
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('the client is offline')
      ) {
        console.error('Please check your Firebase configuration.');
      }
    }
  }

  private handleFirestoreError(
    error: unknown,
    operationType: OperationType,
    path: string | null
  ): never {
    const currentUser = this.auth?.currentUser;
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: currentUser?.uid,
        email: currentUser?.email,
        emailVerified: currentUser?.emailVerified,
        isAnonymous: currentUser?.isAnonymous,
        tenantId: currentUser?.tenantId,
        providerInfo:
          currentUser?.providerData?.map((provider) => ({
            providerId: provider.providerId,
            email: provider.email,
          })) || [],
      },
      operationType,
      path,
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  }

  async signInWithGoogle(): Promise<void> {
    if (!this.auth || this.isSigningIn()) return;
    this.isSigningIn.set(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({prompt: 'select_account'});
      const cred = await signInWithPopup(this.auth, provider);
      const name =
        cred.user.displayName || cred.user.email?.split('@')[0] || 'Student';
      this.api.showToast(
        `Signed in as ${name}. Cloud profile sync active.`,
        'success'
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (!msg.includes('popup-closed-by-user')) {
        this.api.showToast(
          'Google Sign-In could not be completed. Please try again.',
          'warning'
        );
      }
    } finally {
      this.isSigningIn.set(false);
    }
  }

  async signOutUser(): Promise<void> {
    if (!this.auth) return;
    try {
      await signOut(this.auth);
      this.currentUser.set(null);
      this.lastSyncedAt.set(null);
      this.api.showToast('Signed out of your Search Kro account.', 'info');
    } catch {
      this.api.showToast('Could not sign out. Please try again.', 'error');
    }
  }

  private sanitizeString(val: string, minLen: number, maxLen: number, fallback: string): string {
    const cleaned = (val || '').trim().slice(0, maxLen);
    return cleaned.length >= minLen ? cleaned : fallback;
  }

  private sanitizeStringArray(arr: string[], maxItems: number): string[] {
    return (arr || [])
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0 && item.length <= 128)
      .slice(0, maxItems);
  }

  async loadOrInitializeCloudProfile(user: AuthUserSummary): Promise<void> {
    if (!this.db || !user.emailVerified) return;
    const path = `users/${user.uid}`;
    this.isSyncingCloud.set(true);
    try {
      const ref = doc(this.db, 'users', user.uid);
      let snap;
      try {
        snap = await getDoc(ref);
      } catch (error) {
        this.handleFirestoreError(error, OperationType.GET, path);
      }

      if (snap.exists()) {
        const data = snap.data();
        const partialProfile: Partial<StudentProfile> = {};
        if (typeof data['displayName'] === 'string' && data['displayName'].trim()) {
          partialProfile.studentName = data['displayName'].trim();
        }
        if (typeof data['homeState'] === 'string' && data['homeState'].trim()) {
          partialProfile.homeState = data['homeState'].trim();
        }
        if (
          typeof data['category'] === 'string' &&
          ['GEN', 'OBC-NCL', 'SC', 'ST', 'EWS'].includes(data['category'])
        ) {
          partialProfile.category = data['category'] as StudentProfile['category'];
        }
        if (typeof data['annualBudgetInr'] === 'number') {
          partialProfile.annualBudgetInr = data['annualBudgetInr'];
        }
        if (typeof data['class12Percent'] === 'number') {
          partialProfile.class12Percent = data['class12Percent'];
        }

        this.profileStore.updateProfile(partialProfile);

        if (Array.isArray(data['compareIds'])) {
          this.profileStore.setCompareColleges(
            data['compareIds'].filter((x): x is string => typeof x === 'string')
          );
        }
        if (Array.isArray(data['checklistCompletedIds'])) {
          this.profileStore.setCompletedChecklistIds(
            data['checklistCompletedIds'].filter(
              (x): x is string => typeof x === 'string'
            )
          );
        }
        this.lastSyncedAt.set(new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}));
      } else {
        await this.createCloudProfile(user);
      }
    } finally {
      this.isSyncingCloud.set(false);
    }
  }

  private async createCloudProfile(user: AuthUserSummary): Promise<void> {
    if (!this.db || !user.emailVerified) return;
    const path = `users/${user.uid}`;
    const p = this.profileStore.profile();
    const payload = {
      uid: user.uid.slice(0, 128),
      displayName: this.sanitizeString(
        p.studentName || user.displayName,
        1,
        100,
        'Student'
      ),
      homeState: this.sanitizeString(p.homeState, 2, 80, 'Maharashtra'),
      category: this.sanitizeString(p.category, 2, 30, 'GEN'),
      annualBudgetInr: Math.min(10000000, Math.max(0, Number(p.annualBudgetInr) || 250000)),
      class12Percent: Math.min(100, Math.max(0, Number(p.class12Percent) || 80)),
      compareIds: this.sanitizeStringArray(this.profileStore.compareIds(), 4),
      checklistCompletedIds: this.sanitizeStringArray(
        this.profileStore.completedChecklistIds(),
        50
      ),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(this.db, 'users', user.uid), payload);
      this.lastSyncedAt.set(new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}));
    } catch (error) {
      this.handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  async syncProfileToCloud(): Promise<void> {
    const user = this.currentUser();
    if (!this.db || !user || !user.emailVerified) return;

    const path = `users/${user.uid}`;
    this.isSyncingCloud.set(true);
    try {
      const ref = doc(this.db, 'users', user.uid);
      let snap;
      try {
        snap = await getDoc(ref);
      } catch (error) {
        this.handleFirestoreError(error, OperationType.GET, path);
      }

      if (!snap.exists()) {
        await this.createCloudProfile(user);
        this.api.showToast('Saved admission profile & shortlist to cloud.', 'success');
        return;
      }

      const p = this.profileStore.profile();
      const updatePayload = {
        displayName: this.sanitizeString(
          p.studentName || user.displayName,
          1,
          100,
          'Student'
        ),
        homeState: this.sanitizeString(p.homeState, 2, 80, 'Maharashtra'),
        category: this.sanitizeString(p.category, 2, 30, 'GEN'),
        annualBudgetInr: Math.min(10000000, Math.max(0, Number(p.annualBudgetInr) || 250000)),
        class12Percent: Math.min(100, Math.max(0, Number(p.class12Percent) || 80)),
        compareIds: this.sanitizeStringArray(this.profileStore.compareIds(), 4),
        checklistCompletedIds: this.sanitizeStringArray(
          this.profileStore.completedChecklistIds(),
          50
        ),
        updatedAt: serverTimestamp(),
      };

      try {
        await updateDoc(ref, updatePayload);
        this.lastSyncedAt.set(new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}));
        this.api.showToast('Synced admission profile & shortlist to cloud.', 'success');
      } catch (error) {
        this.handleFirestoreError(error, OperationType.UPDATE, path);
      }
    } finally {
      this.isSyncingCloud.set(false);
    }
  }

  async deleteCloudProfile(): Promise<void> {
    const user = this.currentUser();
    if (!this.db || !user || !user.emailVerified) return;
    const path = `users/${user.uid}`;
    try {
      await deleteDoc(doc(this.db, 'users', user.uid));
      this.lastSyncedAt.set(null);
    } catch (error) {
      this.handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
}
