import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import {RouterLink} from '@angular/router';
import {MatIconModule} from '@angular/material/icon';
import {APP_NAME} from '../../shared/constants';
import {ApiService} from '../services/api.service';
import {I18nService} from '../services/i18n.service';
import {HowWeCalculateModal} from '../components/ui';

interface FeatureGroup {
  id: string;
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

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-home-page',
  imports: [RouterLink, MatIconModule, HowWeCalculateModal],
  template: `
    <div class="space-y-12 pb-12">
      <!-- Hero Section -->
      <section class="rounded-2xl border border-slate-200 bg-white p-6 sm:p-10 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div class="max-w-3xl space-y-5">
          <div class="text-xs font-semibold tracking-wide text-teal-700 dark:text-teal-400">
            {{ i18n.t('hero.kicker') }} · {{ i18n.t('banner.lastUpdated') }}: <span class="font-mono tabular-nums">{{ api.meta().lastRefreshed }}</span>
          </div>

          <h1 class="text-2xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50 leading-tight" style="text-wrap: balance;">
            {{ i18n.t('hero.title') }}
          </h1>

          <p class="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
            {{ i18n.t('hero.subtitle') }}
          </p>

          <!-- Three Main Actions -->
          <div class="pt-2 flex flex-wrap items-center gap-3">
            <a
              routerLink="/start"
              class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800 transition-colors duration-150 whitespace-nowrap shrink-0"
            >
              <mat-icon class="!w-5 !h-5 !text-[20px]">explore</mat-icon>
              <span>{{ i18n.t('hero.ctaFind') }}</span>
            </a>

            <a
              routerLink="/verify"
              class="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-teal-700 bg-teal-50/70 px-4 py-2.5 text-sm font-semibold text-teal-900 hover:bg-teal-100 dark:border-teal-500 dark:bg-teal-950/60 dark:text-teal-200 transition-colors duration-150 whitespace-nowrap shrink-0"
            >
              <mat-icon class="!w-5 !h-5 !text-[20px]">verified_user</mat-icon>
              <span>{{ i18n.t('hero.ctaVerify') }}</span>
            </a>

            <a
              routerLink="/exams"
              class="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 transition-colors duration-150 whitespace-nowrap shrink-0"
            >
              <mat-icon class="!w-5 !h-5 !text-[20px]">event_note</mat-icon>
              <span>{{ i18n.t('hero.ctaExams') }}</span>
            </a>
          </div>
        </div>

        <!-- Trust Statistics Computed from Dataset -->
        <div class="mt-8 grid grid-cols-2 gap-4 border-t border-slate-200 pt-6 sm:grid-cols-4 dark:border-slate-800">
          <div>
            <div class="font-mono text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {{ trustStats().collegesCount }}
            </div>
            <div class="text-xs text-slate-600 dark:text-slate-400">
              Engineering Colleges Tracked ({{ trustStats().govtCount }} Govt · {{ trustStats().privateCount }} Private/PPP)
            </div>
          </div>
          <div>
            <div class="font-mono text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {{ trustStats().examsCount }}
            </div>
            <div class="text-xs text-slate-600 dark:text-slate-400">
              National, State & Institute Entrance Exams
            </div>
          </div>
          <div>
            <div class="font-mono text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {{ trustStats().scholarshipsCount }}
            </div>
            <div class="text-xs text-slate-600 dark:text-slate-400">
              Verified Govt & AICTE Fee Waiver Schemes
            </div>
          </div>
          <div>
            <div class="font-mono text-2xl font-bold text-teal-700 dark:text-teal-400 tabular-nums">
              ₹0 Upfront
            </div>
            <div class="text-xs text-slate-600 dark:text-slate-400">
              Rankings 100% Unbiased · Flat ₹99 Only After Admission
            </div>
          </div>
        </div>
      </section>

      <!-- How It Works in 3 Steps -->
      <section aria-labelledby="how-it-works-heading" class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 id="how-it-works-heading" class="text-xl font-bold text-slate-900 dark:text-slate-100">
            {{ i18n.t('home.howItWorksTitle') }}
          </h2>
          <button
            type="button"
            (click)="showFormulaModal.set(true)"
            class="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-indigo-400 cursor-pointer"
          >
            <mat-icon class="!w-4 !h-4 !text-[16px]">calculate</mat-icon>
            <span>{{ i18n.t('action.howWeCalculate') }}</span>
          </button>
        </div>

        <div class="grid gap-4 md:grid-cols-3">
          <div class="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">
              {{ i18n.t('home.step1Title') }}
            </h3>
            <p class="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {{ i18n.t('home.step1Desc') }}
            </p>
          </div>

          <div class="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">
              {{ i18n.t('home.step2Title') }}
            </h3>
            <p class="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {{ i18n.t('home.step2Desc') }}
            </p>
          </div>

          <div class="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">
              {{ i18n.t('home.step3Title') }}
            </h3>
            <p class="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {{ i18n.t('home.step3Desc') }}
            </p>
          </div>
        </div>
      </section>

      <!-- All 38 Platform Features Grouped by Category -->
      <section aria-labelledby="all-features-heading" class="space-y-6">
        <div>
          <h2 id="all-features-heading" class="text-xl font-bold text-slate-900 dark:text-slate-100">
            Complete Admission Guidance Suite (All 38 Tools & Features)
          </h2>
          <p class="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Every feature below is free to explore, works on mobile and desktop, and cites official sources.
          </p>
        </div>

        <div class="space-y-8">
          @for (group of featureGroups; track group.id) {
            <div class="space-y-3">
              <div class="border-b border-slate-200 pb-2 dark:border-slate-800">
                <h3 class="text-base font-bold text-slate-900 dark:text-slate-100">
                  {{ group.categoryTitle }}
                </h3>
                <p class="text-xs text-slate-500 dark:text-slate-400">
                  {{ group.subtitle }}
                </p>
              </div>

              <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                @for (feat of group.items; track feat.num) {
                  <a
                    [routerLink]="feat.route"
                    class="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:border-indigo-500 hover:shadow-xs transition-all duration-150 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500"
                  >
                    <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                      <mat-icon class="!w-5 !h-5 !text-[20px]">{{ feat.icon }}</mat-icon>
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-1.5">
                        <span class="font-mono text-[11px] font-semibold text-slate-400 tabular-nums">#{{ feat.num }}</span>
                        <span class="text-sm font-semibold text-slate-900 group-hover:text-indigo-700 dark:text-slate-100 dark:group-hover:text-indigo-400 truncate">
                          {{ feat.title }}
                        </span>
                      </div>
                      <p class="mt-1 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
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
  readonly appName = APP_NAME;
  readonly showFormulaModal = signal<boolean>(false);

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
      categoryTitle: 'A. Admission Flow & Applications (Features 1–11)',
      subtitle: 'Step-by-step checklists, exams, AI counselling, document compression, and application tracking.',
      items: [
        {num: 1, title: 'Admission Help Hub', desc: 'Interactive checklist from before exams to joining college.', route: '/help', icon: 'checklist'},
        {num: 2, title: 'Exams Explorer', desc: '15 major exams with eligibility check and .ics calendar export.', route: '/exams', icon: 'quiz'},
        {num: 3, title: 'Free AI Counsellor', desc: 'Chat grounded strictly in cached verified data with sources.', route: '/counsellor', icon: 'forum'},
        {num: 4, title: 'Partner vs Info-Only Colleges', desc: 'Clear badge separation; membership never affects ranking.', route: '/start', icon: 'handshake'},
        {num: 5, title: 'Admission Route Categories', desc: 'Filter by Direct, College Process, or All-India Exam.', route: '/start', icon: 'alt_route'},
        {num: 6, title: 'Route & Budget Matcher', desc: '3-step guided matcher for your annual or 4-year budget.', route: '/start', icon: 'tune'},
        {num: 7, title: 'Common Application', desc: 'Reuse one profile across partner colleges; ₹99 only after admission.', route: '/apply', icon: 'send'},
        {num: 8, title: 'Application Tracker', desc: 'Track per-application stages, timeline, and admission status.', route: '/tracker', icon: 'track_changes'},
        {num: 9, title: 'Document Checker & Resizer', desc: 'Resize photo & signature in-browser with exam presets.', route: '/documents', icon: 'photo_size_select_large'},
        {num: 10, title: 'Deadline Calendar & Reminders', desc: 'Month/list calendar, .ics export, and prototype reminders.', route: '/calendar', icon: 'calendar_month'},
        {num: 11, title: 'Vacant Seat Alerts', desc: 'Subscribe for CSAB, State Spot, and sliding round seat alerts.', route: '/calendar', icon: 'notifications_active'},
      ],
    },
    {
      id: 'group-b',
      categoryTitle: 'B. Deep College Information & Reality Checks (Features 12–19)',
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
      categoryTitle: 'C. Trust, Fraud Detection & Safety (Features 20–23)',
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
      categoryTitle: 'D. Money, Scholarships & ROI (Features 24–27)',
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
      categoryTitle: 'E. Decision Support & Family Alignment (Features 28–32)',
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
      categoryTitle: 'F. People & After Admission (Features 33–35)',
      subtitle: 'Connect safely with demo seniors, prepare for your first 30 days on campus, and find city-mates.',
      items: [
        {num: 33, title: 'Talk to a Senior (Demo)', desc: 'Browse verified-topic demo senior profiles with strict privacy rules.', route: '/community', icon: 'school'},
        {num: 34, title: 'First 30 Days Campus Guide', desc: 'Checklist for documents, hostel, bank account, and anti-ragging.', route: '/community', icon: 'luggage'},
        {num: 35, title: 'Roommate & City-Mates Matcher', desc: 'Privacy-safe compatibility matching against demo student profiles.', route: '/community', icon: 'group_add'},
      ],
    },
    {
      id: 'group-g',
      categoryTitle: 'G. Multilingual Access, Voice & WhatsApp (Features 36–37)',
      subtitle: 'Built for first-generation applicants in English, Hindi, and Punjabi with voice input and read-aloud.',
      items: [
        {num: 36, title: 'English, Hindi & Punjabi + Voice', desc: 'Full UI translation, Gemini output translation, and Web Speech voice.', route: '/counsellor', icon: 'record_voice_over'},
        {num: 37, title: 'WhatsApp Bot Mode (Simulation)', desc: 'Low-bandwidth WhatsApp-style counsellor chat and wa.me share links.', route: '/whatsapp', icon: 'chat'},
      ],
    },
    {
      id: 'group-h',
      categoryTitle: 'H. Business Model & Partner Transparency (Feature 38)',
      subtitle: 'Why our rankings are 100% immune to paid placement and how our post-admission ₹99 model works.',
      items: [
        {num: 38, title: 'How We Earn & Partner Portal', desc: 'Transparent revenue breakdown, partner dashboard, and mock ₹99 flow.', route: '/partner', icon: 'policy'},
      ],
    },
  ];
}
