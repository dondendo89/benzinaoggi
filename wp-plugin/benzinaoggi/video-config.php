<?php
/**
 * Video Hero Configuration
 * Manages video settings and assets loading
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class BenzinaOggi_Video_Config {
    
    public function __construct() {
        add_action('wp_enqueue_scripts', [$this, 'enqueue_video_assets']);
        add_action('admin_init', [$this, 'register_video_settings']);
    }
    
    /**
     * Enqueue video assets on frontend
     */
    public function enqueue_video_assets() {
        // Only load on home page or pages with video shortcode
        if (is_front_page() || is_home() || $this->should_load_video()) {
            wp_enqueue_style(
                'benzinaoggi-video-hero',
                plugin_dir_url(__FILE__) . 'public/video-hero.css',
                [],
                '1.0.0'
            );
            
            wp_enqueue_script(
                'benzinaoggi-video-hero-js',
                plugin_dir_url(__FILE__) . 'public/video-hero.js',
                ['jquery'],
                '1.0.0',
                true
            );
            
            // Pass video settings to JavaScript
            $video_settings = $this->get_video_settings();
            wp_localize_script('benzinaoggi-video-hero-js', 'BenzinaOggiVideo', $video_settings);
        }
    }
    
    /**
     * Register video settings in WordPress admin
     */
    public function register_video_settings() {
        // Register settings group
        register_setting('benzinaoggi_video_settings', 'benzinaoggi_video_options');
        
        // Add settings section
        add_settings_section(
            'benzinaoggi_video_section',
            'Impostazioni Video Hero',
            [$this, 'video_section_callback'],
            'benzinaoggi_video_settings'
        );
        
        // Video enabled field
        add_settings_field(
            'hero_video_enabled',
            'Abilita Video Hero',
            [$this, 'video_enabled_callback'],
            'benzinaoggi_video_settings',
            'benzinaoggi_video_section'
        );
        
        // Video autoplay field
        add_settings_field(
            'hero_video_autoplay',
            'Riproduzione Automatica',
            [$this, 'video_autoplay_callback'],
            'benzinaoggi_video_settings',
            'benzinaoggi_video_section'
        );
        
        // Video loop field
        add_settings_field(
            'hero_video_loop',
            'Riproduzione Continua',
            [$this, 'video_loop_callback'],
            'benzinaoggi_video_settings',
            'benzinaoggi_video_section'
        );
        
        // Video muted field
        add_settings_field(
            'hero_video_muted',
            'Avvia Senza Audio',
            [$this, 'video_muted_callback'],
            'benzinaoggi_video_settings',
            'benzinaoggi_video_section'
        );
        
        // Video quality field
        add_settings_field(
            'hero_video_quality',
            'Qualità Video',
            [$this, 'video_quality_callback'],
            'benzinaoggi_video_settings',
            'benzinaoggi_video_section'
        );
    }
    
    /**
     * Get current video settings with defaults
     */
    public function get_video_settings() {
        $options = get_option('benzinaoggi_video_options', []);
        
        return array_merge([
            'enabled' => true,
            'autoplay' => true,
            'loop' => true,
            'muted' => true,
            'quality' => 'auto',
            'show_controls' => true,
            'show_cta' => true,
            'cta_text' => '🔔 Attiva Notifiche Gratuite',
            'analytics_enabled' => true
        ], $options);
    }
    
    /**
     * Check if video should be loaded on current page
     */
    private function should_load_video() {
        global $post;
        
        if (!$post) return false;
        
        // Check for video shortcode
        if (has_shortcode($post->post_content, 'benzinaoggi_video')) {
            return true;
        }
        
        // Check for specific page templates
        $template = get_page_template_slug($post->ID);
        if (in_array($template, ['page-home.php', 'page-distributors.php'])) {
            return true;
        }
        
        return false;
    }
    
    // Settings callbacks
    public function video_section_callback() {
        echo '<p>Configura le impostazioni del video promozionale nella homepage.</p>';
    }
    
    public function video_enabled_callback() {
        $options = $this->get_video_settings();
        $checked = $options['enabled'] ? 'checked' : '';
        echo "<input type='checkbox' id='hero_video_enabled' name='benzinaoggi_video_options[enabled]' value='1' $checked />";
        echo "<label for='hero_video_enabled'>Mostra il video promozionale nell'header</label>";
    }
    
    public function video_autoplay_callback() {
        $options = $this->get_video_settings();
        $checked = $options['autoplay'] ? 'checked' : '';
        echo "<input type='checkbox' id='hero_video_autoplay' name='benzinaoggi_video_options[autoplay]' value='1' $checked />";
        echo "<label for='hero_video_autoplay'>Avvia automaticamente il video (raccomandato)</label>";
    }
    
    public function video_loop_callback() {
        $options = $this->get_video_settings();
        $checked = $options['loop'] ? 'checked' : '';
        echo "<input type='checkbox' id='hero_video_loop' name='benzinaoggi_video_options[loop]' value='1' $checked />";
        echo "<label for='hero_video_loop'>Ripeti il video automaticamente</label>";
    }
    
    public function video_muted_callback() {
        $options = $this->get_video_settings();
        $checked = $options['muted'] ? 'checked' : '';
        echo "<input type='checkbox' id='hero_video_muted' name='benzinaoggi_video_options[muted]' value='1' $checked />";
        echo "<label for='hero_video_muted'>Avvia senza audio (richiesto per autoplay)</label>";
    }
    
    public function video_quality_callback() {
        $options = $this->get_video_settings();
        $current = $options['quality'];
        
        $qualities = [
            'auto' => 'Automatica (raccomandato)',
            'high' => 'Alta Qualità (1080p)',
            'medium' => 'Media Qualità (720p)',
            'low' => 'Bassa Qualità (480p)'
        ];
        
        echo "<select id='hero_video_quality' name='benzinaoggi_video_options[quality]'>";
        foreach ($qualities as $value => $label) {
            $selected = $current === $value ? 'selected' : '';
            echo "<option value='$value' $selected>$label</option>";
        }
        echo "</select>";
        echo "<p class='description'>La qualità automatica si adatta alla connessione dell'utente</p>";
    }
    
    /**
     * Get video file URLs based on quality setting
     */
    public function get_video_urls() {
        $settings = $this->get_video_settings();
        $base_url = plugin_dir_url(__FILE__) . 'assets/videos/';
        
        $urls = [
            'poster' => $base_url . 'benzinaoggi-hero-poster.jpg',
            'fallback_image' => $base_url . 'benzinaoggi-hero-fallback.jpg'
        ];
        
        // Add video files based on quality
        switch ($settings['quality']) {
            case 'high':
                $urls['mp4'] = $base_url . 'benzinaoggi-hero-1080p.mp4';
                $urls['webm'] = $base_url . 'benzinaoggi-hero-1080p.webm';
                break;
            case 'medium':
                $urls['mp4'] = $base_url . 'benzinaoggi-hero-720p.mp4';
                $urls['webm'] = $base_url . 'benzinaoggi-hero-720p.webm';
                break;
            case 'low':
                $urls['mp4'] = $base_url . 'benzinaoggi-hero-480p.mp4';
                $urls['webm'] = $base_url . 'benzinaoggi-hero-480p.webm';
                break;
            default: // auto
                $urls['mp4'] = $base_url . 'benzinaoggi-hero.mp4';
                $urls['webm'] = $base_url . 'benzinaoggi-hero.webm';
                break;
        }
        
        return $urls;
    }
    
    /**
     * Render video settings page
     */
    public function render_settings_page() {
        ?>
        <div class="wrap">
            <h1>Impostazioni Video BenzinaOggi</h1>
            
            <div class="video-settings-container">
                <div class="video-preview">
                    <h2>Anteprima Video</h2>
                    <div class="video-preview-container">
                        <?php
                        // Include video template for preview
                        $video_template = plugin_dir_path(__FILE__) . 'templates/video-hero-section.php';
                        if (file_exists($video_template)) {
                            echo '<div style="max-width: 600px; margin: 20px 0;">';
                            include $video_template;
                            echo '</div>';
                        }
                        ?>
                    </div>
                </div>
                
                <div class="video-settings">
                    <form method="post" action="options.php">
                        <?php
                        settings_fields('benzinaoggi_video_settings');
                        do_settings_sections('benzinaoggi_video_settings');
                        submit_button('Salva Impostazioni');
                        ?>
                    </form>
                </div>
            </div>
            
            <div class="video-upload-section">
                <h2>Carica Video Personalizzato</h2>
                <p>Per sostituire il video predefinito, carica i tuoi file nella cartella <code>/wp-content/plugins/benzinaoggi/assets/videos/</code></p>
                
                <h3>File Richiesti:</h3>
                <ul>
                    <li><strong>benzinaoggi-hero.mp4</strong> - Video principale (formato MP4)</li>
                    <li><strong>benzinaoggi-hero.webm</strong> - Video ottimizzato (formato WebM)</li>
                    <li><strong>benzinaoggi-hero-poster.jpg</strong> - Immagine di anteprima</li>
                    <li><strong>benzinaoggi-hero-fallback.jpg</strong> - Immagine fallback</li>
                </ul>
                
                <h3>Specifiche Consigliate:</h3>
                <ul>
                    <li><strong>Risoluzione:</strong> 1920x1080 (16:9)</li>
                    <li><strong>Durata:</strong> 45-60 secondi</li>
                    <li><strong>Bitrate:</strong> 2-4 Mbps</li>
                    <li><strong>Formato Audio:</strong> AAC 128kbps</li>
                    <li><strong>Dimensione:</strong> &lt; 10MB</li>
                </ul>
            </div>
            
            <style>
            .video-settings-container {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 30px;
                margin: 20px 0;
            }
            
            .video-preview-container {
                background: #f9f9f9;
                padding: 20px;
                border-radius: 8px;
                border: 1px solid #ddd;
            }
            
            .video-upload-section {
                background: #fff;
                padding: 20px;
                border-radius: 8px;
                border: 1px solid #ddd;
                margin-top: 30px;
            }
            
            .video-upload-section h3 {
                color: #2563eb;
                margin-top: 20px;
            }
            
            .video-upload-section ul {
                background: #f8f9fa;
                padding: 15px 30px;
                border-radius: 6px;
                border-left: 4px solid #10b981;
            }
            
            @media (max-width: 768px) {
                .video-settings-container {
                    grid-template-columns: 1fr;
                }
            }
            </style>
        </div>
        <?php
    }
}

// Initialize video configuration
new BenzinaOggi_Video_Config();
