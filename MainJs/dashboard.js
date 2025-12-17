const SUPABASE_URL = 'https://mnehllsfvhmdqxdxyqle.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uZWhsbHNmdmhtZHF4ZHh5cWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MzM3NTksImV4cCI6MjA3MjQwOTc1OX0.DVxpiIVVHqiSKZfZYJ8mXsoy3gMaOxI3O4N4fa5G-Xc';

const createClient = (window.supabase && window.supabase.createClient) ? window.supabase.createClient : (window.supabaseJs && window.supabaseJs.createClient) ? window.supabaseJs.createClient : null;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;

const el = {
  statusText: document.getElementById('status-text'),
  userInfo: document.getElementById('user-info'),
  authCta: document.getElementById('auth-cta'),
  btnLogout: document.getElementById('btn-logout'),
  locked: document.getElementById('locked'),
  app: document.getElementById('app'),
  // Métricas
  totalClients: document.getElementById('metric-total-clients'),
  pendingQuotes: document.getElementById('metric-pending-quotes'),
  monthlyRevenue: document.getElementById('metric-monthly-revenue'),
  approvedProjects: document.getElementById('metric-approved-projects'),
  // Calendário
  projectsList: document.getElementById('projects-list'),
  calendarMonthYear: document.getElementById('calendar-month-year'),
  btnPrevMonth: document.getElementById('btn-prev-month'),
  btnNextMonth: document.getElementById('btn-next-month'),
  // Feedback
  feedbackForm: document.getElementById('feedback-form'),
  starRatingContainer: document.getElementById('star-rating'),
  ratingValueInput: document.getElementById('rating-value'),
  feedbackText: document.getElementById('feedback-text'),
  btnSendFeedback: document.getElementById('btn-send-feedback'),
  feedbackMsg: document.getElementById('feedback-msg'),
  // Menu Mobile
  mobileMenuButton: document.getElementById('mobile-menu-button'),
  mobileMenu: document.getElementById('mobile-menu'),
  mobileMenuOverlay: document.getElementById('mobile-menu-overlay'),
  closeMobileMenu: document.getElementById('close-mobile-menu'),
};

let displayedDate = new Date();

async function loadDashboardMetrics() {
  if (!currentUser) return;

  // 1. Total de Clientes
  const { count: clientCount, error: clientError } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true });
  if (!clientError) el.totalClients.textContent = clientCount;

  // 2. Orçamentos Pendentes
  const { count: pendingCount, error: pendingError } = await supabase
    .from('quotes')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'Pendente');
  if (!pendingError) el.pendingQuotes.textContent = pendingCount;

  // 3. Projetos Aprovados (em andamento)
  const { count: approvedCount, error: approvedError } = await supabase
    .from('quotes')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'Aprovado');
  if (!approvedError) el.approvedProjects.textContent = approvedCount;

  // 4. Faturamento no Mês Atual (de orçamentos aprovados)
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

  const { data: revenueData, error: revenueError, count: approvedCountCurrentMonth } = await supabase
    .from('quotes')
    .select('total_value, service_duration_hours')
    .eq('status', 'Aprovado')
    .gte('created_at', firstDayOfMonth)
    .lte('created_at', lastDayOfMonth);

  if (!revenueError) {
    const totalRevenue = revenueData.reduce((sum, quote) => sum + quote.total_value, 0);
    el.monthlyRevenue.textContent = totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
}

async function renderProjectsList(date) {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-11
  const now = new Date();

  const monthYearString = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const capitalizedMonthYear = monthYearString.charAt(0).toUpperCase() + monthYearString.slice(1);

  el.calendarMonthYear.textContent = capitalizedMonthYear.toUpperCase();

  el.projectsList.innerHTML = '<div class="text-gray-500">Carregando projetos...</div>';

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  // Busca orçamentos aprovados para o mês exibido
  const { data: approvedQuotes, error } = await supabase
    .from('quotes')
    .select('service_date, total_value, title, service_duration_hours, clients ( name )')
    .eq('status', 'Aprovado')
    .gte('service_date', firstDayOfMonth.toISOString().split('T')[0])
    .lte('service_date', lastDayOfMonth.toISOString().split('T')[0])
    .order('service_date', { ascending: true });

  if (error) {
    el.projectsList.innerHTML = `<div class="text-red-500">Erro ao carregar projetos: ${error.message}</div>`;
    return;
  }

  if (!approvedQuotes || approvedQuotes.length === 0) {
    el.projectsList.innerHTML = '<div class="text-center text-gray-500 py-4">Nenhum projeto aprovado para este mês.</div>';
    return;
  }

  el.projectsList.innerHTML = '';
  approvedQuotes.forEach(quote => {
    const formattedDate = new Date(quote.service_date).toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' });
    const formattedValue = Number(quote.total_value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const projectHTML = `
      <div class="border-b p-3 flex justify-between items-center hover:bg-gray-50">
        <div>
          <span class="font-bold text-indigo-700 mr-2">[${formattedDate}]</span>
          <span class="font-semibold">${quote.title}</span>
          <span class="text-sm text-gray-500 ml-2">- ${quote.clients?.name || 'Cliente não informado'}</span>
        </div>
        <div class="font-bold text-green-600">${formattedValue}</div>
      </div>
    `;
    el.projectsList.insertAdjacentHTML('beforeend', projectHTML);
  });
}

function handleStarRating() {
  const stars = el.starRatingContainer.querySelectorAll('.star');
  
  stars.forEach(star => {
    star.addEventListener('click', () => {
      const value = parseInt(star.dataset.value, 10);
      el.ratingValueInput.value = value;
      updateStars(value);
    });

    star.addEventListener('mouseover', () => {
      const value = parseInt(star.dataset.value, 10);
      updateStars(value, true);
    });
  });

  el.starRatingContainer.addEventListener('mouseout', () => {
    const selectedValue = parseInt(el.ratingValueInput.value, 10);
    updateStars(selectedValue);
  });
}

function updateStars(value, isHover = false) {
  const stars = el.starRatingContainer.querySelectorAll('.star');
  stars.forEach(star => {
    if (parseInt(star.dataset.value, 10) <= value) {
      star.classList.add('text-amber-300');
      star.classList.remove('text-gray-300');
    } else {
      star.classList.remove('text-amber-300');
      star.classList.add('text-gray-300');
    }
  });
}

async function handleSendFeedback(e) {
  e.preventDefault();
  const rating = parseInt(el.ratingValueInput.value, 10);
  const feedback_text = el.feedbackText.value.trim();

  if (rating === 0) {
    showFeedbackMsg('Por favor, selecione uma nota de 1 a 5 estrelas.', true);
    return;
  }

  el.btnSendFeedback.disabled = true;
  el.btnSendFeedback.textContent = 'Enviando...';

  const { error } = await supabase.from('feedbacks').insert({ rating, feedback_text });

  el.btnSendFeedback.disabled = false;
  el.btnSendFeedback.textContent = 'Enviar Avaliação';

  if (error) showFeedbackMsg(`Erro ao enviar: ${error.message}`, true);
  else showFeedbackMsg('Obrigado pelo seu feedback!', false);
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
    loadDashboardMetrics();
    renderProjectsList(displayedDate);
    handleStarRating();
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

function showFeedbackMsg(text, isError) {
  el.feedbackMsg.textContent = text;
  el.feedbackMsg.className = 'p-3 rounded text-sm mb-4';
  el.feedbackMsg.classList.add(isError ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800');
  el.feedbackMsg.classList.remove('hidden');

  setTimeout(() => el.feedbackMsg.classList.add('hidden'), 5000);
}

async function signOut() {
  await supabase.auth.signOut();
}

// Event Listeners do Calendário
el.btnPrevMonth.addEventListener('click', () => {
  displayedDate.setMonth(displayedDate.getMonth() - 1);
  renderProjectsList(displayedDate);
});
el.btnNextMonth.addEventListener('click', () => {
  displayedDate.setMonth(displayedDate.getMonth() + 1);
  renderProjectsList(displayedDate);
});

el.btnLogout.addEventListener('click', signOut);
el.feedbackForm.addEventListener('submit', handleSendFeedback);

// Lógica do Menu Mobile
function toggleMobileMenu(show) {
  el.mobileMenu.classList.toggle('translate-x-full', !show);
  el.mobileMenuOverlay.classList.toggle('hidden', !show);
}

el.mobileMenuButton.addEventListener('click', () => toggleMobileMenu(true));
el.closeMobileMenu.addEventListener('click', () => toggleMobileMenu(false));
el.mobileMenuOverlay.addEventListener('click', () => toggleMobileMenu(false));


supabase.auth.onAuthStateChange((event, session) => setLoggedState(session?.user ?? null));
(async function init() {
  const { data } = await supabase.auth.getUser();
  setLoggedState(data.user);
})();