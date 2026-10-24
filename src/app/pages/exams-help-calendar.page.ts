import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {Exam, ExamStatus} from '../../shared/schemas';
import {ApiService} from '../services/api.service';
import {I18nService} from '../services/i18n.service';
import {ProfileStorageService} from '../services/storage.service';
import {DataBadge, StateViews} from '../components/ui';
import {ExamCountdownTicker} from '../components/exam-countdown';

function downloadIcsFile(
  filename: string,
  title: string,
  dateStr: string,
  description: string,
  url: string
): void {
  if (typeof window === 'undefined') return;
  const cleanDate = dateStr.replace(/-/g, '') || '20260420';
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Search Kro//Engineering Admission Deadlines//EN',
    'BEGIN:VEVENT',
    `UID:${filename}-${Date.now()}@searchkro.local`,
    `DTSTAMP:${cleanDate}T090000Z`,
    `DTSTART;VALUE=DATE:${cleanDate}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description} - Official Portal: ${url}`,
    `URL:${url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([icsContent], {type: 'text/calendar;charset=utf-8'});
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', `${filename}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * FEATURE 2: Exams Explorer (/exams)
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-exams-page',
  imports: [MatIconModule, DataBadge, StateViews, ExamCountdownTicker],
  template: `
    <div class="space-y-8 pb-12">
      <div class="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
        <div>
          <span class="text-xs font-semibold text-teal-700 dark:text-teal-400">
            Feature #2 · Refresh-Weekly Exam Tracker
          </span>
          <h1 class="mt-1 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
            Engineering Entrance Exams Explorer
          </h1>
          <p class="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Track registration open/close dates, eligibility rules, official links, and download .ics calendar reminders.
          </p>
        </div>

        <div class="text-xs text-slate-500">
          {{ i18n.t('banner.lastUpdated') }}: <span class="font-mono tabular-nums">{{ api.meta().lastRefreshed }}</span> (Marked Refresh-Weekly)
        </div>
      </div>

      <!-- Live Exam Countdown Ticker -->
      <app-exam-countdown-ticker />

      <!-- "Eligible For Me" Interactive Check & Filters -->
      <section class="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 dark:border-slate-800 dark:bg-slate-900">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-sm font-bold text-slate-900 dark:text-slate-100">
              "Eligible for Me" Quick Check & Filters
            </h2>
            <p class="text-xs text-slate-600 dark:text-slate-400">
              Enter your Class 12 PCM aggregate percentage to check whether you meet each exam’s minimum board marks requirement.
            </p>
          </div>
          <label class="inline-flex items-center gap-2 text-xs font-semibold text-indigo-800 dark:text-indigo-300 cursor-pointer">
            <input
              type="checkbox"
              [checked]="onlyEligibleForMe()"
              (change)="onlyEligibleForMe.set(!onlyEligibleForMe())"
              class="rounded border-slate-300 text-indigo-700"
            />
            <span>Show only exams I am eligible for</span>
          </label>
        </div>

        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
          <div>
            <label for="student-pcm-input" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Your Class 12 / PCM Aggregate (%)
            </label>
            <input
              id="student-pcm-input"
              type="number"
              min="35"
              max="100"
              [value]="studentMarksPercent()"
              (input)="onMarksInput($event)"
              class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-sm font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 tabular-nums"
            />
          </div>

          <div>
            <label for="exam-level-filter" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Exam Level
            </label>
            <select
              id="exam-level-filter"
              [value]="selectedLevel()"
              (change)="onLevelChange($event)"
              class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="ALL">All Levels (National, State, Institute)</option>
              <option value="National">National Level</option>
              <option value="State">State CET Level</option>
              <option value="Institute">Institute Own Exam</option>
            </select>
          </div>

          <div>
            <label for="exam-status-filter" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Registration Status
            </label>
            <select
              id="exam-status-filter"
              [value]="selectedStatus()"
              (change)="onStatusChange($event)"
              class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="ALL">All Statuses</option>
              <option value="Open">Open</option>
              <option value="Closing soon">Closing soon</option>
              <option value="Upcoming">Upcoming</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          <div>
            <label for="exam-search-input" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Search Exam Name
            </label>
            <input
              id="exam-search-input"
              type="text"
              placeholder="e.g. JEE, BITSAT, MHT CET..."
              [value]="searchQuery()"
              (input)="onSearchInput($event)"
              class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
        </div>
      </section>

      <!-- Exams List -->
      @if (filteredExams().length === 0) {
        <app-state-views
          state="empty"
          title="No exams match your current filters"
          message="Try resetting the status filter or lowering the Class 12 marks threshold."
          actionLabel="Reset Exam Filters"
          (retryClicked)="resetFilters()"
        />
      } @else {
        <div class="grid gap-4 md:grid-cols-2">
          @for (exam of filteredExams(); track exam.id) {
            <article class="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col justify-between gap-4 dark:border-slate-800 dark:bg-slate-900">
              <div class="space-y-3">
                <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div class="flex items-center gap-2 text-slate-500">
                    <span class="font-semibold text-slate-800 dark:text-slate-200">{{ exam.level }} Exam</span>
                    <span>·</span>
                    <span>{{ exam.conductingBody }}</span>
                  </div>

                  <!-- Accessible Status Indicator (Icon + Text, never colour alone) -->
                  <span
                    class="inline-flex items-center gap-1 font-semibold"
                    [class.text-emerald-700]="exam.status === 'Open'"
                    [class.dark:text-emerald-400]="exam.status === 'Open'"
                    [class.text-amber-700]="exam.status === 'Closing soon' || exam.status === 'Upcoming'"
                    [class.dark:text-amber-400]="exam.status === 'Closing soon' || exam.status === 'Upcoming'"
                    [class.text-red-700]="exam.status === 'Closed'"
                    [class.dark:text-red-400]="exam.status === 'Closed'"
                  >
                    <mat-icon class="!w-4 !h-4 !text-[16px]">
                      {{ exam.status === 'Open' ? 'check_circle' : exam.status === 'Closing soon' ? 'schedule' : exam.status === 'Upcoming' ? 'upcoming' : 'cancel' }}
                    </mat-icon>
                    <span>{{ exam.status }}</span>
                  </span>
                </div>

                <div>
                  <h3 class="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {{ exam.shortName }} — {{ exam.name }} ({{ exam.year }})
                  </h3>
                  <div class="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    <app-data-badge [field]="exam.eligibility" [fallbackUrl]="exam.officialUrl" />
                  </div>
                </div>

                <!-- Eligible for me check result -->
                @let minReq = exam.minClass12Percent.value ?? 45;
                <div class="rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/70">
                  @if (studentMarksPercent() >= minReq) {
                    <span class="inline-flex items-center gap-1.5 font-semibold text-emerald-800 dark:text-emerald-300">
                      <mat-icon class="!w-4 !h-4 !text-[16px]">check_circle</mat-icon>
                      <span>Eligible for you: Your {{ studentMarksPercent() }}% meets the {{ minReq }}% minimum requirement.</span>
                    </span>
                  } @else {
                    <span class="inline-flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300">
                      <mat-icon class="!w-4 !h-4 !text-[16px]">warning_amber</mat-icon>
                      <span>Marks Alert: Requires {{ minReq }}% in Class 12 (check SC/ST/PwD relaxation on portal).</span>
                    </span>
                  }
                </div>

                <!-- Dates Grid -->
                <div class="grid grid-cols-2 gap-3 pt-1 text-xs sm:grid-cols-3">
                  <div>
                    <div class="text-slate-500">Registration Opens</div>
                    <app-data-badge [field]="exam.registrationStart" [fallbackUrl]="exam.officialUrl" />
                  </div>
                  <div>
                    <div class="text-slate-500">Registration Closes</div>
                    <app-data-badge [field]="exam.registrationEnd" [fallbackUrl]="exam.officialUrl" />
                  </div>
                  <div>
                    <div class="text-slate-500">Exam Date</div>
                    <app-data-badge [field]="exam.examDate" [fallbackUrl]="exam.officialUrl" />
                  </div>
                </div>
              </div>

              <div class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800 text-xs">
                <div>
                  Fee: <app-data-badge [field]="exam.applicationFeeGeneralInr" [formatAsInr]="true" [fallbackUrl]="exam.officialUrl" />
                </div>

                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    (click)="exportExamIcs(exam)"
                    class="inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                  >
                    <mat-icon class="!w-4 !h-4 !text-[16px]">event_available</mat-icon>
                    <span>Add to Calendar (.ics)</span>
                  </button>

                  <a
                    [href]="exam.officialUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex min-h-[40px] items-center gap-1 rounded-xl bg-indigo-700 px-3.5 py-1.5 font-semibold text-white hover:bg-indigo-800"
                  >
                    <span>Official Portal</span>
                    <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">open_in_new</mat-icon>
                  </a>
                </div>
              </div>
            </article>
          }
        </div>
      }
    </div>
  `,
})
export class ExamsPage {
  readonly api = inject(ApiService);
  readonly i18n = inject(I18nService);
  readonly profileStore = inject(ProfileStorageService);

  readonly studentMarksPercent = signal<number>(
    this.profileStore.profile().class12Percent || 84
  );
  readonly onlyEligibleForMe = signal<boolean>(false);
  readonly selectedLevel = signal<string>('ALL');
  readonly selectedStatus = signal<'ALL' | ExamStatus>('ALL');
  readonly searchQuery = signal<string>('');

  readonly filteredExams = computed(() => {
    const marks = this.studentMarksPercent();
    const onlyElig = this.onlyEligibleForMe();
    const level = this.selectedLevel();
    const status = this.selectedStatus();
    const q = this.searchQuery().toLowerCase().trim();

    return this.api.exams().filter((e) => {
      if (level !== 'ALL' && e.level !== level) return false;
      if (status !== 'ALL' && e.status !== status) return false;
      if (onlyElig) {
        const min = e.minClass12Percent.value ?? 45;
        if (marks < min) return false;
      }
      if (
        q &&
        !e.shortName.toLowerCase().includes(q) &&
        !e.name.toLowerCase().includes(q) &&
        !e.conductingBody.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  });

  onMarksInput(event: Event): void {
    const val = Number((event.target as HTMLInputElement).value);
    if (!Number.isNaN(val)) {
      this.studentMarksPercent.set(val);
      this.profileStore.updateProfile({class12Percent: val});
    }
  }

  onLevelChange(event: Event): void {
    this.selectedLevel.set((event.target as HTMLSelectElement).value);
  }

  onStatusChange(event: Event): void {
    this.selectedStatus.set(
      (event.target as HTMLSelectElement).value as 'ALL' | ExamStatus
    );
  }

  onSearchInput(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  resetFilters(): void {
    this.onlyEligibleForMe.set(false);
    this.selectedLevel.set('ALL');
    this.selectedStatus.set('ALL');
    this.searchQuery.set('');
  }

  exportExamIcs(exam: Exam): void {
    const date =
      exam.registrationEnd.value || exam.examDate.value || '2026-04-15';
    downloadIcsFile(
      exam.id,
      `${exam.shortName} Registration / Exam Reminder`,
      date,
      `Exam Date: ${exam.examDate.value ?? 'TBD'} | Reg Close: ${exam.registrationEnd.value ?? 'TBD'}`,
      exam.officialUrl
    );
    this.api.showToast(`Downloaded .ics calendar file for ${exam.shortName}`, 'success');
  }
}

/**
 * FEATURE 1: Admission Help Hub (/help)
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-help-hub-page',
  imports: [MatIconModule],
  template: `
    <div class="space-y-8 pb-12">
      <div class="border-b border-slate-200 pb-5 dark:border-slate-800">
        <span class="text-xs font-semibold text-teal-700 dark:text-teal-400">
          Feature #1 · Step-by-Step Student & Parent Journey
        </span>
        <h1 class="mt-1 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
          Admission Help Hub & Master Checklist
        </h1>
        <p class="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          The entire B.Tech admission roadmap from before entrance exams to physical reporting—what to do, when, and common mistakes to avoid.
        </p>
      </div>

      <!-- Progress Bar -->
      <div class="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div class="flex items-center justify-between text-xs font-semibold mb-2">
          <span>Your Admission Readiness Progress</span>
          <span class="font-mono tabular-nums">{{ completedCount() }} / {{ steps.length }} steps completed</span>
        </div>
        <div class="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            class="h-full rounded-full bg-teal-600 transition-all duration-200"
            [style.width.%]="(completedCount() / steps.length) * 100"
          ></div>
        </div>
      </div>

      <div class="space-y-4">
        @for (step of steps; track step.id) {
          @let isDone = profileStore.completedChecklistIds().includes(step.id);
          <article
            class="rounded-2xl border p-5 transition-colors"
            [class.border-teal-500]="isDone"
            [class.bg-teal-50/20]="isDone"
            [class.dark:border-teal-700]="isDone"
            [class.border-slate-200]="!isDone"
            [class.bg-white]="!isDone"
            [class.dark:border-slate-800]="!isDone"
            [class.dark:bg-slate-900]="!isDone"
          >
            <div class="flex items-start gap-4">
              <button
                type="button"
                (click)="profileStore.toggleChecklistItem(step.id)"
                class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors cursor-pointer"
                [class.border-teal-600]="isDone"
                [class.bg-teal-600]="isDone"
                [class.text-white]="isDone"
                [class.border-slate-300]="!isDone"
                [attr.aria-label]="'Mark ' + step.title + ' as complete'"
              >
                @if (isDone) {
                  <mat-icon class="!w-4 !h-4 !text-[16px]">check</mat-icon>
                }
              </button>

              <div class="flex-1 space-y-3">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span class="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                      Stage {{ step.stage }}
                    </span>
                    <h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                      {{ step.title }}
                    </h2>
                  </div>
                  <span class="font-mono text-xs font-semibold text-slate-500">
                    Timeline: {{ step.when }}
                  </span>
                </div>

                <div class="grid gap-4 md:grid-cols-2 text-xs">
                  <div class="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/60">
                    <div class="font-bold text-slate-900 dark:text-slate-100 mb-1.5">
                      What to do:
                    </div>
                    <ul class="list-disc pl-4 space-y-1 text-slate-700 dark:text-slate-300">
                      @for (todo of step.whatToDo; track todo) {
                        <li>{{ todo }}</li>
                      }
                    </ul>
                  </div>

                  <div class="rounded-xl bg-red-50/70 p-3.5 dark:bg-red-950/30">
                    <div class="font-bold text-red-900 dark:text-red-300 mb-1.5">
                      Common mistakes to avoid:
                    </div>
                    <ul class="list-disc pl-4 space-y-1 text-red-800 dark:text-red-200">
                      @for (mistake of step.commonMistakes; track mistake) {
                        <li>{{ mistake }}</li>
                      }
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </article>
        }
      </div>
    </div>
  `,
})
export class HelpHubPage {
  readonly profileStore = inject(ProfileStorageService);

  readonly steps = [
    {
      id: 'help-step-1',
      stage: '1 · Exams Selection',
      title: 'Shortlist National, State CET, and 2 Backup Institute Exams',
      when: 'October – March (Class 12)',
      whatToDo: [
        'Register for JEE Main plus your Home State CET (MHT CET, WBJEE, KCET, KEAM, GUJCET, or EAPCET).',
        'Select 1–2 transparent computer-based backup exams (BITSAT, VITEEE, UGEE, MET, or SRMJEEE) before March deadlines.',
        'Verify your Aadhaar name, date of birth, and Class 10 marksheet spelling match 100%.',
      ],
      commonMistakes: [
        'Relying only on JEE Main without filling out your State CET form.',
        'Missing March registration deadlines for BITSAT, UGEE, or VITEEE.',
      ],
    },
    {
      id: 'help-step-2',
      stage: '2 · Documents & Certificates',
      title: 'Prepare Category, EWS, OBC-NCL & Tehsildar Income Certificates',
      when: 'January – April',
      whatToDo: [
        'Obtain central-format OBC-NCL or EWS certificate issued AFTER April 1 of the admission year (mandatory for JoSAA).',
        'Get a Revenue Officer (Tehsildar/SDM) Family Income Certificate for IIT/NIT tuition remission and AICTE TFW seats.',
        'Standardize passport photo (white background, 80% face coverage) and signature using our Document Checker.',
      ],
      commonMistakes: [
        'Using a state-format OBC certificate for Central JoSAA counselling.',
        'Getting an affidavit or notary stamp instead of an official Tehsildar-signed Income Certificate.',
      ],
    },
    {
      id: 'help-step-3',
      stage: '3 · Counselling & Choice Filling',
      title: 'Lock Choices in Strict Order of Preference (Dream → Target → Safe)',
      when: 'June – August',
      whatToDo: [
        'Fill at least 40–80 choices in JoSAA / State CET arranged strictly from your highest dream college downward.',
        'Understand Float (wait for better preference), Slide (better branch in same institute), and Freeze.',
        'Opt explicitly for TFWS (Tuition Fee Waiver Scheme) choice codes in State CET if family income is under ₹8 Lakh.',
      ],
      commonMistakes: [
        'Putting only 5–10 choices and getting zero allotment in Round 1.',
        'Paying non-refundable seat-blocking money to private agents out of panic before Round 2.',
      ],
    },
    {
      id: 'help-step-4',
      stage: '4 · Fees, Refund Rules & Education Loans',
      title: 'Pay Seat Acceptance Fees Only on Official Portals & Know UGC Refund Rights',
      when: 'June – August',
      whatToDo: [
        'Pay Seat Acceptance Fee (SAF) strictly inside the official JoSAA / State CET / University ERP portal.',
        'Download the official fee receipt and check the last date for 100% withdrawal refund under UGC rules.',
        'Apply on PM-Vidyalaxmi / SBI Scholar Loan portal once your allotment letter is generated.',
      ],
      commonMistakes: [
        'Transferring fees via UPI/NEFT to an individual agent or consultancy bank account.',
        'Missing the JoSAA Round 5 withdrawal deadline if you decide to join another institute.',
      ],
    },
    {
      id: 'help-step-5',
      stage: '5 · Physical Reporting & Joining',
      title: 'Physical Document Verification, Hostel Allotment & Scholarship Nodal Verification',
      when: 'August – September',
      whatToDo: [
        'Carry 4 sets of self-attested photocopies plus original Class 10/12 marksheets, TC/Migration, and Medical Certificate.',
        'Never surrender original marksheets permanently to any private college (prohibited by UGC/AICTE).',
        'Apply on scholarships.gov.in (NSP) and submit hardcopy to your college Scholarship Nodal Officer.',
      ],
      commonMistakes: [
        'Handing over original Class 12 marksheet without taking a written receipt.',
        'Submitting NSP online form without getting the college Nodal Officer to verify it online.',
      ],
    },
  ];

  readonly completedCount = computed(
    () =>
      this.steps.filter((s) =>
        this.profileStore.completedChecklistIds().includes(s.id)
      ).length
  );
}

/**
 * FEATURES 10 & 11: Deadline Calendar (/calendar) & Vacant Seat Alerts
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-calendar-alerts-page',
  imports: [MatIconModule],
  template: `
    <div class="space-y-10 pb-12">
      <div class="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
        <div>
          <span class="text-xs font-semibold text-teal-700 dark:text-teal-400">
            Features #10 & #11 · Deadlines, Reminders & Vacant Seat Alerts
          </span>
          <h1 class="mt-1 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
            Admission Deadline Calendar & Vacant Seat Alerts
          </h1>
          <p class="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Switch between Month and List views, export .ics files, enable browser notifications, or test our Prototype Reminder & Vacant Seat Adapters.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            (click)="enableBrowserNotifications()"
            class="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 cursor-pointer"
          >
            <mat-icon class="!w-4 !h-4 !text-[16px]">notifications</mat-icon>
            <span>Enable Browser Notifications</span>
          </button>
        </div>
      </div>

      <!-- SECTION 1: DEADLINE CALENDAR (Month & List Views) -->
      <section class="rounded-2xl border border-slate-200 bg-white p-6 space-y-5 dark:border-slate-800 dark:bg-slate-900">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100">
            2026 Engineering Exam & Counselling Calendar
          </h2>

          <div class="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            <button
              type="button"
              (click)="viewMode.set('list')"
              class="rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer"
              [class.bg-white]="viewMode() === 'list'"
              [class.text-slate-900]="viewMode() === 'list'"
              [class.shadow-xs]="viewMode() === 'list'"
              [class.dark:bg-slate-900]="viewMode() === 'list'"
              [class.dark:text-slate-100]="viewMode() === 'list'"
            >
              Chronological List View
            </button>
            <button
              type="button"
              (click)="viewMode.set('month')"
              class="rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer"
              [class.bg-white]="viewMode() === 'month'"
              [class.text-slate-900]="viewMode() === 'month'"
              [class.shadow-xs]="viewMode() === 'month'"
              [class.dark:bg-slate-900]="viewMode() === 'month'"
              [class.dark:text-slate-100]="viewMode() === 'month'"
            >
              Month Grid View
            </button>
          </div>
        </div>

        @if (viewMode() === 'list') {
          <div class="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            @for (ev of calendarEvents(); track ev.id) {
              <div class="flex flex-wrap items-center justify-between gap-3 py-3">
                <div class="flex items-center gap-3">
                  <span class="rounded-lg bg-indigo-50 px-2.5 py-1 font-mono font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 tabular-nums">
                    {{ ev.date }}
                  </span>
                  <div>
                    <div class="font-bold text-slate-900 dark:text-slate-100">{{ ev.title }}</div>
                    <div class="text-slate-500">{{ ev.type }} · {{ ev.conductingBody }}</div>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    (click)="exportIcs(ev)"
                    class="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 font-semibold hover:bg-slate-100 dark:border-slate-700 cursor-pointer"
                  >
                    <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">download</mat-icon>
                    <span>.ics</span>
                  </button>
                </div>
              </div>
            }
          </div>
        } @else {
          <!-- Month Grid View Grouped by Month -->
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            @for (m of monthGroups(); track m.monthLabel) {
              <div class="rounded-xl border border-slate-200 p-4 space-y-2.5 dark:border-slate-800">
                <div class="font-bold text-sm text-indigo-700 dark:text-indigo-400 border-b border-slate-100 pb-1.5 dark:border-slate-800">
                  {{ m.monthLabel }}
                </div>
                <div class="space-y-2 text-xs">
                  @for (ev of m.events; track ev.id) {
                    <div class="flex items-start justify-between gap-2">
                      <div>
                        <span class="font-mono font-semibold text-slate-500 tabular-nums">{{ ev.date.slice(8, 10) }}:</span>
                        <span class="ml-1 font-medium text-slate-900 dark:text-slate-100">{{ ev.title }}</span>
                      </div>
                      <button
                        type="button"
                        (click)="exportIcs(ev)"
                        class="text-indigo-700 hover:underline dark:text-indigo-400 shrink-0 cursor-pointer"
                      >
                        .ics
                      </button>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        }
      </section>

      <!-- SECTION 2: SIMULATED WHATSAPP & SMS REMINDER ADAPTER (Feature 10) -->
      <div class="grid gap-6 lg:grid-cols-2">
        <section class="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">
              Deadline Reminder Opt-In (Simulated Adapter)
            </h2>
            <span class="font-mono text-[11px] font-semibold uppercase text-amber-800 dark:text-amber-300">
              Prototype Simulation
            </span>
          </div>
          <p class="text-xs text-slate-600 dark:text-slate-400">
            Subscribes your anonymous device profile to exam deadline alerts via our adapter interface. No real SMS or WhatsApp messages are dispatched in this prototype.
          </p>

          <div class="space-y-3 text-xs">
            <div>
              <label for="rem-exam-select" class="block font-semibold mb-1">Select Exam Deadline</label>
              <select
                id="rem-exam-select"
                [value]="selectedReminderExamId()"
                (change)="onRemExamChange($event)"
                class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              >
                @for (ex of api.exams(); track ex.id) {
                  <option [value]="ex.id">{{ ex.shortName }} — Closes {{ ex.registrationEnd.value }}</option>
                }
              </select>
            </div>

            <div>
              <label for="rem-channel-select" class="block font-semibold mb-1">Simulated Delivery Adapter</label>
              <select
                id="rem-channel-select"
                [value]="selectedReminderChannel()"
                (change)="onRemChannelChange($event)"
                class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="Simulated WhatsApp">Simulated WhatsApp Adapter</option>
                <option value="Simulated SMS">Simulated SMS Adapter</option>
                <option value="Browser Notification">Browser Notification</option>
              </select>
            </div>

            <label class="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                [checked]="reminderOptIn()"
                (change)="reminderOptIn.set(!reminderOptIn())"
                class="rounded border-slate-300 text-indigo-700"
              />
              <span>I consent to receive deadline alerts (Prototype adapter — no phone number stored).</span>
            </label>

            <button
              type="button"
              (click)="submitReminderSubscription()"
              class="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800 cursor-pointer"
            >
              <mat-icon class="!w-4 !h-4 !text-[16px]">add_alert</mat-icon>
              <span>Subscribe to Deadline Reminder</span>
            </button>
          </div>

          @if (subscribedReminders().length > 0) {
            <div class="border-t border-slate-100 pt-3 space-y-1.5 text-xs dark:border-slate-800">
              <div class="font-bold">Active Reminder Subscriptions ({{ subscribedReminders().length }}):</div>
              @for (rem of subscribedReminders(); track rem.id) {
                <div class="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <span>{{ rem.title }} ({{ rem.date }})</span>
                  <span class="font-mono text-[11px]">{{ rem.channel }}</span>
                </div>
              }
            </div>
          }
        </section>

        <!-- SECTION 3: VACANT SEAT ALERTS (Feature 11) -->
        <section class="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">
              Vacant Seat & Spot Round Alerts (Feature #11)
            </h2>
            <span class="font-mono text-[11px] font-semibold uppercase text-teal-700 dark:text-teal-400">
              Simulated Feed + Adapter
            </span>
          </div>
          <p class="text-xs text-slate-600 dark:text-slate-400">
            Track CSAB Special Rounds, State CET Spot Rounds, and Institute Internal Sliding vacancies per college and branch.
          </p>

          <div class="grid gap-3 sm:grid-cols-2 text-xs">
            <div>
              <label for="alert-college-select" class="block font-semibold mb-1">Target College</label>
              <select
                id="alert-college-select"
                [value]="selectedAlertCollegeId()"
                (change)="onAlertCollegeChange($event)"
                class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              >
                @for (c of api.colleges(); track c.id) {
                  <option [value]="c.id">{{ c.shortName }}</option>
                }
              </select>
            </div>

            <div>
              <label for="alert-branch-select" class="block font-semibold mb-1">Target Branch</label>
              <select
                id="alert-branch-select"
                [value]="selectedAlertBranch()"
                (change)="onAlertBranchChange($event)"
                class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="CSE">CSE</option>
                <option value="ECE">ECE</option>
                <option value="ME">ME</option>
                <option value="IT">IT</option>
              </select>
            </div>

            <div class="sm:col-span-2">
              <label for="alert-round-select" class="block font-semibold mb-1">Counselling Vacancy Round</label>
              <select
                id="alert-round-select"
                [value]="selectedAlertRound()"
                (change)="onAlertRoundChange($event)"
                class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="JoSAA / CSAB Special Round">JoSAA / CSAB Special Round</option>
                <option value="State CET Spot Round">State CET Spot Round (MHT CET / WBJEE / KCET)</option>
                <option value="Institute Internal Sliding / Vacancy Round">Institute Internal Sliding / Vacancy Round</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            (click)="submitSeatAlert()"
            class="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 cursor-pointer"
          >
            <mat-icon class="!w-4 !h-4 !text-[16px]">notifications_active</mat-icon>
            <span>Subscribe to Vacant Seat Alert</span>
          </button>

          <!-- Simulated Live Alert Feed -->
          <div class="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2 text-xs dark:border-slate-800 dark:bg-slate-800/50">
            <div class="font-bold text-slate-800 dark:text-slate-200">
              Simulated Spot & Vacancy Alert Feed (Prototype Demo):
            </div>
            @for (item of simulatedFeed(); track item.id) {
              <div class="border-t border-slate-200/70 pt-2 dark:border-slate-700">
                <div class="font-semibold text-indigo-800 dark:text-indigo-300">{{ item.title }}</div>
                <div class="text-slate-600 dark:text-slate-400">{{ item.detail }}</div>
              </div>
            }
          </div>
        </section>
      </div>
    </div>
  `,
})
export class CalendarAlertsPage implements OnInit {
  readonly api = inject(ApiService);
  readonly profileStore = inject(ProfileStorageService);

  readonly viewMode = signal<'list' | 'month'>('list');

  readonly selectedReminderExamId = signal<string>('jee-main');
  readonly selectedReminderChannel = signal<
    'Browser Notification' | 'Simulated WhatsApp' | 'Simulated SMS'
  >('Simulated WhatsApp');
  readonly reminderOptIn = signal<boolean>(true);
  readonly subscribedReminders = signal<
    {id: string; title: string; date: string; channel: string}[]
  >([]);

  readonly selectedAlertCollegeId = signal<string>('nit-trichy');
  readonly selectedAlertBranch = signal<string>('CSE');
  readonly selectedAlertRound = signal<
    | 'JoSAA / CSAB Special Round'
    | 'State CET Spot Round'
    | 'Institute Internal Sliding / Vacancy Round'
  >('JoSAA / CSAB Special Round');

  readonly simulatedFeed = signal([
    {
      id: 'feed-1',
      title: '[Simulated Feed] CSAB Special Round-1 Vacancy Matrix Notice',
      detail:
        'Check csab.nic.in in August for vacant NIT/IIIT/GFTI seats after JoSAA Round 5.',
    },
    {
      id: 'feed-2',
      title: '[Simulated Feed] WBJEE Decentralized Counselling (Jadavpur University)',
      detail:
        'Decentralized spot verification typically opens after WBJEEB Round 2; check jadavpuruniversity.in.',
    },
  ]);

  ngOnInit(): void {
    const devId = this.profileStore.deviceId();
    this.api.getReminders(devId).then((res) => {
      this.subscribedReminders.set(res.reminders);
    });
  }

  readonly calendarEvents = computed(() => {
    const events: {
      id: string;
      title: string;
      date: string;
      type: string;
      conductingBody: string;
      url: string;
    }[] = [];

    for (const ex of this.api.exams()) {
      if (ex.registrationEnd.value) {
        events.push({
          id: `${ex.id}-reg`,
          title: `${ex.shortName} Registration Deadline`,
          date: ex.registrationEnd.value,
          type: 'Registration Close',
          conductingBody: ex.conductingBody,
          url: ex.officialUrl,
        });
      }
      if (ex.examDate.value) {
        events.push({
          id: `${ex.id}-exam`,
          title: `${ex.shortName} Examination Date`,
          date: ex.examDate.value,
          type: 'Exam Day',
          conductingBody: ex.conductingBody,
          url: ex.officialUrl,
        });
      }
    }

    return events.sort((a, b) => a.date.localeCompare(b.date));
  });

  readonly monthGroups = computed(() => {
    const groups = new Map<string, typeof this.calendarEvents extends () => infer R ? R : never>();
    for (const ev of this.calendarEvents()) {
      const monthKey = ev.date.slice(0, 7);
      const list = groups.get(monthKey) || [];
      list.push(ev);
      groups.set(monthKey, list);
    }
    return Array.from(groups.entries()).map(([monthLabel, events]) => ({
      monthLabel,
      events,
    }));
  });

  enableBrowserNotifications(): void {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      this.api.showToast(
        'Browser Notifications API is not supported in this environment.',
        'info'
      );
      return;
    }
    Notification.requestPermission().then((perm) => {
      if (perm === 'granted') {
        this.api.showToast('Browser notifications enabled!', 'success');
      } else {
        this.api.showToast(
          'Notification permission not granted; you can still export .ics files.',
          'info'
        );
      }
    });
  }

  exportIcs(ev: {
    id: string;
    title: string;
    date: string;
    type: string;
    url: string;
  }): void {
    downloadIcsFile(ev.id, ev.title, ev.date, ev.type, ev.url);
    this.api.showToast(`Downloaded ${ev.title} (.ics)`, 'success');
  }

  onRemExamChange(event: Event): void {
    this.selectedReminderExamId.set((event.target as HTMLSelectElement).value);
  }

  onRemChannelChange(event: Event): void {
    this.selectedReminderChannel.set(
      (event.target as HTMLSelectElement).value as
        | 'Browser Notification'
        | 'Simulated WhatsApp'
        | 'Simulated SMS'
    );
  }

  async submitReminderSubscription(): Promise<void> {
    if (!this.reminderOptIn()) {
      this.api.showToast('Please check the consent box first.', 'warning');
      return;
    }
    const exam = this.api
      .exams()
      .find((e) => e.id === this.selectedReminderExamId());
    if (!exam) return;

    const res = await this.api.subscribeReminder({
      deviceId: this.profileStore.deviceId(),
      examOrEventId: exam.id,
      title: `${exam.shortName} Registration Close`,
      date: exam.registrationEnd.value || '2026-04-01',
      channel: this.selectedReminderChannel(),
      optInConfirmed: true,
    });
    this.subscribedReminders.set(res.reminders);
    this.api.showToast(
      `Subscribed to ${exam.shortName} via ${this.selectedReminderChannel()}`,
      'success'
    );
  }

  onAlertCollegeChange(event: Event): void {
    this.selectedAlertCollegeId.set((event.target as HTMLSelectElement).value);
  }

  onAlertBranchChange(event: Event): void {
    this.selectedAlertBranch.set((event.target as HTMLSelectElement).value);
  }

  onAlertRoundChange(event: Event): void {
    this.selectedAlertRound.set(
      (event.target as HTMLSelectElement).value as
        | 'JoSAA / CSAB Special Round'
        | 'State CET Spot Round'
        | 'Institute Internal Sliding / Vacancy Round'
    );
  }

  async submitSeatAlert(): Promise<void> {
    const college = this.api
      .colleges()
      .find((c) => c.id === this.selectedAlertCollegeId());
    await this.api.subscribeSeatAlert({
      deviceId: this.profileStore.deviceId(),
      collegeId: this.selectedAlertCollegeId(),
      branchCode: this.selectedAlertBranch(),
      counsellingRound: this.selectedAlertRound(),
      channel: 'Simulated WhatsApp',
    });

    this.simulatedFeed.update((list) => [
      {
        id: `feed-${Date.now()}`,
        title: `[Subscribed Alert Active] ${college?.shortName ?? 'College'} — ${this.selectedAlertBranch()} (${this.selectedAlertRound()})`,
        detail:
          'Adapter registered. You will see vacancy notifications here when spot round seat matrices are published.',
      },
      ...list,
    ]);
    this.api.showToast('Vacant seat alert subscription added!', 'success');
  }
}
