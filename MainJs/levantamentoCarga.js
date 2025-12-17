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
  selSystem: document.getElementById('sel-system'),
  inputVoltage: document.getElementById('input-voltage'),
  inputPf: document.getElementById('input-pf'),
  btnAddLoad: document.getElementById('btn-add-load'),
  loadList: document.getElementById('load-list'),
  loadListEmpty: document.getElementById('load-list-empty'),
  totalVa: document.getElementById('total-va'),
  totalW: document.getElementById('total-w'),
  totalCurrent: document.getElementById('total-current'),
  mainBreaker: document.getElementById('main-breaker'),
  // Menu Mobile
  mobileMenuButton: document.getElementById('mobile-menu-button'),
  mobileMenu: document.getElementById('mobile-menu'),
  mobileMenuOverlay: document.getElementById('mobile-menu-overlay'),
  closeMobileMenu: document.getElementById('close-mobile-menu'),
};

const STANDARD_BREAKERS = [10, 16, 20, 25, 32, 35, 40, 50, 63, 70, 80, 90, 100, 125, 150, 175, 200, 225, 250];

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
    addLoadRow(); // Adiciona a primeira linha ao carregar
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

function calculateTotals() {
    const V = Number(el.inputVoltage.value) || 0;
    const pf = Number(el.inputPf.value) || 0.92;
    const system = el.selSystem.value;
    const loadRows = el.loadList.querySelectorAll('.load-row');
    
    let totalVA = 0;
    loadRows.forEach(row => {
        const vaInput = row.querySelector('input[type="number"]');
        totalVA += Number(vaInput.value) || 0;
    });

    const totalW = totalVA * pf;
    
    let totalCurrent = 0;
    if (V > 0 && totalVA > 0) {
        if (system === 'three') {
            totalCurrent = totalVA / (V * Math.sqrt(3));
        } else { // Monofásico e Bifásico
            totalCurrent = totalVA / V;
        }
    }

    const suggestedBreaker = STANDARD_BREAKERS.find(b => b >= totalCurrent) || STANDARD_BREAKERS[STANDARD_BREAKERS.length - 1];

    el.totalVa.textContent = `${totalVA.toFixed(0)} VA`;
    el.totalW.textContent = `${totalW.toFixed(0)} W`;
    el.totalCurrent.textContent = `${totalCurrent.toFixed(2)} A`;
    el.mainBreaker.textContent = totalCurrent > 0 ? `${suggestedBreaker} A` : '-- A';
    
    el.loadListEmpty.classList.toggle('hidden', loadRows.length > 0);
}

function addLoadRow() {
    const rowId = `row-${Date.now()}`;
    const div = document.createElement('div');
    div.className = 'load-row grid grid-cols-[1fr,150px,auto] gap-2 items-center';
    div.id = rowId;
    div.innerHTML = `
        <input type="text" placeholder="Descrição da Carga (ex: Chuveiro)" class="w-full border rounded px-3 py-2 text-sm">
        <input type="number" placeholder="Potência (VA)" class="w-full border rounded px-3 py-2 text-sm">
        <button class="text-red-500 hover:text-red-700 p-2" onclick="document.getElementById('${rowId}').remove(); calculateTotals();">&times;</button>
    `;
    el.loadList.appendChild(div);
    calculateTotals();
}

el.btnAddLoad.addEventListener('click', addLoadRow);

[el.selSystem, el.inputVoltage, el.inputPf].forEach(input => {
    input.addEventListener('change', calculateTotals);
});

el.loadList.addEventListener('input', (e) => {
    if (e.target.tagName === 'INPUT') {
        calculateTotals();
    }
});

el.btnLogout.addEventListener('click', signOut);

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