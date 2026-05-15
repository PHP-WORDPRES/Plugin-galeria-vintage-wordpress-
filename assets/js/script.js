document.addEventListener('DOMContentLoaded', function() {
    if (typeof fabric === 'undefined' || !document.getElementById('retro-canvas')) return;

    const baseWidth = 1264;
    const baseHeight = 842;

    const canvas = new fabric.Canvas('retro-canvas', {
        width: baseWidth,
        height: baseHeight,
        selection: false,
        allowTouchScrolling: true
    });

    const data = window.retroGalleryData || {};
    const settings = data.settings || {};
    const imgUrl = data.imgUrl || '';

    const monitorConfigs = [
        { id: 1, x: 515, y: 450, w: 265, h: 205, type: 'main' },      
        { id: 2, x: 995, y: 240, w: 255, h: 190, type: 'small' },     
        { id: 3, x: 20, y: 380, w: 180, h: 120, type: 'small', filter: 'sepia' }, 
        { id: 4, x: 825, y: 560, w: 165, h: 130, type: 'small' },     
        { id: 5, x: 590, y: 290, w: 150, h: 115, type: 'small', filter: 'green' }, 
        { id: 6, x: 760, y: 195, w: 140, h: 100, type: 'small' }     
    ];

    // COORD HELPER
    canvas.on('mouse:down', function(options) {
        const pointer = canvas.getPointer(options.e);
        console.log('COORD:', Math.round(pointer.x), Math.round(pointer.y));
    });

    let monitorObjects = [];
    let titleSign = null;

    // Load Background as Overlay to mask images
    fabric.Image.fromURL(imgUrl + 'fondo-tv-transparent.png', function(img) {
        img.set({
            scaleX: baseWidth / img.width,
            scaleY: baseHeight / img.height,
            originX: 'left',
            originY: 'top'
        });
        canvas.setOverlayImage(img, canvas.renderAll.bind(canvas));
        initMonitors();
    });

    function initMonitors() {
        monitorConfigs.forEach((config, index) => {
            const monitorData = settings['monitor_' + config.id] || { url: '', title: '', description: '' };
            const placeholderUrl = 'https://via.placeholder.com/' + config.w + 'x' + config.h + '?text=No+Image';
            const finalUrl = monitorData.url || placeholderUrl;

            fabric.Image.fromURL(finalUrl, function(img) {
                img.set({
                    left: config.x,
                    top: config.y,
                    width: img.width,
                    height: img.height,
                    scaleX: config.w / img.width,
                    scaleY: config.h / img.height,
                    selectable: false,
                    hoverCursor: 'pointer'
                });

                // Attach metadata
                img.monitorId = config.id;
                img.monitorTitle = monitorData.title || ('Monitor ' + config.id);
                img.monitorDesc = monitorData.description || '';
                img.monitorUrl = finalUrl;
                img.monitorType = config.type;

                // Apply filters if small
                if (config.type === 'small') {
                    applyMonitorFilter(img, config.filter);
                }

                canvas.add(img);
                monitorObjects[config.id] = img;

                if (config.id === 1) {
                    createTitleSign(img.monitorTitle);
                }

                img.on('mousedown', () => handleMonitorClick(img));
            }, { crossOrigin: 'anonymous' });
        });
    }

    function applyMonitorFilter(img, filterType) {
        img.filters = [];
        if (filterType === 'sepia') {
            img.filters.push(new fabric.Image.filters.Sepia());
        } else if (filterType === 'green') {
            img.filters.push(new fabric.Image.filters.Grayscale());
            img.filters.push(new fabric.Image.filters.BlendColor({
                color: '#00ff00',
                mode: 'multiply',
                alpha: 0.5
            }));
        }
        img.applyFilters();
    }

    function createTitleSign(text) {
        if (titleSign) canvas.remove(titleSign);

        // Sign position below Main Monitor
        titleSign = new fabric.Text(text || '', {
            left: baseWidth / 2,
            top: baseHeight - 40,
            fontSize: 40,
            fontFamily: 'Courier New',
            fontWeight: 'bold',
            fill: '#fff',
            backgroundColor: '#333',
            originX: 'center',
            padding: 10,
            selectable: false,
            angle: 2 // Slight tilt for "leaned" look
        });

        canvas.add(titleSign);
    }

    function handleMonitorClick(img) {
        if (img.monitorType === 'small') {
            swapWithMain(img);
        } else {
            enterFullscreen(img);
        }
    }

    function swapWithMain(smallImg) {
        const mainImg = monitorObjects[1];
        if (!mainImg) return;

        // Temporary storage
        const tempUrl = mainImg.monitorUrl;
        const tempTitle = mainImg.monitorTitle;
        const tempDesc = mainImg.monitorDesc;

        // Update Main
        updateMonitorImage(mainImg, smallImg.monitorUrl, smallImg.monitorTitle, smallImg.monitorDesc);
        
        // Update Small
        updateMonitorImage(smallImg, tempUrl, tempTitle, tempDesc);

        // Update sign
        if (titleSign) {
            titleSign.set('text', mainImg.monitorTitle);
            canvas.renderAll();
        }
    }

    function updateMonitorImage(imgObj, url, title, desc) {
        fabric.Image.fromURL(url, function(newImg) {
            imgObj.setElement(newImg.getElement());
            imgObj.monitorUrl = url;
            imgObj.monitorTitle = title;
            imgObj.monitorDesc = desc;
            
            const config = monitorConfigs.find(c => c.id === imgObj.monitorId);
            if (config) {
                // Recalculate scale based on the new image's dimensions to fit the monitor
                imgObj.set({
                    width: newImg.width,
                    height: newImg.height,
                    scaleX: config.w / newImg.width,
                    scaleY: config.h / newImg.height
                });

                // Re-apply filters if it's a small monitor
                if (config.type === 'small') {
                    applyMonitorFilter(imgObj, config.filter);
                } else {
                    imgObj.filters = [];
                    imgObj.applyFilters();
                }
            }

            canvas.renderAll();
        }, { crossOrigin: 'anonymous' });
    }

    // Fullscreen Logic
    const overlay = document.getElementById('fullscreen-overlay');
    const exitBtn = document.getElementById('exit-fullscreen');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    let currentFullscreenIndex = 1;

    function enterFullscreen(img) {
        currentFullscreenIndex = img.monitorId;
        const wrapper = document.getElementById('retro-canvas-wrapper');
        
        if (wrapper.requestFullscreen) {
            wrapper.requestFullscreen();
        } else if (wrapper.webkitRequestFullscreen) {
            wrapper.webkitRequestFullscreen();
        }

        overlay.style.display = 'flex';
    }

    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            overlay.style.display = 'none';
        }
    });

    exitBtn.addEventListener('click', () => {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    });

    prevBtn.addEventListener('click', () => navigateGallery(-1));
    nextBtn.addEventListener('click', () => navigateGallery(1));

    function navigateGallery(dir) {
        // Simple navigation between the 6 images currently in monitors
        let nextIndex = currentFullscreenIndex + dir;
        if (nextIndex < 1) nextIndex = 6;
        if (nextIndex > 6) nextIndex = 1;

        const nextMonitor = monitorObjects[nextIndex];
        if (nextMonitor) {
            // Swap nextMonitor with Main if it's not already Main
            if (nextIndex !== 1) {
                swapWithMain(nextMonitor);
            }
            currentFullscreenIndex = 1; // Since it swapped to Main
        }
    }

    // Responsive Canvas
    function resizeCanvas() {
        const wrapper = document.getElementById('retro-canvas-wrapper');
        const scale = wrapper.offsetWidth / baseWidth;
        canvas.setZoom(scale);
        canvas.setWidth(baseWidth * scale);
        canvas.setHeight(baseHeight * scale);
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
});
