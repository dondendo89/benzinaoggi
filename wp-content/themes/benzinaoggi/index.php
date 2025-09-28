<?php
/**
 * The main template file
 *
 * This is the most generic template file in a WordPress theme
 * and one of the two required files for a theme (the other being style.css).
 *
 * @package BenzinaOggi
 */

get_header(); ?>

<main id="main" class="site-main">
    <div class="container">
        <?php if (have_posts()) : ?>
            <div class="posts-container">
                <?php while (have_posts()) : the_post(); ?>
                    <article id="post-<?php the_ID(); ?>" <?php post_class('post-item'); ?>>
                        <header class="entry-header">
                            <h2 class="entry-title">
                                <a href="<?php the_permalink(); ?>" rel="bookmark">
                                    <?php the_title(); ?>
                                </a>
                            </h2>
                        </header>
                        
                        <div class="entry-content">
                            <?php the_excerpt(); ?>
                        </div>
                        
                        <footer class="entry-footer">
                            <a href="<?php the_permalink(); ?>" class="read-more">
                                Leggi tutto
                            </a>
                        </footer>
                    </article>
                <?php endwhile; ?>
            </div>
        <?php else : ?>
            <div class="no-posts">
                <h2>Nessun contenuto trovato</h2>
                <p>Spiacenti, non ci sono contenuti da mostrare.</p>
            </div>
        <?php endif; ?>
    </div>
</main>

<?php get_footer(); ?>
