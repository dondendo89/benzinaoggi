<?php
/*
Plugin Name: Benzina Oggi
Description: Mappa distributori e prezzi carburanti via API Vercel con notifiche OneSignal.
Version: 1.0.0
Author: Dev
*/

if (!defined('ABSPATH')) { exit; }

// Includi template loader
require_once plugin_dir_path(__FILE__) . 'template-loader.php';

class BenzinaOggiPlugin {
    const OPTION_GROUP = 'benzinaoggi_options_group';
    const OPTION_NAME = 'benzinaoggi_options';

    public function __construct() {
        add_action('admin_menu', [$this, 'add_admin_menu']);
        add_action('admin_init', [$this, 'settings_init']);
        add_action('admin_enqueue_scripts', [$this, 'admin_enqueue_scripts']);
        add_shortcode('carburanti_map', [$this, 'shortcode_map']);
        add_shortcode('carburante_distributor', [$this, 'shortcode_distributor']);
        // Global styles
        add_action('wp_enqueue_scripts', [$this, 'enqueue_global_styles'], 5);
        add_action('wp_enqueue_scripts', [$this, 'enqueue_assets']);
        add_action('rest_api_init', [$this, 'register_rest']);
        // Inject Google Analytics (gtag) in <head>
        add_action('wp_head', [$this, 'inject_gtag']);
        // Ensure OneSignal v16 SDK is present site-wide (if configured)
        add_action('wp_head', [$this, 'inject_onesignal_v16']);
        
        // Inizializza template loader
        new BenzinaOggi_Template_Loader();
        
        // Cron to check variations
        add_action('benzinaoggi_check_variations', [$this, 'cron_check_variations']);
        // Add custom cron schedule for every 10 minutes
        add_filter('cron_schedules', function($schedules){
            if (!isset($schedules['ten_minutes'])) {
                $schedules['ten_minutes'] = [
                    'interval' => 600,
                    'display' => __('Every 10 Minutes', 'benzinaoggi')
                ];
            }
            return $schedules;
        });
        add_action('init', [$this, 'ensure_daily_variations_cron']);
        // Admin post action for import + page creation
        add_action('admin_post_benzinaoggi_import', [$this, 'handle_import_and_pages']);
        // Admin post action to create template pages
        add_action('admin_post_benzinaoggi_create_pages', [$this, 'handle_create_pages']);
        add_action('admin_post_benzinaoggi_delete_distributor_pages', [$this, 'handle_delete_distributor_pages']);
        // Admin post action to generate SEO description via Gemini
        add_action('admin_post_benzinaoggi_generate_seo', [$this, 'handle_generate_seo_description']);
        // Add row action in Pages list
        add_filter('page_row_actions', [$this, 'add_generate_seo_row_action'], 10, 2);
        // Add meta box in page editor
        add_action('add_meta_boxes', [$this, 'register_seo_metabox']);
        // Ensure pages support excerpt so we can save meta description there
        add_action('init', function(){
            add_post_type_support('page', 'excerpt');
        });
        // Registra template personalizzato
        add_filter('theme_page_templates', [$this, 'add_custom_page_template']);
        add_filter('page_template', [$this, 'load_custom_page_template']);
        // Admin post action to run variations now
        add_action('admin_post_benzinaoggi_run_variations', [$this, 'handle_run_variations']);
        // Admin post action to run daily price update manually
        add_action('admin_post_benzinaoggi_run_daily_update', [$this, 'handle_run_daily_update']);
        // Admin post action to run weekly SEO generation manually
        add_action('admin_post_benzinaoggi_run_weekly_seo', [$this, 'handle_run_weekly_seo']);
        // Bulk generate SEO for all pages
        add_action('admin_post_benzinaoggi_generate_seo_all', [$this, 'handle_generate_seo_all']);
        // Single-run cron to sync pages
        add_action('benzinaoggi_sync_pages', [$this, 'cron_sync_pages']);
        // Ensure daily sync at 05:00 local time
        add_action('init', function(){
            if (!wp_next_scheduled('benzinaoggi_sync_pages')) {
                $next = $this->next_run_5am();
                wp_schedule_event($next, 'daily', 'benzinaoggi_sync_pages');
            }
        });
        
        // Daily price update job at 06:00
        add_action('benzinaoggi_daily_price_update', [$this, 'cron_daily_price_update']);
        add_action('init', function(){
            if (!wp_next_scheduled('benzinaoggi_daily_price_update')) {
                $next = $this->next_run_6am();
                wp_schedule_event($next, 'daily', 'benzinaoggi_daily_price_update');
            }
        });
        
        // Weekly SEO generation job at 02:00
        add_action('benzinaoggi_weekly_seo_generation', [$this, 'cron_weekly_seo_generation']);
        add_action('init', function(){
            if (!wp_next_scheduled('benzinaoggi_weekly_seo_generation')) {
                $next = $this->next_run_2am();
                wp_schedule_event($next, 'weekly', 'benzinaoggi_weekly_seo_generation');
            }
        });
        
        // Handle OneSignal Service Worker (legacy query path kept for safety)
        add_action('init', [$this, 'handle_onesignal_worker']);
        // Add rewrites to expose SW at root (v16)
        add_action('init', [$this, 'register_sw_rewrites']);
        register_activation_hook(__FILE__, [$this, 'activate_flush_rewrites']);
        register_deactivation_hook(__FILE__, [$this, 'deactivate_flush_rewrites']);
    }

    /**
     * Trim intelligente: tenta di mantenere frasi complete sotto un limite
     */
    private function smart_trim_sentence($text, $maxLen = 156) {
        $text = trim(preg_replace('/\s+/', ' ', (string)$text));
        if ($text === '') return $text;
        if (function_exists('mb_strlen') && function_exists('mb_substr')) {
            if (mb_strlen($text, 'UTF-8') <= $maxLen) return rtrim($text, ",; ") . (preg_match('/[\.!?]$/u', $text) ? '' : '.');
            $cut = mb_substr($text, 0, $maxLen, 'UTF-8');
        } else {
            if (strlen($text) <= $maxLen) return rtrim($text, ",; ") . (preg_match('/[\.!?]$/', $text) ? '' : '.');
            $cut = substr($text, 0, $maxLen);
        }
        // prova a tagliare all'ultima punteggiatura forte
        $pos = max(strrpos($cut, '.'), strrpos($cut, '!'), strrpos($cut, '?'));
        if ($pos !== false && $pos > 20) {
            return trim(substr($cut, 0, $pos + 1));
        }
        // altrimenti taglia all'ultimo spazio e chiudi con punto
        $sp = strrpos($cut, ' ');
        $res = $sp ? substr($cut, 0, $sp) : $cut;
        return rtrim($res, ",; ") . '.';
    }
    /**
     * Bulk: genera descrizione SEO per tutte le pagine pubblicate
     */
    public function handle_generate_seo_all() {
        if (!current_user_can('manage_options')) wp_die('Not allowed');
        check_admin_referer('bo_generate_seo_all');
        @ignore_user_abort(true);
        @set_time_limit(600);
        $opts = $this->get_options();
        if (empty($opts['gemini_api_key'])) {
            wp_die('Configura prima la Google Gemini API Key nelle impostazioni.');
        }
        $pages = get_posts(array(
            'post_type' => 'page',
            'post_status' => 'publish',
            'numberposts' => -1,
            'fields' => 'ids'
        ));
        $count = 0; $errors = 0;
        foreach ($pages as $pid) {
            // Reindirizza tramite stessa action singola per riusare la logica e nonce dinamico non necessario in bulk
            try {
                $this->generate_seo_for_post($pid);
                $count++;
            } catch (Exception $e) {
                $errors++;
            }
            // Breve pausa per evitare rate limit
            usleep(120000); // 120ms
        }
        set_transient('benzinaoggi_notice', 'SEO generata per '.$count.' pagine (errori: '.$errors.').', 30);
        wp_redirect(admin_url('options-general.php?page=benzinaoggi&tab=seo'));
        exit;
    }

    /**
     * Refactor: logica di generazione riusabile programmaticamente
     */
    private function generate_seo_for_post($post_id) {
        $post_id = intval($post_id);
        $opts = $this->get_options();
        $api_key = trim($opts['gemini_api_key'] ?? '');
        if (!$api_key) throw new Exception('Missing Gemini API Key');
        $post = get_post($post_id);
        if (!$post || $post->post_type !== 'page') throw new Exception('Invalid post');

        $site_name = get_bloginfo('name');
        $title = get_the_title($post_id);
        $permalink = get_permalink($post_id);
        $prompt = sprintf(
            "Scrivi una descrizione SEO breve (max 160 parole, tono informativo, italiano) per una pagina di un sito che si chiama '%s'. Usa solo le informazioni che puoi dedurre dal titolo.\n\nTitolo: %s\nURL: %s\n\nRequisiti:\n- Evita keyword stuffing\n- Frasi naturali e utili per l'utente\n- Includi una call-to-action leggera\n- Non inventare dati specifici non presenti nel titolo\n- Restituisci solo il testo della descrizione, senza markdown",
            $site_name,
            $title,
            $permalink
        );

        // Model discovery (riusa la stessa logica dell'handler)
        $chosen_model = get_transient('bo_gemini_model');
        if (!$chosen_model) {
            $models_url = add_query_arg('key', rawurlencode($api_key), 'https://generativelanguage.googleapis.com/v1/models');
            $list = wp_remote_get($models_url, [ 'timeout' => 20 ]);
            if (!is_wp_error($list) && wp_remote_retrieve_response_code($list) === 200) {
                $j = json_decode(wp_remote_retrieve_body($list), true);
                $models = isset($j['models']) && is_array($j['models']) ? $j['models'] : [];
                $eligible = array_filter($models, function($m){
                    $methods = isset($m['supportedGenerationMethods']) ? $m['supportedGenerationMethods'] : [];
                    return !empty($m['name']) && is_array($methods) && in_array('generateContent', $methods, true);
                });
                usort($eligible, function($a, $b){
                    $an = strtolower($a['name']); $bn = strtolower($b['name']);
                    $aFlash = strpos($an, 'flash') !== false ? 1 : 0;
                    $bFlash = strpos($bn, 'flash') !== false ? 1 : 0;
                    if ($aFlash !== $bFlash) return $bFlash - $aFlash;
                    return strcmp($bn, $an);
                });
                if (!empty($eligible)) {
                    $parts = explode('/', $eligible[0]['name']);
                    $chosen_model = end($parts);
                }
            }
            if (!$chosen_model) $chosen_model = 'gemini-1.5-flash';
            set_transient('bo_gemini_model', $chosen_model, HOUR_IN_SECONDS);
        }
        $endpoint = add_query_arg('key', rawurlencode($api_key), 'https://generativelanguage.googleapis.com/v1/models/' . rawurlencode($chosen_model) . ':generateContent');
        $body = array('contents' => array(array('role' => 'user','parts' => array(array('text' => $prompt)))));
        $resp = wp_remote_post($endpoint, array('timeout' => 30,'headers' => array('Content-Type' => 'application/json'),'body' => wp_json_encode($body)));
        if (is_wp_error($resp)) throw new Exception('Gemini error');
        if (wp_remote_retrieve_response_code($resp) < 200 || wp_remote_retrieve_response_code($resp) >= 300) throw new Exception('Gemini HTTP error');
        $json = json_decode(wp_remote_retrieve_body($resp), true);
        $generated = !empty($json['candidates'][0]['content']['parts'][0]['text']) ? trim($json['candidates'][0]['content']['parts'][0]['text']) : '';
        if (!$generated) throw new Exception('No text');

        $plain = trim(preg_replace('/\s+/', ' ', wp_strip_all_tags($generated)));
        $limit = 100;
        if (function_exists('mb_strlen') && function_exists('mb_substr')) {
            $metaDesc = mb_strlen($plain, 'UTF-8') > $limit ? (mb_substr($plain, 0, $limit, 'UTF-8')) : $plain;
        } else {
            $metaDesc = strlen($plain) > $limit ? substr($plain, 0, $limit) : $plain;
        }
        wp_update_post(array('ID' => $post_id,'post_excerpt' => wp_slash($metaDesc)));
        update_post_meta($post_id, 'bo_seo_description', wp_kses_post($generated));
        update_post_meta($post_id, '_yoast_wpseo_metadesc', $metaDesc);
        update_post_meta($post_id, '_rank_math_description', $metaDesc);
        update_post_meta($post_id, '_aioseo_description', $metaDesc);

        $content = (string) get_post_field('post_content', $post_id);
        $new_block = "<!-- SEO: Generated by Gemini -->\n<p class=\"bo-seo-description\">" . wp_kses_post($generated) . "</p>\n";
        $shortcode_pattern = '/(\[carburante_distributor\s+impianto_id="?\d+"?\])/i';
        if (preg_match($shortcode_pattern, $content, $m, PREG_OFFSET_CAPTURE)) {
            $pos = $m[0][1] + strlen($m[0][0]);
            $head = substr($content, 0, $pos);
            $content = rtrim($head) . "\n\n" . $new_block;
        } else {
            $content = rtrim($content) . "\n\n" . $new_block;
        }
        wp_update_post(array('ID' => $post_id,'post_content' => wp_slash($content)));
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
        // Aggiungi il plugin nel menu principale (a sinistra) invece che nelle impostazioni
        add_menu_page(
            'Benzina Oggi',           // Titolo della pagina
            'Benzina Oggi',           // Titolo del menu
            'manage_options',         // Capability
            'benzinaoggi',           // Slug del menu
            [$this, 'options_page'], // Funzione callback
            'dashicons-car',         // Icona (auto)
            30                        // Posizione nel menu
        );
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
        add_settings_field('gemini_api_key', 'Google Gemini API Key', [$this, 'field_gemini_api_key'], 'benzinaoggi', 'benzinaoggi_section');

        // Sezione per il logo
        add_settings_section('benzinaoggi_logo_section', __('Logo e Branding', 'benzinaoggi'), function() {
            echo '<p>'.esc_html__('Carica il logo da utilizzare nel template.', 'benzinaoggi').'</p>';
        }, 'benzinaoggi');

        add_settings_field('logo_url', 'Logo URL', [$this, 'field_logo_url'], 'benzinaoggi', 'benzinaoggi_logo_section');

        // pulsante import ora reso come form separato fuori dall'options form
    }

    public function get_options() {
        $defaults = [
            'api_base' => '',
            'onesignal_app_id' => '',
            'onesignal_api_key' => '',
            'webhook_secret' => '',
            'api_secret' => '',
            'logo_url' => '',
            'gemini_api_key' => ''
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

    public function field_gemini_api_key() {
        $opts = $this->get_options();
        echo '<input type="password" name="'.self::OPTION_NAME.'[gemini_api_key]" value="'.esc_attr($opts['gemini_api_key']).'" class="regular-text" placeholder="AIza..." />';
        echo '<p class="description">Chiave API di Google Gemini usata per generare descrizioni SEO.</p>';
    }

    public function field_logo_url() {
        $opts = $this->get_options();
        $logo_url = $opts['logo_url'];
        
        echo '<div>';
        echo '<input type="url" name="'.self::OPTION_NAME.'[logo_url]" value="'.esc_attr($logo_url).'" class="regular-text" placeholder="https://example.com/logo.png" />';
        echo '<button type="button" class="button" id="upload-logo-btn">Carica Logo</button>';
        
        if ($logo_url) {
            echo '<div style="margin-top: 10px;">';
            echo '<img src="'.esc_url($logo_url).'" alt="Logo" style="max-width: 200px; max-height: 100px; border: 1px solid #ddd; padding: 5px;" />';
            echo '</div>';
        }
        
        echo '</div>';
        
        // JavaScript per il media uploader
        echo '<script>
        jQuery(document).ready(function($) {
            $("#upload-logo-btn").click(function(e) {
                e.preventDefault();
                var mediaUploader = wp.media({
                    title: "Seleziona Logo",
                    button: {
                        text: "Usa questo logo"
                    },
                    multiple: false
                });
                
                mediaUploader.on("select", function() {
                    var attachment = mediaUploader.state().get("selection").first().toJSON();
                    $("input[name=\''.self::OPTION_NAME.'[logo_url]\']").val(attachment.url);
                });
                
                mediaUploader.open();
            });
        });
        </script>';
    }

    public function admin_enqueue_scripts($hook) {
        // Carica wp.media solo nella pagina del plugin
        if ($hook === 'toplevel_page_benzinaoggi') {
            wp_enqueue_media();
        }
    }

    public function enqueue_global_styles() {
        if (is_admin()) return;
        // Carica lo stile del plugin ovunque per lo header con logo (tema)
        wp_enqueue_style('benzinaoggi-style', plugins_url('public/style.css', __FILE__), [], '2.0.0');
    }

    public function inject_onesignal_v16() {
        if (is_admin()) return;
        $opts = $this->get_options();
        $appId = trim($opts['onesignal_app_id'] ?? '');
        if (!$appId) return;
        // Avoid duplicate if already printed
        static $printed = false; if ($printed) return; $printed = true;
        echo "\n<!-- OneSignal v16 (page SDK) -->\n";
        echo "<link rel=\"preconnect\" href=\"https://cdn.onesignal.com\" crossorigin>\n";
        echo "<script src=\"https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js\" async></script>\n";
        $app = esc_js($appId);
        $init = "(function(){\n  window.OneSignalDeferred = window.OneSignalDeferred || [];\n  window.OneSignalDeferred.push(function(OneSignal){ try { OneSignal.init({ appId: '$app', serviceWorkerPath: '/OneSignalSDKWorker.js', serviceWorkerUpdaterWorkerPath: '/OneSignalSDKUpdaterWorker.js', serviceWorkerUpdaterPath: '/OneSignalSDKUpdaterWorker.js', serviceWorkerScope: '/', allowLocalhostAsSecureOrigin: true }); } catch(e){} });\n  // Fallback loader if CDN blocked\n  function ensureOS(){ try { if (window.OneSignal && (window.OneSignal.Notifications||window.OneSignal.push)) return; var s=document.createElement('script'); s.src='https://onesignal.com/sdks/web/v16/OneSignalSDK.page.js'; s.async=true; document.head.appendChild(s); } catch(_){} }\n  setTimeout(function(){ if(!(window.OneSignal&& (window.OneSignal.Notifications||window.OneSignal.push))){ ensureOS(); } }, 1500);\n})();";
        echo '<script>'.$init.'</script>' . "\n";
    }

    public function inject_gtag() {
        // Google tag (gtag.js)
        echo "\n<!-- Google tag (gtag.js) -->\n";
        echo "<script async src=\"https://www.googletagmanager.com/gtag/js?id=G-2YRVTC8RPV\"></script>\n";
        echo "<script>\n";
        echo "  window.dataLayer = window.dataLayer || [];\n";
        echo "  function gtag(){dataLayer.push(arguments);}\n";
        echo "  gtag('js', new Date());\n\n";
        echo "  gtag('config', 'G-2YRVTC8RPV');\n";
        echo "</script>\n";
    }

    public function get_logo_url() {
        $opts = $this->get_options();
        $logo_url = $opts['logo_url'];
        
        // Se non c'è logo personalizzato, usa quello di default
        if (empty($logo_url)) {
            return plugins_url('assets/logo-benzinaoggi.svg', __FILE__);
        }
        
        return $logo_url;
    }

    public function options_page() {
        $active_tab = isset($_GET['tab']) ? $_GET['tab'] : 'settings';
        ?>
        <div class="wrap">
            <h1>Benzina Oggi</h1>
            <nav class="nav-tab-wrapper">
                <a href="?page=benzinaoggi&tab=settings" class="nav-tab <?php echo $active_tab == 'settings' ? 'nav-tab-active' : ''; ?>">Impostazioni</a>
                <a href="?page=benzinaoggi&tab=import" class="nav-tab <?php echo $active_tab == 'import' ? 'nav-tab-active' : ''; ?>">Importa Dati</a>
                <a href="?page=benzinaoggi&tab=notifications" class="nav-tab <?php echo $active_tab == 'notifications' ? 'nav-tab-active' : ''; ?>">Notifiche</a>
                <a href="?page=benzinaoggi&tab=pages" class="nav-tab <?php echo $active_tab == 'pages' ? 'nav-tab-active' : ''; ?>">Pagine Template</a>
                <a href="?page=benzinaoggi&tab=seo" class="nav-tab <?php echo $active_tab == 'seo' ? 'nav-tab-active' : ''; ?>">SEO</a>
            </nav>
            
            <?php
            // Admin notice from last action
            if ($msg = get_transient('benzinaoggi_notice')) {
                echo '<div class="notice notice-success is-dismissible"><p>'.esc_html($msg).'</p></div>';
                delete_transient('benzinaoggi_notice');
            }
            
        if (isset($_GET['created'])) {
            echo '<div class="notice notice-success is-dismissible"><p>Pagine create: ' . esc_html($_GET['created']) . '</p></div>';
        }
        if (isset($_GET['deleted_pages'])) {
            echo '<div class="notice notice-success is-dismissible"><p>' . esc_html($_GET['deleted_pages']) . '</p></div>';
        }
            ?>
            
            <?php if ($active_tab == 'settings'): ?>
                <form method="post" action="options.php">
                    <?php
                    settings_fields(self::OPTION_GROUP);
                    do_settings_sections('benzinaoggi');
                    submit_button();
                    ?>
                </form>
            <?php elseif ($active_tab == 'seo'): ?>
                <h2>Generazione SEO (Gemini)</h2>
                <p>Genera la descrizione SEO per tutte le pagine pubblicate. Usa il titolo come prompt.</p>
                <?php $action = admin_url('admin-post.php'); ?>
                <form method="post" action="<?php echo esc_url($action); ?>" onsubmit="return confirm('Generare la descrizione per tutte le pagine?');">
                    <input type="hidden" name="action" value="benzinaoggi_generate_seo_all" />
                    <?php wp_nonce_field('bo_generate_seo_all'); ?>
                    <button type="submit" class="button button-primary">Genera per tutte le pagine</button>
                </form>
                
                <h3>Cron Job Settimanale</h3>
                <p>Il job settimanale viene eseguito automaticamente ogni domenica alle 2:00 del mattino per aggiornare tutte le descrizioni SEO.</p>
                <form method="post" action="<?php echo esc_url($action); ?>" onsubmit="return confirm('Eseguire la generazione SEO settimanale adesso?');">
                    <input type="hidden" name="action" value="benzinaoggi_run_weekly_seo" />
                    <?php wp_nonce_field('bo_run_weekly_seo'); ?>
                    <button type="submit" class="button button-secondary">Esegui generazione SEO settimanale</button>
                </form>
                
                <?php
                // Mostra info sul prossimo cron
                $next_run = wp_next_scheduled('benzinaoggi_weekly_seo_generation');
                if ($next_run) {
                    echo '<p><strong>Prossima esecuzione automatica:</strong> ' . date_i18n('d/m/Y H:i', $next_run) . '</p>';
                } else {
                    echo '<p><em>Cron job settimanale non programmato</em></p>';
                }
                ?>
                
                <h2>Shortcode</h2>
                <code>[carburanti_map]</code>
                
            <?php elseif ($active_tab == 'import'): ?>
                <h2>Azioni</h2>
                <?php $action = admin_url('admin-post.php'); ?>
                <form method="post" action="<?php echo esc_url($action); ?>" style="margin-top:8px">
                    <input type="hidden" name="action" value="benzinaoggi_import" />
                    <?php wp_nonce_field('bo_import_all'); ?>
                    <button type="submit" class="button button-secondary">Avvia sincronizzazione pagine (cron)</button>
                </form>
                <form method="post" action="<?php echo esc_url($action); ?>" style="margin-top:8px">
                    <input type="hidden" name="action" value="benzinaoggi_run_variations" />
                    <?php wp_nonce_field('bo_run_variations'); ?>
                    <button type="submit" class="button button-secondary">Esegui adesso notifica variazioni</button>
                </form>
                <form method="post" action="<?php echo esc_url($action); ?>" style="margin-top:8px">
                    <input type="hidden" name="action" value="benzinaoggi_run_daily_update" />
                    <?php wp_nonce_field('bo_run_daily_update'); ?>
                    <button type="submit" class="button button-primary">Esegui aggiornamento prezzi giornaliero</button>
                </form>
                <?php
                $last = get_option('benzinaoggi_last_sync');
                if ($last && is_array($last)) {
                    echo '<p><strong>Ultima sincronizzazione:</strong> ' . esc_html($last['when']) . '</p>';
                    echo '<p>Statistiche: ' . intval($last['total'] ?? 0) . ' totali, ' .
                         intval($last['created'] ?? 0) . ' create, ' .
                         intval($last['skipped'] ?? 0) . ' saltate, ' .
                         intval($last['errors'] ?? 0) . ' errori</p>';
                }
                $ongoing = get_option('benzinaoggi_sync_state');
                if ($ongoing && is_array($ongoing)) {
                    echo '<p><em>Sincronizzazione in corso</em>: indice ' . intval($ongoing['next_index'] ?? 0) . ' di ' . intval($ongoing['total'] ?? 0) . '</p>';
                    echo '<p>Parziali: ' . intval($ongoing['created'] ?? 0) . ' create, ' . intval($ongoing['skipped'] ?? 0) . ' saltate, ' . intval($ongoing['errors'] ?? 0) . ' errori</p>';
                }
                
                $lastPriceUpdate = get_option('benzinaoggi_last_price_update');
                if ($lastPriceUpdate) {
                    echo '<p><strong>Ultimo aggiornamento prezzi:</strong> ' . esc_html($lastPriceUpdate['when']) . '</p>';
                    echo '<p>Statistiche: ' . intval($lastPriceUpdate['processed'] ?? 0) . ' processati, ' . 
                         intval($lastPriceUpdate['updated'] ?? 0) . ' aggiornati, ' . 
                         intval($lastPriceUpdate['created'] ?? 0) . ' creati, ' . 
                         intval($lastPriceUpdate['errors'] ?? 0) . ' errori</p>';
                }
                ?>
                
            <?php elseif ($active_tab == 'notifications'): ?>
                <h2>Gestione Notifiche</h2>
                <p>Le notifiche vengono inviate automaticamente quando i prezzi scendono per i distributori a cui gli utenti sono iscritti.</p>
                <p><strong>Configurazione OneSignal:</strong> Assicurati di aver configurato correttamente App ID e API Key nelle impostazioni.</p>
                
            <?php elseif ($active_tab == 'pages'): ?>
                <h2>Pagine Template</h2>
                <p>Crea le pagine necessarie per il funzionamento del plugin con i template personalizzati.</p>
                
                <div class="card" style="max-width: 600px;">
                    <h3>Pagine da creare:</h3>
                    <ul>
                        <li><strong>Home:</strong> <code>/benzinaoggi-home/</code> - Pagina principale con mappa e ricerca</li>
                        <li><strong>Risultati:</strong> <code>/benzinaoggi-risultati/</code> - Pagina per visualizzare i risultati della ricerca</li>
                        <li><strong>Distributori:</strong> <code>/distributore-{ID}/</code> - Pagine dinamiche per ogni distributore</li>
                    </ul>
                    
                    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="margin-top: 20px;">
                        <input type="hidden" name="action" value="benzinaoggi_create_pages" />
                        <?php wp_nonce_field('benzinaoggi_create_pages'); ?>
                        <button type="submit" class="button button-primary">Crea Pagine Template</button>
                    </form>
                </div>
                
                <h3>Gestione Pagine Distributori:</h3>
                <div class="card" style="max-width: 600px; margin-bottom: 20px;">
                    <h4>Elimina Pagine Distributori</h4>
                    <p>Elimina tutte le pagine dei distributori che contengono il shortcode <code>[carburante_distributor impianto_id=]</code></p>
                    
                    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="margin-top: 15px;" onsubmit="return confirm('Sei sicuro di voler eliminare tutte le pagine dei distributori? Questa azione non può essere annullata.');">
                        <input type="hidden" name="action" value="benzinaoggi_delete_distributor_pages" />
                        <?php wp_nonce_field('benzinaoggi_delete_distributor_pages'); ?>
                        <button type="submit" class="button button-secondary" style="background-color: #dc3232; color: white; border-color: #dc3232;">
                            🗑️ Elimina Pagine Distributori
                        </button>
                    </form>
                </div>
                
                <h3>Pagine esistenti:</h3>
                <?php
                $home_page = get_page_by_path('benzinaoggi-home');
                $results_page = get_page_by_path('benzinaoggi-risultati');
                ?>
                <table class="wp-list-table widefat fixed striped">
                    <thead>
                        <tr>
                            <th>Pagina</th>
                            <th>Stato</th>
                            <th>URL</th>
                            <th>Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Home</td>
                            <td><?php echo $home_page ? '<span style="color: green;">✓ Creata</span>' : '<span style="color: red;">✗ Non creata</span>'; ?></td>
                            <td><?php echo $home_page ? '<a href="' . get_permalink($home_page->ID) . '" target="_blank">' . get_permalink($home_page->ID) . '</a>' : '-'; ?></td>
                            <td><?php echo $home_page ? '<a href="' . get_edit_post_link($home_page->ID) . '">Modifica</a>' : '-'; ?></td>
                        </tr>
                        <tr>
                            <td>Risultati</td>
                            <td><?php echo $results_page ? '<span style="color: green;">✓ Creata</span>' : '<span style="color: red;">✗ Non creata</span>'; ?></td>
                            <td><?php echo $results_page ? '<a href="' . get_permalink($results_page->ID) . '" target="_blank">' . get_permalink($results_page->ID) . '</a>' : '-'; ?></td>
                            <td><?php echo $results_page ? '<a href="' . get_edit_post_link($results_page->ID) . '">Modifica</a>' : '-'; ?></td>
                        </tr>
                    </tbody>
                </table>
                
            <?php endif; ?>
        </div>
        <?php
    }

    public function handle_run_variations() {
        if (!current_user_can('manage_options')) wp_die('Not allowed');
        // Schedule single event to run in background
        if (!wp_next_scheduled('benzinaoggi_check_variations')) {
            wp_schedule_single_event(time() + 5, 'benzinaoggi_check_variations');
        }
        // Try to immediately spawn wp-cron so the job appears and runs
        if (function_exists('spawn_cron')) {
            @spawn_cron(time() + 1);
        } else {
            // Fallback: ping wp-cron.php
            wp_remote_post(site_url('wp-cron.php'));
        }
        // Also run synchronously now to send notifications immediately
        @ignore_user_abort(true);
        @set_time_limit(180);
        $this->cron_check_variations();
        set_transient('benzinaoggi_notice', 'Job variazioni avviato. Notifiche inviate se presenti cali prezzo.', 30);
        wp_redirect(admin_url('options-general.php?page=benzinaoggi'));
        exit;
    }
    
    public function handle_run_daily_update() {
        if (!current_user_can('manage_options')) wp_die('Not allowed');
        check_admin_referer('bo_run_daily_update');
        
        // Esegui immediatamente l'aggiornamento prezzi
        $this->cron_daily_price_update();
        
        set_transient('benzinaoggi_notice', 'Aggiornamento prezzi giornaliero eseguito. Controlla i log per i dettagli.', 30);
        wp_redirect(admin_url('options-general.php?page=benzinaoggi'));
        exit;
    }

    public function handle_run_weekly_seo() {
        if (!current_user_can('manage_options')) wp_die('Not allowed');
        check_admin_referer('bo_run_weekly_seo');
        
        // Esegui immediatamente la generazione SEO
        $this->cron_weekly_seo_generation();
        
        set_transient('benzinaoggi_notice', 'Generazione SEO settimanale eseguita. Controlla i log per i dettagli.', 30);
        wp_redirect(admin_url('options-general.php?page=benzinaoggi'));
        exit;
    }

    public function handle_create_pages() {
        if (!current_user_can('manage_options')) {
            wp_die('Non autorizzato');
        }
        
        check_admin_referer('benzinaoggi_create_pages');
        
        $pages_created = [];
        
        // Pagina Home
        $home_page = get_page_by_path('benzinaoggi-home');
        if (!$home_page) {
            $home_id = wp_insert_post([
                'post_title' => 'BenzinaOggi - Trova i prezzi più bassi',
                'post_name' => 'benzinaoggi-home',
                'post_content' => '[carburanti_map]',
                'post_status' => 'publish',
                'post_type' => 'page',
                'post_author' => get_current_user_id()
            ]);
            if ($home_id) {
                $pages_created[] = 'Home page creata (ID: ' . $home_id . ')';
            }
        } else {
            $pages_created[] = 'Home page già esistente (ID: ' . $home_page->ID . ')';
        }
        
        // Pagina Risultati
        $results_page = get_page_by_path('benzinaoggi-risultati');
        if (!$results_page) {
            $results_id = wp_insert_post([
                'post_title' => 'Risultati Ricerca Distributori',
                'post_name' => 'benzinaoggi-risultati',
                'post_content' => 'Pagina per visualizzare i risultati della ricerca distributori.',
                'post_status' => 'publish',
                'post_type' => 'page',
                'post_author' => get_current_user_id()
            ]);
            if ($results_id) {
                $pages_created[] = 'Pagina risultati creata (ID: ' . $results_id . ')';
            }
        } else {
            $pages_created[] = 'Pagina risultati già esistente (ID: ' . $results_page->ID . ')';
        }
        
        // Imposta permalink structure per distributori
        $this->setup_rewrite_rules();
        
        wp_redirect(admin_url('admin.php?page=benzinaoggi&tab=pages&created=' . urlencode(implode(', ', $pages_created))));
        exit;
    }
    
    private function setup_rewrite_rules() {
        // Aggiungi regola per distributori: /distributore-123/
        add_rewrite_rule(
            '^distributore-([0-9]+)/?$',
            'index.php?pagename=distributore-$matches[1]',
            'top'
        );
        
        // Flush rewrite rules
        flush_rewrite_rules();
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

    public function handle_delete_distributor_pages() {
        if (!current_user_can('manage_options')) wp_die('Not allowed');
        check_admin_referer('benzinaoggi_delete_distributor_pages');
        
        $deleted_count = 0;
        $errors = [];
        
        // Trova tutte le pagine che contengono il shortcode [carburante_distributor impianto_id=]
        $pages = get_posts([
            'post_type' => 'page',
            'post_status' => 'publish',
            'numberposts' => -1,
            'meta_query' => [
                [
                    'key' => '_wp_page_template',
                    'value' => 'single-distributor.php',
                    'compare' => '='
                ]
            ]
        ]);
        
        // Aggiungi anche le pagine che contengono il shortcode nel contenuto
        $pages_with_shortcode = get_posts([
            'post_type' => 'page',
            'post_status' => 'publish',
            'numberposts' => -1,
            's' => '[carburante_distributor impianto_id='
        ]);
        
        $all_pages = array_merge($pages, $pages_with_shortcode);
        $all_pages = array_unique($all_pages, SORT_REGULAR);
        
        foreach ($all_pages as $page) {
            // Verifica che la pagina contenga effettivamente il shortcode
            if (strpos($page->post_content, '[carburante_distributor impianto_id=') !== false ||
                get_page_template_slug($page->ID) === 'single-distributor.php') {
                
                if (wp_delete_post($page->ID, true)) {
                    $deleted_count++;
                } else {
                    $errors[] = "Errore nell'eliminazione della pagina: " . $page->post_title;
                }
            }
        }
        
        // Messaggio di risultato
        if ($deleted_count > 0) {
            $message = "Eliminate {$deleted_count} pagine distributori.";
            if (!empty($errors)) {
                $message .= " Errori: " . implode(', ', $errors);
            }
        } else {
            $message = "Nessuna pagina distributore trovata da eliminare.";
        }
        
        wp_redirect(admin_url('admin.php?page=benzinaoggi&deleted_pages=' . urlencode($message)));
        exit;
    }

    /**
     * Aggiunge il template personalizzato alla lista dei template disponibili
     */
    public function add_custom_page_template($templates) {
        $templates['page-distributor.php'] = 'Distributore BenzinaOggi';
        return $templates;
    }

    /**
     * Carica il template personalizzato quando selezionato
     */
    public function load_custom_page_template($template) {
        global $post;
        
        if ($post && get_page_template_slug($post->ID) === 'page-distributor.php') {
            // Prima cerca nel tema BenzinaOggi
            $benzinaoggi_theme_template = get_theme_root() . '/benzinaoggi/page-distributor.php';
            if (file_exists($benzinaoggi_theme_template)) {
                return $benzinaoggi_theme_template;
            }
            
            // Poi cerca nel tema attivo
            $theme_template = get_template_directory() . '/page-distributor.php';
            if (file_exists($theme_template)) {
                return $theme_template;
            }
            
            // Fallback: cerca nel plugin
            $plugin_template = plugin_dir_path(__FILE__) . 'templates/page-distributor.php';
            if (file_exists($plugin_template)) {
                return $plugin_template;
            }
        }
        
        return $template;
    }

    /**
     * Aggiunge azione riga "Genera descrizione SEO" nella lista Pagine
     */
    public function add_generate_seo_row_action($actions, $post) {
        if ($post->post_type !== 'page' || !current_user_can('edit_post', $post->ID)) return $actions;
        $url = wp_nonce_url(admin_url('admin-post.php?action=benzinaoggi_generate_seo&post_id=' . intval($post->ID)), 'bo_generate_seo_' . $post->ID);
        $icon = '<span class="dashicons dashicons-edit-page" style="vertical-align: text-bottom;"></span>';
        $actions['bo_generate_seo'] = '<a href="' . esc_url($url) . '" title="Genera descrizione SEO">' . $icon . ' Genera descrizione</a>';
        return $actions;
    }

    /**
     * Handler: genera descrizione SEO con Gemini e la aggiunge al contenuto della pagina
     */
    public function handle_generate_seo_description() {
        if (!current_user_can('edit_pages')) wp_die('Not allowed');
        $post_id = isset($_GET['post_id']) ? intval($_GET['post_id']) : 0;
        if (!$post_id) wp_die('Post non valido');
        check_admin_referer('bo_generate_seo_' . $post_id);

        $opts = $this->get_options();
        $api_key = trim($opts['gemini_api_key'] ?? '');
        if (!$api_key) {
            wp_die('Configura prima la Google Gemini API Key nelle impostazioni BenzinaOggi.');
        }

        $post = get_post($post_id);
        if (!$post || $post->post_type !== 'page') wp_die('Pagina non trovata');

        $site_name = get_bloginfo('name');
        $title = get_the_title($post_id);
        $permalink = get_permalink($post_id);

        $prompt = sprintf(
            "Agisci come copywriter SEO. In italiano, genera SOLO un JSON con due campi: \n".
            "- meta: UNA sola frase completa (<=156 caratteri), naturale e chiara, che termina con un punto. Evita keyword stuffing, non citare il brand o il sito, non promettere 'tempo reale'. Inserisci il nome città se presente nel titolo.\n".
            "- html: un blocco HTML BREVE e UNICO che non usi <h1> (usa al massimo <h2>/<h3>), includa 1-2 paragrafi + un elenco puntato conciso (3 voci), con 2-3 emoji pertinenti. Niente ripetizioni ovvie del titolo e nessun brand.\n".
            "Vincoli: usa solo informazioni deducibili dal titolo. Non inventare dati specifici. Non ripetere testualmente il campo 'meta'.\n".
            "Contesto: Titolo pagina: '%s' — URL: %s. \n".
            "Rispondi SOLO con JSON: {\"meta\":\"...\",\"html\":\"...\"} senza testo extra.",
            $title,
            $permalink
        );

        // 1) Scopri dinamicamente un modello disponibile (prefer "flash" gratuito)
        $chosen_model = get_transient('bo_gemini_model');
        if (!$chosen_model) {
            $models_url = add_query_arg('key', rawurlencode($api_key), 'https://generativelanguage.googleapis.com/v1/models');
            $list = wp_remote_get($models_url, [ 'timeout' => 20 ]);
            if (!is_wp_error($list) && wp_remote_retrieve_response_code($list) === 200) {
                $j = json_decode(wp_remote_retrieve_body($list), true);
                $models = isset($j['models']) && is_array($j['models']) ? $j['models'] : [];
                // Filtra modelli che supportano generateContent
                $eligible = array_filter($models, function($m){
                    if (empty($m['name'])) return false;
                    $methods = isset($m['supportedGenerationMethods']) ? $m['supportedGenerationMethods'] : [];
                    return is_array($methods) && in_array('generateContent', $methods, true);
                });
                // Preferisci quelli con "flash" nel nome
                usort($eligible, function($a, $b){
                    $an = strtolower($a['name']); $bn = strtolower($b['name']);
                    $aFlash = strpos($an, 'flash') !== false ? 1 : 0;
                    $bFlash = strpos($bn, 'flash') !== false ? 1 : 0;
                    if ($aFlash !== $bFlash) return $bFlash - $aFlash; // flash prima
                    // poi per versione più alta
                    return strcmp($bn, $an);
                });
                if (!empty($eligible)) {
                    // I nomi arrivano come "models/gemini-1.5-flash" → prendi la parte dopo "models/"
                    $full = $eligible[0]['name'];
                    $parts = explode('/', $full);
                    $chosen_model = end($parts);
                }
            }
            if (!$chosen_model) {
                // Fallback statico a un modello comunemente disponibile
                $chosen_model = 'gemini-1.5-flash';
            }
            set_transient('bo_gemini_model', $chosen_model, HOUR_IN_SECONDS);
        }
        $endpoint_generate = add_query_arg('key', rawurlencode($api_key), 'https://generativelanguage.googleapis.com/v1/models/' . rawurlencode($chosen_model) . ':generateContent');
        $body = array(
            'contents' => array(
                array(
                    'role' => 'user',
                    'parts' => array(
                        array('text' => $prompt)
                    )
                )
            )
        );

        $response = wp_remote_post($endpoint_generate, array(
            'timeout' => 30,
            'headers' => array('Content-Type' => 'application/json'),
            'body' => wp_json_encode($body)
        ));

        if (is_wp_error($response)) {
            wp_die('Errore chiamata Gemini: ' . esc_html($response->get_error_message()));
        }

        $code = wp_remote_retrieve_response_code($response);
        $json = json_decode(wp_remote_retrieve_body($response), true);
        if ($code < 200 || $code >= 300) {
            $err = isset($json['error']['message']) ? $json['error']['message'] : 'Unknown error';
            // se fallisce, invalida la cache modello e suggerisci di riprovare
            delete_transient('bo_gemini_model');
            wp_die('Gemini ha risposto con errore: ' . esc_html($err) . ' (modello: ' . esc_html($chosen_model) . '). Riprova.');
        }

        // Estrai meta/html dal testo del modello (atteso SOLO JSON). Evita qualunque leak di JSON/markup nel campo meta.
        $modelText = !empty($json['candidates'][0]['content']['parts'][0]['text']) ? trim($json['candidates'][0]['content']['parts'][0]['text']) : '';
        $genMeta = '';
        $genHtml = '';
        if ($modelText) {
            // Prova parsing rigoroso: isola il primo blocco JSON se presenti testi extra
            $start = strpos($modelText, '{');
            $end = strrpos($modelText, '}');
            $jsonSlice = ($start !== false && $end !== false && $end > $start) ? substr($modelText, $start, $end - $start + 1) : $modelText;
            $try = json_decode($jsonSlice, true);
            if (is_array($try)) {
                $genMeta = isset($try['meta']) ? trim((string)$try['meta']) : '';
                $genHtml = isset($try['html']) ? (string)$try['html'] : '';
            }
        }
        // Fallback prudenti
        if (!$genMeta && $genHtml) {
            $genMeta = wp_strip_all_tags($genHtml);
        }
        if (!$genMeta && $modelText) {
            // Estrai solo testo (senza braces/keys) come ultima risorsa
            $tmp = preg_replace('/"?meta"?\s*:\s*|"?html"?\s*:\s*/i', '', $modelText);
            $tmp = preg_replace('/[{}\[\]]/', ' ', $tmp);
            $genMeta = trim(preg_replace('/\s+/', ' ', wp_strip_all_tags($tmp)));
        }
        // Assicurati che meta sia sempre plain text
        $genMeta = trim(preg_replace('/\s+/', ' ', wp_strip_all_tags((string)$genMeta)));
        // HTML: se vuoto, crea un paragrafo semplice
        if (!$genHtml) {
            $genHtml = '<p>' . esc_html($genMeta) . '</p>';
        }
        if (!$genMeta && !$genHtml) {
            wp_die('Nessun contenuto generato da Gemini.');
        }

        // Non modificare il contenuto. Salva come excerpt e in meta dedicato.
        // Prepara versione meta (max 156 caratteri, testo piano)
        // Rifinitura meta: massimizza senso compiuto entro 156
        $plain = trim(preg_replace('/\s+/', ' ', wp_strip_all_tags($genMeta)));
        $metaDesc = $this->smart_trim_sentence($plain, 156);

        $update = wp_update_post(array(
            'ID' => $post_id,
            'post_excerpt' => wp_slash($metaDesc)
        ), true);
        if (is_wp_error($update)) {
            wp_die('Errore nell\'aggiornamento della pagina (excerpt): ' . esc_html($update->get_error_message()));
        }
        update_post_meta($post_id, 'bo_seo_description', wp_kses_post($genHtml));
        // Aggiorna meta description per plugin SEO comuni (se presenti) con versione troncata
        update_post_meta($post_id, '_yoast_wpseo_metadesc', $metaDesc);
        update_post_meta($post_id, '_rank_math_description', $metaDesc);
        update_post_meta($post_id, '_aioseo_description', $metaDesc);

        // Aggiorna anche il contenuto della pagina:
        // - Se trova il shortcode [carburante_distributor impianto_id=...] sostituisce tutto ciò che segue con il blocco SEO
        // - Altrimenti aggiunge in coda
        $content = (string) $post->post_content;
        $uniqueMarker = '<!-- SEO: Generated by Gemini | post '.intval($post_id).' | '.esc_html(current_time('mysql')).' -->';
        $new_block = $uniqueMarker . "\n" . (string) wp_kses_post($genHtml) . "\n";
        $shortcode_pattern = '/(\[carburante_distributor\s+impianto_id="?\d+"?\])/i';
        if (preg_match($shortcode_pattern, $content, $m, PREG_OFFSET_CAPTURE)) {
            $pos = $m[0][1] + strlen($m[0][0]);
            $head = substr($content, 0, $pos);
            $content = rtrim($head) . "\n\n" . $new_block;
        } else {
            $content = rtrim($content) . "\n\n" . $new_block;
        }
        $update2 = wp_update_post(array(
            'ID' => $post_id,
            'post_content' => wp_slash($content)
        ), true);
        if (is_wp_error($update2)) {
            wp_die('Errore nell\'aggiornamento del contenuto: ' . esc_html($update2->get_error_message()));
        }

        // Redirect back to edit page con messaggio
        wp_redirect(add_query_arg(array('updated' => 'true', 'bo_seo' => 'saved'), get_edit_post_link($post_id, '')));
        exit;
    }

    /**
     * Meta box nel post edit per generare descrizione SEO
     */
    public function register_seo_metabox() {
        add_meta_box(
            'bo_seo_gemini_box',
            'BenzinaOggi – Descrizione SEO (Gemini)',
            [$this, 'render_seo_metabox'],
            'page',
            'side',
            'high'
        );
    }

    public function render_seo_metabox($post) {
        if (!current_user_can('edit_post', $post->ID)) {
            echo '<p>Permessi insufficienti.</p>';
            return;
        }
        $opts = $this->get_options();
        $has_key = !empty($opts['gemini_api_key']);
        $desc = get_post_meta($post->ID, 'bo_seo_description', true);
        $nonce = wp_create_nonce('bo_generate_seo_' . $post->ID);
        $action_url = admin_url('admin-post.php?action=benzinaoggi_generate_seo&post_id=' . intval($post->ID) . '&_wpnonce=' . $nonce);
        echo '<div class="bo-seo-box">';
        if (!$has_key) {
            echo '<p><strong>API Key mancante.</strong><br/>Imposta la <em>Google Gemini API Key</em> in Impostazioni → Benzina Oggi.</p>';
        } else {
            echo '<p>Genera automaticamente una descrizione SEO basata sul titolo della pagina.</p>';
            echo '<p><a href="' . esc_url($action_url) . '" class="button button-primary" style="width:100%">Genera descrizione</a></p>';
        }
        if (!empty($desc)) {
            echo '<p><em>Ultima descrizione:</em></p>';
            echo '<div style="max-height:120px; overflow:auto; padding:8px; background:#f6f7f7; border:1px solid #dcdcde;">' . wp_kses_post($desc) . '</div>';
        }
        echo '</div>';
    }

    public function cron_daily_price_update() {
        $this->log_progress('Avvio aggiornamento prezzi giornaliero con rilevamento variazioni...');
        
        $api_base = $this->get_options()['api_base'] ?? '';
        if (empty($api_base)) {
            $this->log_progress('ERRORE: API base non configurata');
            return;
        }
        
        try {
            // STEP 1: Aggiorna prezzi (ALL) usando endpoint cron che pagina tutti
            $this->log_progress('STEP 1: Aggiornamento prezzi (update-prices-daily all=true)...');
            $response = wp_remote_get($api_base . '/api/cron/update-prices-daily?all=true&force=true', [
                'timeout' => 300, // 5 minuti timeout
                'headers' => [
                    'Authorization' => 'Bearer ' . ($this->get_options()['api_secret'] ?? ''),
                    'User-Agent' => 'BenzinaOggi-WordPress/1.0'
                ]
            ]);
            
            if (is_wp_error($response)) {
                $this->log_progress('ERRORE chiamata API: ' . $response->get_error_message());
                return;
            }
            
            $body = wp_remote_retrieve_body($response);
            $data = json_decode($body, true);
            
            if ($data && $data['ok']) {
                $summary = $data['summary'] ?? [];
                $results = $data['results'] ?? [];
                
                $this->log_progress(sprintf(
                    'Aggiornamento completato: %d processati, %d aggiornati, %d creati',
                    $summary['totalProcessed'] ?? 0,
                    $summary['totalUpdated'] ?? 0,
                    $summary['totalCreated'] ?? 0
                ));
                
                // STEP 2: Rileva variazioni dopo aggiornamento
                $this->log_progress('STEP 2: Rilevamento variazioni dopo aggiornamento...');
                $variationResponse = wp_remote_get($api_base . '/api/check-variations-smart?onlyDown=true&verbose=true&limit=100', [
                    'timeout' => 60,
                    'headers' => [
                        'Authorization' => 'Bearer ' . ($this->get_options()['api_secret'] ?? ''),
                        'User-Agent' => 'BenzinaOggi-WordPress/1.0'
                    ]
                ]);
                
                if (!is_wp_error($variationResponse)) {
                    $variationData = json_decode(wp_remote_retrieve_body($variationResponse), true);
                    $variations = $variationData['variations'] ?? [];
                    $variationCount = count($variations);
                    
                    if ($variationCount > 0) {
                        $this->log_progress("STEP 3: Invio notifiche per {$variationCount} variazioni...");
                        
                        // Raggruppa variazioni per distributore
                        $variationsByDistributor = [];
                        foreach ($variations as $variation) {
                            $distributorId = $variation['impiantoId'] ?? $variation['distributorId'];
                            if (!isset($variationsByDistributor[$distributorId])) {
                                $variationsByDistributor[$distributorId] = [];
                            }
                            $variationsByDistributor[$distributorId][] = $variation;
                        }
                        
                        // Invia notifica per ogni distributore con variazioni
                        $opts = $this->get_options();
                        foreach ($variationsByDistributor as $distributorId => $distributorVariations) {
                            foreach ($distributorVariations as $variation) {
                                $this->send_price_drop_notification($variation, $opts);
                            }
                        }
                        
                        $this->log_progress("Notifiche inviate per " . count($variationsByDistributor) . " distributori");
                    } else {
                        $this->log_progress('Nessuna variazione rilevata dopo aggiornamento');
                    }
                } else {
                    $this->log_progress('ERRORE rilevamento variazioni: ' . $variationResponse->get_error_message());
                }
                
                // Salva statistiche
                update_option('benzinaoggi_last_price_update', [
                    'when' => current_time('mysql'),
                    'processed' => $summary['totalProcessed'] ?? 0,
                    'updated' => $summary['totalUpdated'] ?? 0,
                    'variations' => $variationCount,
                    'notifications_sent' => $variationCount > 0 ? count($variationsByDistributor ?? []) : 0
                ]);
                
            } else {
                $error = $data['error'] ?? 'Errore sconosciuto';
                $this->log_progress('ERRORE risposta API: ' . $error);
            }
            
        } catch (Exception $e) {
            $this->log_progress('ERRORE eccezione: ' . $e->getMessage());
        }
    }

    public function cron_sync_pages() {
        $opts = $this->get_options();
        $base = rtrim($opts['api_base'], '/');
        if (!$base) return;
        @ignore_user_abort(true);
        @set_time_limit(3600);
        @ini_set('memory_limit', '512M');
        $headers = [];
        if (!empty($opts['api_secret'])) { $headers['Authorization'] = 'Bearer '.$opts['api_secret']; }

        // Stato di sincronizzazione per esecuzioni a tranche (con versioning della logica)
        $state = get_option('benzinaoggi_sync_state', []);
        $logicVersion = 'noTitleCheck_v1';
        $stateVersion = isset($state['logic_v']) ? $state['logic_v'] : null;
        $resetForNewLogic = $stateVersion !== $logicVersion;
        $startIndex = $resetForNewLogic ? 0 : intval($state['next_index'] ?? 0);
        $accCreated = $resetForNewLogic ? 0 : intval($state['created'] ?? 0);
        $accSkipped = $resetForNewLogic ? 0 : intval($state['skipped'] ?? 0);
        $accErrors  = $resetForNewLogic ? 0 : intval($state['errors'] ?? 0);
        $batchSize  = 5000; // numero massimo da processare per run

        if ($resetForNewLogic) {
            $this->log_progress('Sync pagine — reset stato per nuova logica (solo controllo slug). Ricomincio da 0.');
        }
        $this->log_progress('Sync pagine — startIndex='.$startIndex.' batchSize='.$batchSize.' (scarico elenco)…');
        $res2 = wp_remote_get($base.'/api/distributors-all', ['timeout' => 600, 'headers' => $headers]);
        if (is_wp_error($res2)) { $this->log_progress('Errore API distributors-all: '.$res2->get_error_message()); return; }
        $data = json_decode(wp_remote_retrieve_body($res2), true);
        if (empty($data['distributors']) || !is_array($data['distributors'])) { $this->log_progress('Nessun distributore ricevuto.'); return; }

        $total = count($data['distributors']);
        $end = min($startIndex + $batchSize, $total);
        $created = 0; $skipped = 0; $errors = 0;
        $this->log_progress('Totale='.$total.' — Elaboro da '.$startIndex.' a '.($end-1));

        for ($i = $startIndex; $i < $end; $i++) {
            $d = $data['distributors'][$i];
            $rawTitle = trim(($d['bandiera'] ?: 'Distributore').' '.($d['comune'] ?: ''));
            $title = trim(preg_replace('/\s+/', ' ', $rawTitle));
            if (empty($d['impiantoId'])) { $skipped++; continue; }
            // Slug nel formato bandiera-comune-id (anche se comune è vuoto)
            $slugParts = [ ($d['bandiera'] ?: 'Distributore') ];
            if (!empty($d['comune'])) { $slugParts[] = $d['comune']; }
            $slugParts[] = $d['impiantoId'];
            $slug = sanitize_title(implode('-', $slugParts));
            // Verifica solo per slug: il titolo può essere uguale per più impianti nella stessa città
            $existingBySlug  = get_page_by_path($slug, OBJECT, 'page');
            if ($existingBySlug) { $skipped++; } else {
                $post_id = wp_insert_post([
                    'post_title' => $title,
                    'post_name'  => $slug,
                    'post_type'  => 'page',
                    'post_status'=> 'publish',
                    'post_content' => '[carburante_distributor impianto_id="'.$d['impiantoId'].'"]',
                    'page_template' => 'page-distributor.php'
                ], true);
                if (is_wp_error($post_id)) { $errors++; $this->log_progress('Errore crea pagina impianto '.$d['impiantoId'].': '.$post_id->get_error_message()); }
                else { $created++; }
            }
            if ( (($i+1) % 500) === 0 ) {
                $this->log_progress('Avanzamento parziale: '.($i+1).' / '.$total.' — create: '.($accCreated+$created).' — skipped: '.($accSkipped+$skipped).' — errors: '.($accErrors+$errors));
            }
        }

        // Aggiorna accumulati e next index
        $accCreated += $created; $accSkipped += $skipped; $accErrors += $errors;
        $nextIndex = $end;

        if ($nextIndex < $total) {
            update_option('benzinaoggi_sync_state', [
                'next_index' => $nextIndex,
                'created' => $accCreated,
                'skipped' => $accSkipped,
                'errors'  => $accErrors,
                'total'   => $total,
                'when'    => current_time('mysql'),
                'logic_v' => $logicVersion
            ], false);
            $this->log_progress('Tranche completata: next_index='.$nextIndex.' / '.$total.' (create='.$accCreated.' skipped='.$accSkipped.' errors='.$accErrors.'). Reschedulo…');
            // pianifica subito la prossima tranche
            if (!wp_next_scheduled('benzinaoggi_sync_pages')) {
                wp_schedule_single_event(time() + 5, 'benzinaoggi_sync_pages');
            } else {
                // comunque prova a spawnare
                if (function_exists('spawn_cron')) { @spawn_cron(time() + 1); }
            }
            return; // esci, continuerà alla prossima run
        }

        // Finito
        delete_option('benzinaoggi_sync_state');
        update_option('benzinaoggi_last_sync', [
            'when' => current_time('mysql'),
            'created' => $accCreated,
            'skipped' => $accSkipped,
            'errors' => $accErrors,
            'total' => $total
        ], false);
        $this->log_progress('Sync completato. Create: '.$accCreated.' — skipped: '.$accSkipped.' — errors: '.$accErrors.' — total: '.$total);
    }

    public function cron_weekly_seo_generation() {
        $this->log_progress('Avvio generazione SEO settimanale per tutte le pagine...');
        
        $opts = $this->get_options();
        if (empty($opts['gemini_api_key'])) {
            $this->log_progress('ERRORE: Google Gemini API Key non configurata');
            return;
        }
        
        @ignore_user_abort(true);
        @set_time_limit(1800); // 30 minuti timeout
        @ini_set('memory_limit', '512M');
        
        // Ottieni tutte le pagine pubblicate
        $pages = get_posts([
            'post_type' => 'page',
            'post_status' => 'publish',
            'numberposts' => -1,
            'fields' => 'ids'
        ]);
        
        $total = count($pages);
        $processed = 0;
        $errors = 0;
        
        $this->log_progress("Trovate {$total} pagine da processare");
        
        foreach ($pages as $page_id) {
            try {
                $this->generate_seo_for_post($page_id);
                $processed++;
                
                // Log progresso ogni 10 pagine
                if ($processed % 10 === 0) {
                    $this->log_progress("Processate {$processed}/{$total} pagine...");
                }
                
                // Piccola pausa per evitare rate limiting
                usleep(100000); // 0.1 secondi
                
            } catch (Exception $e) {
                $errors++;
                $this->log_progress("ERRORE pagina ID {$page_id}: " . $e->getMessage());
            }
        }
        
        $this->log_progress("Generazione SEO settimanale completata. Processate: {$processed}, Errori: {$errors}");
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
    
    private function next_run_6am() {
        // Compute next 6:00 AM based on WP timezone
        $now = current_time('timestamp');
        $date = date_i18n('Y-m-d', $now, true);
        $six = strtotime($date.' 06:00:00');
        if ($six <= $now) {
            $six = strtotime('+1 day', $six);
        }
        return $six;
    }
    
    private function next_run_2am() {
        // Compute next 2:00 AM based on WP timezone
        $now = current_time('timestamp');
        $date = date_i18n('Y-m-d', $now, true);
        $two = strtotime($date.' 02:00:00');
        if ($two <= $now) {
            $two = strtotime('+1 day', $two);
        }
        return $two;
    }
    
    private function next_run_10am() {
        // Compute next 10:00 AM based on WP timezone
        $now = current_time('timestamp');
        $date = date_i18n('Y-m-d', $now, true);
        $ten = strtotime($date.' 10:00:00');
        if ($ten <= $now) {
            $ten = strtotime('+1 day', $ten);
        }
        return $ten;
    }
    
    public function handle_onesignal_worker() {
        if (isset($_GET['onesignal_worker']) && $_GET['onesignal_worker'] === '1') {
            // Back-compat: serve v16 SW from query path too
            header('Content-Type: application/javascript; charset=UTF-8');
            header('Cache-Control: public, max-age=31536000');
            echo "importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');";
            exit;
        }
    }

    public function register_sw_rewrites() {
        add_rewrite_rule('^OneSignalSDKWorker\.js$', 'index.php?onesignal_sw=1', 'top');
        add_rewrite_rule('^OneSignalSDKUpdaterWorker\.js$', 'index.php?onesignal_sw_updater=1', 'top');
        // v16 primary SW filename
        add_rewrite_rule('^OneSignalSDK\.sw\.js$', 'index.php?onesignal_sw_alias=1', 'top');
        add_filter('query_vars', function($vars){ $vars[]='onesignal_sw'; $vars[]='onesignal_sw_updater'; $vars[]='onesignal_sw_alias'; return $vars; });
        add_action('template_redirect', function(){
            if (get_query_var('onesignal_sw') || get_query_var('onesignal_sw_updater') || get_query_var('onesignal_sw_alias')) {
                header('Content-Type: application/javascript; charset=UTF-8');
                header('Cache-Control: public, max-age=31536000');
                // Always serve v16 SW
                echo "importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');";
                exit;
            }
        });
    }

    public function ensure_daily_variations_cron() {
        // Migrate to 10-minute schedule once
        $cron_v = get_option('benzinaoggi_cron_v');
        if ($cron_v !== 'ten_minutes_v1') {
            wp_clear_scheduled_hook('benzinaoggi_check_variations');
            wp_schedule_event(time() + 60, 'ten_minutes', 'benzinaoggi_check_variations');
            update_option('benzinaoggi_cron_v', 'ten_minutes_v1');
            $this->log_progress('Scheduled benzinaoggi_check_variations every 10 minutes.');
            return;
        }
        // Ensure it's scheduled
        if (!wp_next_scheduled('benzinaoggi_check_variations')) {
            wp_schedule_event(time() + 60, 'ten_minutes', 'benzinaoggi_check_variations');
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

        // Manual trigger to check variations and send notifications immediately
        register_rest_route('benzinaoggi/v1', '/run-variations', [
            'methods' => 'POST',
            'permission_callback' => '__return_true',
            'callback' => function($request){
                $opts = $this->get_options();
                $secret = sanitize_text_field($request->get_param('secret'));
                if (!$secret || $secret !== ($opts['webhook_secret'] ?? '')) {
                    return new WP_REST_Response(['ok'=>false,'error'=>'unauthorized'], 401);
                }
                if (!wp_next_scheduled('benzinaoggi_check_variations')) {
                    wp_schedule_single_event(time() + 5, 'benzinaoggi_check_variations');
                }
                if (function_exists('spawn_cron')) { @spawn_cron(time() + 1); }
                @ignore_user_abort(true);
                @set_time_limit(120);
                $this->cron_check_variations();
                return new WP_REST_Response(['ok'=>true,'message'=>'Variations job triggered']);
            }
        ]);

    }

    public function enqueue_assets() {
        if (!is_singular()) return;
        
        // Verifica se la pagina contiene lo shortcode del distributore
        global $post;
        $has_distributor_shortcode = ($post && has_shortcode($post->post_content, 'carburante_distributor'));
        
        // OneSignal SDK è già iniettato globalmente in wp_head da inject_onesignal_v16()
        $opts = $this->get_options();

        // Stili comuni
        wp_enqueue_style('benzinaoggi-style', plugins_url('public/style.css', __FILE__), [], '1.0.0');
        
        // Se la pagina ha lo shortcode del distributore, carica solo lo script dedicato
        if ($has_distributor_shortcode) {
            wp_register_script('benzinaoggi-distributor', plugins_url('public/distributor.js', __FILE__), [], '2.0.0', true);
            wp_localize_script('benzinaoggi-distributor', 'BenzinaOggi', [
                'apiBase' => rtrim($opts['api_base'], '/'),
                'onesignalAppId' => $opts['onesignal_app_id'],
                'onesignalOfficial' => false,
                'useOwnOneSignal' => true
            ]);
            wp_enqueue_script('benzinaoggi-distributor');
            return; // Non caricare app.js per evitare conflitti
        }
        
        // Always use our own OneSignal integration (do not rely on official plugin)
        $onesignal_official = false;
        // Leaflet
        wp_enqueue_style('leaflet', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', [], '1.9.4');
        wp_enqueue_script('leaflet', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', [], '1.9.4', true);
        // Leaflet Draw (for circle/polygon tools)
        wp_enqueue_style('leaflet-draw', 'https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css', [], '1.0.4');
        wp_enqueue_script('leaflet-draw', 'https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js', ['leaflet'], '1.0.4', true);
        // Leaflet Control Geocoder (Nominatim)
        wp_enqueue_style('leaflet-geocoder', 'https://unpkg.com/leaflet-control-geocoder/dist/Control.Geocoder.css', [], null);
        wp_enqueue_script('leaflet-geocoder', 'https://unpkg.com/leaflet-control-geocoder/dist/Control.Geocoder.js', ['leaflet'], null, true);
        
        // (OneSignal già caricato sopra se presente)
        // App
        wp_register_script('benzinaoggi-app', plugins_url('public/app.js', __FILE__), ['leaflet'], '1.0.0', true);
        $opts = $this->get_options();
        wp_localize_script('benzinaoggi-app', 'BenzinaOggi', [
            'apiBase' => rtrim($opts['api_base'], '/'),
            'onesignalAppId' => $opts['onesignal_app_id'],
            'onesignalOfficial' => false,
            'useOwnOneSignal' => true,
        ]);
        wp_enqueue_script('benzinaoggi-app');
        // lo script distributor è caricato solo quando è presente lo shortcode
    }

    public function shortcode_map($atts = []) {
        ob_start();
        ?>
        <div class="benzinaoggi-wrap">
            <div class="bo-filters-toggle"><button id="bo_filters_toggle" type="button">Nascondi filtri</button></div>
            <div class="filters">
                <div style="margin-bottom:8px;">
                    <strong>Disegna un'area di tipo:</strong>
                    <label style="margin-left:8px"><input type="radio" name="bo_shape" value="circle" checked /> Cerchio</label>
                    <label style="margin-left:8px"><input type="radio" name="bo_shape" value="polygon" /> Poligono</label>
                </div>
                <div style="margin-bottom:8px;">
                    <label>Impostazione attuale del Raggio <span id="bo_radius_km_label">9.5</span> km</label>
                    <input type="range" id="bo_radius_km" min="1" max="50" step="0.5" value="9.5" style="width:280px; vertical-align:middle; margin-left:8px" />
                </div>
                <input type="text" id="bo_city" placeholder="Via, cap, provincia" />
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
        
        $this->log_progress('Controllo variazioni ogni 10 minuti con endpoint smart...');
        
        // Use Bearer auth for protected endpoint
        $headers = [];
        if (!empty($opts['api_secret'])) {
            $headers['Authorization'] = 'Bearer ' . $opts['api_secret'];
        }
        
        // Usa endpoint smart per rilevamento intelligente (sempre con API MISE)
        $url = $base . '/api/check-variations-smart?onlyDown=true&verbose=true&limit=50';
        $resp = wp_remote_get($url, [ 
            'timeout' => 60, // Aumentato timeout per endpoint smart
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
        $method = $data['method'] ?? 'unknown';
        $summary = $data['summary'] ?? [];
        
        $this->log_progress(sprintf(
            'Controllo variazioni completato (metodo: %s): %d variazioni rilevate',
            $method,
            count($vars)
        ));
        if (empty($vars)) {
            $this->log_progress('No price variations detected');
            return;
        }

        $this->log_progress('Found ' . count($vars) . ' price variations');

        // Send specific notifications for each price drop
        foreach ($vars as $variation) {
            $dir = isset($variation['direction']) ? $variation['direction'] : (isset($variation['type']) ? $variation['type'] : null);
            if ($dir === 'down' || $dir === 'decrease') {
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
        
        // Controlla se ci sono utenti che hanno abilitato le notifiche per questo distributore
        $distributorId = isset($variation['impiantoId']) ? $variation['impiantoId'] : (isset($variation['distributorId']) ? $variation['distributorId'] : '');
        if (!$distributorId) {
            $this->log_progress('No distributor ID found in variation, skipping notification');
            return;
        }
        

        $title = "💰 Prezzo $fuelType sceso!";
        $message = "$distributorName: $fuelType da €" . number_format($oldPrice, 3) . " a €" . number_format($newPrice, 3) . " (-" . number_format($percentageDiff, 1) . "%)";

        // Fetch externalIds from Next API (sistema originale)
        $apiBase = rtrim($opts['api_base'] ?? '', '/');
        $externalIds = [];
        if ($apiBase) {
            $q = add_query_arg(array(
                // IMPORTANT: impiantoId must be the public impianto ID, not internal distributorId
                'impiantoId' => (isset($variation['impiantoId']) ? $variation['impiantoId'] : ''),
                'fuelType' => $fuelType
            ), $apiBase . '/api/subscriptions');
            $resp = wp_remote_get($q, [ 'timeout' => 15 ]);
            if (!is_wp_error($resp) && wp_remote_retrieve_response_code($resp) === 200) {
                $json = json_decode(wp_remote_retrieve_body($resp), true);
                if (!empty($json['externalIds']) && is_array($json['externalIds'])) {
                    $externalIds = $json['externalIds'];
                    // Log how many and a small sample to verify
                    $sample = array_slice($externalIds, 0, 5);
                    $this->log_progress('Subscriptions fetched for impianto '.(isset($variation['impiantoId']) ? $variation['impiantoId'] : 'unknown').' fuel '.$fuelType.': count='.count($externalIds).' sample='.json_encode($sample));
                }
            }
        }

        if (empty($externalIds)) {
            $this->log_progress('No subscribers (externalIds) for impianto '.(isset($variation['impiantoId']) ? $variation['impiantoId'] : 'unknown').' fuel '.$fuelType);
            return;
        }

        $payload = array(
            'app_id' => $app_id,
            'include_aliases' => array('external_id' => $externalIds),
            // Required when using alias targeting
            'target_channel' => 'push',
            // OneSignal requires an English (en) fallback
            'headings' => array('en' => $title, 'it' => $title),
            'contents' => array('en' => $message, 'it' => $message),
            'data' => array(
                'fuelType' => $fuelType,
                // Use impiantoId consistently as public identifier in payload
                'distributorId' => (isset($variation['impiantoId']) ? $variation['impiantoId'] : ''),
                'oldPrice' => $oldPrice,
                'newPrice' => $newPrice,
                'priceDiff' => $priceDiff,
                'percentageDiff' => $percentageDiff,
                'externalIdsCount' => count($externalIds)
            ),
            // Deep link to distributor page using impiantoId
            // Deep link to pretty slug bandiera-comune-id if available via variation; fallback to /distributore-ID
            'url' => (function() use ($variation) {
                $id = isset($variation['impiantoId']) ? $variation['impiantoId'] : '';
                $band = isset($variation['distributorName']) ? $variation['distributorName'] : '';
                $com = isset($variation['comune']) ? $variation['comune'] : '';
                $base = home_url('/');
                if ($band && $com && $id) {
                    $slug = sanitize_title($band . '-' . $com . '-' . $id);
                    return trailingslashit($base . $slug);
                }
                return home_url('/distributore-' . $id);
            })()
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
            $code = wp_remote_retrieve_response_code($response);
            $body = wp_remote_retrieve_body($response);
            $this->log_progress('OneSignal response ['.$code.']: ' . $body);
            if ($code >= 200 && $code < 300) {
                $this->log_progress('Notification sent for ' . $fuelType . ' at ' . $distributorName);
            }
        }
    }
}

new BenzinaOggiPlugin();

