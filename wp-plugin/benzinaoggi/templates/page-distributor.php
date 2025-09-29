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

<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?php the_title(); ?> - <?php bloginfo('name'); ?></title>
    
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
        .bo-back {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: #ffffff;
            color: #1e3a5f;
            border: 1px solid rgba(255,255,255,0.6);
            padding: 8px 12px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            margin-top: 12px;
        }
        .bo-back:hover { background: rgba(255,255,255,0.9); }
        
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
        
        @media (max-width: 768px) {
            .bo-content {
                grid-template-columns: 1fr;
                gap: 20px;
            }
            
            .bo-container {
                padding: 15px;
            }
        }
    </style>
</head>

<body <?php body_class(); ?>>
    <div class="bo-container">
        <!-- Header globale già reso via wp_body_open -->
        <a href="<?php echo esc_url( home_url('/benzinaoggi-risultati/') ); ?>" class="bo-back" onclick="if(document.referrer){event.preventDefault(); window.history.back();}" style="display:inline-flex;margin:8px 0 16px 0;">
            <span>←</span>
            <span style="margin-left:8px">Torna ai risultati</span>
        </a>
        
        <!-- Contenuto principale -->
        <div id="bo-distributor-content" class="bo-loading">
            <p>Caricamento informazioni distributore...</p>
        </div>
    </div>

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
        }
        
        // Carica i dati quando la pagina è pronta
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', loadDistributorData);
        } else {
            loadDistributorData();
        }
    })();
    </script>
</body>
</html>
