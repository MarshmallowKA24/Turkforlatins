// study.js

let currentIndex = 0;
let cards = [];
let totalCards = 0;
let deckId = null;
let viewOnly = false;
let isLearnedDeck = false;
let studyWindow = null;

// Inicialización cuando la página carga
document.addEventListener('DOMContentLoaded', function() {
    console.log('[Study.js] DOM cargado, iniciando...');
    
    // Intentar obtener parámetros de la URL primero
    const urlParams = new URLSearchParams(window.location.search);
    const urlDeckId = urlParams.get('deckId');
    
    if (urlDeckId) {
        console.log('[Study.js] Parámetros URL detectados, deckId:', urlDeckId);
        deckId = String(urlDeckId);
        viewOnly = urlParams.get('viewOnly') === 'true';
        isLearnedDeck = urlParams.get('isLearned') === 'true';
        
        // Solicitar datos al padre
        requestDataFromParent();
    }
    
    // Configurar listener para mensajes del padre
    setupMessageListener();
    
    // Configurar navegación por teclado
    setupKeyboardNavigation();
});

// Configurar listener de mensajes
function setupMessageListener() {
    window.addEventListener('message', function(event) {
        // Verificar origen por seguridad
        if (event.origin !== window.location.origin) {
            console.warn('[Study.js] Mensaje de origen no confiable:', event.origin);
            return;
        }

        console.log('[Study.js] Mensaje recibido:', event.data);
        
        const data = event.data;
        
        // Manejar inicialización
        if (data.type === 'init') {
            handleInitMessage(data);
        }
        
        // Manejar respuesta a solicitud de datos
        if (data.type === 'initialDataResponse') {
            handleDataResponse(data);
        }
    });
}

// Solicitar datos al padre
function requestDataFromParent() {
    if (!window.opener || window.opener.closed) {
        console.error('[Study.js] No hay ventana padre disponible');
        showError('Error de comunicación con la ventana principal');
        return;
    }
    
    const requestMessage = {
        type: 'requestInitialData',
        deckId: deckId
    };
    
    console.log('[Study.js] Solicitando datos al padre:', requestMessage);
    
    // Enviar solicitud múltiples veces para asegurar recepción
    let attempts = 0;
    const maxAttempts = 5;
    const requestInterval = setInterval(() => {
        attempts++;
        console.log(`[Study.js] Intento ${attempts} - Solicitando datos...`);
        
        try {
            window.opener.postMessage(requestMessage, '*');
            
            if (attempts >= maxAttempts) {
                clearInterval(requestInterval);
                console.log('[Study.js] Máximo de intentos alcanzado');
            }
        } catch (error) {
            console.error('[Study.js] Error enviando solicitud:', error);
            clearInterval(requestInterval);
        }
    }, 200);
    
    // Timeout de seguridad
    setTimeout(() => {
        clearInterval(requestInterval);
    }, 2000);
}

// Manejar mensaje de inicialización
function handleInitMessage(data) {
    console.log('[Study.js] Procesando mensaje de inicialización:', data);
    
    currentIndex = 0;
    const {
        deckName,
        cardsData,
        unlearnedCount,
        deckId: receivedDeckId,
        viewOnly: isViewOnly,
        isLearnedDeck: flagLearnedDeck
    } = data;

    deckId = String(receivedDeckId);
    viewOnly = !!isViewOnly;
    isLearnedDeck = flagLearnedDeck ||
                    deckName.includes('Aprendidas') ||
                    deckName.includes('Repaso');

    // Inicializar la interfaz
    initializeInterface(deckName, cardsData, unlearnedCount);
}

// Manejar respuesta de datos
function handleDataResponse(data) {
    console.log('[Study.js] Procesando respuesta de datos:', data);
    
    currentIndex = 0;
    const {
        deckName,
        cardsData,
        unlearnedCount,
        deckId: receivedDeckId,
        viewOnly: isViewOnly,
        isLearnedDeck: flagLearnedDeck
    } = data;

    deckId = String(receivedDeckId);
    viewOnly = !!isViewOnly;
    isLearnedDeck = flagLearnedDeck || false;

    // Inicializar la interfaz
    initializeInterface(deckName, cardsData, unlearnedCount);
}

// Inicializar la interfaz
function initializeInterface(deckName, cardsData, unlearnedCount) {
    console.log('[Study.js] Inicializando interfaz...');
    
    if (!cardsData || cardsData.length === 0) {
        showError('No hay tarjetas para estudiar en este deck');
        return;
    }
    
    // Construir la UI
    buildUI(deckName, cardsData, unlearnedCount);
    
    // Renderizar tarjetas
    renderCards(cardsData);
    
    // Configurar variables globales
    totalCards = cards.length;
    
    // Actualizar contador
    updateCounter();
    
    // Configurar listeners
    if (!viewOnly) {
        attachMarkListeners();
    } else {
        addNavigationControls();
    }
    
    // Configurar clic para voltear tarjetas
    const flashcardContainer = document.getElementById('flashcard-container');
    if (flashcardContainer) {
        flashcardContainer.addEventListener('click', onCardClick);
    }
    
    console.log('[Study.js] Interfaz inicializada correctamente');
}

function buildUI(deckName, cardsData, unlearnedCount) {
    let controlsHtml = '';
    if (!viewOnly) {
        if (isLearnedDeck) {
            controlsHtml = `
                <div class="controls">
                    <button class="btn btn-unlearned" id="mark-unlearned">🔄 Reestudiar</button>
                    <button class="btn btn-learned" id="mark-learned">✅ Mantener Aprendida</button>
                </div>`;
        } else {
            controlsHtml = `
                <div class="controls">
                    <button class="btn btn-unlearned" id="mark-unlearned">🔴 No Aprendida</button>
                    <button class="btn btn-learned" id="mark-learned">🟢 Aprendida</button>
                </div>`;
        }
    }

    document.body.innerHTML = `
        <div class="header">
            <h2>${escapeHtml(deckName)}</h2>
            <div class="counter" id="counter">Tarjeta 1 de ${cardsData.length}</div>
            ${isLearnedDeck ? '<div class="progress-info">🎯 Revisa tus tarjetas aprendidas</div>' : ''}
            ${!isLearnedDeck && unlearnedCount > 0 ? `<div class="progress-info">📚 ${unlearnedCount} por aprender</div>` : ''}
        </div>
        <div class="flashcard-container" id="flashcard-container"></div>
        ${controlsHtml}
        ${viewOnly ? '<div class="view-only-notice">👁️ Modo solo lectura - Haz clic en las tarjetas para voltearlas</div>' : ''}
    `;
}

function renderCards(cardsData) {
    const container = document.getElementById('flashcard-container');
    if (!container) {
        console.error('[Study.js] Container de flashcards no encontrado');
        return;
    }
    
    cards = cardsData.map((card, index) => {
        const cardDiv = document.createElement('div');
        cardDiv.className = `flashcard ${index === 0 ? '' : 'hidden'}`;
        cardDiv.id = `card-${card.id}`;
        cardDiv.dataset.index = index;
        cardDiv.dataset.cardId = String(card.id);
        cardDiv.innerHTML = `
            <div class="flashcard-inner">
                <div class="flashcard-front">
                    ${card.image ? `<img src="${card.image}" alt="Card image" style="max-width:150px; max-height:150px; margin-bottom:15px;">` : ''}
                    <h3>${escapeHtml(card.front)}</h3>
                    ${card.sourceDeck ? `<div class="source-deck">📚 Origen: ${escapeHtml(card.sourceDeck)}</div>` : ''}
                    ${card.learnedAt ? `<div class="learned-date">✅ Aprendida: ${formatDate(card.learnedAt)}</div>` : ''}
                </div>
                <div class="flashcard-back">
                    <p>${escapeHtml(card.back)}</p>
                    ${viewOnly && !card.learned ? '<div class="navigation-hint">⬅️ Desliza o usa los botones para navegar</div>' : ''}
                </div>
            </div>`;
        container.appendChild(cardDiv);
        return cardDiv;
    });
    
    console.log('[Study.js] Tarjetas renderizadas:', cards.length);
}

// Adjuntar listeners para los botones de marcar
function attachMarkListeners() {
    const learnedBtn = document.getElementById('mark-learned');
    const unlearnedBtn = document.getElementById('mark-unlearned');
    if (learnedBtn) learnedBtn.addEventListener('click', () => markCard(true));
    if (unlearnedBtn) unlearnedBtn.addEventListener('click', () => markCard(false));
}

// Manejar clic para volteo
function onCardClick(e) {
    const card = e.target.closest('.flashcard');
    if (card && !card.classList.contains('hidden') && !card.classList.contains('swiped')) {
        card.classList.toggle('flipped');
        e.stopPropagation();
    }
}

function setupKeyboardNavigation() {
    document.addEventListener('keydown', function(e) {
        if (viewOnly) {
            if (e.key === 'ArrowLeft') { e.preventDefault(); showPreviousCard(); }
            if (e.key === 'ArrowRight') { e.preventDefault(); showNextCard(); }
            if (e.key === ' ') { e.preventDefault(); flipCurrentCard(); }
        } else {
            if (e.key === '1') { e.preventDefault(); markCard(false); }
            if (e.key === '2') { e.preventDefault(); markCard(true); }
            if (e.key === ' ') { e.preventDefault(); flipCurrentCard(); }
        }
    });
}

function flipCurrentCard() {
    const card = cards[currentIndex];
    if (card && !card.classList.contains('swiped')) {
        card.classList.toggle('flipped');
    }
}

function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', { year:'numeric', month:'short', day:'numeric' });
    } catch {
        return 'Fecha inválida';
    }
}

const escapeHtml = function(text) {
    if (typeof text !== 'string') text = String(text || '');
    const map = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
};

function addNavigationControls() {
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'navigation-controls';
    controlsDiv.innerHTML = `
        <button class="btn btn-nav" id="prev-card" ${currentIndex === 0 ? 'disabled' : ''}>⬅️ Anterior</button>
        <button class="btn btn-nav" id="next-card" ${currentIndex === totalCards - 1 ? 'disabled' : ''}>Siguiente ➡️</button>
        <div class="keyboard-hints"><small>💡 Usa flechas ← → o espacio para navegar</small></div>
    `;
    document.body.appendChild(controlsDiv);
    
    const prevBtn = document.getElementById('prev-card');
    const nextBtn = document.getElementById('next-card');
    
    if (prevBtn) prevBtn.addEventListener('click', showPreviousCard);
    if (nextBtn) nextBtn.addEventListener('click', showNextCard);
}

function updateCounter() {
    const counterEl = document.getElementById('counter');
    if (counterEl) counterEl.textContent = `Tarjeta ${currentIndex+1} de ${totalCards}`;
}

function showPreviousCard() {
    if (currentIndex <= 0) return;
    
    // Resetear flip de la tarjeta actual
    cards[currentIndex].classList.remove('flipped');
    
    currentIndex--;
    
    // Mostrar tarjeta anterior
    cards.forEach((c, i) => c.classList.toggle('hidden', i !== currentIndex));
    
    updateCounter();
    updateNavigationButtons();
}

function showNextCard() {
    if (viewOnly && currentIndex >= totalCards - 1) return;
    if (currentIndex >= totalCards - 1) {
        endSession();
        return;
    }
    
    // Resetear flip de la tarjeta actual
    cards[currentIndex].classList.remove('flipped');
    
    currentIndex++;
    
    // Mostrar siguiente tarjeta
    cards.forEach((c, i) => {
        c.classList.toggle('hidden', i !== currentIndex);
        c.classList.remove('swiped');
    });
    
    updateCounter();
    updateNavigationButtons();
}

function updateNavigationButtons() {
    const prev = document.getElementById('prev-card');
    const next = document.getElementById('next-card');
    if (prev) prev.disabled = currentIndex === 0;
    if (next) next.disabled = currentIndex === totalCards - 1;
}

function endSession() {
    const container = document.getElementById('flashcard-container');
    if (container) {
        container.innerHTML = `
            <h2 style="text-align:center; color:#4CAF50;">✅ ¡Has completado todas las tarjetas!</h2>
            <p style="text-align:center; margin-top:15px;">Regresando al menú...</p>
        `;
    }
    
    // Ocultar controles
    document.querySelectorAll('.controls, .navigation-controls')
            .forEach(el => el.style.display = 'none');
    
    setTimeout(() => {
        if (window.opener && !window.opener.closed) {
            window.close();
        } else {
            window.location.href = 'flashcards.html';
        }
    }, 1300);
}

function markCard(learned) {
    if (viewOnly) return;
    
    const currentCard = cards[currentIndex];
    if (!currentCard) {
        console.error('[Study.js] No hay tarjeta actual para marcar');
        return;
    }

    const cardId = currentCard.dataset.cardId;
    if (!cardId) {
        console.error('[Study.js] cardId inválido:', currentCard);
        return;
    }
    
    if (!window.opener || window.opener.closed) {
        console.error('[Study.js] Ventana padre no disponible');
        showError('Error de comunicación con la ventana principal');
        return;
    }

    const message = isLearnedDeck && !learned
        ? { type: 'moveCardBack', deckId, cardId }
        : { type: 'updateCardStatus', deckId, cardId, learned };

    console.log('[Study.js] Enviando mensaje al padre:', message);
    
    try {
        window.opener.postMessage(message, '*');
        
        // Marcar tarjeta como procesada
        currentCard.classList.add('swiped');
        
        // Avanzar a la siguiente tarjeta después de un breve delay
        setTimeout(() => {
            showNextCard();
        }, 600);
        
    } catch (error) {
        console.error('[Study.js] Error enviando mensaje:', error);
        showError('Error al comunicarse con la ventana principal');
    }
}

// Mostrar error al usuario
function showError(message) {
    console.error('[Study.js] Error:', message);
    
    const container = document.getElementById('flashcard-container');
    if (container) {
        container.innerHTML = `
            <div style="text-align:center; color:#f44336; padding:20px;">
                <h3>❌ Error</h3>
                <p>${escapeHtml(message)}</p>
                <button onclick="window.close()" style="margin-top:15px; padding:10px 20px;">Cerrar</button>
            </div>
        `;
    } else {
        alert('❌ ' + message);
    }
}

// Enviar aviso al cerrar ventana
window.addEventListener('beforeunload', () => {
    if (window.opener && !window.opener.closed) {
        try {
            window.opener.postMessage({ type: 'studyWindowClosed' }, '*');
        } catch (error) {
            console.error('[Study.js] Error enviando mensaje de cierre:', error);
        }
    }
});

// Función de utilidad para debugging
function debugLog(message, data = null) {
    if (console && typeof console.log === 'function') {
        console.log(`[Study.js] ${message}`, data || '');
    }
}