import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {MatIconModule} from '@angular/material/icon';
import {APP_NAME, APP_TAGLINE, SupportedLanguage} from '../shared/constants';
import {ApiService} from './services/api.service';
import {I18nService} from './services/i18n.service';
import {ProfileStorageService} from './services/storage.service';
import {FirebaseAuthService} from './services/firebase-auth.service';
import {HowWeCalculateModal} from './components/ui';

export interface NavItem {
  path: string;
  labelKey: string;
  icon: string;
  group: 'core' | 'trust' | 'money' | 'apply' | 'support';
}

export interface NavSection {
  id: 'core' | 'trust' | 'money' | 'apply' | 'support';
  title: string;
  items: NavItem[];
}

export type BgThemeId = 'ocean' | 'warm' | 'emerald' | 'lavender';

export interface BgThemeOption {
  id: BgThemeId;
  label: string;
  swatchClass: string;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatIconModule,
    HowWeCalculateModal,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  readonly api = inject(ApiService);
  readonly i18n = inject(I18nService);
  readonly profileStore = inject(ProfileStorageService);
  readonly authService = inject(FirebaseAuthService);
  private readonly router = inject(Router);

  readonly appName = APP_NAME;
  readonly appTagline = APP_TAGLINE;

  readonly searchQuery = signal<string>('');
  readonly isSearchFocused = signal<boolean>(false);
  readonly showSearchDropdown = signal<boolean>(false);
  readonly showMobileDrawer = signal<boolean>(false);
  readonly showFormulaModal = signal<boolean>(false);
  readonly showDeleteConfirmModal = signal<boolean>(false);
  readonly showPreferencesMenu = signal<boolean>(false);
  readonly showAccountMenu = signal<boolean>(false);
  readonly isSidebarCollapsed = signal<boolean>(false);
  readonly expandedSectionIds = signal<string[]>(['core', 'apply']);
  readonly bgTheme = signal<BgThemeId>('ocean');

  readonly bgThemeOptions: BgThemeOption[] = [
    {id: 'ocean', label: 'Ocean Indigo & Teal', swatchClass: 'bg-gradient-to-br from-indigo-500 to-teal-400'},
    {id: 'warm', label: 'Warm Academic Sand', swatchClass: 'bg-gradient-to-br from-amber-400 to-rose-400'},
    {id: 'emerald', label: 'Campus Emerald & Sky', swatchClass: 'bg-gradient-to-br from-emerald-500 to-sky-400'},
    {id: 'lavender', label: 'Royal Lavender', swatchClass: 'bg-gradient-to-br from-violet-500 to-pink-400'},
  ];

  toggleSidebarSection(sectionId: string): void {
    this.expandedSectionIds.update((curr) =>
      curr.includes(sectionId)
        ? curr.filter((id) => id !== sectionId)
        : [...curr, sectionId]
    );
  }

  isSectionExpanded(sectionId: string): boolean {
    return this.expandedSectionIds().includes(sectionId);
  }

  expandAllSidebarSections(): void {
    this.expandedSectionIds.set(this.navSections.map((s) => s.id));
  }

  readonly navItems: NavItem[] = [
    {path: '/', labelKey: 'nav.home', icon: 'home', group: 'core'},
    {path: '/start', labelKey: 'nav.start', icon: 'explore', group: 'core'},
    {path: '/exams', labelKey: 'nav.exams', icon: 'event_note', group: 'core'},
    {path: '/counsellor', labelKey: 'nav.counsellor', icon: 'psychology', group: 'core'},
    {path: '/verify', labelKey: 'nav.verify', icon: 'verified_user', group: 'trust'},
    {path: '/pitch', labelKey: 'nav.pitch', icon: 'record_voice_over', group: 'trust'},
    {path: '/fees', labelKey: 'nav.fees', icon: 'receipt_long', group: 'trust'},
    {path: '/claims', labelKey: 'nav.claims', icon: 'fact_check', group: 'trust'},
    {path: '/compare', labelKey: 'nav.compare', icon: 'compare_arrows', group: 'money'},
    {path: '/money', labelKey: 'nav.money', icon: 'account_balance_wallet', group: 'money'},
    {path: '/decision', labelKey: 'nav.decision', icon: 'analytics', group: 'money'},
    {path: '/plan', labelKey: 'nav.plan', icon: 'alt_route', group: 'money'},
    {path: '/family', labelKey: 'nav.family', icon: 'family_restroom', group: 'money'},
    {path: '/apply', labelKey: 'nav.apply', icon: 'send', group: 'apply'},
    {path: '/tracker', labelKey: 'nav.tracker', icon: 'track_changes', group: 'apply'},
    {path: '/documents', labelKey: 'nav.documents', icon: 'document_scanner', group: 'apply'},
    {path: '/calendar', labelKey: 'nav.calendar', icon: 'notifications_active', group: 'apply'},
    {path: '/help', labelKey: 'nav.help', icon: 'checklist', group: 'support'},
    {path: '/community', labelKey: 'nav.community', icon: 'groups', group: 'support'},
    {path: '/whatsapp', labelKey: 'nav.whatsapp', icon: 'chat', group: 'support'},
    {path: '/partner', labelKey: 'nav.partner', icon: 'handshake', group: 'support'},
  ];

  readonly navSections: NavSection[] = [
    {
      id: 'core',
      title: '01. Core Discovery',
      items: this.navItems.filter((i) => i.group === 'core'),
    },
    {
      id: 'apply',
      title: '02. Applications & Docs',
      items: this.navItems.filter((i) => i.group === 'apply'),
    },
    {
      id: 'money',
      title: '03. Cost, ROI & Family',
      items: this.navItems.filter((i) => i.group === 'money'),
    },
    {
      id: 'trust',
      title: '04. Trust & Fraud Safety',
      items: this.navItems.filter((i) => i.group === 'trust'),
    },
    {
      id: 'support',
      title: '05. Community & Transparency',
      items: this.navItems.filter((i) => i.group === 'support'),
    },
  ];

  readonly searchResults = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (q.length < 2) return {colleges: [], exams: [], tools: []};

    const colleges = this.api
      .colleges()
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.shortName.toLowerCase().includes(q) ||
          c.cityInfo.city.toLowerCase().includes(q) ||
          c.cityInfo.state.toLowerCase().includes(q)
      )
      .slice(0, 5);

    const exams = this.api
      .exams()
      .filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.shortName.toLowerCase().includes(q)
      )
      .slice(0, 3);

    const tools = this.navItems
      .filter((item) => this.i18n.t(item.labelKey).toLowerCase().includes(q))
      .slice(0, 4);

    return {colleges, exams, tools};
  });

  ngOnInit(): void {
    void this.api.initializeData();
    this.i18n.syncDarkModeClass(this.i18n.darkMode());
    if (typeof localStorage !== 'undefined') {
      const savedTheme = localStorage.getItem('admitwise_bg_theme_v1') as BgThemeId | null;
      if (savedTheme && ['ocean', 'warm', 'emerald', 'lavender'].includes(savedTheme)) {
        this.bgTheme.set(savedTheme);
      }
    }
  }

  setBgTheme(theme: BgThemeId): void {
    this.bgTheme.set(theme);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('admitwise_bg_theme_v1', theme);
    }
  }

  setLang(lang: SupportedLanguage): void {
    this.i18n.setLanguage(lang);
  }

  onSearchFocus(): void {
    this.isSearchFocused.set(true);
    this.showSearchDropdown.set(true);
  }

  onSearchBlur(): void {
    const current = this.searchQuery().trim();
    if (current.length >= 2) {
      this.profileStore.addRecentSearch(current);
    }
    setTimeout(() => {
      this.isSearchFocused.set(false);
      this.showSearchDropdown.set(false);
    }, 180);
  }

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
    this.showSearchDropdown.set(true);
  }

  onSearchEnter(): void {
    const q = this.searchQuery().trim();
    if (q.length < 2) return;
    this.profileStore.addRecentSearch(q);
    const res = this.searchResults();
    if (res.colleges.length > 0) {
      this.navigateToSearchResult('/college/' + res.colleges[0].id, q);
    } else if (res.exams.length > 0) {
      this.navigateToSearchResult('/exams', q);
    } else if (res.tools.length > 0) {
      this.navigateToSearchResult(res.tools[0].path, q);
    } else {
      this.showSearchDropdown.set(false);
      void this.router.navigate(['/start']);
    }
  }

  applyRecentSearch(query: string): void {
    this.searchQuery.set(query);
    this.profileStore.addRecentSearch(query);
    this.isSearchFocused.set(true);
    this.showSearchDropdown.set(true);
  }

  removeRecentSearchItem(query: string, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.profileStore.removeRecentSearch(query);
  }

  clearRecentSearchHistory(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.profileStore.clearRecentSearches();
  }

  navigateToSearchResult(path: string, queryToSave?: string): void {
    const effectiveQuery = (queryToSave ?? this.searchQuery()).trim();
    if (effectiveQuery.length >= 2) {
      this.profileStore.addRecentSearch(effectiveQuery);
    }
    this.showSearchDropdown.set(false);
    this.isSearchFocused.set(false);
    this.searchQuery.set('');
    void this.router.navigateByUrl(path);
  }

  async confirmDeleteAllMyData(): Promise<void> {
    const deviceId = this.profileStore.deviceId();
    this.profileStore.resetAllLocalData();
    await this.api.deleteServerData(deviceId);
    if (this.authService.currentUser()) {
      await this.authService.deleteCloudProfile();
    }
    this.showDeleteConfirmModal.set(false);
    this.api.showToast(
      'All your local and cloud profile, checklist, applications, and alerts have been permanently deleted.',
      'success'
    );
  }
}
