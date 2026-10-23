import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {SourcedField} from '../../shared/schemas';
import {I18nService} from '../services/i18n.service';
import {ApiService} from '../services/api.service';

/**
 * 1. DataBadge: Displays a sourced fact with an interactive popover showing
 * sourceName, sourceUrl, lastVerified, and confidence level.
 * If value is null, explicitly shows "Not verified, check the official site".
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-data-badge',
  imports: [MatIconModule],
  template: `
    @let fieldData = field();
    @if (fieldData && fieldData.value !== null && fieldData.value !== undefined) {
      <span class="relative inline-flex items-center gap-1.5 align-baseline">
        <span class="font-medium text-slate-900 dark:text-slate-100 tabular-nums">
          {{ prefix() }}{{ formatVal(fieldData.value) }}{{ suffix() }}
        </span>
        <button
          type="button"
          (click)="togglePopover($event)"
          class="inline-flex items-center gap-0.5 text-xs text-teal-700 hover:text-teal-900 dark:text-teal-400 dark:hover:text-teal-300 underline decoration-dotted underline-offset-2 focus-visible:outline-2 focus-visible:outline-indigo-600 rounded px-1 py-0.5 cursor-pointer"
          [attr.aria-label]="'View data source: ' + (fieldData.sourceName || 'Official source')"
        >
          <mat-icon class="!w-3.5 !h-3.5 !text-[14px] leading-none">verified</mat-icon>
          <span class="whitespace-nowrap">{{ fieldData.confidence === 'official' ? 'Source' : fieldData.confidence }}</span>
        </button>

        @if (isOpen()) {
          <div
            role="dialog"
            aria-label="Data source verification details"
            class="absolute bottom-full left-0 z-40 mb-2 w-72 rounded-xl border border-slate-200 bg-white p-3.5 text-left text-xs shadow-md dark:border-slate-700 dark:bg-slate-900"
          >
            <div class="flex items-start justify-between gap-2">
              <span class="font-semibold text-slate-900 dark:text-slate-100">
                {{ fieldData.sourceName || 'Verified Record' }}
              </span>
              <button
                type="button"
                (click)="isOpen.set(false)"
                class="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                aria-label="Close source popover"
              >
                <mat-icon class="!w-4 !h-4 !text-[16px]">close</mat-icon>
              </button>
            </div>
            <div class="mt-1.5 space-y-1 text-slate-600 dark:text-slate-400">
              <div>
                Confidence: <span class="font-medium text-slate-800 dark:text-slate-200">{{ fieldData.confidence }}</span>
              </div>
              @if (fieldData.lastVerified) {
                <div>
                  Last verified: <span class="font-mono tabular-nums">{{ fieldData.lastVerified }}</span>
                </div>
              }
              @if (fieldData.sourceUrl) {
                <div class="pt-1">
                  <a
                    [href]="fieldData.sourceUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1 font-medium text-indigo-700 hover:underline dark:text-indigo-400"
                  >
                    <span>Verify on official site</span>
                    <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">open_in_new</mat-icon>
                  </a>
                </div>
              }
            </div>
          </div>
        }
      </span>
    } @else {
      <span class="inline-flex items-center gap-1 text-xs text-amber-800 dark:text-amber-300">
        <mat-icon class="!w-3.5 !h-3.5 !text-[14px] leading-none">help_outline</mat-icon>
        <span>{{ i18n.t('common.notVerified') }}</span>
        @if (fallbackUrl()) {
          <a
            [href]="fallbackUrl()"
            target="_blank"
            rel="noopener noreferrer"
            class="underline hover:text-amber-950 dark:hover:text-amber-200 ml-0.5"
          >
            Official link
          </a>
        }
      </span>
    }
  `,
})
export class DataBadge {
  readonly i18n = inject(I18nService);
  readonly field = input.required<SourcedField<unknown> | null | undefined>();
  readonly prefix = input<string>('');
  readonly suffix = input<string>('');
  readonly formatAsInr = input<boolean>(false);
  readonly fallbackUrl = input<string>('');

  readonly isOpen = signal<boolean>(false);

  togglePopover(event: Event): void {
    event.stopPropagation();
    this.isOpen.update((v) => !v);
  }

  formatVal(val: unknown): string {
    if (Array.isArray(val)) {
      return val.join(', ');
    }
    if (typeof val === 'number') {
      return this.formatAsInr()
        ? `₹${val.toLocaleString('en-IN')}`
        : val.toLocaleString('en-IN');
    }
    if (typeof val === 'boolean') {
      return val ? 'Yes' : 'No';
    }
    return String(val);
  }
}

/**
 * 2. RiskMeter: Accessible risk indicator that always pairs colour with an icon and explicit text label.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-risk-meter',
  imports: [MatIconModule],
  template: `
    <div
      class="rounded-xl border p-4 transition-colors duration-150"
      [class.border-emerald-300]="level() === 'Low'"
      [class.bg-emerald-50]="level() === 'Low'"
      [class.dark:border-emerald-800]="level() === 'Low'"
      [class.dark:bg-emerald-950]="level() === 'Low'"
      [class.border-amber-300]="level() === 'Medium'"
      [class.bg-amber-50]="level() === 'Medium'"
      [class.dark:border-amber-800]="level() === 'Medium'"
      [class.dark:bg-amber-950]="level() === 'Medium'"
      [class.border-red-300]="level() === 'High'"
      [class.bg-red-50]="level() === 'High'"
      [class.dark:border-red-800]="level() === 'High'"
      [class.dark:bg-red-950]="level() === 'High'"
      role="status"
      [attr.aria-label]="'Risk Level: ' + level()"
    >
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-2.5">
          @if (level() === 'Low') {
            <mat-icon class="text-emerald-700 dark:text-emerald-400">verified_user</mat-icon>
            <div>
              <div class="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                Low Risk — Verified Signals
              </div>
              <div class="text-xs text-emerald-800 dark:text-emerald-300">
                Matches official records; still confirm on the official portal.
              </div>
            </div>
          } @else if (level() === 'Medium') {
            <mat-icon class="text-amber-700 dark:text-amber-400">warning_amber</mat-icon>
            <div>
              <div class="text-sm font-bold text-amber-900 dark:text-amber-200">
                Medium Risk — Caution & Verify
              </div>
              <div class="text-xs text-amber-800 dark:text-amber-300">
                Unverified claims or missing official disclosures detected.
              </div>
            </div>
          } @else {
            <mat-icon class="text-red-700 dark:text-red-400">gpp_bad</mat-icon>
            <div>
              <div class="text-sm font-bold text-red-900 dark:text-red-200">
                High Risk — Fraud / High-Pressure Red Flags Detected
              </div>
              <div class="text-xs text-red-800 dark:text-red-300">
                Do not pay fees or hand over original documents.
              </div>
            </div>
          }
        </div>
        <span class="font-mono text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded bg-white/80 dark:bg-slate-900/80 text-slate-900 dark:text-slate-100">
          {{ level() }} RISK
        </span>
      </div>
      <!-- Segmented visual bar -->
      <div class="mt-3 grid grid-cols-3 gap-1.5" aria-hidden="true">
        <div
          class="h-2 rounded-full"
          [class.bg-emerald-600]="level() === 'Low'"
          [class.bg-slate-200]="level() !== 'Low'"
          [class.dark:bg-slate-800]="level() !== 'Low'"
        ></div>
        <div
          class="h-2 rounded-full"
          [class.bg-amber-500]="level() === 'Medium'"
          [class.bg-slate-200]="level() !== 'Medium'"
          [class.dark:bg-slate-800]="level() !== 'Medium'"
        ></div>
        <div
          class="h-2 rounded-full"
          [class.bg-red-600]="level() === 'High'"
          [class.bg-slate-200]="level() !== 'High'"
          [class.dark:bg-slate-800]="level() !== 'High'"
        ></div>
      </div>
    </div>
  `,
})
export class RiskMeter {
  readonly level = input.required<'Low' | 'Medium' | 'High'>();
}

/**
 * 3. AIDisclaimer: Displayed on every AI output, with optional Read Aloud (Web Speech API)
 * and Gemini translation into English / Hindi / Punjabi.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-ai-disclaimer',
  imports: [MatIconModule],
  template: `
    <div class="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-1.5">
          <mat-icon class="!w-4 !h-4 !text-[16px] text-indigo-600 dark:text-indigo-400">info</mat-icon>
          <span class="font-medium">{{ i18n.t('common.aiDisclaimer') }}</span>
        </div>

        @if (textToReadOrTranslate()) {
          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              (click)="speakText()"
              class="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">{{ isSpeaking() ? 'stop' : 'volume_up' }}</mat-icon>
              <span>{{ isSpeaking() ? 'Stop' : i18n.t('action.readAloud') }}</span>
            </button>
            <button
              type="button"
              (click)="translateTo('hi')"
              [disabled]="isTranslating()"
              class="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer disabled:opacity-50"
            >
              <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">translate</mat-icon>
              <span>हिंदी</span>
            </button>
            <button
              type="button"
              (click)="translateTo('pa')"
              [disabled]="isTranslating()"
              class="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer disabled:opacity-50"
            >
              <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">translate</mat-icon>
              <span>ਪੰਜਾਬੀ</span>
            </button>
          </div>
        }
      </div>

      @if (translatedOutput()) {
        <div class="mt-2.5 rounded-lg border border-indigo-200 bg-indigo-50/60 p-2.5 text-slate-800 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-slate-200">
          <div class="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 mb-1">
            Translated Output:
          </div>
          <p class="whitespace-pre-line text-xs leading-relaxed">{{ translatedOutput() }}</p>
        </div>
      }
    </div>
  `,
})
export class AIDisclaimer {
  readonly i18n = inject(I18nService);
  readonly api = inject(ApiService);
  readonly textToReadOrTranslate = input<string>('');

  readonly isSpeaking = signal<boolean>(false);
  readonly isTranslating = signal<boolean>(false);
  readonly translatedOutput = signal<string | null>(null);

  speakText(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.api.showToast(
        'Read-aloud is not supported in this browser.',
        'warning'
      );
      return;
    }
    if (this.isSpeaking()) {
      window.speechSynthesis.cancel();
      this.isSpeaking.set(false);
      return;
    }
    const text = this.translatedOutput() || this.textToReadOrTranslate();
    if (!text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const lang = this.i18n.currentLang();
    utterance.lang = lang === 'hi' ? 'hi-IN' : lang === 'pa' ? 'pa-IN' : 'en-IN';
    utterance.onend = () => this.isSpeaking.set(false);
    utterance.onerror = () => this.isSpeaking.set(false);
    this.isSpeaking.set(true);
    window.speechSynthesis.speak(utterance);
  }

  async translateTo(lang: 'hi' | 'pa'): Promise<void> {
    const raw = this.textToReadOrTranslate();
    if (!raw) return;
    this.isTranslating.set(true);
    try {
      const res = await this.api.translateText(raw, lang);
      this.translatedOutput.set(res.translatedText);
    } catch {
      this.api.showToast('Could not translate text right now.', 'error');
    } finally {
      this.isTranslating.set(false);
    }
  }
}

/**
 * 4. VoiceInputButton: Web Speech API microphone speech-to-text with graceful fallback.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-voice-input-btn',
  imports: [MatIconModule],
  template: `
    <button
      type="button"
      (click)="toggleListening()"
      class="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
      [class.border-red-500]="isListening()"
      [class.text-red-700]="isListening()"
      [attr.aria-label]="i18n.t('action.voiceInput')"
    >
      <mat-icon class="!w-4 !h-4 !text-[16px]">{{ isListening() ? 'mic_off' : 'mic' }}</mat-icon>
      <span class="whitespace-nowrap">{{ isListening() ? 'Listening...' : i18n.t('action.voiceInput') }}</span>
    </button>
  `,
})
export class VoiceInputButton {
  readonly i18n = inject(I18nService);
  readonly api = inject(ApiService);
  readonly transcriptReady = output<string>();
  readonly isListening = signal<boolean>(false);

  toggleListening(): void {
    if (typeof window === 'undefined') return;
    const win = window as unknown as Record<string, unknown>;
    const SpeechRec = (win['SpeechRecognition'] ||
      win['webkitSpeechRecognition']) as
      | (new () => {
          lang: string;
          interimResults: boolean;
          maxAlternatives: number;
          start: () => void;
          stop: () => void;
          onresult: (e: {
            results: {0: {0: {transcript: string}}};
          }) => void;
          onerror: () => void;
          onend: () => void;
        })
      | undefined;

    if (!SpeechRec) {
      this.api.showToast(
        'Voice input (Web Speech API) is not supported in this browser. Please type your query.',
        'info'
      );
      return;
    }

    if (this.isListening()) {
      this.isListening.set(false);
      return;
    }

    try {
      const rec = new SpeechRec();
      const lang = this.i18n.currentLang();
      rec.lang = lang === 'hi' ? 'hi-IN' : lang === 'pa' ? 'pa-IN' : 'en-IN';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      this.isListening.set(true);

      rec.onresult = (event) => {
        const text = event.results?.[0]?.[0]?.transcript;
        if (text) {
          this.transcriptReady.emit(text);
        }
        this.isListening.set(false);
      };
      rec.onerror = () => {
        this.isListening.set(false);
        this.api.showToast(
          'Microphone permission or voice recognition unavailable.',
          'warning'
        );
      };
      rec.onend = () => {
        this.isListening.set(false);
      };
      rec.start();
    } catch {
      this.isListening.set(false);
    }
  }
}

/**
 * 5. HowWeCalculateModal: Transparent formula disclosure modal.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-how-we-calculate-modal',
  imports: [MatIconModule],
  template: `
    @if (isOpen()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        aria-labelledby="calc-modal-title"
      >
        <div class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div class="flex items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
            <div>
              <h2 id="calc-modal-title" class="text-lg font-bold text-slate-900 dark:text-slate-100">
                How We Calculate Rankings & ROI
              </h2>
              <p class="mt-1 text-xs text-slate-600 dark:text-slate-400">
                {{ api.rankingFormulas().principle }}
              </p>
            </div>
            <button
              type="button"
              (click)="closed.emit()"
              class="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="Close modal"
            >
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <div class="mt-4 space-y-4">
            @for (item of api.rankingFormulas().formulas; track item.name) {
              <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <div class="font-semibold text-sm text-slate-900 dark:text-slate-100">
                  {{ item.name }}
                </div>
                <div class="mt-1.5 rounded bg-slate-100 px-3 py-2 font-mono text-xs text-indigo-800 dark:bg-slate-800 dark:text-indigo-300">
                  {{ item.formula }}
                </div>
                <p class="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {{ item.explanation }}
                </p>
              </div>
            }
          </div>

          <div class="mt-6 flex items-center justify-between border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-800">
            <span>Last refreshed: {{ api.meta().lastRefreshed }}</span>
            <button
              type="button"
              (click)="closed.emit()"
              class="inline-flex items-center gap-1.5 rounded-xl bg-indigo-700 px-4 py-2 font-medium text-white hover:bg-indigo-800 cursor-pointer"
            >
              <mat-icon class="!w-4 !h-4 !text-[16px]">check</mat-icon>
              <span>Got it</span>
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class HowWeCalculateModal {
  readonly api = inject(ApiService);
  readonly isOpen = input.required<boolean>();
  readonly closed = output<void>();
}

/**
 * 6. State View Components: Loading Skeleton, Empty State, Error State with Retry
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-state-views',
  imports: [MatIconModule],
  template: `
    @if (state() === 'loading') {
      <div class="space-y-3 py-4" role="status" aria-label="Loading content">
        @for (row of skeletonRows(); track row) {
          <div class="h-16 w-full animate-pulse rounded-xl bg-slate-200/80 dark:bg-slate-800"></div>
        }
      </div>
    } @else if (state() === 'error') {
      <div class="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/50 dark:bg-red-950/40" role="alert">
        <mat-icon class="!w-8 !h-8 !text-[32px] text-red-600 dark:text-red-400 mx-auto">error_outline</mat-icon>
        <h3 class="mt-2 text-base font-semibold text-red-900 dark:text-red-200">
          {{ title() || 'Something went wrong while loading this section' }}
        </h3>
        <p class="mt-1 text-xs text-red-800 dark:text-red-300">
          {{ message() || 'Please check your connection or retry with cached data.' }}
        </p>
        <button
          type="button"
          (click)="retryClicked.emit()"
          class="mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-red-700 px-4 py-2 text-xs font-semibold text-white hover:bg-red-800 cursor-pointer"
        >
          <mat-icon class="!w-4 !h-4 !text-[16px]">refresh</mat-icon>
          <span>Retry</span>
        </button>
      </div>
    } @else if (state() === 'empty') {
      <div class="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
        <mat-icon class="!w-8 !h-8 !text-[32px] text-slate-400 mx-auto">search_off</mat-icon>
        <h3 class="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
          {{ title() || 'No matching records found' }}
        </h3>
        <p class="mt-1 text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
          {{ message() || 'Try broadening your budget, admission route, or search filters.' }}
        </p>
        @if (actionLabel()) {
          <button
            type="button"
            (click)="retryClicked.emit()"
            class="mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-indigo-700 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-800 cursor-pointer"
          >
            <mat-icon class="!w-4 !h-4 !text-[16px]">restart_alt</mat-icon>
            <span>{{ actionLabel() }}</span>
          </button>
        }
      </div>
    }
  `,
})
export class StateViews {
  readonly state = input.required<'loading' | 'empty' | 'error' | 'ready'>();
  readonly title = input<string>('');
  readonly message = input<string>('');
  readonly actionLabel = input<string>('');
  readonly rows = input<number>(3);
  readonly retryClicked = output<void>();

  readonly skeletonRows = computed(() =>
    Array.from({length: this.rows()}, (_, i) => i)
  );
}
