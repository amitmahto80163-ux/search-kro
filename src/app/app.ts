import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { APP_NAME, APP_TAGLINE, SupportedLanguage } from '../shared/constants';
import { ApiService } from './services/api.service';
import { I18nService } from './services/i18n.service';
import { ProfileStorageService } from './services/storage.service';
import { HowWeCalculateModal } from './components/ui';

export interface NavItem {
  path: string;
  labelKey: string;
  icon: string;
  group: 'core' | 'trust' | 'money' | 'apply' | 'support';
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
  private readonly router = inject(Router);

  readonly appName = APP_NAME;
  readonly appTagline = APP_TAGLINE;

  readonly searchQuery = signal<string>('');
  readonly showSearchDropdown = signal<boolean>(false);
  readonly showMobileDrawer = signal<boolean>(false);
  readonly showFormulaModal = signal<boolean>(false);
  readonly showDeleteConfirmModal = signal<boolean>(false);

  readonly navItems: NavItem[] = [
    { path: '/', labelKey: 'nav.home', icon: 'home', group: 'core' },
    { path: '/start', labelKey: 'nav.start', icon: 'explore', group: 'core' },
    { path: '/exams', labelKey: 'nav.exams', icon: 'event_note', group: 'core' },
    { path: '/counsellor', labelKey: 'nav.counsellor', icon: 'psychology', group: 'core' },
    { path: '/verify', labelKey: 'nav.verify', icon: 'verified_user', group: 'trust' },
    { path: '/pitch', labelKey: 'nav.pitch', icon: 'record_voice_over', group: 'trust' },
    { path: '/fees', labelKey: 'nav.fees', icon: 'receipt_long', group: 'trust' },
    { path: '/claims', labelKey: 'nav.claims', icon: 'fact_check', group: 'trust' },
    { path: '/compare', labelKey: 'nav.compare', icon: 'compare_arrows', group: 'money' },
    { path: '/money', labelKey: 'nav.money', icon: 'account_balance_wallet', group: 'money' },
    { path: '/decision', labelKey: 'nav.decision', icon: 'analytics', group: 'money' },
    { path: '/plan', labelKey: 'nav.plan', icon: 'alt_route', group: 'money' },
    { path: '/family', labelKey: 'nav.family', icon: 'family_restroom', group: 'money' },
    { path: '/apply', labelKey: 'nav.apply', icon: 'send', group: 'apply' },
    { path: '/tracker', labelKey: 'nav.tracker', icon: 'track_changes', group: 'apply' },
    { path: '/documents', labelKey: 'nav.documents', icon: 'crop_Original', group: 'apply' },
    { path: '/calendar', labelKey: 'nav.calendar', icon: 'notifications_active', group: 'apply' },
    { path: '/help', labelKey: 'nav.help', icon: 'checklist', group: 'support' },
    { path: '/community', labelKey: 'nav.community', icon: 'groups', group: 'support' },
    { path: '/whatsapp', labelKey: 'nav.whatsapp', icon: 'chat', group: 'support' },
    { path: '/partner', labelKey: 'nav.partner', icon: 'handshake', group: 'support' },
  ];

  readonly searchResults = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (q.length < 2) return { colleges: [], exams: [], tools: [] };

    const colleges = this.api
      .colleges()
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.shortName.toLowerCase().includes(q) ||
          c.cityInfo.city.toLowerCase().includes(q) ||
          c.cityInfo.state.toLowerCase().includes(q)
      )
      .slice(0, 4);

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

    return { colleges, exams, tools };
  });

  ngOnInit(): void {
    void this.api.initializeData();
    if (typeof document !== 'undefined' && this.i18n.darkMode()) {
      document.documentElement.classList.add('dark');
    }
  }

  setLang(lang: SupportedLanguage): void {
    this.i18n.setLanguage(lang);
  }

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
    this.showSearchDropdown.set(value.trim().length >= 2);
  }

  navigateToSearchResult(path: string): void {
    this.showSearchDropdown.set(false);
    this.searchQuery.set('');
    void this.router.navigateByUrl(path);
  }

  async confirmDeleteAllMyData(): Promise<void> {
    const deviceId = this.profileStore.deviceId();
    this.profileStore.resetAllLocalData();
    await this.api.deleteServerData(deviceId);
    this.showDeleteConfirmModal.set(false);
    this.api.showToast(
      'All your local profile, checklist, applications, and alerts have been permanently deleted.',
      'success'
    );
  }
}
