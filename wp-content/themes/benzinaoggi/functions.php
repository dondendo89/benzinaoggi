<?php
// Register WordPress menu locations for the theme
add_action('after_setup_theme', function(){
    register_nav_menus(array(
        'primary' => __('Menu Principale', 'benzinaoggi'),
    ));
});

// Optional: add CSS class to menu links
add_filter('nav_menu_link_attributes', function($atts, $item, $args){
    if (!empty($args) && isset($args->theme_location) && $args->theme_location === 'primary') {
        $atts['class'] = isset($atts['class']) ? ($atts['class'] . ' site-menu-link') : 'site-menu-link';
        $atts['target'] = '_self';
        $atts['rel'] = 'noopener';
    }
    return $atts;
}, 10, 3);


