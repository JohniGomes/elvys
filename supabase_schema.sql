-- Tabela de lançamentos financeiros pessoais / empresariais
-- Execute no SQL Editor do Supabase: https://supabase.com/dashboard

create table if not exists lancamentos (
  id          text primary key,
  tipo        text not null,          -- 'pagar' | 'receber'
  empresa     text not null default 'Pessoal',
  categoria   text,
  descricao   text not null,
  parceiro    text,                   -- fornecedor ou cliente
  valor       numeric not null default 0,
  status      text not null default 'pendente',
                                      -- 'pendente' | 'pago' | 'recebido' | 'atrasado' | 'cancelado'
  vencimento  text not null,          -- YYYY-MM-DD
  pagamento   text,                   -- YYYY-MM-DD (data efetiva)
  obs         text,
  created_at  text
);

-- Desabilita RLS (acesso público via anon key)
alter table lancamentos disable row level security;

-- Concede acesso às roles anon e authenticated
grant all on lancamentos to anon;
grant all on lancamentos to authenticated;

-- Índices para filtros comuns
create index if not exists idx_lanc_vencimento on lancamentos(vencimento);
create index if not exists idx_lanc_empresa    on lancamentos(empresa);
create index if not exists idx_lanc_tipo       on lancamentos(tipo);
create index if not exists idx_lanc_status     on lancamentos(status);

-- Configuração do app (login/senha)
create table if not exists app_config (
  key   text primary key,
  value text
);
alter table app_config disable row level security;
grant all on app_config to anon;
grant all on app_config to authenticated;
