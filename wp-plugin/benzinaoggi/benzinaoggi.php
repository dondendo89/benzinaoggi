<?php
/*
Plugin Name: Benzina Oggi
Description: Mappa distributori e prezzi carburanti via API Vercel con notifiche OneSignal.
Version: 1.0.0
Author: Dev
*/

if (!defined('ABSPATH')) { exit; }

class BenzinaOggiPlugin {
    const OPTION_GROUP = 'benzinaoggi_options_group';
    const OPTION_NAME = 'benzinaoggi_options';

    public function __construct() {
        add_action('admin_menu', [$this, 'add_admin_menu']);
        add_action('admin_init', [$this, 'settings_init']);
        add_shortcode('carburanti_map', [$this, 'shortcode_map']);
        add_action('wp_enqueue_scripts', [$this, 'enqueue_assets']);
        // Cron hourly to check variations
        add_action('benzinaoggi_check_variations', [$this, 'cron_check_variations']);
        if (!wp_next_scheduled('benzinaoggi_check_variations')) {
            wp_schedule_event(time() + 60, 'hourly', 'benzinaoggi_check_variations');
        }
    }

    public function add_admin_menu() {
        add_options_page('Benzina Oggi', 'Benzina Oggi', 'manage_options', 'benzinaoggi', [$this, 'options_page']);
    }

    public function settings_init() {
        register_setting(self::OPTION_GROUP, self::OPTION_NAME);

        add_settings_section('benzinaoggi_section', __('Configurazione API e OneSignal', 'benzinaoggi'), function() {
            echo '<p>'.esc_html__('Imposta l\'URL base delle API (Vercel) e le credenziali OneSignal.', 'benzinaoggi').'</p>';
        }, 'benzinaoggi');

        add_settings_field('api_base', 'API Base URL', [$this, 'field_api_base'], 'benzinaoggi', 'benzinaoggi_section');
        add_settings_field('onesignal_app_id', 'OneSignal App ID', [$this, 'field_onesignal_app_id'], 'benzinaoggi', 'benzinaoggi_section');
        add_settings_field('onesignal_api_key', 'OneSignal REST API Key', [$this, 'field_onesignal_api_key'], 'benzinaoggi', 'benzinaoggi_section');
    }

    public function get_options() {
        $defaults = [
            'api_base' => '',
            'onesignal_app_id' => '',
            'onesignal_api_key' => ''
        ];
        $opts = get_option(self::OPTION_NAME, []);
        return wp_parse_args($opts, $defaults);
    }

    public function field_api_base() {
        $opts = $this->get_options();
        echo '<input type="url" name="'.self::OPTION_NAME.'[api_base]" value="'.esc_attr($opts['api_base']).'" class="regular-text" placeholder="https://your-vercel-app.vercel.app" />';
    }
    public function field_onesignal_app_id() {
        $opts = $this->get_options();
        echo '<input type="text" name="'.self::OPTION_NAME.'[onesignal_app_id]" value="'.esc_attr($opts['onesignal_app_id']).'" class="regular-text" />';
    }
    public function field_onesignal_api_key() {
        $opts = $this->get_options();
        echo '<input type="password" name="'.self::OPTION_NAME.'[onesignal_api_key]" value="'.esc_attr($opts['onesignal_api_key']).'" class="regular-text" />';
    }

    public function options_page() {
        echo '<div class="wrap"><h1>Benzina Oggi</h1><form method="post" action="options.php">';
        settings_fields(self::OPTION_GROUP);
        do_settings_sections('benzinaoggi');
        submit_button();
        echo '</form>';
        echo '<h2>Shortcode</h2><code>[carburanti_map]</code>';
        echo '</div>';
    }

    public function enqueue_assets() {
        if (!is_singular()) return;
        // Leaflet
        wp_enqueue_style('leaflet', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', [], '1.9.4');
        wp_enqueue_script('leaflet', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', [], '1.9.4', true);
        // App
        wp_register_script('benzinaoggi-app', plugins_url('public/app.js', __FILE__), ['leaflet'], '1.0.0', true);
        $opts = $this->get_options();
        wp_localize_script('benzinaoggi-app', 'BenzinaOggi', [
            'apiBase' => rtrim($opts['api_base'], '/'),
            'onesignalAppId' => $opts['onesignal_app_id'],
        ]);
        wp_enqueue_script('benzinaoggi-app');
        wp_enqueue_style('benzinaoggi-style', plugins_url('public/style.css', __FILE__), [], '1.0.0');
    }

    public function shortcode_map($atts = []) {
        ob_start();
        ?>
        <div class="benzinaoggi-wrap">
            <div class="filters">
                <input type="text" id="bo_city" placeholder="Città" />
                <select id="bo_fuel">
                    <option value="">Tutti i carburanti</option>
                    <option>Benzina</option>
                    <option>Gasolio</option>
                    <option>GPL</option>
                    <option>Metano</option>
                    <option>HiQ Diesel</option>
                </select>
                <button id="bo_search">Cerca</button>
            </div>
            <div id="bo_map" style="height: 420px; margin: 12px 0;"></div>
            <ul id="bo_list"></ul>
            <div id="bo_subscribe" style="margin-top:12px;"></div>
        </div>
        <?php
        return ob_get_clean();
    }

    public function cron_check_variations() {
        $opts = $this->get_options();
        $base = rtrim($opts['api_base'], '/');
        if (!$base) return;
        $url = $base . '/api/check-variation';
        $resp = wp_remote_get($url, [ 'timeout' => 20 ]);
        if (is_wp_error($resp)) return;
        $code = wp_remote_retrieve_response_code($resp);
        if ($code !== 200) return;
        $data = json_decode(wp_remote_retrieve_body($resp), true);
        if (!isset($data['variations'])) return;
        $vars = $data['variations'];
        if (empty($vars)) return;

        // Send OneSignal notification (generic broadcast with count)
        $app_id = $opts['onesignal_app_id'];
        $api_key = $opts['onesignal_api_key'];
        if (!$app_id || !$api_key) return;
        $title = 'Aggiornamento prezzi carburanti';
        $msg = count($vars) . ' distributori con variazioni oggi';
        $payload = [
            'app_id' => $app_id,
            'included_segments' => ['All'],
            'headings' => ['it' => $title],
            'contents' => ['it' => $msg],
            'url' => home_url('/'),
        ];
        wp_remote_post('https://onesignal.com/api/v1/notifications', [
            'headers' => [
                'Content-Type' => 'application/json; charset=utf-8',
                'Authorization' => 'Basic ' . $api_key,
            ],
            'body' => wp_json_encode($payload),
            'timeout' => 20,
        ]);
    }
}

new BenzinaOggiPlugin();


