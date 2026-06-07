document.addEventListener('DOMContentLoaded', function() {
    if (typeof fabric === 'undefined' || !document.getElementById('retro-canvas')) return;

    let baseWidth = 1680;
    let baseHeight = 640;
    let isPortrait = false;
    let canvasInitialized = false;

    const canvas = new fabric.Canvas('retro-canvas', {
        width: baseWidth,
        height: baseHeight,
        selection: false,
        allowTouchScrolling: false
    });

    // ── Mobile scroll fix ──────────────────────────────────────────────────
    // Fabric.js llama a preventDefault() en touchmove, bloqueando el scroll
    // nativo de la página. Detectamos si el gesto es mayoritariamente vertical
    // (scroll) y en ese caso lo dejamos pasar al navegador.
    (function() {
        const rawCanvas = document.getElementById('retro-canvas');
        if (!rawCanvas) return;

        let touchStartX = 0;
        let touchStartY = 0;
        let isScrolling = false; // null = no decidido, true = scroll, false = tap/canvas
        const SCROLL_THRESHOLD = 8; // px de movimiento vertical para considerar scroll

        rawCanvas.addEventListener('touchstart', function(e) {
            if (e.touches.length === 1) {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                isScrolling = false; // aún no sabemos
            }
        }, { passive: true });

        rawCanvas.addEventListener('touchmove', function(e) {
            if (e.touches.length !== 1) return;

            const dx = Math.abs(e.touches[0].clientX - touchStartX);
            const dy = Math.abs(e.touches[0].clientY - touchStartY);

            if (!isScrolling && dy > SCROLL_THRESHOLD && dy > dx * 1.2) {
                // Gesto principalmente vertical → es scroll de página
                isScrolling = true;
            }

            if (isScrolling) {
                // Dejar que el navegador haga scroll
                // No llamamos a preventDefault; Fabric no debe capturar esto
                e.stopImmediatePropagation();
            }
        }, { passive: true }); // passive:true para que el navegador no espere a preventDefault

        rawCanvas.addEventListener('touchend', function() {
            isScrolling = false;
        }, { passive: true });
    }());

    const data = window.retroGalleryData || {};
    const settings = data.settings || {};
    const imgUrl = data.imgUrl || '';

    // Custom Scanline Filter
    fabric.Image.filters.Scanline = fabric.util.createClass(fabric.Image.filters.BaseFilter, {
        type: 'Scanline',
        fragmentSource: `
            precision highp float;
            uniform sampler2D uTexture;
            varying vec2 vTexCoord;
            void main() {
                vec4 color = texture2D(uTexture, vTexCoord);
                float scanline = step(2.0, mod(gl_FragCoord.y, 4.0)) * 0.4;
                color.rgb -= scanline;
                gl_FragColor = color;
            }
        `,
        applyTo2d: function(options) {
            var data = options.imageData.data,
                len = data.length,
                width = options.imageData.width;
            for (var i = 0; i < len; i += 4) {
                var y = Math.floor((i / 4) / width);
                if (y % 4 < 2) {
                    data[i] = Math.max(0, data[i] - 100);
                    data[i+1] = Math.max(0, data[i+1] - 100);
                    data[i+2] = Math.max(0, data[i+2] - 100);
                }
            }
        }
    });
    fabric.Image.filters.Scanline.fromObject = fabric.Image.filters.BaseFilter.fromObject;

    // Create the scanline pattern once (2px dark / 2px transparent, repeating)
    const scanlinePatternCanvas = document.createElement('canvas');
    scanlinePatternCanvas.width = 1;
    scanlinePatternCanvas.height = 4;
    const sctx = scanlinePatternCanvas.getContext('2d');
    sctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    sctx.fillRect(0, 0, 1, 2);
    // rows 2-3 are transparent

    const monitorConfigsLandscape = [
        { id: 1, x: 619, y: 245, w: 384, h: 246, type: 'main' },      
        { id: 2, x: 210, y: 301, w: 211, h: 188, type: 'small' },     
        { id: 3, x: 1294, y: 379, w: 184, h: 146, type: 'small', filter: 'sepia' }, 
        { id: 4, x: 1109, y: 117, w: 169, h: 132, type: 'small' },     
        { id: 5, x: 254, y: 104, w: 166, h: 139, type: 'small', filter: 'green' }, 
        { id: 6, x: 1112, y: 340, w: 95, h: 74, type: 'small' }     
    ];

    const monitorConfigsPortrait = [
        { id: 1, x: 209, y: 801, w: 351, h: 217, type: 'main' },
        { id: 2, x: 170, y: 306, w: 144, h: 121, type: 'small' },
        { id: 3, x: 135, y: 472, w: 180, h: 158, type: 'small', filter: 'sepia' },
        { id: 4, x: 426, y: 568, w: 153, h: 122, type: 'small' },
        { id: 5, x: 105, y: 1068, w: 186, h: 155, type: 'small', filter: 'green' },
        { id: 6, x: 462, y: 1086, w: 184, h: 152, type: 'small' }
    ];

    let activeConfigs = monitorConfigsLandscape;
    let activeRemoteCoords = {
        plus: { cx: 780.5, cy: 569.5, w: 87, h: 15 },
        minus: { cx: 776, cy: 614.5, w: 96, h: 17 }
    };
    let activeSignCoords = {
        left: 518, top: 17, w: 545, h: 66
    };

    // COORD HELPER
    canvas.on('mouse:down', function(options) {
        const pointer = canvas.getPointer(options.e);
        console.log('COORD:', Math.round(pointer.x), Math.round(pointer.y));
    });

    let monitorObjects = [];
    let filterOverlays = [];
    let scanlineOverlays = [];
    let maskImage = null;
    let titleSignGroup = null;
    let remoteButtons = [];
    let currentChannel = 0;
    const totalChannels = 6;

    function getMonitorData(channel, configId) {
        const index = channel * 6 + configId;
        return settings['monitor_' + index] || { url: '', title: '', description: '' };
    }

    function initGallery() {
        const newIsPortrait = window.innerHeight > window.innerWidth;
        
        if (canvasInitialized && isPortrait === newIsPortrait) {
            resizeCanvas();
            return;
        }
        
        isPortrait = newIsPortrait;
        canvasInitialized = true;
        
        // Clear previous state
        canvas.clear();
        monitorObjects = [];
        filterOverlays = [];
        scanlineOverlays = [];
        remoteButtons = [];
        if (titleSignGroup) {
            titleSignGroup = null;
        }
        
        // Update layout configuration
        baseWidth = isPortrait ? 768 : 1680;
        baseHeight = isPortrait ? 1376 : 640;
        activeConfigs = isPortrait ? monitorConfigsPortrait : monitorConfigsLandscape;
        
        activeRemoteCoords = isPortrait ? {
            plus: { cx: 258.5, cy: 1320.0, w: 135, h: 64 },
            minus: { cx: 442.5, cy: 1322.5, w: 145, h: 65 }
        } : {
            plus: { cx: 780.5, cy: 569.5, w: 87, h: 15 },
            minus: { cx: 776, cy: 614.5, w: 96, h: 17 }
        };
        
        activeSignCoords = isPortrait ? {
            left: 95, top: 81, w: 577, h: 75
        } : {
            left: 518, top: 17, w: 545, h: 66
        };
        
        canvas.setWidth(baseWidth);
        canvas.setHeight(baseHeight);
        
        // Immediately set correct canvas zoom scale on initial load
        resizeCanvas();
        
        const bgImgName = isPortrait ? 'vertical-1.png' : 'fondo-tv-transparent4-alpha.png';
        
        fabric.Image.fromURL(imgUrl + bgImgName, function(img) {
            img.set({
                scaleX: baseWidth / img.width,
                scaleY: baseHeight / img.height,
                originX: 'left',
                originY: 'top',
                selectable: false,
                evented: false
            });
            maskImage = img;
            canvas.add(img);
            img.bringToFront();
            initMonitors();
            initRemoteControl();
        });
    }

    function initMonitors() {
        activeConfigs.forEach((config, index) => {
            const monitorData = getMonitorData(currentChannel, config.id);
            const placeholderUrl = 'https://via.placeholder.com/' + config.w + 'x' + config.h + '?text=No+Image';
            const finalUrl = monitorData.url || placeholderUrl;

            // Create overlays once per config BEFORE images load to keep them above
            addFilterOverlay(config);
            addScanlineOverlay(config);

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

                canvas.add(img);
                img.sendToBack(); // Images always go to the bottom
                monitorObjects[config.id] = img;

                if (config.id === 1) {
                    createTitleSign(img.monitorTitle);
                }

                img.on('mousedown', () => handleMonitorClick(img));
                ensureCorrectStacking();
            }, { crossOrigin: 'anonymous' });
        });
    }

    function addScanlineOverlay(config) {
        const pattern = new fabric.Pattern({
            source: scanlinePatternCanvas,
            repeat: 'repeat'
        });
        const scanRect = new fabric.Rect({
            left: config.x,
            top: config.y,
            width: config.w,
            height: config.h,
            fill: pattern,
            selectable: false,
            evented: false,
            hoverCursor: 'default'
        });
        canvas.add(scanRect);
        scanlineOverlays.push(scanRect);
    }

    function addFilterOverlay(config) {
        if (!config.filter) return;
        
        let color = '';
        let opacity = 0;
        let mode = 'source-over';
        
        if (config.filter === 'sepia') {
            color = '#9e6e30';
            opacity = 0.5;
            mode = 'multiply';
        } else if (config.filter === 'green') {
            color = '#00ff00';
            opacity = 0.5;
            mode = 'multiply';
        }
        
        const filterRect = new fabric.Rect({
            left: config.x,
            top: config.y,
            width: config.w,
            height: config.h,
            fill: color,
            opacity: opacity,
            selectable: false,
            evented: false,
            hoverCursor: 'default',
            globalCompositeOperation: mode
        });
        canvas.add(filterRect);
        filterOverlays.push(filterRect);
    }

    function ensureCorrectStacking() {
        filterOverlays.forEach(o => o.bringToFront());
        scanlineOverlays.forEach(o => o.bringToFront());
        if (maskImage) maskImage.bringToFront();
        if (titleSignGroup) titleSignGroup.bringToFront();
        remoteButtons.forEach(btn => btn.bringToFront());
        canvas.renderAll();
    }

    function isChannelActive(channel) {
        for (let i = 1; i <= 6; i++) {
            const data = getMonitorData(channel, i);
            if (data && data.url && data.url !== '') {
                return true;
            }
        }
        return false;
    }

    function initRemoteControl() {
        // Canal +
        const btnPlus = new fabric.Rect({
            left: activeRemoteCoords.plus.cx,
            top: activeRemoteCoords.plus.cy,
            width: activeRemoteCoords.plus.w,
            height: activeRemoteCoords.plus.h,
            fill: 'rgba(255,0,0,0)', // Invisible
            originX: 'center',
            originY: 'center',
            selectable: false,
            hoverCursor: 'pointer'
        });
        btnPlus.on('mousedown', () => changeChannel(1));

        // Canal -
        const btnMinus = new fabric.Rect({
            left: activeRemoteCoords.minus.cx,
            top: activeRemoteCoords.minus.cy,
            width: activeRemoteCoords.minus.w,
            height: activeRemoteCoords.minus.h,
            fill: 'rgba(255,0,0,0)', // Invisible
            originX: 'center',
            originY: 'center',
            selectable: false,
            hoverCursor: 'pointer'
        });
        btnMinus.on('mousedown', () => changeChannel(-1));

        canvas.add(btnPlus, btnMinus);
        remoteButtons.push(btnPlus, btnMinus);
        ensureCorrectStacking();
    }

    function changeChannel(dir) {
        let nextChannel = currentChannel;
        let found = false;

        // Intentar buscar el siguiente canal que tenga al menos una imagen
        for (let attempts = 0; attempts < totalChannels; attempts++) {
            nextChannel += dir;
            if (nextChannel >= totalChannels) nextChannel = 0;
            if (nextChannel < 0) nextChannel = totalChannels - 1;

            if (isChannelActive(nextChannel)) {
                found = true;
                break;
            }
        }

        if (found && nextChannel !== currentChannel) {
            currentChannel = nextChannel;
            loadChannel(currentChannel);
        }
    }

    function loadChannel(channel) {
        activeConfigs.forEach((config) => {
            const oldImgObj = monitorObjects[config.id];
            if (!oldImgObj) return;

            const monitorData = getMonitorData(channel, config.id);
            const placeholderUrl = 'https://via.placeholder.com/' + config.w + 'x' + config.h + '?text=No+Image';
            const finalUrl = monitorData.url || placeholderUrl;

            updateMonitorImage(oldImgObj, finalUrl, monitorData.title, monitorData.description, function() {
                if (config.id === 1) {
                    createTitleSign(monitorData.title);
                }
            });
        });
    }

    /**
     * Dibuja el texto de título como una imagen LED (canvas 2D nativo).
     * Evita fabric.Text por completo para esquivar el bug 'alphabetical' de Fabric 5.x.
     */
    function drawLedTextToCanvas(text, canvasH) {
        // Paso 1: medir el ancho real del texto en un canvas temporal
        const measureCanvas = document.createElement('canvas');
        const mctx = measureCanvas.getContext('2d');
        const fontSize = Math.floor(canvasH * 0.82);
        mctx.font = 'bold ' + fontSize + 'px "Courier New", monospace';
        const measuredW = Math.ceil(mctx.measureText(text || '').width) + 20; // +20px de padding

        const canvasW = measuredW;
        const offscreen = document.createElement('canvas');
        offscreen.width  = canvasW;
        offscreen.height = canvasH;
        const ctx = offscreen.getContext('2d');

        // Fondo oscuro
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, canvasW, canvasH);

        // Renderizar el texto en blanco primero para luego "picar" los píxeles en puntos LED
        ctx.font = 'bold ' + fontSize + 'px "Courier New", monospace';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(text || '', 0, canvasH / 2);

        // Leer los píxeles y dibujar puntos LED encima
        const imageData = ctx.getImageData(0, 0, canvasW, canvasH);
        const pixels = imageData.data;

        // Limpiar y redibujar como puntos LED
        ctx.clearRect(0, 0, canvasW, canvasH);
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, canvasW, canvasH);

        const dotSize = 3;
        const gap = 1;
        const step = dotSize + gap;

        for (let y = 0; y < canvasH; y += step) {
            for (let x = 0; x < canvasW; x += step) {
                const idx = (y * canvasW + x) * 4;
                const alpha = pixels[idx + 3];
                if (alpha > 50) {
                    const brightness = pixels[idx]; // Canal R del blanco original
                    const intensity = brightness / 255;
                    // Punto exterior (glow tenue)
                    ctx.beginPath();
                    ctx.arc(x + dotSize / 2, y + dotSize / 2, dotSize * 0.9, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(0, 220, 220, ' + (intensity * 0.25) + ')';
                    ctx.fill();
                    // Punto interior brillante
                    ctx.beginPath();
                    ctx.arc(x + dotSize / 2, y + dotSize / 2, dotSize * 0.5, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(0, 255, 255, ' + (intensity * 0.95) + ')';
                    ctx.shadowColor = '#00ffff';
                    ctx.shadowBlur = 4;
                    ctx.fill();
                    ctx.shadowBlur = 0;
                }
            }
        }
        return { canvas: offscreen, width: canvasW };
    }

    function createTitleSign(text) {
        if (titleSignGroup) canvas.remove(titleSignGroup);
        
        const signLeft = activeSignCoords.left;
        const signTop  = activeSignCoords.top;
        const signW    = activeSignCoords.w;
        const signH    = activeSignCoords.h;

        // Generar texto LED en canvas 2D nativo (evita el bug de Fabric.js 5.x con textBaseline)
        // Medir el texto real para no tener espacio vacío en el marquee
        const ledResult   = drawLedTextToCanvas(text, signH);
        const ledCanvas   = ledResult.canvas;
        const textCanvasW = ledResult.width;

        const rect = new fabric.Rect({
            width: signW,
            height: signH,
            fill: '#050505',
            stroke: '#002244',
            strokeWidth: 2,
            originX: 'center',
            originY: 'center',
            rx: 5,
            ry: 5
        });

        // Convertir el canvas LED en fabric.Image
        const ledImg = new fabric.Image(ledCanvas, {
            originX: 'left',
            originY: 'center',
            left: signW / 2, // Empieza a la derecha (para el marquee)
            top: 0,
            width: textCanvasW,
            height: signH,
            scaleX: 1,
            scaleY: 1
        });

        titleSignGroup = new fabric.Group([rect, ledImg], {
            left: signLeft + signW / 2,
            top: signTop + signH / 2,
            selectable: false,
            evented: false,
            originX: 'center',
            originY: 'center',
            clipPath: new fabric.Rect({
                originX: 'center',
                originY: 'center',
                width: signW - 4,
                height: signH - 4
            })
        });

        canvas.add(titleSignGroup);
        ensureCorrectStacking();

        // Animar el texto en bucle infinito de derecha a izquierda
        const currentGroup = titleSignGroup;
        function stepMarquee() {
            if (titleSignGroup !== currentGroup) return;
            
            const startX =  signW / 2;
            const endX   = -textCanvasW - signW / 2;
            
            fabric.util.animate({
                startValue: startX,
                endValue: endX,
                duration: (4000 + (textCanvasW * 4)) / 1.5, // 1.5x más rápido
                easing: fabric.util.ease.linear,
                onChange: function(value) {
                    if (titleSignGroup !== currentGroup) return;
                    ledImg.set('left', value);
                    canvas.requestRenderAll();
                },
                onComplete: function() {
                    if (titleSignGroup === currentGroup) stepMarquee();
                }
            });
        }
        stepMarquee();
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
        updateMonitorImage(mainImg, smallImg.monitorUrl, smallImg.monitorTitle, smallImg.monitorDesc, function() {
            // Update sign after main monitor is updated
            createTitleSign(smallImg.monitorTitle);
        });
        
        // Update Small
        updateMonitorImage(smallImg, tempUrl, tempTitle, tempDesc);
    }

    function updateMonitorImage(oldImgObj, url, title, desc, callback) {
        const configId = oldImgObj.monitorId;
        const config = activeConfigs.find(c => c.id === configId);

        fabric.Image.fromURL(url, function(newImg) {
            newImg.set({
                left: config.x,
                top: config.y,
                width: newImg.width,
                height: newImg.height,
                scaleX: config.w / newImg.width,
                scaleY: config.h / newImg.height,
                selectable: false,
                hoverCursor: 'pointer'
            });

            newImg.monitorId = configId;
            newImg.monitorTitle = title;
            newImg.monitorDesc = desc;
            newImg.monitorUrl = url;
            newImg.monitorType = config.type;

            // Reemplazar el objeto viejo por el nuevo
            canvas.remove(oldImgObj);
            canvas.add(newImg);
            newImg.sendToBack();
            monitorObjects[configId] = newImg;

            newImg.on('mousedown', () => handleMonitorClick(newImg));

            ensureCorrectStacking(); // IMPORTANTE: para que la máscara y scanlines queden arriba

            if (callback) callback();
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
        const fsImage = document.getElementById('fullscreen-main-img');
        const fsDesc = document.getElementById('fullscreen-desc');
        
        if (fsImage) fsImage.src = img.monitorUrl;
        if (fsDesc)  fsDesc.textContent = img.monitorDesc || '';
        
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
        let nextIndex = currentFullscreenIndex + dir;
        if (nextIndex < 1) nextIndex = 6;
        if (nextIndex > 6) nextIndex = 1;

        const nextMonitor = monitorObjects[nextIndex];
        if (nextMonitor) {
            currentFullscreenIndex = nextIndex;

            const fsImage = document.getElementById('fullscreen-main-img');
            const fsDesc = document.getElementById('fullscreen-desc');
            if (fsImage) fsImage.src = nextMonitor.monitorUrl;
            if (fsDesc)  fsDesc.textContent = nextMonitor.monitorDesc || '';
        }
    }

    // Responsive Canvas
    function resizeCanvas() {
        const wrapper = document.getElementById('retro-canvas-wrapper');
        if (!wrapper) return;
        let width = wrapper.offsetWidth;
        if (width === 0 && wrapper.parentElement) {
            width = wrapper.parentElement.offsetWidth;
        }
        if (width === 0) {
            // Retry in a bit once the CSS/layout has loaded
            setTimeout(resizeCanvas, 50);
            return;
        }
        const scale = width / baseWidth;
        canvas.setZoom(scale);
        canvas.setWidth(baseWidth * scale);
        canvas.setHeight(baseHeight * scale);
    }

    window.addEventListener('resize', initGallery);
    window.addEventListener('load', initGallery);
    initGallery();
});
