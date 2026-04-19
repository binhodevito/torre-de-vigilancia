-- ============================================================
-- Torre de Vigilância — Schema do Supabase
-- Cole este SQL em: Supabase → SQL Editor → New query → Run
-- ============================================================

-- ── Tabela: coleção (por usuário) ─────────────────────────
create table if not exists colecao (
  id           uuid    default gen_random_uuid() primary key,
  user_id      uuid    references auth.users(id) on delete cascade not null,
  id_guia      text    not null,
  titulo       text    not null default '',
  numero       text    default '',
  editora      text    default '',
  ano          text    default '',
  capa_url     text    default '',
  artistas     text    default '',
  personagens  text    default '',
  url_original text    default '',
  status       text    default 'quero_ler',
  nota         integer default 0,
  fisico       boolean default false,
  notas_pessoais text  default '',
  data_adicao  timestamptz default now(),
  data_leitura timestamptz,
  unique(user_id, id_guia)
);

-- ── Tabela: listas ─────────────────────────────────────────
create table if not exists listas (
  id           uuid    default gen_random_uuid() primary key,
  user_id      uuid    references auth.users(id) on delete cascade not null,
  nome         text    not null,
  descricao    text    default '',
  cor          text    default '#C0392B',
  icone        text    default '📚',
  data_criacao timestamptz default now()
);

-- ── Tabela: itens das listas ───────────────────────────────
create table if not exists lista_itens (
  id        uuid    default gen_random_uuid() primary key,
  user_id   uuid    references auth.users(id) on delete cascade not null,
  lista_id  uuid    references listas(id) on delete cascade not null,
  id_guia   text    not null,
  ordem     integer default 0,
  data_adicao timestamptz default now(),
  unique(lista_id, id_guia)
);

-- ── Tabela: cache compartilhado do Guia dos Quadrinhos ─────
-- Todos os usuários se beneficiam: se um raspa, ninguém mais raspa
create table if not exists cache_guia (
  id_guia      text primary key,
  titulo       text default '',
  numero       text default '',
  editora      text default '',
  ano          text default '',
  capa_url     text default '',
  artistas     text default '',
  personagens  text default '',
  url_original text default '',
  data_cache   timestamptz default now()
);

-- ── Row Level Security ─────────────────────────────────────

alter table colecao    enable row level security;
alter table listas     enable row level security;
alter table lista_itens enable row level security;
alter table cache_guia enable row level security;

-- Coleção: usuário acessa apenas seus próprios dados
create policy "colecao_select" on colecao for select using (auth.uid() = user_id);
create policy "colecao_insert" on colecao for insert with check (auth.uid() = user_id);
create policy "colecao_update" on colecao for update using (auth.uid() = user_id);
create policy "colecao_delete" on colecao for delete using (auth.uid() = user_id);

-- Listas: idem
create policy "listas_select" on listas for select using (auth.uid() = user_id);
create policy "listas_insert" on listas for insert with check (auth.uid() = user_id);
create policy "listas_update" on listas for update using (auth.uid() = user_id);
create policy "listas_delete" on listas for delete using (auth.uid() = user_id);

-- Itens de lista: idem
create policy "lista_itens_select" on lista_itens for select using (auth.uid() = user_id);
create policy "lista_itens_insert" on lista_itens for insert with check (auth.uid() = user_id);
create policy "lista_itens_delete" on lista_itens for delete using (auth.uid() = user_id);

-- Cache do Guia: qualquer usuário autenticado pode ler e inserir
-- (ninguém pode apagar ou alterar dados do cache de outro)
create policy "cache_select" on cache_guia for select to authenticated using (true);
create policy "cache_insert" on cache_guia for insert to authenticated with check (true);

-- ── Índices para performance ───────────────────────────────
create index if not exists idx_colecao_user    on colecao(user_id);
create index if not exists idx_colecao_status  on colecao(user_id, status);
create index if not exists idx_listas_user     on listas(user_id);
create index if not exists idx_lista_itens_lista on lista_itens(lista_id);
