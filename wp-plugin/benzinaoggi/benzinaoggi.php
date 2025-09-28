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
        add_action('wp_enqueue_scripts', [$this, 'enqueue_assets']);
        add_action('rest_api_init', [$this, 'register_rest']);
        
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
        // Registra template personalizzato
        add_filter('theme_page_templates', [$this, 'add_custom_page_template']);
        add_filter('page_template', [$this, 'load_custom_page_template']);
        // Admin post action to run variations now
        add_action('admin_post_benzinaoggi_run_variations', [$this, 'handle_run_variations']);
        // Admin post action to run daily price update manually
        add_action('admin_post_benzinaoggi_run_daily_update', [$this, 'handle_run_daily_update']);
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
        
        // Handle OneSignal Service Worker (legacy query path kept for safety)
        add_action('init', [$this, 'handle_onesignal_worker']);
        // Add rewrites to expose SW at root (v16)
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
            'logo_url' => ''
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
                if ($last) {
                    echo '<p>Ultima sincronizzazione: ' . esc_html($last) . '</p>';
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
            // Prima cerca nella directory del tema attivo
            $theme_template = get_template_directory() . '/benzinaoggi-templates/page-distributor.php';
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

    public function cron_daily_price_update() {
        $this->log_progress('Avvio aggiornamento prezzi giornaliero con rilevamento variazioni...');
        
        $api_base = $this->get_options()['api_base'] ?? '';
        if (empty($api_base)) {
            $this->log_progress('ERRORE: API base non configurata');
            return;
        }
        
        try {
            // STEP 1: Aggiorna prezzi usando API MISE diretta (sempre)
            $this->log_progress('STEP 1: Aggiornamento prezzi con API MISE diretta...');
            $response = wp_remote_get($api_base . '/api/cron/update-prices-daily?limit=2000&force=true', [
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
                    'Aggiornamento MISE completato: %d processati, %d aggiornati, %d creati',
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
                        'post_content' => '[carburante_distributor impianto_id="'.$d['impiantoId'].'"]',
                        'page_template' => 'page-distributor.php'
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
        
        // OneSignal SDK v16 (clean minimal integration)
        $opts = $this->get_options();
        if (!empty($opts['onesignal_app_id'])) {
            $handle = 'onesignal-v16';
            // Best-effort: avoid conflicts with official plugin
            wp_dequeue_script('onesignal-sdk');
            wp_dequeue_script('OneSignalSDK');
            wp_dequeue_script('onesignal-public-sdk');
            wp_deregister_script('onesignal-sdk');
            wp_deregister_script('OneSignalSDK');
            wp_deregister_script('onesignal-public-sdk');
            // enqueue v16 page SDK in header
            wp_enqueue_script($handle, 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js', [], null, false);
            // inline init BEFORE the SDK loads using OneSignalDeferred (minimal)
            $appId = esc_js($opts['onesignal_app_id']);
            $init = "(function(){ window.OneSignalDeferred = window.OneSignalDeferred || []; window.OneSignalDeferred.push(function(OneSignal){ try { OneSignal.init({ appId: '".$appId."', serviceWorkerPath: '/OneSignalSDKWorker.js', serviceWorkerUpdaterPath: '/OneSignalSDKUpdaterWorker.js', serviceWorkerScope: '/', allowLocalhostAsSecureOrigin: true }); } catch(e) { } }); })();";
            wp_add_inline_script($handle, $init, 'before');
        }
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
        wp_enqueue_style('benzinaoggi-style', plugins_url('public/style.css', __FILE__), [], '1.0.0');

        // Distributor detail loader if shortcode present
        global $post;
        if ($post && has_shortcode($post->post_content, 'carburante_distributor')) {
            wp_register_script('benzinaoggi-distributor', plugins_url('public/distributor.js', __FILE__), [], '2.0.0', true);
            wp_localize_script('benzinaoggi-distributor', 'BenzinaOggi', [
                'apiBase' => rtrim($opts['api_base'], '/'),
                'onesignalAppId' => $opts['onesignal_app_id'],
                'onesignalOfficial' => false,
                'useOwnOneSignal' => true
            ]);
            wp_enqueue_script('benzinaoggi-distributor');
        }
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

        $title = "💰 Prezzo $fuelType sceso!";
        $message = "$distributorName: $fuelType da €" . number_format($oldPrice, 3) . " a €" . number_format($newPrice, 3) . " (-" . number_format($percentageDiff, 1) . "%)";

        // Prefer exact distributor+fuel targeting; fallback to per-distributor or per-fuel
        $fuel_key_norm = strtolower(str_replace(' ', '_', $fuelType));
        $dist_fuel_tag = 'notify_distributor_' . (isset($variation['distributorId']) ? $variation['distributorId'] : '') . '_' . $fuel_key_norm;

        // Fetch externalIds from Next API instead of using tags
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
            'url' => home_url('/distributore-' . (isset($variation['impiantoId']) ? $variation['impiantoId'] : ''))
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

