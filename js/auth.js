const Auth = {
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
    const email = document.getElementById('lUser').value.trim();
    const senha = document.getElementById('lPass').value;
    const { error } = await Api._db.auth.signInWithPassword({ email, password: senha });
    if (error) {
      this.msg('E-mail ou senha incorretos.');
      document.getElementById('lPass').value = '';
      return;
    }
    this.abrir();
  },

  async trocarSenha() {
    const email = document.getElementById('sUser').value.trim();
    const atual = document.getElementById('sAtual').value;
    const nova = document.getElementById('sNova').value;
    const conf = document.getElementById('sConf').value;
    if (nova.length < 6) return this.msg('A nova senha precisa ter pelo menos 6 caracteres.');
    if (nova !== conf) return this.msg('A confirmação não confere.');
    const { error } = await Api._db.auth.signInWithPassword({ email, password: atual });
    if (error) return this.msg('E-mail ou senha atual incorretos.');
    const { error: e2 } = await Api._db.auth.updateUser({ password: nova });
    await Api._db.auth.signOut();
    if (e2) return this.msg('Erro ao alterar: ' + e2.message);
    ['sAtual', 'sNova', 'sConf'].forEach(id => document.getElementById(id).value = '');
    this.modo('login');
    this.msg('Senha alterada! Entre com a nova senha.', true);
  },

  abrir() {
    document.getElementById('loginOverlay').classList.add('hidden');
    App.init();
  },

  async sair() { await Api._db.auth.signOut(); location.reload(); },

  async boot() {
    const { data } = await Api._db.auth.getSession();
    if (data.session) this.abrir();
    else { document.getElementById('loading').classList.add('hidden'); document.getElementById('lUser').focus(); }
  },
};

document.addEventListener('DOMContentLoaded', () => Auth.boot());
