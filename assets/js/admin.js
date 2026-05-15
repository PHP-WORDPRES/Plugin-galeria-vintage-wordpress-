jQuery(document).ready(function($) {
    $('.upload_image_button').on('click', function(e) {
        e.preventDefault();
        var button = $(this);
        var monitorId = button.data('monitor');
        var custom_uploader = wp.media({
            title: 'Select Image',
            button: {
                text: 'Use this image'
            },
            multiple: false
        }).on('select', function() {
            var attachment = custom_uploader.state().get('selection').first().toJSON();
            $('#url_' + monitorId).val(attachment.url);
            $('#preview_' + monitorId).html('<img src="' + attachment.url + '" style="max-width:100%; height:auto;" />');
        }).open();
    });

    $('.remove_image_button').on('click', function(e) {
        e.preventDefault();
        var button = $(this);
        var monitorId = button.data('monitor');
        $('#url_' + monitorId).val('');
        $('#preview_' + monitorId).html('');
    });
});
