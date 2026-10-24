import {Injectable, computed, signal} from '@angular/core';
import {AdmissionRouteType} from '../../shared/schemas';

export function safeGetItem(key: string): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSetItem(key: string, value: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    window.localStorage.setItem(key, value);
  } catch {
    // Keep working if localStorage is blocked or quota is exceeded
  }
}

export function safeRemoveItem(key: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage removal errors
  }
}

export function safeClearAllAdmitWiseStorage(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith('admitwise_')) {
        keysToRemove.push(k);
      }
    }
    for (const k of keysToRemove) {
      window.localStorage.removeItem(k);
    }
  } catch {
    // Ignore storage clear errors
  }
}

export interface StudentProfile {
  studentName: string;
  category: 'GEN' | 'OBC-NCL' | 'SC' | 'ST' | 'EWS';
  gender: 'Female' | 'Male' | 'Other';
  homeState: string;
  class12Percent: number;
  familyIncomeLakhs: number;
  preferredRoute: AdmissionRouteType;
  annualBudgetInr: number;
  preferredBranch: string;
  jeeRankOrPercentile: number;
}

const DEFAULT_PROFILE: StudentProfile = {
  studentName: '',
  category: 'GEN',
  gender: 'Female',
  homeState: 'Maharashtra',
  class12Percent: 84,
  familyIncomeLakhs: 4.5,
  preferredRoute: 'national_exam',
  annualBudgetInr: 250000,
  preferredBranch: 'CSE',
  jeeRankOrPercentile: 14500,
};

export interface SavedAcademicDocument {
  id: string;
  title: string;
  docType:
    | 'Class 12 Marksheet'
    | 'Class 10 Marksheet / DOB Proof'
    | 'Entrance Exam Admit Card'
    | 'Category / EWS Certificate'
    | 'Income Certificate'
    | 'Passport Photo / Signature';
  examTag: string;
  dataUrl: string;
  width: number;
  height: number;
  sizeKb: number;
  filterApplied: 'colour' | 'high_contrast_bw' | 'bright_document';
  createdAt: string;
}

@Injectable({providedIn: 'root'})
export class ProfileStorageService {
  readonly deviceId = signal<string>(this.initDeviceId());
  readonly profile = signal<StudentProfile>(this.loadProfile());
  readonly compareIds = signal<string[]>(this.loadCompareIds());
  readonly completedChecklistIds = signal<string[]>(this.loadChecklist());
  readonly savedDocuments = signal<SavedAcademicDocument[]>(
    this.loadSavedDocuments()
  );
  readonly recentSearches = signal<string[]>(this.loadRecentSearches());

  readonly profileCompletionPercent = computed(() => {
    const p = this.profile();
    let filled = 0;
    if (p.studentName.trim().length > 1) filled++;
    if (p.homeState) filled++;
    if (p.class12Percent > 0) filled++;
    if (p.annualBudgetInr > 0) filled++;
    if (p.preferredBranch) filled++;
    return Math.round((filled / 5) * 100);
  });

  private initDeviceId(): string {
    const existing = safeGetItem('admitwise_device_id');
    if (existing) return existing;
    const generated = `DEV-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    safeSetItem('admitwise_device_id', generated);
    return generated;
  }

  private loadProfile(): StudentProfile {
    const raw = safeGetItem('admitwise_profile');
    if (!raw) return DEFAULT_PROFILE;
    try {
      return {...DEFAULT_PROFILE, ...JSON.parse(raw)};
    } catch {
      return DEFAULT_PROFILE;
    }
  }

  updateProfile(partial: Partial<StudentProfile>): void {
    const updated = {...this.profile(), ...partial};
    this.profile.set(updated);
    safeSetItem('admitwise_profile', JSON.stringify(updated));
  }

  private loadCompareIds(): string[] {
    const raw = safeGetItem('admitwise_compare_ids');
    if (!raw) return ['nit-trichy', 'vit-vellore', 'coep-pune'];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(0, 4) : [];
    } catch {
      return ['nit-trichy', 'vit-vellore', 'coep-pune'];
    }
  }

  toggleCompareCollege(collegeId: string): {added: boolean; limitReached: boolean} {
    const current = this.compareIds();
    if (current.includes(collegeId)) {
      const next = current.filter((id) => id !== collegeId);
      this.compareIds.set(next);
      safeSetItem('admitwise_compare_ids', JSON.stringify(next));
      return {added: false, limitReached: false};
    }
    if (current.length >= 4) {
      return {added: false, limitReached: true};
    }
    const next = [...current, collegeId];
    this.compareIds.set(next);
    safeSetItem('admitwise_compare_ids', JSON.stringify(next));
    return {added: true, limitReached: false};
  }

  setCompareColleges(ids: string[]): void {
    const trimmed = ids.slice(0, 4);
    this.compareIds.set(trimmed);
    safeSetItem('admitwise_compare_ids', JSON.stringify(trimmed));
  }

  private loadChecklist(): string[] {
    const raw = safeGetItem('admitwise_checklist');
    if (!raw) return ['help-step-1'];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  toggleChecklistItem(itemId: string): void {
    const current = this.completedChecklistIds();
    const next = current.includes(itemId)
      ? current.filter((id) => id !== itemId)
      : [...current, itemId];
    this.completedChecklistIds.set(next);
    safeSetItem('admitwise_checklist', JSON.stringify(next));
  }

  setCompletedChecklistIds(ids: string[]): void {
    const trimmed = ids.slice(0, 50);
    this.completedChecklistIds.set(trimmed);
    safeSetItem('admitwise_checklist', JSON.stringify(trimmed));
  }

  private loadSavedDocuments(): SavedAcademicDocument[] {
    const raw = safeGetItem('admitwise_saved_documents');
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  addSavedDocument(
    doc: Omit<SavedAcademicDocument, 'id' | 'createdAt'>
  ): SavedAcademicDocument {
    const newDoc: SavedAcademicDocument = {
      ...doc,
      id: `DOC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
      createdAt: new Date().toISOString(),
    };
    const next = [newDoc, ...this.savedDocuments()].slice(0, 20);
    this.savedDocuments.set(next);
    safeSetItem('admitwise_saved_documents', JSON.stringify(next));
    return newDoc;
  }

  deleteSavedDocument(id: string): void {
    const next = this.savedDocuments().filter((d) => d.id !== id);
    this.savedDocuments.set(next);
    safeSetItem('admitwise_saved_documents', JSON.stringify(next));
  }

  private loadRecentSearches(): string[] {
    const raw = safeGetItem('admitwise_recent_searches');
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => item.trim())
        .slice(0, 5);
    } catch {
      return [];
    }
  }

  addRecentSearch(query: string): void {
    const cleaned = query.trim();
    if (cleaned.length < 2) return;
    const current = this.recentSearches();
    const deduplicated = current.filter(
      (item) => item.toLowerCase() !== cleaned.toLowerCase()
    );
    const next = [cleaned, ...deduplicated].slice(0, 5);
    this.recentSearches.set(next);
    safeSetItem('admitwise_recent_searches', JSON.stringify(next));
  }

  removeRecentSearch(query: string): void {
    const next = this.recentSearches().filter(
      (item) => item.toLowerCase() !== query.trim().toLowerCase()
    );
    this.recentSearches.set(next);
    safeSetItem('admitwise_recent_searches', JSON.stringify(next));
  }

  clearRecentSearches(): void {
    this.recentSearches.set([]);
    safeRemoveItem('admitwise_recent_searches');
  }

  resetAllLocalData(): void {
    safeClearAllAdmitWiseStorage();
    this.profile.set(DEFAULT_PROFILE);
    this.compareIds.set([]);
    this.completedChecklistIds.set([]);
    this.savedDocuments.set([]);
    this.recentSearches.set([]);
  }
}
