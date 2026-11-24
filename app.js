const SUPABASE_URL = 'https://fkagcbfpfnebonmldwwz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_UjVSW27WbbiMRfcqZm1WJQ_QTdcHOi6';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const seletor = document.getElementById('seletor-usuario');
const saldoEl = document.getElementById('saldo');
const form = document.getElementById('form-transferencia');
const chaveEl = document.getElementById('chave');
const valorEl = document.getElementById('valor');
const mensagemEl = document.getElementById('mensagem');
const extratoEl = document.getElementById('extrato');
const cartaoNomeEl = document.getElementById('cartao-nome');
const cartaoNumeroEl = document.getElementById('cartao-numero');
const modalEl = document.getElementById('modal');
const modalConteudoEl = document.getElementById('modal-conteudo');
const abasEl = document.querySelectorAll('.aba');
const periodoEl = document.getElementById('filtro-periodo');
const btnDepositoEl = document.getElementById('btn-deposito');
const btnCadastroEl = document.getElementById('btn-cadastro');

let transferencias = [];
let filtroTipo = 'todas';
let usuarios = [];

function formatarMoeda(valor) {
    return Number(valor).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}
function mostrarMensagem(texto, tipo) {
    mensagemEl.textContent = texto;
    mensagemEl.className = 'mensagem ' + tipo;

}

async function carregarUsuarios(idParaSelecionar) {
    const selecionado = idParaSelecionar || seletor.value;
    const { data, error } = await db.from('usuarios').select('*').order('id');

    if (error) {
        console.error(error);
        saldoEl.textContent = 'Erro ao carregar';
        return;
    }
    usuarios = data;
    seletor.innerHTML = '<option value = ""> Selecione um usuário</option>';
    usuarios.forEach(function (u) {
        const opcao = document.createElement('option');
        opcao.value = u.id;
        opcao.textContent = u.nome;
        seletor.appendChild(opcao);

    });

    if (selecionado) {
        seletor.value = selecionado;
    }
    mostrarSaldo();
    carregarExtrato();
}
function mostrarSaldo() {
    const usuario = usuarios.find(function (u) {
        return u.id === Number(seletor.value);
    });
    saldoEl.textContent = usuario ? formatarMoeda(usuario.saldo) : ' R$ --';
    cartaoNomeEl.textContent = usuario
        ? usuario.nome.toUpperCase()
        : 'SELECIONE UM USUÁRIO';

    cartaoNumeroEl.textContent = usuario
        ? ' XXXX XXXX XXXX ' + String(usuario.id).padStart(4, '0') :
        'XXXX XXXX XXXX XXXX ';
}

async function carregarExtrato() {
    const id = Number(seletor.value);
    if (!id) {
        transferencias = []
        extratoEl.innerHTML = '';
        return;
    }

    const { data, error } = await db.from('extrato').select('*').eq('usuario_id', id).order('criado_em', { ascending: false });
    if (error) {
        console.error(error);
        extratoEl.textContent = 'Erro ao carregar o extrato';
        return;
    }
    transferencias = data;
    renderizarExtrato();
}
function renderizarExtrato() {
    const dias = periodoEl.value;
    const limite = dias === 'tudo'
        ? null
        : Date.now() - Number(dias) * 24 * 60 * 60 * 1000;

    const lista = transferencias.filter(function (t) {
        const ehSaida = t.tipo === 'saida';
        if (filtroTipo === 'entradas' && ehSaida) {
            return false;
        }
        if (filtroTipo === 'saidas' && !ehSaida) {
            return false;
        }
        if (limite && new Date(t.criado_em).getTime() < limite) {
            return false;
        }
        return true;
    });
    extratoEl.innerHTML = '';
    if (lista.length === 0) {
        const vazio = document.createElement('li');
        vazio.className = 'vazio';
        vazio.textContent = 'Nenhuma transferência encontrada.';
        extratoEl.appendChild(vazio);
        return;
    }
    lista.forEach(function (t) {
        const ehSaida = t.tipo === 'saida';

        const li = document.createElement('li');
        li.className = ehSaida ? 'saida' : 'entrada';

        const info = document.createElement('div');

        const titulo = document.createElement('strong');
        if (t.tipo === 'deposito') {
            titulo.textContent = 'Depósito';
        } else if (ehSaida) {
            titulo.textContent = 'Para ' + t.contraparte;
        } else {
            titulo.textContent = 'De ' + t.contraparte;
        }

        const dataEl = document.createElement('small');
        dataEl.textContent = new Date(t.criado_em).toLocaleString('pt-BR');

        info.appendChild(titulo);
        info.appendChild(dataEl);

        const valor = document.createElement('span');
        valor.className = 'valor';
        valor.textContent = (ehSaida ? '- ' : '+ ') + formatarMoeda(t.valor);

        li.appendChild(info);
        li.appendChild(valor);
        extratoEl.appendChild(li);
    });
}

function criarLinha(rotulo, valor) {
    const linha = document.createElement('div');
    linha.className = 'linha';

    const r = document.createElement('span');
    r.textContent = rotulo;

    const v = document.createElement('strong');
    v.textContent = valor;
    linha.appendChild(r);
    linha.appendChild(v);
    return linha;
}

function abrirConfirmação(destinario, valor) {
    modalConteudoEl.innerHTML = '';

    const titulo = document.createElement('h3');
    titulo.textContent = 'Confirmar transferência';

    const btnCancelar = document.createElement('button');
    btnCancelar.type = 'button';
    btnCancelar.className = 'btn-secundario';
    btnCancelar.textContent = 'Cancelar';
    btnCancelar.addEventListener('click', function () {
        modalEl.close();

    });
    const btnConfirmar = document.createElement('button');
    btnConfirmar.type = 'button';
    btnConfirmar.textContent = 'Confirmar';
    btnConfirmar.addEventListener('click', function () {
        confirmarTransferencia(destinario, valor, btnConfirmar);
    });
    const acoes = document.createElement('div');
    acoes.className = 'acoes';
    acoes.appendChild(btnCancelar);
    acoes.appendChild(btnConfirmar);

    modalConteudoEl.appendChild(titulo);
    modalConteudoEl.appendChild(criarLinha('Para', destinario.nome));
    modalConteudoEl.appendChild(criarLinha('Chave Pix', destinario.chave_pix));
    modalConteudoEl.appendChild(criarLinha('Valor', formatarMoeda(valor)));
    modalConteudoEl.appendChild(acoes);

    modalEl.showModal();
}

function mostrarComprovante(remetente, destinatario, valor) {
    modalConteudoEl.innerHTML = '';

    const icone = document.createElement('div');
    icone.className = 'icone-ok';
    icone.textContent = '✔';

    const titulo = document.createElement('h3');
    titulo.textContent = 'Transferência realizada';

    const valorGrande = document.createElement('div');
    valorGrande.className = 'valor-grande';
    valorGrande.textContent = formatarMoeda(valor);

    const btnFechar = document.createElement('button');
    btnFechar.type = 'button';
    btnFechar.textContent = 'Fechar';
    btnFechar.addEventListener(`click`, function () {
        modalEl.close();
    });
    const acoes = document.createElement('div');
    acoes.className = ' acoes';
    acoes.style.gridTemplateColumns = '1fr';
    acoes.appendChild(btnFechar);

    modalConteudoEl.appendChild(icone);
    modalConteudoEl.appendChild(titulo);
    modalConteudoEl.appendChild(valorGrande);
    modalConteudoEl.appendChild(criarLinha('De', remetente.nome));
    modalConteudoEl.appendChild(criarLinha('Para', destinatario.nome));
    modalConteudoEl.appendChild(criarLinha('Data e hora', new Date().toLocaleDateString('pt-BR')));
    modalConteudoEl.appendChild(acoes);

}

async function confirmarTransferencia(destinatario, valor, botaoConfirmar) {
    botaoConfirmar.disabled = true;
    botaoConfirmar.textContent = 'Processando...';

    const remetente = usuarios.find(function (u) {
        return u.id === Number(seletor.value);
    });

    const { error } = await db.rpc('transferir', {
        p_origem_id: remetente.id,
        p_chave_destino: destinatario.chave_pix,
        p_valor: valor
    });
    if (error) {
        modalEl.close();
        mostrarMensagem(error.message, 'erro');
        return;
    }
    mostrarComprovante(remetente, destinatario, valor);
    mostrarMensagem('', '');
    form.reset();
    await carregarUsuarios();
}
function abrirDeposito() {
    if (!seletor.value) {
        mostrarMensagem('Selecione quem você é antes de adicionar saldo.', 'erro');
        return;
    }
    modalConteudoEl.innerHTML = '';
    const titulo = document.createElement('h3');
    titulo.textContent = 'Adicionar saldo(simulado)';

    const rotulo = document.createElement('label');
    rotulo.textContent = 'Valor (R$)';

    const campo = document.createElement('input');
    campo.type = 'number';
    campo.min = '0.01';
    campo.step = '0.01';
    campo.placeholder = '0,00';

    const erroEl = document.createElement('p');
    erroEl.className = 'mensagem erro';

    const btnCancelar = document.createElement('button');
    btnCancelar.type = 'button';
    btnCancelar.className = 'btn-secundario';
    btnCancelar.textContent = 'Cancelar';
    btnCancelar.addEventListener('click', function () {
        modalEl.close();
    });
    const btnConfirmar = document.createElement('button');
    btnConfirmar.type = 'button';
    btnConfirmar.textContent = 'Adicionar';
    btnConfirmar.addEventListener('click', function () {
        confirmarDeposito(Number(campo.value), btnConfirmar, erroEl);
    });
    const acoes = document.createElement('div');
    acoes.className = 'acoes';
    acoes.appendChild(btnConfirmar);
    acoes.appendChild(btnCancelar);

    modalConteudoEl.appendChild(titulo);
    modalConteudoEl.appendChild(rotulo);
    modalConteudoEl.appendChild(campo);
    modalConteudoEl.appendChild(erroEl);
    modalConteudoEl.appendChild(acoes);

    modalEl.showModal();
}

async function confirmarDeposito(valor, botaoConfirmar, erroEl) {
    if (!valor || valor <= 0) {
        erroEl.textContent = 'Informe um valor válido.';
        return;
    }
    erroEl.textContent = '';
    botaoConfirmar.disabled = true;
    botaoConfirmar.textContent = 'Processando...';

    const { error } = await db.rpc('depositar', {
        p_usuario_id: Number(seletor.value),
        p_valor: valor
    });
    if (error) {
        erroEl.textContent = error.message;
        botaoConfirmar.disabled = false;
        botaoConfirmar.textContent = 'Adicionar';
        return;
    }
    modalEl.close();
    await carregarUsuarios();
}
function abrirCadastro() {
    modalConteudoEl.innerHTML = '';

    const titulo = document.createElement('h3');
    titulo.textContent = 'Criar nova conta';

    const rotuloNome = document.createElement('label');
    rotuloNome.textContent = 'Nome';

    const campoNome = document.createElement('input');
    campoNome.type = 'text';
    campoNome.maxLength = 50;
    campoNome.placeholder = 'Seu nome';

    const rotuloChave = document.createElement('label');
    rotuloChave.textContent = 'Chave Pix (e-mail ou apelido)';

    const campoChave = document.createElement('input');
    campoChave.type = 'text';
    campoChave.maxLength = 60;
    campoChave.placeholder = 'voce@exemplo.com';

    const erroEl = document.createElement('p');
    erroEl.className = 'mensagem erro';

    const btnCancelar = document.createElement('button');
    btnCancelar.type = 'button';
    btnCancelar.className = 'btn-secundario';
    btnCancelar.textContent = 'Cancelar';
    btnCancelar.addEventListener('click', function () {
        modalEl.close();
    });
    const btnConfirmar = document.createElement('button');
    btnConfirmar.type = 'button';
    btnConfirmar.textContent = 'Criar conta';
    btnConfirmar.addEventListener('click', function () {
        confirmarCadastro(campoNome.value.trim(), campoChave.value.trim(), btnConfirmar, erroEl);
    });
    const acoes = document.createElement('div');
    acoes.className = 'acoes';
    acoes.appendChild(btnCancelar);
    acoes.appendChild(btnConfirmar);

    modalConteudoEl.appendChild(titulo);
    modalConteudoEl.appendChild(rotuloNome);
    modalConteudoEl.appendChild(campoNome);
    modalConteudoEl.appendChild(rotuloChave);
    modalConteudoEl.appendChild(campoChave);
    modalConteudoEl.appendChild(erroEl);
    modalConteudoEl.appendChild(acoes);

    modalEl.showModal();

}

async function confirmarCadastro(nome, chave, botaoConfirmar, erroEl) {
    if (!nome || !chave) {
        erroEl.textContent = 'Preencha o nome e a chave Pix.';
        return;
    }
    erroEl.textContent = '';
    botaoConfirmar.disabled = true;
    botaoConfirmar.textContent = 'Criando...';
    const { data, error } = await db.rpc('criar_usuario', {
        p_nome: nome,
        p_chave: chave
    });
    if (error) {
        erroEl.textContent = error.message;
        botaoConfirmar.disabled = false;
        botaoConfirmar.textContent = 'Criar conta';
        return;
    }
    modalEl.close();
    await carregarUsuarios(data);
}

function transferir(event) {
    event.preventDefault();

    if (!seletor.value) {
        mostrarMensagem('Selecione quem você é antes de transferir.', 'erro');
        return;
    }
    const chave = chaveEl.value.trim();
    const valor = Number(valorEl.value);

    const remetente = usuarios.find(function (u) {
        return u.id === Number(seletor.value);
    });
    const destinatario = usuarios.find(function (u) {
        return u.chave_pix === chave.toLowerCase();
    });

    if (!destinatario) {
        mostrarMensagem('Chave Pix não encontrada', 'erro');
        return;
    }
    if (destinatario.id === remetente.id) {
        mostrarMensagem('Não é possível transferir para você mesmo', 'erro');
        return;
    }
    if (valor > Number(remetente.saldo)) {
        mostrarMensagem('Saldo insuficiente', 'erro');
        return;
    }
    mostrarMensagem('', '');
    abrirConfirmação(destinatario, valor);
}
seletor.addEventListener('change', function () {
    mostrarSaldo();
    carregarExtrato();
});

form.addEventListener('submit', transferir);

modalEl.addEventListener('click', function (event) {
    if (event.target === modalEl) {
        modalEl.close();
    }
});

abasEl.forEach(function (aba) {
    aba.addEventListener('click', function () {
        filtroTipo = aba.dataset.tipo;

        abasEl.forEach(function (a) {
            a.classList.remove('ativa');
        });
        aba.classList.add('ativa');
        renderizarExtrato();
    });
});
btnDepositoEl.addEventListener('click', abrirDeposito);
btnCadastroEl.addEventListener('click', abrirCadastro);
periodoEl.addEventListener('change', renderizarExtrato);

carregarUsuarios();