// O Cloudflare Workers injeta o arquivo CSV aqui como texto puro graças à regra do wrangler.toml
import csvDadosBrutos from './top-1m.csv';

// Processa o CSV uma única vez na inicialização do Worker (Economiza CPU por requisição)
const listaDominios = csvDadosBrutos
  .split('\n')
  .map(linha => {
    const linhaLimpa = linha.trim();
    if (!linhaLimpa) return null;
    
    // Se tiver a posição do ranking (ex: "1,google.com"), pega só o domínio
    if (linhaLimpa.includes(',')) {
      const partes = linhaLimpa.split(',');
      return partes[1] ? partes[1].toLowerCase() : partes[0].toLowerCase();
    }
    return linhaLimpa.toLowerCase();
  })
  .filter(Boolean);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // API de Busca: Filtra o array na memória de forma ultra rápida
    if (url.pathname === '/search') {
      const query = url.searchParams.get('q')?.trim().toLowerCase();
      if (!query) {
        return new Response(JSON.stringify({ success: true, results: [] }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const resultados = [];
      const limite = 50;

      for (const dominio of listaDominios) {
        if (dominio.includes(query)) {
          resultados.push(`https://${dominio}`);
          if (resultados.length >= limite) break;
        }
      }

      return new Response(JSON.stringify({ success: true, results: resultados }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*' 
        }
      });
    }

    // Rota Principal: Serve o Frontend idêntico ao Google
    return new Response(obterHtmlFrontend(), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
};

function obterHtmlFrontend() {
  return `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Whale Surfer</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
          .g-blue { color: #4285F4; } .g-red { color: #EA4335; }
          .g-yellow { color: #FBBC05; } .g-green { color: #34A853; }
      </style>
  </head>
  <body class="bg-white text-gray-900 font-sans min-h-screen flex flex-col justify-between">
      <main class="flex-grow flex flex-col items-center justify-center px-4 -mt-16">
          <div class="text-center mb-8 select-none">
              <h1 class="text-6xl font-bold tracking-tight font-serif">
                  <span class="g-blue">W</span><span class="g-red">h</span><span class="g-yellow">a</span><span class="g-blue">l</span><span class="g-green">e</span>
                  <span class="g-red">S</span><span class="g-blue">u</span><span class="g-red">r</span><span class="g-green">f</span><span class="g-yellow">e</span><span class="g-blue">r</span>
              </h1>
              <p class="text-xs text-gray-400 mt-1 tracking-widest uppercase">Mecanismo de Busca na Edge</p>
          </div>
          <div class="w-full max-w-2xl">
              <div class="bg-white rounded-full border border-gray-200 pl-5 pr-3 py-2.5 flex items-center shadow-sm hover:shadow-md focus-within:shadow-md focus-within:border-gray-300 transition duration-150">
                  <svg class="h-5 w-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input type="text" id="search-input" class="w-full text-base text-gray-900 focus:outline-none bg-transparent">
              </div>
              <div class="flex justify-center space-x-3 mt-6">
                  <button onclick="realizarBusca(false)" class="bg-gray-50 text-sm text-gray-800 px-4 py-2 rounded border border-transparent hover:border-gray-200 hover:bg-gray-100 transition">
                      Pesquisar na Whale
                  </button>
                  <button onclick="realizarBusca(true)" class="bg-gray-50 text-sm text-gray-800 px-4 py-2 rounded border border-transparent hover:border-gray-200 hover:bg-gray-100 transition">
                      Acessar site em alta
                  </button>
              </div>
          </div>
          <div id="results-area" class="w-full max-w-2xl mt-8 space-y-4 hidden text-left">
              <div id="status-message" class="text-xs text-gray-500 pl-4"></div>
              <div id="results-list" class="space-y-2"></div>
          </div>
      </main>
      <footer class="bg-gray-100 text-gray-500 text-xs py-3.5 px-6 border-t border-gray-200 w-full flex justify-between">
          <div>Whale Surfer &copy; 2026</div>
          <div class="space-x-4"><span class="hover:underline cursor-pointer">Privacidade</span><span class="hover:underline cursor-pointer">Termos</span></div>
      </footer>
      <script>
          async function realizarBusca(abrirPrimeiroImediato = false) {
              const query = document.getElementById('search-input').value.trim();
              if (!query) return;
              const resultsArea = document.getElementById('results-area');
              const resultsList = document.getElementById('results-list');
              const statusMessage = document.getElementById('status-message');
              resultsList.innerHTML = '';
              statusMessage.innerText = "Buscando nos domínios da edge...";
              resultsArea.classList.remove('hidden');
              try {
                  const response = await fetch(\`/search?q=\${encodeURIComponent(query)}\`);
                  const data = await response.json();
                  if (!data.success || data.results.length === 0) {
                      statusMessage.innerText = "Nenhum domínio encontrado.";
                      return;
                  }
                  if (abrirPrimeiroImediato && data.results.length > 0) {
                      window.open(data.results[0], '_blank');
                      resultsArea.classList.add('hidden');
                      return;
                  }
                  statusMessage.innerText = \`Aproximadamente \${data.results.length} domínios listados:\`;
                  data.results.forEach(dominio => {
                      const exibicao = dominio.replace('https://', '');
                      const card = \`
                          <div class="bg-white p-3 rounded border border-gray-100 hover:shadow-sm transition">
                              <a href="\${dominio}" target="_blank" class="text-lg text-blue-800 font-medium hover:underline break-all">
                                  \${exibicao}
                              </a>
                              <span class="text-xs text-green-700 block mt-0.5">\${dominio}</span>
                          </div>
                      \`;
                      resultsList.insertAdjacentHTML('beforeend', card);
                  });
              } catch (err) {
                  statusMessage.innerHTML = '<span class="text-red-500">Erro ao conectar com o motor Whale Surfer.</span>';
              }
          }
          document.getElementById('search-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') realizarBusca(false); });
      </script>
  </body>
  </html>
  `;
}
