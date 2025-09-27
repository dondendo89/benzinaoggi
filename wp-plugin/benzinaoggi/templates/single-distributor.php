<?php
/*
Template Name: Distributore Dettaglio
*/

get_header(); ?>

<div class="benzinaoggi-distributor">
    <!-- Header -->
    <header class="bo-header">
        <div class="bo-container">
            <div class="bo-logo">
                <img src="<?php echo plugins_url('assets/logo-benzinaoggi.svg', __FILE__); ?>" alt="BenzinaOggi" class="bo-logo-img">
                <span class="bo-logo-text">BenzinaOggi.it</span>
            </div>
            <nav class="bo-nav">
                <a href="<?php echo home_url(); ?>" class="bo-nav-link">← Torna alla ricerca</a>
            </nav>
        </div>
    </header>

    <!-- Breadcrumb -->
    <div class="bo-breadcrumb">
        <div class="bo-container">
            <a href="<?php echo home_url(); ?>">Home</a> > 
            <a href="<?php echo home_url(); ?>">Distributori</a> > 
            <span id="bo-breadcrumb-current">Caricamento...</span>
        </div>
    </div>

    <!-- Contenuto principale -->
    <main class="bo-main">
        <div class="bo-container">
            <div class="bo-distributor-layout">
                <!-- Info distributore -->
                <div class="bo-distributor-info">
                    <div class="bo-distributor-header">
                        <div class="bo-distributor-brand" id="bo-brand">Caricamento...</div>
                        <div class="bo-distributor-id" id="bo-impianto-id">ID: -</div>
                    </div>
                    
                    <div class="bo-distributor-details">
                        <div class="bo-detail-item">
                            <div class="bo-detail-label">Indirizzo</div>
                            <div class="bo-detail-value" id="bo-address">-</div>
                        </div>
                        <div class="bo-detail-item">
                            <div class="bo-detail-label">Comune</div>
                            <div class="bo-detail-value" id="bo-city">-</div>
                        </div>
                        <div class="bo-detail-item">
                            <div class="bo-detail-label">Provincia</div>
                            <div class="bo-detail-value" id="bo-province">-</div>
                        </div>
                        <div class="bo-detail-item">
                            <div class="bo-detail-label">Gestore</div>
                            <div class="bo-detail-value" id="bo-gestore">-</div>
                        </div>
                    </div>

                    <div class="bo-distributor-actions">
                        <button id="bo-directions" class="bo-action-btn bo-primary">
                            <svg viewBox="0 0 24 24">
                                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                            </svg>
                            Indicazioni
                        </button>
                        <button id="bo-share" class="bo-action-btn bo-secondary">
                            <svg viewBox="0 0 24 24">
                                <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>
                            </svg>
                            Condividi
                        </button>
                    </div>
                </div>

                <!-- Prezzi -->
                <div class="bo-prices-section">
                    <div class="bo-section-header">
                        <h2>Prezzi attuali</h2>
                        <div class="bo-update-time" id="bo-update-time">Aggiornato: -</div>
                    </div>
                    
                    <div class="bo-prices-grid" id="bo-prices-grid">
                        <!-- Prezzi dinamici -->
                    </div>

                    <!-- Notifiche -->
                    <div class="bo-notifications-section">
                        <h3>Notifiche prezzi</h3>
                        <p class="bo-notifications-desc">
                            Ricevi una notifica quando i prezzi scendono per questo distributore
                        </p>
                        <div class="bo-notification-controls" id="bo-notification-controls">
                            <!-- Controlli dinamici -->
                        </div>
                    </div>
                </div>
            </div>

            <!-- Mappa -->
            <div class="bo-map-section">
                <h3>Posizione</h3>
                <div id="bo_detail_map" class="bo-detail-map"></div>
            </div>
        </div>
    </main>
</div>

<style>
/* Reset e base */
.benzinaoggi-distributor {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    line-height: 1.6;
    color: #333;
    background: #f8f9fa;
    min-height: 100vh;
}

.bo-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
}

/* Header */
.bo-header {
    background: #fff;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    position: sticky;
    top: 0;
    z-index: 1000;
}

.bo-header .bo-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 20px;
}

.bo-logo {
    display: flex;
    align-items: center;
    gap: 10px;
}

.bo-logo-img {
    height: 40px;
    width: auto;
}

.bo-logo-text {
    font-size: 24px;
    font-weight: bold;
    color: #2c5aa0;
}

.bo-nav-link {
    text-decoration: none;
    color: #2c5aa0;
    font-weight: 500;
    padding: 8px 16px;
    border: 1px solid #2c5aa0;
    border-radius: 6px;
    transition: all 0.3s;
}

.bo-nav-link:hover {
    background: #2c5aa0;
    color: white;
}

/* Breadcrumb */
.bo-breadcrumb {
    background: white;
    padding: 15px 0;
    border-bottom: 1px solid #e1e5e9;
}

.bo-breadcrumb a {
    color: #2c5aa0;
    text-decoration: none;
}

.bo-breadcrumb a:hover {
    text-decoration: underline;
}

/* Layout principale */
.bo-main {
    padding: 30px 0;
}

.bo-distributor-layout {
    display: grid;
    grid-template-columns: 1fr 400px;
    gap: 30px;
    margin-bottom: 40px;
}

/* Info distributore */
.bo-distributor-info {
    background: white;
    border-radius: 12px;
    padding: 30px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}

.bo-distributor-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 25px;
    padding-bottom: 20px;
    border-bottom: 2px solid #f8f9fa;
}

.bo-distributor-brand {
    font-size: 28px;
    font-weight: bold;
    color: #2c5aa0;
}

.bo-distributor-id {
    background: #e1e5e9;
    color: #666;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 14px;
    font-weight: 600;
}

.bo-distributor-details {
    margin-bottom: 30px;
}

.bo-detail-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid #f8f9fa;
}

.bo-detail-item:last-child {
    border-bottom: none;
}

.bo-detail-label {
    font-weight: 600;
    color: #666;
    min-width: 100px;
}

.bo-detail-value {
    color: #333;
    text-align: right;
    flex: 1;
}

.bo-distributor-actions {
    display: flex;
    gap: 15px;
}

.bo-action-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;
    text-decoration: none;
}

.bo-action-btn svg {
    width: 20px;
    height: 20px;
    fill: currentColor;
}

.bo-primary {
    background: #2c5aa0;
    color: white;
}

.bo-primary:hover {
    background: #1e3a5f;
    transform: translateY(-2px);
}

.bo-secondary {
    background: #f8f9fa;
    color: #666;
    border: 1px solid #e1e5e9;
}

.bo-secondary:hover {
    background: #e9ecef;
}

/* Sezione prezzi */
.bo-prices-section {
    background: white;
    border-radius: 12px;
    padding: 30px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}

.bo-section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 25px;
    padding-bottom: 15px;
    border-bottom: 2px solid #f8f9fa;
}

.bo-section-header h2 {
    margin: 0;
    color: #333;
    font-size: 24px;
}

.bo-update-time {
    color: #666;
    font-size: 14px;
}

.bo-prices-grid {
    display: grid;
    gap: 20px;
    margin-bottom: 30px;
}

.bo-price-card {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 20px;
    border-left: 4px solid #2c5aa0;
}

.bo-price-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
}

.bo-price-fuel {
    font-size: 18px;
    font-weight: bold;
    color: #333;
}

.bo-price-service {
    background: #e1e5e9;
    color: #666;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 12px;
}

.bo-price-main {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
}

.bo-price-value {
    font-size: 32px;
    font-weight: bold;
    color: #2c5aa0;
}

.bo-price-change {
    font-size: 16px;
    font-weight: 600;
}

.bo-price-change.down {
    color: #28a745;
}

.bo-price-change.up {
    color: #dc3545;
}

.bo-price-change.neutral {
    color: #666;
}

/* Notifiche */
.bo-notifications-section {
    border-top: 1px solid #e1e5e9;
    padding-top: 25px;
}

.bo-notifications-section h3 {
    margin: 0 0 10px 0;
    color: #333;
    font-size: 20px;
}

.bo-notifications-desc {
    color: #666;
    margin-bottom: 20px;
}

.bo-notification-controls {
    display: grid;
    gap: 15px;
}

.bo-notification-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px;
    background: #f8f9fa;
    border-radius: 8px;
    border: 1px solid #e1e5e9;
}

.bo-notification-label {
    font-weight: 600;
    color: #333;
}

.bo-notification-toggle {
    position: relative;
    width: 50px;
    height: 24px;
    background: #ccc;
    border-radius: 12px;
    cursor: pointer;
    transition: background 0.3s;
}

.bo-notification-toggle.active {
    background: #2c5aa0;
}

.bo-notification-toggle::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    background: white;
    border-radius: 50%;
    transition: transform 0.3s;
}

.bo-notification-toggle.active::after {
    transform: translateX(26px);
}

/* Mappa */
.bo-map-section {
    background: white;
    border-radius: 12px;
    padding: 30px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}

.bo-map-section h3 {
    margin: 0 0 20px 0;
    color: #333;
    font-size: 20px;
}

.bo-detail-map {
    height: 400px;
    border-radius: 8px;
    overflow: hidden;
}

/* Responsive */
@media (max-width: 768px) {
    .bo-distributor-layout {
        grid-template-columns: 1fr;
        gap: 20px;
    }
    
    .bo-distributor-actions {
        flex-direction: column;
    }
    
    .bo-prices-grid {
        grid-template-columns: 1fr;
    }
    
    .bo-price-main {
        flex-direction: column;
        align-items: flex-start;
        gap: 10px;
    }
    
    .bo-detail-map {
        height: 300px;
    }
}
</style>

<?php get_footer(); ?>
