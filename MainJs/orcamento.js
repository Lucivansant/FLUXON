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
  // Elementos da página de orçamentos
  addQuoteBtn: document.getElementById('add-quote-btn'),
  quoteModal: document.getElementById('quote-modal'),
  closeModalBtn: document.getElementById('close-modal-btn'),
  cancelModalBtn: document.getElementById('cancel-modal-btn'),
  addQuoteForm: document.getElementById('add-quote-form'),
  quotesList: document.getElementById('quotes-list'),
  quotesEmpty: document.getElementById('quotes-empty'),
  quotesTableBody: document.getElementById('quotes-table-body'),
  quotesLimitMsg: document.getElementById('quotes-limit-msg'),
  // Construtor de Orçamento
  extraContent: document.getElementById('extra-content'),
  quoteBuilderList: document.getElementById('quote-builder-list'),
  quoteBuilderEmpty: document.getElementById('quote-builder-empty'),
  btnUseForQuote: document.getElementById('btn-use-for-quote'),
  quoteTitleInput: document.getElementById('quote-title'),
  quoteValueInput: document.getElementById('quote-value'),
  // Menu Mobile
  mobileMenuButton: document.getElementById('mobile-menu-button'),
  mobileMenu: document.getElementById('mobile-menu'),
  mobileMenuOverlay: document.getElementById('mobile-menu-overlay'),
  closeMobileMenu: document.getElementById('close-mobile-menu'),
};

const statusStyles = {
  'Pendente': { border: 'border-amber-500', bg: 'bg-amber-100', text: 'text-amber-800' },
  'Aprovado': { border: 'border-green-500', bg: 'bg-green-100', text: 'text-green-800' },
  'Recusado': { border: 'border-red-500', bg: 'bg-red-100', text: 'text-red-800' },
};

let quoteBuilderItems = [];
const QUOTE_LIMIT = 10;

function toggleModal(show) {
  el.quoteModal.classList.toggle('hidden', !show);
  if (show) loadClientsForDropdown();
}

async function loadClientsForDropdown() {
  const select = document.getElementById('quote-client');
  select.innerHTML = '<option value="">Carregando clientes...</option>';

  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name')
    .order('name');

  if (error) {
    select.innerHTML = '<option value="">Erro ao carregar</option>';
    return;
  }

  if (clients.length === 0) {
    select.innerHTML = '<option value="">Nenhum cliente cadastrado</option>';
    return;
  }

  select.innerHTML = '<option value="">Selecione um cliente</option>';
  clients.forEach(client => {
    select.innerHTML += `<option value="${client.id}">${client.name}</option>`;
  });

}

async function loadQuotes() {
  if (!currentUser) return;

  const { data: quotes, error } = await supabase
    .from('quotes')
    .select(`
      id, title, total_value, status, created_at, description,
      clients ( name )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }
  renderQuotes(quotes);
  checkQuoteLimit(quotes ? quotes.length : 0);
}

function renderQuotes(quotes = []) {
  el.quotesTableBody.innerHTML = '';
  el.quotesEmpty.classList.toggle('hidden', quotes.length > 0);

  quotes.forEach((quote) => {
    const style = statusStyles[quote.status] || statusStyles['Pendente'];
    const row = document.createElement('tr');
    row.className = 'bg-white border-b';
    row.innerHTML = `
      <td class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">${quote.clients?.name || 'N/A'}</td>
      <td class="px-6 py-4">${quote.title}</td>
      <td class="px-6 py-4 font-semibold">R$ ${Number(quote.total_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
      <td class="px-6 py-4">
        <span class="text-xs font-medium ${style.bg} ${style.text} px-2 py-1 rounded-full">${quote.status}</span>
      </td>
      <td class="px-6 py-4 text-right flex items-center justify-end gap-3">
          <select class="status-select text-xs border-gray-300 rounded" data-id="${quote.id}">
            <option value="Pendente" ${quote.status === 'Pendente' ? 'selected' : ''}>Pendente</option>
            <option value="Aprovado" ${quote.status === 'Aprovado' ? 'selected' : ''}>Aprovado</option>
            <option value="Recusado" ${quote.status === 'Recusado' ? 'selected' : ''}>Recusado</option>
          </select>
          <button class="generate-pdf-btn text-indigo-600 hover:text-indigo-800 p-1 rounded-full hover:bg-indigo-100" title="Gerar PDF do Orçamento" data-id="${quote.id}">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clip-rule="evenodd" /></svg>
          </button>
          <button class="delete-quote-btn text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100" title="Excluir Orçamento" data-id="${quote.id}">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
      </td>
    `;
    el.quotesTableBody.appendChild(row);
  });

  el.quotesTableBody.querySelectorAll('.status-select').forEach(select => {
    select.addEventListener('change', handleStatusChange);
  });

  el.quotesTableBody.querySelectorAll('.generate-pdf-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const quoteId = e.currentTarget.dataset.id;
      await generateQuotePDF(quoteId);
    });
  });

  el.quotesTableBody.querySelectorAll('.delete-quote-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const quoteId = e.currentTarget.dataset.id;
      if (confirm('Tem certeza que deseja excluir este orçamento? Esta ação não pode ser desfeita.')) {
        await deleteQuote(quoteId);
      }
    });
  });
}

async function handleAddQuote(e) {
  e.preventDefault();
  // Gera a descrição dinamicamente no momento do salvamento
  const descriptionText = generateQuoteCopyText();

  try {
    const formData = new FormData(el.addQuoteForm);
    const quoteData = {
      user_id: currentUser.id,
      client_id: formData.get('quote-client'),
      title: formData.get('quote-title'),
      total_value: formData.get('quote-value'),
      service_date: formData.get('quote-date'),
      service_duration_hours: formData.get('quote-duration'),
      description: descriptionText,
    };

    // 1. Insere o orçamento principal e obtém o ID dele
    const { data: newQuote, error: quoteError } = await supabase
      .from('quotes')
      .insert(quoteData)
      .select()
      .single();

    if (quoteError) throw quoteError;

    // 2. Prepara os itens do orçamento para inserção
    const itemsToInsert = quoteBuilderItems.map(item => ({
      quote_id: newQuote.id,
      user_id: currentUser.id,
      service_name: item.name,
      price: item.price,
    }));

    // 3. Insere todos os itens na tabela 'quote_items'
    const { error: itemsError } = await supabase.from('quote_items').insert(itemsToInsert);
    if (itemsError) throw itemsError;

    el.addQuoteForm.reset();
    toggleModal(false);
    // Limpa o construtor após o sucesso
    quoteBuilderItems = [];
    renderQuoteBuilder();

    await loadQuotes();
    
  } catch (error) {
    alert('Erro ao salvar orçamento: ' + error.message);
  }
}

async function handleStatusChange(e) {
  const quoteId = e.target.dataset.id;
  const newStatus = e.target.value;

  const { error } = await supabase
    .from('quotes')
    .update({ status: newStatus })
    .eq('id', quoteId);

  if (error) {
    alert('Erro ao atualizar status: ' + error.message);
  } else {
    await loadQuotes(); // Recarrega para mostrar as cores atualizadas
  }
}

async function deleteQuote(quoteId) {
  try {
    const { error } = await supabase.from('quotes').delete().eq('id', quoteId);
    if (error) throw error;
    await loadQuotes(); // Recarrega a lista após a exclusão
  } catch (err) {
    alert('Erro ao excluir orçamento: ' + err.message);
  }
}

async function generateQuotePDF(quoteId) {
  try {
    // 1. Buscar dados do orçamento e itens
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('*, clients(name)')
      .eq('id', quoteId)
      .single();

    if (quoteError) throw new Error(`Erro ao buscar orçamento: ${quoteError.message}`);

    const { data: items, error: itemsError } = await supabase
      .from('quote_items')
      .select('service_name, price')
      .eq('quote_id', quoteId);

    if (itemsError) throw new Error(`Erro ao buscar itens do orçamento: ${itemsError.message}`);

    // 2. Iniciar o documento PDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    let y = 0; // Posição vertical inicial

    const MARGIN = 15;
    const CONTENT_WIDTH = pageWidth - MARGIN * 2;

    // --- FUNÇÕES AUXILIARES PARA REPETIR EM PÁGINAS ---
    const drawHeader = () => {
      doc.setFillColor(248, 250, 252); // bg-slate-50
      doc.rect(0, 0, pageWidth, 40, 'F');
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(79, 70, 229); // text-indigo-600
      doc.text('ProjectGrid', MARGIN, 20);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139); // text-slate-500
      doc.text('Proposta de Serviços Elétricos', MARGIN, 26);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42); // text-slate-800
      doc.text('ORÇAMENTO', pageWidth - MARGIN, 20, { align: 'right' });
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Data: ${new Date(quote.created_at).toLocaleDateString('pt-BR')}`, pageWidth - MARGIN, 26, { align: 'right' });
    };

    const drawFooter = () => {
      const footerY = pageHeight - 20;
      doc.setDrawColor(226, 232, 240);
      doc.line(MARGIN, footerY, pageWidth - MARGIN, footerY);
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text('Obrigado pela sua confiança!', MARGIN, footerY + 8);
      doc.text(`Contato: ${currentUser.email}`, pageWidth - MARGIN, footerY + 8, { align: 'right' });
    };

    // 3. Montar o conteúdo do PDF
    drawHeader();

    y = 50; // Posição inicial abaixo do cabeçalho

    // --- INFORMAÇÕES DO CLIENTE ---
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('PARA:', MARGIN, y);
    doc.setFont('helvetica', 'normal');
    doc.text(quote.clients.name, MARGIN, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.text('PROJETO:', pageWidth / 2, y);
    doc.setFont('helvetica', 'normal');
    doc.text(quote.title, pageWidth / 2, y + 6);
    y += 15;
    doc.setDrawColor(226, 232, 240); // border-slate-200
    doc.line(MARGIN, y, pageWidth - MARGIN, y);
    y += 15;

    // --- COPY DA PROPOSTA (usando o campo 'description') ---
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('1. Proposta de Serviço', MARGIN, y);
    y += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const proposalText = doc.splitTextToSize(quote.description || 'Descrição detalhada dos serviços a serem executados.', CONTENT_WIDTH);
    doc.text(proposalText, MARGIN, y);
    y = doc.getTextDimensions(proposalText).h + y + 15;

    // --- TABELA DE SERVIÇOS ---
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('2. Detalhamento dos Serviços e Valores', MARGIN, y);
    y += 7;

    const tableBody = items.map((item, index) => [
      index + 1,
      item.service_name,
      Number(item.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    ]);

    doc.autoTable({
      startY: y,
      head: [['Item', 'Descrição do Serviço', 'Valor']],
      body: tableBody, // Corpo principal da tabela
      foot: [[ // Rodapé da tabela com o total
        { content: 'Valor Total (Mão de Obra):', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold', fontSize: 11 } },
        { content: Number(quote.total_value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), styles: { fontStyle: 'bold', fontSize: 11, halign: 'right' } }
      ]],
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 2: { halign: 'right' } },
      didDrawPage: (data) => { y = data.cursor.y; } // Atualiza o 'y' após a tabela
    });

    // --- COPY FINAL DE PROFISSIONALISMO ---
    y = doc.lastAutoTable.finalY + 20; // Pega a posição Y final da tabela

    const finalCopy = `Todos os nossos serviços são executados com máxima responsabilidade e profissionalismo, seguindo rigorosamente as diretrizes da norma NBR 5410 para instalações elétricas de baixa tensão. Nosso objetivo é garantir não apenas a funcionalidade, mas principalmente a segurança e a durabilidade da sua instalação elétrica. Investir em um serviço qualificado é a melhor forma de proteger seu patrimônio e garantir tranquilidade.`;
    const splitFinalCopy = doc.splitTextToSize(finalCopy, CONTENT_WIDTH);
    const finalCopyHeight = doc.getTextDimensions(splitFinalCopy).h;

    // Verifica se o texto final cabe na página atual
    if (y + finalCopyHeight + 30 > pageHeight) { // 30 é uma margem para o rodapé
      drawFooter(); // Desenha o rodapé na página atual
      doc.addPage();
      drawHeader(); // Desenha o cabeçalho na nova página
      y = 50; // Reseta o Y para o topo da nova página
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('3. Compromisso com a Qualidade e Segurança', MARGIN, y);
    y += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(splitFinalCopy, MARGIN, y);

    // --- RODAPÉ ---
    drawFooter();

    // 4. Salvar o PDF com nome mais amigável
    doc.save(`Orcamento_${quote.clients.name.replace(/\s/g, '_')}_${quote.id}.pdf`);
  } catch (error) {
    alert(`Não foi possível gerar o PDF: ${error.message}`);
  }
}

function checkQuoteLimit(count) {
  if (count >= QUOTE_LIMIT) {
    el.addQuoteBtn.disabled = true;
    el.quotesLimitMsg.classList.remove('hidden');
  } else {
    el.addQuoteBtn.disabled = false;
    el.quotesLimitMsg.classList.add('hidden');
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
    loadQuotes();
    el.extraContent.classList.remove('hidden');
  } else {
    el.locked.classList.remove('hidden');
    el.app.classList.add('hidden');
    el.userInfo.classList.add('hidden');
    el.authCta.classList.remove('hidden');
    el.statusText.title = '';
    el.statusText.textContent = 'Deslogado';
    renderQuotes([]);
    el.extraContent.classList.add('hidden');
  }
  // <-- FIM DA VALIDAÇÃO
}

async function signOut() {
  await supabase.auth.signOut();
}

function renderQuoteBuilder() {
  el.quoteBuilderList.innerHTML = '';
  if (quoteBuilderItems.length === 0) {
    el.quoteBuilderList.appendChild(el.quoteBuilderEmpty);
    el.quoteBuilderEmpty.classList.remove('hidden');
    el.btnUseForQuote.disabled = true;
  } else {
    el.quoteBuilderEmpty.classList.add('hidden');
    quoteBuilderItems.forEach((item, index) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'flex justify-between items-center p-2 bg-gray-50 border rounded';
      itemEl.innerHTML = `
        <span class="text-sm">${item.name}</span>
        <div class="flex items-center gap-4">
          <span class="font-semibold text-sm">${item.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          <button class="remove-builder-item text-red-500 hover:text-red-700" data-index="${index}">&times;</button>
        </div>
      `;
      el.quoteBuilderList.appendChild(itemEl);
    });
    el.btnUseForQuote.disabled = false;
  }

  // Adiciona listeners para os botões de remover
  document.querySelectorAll('.remove-builder-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.currentTarget.dataset.index, 10);
      quoteBuilderItems.splice(index, 1);
      renderQuoteBuilder();
    });
  });
}

function generateQuoteCopyText() {
  // Gera a "copy" para o cliente
  const serviceList = quoteBuilderItems.map(item => `- ${item.name}`).join('\n');
  const total = quoteBuilderItems.reduce((sum, item) => sum + item.price, 0);
  const formattedTotal = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  
  return `Olá! Agradeço pelo seu contato e pela oportunidade de apresentar esta proposta.
Detalhes dos serviços a serem realizados:\n${serviceList}\n\nO valor total para a execução destes serviços (mão de obra) é de ${formattedTotal}.\n\nEste orçamento foi elaborado visando a máxima segurança e eficiência para sua instalação, utilizando as melhores práticas do mercado e garantindo a conformidade com as normas técnicas.\n\nFico à sua inteira disposição para esclarecer qualquer dúvida ou ajustar a proposta conforme sua necessidade.`;
}

function addServiceToBuilder(name, price) {
  quoteBuilderItems.push({ name, price });
  renderQuoteBuilder();
}

function useBuilderForQuote() {
  if (quoteBuilderItems.length === 0) return;

  const total = quoteBuilderItems.reduce((sum, item) => sum + item.price, 0);
  const title = `Orçamento: ${quoteBuilderItems.map(i => i.name).slice(0, 2).join(', ')}${quoteBuilderItems.length > 2 ? '...' : ''}`;

  toggleModal(true);

  // Preenche o formulário do modal
  el.quoteTitleInput.value = title;
  el.quoteValueInput.value = total.toFixed(2);

  // Não limpa o construtor aqui, apenas ao salvar o orçamento.
  // quoteBuilderItems = [];
  // renderQuoteBuilder();
}

// Event Listeners
el.btnLogout.addEventListener('click', signOut);
el.addQuoteBtn.addEventListener('click', () => toggleModal(true));
el.closeModalBtn.addEventListener('click', () => toggleModal(false));
el.cancelModalBtn.addEventListener('click', () => toggleModal(false));
el.addQuoteForm.addEventListener('submit', handleAddQuote);

// Lógica do Menu Mobile
function toggleMobileMenu(show) {
  el.mobileMenu.classList.toggle('translate-x-full', !show);
  el.mobileMenuOverlay.classList.toggle('hidden', !show);
}

el.mobileMenuButton.addEventListener('click', () => toggleMobileMenu(true));
el.closeMobileMenu.addEventListener('click', () => toggleMobileMenu(false));
el.mobileMenuOverlay.addEventListener('click', () => toggleMobileMenu(false));


el.btnUseForQuote.addEventListener('click', useBuilderForQuote);

// Adiciona listeners para as linhas das tabelas de referência
document.querySelectorAll('.service-row').forEach(row => {
  row.addEventListener('click', () => {
    const name = row.dataset.service;
    const price = parseFloat(row.dataset.price);
    addServiceToBuilder(name, price);
  });
});

// Lógica do Accordion
document.querySelectorAll('.accordion-header').forEach(header => {
  header.addEventListener('click', () => {
    const content = header.nextElementSibling;
    const icon = header.querySelector('.accordion-icon');

    content.classList.toggle('hidden');
    icon.classList.toggle('rotate-180');

    // Opcional: Fechar outros accordions abertos
    // document.querySelectorAll('.accordion-content').forEach(c => { if (c !== content) c.classList.add('hidden'); });
    // document.querySelectorAll('.accordion-icon').forEach(i => { if (i !== icon) i.classList.remove('rotate-180'); });
  });
});

// Inicialização
supabase.auth.onAuthStateChange((event, session) => setLoggedState(session?.user ?? null));
(async function init() {
  const { data } = await supabase.auth.getUser();
  setLoggedState(data.user);
  renderQuoteBuilder(); // Inicializa o construtor vazio
})();