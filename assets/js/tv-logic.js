
document.addEventListener('DOMContentLoaded', function() {
    const mainTv = document.querySelector('.main-tv-wrapper .tv-item');
    const secondaryTvs = document.querySelectorAll('.secondary-tvs-grid .tv-item');
    const fullscreenView = document.getElementById('tv-fullscreen-view');
    const fullscreenImg = fullscreenView.querySelector('.fullscreen-image');
    const exitBtn = document.getElementById('tv-exit-fullscreen');

    // Swap Logic
    secondaryTvs.forEach(tv => {
        tv.addEventListener('click', function() {
            const mainImg = mainTv.querySelector('.tv-content img');
            const thisImg = this.querySelector('.tv-content img');
            
            // Swap src
            const tempSrc = mainImg.src;
            mainImg.src = thisImg.src;
            thisImg.src = tempSrc;

            // Trigger a small "static" flicker effect if desired
            mainTv.style.opacity = '0.5';
            setTimeout(() => mainTv.style.opacity = '1', 50);
        });
    });

    // Fullscreen Logic
    mainTv.addEventListener('click', function() {
        const currentImg = this.querySelector('.tv-content img').src;
        fullscreenImg.src = currentImg;
        fullscreenView.classList.add('active');
        
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        }
    });

    // Exit Fullscreen
    exitBtn.addEventListener('click', function() {
        fullscreenView.classList.remove('active');
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    });

    // Also close on ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && fullscreenView.classList.contains('active')) {
            fullscreenView.classList.remove('active');
        }
    });
});
