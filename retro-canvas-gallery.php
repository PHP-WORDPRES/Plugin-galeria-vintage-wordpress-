<?php
/**
 * Plugin Name: Retro Canvas Gallery
 * Description: An interactive retro-tech gallery using HTML5 Canvas and Fabric.js.
 * Version: 3.0.6
 * Author: Jaime Sanchez Chirivella
 * Text Domain: retro-canvas-gallery
 */

if (!defined('ABSPATH')) {
    exit;
}

class RetroCanvasGallery {
    public function __construct() {
        add_action('admin_menu', [$this, 'add_admin_menu']);
        add_action('admin_init', [$this, 'register_settings']);
        add_action('admin_enqueue_scripts', [$this, 'enqueue_admin_scripts']);
        add_shortcode('retro_canvas_gallery', [$this, 'render_shortcode']);
    }

    public function add_admin_menu() {
        add_menu_page(
            'Retro Gallery',
            'Retro Gallery',
            'manage_options',
            'retro-gallery-settings',
            [$this, 'render_settings_page'],
            'dashicons-format-gallery',
            25
        );
    }

    public function register_settings() {
        register_setting('retro_gallery_options', 'retro_gallery_settings');
    }

    public function enqueue_admin_scripts($hook) {
        if ($hook !== 'toplevel_page_retro-gallery-settings') {
            return;
        }
        wp_enqueue_media();
        wp_enqueue_script('retro-admin-js', plugin_dir_url(__FILE__) . 'assets/js/admin.js', ['jquery'], '3.0.2', true);
        wp_enqueue_style('retro-admin-css', plugin_dir_url(__FILE__) . 'assets/css/style.css', [], '3.0.2');
    }

    public function render_settings_page() {
        $settings = get_option('retro_gallery_settings', []);
        ?>
        <div class="wrap retro-settings-wrap">
            <h1>Retro Canvas Gallery Settings</h1>
            <p>Use the shortcode <code>[retro_canvas_gallery]</code> to display the gallery on any page or post.</p>
            <form method="post" action="options.php">
                <?php settings_fields('retro_gallery_options'); ?>
                <div class="retro-monitors-grid">
                    <?php for ($i = 1; $i <= 36; $i++) : 
                        if (($i - 1) % 6 === 0) {
                            $channelNum = floor(($i - 1) / 6) + 1;
                            echo '<h2 style="width:100%; border-bottom:1px solid #ccc; padding-bottom:10px; margin-top:30px; grid-column: 1 / -1;">Canal ' . $channelNum . ' ' . ($channelNum === 1 ? '(Canal Inicial / Activo)' : '(Imágenes Extra a la espera)') . '</h2>';
                        }

                        $monitor = isset($settings['monitor_' . $i]) ? $settings['monitor_' . $i] : [
                            'url' => '',
                            'title' => '',
                            'description' => ''
                        ];
                        
                        $posInChannel = ($i - 1) % 6 + 1;
                        $label = ($posInChannel === 1) ? 'Slot Principal (Grande)' : 'Slot Secundario ' . ($posInChannel - 1);
                        ?>
                        <div class="retro-monitor-section">
                            <h3><?php echo esc_html($label); ?></h3>
                            <div class="image-preview-wrapper" id="preview_<?php echo $i; ?>">
                                <?php if (!empty($monitor['url'])) : ?>
                                    <img src="<?php echo esc_url($monitor['url']); ?>" style="max-width:100%; height:auto;" />
                                <?php endif; ?>
                            </div>
                            <input type="hidden" name="retro_gallery_settings[monitor_<?php echo $i; ?>][url]" id="url_<?php echo $i; ?>" value="<?php echo esc_attr($monitor['url']); ?>" />
                            <button type="button" class="button upload_image_button" data-monitor="<?php echo $i; ?>">Upload/Select Image</button>
                            <button type="button" class="button remove_image_button" data-monitor="<?php echo $i; ?>">Remove</button>
                            
                            <p>
                                <label>Título:</label><br>
                                <input type="text" name="retro_gallery_settings[monitor_<?php echo $i; ?>][title]" value="<?php echo esc_attr($monitor['title']); ?>" class="regular-text" />
                            </p>
                            <p>
                                <label>Descripción:</label><br>
                                <textarea name="retro_gallery_settings[monitor_<?php echo $i; ?>][description]" class="large-text" rows="3"><?php echo esc_textarea($monitor['description']); ?></textarea>
                            </p>
                        </div>
                    <?php endfor; ?>
                </div>
                <?php submit_button(); ?>
            </form>
        </div>
        <?php
    }

    public function render_shortcode() {
        $settings = get_option('retro_gallery_settings', []);

        // Force HTTPS on all stored image URLs to avoid Mixed Content errors
        $safe_settings = [];
        foreach ($settings as $key => $monitor) {
            if (is_array($monitor) && isset($monitor['url'])) {
                $monitor['url'] = set_url_scheme($monitor['url'], 'https');
            }
            $safe_settings[$key] = $monitor;
        }
        
        // Enqueue frontend scripts
        wp_enqueue_script('fabric-js', 'https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js', [], '5.3.1', true);
        wp_enqueue_script('retro-gallery-js', plugin_dir_url(__FILE__) . 'assets/js/script.js', ['fabric-js'], '3.0.6', true);
        wp_enqueue_style('retro-gallery-css', plugin_dir_url(__FILE__) . 'assets/css/style.css', [], '3.0.6');

        // Pass settings to JS
        wp_localize_script('retro-gallery-js', 'retroGalleryData', [
            'settings' => $safe_settings,
            'pluginUrl' => plugin_dir_url(__FILE__),
            'imgUrl' => plugin_dir_url(__FILE__) . 'img/'
        ]);

        ob_start();
        ?>
        <div id="retro-canvas-wrapper" class="retro-canvas-wrapper">
            <canvas id="retro-canvas"></canvas>
            <div id="fullscreen-overlay" class="fullscreen-overlay" style="display:none;">
                <p id="fullscreen-desc" style="color:#fff; text-align:center; font-family:'Courier New',monospace; font-size:2rem; margin: 0 auto 18px; max-width:80%; background:rgba(0,0,0,0.6); padding:12px 24px; border-radius:4px;"></p>
                <img id="fullscreen-main-img" src="" style="max-width: 90%; max-height: 80%; margin: auto; display: block; object-fit: contain;" />
                <div id="exit-fullscreen" class="exit-fullscreen">
                <img src="<?php echo plugin_dir_url(__FILE__) . 'img/exit-sign.png'; ?>" alt="Exit" />
                </div>
                <div class="nav-controls">
                    <button id="prev-btn" class="nav-btn">&lsaquo;</button>
                    <button id="next-btn" class="nav-btn">&rsaquo;</button>
                </div>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }
}

new RetroCanvasGallery();
