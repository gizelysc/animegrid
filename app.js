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

function render() {
    const board = document.getElementById('kanban-board');
    if (!board) return;
    board.innerHTML = '';
    const fragment = document.createDocumentFragment();

    const filtered = animeState.filter(a => 
        (a.status === "Currently Airing" || a.status === "Not yet aired" || a.status === "Finished Airing") 
        && a.images?.jpg?.image_url
    );

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
            const status = prefs[anime.mal_id] || '';
            const card = document.createElement('div');
            card.className = `anime-card ${status}`;
            card.onclick = () => openAnimeDetails(anime.mal_id);
            card.innerHTML = `
                <div class="card-media"><img src="${anime.images.jpg.image_url}" loading="lazy"></div>
                <div class="anime-info">
                    <h3>${anime.title}</h3>
                    <p>⭐ ${anime.score || 'N/A'}</p>
                </div>
                <div class="card-actions" onclick="event.stopPropagation()">
                    <button onclick="updatePref('${anime.mal_id}', 'watching')">
                        ${status === 'watching' ? '✓ Salvo' : '+ Add'}
                    </button>
                </div>
            `;
            container.appendChild(card);
        });
        fragment.appendChild(col);
    });
    
    board.appendChild(fragment);
}

function openAnimeDetails(id) {
    const anime = animeState.find(a => a.mal_id === id);
    if (!anime) return;
    document.getElementById('m-title').innerText = anime.title;
    document.getElementById('m-synopsis').innerText = anime.synopsis || "Sem sinopse disponível.";
    document.getElementById('m-episodes').innerText = anime.episodes || "?";
    document.getElementById('m-score').innerText = anime.score || "N/A";
    document.getElementById('m-genres').innerText = anime.genres.map(g => g.name).join(', ');
    document.getElementById('anime-modal').style.display = 'flex';
}

function closeModal() { document.getElementById('anime-modal').style.display = 'none'; }
function updatePref(id, type) {
    prefs[id] = prefs[id] === type ? '' : type;
    localStorage.setItem('animeGrid_v2', JSON.stringify(prefs));
    render();
}
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