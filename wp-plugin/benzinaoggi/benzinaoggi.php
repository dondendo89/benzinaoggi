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
        add_shortcode('carburante_distributor', [$this, 'shortcode_distributor']);
        add_action('wp_enqueue_scripts', [$this, 'enqueue_assets']);
        add_action('rest_api_init', [$this, 'register_rest']);
        // Cron hourly to check variations
        add_action('benzinaoggi_check_variations', [$this, 'cron_check_variations']);
        add_action('init', [$this, 'ensure_hourly_variations_cron']);
        // Admin post action for import + page creation
        add_action('admin_post_benzinaoggi_import', [$this, 'handle_import_and_pages']);
        // Single-run cron to sync pages
        add_action('benzinaoggi_sync_pages', [$this, 'cron_sync_pages']);
        // Ensure daily sync at 05:00 local time
        add_action('init', function(){
            if (!wp_next_scheduled('benzinaoggi_sync_pages')) {
                $next = $this->next_run_5am();
                wp_schedule_event($next, 'daily', 'benzinaoggi_sync_pages');
            }
        });
        
        // Handle OneSignal Service Worker
        add_action('init', [$this, 'handle_onesignal_worker']);
        // Add rewrites to expose SW at root
        add_action('init', [$this, 'register_sw_rewrites']);
        register_activation_hook(__FILE__, [$this, 'activate_flush_rewrites']);
        register_deactivation_hook(__FILE__, [$this, 'deactivate_flush_rewrites']);
    }

    private function log_progress($message) {
        $log = get_option('benzinaoggi_sync_log', []);
        if (!is_array($log)) { $log = []; }
        $log[] = '['.current_time('mysql').'] '.$message;
        if (count($log) > 500) { // keep last 500 lines
            $log = array_slice($log, -500);
        }
        update_option('benzinaoggi_sync_log', $log, false);
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
        add_settings_field('webhook_secret', 'Webhook Secret', [$this, 'field_webhook_secret'], 'benzinaoggi', 'benzinaoggi_section');
        add_settings_field('api_secret', 'API Bearer Secret', [$this, 'field_api_secret'], 'benzinaoggi', 'benzinaoggi_section');

        // pulsante import ora reso come form separato fuori dall'options form
    }

    public function get_options() {
        $defaults = [
            'api_base' => '',
            'onesignal_app_id' => '',
            'onesignal_api_key' => '',
            'webhook_secret' => '',
            'api_secret' => ''
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
    public function field_webhook_secret() {
        $opts = $this->get_options();
        echo '<input type="text" name="'.self::OPTION_NAME.'[webhook_secret]" value="'.esc_attr($opts['webhook_secret']).'" class="regular-text" placeholder="chiave segreta webhook" />';
    }
    public function field_api_secret() {
        $opts = $this->get_options();
        echo '<input type="text" name="'.self::OPTION_NAME.'[api_secret]" value="'.esc_attr($opts['api_secret']).'" class="regular-text" placeholder="Bearer per API Vercel" />';
    }

    public function options_page() {
        echo '<div class="wrap"><h1>Benzina Oggi</h1>';
        // Admin notice from last action
        if ($msg = get_transient('benzinaoggi_notice')) {
            echo '<div class="notice notice-success is-dismissible"><p>'.esc_html($msg).'</p></div>';
            delete_transient('benzinaoggi_notice');
        }
        echo '<form method="post" action="options.php">';
        settings_fields(self::OPTION_GROUP);
        do_settings_sections('benzinaoggi');
        submit_button();
        echo '</form>';
        echo '<h2>Shortcode</h2><code>[carburanti_map]</code>';
        echo '<h2>Azioni</h2>';
        $action = admin_url('admin-post.php');
        echo '<form method="post" action="'.esc_url($action).'" style="margin-top:8px">';
        echo '<input type="hidden" name="action" value="benzinaoggi_import" />';
        wp_nonce_field('bo_import_all');
        submit_button('Avvia sincronizzazione pagine (cron)', 'secondary', 'submit', false);
        echo '</form>';
        $last = get_option('benzinaoggi_last_sync');
        if ($last) {
            echo '<p><em>Ultima sincronizzazione: '.esc_html($last['when'] ?? '').' — create: '.intval($last['created'] ?? 0).'</em></p>';
        }
        // Log di avanzamento
        $log = get_option('benzinaoggi_sync_log', []);
        if (!empty($log)) {
            echo '<h3>Log sincronizzazione</h3>';
            echo '<pre style="max-height:240px; overflow:auto; background:#f6f8fa; padding:8px; border:1px solid #e2e8f0;">';
            foreach (array_slice($log, -100) as $line) {
                echo esc_html($line)."\n";
            }
            echo '</pre>'; 
        }
        echo '</div>';
    }

    public function handle_import_and_pages() {
        if (!current_user_can('manage_options')) wp_die('Not allowed');
        check_admin_referer('bo_import_all');
        // Schedule single event to run in background
        if (!wp_next_scheduled('benzinaoggi_sync_pages')) {
            wp_schedule_single_event(time() + 5, 'benzinaoggi_sync_pages');
        }
        $this->log_progress('Sincronizzazione schedulata dall\'admin.');
        // Try to immediately spawn wp-cron so the job appears and runs
        if (function_exists('spawn_cron')) {
            spawn_cron(time() + 1);
        } else {
            // Fallback: ping wp-cron.php
            wp_remote_post(site_url('wp-cron.php'));
        }
        // Esegui anche subito in modalità sincrona per assicurare l'avvio
        @ignore_user_abort(true);
        @set_time_limit(300);
        $this->cron_sync_pages();
        set_transient('benzinaoggi_notice', 'Sincronizzazione pagine avviata. Verrà eseguita in background tra pochi secondi.', 30);
        wp_redirect(admin_url('options-general.php?page=benzinaoggi'));
        exit;
    }

    public function cron_sync_pages() {
        $opts = $this->get_options();
        $base = rtrim($opts['api_base'], '/');
        if (!$base) return;
        @ignore_user_abort(true);
        @set_time_limit(900);
        $this->log_progress('Inizio sync: scarico elenco distributori…');
        $headers = [];
        $optsCfg = $this->get_options();
        if (!empty($optsCfg['api_secret'])) { $headers['Authorization'] = 'Bearer '.$optsCfg['api_secret']; }
        $res2 = wp_remote_get($base.'/api/distributors-all', ['timeout' => 300, 'headers' => $headers]);
        if (is_wp_error($res2)) return;
        $data = json_decode(wp_remote_retrieve_body($res2), true);
        $created = 0; $skipped = 0; $errors = 0;
        if (!empty($data['distributors'])) {
            $total = count($data['distributors']);
            $this->log_progress('Totale da processare: '.$total);
            foreach ($data['distributors'] as $i => $d) {
                $rawTitle = trim(($d['bandiera'] ?: 'Distributore').' '.($d['comune'] ?: ''));
                $title = trim(preg_replace('/\s+/', ' ', $rawTitle));
                if ($title === '' || empty($d['impiantoId'])) { $skipped++; continue; }
                $slug = sanitize_title($title.'-'.$d['impiantoId']);
                $existingByTitle = get_page_by_title($title, OBJECT, 'page');
                $existingBySlug  = get_page_by_path($slug, OBJECT, 'page');
                if ($existingByTitle || $existingBySlug) { $skipped++; } else {
                    $post_id = wp_insert_post([
                        'post_title' => $title,
                        'post_name'  => $slug,
                        'post_type'  => 'page',
                        'post_status'=> 'publish',
                        'post_content' => '[carburante_distributor impianto_id="'.$d['impiantoId'].'"]'
                    ], true);
                    if (is_wp_error($post_id)) { $errors++; $this->log_progress('Errore creazione pagina impianto '.$d['impiantoId'].': '.$post_id->get_error_message()); }
                    else { $created++; }
                }
                if ( ($i+1) % 500 === 0 ) {
                    $this->log_progress('Avanzamento: '.($i+1).' / '.$total.' — create: '.$created.' — skipped: '.$skipped.' — errors: '.$errors);
                }
            }
        }
        update_option('benzinaoggi_last_sync', [ 'when' => current_time('mysql'), 'created' => $created, 'skipped' => $skipped, 'errors' => $errors ]);
        $this->log_progress('Completato. Create: '.$created.' — skipped: '.$skipped.' — errors: '.$errors);
    }

    private function next_run_5am() {
        // Compute next 5:00 AM based on WP timezone
        $now = current_time('timestamp');
        $date = date_i18n('Y-m-d', $now, true);
        $five = strtotime($date.' 05:00:00');
        if ($five <= $now) {
            $five = strtotime('+1 day', $five);
        }
        return $five;
    }
    
    public function handle_onesignal_worker() {
        if (isset($_GET['onesignal_worker']) && $_GET['onesignal_worker'] === '1') {
            $worker_path = plugin_dir_path(__FILE__) . 'public/OneSignalSDKWorker.js';
            if (file_exists($worker_path)) {
                header('Content-Type: application/javascript');
                header('Cache-Control: public, max-age=31536000');
                readfile($worker_path);
                exit;
            }
        }
    }

    public function register_sw_rewrites() {
        add_rewrite_rule('^OneSignalSDKWorker\.js$', 'index.php?onesignal_sw=1', 'top');
        add_rewrite_rule('^OneSignalSDKUpdaterWorker\.js$', 'index.php?onesignal_sw_updater=1', 'top');
        add_filter('query_vars', function($vars){ $vars[]='onesignal_sw'; $vars[]='onesignal_sw_updater'; return $vars; });
        add_action('template_redirect', function(){
            if (get_query_var('onesignal_sw')) {
                header('Content-Type: application/javascript; charset=UTF-8');
                echo "importScripts('https://cdn.onesignal.com/sdks/OneSignalSDKWorker.js');";
                exit;
            }
            if (get_query_var('onesignal_sw_updater')) {
                header('Content-Type: application/javascript; charset=UTF-8');
                echo "importScripts('https://cdn.onesignal.com/sdks/OneSignalSDKWorker.js');";
                exit;
            }
        });
    }

    public function ensure_hourly_variations_cron() {
        if (!wp_next_scheduled('benzinaoggi_check_variations')) {
            // schedule to the next minute to avoid missed execution on cold start
            $next = time() + 60;
            wp_schedule_event($next, 'hourly', 'benzinaoggi_check_variations');
        }
    }

    public function activate_flush_rewrites() {
        $this->register_sw_rewrites();
        flush_rewrite_rules();
    }

    public function deactivate_flush_rewrites() {
        flush_rewrite_rules();
    }

    public function register_rest() {
        register_rest_route('benzinaoggi/v1', '/sync', [
            'methods' => 'POST',
            'permission_callback' => '__return_true',
            'callback' => function($request){
                $opts = $this->get_options();
                $secret = sanitize_text_field($request->get_param('secret'));
                if (!$secret || $secret !== ($opts['webhook_secret'] ?? '')) {
                    return new WP_REST_Response(['ok'=>false,'error'=>'unauthorized'], 401);
                }
                $apiBase = rtrim(sanitize_text_field($request->get_param('apiBase')) ?: ($opts['api_base'] ?? ''), '/');
                if (!$apiBase) return new WP_REST_Response(['ok'=>false,'error'=>'missing apiBase'], 400);
                // Run import + page creation
                $res1 = wp_remote_get($apiBase.'/api/update-anagrafica');
                if (is_wp_error($res1)) return new WP_REST_Response(['ok'=>false,'error'=>'update-anagrafica failed'], 500);
        $headers = [];
        if (!empty($opts['api_secret'])) { $headers['Authorization'] = 'Bearer '.$opts['api_secret']; }
        $res2 = wp_remote_get($apiBase.'/api/distributors-all', ['headers' => $headers]);
                if (is_wp_error($res2)) return new WP_REST_Response(['ok'=>false,'error'=>'distributors-all failed'], 500);
                $data = json_decode(wp_remote_retrieve_body($res2), true);
                $count = 0;
                if (!empty($data['distributors'])) {
                    foreach ($data['distributors'] as $d) {
                        $title = trim(($d['bandiera']?:'Distributore').' '.$d['comune']);
                        $slug = sanitize_title($title.'-'.$d['impiantoId']);
                        $existing = get_page_by_path($slug, OBJECT, 'page');
                        if ($existing) continue;
                        $post_id = wp_insert_post([
                            'post_title' => $title,
                            'post_name'  => $slug,
                            'post_type'  => 'page',
                            'post_status'=> 'publish',
                            'post_content' => '[carburante_distributor impianto_id="'.$d['impiantoId'].'"]',
                        ]);
                        if (!is_wp_error($post_id)) $count++;
                    }
                }
                return new WP_REST_Response(['ok'=>true,'created'=>$count]);
            }
        ]);
    }

    public function enqueue_assets() {
        if (!is_singular()) return;
        // detect official OneSignal plugin
        if (!function_exists('is_plugin_active')) { include_once ABSPATH . 'wp-admin/includes/plugin.php'; }
        $onesignal_official = false;
        if (function_exists('is_plugin_active')) {
            $onesignal_official = is_plugin_active('onesignal-free-web-push-notifications/onesignal.php') || is_plugin_active('onesignal/onesignal.php');
        }
        // Leaflet
        wp_enqueue_style('leaflet', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', [], '1.9.4');
        wp_enqueue_script('leaflet', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', [], '1.9.4', true);
        
        // OneSignal SDK (only if official plugin NOT active)
        $opts = $this->get_options();
        if (!$onesignal_official && !empty($opts['onesignal_app_id'])) {
            wp_enqueue_script('onesignal', 'https://cdn.onesignal.com/sdks/OneSignalSDK.js', [], null, true);
        }
        
        // Add OneSignal Service Worker to head
        if (!$onesignal_official && !empty($opts['onesignal_app_id'])) {
            add_action('wp_head', function() use ($opts) {
                $root = home_url('/');
                $pathQuery = home_url('/?onesignal_worker=1');
                $appId = esc_js($opts['onesignal_app_id']);
                echo '<script>'
                    . 'window.OneSignal = window.OneSignal || [];' 
                    . 'window.OneSignal.SERVICE_WORKER_PARAM = { scope: "/" };'
                    . 'window.OneSignal.SERVICE_WORKER_PATH = "' . esc_js($pathQuery) . '";'
                    . 'window.OneSignal.SERVICE_WORKER_UPDATER_PATH = "' . esc_js($pathQuery) . '";'
                    . '</script>';
            });
        }
        // App
        wp_register_script('benzinaoggi-app', plugins_url('public/app.js', __FILE__), ['leaflet'], '1.0.0', true);
        $opts = $this->get_options();
        wp_localize_script('benzinaoggi-app', 'BenzinaOggi', [
            'apiBase' => rtrim($opts['api_base'], '/'),
            'onesignalAppId' => $opts['onesignal_app_id'],
            'onesignalOfficial' => $onesignal_official,
            'useOwnOneSignal' => !$onesignal_official,
        ]);
        wp_enqueue_script('benzinaoggi-app');
        wp_enqueue_style('benzinaoggi-style', plugins_url('public/style.css', __FILE__), [], '1.0.0');

        // Distributor detail loader if shortcode present
        global $post;
        if ($post && has_shortcode($post->post_content, 'carburante_distributor')) {
            wp_register_script('benzinaoggi-distributor', plugins_url('public/distributor.js', __FILE__), [], '1.0.1', true);
            wp_localize_script('benzinaoggi-distributor', 'BenzinaOggi', [
                'apiBase' => rtrim($opts['api_base'], '/'),
                'onesignalAppId' => $opts['onesignal_app_id'],
                'onesignalOfficial' => $onesignal_official,
                'useOwnOneSignal' => !$onesignal_official,
                'workerPath' => plugins_url('public/OneSignalSDKWorker.js', __FILE__),
                'workerUpdaterPath' => plugins_url('public/OneSignalSDKUpdaterWorker.js', __FILE__),
                'rootWorkerPath' => home_url('/OneSignalSDKWorker.js'),
                'rootWorkerUpdaterPath' => home_url('/OneSignalSDKUpdaterWorker.js')
            ]);
            wp_enqueue_script('benzinaoggi-distributor');
        }
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
                <select id="bo_brand">
                    <option value="">Tutte le bandiere</option>
                    <option>Agip Eni</option>
                    <option>Q8</option>
                    <option>Api-Ip</option>
                    <option>Esso</option>
                    <option>Pompe Bianche</option>
                    <option>Giap</option>
                </select>
                <select id="bo_sort">
                    <option value="">Ordina</option>
                    <option value="nearest">Più vicino</option>
                    <option value="cheapest">Più economico</option>
                </select>
                <button id="bo_geo">Usa mia posizione</button>
                <button id="bo_search">Cerca</button>
            </div>
            <div id="bo_map" style="height: 420px; margin: 12px 0;"></div>
            <ul id="bo_list"></ul>
            <div id="bo_subscribe" style="margin-top:12px;"></div>
        </div>
        <?php
        return ob_get_clean();
    }

    public function shortcode_distributor($atts = []) {
        $atts = shortcode_atts([
            'impianto_id' => ''
        ], $atts);
        $impianto = $atts['impianto_id'];
        if (!$impianto && isset($_GET['impiantoId'])) {
            $impianto = sanitize_text_field($_GET['impiantoId']);
        }
        ob_start();
        ?>
        <div class="bo-distributor" data-impianto="<?php echo esc_attr($impianto); ?>">
            <div id="bo_distributor_detail">Caricamento…</div>
        </div>
        <?php
        return ob_get_clean();
    }

    public function cron_check_variations() {
        $opts = $this->get_options();
        $base = rtrim($opts['api_base'], '/');
        if (!$base) return;
        
        // Use Bearer auth for protected endpoint
        $headers = [];
        if (!empty($opts['api_secret'])) {
            $headers['Authorization'] = 'Bearer ' . $opts['api_secret'];
        }
        
        $url = $base . '/api/check-variation';
        $resp = wp_remote_get($url, [ 
            'timeout' => 20,
            'headers' => $headers
        ]);
        if (is_wp_error($resp)) {
            $this->log_progress('Error checking variations: ' . $resp->get_error_message());
            return;
        }
        $code = wp_remote_retrieve_response_code($resp);
        if ($code !== 200) {
            $this->log_progress('API returned code: ' . $code);
            return;
        }
        $data = json_decode(wp_remote_retrieve_body($resp), true);
        if (!isset($data['variations'])) {
            $this->log_progress('No variations data in response');
            return;
        }
        $vars = $data['variations'];
        if (empty($vars)) {
            $this->log_progress('No price variations detected');
            return;
        }

        $this->log_progress('Found ' . count($vars) . ' price variations');

        // Send specific notifications for each price drop
        foreach ($vars as $variation) {
            if ($variation['type'] === 'decrease') {
                $this->send_price_drop_notification($variation, $opts);
            }
        }
    }
    
    private function send_price_drop_notification($variation, $opts) {
        $app_id = $opts['onesignal_app_id'];
        $api_key = $opts['onesignal_api_key'];
        if (!$app_id || !$api_key) return;

        $fuelType = isset($variation['fuelType']) ? $variation['fuelType'] : 'Carburante';
        $distributorName = isset($variation['distributorName']) ? $variation['distributorName'] : 'Distributore';
        $oldPrice = isset($variation['oldPrice']) ? $variation['oldPrice'] : 0;
        $newPrice = isset($variation['newPrice']) ? $variation['newPrice'] : 0;
        $priceDiff = $oldPrice - $newPrice;
        $percentageDiff = $oldPrice > 0 ? (($priceDiff / $oldPrice) * 100) : 0;

        $title = "💰 Prezzo $fuelType sceso!";
        $message = "$distributorName: $fuelType da €" . number_format($oldPrice, 3) . " a €" . number_format($newPrice, 3) . " (-" . number_format($percentageDiff, 1) . "%)";

        // Prefer exact distributor+fuel targeting; fallback to per-distributor or per-fuel
        $fuel_key_norm = strtolower(str_replace(' ', '_', $fuelType));
        $dist_fuel_tag = 'notify_distributor_' . (isset($variation['distributorId']) ? $variation['distributorId'] : '') . '_' . $fuel_key_norm;

        $payload = array(
            'app_id' => $app_id,
            // Target either specific distributor subscribers or generic fuel-type subscribers
            'filters' => array(
                array('field' => 'tag', 'key' => $dist_fuel_tag, 'relation' => '=', 'value' => '1'),
                array('operator' => 'OR'),
                array('field' => 'tag', 'key' => 'notify_distributor_' . (isset($variation['distributorId']) ? $variation['distributorId'] : ''), 'relation' => '=', 'value' => '1'),
                array('operator' => 'OR'),
                array('field' => 'tag', 'key' => 'price_drop_notifications', 'relation' => '=', 'value' => '1'),
                array('field' => 'tag', 'key' => 'fuel_type', 'relation' => '=', 'value' => $fuelType)
            ),
            'headings' => array('it' => $title),
            'contents' => array('it' => $message),
            'data' => array(
                'fuelType' => $fuelType,
                'distributorId' => (isset($variation['distributorId']) ? $variation['distributorId'] : ''),
                'oldPrice' => $oldPrice,
                'newPrice' => $newPrice,
                'priceDiff' => $priceDiff,
                'percentageDiff' => $percentageDiff
            ),
            'url' => home_url('/distributore-' . (isset($variation['distributorId']) ? $variation['distributorId'] : ''))
        );

        $response = wp_remote_post('https://onesignal.com/api/v1/notifications', [
            'headers' => [
                'Authorization' => 'Basic ' . $api_key, 
                'Content-Type' => 'application/json'
            ],
            'body' => json_encode($payload),
        ]);

        if (is_wp_error($response)) {
            $this->log_progress('OneSignal error for ' . $fuelType . ': ' . $response->get_error_message());
        } else {
            $this->log_progress('Notification sent for ' . $fuelType . ' at ' . $distributorName);
        }
    }
}

new BenzinaOggiPlugin();


