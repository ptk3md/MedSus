import { icon, type IconName } from './icons.js';
import { loadState, persistState, removeDocument, resetState, upsertDocument } from './storage.js';
import type { AppState, DocumentKind, StoredDocument } from './types.js';
import {
  checkedValues,
  downloadText,
  escapeHTML,
  formatDate,
  formatDateTime,
  formValue,
  uid
} from './utils.js';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Elemento #app não encontrado.');

let state: AppState = loadState();

interface QuickAction {
  route: string;
  title: string;
  icon: IconName;
  tone?: 'blue' | 'orange';
}

const quickActions: QuickAction[] = [
  { route: '/receita', title: 'Nova Receita', icon: 'file-plus' },
  { route: '/exame', title: 'Novo Exame', icon: 'microscope' },
  { route: '/atestado', title: 'Novo Atestado', icon: 'certificate' },
  { route: '/ia', title: 'Atendimento IA', icon: 'robot' },
  { route: '/documentos', title: 'Documentos Médicos', icon: 'medical-file', tone: 'orange' },
  { route: '/aih', title: 'Gerar AIH', icon: 'users-file' },
  { route: '/apac', title: 'Gerar APAC', icon: 'hospital-file' },
  { route: '/lme', title: 'Gerar LME', icon: 'clipboard-file' },
  { route: '/prescricoes', title: 'Minhas Prescrições', icon: 'prescriptions' }
];

const kindLabels: Record<DocumentKind, string> = {
  prescription: 'Receita médica',
  exam: 'Solicitação de exames',
  certificate: 'Atestado médico',
  'medical-document': 'Documento médico',
  aih: 'AIH',
  apac: 'APAC',
  lme: 'LME'
};

const route = (): string => {
  const value = location.hash.replace(/^#/, '') || '/dashboard';
  return value.startsWith('/') ? value : `/${value}`;
};

const go = (path: string): void => {
  location.hash = path;
};

const currentUnit = () => state.units.find((unit) => unit.id === state.activeUnitId) ?? state.units[0];

const accountShortName = (): string => {
  if (state.account.role === 'visitor') return 'Visitante';
  return state.account.name.split(' ')[0] || state.account.name;
};

const unreadNotifications = (): number => state.notifications.filter((item) => !item.read).length;

const header = (): string => `
  <header class="app-header">
    <button class="header-icon header-menu" type="button" data-toggle-drawer aria-label="Abrir menu">
      <span class="double-chevron">»</span>
    </button>
    <a class="app-brand" href="#/dashboard" aria-label="Voltar ao painel">
      <span class="brand-symbol">${icon('stethoscope', 25)}</span>
      <strong>SisMed Médico</strong>
    </a>
    <div class="header-spacer"></div>
    <div class="header-popover-wrap">
      <button class="header-icon notification-button" type="button" data-toggle-notifications aria-label="Notificações">
        ${icon('bell', 20)}
        ${unreadNotifications() ? '<span class="notification-dot"></span>' : ''}
      </button>
      <div class="popover notifications-popover" data-notifications hidden>
        <div class="popover-heading"><strong>Notificações</strong><button type="button" data-read-all>Marcar como lidas</button></div>
        <div class="notification-list">
          ${state.notifications.length
            ? state.notifications
                .map(
                  (item) => `<article class="notification-item ${item.read ? '' : 'unread'}">
                    <strong>${escapeHTML(item.title)}</strong>
                    <p>${escapeHTML(item.description)}</p>
                    <small>${formatDateTime(item.createdAt)}</small>
                  </article>`
                )
                .join('')
            : '<p class="empty-inline">Nenhuma notificação.</p>'}
        </div>
      </div>
    </div>
    <div class="header-popover-wrap profile-wrap">
      <button class="profile-button" type="button" data-toggle-profile>
        <span class="profile-avatar">D<span class="online-dot"></span></span>
        <span class="profile-copy"><strong>${escapeHTML(state.account.name)}</strong><small>${state.account.role === 'visitor' ? 'Visitante' : escapeHTML(state.account.crm || 'Conta local')}</small></span>
        ${icon('chevron-down', 18)}
      </button>
      <div class="popover profile-popover" data-profile hidden>
        <button type="button" data-open-account>${icon('user', 18)} Dados da conta</button>
        <button type="button" data-open-settings>${icon('settings', 18)} Configurações</button>
        <button type="button" data-reset-demo>${icon('refresh', 18)} Limpar dados locais</button>
      </div>
    </div>
  </header>`;

const drawer = (): string => `
  <div class="drawer-backdrop" data-drawer-backdrop hidden></div>
  <aside class="nav-drawer" data-drawer aria-label="Menu principal">
    <div class="drawer-heading">
      <span class="brand-symbol">${icon('stethoscope', 24)}</span>
      <strong>SisMed Médico</strong>
      <button type="button" data-toggle-drawer aria-label="Fechar menu">${icon('x', 20)}</button>
    </div>
    <nav>
      <a href="#/dashboard" class="${route() === '/dashboard' ? 'active' : ''}">${icon('home', 19)} Painel</a>
      <a href="#/condutas" class="${route() === '/condutas' ? 'active' : ''}">${icon('book-medical', 19)} Condutas do plantão</a>
      ${quickActions
        .map(
          (action) => `<a href="#${action.route}" class="${route() === action.route ? 'active' : ''}">${icon(action.icon, 19)} ${action.title}</a>`
        )
        .join('')}
    </nav>
    <div class="drawer-footer">
      <p>Modo visitante</p>
      <small>Dados salvos apenas neste navegador.</small>
    </div>
  </aside>`;

const shell = (content: string): string => `
  ${header()}
  ${drawer()}
  <main class="app-main">${content}</main>
  <div id="modal-root"></div>
  <div class="toast-region" aria-live="polite" aria-atomic="true"></div>`;

const dashboardPage = (): string => {
  const unit = currentUnit();
  return `
    <section class="dashboard-page">
      <section class="unit-banner">
        <span class="unit-icon">${icon('building', 26)}</span>
        <div><small>UNIDADE ATIVA DOS DOCUMENTOS</small><strong>${escapeHTML(unit?.name ?? 'UNIDADE PADRÃO')}</strong></div>
        <button class="white-button" type="button" data-open-units>${icon('swap', 17)} Trocar unidade</button>
      </section>

      <section class="welcome-card">
        <div><h1>Bom plantão, ${escapeHTML(accountShortName())}.</h1><p>O que deseja fazer agora?</p></div>
        <div class="current-account"><small>CONTA ATUAL</small><strong>${escapeHTML(accountShortName())}</strong></div>
      </section>

      <section class="conduct-banner">
        <span class="conduct-icon">${icon('book-medical', 26)}</span>
        <div class="conduct-copy"><h2>Condutas do Plantão <span>NOVO DESTAQUE</span></h2><p>Pesquise medicamentos, doses, diluições e condutas em 19 áreas clínicas.</p></div>
        <a class="primary-button" href="#/condutas">${icon('external', 17)} Consultar agora</a>
      </section>

      <section class="quick-section">
        <h2 class="section-kicker">AÇÕES RÁPIDAS</h2>
        <div class="quick-actions-grid">
          ${quickActions
            .map(
              (action) => `<a href="#${action.route}" class="quick-action-card">
                <span class="quick-action-icon ${action.tone === 'orange' ? 'orange' : ''}">${icon(action.icon, 22)}</span>
                <strong>${action.title}</strong>
              </a>`
            )
            .join('')}
        </div>
      </section>

      <section class="visitor-cta">
        <span>${icon('check', 17)}</span>
        <div><strong>Teste as ferramentas primeiro.</strong><p>Depois, crie sua conta grátis para usar seu nome e CRM e salvar seus modelos.</p></div>
        <div class="visitor-cta-actions"><button class="primary-button" type="button" data-open-account>${icon('user', 16)} Criar conta grátis</button><button class="outline-button" type="button" data-support>${icon('headset', 16)} Falar comigo</button></div>
      </section>

      <section class="bottom-info-grid">
        <article class="info-card tip-card"><span class="emoji">💡</span><div><h3>Dica do dia</h3><p>Conheça um recurso que pode facilitar sua rotina.</p></div><button type="button" data-show-tip>${icon('arrow-right', 18)}</button></article>
        <article class="info-card"><span class="info-icon">${icon('shield', 22)}</span><div><h3>Segurança médica</h3><p>Revise o conteúdo antes de emitir. O sistema é ferramenta de apoio administrativo.</p></div></article>
      </section>
    </section>`;
};

const moduleHeader = (title: string, subtitle: string, iconName: IconName, actions = ''): string => `
  <div class="module-topline">
    <a class="back-button" href="#/dashboard">${icon('arrow-left', 18)} Voltar ao painel</a>
    <div class="module-topline-actions">${actions}</div>
  </div>
  <header class="module-heading">
    <span>${icon(iconName, 28)}</span>
    <div><h1>${title}</h1><p>${subtitle}</p></div>
  </header>`;

const patientFields = (): string => `
  <fieldset class="form-section">
    <legend>Identificação do paciente</legend>
    <div class="form-grid columns-3">
      <label class="field span-2">Nome do paciente<input name="patientName" required autocomplete="off" placeholder="Nome completo" /></label>
      <label class="field">Data de nascimento<input name="birthDate" type="date" /></label>
      <label class="field">CPF<input name="cpf" inputmode="numeric" placeholder="000.000.000-00" /></label>
      <label class="field">CNS<input name="cns" inputmode="numeric" placeholder="Cartão Nacional de Saúde" /></label>
      <label class="field">Sexo<select name="sex"><option value="">Não informado</option><option>Feminino</option><option>Masculino</option><option>Outro</option></select></label>
    </div>
  </fieldset>`;

const formFooter = (label: string): string => `
  <div class="form-footer">
    <p>${icon('shield', 17)} Revise integralmente o documento antes de imprimir, assinar ou utilizar.</p>
    <div><button class="outline-button" type="reset">Limpar</button><button class="primary-button" type="submit">${icon('save', 17)} ${label}</button></div>
  </div>`;

const prescriptionPage = (): string => `
  <section class="module-page">
    ${moduleHeader('Nova Receita', 'Monte uma prescrição estruturada, revise e imprima.', 'file-plus')}
    <form id="prescription-form" class="document-form">
      ${patientFields()}
      <fieldset class="form-section">
        <div class="fieldset-heading"><legend>Medicamentos</legend><button type="button" class="small-button" data-add-medication>${icon('plus', 15)} Adicionar item</button></div>
        <div class="medication-list" data-medication-list>
          ${medicationRow(1)}
        </div>
      </fieldset>
      <fieldset class="form-section"><legend>Orientações adicionais</legend><label class="field"><textarea name="notes" rows="4" placeholder="Recomendações, sinais de alarme, retorno e observações"></textarea></label></fieldset>
      ${formFooter('Salvar e visualizar')}
    </form>
  </section>`;

const medicationRow = (index: number): string => `
  <div class="medication-row" data-medication-row>
    <div class="row-number">${index}</div>
    <div class="form-grid columns-4 medication-fields">
      <label class="field span-2">Medicamento<input data-medication="name" placeholder="Nome e apresentação" required /></label>
      <label class="field">Via<select data-medication="route"><option>Uso oral</option><option>Uso tópico</option><option>Uso injetável</option><option>Uso inalatório</option><option>Outra</option></select></label>
      <label class="field">Quantidade<input data-medication="quantity" placeholder="Ex.: 1 caixa" /></label>
      <label class="field span-2">Posologia<input data-medication="dosage" placeholder="Instrução para uso — revisar manualmente" required /></label>
      <label class="field">Duração<input data-medication="duration" placeholder="Ex.: 7 dias" /></label>
      <label class="field">Observação<input data-medication="note" placeholder="Opcional" /></label>
    </div>
    <button class="remove-row-button" type="button" data-remove-medication aria-label="Remover medicamento">${icon('trash', 17)}</button>
  </div>`;

const examPage = (): string => `
  <section class="module-page">
    ${moduleHeader('Novo Exame', 'Selecione exames, registre a indicação e gere a solicitação.', 'microscope')}
    <form id="exam-form" class="document-form">
      ${patientFields()}
      <fieldset class="form-section">
        <legend>Exames solicitados</legend>
        <div class="checkbox-grid">
          ${[
            'Hemograma completo',
            'Glicemia',
            'Ureia e creatinina',
            'Sódio e potássio',
            'TGO e TGP',
            'Coagulograma',
            'Urina tipo I',
            'Radiografia',
            'Ultrassonografia',
            'Tomografia',
            'Eletrocardiograma',
            'Outro'
          ]
            .map((name) => `<label><input type="checkbox" name="exams" value="${name}" /> <span>${name}</span></label>`)
            .join('')}
        </div>
        <label class="field top-gap">Exames adicionais<textarea name="customExams" rows="3" placeholder="Um exame por linha"></textarea></label>
      </fieldset>
      <fieldset class="form-section"><legend>Informações clínicas</legend><div class="form-grid columns-3"><label class="field span-2">Indicação clínica<textarea name="indication" rows="4" required placeholder="Indicação para revisão do profissional"></textarea></label><label class="field">Prioridade<select name="priority"><option>Rotina</option><option>Urgência</option><option>Emergência</option></select></label></div></fieldset>
      ${formFooter('Salvar e visualizar')}
    </form>
  </section>`;

const certificatePage = (): string => `
  <section class="module-page">
    ${moduleHeader('Novo Atestado', 'Preencha os dados, revise o texto e gere a versão para impressão.', 'certificate')}
    <form id="certificate-form" class="document-form">
      ${patientFields()}
      <fieldset class="form-section"><legend>Período e finalidade</legend><div class="form-grid columns-4"><label class="field">Data inicial<input type="date" name="startDate" required value="${new Date().toISOString().slice(0, 10)}" /></label><label class="field">Quantidade de dias<input type="number" min="0" max="365" name="days" value="1" required /></label><label class="field">Finalidade<select name="purpose"><option>Trabalho</option><option>Estudo</option><option>Comparecimento</option><option>Outra</option></select></label><label class="field">CID — opcional<input name="cid" placeholder="Incluir somente com autorização" /></label></div></fieldset>
      <fieldset class="form-section"><legend>Texto do atestado</legend><label class="field"><textarea name="body" rows="7">Atesto, para os devidos fins, que o(a) paciente acima identificado(a) necessita de afastamento de suas atividades pelo período informado, a contar da data indicada.</textarea></label><label class="consent-check"><input type="checkbox" name="cidConsent" /> O paciente autorizou expressamente a inclusão do CID.</label></fieldset>
      ${formFooter('Salvar e visualizar')}
    </form>
  </section>`;

const aiPage = (): string => `
  <section class="module-page">
    ${moduleHeader('Atendimento IA', 'Organize texto clínico em seções editáveis. A decisão permanece com o profissional.', 'robot')}
    <div class="ai-layout">
      <form id="ai-form" class="document-form ai-input-card">
        <fieldset class="form-section"><legend>Entrada clínica</legend><label class="field">Registro do atendimento<textarea name="clinicalText" rows="15" required placeholder="Digite apenas as informações necessárias. Evite dados identificáveis desnecessários."></textarea></label><div class="form-grid columns-2 top-gap"><label class="field">Formato de saída<select name="outputFormat"><option value="structured">Atendimento estruturado</option><option value="soap">SOAP</option><option value="summary">Resumo objetivo</option></select></label><label class="field">Endpoint opcional<input name="endpoint" type="url" placeholder="https://seu-backend/api/ai" value="${escapeHTML(localStorage.getItem('sismed-ai-endpoint') ?? '')}" /></label></div></fieldset>
        <div class="form-footer"><p>${icon('shield', 17)} O modo local apenas reorganiza o texto. Para IA real, conecte seu endpoint autenticado.</p><button class="primary-button" type="submit">${icon('wand', 17)} Organizar atendimento</button></div>
      </form>
      <section class="ai-output-card" data-ai-output><div class="empty-state">${icon('robot', 38)}<h2>Saída aguardando processamento</h2><p>O conteúdo estruturado aparecerá aqui para revisão e cópia.</p></div></section>
    </div>
  </section>`;

const medicalDocumentsPage = (): string => `
  <section class="module-page">
    ${moduleHeader('Documentos Médicos', 'Gere relatórios, encaminhamentos, declarações e resumos.', 'medical-file')}
    <form id="medical-document-form" class="document-form">
      ${patientFields()}
      <fieldset class="form-section"><legend>Tipo de documento</legend><div class="template-grid">${[
        ['Relatório médico', 'Relato clínico e administrativo'],
        ['Encaminhamento', 'Solicitação a outro serviço ou especialidade'],
        ['Declaração de comparecimento', 'Registro de presença no atendimento'],
        ['Resumo de alta', 'Síntese para continuidade do cuidado']
      ]
        .map(([title, description], index) => `<label class="template-option"><input type="radio" name="documentType" value="${title}" ${index === 0 ? 'checked' : ''}/><span>${icon('file-text', 22)}<strong>${title}</strong><small>${description}</small></span></label>`)
        .join('')}</div></fieldset>
      <fieldset class="form-section"><legend>Conteúdo</legend><div class="form-grid columns-2"><label class="field">Diagnóstico ou hipótese<input name="diagnosis" placeholder="Opcional" /></label><label class="field">CID<input name="cid" placeholder="Opcional e sujeito a autorização" /></label></div><label class="field top-gap">Texto do documento<textarea name="body" rows="10" required placeholder="Descreva o conteúdo que será revisado e assinado."></textarea></label></fieldset>
      ${formFooter('Salvar e visualizar')}
    </form>
  </section>`;

const aihPage = (): string => `
  <section class="module-page">
    ${moduleHeader('Gerar AIH', 'Organize dados para conferência e impressão do formulário de internação.', 'users-file')}
    <form id="aih-form" class="document-form">
      ${patientFields()}
      <fieldset class="form-section"><legend>Dados da internação</legend><div class="form-grid columns-3"><label class="field span-2">Procedimento solicitado<input name="procedure" required /></label><label class="field">Código do procedimento<input name="procedureCode" /></label><label class="field">CID principal<input name="cid" required /></label><label class="field">CID secundário<input name="secondaryCid" /></label><label class="field">Caráter<select name="character"><option>Eletivo</option><option>Urgência</option></select></label><label class="field">Data da solicitação<input type="date" name="requestDate" value="${new Date().toISOString().slice(0, 10)}" /></label><label class="field">Diárias solicitadas<input type="number" min="1" name="days" /></label><label class="field">Clínica<select name="clinic"><option>Clínica médica</option><option>Cirúrgica</option><option>Obstétrica</option><option>Pediátrica</option><option>Psiquiátrica</option><option>Outra</option></select></label></div></fieldset>
      <fieldset class="form-section"><legend>Justificativa</legend><label class="field">Principais sinais, sintomas e condições<textarea name="signs" rows="4" required></textarea></label><label class="field top-gap">Resultados diagnósticos relevantes<textarea name="results" rows="4"></textarea></label></fieldset>
      ${formFooter('Salvar e visualizar')}
    </form>
  </section>`;

const apacPage = (): string => `
  <section class="module-page">
    ${moduleHeader('Gerar APAC', 'Estruture os dados do procedimento ambulatorial para revisão.', 'hospital-file')}
    <form id="apac-form" class="document-form">
      ${patientFields()}
      <fieldset class="form-section"><legend>Procedimento</legend><div class="form-grid columns-3"><label class="field span-2">Nome do procedimento<input name="procedure" required /></label><label class="field">Código SIGTAP<input name="procedureCode" /></label><label class="field">CID principal<input name="cid" required /></label><label class="field">CID secundário<input name="secondaryCid" /></label><label class="field">Quantidade solicitada<input type="number" name="quantity" min="1" value="1" /></label><label class="field">Competência<input type="month" name="period" /></label><label class="field">Origem<select name="origin"><option>Ambulatorial</option><option>Hospitalar</option><option>Regulação</option></select></label><label class="field">Caráter<select name="character"><option>Eletivo</option><option>Urgência</option></select></label></div></fieldset>
      <fieldset class="form-section"><legend>Justificativa clínica</legend><label class="field"><textarea name="justification" rows="7" required></textarea></label></fieldset>
      ${formFooter('Salvar e visualizar')}
    </form>
  </section>`;

const lmePage = (): string => `
  <section class="module-page">
    ${moduleHeader('Gerar LME', 'Organize a solicitação de medicamento especializado para conferência.', 'clipboard-file')}
    <form id="lme-form" class="document-form">
      ${patientFields()}
      <fieldset class="form-section"><legend>Diagnóstico e tratamento</legend><div class="form-grid columns-3"><label class="field span-2">Diagnóstico<input name="diagnosis" required /></label><label class="field">CID-10<input name="cid" required /></label><label class="field span-2">Medicamento e apresentação<input name="medication" required /></label><label class="field">Quantidade mensal<input name="monthlyQuantity" required /></label><label class="field">Dose por administração<input name="dose" required /></label><label class="field">Frequência<input name="frequency" required /></label><label class="field">Período solicitado<input name="period" placeholder="Ex.: 6 meses" /></label></div></fieldset>
      <fieldset class="form-section"><legend>Anamnese e justificativa</legend><label class="field"><textarea name="justification" rows="7" required placeholder="Critérios diagnósticos, tratamentos prévios e justificativa"></textarea></label></fieldset>
      ${formFooter('Salvar e visualizar')}
    </form>
  </section>`;

const prescriptionsPage = (): string => {
  const prescriptions = state.documents.filter((item) => item.kind === 'prescription');
  return `
    <section class="module-page">
      ${moduleHeader('Minhas Prescrições', 'Consulte, duplique, imprima ou exclua prescrições salvas neste navegador.', 'prescriptions', '<a class="primary-button" href="#/receita">' + icon('plus', 16) + ' Nova receita</a>')}
      <section class="history-panel">
        <div class="history-toolbar"><label class="search-box">${icon('search', 18)}<input data-history-search placeholder="Buscar por paciente ou medicamento" /></label><span>${prescriptions.length} registro(s)</span></div>
        <div class="document-list" data-history-list>
          ${prescriptions.length
            ? prescriptions.map(documentListItem).join('')
            : `<div class="empty-state">${icon('prescriptions', 42)}<h2>Nenhuma prescrição salva</h2><p>Crie uma receita para vê-la nesta lista.</p><a class="primary-button" href="#/receita">Criar receita</a></div>`}
        </div>
      </section>
    </section>`;
};

const documentListItem = (document: StoredDocument): string => {
  const medications = Array.isArray(document.payload.medications) ? (document.payload.medications as Array<Record<string, unknown>>) : [];
  const searchable = `${document.patientName} ${medications.map((item) => item.name ?? '').join(' ')}`.toLowerCase();
  return `<article class="document-list-item" data-searchable="${escapeHTML(searchable)}">
    <span class="document-kind-icon">${icon('file-plus', 21)}</span>
    <div class="document-list-copy"><strong>${escapeHTML(document.patientName || 'Paciente não informado')}</strong><p>${medications.length} medicamento(s) · ${escapeHTML(currentUnitName(document.unitId))}</p><small>${formatDateTime(document.createdAt)}</small></div>
    <div class="document-list-actions"><button type="button" title="Visualizar" data-preview-document="${document.id}">${icon('file-text', 17)}</button><button type="button" title="Duplicar" data-duplicate-document="${document.id}">${icon('copy', 17)}</button><button type="button" title="Excluir" data-delete-document="${document.id}">${icon('trash', 17)}</button></div>
  </article>`;
};

const conductsPage = (): string => `
  <section class="module-page">
    ${moduleHeader('Condutas do Plantão', 'Pesquise fichas locais ou importe seu catálogo clínico validado.', 'book-medical')}
    <section class="conducts-panel">
      <div class="conduct-search-row"><label class="large-search">${icon('search', 21)}<input data-conduct-search placeholder="Medicamento, condição, dose, diluição ou área clínica" autofocus /></label><button class="outline-button" type="button" data-import-conducts>${icon('upload', 17)} Importar JSON</button><input type="file" accept="application/json" data-conduct-file hidden /></div>
      <p class="clinical-warning">O projeto não incorpora banco farmacológico proprietário. As fichas abaixo são demonstrativas; importe conteúdo revisado e licenciado pela sua equipe.</p>
      <div class="conduct-layout">
        <aside class="area-filter"><button class="active" type="button" data-area="">Todas as áreas</button>${[...new Set(state.conducts.map((item) => item.area))].map((area) => `<button type="button" data-area="${escapeHTML(area)}">${escapeHTML(area)}</button>`).join('')}</aside>
        <div class="conduct-results" data-conduct-results>${renderConductResults(state.conducts)}</div>
      </div>
    </section>
  </section>`;

const renderConductResults = (items: AppState['conducts']): string =>
  items.length
    ? items
        .map(
          (item) => `<article class="conduct-result"><span>${icon('book-medical', 21)}</span><div><small>${escapeHTML(item.area)}</small><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.summary)}</p><em>${escapeHTML(item.sourceNote)}</em></div></article>`
        )
        .join('')
    : `<div class="empty-state compact">${icon('search', 36)}<h2>Nenhum resultado</h2><p>Tente outro termo ou importe um catálogo.</p></div>`;

const notFoundPage = (): string => `
  <section class="module-page"><div class="empty-state full-page">${icon('file-text', 48)}<h1>Página não encontrada</h1><p>O endereço solicitado não existe nesta reprodução.</p><a class="primary-button" href="#/dashboard">Voltar ao painel</a></div></section>`;

const render = (): void => {
  const path = route();
  let content: string;
  switch (path) {
    case '/dashboard':
      content = dashboardPage();
      break;
    case '/receita':
      content = prescriptionPage();
      break;
    case '/exame':
      content = examPage();
      break;
    case '/atestado':
      content = certificatePage();
      break;
    case '/ia':
      content = aiPage();
      break;
    case '/documentos':
      content = medicalDocumentsPage();
      break;
    case '/aih':
      content = aihPage();
      break;
    case '/apac':
      content = apacPage();
      break;
    case '/lme':
      content = lmePage();
      break;
    case '/prescricoes':
      content = prescriptionsPage();
      break;
    case '/condutas':
      content = conductsPage();
      break;
    default:
      content = notFoundPage();
  }
  app.innerHTML = shell(content);
  window.scrollTo({ top: 0, behavior: 'instant' });
};

const openModal = (html: string): void => {
  const root = document.querySelector<HTMLDivElement>('#modal-root');
  if (!root) return;
  root.innerHTML = `<div class="modal-backdrop" data-modal-backdrop>${html}</div>`;
  document.body.classList.add('modal-open');
  root.querySelector<HTMLElement>('input, textarea, select, button')?.focus();
};

const closeModal = (): void => {
  const root = document.querySelector<HTMLDivElement>('#modal-root');
  if (root) root.innerHTML = '';
  document.body.classList.remove('modal-open');
};

const toast = (message: string, tone: 'success' | 'error' = 'success'): void => {
  const region = document.querySelector<HTMLDivElement>('.toast-region');
  if (!region) return;
  const node = document.createElement('div');
  node.className = `toast ${tone}`;
  node.textContent = message;
  region.append(node);
  setTimeout(() => node.remove(), 3200);
};

const unitModal = (): string => `
  <section class="modal-card small-modal" role="dialog" aria-modal="true" aria-labelledby="unit-title">
    <button class="modal-close" type="button" data-close-modal>${icon('x', 19)}</button>
    <span class="modal-icon">${icon('building', 24)}</span><h2 id="unit-title">Trocar unidade</h2><p>Escolha a unidade que aparecerá nos novos documentos.</p>
    <div class="unit-list">${state.units
      .map(
        (unit) => `<label class="unit-option"><input type="radio" name="activeUnit" value="${unit.id}" ${unit.id === state.activeUnitId ? 'checked' : ''}/><span><strong>${escapeHTML(unit.name)}</strong><small>${escapeHTML(unit.cnes ? `CNES ${unit.cnes}` : 'Sem CNES informado')}</small></span></label>`
      )
      .join('')}</div>
    <form id="new-unit-form" class="inline-form"><label class="field">Nova unidade<input name="unitName" placeholder="Nome da unidade" required /></label><button class="small-button" type="submit">${icon('plus', 15)} Adicionar</button></form>
    <div class="modal-actions"><button class="outline-button" type="button" data-close-modal>Cancelar</button><button class="primary-button" type="button" data-confirm-unit>Usar unidade</button></div>
  </section>`;

const accountModal = (): string => `
  <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="account-title">
    <button class="modal-close" type="button" data-close-modal>${icon('x', 19)}</button>
    <span class="modal-icon">${icon('user', 24)}</span><h2 id="account-title">Dados da conta local</h2><p>Este formulário personaliza o protótipo. Não cria conta no servidor original.</p>
    <form id="account-form" class="document-form modal-form">
      <div class="form-grid columns-2"><label class="field">Nome completo<input name="name" required value="${escapeHTML(state.account.role === 'visitor' ? '' : state.account.name)}" /></label><label class="field">CRM<input name="crm" placeholder="12345/UF" value="${escapeHTML(state.account.crm)}" /></label><label class="field span-2">E-mail<input name="email" type="email" required value="${escapeHTML(state.account.email)}" /></label><label class="field span-2">Perfil<select name="role"><option value="doctor" ${state.account.role === 'doctor' ? 'selected' : ''}>Médico</option><option value="student" ${state.account.role === 'student' ? 'selected' : ''}>Acadêmico de medicina</option></select></label></div>
      <div class="modal-actions"><button class="outline-button" type="button" data-close-modal>Cancelar</button><button class="primary-button" type="submit">Salvar dados</button></div>
    </form>
  </section>`;

const settingsModal = (): string => `
  <section class="modal-card small-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
    <button class="modal-close" type="button" data-close-modal>${icon('x', 19)}</button>
    <span class="modal-icon">${icon('settings', 24)}</span><h2 id="settings-title">Configurações</h2>
    <form id="settings-form" class="document-form modal-form"><label class="field">Endpoint de IA<input name="aiEndpoint" type="url" placeholder="https://seu-backend/api/ai" value="${escapeHTML(localStorage.getItem('sismed-ai-endpoint') ?? '')}" /></label><label class="field">Nome exibido da aplicação<input name="appName" value="SisMed Médico" disabled /></label><div class="modal-actions"><button class="outline-button" type="button" data-close-modal>Cancelar</button><button class="primary-button" type="submit">Salvar</button></div></form>
  </section>`;

const tipModal = (): string => `
  <section class="modal-card small-modal" role="dialog" aria-modal="true" aria-labelledby="tip-title">
    <button class="modal-close" type="button" data-close-modal>${icon('x', 19)}</button><span class="modal-icon">${icon('lightbulb', 24)}</span><h2 id="tip-title">Dica do dia</h2><p>Use “Minhas Prescrições” para duplicar uma receita já revisada e ajustar apenas os campos necessários. O histórico deste protótipo fica no armazenamento local do navegador.</p><div class="modal-actions"><button class="primary-button" type="button" data-close-modal>Entendi</button></div>
  </section>`;

const currentUnitName = (unitId: string): string => state.units.find((unit) => unit.id === unitId)?.name ?? 'Unidade não informada';

const baseDocument = (kind: DocumentKind, title: string, patientName: string, payload: Record<string, unknown>): StoredDocument => {
  const now = new Date().toISOString();
  return {
    id: uid(kind),
    kind,
    title,
    patientName,
    createdAt: now,
    updatedAt: now,
    unitId: state.activeUnitId,
    status: 'ready',
    payload
  };
};

const patientPayload = (data: FormData): Record<string, string> => ({
  patientName: formValue(data, 'patientName'),
  birthDate: formValue(data, 'birthDate'),
  cpf: formValue(data, 'cpf'),
  cns: formValue(data, 'cns'),
  sex: formValue(data, 'sex')
});

const collectMedications = (form: HTMLFormElement): Array<Record<string, string>> =>
  Array.from(form.querySelectorAll<HTMLElement>('[data-medication-row]'))
    .map((row) => ({
      name: row.querySelector<HTMLInputElement>('[data-medication="name"]')?.value.trim() ?? '',
      route: row.querySelector<HTMLSelectElement>('[data-medication="route"]')?.value ?? '',
      quantity: row.querySelector<HTMLInputElement>('[data-medication="quantity"]')?.value.trim() ?? '',
      dosage: row.querySelector<HTMLInputElement>('[data-medication="dosage"]')?.value.trim() ?? '',
      duration: row.querySelector<HTMLInputElement>('[data-medication="duration"]')?.value.trim() ?? '',
      note: row.querySelector<HTMLInputElement>('[data-medication="note"]')?.value.trim() ?? ''
    }))
    .filter((item) => item.name);

const saveAndPreview = (document: StoredDocument): void => {
  upsertDocument(state, document);
  state.notifications.unshift({ id: uid('notification'), title: `${kindLabels[document.kind]} salvo`, description: `Documento de ${document.patientName || 'paciente não informado'} salvo neste navegador.`, createdAt: new Date().toISOString(), read: false });
  persistState(state);
  openDocumentPreview(document);
};

const handleDocumentForm = (form: HTMLFormElement): void => {
  const data = new FormData(form);
  const patient = patientPayload(data);
  let document: StoredDocument | null = null;

  switch (form.id) {
    case 'prescription-form': {
      const medications = collectMedications(form);
      if (!medications.length) {
        toast('Adicione pelo menos um medicamento.', 'error');
        return;
      }
      document = baseDocument('prescription', 'Receita médica', patient.patientName ?? '', { ...patient, medications, notes: formValue(data, 'notes') });
      break;
    }
    case 'exam-form': {
      const selected = checkedValues(form, 'exams');
      const custom = formValue(data, 'customExams').split('\n').map((item) => item.trim()).filter(Boolean);
      const exams = [...selected.filter((item) => item !== 'Outro'), ...custom];
      if (!exams.length) {
        toast('Selecione ou informe pelo menos um exame.', 'error');
        return;
      }
      document = baseDocument('exam', 'Solicitação de exames', patient.patientName ?? '', { ...patient, exams, indication: formValue(data, 'indication'), priority: formValue(data, 'priority') });
      break;
    }
    case 'certificate-form': {
      const cid = formValue(data, 'cid');
      const consent = data.get('cidConsent') === 'on';
      if (cid && !consent) {
        toast('Confirme a autorização para incluir o CID.', 'error');
        return;
      }
      document = baseDocument('certificate', 'Atestado médico', patient.patientName ?? '', { ...patient, startDate: formValue(data, 'startDate'), days: formValue(data, 'days'), purpose: formValue(data, 'purpose'), cid: consent ? cid : '', body: formValue(data, 'body') });
      break;
    }
    case 'medical-document-form':
      document = baseDocument('medical-document', formValue(data, 'documentType'), patient.patientName ?? '', { ...patient, documentType: formValue(data, 'documentType'), diagnosis: formValue(data, 'diagnosis'), cid: formValue(data, 'cid'), body: formValue(data, 'body') });
      break;
    case 'aih-form':
      document = baseDocument('aih', 'AIH', patient.patientName ?? '', { ...patient, procedure: formValue(data, 'procedure'), procedureCode: formValue(data, 'procedureCode'), cid: formValue(data, 'cid'), secondaryCid: formValue(data, 'secondaryCid'), character: formValue(data, 'character'), requestDate: formValue(data, 'requestDate'), days: formValue(data, 'days'), clinic: formValue(data, 'clinic'), signs: formValue(data, 'signs'), results: formValue(data, 'results') });
      break;
    case 'apac-form':
      document = baseDocument('apac', 'APAC', patient.patientName ?? '', { ...patient, procedure: formValue(data, 'procedure'), procedureCode: formValue(data, 'procedureCode'), cid: formValue(data, 'cid'), secondaryCid: formValue(data, 'secondaryCid'), quantity: formValue(data, 'quantity'), period: formValue(data, 'period'), origin: formValue(data, 'origin'), character: formValue(data, 'character'), justification: formValue(data, 'justification') });
      break;
    case 'lme-form':
      document = baseDocument('lme', 'LME', patient.patientName ?? '', { ...patient, diagnosis: formValue(data, 'diagnosis'), cid: formValue(data, 'cid'), medication: formValue(data, 'medication'), monthlyQuantity: formValue(data, 'monthlyQuantity'), dose: formValue(data, 'dose'), frequency: formValue(data, 'frequency'), period: formValue(data, 'period'), justification: formValue(data, 'justification') });
      break;
    default:
      break;
  }
  if (document) saveAndPreview(document);
};

const getPayloadString = (document: StoredDocument, key: string): string => String(document.payload[key] ?? '');

const patientBlock = (document: StoredDocument): string => `
  <div class="print-patient-grid">
    <p><span>Paciente</span><strong>${escapeHTML(document.patientName || 'Não informado')}</strong></p>
    ${getPayloadString(document, 'birthDate') ? `<p><span>Nascimento</span><strong>${escapeHTML(getPayloadString(document, 'birthDate').split('-').reverse().join('/'))}</strong></p>` : ''}
    ${getPayloadString(document, 'cpf') ? `<p><span>CPF</span><strong>${escapeHTML(getPayloadString(document, 'cpf'))}</strong></p>` : ''}
    ${getPayloadString(document, 'cns') ? `<p><span>CNS</span><strong>${escapeHTML(getPayloadString(document, 'cns'))}</strong></p>` : ''}
  </div>`;

const fieldLine = (label: string, value: unknown): string => value ? `<p class="print-field"><span>${label}</span>${escapeHTML(value)}</p>` : '';

const documentBodyHTML = (document: StoredDocument): string => {
  const p = document.payload;
  switch (document.kind) {
    case 'prescription': {
      const medications = Array.isArray(p.medications) ? (p.medications as Array<Record<string, unknown>>) : [];
      return `<h2>Prescrição</h2><ol class="prescription-items">${medications.map((med) => `<li><strong>${escapeHTML(med.name)}</strong><div>${escapeHTML(med.route)}${med.quantity ? ` · ${escapeHTML(med.quantity)}` : ''}</div><p>${escapeHTML(med.dosage)}</p>${med.duration ? `<small>Duração: ${escapeHTML(med.duration)}</small>` : ''}${med.note ? `<small>Observação: ${escapeHTML(med.note)}</small>` : ''}</li>`).join('')}</ol>${fieldLine('Orientações', p.notes)}`;
    }
    case 'exam': {
      const exams = Array.isArray(p.exams) ? p.exams : [];
      return `<h2>Exames solicitados</h2><ul class="exam-list">${exams.map((exam) => `<li>${escapeHTML(exam)}</li>`).join('')}</ul>${fieldLine('Prioridade', p.priority)}${fieldLine('Indicação clínica', p.indication)}`;
    }
    case 'certificate':
      return `<h2>Atestado médico</h2><p class="certificate-body">${escapeHTML(p.body)}</p>${fieldLine('Data inicial', p.startDate)}${fieldLine('Período', p.days ? `${p.days} dia(s)` : '')}${fieldLine('Finalidade', p.purpose)}${fieldLine('CID', p.cid)}`;
    case 'medical-document':
      return `<h2>${escapeHTML(p.documentType)}</h2>${fieldLine('Diagnóstico ou hipótese', p.diagnosis)}${fieldLine('CID', p.cid)}<p class="document-body-text">${escapeHTML(p.body)}</p>`;
    case 'aih':
      return `<h2>Dados da internação</h2>${fieldLine('Procedimento solicitado', p.procedure)}${fieldLine('Código do procedimento', p.procedureCode)}${fieldLine('CID principal', p.cid)}${fieldLine('CID secundário', p.secondaryCid)}${fieldLine('Caráter', p.character)}${fieldLine('Data da solicitação', p.requestDate)}${fieldLine('Diárias solicitadas', p.days)}${fieldLine('Clínica', p.clinic)}${fieldLine('Sinais, sintomas e condições', p.signs)}${fieldLine('Resultados diagnósticos', p.results)}`;
    case 'apac':
      return `<h2>Procedimento ambulatorial</h2>${fieldLine('Procedimento', p.procedure)}${fieldLine('Código SIGTAP', p.procedureCode)}${fieldLine('CID principal', p.cid)}${fieldLine('CID secundário', p.secondaryCid)}${fieldLine('Quantidade', p.quantity)}${fieldLine('Competência', p.period)}${fieldLine('Origem', p.origin)}${fieldLine('Caráter', p.character)}${fieldLine('Justificativa clínica', p.justification)}`;
    case 'lme':
      return `<h2>Solicitação de medicamento</h2>${fieldLine('Diagnóstico', p.diagnosis)}${fieldLine('CID-10', p.cid)}${fieldLine('Medicamento e apresentação', p.medication)}${fieldLine('Quantidade mensal', p.monthlyQuantity)}${fieldLine('Dose', p.dose)}${fieldLine('Frequência', p.frequency)}${fieldLine('Período', p.period)}${fieldLine('Anamnese e justificativa', p.justification)}`;
  }
};

const printableDocument = (document: StoredDocument): string => `
  <article class="print-document">
    <header class="print-header"><div><strong>SisMed Médico</strong><span>${escapeHTML(currentUnitName(document.unitId))}</span></div><div><strong>${escapeHTML(document.title)}</strong><span>${formatDate(document.createdAt)}</span></div></header>
    ${patientBlock(document)}
    <section class="print-content">${documentBodyHTML(document)}</section>
    <footer class="print-footer"><div class="signature-line"><span>Assinatura e carimbo do profissional</span></div><p>Documento gerado como apoio administrativo. Revisão e responsabilidade do profissional emissor.</p></footer>
  </article>`;

const documentText = (document: StoredDocument): string => {
  const container = globalThis.document.createElement('div');
  container.innerHTML = printableDocument(document);
  return container.innerText;
};

const openDocumentPreview = (document: StoredDocument): void => {
  openModal(`<section class="modal-card preview-modal" role="dialog" aria-modal="true" aria-labelledby="preview-title"><button class="modal-close" type="button" data-close-modal>${icon('x', 19)}</button><div class="preview-heading"><div><small>PRÉ-VISUALIZAÇÃO</small><h2 id="preview-title">${escapeHTML(document.title)}</h2></div><div class="preview-actions"><button class="outline-button" type="button" data-copy-document="${document.id}">${icon('copy', 16)} Copiar</button><button class="outline-button" type="button" data-download-document="${document.id}">${icon('download', 16)} JSON</button><button class="primary-button" type="button" data-print-document="${document.id}">${icon('printer', 16)} Imprimir / PDF</button></div></div><div class="preview-paper">${printableDocument(document)}</div></section>`);
};

const printDocument = (document: StoredDocument): void => {
  const printWindow = window.open('', '_blank', 'width=900,height=1000');
  if (!printWindow) {
    toast('O navegador bloqueou a janela de impressão.', 'error');
    return;
  }
  printWindow.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHTML(document.title)}</title><style>${printStyles()}</style></head><body>${printableDocument(document)}<script>window.onload=()=>{window.print();}</script></body></html>`);
  printWindow.document.close();
};

const printStyles = (): string => `
  *{box-sizing:border-box}body{margin:0;background:#fff;color:#101828;font-family:Arial,sans-serif}.print-document{width:210mm;min-height:297mm;margin:0 auto;padding:18mm 18mm 20mm}.print-header{display:flex;justify-content:space-between;gap:30px;border-bottom:3px solid #2563eb;padding-bottom:14px}.print-header div{display:grid;gap:4px}.print-header div:last-child{text-align:right}.print-header strong{font-size:17px}.print-header span{font-size:11px;color:#667085}.print-patient-grid{display:grid;grid-template-columns:2fr 1fr 1fr;gap:12px;padding:18px 0;border-bottom:1px solid #d0d5dd}.print-patient-grid p{margin:0;display:grid;gap:3px}.print-patient-grid span,.print-field span{font-size:9px;font-weight:700;text-transform:uppercase;color:#667085}.print-patient-grid strong{font-size:12px}.print-content{padding-top:20px}.print-content h2{font-size:16px;margin:0 0 16px}.prescription-items{padding-left:22px}.prescription-items li{padding:0 0 16px 5px;border-bottom:1px solid #e4e7ec;margin-bottom:14px}.prescription-items div,.prescription-items small{display:block;color:#667085;font-size:10px;margin-top:4px}.prescription-items p{font-size:12px;margin:8px 0}.exam-list{columns:2;padding-left:20px}.exam-list li{margin-bottom:9px;font-size:12px}.print-field{white-space:pre-wrap;line-height:1.55;font-size:12px;margin:14px 0}.print-field span{display:block;margin-bottom:4px}.certificate-body,.document-body-text{white-space:pre-wrap;line-height:1.75;font-size:13px}.print-footer{margin-top:48px;text-align:center}.signature-line{width:75mm;border-top:1px solid #344054;margin:70px auto 0;padding-top:7px;font-size:10px}.print-footer p{font-size:8px;color:#667085;margin-top:30px}@page{size:A4;margin:0}@media print{body{print-color-adjust:exact}.print-document{margin:0}}
`;

const localAiStructure = (text: string, format: string): Record<string, string> => {
  const normalized = text.trim().replace(/\n{3,}/g, '\n\n');
  const sentences = normalized.split(/(?<=[.!?])\s+/).filter(Boolean);
  const first = sentences.slice(0, 3).join(' ');
  if (format === 'soap') {
    return {
      'S — Subjetivo': normalized,
      'O — Objetivo': 'Preencher achados objetivos, sinais vitais e exame físico após revisão.',
      'A — Avaliação': 'Registrar hipóteses diagnósticas e CID somente após julgamento clínico.',
      'P — Plano': 'Registrar conduta, prescrições, exames, orientações e retorno após validação profissional.'
    };
  }
  if (format === 'summary') {
    return {
      'Resumo informado': first || normalized,
      'Pontos para conferência': 'Identificação mínima, alergias, antecedentes, sinais de alarme, exames, hipótese, conduta e orientações.'
    };
  }
  return {
    'Queixa e história': normalized,
    'Exame físico': 'Preencher os achados examinados. O modo local não inventa informações ausentes.',
    'Avaliação': 'Inserir hipótese diagnóstica e CID após revisão do profissional.',
    'Conduta': 'Inserir medidas, exames, prescrição e orientações após revisão do profissional.'
  };
};

const renderAiOutput = (sections: Record<string, string>, source: 'local' | 'api'): string => `
  <div class="ai-output-heading"><div><small>${source === 'api' ? 'RESPOSTA DO ENDPOINT' : 'ORGANIZAÇÃO LOCAL'}</small><h2>Conteúdo para revisão</h2></div><button class="outline-button" type="button" data-copy-ai>${icon('copy', 16)} Copiar tudo</button></div>
  <div class="ai-sections">${Object.entries(sections).map(([title, content]) => `<section><h3>${escapeHTML(title)}</h3><textarea rows="${Math.max(4, Math.ceil(content.length / 90))}">${escapeHTML(content)}</textarea></section>`).join('')}</div>
  <p class="clinical-warning">Não utilize sem revisão crítica. O sistema não substitui raciocínio clínico, protocolos ou responsabilidade profissional.</p>`;

const callAiEndpoint = async (endpoint: string, text: string, format: string): Promise<Record<string, string>> => {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, format })
  });
  if (!response.ok) throw new Error(`Endpoint respondeu ${response.status}`);
  const data: unknown = await response.json();
  if (!data || typeof data !== 'object') throw new Error('Resposta inválida');
  const candidate = data as { sections?: unknown; output?: unknown };
  const output = candidate.sections ?? candidate.output ?? data;
  if (!output || typeof output !== 'object' || Array.isArray(output)) throw new Error('A resposta deve ser um objeto de seções.');
  return Object.fromEntries(Object.entries(output as Record<string, unknown>).map(([key, value]) => [key, String(value)]));
};

const updateMedicationNumbers = (): void => {
  document.querySelectorAll<HTMLElement>('[data-medication-row]').forEach((row, index) => {
    const number = row.querySelector<HTMLElement>('.row-number');
    if (number) number.textContent = String(index + 1);
  });
};

const toggleDrawer = (): void => {
  const drawerNode = document.querySelector<HTMLElement>('[data-drawer]');
  const backdrop = document.querySelector<HTMLElement>('[data-drawer-backdrop]');
  if (!drawerNode || !backdrop) return;
  const isOpen = drawerNode.classList.toggle('open');
  backdrop.hidden = !isOpen;
};

const togglePopover = (target: 'notifications' | 'profile'): void => {
  const node = document.querySelector<HTMLElement>(`[data-${target}]`);
  if (!node) return;
  const hidden = !node.hidden;
  document.querySelectorAll<HTMLElement>('.popover').forEach((popover) => (popover.hidden = true));
  node.hidden = hidden;
};

document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const button = target.closest<HTMLElement>('button, a, [data-modal-backdrop]');
  if (!button) return;

  if (button.matches('[data-toggle-drawer], [data-drawer-backdrop]')) {
    toggleDrawer();
    return;
  }
  if (button.matches('[data-toggle-notifications]')) {
    togglePopover('notifications');
    return;
  }
  if (button.matches('[data-toggle-profile]')) {
    togglePopover('profile');
    return;
  }
  if (button.matches('[data-read-all]')) {
    state.notifications.forEach((item) => (item.read = true));
    persistState(state);
    render();
    return;
  }
  if (button.matches('[data-open-units]')) {
    openModal(unitModal());
    return;
  }
  if (button.matches('[data-open-account]')) {
    openModal(accountModal());
    return;
  }
  if (button.matches('[data-open-settings]')) {
    openModal(settingsModal());
    return;
  }
  if (button.matches('[data-show-tip]')) {
    openModal(tipModal());
    return;
  }
  if (button.matches('[data-support]')) {
    location.href = 'mailto:suporte@sismedonline.com.br?subject=Suporte%20SisMed';
    return;
  }
  if (button.matches('[data-close-modal]') || (button.matches('[data-modal-backdrop]') && event.target === button)) {
    closeModal();
    return;
  }
  if (button.matches('[data-confirm-unit]')) {
    const selected = document.querySelector<HTMLInputElement>('input[name="activeUnit"]:checked');
    if (selected) {
      state.activeUnitId = selected.value;
      persistState(state);
      closeModal();
      render();
      toast('Unidade ativa alterada.');
    }
    return;
  }
  if (button.matches('[data-reset-demo]')) {
    if (confirm('Excluir documentos, unidades e configurações salvos localmente?')) {
      state = resetState();
      localStorage.removeItem('sismed-ai-endpoint');
      render();
      toast('Dados locais removidos.');
    }
    return;
  }
  if (button.matches('[data-add-medication]')) {
    const list = document.querySelector<HTMLElement>('[data-medication-list]');
    if (list) list.insertAdjacentHTML('beforeend', medicationRow(list.children.length + 1));
    return;
  }
  if (button.matches('[data-remove-medication]')) {
    const rows = document.querySelectorAll('[data-medication-row]');
    if (rows.length <= 1) {
      toast('A receita precisa manter ao menos uma linha.', 'error');
      return;
    }
    button.closest('[data-medication-row]')?.remove();
    updateMedicationNumbers();
    return;
  }
  const previewId = button.dataset.previewDocument;
  if (previewId) {
    const item = state.documents.find((document) => document.id === previewId);
    if (item) openDocumentPreview(item);
    return;
  }
  const duplicateId = button.dataset.duplicateDocument;
  if (duplicateId) {
    const original = state.documents.find((document) => document.id === duplicateId);
    if (original) {
      const now = new Date().toISOString();
      const duplicate: StoredDocument = { ...original, id: uid(original.kind), createdAt: now, updatedAt: now, title: `${original.title} — cópia` };
      upsertDocument(state, duplicate);
      render();
      toast('Prescrição duplicada.');
    }
    return;
  }
  const deleteId = button.dataset.deleteDocument;
  if (deleteId) {
    if (confirm('Excluir este documento do armazenamento local?')) {
      removeDocument(state, deleteId);
      render();
      toast('Documento excluído.');
    }
    return;
  }
  const printId = button.dataset.printDocument;
  if (printId) {
    const item = state.documents.find((document) => document.id === printId);
    if (item) printDocument(item);
    return;
  }
  const copyId = button.dataset.copyDocument;
  if (copyId) {
    const item = state.documents.find((document) => document.id === copyId);
    if (item) void navigator.clipboard.writeText(documentText(item)).then(() => toast('Documento copiado.')).catch(() => toast('Não foi possível copiar.', 'error'));
    return;
  }
  const downloadId = button.dataset.downloadDocument;
  if (downloadId) {
    const item = state.documents.find((document) => document.id === downloadId);
    if (item) downloadText(`${item.kind}-${item.id}.json`, JSON.stringify(item, null, 2));
    return;
  }
  if (button.matches('[data-copy-ai]')) {
    const texts = Array.from(document.querySelectorAll<HTMLTextAreaElement>('[data-ai-output] textarea')).map((textarea) => `${textarea.previousElementSibling?.textContent ?? ''}\n${textarea.value}`).join('\n\n');
    void navigator.clipboard.writeText(texts).then(() => toast('Conteúdo copiado.')).catch(() => toast('Não foi possível copiar.', 'error'));
    return;
  }
  if (button.matches('[data-import-conducts]')) {
    document.querySelector<HTMLInputElement>('[data-conduct-file]')?.click();
    return;
  }
  const area = button.dataset.area;
  if (area !== undefined) {
    document.querySelectorAll<HTMLElement>('[data-area]').forEach((node) => node.classList.toggle('active', node === button));
    const search = document.querySelector<HTMLInputElement>('[data-conduct-search]')?.value.trim().toLowerCase() ?? '';
    const filtered = state.conducts.filter((item) => (!area || item.area === area) && (!search || `${item.title} ${item.area} ${item.keywords.join(' ')} ${item.summary}`.toLowerCase().includes(search)));
    const results = document.querySelector<HTMLElement>('[data-conduct-results]');
    if (results) results.innerHTML = renderConductResults(filtered);
  }
});

document.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.target as HTMLFormElement;
  if (['prescription-form', 'exam-form', 'certificate-form', 'medical-document-form', 'aih-form', 'apac-form', 'lme-form'].includes(form.id)) {
    if (form.reportValidity()) handleDocumentForm(form);
    return;
  }
  if (form.id === 'new-unit-form') {
    const data = new FormData(form);
    const name = formValue(data, 'unitName');
    if (!name) return;
    const unit = { id: uid('unit'), name: name.toUpperCase(), cnes: '', address: '' };
    state.units.push(unit);
    state.activeUnitId = unit.id;
    persistState(state);
    openModal(unitModal());
    toast('Unidade adicionada.');
    return;
  }
  if (form.id === 'account-form') {
    const data = new FormData(form);
    state.account = {
      name: formValue(data, 'name'),
      crm: formValue(data, 'crm'),
      email: formValue(data, 'email'),
      role: formValue(data, 'role') === 'student' ? 'student' : 'doctor'
    };
    persistState(state);
    closeModal();
    render();
    toast('Dados da conta salvos localmente.');
    return;
  }
  if (form.id === 'settings-form') {
    const data = new FormData(form);
    const endpoint = formValue(data, 'aiEndpoint');
    if (endpoint) localStorage.setItem('sismed-ai-endpoint', endpoint);
    else localStorage.removeItem('sismed-ai-endpoint');
    closeModal();
    toast('Configurações salvas.');
    return;
  }
  if (form.id === 'ai-form') {
    void (async () => {
      const data = new FormData(form);
      const text = formValue(data, 'clinicalText');
      const format = formValue(data, 'outputFormat');
      const endpoint = formValue(data, 'endpoint') || localStorage.getItem('sismed-ai-endpoint') || '';
      const output = document.querySelector<HTMLElement>('[data-ai-output]');
      if (!output) return;
      output.innerHTML = `<div class="loading-state"><span></span><p>Organizando conteúdo...</p></div>`;
      if (endpoint) localStorage.setItem('sismed-ai-endpoint', endpoint);
      try {
        const sections = endpoint ? await callAiEndpoint(endpoint, text, format) : localAiStructure(text, format);
        output.innerHTML = renderAiOutput(sections, endpoint ? 'api' : 'local');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha desconhecida';
        output.innerHTML = renderAiOutput(localAiStructure(text, format), 'local');
        toast(`Endpoint indisponível: ${message}. Usando modo local.`, 'error');
      }
    })();
  }
});

document.addEventListener('input', (event) => {
  const target = event.target as HTMLInputElement;
  if (target.matches('[data-history-search]')) {
    const query = target.value.trim().toLowerCase();
    document.querySelectorAll<HTMLElement>('.document-list-item').forEach((item) => {
      item.hidden = query ? !(item.dataset.searchable ?? '').includes(query) : false;
    });
  }
  if (target.matches('[data-conduct-search]')) {
    const activeArea = document.querySelector<HTMLElement>('[data-area].active')?.dataset.area ?? '';
    const query = target.value.trim().toLowerCase();
    const filtered = state.conducts.filter((item) => (!activeArea || item.area === activeArea) && (!query || `${item.title} ${item.area} ${item.keywords.join(' ')} ${item.summary}`.toLowerCase().includes(query)));
    const results = document.querySelector<HTMLElement>('[data-conduct-results]');
    if (results) results.innerHTML = renderConductResults(filtered);
  }
});

document.addEventListener('change', (event) => {
  const target = event.target as HTMLInputElement;
  if (target.matches('[data-conduct-file]') && target.files?.[0]) {
    const file = target.files[0];
    void file.text().then((text) => {
      try {
        const parsed: unknown = JSON.parse(text);
        if (!Array.isArray(parsed)) throw new Error('O arquivo precisa conter uma lista.');
        const validated = parsed.map((item, index) => {
          if (!item || typeof item !== 'object') throw new Error(`Item ${index + 1} inválido.`);
          const value = item as Record<string, unknown>;
          return {
            id: String(value.id ?? uid('conduct')),
            area: String(value.area ?? 'Sem área'),
            title: String(value.title ?? 'Sem título'),
            keywords: Array.isArray(value.keywords) ? value.keywords.map(String) : [],
            summary: String(value.summary ?? ''),
            sourceNote: String(value.sourceNote ?? 'Conteúdo importado pelo usuário.')
          };
        });
        state.conducts = validated;
        persistState(state);
        render();
        toast(`${validated.length} ficha(s) importada(s).`);
      } catch (error) {
        toast(error instanceof Error ? error.message : 'Arquivo inválido.', 'error');
      }
    });
  }
});

window.addEventListener('hashchange', render);
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeModal();
});

render();
