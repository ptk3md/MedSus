export type DocumentKind =
  | 'prescription'
  | 'exam'
  | 'certificate'
  | 'medical-document'
  | 'aih'
  | 'apac'
  | 'lme';

export interface Unit {
  id: string;
  name: string;
  cnes?: string;
  address?: string;
}

export interface AccountProfile {
  name: string;
  email: string;
  crm: string;
  role: 'visitor' | 'doctor' | 'student';
}

export interface StoredDocument {
  id: string;
  kind: DocumentKind;
  title: string;
  patientName: string;
  createdAt: string;
  updatedAt: string;
  unitId: string;
  status: 'draft' | 'ready';
  payload: Record<string, unknown>;
}

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  read: boolean;
}

export interface ConductItem {
  id: string;
  area: string;
  title: string;
  keywords: string[];
  summary: string;
  sourceNote: string;
}

export interface AppState {
  units: Unit[];
  activeUnitId: string;
  account: AccountProfile;
  documents: StoredDocument[];
  notifications: NotificationItem[];
  conducts: ConductItem[];
}
