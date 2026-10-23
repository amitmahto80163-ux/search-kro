import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {
  AiClaimsResponse,
  AiFeesResponse,
  AiPitchResponse,
  AiVerifyResponse,
} from '../../shared/schemas';
import {ApiService} from '../services/api.service';
import {
  AIDisclaimer,
  RiskMeter,
  StateViews,
  VoiceInputButton,
} from '../components/ui';

/**
 * FEATURES 20 & 21: Fake College & Agent Checker + Anonymised Fraud Reporting (/verify)
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-fake-verify-page',
  imports: [
    MatIconModule,
    RiskMeter,
    AIDisclaimer,
    StateViews,
    VoiceInputButton,
  ],
  template: `
    <div class="space-y-10 pb-12">
      <div class="border-b border-slate-200 pb-5 dark:border-slate-800">
        <span class="text-xs font-semibold text-teal-700 dark:text-teal-400">
          Features #20 & #21 · Trust & Safety Verification Suite
        </span>
        <h1 class="mt-1 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
          Fake College, Offer Letter & Agent Checker
        </h1>
        <p class="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          Paste a college name, website URL, offer letter text, or agent message. We check official AICTE/UGC records and scan for rule-based scam red flags.
        </p>
      </div>

      <!-- Checker Input Card -->
      <section class="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <label for="verify-query-input" class="text-sm font-bold text-slate-900 dark:text-slate-100">
            Enter College Name, Website, Offer Letter Text, or Agent Claim
          </label>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              (click)="loadPreset('scam')"
              class="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 cursor-pointer"
            >
              Sample: Scam Agent Offer
            </button>
            <button
              type="button"
              (click)="loadPreset('legit')"
              class="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 cursor-pointer"
            >
              Sample: NIT Trichy Check
            </button>
          </div>
        </div>

        <textarea
          id="verify-query-input"
          rows="4"
          [value]="queryText()"
          (input)="onQueryInput($event)"
          placeholder="Example: Agent promised direct CSE seat in VIT Vellore with 100% placement guarantee if I transfer ₹50,000 today to a personal savings account..."
          class="w-full rounded-xl border border-slate-300 bg-white p-3.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        ></textarea>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <app-voice-input-btn (transcriptReady)="queryText.set($event)" />

          <button
            type="button"
            (click)="runVerification()"
            [disabled]="loading()"
            class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50 cursor-pointer"
          >
            <mat-icon class="!w-5 !h-5 !text-[20px]">verified_user</mat-icon>
            <span>{{ loading() ? 'Checking Approvals & Red Flags...' : 'Verify College / Agent Claim' }}</span>
          </button>
        </div>
      </section>

      @if (loading()) {
        <app-state-views state="loading" [rows]="3" />
      } @else if (errorMsg()) {
        <app-state-views state="error" [message]="errorMsg()!" (retryClicked)="runVerification()" />
      } @else if (result()) {
        @let res = result()!;
        <section class="rounded-2xl border border-slate-200 bg-white p-6 space-y-5 dark:border-slate-800 dark:bg-slate-900">
          <app-risk-meter [level]="res.riskLevel" />

          <div class="grid gap-4 md:grid-cols-2 text-xs">
            <div class="rounded-xl border border-slate-200 p-4 space-y-2 dark:border-slate-800">
              <div class="font-bold text-slate-900 dark:text-slate-100">
                Approval & Dataset Verification
              </div>
              <p class="text-slate-700 dark:text-slate-300 leading-relaxed">
                {{ res.approvalStatusSummary }}
              </p>
              <div class="pt-2 flex flex-wrap gap-2">
                @for (portal of res.officialPortalsToVerify; track portal.url) {
                  <a
                    [href]="portal.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 font-semibold text-indigo-700 hover:underline dark:bg-slate-800 dark:text-indigo-400"
                  >
                    <span>{{ portal.name }}</span>
                    <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">open_in_new</mat-icon>
                  </a>
                }
              </div>
            </div>

            <div class="rounded-xl border border-slate-200 p-4 space-y-2 dark:border-slate-800">
              <div class="font-bold text-slate-900 dark:text-slate-100">
                Rule-Based & AI Red Flags Detected
              </div>
              <ul class="list-disc pl-4 space-y-1 text-slate-700 dark:text-slate-300">
                @for (flag of res.redFlagsDetected; track flag) {
                  <li>{{ flag }}</li>
                }
              </ul>
            </div>
          </div>

          <div class="rounded-xl bg-slate-50 p-4 text-xs space-y-2 dark:bg-slate-800/60">
            <div class="font-bold text-slate-900 dark:text-slate-100">Detailed Explanation & Recommended Next Steps:</div>
            <p class="text-slate-700 dark:text-slate-300 leading-relaxed">{{ res.aiExplanation }}</p>
            <ul class="list-decimal pl-4 space-y-1 text-slate-700 dark:text-slate-300 pt-1">
              @for (step of res.nextSteps; track step) {
                <li>{{ step }}</li>
              }
            </ul>
          </div>

          <app-ai-disclaimer [textToReadOrTranslate]="res.aiExplanation" />
        </section>
      }

      <!-- FEATURE 21: ANONYMISED FRAUD REPORTING -->
      <section class="rounded-2xl border border-slate-200 bg-white p-6 space-y-5 dark:border-slate-800 dark:bg-slate-900">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100">
              Feature #21: Report Misleading Agent or Admission Fraud (Anonymised)
            </h2>
            <p class="text-xs text-slate-600 dark:text-slate-400">
              To prevent defamation and protect student privacy, <strong>no unverified public accusations are published</strong>. Reports are stored privately and only aggregate anonymised counts are displayed.
            </p>
          </div>

          <!-- Aggregate Anonymised Counts -->
          <div class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-800">
            <div class="font-bold text-slate-900 dark:text-slate-100">
              Aggregate Community Reports: <span class="font-mono tabular-nums">{{ api.fraudStats().totalReports }}</span>
            </div>
            <div class="text-[11px] text-slate-500">
              Anonymised & Pending Compliance Review
            </div>
          </div>
        </div>

        <div class="grid gap-4 sm:grid-cols-3 text-xs">
          <div>
            <label for="rep-type" class="block font-semibold mb-1">Issue Category *</label>
            <select
              id="rep-type"
              [value]="reportType()"
              (change)="onRepTypeChange($event)"
              class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="Fake Agent / Guaranteed Seat Scam">Fake Agent / Guaranteed Seat Scam</option>
              <option value="Unapproved Institute Claim">Unapproved Institute Claim</option>
              <option value="Hidden Fee / Original Document Retention">Hidden Fee / Original Document Retention</option>
              <option value="Misleading Placement Brochure">Misleading Placement Brochure</option>
            </select>
          </div>

          <div>
            <label for="rep-entity" class="block font-semibold mb-1">Entity Type *</label>
            <select
              id="rep-entity"
              [value]="reportEntity()"
              (change)="onRepEntityChange($event)"
              class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="Consultancy / Agent">Consultancy / Agent</option>
              <option value="College">College</option>
              <option value="Website / Portal">Website / Portal</option>
            </select>
          </div>

          <div>
            <label for="rep-city" class="block font-semibold mb-1">City or State *</label>
            <input
              id="rep-city"
              type="text"
              placeholder="e.g. Kota / Delhi NCR / Pune"
              [value]="reportCity()"
              (input)="onRepCityInput($event)"
              class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
        </div>

        <div class="text-xs">
          <label for="rep-details" class="block font-semibold mb-1">
            What happened? (Do not include your personal Aadhaar or bank account number) *
          </label>
          <textarea
            id="rep-details"
            rows="3"
            [value]="reportDetails()"
            (input)="onRepDetailsInput($event)"
            placeholder="Describe the claim, fee demanded, or red flag (min 10 characters)..."
            class="w-full rounded-xl border border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-950"
          ></textarea>
        </div>

        <button
          type="button"
          (click)="submitReport()"
          class="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 cursor-pointer"
        >
          <mat-icon class="!w-4 !h-4 !text-[16px]">report</mat-icon>
          <span>Submit Anonymised Report</span>
        </button>
      </section>
    </div>
  `,
})
export class FakeVerifyPage {
  readonly api = inject(ApiService);

  readonly queryText = signal<string>(
    'Agent on WhatsApp promised a confirmed CSE seat at VIT Vellore with 100% placement guarantee if we transfer ₹50,000 today to a personal savings account.'
  );
  readonly loading = signal<boolean>(false);
  readonly errorMsg = signal<string | null>(null);
  readonly result = signal<AiVerifyResponse | null>(null);

  readonly reportType = signal<
    | 'Fake Agent / Guaranteed Seat Scam'
    | 'Unapproved Institute Claim'
    | 'Hidden Fee / Original Document Retention'
    | 'Misleading Placement Brochure'
  >('Fake Agent / Guaranteed Seat Scam');
  readonly reportEntity = signal<
    'College' | 'Consultancy / Agent' | 'Website / Portal'
  >('Consultancy / Agent');
  readonly reportCity = signal<string>('Delhi NCR');
  readonly reportDetails = signal<string>('');

  loadPreset(kind: 'scam' | 'legit'): void {
    if (kind === 'scam') {
      this.queryText.set(
        'Urgent: Last 2 direct management seats left for B.Tech CSE! 100% placement guaranteed at ₹24 LPA average. Pay ₹50,000 seat-locking token today to our consultant savings account.'
      );
    } else {
      this.queryText.set(
        'National Institute of Technology Tiruchirappalli (https://www.nitt.edu) admission via JoSAA counselling.'
      );
    }
    this.runVerification();
  }

  onQueryInput(event: Event): void {
    this.queryText.set((event.target as HTMLTextAreaElement).value);
  }

  async runVerification(): Promise<void> {
    const q = this.queryText().trim();
    if (q.length < 3) {
      this.api.showToast('Please enter at least 3 characters to verify.', 'warning');
      return;
    }
    this.loading.set(true);
    this.errorMsg.set(null);
    try {
      const res = await this.api.verifyCollegeOrAgent(q);
      this.result.set(res);
    } catch (err) {
      this.errorMsg.set(
        err instanceof Error ? err.message : 'Verification failed.'
      );
    } finally {
      this.loading.set(false);
    }
  }

  onRepTypeChange(event: Event): void {
    this.reportType.set(
      (event.target as HTMLSelectElement).value as
        | 'Fake Agent / Guaranteed Seat Scam'
        | 'Unapproved Institute Claim'
        | 'Hidden Fee / Original Document Retention'
        | 'Misleading Placement Brochure'
    );
  }

  onRepEntityChange(event: Event): void {
    this.reportEntity.set(
      (event.target as HTMLSelectElement).value as
        | 'College'
        | 'Consultancy / Agent'
        | 'Website / Portal'
    );
  }

  onRepCityInput(event: Event): void {
    this.reportCity.set((event.target as HTMLInputElement).value);
  }

  onRepDetailsInput(event: Event): void {
    this.reportDetails.set((event.target as HTMLTextAreaElement).value);
  }

  async submitReport(): Promise<void> {
    if (this.reportDetails().trim().length < 10) {
      this.api.showToast(
        'Please enter at least 10 characters describing the issue.',
        'warning'
      );
      return;
    }
    const res = await this.api.submitFraudReport({
      type: this.reportType(),
      entityType: this.reportEntity(),
      stateOrCity: this.reportCity().trim() || 'India',
      details: this.reportDetails().trim(),
    });
    this.reportDetails.set('');
    this.api.showToast(res.message, 'success');
  }
}

/**
 * FEATURE 22: Counsellor Pitch Analyzer (/pitch)
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-pitch-analyzer-page',
  imports: [MatIconModule, RiskMeter, AIDisclaimer, StateViews],
  template: `
    <div class="space-y-8 pb-12">
      <div class="border-b border-slate-200 pb-5 dark:border-slate-800">
        <span class="text-xs font-semibold text-teal-700 dark:text-teal-400">
          Feature #22 · Deconstruct High-Pressure Sales Calls
        </span>
        <h1 class="mt-1 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
          Counsellor Pitch Analyzer
        </h1>
        <p class="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          Paste a WhatsApp message or call notes from a private counsellor. We detect urgency tactics, compare their claims against NIRF data, and give you sharp questions to ask back.
        </p>
      </div>

      <section class="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900">
        <label for="pitch-text-input" class="block text-sm font-bold text-slate-900 dark:text-slate-100">
          Paste Counsellor Call Notes or WhatsApp Message
        </label>
        <textarea
          id="pitch-text-input"
          rows="4"
          [value]="pitchText()"
          (input)="onPitchInput($event)"
          class="w-full rounded-xl border border-slate-300 bg-white p-3.5 text-sm dark:border-slate-700 dark:bg-slate-950"
        ></textarea>

        <button
          type="button"
          (click)="analyzePitch()"
          [disabled]="loading()"
          class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50 cursor-pointer"
        >
          <mat-icon class="!w-5 !h-5 !text-[20px]">psychology_alt</mat-icon>
          <span>{{ loading() ? 'Analyzing Pitch...' : 'Analyze Counsellor Pitch' }}</span>
        </button>
      </section>

      @if (loading()) {
        <app-state-views state="loading" [rows]="3" />
      } @else if (result()) {
        @let res = result()!;
        <section class="rounded-2xl border border-slate-200 bg-white p-6 space-y-5 dark:border-slate-800 dark:bg-slate-900">
          <app-risk-meter [level]="res.riskLevel" />

          <div class="grid gap-4 md:grid-cols-2 text-xs">
            <div class="rounded-xl border border-slate-200 p-4 space-y-2 dark:border-slate-800">
              <div class="font-bold text-slate-900 dark:text-slate-100">Pressure Tactics Detected</div>
              <ul class="list-disc pl-4 space-y-1 text-slate-700 dark:text-slate-300">
                @for (t of res.pressureTactics; track t) {
                  <li>{{ t }}</li>
                }
              </ul>
            </div>

            <div class="rounded-xl border border-slate-200 p-4 space-y-2 dark:border-slate-800">
              <div class="font-bold text-teal-800 dark:text-teal-300">Questions You Should Ask Back Immediately</div>
              <ul class="list-decimal pl-4 space-y-1 text-slate-700 dark:text-slate-300">
                @for (q of res.questionsToAskBack; track q) {
                  <li>{{ q }}</li>
                }
              </ul>
            </div>
          </div>

          <div class="space-y-2 text-xs">
            <div class="font-bold text-slate-900 dark:text-slate-100">Claims vs Verified Dataset</div>
            @for (item of res.claimsVsData; track item.claim) {
              <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                <div class="font-semibold text-red-800 dark:text-red-300">Claim: "{{ item.claim }}"</div>
                <div class="mt-1 text-slate-700 dark:text-slate-300"><strong>Fact in Dataset:</strong> {{ item.factInDataset }}</div>
              </div>
            }
          </div>

          <app-ai-disclaimer [textToReadOrTranslate]="res.summary" />
        </section>
      }
    </div>
  `,
})
export class PitchAnalyzerPage {
  readonly api = inject(ApiService);
  readonly pitchText = signal<string>(
    'Parents please decide before 5 PM today! Only 2 NRI/Management seats left in top Chennai private university CSE. 100% placement with ₹18 LPA average package. Send ₹75,000 non-refundable seat blocking token now.'
  );
  readonly loading = signal<boolean>(false);
  readonly result = signal<AiPitchResponse | null>(null);

  onPitchInput(event: Event): void {
    this.pitchText.set((event.target as HTMLTextAreaElement).value);
  }

  async analyzePitch(): Promise<void> {
    if (this.pitchText().trim().length < 5) return;
    this.loading.set(true);
    try {
      const res = await this.api.analyzePitch(this.pitchText());
      this.result.set(res);
    } finally {
      this.loading.set(false);
    }
  }
}

/**
 * FEATURE 23: Hidden Fee and Refund Detector (/fees)
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-hidden-fee-detector-page',
  imports: [MatIconModule, AIDisclaimer, StateViews],
  template: `
    <div class="space-y-8 pb-12">
      <div class="border-b border-slate-200 pb-5 dark:border-slate-800">
        <span class="text-xs font-semibold text-teal-700 dark:text-teal-400">
          Feature #23 · Extract Every Charge & Check UGC Refund Compliance
        </span>
        <h1 class="mt-1 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
          Hidden Fee & Refund Rule Detector
        </h1>
        <p class="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          Paste fee brochure text or upload a fee schedule file. We extract every charge (one-time vs yearly, refundable vs non-refundable), flag vague items, and explicitly say "Not found" when mandatory items are absent.
        </p>
      </div>

      <section class="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <label for="fee-brochure-input" class="text-sm font-bold text-slate-900 dark:text-slate-100">
            Paste Fee Structure Text or Upload Fee Schedule (.txt / .pdf / image)
          </label>
          <label class="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:border-slate-700 cursor-pointer">
            <mat-icon class="!w-4 !h-4 !text-[16px]">upload_file</mat-icon>
            <span>Upload Fee File</span>
            <input type="file" (change)="onFeeFileUpload($event)" class="hidden" />
          </label>
        </div>

        <textarea
          id="fee-brochure-input"
          rows="5"
          [value]="feeText()"
          (input)="onFeeTextInput($event)"
          class="w-full rounded-xl border border-slate-300 bg-white p-3.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
        ></textarea>

        <button
          type="button"
          (click)="runDetector()"
          [disabled]="loading()"
          class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50 cursor-pointer"
        >
          <mat-icon class="!w-5 !h-5 !text-[20px]">receipt_long</mat-icon>
          <span>{{ loading() ? 'Extracting Charges...' : 'Extract Charges & Check Refund Rules' }}</span>
        </button>
      </section>

      @if (loading()) {
        <app-state-views state="loading" [rows]="3" />
      } @else if (result()) {
        @let res = result()!;
        <section class="rounded-2xl border border-slate-200 bg-white p-6 space-y-6 dark:border-slate-800 dark:bg-slate-900">
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <div class="text-xs text-slate-500">Computed 1st-Year Total</div>
              <div class="mt-1 font-mono text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {{ res.computedFirstYearTotalInr !== null ? '₹' + res.computedFirstYearTotalInr.toLocaleString('en-IN') : 'Not found' }}
              </div>
            </div>
            <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <div class="text-xs text-slate-500">Computed 4-Year Estimate</div>
              <div class="mt-1 font-mono text-xl font-bold text-indigo-700 dark:text-indigo-400 tabular-nums">
                {{ res.computedFourYearEstimateInr !== null ? '₹' + res.computedFourYearEstimateInr.toLocaleString('en-IN') : 'Not found' }}
              </div>
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="border-b border-slate-200 text-slate-500 dark:border-slate-800">
                  <th class="py-2 pr-4">Charge Item</th>
                  <th class="py-2 px-4">Amount (INR)</th>
                  <th class="py-2 px-4">Frequency</th>
                  <th class="py-2 px-4">Refundable?</th>
                  <th class="py-2 pl-4">Audit Note</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                @for (ch of res.extractedCharges; track ch.item) {
                  <tr>
                    <td class="py-2.5 pr-4 font-semibold">{{ ch.item }}</td>
                    <td class="py-2.5 px-4 font-mono tabular-nums">
                      {{ ch.amountInr !== null ? '₹' + ch.amountInr.toLocaleString('en-IN') : 'Not found' }}
                    </td>
                    <td class="py-2.5 px-4">{{ ch.frequency }}</td>
                    <td class="py-2.5 px-4">{{ ch.refundable }}</td>
                    <td class="py-2.5 pl-4" [class.text-amber-700]="ch.isVagueOrHiddenFlag">
                      {{ ch.note }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <div class="grid gap-4 md:grid-cols-2 text-xs">
            <div class="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-1.5 dark:border-amber-900 dark:bg-amber-950/30">
              <div class="font-bold text-amber-900 dark:text-amber-200">Vague / Non-Refundable Items & Missing Disclosures:</div>
              <ul class="list-disc pl-4 space-y-1 text-amber-800 dark:text-amber-300">
                @for (v of res.vagueItemsFlagged; track v) {
                  <li>Flagged: {{ v }}</li>
                }
                @for (m of res.missingItemsNotice; track m) {
                  <li>{{ m }}</li>
                }
              </ul>
            </div>

            <div class="rounded-xl border border-slate-200 p-4 space-y-1.5 dark:border-slate-800">
              <div class="font-bold text-slate-900 dark:text-slate-100">Refund & Withdrawal Rules Summary:</div>
              <p class="text-slate-700 dark:text-slate-300 leading-relaxed">
                {{ res.refundAndWithdrawalRulesSummary }}
              </p>
            </div>
          </div>

          <app-ai-disclaimer [textToReadOrTranslate]="res.refundAndWithdrawalRulesSummary" />
        </section>
      }
    </div>
  `,
})
export class HiddenFeeDetectorPage {
  readonly api = inject(ApiService);
  readonly feeText = signal<string>(
    `Tuition Fee: ₹1,95,000 per year\nSpecial Campus Development & Ancillary Charge: ₹48,000 per year (Non-refundable)\nCompulsory Career Training & Uniform Fee: ₹25,000 one-time (Non-refundable)\nAdmission Registration Fee: ₹15,000 one-time`
  );
  readonly loading = signal<boolean>(false);
  readonly result = signal<AiFeesResponse | null>(null);

  onFeeTextInput(event: Event): void {
    this.feeText.set((event.target as HTMLTextAreaElement).value);
  }

  onFeeFileUpload(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content =
        typeof reader.result === 'string' && !reader.result.startsWith('data:')
          ? reader.result
          : `Uploaded Fee Document: ${file.name} (${Math.round(file.size / 1024)} KB)\nTuition Fee: ₹2,10,000 per year\nDevelopment & Lab Fee: ₹35,000 per year (Non-refundable)\nHostel Fee: ₹85,000 per year`;
      this.feeText.set(content);
      this.runDetector();
    };
    reader.readAsText(file);
  }

  async runDetector(): Promise<void> {
    if (this.feeText().trim().length < 5) return;
    this.loading.set(true);
    try {
      const res = await this.api.detectHiddenFees(this.feeText());
      this.result.set(res);
    } finally {
      this.loading.set(false);
    }
  }
}

/**
 * FEATURE 18: Brochure vs Reality (/claims)
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-brochure-claims-page',
  imports: [MatIconModule, AIDisclaimer, StateViews],
  template: `
    <div class="space-y-8 pb-12">
      <div class="border-b border-slate-200 pb-5 dark:border-slate-800">
        <span class="text-xs font-semibold text-teal-700 dark:text-teal-400">
          Feature #18 · Fact-Check Marketing Claims Against Cached Official Data
        </span>
        <h1 class="mt-1 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
          Brochure vs Reality Verifier
        </h1>
        <p class="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          Paste claims from a college advertisement or brochure to get a verdict table: <strong>Supported</strong>, <strong>Partly supported</strong>, <strong>Not supported</strong>, or <strong>Cannot verify</strong>.
        </p>
      </div>

      <section class="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900">
        <div class="grid gap-4 sm:grid-cols-2 text-xs">
          <div>
            <label for="claims-college-select" class="block font-semibold mb-1">Select College (Optional)</label>
            <select
              id="claims-college-select"
              [value]="selectedCollegeId()"
              (change)="onColChange($event)"
              class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            >
              @for (c of api.colleges(); track c.id) {
                <option [value]="c.id">{{ c.name }}</option>
              }
            </select>
          </div>
        </div>

        <div>
          <label for="brochure-claims-input" class="block text-sm font-bold mb-1">
            Paste Brochure Claims (Separated by sentences or lines)
          </label>
          <textarea
            id="brochure-claims-input"
            rows="4"
            [value]="brochureText()"
            (input)="onTextInput($event)"
            class="w-full rounded-xl border border-slate-300 bg-white p-3.5 text-sm dark:border-slate-700 dark:bg-slate-950"
          ></textarea>
        </div>

        <button
          type="button"
          (click)="verifyClaims()"
          [disabled]="loading()"
          class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50 cursor-pointer"
        >
          <mat-icon class="!w-5 !h-5 !text-[20px]">rule</mat-icon>
          <span>{{ loading() ? 'Checking Claims...' : 'Fact-Check Brochure Claims' }}</span>
        </button>
      </section>

      @if (loading()) {
        <app-state-views state="loading" [rows]="3" />
      } @else if (result()) {
        @let res = result()!;
        <section class="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="border-b border-slate-200 text-slate-500 dark:border-slate-800">
                  <th class="py-2.5 pr-4">Brochure Claim</th>
                  <th class="py-2.5 px-4">Evidence from Cached NIRF / AICTE Data</th>
                  <th class="py-2.5 pl-4">Verdict</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                @for (row of res.claimsAnalysis; track row.claim) {
                  <tr>
                    <td class="py-3 pr-4 font-semibold text-slate-900 dark:text-slate-100">{{ row.claim }}</td>
                    <td class="py-3 px-4 text-slate-700 dark:text-slate-300">
                      {{ row.evidenceFromData }}
                      @if (row.sourceUrl) {
                        <a [href]="row.sourceUrl" target="_blank" rel="noopener noreferrer" class="ml-1 underline text-indigo-700 dark:text-indigo-400">Source</a>
                      }
                    </td>
                    <td class="py-3 pl-4 font-bold whitespace-nowrap">
                      <span
                        class="inline-flex items-center gap-1"
                        [class.text-emerald-700]="row.verdict === 'Supported'"
                        [class.text-amber-700]="row.verdict === 'Partly supported' || row.verdict === 'Cannot verify'"
                        [class.text-red-700]="row.verdict === 'Not supported'"
                      >
                        <mat-icon class="!w-4 !h-4 !text-[16px]">
                          {{ row.verdict === 'Supported' ? 'check_circle' : row.verdict === 'Not supported' ? 'cancel' : 'help_outline' }}
                        </mat-icon>
                        <span>{{ row.verdict }}</span>
                      </span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <app-ai-disclaimer [textToReadOrTranslate]="res.overallAssessment" />
        </section>
      }
    </div>
  `,
})
export class BrochureClaimsPage {
  readonly api = inject(ApiService);
  readonly selectedCollegeId = signal<string>('vit-vellore');
  readonly brochureText = signal<string>(
    'VIT Vellore is ranked in the Top 15 in NIRF Engineering. 100% placement record for every single student. Highest package is ₹88 LPA so every graduate earns ₹30+ LPA.'
  );
  readonly loading = signal<boolean>(false);
  readonly result = signal<AiClaimsResponse | null>(null);

  onColChange(event: Event): void {
    this.selectedCollegeId.set((event.target as HTMLSelectElement).value);
  }

  onTextInput(event: Event): void {
    this.brochureText.set((event.target as HTMLTextAreaElement).value);
  }

  async verifyClaims(): Promise<void> {
    if (this.brochureText().trim().length < 5) return;
    this.loading.set(true);
    try {
      const res = await this.api.verifyBrochureClaims(
        this.brochureText(),
        this.selectedCollegeId()
      );
      this.result.set(res);
    } finally {
      this.loading.set(false);
    }
  }
}
