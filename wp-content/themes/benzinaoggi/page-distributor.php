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

// Non ricaviamo più automaticamente l'ID: la pagina deve funzionare SOLO con shortcode
$post_content = get_post_field('post_content', get_the_ID());

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

            // Non auto-inseriamo lo shortcode: deve essere presente nel contenuto
            ?>
        </div>
    </div>
</main>

<?php get_footer(); ?>
