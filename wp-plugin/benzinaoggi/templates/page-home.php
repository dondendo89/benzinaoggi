<?php
/*
Template Name: BenzinaOggi Home
*/

get_header(); ?>

<div class="benzinaoggi-home">
    <!-- Hero Section -->
    <section class="bo-hero">
        <div class="bo-container">
            <div class="bo-hero-content">
                <h1 class="bo-hero-title">Trova i prezzi più bassi della benzina</h1>
                <p class="bo-hero-subtitle">Confronta i prezzi dei carburanti in tempo reale e risparmia</p>
                
                <!-- Form di ricerca -->
                <div class="bo-search-form">
                    <div class="bo-search-row">
                        <div class="bo-search-field">
                            <label for="bo-location">Dove</label>
                            <div class="bo-location-input-group">
                                <input type="text" id="bo-location" placeholder="Inserisci città, indirizzo o CAP" class="bo-input">
                                <button type="button" id="bo-my-location" class="bo-location-btn" title="Usa la mia posizione">
                                    <svg viewBox="0 0 24 24" width="20" height="20">
                                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div class="bo-search-field">
                            <label for="bo-fuel">Carburante</label>
                            <select id="bo-fuel" class="bo-select">
                                <option value="">Tutti i carburanti</option>
                                <option value="Benzina">Benzina</option>
                                <option value="Gasolio">Gasolio</option>
                                <option value="GPL">GPL</option>
                                <option value="Metano">Metano</option>
                            </select>
                        </div>
                        <div class="bo-search-field">
                            <label for="bo-radius">Raggio</label>
                            <select id="bo-radius" class="bo-select">
                                <option value="5">5 km</option>
                                <option value="10" selected>10 km</option>
                                <option value="20">20 km</option>
                                <option value="50">50 km</option>
                            </select>
                        </div>
                        <button type="button" id="bo-search-btn" class="bo-search-btn">
                            <svg class="bo-search-icon" viewBox="0 0 24 24">
                                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                            </svg>
                            Cerca
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Mappa e risultati -->
    <section class="bo-results-section">
        <div class="bo-container">
            <div class="bo-results-layout">
                <!-- Mappa -->
                <div class="bo-map-container">
                    <div id="bo_map" class="bo-map"></div>
                    <div class="bo-map-controls">
                        <button id="bo-my-location" class="bo-map-btn" title="La mia posizione">
                            <svg viewBox="0 0 24 24">
                                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                            </svg>
                        </button>
                    </div>
                </div>

                <!-- Lista risultati -->
                <div class="bo-results-list">
                    <div class="bo-results-header">
                        <h3>Distributori trovati</h3>
                        <span id="bo-results-count" class="bo-results-count">0 risultati</span>
                    </div>
                    <div id="bo-results" class="bo-results-content">
                        <!-- Risultati dinamici -->
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Statistiche -->
    <section class="bo-stats">
        <div class="bo-container">
            <div class="bo-stats-grid">
                <div class="bo-stat">
                    <div class="bo-stat-number">15.000+</div>
                    <div class="bo-stat-label">Distributori</div>
                </div>
                <div class="bo-stat">
                    <div class="bo-stat-number">24/7</div>
                    <div class="bo-stat-label">Aggiornamenti</div>
                </div>
                <div class="bo-stat">
                    <div class="bo-stat-number">€0.15</div>
                    <div class="bo-stat-label">Risparmio medio</div>
                </div>
            </div>
        </div>
    </section>
</div>

<style>
/* Reset e base */
.benzinaoggi-home {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    line-height: 1.6;
    color: #333;
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

.bo-nav {
    display: flex;
    gap: 30px;
}

.bo-nav-link {
    text-decoration: none;
    color: #666;
    font-weight: 500;
    padding: 10px 0;
    border-bottom: 2px solid transparent;
    transition: all 0.3s;
}

.bo-nav-link:hover,
.bo-nav-link.active {
    color: #2c5aa0;
    border-bottom-color: #2c5aa0;
}

/* Hero Section */
.bo-hero {
    background: linear-gradient(135deg, #2c5aa0 0%, #1e3a5f 100%);
    color: white;
    padding: 60px 0;
    text-align: center;
}

.bo-hero-title {
    font-size: 48px;
    font-weight: bold;
    margin-bottom: 20px;
}

.bo-hero-subtitle {
    font-size: 20px;
    margin-bottom: 40px;
    opacity: 0.9;
}

/* Form di ricerca */
.bo-search-form {
    background: white;
    border-radius: 12px;
    padding: 30px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    max-width: 800px;
    margin: 0 auto;
}

.bo-search-row {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr auto;
    gap: 20px;
    align-items: end;
}

.bo-search-field {
    display: flex;
    flex-direction: column;
}

.bo-search-field label {
    font-weight: 600;
    margin-bottom: 8px;
    color: #333;
    font-size: 14px;
}

.bo-location-input-group {
    position: relative;
    display: flex;
}

.bo-location-input-group .bo-input {
    padding: 12px 50px 12px 16px;
    border: 2px solid #e1e5e9;
    border-radius: 8px;
    font-size: 16px;
    transition: border-color 0.3s;
    flex: 1;
}

.bo-location-btn {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    padding: 8px;
    cursor: pointer;
    color: #666;
    border-radius: 4px;
    transition: all 0.3s;
}

.bo-location-btn:hover {
    background: #f0f0f0;
    color: #2c5aa0;
}

.bo-location-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.bo-welcome-message {
    text-align: center;
    padding: 40px 20px;
    background: #f8f9fa;
    border-radius: 12px;
    margin: 20px 0;
}

.bo-welcome-message h3 {
    color: #2c5aa0;
    margin-bottom: 16px;
    font-size: 24px;
}

.bo-welcome-message p {
    color: #666;
    margin-bottom: 12px;
    font-size: 16px;
    line-height: 1.5;
}

.bo-input,
.bo-select {
    padding: 12px 16px;
    border: 2px solid #e1e5e9;
    border-radius: 8px;
    font-size: 16px;
    transition: border-color 0.3s;
}

.bo-input:focus,
.bo-select:focus {
    outline: none;
    border-color: #2c5aa0;
}

.bo-search-btn {
    background: #2c5aa0;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: background 0.3s;
}

.bo-search-btn:hover {
    background: #1e3a5f;
}

.bo-search-icon {
    width: 20px;
    height: 20px;
    fill: currentColor;
}

/* Layout risultati */
.bo-results-section {
    padding: 40px 0;
    background: #f8f9fa;
}

.bo-results-layout {
    display: grid;
    grid-template-columns: 1fr 400px;
    gap: 30px;
    height: 600px;
}

/* Mappa */
.bo-map-container {
    position: relative;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}

.bo-map {
    width: 100%;
    height: 100%;
}

.bo-map-controls {
    position: absolute;
    top: 20px;
    right: 20px;
    z-index: 1000;
}

.bo-map-btn {
    background: white;
    border: none;
    border-radius: 8px;
    padding: 12px;
    cursor: pointer;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    transition: all 0.3s;
}

.bo-map-btn:hover {
    background: #f8f9fa;
    transform: translateY(-2px);
}

.bo-map-btn svg {
    width: 20px;
    height: 20px;
    fill: #2c5aa0;
}

/* Lista risultati */
.bo-results-list {
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    display: flex;
    flex-direction: column;
}

.bo-results-header {
    padding: 20px;
    border-bottom: 1px solid #e1e5e9;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.bo-results-header h3 {
    margin: 0;
    color: #333;
}

.bo-results-count {
    background: #2c5aa0;
    color: white;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 14px;
    font-weight: 600;
}

.bo-results-content {
    flex: 1;
    overflow-y: auto;
    padding: 0;
}

.bo-result-item {
    padding: 20px;
    border-bottom: 1px solid #e1e5e9;
    cursor: pointer;
    transition: background 0.3s;
}

.bo-result-item:hover {
    background: #f8f9fa;
}

.bo-result-item:last-child {
    border-bottom: none;
}

.bo-result-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 10px;
}

.bo-result-brand {
    font-weight: bold;
    color: #2c5aa0;
    font-size: 18px;
}

.bo-result-distance {
    background: #e1e5e9;
    color: #666;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 12px;
}

.bo-result-address {
    color: #666;
    margin-bottom: 10px;
}

.bo-result-prices {
    display: flex;
    gap: 15px;
    flex-wrap: wrap;
}

.bo-price-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 80px;
}

.bo-price-label {
    font-size: 12px;
    color: #666;
    margin-bottom: 4px;
}

.bo-price-value {
    font-weight: bold;
    color: #2c5aa0;
    font-size: 16px;
}

.bo-price-change {
    font-size: 12px;
    margin-top: 2px;
}

.bo-price-change.down {
    color: #28a745;
}

.bo-price-change.up {
    color: #dc3545;
}

/* Statistiche */
.bo-stats {
    background: #2c5aa0;
    color: white;
    padding: 60px 0;
}

.bo-stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 40px;
    text-align: center;
}

.bo-stat-number {
    font-size: 48px;
    font-weight: bold;
    margin-bottom: 10px;
}

.bo-stat-label {
    font-size: 18px;
    opacity: 0.9;
}

/* Responsive */
@media (max-width: 768px) {
    .bo-hero-title {
        font-size: 32px;
    }
    
    .bo-search-row {
        grid-template-columns: 1fr;
        gap: 15px;
    }
    
    .bo-results-layout {
        grid-template-columns: 1fr;
        height: auto;
    }
    
    .bo-map {
        height: 400px;
    }
    
    .bo-stats-grid {
        grid-template-columns: 1fr;
        gap: 30px;
    }
    
    .bo-nav {
        display: none;
    }
}
</style>

<?php get_footer(); ?>
