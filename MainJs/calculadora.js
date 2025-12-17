
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
  selMaterial: document.getElementById('sel-material'),
  selCircuitType: document.getElementById('sel-circuit-type'),
  selMethod: document.getElementById('sel-method'),
  inputPower: document.getElementById('input-power'),
  inputLength: document.getElementById('input-length'),
  inputVd: document.getElementById('input-vd'),
  inputPf: document.getElementById('input-pf'),
  inputFct: document.getElementById('input-fct'),
  inputFca: document.getElementById('input-fca'),
  btnCalc: document.getElementById('btn-calc'),
  btnReset: document.getElementById('btn-reset'),
  resultArea: document.getElementById('result-area'),
  history: document.getElementById('history'),
  historyEmpty: document.getElementById('history-empty'),
  // Menu Mobile
  mobileMenuButton: document.getElementById('mobile-menu-button'),
  mobileMenu: document.getElementById('mobile-menu'),
  mobileMenuOverlay: document.getElementById('mobile-menu-overlay'),
  closeMobileMenu: document.getElementById('close-mobile-menu'),
};

const CALCULATION_LIMIT = 10; // Define o limite de cálculos salvos para o usuário

function showMsg(text, type='info', targetElement = null) {
    // This is a placeholder for a more robust notification system if needed
    if (type === 'error') {
        alert(`Erro: ${text}`);
    } else {
        // For success messages, we can perhaps show a subtle temporary message near the button
        console.log(`Info: ${text}`);
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
    loadHistory();
    checkCalculationLimit(0); // Inicializa o estado do botão (será atualizado por loadHistory)
  } else {
    el.locked.classList.remove('hidden');
    el.app.classList.add('hidden');
    el.userInfo.classList.add('hidden');
    el.authCta.classList.remove('hidden');
    el.statusText.title = '';
    el.statusText.textContent = 'Deslogado';
    el.resultArea.innerHTML = 'Resultados aparecerão aqui após clicar em "Calcular & Salvar".';
    el.btnCalc.disabled = false; // Garante que o botão não fique desativado para usuários deslogados
    el.history.innerHTML = '';
    el.historyEmpty.classList.remove('hidden');
  }
  // <-- FIM DA VALIDAÇÃO
}

async function signOut() {
  await supabase.auth.signOut();
}

function computeResult() {
  const V = Number(el.inputVoltage.value);
  const L = Number(el.inputLength.value);
  const vdP = Number(el.inputVd.value);
  const pf = Number(el.inputPf.value);
  const FCT = Number(el.inputFct.value);
  const FCA = Number(el.inputFca.value);
  const method = el.selMethod.value;

  if (!V || V <= 0) return { error: 'Tensão inválida' };
  if (!L || L <= 0) return { error: 'Comprimento inválido' };
  if (vdP <= 0) return { error: '% de queda de tensão inválido' };
  if (!pf || pf <= 0 || pf > 1) return { error: 'Fator de potência inválido (use 0 a 1)' };
  if (!FCT || FCT <= 0) return { error: 'Fator de Temperatura (FCT) inválido' };
  if (!FCA || FCA <= 0) return { error: 'Fator de Agrupamento (FCA) inválido' };

  let Ib = 0; // Corrente de Projeto
  const P = Number(el.inputPower.value);
  if (!P || P <= 0) return { error: 'Potência inválida' };
  
  const systemType = el.selSystem.value;
  if (systemType === 'three') {
    Ib = P / (Math.sqrt(3) * V * pf);
  } else { // Monofásico e Bifásico
    Ib = P / (V * pf);
  }
  
  // 1. CRITÉRIO DA CAPACIDADE DE CORRENTE
  const Iz = Ib / (FCT * FCA);
  const numConductors = (systemType === 'three') ? 3 : 2;
  const S_iz = findSectionByCurrent(Iz, method, numConductors, el.selMaterial.value);
  if (S_iz === null) {
    return { error: `Nenhum cabo padrão suporta a corrente corrigida (Iz = ${Iz.toFixed(2)} A) para o método ${method}. Verifique os parâmetros.` };
  }

  // 2. CRITÉRIO DA QUEDA DE TENSÃO
  const material = el.selMaterial.value;
  const rho = material === 'copper' ? 0.0225 : 0.036; // Ω·mm²/m
  const dV = (vdP / 100) * V;

  let S_vd = 0;
  if (systemType === 'three') S_vd = (Math.sqrt(3) * rho * L * Ib) / dV;
  else S_vd = (2 * rho * L * Ib) / dV;

  const S_vd_rounded = Number.isFinite(S_vd) ? Math.max(S_vd, 0.5) : null;

  // 3. COMPARAÇÃO E SUGESTÃO FINAL
  const standardSizes = [0.5,0.75,1,1.5,2.5,4,6,10,16,25,35,50,70,95,120,150,185,240,300];
  const S_vd_standard = standardSizes.find(s => s >= S_vd_rounded) || standardSizes[standardSizes.length - 1];
  const final_S_calculated = Math.max(S_vd_standard, S_iz);

  // 4. APLICAR MÍNIMO NORMATIVO
  const circuitType = el.selCircuitType.value;
  const minGauge = circuitType === 'lighting' ? 1.5 : 2.5;
  const final_S = Math.max(final_S_calculated, minGauge);

  // 5. SUGESTÃO DO DISJUNTOR (In)
  const Iz_final = getCableCapacity(final_S, method, numConductors, material) * FCT * FCA;
  const In = findBreaker(Ib, Iz_final, circuitType);

  // Encontra a queda de tensão real com o cabo escolhido
  let final_vd = 0;
  if (systemType === 'three') {
    final_vd = (Math.sqrt(3) * rho * L * Ib) / final_S;
  } else {
    final_vd = (2 * rho * L * Ib) / final_S;
  }
  const final_vd_percent = (final_vd / V) * 100;

  return {
    I: Number(Ib.toFixed(2)),
    Iz: Number(Iz.toFixed(2)),
    S_vd: S_vd_rounded ? Number(S_vd_rounded.toFixed(2)) : null,
    S_iz: S_iz,
    suggestion: final_S,
    Iz_final: Number(Iz_final.toFixed(2)),
    breaker: In,
    finalVdPercent: Number(final_vd_percent.toFixed(2)),
    material,
    voltage: V,
    length: L,
    vdPercent: vdP,
    system: systemType,
    circuitType: circuitType,
    notes: `Cabo sugerido é o maior valor entre: Queda de Tensão (${S_vd_standard}mm²), Capacidade de Corrente (${S_iz}mm²) e Seção Mínima Normativa (${minGauge}mm²).`
  };
}

async function saveCalculation(payload) {
  if (!currentUser) return showMsg('Usuário não autenticado.','error');

  const record = {
    user_id: currentUser.id,
    tipo_uso: payload.circuitType,
    tipo_circuito: payload.system,
    tensao: payload.voltage,
    potencia: payload.power || null,
    corrente: payload.I,
    comprimento: payload.length,
    material: payload.material,
    queda_tensao: payload.vdPercent,
    secao_minima: payload.S_vd,
    cabo_sugerido: String(payload.suggestion),
  };

  try {
    const { error } = await supabase.from('calculations').insert([record]);
    if (error) throw error;
    loadHistory();
  } catch (err) {
    console.error('save error', err);
    showMsg('Erro ao salvar cálculo: ' + (err.message || err), 'error');
  }
}

async function loadHistory() {
  if (!currentUser) return;
  try {
    const { data, error } = await supabase
      .from('calculations')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(100); // O limite é 10, mas podemos buscar mais para referência
    if (error) throw error;
    renderHistory(data || []);
    checkCalculationLimit(data ? data.length : 0); // Verifica o limite após carregar o histórico
  } catch (err) {
    console.error('load history err', err);
    showMsg('Erro ao carregar histórico.', 'error');
  }
}

async function deleteCalculation(id) {
  if (!currentUser) return;
  try {
    const { error } = await supabase.from('calculations').delete().eq('id', id);
    if (error) throw error;
    loadHistory();
  } catch (err) {
    console.error('delete err', err);
    showMsg('Erro ao remover cálculo.', 'error');
  }
}

function checkCalculationLimit(currentCount) {
  const limitMessage = `<div class="text-amber-600 font-semibold p-4 text-center">Você atingiu o limite de ${CALCULATION_LIMIT} cálculos salvos. Exclua um cálculo antigo para salvar um novo.</div>`;

  if (currentCount >= CALCULATION_LIMIT) {
    el.btnCalc.disabled = true;
    el.btnCalc.textContent = `Limite de ${CALCULATION_LIMIT} cálculos atingido`;
    // Só exibe a mensagem de limite se não houver um resultado de cálculo visível
    if (!el.resultArea.innerHTML.includes("Corrente de Projeto (Ib)")) {
        el.resultArea.innerHTML = limitMessage;
    }
  } else {
    el.btnCalc.disabled = false;
    el.btnCalc.textContent = 'Calcular & Salvar';
    if (el.resultArea.innerHTML === limitMessage) { // Se a mensagem de limite estava visível, remove-a
        el.resultArea.innerHTML = 'Resultados aparecerão aqui após clicar em "Calcular & Salvar".';
    }
  }
}

function renderHistory(items) {
  const container = el.history;
  container.innerHTML = '';
  if (!items || items.length === 0) {
    el.historyEmpty.classList.remove('hidden');
    return;
  }
  el.historyEmpty.classList.add('hidden');

  items.forEach(it => {
    const div = document.createElement('div');
    div.className = 'p-3 bg-white border rounded flex items-start justify-between gap-3 shadow-sm';
    div.innerHTML = `
      <div class="flex-1">
        <div class="text-xs text-gray-500">${new Date(it.created_at).toLocaleString('pt-BR')}</div>
        <div class="font-bold">${it.cabo_sugerido} mm² — ${it.tipo_uso === 'lighting' ? 'Ilum.' : 'Tomada'} — ${it.tensao} V</div>
        <div class="text-sm text-gray-500">I=${it.corrente} A • L=${it.comprimento} m • P=${it.potencia} W</div>
      </div>
      <div class="flex flex-col items-end gap-2">
        <button class="btn-delete text-xs text-red-600 px-2 py-1 border rounded hover:bg-red-50" data-id="${it.id}">Excluir</button>
      </div>
    `;
    container.appendChild(div);
  });

  container.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = btn.getAttribute('data-id');
      if (confirm('Remover este cálculo?')) deleteCalculation(id);
    });
  });
}

el.btnCalc.addEventListener('click', async () => {
  if (!currentUser) return showMsg('Faça login para calcular e salvar.', 'error');
  const result = computeResult();
  if (result.error) {
    el.resultArea.innerHTML = `<div class="text-red-600 font-semibold p-4 text-center">${result.error}</div>`;
    return;
  }

  const ib_check = result.I;
  const in_check = result.breaker;
  const iz_check = result.Iz_final;
  const check_ok = ib_check < in_check && in_check < iz_check;

  el.resultArea.innerHTML = `
    <div class="grid grid-cols-2 gap-4">
      <div>
        <div class="text-sm text-gray-600">Corrente de Projeto (Ib)</div>
        <div class="text-2xl font-bold text-indigo-600">${result.I} A</div>
      </div>
      <div>
        <div class="text-sm text-gray-600">Corrente Corrigida p/ Cabo (Iz)</div>
        <div class="text-lg font-bold">${result.Iz} A</div>
      </div>
    </div>

    <div class="mt-4 pt-3 border-t">
      ${result.suggestion > Math.max(result.S_iz, result.S_vd) ? 
        `<div class="p-2 mb-3 text-xs text-center rounded-lg bg-amber-100 text-amber-800 border border-amber-200">
          O cabo foi ajustado para a seção mínima de <strong>${result.suggestion.toString().replace('.',',')} mm²</strong> para circuitos de ${result.circuitType === 'lighting' ? 'iluminação' : 'tomadas'}.
         </div>` : ''
      }
      <div class="p-3 mb-3 rounded-lg text-center ${check_ok ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border-red-200'}">
        <div class="font-bold text-sm">${check_ok ? 'Coordenação OK: Ib < In < Iz' : 'Falha na Coordenação'}</div>
        <div class="text-xs">
          ${result.I}A &lt; ${result.breaker}A &lt; ${result.Iz_final}A
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4 items-center">
        <div>
          <div class="text-sm text-gray-600">Cabo Sugerido (Seção Comercial)</div>
          <div class="text-3xl font-extrabold text-indigo-700">${result.suggestion} mm²</div>
          <div class="text-sm text-gray-500">Capacidade Corrigida (Iz): ${result.Iz_final} A</div>
          <div class="text-sm text-gray-500">Queda de tensão final: ${result.finalVdPercent}%</div>
        </div>
        <div class="text-center bg-gray-100 p-3 rounded-lg">
          <div class="text-sm text-gray-600">Disjuntor Sugerido (In)</div>
          <div class="text-3xl font-extrabold">${result.breaker ? `${result.breaker} A` : 'N/A'}</div>
        </div>
      </div>
    </div>
    <div class="mt-4 text-xs text-gray-500">${result.notes}</div>
  `;

  result.power = Number(el.inputPower.value);
  await saveCalculation(result);
});

el.btnReset.addEventListener('click', () => {
  el.inputPower.value = 1000;
  el.inputLength.value = 30;
  el.inputVd.value = 3;
  el.inputPf.value = 0.92;
  el.inputFct.value = "1.00";
  el.inputFca.value = "1.00";
  el.selMethod.value = "B1";
  el.selCircuitType.value = "power";
  el.resultArea.innerHTML = 'Resultados aparecerão aqui após clicar em "Calcular & Salvar".';
});

const NBR5410_TABLE_36_CAPACITY = {
  '0.5':  [9, 8, 8, 7, 11, 9.5, 10, 9, 11.5, 10, null, null],
  '0.75': [11, 10, 10, 9, 13, 12, 12, 11, 14, 12.5, null, null],
  '1':    [13, 12, 12, 11, 15, 14, 14, 13, 16, 14.5, null, null],
  '1.5':  [17, 15, 15, 14, 19.5, 17.5, 18, 16, 21, 18, 20, 17],
  '2.5':  [23, 20, 21, 19, 27, 24, 25, 22, 28, 25, 27, 23],
  '4':    [31, 27, 28, 25, 36, 32, 33, 29, 38, 34, 36, 31],
  '6':    [40, 35, 36, 32, 46, 41, 42, 37, 49, 43, 46, 40],
  '10':   [55, 48, 50, 44, 63, 57, 58, 51, 68, 60, 63, 55],
  '16':   [73, 64, 68, 60, 85, 76, 78, 69, 91, 80, 83, 73],
  '25':   [96, 85, 89, 79, 112, 101, 101, 90, 119, 105, 108, 96],
  '35':   [119, 105, 110, 99, 139, 125, 125, 112, 147, 130, 132, 118],
  '50':   [147, 131, 134, 122, 171, 154, 154, 138, 181, 160, 158, 141],
  '70':   [186, 166, 171, 156, 217, 196, 194, 174, 228, 202, 197, 177],
  '95':   [224, 200, 207, 189, 262, 236, 232, 209, 275, 244, 233, 210],
  '120':  [259, 232, 239, 219, 304, 274, 267, 241, 318, 282, 266, 240],
  '150':  [296, 265, 275, 252, 351, 316, 306, 276, 366, 325, 300, 271],
  '185':  [337, 302, 314, 288, 404, 364, 349, 315, 421, 374, 338, 306],
  '240':  [396, 356, 370, 340, 477, 431, 408, 369, 497, 443, 390, 353],
  '300':  [455, 409, 426, 392, 552, 498, 467, 423, 574, 513, 442, 400],
};

const STANDARD_BREAKERS = [2, 4, 6, 10, 13, 16, 20, 25, 32, 35, 40, 50, 63, 70, 80, 90, 100, 125];

function findBreaker(Ib, Iz, circuitType) {
  const minPracticalBreaker = circuitType === 'lighting' ? 10 : 16;
  let suitableBreaker = STANDARD_BREAKERS.find(In => In >= Ib);

  if (suitableBreaker && suitableBreaker < minPracticalBreaker) {
    suitableBreaker = minPracticalBreaker;
  }

  if (!suitableBreaker) return null;

  if (suitableBreaker <= Iz) {
    return suitableBreaker;
  }
  return null;
}

const METHOD_TO_COLUMN_INDEX = {
  'A1': 0, 'A2': 2, 'B1': 4, 'B2': 6, 'C': 8, 'D': 10
};

function findSectionByCurrent(Iz, method, numConductors, material) {
  const columnIndexBase = METHOD_TO_COLUMN_INDEX[method];
  if (columnIndexBase === undefined) return null;

  const columnIndex = columnIndexBase + (numConductors === 3 ? 1 : 0);
  const aluminumFactor = material === 'aluminum' ? 0.78 : 1.0;

  for (const sectionStr in NBR5410_TABLE_36_CAPACITY) {
    const section = parseFloat(sectionStr);
    const capacities = NBR5410_TABLE_36_CAPACITY[sectionStr];
    const capacity = capacities[columnIndex];

    if (capacity === null || capacity === undefined) continue;

    const adjustedCapacity = capacity * aluminumFactor;

    if (adjustedCapacity >= Iz) {
      return section;
    }
  }
  return null;
}

function getCableCapacity(section, method, numConductors, material) {
  const sectionStr = String(section);
  if (!NBR5410_TABLE_36_CAPACITY[sectionStr]) return 0;

  const columnIndexBase = METHOD_TO_COLUMN_INDEX[method];
  if (columnIndexBase === undefined) return 0;

  const columnIndex = columnIndexBase + (numConductors === 3 ? 1 : 0);
  const baseCapacity = NBR5410_TABLE_36_CAPACITY[sectionStr][columnIndex];
  if (baseCapacity === null || baseCapacity === undefined) return 0;

  const aluminumFactor = material === 'aluminum' ? 0.78 : 1.0;
  return baseCapacity * aluminumFactor;
}

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
  let { data: { user } } = await supabase.auth.getUser();
  
  // Se não houver usuário logado, tenta um login anônimo
  if (!user) {
    const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();
    if (!anonError) user = anonData.user;
  }

  setLoggedState(user);
})();
