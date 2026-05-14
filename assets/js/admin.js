
jQuery(document).ready(function($){
    $('.upload_image_button').click(function(e) {
        e.preventDefault();
        var button = $(this);
        var target_id = button.data('target');
        var custom_uploader = wp.media({
            title: 'Seleccionar Imagen para TV',
            button: {
                text: 'Usar esta imagen'
            },
            multiple: false
        }).on('select', function() {
            var attachment = custom_uploader.state().get('selection').first().toJSON();
            $('#' + target_id).val(attachment.url);
            button.siblings('.image_preview').html('<img src="' + attachment.url + '" style="max-width:150px; height:auto;">');
        }).open();
    });
});
