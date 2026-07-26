import type { AppState, ConductItem, StoredDocument } from './types.js';

const STORAGE_KEY = 'sismed-clone-state-v2';

const seedConducts: ConductItem[] = [
  {
    id: 'conduct-1',
    area: 'Clínica médica',
    title: 'Dor torácica — fluxo inicial',
    keywords: ['dor torácica', 'ecg', 'síndrome coronariana'],
    summary: 'Estrutura de consulta para protocolo institucional: estabilização, sinais de alarme, ECG, exames e reavaliação.',
    sourceNote: 'Conteúdo demonstrativo. Vincule esta ficha ao protocolo validado da sua instituição.'
  },
  {
    id: 'conduct-2',
    area: 'Pediatria',
    title: 'Febre em criança — triagem documental',
    keywords: ['febre', 'pediatria', 'criança'],
    summary: 'Checklist administrativo para registrar idade, peso, duração, sinais de alarme, alergias e conduta revisada.',
    sourceNote: 'Não contém dose ou recomendação clínica automática.'
  },
  {
    id: 'conduct-3',
    area: 'Urgência',
    title: 'Anafilaxia — cartão de protocolo',
    keywords: ['anafilaxia', 'alergia', 'emergência'],
    summary: 'Espaço de referência para protocolo local, monitorização, medicações padronizadas e critérios de observação.',
    sourceNote: 'Importe o protocolo institucional em JSON para uso assistencial.'
  },
  {
    id: 'conduct-4',
    area: 'Infectologia',
    title: 'Antimicrobianos — conferência antes da emissão',
    keywords: ['antibiótico', 'antimicrobiano', 'dose', 'diluição'],
    summary: 'Checklist de alergias, função renal, peso, via, diluição, duração e protocolo de stewardship.',
    sourceNote: 'Sem banco farmacológico embutido; conecte uma fonte clínica licenciada.'
  }
];

const defaultState = (): AppState => ({
  units: [
    { id: 'unit-default', name: 'UNIDADE PADRÃO', cnes: '', address: '' },
    { id: 'unit-upa', name: 'UPA DEMONSTRAÇÃO', cnes: '', address: '' }
  ],
  activeUnitId: 'unit-default',
  account: {
    name: 'Dr(a). Visitante',
    email: '',
    crm: '',
    role: 'visitor'
  },
  documents: [],
  notifications: [
    {
      id: 'notification-1',
      title: 'Modo visitante ativo',
      description: 'Os documentos ficam somente neste navegador até você limpar os dados locais.',
      createdAt: new Date().toISOString(),
      read: false
    }
  ],
  conducts: seedConducts
});

const isAppState = (value: unknown): value is AppState => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AppState>;
  return Array.isArray(candidate.units) && Array.isArray(candidate.documents) && !!candidate.account;
};

export const loadState = (): AppState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed: unknown = JSON.parse(raw);
    if (!isAppState(parsed)) return defaultState();
    return {
      ...defaultState(),
      ...parsed,
      conducts: Array.isArray(parsed.conducts) && parsed.conducts.length ? parsed.conducts : seedConducts,
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications : []
    };
  } catch {
    return defaultState();
  }
};

export const persistState = (state: AppState): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const upsertDocument = (state: AppState, document: StoredDocument): void => {
  const index = state.documents.findIndex((item) => item.id === document.id);
  if (index >= 0) state.documents[index] = document;
  else state.documents.unshift(document);
  persistState(state);
};

export const removeDocument = (state: AppState, id: string): void => {
  state.documents = state.documents.filter((item) => item.id !== id);
  persistState(state);
};

export const resetState = (): AppState => {
  const next = defaultState();
  persistState(next);
  return next;
};
