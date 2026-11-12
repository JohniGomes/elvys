/* ── UTILS ── */
const fmt = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function showToast(msg, ms = 2500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), ms);
}

function loading(on) {
  document.getElementById('loading').classList.toggle('hidden', !on);
}

/* ── CATEGORIES ── */
const Cats = {
  _get() {
    try { return JSON.parse(localStorage.getItem(CONFIG.CATS_KEY)) || {}; } catch { return {}; }
  },
  forEmpresa(empresa) {
    const saved = this._get()[empresa];
    return saved || (CONFIG.defaultCats[empresa] || ['Outros']);
  },
  add(empresa, cat) {
    const data = this._get();
    if (!data[empresa]) data[empresa] = this.forEmpresa(empresa);
    if (!data[empresa].includes(cat)) data[empresa].push(cat);
    localStorage.setItem(CONFIG.CATS_KEY, JSON.stringify(data));
  },
};

/* ── MODAL ── */
const Modal = {
  _item: null,
  _tipo: 'pagar',

  open(item) {
    this._item = item || null;
    this._tipo = item ? item.tipo : 'pagar';
    this._render();
    document.getElementById('modalBackdrop').classList.remove('hidden');
  },

  close() {
    document.getElementById('modalBackdrop').classList.add('hidden');
    this._item = null;
  },

  setTipo(t) {
    this._tipo = t;
    document.getElementById('btnTipoPagar').className   = t === 'pagar'   ? 'active-pagar'   : '';
    document.getElementById('btnTipoReceber').className = t === 'receber' ? 'active-receber' : '';
    this._updateCats();
    this._updateStatusOpts();
    document.getElementById('fParceiro').querySelector('label').textContent =
      t === 'pagar' ? 'Fornecedor' : 'Cliente';
  },

  _updateCats() {
    const emp = document.getElementById('fEmpresa').value || CONFIG.empresas[0];
    const sel = document.getElementById('fCategoria');
    const cur = sel.value;
    sel.innerHTML = Cats.forEmpresa(emp).map(c => `<option value="${c}">${c}</option>`).join('');
    if (cur) sel.value = cur;
  },

  _updateStatusOpts() {
    const sel = document.getElementById('fStatus');
    const opts = this._tipo === 'pagar'
      ? ['pendente','pago','atrasado','cancelado']
      : ['pendente','recebido','atrasado','cancelado'];
    sel.innerHTML = opts.map(s => `<option value="${s}">${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('');
  },

  _render() {
    const d = this._item;
    const t = this._tipo;
    const today = new Date().toISOString().split('T')[0];

    document.getElementById('modalTitle').textContent = d ? 'Editar Lançamento' : 'Novo Lançamento';

    document.getElementById('btnTipoPagar').className   = t === 'pagar'   ? 'active-pagar'   : '';
    document.getElementById('btnTipoReceber').className = t === 'receber' ? 'active-receber' : '';

    document.getElementById('fEmpresa').value    = d ? d.empresa    : CONFIG.empresas[0];
    document.getElementById('fDescricao').value  = d ? d.descricao  : '';
    document.getElementById('fParceiro').querySelector('input').value = d ? (d.parceiro || '') : '';
    document.getElementById('fValor').value      = d ? d.valor      : '';
    document.getElementById('fVencimento').value = d ? d.vencimento : today;
    document.getElementById('fPagamento').value  = d ? (d.pagamento || '') : '';
    document.getElementById('fObs').value        = d ? (d.obs || '') : '';

    this._updateCats();
    document.getElementById('fCategoria').value = d ? (d.categoria || '') : '';
    this._updateStatusOpts();
    document.getElementById('fStatus').value = d ? d.status : 'pendente';

    document.getElementById('btnDelete').style.display = d ? 'block' : 'none';
    document.getElementById('fParceiro').querySelector('label').textContent =
      t === 'pagar' ? 'Fornecedor' : 'Cliente';
  },

  async save() {
    const descricao = document.getElementById('fDescricao').value.trim();
    const valor     = parseFloat(document.getElementById('fValor').value);
    const vencimento = document.getElementById('fVencimento').value;
    if (!descricao || !valor || !vencimento) { showToast('Preencha Descrição, Valor e Vencimento.'); return; }

    const empresa   = document.getElementById('fEmpresa').value;
    const categoria = document.getElementById('fCategoria').value;
    const newCat    = document.getElementById('fCategoria').value;

    const d = {
      ...(this._item || {}),
      tipo:       this._tipo,
      empresa,
      categoria,
      descricao,
      parceiro:   document.getElementById('fParceiro').querySelector('input').value.trim(),
      valor,
      status:     document.getElementById('fStatus').value,
      vencimento,
      pagamento:  document.getElementById('fPagamento').value || null,
      obs:        document.getElementById('fObs').value.trim() || null,
    };

    if (categoria && !Cats.forEmpresa(empresa).includes(categoria)) {
      Cats.add(empresa, categoria);
    }

    loading(true);
    try {
      await Api.saveLancamento(d);
      showToast(this._item ? 'Atualizado!' : 'Lançamento salvo!');
      this.close();
      App.refresh();
    } catch (e) {
      showToast('Erro: ' + e.message, 4000);
    } finally {
      loading(false);
    }
  },

  async del() {
    if (!this._item) return;
    if (!confirm('Excluir este lançamento?')) return;
    loading(true);
    try {
      await Api.deleteLancamento(this._item.id);
      showToast('Excluído!');
      this.close();
      App.refresh();
    } catch (e) {
      showToast('Erro: ' + e.message, 4000);
    } finally {
      loading(false);
    }
  },
};

/* ── APP ── */
const App = {
  _view: 'home',  // 'home' | 'month'
  _ano: new Date().getFullYear(),
  _mes: null,
  _filtroEmpresa: '',
  _filtroTipo: '',
  _filtroStatus: '',
  _resumo: {},
  _lancamentos: [],

  async init() {
    await this.loadHome();
    document.getElementById('loading').classList.add('hidden');
  },

  async loadHome() {
    loading(true);
    try {
      this._resumo = await Api.getResumoAno(this._ano);
    } catch (e) {
      showToast('Erro ao carregar: ' + e.message, 4000);
    } finally {
      loading(false);
    }
    this._view = 'home';
    this._mes  = null;
    this._filtroEmpresa = '';
    this._filtroTipo = '';
    this._filtroStatus = '';
    this.render();
  },

  async loadMonth(mes) {
    this._mes  = mes;
    this._view = 'month';
    this._filtroEmpresa = '';
    this._filtroTipo = '';
    this._filtroStatus = '';
    await this.fetchMonth();
  },

  async fetchMonth() {
    loading(true);
    try {
      this._lancamentos = await Api.getLancamentos({
        ano: this._ano,
        mes: this._mes,
        empresa: this._filtroEmpresa || undefined,
        tipo:    this._filtroTipo    || undefined,
        status:  this._filtroStatus  || undefined,
      });
    } catch (e) {
      showToast('Erro: ' + e.message, 4000);
    } finally {
      loading(false);
    }
    this.render();
  },

  async refresh() {
    if (this._view === 'home') await this.loadHome();
    else await this.fetchMonth();
  },

  renderHome() {
    const r = this._resumo;
    const cards = MESES.map((nome, i) => {
      const m = i + 1;
      const d = r[m] || {};
      const pagar   = d.pagar   || 0;
      const receber = d.receber || 0;
      const pago    = d.pago    || 0;
      const recebido = d.recebido || 0;
      const pendentePagar   = pagar   - pago;
      const pendenteReceber = receber - recebido;
      const saldo = receber - pagar;
      const hoje = new Date();
      const isAtrasado = m < hoje.getMonth() + 1 && pendentePagar > 0 && hoje.getFullYear() === this._ano;
      return `
        <div class="month-card" onclick="App.loadMonth(${m})">
          ${isAtrasado ? '<span class="m-badge-atrasado">Atrasado</span>' : ''}
          <div class="m-name">${nome}</div>
          <div class="m-row"><span>A Pagar</span><span class="m-pagar">${fmt(pagar)}</span></div>
          <div class="m-row"><span>A Receber</span><span class="m-receber">${fmt(receber)}</span></div>
          <div class="m-row" style="border-top:1px solid var(--border);padding-top:8px;margin-top:4px;">
            <span>Saldo</span>
            <span class="${saldo >= 0 ? 'm-saldo-pos' : 'm-saldo-neg'}">${fmt(saldo)}</span>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="year-nav">
        <button onclick="App.changeYear(-1)">‹</button>
        <span>${this._ano}</span>
        <button onclick="App.changeYear(1)">›</button>
      </div>
      <div class="month-grid">${cards}</div>`;
  },

  renderMonth() {
    const nome  = MESES[this._mes - 1];
    const rows  = this._lancamentos;
    const total_pagar   = rows.filter(r => r.tipo === 'pagar').reduce((s,r) => s + (parseFloat(r.valor)||0), 0);
    const total_receber = rows.filter(r => r.tipo === 'receber').reduce((s,r) => s + (parseFloat(r.valor)||0), 0);
    const saldo = total_receber - total_pagar;

    const empresaOpts = CONFIG.empresas.map(e => `<option value="${e}">${e}</option>`).join('');
    const statusOpts  = ['pendente','pago','recebido','atrasado','cancelado']
      .map(s => `<option value="${s}">${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('');

    const items = rows.length ? rows.map(r => {
      const isAtrasado = r.status === 'atrasado';
      const statusLabel = r.status.charAt(0).toUpperCase() + r.status.slice(1);
      return `
        <div class="tx-item${isAtrasado ? ' atrasado' : ''}" onclick="Modal.open(${JSON.stringify(r).replace(/"/g,'&quot;')})">
          <span class="tx-tipo-dot ${r.tipo}"></span>
          <div>
            <div class="tx-desc">${r.descricao}</div>
            <div class="tx-meta">${r.empresa} · ${r.categoria || ''} ${r.parceiro ? '· ' + r.parceiro : ''} · Venc. ${r.vencimento}</div>
          </div>
          <span class="tx-valor ${r.tipo}">${r.tipo === 'pagar' ? '-' : '+'}${fmt(r.valor)}</span>
          <span class="tx-status-badge status-${r.status}">${statusLabel}</span>
        </div>`;
    }).join('') : '<div class="empty-msg">Nenhum lançamento neste mês.</div>';

    return `
      <div class="month-header">
        <button class="btn-back" onclick="App.loadHome()">← Voltar</button>
        <h2>${nome} ${this._ano}</h2>
      </div>
      <div class="kpi-row">
        <div class="kpi-card">
          <div class="kpi-label">A Pagar</div>
          <div class="kpi-val m-pagar">${fmt(total_pagar)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">A Receber</div>
          <div class="kpi-val m-receber">${fmt(total_receber)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Saldo</div>
          <div class="kpi-val ${saldo >= 0 ? 'm-saldo-pos' : 'm-saldo-neg'}">${fmt(saldo)}</div>
        </div>
      </div>
      <div class="filters">
        <select onchange="App.setFiltro('empresa',this.value)">
          <option value="">Todas empresas</option>
          ${empresaOpts}
        </select>
        <select onchange="App.setFiltro('tipo',this.value)">
          <option value="">Todos tipos</option>
          <option value="pagar">A Pagar</option>
          <option value="receber">A Receber</option>
        </select>
        <select onchange="App.setFiltro('status',this.value)">
          <option value="">Todos status</option>
          ${statusOpts}
        </select>
      </div>
      <div class="tx-list">${items}</div>`;
  },

  render() {
    const el = document.getElementById('content');
    el.innerHTML = this._view === 'home' ? this.renderHome() : this.renderMonth();
  },

  changeYear(d) {
    this._ano += d;
    this.loadHome();
  },

  setFiltro(key, val) {
    if (key === 'empresa') this._filtroEmpresa = val;
    if (key === 'tipo')    this._filtroTipo    = val;
    if (key === 'status')  this._filtroStatus  = val;
    this.fetchMonth();
  },
};

/* ── BOOT ── */
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
