# Carteira Digital

Simulação de carteira digital com transfer~encias por chave Pix.
Projeto de estudo com dados fictícios, sem dinheiro real.

**DEMO** https://beprestes.github.io/carteira-digital/
![Tela principal] (img/tela.png)

## Funcionalidades

- Criar conta (nome e chave Pix) e escolher o usuário
- Transferir por chave Pix, com janela de confirmação e comprovante
- Adicionar saldo (deposito simulado)
- Extrato (entrada, saída e deposito), filtrável por tipo e período
- Cartão que acompanha o usuário selecionado

## Tecnologias

- PostgresSQL (SupaBase)
- JavaScript
- HTML e CSS

## Destaques técnicos

- **Transferência atômica:** função SQL (PL/pgSQL) que valida, trava as contas
  (`FOR UPDATE`), debita, credita e registra tudo numa única transação
- **Integridade no banco:** `CHECK` (saldo não negativo, valor positivo),
  `UNIQUE` na chave Pix e chaves estrangeiras
- **Segurança:** RLS ligado; o navegador só lê. Toda escrita passa por funções
  SQL (`transferir`, `depositar`, `criar_usuario`) com validação e limites
- **View `extrato`:** `UNION ALL` + `JOIN` juntam transferências e depósitos,
  respeitando o RLS (`security_invoker`)
- **Front-end sem framework:** DOM, `fetch`/`async-await`, `<dialog>` nativo
  e dados inseridos com `textContent`, evitando injeção de HTML
- As validações do JS são só conveniência; as regras reais estão no banco
