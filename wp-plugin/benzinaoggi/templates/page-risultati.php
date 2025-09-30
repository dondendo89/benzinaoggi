<?php
/*
Template Name: Risultati Ricerca
*/

get_header(); ?>

<div class="benzinaoggi-results">
    <!-- Filtri e controlli -->
    <div class="bo-filters-bar">
        <div class="bo-container">
            <div class="bo-filters-content">
                <div class="bo-search-info">
                    <h2>Risultati ricerca</h2>
                    <div class="bo-search-params" id="bo-search-params">
                        <!-- Parametri di ricerca dinamici -->
                    </div>
                </div>
                
                <div class="bo-view-controls">
                    <button id="bo-view-list" class="bo-view-btn active" title="Vista lista">
                        <svg viewBox="0 0 24 24">
                            <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
                        </svg>
                    </button>
                    <button id="bo-view-map" class="bo-view-btn" title="Vista mappa">
                        <svg viewBox="0 0 24 24">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Layout principale -->
    <div class="bo-results-layout">
        <div class="bo-container">
            <div class="bo-results-grid">
                <!-- Sidebar filtri -->
                <aside class="bo-filters-sidebar">
                    <div class="bo-filters-card">
                        <h3>Filtri</h3>
                        
                        <div class="bo-filter-group">
                            <label for="bo-filter-fuel">Carburante</label>
                            <select id="bo-filter-fuel" class="bo-filter-select">
                                <option value="">Tutti</option>
                                <option value="Benzina">Benzina</option>
                                <option value="Gasolio">Gasolio</option>
                                <option value="GPL">GPL</option>
                                <option value="Metano">Metano</option>
                            </select>
                        </div>

                        <div class="bo-filter-group">
                            <label for="bo-filter-brand">Bandiera</label>
                            <select id="bo-filter-brand" class="bo-filter-select">
                                <option value="">Tutte</option>
                                <option value="Agip Eni">Agip Eni</option>
                                <option value="Q8">Q8</option>
                                <option value="Api-Ip">Api-Ip</option>
                                <option value="Esso">Esso</option>
                                <option value="Pompe Bianche">Pompe Bianche</option>
                            </select>
                        </div>

                        <div class="bo-filter-group">
                            <label for="bo-filter-sort">Ordina per</label>
                            <select id="bo-filter-sort" class="bo-filter-select">
                                <option value="distance">Distanza</option>
                                <option value="price">Prezzo</option>
                                <option value="name">Nome</option>
                            </select>
                        </div>

                        <div class="bo-filter-group">
                            <label for="bo-filter-radius">Raggio (km)</label>
                            <input type="range" id="bo-filter-radius" min="1" max="50" value="10" class="bo-filter-range">
                            <div class="bo-filter-value" id="bo-radius-value">10 km</div>
                        </div>

                        <button id="bo-apply-filters" class="bo-filter-btn">Applica filtri</button>
                        <button id="bo-clear-filters" class="bo-filter-btn bo-secondary">Cancella</button>
                    </div>
                </aside>

                <!-- Contenuto principale -->
                <main class="bo-results-main">
                    <!-- Vista lista -->
                    <div id="bo-list-view" class="bo-view-content active">
                        <div class="bo-results-header">
                            <div class="bo-results-count">
                                <span id="bo-results-count-text">0 risultati</span>
                            </div>
                            <div class="bo-results-actions">
                                <button id="bo-export-csv" class="bo-action-btn">
                                    <svg viewBox="0 0 24 24">
                                        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                                    </svg>
                                    Esporta CSV
                                </button>
                            </div>
                        </div>

                        <div class="bo-results-list" id="bo-results-list">
                            <!-- Risultati dinamici -->
                        </div>

                        <div class="bo-pagination" id="bo-pagination">
                            <!-- Paginazione dinamica -->
                        </div>
                    </div>

                    <!-- Vista mappa -->
                    <div id="bo-map-view" class="bo-view-content">
                        <div class="bo-map-container">
                            <div id="bo_results_map" class="bo-results-map"></div>
                            <div class="bo-map-controls">
                                <button id="bo-my-location-results" class="bo-map-btn" title="La mia posizione">
                                    <svg viewBox="0 0 24 24">
                                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    </div>
</div>

<style>
/* Reset e base */
.benzinaoggi-results {
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

/* Barra filtri */
.bo-filters-bar {
    background: white;
    border-bottom: 1px solid #e1e5e9;
    padding: 20px 0;
}

.bo-filters-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.bo-search-info h2 {
    margin: 0 0 10px 0;
    color: #333;
    font-size: 24px;
}

.bo-search-params {
    display: flex;
    gap: 15px;
    flex-wrap: wrap;
}

.bo-param-tag {
    background: #e1e5e9;
    color: #666;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 14px;
}

.bo-view-controls {
    display: flex;
    gap: 10px;
}

.bo-view-btn {
    background: #f8f9fa;
    border: 1px solid #e1e5e9;
    padding: 10px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.3s;
}

.bo-view-btn.active,
.bo-view-btn:hover {
    background: #2c5aa0;
    color: white;
    border-color: #2c5aa0;
}

.bo-view-btn svg {
    width: 20px;
    height: 20px;
    fill: currentColor;
}

/* Layout principale */
.bo-results-layout {
    padding: 30px 0;
}

.bo-results-grid {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 30px;
}

/* Sidebar filtri */
.bo-filters-sidebar {
    position: sticky;
    top: 120px;
    height: fit-content;
}

.bo-filters-card {
    background: white;
    border-radius: 12px;
    padding: 25px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}

.bo-filters-card h3 {
    margin: 0 0 20px 0;
    color: #333;
    font-size: 18px;
}

.bo-filter-group {
    margin-bottom: 20px;
}

.bo-filter-group label {
    display: block;
    font-weight: 600;
    margin-bottom: 8px;
    color: #333;
}

.bo-filter-select,
.bo-filter-range {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #e1e5e9;
    border-radius: 6px;
    font-size: 14px;
}

.bo-filter-range {
    padding: 0;
    height: 6px;
    background: #e1e5e9;
    outline: none;
    -webkit-appearance: none;
}

.bo-filter-range::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #2c5aa0;
    cursor: pointer;
}

.bo-filter-value {
    text-align: center;
    font-weight: 600;
    color: #2c5aa0;
    margin-top: 5px;
}

.bo-filter-btn {
    width: 100%;
    padding: 12px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;
    margin-bottom: 10px;
}

.bo-filter-btn:not(.bo-secondary) {
    background: #2c5aa0;
    color: white;
}

.bo-filter-btn:not(.bo-secondary):hover {
    background: #1e3a5f;
}

.bo-filter-btn.bo-secondary {
    background: #f8f9fa;
    color: #666;
    border: 1px solid #e1e5e9;
}

.bo-filter-btn.bo-secondary:hover {
    background: #e9ecef;
}

/* Contenuto principale */
.bo-results-main {
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    overflow: hidden;
}

.bo-view-content {
    display: none;
}

.bo-view-content.active {
    display: block;
}

/* Header risultati */
.bo-results-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 25px;
    border-bottom: 1px solid #e1e5e9;
    background: #f8f9fa;
}

.bo-results-count {
    font-size: 16px;
    color: #666;
}

.bo-results-actions {
    display: flex;
    gap: 10px;
}

.bo-action-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: #2c5aa0;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;
}

.bo-action-btn:hover {
    background: #1e3a5f;
}

.bo-action-btn svg {
    width: 16px;
    height: 16px;
    fill: currentColor;
}

/* Lista risultati */
.bo-results-list {
    max-height: 600px;
    overflow-y: auto;
}

.bo-result-card {
    padding: 20px 25px;
    border-bottom: 1px solid #e1e5e9;
    cursor: pointer;
    transition: all 0.3s;
}

.bo-result-card:hover {
    background: #f8f9fa;
}

.bo-result-card:last-child {
    border-bottom: none;
}

.bo-result-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 15px;
}

.bo-result-brand {
    font-size: 20px;
    font-weight: bold;
    color: #2c5aa0;
}

.bo-result-distance {
    background: #e1e5e9;
    color: #666;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
}

.bo-result-address {
    color: #666;
    margin-bottom: 15px;
    font-size: 14px;
}

.bo-result-prices {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 15px;
}

.bo-price-item {
    text-align: center;
    padding: 10px;
    background: #f8f9fa;
    border-radius: 6px;
    border: 1px solid #e1e5e9;
}

.bo-price-label {
    font-size: 12px;
    color: #666;
    margin-bottom: 5px;
    font-weight: 600;
}

.bo-price-value {
    font-size: 18px;
    font-weight: bold;
    color: #2c5aa0;
    margin-bottom: 3px;
}

.bo-price-change {
    font-size: 12px;
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

/* Mappa */
.bo-map-container {
    position: relative;
    height: 600px;
}

.bo-results-map {
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
    border-radius: 6px;
    padding: 10px;
    cursor: pointer;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    transition: all 0.3s;
}

.bo-map-btn:hover {
    background: #f8f9fa;
    transform: translateY(-2px);
}

.bo-map-btn svg {
    width: 18px;
    height: 18px;
    fill: #2c5aa0;
}

/* Paginazione */
.bo-pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 20px;
    border-top: 1px solid #e1e5e9;
    background: #f8f9fa;
}

.bo-pagination-btn {
    padding: 8px 12px;
    margin: 0 5px;
    border: 1px solid #e1e5e9;
    background: white;
    color: #666;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.3s;
}

.bo-pagination-btn:hover,
.bo-pagination-btn.active {
    background: #2c5aa0;
    color: white;
    border-color: #2c5aa0;
}

.bo-pagination-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* Responsive */
@media (max-width: 768px) {
    .bo-results-grid {
        grid-template-columns: 1fr;
        gap: 20px;
    }
    
    .bo-filters-sidebar {
        position: static;
        order: 2;
    }
    
    .bo-results-main {
        order: 1;
    }
    
    .bo-result-prices {
        grid-template-columns: repeat(2, 1fr);
    }
    
    .bo-map-container {
        height: 400px;
    }
    
    .bo-filters-content {
        flex-direction: column;
        gap: 15px;
        align-items: flex-start;
    }
}
</style>

<?php get_footer(); ?>
