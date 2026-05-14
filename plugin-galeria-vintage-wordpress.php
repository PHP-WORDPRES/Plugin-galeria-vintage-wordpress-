<?php
/**
 * Plugin Name: Retro TV Gallery
 * Description: Una galería de WordPress con estética de televisores antiguos, intercambio de imágenes y efectos CRT.
 * Version: 1.1
 * Author: Antigravity Agent
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class RetroTechGallery {

    public function __construct() {
        add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_assets' ) );
        add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_assets' ) );
        add_action( 'admin_menu', array( $this, 'add_admin_menu' ) );
        add_action( 'admin_init', array( $this, 'register_settings' ) );
        add_shortcode( 'retro_tv_gallery', array( $this, 'render_gallery' ) );
    }

    public function enqueue_assets() {
        wp_enqueue_style( 'retro-tv-style', plugin_dir_url( __FILE__ ) . 'assets/css/tv-styles.css' );
        wp_enqueue_script( 'retro-tv-logic', plugin_dir_url( __FILE__ ) . 'assets/js/tv-logic.js', array(), '1.0', true );
    }

    public function enqueue_admin_assets( $hook ) {
        if ( 'toplevel_page_retro-tv-gallery' !== $hook ) {
            return;
        }
        wp_enqueue_media();
        wp_enqueue_script( 'retro-tv-admin', plugin_dir_url( __FILE__ ) . 'assets/js/admin.js', array( 'jquery' ), '1.0', true );
    }

    public function add_admin_menu() {
        add_menu_page(
            'Retro TV Gallery',
            'Retro TV Gallery',
            'manage_options',
            'retro-tv-gallery',
            array( $this, 'admin_page_html' ),
            'dashicons-format-video'
        );
    }

    public function register_settings() {
        register_setting( 'retro_tv_gallery_group', 'retro_tv_images' );
    }

    public function admin_page_html() {
        $images = get_option( 'retro_tv_images', array_fill( 1, 9, '' ) );
        ?>
        <div class="wrap">
            <h1>Ajustes de Retro TV Gallery</h1>
            <form method="post" action="options.php">
                <?php settings_fields( 'retro_tv_gallery_group' ); ?>
                <table class="form-table">
                    <?php for ( $i = 1; $i <= 9; $i++ ) : ?>
                        <tr>
                            <th scope="row">Imagen para TV <?php echo $i; ?> <?php echo ($i === 9 ? '(Principal)' : ''); ?></th>
                            <td>
                                <input type="text" name="retro_tv_images[<?php echo $i; ?>]" id="tv_image_<?php echo $i; ?>" value="<?php echo esc_attr( $images[$i] ); ?>" class="regular-text">
                                <button type="button" class="button upload_image_button" data-target="tv_image_<?php echo $i; ?>">Seleccionar Imagen</button>
                                <div class="image_preview" style="margin-top:10px;">
                                    <?php if ( $images[$i] ) : ?>
                                        <img src="<?php echo esc_url( $images[$i] ); ?>" style="max-width:150px; height:auto;">
                                    <?php endif; ?>
                                </div>
                            </td>
                        </tr>
                    <?php endfor; ?>
                </table>
                <?php submit_button(); ?>
            </form>
        </div>
        <?php
    }

    public function render_gallery( $atts ) {
        $config = json_decode( file_get_contents( plugin_dir_path( __FILE__ ) . 'tv-config.json' ), true );
        $saved_images = get_option( 'retro_tv_images', array() );
        
        // Default images if none saved
        $images = array();
        for ( $i = 1; $i <= 9; $i++ ) {
            $images[$i] = ! empty( $saved_images[$i] ) ? $saved_images[$i] : 'https://picsum.photos/id/' . ($i * 10) . '/800/600';
        }

        ob_start();
        ?>
        <div class="tv-gallery-container">
            <!-- Main TV (TV9) -->
            <div class="main-tv-wrapper">
                <?php $this->render_tv_item('TV9', $config['TV9'], $images[9]); ?>
            </div>

            <!-- Secondary TVs (TV1-TV8) -->
            <div class="secondary-tvs-grid">
                <?php for ( $i = 1; $i <= 8; $i++ ) : 
                    $id = "TV$i";
                    if ( isset( $config[$id] ) ) {
                        $this->render_tv_item($id, $config[$id], $images[$i]);
                    }
                endfor; ?>
            </div>

            <!-- Fullscreen Overlay -->
            <div id="tv-fullscreen-view" class="fullscreen-view">
                <img src="" class="fullscreen-image" alt="Fullscreen TV Content">
                <div id="tv-exit-fullscreen" class="exit-button">Salida de Emergencia</div>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    private function render_tv_item($id, $data, $img_url) {
        $screen = $data['screen'];
        ?>
        <div class="tv-item" data-tv-id="<?php echo esc_attr($id); ?>">
            <div class="tv-content <?php echo strtolower($id); ?>-filter" 
                 style="top: <?php echo $screen['top']; ?>%; left: <?php echo $screen['left']; ?>%; width: <?php echo $screen['width']; ?>%; height: <?php echo $screen['height']; ?>%;">
                <img src="<?php echo esc_url($img_url); ?>" alt="TV Content">
            </div>
            <img class="tv-frame" src="<?php echo plugin_dir_url( __FILE__ ) . 'assets/img/frames/' . $data['file']; ?>" alt="<?php echo $id; ?>">
            <div class="tv-overlay scanlines vignette <?php echo ($id === 'TV9' ? 'tv9-label' : ''); ?>"></div>
        </div>
        <?php
    }
}

new RetroTechGallery();
