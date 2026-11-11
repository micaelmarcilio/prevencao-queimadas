/* =========================================================
   Tecnologia para Prevenção e Monitoramento de Queimadas
   Lógica da página: menu, relato de focos, histórico, quiz
   ========================================================= */

document.addEventListener('DOMContentLoaded', function () {

  /* ---------- Utilidades ---------- */
  const $ = (seletor) => document.querySelector(seletor);
  const CHAVE_RELATOS = 'relatos-queimadas';

  // Endereço do Google Apps Script que grava cada relato na planilha do projeto
  const URL_PLANILHA = 'https://script.google.com/macros/s/AKfycbwOeBwS0c-OqA2tOmCZTNb2j5PZgQmNtD8wdrQApL8NZQOo8m0eNZzsDP7uFhwgm6jH/exec';

  // Envia o relato para a planilha. Usa text/plain para evitar bloqueio de CORS.
  function enviarParaPlanilha(relato) {
    return fetch(URL_PLANILHA, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(relato)
    })
      .then(function (resposta) { return resposta.json(); })
      .then(function (dados) { if (!dados.ok) throw new Error(dados.erro || 'Falha'); return dados; });
  }

  // localStorage pode estar indisponível (modo privado, navegador bloqueado)
  function lerRelatos() {
    try { return JSON.parse(localStorage.getItem(CHAVE_RELATOS)) || []; }
    catch (e) { return []; }
  }
  function salvarRelatos(lista) {
    try { localStorage.setItem(CHAVE_RELATOS, JSON.stringify(lista)); return true; }
    catch (e) { return false; }
  }
  function classeIntensidade(valor) {
    return { 'Baixa': 'baixa', 'Média': 'media', 'Alta': 'alta' }[valor] || 'baixa';
  }

  /* ---------- Menu mobile ---------- */
  const menuBotao = $('#menu-botao');
  const menu = $('#menu');

  menuBotao.addEventListener('click', function () {
    const aberto = menu.classList.toggle('aberto');
    menuBotao.setAttribute('aria-expanded', aberto);
    menuBotao.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
  });
  menu.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      menu.classList.remove('aberto');
      menuBotao.setAttribute('aria-expanded', 'false');
    });
  });

  // Destaca no menu a seção visível
  const linksMenu = menu.querySelectorAll('a');
  if ('IntersectionObserver' in window) {
    const observadorMenu = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (entrada) {
        if (entrada.isIntersecting) {
          linksMenu.forEach(function (l) {
            l.classList.toggle('ativo', l.getAttribute('href') === '#' + entrada.target.id);
          });
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('main section[id]').forEach(function (s) { observadorMenu.observe(s); });
  }

  /* ---------- Animação de entrada e contadores ---------- */
  const elementosRevelar = document.querySelectorAll('.numero, .card, .contato, .fluxo__item, .impacto, .linha-passos li, .link-card');
  elementosRevelar.forEach(function (el) { el.classList.add('revelar'); });

  function animarContador(el) {
    const alvo = parseInt(el.dataset.contar, 10);
    const duracao = 1600;
    const inicio = performance.now();
    function passo(agora) {
      const progresso = Math.min((agora - inicio) / duracao, 1);
      const suave = 1 - Math.pow(1 - progresso, 3);
      el.textContent = Math.round(alvo * suave).toLocaleString('pt-BR');
      if (progresso < 1) requestAnimationFrame(passo);
    }
    requestAnimationFrame(passo);
  }

  if ('IntersectionObserver' in window) {
    const observador = new IntersectionObserver(function (entradas, obs) {
      entradas.forEach(function (entrada) {
        if (!entrada.isIntersecting) return;
        entrada.target.classList.add('visivel');
        const contador = entrada.target.querySelector('[data-contar]');
        if (contador) animarContador(contador);
        obs.unobserve(entrada.target);
      });
    }, { threshold: 0.15 });
    elementosRevelar.forEach(function (el) { observador.observe(el); });
  } else {
    elementosRevelar.forEach(function (el) { el.classList.add('visivel'); });
    document.querySelectorAll('[data-contar]').forEach(function (el) {
      el.textContent = parseInt(el.dataset.contar, 10).toLocaleString('pt-BR');
    });
  }

  /* ---------- Geolocalização ---------- */
  const campoLocal = $('#localizacao');
  const geoStatus = $('#geo-status');
  const btnGeo = $('#btn-geolocalizacao');

  function statusGeo(texto, tipo) {
    geoStatus.textContent = texto;
    geoStatus.className = 'dica ' + (tipo || '');
  }

  btnGeo.addEventListener('click', function () {
    if (!('geolocation' in navigator)) {
      statusGeo('Seu navegador não permite localização automática. Digite o endereço ou um ponto de referência.', 'erro');
      return;
    }
    statusGeo('Buscando sua localização…');
    btnGeo.disabled = true;

    try {
      navigator.geolocation.getCurrentPosition(function (pos) {
        const lat = pos.coords.latitude.toFixed(6);
        const lon = pos.coords.longitude.toFixed(6);
        campoLocal.value = lat + ', ' + lon;
        campoLocal.classList.remove('campo-erro');
        statusGeo('Localização encontrada (precisão de ~' + Math.round(pos.coords.accuracy) + ' m).', 'ok');
        btnGeo.disabled = false;
      }, function () {
        statusGeo('Não foi possível obter a localização. Digite o endereço ou um ponto de referência.', 'erro');
        btnGeo.disabled = false;
      }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
    } catch (e) {
      statusGeo('Não foi possível obter a localização. Digite o endereço ou um ponto de referência.', 'erro');
      btnGeo.disabled = false;
    }
  });

  /* ---------- Seleção de intensidade (compatibilidade com navegadores antigos) ---------- */
  const opcoesIntensidade = document.querySelectorAll('.intensidade input');
  opcoesIntensidade.forEach(function (input) {
    input.addEventListener('change', function () {
      document.querySelectorAll('.intensidade').forEach(function (el) { el.classList.remove('selecionada'); });
      input.closest('.intensidade').classList.add('selecionada');
      $('.intensidades').classList.remove('campo-erro');
    });
  });

  /* ---------- Envio do relato ---------- */
  const form = $('#form-relato');
  const mensagem = $('#mensagem');
  const resultado = $('#resultado');

  function mostrarErro(texto) {
    mensagem.textContent = texto;
    mensagem.className = 'mensagem erro';
  }
  function limparErro() {
    mensagem.textContent = '';
    mensagem.className = 'mensagem';
  }

  function extrairCoordenadas(texto) {
    const m = texto.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
    return m ? { lat: m[1], lon: m[2] } : null;
  }

  function montarTexto(r) {
    const linhas = [
      '🔥 RELATO DE FOCO DE INCÊNDIO',
      'Protocolo: ' + r.protocolo,
      'Data/hora: ' + r.data,
      '',
      'Local: ' + r.localizacao
    ];
    if (r.referencia) linhas.push('Referência: ' + r.referencia);
    if (r.coordenadas) linhas.push('Mapa: https://www.google.com/maps?q=' + r.coordenadas.lat + ',' + r.coordenadas.lon);
    linhas.push('Intensidade: ' + r.intensidade);
    if (r.tipoArea) linhas.push('Área: ' + r.tipoArea);
    linhas.push('Risco a pessoas/casas/animais: ' + (r.risco ? 'SIM' : 'Não informado'));
    if (r.descricao) linhas.push('Descrição: ' + r.descricao);
    return linhas.join('\n');
  }

  form.addEventListener('submit', function (evento) {
    evento.preventDefault();
    limparErro();

    const localizacao = campoLocal.value.trim();
    const intensidadeEl = form.querySelector('input[name="intensidade"]:checked');
    let valido = true;

    campoLocal.classList.toggle('campo-erro', !localizacao);
    $('.intensidades').classList.toggle('campo-erro', !intensidadeEl);

    if (!localizacao || !intensidadeEl) {
      valido = false;
      mostrarErro('Preencha a localização e escolha a intensidade do fogo.');
      (!localizacao ? campoLocal : opcoesIntensidade[0]).focus();
    }
    if (!valido) return;

    const agora = new Date();
    const relato = {
      protocolo: 'QM-' + agora.getFullYear().toString().slice(2) +
                 String(agora.getMonth() + 1).padStart(2, '0') +
                 String(agora.getDate()).padStart(2, '0') + '-' +
                 Math.random().toString(36).slice(2, 6).toUpperCase(),
      data: agora.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
      localizacao: localizacao,
      referencia: $('#referencia').value.trim(),
      coordenadas: extrairCoordenadas(localizacao),
      intensidade: intensidadeEl.value,
      tipoArea: $('#tipo-area').value,
      risco: $('#risco-pessoas').checked,
      descricao: $('#descricao').value.trim()
    };

    // Guarda no histórico deste aparelho
    const relatos = lerRelatos();
    relatos.unshift(relato);
    salvarRelatos(relatos.slice(0, 20));

    exibirResultado(relato);
    renderizarHistorico();

    // Registra o relato na base do projeto (planilha)
    const statusEnvio = $('#status-envio');
    statusEnvio.textContent = 'Registrando o relato na base do projeto…';
    statusEnvio.className = 'status-envio';
    enviarParaPlanilha(relato)
      .then(function () {
        statusEnvio.textContent = '✓ Relato registrado na base do projeto.';
        statusEnvio.className = 'status-envio ok';
      })
      .catch(function () {
        statusEnvio.textContent = 'Não foi possível registrar na base do projeto (verifique a internet). Use os botões abaixo para avisar as autoridades.';
        statusEnvio.className = 'status-envio erro';
      });
  });

  function exibirResultado(r) {
    const texto = montarTexto(r);
    $('#res-protocolo').textContent = r.protocolo;
    $('#res-texto').textContent = texto;
    $('#res-alerta').hidden = !(r.intensidade === 'Alta' || r.risco);

    $('#btn-whatsapp').href = 'https://wa.me/?text=' + encodeURIComponent(texto);

    const btnMapa = $('#btn-mapa');
    if (r.coordenadas) {
      btnMapa.href = 'https://www.google.com/maps?q=' + r.coordenadas.lat + ',' + r.coordenadas.lon;
      btnMapa.hidden = false;
    } else {
      btnMapa.href = 'https://www.google.com/maps/search/' + encodeURIComponent(r.localizacao);
      btnMapa.hidden = false;
    }

    $('#copiar-status').textContent = '';
    form.hidden = true;
    resultado.hidden = false;
    resultado.focus({ preventScroll: true });
    resultado.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  $('#btn-copiar').addEventListener('click', function () {
    const texto = $('#res-texto').textContent;
    const status = $('#copiar-status');
    function copiado() { status.textContent = 'Texto copiado. Cole no WhatsApp, SMS ou e-mail.'; status.className = 'dica ok'; }
    function falhou() {
      // Seleciona o texto para a pessoa copiar manualmente
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents($('#res-texto'));
      sel.removeAllRanges();
      sel.addRange(range);
      status.textContent = 'Texto selecionado. Use Ctrl+C (ou "Copiar" no celular).';
      status.className = 'dica';
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texto).then(copiado, falhou);
      } else { falhou(); }
    } catch (e) { falhou(); }
  });

  $('#btn-novo').addEventListener('click', function () {
    form.reset();
    document.querySelectorAll('.intensidade').forEach(function (el) { el.classList.remove('selecionada'); });
    statusGeo('');
    resultado.hidden = true;
    form.hidden = false;
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ---------- Histórico ---------- */
  const historico = $('#historico');
  const lista = $('#lista-relatos');

  function renderizarHistorico() {
    const relatos = lerRelatos();
    lista.innerHTML = '';
    historico.hidden = relatos.length === 0;

    relatos.forEach(function (r) {
      const li = document.createElement('li');

      const selo = document.createElement('span');
      selo.className = 'selo selo--' + classeIntensidade(r.intensidade);
      selo.textContent = r.intensidade;

      const local = document.createElement('span');
      local.className = 'local';
      local.textContent = r.localizacao;

      const data = document.createElement('span');
      data.className = 'data';
      data.textContent = r.data + ' · ' + r.protocolo;

      li.append(selo, local, data);
      lista.appendChild(li);
    });
  }

  $('#btn-limpar').addEventListener('click', function () {
    salvarRelatos([]);
    renderizarHistorico();
  });

  renderizarHistorico();

  /* ---------- Quiz ---------- */
  const perguntas = [
    {
      pergunta: 'Qual é o número do Corpo de Bombeiros no Brasil?',
      opcoes: ['190', '192', '193', '199'],
      certa: 2,
      explicacao: '193 é o Corpo de Bombeiros. 190 é a Polícia Militar, 192 é o SAMU e 199 é a Defesa Civil.'
    },
    {
      pergunta: 'Qual destas atitudes ajuda a PREVENIR queimadas?',
      opcoes: ['Queimar folhas secas no quintal', 'Jogar a bituca de cigarro no lixo', 'Soltar balão em festa junina', 'Fazer fogueira em dia de vento'],
      certa: 1,
      explicacao: 'Bitucas jogadas na beira da estrada e na vegetação seca estão entre as causas mais comuns de incêndios.'
    },
    {
      pergunta: 'Soltar balões é…',
      opcoes: ['Permitido só em festas', 'Crime ambiental', 'Permitido longe de cidades', 'Proibido só em São Paulo'],
      certa: 1,
      explicacao: 'A Lei de Crimes Ambientais (Lei nº 9.605/1998) proíbe fabricar, vender, transportar ou soltar balões que possam causar incêndios.'
    },
    {
      pergunta: 'Como as queimadas se relacionam com a mudança do clima (ODS 13)?',
      opcoes: ['Não têm relação', 'Resfriam o planeta', 'Liberam CO₂ e aumentam o aquecimento global', 'Só afetam a vegetação'],
      certa: 2,
      explicacao: 'A queima da vegetação libera gás carbônico e outros gases de efeito estufa, além de destruir florestas que absorvem CO₂.'
    },
    {
      pergunta: 'Você vê um incêndio médio se espalhando perto de casas. O que fazer primeiro?',
      opcoes: ['Tentar apagar sozinho com baldes', 'Filmar e postar nas redes sociais', 'Afastar-se e ligar 193', 'Esperar para ver se apaga'],
      certa: 2,
      explicacao: 'Sua segurança vem primeiro. Afaste-se contra o vento e ligue 193. Depois, registre o foco na plataforma.'
    }
  ];

  let atual = 0;
  let acertos = 0;

  const qContador = $('#quiz-contador');
  const qPergunta = $('#quiz-pergunta');
  const qOpcoes = $('#quiz-opcoes');
  const qExplicacao = $('#quiz-explicacao');
  const qProxima = $('#quiz-proxima');
  const qBarra = $('#quiz-barra');
  const qCaixa = $('#quiz-caixa');

  function mostrarPergunta() {
    const p = perguntas[atual];
    qContador.textContent = 'Pergunta ' + (atual + 1) + ' de ' + perguntas.length;
    qPergunta.textContent = p.pergunta;
    qBarra.style.width = (atual / perguntas.length * 100) + '%';
    qOpcoes.innerHTML = '';
    qExplicacao.hidden = true;
    qProxima.hidden = true;

    p.opcoes.forEach(function (texto, i) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'quiz__opcao';
      b.textContent = texto;
      b.addEventListener('click', function () { responder(i); });
      qOpcoes.appendChild(b);
    });
  }

  function responder(i) {
    const p = perguntas[atual];
    const botoes = qOpcoes.querySelectorAll('button');
    botoes.forEach(function (b, j) {
      b.disabled = true;
      if (j === p.certa) b.classList.add('certa');
      else if (j === i) b.classList.add('errada');
    });
    if (i === p.certa) acertos++;
    qExplicacao.textContent = (i === p.certa ? 'Isso mesmo! ' : 'Não foi dessa vez. ') + p.explicacao;
    qExplicacao.hidden = false;
    qProxima.textContent = atual === perguntas.length - 1 ? 'Ver resultado' : 'Próxima';
    qProxima.hidden = false;
    qProxima.focus();
  }

  qProxima.addEventListener('click', function () {
    atual++;
    if (atual < perguntas.length) mostrarPergunta();
    else mostrarFinal();
  });

  function mostrarFinal() {
    qBarra.style.width = '100%';
    const frase = acertos === perguntas.length ? 'Excelente! Você é um guardião contra o fogo.'
                : acertos >= 3 ? 'Muito bem! Você já sabe bastante sobre prevenção.'
                : 'Que tal rever a seção de prevenção e tentar de novo?';

    qContador.textContent = 'Resultado';
    qPergunta.textContent = '';
    qExplicacao.hidden = true;
    qProxima.hidden = true;
    qOpcoes.innerHTML = '';

    const final = document.createElement('div');
    final.className = 'quiz__final';
    final.innerHTML =
      '<p class="quiz__nota">' + acertos + '/' + perguntas.length + '</p>' +
      '<p>' + frase + '</p>';

    const refazer = document.createElement('button');
    refazer.type = 'button';
    refazer.className = 'botao botao--fogo';
    refazer.textContent = 'Refazer quiz';
    refazer.addEventListener('click', function () { atual = 0; acertos = 0; mostrarPergunta(); });

    final.appendChild(refazer);
    qOpcoes.appendChild(final);
  }

  mostrarPergunta();
});
