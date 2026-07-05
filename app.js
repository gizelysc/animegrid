const API_BASE = 'https://api.jikan.moe/v4';
const OTHERS_PREF_KEY = 'animeGrid_showOthers';
const DROPPED_KEY = 'animeGrid_dropped_v1';
const LEGACY_MY_LIST_KEY = 'animeGrid_myList_v1';
const MY_LIST_KEY = 'animeGrid_myList_cache_v2';

const DAYS_ORDER = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Unknown'];
const DAYS_BR = {
    'Sundays': 'Domingo', 'Mondays': 'Segunda', 'Tuesdays': 'Terça',
    'Wednesdays': 'Quarta', 'Thursdays': 'Quinta', 'Fridays': 'Sexta',
    'Saturdays': 'Sábado', 'Unknown': 'Outros'
};
let animeState = [];
let prefs = JSON.parse(localStorage.getItem('animeGrid_v2')) || {};
// let showOthers removido
let droppedState = JSON.parse(localStorage.getItem(DROPPED_KEY)) || {};
let searchTerm = ''; // Nova variável para armazenar o termo da pesquisa
let activeScoreFilters = new Set(); // Filtros de nota ativos

let myListState = JSON.parse(localStorage.getItem(MY_LIST_KEY)) || JSON.parse(localStorage.getItem(LEGACY_MY_LIST_KEY)) || {};
let showMyListOnly = false;
let sharedListIds = null;
let selectedDayFilter = 'all';

// Configurações de Cache
const SEASON_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas
const STREAM_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 dias
const STREAM_CACHE_KEY = 'animeGrid_stream_cache_v2';
let streamingCache = JSON.parse(localStorage.getItem(STREAM_CACHE_KEY)) || {};

if (localStorage.getItem('animeGrid_stream_cache')) {
    localStorage.removeItem('animeGrid_stream_cache');
}



//converte o timezone do broadcast para horário local do usuário
//function convertToLocalTime(broadcast) {
//   if (!broadcast || !broadcast.time || !broadcast.timezone) return "N/A";
function getBrasilBroadcast(broadcast, episodes, aired) {
    if (!broadcast || !broadcast.day || !broadcast.time) {
        if (episodes === null || episodes <= 1) {
            return "Horário não disponível";
        }
        if (episodes > 1 && aired && aired.prop && aired.prop.from && aired.prop.from.year) {
            const f = aired.prop.from;
            // Verifica se a data é válida
            if (f.month && f.day) {
                const date = new Date(f.year, f.month - 1, f.day);
                const options = { weekday: 'long', timeZone: 'America/Sao_Paulo' };
                let brasilTime = new Intl.DateTimeFormat('pt-BR', options).format(date);
                return brasilTime.charAt(0).toUpperCase() + brasilTime.slice(1) + " (Aproximado)";
            }
        }
        return "Horário não disponível";
    }

    // Mapeamento de dias para índices (0 = Domingo, 1 = Segunda...)
    const daysMap = {
        'Sundays': 0, 'Mondays': 1, 'Tuesdays': 2, 'Wednesdays': 3,
        'Thursdays': 4, 'Fridays': 5, 'Saturdays': 6
    };

    const [hours, minutes] = broadcast.time.split(':').map(Number);
    const dayIndex = daysMap[broadcast.day];

    // Criamos uma data base em um domingo qualquer (ex: 7 de Abril de 2024)
    // No Japão (UTC+9)
    let date = new Date(Date.UTC(2024, 3, 7 + dayIndex, hours - 9, minutes));

    // Convertemos para a string local do Brasil (UTC-3)
    const options = { weekday: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' };
    let brasilTime = new Intl.DateTimeFormat('pt-BR', options).format(date);

    // Deixa a primeira letra maiúscula
    return brasilTime.charAt(0).toUpperCase() + brasilTime.slice(1);
}

function getBrasilDayEnglish(broadcast, episodes, aired) {
    if (!broadcast || !broadcast.day || !broadcast.time) {
        if (episodes === null || episodes <= 1) {
            return "Unknown";
        }
        if (episodes > 1 && aired && aired.prop && aired.prop.from && aired.prop.from.year) {
            const f = aired.prop.from;
            if (f.month && f.day) {
                const date = new Date(f.year, f.month - 1, f.day);
                const options = { weekday: 'long', timeZone: 'America/Sao_Paulo' };
                let brasilWeekday = new Intl.DateTimeFormat('en-US', options).format(date);
                return brasilWeekday + 's';
            }
        }
        return "Unknown";
    }

    const daysMap = {
        'Sundays': 0, 'Mondays': 1, 'Tuesdays': 2, 'Wednesdays': 3,
        'Thursdays': 4, 'Fridays': 5, 'Saturdays': 6
    };

    const [hours, minutes] = broadcast.time.split(':').map(Number);
    const dayIndex = daysMap[broadcast.day];

    if (dayIndex === undefined || isNaN(hours) || isNaN(minutes)) return "Unknown";

    let date = new Date(Date.UTC(2024, 3, 7 + dayIndex, hours - 9, minutes));
    const options = { weekday: 'long', timeZone: 'America/Sao_Paulo' };
    let brasilWeekday = new Intl.DateTimeFormat('en-US', options).format(date);

    return brasilWeekday + 's';
}



//Adicione a função de filtro vinculada ao input de busca
function filterByName() {
    const val = document.getElementById('search-input').value.toLowerCase().trim();
    if (val.length >= 3 || val.length === 0) {
        searchTerm = val;
        render(); // Atualiza a tela imediatamente
    }
}

function toggleScoreFilter(filter) {
    const buttons = document.querySelectorAll(`button[data-filter="${filter}"]`);
    const active = activeScoreFilters.has(filter);

    buttons.forEach(btn => {
        if (active) {
            activeScoreFilters.delete(filter);
            btn.classList.remove('active');
        } else {
            activeScoreFilters.add(filter);
            btn.classList.add('active');
        }
    });
    render();
}

function toggleDrop(mal_id) {
    const y = document.getElementById('year-input').value;
    const s = document.getElementById('season-select').value;
    const key = `${y}_${s}`;

    if (!droppedState[key]) droppedState[key] = [];

    const index = droppedState[key].indexOf(mal_id);
    if (index > -1) {
        droppedState[key].splice(index, 1);
    } else {
        droppedState[key].push(mal_id);
    }

    localStorage.setItem(DROPPED_KEY, JSON.stringify(droppedState));
    render();
}


document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupControls();

    // Verifica parâmetros compartilhados na URL
    const urlParams = new URLSearchParams(window.location.search);
    let year = urlParams.get('year');
    let season = urlParams.get('season');
    const mylistParam = urlParams.get('mylist');

    if (!year || !season) {
        // Autodetecta a temporada baseada na data de hoje
        const current = getCurrentSeason();
        year = current.year;
        season = current.season;
    }

    document.getElementById('year-input').value = year;
    document.getElementById('season-select').value = season;

    if (mylistParam) {
        sharedListIds = mylistParam.split(',').map(Number);
        showMyListOnly = true;
        document.getElementById('shared-list-banner').style.display = 'flex';
        document.getElementById('mylist-filter-btn').classList.add('active');
    }

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
    const daySelect = document.getElementById('day-select');
    const daySelectDesktop = document.getElementById('day-select-desktop');
    [daySelect, daySelectDesktop].forEach(select => {
        if (select) {
            select.value = selectedDayFilter;
        }
    });
}

function toggleMobileFilters(force) {
    const controls = document.querySelector('.controls');
    const toggle = document.getElementById('mobile-filter-toggle');
    if (!controls) return;

    const shouldOpen = typeof force === 'boolean' ? force : !controls.classList.contains('open');
    controls.classList.toggle('open', shouldOpen);
    document.body.classList.toggle('mobile-filters-open', shouldOpen);

    if (toggle) {
        toggle.setAttribute('aria-expanded', String(shouldOpen));
        toggle.innerHTML = shouldOpen ? '✕ Filtros' : '☰ Filtros';
    }
}

function closeMobileFilters() {
    toggleMobileFilters(false);
}

function setDayFilter(value) {
    selectedDayFilter = value;
    const daySelect = document.getElementById('day-select');
    const daySelectDesktop = document.getElementById('day-select-desktop');
    if (daySelect) daySelect.value = value;
    if (daySelectDesktop) daySelectDesktop.value = value;
    render();
}

// Vinculado ao botão "Buscar" no HTML
function fetchSpecificSeason() {
    const y = document.getElementById('year-input').value;
    const s = document.getElementById('season-select').value;
    if (y && s) loadSeasonData(y, s);
}


async function fetchAnimesAndMerge(year, season, cacheKey) {
    try {
        let allAnimes = [];
        let page = 1;
        let hasNextPage = true;

        while (hasNextPage) {
            const url = `${API_BASE}/seasons/${year}/${season}?page=${page}&sfw=true`;
            const resp = await fetch(url);

            if (resp.status === 429) {
                console.warn("Limite de requisições. Pausando por 2 segundos...");
                await new Promise(r => setTimeout(r, 2000));
                continue;
            }

            if (!resp.ok) throw new Error("Falha na API");

            const data = await resp.json();
            if (data.data) {
                for (const anime of data.data) {
                    const existingIndex = allAnimes.findIndex(a => a.mal_id === anime.mal_id);
                    if (existingIndex > -1) {
                        if (JSON.stringify(anime).length > JSON.stringify(allAnimes[existingIndex]).length) {
                            allAnimes[existingIndex] = anime;
                        }
                    } else {
                        allAnimes.push(anime);
                    }
                }
            }

            hasNextPage = data.pagination.has_next_page;
            if (hasNextPage) {
                page++;
                await new Promise(r => setTimeout(r, 500));
            }
        }

        let hasChanges = false;

        if (animeState.length > 0) {
            const currentIds = new Set(animeState.map(a => a.mal_id));
            for (const newAnime of allAnimes) {
                if (!currentIds.has(newAnime.mal_id)) {
                    animeState.push(newAnime);
                    hasChanges = true;
                } else {
                    const existingIndex = animeState.findIndex(a => a.mal_id === newAnime.mal_id);
                    if (existingIndex > -1 && JSON.stringify(newAnime).length > JSON.stringify(animeState[existingIndex]).length) {
                        animeState[existingIndex] = newAnime;
                        hasChanges = true;
                    }
                }
            }
        } else {
            animeState = allAnimes;
            hasChanges = true;
        }

        if (hasChanges) {
            const cachePayload = { timestamp: Date.now(), data: animeState };
            localStorage.setItem(cacheKey, JSON.stringify(cachePayload));
            render();
        } else {
            const cachePayload = { timestamp: Date.now(), data: animeState };
            localStorage.setItem(cacheKey, JSON.stringify(cachePayload));
        }

    } catch (e) {
        console.error(e);
        if (animeState.length === 0) renderMsg("Erro ao carregar dados. Verifique a conexão.");
    }
}

async function loadSeasonData(year, season) {
    const cacheKey = `season_cache_${year}_${season}`;
    const cachedData = localStorage.getItem(cacheKey);

    if (cachedData) {
        const parsed = JSON.parse(cachedData);
        if (Date.now() - parsed.timestamp < SEASON_CACHE_TTL) {
            console.log("Carregando temporada via cache...");
            animeState = parsed.data;
            render();
            // Stale-while-revalidate background check
            fetchAnimesAndMerge(year, season, cacheKey);
            return;
        }
    }

    renderMsg(`Carregando todos os animes da temporada:  ${season} ${year}. Aguarde...`);
    animeState = [];
    await fetchAnimesAndMerge(year, season, cacheKey);
}

function getActiveMyListIds(seasonKey) {
    const droppedIds = new Set(droppedState[seasonKey] || []);
    return animeState
        .filter(anime => !droppedIds.has(anime.mal_id))
        .map(anime => anime.mal_id);
}

// ==========================================
// 1. FUNÇÃO RENDER atual
// ==========================================
function render() {
    const board = document.getElementById('kanban-board');
    if (!board) return;

    // 1. Salva posições de rolagem da board e das colunas para evitar "pulos"
    const boardScrollLeft = board.scrollLeft;
    const columnScrolls = {};
    board.querySelectorAll('.kanban-column').forEach(col => {
        const header = col.querySelector('.column-header h2');
        const container = col.querySelector('.cards-container');
        if (header && container) {
            columnScrolls[header.innerText] = container.scrollTop;
        }
    });

    board.innerHTML = '';
    const fragment = document.createDocumentFragment();

    const y = document.getElementById('year-input').value;
    const s = document.getElementById('season-select').value;
    const seasonKey = `${y}_${s}`;
    const currentDropped = droppedState[seasonKey] || [];
    const currentMyList = sharedListIds || getActiveMyListIds(seasonKey);

    // Limpa a fila de streamings anterior toda vez que a tela é atualizada
    streamingQueue.length = 0;
    queuedStreamingIds.clear();

    const filtered = animeState.filter(a => {
        const isValidStatus = (a.status === "Currently Airing" || a.status === "Not yet aired" || a.status === "Finished Airing");
        const hasImage = a.images?.jpg?.image_url;

        let matchesSearch = true;
        if (searchTerm.length >= 3) {
            const titleMain = (a.title || "").toLowerCase();
            const titleEn = (a.title_english || "").toLowerCase();

            // Busca por streamings cacheados
            let hasStream = false;
            const cachedStreams = streamingCache[a.mal_id];
            if (cachedStreams && cachedStreams.data) {
                hasStream = cachedStreams.data.some(stream => stream.name.toLowerCase().includes(searchTerm));
            }

            matchesSearch = titleMain.includes(searchTerm) || titleEn.includes(searchTerm) || hasStream;
        }

        let matchesScore = true;
        if (activeScoreFilters.size > 0) {
            const score = a.score;
            let fitsNone = activeScoreFilters.has('none') && (!score || score === null || score === "N/A" || score === 0);
            let fitsLow = activeScoreFilters.has('low') && (score > 0 && score <= 6.99);
            let fitsMid = activeScoreFilters.has('mid') && (score >= 7.0 && score <= 7.99);
            let fitsHigh = activeScoreFilters.has('high') && (score >= 8.0);

            matchesScore = fitsNone || fitsLow || fitsMid || fitsHigh;
        }

        let matchesMyList = true;
        if (showMyListOnly) {
            matchesMyList = currentMyList.includes(a.mal_id);
        }

        return isValidStatus && hasImage && matchesSearch && matchesScore && matchesMyList;
    });

    document.getElementById('global-counter').innerText = `Total: ${filtered.length} Animes`;

    let renderedColumns = 0;
    DAYS_ORDER.forEach(day => {
        if (selectedDayFilter !== 'all' && day !== selectedDayFilter) return;

        // Filtra animes do dia considerando horário de exibição no Brasil e a nova regra de "from"
        const allDayAnimes = filtered.filter(a => getBrasilDayEnglish(a.broadcast, a.episodes, a.aired) === day);
        if (allDayAnimes.length === 0 && day === 'Unknown') return;

        renderedColumns += 1;

        // Separa seguindo de dropados
        const following = allDayAnimes.filter(a => !currentDropped.includes(a.mal_id));
        const dropped = allDayAnimes.filter(a => currentDropped.includes(a.mal_id));

        // Junta as listas (seguindo primeiro)
        const sortedDayAnimes = [...following, ...dropped];

        const col = document.createElement('div');
        col.className = 'kanban-column';
        col.innerHTML = `
            <div class="column-header">
                <h2>${DAYS_BR[day]}</h2>
                <span class="day-counter">${allDayAnimes.length}</span>
            </div>
            <div class="cards-container"></div>
        `;

        const container = col.querySelector('.cards-container');
        sortedDayAnimes.forEach(anime => {
            const isDropped = currentDropped.includes(anime.mal_id);
            const card = document.createElement('div');
            card.className = `anime-card ${isDropped ? 'is-dropped' : ''}`;
            card.onclick = () => openAnimeDetails(anime.mal_id);

            card.innerHTML = `
                <div class="card-media">
                    <img src="${anime.images.jpg.image_url}" loading="lazy">
                </div>
                <div class="anime-info">
                    <h3 title="${anime.title}">${anime.title}</h3>
                    <p>${anime.title_english || ''}</p>
                    <p>⭐ ${anime.score || 'N/A'}</p>
                    <div class="streaming-container" id="stream-${anime.mal_id}">
                        <span class="stream-loading">Buscando streamings...</span>
                    </div>
                    <button class="btn-drop-toggle ${isDropped ? 'follow' : 'drop'}" 
                            onclick="event.stopPropagation(); toggleDrop(${anime.mal_id})">
                        ${isDropped ? 'Acompanhar' : 'Dropar'}
                    </button>
                </div>
            `;
            container.appendChild(card);

            const hasValidCache = streamingCache[anime.mal_id] &&
                (Date.now() - streamingCache[anime.mal_id].timestamp < STREAM_CACHE_TTL) &&
                streamingCache[anime.mal_id].data &&
                streamingCache[anime.mal_id].data.length > 0;

            if (!hasValidCache && !queuedStreamingIds.has(anime.mal_id) && streamingQueue.length < STREAMING_QUEUE_CAP) {
                streamingQueue.push(anime.mal_id);
                queuedStreamingIds.add(anime.mal_id);
            }
        });

        fragment.appendChild(col);
    });

    if (renderedColumns === 0) {
        board.innerHTML = '<h3 style="padding:20px; color:var(--text-main);">Nenhum anime encontrado para o dia selecionado.</h3>';
        return;
    }

    board.appendChild(fragment);

    // 2. Restaura posições de rolagem salvas
    board.scrollLeft = boardScrollLeft;
    board.querySelectorAll('.kanban-column').forEach(col => {
        const header = col.querySelector('.column-header h2');
        const container = col.querySelector('.cards-container');
        if (header && container && columnScrolls[header.innerText] !== undefined) {
            container.scrollTop = columnScrolls[header.innerText];
        }
    });

    // Inicia o processamento da fila assim que os cards aparecem na tela
    processStreamingQueue();
}


/// ==========================================
// 2. SISTEMA DE FILA PARA EVITAR ERRO 429
// ==========================================
const streamingQueue = [];
let isProcessingQueue = false;
const queuedStreamingIds = new Set();
const processingStreamingIds = new Set();
const STREAMING_REQUEST_DELAY = 3000;
const STREAMING_MAX_RETRIES = 3;
const STREAMING_RETRY_DELAY = 4000;
const STREAMING_BATCH_SIZE = 4;
const STREAMING_QUEUE_CAP = 20;
let lastStreamingRequestAt = 0;

function normalizeStreamingLinks(items) {
    if (!Array.isArray(items)) return [];

    return items
        .filter(item => item && typeof item === 'object' && item.url)
        .map(item => ({
            name: item.name || 'Link',
            url: item.url
        }))
        .filter(item => /^https?:\/\//i.test(item.url))
        .slice(0, 6);
}

async function fetchStreamingData(id) {
    const cached = streamingCache[id];
    const hasValidCache = cached && (Date.now() - cached.timestamp < STREAM_CACHE_TTL) && Array.isArray(cached.data);

    if (hasValidCache) {
        return cached.data;
    }

    for (let attempt = 0; attempt <= STREAMING_MAX_RETRIES; attempt++) {
        try {
            const waitTime = lastStreamingRequestAt + STREAMING_REQUEST_DELAY - Date.now();
            if (waitTime > 0) {
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }

            lastStreamingRequestAt = Date.now();

            const resp = await fetch(`${API_BASE}/anime/${id}/streaming`, {
                headers: { 'Accept': 'application/json' }
            });

            if (resp.status === 429) {
                throw new Error('RATE_LIMIT');
            }

            if (!resp.ok) {
                if (resp.status === 404) {
                    return [];
                }
                throw new Error(`HTTP_${resp.status}`);
            }

            const result = await resp.json();
            const rawItems = Array.isArray(result?.data) ? result.data : [];
            const streams = normalizeStreamingLinks(rawItems);

            streamingCache[id] = {
                timestamp: Date.now(),
                data: streams
            };
            localStorage.setItem(STREAM_CACHE_KEY, JSON.stringify(streamingCache));
            return streams;
        } catch (e) {
            if (e.message === 'RATE_LIMIT' && attempt < STREAMING_MAX_RETRIES) {
                console.warn(`Limite da API atingido para o ID ${id}. Tentando novamente em ${STREAMING_RETRY_DELAY / 1000}s...`);
                await new Promise(resolve => setTimeout(resolve, STREAMING_RETRY_DELAY));
                continue;
            }

            console.error(`Erro ao buscar streamings para ${id}`, e);
            return [];
        }
    }

    return [];
}

async function processStreamingQueue() {
    if (isProcessingQueue || streamingQueue.length === 0) return;
    isProcessingQueue = true;

    let processedInBatch = 0;
    while (streamingQueue.length > 0 && processedInBatch < STREAMING_BATCH_SIZE) {
        const id = streamingQueue.shift();
        queuedStreamingIds.delete(id);

        if (!id) continue;

        const container = document.getElementById(`stream-${id}`);
        if (!container) continue;

        const cached = streamingCache[id];
            const hasValidCache = cached && (Date.now() - cached.timestamp < STREAM_CACHE_TTL) && Array.isArray(cached.data);
        if (hasValidCache) {
            renderStreamingLinks(container, cached.data);
            processedInBatch++;
            continue;
        }

        if (processingStreamingIds.has(id)) continue;
        processingStreamingIds.add(id);

        try {
            const streams = await fetchStreamingData(id);
            renderStreamingLinks(container, streams);
        } catch (e) {
            console.error(`Erro ao preencher streamings para ${id}`, e);
            container.innerHTML = '<span class="no-stream">Erro ao buscar</span>';
        } finally {
            processingStreamingIds.delete(id);
        }

        processedInBatch++;
        if (streamingQueue.length > 0 && processedInBatch < STREAMING_BATCH_SIZE) {
            await new Promise(resolve => setTimeout(resolve, STREAMING_REQUEST_DELAY));
        }
    }

    isProcessingQueue = false;

    if (streamingQueue.length > 0) {
        setTimeout(processStreamingQueue, 0);
    }
}

function renderStreamingLinks(container, streams) {
    container.innerHTML = '';

    if (streams && streams.length > 0) {
        streams.forEach(stream => {
            const a = document.createElement('a');
            a.href = stream.url;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.className = 'stream-link';
            a.innerText = stream.name;
            a.onclick = (e) => e.stopPropagation();
            container.appendChild(a);
        });
    } else {
        container.innerHTML = '<span class="no-stream">Não disponível</span>';
    }
}


async function openAnimeDetails(id) {
    const anime = animeState.find(a => a.mal_id === id);

    if (!anime) return;

    document.getElementById('m-image').src = anime.images?.jpg?.image_url;


    //id
    document.getElementById('m-id').innerText = id;
    // Preenche as informações básicas
    document.getElementById('m-title').innerText = anime.title;
    document.getElementById('m-title-english').innerText = anime.title_english || 'N/A';

    document.getElementById('m-synopsis').innerText = anime.synopsis || "Sem sinopse disponível.";
    document.getElementById('m-episodes').innerText = anime.episodes || "?";
    document.getElementById('m-duration').innerText = anime.duration || "N/A";
    document.getElementById('m-score').innerText = anime.score || "N/A";
    document.getElementById('m-studio').innerText = anime.studios && anime.studios.length > 0 ? anime.studios[0].name : 'N/A';

    const releaseDateSpan = document.getElementById('m-release-date');
    const releaseDateStrong = releaseDateSpan.previousElementSibling;

    if (!anime.broadcast || (!anime.broadcast.day && !anime.broadcast.string)) {
        if (anime.aired && anime.aired.prop && anime.aired.prop.from && anime.aired.prop.from.year) {
            const f = anime.aired.prop.from;
            const day = f.day ? String(f.day).padStart(2, '0') : '??';
            const month = f.month ? String(f.month).padStart(2, '0') : '??';
            releaseDateStrong.innerText = "Lançamento no Japão previsto para:";
            releaseDateSpan.innerText = `${day}/${month}/${f.year}`;
        } else {
            releaseDateStrong.innerText = "🕗Japão:";
            releaseDateSpan.innerText = "N/A";
        }
    } else {
        releaseDateStrong.innerText = "🕗Japão:";
        releaseDateSpan.innerText = anime.broadcast.string || "N/A";
    }

    document.getElementById('m-broadcast').innerText = getBrasilBroadcast(anime.broadcast, anime.episodes, anime.aired);

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
        const streams = await fetchStreamingData(id);
        renderStreamingLinks(streamContainer, streams);
    } catch (e) {
        streamContainer.innerHTML = '<span class="no-stream">Não foi possível carregar as opções</span>';
    }
}

function closeModal() { document.getElementById('anime-modal').style.display = 'none'; }

// toggleOthersColumn removida
function renderMsg(m) { document.getElementById('kanban-board').innerHTML = `<h3 style="padding:20px; color:var(--text-main);">${m}</h3>`; }

// Correção do Botão de Tema
function updateLogoForTheme() {
    const logo = document.getElementById('site-logo');
    if (!logo) return;

    const isDark = document.body.classList.contains('dark-mode');
    logo.src = isDark ? 'animegrid_escuro_logo.png' : 'animegrid_claro_logo.png';
    logo.alt = isDark ? 'Logo AnimeGrid escuro' : 'Logo AnimeGrid claro';
}

function initTheme() {
    if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode');
    updateLogoForTheme();
}

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
    updateLogoForTheme();
}

function copyTitle() {
    const titleText = document.getElementById('m-title').innerText;

    navigator.clipboard.writeText(titleText).then(() => {
        const btn = document.querySelector('.copy-btn');

        // Ativa o feedback visual (pisca em verde)
        btn.classList.add('copied');

        setTimeout(() => {
            btn.classList.remove('copied');
        }, 1500);
    }).catch(err => {
        console.error('Erro ao copiar: ', err);
    });
}

/* ==========================================
   3. FUNÇÕES ADICIONAIS PARA MINHA LISTA E COMPARTILHAMENTO
   ========================================== */

function toggleMyList(mal_id) {
    const y = document.getElementById('year-input').value;
    const s = document.getElementById('season-select').value;
    const key = `${y}_${s}`;
    if (!myListState[key]) myListState[key] = [];

    const index = myListState[key].indexOf(mal_id);
    if (index > -1) {
        myListState[key].splice(index, 1);
    } else {
        myListState[key].push(mal_id);
    }

    localStorage.setItem(MY_LIST_KEY, JSON.stringify(myListState));
    render();
}

function toggleMyListFilter() {
    showMyListOnly = !showMyListOnly;
    const btns = [
        document.getElementById('mylist-filter-btn'),
        document.getElementById('mylist-filter-btn-mobile')
    ];
    btns.forEach(btn => {
        if (!btn) return;
        if (showMyListOnly) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    render();
}

function shareMyList() {
    const y = document.getElementById('year-input').value;
    const s = document.getElementById('season-select').value;
    const key = `${y}_${s}`;
    const list = getActiveMyListIds(key);

    if (list.length === 0) {
        alert("Sua lista de assistir está vazia nesta temporada! Não há nenhum anime não dropado para compartilhar.");
        return;
    }

    const baseUrl = window.location.origin + window.location.pathname;
    const shareUrl = `${baseUrl}?year=${y}&season=${s}&mylist=${list.join(',')}`;

    navigator.clipboard.writeText(shareUrl).then(() => {
        const btn = document.getElementById('share-btn');
        const origText = btn.innerText;
        btn.innerText = "📋 Link Copiado!";
        btn.style.background = "#22c55e"; // verde
        btn.style.color = "white";
        setTimeout(() => {
            btn.innerText = origText;
            btn.style.background = ""; // reset
            btn.style.color = "";
        }, 2000);
    }).catch(err => {
        console.error('Erro ao copiar link: ', err);
        alert(`Copie o link manualmente: ${shareUrl}`);
    });
}

function importSharedList() {
    if (!sharedListIds) return;
    const y = document.getElementById('year-input').value;
    const s = document.getElementById('season-select').value;
    const key = `${y}_${s}`;
    myListState[key] = [...sharedListIds];
    localStorage.setItem(MY_LIST_KEY, JSON.stringify(myListState));
    alert("Lista de assistir importada e salva no cache com sucesso!");
    clearSharedList();
}

function clearSharedList() {
    sharedListIds = null;
    showMyListOnly = false;
    document.getElementById('shared-list-banner').style.display = 'none';
    document.getElementById('mylist-filter-btn').classList.remove('active');
    const url = new URL(window.location);
    url.searchParams.delete('mylist');
    window.history.replaceState({}, '', url);
    render();
}