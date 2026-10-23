import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import {ActivatedRoute, RouterLink} from '@angular/router';
import {MatIconModule} from '@angular/material/icon';
import {
  AiScholarshipExplainResponse,
  College,
  Scholarship,
} from '../../shared/schemas';
import {
  calculateEducationLoanEmi,
  calculateRoiScore,
  calculateTrue4YearCost,
  matchScholarships,
} from '../../server-lib/analysis/calculators';
import {ApiService} from '../services/api.service';
import {I18nService} from '../services/i18n.service';
import {ProfileStorageService} from '../services/storage.service';
import {
  AIDisclaimer,
  DataBadge,
  HowWeCalculateModal,
  StateViews,
} from '../components/ui';

/**
 * FEATURE 16: Side-by-Side Compare up to 4 Colleges (/compare)
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-compare-page',
  imports: [
    RouterLink,
    MatIconModule,
    DataBadge,
    HowWeCalculateModal,
    StateViews,
  ],
  template: `
    <div class="space-y-8 pb-12">
      <div class="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
        <div>
          <span class="text-xs font-semibold text-teal-700 dark:text-teal-400">
            Feature #16 · Side-by-Side Unbiased Comparison (Up to 4 Colleges)
          </span>
          <h1 class="mt-1 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
            Compare Engineering Colleges
          </h1>
          <p class="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Compare NIRF ranks, annual fees, 4-year net costs, verified median salaries, and ROI payback side by side.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            (click)="showFormulaModal.set(true)"
            class="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-indigo-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-indigo-400 cursor-pointer"
          >
            <mat-icon class="!w-4 !h-4 !text-[16px]">calculate</mat-icon>
            <span>{{ i18n.t('action.howWeCalculate') }}</span>
          </button>

          <button
            type="button"
            (click)="copyShareableLink()"
            class="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-indigo-700 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-800 cursor-pointer"
          >
            <mat-icon class="!w-4 !h-4 !text-[16px]">share</mat-icon>
            <span>Copy Shareable Link</span>
          </button>
        </div>
      </div>

      <!-- Add / Remove College Bar -->
      <section class="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div class="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-bold text-slate-700 dark:text-slate-300">Add College ({{ comparedColleges().length }}/4):</span>
            <select
              (change)="onAddCollege($event)"
              aria-label="Add college to comparison"
              class="rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-medium dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">+ Select a college to add...</option>
              @for (c of api.colleges(); track c.id) {
                <option [value]="c.id" [disabled]="profileStore.compareIds().includes(c.id)">
                  {{ c.shortName }} ({{ c.cityInfo.city }})
                </option>
              }
            </select>
          </div>

          @if (bestValueCollegeId()) {
            <div class="inline-flex items-center gap-1.5 font-semibold text-teal-800 dark:text-teal-300">
              <mat-icon class="!w-4 !h-4 !text-[16px]">workspace_premium</mat-icon>
              <span>Best Value Highlighted Based on Verified ROI Payback</span>
            </div>
          }
        </div>
      </section>

      @if (comparedColleges().length === 0) {
        <app-state-views
          state="empty"
          title="No colleges selected for comparison"
          message="Select up to 4 colleges from the dropdown above or load our default 3-college comparison."
          actionLabel="Load Default Comparison"
          (retryClicked)="loadDefaults()"
        />
      } @else {
        <!-- Responsive Comparison Matrix -->
        <div class="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-800">
                <th class="p-4 w-48 font-bold text-slate-500">Metric / Source-Verified Field</th>
                @for (col of comparedColleges(); track col.id) {
                  @let isBest = bestValueCollegeId() === col.id;
                  <th
                    class="p-4 min-w-[220px] align-top"
                    [class.bg-teal-50/50]="isBest"
                    [class.dark:bg-teal-950/30]="isBest"
                  >
                    <div class="flex items-start justify-between gap-2">
                      <div>
                        @if (isBest) {
                          <div class="mb-1 text-[11px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
                            ★ Best Value ROI
                          </div>
                        }
                        <a [routerLink]="['/college', col.id]" class="text-sm font-bold text-slate-900 hover:underline dark:text-slate-100">
                          {{ col.shortName }}
                        </a>
                        <div class="font-normal text-slate-500">
                          {{ col.cityInfo.city }} · {{ col.ownership }}
                        </div>
                      </div>
                      <button
                        type="button"
                        (click)="removeCollege(col.id)"
                        class="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                        [attr.aria-label]="'Remove ' + col.shortName"
                      >
                        <mat-icon class="!w-4 !h-4 !text-[16px]">close</mat-icon>
                      </button>
                    </div>
                  </th>
                }
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              <tr>
                <td class="p-4 font-semibold text-slate-700 dark:text-slate-300">Partner / Listing Status</td>
                @for (col of comparedColleges(); track col.id) {
                  <td class="p-4">
                    @if (col.isPartner) {
                      <span class="font-semibold text-teal-700 dark:text-teal-400">{{ i18n.t('common.partnerLabel') }}</span>
                    } @else {
                      <span class="text-slate-500">{{ i18n.t('common.infoOnlyLabel') }}</span>
                    }
                  </td>
                }
              </tr>
              <tr>
                <td class="p-4 font-semibold text-slate-700 dark:text-slate-300">NIRF 2024 Engineering Rank</td>
                @for (col of comparedColleges(); track col.id) {
                  <td class="p-4">
                    <app-data-badge [field]="col.accreditation.nirfRank" prefix="#" [fallbackUrl]="col.officialWebsite" />
                  </td>
                }
              </tr>
              <tr>
                <td class="p-4 font-semibold text-slate-700 dark:text-slate-300">Annual Tuition Fee</td>
                @for (col of comparedColleges(); track col.id) {
                  <td class="p-4">
                    <app-data-badge [field]="col.fees.tuitionPerYearInr" [formatAsInr]="true" suffix="/yr" [fallbackUrl]="col.officialWebsite" />
                  </td>
                }
              </tr>
              <tr>
                <td class="p-4 font-semibold text-slate-700 dark:text-slate-300">Annual Hostel + Mess</td>
                @for (col of comparedColleges(); track col.id) {
                  <td class="p-4 font-mono tabular-nums">
                    ₹{{ ((col.fees.hostelPerYearInr.value ?? 0) + (col.fees.messPerYearInr.value ?? 0)).toLocaleString('en-IN') }}/yr
                  </td>
                }
              </tr>
              <tr>
                <td class="p-4 font-semibold text-slate-700 dark:text-slate-300">Estimated 4-Year Total Cost</td>
                @for (col of comparedColleges(); track col.id) {
                  <td class="p-4 font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                    ₹{{ getFourYearTotal(col).toLocaleString('en-IN') }}
                  </td>
                }
              </tr>
              <tr>
                <td class="p-4 font-semibold text-slate-700 dark:text-slate-300">Verified NIRF Median Salary</td>
                @for (col of comparedColleges(); track col.id) {
                  <td class="p-4">
                    <app-data-badge [field]="col.placements.medianSalaryInr" [formatAsInr]="true" suffix="/yr" [fallbackUrl]="col.officialWebsite" />
                  </td>
                }
              </tr>
              <tr>
                <td class="p-4 font-semibold text-slate-700 dark:text-slate-300">Batch Placed (%)</td>
                @for (col of comparedColleges(); track col.id) {
                  <td class="p-4">
                    <app-data-badge [field]="col.placements.placedPercent" suffix="%" [fallbackUrl]="col.officialWebsite" />
                  </td>
                }
              </tr>
              <tr>
                <td class="p-4 font-semibold text-slate-700 dark:text-slate-300">ROI Payback Period</td>
                @for (col of comparedColleges(); track col.id) {
                  <td class="p-4 font-mono font-bold text-teal-700 dark:text-teal-400 tabular-nums">
                    {{ col.rankingMetrics?.roiPaybackYears !== null ? col.rankingMetrics?.roiPaybackYears + ' Years' : 'Unverified' }}
                  </td>
                }
              </tr>
              <tr>
                <td class="p-4 font-semibold text-slate-700 dark:text-slate-300">Overall Unbiased Fair Score</td>
                @for (col of comparedColleges(); track col.id) {
                  <td class="p-4 font-mono font-bold text-indigo-700 dark:text-indigo-400 tabular-nums">
                    {{ col.rankingMetrics?.overallFairScore ?? 'N/A' }}/100
                  </td>
                }
              </tr>
            </tbody>
          </table>
        </div>
      }

      <app-how-we-calculate-modal
        [isOpen]="showFormulaModal()"
        (closed)="showFormulaModal.set(false)"
      />
    </div>
  `,
})
export class ComparePage {
  readonly api = inject(ApiService);
  readonly i18n = inject(I18nService);
  readonly profileStore = inject(ProfileStorageService);
  private readonly route = inject(ActivatedRoute);

  readonly showFormulaModal = signal<boolean>(false);

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      const idsParam = params.get('ids');
      if (idsParam) {
        const list = idsParam
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        if (list.length > 0) {
          this.profileStore.setCompareColleges(list);
        }
      }
    });
  }

  readonly comparedColleges = computed(() => {
    const ids = this.profileStore.compareIds();
    return ids
      .map((id) => this.api.colleges().find((c) => c.id === id))
      .filter((c): c is College => !!c);
  });

  readonly bestValueCollegeId = computed(() => {
    const list = this.comparedColleges();
    if (list.length === 0) return null;
    const sorted = [...list].sort(
      (a, b) =>
        (b.rankingMetrics?.valueForMoneyScore ?? 0) -
        (a.rankingMetrics?.valueForMoneyScore ?? 0)
    );
    return sorted[0]?.id ?? null;
  });

  onAddCollege(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const id = select.value;
    if (!id) return;
    const res = this.profileStore.toggleCompareCollege(id);
    if (res.limitReached) {
      this.api.showToast('Maximum 4 colleges can be compared.', 'warning');
    }
    select.value = '';
  }

  removeCollege(id: string): void {
    this.profileStore.toggleCompareCollege(id);
  }

  loadDefaults(): void {
    this.profileStore.setCompareColleges([
      'nit-trichy',
      'vit-vellore',
      'coep-pune',
    ]);
  }

  getFourYearTotal(col: College): number {
    const annual =
      (col.fees.tuitionPerYearInr.value ?? 0) +
      (col.fees.hostelPerYearInr.value ?? 0) +
      (col.fees.messPerYearInr.value ?? 0) +
      (col.fees.examAndLabPerYearInr.value ?? 0);
    return annual * 4 + (col.fees.oneTimeAdmissionInr.value ?? 0);
  }

  copyShareableLink(): void {
    if (typeof window === 'undefined') return;
    const ids = this.profileStore.compareIds().join(',');
    const url = `${window.location.origin}/compare?ids=${encodeURIComponent(ids)}`;
    navigator.clipboard?.writeText(url);
    this.api.showToast(`Shareable comparison link copied: ${url}`, 'success');
  }
}

/**
 * FEATURES 24, 25, 26 & 27: Financial Hub (/money)
 * - True 4-Year Cost Calculator
 * - Scholarship Finder + Plain-Language AI Explanation
 * - Education Loan Guide & EMI Calculator
 * - ROI Score & Payback Calculator
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-money-hub-page',
  imports: [MatIconModule, DataBadge, AIDisclaimer],
  template: `
    <div class="space-y-8 pb-12">
      <div class="border-b border-slate-200 pb-5 dark:border-slate-800">
        <span class="text-xs font-semibold text-teal-700 dark:text-teal-400">
          Features #24, #25, #26 & #27 · Complete Financial Planning Suite
        </span>
        <h1 class="mt-1 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
          True 4-Year Cost, Scholarships, Education Loans & ROI
        </h1>
        <p class="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          Calculate your real 4-year B.Tech expenditure, match verified government/AICTE scholarships, plan loan EMIs, and compute payback periods.
        </p>
      </div>

      <!-- 4 Tool Tabs -->
      <div class="flex overflow-x-auto gap-1.5 rounded-xl border border-slate-200 bg-slate-100 p-1.5 dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          (click)="activeTool.set('cost')"
          class="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          [class.bg-white]="activeTool() === 'cost'"
          [class.text-indigo-700]="activeTool() === 'cost'"
          [class.shadow-xs]="activeTool() === 'cost'"
          [class.dark:bg-slate-800]="activeTool() === 'cost'"
          [class.dark:text-indigo-300]="activeTool() === 'cost'"
        >
          <mat-icon class="!w-4 !h-4 !text-[16px]">calculate</mat-icon>
          <span>#24 True 4-Year Cost Calculator</span>
        </button>

        <button
          type="button"
          (click)="activeTool.set('scholarships')"
          class="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          [class.bg-white]="activeTool() === 'scholarships'"
          [class.text-indigo-700]="activeTool() === 'scholarships'"
          [class.shadow-xs]="activeTool() === 'scholarships'"
          [class.dark:bg-slate-800]="activeTool() === 'scholarships'"
          [class.dark:text-indigo-300]="activeTool() === 'scholarships'"
        >
          <mat-icon class="!w-4 !h-4 !text-[16px]">workspace_premium</mat-icon>
          <span>#25 Scholarship Finder ({{ matchedScholarships().length }} Matches)</span>
        </button>

        <button
          type="button"
          (click)="activeTool.set('loans')"
          class="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          [class.bg-white]="activeTool() === 'loans'"
          [class.text-indigo-700]="activeTool() === 'loans'"
          [class.shadow-xs]="activeTool() === 'loans'"
          [class.dark:bg-slate-800]="activeTool() === 'loans'"
          [class.dark:text-indigo-300]="activeTool() === 'loans'"
        >
          <mat-icon class="!w-4 !h-4 !text-[16px]">account_balance_wallet</mat-icon>
          <span>#26 Education Loan & EMI Guide</span>
        </button>

        <button
          type="button"
          (click)="activeTool.set('roi')"
          class="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          [class.bg-white]="activeTool() === 'roi'"
          [class.text-indigo-700]="activeTool() === 'roi'"
          [class.shadow-xs]="activeTool() === 'roi'"
          [class.dark:bg-slate-800]="activeTool() === 'roi'"
          [class.dark:text-indigo-300]="activeTool() === 'roi'"
        >
          <mat-icon class="!w-4 !h-4 !text-[16px]">trending_up</mat-icon>
          <span>#27 ROI Score & Payback</span>
        </button>
      </div>

      <!-- TOOL 1 (#24): TRUE 4-YEAR COST CALCULATOR -->
      @if (activeTool() === 'cost') {
        <div class="grid gap-6 lg:grid-cols-3">
          <section class="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">
                Pre-fill Official Fees from College or Customize
              </h2>
              <select
                [value]="selectedCollegeId()"
                (change)="onLoadCollegeFees($event)"
                aria-label="Pre-fill fees from college"
                class="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-950"
              >
                @for (c of api.colleges(); track c.id) {
                  <option [value]="c.id">{{ c.shortName }} (₹{{ (c.fees.tuitionPerYearInr.value ?? 0).toLocaleString('en-IN') }}/yr)</option>
                }
              </select>
            </div>

            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-xs">
              <div>
                <label for="cost-tuition" class="block font-semibold mb-1">Annual Tuition (INR)</label>
                <input id="cost-tuition" type="number" [value]="tuitionPerYear()" (input)="onNumInput(tuitionPerYear, $event)" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono tabular-nums dark:border-slate-700 dark:bg-slate-950" />
              </div>
              <div>
                <label for="cost-hostel" class="block font-semibold mb-1">Annual Hostel Room (INR)</label>
                <input id="cost-hostel" type="number" [value]="hostelPerYear()" (input)="onNumInput(hostelPerYear, $event)" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono tabular-nums dark:border-slate-700 dark:bg-slate-950" />
              </div>
              <div>
                <label for="cost-mess" class="block font-semibold mb-1">Annual Mess & Food (INR)</label>
                <input id="cost-mess" type="number" [value]="messPerYear()" (input)="onNumInput(messPerYear, $event)" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono tabular-nums dark:border-slate-700 dark:bg-slate-950" />
              </div>
              <div>
                <label for="cost-exam" class="block font-semibold mb-1">Exam & Lab Fees/Yr (INR)</label>
                <input id="cost-exam" type="number" [value]="examPerYear()" (input)="onNumInput(examPerYear, $event)" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono tabular-nums dark:border-slate-700 dark:bg-slate-950" />
              </div>
              <div>
                <label for="cost-onetime" class="block font-semibold mb-1">One-Time Admission (INR)</label>
                <input id="cost-onetime" type="number" [value]="oneTimeFee()" (input)="onNumInput(oneTimeFee, $event)" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono tabular-nums dark:border-slate-700 dark:bg-slate-950" />
              </div>
              <div>
                <label for="cost-books" class="block font-semibold mb-1">Books & Laptop/Yr (INR)</label>
                <input id="cost-books" type="number" [value]="booksPerYear()" (input)="onNumInput(booksPerYear, $event)" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono tabular-nums dark:border-slate-700 dark:bg-slate-950" />
              </div>
              <div>
                <label for="cost-travel" class="block font-semibold mb-1">Home Travel/Yr (INR)</label>
                <input id="cost-travel" type="number" [value]="travelPerYear()" (input)="onNumInput(travelPerYear, $event)" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono tabular-nums dark:border-slate-700 dark:bg-slate-950" />
              </div>
              <div>
                <label for="cost-misc" class="block font-semibold mb-1">Miscellaneous/Yr (INR)</label>
                <input id="cost-misc" type="number" [value]="miscPerYear()" (input)="onNumInput(miscPerYear, $event)" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono tabular-nums dark:border-slate-700 dark:bg-slate-950" />
              </div>
              <div>
                <label for="cost-inc" class="block font-semibold mb-1">Annual Fee Hike (%)</label>
                <input id="cost-inc" type="number" min="0" max="20" [value]="annualIncreasePercent()" (input)="onNumInput(annualIncreasePercent, $event)" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono tabular-nums dark:border-slate-700 dark:bg-slate-950" />
              </div>
            </div>
          </section>

          <!-- Output Summary & Year-by-Year Chart -->
          <section class="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900">
            @let costOut = computedCost();
            <div>
              <div class="text-xs text-slate-500">Grand Total 4-Year B.Tech Cost</div>
              <div class="mt-1 font-mono text-2xl font-bold text-indigo-700 dark:text-indigo-400 tabular-nums">
                ₹{{ costOut.grandTotal4YearsInr.toLocaleString('en-IN') }}
              </div>
            </div>

            <!-- Year 1 to Year 4 Bar Chart -->
            <div class="space-y-2.5 pt-2 text-xs">
              <div class="font-bold text-slate-800 dark:text-slate-200">Year-by-Year Expenditure Chart:</div>
              @for (yr of costOut.yearlyBreakdown; track yr.year) {
                <div>
                  <div class="flex justify-between font-mono text-[11px] tabular-nums mb-1">
                    <span>Year {{ yr.year }}</span>
                    <span class="font-bold">₹{{ yr.netYearCost.toLocaleString('en-IN') }}</span>
                  </div>
                  <div class="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      class="h-full rounded-full bg-indigo-600"
                      [style.width.%]="costOut.grandTotal4YearsInr > 0 ? Math.min(100, (yr.netYearCost / (costOut.grandTotal4YearsInr * 0.35)) * 100) : 0"
                    ></div>
                  </div>
                </div>
              }
            </div>
          </section>
        </div>
      }

      <!-- TOOL 2 (#25): SCHOLARSHIP FINDER + PLAIN-LANGUAGE AI EXPLANATION -->
      @if (activeTool() === 'scholarships') {
        <section class="rounded-2xl border border-slate-200 bg-white p-6 space-y-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">
            Match Scholarships by Category, Class 12 Marks, Family Income, State & Gender
          </h2>

          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 text-xs">
            <div>
              <label for="sch-cat" class="block font-semibold mb-1">Category</label>
              <select id="sch-cat" [value]="schCategory()" (change)="onSchCatChange($event)" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
                <option value="GEN">General (GEN)</option>
                <option value="OBC-NCL">OBC-NCL</option>
                <option value="EWS">EWS</option>
                <option value="SC">SC</option>
                <option value="ST">ST</option>
              </select>
            </div>
            <div>
              <label for="sch-gender" class="block font-semibold mb-1">Gender</label>
              <select id="sch-gender" [value]="schGender()" (change)="onSchGenderChange($event)" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label for="sch-income" class="block font-semibold mb-1">Family Income (₹ Lakhs/yr)</label>
              <input id="sch-income" type="number" step="0.5" [value]="schIncomeLakhs()" (input)="onNumInput(schIncomeLakhs, $event)" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono tabular-nums dark:border-slate-700 dark:bg-slate-950" />
            </div>
            <div>
              <label for="sch-marks" class="block font-semibold mb-1">Class 12 Marks (%)</label>
              <input id="sch-marks" type="number" [value]="schMarksPercent()" (input)="onNumInput(schMarksPercent, $event)" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono tabular-nums dark:border-slate-700 dark:bg-slate-950" />
            </div>
            <div>
              <label for="sch-state" class="block font-semibold mb-1">Home State</label>
              <input id="sch-state" type="text" [value]="schState()" (input)="onSchStateInput($event)" class="w-full rounded-xl border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
            </div>
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            @for (sch of matchedScholarships(); track sch.id) {
              <article class="rounded-xl border border-slate-200 p-5 space-y-3 text-xs dark:border-slate-800">
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <span class="font-bold text-teal-700 dark:text-teal-400">{{ sch.providerType }}</span>
                    <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">{{ sch.name }}</h3>
                  </div>
                  <app-data-badge [field]="sch.annualAmountInr" [formatAsInr]="true" suffix="/yr" [fallbackUrl]="sch.officialUrl" />
                </div>

                <div>
                  <app-data-badge [field]="sch.benefitDescription" [fallbackUrl]="sch.officialUrl" />
                </div>

                <div class="text-slate-500">
                  Deadline: <app-data-badge [field]="sch.deadline" [fallbackUrl]="sch.officialUrl" />
                </div>

                <div>
                  <div class="font-bold text-slate-800 dark:text-slate-200 mb-1">Documents Needed:</div>
                  <ul class="list-disc pl-4 space-y-0.5 text-slate-600 dark:text-slate-400">
                    @for (doc of sch.documentsNeeded; track doc) {
                      <li>{{ doc }}</li>
                    }
                  </ul>
                </div>

                <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    (click)="explainScholarshipWithAi(sch)"
                    class="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-1.5 font-semibold text-indigo-800 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-200 cursor-pointer"
                  >
                    <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">auto_awesome</mat-icon>
                    <span>Plain-Language AI Guide</span>
                  </button>

                  <a [href]="sch.officialUrl" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 font-semibold text-teal-700 hover:underline dark:text-teal-400">
                    <span>Official Portal</span>
                    <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">open_in_new</mat-icon>
                  </a>
                </div>
              </article>
            }
          </div>

          @if (activeScholarshipExplanation()) {
            @let exp = activeScholarshipExplanation()!;
            <div class="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 text-xs space-y-2 dark:border-indigo-800 dark:bg-indigo-950/40">
              <div class="font-bold text-indigo-900 dark:text-indigo-200">Plain-Language AI Scholarship Guide:</div>
              <p class="text-slate-800 dark:text-slate-200">{{ exp.plainLanguageExplanation }}</p>
              <div class="font-semibold">Common Rejection Reasons to Avoid:</div>
              <ul class="list-disc pl-4 text-slate-700 dark:text-slate-300">
                @for (r of exp.commonRejectionReasons; track r) {
                  <li>{{ r }}</li>
                }
              </ul>
              <app-ai-disclaimer [textToReadOrTranslate]="exp.plainLanguageExplanation" />
            </div>
          }
        </section>
      }

      <!-- TOOL 3 (#26): EDUCATION LOAN GUIDE & EMI CALCULATOR -->
      @if (activeTool() === 'loans') {
        <div class="grid gap-6 lg:grid-cols-2">
          <section class="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900">
            <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">
              Education Loan Monthly EMI Calculator
            </h2>

            <div class="grid gap-4 sm:grid-cols-3 text-xs">
              <div>
                <label for="loan-principal" class="block font-semibold mb-1">Loan Principal (INR)</label>
                <input id="loan-principal" type="number" step="50000" [value]="loanPrincipalInr()" (input)="onNumInput(loanPrincipalInr, $event)" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono tabular-nums dark:border-slate-700 dark:bg-slate-950" />
              </div>
              <div>
                <label for="loan-rate" class="block font-semibold mb-1">Interest Rate (% p.a.)</label>
                <input id="loan-rate" type="number" step="0.25" [value]="loanRatePercent()" (input)="onNumInput(loanRatePercent, $event)" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono tabular-nums dark:border-slate-700 dark:bg-slate-950" />
              </div>
              <div>
                <label for="loan-tenure" class="block font-semibold mb-1">Repayment Tenure (Yrs)</label>
                <input id="loan-tenure" type="number" min="1" max="15" [value]="loanTenureYears()" (input)="onNumInput(loanTenureYears, $event)" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono tabular-nums dark:border-slate-700 dark:bg-slate-950" />
              </div>
            </div>

            @let emi = computedEmi();
            <div class="grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-4 text-xs dark:bg-slate-800/60">
              <div>
                <div class="text-slate-500">Monthly EMI</div>
                <div class="mt-0.5 font-mono text-base font-bold text-indigo-700 dark:text-indigo-400 tabular-nums">
                  ₹{{ emi.monthlyEmiInr.toLocaleString('en-IN') }}/mo
                </div>
              </div>
              <div>
                <div class="text-slate-500">Total Interest</div>
                <div class="mt-0.5 font-mono text-base font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                  ₹{{ emi.totalInterestInr.toLocaleString('en-IN') }}
                </div>
              </div>
              <div>
                <div class="text-slate-500">Total Payable</div>
                <div class="mt-0.5 font-mono text-base font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                  ₹{{ emi.totalPayableInr.toLocaleString('en-IN') }}
                </div>
              </div>
            </div>
          </section>

          <section class="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 text-xs dark:border-slate-800 dark:bg-slate-900">
            <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">
              Official Government & Bank Sources Only (No Private Loan Agents)
            </h2>
            <ul class="list-disc pl-4 space-y-1.5 text-slate-700 dark:text-slate-300">
              <li><strong>Collateral-Free Up to ₹7.5 Lakh:</strong> Under the Government of India Credit Guarantee Fund Scheme for Education Loans (CGFSEL), banks do not require collateral up to ₹7.5 Lakh.</li>
              <li><strong>CSIS / PM-Vidyalaxmi Interest Subsidy:</strong> Students with family income up to ₹4.5 Lakh/year in NBA-accredited / NAAC / INI technical courses get 100% moratorium interest subsidy.</li>
              <li><strong>SBI Scholar Loan Scheme:</strong> Offers collateral-free loans up to ₹20L–₹40L at concessional rates for premier IITs, NITs, BITS, and IIITs.</li>
            </ul>

            <div class="flex flex-wrap gap-3 pt-2">
              <a href="https://www.vidyalakshmi.co.in" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 rounded-xl border border-slate-300 px-3 py-2 font-semibold text-indigo-700 hover:bg-slate-100 dark:border-slate-700 dark:text-indigo-400">
                <span>Official Vidya Lakshmi Portal</span>
                <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">open_in_new</mat-icon>
              </a>
              <a href="https://www.jansamarth.in" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 rounded-xl border border-slate-300 px-3 py-2 font-semibold text-indigo-700 hover:bg-slate-100 dark:border-slate-700 dark:text-indigo-400">
                <span>JanSamarth Central Subsidy Portal</span>
                <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">open_in_new</mat-icon>
              </a>
            </div>
          </section>
        </div>
      }

      <!-- TOOL 4 (#27): ROI SCORE & PAYBACK CALCULATOR -->
      @if (activeTool() === 'roi') {
        <section class="rounded-2xl border border-slate-200 bg-white p-6 space-y-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">
            ROI Score & Payback Period Calculator
          </h2>

          <div class="grid gap-4 sm:grid-cols-2 text-xs">
            <div>
              <label for="roi-cost" class="block font-semibold mb-1">Total 4-Year Net Cost (INR)</label>
              <input id="roi-cost" type="number" step="50000" [value]="roiCostInput()" (input)="onNumInput(roiCostInput, $event)" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono tabular-nums dark:border-slate-700 dark:bg-slate-950" />
            </div>
            <div>
              <label for="roi-salary" class="block font-semibold mb-1">Verified Median Starting Salary (INR/Year)</label>
              <input id="roi-salary" type="number" step="50000" [value]="roiSalaryInput()" (input)="onNumInput(roiSalaryInput, $event)" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono tabular-nums dark:border-slate-700 dark:bg-slate-950" />
            </div>
          </div>

          @let roiOut = computedRoi();
          <div class="grid gap-4 sm:grid-cols-3 text-xs">
            <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <div class="text-slate-500">Payback Period</div>
              <div class="mt-1 font-mono text-2xl font-bold text-teal-700 dark:text-teal-400 tabular-nums">
                {{ roiOut.paybackPeriodYears !== null ? roiOut.paybackPeriodYears + ' Years' : 'Cannot Compute' }}
              </div>
              <div class="mt-1 font-semibold">{{ roiOut.roiRating }}</div>
            </div>
            <div class="sm:col-span-2 rounded-xl border border-slate-200 p-4 space-y-1.5 dark:border-slate-800">
              <div class="font-mono text-indigo-700 dark:text-indigo-300 font-semibold">{{ roiOut.formula }}</div>
              <p class="text-slate-600 dark:text-slate-400 leading-relaxed"><strong>Caveat:</strong> {{ roiOut.caveat }}</p>
            </div>
          </div>
        </section>
      }
    </div>
  `,
})
export class MoneyHubPage {
  readonly api = inject(ApiService);
  readonly profileStore = inject(ProfileStorageService);
  protected readonly Math = Math;

  readonly activeTool = signal<'cost' | 'scholarships' | 'loans' | 'roi'>('cost');

  // Cost Calculator Signals
  readonly selectedCollegeId = signal<string>('nit-trichy');
  readonly tuitionPerYear = signal<number>(125000);
  readonly hostelPerYear = signal<number>(24000);
  readonly messPerYear = signal<number>(38000);
  readonly examPerYear = signal<number>(18500);
  readonly oneTimeFee = signal<number>(16950);
  readonly booksPerYear = signal<number>(12000);
  readonly travelPerYear = signal<number>(10000);
  readonly miscPerYear = signal<number>(12000);
  readonly annualIncreasePercent = signal<number>(0);

  // Scholarship Matcher Signals
  readonly schCategory = signal<string>(this.profileStore.profile().category || 'GEN');
  readonly schGender = signal<string>(this.profileStore.profile().gender || 'Female');
  readonly schIncomeLakhs = signal<number>(this.profileStore.profile().familyIncomeLakhs || 4.5);
  readonly schMarksPercent = signal<number>(this.profileStore.profile().class12Percent || 84);
  readonly schState = signal<string>(this.profileStore.profile().homeState || 'Maharashtra');
  readonly activeScholarshipExplanation = signal<AiScholarshipExplainResponse | null>(null);

  // Loan EMI Signals
  readonly loanPrincipalInr = signal<number>(800000);
  readonly loanRatePercent = signal<number>(8.5);
  readonly loanTenureYears = signal<number>(10);

  // ROI Signals
  readonly roiCostInput = signal<number>(920000);
  readonly roiSalaryInput = signal<number>(1576000);

  readonly computedCost = computed(() =>
    calculateTrue4YearCost({
      tuitionPerYearInr: this.tuitionPerYear(),
      hostelPerYearInr: this.hostelPerYear(),
      messPerYearInr: this.messPerYear(),
      examAndLabPerYearInr: this.examPerYear(),
      oneTimeAdmissionInr: this.oneTimeFee(),
      booksAndSuppliesPerYearInr: this.booksPerYear(),
      travelPerYearInr: this.travelPerYear(),
      miscPerYearInr: this.miscPerYear(),
      annualFeeIncreasePercent: this.annualIncreasePercent(),
      scholarshipPerYearInr: 0,
    })
  );

  readonly matchedScholarships = computed(() =>
    matchScholarships(
      {
        category: this.schCategory(),
        gender: this.schGender(),
        familyIncomeLakhs: this.schIncomeLakhs(),
        marksPercent: this.schMarksPercent(),
        state: this.schState(),
      },
      this.api.scholarships()
    )
  );

  readonly computedEmi = computed(() =>
    calculateEducationLoanEmi(
      this.loanPrincipalInr(),
      this.loanRatePercent(),
      this.loanTenureYears()
    )
  );

  readonly computedRoi = computed(() =>
    calculateRoiScore({
      total4YearCostInr: this.roiCostInput(),
      medianAnnualSalaryInr: this.roiSalaryInput(),
    })
  );

  onLoadCollegeFees(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.selectedCollegeId.set(id);
    const col = this.api.colleges().find((c) => c.id === id);
    if (!col) return;
    this.tuitionPerYear.set(col.fees.tuitionPerYearInr.value ?? 0);
    this.hostelPerYear.set(col.fees.hostelPerYearInr.value ?? 0);
    this.messPerYear.set(col.fees.messPerYearInr.value ?? 0);
    this.examPerYear.set(col.fees.examAndLabPerYearInr.value ?? 0);
    this.oneTimeFee.set(col.fees.oneTimeAdmissionInr.value ?? 0);
  }

  onNumInput(targetSignal: {set: (v: number) => void}, event: Event): void {
    const val = Number((event.target as HTMLInputElement).value);
    if (!Number.isNaN(val) && val >= 0) {
      targetSignal.set(val);
    }
  }

  onSchCatChange(event: Event): void {
    this.schCategory.set((event.target as HTMLSelectElement).value);
  }

  onSchGenderChange(event: Event): void {
    this.schGender.set((event.target as HTMLSelectElement).value);
  }

  onSchStateInput(event: Event): void {
    this.schState.set((event.target as HTMLInputElement).value);
  }

  async explainScholarshipWithAi(sch: Scholarship): Promise<void> {
    const res = await this.api.explainScholarship({
      scholarshipId: sch.id,
      studentCategory: this.schCategory(),
      familyIncomeLakhs: this.schIncomeLakhs(),
      marksPercent: this.schMarksPercent(),
    });
    this.activeScholarshipExplanation.set(res);
  }
}
