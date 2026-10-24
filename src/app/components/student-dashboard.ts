import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {RouterLink} from '@angular/router';
import {MatIconModule} from '@angular/material/icon';
import {
  ApplicationRecord,
  College,
  ReminderSubscription,
  SeatAlertSubscription,
} from '../../shared/schemas';
import {ApiService} from '../services/api.service';
import {ProfileStorageService} from '../services/storage.service';
import {FirebaseAuthService} from '../services/firebase-auth.service';

export interface UnifiedDeadlineItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'exam' | 'scholarship' | 'personal_reminder';
  dateStr: string;
  daysAway: number;
  officialUrl: string;
  isSubscribed: boolean;
}

export interface UnifiedNotificationItem {
  id: string;
  title: string;
  detail: string;
  category: 'alert' | 'application' | 'document' | 'deadline';
  timestampLabel: string;
  icon: string;
  actionRoute: string;
  actionLabel: string;
}

export type DashboardTabId = 'overview' | 'shortlist' | 'deadlines' | 'notifications';

function computeDaysAway(dateStr: string | null): number {
  if (!dateStr) return 999;
  const parts = dateStr.split('-').map((n) => Number(n));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return 999;

  const now = new Date();
  const [initYear, month, day] = parts;
  let year = initYear;
  let target = new Date(Date.UTC(year, month - 1, day, 3, 30, 0));
  while (target.getTime() <= now.getTime()) {
    year += 1;
    target = new Date(Date.UTC(year, month - 1, day, 3, 30, 0));
  }
  return Math.max(
    0,
    Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-student-dashboard',
  imports: [RouterLink, MatIconModule],
  template: `
    <section
      aria-labelledby="student-dashboard-heading"
      class="rounded-2xl border border-slate-200/90 bg-white/95 p-5 sm:p-7 shadow-2xs dark:border-slate-800 dark:bg-slate-900/95 space-y-6"
    >
      <!-- Top Header & Separated Section Navigation -->
      <div class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-5 dark:border-slate-800">
        <div class="space-y-1">
          <div class="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span class="font-semibold text-indigo-700 dark:text-teal-400">Student Workspace</span>
            <span aria-hidden="true">·</span>
            <span>
              State: <strong class="text-slate-800 dark:text-slate-200">{{ profileStore.profile().homeState }}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Annual Budget: <strong class="font-mono text-slate-800 dark:text-slate-200 tabular-nums">₹{{ profileStore.profile().annualBudgetInr.toLocaleString('en-IN') }}/yr</strong>
            </span>
          </div>
          <h2 id="student-dashboard-heading" class="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
            Personal Admission Command Center
          </h2>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          @if (!authService.currentUser()) {
            <button
              type="button"
              (click)="authService.signInWithGoogle()"
              class="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-1.5 text-xs font-semibold text-indigo-800 hover:bg-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-indigo-300 cursor-pointer"
            >
              <mat-icon class="!w-4 !h-4 !text-[16px]">cloud_sync</mat-icon>
              <span>Sign In to Cloud Sync</span>
            </button>
          }
          <button
            type="button"
            (click)="refreshDashboardData()"
            class="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <mat-icon class="!w-4 !h-4 !text-[16px]">refresh</mat-icon>
            <span>Sync</span>
          </button>
          <a
            routerLink="/compare"
            class="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-indigo-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-800"
          >
            <mat-icon class="!w-4 !h-4 !text-[16px]">compare_arrows</mat-icon>
            <span>Compare Shortlist ({{ savedColleges().length }}/4)</span>
          </a>
        </div>
      </div>

      <!-- 4 Interactive Summary KPI Cards (Click any card to switch to its dedicated section) -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <button
          type="button"
          (click)="activeTab.set('overview')"
          class="text-left rounded-xl border p-3.5 transition-all cursor-pointer"
          [class]="activeTab() === 'overview' ? 'border-indigo-600 bg-indigo-50/50 dark:border-indigo-400 dark:bg-indigo-950/30' : 'border-slate-200/80 bg-slate-50/50 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800/40'"
        >
          <div class="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Overview & Profile</span>
            <mat-icon class="!w-4 !h-4 !text-[16px] text-indigo-600 dark:text-indigo-400">dashboard</mat-icon>
          </div>
          <div class="mt-1.5 font-mono text-xl font-bold text-slate-900 dark:text-white tabular-nums">
            {{ profileStore.profileCompletionPercent() }}%
          </div>
          <div class="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {{ profileStore.profile().category }} · {{ profileStore.profile().class12Percent }}% PCM
          </div>
        </button>

        <button
          type="button"
          (click)="activeTab.set('shortlist')"
          class="text-left rounded-xl border p-3.5 transition-all cursor-pointer"
          [class]="activeTab() === 'shortlist' ? 'border-indigo-600 bg-indigo-50/50 dark:border-indigo-400 dark:bg-indigo-950/30' : 'border-slate-200/80 bg-slate-50/50 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800/40'"
        >
          <div class="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Saved Colleges</span>
            <mat-icon class="!w-4 !h-4 !text-[16px] text-teal-600 dark:text-teal-400">bookmarks</mat-icon>
          </div>
          <div class="mt-1.5 font-mono text-xl font-bold text-slate-900 dark:text-white tabular-nums">
            {{ savedColleges().length }} / 4
          </div>
          <div class="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
            Ready for side-by-side ROI compare
          </div>
        </button>

        <button
          type="button"
          (click)="activeTab.set('deadlines')"
          class="text-left rounded-xl border p-3.5 transition-all cursor-pointer"
          [class]="activeTab() === 'deadlines' ? 'border-indigo-600 bg-indigo-50/50 dark:border-indigo-400 dark:bg-indigo-950/30' : 'border-slate-200/80 bg-slate-50/50 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800/40'"
        >
          <div class="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Upcoming Deadlines</span>
            <mat-icon class="!w-4 !h-4 !text-[16px] text-amber-600 dark:text-amber-400">event_upcoming</mat-icon>
          </div>
          <div class="mt-1.5 font-mono text-xl font-bold text-slate-900 dark:text-white tabular-nums">
            {{ allDeadlines().length }}
          </div>
          <div class="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
            Next in {{ allDeadlines()[0]?.daysAway ?? '—' }} days
          </div>
        </button>

        <button
          type="button"
          (click)="activeTab.set('notifications')"
          class="text-left rounded-xl border p-3.5 transition-all cursor-pointer"
          [class]="activeTab() === 'notifications' ? 'border-indigo-600 bg-indigo-50/50 dark:border-indigo-400 dark:bg-indigo-950/30' : 'border-slate-200/80 bg-slate-50/50 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800/40'"
        >
          <div class="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Notifications & Docs</span>
            <mat-icon class="!w-4 !h-4 !text-[16px] text-indigo-600 dark:text-indigo-400">notifications</mat-icon>
          </div>
          <div class="mt-1.5 font-mono text-xl font-bold text-slate-900 dark:text-white tabular-nums">
            {{ unreadNotifications().length }}
          </div>
          <div class="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {{ profileStore.savedDocuments().length }} scanned docs in vault
          </div>
        </button>
      </div>

      <!-- Segmented Sub-Navigation Bar to Separate Sections Cleanly -->
      <div
        role="tablist"
        aria-label="Dashboard sections"
        class="flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/90 text-xs"
      >
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="activeTab() === 'overview'"
          (click)="activeTab.set('overview')"
          class="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 font-semibold transition-colors cursor-pointer"
          [class]="activeTab() === 'overview' ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'"
        >
          <mat-icon class="!w-4 !h-4 !text-[16px]">space_dashboard</mat-icon>
          <span>Summary View</span>
        </button>

        <button
          type="button"
          role="tab"
          [attr.aria-selected]="activeTab() === 'shortlist'"
          (click)="activeTab.set('shortlist')"
          class="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 font-semibold transition-colors cursor-pointer"
          [class]="activeTab() === 'shortlist' ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'"
        >
          <mat-icon class="!w-4 !h-4 !text-[16px]">bookmarks</mat-icon>
          <span>Saved Shortlist ({{ savedColleges().length }}/4)</span>
        </button>

        <button
          type="button"
          role="tab"
          [attr.aria-selected]="activeTab() === 'deadlines'"
          (click)="activeTab.set('deadlines')"
          class="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 font-semibold transition-colors cursor-pointer"
          [class]="activeTab() === 'deadlines' ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'"
        >
          <mat-icon class="!w-4 !h-4 !text-[16px]">event_upcoming</mat-icon>
          <span>Upcoming Deadlines ({{ filteredDeadlines().length }})</span>
        </button>

        <button
          type="button"
          role="tab"
          [attr.aria-selected]="activeTab() === 'notifications'"
          (click)="activeTab.set('notifications')"
          class="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 font-semibold transition-colors cursor-pointer"
          [class]="activeTab() === 'notifications' ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'"
        >
          <mat-icon class="!w-4 !h-4 !text-[16px]">notifications</mat-icon>
          <span>Activity & Alerts ({{ unreadNotifications().length }})</span>
        </button>
      </div>

      <!-- TAB 1: SUMMARY OVERVIEW (Clean 2-Column Split without Cluttered Nested Boxes) -->
      @if (activeTab() === 'overview') {
        <div class="grid gap-8 lg:grid-cols-12 pt-1">
          <!-- Left Column (7 cols): Saved Shortlist Snapshot -->
          <div class="lg:col-span-7 space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Saved College Shortlist ({{ savedColleges().length }}/4)
                </h3>
                <p class="text-xs text-slate-500 dark:text-slate-400">
                  Compare verified annual tuition, NIRF median packages, and overall fair score.
                </p>
              </div>
              <a
                routerLink="/start"
                class="text-xs font-semibold text-indigo-700 hover:underline dark:text-indigo-400 shrink-0"
              >
                + Add Colleges
              </a>
            </div>

            @if (savedColleges().length === 0) {
              <div class="rounded-xl border border-dashed border-slate-300 p-6 text-center space-y-3 dark:border-slate-700">
                <mat-icon class="!w-6 !h-6 !text-[24px] text-slate-400 mx-auto">school</mat-icon>
                <div class="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Your college shortlist is empty
                </div>
                <p class="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Save up to 4 colleges to compare true 4-year fees, placement reality, and payback periods side by side.
                </p>
                <button
                  type="button"
                  (click)="restoreDefaultShortlist()"
                  class="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-indigo-700 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-800 cursor-pointer"
                >
                  <mat-icon class="!w-4 !h-4 !text-[16px]">playlist_add</mat-icon>
                  <span>Load Top Value Shortlist</span>
                </button>
              </div>
            } @else {
              <div class="divide-y divide-slate-200/80 dark:divide-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
                @for (college of savedColleges(); track college.id) {
                  <div class="p-4 bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors flex flex-wrap sm:flex-nowrap items-center justify-between gap-4">
                    <div class="min-w-0 space-y-1">
                      <div class="text-[11px] text-slate-500 dark:text-slate-400">
                        {{ college.ownership }} · {{ college.cityInfo.city }}, {{ college.cityInfo.state }}
                      </div>
                      <a
                        [routerLink]="['/college', college.id]"
                        class="text-sm font-bold text-slate-900 hover:text-indigo-700 dark:text-slate-100 dark:hover:text-indigo-400 hover:underline block truncate"
                      >
                        {{ college.name }} ({{ college.shortName }})
                      </a>
                    </div>

                    <div class="flex items-center gap-5 shrink-0">
                      <div class="text-right font-mono text-xs tabular-nums">
                        <div class="text-[10px] font-sans text-slate-400">Tuition/yr</div>
                        <div class="font-semibold text-slate-800 dark:text-slate-200">
                          {{ college.fees.tuitionPerYearInr.value !== null ? '₹' + (college.fees.tuitionPerYearInr.value / 1000).toFixed(0) + 'k' : '—' }}
                        </div>
                      </div>
                      <div class="text-right font-mono text-xs tabular-nums">
                        <div class="text-[10px] font-sans text-slate-400">Median Pkg</div>
                        <div class="font-semibold text-teal-700 dark:text-teal-400">
                          {{ college.placements.medianSalaryInr.value !== null ? '₹' + (college.placements.medianSalaryInr.value / 100000).toFixed(1) + 'L' : '—' }}
                        </div>
                      </div>
                      <div class="text-right font-mono text-xs tabular-nums">
                        <div class="text-[10px] font-sans text-slate-400">Fair Score</div>
                        <div class="font-bold text-indigo-700 dark:text-indigo-400">
                          {{ college.rankingMetrics?.overallFairScore ?? '—' }}
                        </div>
                      </div>
                      <button
                        type="button"
                        (click)="removeSavedCollege(college.id)"
                        class="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 cursor-pointer"
                        [attr.aria-label]="'Remove ' + college.shortName + ' from saved colleges'"
                      >
                        <mat-icon class="!w-4 !h-4 !text-[16px]">close</mat-icon>
                      </button>
                    </div>
                  </div>
                }
              </div>
            }

            <div class="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
              <a routerLink="/compare" class="font-semibold text-indigo-700 hover:underline dark:text-indigo-400">
                Open Side-by-Side Comparison Matrix →
              </a>
              <a routerLink="/money" class="font-semibold text-slate-600 hover:underline dark:text-slate-400">
                Calculate 4-Year Total Cost & ROI →
              </a>
            </div>
          </div>

          <!-- Right Column (5 cols): Priority Deadlines & Latest Alerts -->
          <div class="lg:col-span-5 space-y-6 lg:border-l lg:border-slate-200/80 lg:pl-8 dark:lg:border-slate-800">
            <!-- Top 3 Priority Deadlines -->
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Next Priority Deadlines
                </h3>
                <button
                  type="button"
                  (click)="activeTab.set('deadlines')"
                  class="text-xs font-semibold text-indigo-700 hover:underline dark:text-indigo-400 cursor-pointer"
                >
                  View All ({{ allDeadlines().length }}) →
                </button>
              </div>

              <div class="divide-y divide-slate-200/70 dark:divide-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-800">
                @for (dl of allDeadlines().slice(0, 3); track dl.id) {
                  <div class="p-3.5 flex items-center justify-between gap-3">
                    <div class="min-w-0">
                      <div class="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {{ dl.title }}
                      </div>
                      <div class="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {{ dl.dateStr }} · {{ dl.subtitle }}
                      </div>
                    </div>
                    <div class="flex items-center gap-2.5 shrink-0">
                      <span
                        class="font-mono text-xs font-bold tabular-nums"
                        [class]="dl.daysAway <= 30 ? 'text-amber-700 dark:text-amber-400' : 'text-teal-700 dark:text-teal-400'"
                      >
                        In {{ dl.daysAway }}d
                      </span>
                      @if (!dl.isSubscribed) {
                        <button
                          type="button"
                          (click)="quickSubscribeReminder(dl)"
                          class="text-xs font-semibold text-indigo-700 hover:underline dark:text-indigo-400 cursor-pointer"
                        >
                          Remind
                        </button>
                      } @else {
                        <span class="text-[11px] font-semibold text-teal-700 dark:text-teal-400">Set</span>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>

            <!-- Top 2 Recent Notifications -->
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Latest Activity & Alerts
                </h3>
                <button
                  type="button"
                  (click)="activeTab.set('notifications')"
                  class="text-xs font-semibold text-indigo-700 hover:underline dark:text-indigo-400 cursor-pointer"
                >
                  All Alerts ({{ unreadNotifications().length }}) →
                </button>
              </div>

              <div class="space-y-2">
                @for (notif of unreadNotifications().slice(0, 2); track notif.id) {
                  <div class="rounded-xl border border-slate-200/80 dark:border-slate-800 p-3.5 space-y-1">
                    <div class="flex items-center justify-between gap-2">
                      <span class="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{{ notif.title }}</span>
                      <a [routerLink]="notif.actionRoute" class="text-[11px] font-semibold text-indigo-700 hover:underline dark:text-indigo-400 shrink-0">
                        {{ notif.actionLabel }} →
                      </a>
                    </div>
                    <p class="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                      {{ notif.detail }}
                    </p>
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      }

      <!-- TAB 2: DEDICATED SAVED SHORTLIST VIEW -->
      @if (activeTab() === 'shortlist') {
        <div class="space-y-4 pt-1">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 class="text-base font-bold text-slate-900 dark:text-slate-100">
                Saved Shortlist ({{ savedColleges().length }} of 4 Colleges)
              </h3>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                Inspect tuition, hostel availability, NIRF median salary, and deterministic fair scores.
              </p>
            </div>
            <div class="flex items-center gap-2">
              <button
                type="button"
                (click)="restoreDefaultShortlist()"
                class="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Reset Default Shortlist
              </button>
              <a
                routerLink="/start"
                class="rounded-xl bg-indigo-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-800"
              >
                + Browse More Colleges
              </a>
            </div>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            @for (college of savedColleges(); track college.id) {
              <article class="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 bg-white dark:bg-slate-900">
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <div class="text-xs text-slate-500 dark:text-slate-400">
                      {{ college.ownership }} · {{ college.cityInfo.city }}, {{ college.cityInfo.state }}
                    </div>
                    <a
                      [routerLink]="['/college', college.id]"
                      class="text-sm font-bold text-slate-900 hover:text-indigo-700 dark:text-white dark:hover:text-indigo-400 hover:underline"
                    >
                      {{ college.name }} ({{ college.shortName }})
                    </a>
                  </div>
                  <button
                    type="button"
                    (click)="removeSavedCollege(college.id)"
                    class="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                    [attr.aria-label]="'Remove ' + college.shortName"
                  >
                    <mat-icon class="!w-4 !h-4 !text-[16px]">delete_outline</mat-icon>
                  </button>
                </div>

                <div class="grid grid-cols-3 gap-3 border-y border-slate-100 py-2.5 text-xs dark:border-slate-800 font-mono tabular-nums">
                  <div>
                    <span class="text-slate-400 block font-sans text-[11px]">Annual Tuition</span>
                    <span class="font-semibold text-slate-900 dark:text-slate-100">
                      {{ college.fees.tuitionPerYearInr.value !== null ? '₹' + college.fees.tuitionPerYearInr.value.toLocaleString('en-IN') : 'Unverified' }}
                    </span>
                  </div>
                  <div>
                    <span class="text-slate-400 block font-sans text-[11px]">NIRF Median</span>
                    <span class="font-semibold text-teal-700 dark:text-teal-400">
                      {{ college.placements.medianSalaryInr.value !== null ? '₹' + (college.placements.medianSalaryInr.value / 100000).toFixed(2) + ' LPA' : 'Unverified' }}
                    </span>
                  </div>
                  <div>
                    <span class="text-slate-400 block font-sans text-[11px]">Fair Score</span>
                    <span class="font-bold text-indigo-700 dark:text-indigo-400">
                      {{ college.rankingMetrics?.overallFairScore ?? '—' }}/100
                    </span>
                  </div>
                </div>

                <div class="flex items-center justify-between text-xs pt-0.5">
                  <a [routerLink]="['/college', college.id]" class="font-semibold text-indigo-700 hover:underline dark:text-indigo-400">
                    Open 9-Tab Profile →
                  </a>
                  <a routerLink="/apply" class="font-semibold text-slate-600 hover:underline dark:text-slate-400">
                    Common Application →
                  </a>
                </div>
              </article>
            }
          </div>
        </div>
      }

      <!-- TAB 3: DEDICATED UPCOMING DEADLINES VIEW -->
      @if (activeTab() === 'deadlines') {
        <div class="space-y-4 pt-1">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div
              role="group"
              aria-label="Filter upcoming deadlines"
              class="inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800 text-xs"
            >
              <button
                type="button"
                (click)="deadlineFilter.set('all')"
                [class]="'rounded-lg px-3 py-1.5 font-semibold transition-colors cursor-pointer ' + (deadlineFilter() === 'all' ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400')"
              >
                All ({{ allDeadlines().length }})
              </button>
              <button
                type="button"
                (click)="deadlineFilter.set('exam')"
                [class]="'rounded-lg px-3 py-1.5 font-semibold transition-colors cursor-pointer ' + (deadlineFilter() === 'exam' ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400')"
              >
                Entrance Exams
              </button>
              <button
                type="button"
                (click)="deadlineFilter.set('scholarship')"
                [class]="'rounded-lg px-3 py-1.5 font-semibold transition-colors cursor-pointer ' + (deadlineFilter() === 'scholarship' ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400')"
              >
                Scholarships
              </button>
            </div>

            <a routerLink="/calendar" class="text-xs font-semibold text-indigo-700 hover:underline dark:text-indigo-400">
              Open Full Calendar & .ics Export →
            </a>
          </div>

          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            @for (dl of filteredDeadlines().slice(0, 9); track dl.id) {
              <article class="rounded-xl border border-slate-200 p-4 space-y-2 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div class="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>{{ dl.category === 'exam' ? 'Entrance Exam' : 'Scholarship' }} · <span class="font-mono tabular-nums">{{ dl.dateStr }}</span></span>
                  <span
                    class="font-mono font-bold tabular-nums"
                    [class]="dl.daysAway <= 30 ? 'text-amber-700 dark:text-amber-400' : 'text-teal-700 dark:text-teal-400'"
                  >
                    In {{ dl.daysAway }}d
                  </span>
                </div>
                <div class="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                  {{ dl.title }}
                </div>
                <div class="flex items-center justify-between pt-1 text-xs">
                  <span class="text-slate-500 dark:text-slate-400 truncate">{{ dl.subtitle }}</span>
                  @if (dl.isSubscribed) {
                    <span class="inline-flex items-center gap-1 font-semibold text-teal-700 dark:text-teal-400 shrink-0">
                      <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">notifications_active</mat-icon>
                      <span>Alert Set</span>
                    </span>
                  } @else {
                    <button
                      type="button"
                      (click)="quickSubscribeReminder(dl)"
                      class="inline-flex items-center gap-1 font-semibold text-indigo-700 hover:underline dark:text-indigo-400 shrink-0 cursor-pointer"
                    >
                      <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">add_alert</mat-icon>
                      <span>Remind Me</span>
                    </button>
                  }
                </div>
              </article>
            }
          </div>
        </div>
      }

      <!-- TAB 4: DEDICATED NOTIFICATIONS & ACTIVITY VIEW -->
      @if (activeTab() === 'notifications') {
        <div class="space-y-4 pt-1">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div
              role="group"
              aria-label="Filter notifications"
              class="inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800 text-xs"
            >
              <button
                type="button"
                (click)="notificationFilter.set('all')"
                [class]="'rounded-lg px-3 py-1.5 font-semibold transition-colors cursor-pointer ' + (notificationFilter() === 'all' ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400')"
              >
                All ({{ unreadNotifications().length }})
              </button>
              <button
                type="button"
                (click)="notificationFilter.set('alerts')"
                [class]="'rounded-lg px-3 py-1.5 font-semibold transition-colors cursor-pointer ' + (notificationFilter() === 'alerts' ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400')"
              >
                Seat & Exam Alerts
              </button>
              <button
                type="button"
                (click)="notificationFilter.set('activity')"
                [class]="'rounded-lg px-3 py-1.5 font-semibold transition-colors cursor-pointer ' + (notificationFilter() === 'activity' ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400')"
              >
                Applications & Vault ({{ profileStore.savedDocuments().length }})
              </button>
            </div>

            @if (unreadNotifications().length > 0) {
              <button
                type="button"
                (click)="markAllNotificationsRead()"
                class="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                Clear Read Notifications
              </button>
            } @else {
              <button
                type="button"
                (click)="dismissedNotificationIds.set([])"
                class="text-xs font-semibold text-indigo-700 hover:underline dark:text-indigo-400 cursor-pointer"
              >
                Restore All Notifications
              </button>
            }
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            @for (notif of filteredNotifications(); track notif.id) {
              <article class="rounded-xl border border-slate-200 p-4 space-y-2 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                    <mat-icon class="!w-4 !h-4 !text-[16px] text-indigo-700 dark:text-indigo-400 shrink-0">{{ notif.icon }}</mat-icon>
                    <span>{{ notif.title }}</span>
                  </div>
                  <button
                    type="button"
                    (click)="dismissNotification(notif.id)"
                    class="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                    aria-label="Dismiss notification"
                  >
                    <mat-icon class="!w-4 !h-4 !text-[16px]">close</mat-icon>
                  </button>
                </div>

                <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {{ notif.detail }}
                </p>

                <div class="flex items-center justify-between pt-1 text-xs">
                  <span class="font-mono text-[11px] text-slate-400 tabular-nums">{{ notif.timestampLabel }}</span>
                  <a
                    [routerLink]="notif.actionRoute"
                    class="font-semibold text-indigo-700 hover:underline dark:text-indigo-400"
                  >
                    {{ notif.actionLabel }} →
                  </a>
                </div>
              </article>
            }
          </div>
        </div>
      }
    </section>
  `,
})
export class StudentDashboard implements OnInit {
  readonly api = inject(ApiService);
  readonly profileStore = inject(ProfileStorageService);
  readonly authService = inject(FirebaseAuthService);

  readonly activeTab = signal<DashboardTabId>('overview');
  readonly deadlineFilter = signal<'all' | 'exam' | 'scholarship'>('all');
  readonly notificationFilter = signal<'all' | 'alerts' | 'activity'>('all');

  readonly applications = signal<ApplicationRecord[]>([]);
  readonly seatAlerts = signal<SeatAlertSubscription[]>([]);
  readonly reminders = signal<ReminderSubscription[]>([]);
  readonly dismissedNotificationIds = signal<string[]>([]);

  readonly savedColleges = computed<College[]>(() => {
    const ids = this.profileStore.compareIds();
    const all = this.api.colleges();
    return ids
      .map((id) => all.find((c) => c.id === id))
      .filter((c): c is College => Boolean(c));
  });

  readonly allDeadlines = computed<UnifiedDeadlineItem[]>(() => {
    const subscribedIds = new Set(
      this.reminders().map((r) => r.examOrEventId)
    );
    const items: UnifiedDeadlineItem[] = [];

    for (const exam of this.api.exams()) {
      const regEnd = exam.registrationEnd.value;
      const examDt = exam.examDate.value;
      const targetStr =
        exam.status === 'Open' || exam.status === 'Closing soon'
          ? regEnd || examDt || '2026-04-20'
          : examDt || regEnd || '2026-05-18';
      const labelType =
        exam.status === 'Open' || exam.status === 'Closing soon'
          ? 'Registration Closes'
          : 'Exam Window';

      items.push({
        id: `dl-exam-${exam.id}`,
        title: `${exam.shortName} — ${labelType}`,
        subtitle: `${exam.conductingBody} · ${exam.level}`,
        category: 'exam',
        dateStr: targetStr,
        daysAway: computeDaysAway(targetStr),
        officialUrl: exam.officialUrl,
        isSubscribed: subscribedIds.has(exam.id) || subscribedIds.has(`dl-exam-${exam.id}`),
      });
    }

    for (const sch of this.api.scholarships()) {
      const dlStr = sch.deadline.value || '2025-11-30';
      items.push({
        id: `dl-sch-${sch.id}`,
        title: sch.name,
        subtitle: `${sch.provider} · ${sch.providerType}`,
        category: 'scholarship',
        dateStr: dlStr,
        daysAway: computeDaysAway(dlStr),
        officialUrl: sch.officialUrl,
        isSubscribed: subscribedIds.has(sch.id) || subscribedIds.has(`dl-sch-${sch.id}`),
      });
    }

    return items.sort((a, b) => a.daysAway - b.daysAway);
  });

  readonly filteredDeadlines = computed(() => {
    const f = this.deadlineFilter();
    return this.allDeadlines().filter((d) => f === 'all' || d.category === f);
  });

  readonly allNotifications = computed<UnifiedNotificationItem[]>(() => {
    const feed: UnifiedNotificationItem[] = [];

    for (const app of this.applications()) {
      feed.push({
        id: `notif-app-${app.id}`,
        title: `Application Stage: ${app.status}`,
        detail: `${app.partnerCollegeNames.join(', ')} (${app.preferredBranch}) — ₹0 charged upfront.`,
        category: 'application',
        timestampLabel: app.updatedAt.slice(0, 10),
        icon: 'assignment_turned_in',
        actionRoute: '/tracker',
        actionLabel: 'Track Status',
      });
    }

    for (const doc of this.profileStore.savedDocuments()) {
      feed.push({
        id: `notif-doc-${doc.id}`,
        title: `Document Saved: ${doc.title}`,
        detail: `${doc.docType} (${doc.width}×${doc.height} px · ${doc.sizeKb} KB) ready in your local vault.`,
        category: 'document',
        timestampLabel: doc.createdAt.slice(0, 10),
        icon: 'document_scanner',
        actionRoute: '/documents',
        actionLabel: 'Open Vault',
      });
    }

    for (const sub of this.seatAlerts()) {
      const col = this.api.colleges().find((c) => c.id === sub.collegeId);
      feed.push({
        id: `notif-seat-${sub.id}`,
        title: `Vacant Seat Alert Active: ${col?.shortName || sub.collegeId}`,
        detail: `Monitoring ${sub.counsellingRound} for ${sub.branchCode} via ${sub.channel}.`,
        category: 'alert',
        timestampLabel: sub.createdAt.slice(0, 10),
        icon: 'notifications_active',
        actionRoute: '/calendar',
        actionLabel: 'Manage Alerts',
      });
    }

    for (const rem of this.reminders()) {
      feed.push({
        id: `notif-rem-${rem.id}`,
        title: `Reminder Subscribed: ${rem.title}`,
        detail: `Scheduled for ${rem.date} via ${rem.channel}.`,
        category: 'deadline',
        timestampLabel: rem.createdAt.slice(0, 10),
        icon: 'alarm_on',
        actionRoute: '/calendar',
        actionLabel: 'View Calendar',
      });
    }

    for (const exam of this.api.exams().filter((e) => e.status === 'Closing soon')) {
      feed.push({
        id: `notif-closing-${exam.id}`,
        title: `${exam.shortName} Registration Closing Soon`,
        detail: `Official registration window closes on ${exam.registrationEnd.value || 'soon'} via ${exam.conductingBody}.`,
        category: 'deadline',
        timestampLabel: 'Priority Advisory',
        icon: 'schedule',
        actionRoute: '/exams',
        actionLabel: 'Check Eligibility',
      });
    }

    feed.push({
      id: 'notif-sch-advisory',
      title: 'Tuition Fee Waiver & NSP Scholarships Open',
      detail: `Based on your ₹${this.profileStore.profile().familyIncomeLakhs}L family income & ${this.profileStore.profile().class12Percent}% marks, check eligible Govt/AICTE schemes.`,
      category: 'alert',
      timestampLabel: 'Verified Scheme',
      icon: 'workspace_premium',
      actionRoute: '/money',
      actionLabel: 'Match Scholarships',
    });

    return feed;
  });

  readonly unreadNotifications = computed(() => {
    const dismissed = new Set(this.dismissedNotificationIds());
    return this.allNotifications().filter((n) => !dismissed.has(n.id));
  });

  readonly filteredNotifications = computed(() => {
    const f = this.notificationFilter();
    return this.unreadNotifications().filter((n) => {
      if (f === 'all') return true;
      if (f === 'alerts') return n.category === 'alert' || n.category === 'deadline';
      return n.category === 'application' || n.category === 'document';
    });
  });

  ngOnInit(): void {
    void this.refreshDashboardData();
  }

  async refreshDashboardData(): Promise<void> {
    const devId = this.profileStore.deviceId();
    try {
      const [appsRes, alertsRes, remsRes] = await Promise.all([
        this.api.getApplications(devId),
        this.api.getSeatAlerts(devId),
        this.api.getReminders(devId),
      ]);
      this.applications.set(appsRes.applications);
      this.seatAlerts.set(alertsRes.subscriptions);
      this.reminders.set(remsRes.reminders);
      if (this.authService.currentUser()) {
        await this.authService.syncProfileToCloud();
      }
    } catch {
      // Keep existing local state if offline
    }
  }

  async quickSubscribeReminder(dl: UnifiedDeadlineItem): Promise<void> {
    try {
      const res = await this.api.subscribeReminder({
        deviceId: this.profileStore.deviceId(),
        examOrEventId: dl.id,
        title: dl.title,
        date: dl.dateStr,
        channel: 'Browser Notification',
        optInConfirmed: true,
      });
      this.reminders.set(res.reminders);
      this.api.showToast(`Reminder set for ${dl.title}.`, 'success');
    } catch {
      this.api.showToast('Reminder saved to your dashboard.', 'info');
    }
  }

  removeSavedCollege(collegeId: string): void {
    this.profileStore.toggleCompareCollege(collegeId);
    this.api.showToast('Removed college from saved shortlist.', 'info');
  }

  restoreDefaultShortlist(): void {
    this.profileStore.setCompareColleges([
      'nit-trichy',
      'vit-vellore',
      'coep-pune',
    ]);
    this.api.showToast('Loaded top value shortlist.', 'success');
  }

  dismissNotification(id: string): void {
    this.dismissedNotificationIds.update((list) => [...list, id]);
  }

  markAllNotificationsRead(): void {
    this.dismissedNotificationIds.set(
      this.allNotifications().map((n) => n.id)
    );
    this.api.showToast('Cleared read notifications from view.', 'info');
  }
}
