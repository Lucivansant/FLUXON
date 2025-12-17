const SUPABASE_URL = 'https://mnehllsfvhmdqxdxyqle.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uZWhsbHNmdmhtZHF4ZHh5cWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MzM3NTksImV4cCI6MjA3MjQwOTc1OX0.DVxpiIVVHqiSKZfZYJ8mXsoy3gMaOxI3O4N4fa5G-Xc';

const createClient = (window.supabase && window.supabase.createClient) ? window.supabase.createClient : (window.supabaseJs && window.supabaseJs.createClient) ? window.supabaseJs.createClient : null;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let loads = []; // Array para armazenar as cargas

const el = {
  statusText: document.getElementById('status-text'),
  userInfo: document.getElementById('user-info'),
  authCta: document.getElementById('auth-cta'),
  btnLogout: document.getElementById('btn-logout'),
  locked: document.getElementById('locked'),
  app: document.getElementById('app'),
  // Elementos da página
  selSystem: document.getElementById('sel-system'),
  inputVoltage: document.getElementById('input-voltage'),
  inputPf: document.getElementById('input-pf'),
  btnAddLoad: document.getElementById('btn-add-load'),
  loadList: document.getElementById('load-list'),
  loadListEmpty: document.getElementById('load-list-empty'),
  // Resultados
  resultsArea: document.getElementById('results-area'),
  totalVa: document.getElementById('total-va'),
  totalW: document.getElementById('total-w'),
  totalCurrent: document.getElementById('total-current'),
  mainBreaker: document.getElementById('main-breaker'),
  btnSaveSurvey: document.getElementById('btn-save-survey'),
  // Levantamentos Salvos
  btnNewSurvey: document.getElementById('btn-new-survey'),
  savedSurveysList: document.getElementById('saved-surveys-list'),
  savedSurveysTbody: document.getElementById('saved-surveys-tbody'),
  savedSurveysEmpty: document.getElementById('saved-surveys-empty'),
  // Menu Mobile
  mobileMenuButton: document.getElementById('mobile-menu-button'),
  mobileMenu: document.getElementById('mobile-menu'),
  mobileMenuOverlay: document.getElementById('mobile-menu-overlay'),
  closeMobileMenu: document.getElementById('close-mobile-menu'),
};

const STANDARD_BREAKERS = [10, 16, 20, 25, 32, 40, 50, 63, 70, 80, 90, 100, 125, 150, 175, 200, 225, 250];
let currentSurveyId = null; // Armazena o ID do levantamento carregado

function calculateTotals() {
  const V = parseFloat(el.inputVoltage.value) || 0;
  if (V <= 0) {
    el.btnSaveSurvey.textContent = 'Salvar';
    el.btnSaveSurvey.disabled = true;
    return;
  }
  const pf = parseFloat(el.inputPf.value) || 1;
  const system = el.selSystem.value;

  let totalVA = 0;
  let totalW = 0;

  loads.forEach(load => {
    const power = load.power_va || 0;
    const qty = load.quantity || 0;
    const demandFactor = load.demand_factor || 1;
    totalVA += power * qty * demandFactor;
  });

  totalW = totalVA * pf;

  let totalCurrent = 0;
  if (V > 0) {
    if (system === 'three') {
      totalCurrent = totalVA / (V * Math.sqrt(3));
    } else { // Monofásico e Bifásico
      totalCurrent = totalVA / V;
    }
  }

  const suggestedBreaker = STANDARD_BREAKERS.find(b => b >= totalCurrent) || STANDARD_BREAKERS[STANDARD_BREAKERS.length - 1];

  // Renderiza os resultados
  el.totalVa.textContent = `${totalVA.toLocaleString('pt-BR')} VA`;
  el.totalW.textContent = `${totalW.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} W`;
  el.totalCurrent.textContent = `${totalCurrent.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} A`;
  el.mainBreaker.textContent = totalCurrent > 0 ? `${suggestedBreaker} A` : '-- A';

  el.btnSaveSurvey.disabled = loads.length === 0;
}

function renderLoads() {
  el.loadList.innerHTML = '';
  el.loadListEmpty.classList.toggle('hidden', loads.length > 0);

  if (loads.length > 0) {
    const header = `
      <div class="grid grid-cols-12 gap-2 text-xs font-bold text-gray-500 mb-1 px-2">
        <div class="col-span-5">Descrição</div>
        <div class="col-span-2 text-center">Qtde.</div>
        <div class="col-span-2 text-center">Potência (VA)</div>
        <div class="col-span-2 text-center">F. Demanda</div>
        <div class="col-span-1"></div>
      </div>
    `;
    el.loadList.insertAdjacentHTML('beforeend', header);
  }

  loads.forEach((load, index) => {
    const loadEl = document.createElement('div');
    loadEl.className = 'grid grid-cols-12 gap-2 items-center';
    loadEl.innerHTML = `
      <div class="col-span-5">
        <input type="text" value="${load.description}" data-index="${index}" data-field="description" class="w-full border rounded px-2 py-1.5 text-sm" placeholder="Ex: Chuveiro">
      </div>
      <div class="col-span-2">
        <input type="number" value="${load.quantity}" data-index="${index}" data-field="quantity" class="w-full border rounded px-2 py-1.5 text-sm text-center" min="1">
      </div>
      <div class="col-span-2">
        <input type="number" value="${load.power_va}" data-index="${index}" data-field="power_va" class="w-full border rounded px-2 py-1.5 text-sm text-center" placeholder="5500">
      </div>
      <div class="col-span-2">
        <input type="number" value="${load.demand_factor}" data-index="${index}" data-field="demand_factor" class="w-full border rounded px-2 py-1.5 text-sm text-center" step="0.1" min="0" max="1">
      </div>
      <div class="col-span-1 text-right">
        <button data-index="${index}" class="delete-load-btn text-red-500 hover:bg-red-100 p-1 rounded-full">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>
    `;
    el.loadList.appendChild(loadEl);
  });
  calculateTotals();
}

function addLoad() {
  loads.push({
    description: '',
    quantity: 1,
    power_va: 0,
    demand_factor: 1.0,
  });
  renderLoads();
}

function updateLoad(index, field, value) {
  if (loads[index]) {
    loads[index][field] = value;
    calculateTotals();
  }
}

function deleteLoad(index) {
  loads.splice(index, 1);
  renderLoads();
}

function newSurvey() {
  currentSurveyId = null;
  loads = [];
  // Reseta os campos para os valores padrão
  el.inputVoltage.value = 220;
  el.inputPf.value = 0.92;
  el.selSystem.value = 'single';
  renderLoads();
  alert('Formulário limpo. Pronto para um novo levantamento.');
}

async function saveSurvey() {
  if (!currentUser) {
    alert('Você precisa estar logado para salvar.');
    return;
  }
  if (loads.length === 0) {
    alert('Adicione pelo menos uma carga para salvar o levantamento.');
    return;
  }

  const title = currentSurveyId ? document.querySelector(`[data-id="${currentSurveyId}"] .survey-title`).textContent : prompt('Digite um título para este levantamento de carga:', 'Levantamento Residencial');
  if (!title && !currentSurveyId) return; // Usuário cancelou a criação de um novo

  el.btnSaveSurvey.disabled = true;
  el.btnSaveSurvey.textContent = currentSurveyId ? 'Atualizando...' : 'Salvando...';

  try {
    // 1. Coleta os dados principais e os resultados calculados
    const surveyData = {
      user_id: currentUser.id,
      title: title,
      system: el.selSystem.value,
      voltage: parseFloat(el.inputVoltage.value),
      power_factor: parseFloat(el.inputPf.value),
      total_va: parseFloat(el.totalVa.textContent.replace(/[^\d,]/g, '').replace(',', '.')),
      total_w: parseFloat(el.totalW.textContent.replace(/[^\d,]/g, '').replace(',', '.')),
      total_demand_current: parseFloat(el.totalCurrent.textContent.replace(',', '.')),
      suggested_breaker: parseInt(el.mainBreaker.textContent),
    };

    if (currentSurveyId) {
      // ATUALIZAR um levantamento existente
      const { error: updateError } = await supabase.from('load_surveys').update(surveyData).eq('id', currentSurveyId);
      if (updateError) throw updateError;

      // Deleta itens antigos e insere os novos
      await supabase.from('load_survey_items').delete().eq('survey_id', currentSurveyId);
      const itemsToInsert = loads.map(load => ({ ...load, survey_id: currentSurveyId, user_id: currentUser.id }));
      const { error: itemsError } = await supabase.from('load_survey_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      alert(`Levantamento "${title}" atualizado com sucesso!`);

    } else {
      // CRIAR um novo levantamento
      surveyData.title = title;
      const { data: newSurvey, error: surveyError } = await supabase.from('load_surveys').insert(surveyData).select().single();
      if (surveyError) throw surveyError;

      const itemsToInsert = loads.map(load => ({ ...load, survey_id: newSurvey.id, user_id: currentUser.id }));
      const { error: itemsError } = await supabase.from('load_survey_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      alert(`Levantamento "${title}" salvo com sucesso!`);
    }

    await loadSavedSurveys(); // Recarrega a lista

  } catch (error) {
    alert('Erro ao salvar o levantamento: ' + error.message);
  } finally {
    el.btnSaveSurvey.disabled = false;
    el.btnSaveSurvey.textContent = currentSurveyId ? 'Atualizar' : 'Salvar';
  }
}

async function loadSavedSurveys() {
  if (!currentUser) return;
  try {
    const { data, error } = await supabase
      .from('load_surveys')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    renderSavedSurveys(data);
  } catch (error) {
    console.error('Erro ao carregar levantamentos:', error);
    el.savedSurveysTbody.innerHTML = `<tr><td colspan="4" class="text-center text-red-500 p-4">Erro ao carregar dados.</td></tr>`;
  }
}

function renderSavedSurveys(surveys) {
  el.savedSurveysTbody.innerHTML = '';
  el.savedSurveysEmpty.classList.toggle('hidden', surveys.length > 0);

  surveys.forEach(survey => {
    const row = document.createElement('tr');
    row.className = 'bg-white border-b hover:bg-gray-50';
    row.dataset.id = survey.id;
    row.innerHTML = `
      <td class="px-4 py-3 font-medium text-gray-900 survey-title">${survey.title}</td>
      <td class="px-4 py-3 text-gray-500">${new Date(survey.created_at).toLocaleDateString('pt-BR')}</td>
      <td class="px-4 py-3 font-semibold">${survey.total_va.toLocaleString('pt-BR')} VA</td>
      <td class="px-4 py-3 text-right space-x-2">
        <button class="load-survey-btn text-sm font-medium text-indigo-600 hover:underline" data-id="${survey.id}">Carregar</button>
        <button class="delete-survey-btn text-sm font-medium text-red-600 hover:underline" data-id="${survey.id}">Excluir</button>
      </td>
    `;
    el.savedSurveysTbody.appendChild(row);
  });
}

async function loadSurveyIntoCalculator(surveyId) {
  try {
    const { data: surveyData, error: surveyError } = await supabase
      .from('load_surveys')
      .select('*')
      .eq('id', surveyId)
      .single();
    if (surveyError) throw surveyError;

    const { data: itemsData, error: itemsError } = await supabase
      .from('load_survey_items')
      .select('*')
      .eq('survey_id', surveyId);
    if (itemsError) throw itemsError;

    // Preenche o formulário
    el.selSystem.value = surveyData.system;
    el.inputVoltage.value = surveyData.voltage;
    el.inputPf.value = surveyData.power_factor;
    
    currentSurveyId = surveyId;
    loads = itemsData.map(({ id, survey_id, user_id, created_at, ...rest }) => rest); // Limpa os campos desnecessários
    
    renderLoads();
    el.btnSaveSurvey.textContent = 'Atualizar';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    alert(`Levantamento "${surveyData.title}" carregado.`);

  } catch (error) {
    alert('Erro ao carregar o levantamento: ' + error.message);
  }
}

async function deleteSavedSurvey(surveyId) {
  if (!confirm('Tem certeza que deseja excluir este levantamento? Esta ação não pode ser desfeita.')) {
    return;
  }

  try {
    const { error } = await supabase.from('load_surveys').delete().eq('id', surveyId);
    if (error) throw error;

    // Se o levantamento excluído era o que estava carregado, limpa o formulário
    if (currentSurveyId === surveyId) {
      newSurvey();
    }

    await loadSavedSurveys();
    alert('Levantamento excluído com sucesso.');
  } catch (error) {
    alert('Erro ao excluir: ' + error.message);
  }
}

function setLoggedState(user) {
  currentUser = user;
  // --> INÍCIO DA VALIDAÇÃO:
  // A variável 'user' contém as informações do usuário se ele estiver logado.
  // Se 'user' for nulo (ou seja, false), o usuário não está logado.
  if (user) {
    el.locked.classList.add('hidden');
    el.app.classList.remove('hidden');
    el.userInfo.classList.remove('hidden');
    el.authCta.classList.add('hidden');
    el.statusText.textContent = user.email.split('@')[0];
    el.statusText.title = user.email;
    renderLoads(); // Renderiza a lista inicial (vazia)
    loadSavedSurveys();
  } else {
    el.locked.classList.remove('hidden');
    el.app.classList.add('hidden');
    el.userInfo.classList.add('hidden');
    el.authCta.classList.remove('hidden');
    el.statusText.title = '';
    el.statusText.textContent = 'Deslogado';
  }
  // <-- FIM DA VALIDAÇÃO
}

async function signOut() {
  await supabase.auth.signOut();
}

// Lógica do Menu Mobile
function toggleMobileMenu(show) {
  el.mobileMenu.classList.toggle('translate-x-full', !show);
  el.mobileMenuOverlay.classList.toggle('hidden', !show);
}

// Event Listeners
el.btnLogout.addEventListener('click', signOut);
el.btnAddLoad.addEventListener('click', addLoad);
el.btnNewSurvey.addEventListener('click', newSurvey);
el.btnSaveSurvey.addEventListener('click', saveSurvey);

// Listeners para recalcular quando os parâmetros principais mudam
[el.selSystem, el.inputVoltage, el.inputPf].forEach(element => {
    element.addEventListener('change', calculateTotals);
});

// Listener de eventos para a lista de cargas (delegação de eventos)
el.loadList.addEventListener('input', (e) => {
  if (e.target.tagName === 'INPUT') {
    const index = e.target.dataset.index;
    const field = e.target.dataset.field;
    const value = e.target.type === 'number' ? parseFloat(e.target.value) : e.target.value;
    updateLoad(index, field, value);
  }
});

el.loadList.addEventListener('click', (e) => {
  if (e.target.closest('.delete-load-btn')) {
    const index = e.target.closest('.delete-load-btn').dataset.index;
    deleteLoad(index);
  }
});

el.savedSurveysList.addEventListener('click', (e) => {
  const loadBtn = e.target.closest('.load-survey-btn');
  const deleteBtn = e.target.closest('.delete-survey-btn');
  if (loadBtn) {
    loadSurveyIntoCalculator(loadBtn.dataset.id);
  }
  if (deleteBtn) {
    deleteSavedSurvey(deleteBtn.dataset.id);
  }
});

el.mobileMenuButton.addEventListener('click', () => toggleMobileMenu(true));
el.closeMobileMenu.addEventListener('click', () => toggleMobileMenu(false));
el.mobileMenuOverlay.addEventListener('click', () => toggleMobileMenu(false));

// Inicialização
supabase.auth.onAuthStateChange((event, session) => setLoggedState(session?.user ?? null));
(async function init() {
  const { data } = await supabase.auth.getUser();
  setLoggedState(data.user);
})();