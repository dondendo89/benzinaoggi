<?php
/**
 * SEO Content Generator with Gemini AI
 * Advanced SEO content creation for BenzinaOggi WordPress
 */

class SEO_Content_Generator {
    
    private $gemini_api_key;
    private $wordpress_url;
    
    public function __construct($api_key, $wp_url) {
        $this->gemini_api_key = $api_key;
        $this->wordpress_url = $wp_url;
    }
    
    /**
     * Generate SEO landing pages for high-volume keywords
     */
    public function generate_keyword_landing_pages() {
        $keyword_groups = [
            'regional' => [
                'prezzi-benzina-lazio',
                'distributori-lombardia',
                'carburante-veneto',
                'stazioni-servizio-campania'
            ],
            'brand' => [
                'distributori-eni',
                'prezzi-agip',
                'stazioni-shell',
                'carburante-tamoil'
            ],
            'comparative' => [
                'prezzi-benzina-vs-gasolio',
                'self-service-vs-servito',
                'distributori-economici-vs-premium',
                'gpl-vs-benzina-convenienza'
            ],
            'seasonal' => [
                'prezzi-carburanti-estate-2025',
                'distributori-aperti-vacanze',
                'risparmio-benzina-viaggi',
                'carburante-autostrade-agosto'
            ]
        ];
        
        foreach ($keyword_groups as $category => $keywords) {
            foreach ($keywords as $keyword) {
                $this->create_seo_page($keyword, $category);
                usleep(500000); // Rate limiting
            }
        }
    }
    
    /**
     * Create individual SEO page with Gemini-generated content
     */
    private function create_seo_page($keyword, $category) {
        // Check if page already exists
        $slug = sanitize_title($keyword);
        $existing = get_page_by_path($slug, OBJECT, 'page');
        
        if ($existing) {
            error_log("SEO page already exists: $slug");
            return false;
        }
        
        // Generate content with Gemini
        $content_data = $this->generate_seo_content($keyword, $category);
        
        if (!$content_data) {
            error_log("Failed to generate content for: $keyword");
            return false;
        }
        
        // Create WordPress page
        $page_id = wp_insert_post([
            'post_title' => $content_data['title'],
            'post_name' => $slug,
            'post_content' => $content_data['content'],
            'post_excerpt' => $content_data['excerpt'],
            'post_status' => 'publish',
            'post_type' => 'page',
            'post_author' => 1,
            'meta_input' => [
                '_yoast_wpseo_title' => $content_data['seo_title'],
                '_yoast_wpseo_metadesc' => $content_data['meta_description'],
                '_yoast_wpseo_focuskw' => $keyword,
                '_yoast_wpseo_canonical' => $this->wordpress_url . '/' . $slug . '/',
                'seo_category' => $category,
                'generated_date' => current_time('mysql'),
                'keyword_target' => $keyword
            ]
        ]);
        
        if ($page_id) {
            error_log("Created SEO page: $slug (ID: $page_id)");
            return $page_id;
        }
        
        return false;
    }
    
    /**
     * Generate SEO-optimized content with Gemini API
     */
    private function generate_seo_content($keyword, $category) {
        $prompts = [
            'regional' => "Crea contenuto SEO per '$keyword'. Includi informazioni sui prezzi carburanti nella regione, distributori principali, consigli di risparmio. Min 800 parole.",
            'brand' => "Scrivi una guida completa sui '$keyword'. Includi storia del brand, rete distributori, prezzi medi, servizi offerti, programmi fedeltà. Min 1000 parole.",
            'comparative' => "Analizza '$keyword' con confronto dettagliato. Pro/contro, differenze di prezzo, consigli per consumatori, quando conviene scegliere una opzione. Min 900 parole.",
            'seasonal' => "Crea articolo stagionale su '$keyword'. Includi trend prezzi, consigli viaggio, distributori consigliati, previsioni mercato. Min 800 parole."
        ];
        
        $base_prompt = $prompts[$category] ?? $prompts['regional'];
        
        $full_prompt = "$base_prompt

IMPORTANTE: Rispondere SOLO in formato JSON:
{
  \"title\": \"Titolo principale per la pagina (max 60 caratteri)\",
  \"seo_title\": \"Titolo SEO ottimizzato (max 60 caratteri)\",
  \"meta_description\": \"Meta description accattivante (max 155 caratteri)\",
  \"excerpt\": \"Riassunto di 2-3 frasi per l'anteprima\",
  \"content\": \"Contenuto HTML completo con h2, h3, liste, paragrafi. Include dati realistici sui prezzi carburanti in Italia. Usa emoji con moderazione. Min 800 parole.\"
}

Keyword focus: '$keyword'
Contesto: BenzinaOggi.it - sito prezzi carburanti Italia
Tone: Professionale ma accessibile, utile per automobilisti";

        return $this->call_gemini_api($full_prompt);
    }
    
    /**
     * Call Gemini API with enhanced error handling
     */
    private function call_gemini_api($prompt) {
        $model = 'gemini-1.5-flash';
        $endpoint = "https://generativelanguage.googleapis.com/v1/models/$model:generateContent?key=" . $this->gemini_api_key;
        
        $body = [
            'contents' => [[
                'role' => 'user',
                'parts' => [['text' => $prompt]]
            ]],
            'generationConfig' => [
                'temperature' => 0.7,
                'topP' => 0.8,
                'topK' => 40,
                'maxOutputTokens' => 8192
            ]
        ];
        
        $response = wp_remote_post($endpoint, [
            'timeout' => 60,
            'headers' => ['Content-Type' => 'application/json'],
            'body' => wp_json_encode($body)
        ]);
        
        if (is_wp_error($response)) {
            error_log('Gemini API error: ' . $response->get_error_message());
            return false;
        }
        
        $code = wp_remote_retrieve_response_code($response);
        $json = json_decode(wp_remote_retrieve_body($response), true);
        
        if ($code !== 200) {
            error_log('Gemini API HTTP error: ' . $code);
            error_log('Response: ' . print_r($json, true));
            return false;
        }
        
        $content_text = $json['candidates'][0]['content']['parts'][0]['text'] ?? '';
        
        if (empty($content_text)) {
            error_log('Empty response from Gemini API');
            return false;
        }
        
        // Extract JSON from response
        $start = strpos($content_text, '{');
        $end = strrpos($content_text, '}');
        
        if ($start === false || $end === false) {
            error_log('No JSON found in Gemini response');
            return false;
        }
        
        $json_content = substr($content_text, $start, $end - $start + 1);
        $content_data = json_decode($json_content, true);
        
        if (!$content_data) {
            error_log('Failed to parse JSON from Gemini response');
            return false;
        }
        
        // Validate required fields
        $required = ['title', 'seo_title', 'meta_description', 'excerpt', 'content'];
        foreach ($required as $field) {
            if (empty($content_data[$field])) {
                error_log("Missing required field: $field");
                return false;
            }
        }
        
        return $content_data;
    }
    
    /**
     * Generate FAQ pages with schema markup
     */
    public function generate_faq_pages() {
        $faq_topics = [
            'prezzi-benzina-faq' => [
                'Quanto costa la benzina oggi in Italia?',
                'Dove trovo i prezzi più bassi della benzina?',
                'Perché i prezzi cambiano tra distributori?',
                'Quando conviene fare rifornimento?'
            ],
            'distributori-faq' => [
                'Come funziona il self service?',
                'Differenza tra servito e self service?',
                'Quali carte di credito accettano?',
                'Come trovare distributori aperti h24?'
            ],
            'risparmio-carburante-faq' => [
                'Come risparmiare sulla benzina?',
                'Conviene il GPL o il metano?',
                'App per trovare prezzi economici?',
                'Tessere fedeltà distributori convengono?'
            ]
        ];
        
        foreach ($faq_topics as $slug => $questions) {
            $this->create_faq_page($slug, $questions);
            usleep(300000);
        }
    }
    
    private function create_faq_page($slug, $questions) {
        $existing = get_page_by_path($slug, OBJECT, 'page');
        if ($existing) return false;
        
        $questions_text = implode('\n', array_map(function($q) {
            return "- $q";
        }, $questions));
        
        $prompt = "Crea una pagina FAQ completa per '$slug' rispondendo a queste domande:
$questions_text

Formato JSON richiesto:
{
  \"title\": \"Titolo pagina FAQ (max 60 caratteri)\",
  \"seo_title\": \"Titolo SEO (max 60 caratteri)\", 
  \"meta_description\": \"Meta description (max 155 caratteri)\",
  \"excerpt\": \"Breve introduzione alle FAQ\",
  \"content\": \"Contenuto HTML con h2 per ogni domanda, risposte dettagliate, schema FAQ JSON-LD\",
  \"schema_faq\": \"JSON-LD schema per FAQ (array di domande/risposte)\"
}

Stile: Professionale, dettagliato, utile per automobilisti italiani.";

        $content_data = $this->call_gemini_api($prompt);
        
        if ($content_data) {
            $page_id = wp_insert_post([
                'post_title' => $content_data['title'],
                'post_name' => $slug,
                'post_content' => $content_data['content'],
                'post_excerpt' => $content_data['excerpt'],
                'post_status' => 'publish',
                'post_type' => 'page',
                'meta_input' => [
                    '_yoast_wpseo_title' => $content_data['seo_title'],
                    '_yoast_wpseo_metadesc' => $content_data['meta_description'],
                    'faq_schema' => $content_data['schema_faq'] ?? '',
                    'content_type' => 'faq'
                ]
            ]);
            
            error_log("Created FAQ page: $slug (ID: $page_id)");
            return $page_id;
        }
        
        return false;
    }
    
    /**
     * Generate local SEO content for provinces
     */
    public function generate_local_seo_pages() {
        $provinces = [
            'roma', 'milano', 'napoli', 'torino', 'palermo', 'genova', 'bologna', 
            'firenze', 'bari', 'catania', 'venezia', 'verona', 'messina', 'padova',
            'trieste', 'brescia', 'parma', 'modena', 'reggio-emilia', 'perugia'
        ];
        
        foreach ($provinces as $province) {
            $keywords = [
                "distributori-$province",
                "prezzi-benzina-$province", 
                "stazioni-servizio-$province"
            ];
            
            foreach ($keywords as $keyword) {
                $this->create_seo_page($keyword, 'local');
                usleep(400000);
            }
        }
    }
    
    /**
     * Generate brand comparison pages
     */
    public function generate_brand_comparisons() {
        $brands = ['eni', 'agip', 'shell', 'esso', 'tamoil', 'q8', 'total'];
        
        for ($i = 0; $i < count($brands) - 1; $i++) {
            for ($j = $i + 1; $j < count($brands); $j++) {
                $keyword = "confronto-{$brands[$i]}-vs-{$brands[$j]}";
                $this->create_seo_page($keyword, 'comparative');
                usleep(600000);
            }
        }
    }
    
    /**
     * Generate seasonal content
     */
    public function generate_seasonal_content() {
        $current_month = date('n');
        $year = date('Y');
        
        $seasonal_keywords = [
            // Estate
            6 => ["prezzi-carburanti-estate-$year", "distributori-autostrade-vacanze"],
            7 => ["benzina-luglio-$year", "risparmio-carburante-vacanze"],
            8 => ["prezzi-agosto-$year", "distributori-aperti-ferragosto"],
            
            // Inverno
            12 => ["prezzi-carburanti-dicembre-$year", "distributori-natale"],
            1 => ["benzina-gennaio-$year", "risparmio-anno-nuovo"],
            2 => ["prezzi-febbraio-$year", "carburante-inverno"],
            
            // Primavera/Autunno
            3 => ["prezzi-primavera-$year", "distributori-gite-pasquali"],
            9 => ["benzina-settembre-$year", "rientro-vacanze"],
            10 => ["prezzi-ottobre-$year", "carburante-autunno"],
            11 => ["benzina-novembre-$year", "risparmio-fine-anno"]
        ];
        
        if (isset($seasonal_keywords[$current_month])) {
            foreach ($seasonal_keywords[$current_month] as $keyword) {
                $this->create_seo_page($keyword, 'seasonal');
                usleep(500000);
            }
        }
    }
}

// Integration with existing WordPress system
function benzinaoggi_seo_content_init() {
    $options = get_option('benzinaoggi_options', []);
    $api_key = $options['gemini_api_key'] ?? '';
    $wp_url = get_site_url();
    
    if (!$api_key) {
        error_log('Gemini API key not configured for SEO content generation');
        return;
    }
    
    return new SEO_Content_Generator($api_key, $wp_url);
}

// WP-Cron hooks for automated SEO content generation
add_action('benzinaoggi_generate_seo_content', function() {
    $generator = benzinaoggi_seo_content_init();
    if ($generator) {
        $generator->generate_seasonal_content();
    }
});

// Schedule monthly SEO content generation
if (!wp_next_scheduled('benzinaoggi_generate_seo_content')) {
    wp_schedule_event(time(), 'monthly', 'benzinaoggi_generate_seo_content');
}
