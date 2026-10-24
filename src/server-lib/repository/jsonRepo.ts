import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  ApplicationRecord,
  College,
  CutoffRecord,
  Exam,
  FraudReport,
  MetaInfo,
  ReminderSubscription,
  Scholarship,
  SeatAlertSubscription,
} from '../../shared/schemas';
import {
  SEED_COLLEGES,
  SEED_CUTOFFS,
  SEED_EXAMS,
  SEED_META,
  SEED_SCHOLARSHIPS,
} from '../../shared/seed-data';

const IS_SERVERLESS = Boolean(
  process.env['VERCEL'] || process.env['AWS_LAMBDA_FUNCTION_NAME']
);
const DATA_DIR = IS_SERVERLESS
  ? path.join('/tmp', 'search-kro-data')
  : path.resolve(process.cwd(), 'data');
const SEED_DATA_DIR = path.resolve(process.cwd(), 'data');
const memoryStore = new Map<string, unknown>();

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {recursive: true});
  }
}

export function atomicWriteJson<T>(filename: string, data: T): void {
  memoryStore.set(filename, data);
  try {
    ensureDataDir();
    const targetPath = path.join(DATA_DIR, filename);
    const tempPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, targetPath);
  } catch {
    // Fallback to in-memory store if filesystem is read-only
  }
}

export function readJsonOrDefault<T>(filename: string, defaultData: T): T {
  try {
    ensureDataDir();
    const targetPath = path.join(DATA_DIR, filename);
    if (fs.existsSync(targetPath)) {
      const raw = fs.readFileSync(targetPath, 'utf-8');
      const parsed = JSON.parse(raw) as T;
      memoryStore.set(filename, parsed);
      return parsed;
    }
    const seedPath = path.join(SEED_DATA_DIR, filename);
    if (fs.existsSync(seedPath)) {
      const raw = fs.readFileSync(seedPath, 'utf-8');
      const parsed = JSON.parse(raw) as T;
      memoryStore.set(filename, parsed);
      return parsed;
    }
    if (memoryStore.has(filename)) {
      return memoryStore.get(filename) as T;
    }
    atomicWriteJson(filename, defaultData);
    return defaultData;
  } catch {
    if (memoryStore.has(filename)) {
      return memoryStore.get(filename) as T;
    }
    return defaultData;
  }
}

export class DataRepository {
  private collegesCache: College[] | null = null;
  private examsCache: Exam[] | null = null;
  private scholarshipsCache: Scholarship[] | null = null;
  private cutoffsCache: CutoffRecord[] | null = null;
  private metaCache: MetaInfo | null = null;

  constructor() {
    this.bootstrapFilesIfNeeded();
  }

  public bootstrapFilesIfNeeded(): void {
    const existingColleges = readJsonOrDefault('colleges.json', SEED_COLLEGES);
    const existingIds = new Set(existingColleges.map((c) => c.id));
    const mergedColleges = [...existingColleges];
    let addedSeed = false;
    for (const seedCollege of SEED_COLLEGES) {
      if (!existingIds.has(seedCollege.id)) {
        mergedColleges.push(seedCollege);
        existingIds.add(seedCollege.id);
        addedSeed = true;
      }
    }
    if (addedSeed) {
      atomicWriteJson('colleges.json', mergedColleges);
      this.collegesCache = mergedColleges;
    }

    readJsonOrDefault('exams.json', SEED_EXAMS);
    readJsonOrDefault('scholarships.json', SEED_SCHOLARSHIPS);
    readJsonOrDefault('cutoffs.json', SEED_CUTOFFS);

    const currentMeta = readJsonOrDefault('meta.json', SEED_META);
    if (currentMeta.totalColleges !== mergedColleges.length) {
      const updatedMeta: MetaInfo = {
        ...currentMeta,
        totalColleges: mergedColleges.length,
        lastRefreshed: new Date().toISOString(),
      };
      atomicWriteJson('meta.json', updatedMeta);
      this.metaCache = updatedMeta;
    }

    readJsonOrDefault<ApplicationRecord[]>('applications.json', []);
    readJsonOrDefault<FraudReport[]>('reports.json', [
      {
        id: 'rep-seed-1',
        type: 'Fake Agent / Guaranteed Seat Scam',
        entityType: 'Consultancy / Agent',
        stateOrCity: 'Delhi NCR',
        details: 'Agent promised direct CSE seat in government college for ₹5 Lakh advance.',
        createdAt: '2025-01-20T10:00:00.000Z',
        status: 'Aggregated',
      },
      {
        id: 'rep-seed-2',
        type: 'Hidden Fee / Original Document Retention',
        entityType: 'College',
        stateOrCity: 'Pune',
        details: 'Requested original Class 12 marksheet retention before JoSAA spot round withdrawal window.',
        createdAt: '2025-01-25T12:00:00.000Z',
        status: 'Aggregated',
      },
    ]);
    readJsonOrDefault<SeatAlertSubscription[]>('alerts.json', []);
    readJsonOrDefault<ReminderSubscription[]>('reminders.json', []);
    readJsonOrDefault<Record<string, {timestamp: number; response: unknown}>>(
      'ai-cache.json',
      {}
    );
  }

  public getColleges(): College[] {
    if (!this.collegesCache) {
      this.collegesCache = readJsonOrDefault('colleges.json', SEED_COLLEGES);
    }
    return this.collegesCache;
  }

  public getCollegeById(id: string): College | undefined {
    return this.getColleges().find((c) => c.id === id);
  }

  public upsertColleges(newColleges: College[]): College[] {
    const current = [...this.getColleges()];
    const indexById = new Map<string, number>();
    current.forEach((c, idx) => indexById.set(c.id, idx));

    for (const incoming of newColleges) {
      const existingIdx = indexById.get(incoming.id);
      if (existingIdx !== undefined) {
        current[existingIdx] = incoming;
      } else {
        current.push(incoming);
        indexById.set(incoming.id, current.length - 1);
      }
    }

    this.collegesCache = current;
    atomicWriteJson('colleges.json', current);

    const updatedMeta: MetaInfo = {
      ...this.getMeta(),
      totalColleges: current.length,
      lastRefreshed: new Date().toISOString(),
    };
    this.metaCache = updatedMeta;
    atomicWriteJson('meta.json', updatedMeta);

    return current;
  }

  public getExams(): Exam[] {
    if (!this.examsCache) {
      this.examsCache = readJsonOrDefault('exams.json', SEED_EXAMS);
    }
    return this.examsCache;
  }

  public getScholarships(): Scholarship[] {
    if (!this.scholarshipsCache) {
      this.scholarshipsCache = readJsonOrDefault(
        'scholarships.json',
        SEED_SCHOLARSHIPS
      );
    }
    return this.scholarshipsCache;
  }

  public getCutoffs(): CutoffRecord[] {
    if (!this.cutoffsCache) {
      this.cutoffsCache = readJsonOrDefault('cutoffs.json', SEED_CUTOFFS);
    }
    return this.cutoffsCache;
  }

  public getMeta(): MetaInfo {
    if (!this.metaCache) {
      this.metaCache = readJsonOrDefault('meta.json', SEED_META);
    }
    return this.metaCache;
  }

  public getApplicationsByDevice(deviceId: string): ApplicationRecord[] {
    const all = readJsonOrDefault<ApplicationRecord[]>('applications.json', []);
    return all.filter((a) => a.deviceId === deviceId);
  }

  public createApplication(record: ApplicationRecord): ApplicationRecord {
    const all = readJsonOrDefault<ApplicationRecord[]>('applications.json', []);
    all.unshift(record);
    atomicWriteJson('applications.json', all);
    return record;
  }

  public updateApplicationStatus(
    id: string,
    deviceId: string,
    status: ApplicationRecord['status'],
    note: string
  ): ApplicationRecord | null {
    const all = readJsonOrDefault<ApplicationRecord[]>('applications.json', []);
    const index = all.findIndex((a) => a.id === id && a.deviceId === deviceId);
    if (index === -1) return null;
    const updated: ApplicationRecord = {
      ...all[index],
      status,
      updatedAt: new Date().toISOString(),
      timeline: [
        ...all[index].timeline,
        {
          stage: status,
          date: new Date().toISOString().slice(0, 10),
          note,
        },
      ],
    };
    all[index] = updated;
    atomicWriteJson('applications.json', all);
    return updated;
  }

  public addFraudReport(report: FraudReport): {
    totalReports: number;
    byType: Record<string, number>;
  } {
    const all = readJsonOrDefault<FraudReport[]>('reports.json', []);
    all.push(report);
    atomicWriteJson('reports.json', all);
    return this.getAggregatedFraudStats();
  }

  public getAggregatedFraudStats(): {
    totalReports: number;
    byType: Record<string, number>;
  } {
    const all = readJsonOrDefault<FraudReport[]>('reports.json', []);
    const byType: Record<string, number> = {};
    for (const r of all) {
      byType[r.type] = (byType[r.type] || 0) + 1;
    }
    return {
      totalReports: all.length,
      byType,
    };
  }

  public addSeatAlertSubscription(
    sub: SeatAlertSubscription
  ): SeatAlertSubscription[] {
    const all = readJsonOrDefault<SeatAlertSubscription[]>('alerts.json', []);
    all.unshift(sub);
    atomicWriteJson('alerts.json', all);
    return all.filter((a) => a.deviceId === sub.deviceId);
  }

  public getSeatAlertsByDevice(deviceId: string): SeatAlertSubscription[] {
    const all = readJsonOrDefault<SeatAlertSubscription[]>('alerts.json', []);
    return all.filter((a) => a.deviceId === deviceId);
  }

  public addReminderSubscription(
    sub: ReminderSubscription
  ): ReminderSubscription[] {
    const all = readJsonOrDefault<ReminderSubscription[]>('reminders.json', []);
    all.unshift(sub);
    atomicWriteJson('reminders.json', all);
    return all.filter((r) => r.deviceId === sub.deviceId);
  }

  public getRemindersByDevice(deviceId: string): ReminderSubscription[] {
    const all = readJsonOrDefault<ReminderSubscription[]>('reminders.json', []);
    return all.filter((r) => r.deviceId === deviceId);
  }

  public deleteDeviceData(deviceId: string): void {
    const apps = readJsonOrDefault<ApplicationRecord[]>('applications.json', []);
    atomicWriteJson(
      'applications.json',
      apps.filter((a) => a.deviceId !== deviceId)
    );

    const alerts = readJsonOrDefault<SeatAlertSubscription[]>(
      'alerts.json',
      []
    );
    atomicWriteJson(
      'alerts.json',
      alerts.filter((a) => a.deviceId !== deviceId)
    );

    const reminders = readJsonOrDefault<ReminderSubscription[]>(
      'reminders.json',
      []
    );
    atomicWriteJson(
      'reminders.json',
      reminders.filter((r) => r.deviceId !== deviceId)
    );
  }
}

export const repo = new DataRepository();
