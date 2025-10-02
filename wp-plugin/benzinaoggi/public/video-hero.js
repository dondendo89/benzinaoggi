/**
 * BenzinaOggi Video Hero Controller
 * Advanced video player with analytics and accessibility
 */

(function($) {
    'use strict';
    
    class BenzinaOggiVideoHero {
        constructor() {
            this.video = null;
            this.controls = {};
            this.settings = window.BenzinaOggiVideo || {};
            this.analytics = {
                played: false,
                milestones: [25, 50, 75, 100],
                tracked: []
            };
            
            this.init();
        }
        
        init() {
            this.video = document.getElementById('hero-video-player');
            if (!this.video) return;
            
            this.setupControls();
            this.setupEventListeners();
            this.setupAnalytics();
            this.setupAccessibility();
            
            // Initialize based on settings
            if (this.settings.autoplay && this.settings.muted) {
                this.attemptAutoplay();
            }
        }
        
        setupControls() {
            this.controls = {
                playPause: document.getElementById('video-play-pause'),
                mute: document.getElementById('video-mute-toggle'),
                progress: document.getElementById('video-progress'),
                progressBar: document.querySelector('.progress-bar'),
                currentTime: document.getElementById('current-time'),
                totalTime: document.getElementById('total-time'),
                cta: document.getElementById('video-cta-button'),
                loading: document.getElementById('video-loading'),
                overlay: document.querySelector('.video-controls-overlay'),
                wrapper: document.querySelector('.video-wrapper')
            };
        }
        
        setupEventListeners() {
            // Video events
            this.video.addEventListener('loadstart', () => this.showLoading());
            this.video.addEventListener('canplay', () => this.hideLoading());
            this.video.addEventListener('loadedmetadata', () => this.updateTotalTime());
            this.video.addEventListener('timeupdate', () => this.updateProgress());
            this.video.addEventListener('ended', () => this.onVideoEnd());
            this.video.addEventListener('pause', () => this.onVideoPause());
            this.video.addEventListener('play', () => this.onVideoPlay());
            this.video.addEventListener('error', (e) => this.onVideoError(e));
            
            // Control events
            if (this.controls.playPause) {
                this.controls.playPause.addEventListener('click', () => this.togglePlayPause());
            }
            
            if (this.controls.mute) {
                this.controls.mute.addEventListener('click', () => this.toggleMute());
            }
            
            if (this.controls.progressBar) {
                this.controls.progressBar.addEventListener('click', (e) => this.seekVideo(e));
            }
            
            if (this.controls.cta) {
                this.controls.cta.addEventListener('click', () => this.onCtaClick());
            }
            
            // Auto-hide controls
            this.setupAutoHideControls();
            
            // Keyboard controls
            this.video.addEventListener('keydown', (e) => this.handleKeyboard(e));
            
            // Intersection Observer for lazy loading
            this.setupIntersectionObserver();
        }
        
        setupAutoHideControls() {
            let hideTimeout;
            
            const showControls = () => {
                if (this.controls.overlay) {
                    this.controls.overlay.classList.add('active');
                    clearTimeout(hideTimeout);
                    hideTimeout = setTimeout(hideControls, 3000);
                }
            };
            
            const hideControls = () => {
                if (this.controls.overlay && !this.video.paused) {
                    this.controls.overlay.classList.remove('active');
                }
            };
            
            if (this.controls.wrapper) {
                this.controls.wrapper.addEventListener('mousemove', showControls);
                this.controls.wrapper.addEventListener('mouseleave', hideControls);
                this.controls.wrapper.addEventListener('touchstart', showControls);
            }
        }
        
        setupIntersectionObserver() {
            if ('IntersectionObserver' in window) {
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            this.onVideoVisible();
                        } else {
                            this.onVideoHidden();
                        }
                    });
                }, { threshold: 0.5 });
                
                observer.observe(this.video);
            }
        }
        
        setupAnalytics() {
            // Track video milestones
            this.video.addEventListener('timeupdate', () => {
                if (this.video.duration) {
                    const progress = (this.video.currentTime / this.video.duration) * 100;
                    
                    this.analytics.milestones.forEach(milestone => {
                        if (progress >= milestone && !this.analytics.tracked.includes(milestone)) {
                            this.analytics.tracked.push(milestone);
                            this.trackEvent('video_progress_' + milestone, { progress });
                        }
                    });
                }
            });
        }
        
        setupAccessibility() {
            // Add ARIA labels
            this.video.setAttribute('aria-label', 'Video esplicativo BenzinaOggi');
            
            // Add keyboard support
            this.video.setAttribute('tabindex', '0');
            
            // Screen reader announcements
            this.video.addEventListener('play', () => {
                this.announceToScreenReader('Video in riproduzione');
            });
            
            this.video.addEventListener('pause', () => {
                this.announceToScreenReader('Video in pausa');
            });
        }
        
        // Control methods
        togglePlayPause() {
            if (this.video.paused) {
                this.playVideo();
            } else {
                this.pauseVideo();
            }
        }
        
        playVideo() {
            const playPromise = this.video.play();
            
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        this.updatePlayPauseIcon(false);
                        this.trackEvent('video_play');
                    })
                    .catch(error => {
                        console.warn('Video play failed:', error);
                        this.showPlayError();
                    });
            }
        }
        
        pauseVideo() {
            this.video.pause();
            this.updatePlayPauseIcon(true);
            this.trackEvent('video_pause');
        }
        
        toggleMute() {
            this.video.muted = !this.video.muted;
            this.updateMuteIcon(this.video.muted);
            this.trackEvent('video_mute_toggle', { muted: this.video.muted });
        }
        
        seekVideo(event) {
            const rect = this.controls.progressBar.getBoundingClientRect();
            const pos = (event.clientX - rect.left) / rect.width;
            const newTime = pos * this.video.duration;
            
            this.video.currentTime = newTime;
            this.trackEvent('video_seek', { position: pos, time: newTime });
        }
        
        // UI update methods
        updatePlayPauseIcon(isPaused) {
            if (!this.controls.playPause) return;
            
            const playIcon = this.controls.playPause.querySelector('.play-icon');
            const pauseIcon = this.controls.playPause.querySelector('.pause-icon');
            
            if (playIcon && pauseIcon) {
                if (isPaused) {
                    playIcon.style.display = 'block';
                    pauseIcon.style.display = 'none';
                    this.controls.playPause.setAttribute('aria-label', 'Riproduci video');
                } else {
                    playIcon.style.display = 'none';
                    pauseIcon.style.display = 'block';
                    this.controls.playPause.setAttribute('aria-label', 'Metti in pausa video');
                }
            }
        }
        
        updateMuteIcon(isMuted) {
            if (!this.controls.mute) return;
            
            const unmuteIcon = this.controls.mute.querySelector('.unmute-icon');
            const muteIcon = this.controls.mute.querySelector('.mute-icon');
            
            if (unmuteIcon && muteIcon) {
                if (isMuted) {
                    unmuteIcon.style.display = 'none';
                    muteIcon.style.display = 'block';
                    this.controls.mute.setAttribute('aria-label', 'Attiva audio');
                } else {
                    unmuteIcon.style.display = 'block';
                    muteIcon.style.display = 'none';
                    this.controls.mute.setAttribute('aria-label', 'Disattiva audio');
                }
            }
        }
        
        updateProgress() {
            if (!this.video.duration) return;
            
            const progress = (this.video.currentTime / this.video.duration) * 100;
            
            if (this.controls.progress) {
                this.controls.progress.style.width = progress + '%';
            }
            
            if (this.controls.currentTime) {
                this.controls.currentTime.textContent = this.formatTime(this.video.currentTime);
            }
        }
        
        updateTotalTime() {
            if (this.controls.totalTime && this.video.duration) {
                this.controls.totalTime.textContent = this.formatTime(this.video.duration);
            }
        }
        
        formatTime(seconds) {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return mins + ':' + (secs < 10 ? '0' : '') + secs;
        }
        
        // Loading states
        showLoading() {
            if (this.controls.loading) {
                this.controls.loading.style.display = 'block';
            }
            this.video.classList.add('loading');
        }
        
        hideLoading() {
            if (this.controls.loading) {
                this.controls.loading.style.display = 'none';
            }
            this.video.classList.remove('loading');
        }
        
        // Event handlers
        onVideoPlay() {
            this.analytics.played = true;
            this.hideCta();
            if (this.controls.wrapper) {
                this.controls.wrapper.classList.remove('paused');
            }
        }
        
        onVideoPause() {
            this.showCta();
            if (this.controls.wrapper) {
                this.controls.wrapper.classList.add('paused');
            }
        }
        
        onVideoEnd() {
            this.showCta();
            this.updatePlayPauseIcon(true);
            this.trackEvent('video_complete');
            
            // Auto-restart after 3 seconds if loop is enabled
            if (this.settings.loop) {
                setTimeout(() => {
                    if (this.video.paused) {
                        this.video.currentTime = 0;
                        this.playVideo();
                    }
                }, 3000);
            }
        }
        
        onVideoError(error) {
            console.error('Video error:', error);
            this.showVideoError();
            this.trackEvent('video_error', { error: error.message });
        }
        
        onVideoVisible() {
            // Auto-play when video becomes visible (if enabled)
            if (this.settings.autoplay && !this.analytics.played) {
                this.attemptAutoplay();
            }
        }
        
        onVideoHidden() {
            // Pause video when not visible to save bandwidth
            if (!this.video.paused && this.settings.pause_when_hidden) {
                this.pauseVideo();
            }
        }
        
        onCtaClick() {
            this.trackEvent('video_cta_click');
            
            // Trigger notification request
            if (window.BenzinaOggi && window.BenzinaOggi.requestNotificationPermission) {
                window.BenzinaOggi.requestNotificationPermission();
            } else {
                // Fallback: show notification modal or scroll to section
                this.showNotificationFallback();
            }
        }
        
        // CTA management
        showCta() {
            if (this.controls.cta && this.settings.show_cta) {
                this.controls.cta.style.display = 'block';
                this.controls.cta.style.animation = 'pulse-glow 2s infinite';
            }
        }
        
        hideCta() {
            if (this.controls.cta) {
                this.controls.cta.style.display = 'none';
                this.controls.cta.style.animation = 'none';
            }
        }
        
        // Autoplay handling
        attemptAutoplay() {
            if (!this.video.muted) {
                this.video.muted = true;
                this.updateMuteIcon(true);
            }
            
            const playPromise = this.video.play();
            
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        this.updatePlayPauseIcon(false);
                        this.trackEvent('video_autoplay_success');
                    })
                    .catch(() => {
                        // Autoplay failed - show play button
                        this.showPlayButton();
                        this.trackEvent('video_autoplay_failed');
                    });
            }
        }
        
        // Error handling
        showVideoError() {
            const errorHtml = `
                <div class="video-error">
                    <h3>Errore nel caricamento del video</h3>
                    <p>Il video non può essere riprodotto. <a href="#" onclick="location.reload()">Ricarica la pagina</a> per riprovare.</p>
                </div>
            `;
            
            if (this.controls.wrapper) {
                this.controls.wrapper.innerHTML = errorHtml;
            }
        }
        
        showPlayError() {
            this.announceToScreenReader('Errore nella riproduzione del video');
        }
        
        showPlayButton() {
            this.updatePlayPauseIcon(true);
            if (this.controls.overlay) {
                this.controls.overlay.classList.add('active');
            }
        }
        
        showNotificationFallback() {
            // Try to find notification section
            const notificationSection = document.querySelector('#notification-section, .notification-section');
            if (notificationSection) {
                notificationSection.scrollIntoView({ behavior: 'smooth' });
            } else {
                // Show browser notification request
                if ('Notification' in window) {
                    Notification.requestPermission().then(permission => {
                        if (permission === 'granted') {
                            new Notification('BenzinaOggi', {
                                body: 'Notifiche attivate! Riceverai avvisi sui prezzi bassi.',
                                icon: '/wp-content/plugins/benzinaoggi/assets/logo-benzinaoggi.svg'
                            });
                        }
                    });
                } else {
                    alert('Attiva le notifiche dalle impostazioni del browser per ricevere avvisi sui prezzi!');
                }
            }
        }
        
        // Keyboard handling
        handleKeyboard(event) {
            switch (event.key) {
                case ' ':
                case 'k':
                    event.preventDefault();
                    this.togglePlayPause();
                    break;
                case 'm':
                    event.preventDefault();
                    this.toggleMute();
                    break;
                case 'ArrowLeft':
                    event.preventDefault();
                    this.video.currentTime = Math.max(0, this.video.currentTime - 10);
                    break;
                case 'ArrowRight':
                    event.preventDefault();
                    this.video.currentTime = Math.min(this.video.duration, this.video.currentTime + 10);
                    break;
                case '0':
                    event.preventDefault();
                    this.video.currentTime = 0;
                    break;
            }
        }
        
        // Accessibility
        announceToScreenReader(message) {
            const announcement = document.createElement('div');
            announcement.setAttribute('aria-live', 'polite');
            announcement.setAttribute('aria-atomic', 'true');
            announcement.className = 'sr-only';
            announcement.textContent = message;
            
            document.body.appendChild(announcement);
            
            setTimeout(() => {
                document.body.removeChild(announcement);
            }, 1000);
        }
        
        // Analytics
        trackEvent(action, data = {}) {
            // Google Analytics 4
            if (typeof gtag !== 'undefined') {
                gtag('event', action, {
                    event_category: 'Video',
                    event_label: 'Hero Video',
                    ...data
                });
            }
            
            // WordPress analytics (if available)
            if (window.BenzinaOggi && window.BenzinaOggi.trackEvent) {
                window.BenzinaOggi.trackEvent(action, data);
            }
            
            // Custom analytics endpoint
            if (this.settings.analytics_enabled) {
                fetch('/wp-json/benzinaoggi/v1/analytics', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        event: action,
                        data: data,
                        timestamp: Date.now(),
                        video_id: 'hero_video',
                        user_agent: navigator.userAgent
                    })
                }).catch(() => {
                    // Silent fail for analytics
                });
            }
        }
        
        // Public API
        play() { this.playVideo(); }
        pause() { this.pauseVideo(); }
        mute() { this.video.muted = true; this.updateMuteIcon(true); }
        unmute() { this.video.muted = false; this.updateMuteIcon(false); }
        seek(time) { this.video.currentTime = time; }
        getCurrentTime() { return this.video.currentTime; }
        getDuration() { return this.video.duration; }
        getProgress() { return (this.video.currentTime / this.video.duration) * 100; }
    }
    
    // Initialize when DOM is ready
    $(document).ready(function() {
        // Only initialize if video element exists
        if (document.getElementById('hero-video-player')) {
            window.BenzinaOggiVideoPlayer = new BenzinaOggiVideoHero();
        }
    });
    
    // Global function for CTA (backward compatibility)
    window.activateNotifications = function() {
        if (window.BenzinaOggiVideoPlayer) {
            window.BenzinaOggiVideoPlayer.onCtaClick();
        } else if (window.BenzinaOggi && window.BenzinaOggi.requestNotificationPermission) {
            window.BenzinaOggi.requestNotificationPermission();
        }
    };
    
})(jQuery);
