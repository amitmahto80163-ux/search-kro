import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../services/api.service';
import { I18nService } from '../services/i18n.service';
import { ProfileStorageService } from '../services/storage.service';
import { AIDisclaimer, HowWeCalculateModal } from '../components/ui';
import {
  AiBranchResponse,
  AiFamilyResponse,
  AiPlanResponse,
  EligibilityResultItem,
} from '../../shared/schemas';

// ============================================================================
// 1. DecisionSupportPage (/decision) — Feature #28 Rank Eligibility & #29 Branch Quiz
// ============================================================================
@Component({
  selector: 'app-decision-support-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, MatIconModule, AIDisclaimer, HowWeCalculateModal],
  template: `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <span class="text-xs font-mono uppercase tracking-wider text-teal-700 dark:text-teal-400">Features #28 & #29 • Decision Engine</span>
          <h1 class="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-1">Rank Eligibility & Branch Guidance</h1>
          <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Compare your entrance exam rank against historical cutoffs and take our 8-question aptitude quiz to find your best B.Tech branch.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button type="button" (click)="activeTab.set('rank')"
            class="px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            [class]="activeTab() === 'rank' ? 'bg-teal-700 text-white' : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'">
            <mat-icon class="!text-sm !w-4 !h-4">analytics</mat-icon>
            <span>Rank Eligibility Checker</span>
          </button>
          <button type="button" (click)="activeTab.set('quiz')"
            class="px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            [class]="activeTab() === 'quiz' ? 'bg-teal-700 text-white' : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'">
            <mat-icon class="!text-sm !w-4 !h-4">psychology</mat-icon>
            <span>Branch Guidance Quiz</span>
          </button>
        </div>
      </div>

      @if (activeTab() === 'rank') {
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div class="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4 h-fit">
            <div class="flex items-center justify-between">
              <h2 class="text-base font-bold text-slate-900 dark:text-white">Enter Your Exam Details</h2>
              <button type="button" (click)="showFormula.set(true)" class="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-1 cursor-pointer">
                <mat-icon class="!text-xs !w-3.5 !h-3.5">functions</mat-icon>
                <span>Formula</span>
              </button>
            </div>
            <form [formGroup]="rankForm" (ngSubmit)="runEligibility()" class="space-y-4">
              <div>
                <label for="rank-exam-id" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Entrance Exam</label>
                <select id="rank-exam-id" formControlName="examId" class="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white">
                  <option value="jee-main">JEE Main</option>
                  <option value="jee-advanced">JEE Advanced</option>
                  <option value="bitsat">BITSAT</option>
                  <option value="viteee">VITEEE</option>
                  <option value="mht-cet">MHT CET</option>
                  <option value="kcet">KCET</option>
                  <option value="comedk-uget">COMEDK UGET</option>
                  <option value="wbjee">WBJEE</option>
                  <option value="tnea">TNEA</option>
                </select>
              </div>
              <div>
                <label for="rank-metric-type" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Metric Type</label>
                <select id="rank-metric-type" formControlName="metricType" class="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white">
                  <option value="Rank">All-India / State Rank</option>
                  <option value="Percentile">Percentile (0–100)</option>
                  <option value="Score">Exam Score</option>
                </select>
              </div>
              <div>
                <label for="rank-user-value" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Your Rank / Percentile / Score</label>
                <input id="rank-user-value" type="number" formControlName="userValue" min="1" max="1500000"
                  class="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm font-mono text-slate-900 dark:text-white" />
              </div>
              <div>
                <label for="rank-category" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Category</label>
                <select id="rank-category" formControlName="category" class="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white">
                  <option value="GEN">General / Open (GEN)</option>
                  <option value="OBC-NCL">OBC-NCL</option>
                  <option value="EWS">Gen-EWS</option>
                  <option value="SC">SC</option>
                  <option value="ST">ST</option>
                </select>
              </div>
              <button type="submit"
                class="w-full py-2.5 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer">
                <mat-icon class="!text-sm !w-4 !h-4">search</mat-icon>
                <span>Check Cutoff Eligibility</span>
              </button>
            </form>
            <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 space-y-1">
              <p class="font-bold text-slate-800 dark:text-slate-200">Classification Rules:</p>
              <p>• <strong class="text-emerald-700 dark:text-emerald-400">Safe:</strong> Your rank is ≤ 80% of closing rank</p>
              <p>• <strong class="text-teal-700 dark:text-teal-400">Target:</strong> Your rank is between 80% and 105% of closing rank</p>
              <p>• <strong class="text-amber-700 dark:text-amber-400">Dream:</strong> Your rank is between 105% and 135% of closing rank</p>
              <p>• <strong class="text-rose-700 dark:text-rose-400">Unlikely:</strong> Your rank is &gt; 135% of closing rank</p>
            </div>
          </div>

          <div class="lg:col-span-8 space-y-4">
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              @for (group of ['Safe', 'Target', 'Ambitious', 'Cutoff Not Verified']; track group) {
                <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                  <div class="text-xs font-mono uppercase text-slate-500">{{ group }}</div>
                  <div class="text-2xl font-bold font-mono mt-1 text-slate-900 dark:text-white">
                    {{ countByTier(group) }}
                  </div>
                </div>
              }
            </div>

            <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
              <div class="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h3 class="text-sm font-bold text-slate-900 dark:text-white">Cutoff Comparison Results ({{ eligibilityResults().length }} records)</h3>
                <span class="text-xs text-slate-500">Guidance only • Never a guarantee of admission</span>
              </div>
              <div class="divide-y divide-slate-200 dark:divide-slate-800">
                @for (row of eligibilityResults(); track $index) {
                  <div class="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <div>
                      <div class="flex items-center gap-2 flex-wrap">
                        <a [routerLink]="['/college', row.collegeId]" class="text-sm font-bold text-slate-900 dark:text-white hover:text-teal-700 dark:hover:text-teal-400">
                          {{ row.collegeName }}
                        </a>
                        <span class="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {{ row.branchName }} ({{ row.branchCode }})
                        </span>
                        <span class="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {{ row.examName }}
                        </span>
                      </div>
                      <p class="text-xs text-slate-600 dark:text-slate-400 mt-1">{{ row.explanation }}</p>
                      <div class="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                        <span>Source: {{ row.sourceName }} • Verified {{ row.lastVerified }}</span>
                        @if (row.sourceUrl) {
                          <a [href]="row.sourceUrl" target="_blank" rel="noopener noreferrer" class="text-teal-700 dark:text-teal-400 hover:underline">Verify ↗</a>
                        }
                      </div>
                    </div>
                    <div class="flex items-center gap-3 shrink-0">
                      <div class="text-right font-mono">
                        <div class="text-xs text-slate-500">Closing {{ row.metricType }}</div>
                        <div class="text-sm font-bold text-slate-900 dark:text-white">{{ row.closingValue !== null ? (row.closingValue | number) : 'N/A' }}</div>
                      </div>
                      <span class="px-3 py-1 rounded-lg text-xs font-bold font-mono"
                        [class]="row.classification === 'Safe' ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-300' :
                                 row.classification === 'Target' ? 'bg-teal-100 text-teal-900 dark:bg-teal-950/70 dark:text-teal-300' :
                                 row.classification === 'Ambitious' ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-300' :
                                 'bg-rose-100 text-rose-900 dark:bg-rose-950/70 dark:text-rose-300'">
                        {{ row.classification }}
                      </span>
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      }

      @if (activeTab() === 'quiz') {
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div class="lg:col-span-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-5">
            <div>
              <h2 class="text-lg font-bold text-slate-900 dark:text-white">8-Question Engineering Branch Quiz</h2>
              <p class="text-xs text-slate-500 mt-0.5">Don't pick CSE blindly because of herd mentality. Answer honestly to see your top 2 matching B.Tech branches.</p>
            </div>
            <div class="space-y-4">
              @for (q of quizQuestions; track q.id; let idx = $index) {
                <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-2">
                  <div class="text-xs font-bold text-slate-800 dark:text-slate-200">{{ idx + 1 }}. {{ q.question }}</div>
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    @for (opt of q.options; track opt) {
                      <button type="button" (click)="selectAnswer(q.id, opt)"
                        class="text-left px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer"
                        [class]="quizAnswers()[q.id] === opt
                          ? 'bg-teal-700 text-white border-teal-700'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-teal-500'">
                        {{ opt }}
                      </button>
                    }
                  </div>
                </div>
              }
            </div>
            <button type="button" (click)="submitQuiz()" [disabled]="quizLoading()"
              class="w-full py-3 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer">
              <mat-icon class="!text-base !w-4 !h-4">auto_awesome</mat-icon>
              <span>{{ quizLoading() ? 'Analyzing Your Engineering Fit...' : 'Get My Top 2 Branch Recommendations' }}</span>
            </button>
          </div>

          <div class="lg:col-span-6 space-y-4">
            @if (quizResult(); as res) {
              <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6">
                <div>
                  <span class="text-xs font-mono uppercase text-teal-700 dark:text-teal-400">Your Personalized Result</span>
                  <h3 class="text-lg font-bold text-slate-900 dark:text-white mt-1">{{ res.summaryAdvice }}</h3>
                </div>
                <div class="space-y-4">
                  @for (rec of res.recommendedBranches; track rec.branchCode; let i = $index) {
                    <div class="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 space-y-3">
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                          <span class="w-6 h-6 rounded-full bg-teal-700 text-white text-xs font-bold flex items-center justify-center">#{{ i + 1 }}</span>
                          <h4 class="text-base font-bold text-slate-900 dark:text-white">{{ rec.branchName }}</h4>
                        </div>
                        <span class="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-300 text-xs font-mono font-bold">
                          {{ rec.branchCode }}
                        </span>
                      </div>
                      <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{{ rec.fitReason }}</p>
                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-700 text-xs">
                        <div>
                          <div class="font-semibold text-slate-500">Core Skills to Build</div>
                          <div class="flex flex-wrap gap-1 mt-1">
                            @for (skill of rec.coreSkillsToBuild; track skill) {
                              <span class="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px]">{{ skill }}</span>
                            }
                          </div>
                        </div>
                        <div>
                          <div class="font-semibold text-slate-500">Typical Careers</div>
                          <div class="flex flex-wrap gap-1 mt-1">
                            @for (role of rec.typicalCareers; track role) {
                              <span class="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px]">{{ role }}</span>
                            }
                          </div>
                        </div>
                      </div>
                    </div>
                  }
                </div>
                <app-ai-disclaimer [textToReadOrTranslate]="res.summaryAdvice" />
              </div>
            } @else {
              <div class="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center space-y-2">
                <mat-icon class="!text-3xl !w-8 !h-8 text-slate-400 mx-auto">psychology</mat-icon>
                <h3 class="text-sm font-bold text-slate-800 dark:text-slate-200">Complete the 8 Questions on the Left</h3>
                <p class="text-xs text-slate-500 max-w-md mx-auto">
                  We evaluate your math comfort, hardware vs software interest, and career timeline to recommend your top 2 engineering branches with core skills and career paths.
                </p>
              </div>
            }
          </div>
        </div>
      }

      <app-how-we-calculate-modal [isOpen]="showFormula()" (closed)="showFormula.set(false)" />
    </div>
  `
})
export class DecisionSupportPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly profileStore = inject(ProfileStorageService);

  readonly activeTab = signal<'rank' | 'quiz'>('rank');
  readonly showFormula = signal(false);
  readonly eligibilityResults = signal<EligibilityResultItem[]>([]);

  readonly rankForm = this.fb.nonNullable.group({
    examId: ['jee-main'],
    metricType: ['Rank' as 'Rank' | 'Percentile' | 'Score'],
    userValue: [14500],
    category: ['GEN' as 'GEN' | 'OBC-NCL' | 'SC' | 'ST' | 'EWS'],
  });

  readonly quizQuestions = [
    { id: 'q1', question: 'Which problem sounds most exciting to solve?', options: ['Writing algorithms & apps', 'Designing chips, circuits & robots', 'Building engines, structures & grids'] },
    { id: 'q2', question: 'How do you feel about abstract mathematics & probability?', options: ['Love calculus, stats & linear algebra', 'Prefer applied physics & electronics', 'Prefer hands-on CAD & lab work'] },
    { id: 'q3', question: 'What kind of lab environment do you prefer?', options: ['Laptop + terminal + cloud servers', 'Oscilloscopes, microcontrollers & PCB', 'Wind tunnels, CNC machines & workshops'] },
    { id: 'q4', question: 'Where do you see yourself 5 years after B.Tech?', options: ['Software / AI / Product company', 'Semiconductor / Core R&D / PSU', 'Manufacturing / EV / Infrastructure / MBA'] },
    { id: 'q5', question: 'How comfortable are you with debugging code for hours?', options: ['Enjoy hunting bugs till it works', 'Okay with scripting for hardware', 'Prefer physical troubleshooting'] },
    { id: 'q6', question: 'Which emerging tech excites you the most?', options: ['LLMs, Cybersecurity & Cloud', 'VLSI, 6G & Embedded IoT', 'Electric Vehicles, Robotics & Clean Energy'] },
    { id: 'q7', question: 'What is your priority for your first job after graduation?', options: ['High Day-1 software package', 'Stable core engineering & GATE/PSU', 'Flexible interdisciplinary career'] },
    { id: 'q8', question: 'How do you prefer to learn new concepts?', options: ['Self-paced online docs & hackathons', 'Structured university labs & IEEE papers', 'Team workshops & field projects'] }
  ];

  readonly quizAnswers = signal<Record<string, string>>({
    q1: 'Writing algorithms & apps',
    q2: 'Love calculus, stats & linear algebra',
    q3: 'Laptop + terminal + cloud servers',
    q4: 'Software / AI / Product company',
    q5: 'Enjoy hunting bugs till it works',
    q6: 'LLMs, Cybersecurity & Cloud',
    q7: 'High Day-1 software package',
    q8: 'Self-paced online docs & hackathons',
  });
  readonly quizLoading = signal(false);
  readonly quizResult = signal<AiBranchResponse | null>(null);

  ngOnInit(): void {
    const p = this.profileStore.profile();
    if (p.jeeRankOrPercentile) {
      this.rankForm.patchValue({ userValue: p.jeeRankOrPercentile, category: p.category });
    }
    void this.runEligibility();
  }

  async runEligibility(): Promise<void> {
    const raw = this.rankForm.getRawValue();
    const res = await this.api.checkEligibility({
      examId: raw.examId,
      metricValue: Number(raw.userValue) || 15000,
      category: raw.category,
    });
    this.eligibilityResults.set(res.results);
  }

  countByTier(tier: string): number {
    return this.eligibilityResults().filter((r) => r.classification === tier).length;
  }

  selectAnswer(qid: string, opt: string): void {
    this.quizAnswers.update((curr) => ({ ...curr, [qid]: opt }));
  }

  async submitQuiz(): Promise<void> {
    this.quizLoading.set(true);
    try {
      const answers = this.quizQuestions.map((q) => ({
        questionId: q.id,
        question: q.question,
        selectedOption: this.quizAnswers()[q.id] ?? q.options[0],
      }));
      const res = await this.api.getBranchGuidance(answers);
      this.quizResult.set(res);
    } finally {
      this.quizLoading.set(false);
    }
  }
}

// ============================================================================
// 2. BackupPlanPage (/plan) — Feature #30 Backup Plan Engine
// ============================================================================
@Component({
  selector: 'app-backup-plan-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, MatIconModule, AIDisclaimer],
  template: `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <span class="text-xs font-mono uppercase tracking-wider text-teal-700 dark:text-teal-400">Feature #30 • Zero-Panic Admission Strategy</span>
          <h1 class="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-1">Backup Plan Engine (Dream • Target • Safe)</h1>
          <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Never rely on a single counselling round. Build a 3-tier college matrix across All-India Exams, College Processes, and Direct Admission routes with If-This-Fails-Then-That steps.
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div class="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4 h-fit">
          <h2 class="text-base font-bold text-slate-900 dark:text-white">Your Profile Snapshot</h2>
          <form [formGroup]="planForm" (ngSubmit)="generatePlan()" class="space-y-4">
            <div>
              <label for="plan-class12" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">12th PCM Percentage (%)</label>
              <input id="plan-class12" type="number" formControlName="class12Percent" min="45" max="100"
                class="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm font-mono text-slate-900 dark:text-white" />
            </div>
            <div>
              <label for="plan-jee-rank" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">JEE Rank / Percentile</label>
              <input id="plan-jee-rank" type="text" formControlName="jeePercentileOrRank"
                class="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm font-mono text-slate-900 dark:text-white" />
            </div>
            <div>
              <label for="plan-budget" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Annual Tuition Budget (₹ INR)</label>
              <input id="plan-budget" type="number" formControlName="budgetPerYearInr" min="50000" max="1000000" step="25000"
                class="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm font-mono text-slate-900 dark:text-white" />
            </div>
            <div>
              <label for="plan-state" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Preferred State</label>
              <input id="plan-state" type="text" formControlName="preferredState"
                class="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white" />
            </div>
            <div>
              <label for="plan-branch" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Preferred Branch Code</label>
              <input id="plan-branch" type="text" formControlName="preferredBranch"
                class="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white" />
            </div>
            <button type="submit" [disabled]="loading()"
              class="w-full py-2.5 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer">
              <mat-icon class="!text-base !w-4 !h-4">route</mat-icon>
              <span>{{ loading() ? 'Building 3-Route Backup Plan...' : 'Generate My Backup Plan' }}</span>
            </button>
          </form>
        </div>

        <div class="lg:col-span-8 space-y-6">
          @if (plan(); as p) {
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="bg-white dark:bg-slate-900 rounded-2xl border border-amber-300 dark:border-amber-800/80 p-5 space-y-3">
                <div class="flex items-center justify-between">
                  <span class="px-2.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 text-xs font-bold font-mono">DREAM TIER</span>
                  <mat-icon class="!text-base !w-4 !h-4 text-amber-600">star</mat-icon>
                </div>
                @for (item of p.dreamColleges; track item.collegeId) {
                  <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                    <a [routerLink]="['/college', item.collegeId]" class="text-sm font-bold text-slate-900 dark:text-white hover:text-teal-700">{{ item.collegeName }}</a>
                    <div class="text-xs font-mono text-teal-700 dark:text-teal-400">{{ item.route }}</div>
                    <p class="text-xs text-slate-600 dark:text-slate-400">{{ item.reason }}</p>
                    <div class="text-[11px] font-semibold text-amber-700 dark:text-amber-400 pt-1">{{ item.deadlineNote }}</div>
                  </div>
                }
              </div>

              <div class="bg-white dark:bg-slate-900 rounded-2xl border border-teal-300 dark:border-teal-800/80 p-5 space-y-3">
                <div class="flex items-center justify-between">
                  <span class="px-2.5 py-0.5 rounded-md bg-teal-100 dark:bg-teal-950/70 text-teal-900 dark:text-teal-300 text-xs font-bold font-mono">TARGET TIER</span>
                  <mat-icon class="!text-base !w-4 !h-4 text-teal-600">gps_fixed</mat-icon>
                </div>
                @for (item of p.targetColleges; track item.collegeId) {
                  <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                    <a [routerLink]="['/college', item.collegeId]" class="text-sm font-bold text-slate-900 dark:text-white hover:text-teal-700">{{ item.collegeName }}</a>
                    <div class="text-xs font-mono text-teal-700 dark:text-teal-400">{{ item.route }}</div>
                    <p class="text-xs text-slate-600 dark:text-slate-400">{{ item.reason }}</p>
                    <div class="text-[11px] font-semibold text-teal-700 dark:text-teal-400 pt-1">{{ item.deadlineNote }}</div>
                  </div>
                }
              </div>

              <div class="bg-white dark:bg-slate-900 rounded-2xl border border-emerald-300 dark:border-emerald-800/80 p-5 space-y-3">
                <div class="flex items-center justify-between">
                  <span class="px-2.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-300 text-xs font-bold font-mono">SAFE BACKUP</span>
                  <mat-icon class="!text-base !w-4 !h-4 text-emerald-600">verified_user</mat-icon>
                </div>
                @for (item of p.safeColleges; track item.collegeId) {
                  <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                    <a [routerLink]="['/college', item.collegeId]" class="text-sm font-bold text-slate-900 dark:text-white hover:text-teal-700">{{ item.collegeName }}</a>
                    <div class="text-xs font-mono text-teal-700 dark:text-teal-400">{{ item.route }}</div>
                    <p class="text-xs text-slate-600 dark:text-slate-400">{{ item.reason }}</p>
                    <div class="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 pt-1">{{ item.deadlineNote }}</div>
                  </div>
                }
              </div>
            </div>

            <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
              <h3 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <mat-icon class="!text-base !w-4 !h-4 text-teal-700">alt_route</mat-icon>
                <span>If-This-Fails-Then-That Contingency Playbook</span>
              </h3>
              <div class="space-y-2.5">
                @for (step of p.ifThisFailsThenThatSteps; track $index; let i = $index) {
                  <div class="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                    <span class="w-6 h-6 rounded-full bg-teal-700 text-white text-xs font-mono font-bold flex items-center justify-center shrink-0">{{ i + 1 }}</span>
                    <div class="text-xs sm:text-sm space-y-0.5">
                      <div class="font-bold text-slate-900 dark:text-white">{{ step.scenario }} <span class="text-xs font-mono text-teal-700 dark:text-teal-400">({{ step.timeline }})</span></div>
                      <p class="text-slate-700 dark:text-slate-300">{{ step.fallbackAction }}</p>
                    </div>
                  </div>
                }
              </div>
              <app-ai-disclaimer [textToReadOrTranslate]="p.disclaimer" />
            </div>
          }
        </div>
      </div>
    </div>
  `
})
export class BackupPlanPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly profileStore = inject(ProfileStorageService);

  readonly loading = signal(false);
  readonly plan = signal<AiPlanResponse | null>(null);

  readonly planForm = this.fb.nonNullable.group({
    class12Percent: [84],
    jeePercentileOrRank: ['14500'],
    budgetPerYearInr: [250000],
    preferredState: ['Maharashtra'],
    preferredBranch: ['CSE'],
  });

  ngOnInit(): void {
    const p = this.profileStore.profile();
    this.planForm.patchValue({
      class12Percent: p.class12Percent || 84,
      jeePercentileOrRank: String(p.jeeRankOrPercentile || 14500),
      budgetPerYearInr: p.annualBudgetInr || 250000,
      preferredState: p.homeState || 'Maharashtra',
      preferredBranch: p.preferredBranch || 'CSE',
    });
    void this.generatePlan();
  }

  async generatePlan(): Promise<void> {
    this.loading.set(true);
    try {
      const v = this.planForm.getRawValue();
      const res = await this.api.generateBackupPlan({
        budgetPerYearInr: Number(v.budgetPerYearInr) || 250000,
        preferredBranches: [v.preferredBranch || 'CSE'],
        preferredStates: [v.preferredState || 'Maharashtra'],
        jeePercentileOrRank: v.jeePercentileOrRank,
        class12Percent: Number(v.class12Percent) || 84,
      });
      this.plan.set(res);
    } finally {
      this.loading.set(false);
    }
  }
}

// ============================================================================
// 3. FamilyDecisionPage (/family) — Feature #31 Family Room & #32 Parent Mode
// ============================================================================
@Component({
  selector: 'app-family-decision-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, MatIconModule, AIDisclaimer],
  template: `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <span class="text-xs font-mono uppercase tracking-wider text-teal-700 dark:text-teal-400">Features #31 & #32 • Collaborative Family Decision Room</span>
          <h1 class="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-1">Student vs Parent Alignment Room</h1>
          <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Score priority weights separately from the Student's perspective and Parents' perspective, compute alignment, and print or share on WhatsApp.
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2 no-print">
          <button type="button" (click)="i18n.toggleParentMode()"
            class="px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer"
            [class]="i18n.parentMode() ? 'bg-amber-600 text-white border-amber-600' : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200'">
            <mat-icon class="!text-sm !w-4 !h-4">family_restroom</mat-icon>
            <span>{{ i18n.parentMode() ? 'Parent Mode: ON (Larger Font + Safety Focus)' : 'Enable Parent Mode' }}</span>
          </button>
          <button type="button" (click)="printSummary()"
            class="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold flex items-center gap-1.5 cursor-pointer">
            <mat-icon class="!text-sm !w-4 !h-4">print</mat-icon>
            <span>Print Family Sheet</span>
          </button>
          <a [href]="whatsappShareUrl()" target="_blank" rel="noopener noreferrer"
            class="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5">
            <mat-icon class="!text-sm !w-4 !h-4">share</mat-icon>
            <span>Share on WhatsApp</span>
          </a>
        </div>
      </div>

      <!-- Parent Mode Explainer Banner -->
      <div class="p-5 rounded-2xl bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 space-y-2">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <h2 class="text-base font-bold text-amber-950 dark:text-amber-200 flex items-center gap-2">
            <mat-icon class="!text-base !w-4 !h-4">verified_user</mat-icon>
            <span>माता-पिता के लिए विशेष सारांश / ਮਾਪਿਆਂ ਲਈ ਮੁੱਖ ਜਾਣਕਾਰੀ (Parent Safety & Cost Brief)</span>
          </h2>
          <div class="flex items-center gap-1.5 no-print">
            <button type="button" (click)="i18n.setLanguage('en')" class="px-2.5 py-1 rounded text-xs font-bold bg-white dark:bg-slate-900 border border-amber-300 cursor-pointer">English</button>
            <button type="button" (click)="i18n.setLanguage('hi')" class="px-2.5 py-1 rounded text-xs font-bold bg-white dark:bg-slate-900 border border-amber-300 cursor-pointer">हिंदी</button>
            <button type="button" (click)="i18n.setLanguage('pa')" class="px-2.5 py-1 rounded text-xs font-bold bg-white dark:bg-slate-900 border border-amber-300 cursor-pointer">ਪੰਜਾਬੀ</button>
          </div>
        </div>
        <p class="text-xs sm:text-sm text-amber-900 dark:text-amber-300 leading-relaxed">
          We highlight <strong>UGC/AICTE statutory approval</strong>, <strong>True 4-Year Total Cost (Tuition + Hostel + Mess + Caution Deposit)</strong>, <strong>Hostel Safety</strong>, and <strong>Verified Median Placement Salary</strong> so families never sign blank cheques or fall for inflated "Highest International Package" billboards.
        </p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <!-- Sliders for Student & Parent Priorities -->
        <div class="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
          <h3 class="text-base font-bold text-slate-900 dark:text-white">Compare Student vs Parent Priority Weights (1–5)</h3>
          @for (dim of dimensions; track dim.key) {
            <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
              <div class="text-xs font-bold text-slate-800 dark:text-slate-200">{{ dim.label }}</div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <div class="flex justify-between text-[11px] font-semibold text-teal-700 dark:text-teal-400">
                    <span>Student</span>
                    <span class="font-mono">{{ studentWeights()[dim.key] }}/5</span>
                  </div>
                  <input type="range" min="1" max="5" [value]="studentWeights()[dim.key]"
                    (input)="updateWeight('student', dim.key, $any($event.target).value)"
                    class="w-full accent-teal-700" />
                </div>
                <div>
                  <div class="flex justify-between text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                    <span>Parent</span>
                    <span class="font-mono">{{ parentWeights()[dim.key] }}/5</span>
                  </div>
                  <input type="range" min="1" max="5" [value]="parentWeights()[dim.key]"
                    (input)="updateWeight('parent', dim.key, $any($event.target).value)"
                    class="w-full accent-amber-600" />
                </div>
              </div>
            </div>
          }
          <button type="button" (click)="evaluateAlignment()" [disabled]="loading()"
            class="w-full py-2.5 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer">
            <mat-icon class="!text-sm !w-4 !h-4">handshake</mat-icon>
            <span>{{ loading() ? 'Calculating Family Consensus...' : 'Calculate Family Alignment & Top Colleges' }}</span>
          </button>
        </div>

        <div class="lg:col-span-7 space-y-6">
          @if (familyResult(); as res) {
            <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
              <div class="flex items-center justify-between">
                <div>
                  <span class="text-xs font-mono uppercase text-teal-700 dark:text-teal-400">Consensus Meter</span>
                  <h3 class="text-xl font-bold text-slate-900 dark:text-white mt-0.5">Family Alignment Score: {{ res.alignmentScorePercent }}%</h3>
                </div>
                <span class="px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-300 font-mono text-sm font-bold">
                  {{ res.alignmentScorePercent }}% Match
                </span>
              </div>

              <div class="space-y-3">
                <div class="text-xs font-bold uppercase font-mono text-slate-500">Key Trade-offs & Compromise Suggestions</div>
                @for (t of res.keyTradeOffs; track t.dimension) {
                  <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                    <div class="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
                      <span>{{ t.dimension }}</span>
                      <span class="font-mono">Student {{ t.studentScore }}/5 vs Parent {{ t.parentScore }}/5</span>
                    </div>
                    <p class="text-xs text-slate-600 dark:text-slate-400">{{ t.compromiseSuggestion }}</p>
                  </div>
                }
              </div>

              <div class="space-y-3">
                <div class="text-xs font-bold uppercase font-mono text-slate-500">Top Balanced Colleges for Both Student & Parents</div>
                @for (c of res.topBalancedColleges; track c.collegeId) {
                  <div class="p-4 rounded-xl border border-teal-200 dark:border-teal-800/70 bg-teal-50/40 dark:bg-teal-950/20 flex items-center justify-between gap-4">
                    <div>
                      <a [routerLink]="['/college', c.collegeId]" class="text-sm font-bold text-slate-900 dark:text-white hover:text-teal-700">{{ c.collegeName }}</a>
                      <p class="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{{ c.fitExplanation }}</p>
                    </div>
                    <a [routerLink]="['/college', c.collegeId]" class="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-teal-700 dark:text-teal-400 shrink-0">
                      View Details
                    </a>
                  </div>
                }
              </div>

              <app-ai-disclaimer [textToReadOrTranslate]="res.shareableSummaryText" />
            </div>
          }
        </div>
      </div>
    </div>
  `
})
export class FamilyDecisionPage implements OnInit {
  readonly i18n = inject(I18nService);
  private readonly api = inject(ApiService);
  private readonly profileStore = inject(ProfileStorageService);

  readonly loading = signal(false);
  readonly familyResult = signal<AiFamilyResponse | null>(null);

  readonly dimensions: { key: 'budget' | 'location' | 'safety' | 'branch' | 'placements'; label: string }[] = [
    { key: 'budget', label: 'Affordable 4-Year Total Cost & Low Loan Burden' },
    { key: 'location', label: 'Proximity to Home State / Direct Train & Flight Connectivity' },
    { key: 'safety', label: 'Campus Security, Hostel Curfew & Medical Facilities' },
    { key: 'branch', label: 'Preferred Branch (CSE / AI / ECE) & Modern Curriculum' },
    { key: 'placements', label: 'Verified Median Placement Salary & Recruiter Diversity' },
  ];

  readonly studentWeights = signal({ budget: 3, location: 2, safety: 4, branch: 5, placements: 5 });
  readonly parentWeights = signal({ budget: 5, location: 4, safety: 5, branch: 4, placements: 5 });

  ngOnInit(): void {
    void this.evaluateAlignment();
  }

  updateWeight(role: 'student' | 'parent', key: 'budget' | 'location' | 'safety' | 'branch' | 'placements', val: string): void {
    const num = Math.min(5, Math.max(1, Number(val) || 3));
    if (role === 'student') {
      this.studentWeights.update((w) => ({ ...w, [key]: num }));
    } else {
      this.parentWeights.update((w) => ({ ...w, [key]: num }));
    }
  }

  async evaluateAlignment(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.api.evaluateFamilyDecision({
        studentWeights: this.studentWeights(),
        parentWeights: this.parentWeights(),
        maxAnnualBudgetInr: this.profileStore.profile().annualBudgetInr || 250000,
      });
      this.familyResult.set(res);
    } finally {
      this.loading.set(false);
    }
  }

  printSummary(): void {
    if (typeof window !== 'undefined') window.print();
  }

  whatsappShareUrl(): string {
    const text = this.familyResult()?.shareableSummaryText || 'AdmitWise Family Decision Sheet: Compare student vs parent college priorities.';
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }
}
