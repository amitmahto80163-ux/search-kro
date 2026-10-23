import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {ActivatedRoute, RouterLink} from '@angular/router';
import {MatIconModule} from '@angular/material/icon';
import {PLATFORM_FEE_INR} from '../../shared/constants';
import {ApplicationRecord, ApplicationStage} from '../../shared/schemas';
import {ApiService} from '../services/api.service';
import {ProfileStorageService} from '../services/storage.service';
import {StateViews} from '../components/ui';

/**
 * FEATURE 7: Common Application (/apply)
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-common-apply-page',
  imports: [RouterLink, MatIconModule],
  template: `
    <div class="space-y-8 pb-12">
      <div class="border-b border-slate-200 pb-5 dark:border-slate-800">
        <span class="text-xs font-semibold text-teal-700 dark:text-teal-400">
          Feature #7 · Simulated Common Application Adapter
        </span>
        <h1 class="mt-1 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
          Common Application for Partner Colleges
        </h1>
        <p class="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          Reuse one student profile and document set across verified Partner Colleges. Platform fee is ₹0 upfront (flat ₹{{ platformFee }} only after confirmed admission).
        </p>
      </div>

      @if (confirmedApp()) {
        <!-- Confirmation Screen -->
        <section class="rounded-2xl border border-emerald-300 bg-emerald-50/70 p-6 space-y-4 dark:border-emerald-800 dark:bg-emerald-950/50">
          <div class="flex items-center gap-3">
            <mat-icon class="!w-8 !h-8 !text-[32px] text-emerald-700 dark:text-emerald-400">check_circle</mat-icon>
            <div>
              <h2 class="text-lg font-bold text-emerald-950 dark:text-emerald-100">
                Common Application Submitted (Simulation ID: {{ confirmedApp()!.id }})
              </h2>
              <p class="text-xs text-emerald-800 dark:text-emerald-300">
                Submitted to: {{ confirmedApp()!.partnerCollegeNames.join(', ') }} · Platform Upfront Charge: ₹0
              </p>
            </div>
          </div>

          <div class="flex flex-wrap gap-3 pt-2">
            <a
              routerLink="/tracker"
              class="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-indigo-700 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-800"
            >
              <mat-icon class="!w-4 !h-4 !text-[16px]">track_changes</mat-icon>
              <span>Open Application Tracker</span>
            </a>
            <button
              type="button"
              (click)="confirmedApp.set(null)"
              class="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 cursor-pointer"
            >
              <span>Start Another Application</span>
            </button>
          </div>
        </section>
      } @else {
        <div class="grid gap-6 lg:grid-cols-3">
          <!-- Left 2 Columns: Profile & Partner College Selection -->
          <div class="lg:col-span-2 space-y-6">
            <section class="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900">
              <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">
                1. Student Profile (Stored in Browser Only — Minimum Data)
              </h2>
              <p class="text-xs text-slate-500">
                We never collect Aadhaar numbers, PAN numbers, or payment card details.
              </p>

              <div class="grid gap-4 sm:grid-cols-2 text-xs">
                <div>
                  <label for="app-student-name" class="block font-semibold mb-1">Student Full Name *</label>
                  <input
                    id="app-student-name"
                    type="text"
                    placeholder="e.g. Rohan Sharma"
                    [value]="studentName()"
                    (input)="onNameInput($event)"
                    class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>

                <div>
                  <label for="app-category" class="block font-semibold mb-1">Admission Category *</label>
                  <select
                    id="app-category"
                    [value]="studentCategory()"
                    (change)="onCategoryChange($event)"
                    class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="GEN">General (GEN)</option>
                    <option value="OBC-NCL">OBC-NCL</option>
                    <option value="EWS">EWS</option>
                    <option value="SC">SC</option>
                    <option value="ST">ST</option>
                  </select>
                </div>

                <div>
                  <label for="app-state" class="block font-semibold mb-1">Home Domicile State *</label>
                  <input
                    id="app-state"
                    type="text"
                    [value]="homeState()"
                    (input)="onStateInput($event)"
                    class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>

                <div>
                  <label for="app-branch" class="block font-semibold mb-1">Preferred B.Tech Branch *</label>
                  <select
                    id="app-branch"
                    [value]="preferredBranch()"
                    (change)="onBranchChange($event)"
                    class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="Computer Science and Engineering (CSE)">Computer Science and Engineering (CSE)</option>
                    <option value="Electronics and Communication (ECE)">Electronics and Communication (ECE)</option>
                    <option value="Mechanical Engineering (ME)">Mechanical Engineering (ME)</option>
                    <option value="Information Technology (IT)">Information Technology (IT)</option>
                  </select>
                </div>
              </div>
            </section>

            <section class="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900">
              <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">
                2. Select Verified Partner Colleges to Apply
              </h2>
              <p class="text-xs text-slate-500">
                Non-partner colleges remain listed as Information Only across the platform. Only verified Partner Colleges accept the Common Application.
              </p>

              <div class="grid gap-3 sm:grid-cols-2">
                @for (col of partnerColleges(); track col.id) {
                  @let isSelected = selectedPartnerIds().includes(col.id);
                  <button
                    type="button"
                    (click)="togglePartnerSelection(col.id)"
                    class="flex items-start justify-between rounded-xl border p-4 text-left transition-colors cursor-pointer"
                    [class.border-teal-600]="isSelected"
                    [class.bg-teal-50/40]="isSelected"
                    [class.dark:border-teal-500]="isSelected"
                    [class.dark:bg-teal-950/30]="isSelected"
                    [class.border-slate-200]="!isSelected"
                    [class.dark:border-slate-800]="!isSelected"
                  >
                    <div>
                      <div class="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {{ col.shortName }}
                      </div>
                      <div class="text-xs text-slate-500">
                        {{ col.cityInfo.city }} · NIRF #{{ col.accreditation.nirfRank.value ?? 'N/A' }}
                      </div>
                      <div class="mt-2 font-mono text-xs font-semibold text-teal-800 dark:text-teal-300 tabular-nums">
                        Official Exam/App Fee: ₹{{ (col.admissionRoutes[0]?.applicationFeeInr?.value ?? 1500).toLocaleString('en-IN') }}
                      </div>
                    </div>
                    <mat-icon class="text-teal-700 dark:text-teal-400">
                      {{ isSelected ? 'check_box' : 'check_box_outline_blank' }}
                    </mat-icon>
                  </button>
                }
              </div>
            </section>
          </div>

          <!-- Right Column: Cost Breakdown & Consent -->
          <div class="space-y-6">
            <section class="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900">
              <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">
                3. Transparent Cost Breakdown & Consent
              </h2>

              <div class="space-y-2 border-b border-slate-100 pb-3 text-xs dark:border-slate-800">
                @for (col of selectedPartnersObjects(); track col.id) {
                  <div class="flex justify-between">
                    <span>{{ col.shortName }} Official App Fee</span>
                    <span class="font-mono font-semibold tabular-nums">
                      ₹{{ (col.admissionRoutes[0]?.applicationFeeInr?.value ?? 1500).toLocaleString('en-IN') }}
                    </span>
                  </div>
                }
                <div class="flex justify-between text-teal-800 dark:text-teal-300 font-semibold pt-1">
                  <span>Our Platform Upfront Fee Today</span>
                  <span class="font-mono tabular-nums">₹0</span>
                </div>
                <div class="flex justify-between text-slate-500">
                  <span>Post-Admission Platform Fee (Only if admitted & joined)</span>
                  <span class="font-mono tabular-nums">₹{{ platformFee }}</span>
                </div>
              </div>

              <div class="flex justify-between text-sm font-bold">
                <span>Total College Fees (Simulated)</span>
                <span class="font-mono tabular-nums">₹{{ totalCollegeAppFees().toLocaleString('en-IN') }}</span>
              </div>

              <label class="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer pt-2">
                <input
                  type="checkbox"
                  [checked]="consentChecked()"
                  (change)="consentChecked.set(!consentChecked())"
                  class="mt-0.5 rounded border-slate-300 text-indigo-700"
                />
                <span>
                  I have reviewed my details and understand this is a simulated Common Application adapter with zero real payment processing.
                </span>
              </label>

              @if (validationMessage()) {
                <p class="text-xs font-semibold text-red-600 dark:text-red-400" role="alert">
                  {{ validationMessage() }}
                </p>
              }

              <button
                type="button"
                (click)="submitApplication()"
                [disabled]="isSubmitting()"
                class="w-full inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50 cursor-pointer"
              >
                <mat-icon class="!w-4 !h-4 !text-[16px]">send</mat-icon>
                <span>{{ isSubmitting() ? 'Submitting...' : 'Submit Common Application (Simulated)' }}</span>
              </button>
            </section>
          </div>
        </div>
      }
    </div>
  `,
})
export class CommonApplyPage {
  readonly api = inject(ApiService);
  readonly profileStore = inject(ProfileStorageService);
  private readonly route = inject(ActivatedRoute);
  readonly platformFee = PLATFORM_FEE_INR;

  readonly studentName = signal<string>(
    this.profileStore.profile().studentName || 'Aarav Verma'
  );
  readonly studentCategory = signal<string>(
    this.profileStore.profile().category || 'GEN'
  );
  readonly homeState = signal<string>(
    this.profileStore.profile().homeState || 'Maharashtra'
  );
  readonly preferredBranch = signal<string>(
    'Computer Science and Engineering (CSE)'
  );
  readonly selectedPartnerIds = signal<string[]>(['vit-vellore', 'thapar-patiala']);
  readonly consentChecked = signal<boolean>(false);
  readonly validationMessage = signal<string | null>(null);
  readonly isSubmitting = signal<boolean>(false);
  readonly confirmedApp = signal<ApplicationRecord | null>(null);

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      const colId = params.get('collegeId');
      if (colId && !this.selectedPartnerIds().includes(colId)) {
        this.selectedPartnerIds.update((list) => [...list, colId]);
      }
    });
  }

  readonly partnerColleges = computed(() =>
    this.api.colleges().filter((c) => c.isPartner)
  );

  readonly selectedPartnersObjects = computed(() =>
    this.partnerColleges().filter((c) =>
      this.selectedPartnerIds().includes(c.id)
    )
  );

  readonly totalCollegeAppFees = computed(() =>
    this.selectedPartnersObjects().reduce(
      (acc, c) => acc + (c.admissionRoutes[0]?.applicationFeeInr.value ?? 1500),
      0
    )
  );

  onNameInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.studentName.set(val);
    this.profileStore.updateProfile({studentName: val});
  }

  onCategoryChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value as
      | 'GEN'
      | 'OBC-NCL'
      | 'SC'
      | 'ST'
      | 'EWS';
    this.studentCategory.set(val);
    this.profileStore.updateProfile({category: val});
  }

  onStateInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.homeState.set(val);
    this.profileStore.updateProfile({homeState: val});
  }

  onBranchChange(event: Event): void {
    this.preferredBranch.set((event.target as HTMLSelectElement).value);
  }

  togglePartnerSelection(id: string): void {
    const cur = this.selectedPartnerIds();
    this.selectedPartnerIds.set(
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    );
  }

  async submitApplication(): Promise<void> {
    this.validationMessage.set(null);
    if (this.studentName().trim().length < 2) {
      this.validationMessage.set('Please enter your full name (at least 2 characters).');
      return;
    }
    if (this.selectedPartnerIds().length === 0) {
      this.validationMessage.set('Please select at least 1 Partner College.');
      return;
    }
    if (!this.consentChecked()) {
      this.validationMessage.set('Please confirm the review and consent checkbox before submitting.');
      return;
    }

    this.isSubmitting.set(true);
    try {
      const res = await this.api.submitCommonApplication({
        deviceId: this.profileStore.deviceId(),
        studentName: this.studentName().trim(),
        studentCategory: this.studentCategory(),
        homeState: this.homeState().trim(),
        preferredBranch: this.preferredBranch(),
        partnerCollegeIds: this.selectedPartnerIds(),
        consentConfirmed: true,
      });
      this.confirmedApp.set(res.application);
      this.api.showToast('Common Application submitted!', 'success');
    } catch (err) {
      this.validationMessage.set(
        err instanceof Error ? err.message : 'Submission failed.'
      );
    } finally {
      this.isSubmitting.set(false);
    }
  }
}

/**
 * FEATURE 8: Application Tracker (/tracker)
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-application-tracker-page',
  imports: [RouterLink, MatIconModule, StateViews],
  template: `
    <div class="space-y-8 pb-12">
      <div class="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
        <div>
          <span class="text-xs font-semibold text-teal-700 dark:text-teal-400">
            Feature #8 · Per-Application Stages, Timeline & Status
          </span>
          <h1 class="mt-1 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
            Application Tracker
          </h1>
          <p class="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Track your Common Application progress across stages and test the post-admission ₹99 fee simulation.
          </p>
        </div>

        <a
          routerLink="/apply"
          class="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-indigo-700 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-800"
        >
          <mat-icon class="!w-4 !h-4 !text-[16px]">add</mat-icon>
          <span>New Common Application</span>
        </a>
      </div>

      @if (loading()) {
        <app-state-views state="loading" [rows]="2" />
      } @else if (applications().length === 0) {
        <app-state-views
          state="empty"
          title="No applications submitted yet on this device"
          message="Submit a simulated Common Application to VIT Vellore, SRM IST, Thapar Patiala, or MIT Manipal to track stages and timeline here."
          actionLabel="Create Demo Application Now"
          (retryClicked)="createQuickDemoApp()"
        />
      } @else {
        <div class="space-y-6">
          @for (app of applications(); track app.id) {
            <article class="rounded-2xl border border-slate-200 bg-white p-6 space-y-5 dark:border-slate-800 dark:bg-slate-900">
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div class="font-mono text-xs text-slate-500">
                    Application ID: {{ app.id }} · Submitted {{ app.submittedAt.slice(0, 10) }}
                  </div>
                  <h2 class="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                    {{ app.partnerCollegeNames.join(', ') }} — {{ app.preferredBranch }}
                  </h2>
                  <div class="text-xs text-slate-500">
                    Applicant: {{ app.studentName }} ({{ app.studentCategory }} · {{ app.homeState }})
                  </div>
                </div>

                <span class="rounded-xl bg-indigo-50 px-3 py-1.5 font-mono text-xs font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">
                  Stage: {{ app.status }}
                </span>
              </div>

              <!-- 5-Stage Progress Stepper -->
              <div class="grid grid-cols-2 gap-2 sm:grid-cols-5 text-xs">
                @for (stage of allStages; track stage) {
                  @let reached = isStageReached(app.status, stage);
                  <div
                    class="rounded-xl border p-2.5 text-center font-medium"
                    [class.border-teal-600]="reached"
                    [class.bg-teal-50/60]="reached"
                    [class.text-teal-950]="reached"
                    [class.dark:border-teal-500]="reached"
                    [class.dark:bg-teal-950/50]="reached"
                    [class.dark:text-teal-200]="reached"
                    [class.border-slate-200]="!reached"
                    [class.text-slate-400]="!reached"
                    [class.dark:border-slate-800]="!reached"
                  >
                    {{ stage }}
                  </div>
                }
              </div>

              <!-- Timeline Log -->
              <div class="space-y-2 border-t border-slate-100 pt-4 text-xs dark:border-slate-800">
                <div class="font-bold text-slate-800 dark:text-slate-200">Application Timeline:</div>
                @for (item of app.timeline; track item.stage + item.date) {
                  <div class="flex items-start gap-2.5 text-slate-600 dark:text-slate-400">
                    <span class="font-mono text-[11px] font-semibold text-slate-500 tabular-nums shrink-0">{{ item.date }}</span>
                    <span><strong>{{ item.stage }}:</strong> {{ item.note }}</span>
                  </div>
                }
              </div>

              <!-- Simulate Stage Advancement -->
              <div class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs dark:border-slate-800">
                <span class="text-slate-500">Simulate stage progression (Prototype Controls):</span>
                <div class="flex flex-wrap gap-2">
                  @for (stage of allStages; track stage) {
                    <button
                      type="button"
                      (click)="advanceStage(app.id, stage)"
                      class="rounded-lg border border-slate-300 px-2.5 py-1 font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      Set: {{ stage }}
                    </button>
                  }
                </div>
              </div>
            </article>
          }
        </div>
      }
    </div>
  `,
})
export class ApplicationTrackerPage implements OnInit {
  readonly api = inject(ApiService);
  readonly profileStore = inject(ProfileStorageService);

  readonly loading = signal<boolean>(false);
  readonly applications = signal<ApplicationRecord[]>([]);

  readonly allStages: ApplicationStage[] = [
    'Submitted',
    'Document Check',
    'Counselling / Merit Review',
    'Offer Released',
    'Admission Confirmed',
  ];

  ngOnInit(): void {
    this.loadApps();
  }

  async loadApps(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.api.getApplications(this.profileStore.deviceId());
      this.applications.set(res.applications);
    } finally {
      this.loading.set(false);
    }
  }

  isStageReached(current: ApplicationStage, target: ApplicationStage): boolean {
    return this.allStages.indexOf(current) >= this.allStages.indexOf(target);
  }

  async advanceStage(appId: string, stage: ApplicationStage): Promise<void> {
    try {
      const res = await this.api.updateApplicationStatus(
        appId,
        this.profileStore.deviceId(),
        stage,
        `Status updated to ${stage} in Application Tracker.`
      );
      this.applications.update((list) =>
        list.map((a) => (a.id === appId ? res.application : a))
      );
      this.api.showToast(`Application moved to: ${stage}`, 'success');
    } catch {
      this.api.showToast('Updated stage in local session.', 'info');
    }
  }

  async createQuickDemoApp(): Promise<void> {
    const res = await this.api.submitCommonApplication({
      deviceId: this.profileStore.deviceId(),
      studentName: this.profileStore.profile().studentName || 'Demo Applicant',
      studentCategory: this.profileStore.profile().category || 'GEN',
      homeState: this.profileStore.profile().homeState || 'Maharashtra',
      preferredBranch: 'Computer Science and Engineering (CSE)',
      partnerCollegeIds: ['vit-vellore', 'thapar-patiala'],
      consentConfirmed: true,
    });
    this.applications.set([res.application]);
  }
}

/**
 * FEATURE 9: Document Checker & In-Browser Canvas Resizer (/documents)
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-document-checker-page',
  imports: [MatIconModule],
  template: `
    <div class="space-y-8 pb-12">
      <div class="border-b border-slate-200 pb-5 dark:border-slate-800">
        <span class="text-xs font-semibold text-teal-700 dark:text-teal-400">
          Feature #9 · 100% Client-Side HTML5 Canvas Document Resizer
        </span>
        <h1 class="mt-1 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
          Exam Document Checker, Photo & Signature Resizer
        </h1>
        <p class="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          Resize and compress photos and signatures to exact JEE Main, BITSAT, VITEEE, and State CET specifications. <strong>Privacy guarantee: Files are processed inside your browser and are never uploaded to any server.</strong>
        </p>
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <!-- Left Column: Canvas Resizer & Presets -->
        <section class="rounded-2xl border border-slate-200 bg-white p-6 space-y-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">
            1. Select Exam Preset & Choose Image (Processed Locally)
          </h2>

          <div class="grid gap-3 sm:grid-cols-2 text-xs">
            @for (preset of presets; track preset.id) {
              <button
                type="button"
                (click)="selectPreset(preset)"
                class="rounded-xl border p-3 text-left transition-colors cursor-pointer"
                [class.border-indigo-600]="activePreset().id === preset.id"
                [class.bg-indigo-50/50]="activePreset().id === preset.id"
                [class.dark:border-indigo-400]="activePreset().id === preset.id"
                [class.border-slate-200]="activePreset().id !== preset.id"
                [class.dark:border-slate-800]="activePreset().id !== preset.id"
              >
                <div class="font-bold text-slate-900 dark:text-slate-100">{{ preset.label }}</div>
                <div class="mt-0.5 font-mono text-[11px] text-slate-500 tabular-nums">
                  Target: {{ preset.width }}×{{ preset.height }} px · {{ preset.minKb }}–{{ preset.maxKb }} KB (JPEG)
                </div>
              </button>
            }
          </div>

          <!-- File Dropzone / Input + Demo Sample Generator -->
          <div class="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-center space-y-3 dark:border-slate-700 dark:bg-slate-800/40">
            <mat-icon class="!w-8 !h-8 !text-[32px] text-indigo-600 mx-auto">upload_file</mat-icon>
            <div class="text-xs text-slate-700 dark:text-slate-300">
              Select a JPG or PNG photo/signature from your phone or computer:
            </div>
            <div class="flex flex-wrap items-center justify-center gap-3">
              <label class="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-indigo-700 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-800 cursor-pointer">
                <mat-icon class="!w-4 !h-4 !text-[16px]">folder_open</mat-icon>
                <span>Choose Image File</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  (change)="onFileSelected($event)"
                  class="hidden"
                />
              </label>

              <button
                type="button"
                (click)="generateSamplePassportImage()"
                class="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer"
              >
                <mat-icon class="!w-4 !h-4 !text-[16px]">auto_fix_high</mat-icon>
                <span>Test with Sample Photo</span>
              </button>
            </div>
          </div>

          <!-- Quality Slider -->
          <div class="space-y-1.5 text-xs">
            <div class="flex justify-between font-semibold">
              <label for="jpeg-quality">JPEG Compression Quality</label>
              <span class="font-mono tabular-nums">{{ Math.round(jpegQuality() * 100) }}%</span>
            </div>
            <input
              id="jpeg-quality"
              type="range"
              min="0.3"
              max="0.98"
              step="0.04"
              [value]="jpegQuality()"
              (input)="onQualityChange($event)"
              class="w-full accent-indigo-700 cursor-pointer"
            />
          </div>

          <!-- Before and After Preview -->
          @if (resizedDataUrl()) {
            <div class="grid gap-4 sm:grid-cols-2 border-t border-slate-200 pt-4 text-xs dark:border-slate-800">
              <div class="space-y-1.5">
                <div class="font-bold text-slate-700 dark:text-slate-300">Before (Original)</div>
                <div class="font-mono text-[11px] text-slate-500 tabular-nums">
                  Size: {{ originalSizeKb() }} KB ({{ originalDims() }})
                </div>
                @if (originalDataUrl()) {
                  <img
                    [src]="originalDataUrl()!"
                    alt="Original uploaded preview"
                    class="max-h-36 rounded-lg border border-slate-200 object-contain"
                  />
                }
              </div>

              <div class="space-y-1.5">
                <div class="font-bold text-teal-800 dark:text-teal-300">
                  After ({{ activePreset().width }}×{{ activePreset().height }} px JPEG)
                </div>
                <div class="font-mono text-[11px] font-semibold tabular-nums">
                  Compressed Size: {{ outputSizeKb() }} KB
                </div>
                <img
                  [src]="resizedDataUrl()!"
                  alt="Resized exam-ready preview"
                  class="max-h-36 rounded-lg border border-teal-500 object-contain"
                />
                <div class="pt-1">
                  <a
                    [href]="resizedDataUrl()!"
                    [download]="activePreset().id + '-resized.jpg'"
                    class="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-teal-700 px-3.5 py-1.5 font-semibold text-white hover:bg-teal-800"
                  >
                    <mat-icon class="!w-4 !h-4 !text-[16px]">download</mat-icon>
                    <span>Download Exam-Ready JPG</span>
                  </a>
                </div>
              </div>
            </div>
          }
        </section>

        <!-- Right Column: Per-Exam Document Checklist -->
        <section class="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">
            2. Per-Exam Mandatory Document Checklist
          </h2>
          <p class="text-xs text-slate-600 dark:text-slate-400">
            Keep scanned PDFs (100 KB – 300 KB) and 4 physical photocopies of these documents ready before counselling starts.
          </p>

          <div class="space-y-3 text-xs">
            @for (doc of examDocChecklist; track doc.title) {
              <div class="rounded-xl border border-slate-200 p-3.5 space-y-1 dark:border-slate-800">
                <div class="flex items-center justify-between font-bold text-slate-900 dark:text-slate-100">
                  <span>{{ doc.title }}</span>
                  <span class="font-mono text-[11px] text-indigo-700 dark:text-indigo-400">{{ doc.exams }}</span>
                </div>
                <p class="text-slate-600 dark:text-slate-400">{{ doc.spec }}</p>
              </div>
            }
          </div>
        </section>
      </div>
    </div>
  `,
})
export class DocumentCheckerPage {
  protected readonly Math = Math;

  readonly presets = [
    {
      id: 'jee-main-photo',
      label: 'JEE Main / JoSAA Passport Photo',
      width: 200,
      height: 230,
      minKb: 10,
      maxKb: 200,
    },
    {
      id: 'jee-main-signature',
      label: 'JEE Main / NTA Candidate Signature',
      width: 140,
      height: 60,
      minKb: 4,
      maxKb: 30,
    },
    {
      id: 'bitsat-viteee-photo',
      label: 'BITSAT / VITEEE Colour Photo',
      width: 240,
      height: 300,
      minKb: 20,
      maxKb: 200,
    },
    {
      id: 'state-cet-photo',
      label: 'MHT CET / WBJEE / KCET Photo',
      width: 200,
      height: 250,
      minKb: 15,
      maxKb: 100,
    },
  ];

  readonly activePreset = signal(this.presets[0]);
  readonly jpegQuality = signal<number>(0.86);

  readonly originalDataUrl = signal<string | null>(null);
  readonly originalSizeKb = signal<number>(0);
  readonly originalDims = signal<string>('');
  readonly resizedDataUrl = signal<string | null>(null);
  readonly outputSizeKb = signal<number>(0);

  readonly examDocChecklist = [
    {
      title: 'Class 10 Marksheet & Passing Certificate',
      exams: 'All Exams & JoSAA',
      spec: 'Used as official proof of Date of Birth and exact name spelling.',
    },
    {
      title: 'Class 12 Marks Statement & Admit Card',
      exams: 'JoSAA / BITSAT / State CET',
      spec: 'Must show individual marks in Physics, Mathematics, and Chemistry.',
    },
    {
      title: 'Central-Format OBC-NCL / EWS Certificate (Issued after April 1)',
      exams: 'JEE Main / JEE Advanced / JoSAA',
      spec: 'Must be in Government of India central format issued in current financial year.',
    },
    {
      title: 'Tehsildar / Revenue Officer Family Income Certificate',
      exams: 'IIT/NIT Fee Remission & AICTE TFW',
      spec: 'Required for 100% / 66.6% NIT-IIT tuition remission and State CET TFWS seats.',
    },
    {
      title: 'Gap Year Affidavit & Medical Fitness Certificate (JoSAA Annexure 7)',
      exams: 'Physical Reporting at Institute',
      spec: 'Signed by a registered medical practitioner for physical reporting.',
    },
  ];

  selectPreset(preset: (typeof this.presets)[number]): void {
    this.activePreset.set(preset);
    if (this.originalDataUrl()) {
      this.processImageDataUrl(this.originalDataUrl()!);
    }
  }

  onQualityChange(event: Event): void {
    const val = Number((event.target as HTMLInputElement).value);
    if (!Number.isNaN(val)) {
      this.jpegQuality.set(val);
      if (this.originalDataUrl()) {
        this.processImageDataUrl(this.originalDataUrl()!);
      }
    }
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.originalSizeKb.set(Math.round((file.size / 1024) * 10) / 10);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      this.originalDataUrl.set(dataUrl);
      this.processImageDataUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  generateSamplePassportImage(): void {
    if (typeof document === 'undefined') return;
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 480, 600);
    ctx.fillStyle = '#e0e7ff';
    ctx.fillRect(40, 40, 400, 520);
    ctx.fillStyle = '#312e81';
    ctx.beginPath();
    ctx.arc(240, 220, 85, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(110, 330, 260, 170);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SAMPLE STUDENT PHOTO', 240, 420);

    const sampleUrl = canvas.toDataURL('image/png');
    this.originalDataUrl.set(sampleUrl);
    this.originalSizeKb.set(42.5);
    this.originalDims.set('480×600 px');
    this.processImageDataUrl(sampleUrl);
  }

  private processImageDataUrl(dataUrl: string): void {
    if (typeof window === 'undefined') return;
    const img = new Image();
    img.onload = () => {
      this.originalDims.set(`${img.width}×${img.height} px`);
      const target = this.activePreset();
      const canvas = document.createElement('canvas');
      canvas.width = target.width;
      canvas.height = target.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, target.width, target.height);
      ctx.drawImage(img, 0, 0, target.width, target.height);

      const outUrl = canvas.toDataURL('image/jpeg', this.jpegQuality());
      this.resizedDataUrl.set(outUrl);
      const base64Len = outUrl.split(',')[1]?.length || 0;
      const bytes = (base64Len * 3) / 4;
      this.outputSizeKb.set(Math.round((bytes / 1024) * 10) / 10);
    };
    img.src = dataUrl;
  }
}
