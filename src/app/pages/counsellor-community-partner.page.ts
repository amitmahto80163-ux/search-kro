import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../services/api.service';
import { I18nService } from '../services/i18n.service';
import { AIDisclaimer, VoiceInputButton } from '../components/ui';
import { PLATFORM_FEE_INR, SUPPORT_HELPLINE } from '../../shared/constants';

// ============================================================================
// 1. AiCounsellorPage (/counsellor) — Feature #3 AI Counsellor & #36 Voice/Language
// ============================================================================
@Component({
  selector: 'app-ai-counsellor-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule, AIDisclaimer, VoiceInputButton],
  template: `
    <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <span class="text-xs font-mono uppercase tracking-wider text-teal-700 dark:text-teal-400">Features #3 & #36 • Multilingual Voice + Text AI Counsellor</span>
          <h1 class="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-1">Unbiased AI Admission Counsellor</h1>
          <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Ask in English, हिंदी, or ਪੰਜਾਬੀ using your microphone or keyboard. Grounded strictly in verified NIRF, JoSAA, AICTE, and official fee records.
          </p>
        </div>
        <div class="flex items-center gap-1.5">
          @for (lang of ['en', 'hi', 'pa']; track lang) {
            <button type="button" (click)="setLang(lang)"
              class="px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer"
              [class]="i18n.currentLang() === lang ? 'bg-teal-700 text-white border-teal-700' : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'">
              {{ lang === 'en' ? 'English' : lang === 'hi' ? 'हिंदी' : 'ਪੰਜਾਬੀ' }}
            </button>
          }
        </div>
      </div>

      <!-- Quick Prompt Starters -->
      <div class="flex flex-wrap gap-2">
        @for (starter of starterPrompts; track starter) {
          <button type="button" (click)="sendQuickPrompt(starter)"
            class="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-teal-500 text-xs text-slate-700 dark:text-slate-300 transition-colors cursor-pointer">
            {{ starter }}
          </button>
        }
      </div>

      <!-- Chat Conversation Box -->
      <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col min-h-[420px]">
        <div class="flex-1 p-5 space-y-4 overflow-y-auto max-h-[500px]">
          @for (msg of messages(); track $index) {
            <div class="flex flex-col" [class]="msg.role === 'user' ? 'items-end' : 'items-start'">
              <div class="max-w-2xl rounded-2xl px-4 py-3 text-xs sm:text-sm space-y-2"
                [class]="msg.role === 'user'
                  ? 'bg-teal-700 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700'">
                <p class="whitespace-pre-line leading-relaxed">{{ msg.text }}</p>
                @if (msg.sources && msg.sources.length > 0) {
                  <div class="pt-2 border-t border-slate-200/60 dark:border-slate-700 flex flex-wrap gap-1.5">
                    @for (src of msg.sources; track src.name) {
                      <a [href]="src.url" target="_blank" rel="noopener noreferrer"
                        class="px-2 py-0.5 rounded bg-white/80 dark:bg-slate-900 text-[11px] font-mono text-teal-800 dark:text-teal-300 hover:underline">
                        Source: {{ src.name }} ↗
                      </a>
                    }
                  </div>
                }
                @if (msg.role === 'assistant') {
                  <app-ai-disclaimer [textToReadOrTranslate]="msg.text" />
                }
              </div>
            </div>
          }
          @if (loading()) {
            <div class="flex items-center gap-2 text-xs text-slate-500 font-mono">
              <mat-icon class="!text-sm !w-4 !h-4 animate-spin">sync</mat-icon>
              <span>Verifying against NIRF, JoSAA & official fee tables...</span>
            </div>
          }
        </div>

        <!-- Input Bar -->
        <form [formGroup]="chatForm" (ngSubmit)="sendMessage()" class="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
          <app-voice-input-btn (transcriptReady)="onVoiceTranscript($event)" />
          <input type="text" formControlName="message" placeholder="Ask about JEE rank cutoffs, direct admission, hidden fees, or scholarships..."
            class="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white" />
          <button type="submit" [disabled]="loading() || chatForm.invalid"
            class="px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer">
            <mat-icon class="!text-sm !w-4 !h-4">send</mat-icon>
            <span>Ask</span>
          </button>
        </form>
      </div>
    </div>
  `
})
export class AiCounsellorPage {
  readonly i18n = inject(I18nService);
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly messages = signal<{ role: 'user' | 'assistant'; text: string; sources?: { name: string; url: string }[] }[]>([
    {
      role: 'assistant',
      text: 'Namaste! Sat Sri Akal! Welcome to Search Kro AI Counsellor. Tell me your 12th PCM percentage, JEE/CET rank, home state, and 4-year family budget — I will suggest verified colleges across Exam, College Process, and Direct routes without any paid promotion.',
      sources: [
        { name: 'NIRF 2024 Rankings', url: 'https://www.nirfindia.org/Rankings/2024/EngineeringRanking.html' },
        { name: 'JoSAA Portal', url: 'https://josaa.nic.in' }
      ]
    }
  ]);

  readonly starterPrompts = [
    'My JEE Main rank is 18,000 and annual budget is ₹2L. What are my best CSE/ECE options?',
    'I missed JEE Main cutoff (82% in 12th). Which verified colleges have their own entrance or merit route?',
    'Is a ₹50 Lakh highest package claim in a college brochure reliable? How do I check median salary?',
    'मेरी 12वीं में 84% हैं और बजट 8 लाख है, मुझे कौन सा कॉलेज चुनना चाहिए?',
  ];

  readonly chatForm = this.fb.nonNullable.group({
    message: ['', [Validators.required, Validators.minLength(2)]],
  });

  setLang(l: string): void {
    if (l === 'en' || l === 'hi' || l === 'pa') this.i18n.setLanguage(l);
  }

  onVoiceTranscript(text: string): void {
    this.chatForm.patchValue({ message: text });
    void this.sendMessage();
  }

  sendQuickPrompt(prompt: string): void {
    this.chatForm.patchValue({ message: prompt });
    void this.sendMessage();
  }

  async sendMessage(): Promise<void> {
    if (this.chatForm.invalid || this.loading()) return;
    const text = this.chatForm.getRawValue().message.trim();
    if (!text) return;

    this.messages.update((m) => [...m, { role: 'user', text }]);
    this.chatForm.reset({ message: '' });
    this.loading.set(true);

    try {
      const res = await this.api.askCounsellor(text, this.i18n.currentLang());
      this.messages.update((m) => [
        ...m,
        {
          role: 'assistant',
          text: `${res.answer}\n\nSuggested follow-ups:\n${res.suggestedFollowUps.map((a) => '• ' + a).join('\n')}`,
          sources: res.citedSources,
        },
      ]);
    } finally {
      this.loading.set(false);
    }
  }
}

// ============================================================================
// 2. CommunityAfterAdmissionPage (/community) — Features #33, #34, #35
// ============================================================================
@Component({
  selector: 'app-community-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  template: `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      <div class="border-b border-slate-200 dark:border-slate-800 pb-6">
        <span class="text-xs font-mono uppercase tracking-wider text-teal-700 dark:text-teal-400">Features #33, #34 & #35 • Post-Admission Support</span>
        <h1 class="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-1">Seniors, First 30 Days Guide & Roommate Matcher</h1>
        <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Our relationship doesn't end when you pay admission fees. Connect with verified student seniors, get your First 30 Days survival roadmap, and find city-mates.
        </p>
      </div>

      <!-- Feature #33: Talk to a Senior (Demo) -->
      <section class="space-y-4">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 class="text-lg font-bold text-slate-900 dark:text-white">Feature #33 • Talk to a Verified Senior (Demo Profiles)</h2>
            <p class="text-xs text-slate-500">Clearly labelled demo profiles showing how 1-on-1 senior mentorship works without agent interference.</p>
          </div>
          <span class="px-2.5 py-1 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 text-xs font-mono font-bold">
            DEMO MENTOR PROFILES
          </span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          @for (senior of api.seniors(); track senior.id) {
            <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3 flex flex-col justify-between">
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <span class="px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 text-[11px] font-mono font-semibold">
                    {{ senior.collegeName }}
                  </span>
                  <span class="text-xs font-mono text-slate-500">{{ senior.yearOfStudy }}</span>
                </div>
                <h3 class="text-base font-bold text-slate-900 dark:text-white">{{ senior.displayName }}</h3>
                <div class="text-xs font-medium text-teal-700 dark:text-teal-400">{{ senior.branch }} • From {{ senior.homeState }}</div>
                <p class="text-xs text-slate-600 dark:text-slate-400 italic">"{{ senior.shortBio }}"</p>
                <div class="flex flex-wrap gap-1 pt-1">
                  @for (topic of senior.topics; track topic) {
                    <span class="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-300">{{ topic }}</span>
                  }
                </div>
              </div>
              <button type="button" (click)="selectedSenior.set(senior.displayName)"
                class="w-full py-2 px-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer">
                <mat-icon class="!text-sm !w-4 !h-4">chat</mat-icon>
                <span>Request 15-Min Call (Demo)</span>
              </button>
            </div>
          }
        </div>
        @if (selectedSenior(); as sName) {
          <div class="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-center justify-between">
            <span>Demo slot requested with <strong>{{ sName }}</strong>! In production, verified college email (.ac.in / .edu.in) seniors receive a calendar invite.</span>
            <button type="button" (click)="selectedSenior.set(null)" class="underline font-bold cursor-pointer">Dismiss</button>
          </div>
        }
      </section>

      <!-- Feature #34: First 30 Days on Campus Guide -->
      <section class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-5">
        <div>
          <h2 class="text-lg font-bold text-slate-900 dark:text-white">Feature #34 • First 30 Days on Campus Survival Guide</h2>
          <p class="text-xs text-slate-500">Week-by-week roadmap, anti-ragging helpline numbers, and academic survival tips for freshers.</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
            <div class="text-xs font-mono uppercase text-teal-700 dark:text-teal-400 font-bold">Week 1 • Reporting & Hostel</div>
            <p class="text-xs text-slate-700 dark:text-slate-300">• Keep 4 attested photocopies of Provisional Allotment Letter & Fee Receipt</p>
            <p class="text-xs text-slate-700 dark:text-slate-300">• Never hand over original 10th/12th marksheets permanently (UGC Rule)</p>
            <p class="text-xs text-slate-700 dark:text-slate-300">• Complete DigiLocker ABC (Academic Bank of Credits) ID registration</p>
          </div>
          <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
            <div class="text-xs font-mono uppercase text-teal-700 dark:text-teal-400 font-bold">Week 2 • Labs & Bank Setup</div>
            <p class="text-xs text-slate-700 dark:text-slate-300">• Link Aadhaar NPCI mapper to your student bank account for NSP scholarships</p>
            <p class="text-xs text-slate-700 dark:text-slate-300">• Collect library cards and NPTEL / IEEE student portal access</p>
            <p class="text-xs text-slate-700 dark:text-slate-300">• Attend departmental orientation & lab safety briefing</p>
          </div>
          <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
            <div class="text-xs font-mono uppercase text-teal-700 dark:text-teal-400 font-bold">Weeks 3-4 • Academics & Clubs</div>
            <p class="text-xs text-slate-700 dark:text-slate-300">• Maintain 8.0+ CGPA in Semester 1 (easiest semester to build CGPA buffer)</p>
            <p class="text-xs text-slate-700 dark:text-slate-300">• Join 1 technical society (Coding / Robotics / SAE) and 1 hobby club</p>
            <p class="text-xs text-slate-700 dark:text-slate-300">• Review internal sliding / branch change rules if targeting CSE/ECE</p>
          </div>
          <div class="p-4 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/70 space-y-2">
            <div class="text-xs font-mono uppercase text-rose-800 dark:text-rose-300 font-bold">Safety & Anti-Ragging</div>
            <p class="text-xs text-rose-900 dark:text-rose-200">• National Anti-Ragging 24×7 Toll-Free Helpline: <strong>1800-180-5522</strong></p>
            <p class="text-xs text-rose-900 dark:text-rose-200">• Email: <strong>helpline@antiragging.in</strong></p>
            <p class="text-xs text-rose-900 dark:text-rose-200">• Save Chief Warden & Campus Medical Centre numbers on speed dial</p>
          </div>
        </div>
      </section>

      <!-- Feature #35: Roommate & City-Mates Matching -->
      <section class="space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 class="text-lg font-bold text-slate-900 dark:text-white">Feature #35 • Hostel Roommate & City-Mates Matcher (Demo)</h2>
            <p class="text-xs text-slate-500">Filter incoming batchmates by sleep schedule, study habits, and home state before hostel room allotment.</p>
          </div>
          <select [value]="roommateFilter()" (change)="roommateFilter.set($any($event.target).value)"
            class="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white">
            <option value="">All Sleep Schedules</option>
            <option value="Early Bird">Early Bird</option>
            <option value="Flexible">Flexible</option>
            <option value="Night Owl">Night Owl</option>
          </select>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          @for (rm of filteredRoommates(); track rm.id) {
            <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-mono text-teal-700 dark:text-teal-400 font-bold">From {{ rm.homeState }}</span>
                <span class="text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">Demo</span>
              </div>
              <h3 class="text-base font-bold text-slate-900 dark:text-white">{{ rm.alias }}</h3>
              <div class="text-xs text-slate-600 dark:text-slate-400">Target City: {{ rm.targetCity }}</div>
              <div class="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs space-y-1">
                <div><strong>Sleep:</strong> {{ rm.sleepSchedule }}</div>
                <div><strong>Study:</strong> {{ rm.studyHabit }}</div>
                <div><strong>Food:</strong> {{ rm.foodPreference }}</div>
                <div><strong>Languages:</strong> {{ rm.languages.join(', ') }}</div>
              </div>
            </div>
          }
        </div>
      </section>
    </div>
  `
})
export class CommunityAfterAdmissionPage {
  readonly api = inject(ApiService);
  readonly selectedSenior = signal<string | null>(null);
  readonly roommateFilter = signal('');

  filteredRoommates() {
    const f = this.roommateFilter();
    const list = this.api.roommates();
    if (!f) return list;
    return list.filter((r) => r.sleepSchedule === f);
  }
}

// ============================================================================
// 3. WhatsAppBotPage (/whatsapp) — Feature #37 WhatsApp Bot Mode Simulation
// ============================================================================
@Component({
  selector: 'app-whatsapp-bot-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  template: `
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div class="border-b border-slate-200 dark:border-slate-800 pb-5">
        <span class="text-xs font-mono uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Feature #37 • Low-Bandwidth Rural & Tier-3 Access</span>
        <h1 class="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-1">WhatsApp Bot Mode (Interactive Simulation)</h1>
        <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Students and parents on 2G/low-end phones can send menu numbers (1–5) to check college approvals, fees, cutoffs, and scholarships, or export any summary directly to WhatsApp.
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div class="md:col-span-7 bg-[#e5ddd5] dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-800 overflow-hidden shadow-sm flex flex-col h-[500px]">
          <div class="bg-[#075e54] text-white px-4 py-3 flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <mat-icon class="!text-lg !w-5 !h-5">chat</mat-icon>
              <div>
                <div class="text-sm font-bold">Search Kro Official Bot (Simulated)</div>
                <div class="text-[11px] text-emerald-100">Verified Admission Assistant • Online</div>
              </div>
            </div>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-black/20">SIMULATION</span>
          </div>

          <div class="flex-1 p-4 space-y-3 overflow-y-auto">
            @for (m of botLogs(); track $index) {
              <div class="flex" [class]="m.from === 'user' ? 'justify-end' : 'justify-start'">
                <div class="max-w-xs sm:max-w-sm rounded-xl px-3.5 py-2.5 text-xs whitespace-pre-line shadow-2xs"
                  [class]="m.from === 'user' ? 'bg-[#dcf8c6] text-slate-900' : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100'">
                  {{ m.text }}
                </div>
              </div>
            }
          </div>

          <div class="p-3 bg-slate-100 dark:bg-slate-800 flex items-center gap-2">
            @for (cmd of ['1', '2', '3', '4', '5']; track cmd) {
              <button type="button" (click)="sendBotCommand(cmd)"
                class="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-mono font-bold cursor-pointer">
                Send "{{ cmd }}"
              </button>
            }
          </div>
        </div>

        <div class="md:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 h-fit">
          <h2 class="text-base font-bold text-slate-900 dark:text-white">Bot Menu Commands</h2>
          <ul class="text-xs text-slate-600 dark:text-slate-400 space-y-2 font-mono">
            <li><strong>1</strong> → Check Top Verified Engineering Colleges & NIRF Ranks</li>
            <li><strong>2</strong> → Verify UGC/AICTE Approval & Fake University Alert</li>
            <li><strong>3</strong> → Calculate True 4-Year B.Tech Cost & Hostel Fees</li>
            <li><strong>4</strong> → Upcoming Exam Deadlines (JEE, BITSAT, State CET)</li>
            <li><strong>5</strong> → Scholarship & Education Loan Quick Check</li>
          </ul>
          <div class="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <h3 class="text-xs font-bold text-slate-800 dark:text-slate-200">Share Summary on Real WhatsApp</h3>
            <a [href]="realWhatsAppLink()" target="_blank" rel="noopener noreferrer"
              class="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center justify-center gap-2">
              <mat-icon class="!text-sm !w-4 !h-4">open_in_new</mat-icon>
              <span>Open wa.me Share Link</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  `
})
export class WhatsAppBotPage {
  readonly botLogs = signal<{ from: 'user' | 'bot'; text: string }[]>([
    {
      from: 'bot',
      text: 'Namaste! Welcome to Search Kro WhatsApp Bot.\nReply with a number:\n1 - Top Verified Colleges\n2 - Fake University Check\n3 - 4-Year Fee Breakdown\n4 - Upcoming Exam Dates\n5 - Scholarships & Loans'
    }
  ]);

  sendBotCommand(cmd: string): void {
    const replies: Record<string, string> = {
      '1': 'Verified Colleges (NIRF 2024):\n• IIT Bombay (#3) - ₹2.0L/yr tuition\n• NIT Trichy (#9) - ₹1.25L/yr tuition\n• Jadavpur University (#12) - ₹2,400/yr tuition\n• COEP Pune (#77) - ₹68,000/yr tuition\n• VIT Vellore (#11) - ₹1.98L/yr Cat-1',
      '2': 'UGC Fake University Alert:\nAlways verify AICTE Permanent ID & UGC 2(f)/12(B) notification on ugc.gov.in before paying any token fee. Never pay cash to middlemen.',
      '3': 'True 4-Year B.Tech Cost Formula:\n(Tuition + Hostel + Mess + Exam Fee) × 4 + One-time Admission Deposit + Laptop/Books. Compare on Search Kro /money.',
      '4': 'Upcoming Exams:\n• JEE Main Session 2: April\n• BITSAT Session 1: May\n• COMEDK / MHT-CET / WBJEE: April–May\nSet reminders at Search Kro /calendar.',
      '5': 'Top Scholarships:\n• NSP Central Sector Scheme: ₹20,000/yr\n• AICTE Pragati (Girls): ₹50,000/yr\n• Post-Matric SC/ST/OBC State Portal\n• PM-Vidyalaxmi Education Loan (No collateral up to ₹7.5L).'
    };
    this.botLogs.update((curr) => [
      ...curr,
      { from: 'user', text: cmd },
      { from: 'bot', text: replies[cmd] ?? 'Reply with 1, 2, 3, 4, or 5.' },
    ]);
  }

  realWhatsAppLink(): string {
    const msg = 'Check verified B.Tech college fees, NIRF placements, and fake university alerts on Search Kro (Zero paid rankings).';
    return `https://wa.me/?text=${encodeURIComponent(msg)}`;
  }
}

// ============================================================================
// 4. PartnerTransparencyPage (/partner) — Feature #38 Revenue Model & Partner Portal
// ============================================================================
@Component({
  selector: 'app-partner-transparency-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  template: `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      <div class="border-b border-slate-200 dark:border-slate-800 pb-6">
        <span class="text-xs font-mono uppercase tracking-wider text-teal-700 dark:text-teal-400">Feature #38 • Ethical Business Model & Partner Transparency</span>
        <h1 class="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-1">How We Earn & Verified Partner Portal</h1>
        <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">
          100% transparent business model: We never sell rankings, never hide negative reviews, and never sell student phone numbers to call centres.
        </p>
      </div>

      <!-- Ethical Pledge Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-2">
          <div class="text-xs font-mono uppercase text-teal-700 dark:text-teal-400 font-bold">1. Student Success Fee (₹{{ feeInr }})</div>
          <h2 class="text-lg font-bold text-slate-900 dark:text-white">Pay ₹{{ feeInr }} Only After Admission</h2>
          <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Discovery, AI counselling, fake university verification, and common applications are 100% free. Students optionally pay a flat ₹{{ feeInr }} platform fee only after uploading their verified final admission letter.
          </p>
        </div>
        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-2">
          <div class="text-xs font-mono uppercase text-teal-700 dark:text-teal-400 font-bold">2. Verified Partner SaaS</div>
          <h2 class="text-lg font-bold text-slate-900 dark:text-white">Zero Ranking Manipulation</h2>
          <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Colleges can subscribe to our Verified Partner Portal to receive structured digital applications and publish official fee PDFs. Partner status (<code>isPartner</code>) is strictly excluded from our ranking algorithm.
          </p>
        </div>
        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-2">
          <div class="text-xs font-mono uppercase text-teal-700 dark:text-teal-400 font-bold">3. Zero Spam Guarantee</div>
          <h2 class="text-lg font-bold text-slate-900 dark:text-white">Your Phone Number is Never Sold</h2>
          <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Traditional portals sell your phone number to 30+ aggressive admission agents within 5 minutes of sign-up. Search Kro stores your profile locally and shares applications only with colleges you explicitly select.
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <!-- Post-Admission ₹99 Success Fee Flow (Simulated) -->
        <div class="lg:col-span-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-bold text-slate-900 dark:text-white">Upload Final Admission Letter & Pay ₹{{ feeInr }} (Simulated)</h2>
            <span class="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 text-[11px] font-mono font-bold">SIMULATED</span>
          </div>
          <p class="text-xs text-slate-600 dark:text-slate-400">
            Already secured your B.Tech seat? Upload your official provisional allotment / admission offer letter to unlock the First 30 Days Alumni Pack and support unbiased student tools.
          </p>
          <div class="space-y-3">
            <div>
              <label for="admitted-college-select" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Admitted College</label>
              <select id="admitted-college-select" [value]="selectedCollege()" (change)="selectedCollege.set($any($event.target).value)"
                class="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white">
                @for (c of api.colleges(); track c.id) {
                  <option [value]="c.name">{{ c.name }}</option>
                }
              </select>
            </div>
            <div>
              <label for="offer-ref-input" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Offer Letter Reference / Roll No.</label>
              <input id="offer-ref-input" type="text" [value]="offerRef()" (input)="offerRef.set($any($event.target).value)"
                placeholder="e.g., JOSAA-2025-NITT-98412"
                class="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-mono text-slate-900 dark:text-white" />
            </div>
            <button type="button" (click)="simulatePayment()"
              class="w-full py-2.5 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer">
              <mat-icon class="!text-sm !w-4 !h-4">verified</mat-icon>
              <span>Verify Admission Letter & Simulate ₹{{ feeInr }} UPI Payment</span>
            </button>
          </div>
          @if (paymentSuccess()) {
            <div class="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
              <div class="font-bold">Thank you! Simulated Receipt #AW-99-{{ receiptId() }} generated.</div>
              <p>College: {{ selectedCollege() }} • Amount: ₹{{ feeInr }} (Simulated Demo Mode — no real money charged).</p>
            </div>
          }
        </div>

        <!-- Partner College Transparency Dashboard -->
        <div class="lg:col-span-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-bold text-slate-900 dark:text-white">Verified Partner Colleges Directory</h2>
            <span class="text-xs font-mono text-slate-500">{{ partnerColleges().length }} Partners</span>
          </div>
          <p class="text-xs text-slate-600 dark:text-slate-400">
            Every college that uses our Common Application workflow is publicly disclosed below. Notice how their algorithmic scores follow the exact same formula as non-partners.
          </p>
          <div class="divide-y divide-slate-200 dark:divide-slate-800">
            @for (c of partnerColleges(); track c.id) {
              <div class="py-3 flex items-center justify-between gap-3">
                <div>
                  <div class="text-sm font-bold text-slate-900 dark:text-white">{{ c.name }}</div>
                  <div class="text-xs text-slate-500">{{ c.cityInfo.city }}, {{ c.cityInfo.state }} • {{ c.ownership }} • NIRF: {{ c.accreditation.nirfRank.value ? '#' + c.accreditation.nirfRank.value : 'Unranked' }}</div>
                </div>
                <span class="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-mono">
                  Disclosed Partner
                </span>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `
})
export class PartnerTransparencyPage {
  readonly api = inject(ApiService);
  readonly feeInr = PLATFORM_FEE_INR;
  readonly helpline = SUPPORT_HELPLINE;
  readonly selectedCollege = signal('National Institute of Technology Tiruchirappalli');
  readonly offerRef = signal('JOSAA-2025-NITT-44810');
  readonly paymentSuccess = signal(false);
  readonly receiptId = signal(1042);

  partnerColleges() {
    return this.api.colleges().filter((c) => c.isPartner);
  }

  simulatePayment(): void {
    this.receiptId.set(Math.floor(1000 + Math.random() * 9000));
    this.paymentSuccess.set(true);
  }
}
