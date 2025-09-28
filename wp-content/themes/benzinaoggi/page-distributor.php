<?php
/**
 * Template Name: Distributore BenzinaOggi
 * 
 * Template personalizzato per le pagine dei distributori di carburante.
 * Questo template viene utilizzato automaticamente per le pagine che contengono
 * il shortcode [carburante_distributor impianto_id=XXXXX]
 */

// Prevenire accesso diretto
if (!defined('ABSPATH')) {
    exit;
}

// Ottieni l'impianto_id dal contenuto della pagina
$impianto_id = null;
$post_content = get_the_content();

// Estrai l'impianto_id dal shortcode
if (preg_match('/\[carburante_distributor impianto_id="?(\d+)"?\]/', $post_content, $matches)) {
    $impianto_id = $matches[1];
}

// Se non troviamo l'impianto_id, mostra errore
if (!$impianto_id) {
    echo '<div class="bo-error">';
    echo '<h2>Errore</h2>';
    echo '<p>Impossibile trovare l\'ID del distributore in questa pagina.</p>';
    echo '</div>';
    return;
}

// Carica il plugin per accedere alle funzioni
$plugin = new BenzinaOggiPlugin();
$logo_url = $plugin->get_logo_url();
?>

<?php
/**
 * Template Name: Distributore BenzinaOggi
 * 
 * Template personalizzato per le pagine dei distributori di carburante.
 */

get_header(); ?>

<main id="main" class="site-main">
    <div class="container">
    
    <!-- CSS del plugin -->
    <style>
        .bo-container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .bo-header {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            background: linear-gradient(135deg, #2c5aa0 0%, #1e3a5f 100%);
            color: white;
            border-radius: 12px;
        }
        
        .bo-logo {
            max-height: 60px;
            margin-bottom: 15px;
        }
        
        .bo-title {
            font-size: 28px;
            margin: 0 0 10px 0;
            font-weight: 600;
        }
        
        .bo-subtitle {
            font-size: 16px;
            opacity: 0.9;
            margin: 0;
        }
        
        .bo-content {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 30px;
        }
        
        .bo-info-card {
            background: white;
            border-radius: 12px;
            padding: 25px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            border: 1px solid #e1e5e9;
        }
        
        .bo-info-card h3 {
            color: #2c5aa0;
            margin: 0 0 15px 0;
            font-size: 20px;
            font-weight: 600;
        }
        
        .bo-info-item {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #f0f0f0;
        }
        
        .bo-info-item:last-child {
            border-bottom: none;
        }
        
        .bo-info-label {
            font-weight: 500;
            color: #666;
        }
        
        .bo-info-value {
            font-weight: 600;
            color: #333;
        }
        
        .bo-prices {
            background: white;
            border-radius: 12px;
            padding: 25px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            border: 1px solid #e1e5e9;
        }
        
        .bo-price-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 0;
            border-bottom: 1px solid #f0f0f0;
        }
        
        .bo-price-item:last-child {
            border-bottom: none;
        }
        
        .bo-fuel-type {
            font-weight: 600;
            color: #333;
        }
        
        .bo-price {
            font-size: 24px;
            font-weight: 700;
            color: #2c5aa0;
        }
        
        .bo-self-service {
            background: #e8f4fd;
            color: #2c5aa0;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
        }
        
        .bo-loading {
            text-align: center;
            padding: 40px;
            color: #666;
        }
        
        .bo-error {
            background: #fee;
            color: #c33;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }
        
        /* Stili per la mappa */
        .bo-map-container {
            margin: 20px 0;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .bo-map {
            width: 100%;
            height: 300px;
            border: none;
        }
        
        .bo-map-actions {
            display: flex;
            gap: 10px;
            margin-top: 15px;
            flex-wrap: wrap;
        }
        
        .bo-map-button {
            background: #2c5aa0;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            transition: background-color 0.3s;
        }
        
        .bo-map-button:hover {
            background: #1e3a5f;
            color: white;
        }
        
        .bo-map-button i {
            font-size: 16px;
        }
        
        /* Stili per le notifiche */
        .bo-notifications {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        
        .bo-notification-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 15px;
        }
        
        .bo-notification-icon {
            width: 24px;
            height: 24px;
            background: #28a745;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 12px;
        }
        
        .bo-notification-toggle {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 15px;
        }
        
        .bo-switch {
            position: relative;
            display: inline-block;
            width: 50px;
            height: 24px;
        }
        
        .bo-switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }
        
        .bo-slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #ccc;
            transition: .4s;
            border-radius: 24px;
        }
        
        .bo-slider:before {
            position: absolute;
            content: "";
            height: 18px;
            width: 18px;
            left: 3px;
            bottom: 3px;
            background-color: white;
            transition: .4s;
            border-radius: 50%;
        }
        
        input:checked + .bo-slider {
            background-color: #2c5aa0;
        }
        
        input:checked + .bo-slider:before {
            transform: translateX(26px);
        }
        
        .bo-notification-info {
            font-size: 14px;
            color: #666;
            line-height: 1.4;
        }
        
        @media (max-width: 768px) {
            .bo-content {
                grid-template-columns: 1fr;
                gap: 20px;
            }
            
            .bo-container {
                padding: 15px;
            }
            
            .bo-map-actions {
                flex-direction: column;
            }
            
            .bo-map-button {
                justify-content: center;
            }
        }
    </style>
</head>

<body <?php body_class(); ?>>
    <div class="bo-container">
        <!-- Header -->
        <div class="bo-header">
            <img src="<?php echo esc_url($logo_url); ?>" alt="BenzinaOggi" class="bo-logo">
            <h1 class="bo-title"><?php the_title(); ?></h1>
            <p class="bo-subtitle">Informazioni e prezzi aggiornati</p>
        </div>
        
        <!-- Contenuto principale -->
        <div id="bo-distributor-content" class="bo-loading">
            <p>Caricamento informazioni distributore...</p>
        </div>
        
        <!-- Sezione Mappa -->
        <div id="bo-map-section" style="display: none;">
            <div class="bo-map-container">
                <iframe id="bo-distributor-map" class="bo-map" src="" frameborder="0" allowfullscreen></iframe>
                <div class="bo-map-actions">
                    <a id="bo-google-maps-btn" href="#" target="_blank" class="bo-map-button">
                        <i>🗺️</i>
                        Apri in Google Maps
                    </a>
                    <a id="bo-directions-btn" href="#" target="_blank" class="bo-map-button">
                        <i>🧭</i>
                        Indicazioni stradali
                    </a>
                </div>
            </div>
        </div>
        
        <!-- Sezione Notifiche -->
        <div id="bo-notifications-section" style="display: none;">
            <div class="bo-notifications">
                <div class="bo-notification-header">
                    <div class="bo-notification-icon">🔔</div>
                    <h3>Notifiche Prezzo</h3>
                </div>
                <div class="bo-notification-toggle">
                    <label class="bo-switch">
                        <input type="checkbox" id="bo-notification-toggle">
                        <span class="bo-slider"></span>
                    </label>
                    <span>Ricevi notifiche quando il prezzo scende</span>
                </div>
                <div class="bo-notification-info">
                    <p>Attiva le notifiche per essere avvisato quando il prezzo del carburante scende in questo distributore. Le notifiche vengono inviate solo quando c'è una variazione significativa del prezzo.</p>
                </div>
            </div>
        </div>
    </div>
</main>

<?php get_footer(); ?>

<!-- JavaScript per caricare i dati -->
<script>
    (function() {
        'use strict';
        
        const impiantoId = <?php echo json_encode($impianto_id); ?>;
        const apiBase = '<?php echo esc_js(get_option('benzinaoggi_api_base', 'https://benzinaoggi.vercel.app')); ?>';
        
        async function loadDistributorData() {
            try {
                const response = await fetch(`${apiBase}/api/distributor/${impiantoId}`);
                const data = await response.json();
                
                if (!data.ok) {
                    throw new Error(data.error || 'Errore nel caricamento dei dati');
                }
                
                renderDistributorInfo(data);
            } catch (error) {
                console.error('Errore:', error);
                document.getElementById('bo-distributor-content').innerHTML = `
                    <div class="bo-error">
                        <h3>Errore nel caricamento</h3>
                        <p>Impossibile caricare le informazioni del distributore.</p>
                        <p>Errore: ${error.message}</p>
                    </div>
                `;
            }
        }
        
        function renderDistributorInfo(data) {
            const distributor = data.distributor;
            const prices = data.prices || [];
            
            const content = `
                <div class="bo-content">
                    <!-- Informazioni distributore -->
                    <div class="bo-info-card">
                        <h3>📍 Informazioni</h3>
                        <div class="bo-info-item">
                            <span class="bo-info-label">Bandiera:</span>
                            <span class="bo-info-value">${distributor.bandiera || 'N/A'}</span>
                        </div>
                        <div class="bo-info-item">
                            <span class="bo-info-label">Comune:</span>
                            <span class="bo-info-value">${distributor.comune || 'N/A'}</span>
                        </div>
                        <div class="bo-info-item">
                            <span class="bo-info-label">Provincia:</span>
                            <span class="bo-info-value">${distributor.provincia || 'N/A'}</span>
                        </div>
                        <div class="bo-info-item">
                            <span class="bo-info-label">Indirizzo:</span>
                            <span class="bo-info-value">${distributor.indirizzo || 'N/A'}</span>
                        </div>
                        <div class="bo-info-item">
                            <span class="bo-info-label">Gestore:</span>
                            <span class="bo-info-value">${distributor.gestore || 'N/A'}</span>
                        </div>
                    </div>
                    
                    <!-- Prezzi carburanti -->
                    <div class="bo-prices">
                        <h3>⛽ Prezzi Carburanti</h3>
                        ${prices.length > 0 ? prices.map(price => `
                            <div class="bo-price-item">
                                <div>
                                    <div class="bo-fuel-type">${price.fuelType}</div>
                                    ${price.isSelfService ? '<span class="bo-self-service">Self</span>' : ''}
                                </div>
                                <div class="bo-price">€${price.price.toFixed(3)}</div>
                            </div>
                        `).join('') : '<p>Nessun prezzo disponibile</p>'}
                    </div>
                </div>
            `;
            
            document.getElementById('bo-distributor-content').innerHTML = content;
            
            // Mostra e configura la mappa
            setupMap(distributor);
            
            // Mostra e configura le notifiche
            setupNotifications(distributor);
        }
        
        function setupMap(distributor) {
            if (!distributor.lat || !distributor.lng) {
                console.warn('Coordinate non disponibili per la mappa');
                return;
            }
            
            const lat = distributor.lat;
            const lng = distributor.lng;
            const address = `${distributor.indirizzo || ''}, ${distributor.comune || ''}, ${distributor.provincia || ''}`.trim();
            
            // Mostra la sezione mappa
            document.getElementById('bo-map-section').style.display = 'block';
            
            // Configura l'iframe della mappa (OpenStreetMap)
            const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lng-0.01},${lat-0.01},${lng+0.01},${lat+0.01}&layer=mapnik&marker=${lat},${lng}`;
            document.getElementById('bo-distributor-map').src = mapUrl;
            
            // Configura i pulsanti Google Maps
            const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
            const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
            
            document.getElementById('bo-google-maps-btn').href = googleMapsUrl;
            document.getElementById('bo-directions-btn').href = directionsUrl;
        }
        
        function setupNotifications(distributor) {
            // Mostra la sezione notifiche
            document.getElementById('bo-notifications-section').style.display = 'block';
            
            // Gestisci il toggle delle notifiche
            const toggle = document.getElementById('bo-notification-toggle');
            const distributorId = distributor.id || impiantoId;
            
            // Carica lo stato salvato dal server
            loadNotificationPreference(distributorId).then(enabled => {
                toggle.checked = enabled;
            }).catch(error => {
                console.warn('Errore nel caricare le preferenze:', error);
                // Fallback: carica da localStorage
                const savedState = localStorage.getItem(`bo_notifications_${distributorId}`);
                if (savedState === 'true') {
                    toggle.checked = true;
                }
            });
            
            // Gestisci il cambio di stato
            toggle.addEventListener('change', function() {
                const isEnabled = this.checked;
                localStorage.setItem(`bo_notifications_${distributorId}`, isEnabled.toString());
                
                if (isEnabled) {
                    subscribeToNotifications(distributorId);
                } else {
                    unsubscribeFromNotifications(distributorId);
                }
            });
        }
        
        function loadNotificationPreference(distributorId) {
            const wpApiUrl = '<?php echo esc_js(home_url('/wp-json/benzinaoggi/v1')); ?>';
            return fetch(`${wpApiUrl}/notifications/preference?distributorId=${distributorId}`)
                .then(response => response.json())
                .then(data => {
                    if (data.ok) {
                        return data.enabled;
                    } else {
                        throw new Error(data.error || 'Errore nel caricamento delle preferenze');
                    }
                });
        }
        
        function subscribeToNotifications(distributorId) {
            // Verifica se OneSignal è disponibile
            if (typeof OneSignal !== 'undefined') {
                OneSignal.showNativePrompt().then(() => {
                    // L'utente ha accettato le notifiche
                    console.log('Notifiche attivate per il distributore:', distributorId);
                    
                    // Salva la preferenza nel database (opzionale)
                    saveNotificationPreference(distributorId, true);
                }).catch(() => {
                    // L'utente ha rifiutato le notifiche
                    console.log('Notifiche rifiutate');
                    document.getElementById('bo-notification-toggle').checked = false;
                });
            } else {
                console.warn('OneSignal non disponibile');
                alert('Le notifiche non sono disponibili. Assicurati che OneSignal sia configurato correttamente.');
                document.getElementById('bo-notification-toggle').checked = false;
            }
        }
        
        function unsubscribeFromNotifications(distributorId) {
            console.log('Notifiche disattivate per il distributore:', distributorId);
            
            // Salva la preferenza nel database (opzionale)
            saveNotificationPreference(distributorId, false);
        }
        
        function saveNotificationPreference(distributorId, enabled) {
            // Salva la preferenza tramite API WordPress
            const wpApiUrl = '<?php echo esc_js(home_url('/wp-json/benzinaoggi/v1')); ?>';
            fetch(`${wpApiUrl}/notifications/preference`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    distributorId: distributorId,
                    enabled: enabled
                })
            }).then(response => response.json())
            .then(data => {
                if (data.ok) {
                    console.log('Preferenza salvata:', data);
                } else {
                    console.warn('Errore nel salvare la preferenza:', data.error);
                }
            }).catch(error => {
                console.warn('Errore nel salvare la preferenza:', error);
            });
        }
        
        // Carica i dati quando la pagina è pronta
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', loadDistributorData);
        } else {
            loadDistributorData();
        }
    })();
</script>
