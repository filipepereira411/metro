# Metro de Lisboa · simulador, mapa e contas

Inspirado no **Simulador de viagem** do site oficial [metrolisboa.pt](https://www.metrolisboa.pt/).

Três páginas ligadas por uma navegação comum:

| Página | O que faz |
| --- | --- |
| `index.html` | Simulador de viagem: origem, destino, hora e data, itinerário e animação |
| `mapa.html` | Mapa esquemático interativo: clicar em estações, zoom/pan, calcular itinerário |
| `conta.html` | Entrar, registar e sair, com perfis **cliente** e **admin** |
| `admin.html` | Painel admin: tipos de utilizadores e estado das linhas |

## Como abrir

Abrir `index.html` (ou qualquer uma das páginas) diretamente no browser. Não há dependências, build, servidor nem ligação à internet.

## Simulador

- Rede com 50 estações nas linhas Azul, Vermelha, Amarela e Verde (rede de 2026; a Linha Circular não está incluída porque a conclusão está prevista para 2027).
- 2 minutos entre estações consecutivas, 4 minutos por transbordo e espera média conforme hora/dia.
- Cálculo com Dijkstra sobre pares (estação, linha).
- Animação do percurso com controlos iniciar/pausar/reiniciar e velocidades 1×/4×/10×.
- Aceita parâmetros na URL: `index.html?origem=Aeroporto&destino=Rato&hora=510`.

## Mapa interativo

- Esquema das 4 linhas em SVG, com as correspondências alinhadas e ligações tracejadas.
- Clicar numa estação e definir origem/destino; botão **Calcular itinerário** realça o percurso e mostra as pernadas.
- Zoom com `+`, `−`, `Reset` e rodinha do rato; pan com arrasto.
- Link **Ver no simulador** abre o mesmo itinerário em `index.html`.
- Linhas marcadas como interrompidas no painel admin aparecem a vermelho e são ignoradas nos cálculos.

## Contas

Demonstração local guardada em `localStorage` — **não é autenticação real**.

| Conta | Palavra-passe | Perfil |
| --- | --- | --- |
| `admin@metro.pt` | `admin123` | Admin |
| `cliente@metro.pt` | `cliente123` | Cliente |

- Registo permite escolher Cliente ou Administrador; para admin é exigido o código `ML-ADMIN-2026`.
- Após entrar, clientes vão para `index.html` e administradores para `admin.html`.
- O botão **Sair** termina a sessão.
- No painel admin é possível alterar o tipo de utilizador, remover contas e marcar linhas como interrompidas/operacionais.
- Elementos com `data-sessao` (`nome`, `email`, `autenticado`, `convidado`, `admin`, `cliente`) controlam o que cada perfil vê.

## Ficheiros

- `index.html`, `css/estilo.css`, `js/app.js` — simulador e animação
- `mapa.html`, `css/mapa.css`, `js/mapa.js` — mapa interativo
- `conta.html`, `css/conta.css`, `js/conta-pagina.js` — entrar/registar
- `admin.html`, `js/admin.js` — painel de administração
- `js/rede.js` — modelo da rede e cálculo de rotas (partilhado)
- `js/conta.js` — contas, sessão e estado das linhas (partilhado)

Os tempos são estimativas simplificadas para demonstração, não horários oficiais. As contas vivem apenas no browser onde foram criadas; limpar os dados do site repõe as contas de teste.
