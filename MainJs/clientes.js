const SUPABASE_URL = 'https://mnehllsfvhmdqxdxyqle.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uZWhsbHNmdmhtZHF4ZHh5cWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MzM3NTksImV4cCI6MjA3MjQwOTc1OX0.DVxpiIVVHqiSKZfZYJ8mXsoy3gMaOxI3O4N4fa5G-Xc';

const createClient = (window.supabase && window.supabase.createClient) ? window.supabase.createClient : (window.supabaseJs && window.supabaseJs.createClient) ? window.supabaseJs.createClient : null;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const el = {
  statusText: document.getElementById('status-text'),
  userInfo: document.getElementById('user-info'),
  authCta: document.getElementById('auth-cta'),
  btnLogout: document.getElementById('btn-logout'),
  locked: document.getElementById('locked'),
  app: document.getElementById('app'),
  // Elementos da página de clientes
  addClientBtn: document.getElementById('add-client-btn'),
  clientModal: document.getElementById('client-modal'),
  closeModalBtn: document.getElementById('close-modal-btn'),
  cancelModalBtn: document.getElementById('cancel-modal-btn'),
  addClientForm: document.getElementById('add-client-form'),
  clientsTableBody: document.getElementById('clients-table-body'),
  clientsEmpty: document.getElementById('clients-empty'),
  clientsLimitMsg: document.getElementById('clients-limit-msg'),
  // Menu Mobile
  mobileMenuButton: document.getElementById('mobile-menu-button'),
  mobileMenu: document.getElementById('mobile-menu'),
  mobileMenuOverlay: document.getElementById('mobile-menu-overlay'),
  closeMobileMenu: document.getElementById('close-mobile-menu'),
};

let currentUser = null;
const CLIENT_LIMIT = 10;

function toggleModal(show) {
  el.clientModal.classList.toggle('hidden', !show);
}

async function loadClients() {
  if (!currentUser) return;

  try {
    const { data, error, count } = await supabase
      .from('clients')
      .select('*', { count: 'exact' })
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    renderClients(data);
    checkClientLimit(count);

  } catch (err) {
    alert('Erro ao carregar clientes: ' + err.message);
  }
}

function renderClients(clients) {
  el.clientsTableBody.innerHTML = '';
  if (!clients || clients.length === 0) {
    el.clientsEmpty.classList.remove('hidden');
    return;
  }

  el.clientsEmpty.classList.add('hidden');
  clients.forEach(client => {
    const row = document.createElement('tr');
    row.className = 'bg-white border-b';
    row.innerHTML = `
      <th scope="row" class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">${client.name}</th>
      <td class="px-6 py-4">${client.contact || 'N/A'}</td>
      <td class="px-6 py-4 text-gray-500">${client.notes || 'N/A'}</td>
      <td class="px-6 py-4 text-right">
        <button class="delete-client-btn font-medium text-red-600 hover:underline" data-id="${client.id}">Excluir</button>
      </td>
    `;
    el.clientsTableBody.appendChild(row);
  });

  // Adiciona listeners para os botões de deletar
  document.querySelectorAll('.delete-client-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const clientId = e.target.dataset.id;
      if (confirm('Tem certeza que deseja excluir este cliente?')) {
        await deleteClient(clientId);
      }
    });
  });
}

async function handleAddClient(e) {
  e.preventDefault();
  if (!currentUser) return;

  const name = document.getElementById('client-name').value.trim();
  const contact = document.getElementById('client-contact').value.trim();
  const notes = document.getElementById('client-notes').value.trim();

  if (!name) {
    alert('O nome do cliente é obrigatório.');
    return;
  }

  try {
    const { error } = await supabase.from('clients').insert([{
      user_id: currentUser.id,
      name,
      contact,
      notes
    }]);

    if (error) throw error;

    el.addClientForm.reset();
    toggleModal(false);
    await loadClients();

  } catch (err) {
    alert('Erro ao salvar cliente: ' + err.message);
  }
}

async function deleteClient(clientId) {
  try {
    const { error } = await supabase.from('clients').delete().eq('id', clientId);
    if (error) throw error;
    await loadClients();
  } catch (err) {
    alert('Erro ao excluir cliente: ' + err.message);
  }
}

function checkClientLimit(count) {
  if (count >= CLIENT_LIMIT) {
    el.addClientBtn.disabled = true;
    el.clientsLimitMsg.classList.remove('hidden');
  } else {
    el.addClientBtn.disabled = false;
    el.clientsLimitMsg.classList.add('hidden');
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
    loadClients();
  } else {
    el.locked.classList.remove('hidden');
    el.app.classList.add('hidden');
    el.userInfo.classList.add('hidden');
    el.authCta.classList.remove('hidden');
    el.statusText.title = '';
    el.statusText.textContent = 'Deslogado';
    renderClients([]); // Limpa a tabela
    checkClientLimit(0); // Reseta o limite
  }
  // <-- FIM DA VALIDAÇÃO
}

async function signOut() {
  await supabase.auth.signOut();
}

// Event Listeners
el.btnLogout.addEventListener('click', signOut);
el.addClientBtn.addEventListener('click', () => toggleModal(true));
el.closeModalBtn.addEventListener('click', () => toggleModal(false));
el.cancelModalBtn.addEventListener('click', () => toggleModal(false));
el.addClientForm.addEventListener('submit', handleAddClient);

// Lógica do Menu Mobile
function toggleMobileMenu(show) {
  el.mobileMenu.classList.toggle('translate-x-full', !show);
  el.mobileMenuOverlay.classList.toggle('hidden', !show);
}

el.mobileMenuButton.addEventListener('click', () => toggleMobileMenu(true));
el.closeMobileMenu.addEventListener('click', () => toggleMobileMenu(false));
el.mobileMenuOverlay.addEventListener('click', () => toggleMobileMenu(false));


// Inicialização
supabase.auth.onAuthStateChange((event, session) => setLoggedState(session?.user ?? null));
(async function init() {
  const { data } = await supabase.auth.getUser();
  setLoggedState(data.user);
})();