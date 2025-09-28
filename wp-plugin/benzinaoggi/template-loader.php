<?php
/**
 * Template Loader per BenzinaOggi
 */

// Previeni accesso diretto
if (!defined('ABSPATH')) {
    exit;
}

class BenzinaOggi_Template_Loader {
    
    public function __construct() {
        add_action('template_redirect', array($this, 'load_custom_templates'));
        add_action('wp_enqueue_scripts', array($this, 'enqueue_template_assets'));
    }
    
    /**
     * Carica template personalizzati
     */
    public function load_custom_templates() {
        global $wp_query;
        
        // Template per pagina home
        if (is_page('benzinaoggi-home') || is_page('home-benzinaoggi')) {
            $this->load_template('page-home.php');
            exit;
        }
        
        // Template per risultati
        if (is_page('benzinaoggi-risultati') || is_page('risultati-benzinaoggi')) {
            $this->load_template('page-risultati.php');
            exit;
        }
        
        // Template per dettaglio distributore
        if (is_page() && preg_match('/^distributore-(\d+)$/', get_query_var('pagename'), $matches)) {
            $impianto_id = $matches[1];
            
            // Cerca prima se esiste una pagina specifica per questo distributore
            $existing_page = get_page_by_path(get_query_var('pagename'));
            
            if ($existing_page) {
                // Usa la pagina esistente con il template personalizzato
                $this->load_template('single-distributor.php', array('impianto_id' => $impianto_id));
                exit;
            } else {
                // Fallback: usa il template dinamico
                $this->load_template('single-distributor.php', array('impianto_id' => $impianto_id));
                exit;
            }
        }
    }
    
    /**
     * Carica un template specifico
     */
    private function load_template($template_name, $vars = array()) {
        $template_path = plugin_dir_path(__FILE__) . 'templates/' . $template_name;
        
        if (file_exists($template_path)) {
            // Estrai variabili
            extract($vars);
            
            // Carica il template
            include $template_path;
        } else {
            wp_die('Template non trovato: ' . $template_name);
        }
    }
    
    /**
     * Carica asset per i template
     */
    public function enqueue_template_assets() {
        // Solo per le pagine del plugin
        if (!$this->is_benzinaoggi_page()) {
            return;
        }
        
        // Leaflet CSS e JS
        wp_enqueue_style('leaflet-css', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
        wp_enqueue_script('leaflet-js', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', array(), '1.9.4', true);
        
        // Leaflet Draw
        wp_enqueue_style('leaflet-draw-css', 'https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css');
        wp_enqueue_script('leaflet-draw-js', 'https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js', array('leaflet-js'), '1.0.4', true);
        
        // Leaflet Geocoder
        wp_enqueue_style('leaflet-geocoder-css', 'https://unpkg.com/leaflet-control-geocoder@1.13.0/dist/Control.Geocoder.css');
        wp_enqueue_script('leaflet-geocoder-js', 'https://unpkg.com/leaflet-control-geocoder@1.13.0/dist/Control.Geocoder.js', array('leaflet-js'), '1.13.0', true);
        
        // Script personalizzati
        if (is_page('benzinaoggi-home') || is_page('home-benzinaoggi')) {
            wp_enqueue_script('benzinaoggi-home-js', plugin_dir_url(__FILE__) . 'templates/page-home.js', array('leaflet-js'), '1.0.0', true);
        }
        
        // OneSignal per le pagine che lo richiedono
        if (is_page() && (strpos(get_query_var('pagename'), 'distributore-') === 0)) {
            wp_enqueue_script('onesignal-sdk', 'https://cdn.onesignal.com/sdks/OneSignalSDK.js', array(), '1.0.0', true);
        }
        
        // Localizza script
        wp_localize_script('benzinaoggi-home-js', 'BenzinaOggi', array(
            'apiBase' => get_option('benzinaoggi_api_base', 'https://benzinaoggi.vercel.app'),
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('benzinaoggi_nonce')
        ));
    }
    
    /**
     * Verifica se è una pagina del plugin
     */
    private function is_benzinaoggi_page() {
        $pagename = get_query_var('pagename');
        
        return (
            is_page('benzinaoggi-home') ||
            is_page('home-benzinaoggi') ||
            is_page('benzinaoggi-risultati') ||
            is_page('risultati-benzinaoggi') ||
            (is_page() && strpos($pagename, 'distributore-') === 0)
        );
    }
}

// Inizializza il template loader
new BenzinaOggi_Template_Loader();
