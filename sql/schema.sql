

-- Tabelas
create table usuarios (
  id bigint generated always as identity primary key,
  nome text not null,
  chave_pix text not null unique,
  saldo numeric(12,2) not null default 0 check (saldo >= 0)
);

create table transferencias (
  id bigint generated always as identity primary key,
  origem_id bigint not null references usuarios(id),
  destino_id bigint not null references usuarios(id),
  valor numeric(12,2) not null check (valor > 0),
  criado_em timestamptz not null default now(),
  check (origem_id <> destino_id)
);

create table depositos (
  id bigint generated always as identity primary key,
  usuario_id bigint not null references usuarios(id),
  valor numeric(12,2) not null check (valor > 0),
  criado_em timestamptz not null default now()
);

-- Dados de teste (fictícios)
insert into usuarios (nome, chave_pix, saldo) values
  ('Ana Souza',  'ana@exemplo.com',   1000.00),
  ('Bruno Lima', 'bruno@exemplo.com',  500.00),
  ('Carla Dias', 'carla@exemplo.com',  250.00);

-- Segurança: RLS ligado e somente leitura para o navegador
alter table usuarios enable row level security;
alter table transferencias enable row level security;
alter table depositos enable row level security;

create policy "leitura usuarios" on usuarios for select using (true);
create policy "leitura transferencias" on transferencias for select using (true);
create policy "leitura depositos" on depositos for select using (true);

grant usage on schema public to anon;
grant select on usuarios, transferencias, depositos to anon;

-- Transferência atômica
create or replace function transferir(
  p_origem_id bigint,
  p_chave_destino text,
  p_valor numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_destino_id bigint;
  v_saldo numeric;
begin
  if p_valor is null or p_valor <= 0 then
    raise exception 'Valor inválido';
  end if;

  select id into v_destino_id from usuarios where chave_pix = p_chave_destino;

  if v_destino_id is null then
    raise exception 'Chave Pix não encontrada';
  end if;

  if v_destino_id = p_origem_id then
    raise exception 'Não é possível transferir para você mesmo';
  end if;

  perform 1 from usuarios
  where id in (p_origem_id, v_destino_id)
  order by id
  for update;

  select saldo into v_saldo from usuarios where id = p_origem_id;

  if v_saldo is null then
    raise exception 'Usuário de origem não encontrado';
  end if;

  if v_saldo < p_valor then
    raise exception 'Saldo insuficiente';
  end if;

  update usuarios set saldo = saldo - p_valor where id = p_origem_id;
  update usuarios set saldo = saldo + p_valor where id = v_destino_id;

  insert into transferencias (origem_id, destino_id, valor)
  values (p_origem_id, v_destino_id, p_valor);
end;
$$;

-- Depósito simulado
create or replace function depositar(
  p_usuario_id bigint,
  p_valor numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_valor is null or p_valor <= 0 then
    raise exception 'Valor inválido';
  end if;

  if p_valor > 10000 then
    raise exception 'Limite de depósito simulado: R$ 10.000,00';
  end if;

  update usuarios set saldo = saldo + p_valor where id = p_usuario_id;

  if not found then
    raise exception 'Usuário não encontrado';
  end if;

  insert into depositos (usuario_id, valor) values (p_usuario_id, p_valor);
end;
$$;

-- Cadastro de usuário
create or replace function criar_usuario(
  p_nome text,
  p_chave text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text := trim(p_nome);
  v_chave text := lower(trim(p_chave));
  v_id bigint;
begin
  if v_nome is null or char_length(v_nome) < 2 or char_length(v_nome) > 50 then
    raise exception 'O nome deve ter entre 2 e 50 caracteres';
  end if;

  if v_chave is null or char_length(v_chave) < 3
     or char_length(v_chave) > 60 or v_chave ~ '\s' then
    raise exception 'Chave Pix inválida (3 a 60 caracteres, sem espaços)';
  end if;

  if (select count(*) from usuarios) >= 50 then
    raise exception 'Limite de usuários da demonstração atingido';
  end if;

  begin
    insert into usuarios (nome, chave_pix, saldo)
    values (v_nome, v_chave, 0)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Essa chave Pix já está em uso';
  end;

  return v_id;
end;
$$;

grant execute on function transferir(bigint, text, numeric) to anon;
grant execute on function depositar(bigint, numeric) to anon;
grant execute on function criar_usuario(text, text) to anon;

--extrato (entradas, saídas e depósitos)
create view extrato with (security_invoker = true) as
  select t.origem_id as usuario_id, 'saida' as tipo,
         d.nome as contraparte, t.valor, t.criado_em
  from transferencias t
  join usuarios d on d.id = t.destino_id
  union all
  select t.destino_id, 'entrada', o.nome, t.valor, t.criado_em
  from transferencias t
  join usuarios o on o.id = t.origem_id
  union all
  select dp.usuario_id, 'deposito', null, dp.valor, dp.criado_em
  from depositos dp;

grant select on extrato to anon;