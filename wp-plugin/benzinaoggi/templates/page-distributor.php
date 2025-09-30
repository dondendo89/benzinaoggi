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

get_header();
?>

<div class="bo-container">
    <a href="<?php echo esc_url( home_url('/benzinaoggi-risultati/') ); ?>" class="bo-back" onclick="if(document.referrer){event.preventDefault(); window.history.back();}" style="display:inline-flex;margin:8px 0 16px 0;">
        <span>←</span>
        <span style="margin-left:8px">Torna ai risultati</span>
    </a>
    
    <!-- Contenuto principale -->
    <div id="bo-distributor-content" class="bo-loading">
        <p>Caricamento informazioni distributore...</p>
    </div>
</div>

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
                        ${prices.length > 0 ? prices.map(price => {
                            const v = price.variation;
                            const delta = Number(price.delta || 0);
                            const arrow = v === 'down' ? '⬇️' : (v === 'up' ? '⬆️' : '');
                            const deltaTxt = arrow ? `${arrow} ${(Math.abs(delta)).toFixed(3)}` : '-';
                            return `
                            <div class="bo-price-item">
                                <div>
                                    <div class="bo-fuel-type">${price.fuelType}</div>
                                    ${price.isSelfService ? '<span class="bo-self-service">Self</span>' : ''}
                                </div>
                                <div class="bo-price">€${Number(price.price).toFixed(3)}</div>
                                <div style="min-width:80px;text-align:right;color:${v==='down'?'#16a34a':v==='up'?'#dc2626':'#666'}">${deltaTxt}</div>
                            </div>`;
                        }).join('') : '<p>Nessun prezzo disponibile</p>'}
                    </div>
                </div>
            `;
            
            document.getElementById('bo-distributor-content').innerHTML = content;
        }
        
        // Carica i dati quando la pagina è pronta
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', loadDistributorData);
        } else {
            loadDistributorData();
        }
    })();
</script>

<?php get_footer();
