import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import {ActivatedRoute, RouterLink} from '@angular/router';
import {MatIconModule} from '@angular/material/icon';
import {ReviewCategory} from '../../shared/schemas';
import {
  calculateRoiScore,
  calculateTrue4YearCost,
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

type CollegeTab =
  | 'overview'
  | 'fees'
  | 'admission'
  | 'scholarships'
  | 'placements'
  | 'reviews'
  | 'cost_roi'
  | 'trust'
  | 'hostel_city';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-college-detail-page',
  imports: [
    RouterLink,
    MatIconModule,
    DataBadge,
    AIDisclaimer,
    HowWeCalculateModal,
    StateViews,
  ],
  template: `
    <div class="space-y-6 pb-12">
      <!-- Quick College Switcher Bar -->
      <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-900">
        <div class="flex items-center gap-2">
          <a routerLink="/start" class="inline-flex items-center gap-1 font-semibold text-indigo-700 hover:underline dark:text-indigo-400">
            <mat-icon class="!w-4 !h-4 !text-[16px]">arrow_back</mat-icon>
            <span>All Colleges</span>
          </a>
          <span class="text-slate-300 dark:text-slate-700">/</span>
          <span class="text-slate-600 dark:text-slate-400">Switch College:</span>
          <select
            [value]="collegeId()"
            (change)="onSwitchCollege($event)"
            aria-label="Switch college profile"
            class="rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            @for (c of api.colleges(); track c.id) {
              <option [value]="c.id">{{ c.shortName }} — {{ c.cityInfo.city }}</option>
            }
          </select>
        </div>

        <div class="text-slate-500 dark:text-slate-400">
          {{ i18n.t('banner.lastUpdated') }}: <span class="font-mono tabular-nums">{{ api.meta().lastRefreshed }}</span>
        </div>
      </div>

      @let data = collegeBundle();
      @if (!data.college) {
        <app-state-views
          state="empty"
          title="College not found in dataset"
          message="Select one of the 15 verified engineering colleges from the dropdown above."
          actionLabel="View All Colleges"
          (retryClicked)="selectDefaultCollege()"
        />
      } @else {
        @let col = data.college;

        <!-- College Header Card -->
        <header class="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="space-y-2">
              <div class="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span class="font-semibold text-slate-800 dark:text-slate-200">{{ col.ownership }} Institute</span>
                <span aria-hidden="true">·</span>
                <span>{{ col.cityInfo.city }}, {{ col.cityInfo.state }}</span>
                <span aria-hidden="true">·</span>
                <span>Est. <app-data-badge [field]="col.establishedYear" [fallbackUrl]="col.officialWebsite" /></span>
                <span aria-hidden="true">·</span>
                @if (col.isPartner) {
                  <span class="font-semibold text-teal-700 dark:text-teal-400">{{ i18n.t('common.partnerLabel') }}</span>
                } @else {
                  <span>{{ i18n.t('common.infoOnlyLabel') }}</span>
                }
              </div>

              <h1 class="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
                {{ col.name }} ({{ col.shortName }})
              </h1>

              <div class="flex flex-wrap items-center gap-4 pt-1 text-xs">
                <a
                  [href]="col.officialWebsite"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1 font-semibold text-indigo-700 hover:underline dark:text-indigo-400"
                >
                  <span>Official Portal ({{ col.officialWebsite }})</span>
                  <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">open_in_new</mat-icon>
                </a>
                <button
                  type="button"
                  (click)="showFormulaModal.set(true)"
                  class="inline-flex items-center gap-1 font-semibold text-teal-700 hover:underline dark:text-teal-400 cursor-pointer"
                >
                  <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">calculate</mat-icon>
                  <span>{{ i18n.t('action.howWeCalculate') }}</span>
                </button>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex flex-wrap items-center gap-2">
              <button
                type="button"
                (click)="toggleCompare(col.id)"
                class="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 cursor-pointer"
              >
                <mat-icon class="!w-4 !h-4 !text-[16px]">compare_arrows</mat-icon>
                <span>{{ profileStore.compareIds().includes(col.id) ? 'Added to Compare' : 'Add to Compare' }}</span>
              </button>

              @if (col.isPartner) {
                <a
                  routerLink="/apply"
                  [queryParams]="{collegeId: col.id}"
                  class="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
                >
                  <mat-icon class="!w-4 !h-4 !text-[16px]">send</mat-icon>
                  <span>Apply via Common App</span>
                </a>
              }
            </div>
          </div>

          <!-- Cached Precomputed Ranking Strip -->
          @if (col.rankingMetrics) {
            <div class="mt-6 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-5 dark:border-slate-800 text-xs">
              <div>
                <div class="text-slate-500">Overall Fair Score</div>
                <div class="font-mono text-lg font-bold text-indigo-700 dark:text-indigo-400 tabular-nums">
                  {{ col.rankingMetrics.overallFairScore }}/100
                </div>
              </div>
              <div>
                <div class="text-slate-500">Affordability</div>
                <div class="font-mono text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                  {{ col.rankingMetrics.affordabilityScore }}/100
                </div>
              </div>
              <div>
                <div class="text-slate-500">Placement Strength</div>
                <div class="font-mono text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                  {{ col.rankingMetrics.placementStrengthScore }}/100
                </div>
              </div>
              <div>
                <div class="text-slate-500">Value for Money</div>
                <div class="font-mono text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                  {{ col.rankingMetrics.valueForMoneyScore }}/100
                </div>
              </div>
              <div>
                <div class="text-slate-500">Trust & Approvals</div>
                <div class="font-mono text-lg font-bold text-teal-700 dark:text-teal-400 tabular-nums">
                  {{ col.rankingMetrics.trustScore }}/100
                </div>
              </div>
            </div>
          }
        </header>

        <!-- 9 Required Navigation Tabs -->
        <nav aria-label="College information sections" class="flex overflow-x-auto gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1.5 dark:border-slate-800 dark:bg-slate-900">
          @for (tab of tabs; track tab.id) {
            <button
              type="button"
              (click)="activeTab.set(tab.id)"
              class="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              [class.bg-white]="activeTab() === tab.id"
              [class.text-indigo-700]="activeTab() === tab.id"
              [class.shadow-xs]="activeTab() === tab.id"
              [class.dark:bg-slate-800]="activeTab() === tab.id"
              [class.dark:text-indigo-300]="activeTab() === tab.id"
              [class.text-slate-600]="activeTab() !== tab.id"
              [class.dark:text-slate-400]="activeTab() !== tab.id"
            >
              <mat-icon class="!w-4 !h-4 !text-[16px]">{{ tab.icon }}</mat-icon>
              <span>{{ tab.label }}</span>
            </button>
          }
        </nav>

        <!-- TAB 1: OVERVIEW -->
        @if (activeTab() === 'overview') {
          <section class="rounded-2xl border border-slate-200 bg-white p-6 space-y-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100">
              Academic Overview & B.Tech / B.E. Courses Offered
            </h2>

            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs border-collapse">
                <thead>
                  <tr class="border-b border-slate-200 text-slate-500 dark:border-slate-800">
                    <th class="py-2.5 pr-4 font-semibold">Course Name</th>
                    <th class="py-2.5 px-4 font-semibold">Branch Code</th>
                    <th class="py-2.5 px-4 font-semibold">Duration</th>
                    <th class="py-2.5 px-4 font-semibold">Annual Intake Seats</th>
                    <th class="py-2.5 pl-4 font-semibold">NBA Accredited</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                  @for (course of col.courses; track course.id) {
                    <tr>
                      <td class="py-3 pr-4 font-semibold text-slate-900 dark:text-slate-100">{{ course.name }}</td>
                      <td class="py-3 px-4 font-mono">{{ course.branchCode }}</td>
                      <td class="py-3 px-4 font-mono tabular-nums">{{ course.durationYears }} Years</td>
                      <td class="py-3 px-4">
                        <app-data-badge [field]="course.intakeSeats" [fallbackUrl]="col.officialWebsite" />
                      </td>
                      <td class="py-3 pl-4">
                        <app-data-badge [field]="course.NBAStatus" [fallbackUrl]="col.officialWebsite" />
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }

        <!-- TAB 2: FEES -->
        @if (activeTab() === 'fees') {
          <section class="rounded-2xl border border-slate-200 bg-white p-6 space-y-6 dark:border-slate-800 dark:bg-slate-900">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100">
                Verified Official Fee Structure
              </h2>
              <a routerLink="/fees" class="text-xs font-semibold text-indigo-700 hover:underline dark:text-indigo-400">
                Have a brochure PDF/text? Run Hidden Fee Detector →
              </a>
            </div>

            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-xs">
              <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <div class="text-slate-500">Tuition Fee (Per Year)</div>
                <div class="mt-1 text-base">
                  <app-data-badge [field]="col.fees.tuitionPerYearInr" [formatAsInr]="true" suffix="/year" [fallbackUrl]="col.officialWebsite" />
                </div>
              </div>
              <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <div class="text-slate-500">Hostel Room Fee (Per Year)</div>
                <div class="mt-1 text-base">
                  <app-data-badge [field]="col.fees.hostelPerYearInr" [formatAsInr]="true" suffix="/year" [fallbackUrl]="col.officialWebsite" />
                </div>
              </div>
              <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <div class="text-slate-500">Mess & Dining Advance (Per Year)</div>
                <div class="mt-1 text-base">
                  <app-data-badge [field]="col.fees.messPerYearInr" [formatAsInr]="true" suffix="/year" [fallbackUrl]="col.officialWebsite" />
                </div>
              </div>
              <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <div class="text-slate-500">Exam, Lab & Other Annual Charges</div>
                <div class="mt-1 text-base">
                  <app-data-badge [field]="col.fees.examAndLabPerYearInr" [formatAsInr]="true" suffix="/year" [fallbackUrl]="col.officialWebsite" />
                </div>
              </div>
              <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <div class="text-slate-500">One-Time Admission Fee</div>
                <div class="mt-1 text-base">
                  <app-data-badge [field]="col.fees.oneTimeAdmissionInr" [formatAsInr]="true" suffix=" (One-time)" [fallbackUrl]="col.officialWebsite" />
                </div>
              </div>
              <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <div class="text-slate-500">Refundable Caution Deposit</div>
                <div class="mt-1 text-base">
                  <app-data-badge [field]="col.fees.cautionDepositRefundableInr" [formatAsInr]="true" suffix=" (Refundable)" [fallbackUrl]="col.officialWebsite" />
                </div>
              </div>
            </div>
          </section>
        }

        <!-- TAB 3: HOW TO GET ADMISSION -->
        @if (activeTab() === 'admission') {
          <section class="rounded-2xl border border-slate-200 bg-white p-6 space-y-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100">
              How to Get Admission & Official Cutoffs
            </h2>

            <div class="grid gap-4 md:grid-cols-2">
              @for (route of col.admissionRoutes; track route.label) {
                <div class="rounded-xl border border-slate-200 p-4 space-y-2 dark:border-slate-800">
                  <div class="text-xs font-bold text-indigo-700 dark:text-indigo-400">
                    Route: {{ route.label }}
                  </div>
                  <div class="text-xs text-slate-700 dark:text-slate-300">
                    <app-data-badge [field]="route.explanation" [fallbackUrl]="route.officialAdmissionUrl" />
                  </div>
                  <div class="text-xs text-slate-500">
                    Application / Exam Fee: <app-data-badge [field]="route.applicationFeeInr" [formatAsInr]="true" [fallbackUrl]="route.officialAdmissionUrl" />
                  </div>
                  <div class="pt-1">
                    <a
                      [href]="route.officialAdmissionUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline dark:text-teal-400"
                    >
                      <span>Official Admission / Counselling Portal</span>
                      <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">open_in_new</mat-icon>
                    </a>
                  </div>
                </div>
              }
            </div>

            <div class="space-y-2 pt-2">
              <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">
                Previous-Year Closing Cutoffs for {{ col.shortName }}
              </h3>
              @if (collegeCutoffs().length === 0) {
                <p class="text-xs text-amber-800 dark:text-amber-300">
                  {{ i18n.t('common.notVerified') }} — check {{ col.officialWebsite }} for category-wise cutoffs.
                </p>
              } @else {
                <div class="overflow-x-auto">
                  <table class="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr class="border-b border-slate-200 text-slate-500 dark:border-slate-800">
                        <th class="py-2 pr-4">Branch</th>
                        <th class="py-2 px-4">Exam</th>
                        <th class="py-2 px-4">Category</th>
                        <th class="py-2 px-4">Year</th>
                        <th class="py-2 pl-4">Closing Rank / Percentile / Score</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                      @for (cut of collegeCutoffs(); track cut.id) {
                        <tr>
                          <td class="py-2.5 pr-4 font-medium">{{ cut.branchName }}</td>
                          <td class="py-2.5 px-4">{{ cut.examName }}</td>
                          <td class="py-2.5 px-4 font-mono">{{ cut.category }}</td>
                          <td class="py-2.5 px-4 font-mono tabular-nums">{{ cut.year }}</td>
                          <td class="py-2.5 pl-4">
                            <app-data-badge [field]="cut.closingValue" [suffix]="' (' + cut.metricType + ')'" [fallbackUrl]="col.officialWebsite" />
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          </section>
        }

        <!-- TAB 4: SCHOLARSHIPS -->
        @if (activeTab() === 'scholarships') {
          <section class="rounded-2xl border border-slate-200 bg-white p-6 space-y-6 dark:border-slate-800 dark:bg-slate-900">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100">
                Institute Fee Waivers & National Scholarships
              </h2>
              <a routerLink="/money" class="text-xs font-semibold text-indigo-700 hover:underline dark:text-indigo-400">
                Open Personalised Scholarship Matcher →
              </a>
            </div>

            <div class="rounded-xl border border-teal-200 bg-teal-50/50 p-4 dark:border-teal-900 dark:bg-teal-950/40">
              <div class="text-xs font-bold text-teal-900 dark:text-teal-200">
                Institute-Specific Fee Waiver / Scholarship Policy:
              </div>
              <div class="mt-1 text-xs text-slate-800 dark:text-slate-200">
                <app-data-badge [field]="col.fees.scholarshipNote" [fallbackUrl]="col.officialWebsite" />
              </div>
            </div>

            <div class="grid gap-4 md:grid-cols-2">
              @for (sch of api.scholarships(); track sch.id) {
                <div class="rounded-xl border border-slate-200 p-4 space-y-2 dark:border-slate-800">
                  <div class="text-sm font-bold text-slate-900 dark:text-slate-100">{{ sch.name }}</div>
                  <div class="text-xs text-slate-600 dark:text-slate-400">
                    <app-data-badge [field]="sch.benefitDescription" [fallbackUrl]="sch.officialUrl" />
                  </div>
                  <div class="text-xs text-slate-500">
                    Income Cap: <app-data-badge [field]="sch.maxIncomeLakhs" prefix="₹" suffix=" Lakh/yr" [fallbackUrl]="sch.officialUrl" />
                  </div>
                </div>
              }
            </div>
          </section>
        }

        <!-- TAB 5: PLACEMENTS (Feature 17: Placement Reality Check) -->
        @if (activeTab() === 'placements') {
          <section class="rounded-2xl border border-slate-200 bg-white p-6 space-y-6 dark:border-slate-800 dark:bg-slate-900">
            <div>
              <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100">
                Placement Reality Check (NIRF {{ col.placements.year }} Verified Data)
              </h2>
              <p class="mt-1 text-xs text-slate-600 dark:text-slate-400">
                We always show the official NIRF 4-year UG median salary first—never just the single highest package used in marketing banners.
              </p>
            </div>

            <!-- Warning when headline highest package differs dramatically from median -->
            @if (hasLargeHeadlineGap(col.placements.medianSalaryInr.value, col.placements.highestSalaryInr.value)) {
              <div class="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200" role="alert">
                <div class="flex items-start gap-2.5">
                  <mat-icon class="text-amber-700 dark:text-amber-400 shrink-0">warning_amber</mat-icon>
                  <div>
                    <div class="font-bold">Headline Package Reality Warning</div>
                    <p class="mt-0.5 leading-relaxed">
                      The advertised highest package is more than 3× higher than the typical student’s median salary. Plan your education loan and ROI strictly using the <span class="font-semibold">Median Salary</span> below, which represents the 50th-percentile graduate.
                    </p>
                  </div>
                </div>
              </div>
            }

            <div class="grid gap-4 sm:grid-cols-3">
              <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <div class="text-xs text-slate-500">Verified Median Salary (50th Percentile)</div>
                <div class="mt-1 text-lg">
                  <app-data-badge [field]="col.placements.medianSalaryInr" [formatAsInr]="true" suffix="/yr" [fallbackUrl]="col.officialWebsite" />
                </div>
              </div>
              <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <div class="text-xs text-slate-500">Headline Highest Package</div>
                <div class="mt-1 text-lg">
                  <app-data-badge [field]="col.placements.highestSalaryInr" [formatAsInr]="true" suffix="/yr" [fallbackUrl]="col.officialWebsite" />
                </div>
              </div>
              <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <div class="text-xs text-slate-500">Graduating Batch Placed (%)</div>
                <div class="mt-1 text-lg">
                  <app-data-badge [field]="col.placements.placedPercent" suffix="%" [fallbackUrl]="col.officialWebsite" />
                </div>
              </div>
            </div>

            <!-- Visual Comparison Bar Chart -->
            <div class="rounded-xl border border-slate-200 p-4 space-y-3 dark:border-slate-800">
              <div class="text-xs font-bold text-slate-800 dark:text-slate-200">
                Visual Comparison: Realistic Median vs Headline Highest
              </div>
              @let medVal = col.placements.medianSalaryInr.value || 0;
              @let highVal = col.placements.highestSalaryInr.value || medVal;
              @let maxBar = highVal > medVal ? highVal : (medVal || 2500000);

              <div class="space-y-2 text-xs">
                <div>
                  <div class="flex justify-between mb-1">
                    <span class="font-medium text-teal-800 dark:text-teal-300">Realistic Median Salary (Use this for ROI)</span>
                    <span class="font-mono font-bold tabular-nums">₹{{ medVal.toLocaleString('en-IN') }}/yr</span>
                  </div>
                  <div class="h-4 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      class="h-full rounded-full bg-teal-600"
                      [style.width.%]="maxBar > 0 ? Math.min(100, Math.round((medVal / maxBar) * 100)) : 0"
                    ></div>
                  </div>
                </div>

                @if (col.placements.highestSalaryInr.value !== null) {
                  <div>
                    <div class="flex justify-between mb-1">
                      <span class="font-medium text-amber-800 dark:text-amber-300">Headline Highest Package (Outlier offer)</span>
                      <span class="font-mono font-bold tabular-nums">₹{{ highVal.toLocaleString('en-IN') }}/yr</span>
                    </div>
                    <div class="h-4 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div class="h-full rounded-full bg-amber-500 w-full"></div>
                    </div>
                  </div>
                }
              </div>
            </div>

            <div class="text-xs">
              <span class="font-semibold text-slate-700 dark:text-slate-300">Top Verified Recruiters: </span>
              <app-data-badge [field]="col.placements.topRecruiters" [fallbackUrl]="col.officialWebsite" />
            </div>
          </section>
        }

        <!-- TAB 6: REVIEWS (Features 13 & 14: Review Summary + Authentic Review Filter) -->
        @if (activeTab() === 'reviews') {
          <section class="rounded-2xl border border-slate-200 bg-white p-6 space-y-6 dark:border-slate-800 dark:bg-slate-900">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Review Summary & Deterministic Authenticity Filter
                </h2>
                <p class="mt-1 text-xs text-indigo-800 dark:text-indigo-300 font-medium">
                  {{ i18n.t('common.reviewSignalNote') }} Only short snippets and source links are stored—never full copied reviews.
                </p>
              </div>

              <!-- Filter Controls -->
              <div class="flex flex-wrap items-center gap-2 text-xs">
                <select
                  [value]="selectedReviewCategory()"
                  (change)="onReviewCatChange($event)"
                  aria-label="Filter reviews by category"
                  class="rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-medium dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="ALL">All Categories</option>
                  <option value="placement">Placement</option>
                  <option value="hostel">Hostel</option>
                  <option value="faculty">Faculty</option>
                  <option value="campus">Campus</option>
                  <option value="fees">Fees</option>
                </select>

                <label class="inline-flex items-center gap-1.5 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    [checked]="hideLowAuthenticity()"
                    (change)="hideLowAuthenticity.set(!hideLowAuthenticity())"
                    class="rounded border-slate-300 text-indigo-700"
                  />
                  <span>Hide flagged promotional reviews (&lt;60/100)</span>
                </label>
              </div>
            </div>

            <!-- Category Summaries (AI / Signal-Checked above threshold) -->
            <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              @for (sum of data.summaries; track sum.category) {
                <div class="rounded-xl border border-slate-200 p-3.5 text-xs space-y-1.5 dark:border-slate-800">
                  <div class="flex items-center justify-between">
                    <span class="font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">{{ sum.category }}</span>
                    <span class="font-mono text-[11px] text-slate-500 tabular-nums">
                      {{ sum.verifiedReviewCount }} verified · {{ sum.flaggedReviewCount }} flagged
                    </span>
                  </div>
                  <p class="text-slate-600 dark:text-slate-400 leading-relaxed">
                    {{ sum.summaryText }}
                  </p>
                </div>
              }
            </div>

            <!-- Individual Review Snippets with Authenticity Score & Why Flagged -->
            <div class="space-y-3">
              @for (rev of filteredReviews(); track rev.id) {
                <div
                  class="rounded-xl border p-4 text-xs space-y-2"
                  [class.border-slate-200]="rev.authenticityScore >= 60"
                  [class.dark:border-slate-800]="rev.authenticityScore >= 60"
                  [class.border-amber-300]="rev.authenticityScore < 60"
                  [class.bg-amber-50/40]="rev.authenticityScore < 60"
                  [class.dark:border-amber-800]="rev.authenticityScore < 60"
                >
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <div class="flex items-center gap-2 text-slate-500">
                      <span class="font-semibold text-slate-900 dark:text-slate-100 uppercase">{{ rev.category }}</span>
                      <span>·</span>
                      <span>Rating: <strong class="font-mono tabular-nums">{{ rev.rating }}/5</strong></span>
                      <span>·</span>
                      <span class="font-mono tabular-nums">{{ rev.date }}</span>
                      <span>·</span>
                      <a [href]="rev.sourceUrl" target="_blank" rel="noopener noreferrer" class="underline hover:text-indigo-700">
                        Source: {{ rev.source }}
                      </a>
                    </div>

                    <div class="flex items-center gap-1.5 font-mono font-bold tabular-nums">
                      @if (rev.authenticityScore >= 60) {
                        <mat-icon class="!w-4 !h-4 !text-[16px] text-emerald-600">verified</mat-icon>
                        <span class="text-emerald-800 dark:text-emerald-400">
                          Authenticity Likelihood: {{ rev.authenticityScore }}/100
                        </span>
                      } @else {
                        <mat-icon class="!w-4 !h-4 !text-[16px] text-amber-600">flag</mat-icon>
                        <span class="text-amber-800 dark:text-amber-400">
                          Flagged Signal Score: {{ rev.authenticityScore }}/100
                        </span>
                      }
                    </div>
                  </div>

                  <p class="text-sm text-slate-800 dark:text-slate-200">
                    "{{ rev.shortSnippet }}"
                  </p>

                  <div class="text-[11px] text-slate-500 dark:text-slate-400">
                    <strong>Signal reasons:</strong> {{ rev.flags.join('; ') }} ({{ i18n.t('common.reviewSignalNote') }})
                  </div>
                </div>
              }
            </div>

            <app-ai-disclaimer />
          </section>
        }

        <!-- TAB 7: COST AND ROI (Features 24 & 27) -->
        @if (activeTab() === 'cost_roi') {
          <section class="rounded-2xl border border-slate-200 bg-white p-6 space-y-6 dark:border-slate-800 dark:bg-slate-900">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100">
                  True 4-Year Cost & ROI Payback Analysis for {{ col.shortName }}
                </h2>
                <p class="text-xs text-slate-600 dark:text-slate-400">
                  Includes tuition, hostel, mess, exam/lab fees, and one-time admission fee over 4 years.
                </p>
              </div>
              <a routerLink="/money" class="text-xs font-semibold text-indigo-700 hover:underline dark:text-indigo-400">
                Customize in Full 4-Year Calculator →
              </a>
            </div>

            @let costSummary = collegeCostAndRoi();
            <div class="grid gap-4 sm:grid-cols-3">
              <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <div class="text-xs text-slate-500">Estimated 4-Year Total Cost</div>
                <div class="mt-1 font-mono text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                  ₹{{ costSummary.cost.grandTotal4YearsInr.toLocaleString('en-IN') }}
                </div>
                <div class="mt-1 text-[11px] text-slate-500">
                  Tuition: ₹{{ costSummary.cost.totalTuition4Years.toLocaleString('en-IN') }} · Hostel/Mess: ₹{{ costSummary.cost.totalLiving4Years.toLocaleString('en-IN') }}
                </div>
              </div>

              <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <div class="text-xs text-slate-500">ROI Payback Period</div>
                <div class="mt-1 font-mono text-xl font-bold text-teal-700 dark:text-teal-400 tabular-nums">
                  {{ costSummary.roi.paybackPeriodYears !== null ? costSummary.roi.paybackPeriodYears + ' Years' : 'Not verified' }}
                </div>
                <div class="mt-1 text-[11px] text-slate-500">
                  Rating: {{ costSummary.roi.roiRating }}
                </div>
              </div>

              <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <div class="text-xs text-slate-500">Formula & Caveat</div>
                <div class="mt-1 font-mono text-[11px] text-indigo-700 dark:text-indigo-300">
                  {{ costSummary.roi.formula }}
                </div>
                <p class="mt-1 text-[11px] text-slate-500">
                  {{ costSummary.roi.caveat }}
                </p>
              </div>
            </div>
          </section>
        }

        <!-- TAB 8: TRUST & APPROVALS -->
        @if (activeTab() === 'trust') {
          <section class="rounded-2xl border border-slate-200 bg-white p-6 space-y-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100">
              Regulatory Approvals & Accreditation Verification
            </h2>

            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-xs">
              <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <div class="text-slate-500">AICTE Statutory Approval</div>
                <div class="mt-1 text-sm">
                  <app-data-badge [field]="col.accreditation.aicteApproved" fallbackUrl="https://www.aicte-india.org" />
                </div>
              </div>
              <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <div class="text-slate-500">UGC University Status</div>
                <div class="mt-1 text-sm">
                  <app-data-badge [field]="col.accreditation.ugcStatus" fallbackUrl="https://www.ugc.gov.in" />
                </div>
              </div>
              <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <div class="text-slate-500">NAAC Grade</div>
                <div class="mt-1 text-sm">
                  <app-data-badge [field]="col.accreditation.naacGrade" fallbackUrl="http://www.naac.gov.in" />
                </div>
              </div>
              <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <div class="text-slate-500">NBA Accredited Branches</div>
                <div class="mt-1 text-sm">
                  <app-data-badge [field]="col.accreditation.nbaAccreditedBranches" [fallbackUrl]="col.officialWebsite" />
                </div>
              </div>
              <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <div class="text-slate-500">NIRF {{ col.accreditation.nirfYear }} Engineering Rank</div>
                <div class="mt-1 text-sm">
                  <app-data-badge [field]="col.accreditation.nirfRank" prefix="#" fallbackUrl="https://www.nirfindia.org/Rankings/2024/EngineeringRanking.html" />
                </div>
              </div>
            </div>
          </section>
        }

        <!-- TAB 9: HOSTEL AND CITY (Feature 19) -->
        @if (activeTab() === 'hostel_city') {
          <section class="rounded-2xl border border-slate-200 bg-white p-6 space-y-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100">
              Hostel, Cost of Living & City Guide ({{ col.cityInfo.city }}, {{ col.cityInfo.state }})
            </h2>

            <div class="grid gap-4 sm:grid-cols-2 text-xs">
              <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <div class="text-slate-500">Estimated Monthly Student Cost of Living (Outside Mess)</div>
                <div class="mt-1 text-sm">
                  <app-data-badge [field]="col.cityInfo.costOfLivingMonthlyInr" [formatAsInr]="true" suffix="/month" [fallbackUrl]="col.officialWebsite" />
                </div>
              </div>

              <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <div class="text-slate-500">Hostel & Mess Annual Fee Range</div>
                <div class="mt-1 text-sm">
                  <app-data-badge [field]="col.cityInfo.hostelFeeRangeAnnualInr" [fallbackUrl]="col.officialWebsite" />
                </div>
              </div>

              <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <div class="text-slate-500">Rail, Metro & Bus Connectivity</div>
                <div class="mt-1 text-sm">
                  <app-data-badge [field]="col.cityInfo.transportNotes" [fallbackUrl]="col.officialWebsite" />
                </div>
              </div>

              <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <div class="text-slate-500">Campus Safety & Medical Notes</div>
                <div class="mt-1 text-sm">
                  <app-data-badge [field]="col.cityInfo.safetyNotes" [fallbackUrl]="col.officialWebsite" />
                </div>
              </div>
            </div>
          </section>
        }
      }

      <app-how-we-calculate-modal
        [isOpen]="showFormulaModal()"
        (closed)="showFormulaModal.set(false)"
      />
    </div>
  `,
})
export class CollegeDetailPage {
  readonly api = inject(ApiService);
  readonly i18n = inject(I18nService);
  readonly profileStore = inject(ProfileStorageService);
  private readonly route = inject(ActivatedRoute);
  protected readonly Math = Math;

  readonly collegeId = signal<string>('iit-madras');
  readonly activeTab = signal<CollegeTab>('overview');
  readonly showFormulaModal = signal<boolean>(false);

  readonly selectedReviewCategory = signal<'ALL' | ReviewCategory>('ALL');
  readonly hideLowAuthenticity = signal<boolean>(false);

  readonly tabs: {id: CollegeTab; label: string; icon: string}[] = [
    {id: 'overview', label: 'Overview', icon: 'dashboard'},
    {id: 'fees', label: 'Fees', icon: 'payments'},
    {id: 'admission', label: 'How to get admission', icon: 'alt_route'},
    {id: 'scholarships', label: 'Scholarships', icon: 'workspace_premium'},
    {id: 'placements', label: 'Placements', icon: 'bar_chart'},
    {id: 'reviews', label: 'Reviews', icon: 'rate_review'},
    {id: 'cost_roi', label: 'Cost and ROI', icon: 'trending_up'},
    {id: 'trust', label: 'Trust', icon: 'verified_user'},
    {id: 'hostel_city', label: 'Hostel and City', icon: 'apartment'},
  ];

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.collegeId.set(id);
      }
    });
  }

  readonly collegeBundle = computed(() =>
    this.api.getCollegeWithSummaries(this.collegeId())
  );

  readonly collegeCutoffs = computed(() =>
    this.api.cutoffs().filter((c) => c.collegeId === this.collegeId())
  );

  readonly filteredReviews = computed(() => {
    const col = this.collegeBundle().college;
    if (!col) return [];
    const cat = this.selectedReviewCategory();
    const hideLow = this.hideLowAuthenticity();
    return col.reviews.filter((r) => {
      if (cat !== 'ALL' && r.category !== cat) return false;
      if (hideLow && r.authenticityScore < 60) return false;
      return true;
    });
  });

  readonly collegeCostAndRoi = computed(() => {
    const col = this.collegeBundle().college;
    const cost = calculateTrue4YearCost({
      collegeId: col?.id,
      tuitionPerYearInr: col?.fees.tuitionPerYearInr.value ?? 0,
      hostelPerYearInr: col?.fees.hostelPerYearInr.value ?? 0,
      messPerYearInr: col?.fees.messPerYearInr.value ?? 0,
      examAndLabPerYearInr: col?.fees.examAndLabPerYearInr.value ?? 0,
      oneTimeAdmissionInr: col?.fees.oneTimeAdmissionInr.value ?? 0,
      booksAndSuppliesPerYearInr: 12000,
      travelPerYearInr: 10000,
      miscPerYearInr: 12000,
      annualFeeIncreasePercent: 0,
      scholarshipPerYearInr: 0,
    });
    const roi = calculateRoiScore({
      total4YearCostInr: cost.grandTotal4YearsInr,
      medianAnnualSalaryInr: col?.placements.medianSalaryInr.value ?? null,
    });
    return {cost, roi};
  });

  onSwitchCollege(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.collegeId.set(val);
  }

  selectDefaultCollege(): void {
    this.collegeId.set('iit-madras');
  }

  toggleCompare(id: string): void {
    const res = this.profileStore.toggleCompareCollege(id);
    if (res.limitReached) {
      this.api.showToast('Compare list is full (max 4 colleges).', 'warning');
    } else if (res.added) {
      this.api.showToast('Added to comparison list.', 'success');
    }
  }

  onReviewCatChange(event: Event): void {
    this.selectedReviewCategory.set(
      (event.target as HTMLSelectElement).value as 'ALL' | ReviewCategory
    );
  }

  hasLargeHeadlineGap(median: number | null, highest: number | null): boolean {
    if (median === null || highest === null || median <= 0) return false;
    return highest / median >= 3;
  }
}
