import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

export type AdminAuditLogItem = {
  id: string;
  action: string;
  adminName: string;
  targetCustomer: string;
  ipAddress: string;
  timestamp: string;
};

export type AdminGlobalSettings = {
  platformName: string;
  supportEmail: string;
  maintenanceMode: boolean;
  defaultLanguage: string;
  /** Legacy: external URL fallback (English) */
  logoUrlEn: string;
  /** Legacy: external URL fallback (Arabic) */
  logoUrlAr: string;
  /** Stored filename under .data/branding/ */
  logoAssetEnLight: string;
  logoAssetEnDark: string;
  logoAssetArLight: string;
  logoAssetArDark: string;
  /** Bumps on upload for cache-busting */
  brandingEpoch: number;
};

type AdminRuntimeData = {
  logs: AdminAuditLogItem[];
  settings: AdminGlobalSettings;
};

const DATA_DIR = join(process.cwd(), '.data');
const DATA_FILE = join(DATA_DIR, 'admin-runtime.json');

const DEFAULT_DATA: AdminRuntimeData = {
  logs: [],
  settings: {
    platformName: 'Cloud Signage',
    supportEmail: 'support@cloudsignage.local',
    maintenanceMode: false,
    defaultLanguage: 'ar',
    logoUrlEn: '',
    logoUrlAr: '',
    logoAssetEnLight: '',
    logoAssetEnDark: '',
    logoAssetArLight: '',
    logoAssetArDark: '',
    brandingEpoch: 0,
  },
};

async function ensureDataFile(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    await readFile(DATA_FILE, 'utf-8');
  } catch {
    await writeFile(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2), 'utf-8');
  }
}

function normalizeSettings(raw: unknown): AdminGlobalSettings {
  const base = DEFAULT_DATA.settings;
  if (!raw || typeof raw !== 'object') {
    return { ...base };
  }
  const r = raw as Record<string, unknown>;
  return {
    platformName:
      typeof r.platformName === 'string' ? r.platformName : base.platformName,
    supportEmail:
      typeof r.supportEmail === 'string' ? r.supportEmail : base.supportEmail,
    maintenanceMode:
      typeof r.maintenanceMode === 'boolean'
        ? r.maintenanceMode
        : base.maintenanceMode,
    defaultLanguage:
      typeof r.defaultLanguage === 'string'
        ? r.defaultLanguage
        : base.defaultLanguage,
    logoUrlEn: typeof r.logoUrlEn === 'string' ? r.logoUrlEn : '',
    logoUrlAr: typeof r.logoUrlAr === 'string' ? r.logoUrlAr : '',
    logoAssetEnLight:
      typeof r.logoAssetEnLight === 'string' ? r.logoAssetEnLight : '',
    logoAssetEnDark:
      typeof r.logoAssetEnDark === 'string' ? r.logoAssetEnDark : '',
    logoAssetArLight:
      typeof r.logoAssetArLight === 'string' ? r.logoAssetArLight : '',
    logoAssetArDark:
      typeof r.logoAssetArDark === 'string' ? r.logoAssetArDark : '',
    brandingEpoch:
      typeof r.brandingEpoch === 'number' && Number.isFinite(r.brandingEpoch)
        ? r.brandingEpoch
        : 0,
  };
}

async function readData(): Promise<AdminRuntimeData> {
  await ensureDataFile();
  try {
    const raw = await readFile(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as AdminRuntimeData;
    return {
      logs: Array.isArray(parsed.logs) ? parsed.logs : [],
      settings: normalizeSettings(parsed.settings),
    };
  } catch {
    return DEFAULT_DATA;
  }
}

async function writeData(data: AdminRuntimeData): Promise<void> {
  await ensureDataFile();
  await writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export async function appendAuditLog(
  input: Omit<AdminAuditLogItem, 'id' | 'timestamp'>,
): Promise<void> {
  const data = await readData();
  data.logs.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    timestamp: new Date().toISOString(),
    ...input,
  });
  data.logs = data.logs.slice(0, 1000);
  await writeData(data);
}

export async function listAuditLogs(): Promise<AdminAuditLogItem[]> {
  const data = await readData();
  return data.logs;
}

export async function getAdminSettings(): Promise<AdminGlobalSettings> {
  const data = await readData();
  return data.settings;
}

export async function updateAdminSettings(
  partial: Partial<AdminGlobalSettings>,
): Promise<AdminGlobalSettings> {
  const data = await readData();
  data.settings = { ...data.settings, ...partial };
  await writeData(data);
  return data.settings;
}
