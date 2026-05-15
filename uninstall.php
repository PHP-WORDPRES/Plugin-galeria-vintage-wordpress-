<?php
/**
 * Fired when the plugin is uninstalled.
 *
 * @package RetroCanvasGallery
 */

// If uninstall not called from WordPress, then exit.
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

// Delete the main plugin options from wp_options table.
delete_option( 'retro_gallery_settings' );

// Note: If you ever add custom post types or specific user metadata, 
// you would query and delete them here. Currently, the plugin only 
// uses a single options array to store the monitor settings.
