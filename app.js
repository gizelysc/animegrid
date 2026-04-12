const API_BASE = 'https://api.jikan.moe/v4';
const OTHERS_PREF_KEY = 'animeGrid_showOthers';

const DAYS_ORDER = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Unknown'];
const DAYS_BR = {
    'Sundays': 'Domingo', 'Mondays': 'Segunda', 'Tuesdays': 'Terça', 
    'Wednesdays': 'Quarta', 'Thursdays': 'Quinta', 'Fridays': 'Sexta', 
    'Saturdays': 'Sábado', 'Unknown': 'Outros'
};

let animeState = [];
let prefs = JSON.parse(localStorage.getItem('animeGrid_v2')) || {};
let showOthers = localStorage.getItem(OTHERS_PREF_KEY) === 'true';
let searchTerm = ''; // Nova variável para armazenar o termo da pesquisa

//Adicione a função de filtro vinculada ao input de busca
function filterByName() {
    const val = document.getElementById('search-input').value.toLowerCase();
    if (val.length >= 3 || val.length === 0) {
        searchTerm = val;
        render(); // Atualiza a tela imediatamente
    }
}


document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupControls();
    
    // Autodetecta a temporada baseada na data de hoje
    const { year, season } = getCurrentSeason();
    document.getElementById('year-input').value = year;
    document.getElementById('season-select').value = season;
    
    loadSeasonData(year, season);
});

// Calcula a temporada atual real
function getCurrentSeason() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1 a 12
    let season = '';

    if (month >= 1 && month <= 3) season = 'winter';
    else if (month >= 4 && month <= 6) season = 'spring';
    else if (month >= 7 && month <= 9) season = 'summer';
    else season = 'fall';

    return { year, season };
}

function setupControls() {
    const controls = document.querySelector('.controls');
    if (!document.getElementById('toggle-others') && controls) {
        const btn = document.createElement('button');
        btn.id = 'toggle-others';
        btn.className = `toggle-btn-others ${showOthers ? 'active' : ''}`;
        btn.innerText = showOthers ? 'Ocultar "Outros"' : 'Exibir "Outros"';
        btn.onclick = toggleOthersColumn;
        controls.appendChild(btn);
    }
}

// Vinculado ao botão "Buscar" no HTML
function fetchSpecificSeason() {
    const y = document.getElementById('year-input').value;
    const s = document.getElementById('season-select').value;
    if (y && s) loadSeasonData(y, s);
}

// Função de Busca Robusta
async function loadSeasonData(year, season) {
    renderMsg(`Carregando todos os animes de ${season} ${year}. Aguarde...`);
    
    try {
        let allAnimes = [];
        let page = 1;
        let hasNextPage = true;

        // Loop que garante buscar todas as páginas
        while (hasNextPage) {
            const url = `${API_BASE}/seasons/${year}/${season}?page=${page}&sfw=true`;
            const resp = await fetch(url);
            
            if (resp.status === 429) {
                console.warn("Limite de requisições. Pausando por 2 segundos...");
                await new Promise(r => setTimeout(r, 2000));
                continue; // Tenta a mesma página novamente
            }

            if (!resp.ok) throw new Error("Falha na API");

            const data = await resp.json();
            if (data.data) allAnimes = allAnimes.concat(data.data);
            
            hasNextPage = data.pagination.has_next_page;
            if (hasNextPage) {
                page++;
                // Delay de 500ms é obrigatório para não travar a API Jikan
                await new Promise(r => setTimeout(r, 500)); 
            }
        }

        animeState = allAnimes;
        render();
    } catch (e) {
        console.error(e);
        renderMsg("Erro ao carregar dados. Verifique a conexão.");
    }
}

// ==========================================
// 1. FUNÇÃO RENDER ATUALIZADA
// ==========================================
function render() {
    const board = document.getElementById('kanban-board');
    if (!board) return;
    board.innerHTML = '';
    const fragment = document.createDocumentFragment();

    // Limpa a fila de streamings anterior toda vez que a tela é atualizada
    streamingQueue.length = 0; 

    const filtered = animeState.filter(a => {
        const isValidStatus = (a.status === "Currently Airing" || a.status === "Not yet aired" || a.status === "Finished Airing");
        const hasImage = a.images?.jpg?.image_url;
        const matchesSearch = searchTerm.length >= 3 ? a.title.toLowerCase().includes(searchTerm) : true;
        
        return isValidStatus && hasImage && matchesSearch;
    });

    document.getElementById('global-counter').innerText = `Total: ${filtered.length} Animes`;

    DAYS_ORDER.forEach(day => {
        if (day === 'Unknown' && !showOthers) return;
        const dayAnimes = filtered.filter(a => (a.broadcast?.day || 'Unknown').includes(day));
        if (dayAnimes.length === 0 && day === 'Unknown') return;

        const col = document.createElement('div');
        col.className = 'kanban-column';
        col.innerHTML = `
            <div class="column-header">
                <h2>${DAYS_BR[day]}</h2>
                <span class="day-counter">${dayAnimes.length}</span>
            </div>
            <div class="cards-container"></div>
        `;

        const container = col.querySelector('.cards-container');
        dayAnimes.forEach(anime => {
            const card = document.createElement('div');
            card.className = `anime-card`;
            card.onclick = () => openAnimeDetails(anime.mal_id);
            
            // Retiramos o broadcastStr antigo e colocamos um container vazio para os streamings
            card.innerHTML = `
                <div class="card-media"><img src="${anime.images.jpg.image_url}" loading="lazy"></div>
                <div class="anime-info">
                    <h3>${anime.title}</h3>
                    <p>⭐ ${anime.score || 'N/A'}</p>
                    <div class="streaming-container" id="stream-${anime.mal_id}">
                        <span class="stream-loading">Buscando streamings...</span>
                    </div>
                </div>
            `;
            container.appendChild(card);

            // Coloca esse anime na fila para buscar onde assistir
            streamingQueue.push({ 
                id: anime.mal_id, 
                container: card.querySelector(`#stream-${anime.mal_id}`) 
            });
        });
        fragment.appendChild(col);
    });
    
    board.appendChild(fragment);
    
    // Inicia o processamento da fila assim que os cards aparecem na tela
    processStreamingQueue(); 
}


// ==========================================
// 2. SISTEMA DE FILA PARA EVITAR ERRO 429
// ==========================================
const streamingQueue = [];
let isProcessingQueue = false;

async function processStreamingQueue() {
    // Se já estiver processando, não faz nada
    if (isProcessingQueue) return;
    isProcessingQueue = true;

    while (streamingQueue.length > 0) {
        const { id, container } = streamingQueue.shift();
        
        // Se o card não estiver mais na tela (ex: usuário usou a barra de busca), ignora
        if (!document.body.contains(container)) continue;

        try {
            const resp = await fetch(`${API_BASE}/anime/${id}/streaming`);
            
            if (resp.status === 429) {
                // Se tomar limite da API, devolve pra fila e espera 2 segundos
                streamingQueue.unshift({ id, container }); 
                await new Promise(r => setTimeout(r, 2000)); 
                continue;
            }
            
            const data = await resp.json();
            container.innerHTML = ''; // Limpa o texto "Buscando..."
            
            if (data.data && data.data.length > 0) {
                data.data.forEach(stream => {
                    const a = document.createElement('a');
                    a.href = stream.url;
                    a.target = '_blank'; // Abre em nova aba
                    a.className = 'stream-link';
                    a.innerText = stream.name;
                    a.onclick = (e) => e.stopPropagation(); // Evita abrir o modal ao clicar no link
                    container.appendChild(a);
                });
            } else {
                container.innerHTML = '<span class="no-stream">Sem streaming oficial</span>';
            }
        } catch (e) {
            container.innerHTML = '<span class="no-stream">Erro ao carregar</span>';
        }

        // Delay MÁGICO: Espera 400ms entre cada chamada para respeitar o limite de 3/seg do Jikan
        await new Promise(r => setTimeout(r, 400));
    }
    
    isProcessingQueue = false;
}

async function openAnimeDetails(id) {
    const anime = animeState.find(a => a.mal_id === id);
    if (!anime) return;
    
    // Preenche as informações básicas
    document.getElementById('m-title').innerText = anime.title;
    document.getElementById('m-synopsis').innerText = anime.synopsis || "Sem sinopse disponível.";
    document.getElementById('m-episodes').innerText = anime.episodes || "?";
    document.getElementById('m-score').innerText = anime.score || "N/A";
    
    // Tratamento seguro para os gêneros
    const genres = anime.genres ? anime.genres.map(g => g.name).join(', ') : 'N/A';
    document.getElementById('m-genres').innerText = genres;
    
    // Exibe o modal na tela
    document.getElementById('anime-modal').style.display = 'flex';

    // ==========================================
    // BUSCA DE STREAMING SOB DEMANDA NO MODAL
    // ==========================================
    const streamContainer = document.getElementById('m-streamings');
    streamContainer.innerHTML = '<span class="stream-loading">Buscando opções...</span>';

    try {
        const resp = await fetch(`${API_BASE}/anime/${id}/streaming`);
        if (!resp.ok) throw new Error('Erro na API');
        
        const data = await resp.json();
        streamContainer.innerHTML = ''; // Limpa o texto de "Buscando..."
        
        if (data.data && data.data.length > 0) {
            data.data.forEach(stream => {
                const a = document.createElement('a');
                a.href = stream.url;
                a.target = '_blank'; // Abre em nova guia
                a.className = 'stream-link'; // Reaproveita o CSS colorido que já fizemos!
                a.innerText = stream.name;
                streamContainer.appendChild(a);
            });
        } else {
            streamContainer.innerHTML = '<span class="no-stream">Nenhum streaming oficial encontrado</span>';
        }
    } catch (e) {
        streamContainer.innerHTML = '<span class="no-stream">Não foi possível carregar as opções</span>';
    }
}

function closeModal() { document.getElementById('anime-modal').style.display = 'none'; }

function toggleOthersColumn() {
    showOthers = !showOthers;
    localStorage.setItem(OTHERS_PREF_KEY, showOthers);
    render();
}
function renderMsg(m) { document.getElementById('kanban-board').innerHTML = `<h3 style="padding:20px; color:var(--text-main);">${m}</h3>`; }

// Correção do Botão de Tema
function initTheme() { 
    if(localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode'); 
}
function toggleTheme() { 
    document.body.classList.toggle('dark-mode'); 
    localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light'); 
}
