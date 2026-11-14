const fmt = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtK = v => Math.abs(v) >= 1000 ? (v / 1000).toFixed(1).replace('.', ',') + 'k' : String(Math.round(v));
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MES_CURTO = MESES.map(m => m.slice(0, 3));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hoje = () => new Date().toISOString().split('T')[0];
const num = v => parseFloat(v) || 0;
const fmtData = d => (d || '').split('-').reverse().join('/');

function showToast(msg, ms = 2500) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), ms);
}
function loading(on) { document.getElementById('loading').classList.toggle('hidden', !on); }

// pendente vencido vira atrasado automaticamente
function effStatus(r) {
  return (r.status === 'pendente' && r.vencimento < hoje()) ? 'atrasado' : r.status;
}
const isLiquidado = r => r.status === 'pago' || r.status === 'recebido';

const Cats = {
  cache: {},

  async load() {
    const { data, error } = await Api._db.from('categorias').select('empresa,nome').order('nome');
    if (error) { this.cache = {}; showToast('Rode o SQL das categorias no Supabase.', 4000); return; }
    if (!data.length) await this.seed();
    else this.fill(data);
  },

  fill(rows) {
    this.cache = {};
    rows.forEach(r => (this.cache[r.empresa] ||= []).push(r.nome));
  },

  // 1ª vez: leva as categorias do navegador (se houver) ou as padrão para o Supabase
  async seed() {
    let base = CONFIG.defaultCats;
    try { const l = JSON.parse(localStorage.getItem(CONFIG.CATS_KEY)); if (l) base = { ...base, ...l }; } catch (_) {}
    const rows = Object.entries(base).flatMap(([empresa, nomes]) => nomes.map(nome => ({ empresa, nome })));
    const { error } = await Api._db.from('categorias').insert(rows);
    if (!error) { this.fill(rows); localStorage.removeItem(CONFIG.CATS_KEY); }
  },

  forEmpresa(e) { return this.cache[e] || []; },

  async add(e, cat) {
    if (this.forEmpresa(e).includes(cat)) return;
    const { error } = await Api._db.from('categorias').insert({ empresa: e, nome: cat });
    if (error) return showToast('Erro: ' + error.message, 4000);
    (this.cache[e] ||= []).push(cat);
  },

  async remove(e, cat) {
    const { error } = await Api._db.from('categorias').delete().eq('empresa', e).eq('nome', cat);
    if (error) return showToast('Erro: ' + error.message, 4000);
    this.cache[e] = this.forEmpresa(e).filter(c => c !== cat);
  },
};

const Modal = {
  _item: null, _tipo: 'pagar',

  open(item) { this._item = item || null; this._tipo = item ? item.tipo : 'pagar'; this._render(); document.getElementById('modalBackdrop').classList.remove('hidden'); },
  openById(id) { this.open(App.rows.find(r => r.id === id)); },
  close() { document.getElementById('modalBackdrop').classList.add('hidden'); this._item = null; },

  setTipo(t) {
    this._tipo = t;
    document.getElementById('btnTipoPagar').className = t === 'pagar' ? 'active-pagar' : '';
    document.getElementById('btnTipoReceber').className = t === 'receber' ? 'active-receber' : '';
    document.getElementById('lblParceiro').textContent = t === 'pagar' ? 'Fornecedor' : 'Cliente';
    this._updateStatusOpts();
  },

  _updateCats(sel) {
    const emp = document.getElementById('fEmpresa').value;
    const el = document.getElementById('fCategoria');
    el.innerHTML = Cats.forEmpresa(emp).map(c => `<option>${esc(c)}</option>`).join('');
    if (sel) el.value = sel;
  },

  async novaCat() {
    const nome = (prompt('Nome da nova categoria:') || '').trim();
    if (!nome) return;
    const emp = document.getElementById('fEmpresa').value;
    await Cats.add(emp, nome);
    this._updateCats(nome);
  },

  async removerCat() {
    const emp = document.getElementById('fEmpresa').value;
    const cat = document.getElementById('fCategoria').value;
    if (!cat) return showToast('Nenhuma categoria selecionada.');
    if (!confirm(`Excluir a categoria "${cat}" de ${emp}? Lançamentos já feitos não são alterados.`)) return;
    await Cats.remove(emp, cat);
    this._updateCats();
    showToast('Categoria excluída.');
  },

  _updateStatusOpts(sel) {
    const opts = this._tipo === 'pagar' ? ['pendente', 'pago', 'cancelado'] : ['pendente', 'recebido', 'cancelado'];
    const el = document.getElementById('fStatus');
    el.innerHTML = opts.map(s => `<option value="${s}">${s[0].toUpperCase() + s.slice(1)}</option>`).join('');
    if (sel && opts.includes(sel)) el.value = sel;
  },

  _render() {
    const d = this._item;
    document.getElementById('modalTitle').textContent = d ? 'Editar Lançamento' : 'Novo Lançamento';
    document.getElementById('fEmpresa').innerHTML = CONFIG.empresas.map(e => `<option>${e}</option>`).join('');
    document.getElementById('fEmpresa').value = d ? d.empresa : (App.f.empresa || CONFIG.empresas[0]);
    this._updateCats(d && d.categoria);
    this.setTipo(this._tipo);
    this._updateStatusOpts(d ? d.status : 'pendente');
    document.getElementById('fDescricao').value = d ? d.descricao : '';
    document.getElementById('fParceiro').value = d ? (d.parceiro || '') : '';
    document.getElementById('fValor').value = d ? d.valor : '';
    document.getElementById('fVencimento').value = d ? d.vencimento : hoje();
    document.getElementById('fPagamento').value = d ? (d.pagamento || '') : '';
    document.getElementById('fObs').value = d ? (d.obs || '') : '';
    document.getElementById('btnDelete').style.display = d ? 'block' : 'none';
    document.getElementById('gParcelas').style.display = d ? 'none' : 'block';
    document.getElementById('fParcelas').value = 1;
  },

  async save() {
    const descricao = document.getElementById('fDescricao').value.trim();
    const valor = parseFloat(document.getElementById('fValor').value);
    const vencimento = document.getElementById('fVencimento').value;
    if (!descricao || !valor || !vencimento) return showToast('Preencha Descrição, Valor e Vencimento.');
    const d = {
      ...(this._item || {}),
      tipo: this._tipo,
      empresa: document.getElementById('fEmpresa').value,
      categoria: document.getElementById('fCategoria').value,
      descricao, valor, vencimento,
      parceiro: document.getElementById('fParceiro').value.trim(),
      status: document.getElementById('fStatus').value,
      pagamento: document.getElementById('fPagamento').value || null,
      obs: document.getElementById('fObs').value.trim() || null,
    };
    const n = this._item ? 1 : Math.max(1, Math.min(360, parseInt(document.getElementById('fParcelas').value) || 1));
    loading(true);
    try {
      if (n > 1) {
        const [y, m, dia] = vencimento.split('-').map(Number);
        const lista = Array.from({ length: n }, (_, i) => {
          const mm = m - 1 + i, ano = y + Math.floor(mm / 12), mes = mm % 12;
          const ult = new Date(ano, mes + 1, 0).getDate();
          return {
            ...d, id: crypto.randomUUID(), created_at: hoje(),
            descricao: `${descricao} (${i + 1}/${n})`,
            vencimento: `${ano}-${String(mes + 1).padStart(2, '0')}-${String(Math.min(dia, ult)).padStart(2, '0')}`,
            status: i === 0 ? d.status : 'pendente',
            pagamento: i === 0 ? d.pagamento : null,
          };
        });
        await Api.saveLancamentos(lista);
      } else await Api.saveLancamento(d);
      showToast(n > 1 ? `${n} parcelas lançadas!` : this._item ? 'Atualizado!' : 'Lançamento salvo!');
      this.close();
      await App.load();
    } catch (e) { showToast('Erro: ' + e.message, 4000); }
    finally { loading(false); }
  },

  async del() {
    if (!this._item || !confirm('Excluir este lançamento?')) return;
    loading(true);
    try { await Api.deleteLancamento(this._item.id); showToast('Excluído!'); this.close(); await App.load(); }
    catch (e) { showToast('Erro: ' + e.message, 4000); }
    finally { loading(false); }
  },
};

const App = {
  view: 'dash',
  rows: [],
  f: { ano: String(new Date().getFullYear()), mes: '', empresa: '', tipo: '', status: '' },
  charts: [],

  async init() {
    await Cats.load();
    await this.atualizarAnos(true);
    document.getElementById('fEmp').innerHTML = '<option value="">Todas</option>' + CONFIG.empresas.map(e => `<option>${e}</option>`).join('');
    await this.load();
  },

  async atualizarAnos(inicial) {
    let anos = [];
    try { anos = await Api.getAnos(); } catch (_) {}
    const atual = String(new Date().getFullYear());
    if (!anos.length) anos = [atual];
    if (!anos.includes(this.f.ano)) this.f.ano = anos.includes(atual) ? atual : anos[anos.length - 1];
    document.getElementById('fAno').innerHTML = anos.map(a => `<option>${a}</option>`).join('');
    document.getElementById('fAno').value = this.f.ano;
  },

  atualizarMeses() {
    const presentes = [...new Set(this.rows.map(r => +r.vencimento.split('-')[1]))].sort((a, b) => a - b);
    if (this.f.mes && !presentes.includes(+this.f.mes)) this.f.mes = '';
    const el = document.getElementById('fMes');
    el.innerHTML = '<option value="">Todos</option>' + presentes.map(m => `<option value="${m}">${MESES[m - 1]}</option>`).join('');
    el.value = this.f.mes;
  },

  async load() {
    await this.atualizarAnos();
    loading(true);
    try { this.rows = await Api.getLancamentos({ ano: this.f.ano }); }
    catch (e) { showToast('Erro ao carregar: ' + e.message, 4000); this.rows = []; }
    finally { loading(false); }
    this.atualizarMeses();
    this.render();
  },

  setFiltro(k, v) { this.f[k] = v; k === 'ano' ? this.load() : this.render(); },

  limpar() {
    this.f = { ...this.f, mes: '', empresa: '', tipo: '', status: '' };
    ['fMes', 'fEmp', 'fTip', 'fSta'].forEach(id => document.getElementById(id).value = '');
    this.render();
  },

  setView(v) {
    this.view = v;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === v));
    document.getElementById('pageTitle').textContent = v === 'dash' ? 'Dashboard' : 'Lançamentos';
    this.render();
  },

  // aplica filtros; ignoreMes=true mantém o ano inteiro (para o gráfico mensal)
  filtrar(ignoreMes = false) {
    const { mes, empresa, tipo, status } = this.f;
    return this.rows.filter(r => {
      if (empresa && r.empresa !== empresa) return false;
      if (tipo && r.tipo !== tipo) return false;
      if (status && effStatus(r) !== status) return false;
      if (!ignoreMes && mes && parseInt(r.vencimento.split('-')[1]) !== +mes) return false;
      return true;
    });
  },

  render() {
    this.charts.forEach(c => c.destroy());
    this.charts = [];
    const mesTxt = this.f.mes ? MESES[this.f.mes - 1] + ' de ' : '';
    document.getElementById('pageSub').textContent =
      `${mesTxt}${this.f.ano}${this.f.empresa ? ' · ' + this.f.empresa : ' · Todas as empresas'}`;
    document.getElementById('content').innerHTML = this.view === 'dash' ? this.htmlDash() : this.htmlLanc();
    if (this.view === 'dash') this.drawCharts();
  },

  resumo(rows) {
    const s = { pagar: 0, receber: 0, pago: 0, recebido: 0, atrasadoQtd: 0, atrasadoVal: 0, qtd: rows.length };
    rows.forEach(r => {
      if (r.status === 'cancelado') return;
      const v = num(r.valor);
      s[r.tipo] += v;
      if (r.status === 'pago') s.pago += v;
      if (r.status === 'recebido') s.recebido += v;
      if (effStatus(r) === 'atrasado') { s.atrasadoQtd++; s.atrasadoVal += v; }
    });
    return s;
  },

  htmlDash() {
    const rows = this.filtrar();
    const s = this.resumo(rows);
    const saldo = s.receber - s.pagar;
    const saldoReal = s.recebido - s.pago;
    const saldoProv = (s.receber - s.recebido) - (s.pagar - s.pago);

    // categorias (somente despesas) top 6
    const cat = {};
    rows.filter(r => r.tipo === 'pagar' && r.status !== 'cancelado').forEach(r => {
      const k = r.categoria || 'Sem categoria'; cat[k] = (cat[k] || 0) + num(r.valor);
    });
    const cats = Object.entries(cat).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const maxCat = cats.length ? cats[0][1] : 1;
    const catHtml = cats.length ? cats.map(([k, v]) => `
      <div class="bar-row"><div class="bar-top"><span>${esc(k)}</span><span>${fmt(v)}</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${(v / maxCat * 100).toFixed(0)}%"></div></div></div>`).join('')
      : '<div class="empty">Sem despesas no filtro.</div>';

    // próximos / atrasados
    const abertos = rows.filter(r => r.status === 'pendente').sort((a, b) => a.vencimento.localeCompare(b.vencimento)).slice(0, 7);
    const abertosHtml = abertos.length ? abertos.map(r => this.htmlTx(r)).join('') : '<div class="empty">Nada pendente 🎉</div>';

    return `
      <div class="kpis">
        <div class="kpi hero"><div class="k-label">Saldo</div><div class="k-val">${fmt((s.receber - s.pagar))}</div>
          <div class="k-pair">
            <div><span>Real</span><b>${fmt(saldoReal)}</b></div>
            <div><span>Provisionado</span><b>${fmt(saldoProv)}</b></div></div></div>
        <div class="kpi"><div class="k-label">A Receber</div><div class="k-val" style="color:var(--g700)">${fmt(s.receber)}</div>
          <div class="k-pair">
            <div><span>Real</span><b style="color:var(--g700)">${fmt(s.recebido)}</b></div>
            <div><span>Provisionado</span><b style="color:var(--g700)">${fmt(s.receber - s.recebido)}</b></div></div></div>
        <div class="kpi"><div class="k-label">A Pagar</div><div class="k-val" style="color:var(--red)">${fmt(s.pagar)}</div>
          <div class="k-pair">
            <div><span>Real</span><b style="color:var(--red)">${fmt(s.pago)}</b></div>
            <div><span>Provisionado</span><b style="color:var(--red)">${fmt(s.pagar - s.pago)}</b></div></div></div>
        <div class="kpi ${s.atrasadoQtd ? 'warn' : ''}"><div class="k-label">Atrasados</div><div class="k-val">${s.atrasadoQtd}</div>
          <div class="k-sub">${s.atrasadoQtd ? fmt(s.atrasadoVal) + ' em atraso' : 'Tudo em dia'}</div></div>
      </div>

      <div class="grid2">
        <div class="panel"><h3>Fluxo mensal <small>A Pagar × A Receber</small></h3>
          <div class="chart-wrap"><canvas id="chMensal"></canvas></div></div>
        <div class="panel"><h3>Liquidação <small>pago + recebido</small></h3>
          <div class="chart-wrap"><canvas id="chGauge"></canvas>
            <div class="center-val"><b id="gaugePct">0%</b><span>liquidado</span></div></div></div>
      </div>

      <div class="grid3">
        <div class="panel"><h3>Por empresa <small>valor total</small></h3>
          <div class="chart-wrap sm"><canvas id="chEmpresa"></canvas></div></div>
        <div class="panel"><h3>Maiores despesas <small>por categoria</small></h3>${catHtml}</div>
        <div class="panel"><h3>Próximos vencimentos <small>pendentes</small></h3>${abertosHtml}</div>
      </div>`;
  },

  htmlTx(r) {
    const st = effStatus(r);
    return `<div class="tx" onclick="Modal.openById('${r.id}')">
      <div class="ic ${r.tipo}">${r.tipo === 'pagar' ? '↑' : '↓'}</div>
      <div><div class="d">${esc(r.descricao)}</div>
        <div class="m">${esc(r.empresa)} · ${esc(r.categoria || '—')}${r.parceiro ? ' · ' + esc(r.parceiro) : ''} · ${fmtData(r.vencimento)}</div></div>
      <div class="v ${r.tipo}">${r.tipo === 'pagar' ? '-' : '+'}${fmt(r.valor)}</div>
      <span class="st st-${st}">${st[0].toUpperCase() + st.slice(1)}</span></div>`;
  },

  htmlLanc() {
    const rows = this.filtrar().sort((a, b) => a.vencimento.localeCompare(b.vencimento));
    if (!rows.length) return '<div class="panel"><div class="empty">Nenhum lançamento para os filtros selecionados.</div></div>';
    const s = this.resumo(rows);
    const saldoReal = s.recebido - s.pago;
    const saldoProv = (s.receber - s.recebido) - (s.pagar - s.pago);
    let html = `<div class="kpis" style="grid-template-columns:repeat(3,1fr)">
      <div class="kpi"><div class="k-label">A Receber</div><div class="k-val" style="color:var(--g700)">${fmt(s.receber)}</div><div class="k-pair">
        <div><span>Real</span><b style="color:var(--g700)">${fmt(s.recebido)}</b></div>
        <div><span>Provisionado</span><b style="color:var(--g700)">${fmt(s.receber - s.recebido)}</b></div></div></div>
      <div class="kpi"><div class="k-label">A Pagar</div><div class="k-val" style="color:var(--red)">${fmt(s.pagar)}</div><div class="k-pair">
        <div><span>Real</span><b style="color:var(--red)">${fmt(s.pago)}</b></div>
        <div><span>Provisionado</span><b style="color:var(--red)">${fmt(s.pagar - s.pago)}</b></div></div></div>
      <div class="kpi hero"><div class="k-label">Saldo</div><div class="k-val">${fmt((s.receber - s.pagar))}</div><div class="k-pair">
        <div><span>Real</span><b>${fmt(saldoReal)}</b></div>
        <div><span>Provisionado</span><b>${fmt(saldoProv)}</b></div></div></div></div>
      <div class="panel">`;
    let atual = '';
    rows.forEach(r => {
      if (r.vencimento !== atual) {
        atual = r.vencimento;
        html += `<div class="day-head">${fmtData(atual)}</div>`;
      }
      html += this.htmlTx(r);
    });
    return html + '</div>';
  },

  drawCharts() {
    const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    const g500 = css('--g500'), g900 = css('--g900'), red = css('--red'), g100 = css('--g100');
    Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
    Chart.defaults.color = css('--muted');

    // mensal (ano inteiro, respeita empresa/tipo/status)
    const ano = this.filtrar(true);
    const pag = Array(12).fill(0), rec = Array(12).fill(0);
    ano.forEach(r => {
      if (r.status === 'cancelado') return;
      const m = parseInt(r.vencimento.split('-')[1]) - 1;
      (r.tipo === 'pagar' ? pag : rec)[m] += num(r.valor);
    });
    const sel = this.f.mes ? this.f.mes - 1 : -1;
    const dim = (c, i) => sel === -1 || sel === i ? c : c + '55';
    this.charts.push(new Chart(document.getElementById('chMensal'), {
      type: 'bar',
      data: {
        labels: MES_CURTO,
        datasets: [
          { label: 'A Receber', data: rec, backgroundColor: rec.map((_, i) => dim(g500, i)), borderRadius: 8 },
          { label: 'A Pagar', data: pag, backgroundColor: pag.map((_, i) => dim(red, i)), borderRadius: 8 },
        ],
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${fmt(c.parsed.y)}` } } },
        scales: { y: { ticks: { callback: v => fmtK(v) }, grid: { color: '#eef1ef' } }, x: { grid: { display: false } } },
        onClick: (_, els) => {
          if (!els.length) return;
          const m = String(els[0].index + 1);
          this.f.mes = this.f.mes === m ? '' : m;
          document.getElementById('fMes').value = this.f.mes;
          this.render();
        },
      },
    }));

    // gauge liquidado
    const rows = this.filtrar();
    const s = this.resumo(rows);
    const total = s.pagar + s.receber, feito = s.pago + s.recebido;
    const pct = total ? Math.round(feito / total * 100) : 0;
    document.getElementById('gaugePct').textContent = pct + '%';
    this.charts.push(new Chart(document.getElementById('chGauge'), {
      type: 'doughnut',
      data: { labels: ['Liquidado', 'Em aberto'], datasets: [{ data: [feito, Math.max(total - feito, 0)], backgroundColor: [g900, g100], borderWidth: 0 }] },
      options: { maintainAspectRatio: false, rotation: -90, circumference: 180, cutout: '72%',
        plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } }, tooltip: { callbacks: { label: c => `${c.label}: ${fmt(c.parsed)}` } } } },
    }));

    // por empresa
    const emp = {};
    rows.filter(r => r.status !== 'cancelado').forEach(r => { emp[r.empresa] = (emp[r.empresa] || 0) + num(r.valor); });
    const labels = Object.keys(emp);
    this.charts.push(new Chart(document.getElementById('chEmpresa'), {
      type: 'doughnut',
      data: { labels: labels.length ? labels : ['Sem dados'], datasets: [{ data: labels.length ? Object.values(emp) : [1], backgroundColor: labels.length ? [g900, g500, '#8fd0aa', '#d99100', '#2f7fd1'] : [g100], borderWidth: 0 }] },
      options: { maintainAspectRatio: false, cutout: '62%',
        plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } }, tooltip: { callbacks: { label: c => `${c.label}: ${fmt(c.parsed)}` } } } },
    }));
  },
};


