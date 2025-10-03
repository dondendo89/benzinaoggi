<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="profile" href="https://gmpg.org/xfn/11">
    
    <?php wp_head(); ?>
</head>

<body <?php body_class(); ?>>
<?php wp_body_open(); ?>

<div id="page" class="site">
    <header id="masthead" class="site-header">
        <div class="container">

            <div class="site-branding">
                <?php if (is_home() && is_front_page()) : ?>
                    <h1 class="site-title">
                        <a href="<?php echo esc_url(home_url('/')); ?>" rel="home">
                            <?php bloginfo('name'); ?>
                        </a>
                    </h1>
                <?php else : ?>
                    <p class="site-title">
                        <a href="<?php echo esc_url(home_url('/')); ?>" rel="home">
                            <?php bloginfo('name'); ?>
                        </a>
                    </p>
                <?php endif; ?>
                
                <?php
                $description = get_bloginfo('description', 'display');
                if ($description || is_customize_preview()) :
                ?>
                    <p class="site-description"><?php echo $description; ?></p>
                <?php endif; ?>
            </div>

            <nav class="site-nav" style="float:right; margin-top:10px;">
                <?php
                // Primary WordPress menu location
                if (has_nav_menu('primary')) {
                    wp_nav_menu(array(
                        'theme_location' => 'primary',
                        'container' => false,
                        'menu_class' => 'site-menu',
                        'fallback_cb' => false,
                    ));
                } else {
                    // Fallback: show a default link to notifications management
                    $bo_manage_url = getenv('NEXT_PUBLIC_APP_URL') ? rtrim(getenv('NEXT_PUBLIC_APP_URL'), '/') . '/notifications' : 'https://benzinaoggi.vercel.app/notifications';
                    echo '<a href="' . esc_url($bo_manage_url) . '" class="manage-notifications-link" target="_blank" rel="noopener" style="background:#0ea5e9;color:#fff;padding:8px 12px;border-radius:6px;text-decoration:none;">Gestisci notifiche</a>';
                }
                ?>
            </nav>
        </div>
    </header>

    <div id="content" class="site-content">
