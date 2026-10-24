import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {RouterLink} from '@angular/router';
import {MatIconModule} from '@angular/material/icon';
import {Exam} from '../../shared/schemas';
import {ApiService} from '../services/api.service';

export interface ExamCountdownItem {
  exam: Exam;
  targetType: 'examDate' | 'registrationEnd';
  rawDateStr: string;
  effectiveTargetDate: Date;
  isRolledToNextCycle: boolean;
  effectiveCycleYear: number;
  totalSecondsLeft: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  urgency: 'imminent' | 'soon' | 'standard';
}

function resolveNextCycleDate(
  dateStr: string | null,
  nowMs: number
): {date: Date; isRolled: boolean; cycleYear: number} {
  const fallback = new Date(nowMs + 30 * 24 * 3600 * 1000);
  if (!dateStr) {
    return {
      date: fallback,
      isRolled: false,
      cycleYear: fallback.getFullYear(),
    };
  }
  const parts = dateStr.split('-').map((p) => Number(p));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return {
      date: fallback,
      isRolled: false,
      cycleYear: fallback.getFullYear(),
    };
  }

  const [initialYear, month, day] = parts;
  let year = initialYear;
  // Set target time to 09:00 IST (03:30 UTC) on exam/deadline day
  let candidate = new Date(Date.UTC(year, month - 1, day, 3, 30, 0));
  let isRolled = false;

  while (candidate.getTime() <= nowMs) {
    year += 1;
    isRolled = true;
    candidate = new Date(Date.UTC(year, month - 1, day, 3, 30, 0));
  }

  return {
    date: candidate,
    isRolled,
    cycleYear: year,
  };
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-exam-countdown-ticker',
  imports: [RouterLink, MatIconModule],
  template: `
    <section
      aria-labelledby="exam-countdown-heading"
      class="rounded-2xl border border-teal-200/90 bg-gradient-to-br from-teal-50/80 via-white/95 to-indigo-50/75 p-6 shadow-xs dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-teal-950/30 space-y-5"
    >
      <!-- Top Header & Interactive Controls -->
      <div class="flex flex-wrap items-start justify-between gap-4 border-b border-teal-200/70 pb-4 dark:border-slate-800">
        <div class="space-y-1">
          <div class="flex flex-wrap items-center gap-2 text-xs text-teal-800 dark:text-teal-400 font-semibold">
            <mat-icon class="!w-4 !h-4 !text-[16px]">timer</mat-icon>
            <span>Live Entrance Exam Ticker</span>
            <span aria-hidden="true">·</span>
            <span class="font-normal text-slate-600 dark:text-slate-400">
              Grounded in official NTA, JoSAA, State CET & Institute schedules
            </span>
          </div>
          <h2 id="exam-countdown-heading" class="text-lg sm:text-xl font-bold text-teal-950 dark:text-slate-100">
            Time Remaining for Next Major Engineering Entrance Exams
          </h2>
        </div>

        <!-- Segmented Interactive Filter & Mode Controls -->
        <div class="flex flex-wrap items-center gap-2">
          <!-- Countdown Target Mode Toggle -->
          <div
            role="group"
            aria-label="Countdown target mode"
            class="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
          >
            <button
              type="button"
              (click)="setTargetMode('examDate')"
              [class]="'inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ' + (targetMode() === 'examDate' ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400')"
            >
              <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">event</mat-icon>
              <span>Exam Date</span>
            </button>
            <button
              type="button"
              (click)="setTargetMode('registrationEnd')"
              [class]="'inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ' + (targetMode() === 'registrationEnd' ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400')"
            >
              <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">how_to_reg</mat-icon>
              <span>Registration Close</span>
            </button>
          </div>

          <!-- Exam Level Filter -->
          <div
            role="group"
            aria-label="Filter exams by level"
            class="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
          >
            @for (lvl of levelOptions; track lvl.value) {
              <button
                type="button"
                (click)="selectedLevel.set(lvl.value)"
                [class]="'min-h-[36px] rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ' + (selectedLevel() === lvl.value ? 'bg-white text-indigo-700 shadow-xs dark:bg-slate-900 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400')"
              >
                {{ lvl.label }}
              </button>
            }
          </div>
        </div>
      </div>

      <!-- Primary Spotlight Ticker for Next / Selected Major Exam -->
      @if (spotlightItem(); as spot) {
        <div class="rounded-xl border border-indigo-200/80 bg-indigo-50/40 p-5 dark:border-indigo-900/60 dark:bg-indigo-950/30">
          <div class="grid gap-6 lg:grid-cols-12 items-center">
            <div class="lg:col-span-6 space-y-2">
              <div class="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                <span class="font-semibold text-indigo-800 dark:text-indigo-300">
                  {{ spot.exam.level }} Level
                </span>
                <span aria-hidden="true">·</span>
                <span>{{ spot.exam.conductingBody }}</span>
                <span aria-hidden="true">·</span>
                <span>Min Class 12: {{ spot.exam.minClass12Percent.value ?? 45 }}%</span>
              </div>

              <h3 class="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                {{ spot.exam.shortName }} — {{ spot.exam.name }}
              </h3>

              <div class="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <span>
                  {{ spot.targetType === 'examDate' ? 'Target Exam Window:' : 'Registration Deadline:' }}
                  <strong class="font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                    {{ formatEffectiveDate(spot.effectiveTargetDate) }}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span class="text-slate-500 dark:text-slate-400">
                  Source: {{ (spot.targetType === 'examDate' ? spot.exam.examDate.sourceName : spot.exam.registrationEnd.sourceName) || 'Official Portal' }}
                </span>
              </div>

              <div class="pt-1 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  (click)="exportExamIcs(spot)"
                  class="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-indigo-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-800 transition-colors cursor-pointer"
                >
                  <mat-icon class="!w-4 !h-4 !text-[16px]">event_available</mat-icon>
                  <span>Download .ics Reminder</span>
                </button>

                <a
                  [href]="spot.exam.officialUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 transition-colors"
                >
                  <span>Official Portal</span>
                  <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">open_in_new</mat-icon>
                </a>

                <a
                  routerLink="/exams"
                  class="inline-flex min-h-[40px] items-center gap-1 text-xs font-semibold text-indigo-700 hover:underline dark:text-indigo-400"
                >
                  <span>All {{ api.exams().length }} Exams</span>
                  <mat-icon class="!w-4 !h-4 !text-[16px]">arrow_forward</mat-icon>
                </a>
              </div>
            </div>

            <!-- Live 4-Unit Digital Ticker (Days : Hours : Minutes : Seconds) -->
            <div class="lg:col-span-6">
              <div
                class="grid grid-cols-4 gap-2.5 sm:gap-3 text-center"
                role="timer"
                [attr.aria-label]="'Countdown to ' + spot.exam.shortName"
              >
                <div class="rounded-xl border border-slate-200/90 bg-white p-3 sm:p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div class="font-mono text-2xl sm:text-3xl font-bold text-indigo-700 dark:text-indigo-400 tabular-nums">
                    {{ padNumber(spot.days) }}
                  </div>
                  <div class="mt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Days
                  </div>
                </div>

                <div class="rounded-xl border border-slate-200/90 bg-white p-3 sm:p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div class="font-mono text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                    {{ padNumber(spot.hours) }}
                  </div>
                  <div class="mt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Hours
                  </div>
                </div>

                <div class="rounded-xl border border-slate-200/90 bg-white p-3 sm:p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div class="font-mono text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                    {{ padNumber(spot.minutes) }}
                  </div>
                  <div class="mt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Minutes
                  </div>
                </div>

                <div class="rounded-xl border border-slate-200/90 bg-white p-3 sm:p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div class="font-mono text-2xl sm:text-3xl font-bold text-teal-700 dark:text-teal-400 tabular-nums">
                    {{ padNumber(spot.seconds) }}
                  </div>
                  <div class="mt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Seconds
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Upcoming Major Entrance Exams Ticker Strip (Top 6 by Chronological Order) -->
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        @for (item of visibleCountdownItems(); track item.exam.id) {
          <button
            type="button"
            (click)="selectedExamId.set(item.exam.id)"
            [class]="'group flex flex-col justify-between rounded-xl border p-4 text-left transition-all cursor-pointer ' + (spotlightItem()?.exam?.id === item.exam.id ? 'border-indigo-600 bg-indigo-50/40 dark:border-indigo-400 dark:bg-indigo-950/35' : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900')"
          >
            <div class="w-full space-y-1.5">
              <!-- Clean unboxed metadata row with typographic separators -->
              <div class="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <div class="flex items-center gap-1.5 truncate">
                  <span class="font-semibold text-slate-700 dark:text-slate-300">{{ item.exam.level }}</span>
                  <span aria-hidden="true">·</span>
                  <span class="truncate">{{ item.exam.conductingBody }}</span>
                </div>
                <span
                  [class]="'shrink-0 font-semibold ' + (item.urgency === 'imminent' ? 'text-amber-700 dark:text-amber-400' : item.urgency === 'soon' ? 'text-teal-700 dark:text-teal-400' : 'text-slate-600 dark:text-slate-400')"
                >
                  {{ item.days }}d left
                </span>
              </div>

              <div class="text-sm font-bold text-slate-900 group-hover:text-indigo-700 dark:text-slate-100 dark:group-hover:text-indigo-400 truncate">
                {{ item.exam.shortName }}
              </div>
              <div class="text-xs text-slate-500 dark:text-slate-400 truncate">
                {{ item.exam.name }}
              </div>
            </div>

            <div class="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 w-full dark:border-slate-800 text-xs">
              <span class="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                {{ formatEffectiveDate(item.effectiveTargetDate) }}
              </span>
              <span class="font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {{ padNumber(item.days) }}d : {{ padNumber(item.hours) }}h : {{ padNumber(item.minutes) }}m : {{ padNumber(item.seconds) }}s
              </span>
            </div>
          </button>
        }
      </div>
    </section>
  `,
})
export class ExamCountdownTicker implements OnInit {
  readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly nowMs = signal<number>(Date.now());
  readonly targetMode = signal<'examDate' | 'registrationEnd'>('examDate');
  readonly selectedLevel = signal<'ALL' | 'National' | 'State' | 'Institute'>('ALL');
  readonly selectedExamId = signal<string | null>(null);

  readonly levelOptions: {
    value: 'ALL' | 'National' | 'State' | 'Institute';
    label: string;
  }[] = [
    {value: 'ALL', label: 'All Exams'},
    {value: 'National', label: 'National'},
    {value: 'State', label: 'State CET'},
    {value: 'Institute', label: 'Institute'},
  ];

  readonly countdownItems = computed<ExamCountdownItem[]>(() => {
    const currentMs = this.nowMs();
    const mode = this.targetMode();
    const lvl = this.selectedLevel();

    const filtered = this.api.exams().filter((exam) => {
      if (lvl !== 'ALL' && exam.level !== lvl) {
        return false;
      }
      return true;
    });

    const mapped = filtered.map((exam) => {
      const rawField =
        mode === 'examDate' ? exam.examDate.value : exam.registrationEnd.value;
      const resolved = resolveNextCycleDate(rawField, currentMs);
      const diffMs = Math.max(0, resolved.date.getTime() - currentMs);
      const totalSecondsLeft = Math.floor(diffMs / 1000);
      const days = Math.floor(totalSecondsLeft / 86400);
      const hours = Math.floor((totalSecondsLeft % 86400) / 3600);
      const minutes = Math.floor((totalSecondsLeft % 3600) / 60);
      const seconds = totalSecondsLeft % 60;

      const urgency: 'imminent' | 'soon' | 'standard' =
        days <= 30 ? 'imminent' : days <= 90 ? 'soon' : 'standard';

      return {
        exam,
        targetType: mode,
        rawDateStr: rawField || 'TBA',
        effectiveTargetDate: resolved.date,
        isRolledToNextCycle: resolved.isRolled,
        effectiveCycleYear: resolved.cycleYear,
        totalSecondsLeft,
        days,
        hours,
        minutes,
        seconds,
        urgency,
      };
    });

    return mapped.sort((a, b) => a.totalSecondsLeft - b.totalSecondsLeft);
  });

  readonly visibleCountdownItems = computed(() =>
    this.countdownItems().slice(0, 6)
  );

  readonly spotlightItem = computed<ExamCountdownItem | null>(() => {
    const items = this.countdownItems();
    if (items.length === 0) return null;
    const chosenId = this.selectedExamId();
    if (chosenId) {
      const found = items.find((i) => i.exam.id === chosenId);
      if (found) return found;
    }
    return items[0];
  });

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      const timerId = window.setInterval(() => {
        this.nowMs.set(Date.now());
      }, 1000);
      this.destroyRef.onDestroy(() => {
        window.clearInterval(timerId);
      });
    }
  }

  setTargetMode(mode: 'examDate' | 'registrationEnd'): void {
    this.targetMode.set(mode);
  }

  padNumber(n: number): string {
    return n < 10 ? `0${n}` : `${n}`;
  }

  formatEffectiveDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  exportExamIcs(item: ExamCountdownItem): void {
    if (typeof window === 'undefined') return;
    const dateStr = this.formatEffectiveDate(item.effectiveTargetDate);
    const cleanDate = dateStr.replace(/-/g, '');
    const label =
      item.targetType === 'examDate' ? 'Entrance Exam Date' : 'Registration Deadline';
    const title = `${item.exam.shortName} ${label} (${item.effectiveCycleYear})`;
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Search Kro//Engineering Admission Deadlines//EN',
      'BEGIN:VEVENT',
      `UID:${item.exam.id}-${cleanDate}@searchkro.local`,
      `DTSTAMP:${cleanDate}T090000Z`,
      `DTSTART;VALUE=DATE:${cleanDate}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:${item.exam.name} (${item.exam.conductingBody}) - Official Portal: ${item.exam.officialUrl}`,
      `URL:${item.exam.officialUrl}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([icsContent], {type: 'text/calendar;charset=utf-8'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${item.exam.id}-${cleanDate}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.api.showToast(`Downloaded .ics reminder for ${item.exam.shortName}.`, 'success');
  }
}
