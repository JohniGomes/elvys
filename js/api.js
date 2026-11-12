const _sb = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);

const Api = {
  _db: _sb,

  async _q(promise) {
    const { data, error } = await promise;
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  getLancamentos: async (filtros = {}) => {
    let q = Api._db.from('lancamentos').select('*');
    if (filtros.ano && filtros.mes) {
      const ym = `${filtros.ano}-${String(filtros.mes).padStart(2, '0')}`;
      const last = new Date(filtros.ano, filtros.mes, 0).getDate();
      q = q.gte('vencimento', `${ym}-01`).lte('vencimento', `${ym}-${last}`);
    } else if (filtros.ano) {
      q = q.gte('vencimento', `${filtros.ano}-01-01`).lte('vencimento', `${filtros.ano}-12-31`);
    }
    if (filtros.empresa)  q = q.eq('empresa', filtros.empresa);
    if (filtros.tipo)     q = q.eq('tipo', filtros.tipo);
    if (filtros.status)   q = q.eq('status', filtros.status);
    return Api._q(q.order('vencimento', { ascending: true }));
  },

  saveLancamento: async (d) => {
    if (!d.id) {
      d.id = crypto.randomUUID();
      d.created_at = new Date().toISOString().split('T')[0];
      return Api._q(Api._db.from('lancamentos').insert(d));
    }
    return Api._q(Api._db.from('lancamentos').update(d).eq('id', d.id));
  },

  saveLancamentos: (arr) => Api._q(Api._db.from('lancamentos').insert(arr)),

  getAnos: async () => {
    const rows = await Api._q(Api._db.from('lancamentos').select('vencimento'));
    return [...new Set(rows.map(r => (r.vencimento || '').slice(0, 4)).filter(Boolean))].sort();
  },

  deleteLancamento: (id) => Api._q(Api._db.from('lancamentos').delete().eq('id', id)),

  getResumoAno: async (ano) => {
    const rows = await Api.getLancamentos({ ano });
    const meses = {};
    for (let m = 1; m <= 12; m++) meses[m] = { pagar: 0, receber: 0, pago: 0, recebido: 0 };
    rows.forEach(r => {
      const m = parseInt((r.vencimento || '').split('-')[1]);
      if (!m || !meses[m]) return;
      const v = parseFloat(r.valor) || 0;
      if (r.tipo === 'pagar')   meses[m].pagar   += v;
      if (r.tipo === 'receber') meses[m].receber  += v;
      if (r.tipo === 'pagar'   && r.status === 'pago')     meses[m].pago      += v;
      if (r.tipo === 'receber' && r.status === 'recebido') meses[m].recebido  += v;
    });
    return meses;
  },
};
