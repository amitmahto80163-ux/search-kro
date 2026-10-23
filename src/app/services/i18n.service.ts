import {Injectable, computed, signal} from '@angular/core';
import {SupportedLanguage} from '../../shared/constants';
import {safeGetItem, safeSetItem} from './storage.service';

export type TranslationDictionary = Record<string, string>;

const EN_STRINGS: TranslationDictionary = {
  'banner.sampleData': 'Sample dataset. Run refresh-data for the latest information.',
  'banner.offlineDemo': 'Offline demo mode — using bundled verified dataset and local analysis.',
  'banner.lastUpdated': 'Last updated',
  'banner.guidanceOnly': 'Guidance only · Never a guarantee of admission · Verify on official portals',

  'nav.home': 'Home',
  'nav.start': 'Find Colleges',
  'nav.exams': 'Exams & Deadlines',
  'nav.counsellor': 'Free AI Counsellor',
  'nav.verify': 'Fake & Agent Check',
  'nav.compare': 'Compare',
  'nav.money': 'Cost, Loans & Scholarships',
  'nav.decision': 'Rank & Branch Guide',
  'nav.plan': 'Backup Plan',
  'nav.family': 'Family Room',
  'nav.apply': 'Common Apply',
  'nav.tracker': 'App Tracker',
  'nav.documents': 'Document Resizer',
  'nav.calendar': 'Calendar & Alerts',
  'nav.claims': 'Brochure vs Reality',
  'nav.pitch': 'Pitch Analyzer',
  'nav.fees': 'Hidden Fee Detector',
  'nav.help': 'Admission Checklist',
  'nav.community': 'Seniors & First 30 Days',
  'nav.whatsapp': 'WhatsApp Bot (Sim)',
  'nav.partner': 'How We Earn & Partners',

  'action.parentMode': 'Parent Mode',
  'action.darkMode': 'Dark Theme',
  'action.deleteData': 'Delete My Data',
  'action.howWeCalculate': 'How we calculate',
  'action.retry': 'Retry',
  'action.searchPlaceholder': 'Search colleges, exams, scholarships, or tools...',
  'action.translateOutput': 'Translate AI Output',
  'action.voiceInput': 'Voice Input',
  'action.readAloud': 'Read Aloud',

  'hero.kicker': 'Student-First · Zero Commission Bias · Source Verified',
  'hero.title': 'Unbiased Engineering Admission Guidance for Indian Students & Parents',
  'hero.subtitle': 'Check official fees, real NIRF median salaries, entrance exam deadlines, scholarship eligibility, and admission fraud red flags—without paying ₹25,000+ to private agents.',
  'hero.ctaFind': 'Start: Route & Budget Match',
  'hero.ctaVerify': 'Check if a College or Agent is Real',
  'hero.ctaExams': 'Explore Exams & Deadlines',

  'home.howItWorksTitle': 'How It Works in 3 Transparent Steps',
  'home.step1Title': '01. Choose Your Admission Route & Realistic 4-Year Budget',
  'home.step1Desc': 'Filter across All-India Exams (JEE/JoSAA/CET), College Processes (BITSAT/VITEEE/UGEE), and Direct Board Topper routes with zero paid ranking bias.',
  'home.step2Title': '02. Verify Approvals, True Cost & Placement Reality',
  'home.step2Desc': 'Every number shows its official source and verification date, or explicitly states "Not verified, check the official site".',
  'home.step3Title': '03. Build Your Backup Plan, Check Documents & Track Applications',
  'home.step3Desc': 'Resize exam photos locally in your browser, compare up to 4 colleges, and pay ₹0 upfront (flat ₹99 only after confirmed admission at partner colleges).',

  'common.notVerified': 'Not verified, check the official site',
  'common.partnerLabel': 'Verified Partner College (Never affects ranking)',
  'common.infoOnlyLabel': 'Information Only (Apply on official portal)',
  'common.aiDisclaimer': 'AI-generated guidance. Verify with the official college or portal.',
  'common.reviewSignalNote': 'This is a likelihood based on signals, not proof.',
};

const HI_STRINGS: TranslationDictionary = {
  'banner.sampleData': 'नमूना डेटासेट (Sample dataset)। नवीनतम जानकारी के लिए refresh-data चलाएँ।',
  'banner.offlineDemo': 'ऑफ़लाइन डेमो मोड — बंडल किए गए सत्यापित डेटासेट का उपयोग हो रहा है।',
  'banner.lastUpdated': 'अंतिम अपडेट',
  'banner.guidanceOnly': 'केवल मार्गदर्शन · प्रवेश की कोई गारंटी नहीं · आधिकारिक पोर्टल पर सत्यापित करें',

  'nav.home': 'होम',
  'nav.start': 'कॉलेज खोजें',
  'nav.exams': 'परीक्षाएं और तिथियां',
  'nav.counsellor': 'निःशुल्क AI काउंसलर',
  'nav.verify': 'फर्जी कॉलेज/एजेंट जांच',
  'nav.compare': 'तुलना करें',
  'nav.money': 'खर्च, लोन और छात्रवृत्ति',
  'nav.decision': 'रैंक और ब्रांच गाइड',
  'nav.plan': 'बैकअप प्लान',
  'nav.family': 'फैमिली डिसीजन रूम',
  'nav.apply': 'कॉमन आवेदन',
  'nav.tracker': 'आवेदन ट्रैकर',
  'nav.documents': 'डॉक्यूमेंट रीसाइज़र',
  'nav.calendar': 'कैलेंडर और सीट अलर्ट',
  'nav.claims': 'ब्रोशर बनाम सच्चाई',
  'nav.pitch': 'एजेंट पिच विश्लेषक',
  'nav.fees': 'छुपी फीस डिटेक्टर',
  'nav.help': 'प्रवेश चेकलिस्ट',
  'nav.community': 'सीनियर्स और पहले 30 दिन',
  'nav.whatsapp': 'व्हाट्सएप बॉट (सिमुलेशन)',
  'nav.partner': 'हमारी कमाई और पार्टनर',

  'action.parentMode': 'अभिभावक मोड (Parent Mode)',
  'action.darkMode': 'डार्क मोड',
  'action.deleteData': 'मेरा डेटा हटाएं',
  'action.howWeCalculate': 'गणना का सूत्र',
  'action.retry': 'पुनः प्रयास करें',
  'action.searchPlaceholder': 'कॉलेज, परीक्षा, छात्रवृत्ति या टूल खोजें...',
  'action.translateOutput': 'AI उत्तर का अनुवाद करें',
  'action.voiceInput': 'बोलकर लिखें',
  'action.readAloud': 'सुनें',

  'hero.kicker': 'छात्र-प्रथम · शून्य कमीशन पक्षपात · स्रोत सत्यापित',
  'hero.title': 'भारतीय छात्रों और अभिभावकों के लिए निष्पक्ष इंजीनियरिंग प्रवेश मार्गदर्शन',
  'hero.subtitle': 'निजी एजेंटों को ₹25,000+ दिए बिना आधिकारिक फीस, वास्तविक NIRF मीडियन पैकेज, परीक्षा तिथियां, छात्रवृत्ति पात्रता और फर्जी एजेंटों की जांच करें।',
  'hero.ctaFind': 'शुरू करें: रूट और बजट मैच',
  'hero.ctaVerify': 'कॉलेज या एजेंट की सत्यता जांचें',
  'hero.ctaExams': 'परीक्षाएं और अंतिम तिथियां देखें',

  'home.howItWorksTitle': 'यह 3 पारदर्शी चरणों में कैसे काम करता है',
  'home.step1Title': '01. अपना प्रवेश मार्ग और 4-वर्षीय बजट चुनें',
  'home.step1Desc': 'अखिल भारतीय परीक्षा (JEE/JoSAA/CET), कॉलेज परीक्षा (BITSAT/VITEEE) और डायरेक्ट बोर्ड टॉपर मार्गों में बिना किसी पेड रैंकिंग के कॉलेज खोजें।',
  'home.step2Title': '02. मान्यता, कुल खर्च और प्लेसमेंट की सच्चाई जांचें',
  'home.step2Desc': 'हर आंकड़ा अपना आधिकारिक स्रोत और सत्यापन तिथि दिखाता है, या स्पष्ट रूप से "असत्यापित, आधिकारिक वेबसाइट देखें" बताता है।',
  'home.step3Title': '03. बैकअप प्लान बनाएं, दस्तावेज़ जांचें और आवेदन ट्रैक करें',
  'home.step3Desc': 'ब्राउज़र में फोटो रीसाइज़ करें, 4 कॉलेजों की तुलना करें, और अग्रिम ₹0 दें (पार्टनर कॉलेज में पक्के प्रवेश के बाद ही ₹99 शुल्क)।',

  'common.notVerified': 'असत्यापित, आधिकारिक वेबसाइट देखें',
  'common.partnerLabel': 'सत्यापित पार्टनर कॉलेज (रैंकिंग पर कोई प्रभाव नहीं)',
  'common.infoOnlyLabel': 'केवल जानकारी (आधिकारिक पोर्टल पर आवेदन करें)',
  'common.aiDisclaimer': 'AI-जनित मार्गदर्शन। आधिकारिक कॉलेज या पोर्टल से सत्यापित करें।',
  'common.reviewSignalNote': 'यह संकेतों पर आधारित संभावना है, प्रमाण नहीं।',
};

const PA_STRINGS: TranslationDictionary = {
  'banner.sampleData': 'ਨਮੂਨਾ ਡੇਟਾਸੈੱਟ (Sample dataset)। ਤਾਜ਼ਾ ਜਾਣਕਾਰੀ ਲਈ refresh-data ਚਲਾਓ।',
  'banner.offlineDemo': 'ਔਫਲਾਈਨ ਡੈਮੋ ਮੋਡ — ਬੰਡਲ ਕੀਤੇ ਪ੍ਰਮਾਣਿਤ ਡੇਟਾਸੈੱਟ ਦੀ ਵਰਤੋਂ ਹੋ ਰਹੀ ਹੈ।',
  'banner.lastUpdated': 'ਆਖਰੀ ਅੱਪਡੇਟ',
  'banner.guidanceOnly': 'صرف ਮਾਰਗਦਰਸ਼ਨ · ਦਾਖਲੇ ਦੀ ਕੋਈ ਗਾਰੰਟੀ ਨਹੀਂ · ਅਧਿਕਾਰਤ ਪੋਰਟਲ ਤੇ ਪੁਸ਼ਟੀ ਕਰੋ',

  'nav.home': 'ਹੋਮ',
  'nav.start': 'ਕਾਲਜ ਲੱਭੋ',
  'nav.exams': 'ਪ੍ਰੀਖਿਆਵਾਂ ਅਤੇ ਤਾਰੀਖਾਂ',
  'nav.counsellor': 'ਮੁਫ਼ਤ AI ਕਾਉਂਸਲਰ',
  'nav.verify': 'ਫਰਜ਼ੀ ਕਾਲਜ/ਏਜੰਟ ਜਾਂਚ',
  'nav.compare': 'ਤੁਲਨਾ ਕਰੋ',
  'nav.money': 'ਖਰਚਾ, ਲੋਨ ਅਤੇ ਵਜ਼ੀਫ਼ਾ',
  'nav.decision': 'ਰੈਂਕ ਅਤੇ ਬ੍ਰਾਂਚ ਗਾਈਡ',
  'nav.plan': 'ਬੈਕਅੱਪ ਪਲਾਨ',
  'nav.family': 'ਫੈਮਿਲੀ ਡਿਸੀਜ਼ਨ ਰੂਮ',
  'nav.apply': 'ਸਾਂਝਾ ਅਰਜ਼ੀ ਫਾਰਮ',
  'nav.tracker': 'ਅਰਜ਼ੀ ਟਰੈਕਰ',
  'nav.documents': 'ਦਸਤਾਵੇਜ਼ ਰੀਸਾਈਜ਼ਰ',
  'nav.calendar': 'ਕੈਲੰਡਰ ਅਤੇ ਸੀਟ ਅਲਰਟ',
  'nav.claims': 'ਬ੍ਰੋਸ਼ਰ ਬਨਾਮ ਸੱਚਾਈ',
  'nav.pitch': 'ਏਜੰਟ ਪਿੱਚ ਜਾਂਚ',
  'nav.fees': 'ਲੁਕਵੀਂ ਫੀਸ ਜਾਂਚ',
  'nav.help': 'ਦਾਖਲਾ ਚੈੱਕਲਿਸਟ',
  'nav.community': 'ਸੀਨੀਅਰਜ਼ ਅਤੇ ਪਹਿਲੇ 30 ਦਿਨ',
  'nav.whatsapp': 'ਵਟਸਐਪ ਬੌਟ (ਸਿਮੂਲੇਸ਼ਨ)',
  'nav.partner': 'ਸਾਡੀ ਕਮਾਈ ਅਤੇ ਪਾਰਟਨਰ',

  'action.parentMode': 'ਮਾਪੇ ਮੋਡ (Parent Mode)',
  'action.darkMode': 'ਡਾਰਕ ਮੋਡ',
  'action.deleteData': 'ਮੇਰਾ ਡੇਟਾ ਮਿਟਾਓ',
  'action.howWeCalculate': 'ਗਣਨਾ ਦਾ ਤਰੀਕਾ',
  'action.retry': 'ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ',
  'action.searchPlaceholder': 'ਕਾਲਜ, ਪ੍ਰੀਖਿਆ, ਵਜ਼ੀਫ਼ਾ ਜਾਂ ਟੂਲ ਖੋਜੋ...',
  'action.translateOutput': 'AI ਜਵਾਬ ਦਾ ਅਨੁਵਾਦ ਕਰੋ',
  'action.voiceInput': 'ਬੋਲ ਕੇ ਲਿਖੋ',
  'action.readAloud': 'ਸੁਣੋ',

  'hero.kicker': 'ਵਿਦਿਆਰਥੀ-ਪਹਿਲਾਂ · ਜ਼ੀਰੋ ਕਮਿਸ਼ਨ ਪੱਖਪਾਤ · ਸਰੋਤ ਪ੍ਰਮਾਣਿਤ',
  'hero.title': 'ਭਾਰਤੀ ਵਿਦਿਆਰਥੀਆਂ ਅਤੇ ਮਾਪਿਆਂ ਲਈ ਨਿਰਪੱਖ ਇੰਜੀਨੀਅਰਿੰਗ ਦਾਖਲਾ ਮਾਰਗਦਰਸ਼ਨ',
  'hero.subtitle': 'ਪ੍ਰਾਈਵੇਟ ਏਜੰਟਾਂ ਨੂੰ ₹25,000+ ਦਿੱਤੇ ਬਿਨਾਂ ਅਧਿਕਾਰਤ ਫੀਸਾਂ, ਅਸਲ NIRF ਮੀਡੀਅਨ ਪੈਕੇਜ, ਪ੍ਰੀਖਿਆ ਤਾਰੀਖਾਂ, ਵਜ਼ੀਫ਼ਾ ਯੋਗਤਾ ਅਤੇ ਫਰਜ਼ੀ ਏਜੰਟਾਂ ਦੀ ਜਾਂਚ ਕਰੋ।',
  'hero.ctaFind': 'ਸ਼ੁਰੂ ਕਰੋ: ਰੂਟ ਅਤੇ ਬਜਟ ਮੈਚ',
  'hero.ctaVerify': 'ਕਾਲਜ ਜਾਂ ਏਜੰਟ ਦੀ ਸੱਚਾਈ ਜਾਂਚੋ',
  'hero.ctaExams': 'ਪ੍ਰੀਖਿਆਵਾਂ ਅਤੇ ਆਖਰੀ ਤਾਰੀਖਾਂ ਦੇਖੋ',

  'home.howItWorksTitle': 'ਇਹ 3 ਪਾਰਦਰਸ਼ੀ ਕਦਮਾਂ ਵਿੱਚ ਕਿਵੇਂ ਕੰਮ ਕਰਦਾ ਹੈ',
  'home.step1Title': '01. ਆਪਣਾ ਦਾਖਲਾ ਰਸਤਾ ਅਤੇ 4-ਸਾਲਾ ਬਜਟ ਚੁਣੋ',
  'home.step1Desc': 'ਆਲ-ਇੰਡੀਆ ਪ੍ਰੀਖਿਆ (JEE/JoSAA/CET), ਕਾਲਜ ਪ੍ਰੀਖਿਆ (BITSAT/VITEEE) ਅਤੇ ਡਾਇਰੈਕਟ ਬੋਰਡ ਟਾਪਰ ਰਸਤਿਆਂ ਵਿੱਚ ਬਿਨਾਂ ਕਿਸੇ ਪੇਡ ਰੈਂਕਿੰਗ ਦੇ ਕਾਲਜ ਲੱਭੋ।',
  'home.step2Title': '02. ਮਾਨਤਾ, ਕੁੱਲ ਖਰਚਾ ਅਤੇ ਪਲੇਸਮੈਂਟ ਦੀ ਸੱਚਾਈ ਜਾਂਚੋ',
  'home.step2Desc': 'ਹਰ ਅੰਕੜਾ ਆਪਣਾ ਅਧਿਕਾਰਤ ਸਰੋਤ ਅਤੇ ਤਾਰੀਖ ਦਿਖਾਉਂਦਾ ਹੈ, ਜਾਂ ਸਪੱਸ਼ਟ ਤੌਰ ਤੇ "ਗੈਰ-ਪ੍ਰਮਾਣਿਤ, ਅਧਿਕਾਰਤ ਸਾਈਟ ਦੇਖੋ" ਦੱਸਦਾ ਹੈ।',
  'home.step3Title': '03. ਬੈਕਅੱਪ ਪਲਾਨ ਬਣਾਓ, ਦਸਤਾਵੇਜ਼ ਜਾਂਚੋ ਅਤੇ ਅਰਜ਼ੀਆਂ ਟਰੈਕ ਕਰੋ',
  'home.step3Desc': 'ਬ੍ਰਾਊਜ਼ਰ ਵਿੱਚ ਫੋਟੋ ਰੀਸਾਈਜ਼ ਕਰੋ, 4 ਕਾਲਜਾਂ ਦੀ ਤੁਲਨਾ ਕਰੋ, ਅਤੇ ਪਹਿਲਾਂ ₹0 ਦਿਓ (ਪਾਰਟਨਰ ਕਾਲਜ ਵਿੱਚ ਪੱਕੇ ਦਾਖਲੇ ਤੋਂ ਬਾਅਦ ਹੀ ₹99 ਫੀਸ)।',

  'common.notVerified': 'ਗੈਰ-ਪ੍ਰਮਾਣਿਤ, ਅਧਿਕਾਰਤ ਵੈੱਬਸਾਈਟ ਦੇਖੋ',
  'common.partnerLabel': 'ਪ੍ਰਮਾਣਿਤ ਪਾਰਟਨਰ ਕਾਲਜ (ਰੈਂਕਿੰਗ ਤੇ ਕੋਈ ਅਸਰ ਨਹੀਂ)',
  'common.infoOnlyLabel': 'ਸਿਰਫ਼ ਜਾਣਕਾਰੀ (ਅਧਿਕਾਰਤ ਪੋਰਟਲ ਤੇ ਅਪਲਾਈ ਕਰੋ)',
  'common.aiDisclaimer': 'AI-ਦੁਆਰਾ ਤਿਆਰ ਮਾਰਗਦਰਸ਼ਨ। ਅਧਿਕਾਰਤ ਕਾਲਜ ਜਾਂ ਪੋਰਟਲ ਤੋਂ ਪੁਸ਼ਟੀ ਕਰੋ।',
  'common.reviewSignalNote': 'ਇਹ ਸੰਕੇਤਾਂ ਤੇ ਅਧਾਰਤ ਸੰਭਾਵਨਾ ਹੈ, ਸਬੂਤ ਨਹੀਂ।',
};

const DICTIONARIES: Record<SupportedLanguage, TranslationDictionary> = {
  en: EN_STRINGS,
  hi: HI_STRINGS,
  pa: PA_STRINGS,
};

@Injectable({providedIn: 'root'})
export class I18nService {
  readonly currentLang = signal<SupportedLanguage>(
    (safeGetItem('admitwise_lang') as SupportedLanguage) || 'en'
  );

  readonly parentMode = signal<boolean>(
    safeGetItem('admitwise_parent_mode') === 'true'
  );

  readonly darkMode = signal<boolean>(
    safeGetItem('admitwise_dark_mode') === 'true'
  );

  readonly dict = computed(() => DICTIONARIES[this.currentLang()] ?? EN_STRINGS);

  setLanguage(lang: SupportedLanguage): void {
    this.currentLang.set(lang);
    safeSetItem('admitwise_lang', lang);
  }

  toggleParentMode(): void {
    const next = !this.parentMode();
    this.parentMode.set(next);
    safeSetItem('admitwise_parent_mode', String(next));
  }

  toggleDarkMode(): void {
    const next = !this.darkMode();
    this.darkMode.set(next);
    safeSetItem('admitwise_dark_mode', String(next));
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', next);
    }
  }

  t(key: string): string {
    return this.dict()[key] ?? EN_STRINGS[key] ?? key;
  }
}
