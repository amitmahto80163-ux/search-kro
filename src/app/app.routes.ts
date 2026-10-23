import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home.page').then((m) => m.HomePage),
  },
  {
    path: 'start',
    loadComponent: () => import('./pages/start.page').then((m) => m.StartPage),
  },
  {
    path: 'college/:id',
    loadComponent: () => import('./pages/college-detail.page').then((m) => m.CollegeDetailPage),
  },
  {
    path: 'exams',
    loadComponent: () => import('./pages/exams-help-calendar.page').then((m) => m.ExamsPage),
  },
  {
    path: 'help',
    loadComponent: () => import('./pages/exams-help-calendar.page').then((m) => m.HelpHubPage),
  },
  {
    path: 'calendar',
    loadComponent: () => import('./pages/exams-help-calendar.page').then((m) => m.CalendarAlertsPage),
  },
  {
    path: 'apply',
    loadComponent: () => import('./pages/apply-tracker-docs.page').then((m) => m.CommonApplyPage),
  },
  {
    path: 'tracker',
    loadComponent: () => import('./pages/apply-tracker-docs.page').then((m) => m.ApplicationTrackerPage),
  },
  {
    path: 'documents',
    loadComponent: () => import('./pages/apply-tracker-docs.page').then((m) => m.DocumentCheckerPage),
  },
  {
    path: 'verify',
    loadComponent: () => import('./pages/trust-safety.page').then((m) => m.FakeVerifyPage),
  },
  {
    path: 'pitch',
    loadComponent: () => import('./pages/trust-safety.page').then((m) => m.PitchAnalyzerPage),
  },
  {
    path: 'fees',
    loadComponent: () => import('./pages/trust-safety.page').then((m) => m.HiddenFeeDetectorPage),
  },
  {
    path: 'claims',
    loadComponent: () => import('./pages/trust-safety.page').then((m) => m.BrochureClaimsPage),
  },
  {
    path: 'compare',
    loadComponent: () => import('./pages/money-compare.page').then((m) => m.ComparePage),
  },
  {
    path: 'money',
    loadComponent: () => import('./pages/money-compare.page').then((m) => m.MoneyHubPage),
  },
  {
    path: 'decision',
    loadComponent: () => import('./pages/decision-family.page').then((m) => m.DecisionSupportPage),
  },
  {
    path: 'plan',
    loadComponent: () => import('./pages/decision-family.page').then((m) => m.BackupPlanPage),
  },
  {
    path: 'family',
    loadComponent: () => import('./pages/decision-family.page').then((m) => m.FamilyDecisionPage),
  },
  {
    path: 'counsellor',
    loadComponent: () => import('./pages/counsellor-community-partner.page').then((m) => m.AiCounsellorPage),
  },
  {
    path: 'community',
    loadComponent: () => import('./pages/counsellor-community-partner.page').then((m) => m.CommunityAfterAdmissionPage),
  },
  {
    path: 'whatsapp',
    loadComponent: () => import('./pages/counsellor-community-partner.page').then((m) => m.WhatsAppBotPage),
  },
  {
    path: 'partner',
    loadComponent: () => import('./pages/counsellor-community-partner.page').then((m) => m.PartnerTransparencyPage),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
