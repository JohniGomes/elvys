const Auth = {
  SESSION: 'elvys_session',
  LOCAL: 'elvys_auth',
  DEFAULT: { usuario: 'elvys', senha: 'elvys@2026' },

  async sha(s) {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  },

  async getCred() {
    try {
      const { data, error } = await Api._db.from('app_config').select('value').eq('key', 'auth').maybeSingle();
      if (!error && data) return JSON.parse(data.value);
    } catch (_) {}
    try { const l = JSON.parse(localStorage.getItem(this.LOCAL)); if (l) return l; } catch (_) {}
    return { usuario: this.DEFAULT.usuario, hash: await this.sha(this.DEFAULT.senha) };
  },

  async saveCred(c) {
    const { error } = await Api._db.from('app_config').upsert({ key: 'auth', value: JSON.stringify(c) });
    if (error) { localStorage.setItem(this.LOCAL, JSON.stringify(c)); return false; }
    localStorage.removeItem(this.LOCAL);
    return true;
  },

  msg(t, ok) {
    const el = document.getElementById('loginMsg');
    el.textContent = t; el.className = 'login-msg ' + (ok ? 'ok' : 'err');
  },

  modo(m) {
    document.getElementById('formLogin').classList.toggle('hidden', m !== 'login');
    document.getElementById('formSenha').classList.toggle('hidden', m !== 'senha');
    this.msg('');
  },

  async entrar() {
    const u = document.getElementById('lUser').value.trim();
    const p = document.getElementById('lPass').value;
    const c = await this.getCred();
    if (u.toLowerCase() === c.usuario.toLowerCase() && await this.sha(p) === c.hash) {
      sessionStorage.setItem(this.SESSION, '1');
      this.abrir();
    } else {
      this.msg('Usuário ou senha incorretos.');
      document.getElementById('lPass').value = '';
    }
  },

  async trocarSenha() {
    const u = document.getElementById('sUser').value.trim();
    const atual = document.getElementById('sAtual').value;
    const nova = document.getElementById('sNova').value;
    const conf = document.getElementById('sConf').value;
    const c = await this.getCred();
    if (u.toLowerCase() !== c.usuario.toLowerCase() || await this.sha(atual) !== c.hash) return this.msg('Usuário ou senha atual incorretos.');
    if (nova.length < 6) return this.msg('A nova senha precisa ter pelo menos 6 caracteres.');
    if (nova !== conf) return this.msg('A confirmação não confere.');
    const salvoNuvem = await this.saveCred({ usuario: c.usuario, hash: await this.sha(nova) });
    ['sAtual', 'sNova', 'sConf'].forEach(id => document.getElementById(id).value = '');
    this.modo('login');
    this.msg(salvoNuvem ? 'Senha alterada! Entre com a nova senha.' : 'Senha alterada só neste navegador (falta criar a tabela app_config).', true);
  },

  abrir() {
    document.getElementById('loginOverlay').classList.add('hidden');
    App.init();
  },

  sair() { sessionStorage.removeItem(this.SESSION); location.reload(); },

  boot() {
    if (sessionStorage.getItem(this.SESSION)) this.abrir();
    else { document.getElementById('loading').classList.add('hidden'); document.getElementById('lUser').focus(); }
  },
};

document.addEventListener('DOMContentLoaded', () => Auth.boot());
