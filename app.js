const API_BASE = 'https://api.jikan.moe/v4';
const OTHERS_PREF_KEY = 'animeGrid_showOthers';
const DROPPED_KEY = 'animeGrid_dropped_v1';


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

// Configurações de Cache
const SEASON_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas
const STREAM_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 dias
let streamingCache = JSON.parse(localStorage.getItem('animeGrid_stream_cache')) || {};



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
    const btn = document.querySelector(`button[data-filter="${filter}"]`);
    if (activeScoreFilters.has(filter)) {
        activeScoreFilters.delete(filter);
        btn.classList.remove('active');
    } else {
        activeScoreFilters.add(filter);
        btn.classList.add('active');
    }
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
    // Opção de ocultar 'Outros' foi removida a pedido
}

// Vinculado ao botão "Buscar" no HTML
function fetchSpecificSeason() {
    const y = document.getElementById('year-input').value;
    const s = document.getElementById('season-select').value;
    if (y && s) loadSeasonData(y, s);
}
/*
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
*/

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

    renderMsg(`Carregando todos os animes de ${season} ${year}. Aguarde...`);
    animeState = [];
    await fetchAnimesAndMerge(year, season, cacheKey);
}
// ==========================================
// 1. FUNÇÃO RENDER atual
// ==========================================
function render() {
    const board = document.getElementById('kanban-board');
    if (!board) return;
    board.innerHTML = '';
    const fragment = document.createDocumentFragment();

    const y = document.getElementById('year-input').value;
    const s = document.getElementById('season-select').value;
    const seasonKey = `${y}_${s}`;
    const currentDropped = droppedState[seasonKey] || [];

    // Limpa a fila de streamings anterior toda vez que a tela é atualizada
    streamingQueue.length = 0;

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
            let fitsLow = activeScoreFilters.has('low') && (score > 0 && score <= 5.99);
            let fitsMid = activeScoreFilters.has('mid') && (score >= 6.0 && score <= 7.0);
            let fitsHigh = activeScoreFilters.has('high') && (score > 7.0);
            
            matchesScore = fitsNone || fitsLow || fitsMid || fitsHigh;
        }
        
        return isValidStatus && hasImage && matchesSearch && matchesScore;
    });

    document.getElementById('global-counter').innerText = `Total: ${filtered.length} Animes`;

    DAYS_ORDER.forEach(day => {

        // Filtra animes do dia considerando horário de exibição no Brasil e a nova regra de "from"
        const allDayAnimes = filtered.filter(a => getBrasilDayEnglish(a.broadcast, a.episodes, a.aired) === day);
        if (allDayAnimes.length === 0 && day === 'Unknown') return;

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
                <div class="card-media"><img src="${anime.images.jpg.image_url}" loading="lazy"></div>
                <div class="anime-info">
                    <h3>${anime.title}</h3>
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

            // Coloca esse anime na fila para buscar onde assistir
            streamingQueue.push(anime.mal_id);
        });

        fragment.appendChild(col);
    });

    board.appendChild(fragment);

    // Inicia o processamento da fila assim que os cards aparecem na tela
    processStreamingQueue();
}


/// ==========================================
// 2. SISTEMA DE FILA PARA EVITAR ERRO 429
// ==========================================
const streamingQueue = [];
let isProcessingQueue = false;

/*async function processStreamingQueue() {
    // Se já estiver processando, não faz nada
    if (isProcessingQueue) return;
    isProcessingQueue = true;

    while (streamingQueue.length > 0) {
        const { id, container } = streamingQueue.shift();
        
        // Se o card não estiver mais na tela (ex: usuário usou a barra de busca), ignora
        if (!document.body.contains(container)) continue;
        
        // 1. Verifica se já está no cache de streamings
        const cached = streamingCache[id];
        if (cached && (Date.now() - cached.timestamp < STREAM_CACHE_TTL)) {
            renderStreamingLinks(container, cached.data);
            continue; // Pula para o próximo sem gastar tempo de API
        }


        try {
            const resp = await fetch(`${API_BASE}/anime/${id}/streaming`);
            
            if (resp.status === 429) {
                // Se tomar limite da API, devolve pra fila e espera 2 segundos
                streamingQueue.unshift({ id, container }); 
                await new Promise(r => setTimeout(r, 2000)); 
                continue;
            }
            
                const data = await resp.json();
                 
                // Salva no cache
                streamingCache[id] = {
                timestamp: Date.now(),
                data: streams
                };
                localStorage.setItem('animeGrid_stream_cache', JSON.stringify(streamingCache));


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

// Função auxiliar para renderizar os links (evita repetição de código)
function renderStreamingLinks(container, streams) {
    if (streams && streams.length > 0) {
        container.innerHTML = streams.map(s => 
            `<a href="${s.url}" target="_blank" class="mini-stream-link">${s.name}</a>`
        ).join('');
    } else {
        container.innerHTML = '<span class="no-stream">Não disponível</span>';
    }
}
*/

/*async function processStreamingQueue() {
    if (isProcessingQueue || streamingQueue.length === 0) return;
    isProcessingQueue = true;

    while (streamingQueue.length > 0) {
        const id = streamingQueue.shift();
        const container = document.getElementById(`stream-${id}`);
        if (!container) continue;

        // 1. Verifica se já está no cache de streamings
        const cached = streamingCache[id];
        if (cached && (Date.now() - cached.timestamp < STREAM_CACHE_TTL)) {
            renderStreamingLinks(container, cached.data);
            continue; // Pula para o próximo sem gastar tempo de API
        }

        // 2. Se não estiver no cache, busca na API respeitando o delay
        try {
            const resp = await fetch(`${API_BASE}/anime/${id}/streaming`);
            const result = await resp.json();
            const streams = result.data || [];

            // Salva no cache
            streamingCache[id] = {
                timestamp: Date.now(),
                data: streams
            };
            localStorage.setItem('animeGrid_stream_cache', JSON.stringify(streamingCache));

            renderStreamingLinks(container, streams);
            
            // Delay para evitar Erro 429 (Rate Limit)
            await new Promise(resolve => setTimeout(resolve, 500)); 
        } catch (e) {
            console.error(`Erro ao buscar streaming para ${id}`, e);
        }
    }

    isProcessingQueue = false;
}*/
async function processStreamingQueue() {
    if (isProcessingQueue || streamingQueue.length === 0) return;
    isProcessingQueue = true;

    while (streamingQueue.length > 0) {
        const id = streamingQueue.shift();
        const container = document.getElementById(`stream-${id}`);
        if (!container) continue;

        // 1. Verifica se já está no cache
        const cached = streamingCache[id];

        // NOVA REGRA: Só usa o cache se for válido no tempo E se tiver encontrado algum streaming (length > 0).
        // Se o cache existir mas estiver vazio, ele ignora o cache e tenta buscar novamente.
        if (cached && (Date.now() - cached.timestamp < STREAM_CACHE_TTL) && cached.data && cached.data.length > 0) {
            renderStreamingLinks(container, cached.data);
            continue;
        }

        // 2. Se não estiver no cache OU o cache indicava que não tinha streaming, busca na API
        try {
            const resp = await fetch(`${API_BASE}/anime/${id}/streaming`);

            // PROTEÇÃO: Se a API der erro 429 (Muitas requisições), devolve pra fila e pausa
            if (resp.status === 429) {
                console.warn(`Limite da API atingido para o ID ${id}. Pausando fila...`);
                streamingQueue.unshift(id); // Devolve o anime para o início da fila
                await new Promise(resolve => setTimeout(resolve, 2000)); // Pausa a fila por 2 segundos
                continue; // Tenta de novo no próximo loop
            }

            const result = await resp.json();
            const streams = result.data || [];

            // Salva no cache apenas se a resposta for válida
            if (result.data !== undefined) {
                streamingCache[id] = {
                    timestamp: Date.now(),
                    data: streams
                };
                localStorage.setItem('animeGrid_stream_cache', JSON.stringify(streamingCache));
            }

            renderStreamingLinks(container, streams);

            // Delay padrão de 500ms entre as chamadas normais para evitar bloquear a API
            await new Promise(resolve => setTimeout(resolve, 500));

        } catch (e) {
            console.error(`Erro ao buscar streaming para ${id}`, e);
            container.innerHTML = '<span class="no-stream">Erro ao buscar</span>';
        }
    }

    isProcessingQueue = false;
}
/*

// Função auxiliar para renderizar os links usando createElement
function renderStreamingLinks(container, streams) {
    // 1. Limpa o texto "Aguardando fila..."
    container.innerHTML = ''; 

    // 2. Aplica a sua lógica de exibição
    if (streams && streams.length > 0) {
        streams.forEach(stream => {
            const a = document.createElement('a');
            a.href = stream.url;
            a.target = '_blank'; // Abre em nova aba
            
            // Usando a classe stream-link como você solicitou
            a.className = 'stream-link'; 
            a.innerText = stream.name;
            
            // Evita abrir o modal ao clicar no link
            a.onclick = (e) => e.stopPropagation(); 
            
            container.appendChild(a);
        });
    } else {
        container.innerHTML = '<span class="no-stream">Não disponível</span>';
    }
}*/

function renderStreamingLinks(container, streams) {
    // Limpa qualquer mensagem de "Aguardando fila..." ou "Não disponível"
    container.innerHTML = '';

    if (streams && streams.length > 0) {
        streams.forEach(stream => {
            const a = document.createElement('a');
            a.href = stream.url;
            a.target = '_blank';
            a.className = 'stream-link';
            a.innerText = stream.name;
            a.onclick = (e) => e.stopPropagation(); // Evita abrir o modal ao clicar no link
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

// toggleOthersColumn removida
function renderMsg(m) { document.getElementById('kanban-board').innerHTML = `<h3 style="padding:20px; color:var(--text-main);">${m}</h3>`; }

// Correção do Botão de Tema
function initTheme() {
    if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode');
}
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
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