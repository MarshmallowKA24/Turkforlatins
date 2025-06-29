let decks = [];
let currentImage = null;

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    // Cargar datos del localStorage
    const savedDecks = localStorage.getItem('flashcards-decks');
    if (savedDecks) {
        try {
            decks = JSON.parse(savedDecks);
            // Validar integridad de los decks cargados
            validateDecksIntegrity();
        } catch (e) {
            console.error('Error al cargar decks:', e);
            decks = [];
        }
    }
    
    updateDecksDisplay();
    updateDeckSelector();
    
    // Event listeners
    setupEventListeners();
    
    // Escuchar mensajes de la ventana de estudio
    setupMessageListener();
});

// Validar integridad de decks cargados
function validateDecksIntegrity() {
    decks = decks.filter(deck => {
        // Validar estructura básica del deck
        if (!deck || typeof deck !== 'object') return false;
        if (!deck.id) return false;
        if (!deck.name) return false;
        if (!Array.isArray(deck.cards)) deck.cards = [];
        
        // Validar tarjetas del deck
        deck.cards = deck.cards.filter(card => {
            return card && typeof card === 'object' && card.id && card.front && card.back;
        });
        
        return true;
    });
    
    console.log('Decks validados:', decks.length);
}
function getInitialStudyParams() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
        deckId: urlParams.get('deckId'),
        isLearned: urlParams.get('isLearned') === 'true',
        viewOnly: urlParams.get('viewOnly') === 'true'
    };
}

// Configurar listener de mensajes para comunicación con study.html
function setupMessageListener() {
    window.addEventListener('message', function(event) {
        // Verificar origen del mensaje por seguridad
        if (event.origin !== window.location.origin) {
            console.warn('Mensaje de origen no confiable:', event.origin);
            return;
        }
        
        console.log('Mensaje recibido:', event.data);
        
        // Manejar diferentes tipos de mensajes
        switch(event.data.type) {
            case 'updateCardStatus':
                const { deckId, cardId, learned } = event.data;
                console.log(`Actualizando tarjeta ${cardId} en deck ${deckId}, aprendida: ${learned}`);
                updateCardLearningStatus(deckId, cardId, learned);
                break;
                
            case 'moveCardBack':
                const { deckId: moveToOriginDeckId, cardId: cardToMoveId } = event.data;
                console.log(`Moviendo tarjeta ${cardToMoveId} de vuelta desde deck ${moveToOriginDeckId}`);
                moveCardBackToOriginalDeck(moveToOriginDeckId, cardToMoveId);
                break;
                
            case 'requestData':
                // Solicitud de datos desde study.html
                const requestedDeckId = event.data.deckId;
                const deck = decks.find(d => String(d.id) === String(requestedDeckId));
                if (deck) {
                    const responseData = {
                        type: 'dataResponse',
                        deckId: String(deck.id),
                        deckName: deck.name,
                        cardsData: deck.cards,
                        unlearnedCount: deck.cards.filter(c => !c.learned).length,
                        viewOnly: deck.isLearnedDeck || false,
                        isLearnedDeck: deck.isLearnedDeck || false
                    };
                    event.source.postMessage(responseData, '*');
                }
                break;
                
            default:
                console.log('Tipo de mensaje no reconocido:', event.data.type);
        }
    });
}
// FUNCIÓN ADICIONAL: Para que study.html pueda solicitar datos
function handleDataRequest(event) {
    if (event.data.type === 'requestInitialData') {
        const deckId = event.data.deckId;
        const deck = decks.find(d => String(d.id) === String(deckId));
        
        if (deck) {
            const responseData = {
                type: 'initialDataResponse',
                deckId: String(deck.id),
                deckName: deck.name,
                cardsData: deck.cards,
                unlearnedCount: deck.cards.filter(c => !c.learned).length,
                viewOnly: deck.isLearnedDeck || false,
                isLearnedDeck: deck.isLearnedDeck || false
            };
            
            console.log('📤 Respondiendo solicitud de datos iniciales:', responseData);
            event.source.postMessage(responseData, '*');
        }
    }
}

// Actualizar estado de aprendizaje de una tarjeta
function updateCardLearningStatus(deckId, cardId, learned) {
    console.log('=== INICIO updateCardLearningStatus ===');
    console.log('Parámetros recibidos:', { deckId, cardId, learned });
    console.log('Decks disponibles:', decks.map(d => ({ id: d.id, name: d.name, cardsCount: d.cards.length })));
    
    // Convertir deckId a string para comparación consistente
    const deckIdStr = String(deckId);
    const deck = decks.find(d => String(d.id) === deckIdStr);
    
    if (!deck) {
        console.error('❌ Deck no encontrado:', deckId, 'Decks disponibles:', decks.map(d => d.id));
        showError('Deck no encontrado');
        return;
    }
    
    console.log('✅ Deck encontrado:', deck.name);
    
    const cardIndex = deck.cards.findIndex(c => String(c.id) === String(cardId));
    if (cardIndex === -1) {
        console.error('❌ Tarjeta no encontrada:', cardId, 'Tarjetas disponibles:', deck.cards.map(c => c.id));
        showError('Tarjeta no encontrada');
        return;
    }
    
    const card = deck.cards[cardIndex];
    console.log('✅ Tarjeta encontrada:', card.front);
    
    if (learned) {
        console.log('📚 Marcando tarjeta como aprendida...');
        
        // Marcar como aprendida
        card.learned = true;
        card.learnedAt = new Date().toISOString();
        card.sourceDeck = deck.name;
        card.sourceDeckId = deck.id;
        
        console.log('Tarjeta actualizada:', { 
            learned: card.learned, 
            learnedAt: card.learnedAt, 
            sourceDeck: card.sourceDeck,
            sourceDeckId: card.sourceDeckId 
        });
        
        // Buscar o crear EL deck de aprendidas (uno solo para todas)
        let learnedDeck = decks.find(d => d.id === 'learned_deck' && d.isLearnedDeck);
        
        if (!learnedDeck) {
            console.log('🆕 Creando nuevo deck de aprendidas...');
            learnedDeck = {
                id: 'learned_deck', // ID fijo para el deck único de aprendidas
                name: 'Tarjetas Aprendidas',
                description: 'Todas las tarjetas que has dominado',
                category: 'Aprendidas',
                cards: [],
                created: new Date().toISOString(),
                isLearnedDeck: true
            };
            decks.push(learnedDeck);
            console.log('✅ Deck de aprendidas creado');
        } else {
            console.log('✅ Deck de aprendidas existente encontrado:', learnedDeck.name);
        }
        
        // Mover la tarjeta al deck de aprendidas
        console.log('📦 Moviendo tarjeta al deck de aprendidas...');
        learnedDeck.cards.push({ ...card }); // Crear copia para evitar referencias
        deck.cards.splice(cardIndex, 1);
        
        console.log(`✅ Tarjeta "${card.front}" movida a "Tarjetas Aprendidas"`);
        console.log('Estado final deck aprendidas:', learnedDeck.cards.length, 'tarjetas');
        console.log('Estado final deck original:', deck.cards.length, 'tarjetas');
    } else {
        console.log('❌ Marcando tarjeta como NO aprendida...');
        card.learned = false;
        delete card.learnedAt;
        console.log(`Tarjeta ${cardId} marcada como no aprendida`);
    }
    
    // Guardar y actualizar UI
    console.log('💾 Guardando cambios...');
    saveDecks();
    updateDecksDisplay();
    console.log('=== FIN updateCardLearningStatus ===');
}

// Mover tarjeta de vuelta a su deck original (desde deck de aprendidas)
function moveCardBackToOriginalDeck(learnedDeckId, cardId) {
    console.log('=== INICIO moveCardBackToOriginalDeck ===');
    console.log('Parámetros:', { learnedDeckId, cardId });
    
    const learnedDeck = decks.find(d => String(d.id) === String(learnedDeckId));
    if (!learnedDeck || !learnedDeck.isLearnedDeck) {
        console.error('❌ Deck de aprendidas no encontrado');
        showError('Deck de aprendidas no encontrado');
        return;
    }
    
    console.log('✅ Deck de aprendidas encontrado:', learnedDeck.name);
    
    const cardIndex = learnedDeck.cards.findIndex(c => String(c.id) === String(cardId));
    if (cardIndex === -1) {
        console.error('❌ Tarjeta no encontrada en deck de aprendidas');
        showError('Tarjeta no encontrada');
        return;
    }
    
    const card = learnedDeck.cards[cardIndex];
    console.log('✅ Tarjeta encontrada:', card.front);
    
    // Buscar el deck original usando el ID guardado
    let originalDeck = decks.find(d => String(d.id) === String(card.sourceDeckId));
    
    // Si no existe el deck original por ID, buscar por nombre
    if (!originalDeck) {
        const originalDeckName = card.sourceDeck;
        originalDeck = decks.find(d => d.name === originalDeckName && !d.isLearnedDeck);
        
        // Si tampoco existe por nombre, crearlo
        if (!originalDeck) {
            console.log('🆕 Creando deck original restaurado...');
            originalDeck = {
                id: generateUniqueId(),
                name: originalDeckName || 'Deck Restaurado',
                description: 'Deck restaurado automáticamente',
                category: 'Restaurado',
                cards: [],
                created: new Date().toISOString()
            };
            decks.push(originalDeck);
        }
    }
    
    console.log('✅ Deck original:', originalDeck.name);
    
    // Resetear el estado de la tarjeta
    card.learned = false;
    delete card.learnedAt;
    delete card.sourceDeck;
    delete card.sourceDeckId;
    
    // Mover la tarjeta de vuelta al deck original
    originalDeck.cards.push(card);
    
    // Eliminar del deck de aprendidas
    learnedDeck.cards.splice(cardIndex, 1);
    
    // Si el deck de aprendidas queda vacío, eliminarlo
    if (learnedDeck.cards.length === 0) {
        decks = decks.filter(d => d.id !== learnedDeck.id);
        console.log(`🗑️ Deck de aprendidas "${learnedDeck.name}" eliminado por estar vacío`);
    }
    
    console.log(`✅ Tarjeta "${card.front}" movida de vuelta a "${originalDeck.name}"`);
    
    // Guardar cambios
    saveDecks();
    
    // Actualizar display
    updateDecksDisplay();
    console.log('=== FIN moveCardBackToOriginalDeck ===');
}

// Generar ID único más confiable
function generateUniqueId() {
    return Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Mostrar error al usuario
function showError(message) {
    // Si existe un modal de error personalizado, usarlo
    if (typeof showModal === 'function') {
        showModal('Error', message);
    } else {
        alert('❌ ' + message);
    }
}

// Configurar event listeners
function setupEventListeners() {
    // Navegación por tabs
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            switchTab(tabName);
        });
    });

    // Botón crear deck
    const createDeckBtn = document.querySelector('.create-deck-btn');
    if (createDeckBtn) {
        createDeckBtn.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            switchTab(tabName);
        });
    }

    // Formularios
    const deckForm = document.getElementById('deck-form');
    const cardForm = document.getElementById('card-form');
    
    if (deckForm) deckForm.addEventListener('submit', createDeck);
    if (cardForm) cardForm.addEventListener('submit', createCard);
    
    // Upload de imagen
    const imageUpload = document.getElementById('image-upload');
    const imageInput = document.getElementById('image-input');
    
    if (imageUpload && imageInput) {
        imageUpload.addEventListener('click', function() {
            imageInput.click();
        });
        imageInput.addEventListener('change', handleImageUpload);
    }
    
    // Vista previa
    const previewBtn = document.getElementById('preview-btn');
    const previewCard = document.getElementById('preview-card');
    
    if (previewBtn) previewBtn.addEventListener('click', previewCard);
    if (previewCard) previewCard.addEventListener('click', function() {
        flipCard(this);
    });
}

// Función para cambiar tabs
function switchTab(tabName) {
    // Quitar active de todo
    document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // Seleccionar botón y contenido
    const tabBtn = document.querySelector(`.nav-tab[data-tab="${tabName}"]`);
    const tabContent = document.getElementById(tabName);

    if (!tabBtn) {
        console.warn('No se encontró botón con data-tab:', tabName);
        return;
    }
    if (!tabContent) {
        console.warn('No se encontró contenido con id:', tabName);
        return;
    }

    // Agregar active
    tabBtn.classList.add('active');
    tabContent.classList.add('active');

    if (tabName === 'create-card') updateDeckSelector();
}

// Crear nuevo deck
function createDeck(e) {
    e.preventDefault();
    
    const nameInput = document.getElementById('deck-name');
    const descriptionInput = document.getElementById('deck-description');
    const categoryInput = document.getElementById('deck-category');
    
    if (!nameInput || !descriptionInput || !categoryInput) {
        showError('Formulario incompleto');
        return;
    }
    
    const name = nameInput.value.trim();
    const description = descriptionInput.value.trim();
    const category = categoryInput.value;
    
    if (!name) {
        showError('Por favor ingresa un nombre para el deck');
        return;
    }
    
    // Verificar que no exista un deck con el mismo nombre
    if (decks.some(d => d.name.toLowerCase() === name.toLowerCase() && !d.isLearnedDeck)) {
        showError('Ya existe un deck con ese nombre');
        return;
    }
    
    const newDeck = {
        id: generateUniqueId(),
        name,
        description: description || 'Sin descripción',
        category: category || 'General',
        cards: [],
        created: new Date().toISOString()
    };
    
    decks.push(newDeck);
    saveDecks();
    updateDecksDisplay();
    updateDeckSelector();
    
    // Limpiar formulario
    document.getElementById('deck-form').reset();
    
    // Cambiar a la vista de decks
    switchTab('decks');
    
    alert('✅ Deck creado exitosamente!');
}

// Crear nueva tarjeta
function createCard(e) {
    e.preventDefault();
    
    const deckSelect = document.getElementById('card-deck');
    const frontInput = document.getElementById('card-front');
    const backInput = document.getElementById('card-back');
    
    if (!deckSelect || !frontInput || !backInput) {
        showError('Formulario incompleto');
        return;
    }
    
    const deckId = deckSelect.value;
    const front = frontInput.value.trim();
    const back = backInput.value.trim();
    
    if (!deckId) {
        showError('Por favor selecciona un deck');
        return;
    }
    
    if (!front || !back) {
        showError('Por favor completa el frente y reverso de la tarjeta');
        return;
    }
    
    const deck = decks.find(d => String(d.id) === String(deckId));
    if (!deck) {
        showError('Deck no encontrado');
        updateDeckSelector(); // Actualizar selector en caso de inconsistencia
        return;
    }
    
    const newCard = {
        id: generateUniqueId(),
        front,
        back,
        image: currentImage,
        learned: false,
        created: new Date().toISOString()
    };
    
    deck.cards.push(newCard);
    saveDecks();
    updateDecksDisplay();
    
    // Limpiar formulario
    document.getElementById('card-form').reset();
    const cardPreview = document.getElementById('card-preview');
    if (cardPreview) cardPreview.style.display = 'none';
    resetImageUpload();
    
    alert('✅ Tarjeta creada exitosamente!');
}

// Manejar subida de imagen
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) {
        resetImageUpload();
        return;
    }
    
    // Validar tamaño (5MB máx)
    if (file.size > 5 * 1024 * 1024) {
        showError('La imagen debe ser menor a 5MB');
        resetImageUpload();
        return;
    }
    
    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
        showError('Por favor selecciona un archivo de imagen válido');
        resetImageUpload();
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        currentImage = e.target.result;
        
        const uploadArea = document.getElementById('image-upload');
        if (uploadArea) {
            uploadArea.classList.add('has-image');
            uploadArea.innerHTML = `
                <img src="${currentImage}" class="image-preview" alt="Preview">
                <p>✅ Imagen cargada</p>
                <small>Haz clic para cambiar</small>
            `;
        }
    };
    
    reader.onerror = function() {
        showError('Error al cargar la imagen');
        resetImageUpload();
    };
    
    reader.readAsDataURL(file);
}

// Resetear upload de imagen
function resetImageUpload() {
    currentImage = null;
    const uploadArea = document.getElementById('image-upload');
    const imageInput = document.getElementById('image-input');
    
    if (uploadArea) {
        uploadArea.classList.remove('has-image');
        uploadArea.innerHTML = `
            <div id="upload-text">
                <p>📷 Haz clic para agregar una imagen</p>
                <small>JPG, PNG, GIF - Máx. 5MB</small>
            </div>
        `;
    }
    
    if (imageInput) {
        imageInput.value = '';
    }
}

// Vista previa de tarjeta
function previewCard() {
    const frontInput = document.getElementById('card-front');
    const backInput = document.getElementById('card-back');
    
    if (!frontInput || !backInput) {
        showError('Campos de texto no encontrados');
        return;
    }
    
    const front = frontInput.value.trim();
    const back = backInput.value.trim();
    
    if (!front || !back) {
        showError('Completa el frente y reverso de la tarjeta');
        return;
    }
    
    const previewFront = document.getElementById('preview-front');
    const previewBack = document.getElementById('preview-back');
    const previewImage = document.getElementById('preview-image');
    const cardPreview = document.getElementById('card-preview');
    const previewCardEl = document.getElementById('preview-card');
    
    if (previewFront) previewFront.textContent = front;
    if (previewBack) previewBack.textContent = back;
    
    if (previewImage) {
        if (currentImage) {
            previewImage.innerHTML = `<img src="${currentImage}" alt="Card image">`;
        } else {
            previewImage.innerHTML = '';
        }
    }
    
    // Resetear la tarjeta a la vista frontal
    if (previewCardEl) {
        previewCardEl.classList.remove('flipped');
    }
    
    if (cardPreview) {
        cardPreview.style.display = 'block';
    }
}

// Voltear tarjeta
function flipCard(card) {
    if (card) {
        card.classList.toggle('flipped');
    }
}

// Actualizar display de decks - SEPARAR DECKS NORMALES DE APRENDIDAS
function updateDecksDisplay() {
    const container = document.getElementById('decks-container');
    if (!container) return;
    
    // Separar decks normales del deck de aprendidas
    const normalDecks = decks.filter(deck => !deck.isLearnedDeck);
    const learnedDeck = decks.find(deck => deck.isLearnedDeck);
    
    let html = '';
    
    // Solo mostrar sección de aprendidas si existe el deck Y tiene tarjetas
    if (learnedDeck && learnedDeck.cards && learnedDeck.cards.length > 0) {
        html += `
            <div class="learned-section">
                <div class="section-header">
                    <h2>🎯 Tarjetas Aprendidas</h2>
                    <p>Repasa las ${learnedDeck.cards.length} tarjetas que ya dominas</p>
                </div>
                <div class="deck-card learned-deck" onclick="viewDeck('${learnedDeck.id}')">
                    <h3>🎯 ${escapeHtml(learnedDeck.name)}</h3>
                    <p>${escapeHtml(learnedDeck.description)}</p>
                    <div class="deck-stats">
                        <span>📂 Repaso</span>
                        <span>🃏 ${learnedDeck.cards.length} tarjetas</span>
                        <span>✅ ¡Dominas estas!</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Sección de decks normales
    html += `
        <div class="normal-section">
            <div class="section-header">
                <h2>📚 Mis Decks de Estudio</h2>
                <p>Tus decks para aprender</p>
            </div>
    `;
    
    if (normalDecks.length === 0) {
        html += `
            <div class="empty-state">
                <h3>📚 No tienes decks todavía</h3>
                <p>Crea tu primer deck para comenzar a estudiar</p>
            </div>
        `;
    } else {
        html += '<div class="deck-grid">';
        normalDecks.forEach(deck => {
            const name = deck.name ?? 'Sin nombre';
            const description = deck.description ?? 'Sin descripción';
            const category = deck.category ?? 'Sin categoría';
            const cardsCount = deck.cards?.length ?? 0;
            const unlearnedCount = deck.cards?.filter(c => !c.learned).length ?? 0;
            
            html += `
                <div class="deck-card" onclick="viewDeck('${deck.id}')">
                    <button class="delete-btn" onclick="event.stopPropagation(); deleteDeck('${deck.id}')" title="Eliminar deck">×</button>
                    <h3>${escapeHtml(name)}</h3>
                    <p>${escapeHtml(description)}</p>
                    <div class="deck-stats">
                        <span>📂 ${escapeHtml(category)}</span>
                        <span>🃏 ${cardsCount} tarjetas</span>
                        ${unlearnedCount > 0 ? `<span class="unlearned-count">📖 ${unlearnedCount} por aprender</span>` : '<span class="all-learned">✅ Todas aprendidas</span>'}
                    </div>
                </div>
            `;
        });
        html += '</div>';
    }
    
    html += '</div>';
    
    container.innerHTML = html;
}

// Actualizar selector de decks (solo mostrar decks normales)
function updateDeckSelector() {
    const selector = document.getElementById('card-deck');
    if (!selector) return;
    
    const normalDecks = decks.filter(deck => !deck.isLearnedDeck);
    selector.innerHTML = '<option value="">Selecciona un deck</option>' +
        normalDecks.map(deck => `<option value="${deck.id}">${escapeHtml(deck.name)}</option>`).join('');
}

// Ver deck específico - VERSIÓN CORREGIDA
function viewDeck(deckId) {
    console.log('=== INICIO viewDeck ===');
    console.log('Buscando deck con ID:', deckId);
    
    const deck = decks.find(d => String(d.id) === String(deckId));
    if (!deck) {
        showError('Deck no encontrado');
        console.error('❌ Deck no encontrado. ID buscado:', deckId, 'Decks disponibles:', decks.map(d => ({id: d.id, name: d.name})));
        return;
    }
    
    console.log('✅ Deck encontrado:', deck.name, 'Tarjetas:', deck.cards.length);
    
    if (!deck.cards || deck.cards.length === 0) {
        const deckType = deck.isLearnedDeck ? 'deck de aprendidas' : 'deck';
        alert(`📚 El ${deckType} "${deck.name}" está vacío. ${deck.isLearnedDeck ? '¡Aprende algunas tarjetas para llenar este deck!' : '¡Agrega algunas tarjetas!'}`);
        return;
    }

    try {
        console.log('🚀 Abriendo ventana de estudio...');
        
        // PASO 1: Preparar datos antes de abrir la ventana
        const messageData = {
            type: 'init',
            deckId: String(deck.id),
            deckName: deck.name,
            cardsData: deck.cards,
            unlearnedCount: deck.cards.filter(c => !c.learned).length,
            viewOnly: deck.isLearnedDeck || false,
            isLearnedDeck: deck.isLearnedDeck || false
        };
        
        // PASO 2: Crear URL con parámetros para identificación temprana
        const params = new URLSearchParams({
            deckId: String(deck.id),
            isLearned: deck.isLearnedDeck ? 'true' : 'false',
            viewOnly: (deck.isLearnedDeck || false) ? 'true' : 'false'
        });
        
        const studyUrl = `study.html?${params.toString()}`;
        console.log('📋 URL generada:', studyUrl);
        
        // PASO 3: Abrir ventana con URL parametrizada
        const studyWindow = window.open(studyUrl, '_blank');
        if (!studyWindow) {
            showError('No se pudo abrir la ventana de estudio. Verifica que tu navegador permite ventanas emergentes.');
            return;
        }
        
        // PASO 4: Configurar múltiples intentos de envío de datos
        let attempts = 0;
        const maxAttempts = 10;
        const sendInterval = 100; // Enviar cada 100ms
        
        const sendDataInterval = setInterval(() => {
            attempts++;
            console.log(`📤 Intento ${attempts} - Enviando datos a la ventana de estudio...`);
            
            try {
                studyWindow.postMessage(messageData, '*');
                
                // Después de 3 intentos exitosos o máximo de intentos, detener
                if (attempts >= 3 || attempts >= maxAttempts) {
                    clearInterval(sendDataInterval);
                    console.log('✅ Envío de datos completado');
                }
            } catch (error) {
                console.error('❌ Error enviando mensaje:', error);
                if (attempts >= maxAttempts) {
                    clearInterval(sendDataInterval);
                }
            }
        }, sendInterval);
        
        // PASO 5: Timeout de seguridad
        setTimeout(() => {
            clearInterval(sendDataInterval);
        }, 2000);
        
    } catch (error) {
        console.error('❌ Error al abrir ventana de estudio:', error);
        showError('Error al abrir la ventana de estudio');
    }
    
    console.log('=== FIN viewDeck ===');
}
// Eliminar deck normal
function deleteDeck(deckId) {
    const deck = decks.find(d => String(d.id) === String(deckId));
    if (!deck) {
        showError('Deck no encontrado');
        return;
    }
    
    // No permitir eliminar decks de aprendidas desde aquí
    if (deck.isLearnedDeck) {
        showError('No puedes eliminar este deck de aprendidas desde aquí');
        return;
    }
    
    if (confirm(`¿Seguro que quieres eliminar el deck "${deck.name}" y todas sus ${deck.cards.length} tarjetas?`)) {
        // Eliminar el deck principal
        decks = decks.filter(d => String(d.id) !== String(deckId));
        saveDecks();
        updateDecksDisplay();
        updateDeckSelector();
        
        console.log(`Deck "${deck.name}" eliminado exitosamente`);
    }
}

// Eliminar deck de aprendidas
function deleteLearnedDeck(deckId) {
    const deck = decks.find(d => String(d.id) === String(deckId));
    if (!deck || !deck.isLearnedDeck) {
        showError('Deck de aprendidas no encontrado');
        return;
    }
    
    if (confirm(`¿Seguro que quieres eliminar el deck de aprendidas "${deck.name}"? Las tarjetas se moverán de vuelta a su deck original.`)) {
        // Mover todas las tarjetas de vuelta a sus decks originales
        deck.cards.forEach(card => {
            let originalDeck = decks.find(d => String(d.id) === String(card.sourceDeckId));
            
            if (!originalDeck) {
                // Si no existe el deck original, crear uno nuevo
                originalDeck = {
                    id: generateUniqueId(),
                    name: card.sourceDeck || 'Deck Restaurado',
                    description: 'Deck restaurado automáticamente',
                    category: 'Restaurado',
                    cards: [],
                    created: new Date().toISOString()
                };
                decks.push(originalDeck);
            }
            
            // Resetear el estado de la tarjeta
            card.learned = false;
            delete card.learnedAt;
            delete card.sourceDeck;
            delete card.sourceDeckId;
            
            // Mover la tarjeta de vuelta
            originalDeck.cards.push(card);
        });
        
        // Eliminar el deck de aprendidas
        decks = decks.filter(d => String(d.id) !== String(deckId));
        saveDecks();
        updateDecksDisplay();
        updateDeckSelector();
        
        console.log(`Deck de aprendidas "${deck.name}" eliminado y tarjetas restauradas`);
    }
}

// Guardar decks en localStorage con manejo de errores
function saveDecks() {
    try {
        localStorage.setItem('flashcards-decks', JSON.stringify(decks));
    } catch (error) {
        console.error('Error al guardar decks:', error);
        showError('Error al guardar los datos');
    }
}

// Escapar HTML para prevenir XSS
function escapeHtml(text) {
    if (typeof text !== 'string') text = text ? String(text) : '';
    const map = {
        '&': '&amp;',
        '<': '<',
        '>': '>',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Reparar datos corruptos
function repairCorruptedData() {
    console.log('Iniciando reparación de datos...');
    
    // 1. Eliminar decks malformados
    decks = decks.filter(deck => {
        if (!deck || typeof deck !== 'object') return false;
        if (!deck.id) deck.id = generateUniqueId();
        if (!deck.name) deck.name = 'Deck sin nombre';
        return true;
    });
    
    // 2. Reparar estructura de decks
    decks.forEach(deck => {
        if (!Array.isArray(deck.cards)) deck.cards = [];
        if (!deck.category) deck.category = 'General';
        if (!deck.description) deck.description = 'Sin descripción';
        if (!deck.created) deck.created = new Date().toISOString();
        
        // 3. Limpiar tarjetas malformadas
        deck.cards = deck.cards.filter(card => {
            return card && typeof card === 'object' && card.id && card.front && card.back;
        });
        
        // 4. Asignar ID único a tarjetas que no lo tengan
        deck.cards.forEach(card => {
            if (!card.id) card.id = generateUniqueId();
        });
    });
    
    // 5. Asegurar que solo haya un deck de aprendidas
    const learnedDecks = decks.filter(d => d.isLearnedDeck);
    if (learnedDecks.length > 1) {
        const mainLearnedDeck = learnedDecks.find(d => d.id === 'learned_deck') || learnedDecks[0];
        mainLearnedDeck.id = 'learned_deck';
        
        learnedDecks.forEach((deck, index) => {
            if (index > 0 || deck.id !== 'learned_deck') {
                mainLearnedDeck.cards = mainLearnedDeck.cards.concat(deck.cards);
            }
        });
        
        decks = decks.filter(d => !d.isLearnedDeck);
        decks.push(mainLearnedDeck);
    }
    
    saveDecks();
    console.log('Reparación completada. Decks válidos:', decks.length);
}

// Verificar si necesita reparación
function autoRepairIfNeeded() {
    const needsRepair = decks.some(deck => {
        return !deck.id || !deck.name || !Array.isArray(deck.cards);
    });
    
    if (needsRepair) {
        console.log('Datos corruptos detectados, iniciando reparación...');
        repairCorruptedData();
    }
}

document.addEventListener('DOMContentLoaded', function () {
    // Cargar decks desde localStorage
    loadDecks();

    // Reparar datos automáticamente si es necesario
    setTimeout(autoRepairIfNeeded, 100);
});