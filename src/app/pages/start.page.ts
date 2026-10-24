import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import {RouterLink} from '@angular/router';
import {MatIconModule} from '@angular/material/icon';
import {AdmissionRouteType, College} from '../../shared/schemas';
import {ApiService} from '../services/api.service';
import {I18nService} from '../services/i18n.service';
import {ProfileStorageService} from '../services/storage.service';
import {
  DataBadge,
  HowWeCalculateModal,
  StateViews,
} from '../components/ui';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-start-page',
  imports: [RouterLink, MatIconModule, DataBadge, HowWeCalculateModal, StateViews],
  template: `
    <div class="space-y-8 pb-12">
      <!-- Header -->
      <div class="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
        <div>
          <span class="text-xs font-semibold text-teal-700 dark:text-teal-400">
            Core User Flow · Unbiased College Discovery
          </span>
          <h1 class="mt-1 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
            Find Engineering Colleges by Route & Budget
          </h1>
          <p class="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Step 1: Choose an admission route · Step 2: Set your realistic budget · Step 3: Compare source-verified colleges.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            (click)="showFormulaModal.set(true)"
            class="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-indigo-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-indigo-400 cursor-pointer"
          >
            <mat-icon class="!w-4 !h-4 !text-[16px]">calculate</mat-icon>
            <span>{{ i18n.t('action.howWeCalculate') }}</span>
          </button>
          <a
            routerLink="/compare"
            class="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 cursor-pointer"
          >
            <mat-icon class="!w-4 !h-4 !text-[16px]">compare_arrows</mat-icon>
            <span>Compare ({{ profileStore.compareIds().length }}/4)</span>
          </a>
        </div>
      </div>

      <!-- Stepper Bar -->
      <div class="grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          (click)="activeStep.set(1)"
          class="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors cursor-pointer"
          [class.bg-indigo-50]="activeStep() === 1"
          [class.text-indigo-900]="activeStep() === 1"
          [class.dark:bg-indigo-950]="activeStep() === 1"
          [class.dark:text-indigo-200]="activeStep() === 1"
        >
          <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-700 text-xs font-bold text-white">1</span>
          <div class="min-w-0">
            <div class="text-xs font-bold truncate">Admission Route</div>
            <div class="text-[11px] text-slate-500 dark:text-slate-400 truncate">{{ routeLabel(selectedRoute()) }}</div>
          </div>
        </button>

        <button
          type="button"
          (click)="activeStep.set(2)"
          class="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors cursor-pointer"
          [class.bg-indigo-50]="activeStep() === 2"
          [class.text-indigo-900]="activeStep() === 2"
          [class.dark:bg-indigo-950]="activeStep() === 2"
          [class.dark:text-indigo-200]="activeStep() === 2"
        >
          <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-700 text-xs font-bold text-white">2</span>
          <div class="min-w-0">
            <div class="text-xs font-bold truncate">Fee Budget</div>
            <div class="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums truncate">
              Up to ₹{{ effectiveAnnualBudget().toLocaleString('en-IN') }}/yr
            </div>
          </div>
        </button>

        <button
          type="button"
          (click)="activeStep.set(3)"
          class="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors cursor-pointer"
          [class.bg-indigo-50]="activeStep() === 3"
          [class.text-indigo-900]="activeStep() === 3"
          [class.dark:bg-indigo-950]="activeStep() === 3"
          [class.dark:text-indigo-200]="activeStep() === 3"
        >
          <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-700 text-xs font-bold text-white">3</span>
          <div class="min-w-0">
            <div class="text-xs font-bold truncate">Matching Colleges</div>
            <div class="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums truncate">
              {{ filteredColleges().length }} matches
            </div>
          </div>
        </button>
      </div>

      <!-- STEP 1: Choose Admission Route -->
      @if (activeStep() === 1) {
        <section class="rounded-2xl border border-slate-200 bg-white p-6 space-y-5 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100">
              Step 1: Choose Your Primary Admission Route
            </h2>
            <p class="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Every Indian engineering college admits through one or more of these three transparent routes. You can also view all routes together.
            </p>
          </div>

          <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            @for (rt of routeOptions; track rt.value) {
              <button
                type="button"
                (click)="selectRoute(rt.value)"
                class="flex flex-col justify-between rounded-xl border p-4 text-left transition-all cursor-pointer"
                [class.border-indigo-600]="selectedRoute() === rt.value"
                [class.bg-indigo-50/50]="selectedRoute() === rt.value"
                [class.dark:border-indigo-400]="selectedRoute() === rt.value"
                [class.dark:bg-indigo-950/40]="selectedRoute() === rt.value"
                [class.border-slate-200]="selectedRoute() !== rt.value"
                [class.dark:border-slate-800]="selectedRoute() !== rt.value"
              >
                <div>
                  <div class="flex items-center justify-between gap-2">
                    <mat-icon class="text-indigo-700 dark:text-indigo-400">{{ rt.icon }}</mat-icon>
                    @if (selectedRoute() === rt.value) {
                      <span class="text-xs font-bold text-indigo-700 dark:text-indigo-300">Selected</span>
                    }
                  </div>
                  <h3 class="mt-3 text-sm font-bold text-slate-900 dark:text-slate-100">
                    {{ rt.title }}
                  </h3>
                  <p class="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {{ rt.explanation }}
                  </p>
                </div>
                <div class="mt-4 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] font-medium text-teal-700 dark:text-teal-400">
                  {{ rt.examples }}
                </div>
              </button>
            }
          </div>

          <div class="flex justify-end pt-2">
            <button
              type="button"
              (click)="activeStep.set(2)"
              class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800 cursor-pointer"
            >
              <span>Next: Enter Budget</span>
              <mat-icon class="!w-4 !h-4 !text-[16px]">arrow_forward</mat-icon>
            </button>
          </div>
        </section>
      }

      <!-- STEP 2: Enter Budget (Slider & Number Input, Per Year or Total for 4 Years) -->
      @if (activeStep() === 2) {
        <section class="rounded-2xl border border-slate-200 bg-white p-6 space-y-6 dark:border-slate-800 dark:bg-slate-900">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100">
                Step 2: Set Your Tuition Fee Budget
              </h2>
              <p class="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Choose whether to enter your budget per year or total for 4 years. Both slider and number box stay in sync.
              </p>
            </div>

            <!-- Toggle Per Year vs 4-Year Total -->
            <div class="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              <button
                type="button"
                (click)="setBudgetMode('per_year')"
                class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                [class.bg-white]="budgetMode() === 'per_year'"
                [class.text-slate-900]="budgetMode() === 'per_year'"
                [class.shadow-xs]="budgetMode() === 'per_year'"
                [class.dark:bg-slate-900]="budgetMode() === 'per_year'"
                [class.dark:text-slate-100]="budgetMode() === 'per_year'"
              >
                Per Year (Annual)
              </button>
              <button
                type="button"
                (click)="setBudgetMode('total_4_years')"
                class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                [class.bg-white]="budgetMode() === 'total_4_years'"
                [class.text-slate-900]="budgetMode() === 'total_4_years'"
                [class.shadow-xs]="budgetMode() === 'total_4_years'"
                [class.dark:bg-slate-900]="budgetMode() === 'total_4_years'"
                [class.dark:text-slate-100]="budgetMode() === 'total_4_years'"
              >
                Total for 4 Years
              </button>
            </div>
          </div>

          <div class="grid gap-6 md:grid-cols-2 items-center">
            <div class="space-y-3">
              <label for="budget-slider" class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                {{ budgetMode() === 'per_year' ? 'Maximum Annual Tuition Budget (INR)' : 'Maximum 4-Year Tuition Budget (INR)' }}
              </label>
              <input
                id="budget-slider"
                type="range"
                [min]="budgetMode() === 'per_year' ? 10000 : 40000"
                [max]="budgetMode() === 'per_year' ? 600000 : 2400000"
                [step]="budgetMode() === 'per_year' ? 10000 : 40000"
                [value]="budgetInputValue()"
                (input)="onBudgetChange($event)"
                class="w-full accent-indigo-700 cursor-pointer"
              />
              <div class="flex justify-between font-mono text-[11px] text-slate-500 tabular-nums">
                <span>{{ budgetMode() === 'per_year' ? '₹10,000/yr' : '₹40,000 (4 yrs)' }}</span>
                <span>{{ budgetMode() === 'per_year' ? '₹3,00,000/yr' : '₹12,00,000 (4 yrs)' }}</span>
                <span>{{ budgetMode() === 'per_year' ? '₹6,00,000/yr' : '₹24,00,000 (4 yrs)' }}</span>
              </div>
            </div>

            <div class="space-y-2">
              <label for="budget-number-input" class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Exact Amount in INR ({{ budgetMode() === 'per_year' ? 'Per Year' : '4-Year Total' }})
              </label>
              <input
                id="budget-number-input"
                type="number"
                [min]="2000"
                [max]="3000000"
                [step]="5000"
                [value]="budgetInputValue()"
                (input)="onBudgetChange($event)"
                class="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-mono text-base font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 tabular-nums"
              />
              <p class="text-xs text-slate-500 dark:text-slate-400">
                Equivalent to <span class="font-mono font-semibold text-slate-800 dark:text-slate-200 tabular-nums">₹{{ effectiveAnnualBudget().toLocaleString('en-IN') }}/year</span> or <span class="font-mono font-semibold text-slate-800 dark:text-slate-200 tabular-nums">₹{{ (effectiveAnnualBudget() * 4).toLocaleString('en-IN') }} over 4 years</span> (excluding hostel/mess).
              </p>
            </div>
          </div>

          <div class="flex justify-between pt-2">
            <button
              type="button"
              (click)="activeStep.set(1)"
              class="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <mat-icon class="!w-4 !h-4 !text-[16px]">arrow_back</mat-icon>
              <span>Back to Route</span>
            </button>
            <button
              type="button"
              (click)="activeStep.set(3)"
              class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800 cursor-pointer"
            >
              <span>Show {{ filteredColleges().length }} Matching Colleges</span>
              <mat-icon class="!w-4 !h-4 !text-[16px]">arrow_forward</mat-icon>
            </button>
          </div>
        </section>
      }

      <!-- STEP 3 / Always Visible Filters & Matching Results List -->
      <section class="space-y-5">
        <!-- Pan-India Expansion Hub Banner (Options 1, 2 & 3) -->
        <div class="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/30">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="space-y-0.5">
              <div class="flex items-center gap-2 text-xs font-bold text-indigo-800 dark:text-indigo-300">
                <mat-icon class="!w-4 !h-4 !text-[16px]">public</mat-icon>
                <span>
                  Pan-India Coverage Active: {{ api.colleges().length }} Verified Colleges Across {{ availableStates().length }} States & UTs
                </span>
              </div>
              <p class="text-xs text-slate-600 dark:text-slate-400">
                Includes IITs, NITs, IIITs, GFTIs, State Govt & Private colleges. Can't find a specific local college? Add any Indian college on-demand or bulk import AICTE/AISHE/NIRF records.
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <button
                type="button"
                (click)="toggleExpansionHub('lookup')"
                class="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-indigo-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-800 cursor-pointer"
              >
                <mat-icon class="!w-4 !h-4 !text-[16px]">add_business</mat-icon>
                <span>Add Any Indian College (Live Lookup)</span>
              </button>
              <button
                type="button"
                (click)="toggleExpansionHub('bulk')"
                class="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-indigo-300 bg-white px-3.5 py-2 text-xs font-semibold text-indigo-800 hover:bg-indigo-50 dark:border-indigo-700 dark:bg-slate-900 dark:text-indigo-300 cursor-pointer"
              >
                <mat-icon class="!w-4 !h-4 !text-[16px]">upload_file</mat-icon>
                <span>Bulk Import (AICTE / NIRF JSON)</span>
              </button>
            </div>
          </div>

          @if (expansionTab() !== 'closed') {
            <div class="mt-4 border-t border-indigo-200/80 pt-4 dark:border-indigo-900/60">
              @if (expansionTab() === 'lookup') {
                <div class="space-y-3">
                  <div class="flex items-center justify-between">
                    <h3 class="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-200">
                      Option 3 · On-Demand College Lookup & Auto-Add (Zero Invented Numbers)
                    </h3>
                    <button
                      type="button"
                      (click)="expansionTab.set('closed')"
                      class="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                  <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label for="lookup-college-name" class="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Full College Name *
                      </label>
                      <input
                        id="lookup-college-name"
                        type="text"
                        [value]="lookupName()"
                        (input)="onLookupNameInput($event)"
                        placeholder="e.g. Walchand College of Engineering"
                        class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label for="lookup-college-city" class="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        City *
                      </label>
                      <input
                        id="lookup-college-city"
                        type="text"
                        [value]="lookupCity()"
                        (input)="onLookupCityInput($event)"
                        placeholder="e.g. Sangli"
                        class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label for="lookup-college-state" class="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        State / UT *
                      </label>
                      <input
                        id="lookup-college-state"
                        type="text"
                        [value]="lookupState()"
                        (input)="onLookupStateInput($event)"
                        placeholder="e.g. Maharashtra"
                        class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label for="lookup-college-ownership" class="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Ownership Type
                      </label>
                      <select
                        id="lookup-college-ownership"
                        [value]="lookupOwnership()"
                        (change)="onLookupOwnershipChange($event)"
                        class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      >
                        <option value="Government">Government / Public</option>
                        <option value="Private">Private / Deemed</option>
                        <option value="Public-Private">Public-Private (PPP)</option>
                      </select>
                    </div>
                  </div>
                  <div class="grid gap-3 sm:grid-cols-3 items-end">
                    <div>
                      <label for="lookup-college-website" class="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Official Website URL (Optional)
                      </label>
                      <input
                        id="lookup-college-website"
                        type="url"
                        [value]="lookupWebsite()"
                        (input)="onLookupWebsiteInput($event)"
                        placeholder="https://www.walchandsangli.ac.in"
                        class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label for="lookup-college-tuition" class="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Verified Annual Tuition INR (Leave blank if unverified)
                      </label>
                      <input
                        id="lookup-college-tuition"
                        type="number"
                        [value]="lookupTuition()"
                        (input)="onLookupTuitionInput($event)"
                        placeholder="Leave empty for 'Not verified' badge"
                        class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </div>
                    <div class="flex justify-end">
                      <button
                        type="button"
                        [disabled]="isSubmittingLookup()"
                        (click)="submitLiveCollegeLookup()"
                        class="inline-flex min-h-[40px] w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 cursor-pointer"
                      >
                        <mat-icon class="!w-4 !h-4 !text-[16px]">verified_user</mat-icon>
                        <span>{{ isSubmittingLookup() ? 'Adding College...' : 'Verify & Add to Directory' }}</span>
                      </button>
                    </div>
                  </div>
                </div>
              }

              @if (expansionTab() === 'bulk') {
                <div class="space-y-3">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <h3 class="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-200">
                      Option 1 · Bulk Import Pipeline (AICTE / AISHE / NIRF JSON Array)
                    </h3>
                    <div class="flex items-center gap-3">
                      <button
                        type="button"
                        (click)="loadSampleBulkJson()"
                        class="text-xs font-semibold text-indigo-700 hover:underline dark:text-indigo-300 cursor-pointer"
                      >
                        Load Sample Regional Colleges JSON
                      </button>
                      <button
                        type="button"
                        (click)="expansionTab.set('closed')"
                        class="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  <div>
                    <label for="bulk-import-json" class="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Paste JSON Array of Colleges (unverified fields may be omitted or null)
                    </label>
                    <textarea
                      id="bulk-import-json"
                      rows="4"
                      [value]="bulkJsonText()"
                      (input)="onBulkJsonInput($event)"
                      class="w-full rounded-xl border border-slate-300 bg-white p-3 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    ></textarea>
                  </div>

                  <div class="flex justify-end">
                    <button
                      type="button"
                      [disabled]="isSubmittingBulk()"
                      (click)="submitBulkCollegeImport()"
                      class="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-indigo-700 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-800 disabled:opacity-50 cursor-pointer"
                    >
                      <mat-icon class="!w-4 !h-4 !text-[16px]">cloud_upload</mat-icon>
                      <span>{{ isSubmittingBulk() ? 'Importing...' : 'Run Bulk Import Pipeline' }}</span>
                    </button>
                  </div>
                </div>
              }
            </div>
          }
        </div>

        <!-- Filter Bar -->
        <div class="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 space-y-3">
          <!-- Fast Keyword Search Across All Pan-India Colleges -->
          <div class="relative">
            <label for="filter-keyword-search" class="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Search Across {{ api.colleges().length }} Pan-India Colleges (Name, Short Code, City, or State)
            </label>
            <div class="relative">
              <input
                id="filter-keyword-search"
                type="search"
                [value]="searchQuery()"
                (focus)="onFilterSearchFocus()"
                (blur)="onFilterSearchBlur()"
                (input)="onSearchQueryInput($event)"
                (keydown.enter)="onFilterSearchEnter()"
                placeholder="Search IIT, NIT, IIIT, Jadavpur, COEP, RVCE, VJTI, PSG, city or state..."
                class="w-full rounded-xl border border-slate-300 bg-white pl-3.5 pr-9 py-2 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            @if (isFilterSearchFocused() && searchQuery().trim().length === 0) {
              <div
                (mousedown)="$event.preventDefault()"
                class="absolute left-0 right-0 top-full mt-1.5 z-30 rounded-2xl border border-slate-200 bg-white p-3 shadow-md dark:border-slate-700 dark:bg-slate-900 space-y-2"
              >
                <div class="flex items-center justify-between px-2">
                  <span class="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Recent Searches ({{ profileStore.recentSearches().length }}/5)
                  </span>
                  @if (profileStore.recentSearches().length > 0) {
                    <button
                      type="button"
                      (click)="clearRecentSearches($event)"
                      class="text-[11px] font-semibold text-rose-600 hover:underline dark:text-rose-400 cursor-pointer"
                    >
                      Clear All
                    </button>
                  }
                </div>

                @if (profileStore.recentSearches().length > 0) {
                  <div class="space-y-1">
                    @for (recent of profileStore.recentSearches(); track recent) {
                      <div class="flex items-center justify-between gap-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-slate-800 px-2.5 py-1.5">
                        <button
                          type="button"
                          (click)="selectRecentFilterQuery(recent)"
                          class="flex-1 text-left flex items-center gap-2 text-xs text-slate-800 dark:text-slate-200 cursor-pointer"
                        >
                          <mat-icon class="!w-3.5 !h-3.5 !text-[14px] text-slate-400">history</mat-icon>
                          <span class="font-medium">{{ recent }}</span>
                        </button>
                        <button
                          type="button"
                          (click)="removeRecentFilterQuery(recent, $event)"
                          class="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-0.5 cursor-pointer"
                          [attr.aria-label]="'Remove ' + recent + ' from recent searches'"
                        >
                          <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">close</mat-icon>
                        </button>
                      </div>
                    }
                  </div>
                } @else {
                  <div class="px-2 py-1 text-xs text-slate-500 dark:text-slate-400">
                    No recent search queries saved yet. Your last 5 searches will appear here.
                  </div>
                }
              </div>
            }
          </div>

          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 items-end">
            <div>
              <label for="filter-route" class="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Admission Route
              </label>
              <select
                id="filter-route"
                [value]="selectedRoute()"
                (change)="onRouteSelectChange($event)"
                class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="ALL">All 3 Routes</option>
                <option value="national_exam">All-India / State Exam</option>
                <option value="college_process">College's Own Process</option>
                <option value="direct">Direct Class 12 / Topper</option>
              </select>
            </div>

            <div>
              <label for="filter-state" class="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                City / State ({{ availableStates().length }} States/UTs)
              </label>
              <select
                id="filter-state"
                [value]="selectedState()"
                (change)="onStateChange($event)"
                class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="ALL">All States & Cities</option>
                @for (st of availableStates(); track st) {
                  <option [value]="st">{{ st }}</option>
                }
              </select>
            </div>

            <div>
              <label for="filter-branch" class="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Engineering Branch
              </label>
              <select
                id="filter-branch"
                [value]="selectedBranch()"
                (change)="onBranchChange($event)"
                class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="ALL">All Branches</option>
                <option value="CSE">Computer Science (CSE)</option>
                <option value="ECE">Electronics & Comm (ECE)</option>
                <option value="ME">Mechanical / Aerospace (ME)</option>
                <option value="IT">Information Technology (IT)</option>
              </select>
            </div>

            <div>
              <label for="filter-sort" class="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Sort By (Never by Payment)
              </label>
              <select
                id="filter-sort"
                [value]="sortCriteria()"
                (change)="onSortChange($event)"
                class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="overallFairScore">Overall Fair Score</option>
                <option value="valueForMoneyScore">Best Value for Money (ROI)</option>
                <option value="affordabilityScore">Lowest Tuition Fee First</option>
                <option value="placementStrengthScore">Highest Verified Median Salary</option>
                <option value="nirfRank">NIRF 2024 Rank</option>
              </select>
            </div>

            <div class="flex items-center gap-3 pt-2">
              <label class="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  [checked]="hostelOnly()"
                  (change)="hostelOnly.set(!hostelOnly())"
                  class="rounded border-slate-300 text-indigo-700 focus:ring-indigo-600"
                />
                <span>Hostel available</span>
              </label>
            </div>

            <div class="flex items-center gap-3 pt-2">
              <label class="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  [checked]="partnerOnly()"
                  (change)="partnerOnly.set(!partnerOnly())"
                  class="rounded border-slate-300 text-indigo-700 focus:ring-indigo-600"
                />
                <span>Partner colleges only</span>
              </label>
            </div>
          </div>
        </div>

        <!-- Results State Handling -->
        @if (api.isLoading()) {
          <app-state-views state="loading" [rows]="4" />
        } @else if (api.errorState()) {
          <app-state-views
            state="error"
            [message]="api.errorState() || ''"
            (retryClicked)="api.initializeData()"
          />
        } @else if (filteredColleges().length === 0) {
          <app-state-views
            state="empty"
            title="No colleges match these exact filters"
            message="Try clearing your search query, increasing your annual tuition budget slider, or using 'Add Any Indian College (Live Lookup)' above."
            actionLabel="Reset All Filters"
            (retryClicked)="resetFilters()"
          />
        } @else {
          <div class="space-y-4">
            @for (college of filteredColleges(); track college.id) {
              <article class="rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900">
                <div class="flex flex-wrap items-start justify-between gap-4">
                  <div class="space-y-1.5">
                    <!-- Kicker metadata with typographic separators -->
                    <div class="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span class="font-semibold text-slate-700 dark:text-slate-300">{{ college.ownership }}</span>
                      <span aria-hidden="true">·</span>
                      <span>{{ college.cityInfo.city }}, {{ college.cityInfo.state }}</span>
                      <span aria-hidden="true">·</span>
                      @if (college.isPartner) {
                        <span class="inline-flex items-center gap-1 font-semibold text-teal-700 dark:text-teal-400">
                          <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">verified</mat-icon>
                          <span>{{ i18n.t('common.partnerLabel') }}</span>
                        </span>
                      } @else {
                        <span>{{ i18n.t('common.infoOnlyLabel') }}</span>
                      }
                    </div>

                    <h3 class="text-lg font-bold text-slate-900 dark:text-slate-100">
                      <a [routerLink]="['/college', college.id]" class="hover:text-indigo-700 dark:hover:text-indigo-400 hover:underline">
                        {{ college.name }} ({{ college.shortName }})
                      </a>
                    </h3>

                    <!-- Clear Fit Reasons -->
                    <p class="text-xs text-indigo-800 dark:text-indigo-300 font-medium">
                      Why it fits: {{ buildFitReason(college) }}
                    </p>
                  </div>

                  <!-- Precomputed Unbiased Scores -->
                  @if (college.rankingMetrics) {
                    <div class="flex items-center gap-4 text-right font-mono">
                      <div>
                        <div class="text-[11px] text-slate-500">Fair Score</div>
                        <div class="text-base font-bold text-indigo-700 dark:text-indigo-400 tabular-nums">
                          {{ college.rankingMetrics.overallFairScore }}/100
                        </div>
                      </div>
                      <div>
                        <div class="text-[11px] text-slate-500">ROI Payback</div>
                        <div class="text-base font-bold text-teal-700 dark:text-teal-400 tabular-nums">
                          {{ college.rankingMetrics.roiPaybackYears !== null ? college.rankingMetrics.roiPaybackYears + ' yrs' : 'Unverified' }}
                        </div>
                      </div>
                    </div>
                  }
                </div>

                <!-- Key Sourced Data Grid -->
                <div class="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-4 dark:border-slate-800 text-xs">
                  <div>
                    <div class="text-slate-500 dark:text-slate-400">NIRF 2024 Rank</div>
                    <div class="mt-0.5">
                      <app-data-badge [field]="college.accreditation.nirfRank" prefix="#" [fallbackUrl]="college.officialWebsite" />
                    </div>
                  </div>
                  <div>
                    <div class="text-slate-500 dark:text-slate-400">Annual Tuition Fee</div>
                    <div class="mt-0.5">
                      <app-data-badge [field]="college.fees.tuitionPerYearInr" [formatAsInr]="true" suffix="/yr" [fallbackUrl]="college.officialWebsite" />
                    </div>
                  </div>
                  <div>
                    <div class="text-slate-500 dark:text-slate-400">Verified Median Salary</div>
                    <div class="mt-0.5">
                      <app-data-badge [field]="college.placements.medianSalaryInr" [formatAsInr]="true" suffix="/yr" [fallbackUrl]="college.officialWebsite" />
                    </div>
                  </div>
                  <div>
                    <div class="text-slate-500 dark:text-slate-400">Admission Routes</div>
                    <div class="mt-0.5 font-medium text-slate-800 dark:text-slate-200">
                      {{ formatRoutesList(college) }}
                    </div>
                  </div>
                </div>

                <!-- Action Buttons (Only Partners have Common Apply button; Non-partners show Information Only) -->
                <div class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <div class="text-[11px] text-slate-500 dark:text-slate-400">
                    Branches: {{ formatBranchesList(college) }}
                  </div>

                  <div class="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      (click)="toggleCompare(college.id)"
                      class="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                    >
                      <mat-icon class="!w-4 !h-4 !text-[16px]">
                        {{ profileStore.compareIds().includes(college.id) ? 'check_box' : 'check_box_outline_blank' }}
                      </mat-icon>
                      <span>{{ profileStore.compareIds().includes(college.id) ? 'In Compare' : 'Compare' }}</span>
                    </button>

                    <a
                      [routerLink]="['/college', college.id]"
                      class="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-1.5 text-xs font-semibold text-indigo-800 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-200"
                    >
                      <mat-icon class="!w-4 !h-4 !text-[16px]">visibility</mat-icon>
                      <span>Full 9-Tab Info</span>
                    </a>

                    @if (college.isPartner) {
                      <a
                        routerLink="/apply"
                        [queryParams]="{collegeId: college.id}"
                        class="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-teal-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
                      >
                        <mat-icon class="!w-4 !h-4 !text-[16px]">send</mat-icon>
                        <span>Common Apply (Partner)</span>
                      </a>
                    } @else {
                      <a
                        [href]="college.officialWebsite"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400"
                      >
                        <span>Info Only · Official Site</span>
                        <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">open_in_new</mat-icon>
                      </a>
                    }
                  </div>
                </div>
              </article>
            }
          </div>
        }
      </section>

      <app-how-we-calculate-modal
        [isOpen]="showFormulaModal()"
        (closed)="showFormulaModal.set(false)"
      />
    </div>
  `,
})
export class StartPage {
  readonly api = inject(ApiService);
  readonly i18n = inject(I18nService);
  readonly profileStore = inject(ProfileStorageService);

  readonly activeStep = signal<1 | 2 | 3>(1);
  readonly showFormulaModal = signal<boolean>(false);

  readonly searchQuery = signal<string>('');
  readonly isFilterSearchFocused = signal<boolean>(false);
  readonly selectedRoute = signal<'ALL' | AdmissionRouteType>('ALL');
  readonly budgetMode = signal<'per_year' | 'total_4_years'>('per_year');
  readonly annualBudgetInr = signal<number>(
    this.profileStore.profile().annualBudgetInr || 550000
  );
  readonly selectedState = signal<string>('ALL');
  readonly selectedBranch = signal<string>('ALL');
  readonly hostelOnly = signal<boolean>(false);
  readonly partnerOnly = signal<boolean>(false);
  readonly sortCriteria = signal<
    | 'overallFairScore'
    | 'valueForMoneyScore'
    | 'affordabilityScore'
    | 'placementStrengthScore'
    | 'nirfRank'
  >('overallFairScore');

  // Pan-India Expansion Hub state (Option 1 Bulk Import + Option 3 Live Lookup)
  readonly expansionTab = signal<'closed' | 'lookup' | 'bulk'>('closed');
  readonly lookupName = signal<string>('');
  readonly lookupCity = signal<string>('');
  readonly lookupState = signal<string>('');
  readonly lookupOwnership = signal<'Government' | 'Private' | 'Public-Private'>(
    'Government'
  );
  readonly lookupWebsite = signal<string>('');
  readonly lookupTuition = signal<string>('');
  readonly isSubmittingLookup = signal<boolean>(false);

  readonly bulkJsonText = signal<string>('');
  readonly isSubmittingBulk = signal<boolean>(false);

  readonly routeOptions: {
    value: 'ALL' | AdmissionRouteType;
    title: string;
    explanation: string;
    examples: string;
    icon: string;
  }[] = [
    {
      value: 'ALL',
      title: 'All 3 Admission Routes',
      explanation: 'Show every matching college across national exams, institute tests, and direct merit.',
      examples: 'All Pan-India tracked colleges',
      icon: 'apps',
    },
    {
      value: 'national_exam',
      title: 'All-India / State Exam Route',
      explanation: 'Centralised merit counselling based on JEE Main, JEE Advanced, WBJEE, KCET, MHT CET, or TNEA.',
      examples: 'All IITs, NITs, IIITs, DTU, Jadavpur, COEP, Anna Univ, VJTI',
      icon: 'public',
    },
    {
      value: 'college_process',
      title: "College's Own Entrance Process",
      explanation: 'University conducts its own transparent computer-based entrance exam and counselling.',
      examples: 'BITS Pilani (BITSAT), VIT (VITEEE), IIIT-H (UGEE), MIT (MET), SRM, Amrita',
      icon: 'domain_verification',
    },
    {
      value: 'direct',
      title: 'Direct Class 12 / Board Topper Route',
      explanation: 'Official merit seats allotted on Class 12 board topper rank or PCM aggregate counselling.',
      examples: 'BITS Board Topper Scheme, Thapar Class 12 PCM Mode, SASTRA / TNEA PCM',
      icon: 'workspace_premium',
    },
  ];

  readonly budgetInputValue = computed(() =>
    this.budgetMode() === 'per_year'
      ? this.annualBudgetInr()
      : this.annualBudgetInr() * 4
  );

  readonly effectiveAnnualBudget = computed(() => this.annualBudgetInr());

  readonly availableStates = computed(() => {
    const states = new Set<string>();
    for (const c of this.api.colleges()) {
      states.add(c.cityInfo.state);
    }
    return Array.from(states).sort();
  });

  readonly filteredColleges = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const route = this.selectedRoute();
    const maxAnnual = this.effectiveAnnualBudget();
    const state = this.selectedState();
    const branch = this.selectedBranch();
    const needHostel = this.hostelOnly();
    const needPartner = this.partnerOnly();
    const sortBy = this.sortCriteria();

    const matches = this.api.colleges().filter((c) => {
      if (query) {
        const hay =
          `${c.name} ${c.shortName} ${c.cityInfo.city} ${c.cityInfo.state}`.toLowerCase();
        if (!hay.includes(query)) {
          return false;
        }
      }
      if (
        route !== 'ALL' &&
        !c.admissionRoutes.some((r) => r.routeType === route)
      ) {
        return false;
      }
      const tuition = c.fees.tuitionPerYearInr.value;
      if (tuition !== null && tuition > maxAnnual) {
        return false;
      }
      if (state !== 'ALL' && c.cityInfo.state !== state) {
        return false;
      }
      if (
        branch !== 'ALL' &&
        !c.courses.some((course) => course.branchCode === branch)
      ) {
        return false;
      }
      if (needHostel && !c.hasHostel) {
        return false;
      }
      if (needPartner && !c.isPartner) {
        return false;
      }
      return true;
    });

    return [...matches].sort((a, b) => {
      if (sortBy === 'nirfRank') {
        const rA = a.accreditation.nirfRank.value ?? 999;
        const rB = b.accreditation.nirfRank.value ?? 999;
        return rA - rB;
      }
      const mA = a.rankingMetrics?.[sortBy] ?? 0;
      const mB = b.rankingMetrics?.[sortBy] ?? 0;
      return mB - mA;
    });
  });

  toggleExpansionHub(tab: 'lookup' | 'bulk'): void {
    if (this.expansionTab() === tab) {
      this.expansionTab.set('closed');
    } else {
      this.expansionTab.set(tab);
      if (tab === 'bulk' && !this.bulkJsonText()) {
        this.loadSampleBulkJson();
      }
    }
  }

  onSearchQueryInput(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  onFilterSearchFocus(): void {
    this.isFilterSearchFocused.set(true);
  }

  onFilterSearchBlur(): void {
    const q = this.searchQuery().trim();
    if (q.length >= 2) {
      this.profileStore.addRecentSearch(q);
    }
    setTimeout(() => {
      this.isFilterSearchFocused.set(false);
    }, 180);
  }

  onFilterSearchEnter(): void {
    const q = this.searchQuery().trim();
    if (q.length >= 2) {
      this.profileStore.addRecentSearch(q);
    }
    this.isFilterSearchFocused.set(false);
  }

  selectRecentFilterQuery(query: string): void {
    this.searchQuery.set(query);
    this.profileStore.addRecentSearch(query);
    this.isFilterSearchFocused.set(false);
  }

  removeRecentFilterQuery(query: string, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.profileStore.removeRecentSearch(query);
  }

  clearRecentSearches(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.profileStore.clearRecentSearches();
  }

  onLookupNameInput(event: Event): void {
    this.lookupName.set((event.target as HTMLInputElement).value);
  }

  onLookupCityInput(event: Event): void {
    this.lookupCity.set((event.target as HTMLInputElement).value);
  }

  onLookupStateInput(event: Event): void {
    this.lookupState.set((event.target as HTMLInputElement).value);
  }

  onLookupOwnershipChange(event: Event): void {
    this.lookupOwnership.set(
      (event.target as HTMLSelectElement).value as
        | 'Government'
        | 'Private'
        | 'Public-Private'
    );
  }

  onLookupWebsiteInput(event: Event): void {
    this.lookupWebsite.set((event.target as HTMLInputElement).value);
  }

  onLookupTuitionInput(event: Event): void {
    this.lookupTuition.set((event.target as HTMLInputElement).value);
  }

  onBulkJsonInput(event: Event): void {
    this.bulkJsonText.set((event.target as HTMLTextAreaElement).value);
  }

  loadSampleBulkJson(): void {
    const sample = [
      {
        name: 'Walchand College of Engineering',
        shortName: 'WCE Sangli',
        city: 'Sangli',
        state: 'Maharashtra',
        ownership: 'Government',
        officialWebsite: 'https://www.walchandsangli.ac.in',
        tuitionPerYearInr: 85000,
        medianSalaryInr: 950000,
        examName: 'MHT CET / JEE Main',
      },
      {
        name: 'Harcourt Butler Technical University',
        shortName: 'HBTU Kanpur',
        city: 'Kanpur',
        state: 'Uttar Pradesh',
        ownership: 'Government',
        officialWebsite: 'https://hbtu.ac.in',
        tuitionPerYearInr: 135000,
        medianSalaryInr: 850000,
        examName: 'JEE Main + HBTU Counselling',
      },
    ];
    this.bulkJsonText.set(JSON.stringify(sample, null, 2));
  }

  async submitLiveCollegeLookup(): Promise<void> {
    const name = this.lookupName().trim();
    const city = this.lookupCity().trim();
    const state = this.lookupState().trim();
    if (name.length < 3 || city.length < 2 || state.length < 2) {
      this.api.showToast(
        'Please enter the college name, city, and state.',
        'warning'
      );
      return;
    }

    const rawTuition = Number(this.lookupTuition());
    const tuitionPerYearInr =
      this.lookupTuition().trim() !== '' && !Number.isNaN(rawTuition) && rawTuition > 0
        ? rawTuition
        : null;
    const website = this.lookupWebsite().trim();

    this.isSubmittingLookup.set(true);
    try {
      const res = await this.api.lookupAndAddCollege({
        name,
        city,
        state,
        ownership: this.lookupOwnership(),
        officialWebsite: website.startsWith('http') ? website : undefined,
        tuitionPerYearInr,
      });
      this.api.showToast(res.message, 'success');
      this.searchQuery.set(name);
      this.lookupName.set('');
      this.lookupCity.set('');
      this.lookupState.set('');
      this.lookupWebsite.set('');
      this.lookupTuition.set('');
      this.expansionTab.set('closed');
    } catch (err) {
      this.api.showToast(
        err instanceof Error ? err.message : 'Could not add college.',
        'error'
      );
    } finally {
      this.isSubmittingLookup.set(false);
    }
  }

  async submitBulkCollegeImport(): Promise<void> {
    this.isSubmittingBulk.set(true);
    try {
      const parsed = JSON.parse(this.bulkJsonText());
      const rows = Array.isArray(parsed) ? parsed : parsed?.colleges;
      if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error('JSON must be a non-empty array of college objects.');
      }
      const res = await this.api.bulkImportColleges(rows);
      this.api.showToast(res.message, 'success');
      this.expansionTab.set('closed');
    } catch (err) {
      this.api.showToast(
        err instanceof Error
          ? err.message
          : 'Invalid JSON format for bulk college import.',
        'error'
      );
    } finally {
      this.isSubmittingBulk.set(false);
    }
  }

  selectRoute(rt: 'ALL' | AdmissionRouteType): void {
    this.selectedRoute.set(rt);
    if (rt !== 'ALL') {
      this.profileStore.updateProfile({preferredRoute: rt});
    }
  }

  setBudgetMode(mode: 'per_year' | 'total_4_years'): void {
    this.budgetMode.set(mode);
  }

  onBudgetChange(event: Event): void {
    const val = Number((event.target as HTMLInputElement).value);
    if (Number.isNaN(val) || val <= 0) return;
    const annual =
      this.budgetMode() === 'per_year' ? val : Math.round(val / 4);
    this.annualBudgetInr.set(annual);
    this.profileStore.updateProfile({annualBudgetInr: annual});
  }

  onRouteSelectChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value as
      | 'ALL'
      | AdmissionRouteType;
    this.selectRoute(val);
  }

  onStateChange(event: Event): void {
    this.selectedState.set((event.target as HTMLSelectElement).value);
  }

  onBranchChange(event: Event): void {
    this.selectedBranch.set((event.target as HTMLSelectElement).value);
  }

  onSortChange(event: Event): void {
    this.sortCriteria.set(
      (event.target as HTMLSelectElement).value as
        | 'overallFairScore'
        | 'valueForMoneyScore'
        | 'affordabilityScore'
        | 'placementStrengthScore'
        | 'nirfRank'
    );
  }

  resetFilters(): void {
    this.searchQuery.set('');
    this.selectedRoute.set('ALL');
    this.annualBudgetInr.set(550000);
    this.selectedState.set('ALL');
    this.selectedBranch.set('ALL');
    this.hostelOnly.set(false);
    this.partnerOnly.set(false);
  }

  toggleCompare(collegeId: string): void {
    const res = this.profileStore.toggleCompareCollege(collegeId);
    if (res.limitReached) {
      this.api.showToast(
        'You can compare up to 4 colleges side by side.',
        'warning'
      );
    } else if (res.added) {
      this.api.showToast('Added to comparison list.', 'success');
    }
  }

  routeLabel(rt: 'ALL' | AdmissionRouteType): string {
    if (rt === 'ALL') return 'All 3 Routes';
    if (rt === 'national_exam') return 'All-India / State Exam';
    if (rt === 'college_process') return "College's Own Process";
    return 'Direct Class 12 / Topper';
  }

  formatRoutesList(college: College): string {
    return college.admissionRoutes.map((r) => r.label).join(' · ');
  }

  formatBranchesList(college: College): string {
    return college.courses.map((c) => c.branchCode).join(', ');
  }

  buildFitReason(college: College): string {
    const reasons: string[] = [];
    const tuition = college.fees.tuitionPerYearInr.value;
    if (tuition !== null && tuition <= this.effectiveAnnualBudget()) {
      reasons.push(
        `Annual tuition (₹${tuition.toLocaleString('en-IN')}) is within your ₹${this.effectiveAnnualBudget().toLocaleString('en-IN')}/yr budget`
      );
    }
    if (
      college.rankingMetrics?.roiPaybackYears !== null &&
      college.rankingMetrics?.roiPaybackYears !== undefined
    ) {
      reasons.push(
        `Estimated ROI payback in ${college.rankingMetrics.roiPaybackYears} years based on NIRF median salary`
      );
    }
    if (college.accreditation.nirfRank.value !== null) {
      reasons.push(`Ranked #${college.accreditation.nirfRank.value} in NIRF 2024`);
    }
    if (reasons.length === 0) {
      reasons.push('Verified AICTE/UGC institution in Pan-India directory');
    }
    return reasons.join(' · ');
  }
}
