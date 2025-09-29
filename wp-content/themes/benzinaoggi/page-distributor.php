<?php
/**
 * Template Name: Distributore BenzinaOggi
 * 
 * Il template fornisce solo la grafica; tutta la logica (API, notifiche, mappa)
 * è gestita dal plugin tramite shortcode e script propri.
 */

// Prevenire accesso diretto
if (!defined('ABSPATH')) {
    exit;
}

// Estrai impianto_id dal contenuto o dalla querystring per passarlo allo shortcode
$impianto_id = '';
$post_content = get_post_field('post_content', get_the_ID());
if (preg_match('/\[carburante_distributor\s+impianto_id="?(\d+)"?\]/', (string)$post_content, $m)) {
    $impianto_id = $m[1];
} elseif (!empty($_GET['impiantoId'])) {
    $impianto_id = sanitize_text_field($_GET['impiantoId']);
} else {
    // Fallback: estrai ID da slug tipo q8-rometta-43793 -> 43793
    $slug = get_post_field('post_name', get_the_ID());
    if (is_string($slug) && preg_match('/-(\d+)$/', $slug, $mm)) {
        $impianto_id = $mm[1];
    }
}

get_header(); ?>

<main id="main" class="site-main">
    <div class="container">
        <div class="bo-container">
            <div class="bo-header">
                <h1 class="bo-title"><?php the_title(); ?></h1>
                <p class="bo-subtitle">Informazioni e prezzi aggiornati</p>
            </div>

            <?php
            // Stampa il contenuto esistente (può già contenere lo shortcode)
            the_content();

            // Se lo shortcode non è presente nel contenuto, inseriscilo qui
            if (strpos((string)$post_content, '[carburante_distributor') === false && !empty($impianto_id)) {
                echo do_shortcode('[carburante_distributor impianto_id="' . esc_attr($impianto_id) . '"]');
            }
            ?>
        </div>
    </div>
</main>

<?php get_footer(); ?>
