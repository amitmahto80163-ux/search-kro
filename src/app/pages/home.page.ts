import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import {Router, RouterLink} from '@angular/router';
import {MatIconModule} from '@angular/material/icon';
import {APP_NAME} from '../../shared/constants';
import {AdmissionRouteType, College} from '../../shared/schemas';
import {ApiService} from '../services/api.service';
import {I18nService} from '../services/i18n.service';
import {ProfileStorageService} from '../services/storage.service';
import {HowWeCalculateModal} from '../components/ui';
import {ExamCountdownTicker} from '../components/exam-countdown';
import {StudentDashboard} from '../components/student-dashboard';

interface FeatureGroup {
  id: string;
  shortTabLabel: string;
  categoryTitle: string;
  subtitle: string;
  items: {
    num: number;
    title: string;
    desc: string;
    route: string;
    icon: string;
  }[];
}

export type HomeWorkspaceView = 'dashboard' | 'matcher' | 'countdown' | 'directory';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-home-page',
  imports: [
    RouterLink,
    MatIconModule,
    HowWeCalculateModal,
    ExamCountdownTicker,
    StudentDashboard,
  ],
  template: `
    <div class="space-y-8 pb-12">
      <!-- Clean, Focused Hero Banner (Single Dominant Anchor) -->
      <section class="rounded-2xl border border-indigo-900/80 bg-gradient-to-br from-indigo-950 via-slate-900 to-teal-950 p-6 sm:p-8 text-white shadow-sm">
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div class="space-y-3 max-w-2xl">
            <div class="flex flex-wrap items-center gap-2 text-xs text-teal-300">
              <span>{{ i18n.t('hero.kicker') }}</span>
              <span aria-hidden="true">·</span>
              <span>{{ trustStats().collegesCount }} Verified Colleges</span>
              <span aria-hidden="true">·</span>
              <span>{{ trustStats().examsCount }} Entrance Exams</span>
              <span aria-hidden="true">·</span>
              <span>₹0 Upfront</span>
            </div>

            <h1
              class="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight"
              style="text-wrap: balance;"
            >
              {{ i18n.t('hero.title') }}
            </h1>

            <p class="text-xs sm:text-sm text-indigo-100/90 leading-relaxed">
              {{ i18n.t('hero.subtitle') }}
            </p>
          </div>

          <!-- Primary Quick-Action Buttons -->
          <div class="flex flex-wrap items-center gap-2.5 shrink-0">
            <a
              routerLink="/start"
              class="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-teal-400 px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-950 hover:bg-teal-300 transition-colors whitespace-nowrap"
            >
              <mat-icon class="!w-4 !h-4 !text-[18px]">explore</mat-icon>
              <span>{{ i18n.t('hero.ctaFind') }}</span>
            </a>

            <a
              routerLink="/verify"
              class="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-amber-300/60 bg-amber-400/15 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-amber-200 hover:bg-amber-400/25 transition-colors whitespace-nowrap"
            >
              <mat-icon class="!w-4 !h-4 !text-[18px]">verified_user</mat-icon>
              <span>{{ i18n.t('hero.ctaVerify') }}</span>
            </a>

            <a
              routerLink="/documents"
              class="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-indigo-400/40 bg-white/10 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-white/20 transition-colors whitespace-nowrap"
            >
              <mat-icon class="!w-4 !h-4 !text-[18px]">document_scanner</mat-icon>
              <span>Scan Docs</span>
            </a>
          </div>
        </div>
      </section>

      <!-- Workspace View Switcher: Separates Major Sections Cleanly So Only One Focused Tool Shows at a Time -->
      <div class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/90 pb-3 dark:border-slate-800">
        <div
          role="tablist"
          aria-label="Select workspace view"
          class="inline-flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-200/75 p-1 dark:bg-slate-800 text-xs sm:text-sm"
        >
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="workspaceView() === 'dashboard'"
            (click)="workspaceView.set('dashboard')"
            class="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 font-semibold transition-all cursor-pointer"
            [class]="workspaceView() === 'dashboard' ? 'bg-white text-indigo-950 shadow-2xs dark:bg-slate-900 dark:text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'"
          >
            <mat-icon class="!w-4 !h-4 !text-[16px]">dashboard</mat-icon>
            <span>My Dashboard</span>
          </button>

          <button
            type="button"
            role="tab"
            [attr.aria-selected]="workspaceView() === 'matcher'"
            (click)="workspaceView.set('matcher')"
            class="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 font-semibold transition-all cursor-pointer"
            [class]="workspaceView() === 'matcher' ? 'bg-white text-indigo-950 shadow-2xs dark:bg-slate-900 dark:text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'"
          >
            <mat-icon class="!w-4 !h-4 !text-[16px]">tune</mat-icon>
            <span>Quick College Matcher ({{ heroMatchingCount() }})</span>
          </button>

          <button
            type="button"
            role="tab"
            [attr.aria-selected]="workspaceView() === 'countdown'"
            (click)="workspaceView.set('countdown')"
            class="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 font-semibold transition-all cursor-pointer"
            [class]="workspaceView() === 'countdown' ? 'bg-white text-indigo-950 shadow-2xs dark:bg-slate-900 dark:text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'"
          >
            <mat-icon class="!w-4 !h-4 !text-[16px]">timer</mat-icon>
            <span>Live Exam Countdown</span>
          </button>

          <button
            type="button"
            role="tab"
            [attr.aria-selected]="workspaceView() === 'directory'"
            (click)="workspaceView.set('directory')"
            class="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 font-semibold transition-all cursor-pointer"
            [class]="workspaceView() === 'directory' ? 'bg-white text-indigo-950 shadow-2xs dark:bg-slate-900 dark:text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'"
          >
            <mat-icon class="!w-4 !h-4 !text-[16px]">apps</mat-icon>
            <span>All 38 Platform Tools</span>
          </button>
        </div>

        <button
          type="button"
          (click)="showFormulaModal.set(true)"
          class="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:underline dark:text-indigo-400 cursor-pointer"
        >
          <mat-icon class="!w-4 !h-4 !text-[16px]">functions</mat-icon>
          <span>{{ i18n.t('action.howWeCalculate') }}</span>
        </button>
      </div>

      <!-- VIEW 1: MY DASHBOARD & 3-STEP WORKFLOW -->
      @if (workspaceView() === 'dashboard') {
        <div class="space-y-8">
          <app-student-dashboard />

          <!-- Clean 3-Step Workflow Strip -->
          <section aria-labelledby="how-it-works-heading" class="space-y-3">
            <h2 id="how-it-works-heading" class="text-sm font-bold text-slate-700 dark:text-slate-300">
              {{ i18n.t('home.howItWorksTitle') }}
            </h2>

            <div class="grid gap-4 md:grid-cols-3">
              <a
                routerLink="/start"
                class="group rounded-xl border border-slate-200/90 bg-white/90 p-5 hover:border-indigo-500 transition-colors dark:border-slate-800 dark:bg-slate-900/90"
              >
                <div class="flex items-center justify-between">
                  <span class="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">Step 01</span>
                  <mat-icon class="!w-4 !h-4 !text-[16px] text-slate-400 group-hover:text-indigo-600">arrow_forward</mat-icon>
                </div>
                <h3 class="mt-2 text-sm font-bold text-slate-900 group-hover:text-indigo-700 dark:text-slate-100 dark:group-hover:text-indigo-400">
                  {{ i18n.t('home.step1Title') }}
                </h3>
                <p class="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {{ i18n.t('home.step1Desc') }}
                </p>
              </a>

              <a
                routerLink="/compare"
                class="group rounded-xl border border-slate-200/90 bg-white/90 p-5 hover:border-teal-500 transition-colors dark:border-slate-800 dark:bg-slate-900/90"
              >
                <div class="flex items-center justify-between">
                  <span class="font-mono text-xs font-bold text-teal-600 dark:text-teal-400">Step 02</span>
                  <mat-icon class="!w-4 !h-4 !text-[16px] text-slate-400 group-hover:text-teal-600">arrow_forward</mat-icon>
                </div>
                <h3 class="mt-2 text-sm font-bold text-slate-900 group-hover:text-teal-700 dark:text-slate-100 dark:group-hover:text-teal-400">
                  {{ i18n.t('home.step2Title') }}
                </h3>
                <p class="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {{ i18n.t('home.step2Desc') }}
                </p>
              </a>

              <a
                routerLink="/apply"
                class="group rounded-xl border border-slate-200/90 bg-white/90 p-5 hover:border-amber-500 transition-colors dark:border-slate-800 dark:bg-slate-900/90"
              >
                <div class="flex items-center justify-between">
                  <span class="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">Step 03</span>
                  <mat-icon class="!w-4 !h-4 !text-[16px] text-slate-400 group-hover:text-amber-600">arrow_forward</mat-icon>
                </div>
                <h3 class="mt-2 text-sm font-bold text-slate-900 group-hover:text-amber-700 dark:text-slate-100 dark:group-hover:text-amber-400">
                  {{ i18n.t('home.step3Title') }}
                </h3>
                <p class="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {{ i18n.t('home.step3Desc') }}
                </p>
              </a>
            </div>
          </section>
        </div>
      }

      <!-- VIEW 2: DEDICATED QUICK COLLEGE MATCHER WITH INSTANT LIVE RESULTS -->
      @if (workspaceView() === 'matcher') {
        <section class="rounded-2xl border border-slate-200/90 bg-white/95 p-6 sm:p-8 shadow-2xs dark:border-slate-800 dark:bg-slate-900/95">
          <div class="grid gap-8 lg:grid-cols-12 items-start">
            <!-- Left Controls (5 cols) -->
            <div class="lg:col-span-5 space-y-5 rounded-xl border border-slate-200/80 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-800/40">
              <div>
                <h2 class="text-base font-bold text-slate-900 dark:text-white">
                  Interactive Route & Budget Matcher
                </h2>
                <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Filter verified colleges by admission pathway and maximum annual tuition fee.
                </p>
              </div>

              <!-- Route Selector -->
              <div class="space-y-1.5">
                <label for="hero-route-select" class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  1. Preferred Admission Route
                </label>
                <select
                  id="hero-route-select"
                  [value]="quickRoute()"
                  (change)="onQuickRouteChange($event)"
                  class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="ALL">All 3 Routes (National, Institute & Direct)</option>
                  <option value="national_exam">All-India / State Exam (JEE, CET, WBJEE)</option>
                  <option value="college_process">College's Own Entrance (BITSAT, VITEEE, MET)</option>
                  <option value="direct">Direct Class 12 / Board Topper Merit</option>
                </select>
              </div>

              <!-- Annual Budget Slider -->
              <div class="space-y-2">
                <div class="flex items-center justify-between text-xs">
                  <label for="hero-budget-slider" class="font-semibold text-slate-700 dark:text-slate-300">
                    2. Max Annual Tuition Budget
                  </label>
                  <span class="font-mono font-bold text-indigo-700 dark:text-teal-400 tabular-nums">
                    Up to ₹{{ quickAnnualBudget().toLocaleString('en-IN') }}/yr
                  </span>
                </div>
                <input
                  id="hero-budget-slider"
                  type="range"
                  min="20000"
                  max="600000"
                  step="10000"
                  [value]="quickAnnualBudget()"
                  (input)="onQuickBudgetInput($event)"
                  class="w-full accent-indigo-700 cursor-pointer"
                />
                <div class="flex justify-between font-mono text-[10px] text-slate-500 tabular-nums">
                  <span>₹20k/yr (Govt)</span>
                  <span>₹2.5L/yr</span>
                  <span>₹6L/yr</span>
                </div>
              </div>

              <button
                type="button"
                (click)="launchQuickMatcher()"
                class="w-full inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-800 transition-colors cursor-pointer"
              >
                <span>Open Full College Explorer ({{ heroMatchingCount() }} Matches)</span>
                <mat-icon class="!w-4 !h-4 !text-[16px]">arrow_forward</mat-icon>
              </button>
            </div>

            <!-- Right Instant Preview Cards (7 cols) -->
            <div class="lg:col-span-7 space-y-4">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Top Matching Colleges ({{ heroMatchingCount() }} found)
                </h3>
                <a routerLink="/start" class="text-xs font-semibold text-indigo-700 hover:underline dark:text-indigo-400">
                  Advanced Filters & Sort →
                </a>
              </div>

              <div class="grid gap-3 sm:grid-cols-2">
                @for (college of topMatchingCollegesPreview(); track college.id) {
                  <article class="rounded-xl border border-slate-200 p-4 space-y-2.5 bg-white dark:border-slate-800 dark:bg-slate-900">
                    <div class="flex items-start justify-between gap-2">
                      <div class="min-w-0">
                        <div class="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {{ college.ownership }} · {{ college.cityInfo.city }}
                        </div>
                        <a
                          [routerLink]="['/college', college.id]"
                          class="text-xs sm:text-sm font-bold text-slate-900 hover:text-indigo-700 dark:text-white dark:hover:text-indigo-400 hover:underline block truncate"
                        >
                          {{ college.name }}
                        </a>
                      </div>
                      <span class="font-mono text-xs font-bold text-indigo-700 dark:text-indigo-400 tabular-nums shrink-0">
                        {{ college.rankingMetrics?.overallFairScore ?? '—' }}/100
                      </span>
                    </div>

                    <div class="flex items-center justify-between text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                      <span>Tuition: ₹{{ college.fees.tuitionPerYearInr.value !== null ? (college.fees.tuitionPerYearInr.value / 1000).toFixed(0) + 'k/yr' : '—' }}</span>
                      <span class="text-teal-700 dark:text-teal-400 font-semibold">
                        Median: ₹{{ college.placements.medianSalaryInr.value !== null ? (college.placements.medianSalaryInr.value / 100000).toFixed(1) + 'L' : '—' }}
                      </span>
                    </div>
                  </article>
                }
              </div>
            </div>
          </div>
        </section>
      }

      <!-- VIEW 3: DEDICATED LIVE EXAM COUNTDOWN WORKSPACE -->
      @if (workspaceView() === 'countdown') {
        <app-exam-countdown-ticker />
      }

      <!-- VIEW 4: CLEAN CATEGORIZED PLATFORM TOOLS DIRECTORY -->
      @if (workspaceView() === 'directory') {
        <section aria-labelledby="all-features-heading" class="rounded-2xl border border-slate-200/90 bg-white/95 p-6 sm:p-8 shadow-2xs dark:border-slate-800 dark:bg-slate-900/95 space-y-6">
          <div class="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200/80 pb-5 dark:border-slate-800">
            <div>
              <h2 id="all-features-heading" class="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                Platform Feature Directory (38 Source-Verified Tools)
              </h2>
              <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Select a category below to browse focused tools without visual clutter.
              </p>
            </div>

            <!-- Category Tabs (Defaults to Category 1 so only 1 group shows at a time unless 'All' is clicked) -->
            <div
              role="group"
              aria-label="Filter platform tools by category"
              class="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800 text-xs"
            >
              @for (group of featureGroups; track group.id) {
                <button
                  type="button"
                  (click)="activeFeatureGroup.set(group.id)"
                  [class]="'rounded-lg px-3 py-1.5 font-semibold transition-colors cursor-pointer ' + (activeFeatureGroup() === group.id ? 'bg-indigo-700 text-white shadow-2xs dark:bg-indigo-600' : 'text-slate-700 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-700')"
                >
                  {{ group.shortTabLabel }}
                </button>
              }
              <button
                type="button"
                (click)="activeFeatureGroup.set('ALL')"
                [class]="'rounded-lg px-3 py-1.5 font-semibold transition-colors cursor-pointer ' + (activeFeatureGroup() === 'ALL' ? 'bg-indigo-700 text-white shadow-2xs dark:bg-indigo-600' : 'text-slate-700 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-700')"
              >
                View All (38)
              </button>
            </div>
          </div>

          <div class="space-y-8">
            @for (group of visibleFeatureGroups(); track group.id) {
              <div class="space-y-4">
                <div>
                  <h3 class="text-base font-bold text-slate-900 dark:text-slate-100">
                    {{ group.categoryTitle }}
                  </h3>
                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    {{ group.subtitle }}
                  </p>
                </div>

                <div class="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                  @for (feat of group.items; track feat.num) {
                    <a
                      [routerLink]="feat.route"
                      class="group flex items-start gap-3.5 rounded-xl border border-slate-200/90 bg-white p-4 hover:border-indigo-500 hover:shadow-2xs transition-all duration-150 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500"
                    >
                      <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-indigo-700 group-hover:bg-indigo-50 dark:bg-slate-800 dark:text-indigo-300">
                        <mat-icon class="!w-5 !h-5 !text-[20px]">{{ feat.icon }}</mat-icon>
                      </div>
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-1.5">
                          <span class="font-mono text-[11px] font-semibold text-slate-400 tabular-nums">#{{ feat.num }}</span>
                          <span class="text-sm font-semibold text-slate-900 group-hover:text-indigo-700 dark:text-slate-100 dark:group-hover:text-indigo-400 truncate">
                            {{ feat.title }}
                          </span>
                        </div>
                        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                          {{ feat.desc }}
                        </p>
                      </div>
                    </a>
                  }
                </div>
              </div>
            }
          </div>
        </section>
      }

      <app-how-we-calculate-modal
        [isOpen]="showFormulaModal()"
        (closed)="showFormulaModal.set(false)"
      />
    </div>
  `,
})
export class HomePage {
  readonly api = inject(ApiService);
  readonly i18n = inject(I18nService);
  readonly profileStore = inject(ProfileStorageService);
  private readonly router = inject(Router);

  readonly appName = APP_NAME;
  readonly showFormulaModal = signal<boolean>(false);
  readonly workspaceView = signal<HomeWorkspaceView>('dashboard');

  readonly quickRoute = signal<'ALL' | AdmissionRouteType>('ALL');
  readonly quickAnnualBudget = signal<number>(
    this.profileStore.profile().annualBudgetInr || 300000
  );
  readonly activeFeatureGroup = signal<string>('group-a');

  readonly matchingColleges = computed<College[]>(() => {
    const rt = this.quickRoute();
    const maxB = this.quickAnnualBudget();
    return this.api.colleges().filter((c) => {
      if (rt !== 'ALL' && !c.admissionRoutes.some((r) => r.routeType === rt)) {
        return false;
      }
      const tuition = c.fees.tuitionPerYearInr.value;
      if (tuition !== null && tuition > maxB) {
        return false;
      }
      return true;
    });
  });

  readonly heroMatchingCount = computed(() => this.matchingColleges().length);

  readonly topMatchingCollegesPreview = computed(() =>
    this.matchingColleges().slice(0, 6)
  );

  readonly trustStats = computed(() => {
    const list = this.api.colleges();
    const govtCount = list.filter((c) => c.ownership === 'Government').length;
    const privateCount = list.length - govtCount;
    return {
      collegesCount: list.length,
      govtCount,
      privateCount,
      examsCount: this.api.exams().length,
      scholarshipsCount: this.api.scholarships().length,
    };
  });

  readonly featureGroups: FeatureGroup[] = [
    {
      id: 'group-a',
      shortTabLabel: '01. Admissions & Exams',
      categoryTitle: '01. Admission Flow & Applications (Features 1–11)',
      subtitle: 'Step-by-step checklists, exams, AI counselling, camera document scanner, and application tracking.',
      items: [
        {num: 1, title: 'Admission Help Hub', desc: 'Interactive checklist from before exams to joining college.', route: '/help', icon: 'checklist'},
        {num: 2, title: 'Exams Explorer', desc: '15 major exams with eligibility check and .ics calendar export.', route: '/exams', icon: 'quiz'},
        {num: 3, title: 'Free AI Counsellor', desc: 'Chat grounded strictly in cached verified data with sources.', route: '/counsellor', icon: 'forum'},
        {num: 4, title: 'Partner vs Info-Only Colleges', desc: 'Clear badge separation; membership never affects ranking.', route: '/start', icon: 'handshake'},
        {num: 5, title: 'Admission Route Categories', desc: 'Filter by Direct, College Process, or All-India Exam.', route: '/start', icon: 'alt_route'},
        {num: 6, title: 'Route & Budget Matcher', desc: '3-step guided matcher for your annual or 4-year budget.', route: '/start', icon: 'tune'},
        {num: 7, title: 'Common Application', desc: 'Reuse one profile across partner colleges; ₹99 only after admission.', route: '/apply', icon: 'send'},
        {num: 8, title: 'Application Tracker', desc: 'Track per-application stages, timeline, and admission status.', route: '/tracker', icon: 'track_changes'},
        {num: 9, title: 'Camera Scanner & Resizer', desc: 'Scan & crop marksheets via camera and resize exam photos in-browser.', route: '/documents', icon: 'document_scanner'},
        {num: 10, title: 'Deadline Calendar & Reminders', desc: 'Month/list calendar, .ics export, and prototype reminders.', route: '/calendar', icon: 'calendar_month'},
        {num: 11, title: 'Vacant Seat Alerts', desc: 'Subscribe for CSAB, State Spot, and sliding round seat alerts.', route: '/calendar', icon: 'notifications_active'},
      ],
    },
    {
      id: 'group-b',
      shortTabLabel: '02. Colleges & Reviews',
      categoryTitle: '02. Deep College Information & Reality Checks (Features 12–19)',
      subtitle: '9-tab college profiles, NIRF median vs highest placement reality check, review authenticity, and comparison.',
      items: [
        {num: 12, title: '9-Tab College Profiles', desc: 'Overview, Fees, Admission, Scholarships, Placements, Reviews, ROI, Trust, City.', route: '/college/iit-madras', icon: 'account_balance'},
        {num: 13, title: 'Category Review Summaries', desc: 'Summaries across placement, hostel, faculty, campus, and fees.', route: '/college/vit-vellore', icon: 'rate_review'},
        {num: 14, title: 'Authentic Review Filter', desc: 'Deterministic 0–100 authenticity score and why-flagged reasons.', route: '/college/vit-vellore', icon: 'fact_check'},
        {num: 15, title: 'Unbiased Ranking Analysis', desc: 'Precomputed affordability, placement, value, and trust scores.', route: '/start', icon: 'leaderboard'},
        {num: 16, title: 'Side-by-Side College Compare', desc: 'Compare up to 4 colleges with best-value highlight and shareable link.', route: '/compare', icon: 'compare_arrows'},
        {num: 17, title: 'Placement Reality Check', desc: 'Median vs highest package chart and headline inflation warnings.', route: '/college/vit-vellore', icon: 'bar_chart'},
        {num: 18, title: 'Brochure vs Reality Verifier', desc: 'Paste marketing claims to verify against cached NIRF/AICTE data.', route: '/claims', icon: 'rule'},
        {num: 19, title: 'City & Hostel Cost Guide', desc: 'Monthly living costs, hostel fee ranges, transport, and safety notes.', route: '/college/nit-trichy', icon: 'apartment'},
      ],
    },
    {
      id: 'group-c',
      shortTabLabel: '03. Fraud & Safety',
      categoryTitle: '03. Trust, Fraud Detection & Safety (Features 20–23)',
      subtitle: 'Protect students and parents from fake institutes, predatory agents, and hidden non-refundable charges.',
      items: [
        {num: 20, title: 'Fake College & Agent Checker', desc: 'Check approvals, rule-based red flags, and risk meter (Low/Med/High).', route: '/verify', icon: 'gpp_maybe'},
        {num: 21, title: 'Anonymised Fraud Reporting', desc: 'Report scam pitches safely; only aggregate reviewed counts shown.', route: '/verify', icon: 'report'},
        {num: 22, title: 'Counsellor Pitch Analyzer', desc: 'Detect urgency tactics in call notes and get questions to ask back.', route: '/pitch', icon: 'psychology_alt'},
        {num: 23, title: 'Hidden Fee & Refund Detector', desc: 'Extract charges from fee brochures and flag missing refund rules.', route: '/fees', icon: 'receipt_long'},
      ],
    },
    {
      id: 'group-d',
      shortTabLabel: '04. Money & ROI',
      categoryTitle: '04. Money, Scholarships & ROI (Features 24–27)',
      subtitle: 'Calculate true 4-year expenditure, find tuition waivers, plan education loans, and measure payback period.',
      items: [
        {num: 24, title: 'True 4-Year Cost Calculator', desc: 'Tuition, hostel, mess, books, travel, and annual fee inflation chart.', route: '/money', icon: 'calculate'},
        {num: 25, title: 'Scholarship Finder & AI Guide', desc: 'Match govt/AICTE schemes by income, marks, category, and state.', route: '/money', icon: 'workspace_premium'},
        {num: 26, title: 'Education Loan & EMI Guide', desc: 'Monthly EMI calculator, document checklist, and official portals.', route: '/money', icon: 'account_balance_wallet'},
        {num: 27, title: 'ROI Score & Payback Period', desc: '4-year total cost divided by verified median starting salary.', route: '/money', icon: 'trending_up'},
      ],
    },
    {
      id: 'group-e',
      shortTabLabel: '05. Decision & Family',
      categoryTitle: '05. Decision Support & Family Alignment (Features 28–32)',
      subtitle: 'Classify Safe/Target/Ambitious colleges, discover suitable branches, and align student-parent priorities.',
      items: [
        {num: 28, title: 'Rank-Based Eligibility Checker', desc: 'Enter JEE/CET/BITSAT rank or percentile for Safe/Target/Ambitious list.', route: '/decision', icon: 'military_tech'},
        {num: 29, title: 'Branch Guidance Quiz', desc: '8-question engineering interest quiz with skills and career paths.', route: '/decision', icon: 'extension'},
        {num: 30, title: 'Backup Plan Engine', desc: 'Build Dream, Target, and Safe lists with if-this-fails-then-that steps.', route: '/plan', icon: 'safety_check'},
        {num: 31, title: 'Family Decision Room', desc: 'Compare student and parent priority weights and resolve trade-offs.', route: '/family', icon: 'diversity_3'},
        {num: 32, title: 'Parent Mode & Print View', desc: 'Simplified large-text view with plain-language summary and print layout.', route: '/family', icon: 'family_restroom'},
      ],
    },
    {
      id: 'group-f',
      shortTabLabel: '06. Community & More',
      categoryTitle: '06. Campus Life, Multilingual Voice & Partner Transparency (Features 33–38)',
      subtitle: 'Connect with demo seniors, prepare for campus life, use voice/WhatsApp modes, and audit our ₹99 post-admission model.',
      items: [
        {num: 33, title: 'Talk to a Senior (Demo)', desc: 'Browse verified-topic demo senior profiles with strict privacy rules.', route: '/community', icon: 'school'},
        {num: 34, title: 'First 30 Days Campus Guide', desc: 'Checklist for documents, hostel, bank account, and anti-ragging.', route: '/community', icon: 'luggage'},
        {num: 35, title: 'Roommate & City-Mates Matcher', desc: 'Privacy-safe compatibility matching against demo student profiles.', route: '/community', icon: 'group_add'},
        {num: 36, title: 'English, Hindi & Punjabi + Voice', desc: 'Full UI translation, Gemini output translation, and Web Speech voice.', route: '/counsellor', icon: 'record_voice_over'},
        {num: 37, title: 'WhatsApp Bot Mode (Simulation)', desc: 'Low-bandwidth WhatsApp-style counsellor chat and wa.me share links.', route: '/whatsapp', icon: 'chat'},
        {num: 38, title: 'How We Earn & Partner Portal', desc: 'Transparent revenue breakdown, partner dashboard, and mock ₹99 flow.', route: '/partner', icon: 'policy'},
      ],
    },
  ];

  readonly visibleFeatureGroups = computed(() => {
    const selected = this.activeFeatureGroup();
    if (selected === 'ALL') return this.featureGroups;
    return this.featureGroups.filter((g) => g.id === selected);
  });

  onQuickRouteChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value as
      | 'ALL'
      | AdmissionRouteType;
    this.quickRoute.set(val);
    if (val !== 'ALL') {
      this.profileStore.updateProfile({preferredRoute: val});
    }
  }

  onQuickBudgetInput(event: Event): void {
    const val = Number((event.target as HTMLInputElement).value);
    if (!Number.isNaN(val) && val > 0) {
      this.quickAnnualBudget.set(val);
      this.profileStore.updateProfile({annualBudgetInr: val});
    }
  }

  launchQuickMatcher(): void {
    void this.router.navigate(['/start']);
  }
}
