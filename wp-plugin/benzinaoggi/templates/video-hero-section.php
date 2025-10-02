<?php
/**
 * Video Hero Section Template
 * Displays promotional video in header with responsive design
 */

// Get plugin options for video settings
$options = get_option('benzinaoggi_options', []);
$video_enabled = $options['hero_video_enabled'] ?? true;
$video_autoplay = $options['hero_video_autoplay'] ?? true;
$video_loop = $options['hero_video_loop'] ?? true;
$video_muted = $options['hero_video_muted'] ?? true;

if (!$video_enabled) return;

// Video file URLs (fallback chain)
$video_base_url = plugin_dir_url(__FILE__) . '../assets/videos/';
$video_files = [
    'mp4' => $video_base_url . 'benzinaoggi-hero.mp4',
    'webm' => $video_base_url . 'benzinaoggi-hero.webm',
    'poster' => $video_base_url . 'benzinaoggi-hero-poster.jpg'
];

// Fallback image if video fails
$fallback_image = $video_base_url . 'benzinaoggi-hero-fallback.jpg';
?>

<section id="benzinaoggi-hero-video" class="hero-video-section">
    <div class="hero-video-container">
        <!-- Video Player -->
        <div class="video-wrapper">
            <video 
                id="hero-video-player"
                class="hero-video"
                <?php echo $video_autoplay ? 'autoplay' : ''; ?>
                <?php echo $video_loop ? 'loop' : ''; ?>
                <?php echo $video_muted ? 'muted' : ''; ?>
                playsinline
                preload="metadata"
                poster="<?php echo esc_url($video_files['poster']); ?>"
                aria-label="Video esplicativo BenzinaOggi - Trova i prezzi carburanti più bassi"
            >
                <!-- Multiple video formats for browser compatibility -->
                <source src="<?php echo esc_url($video_files['webm']); ?>" type="video/webm">
                <source src="<?php echo esc_url($video_files['mp4']); ?>" type="video/mp4">
                
                <!-- Fallback for browsers that don't support video -->
                <div class="video-fallback">
                    <img 
                        src="<?php echo esc_url($fallback_image); ?>" 
                        alt="BenzinaOggi - Trova distributori e prezzi carburanti"
                        class="fallback-image"
                    >
                    <div class="fallback-content">
                        <h2>BenzinaOggi - Il Risparmio che ti Segue</h2>
                        <p>Trova i prezzi carburanti più bassi nella tua zona e ricevi notifiche quando scendono!</p>
                        <button class="cta-button" onclick="activateNotifications()">
                            🔔 Attiva Notifiche Gratuite
                        </button>
                    </div>
                </div>
            </video>

            <!-- Video Controls Overlay -->
            <div class="video-controls-overlay">
                <div class="controls-container">
                    <!-- Play/Pause Button -->
                    <button 
                        id="video-play-pause" 
                        class="control-btn play-pause-btn"
                        aria-label="Play/Pausa video"
                        title="Play/Pausa"
                    >
                        <svg class="play-icon" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                        <svg class="pause-icon" viewBox="0 0 24 24" fill="currentColor" style="display:none;">
                            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                        </svg>
                    </button>

                    <!-- Mute/Unmute Button -->
                    <button 
                        id="video-mute-toggle" 
                        class="control-btn mute-btn"
                        aria-label="Mute/Unmute audio"
                        title="Audio on/off"
                    >
                        <svg class="unmute-icon" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                        </svg>
                        <svg class="mute-icon" viewBox="0 0 24 24" fill="currentColor" style="display:none;">
                            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                        </svg>
                    </button>

                    <!-- Progress Bar -->
                    <div class="progress-container">
                        <div class="progress-bar">
                            <div id="video-progress" class="progress-fill"></div>
                        </div>
                        <span class="time-display">
                            <span id="current-time">0:00</span> / <span id="total-time">1:00</span>
                        </span>
                    </div>

                    <!-- CTA Button (appears at video end or on pause) -->
                    <button 
                        id="video-cta-button" 
                        class="cta-button primary-cta"
                        onclick="activateNotifications()"
                        style="display: none;"
                    >
                        🔔 Attiva Notifiche Gratuite
                    </button>
                </div>
            </div>

            <!-- Loading Spinner -->
            <div id="video-loading" class="video-loading">
                <div class="spinner"></div>
                <p>Caricamento video...</p>
            </div>
        </div>

        <!-- Video Caption/Transcript (for accessibility) -->
        <div class="video-caption" style="display: none;">
            <button class="caption-toggle" aria-label="Mostra/Nascondi trascrizione">
                📄 Trascrizione
            </button>
            <div class="caption-content">
                <p><strong>0:00-0:08:</strong> "Ogni giorno in Italia, milioni di automobilisti cercano il distributore più conveniente..."</p>
                <p><strong>0:08-0:18:</strong> "Ma i prezzi cambiano continuamente, e perdere l'occasione di risparmiare può costare caro..."</p>
                <p><strong>0:18-0:32:</strong> "Con BenzinaOggi trovi istantaneamente i prezzi più bassi nella tua zona..."</p>
                <p><strong>0:32-0:48:</strong> "Ma la vera magia? Ricevi notifiche istantanee quando i prezzi scendono..."</p>
                <p><strong>0:48-1:00:</strong> "Inizia subito a risparmiare! Clicca qui per attivare le notifiche gratuite..."</p>
            </div>
        </div>
    </div>

    <!-- Schema.org VideoObject for SEO -->
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "VideoObject",
        "name": "BenzinaOggi - Come Risparmiare sui Carburanti",
        "description": "Scopri come trovare i prezzi carburanti più bassi in Italia e ricevere notifiche quando scendono. Video esplicativo delle funzionalità di BenzinaOggi.",
        "thumbnailUrl": "<?php echo esc_url($video_files['poster']); ?>",
        "uploadDate": "<?php echo date('c'); ?>",
        "duration": "PT1M",
        "contentUrl": "<?php echo esc_url($video_files['mp4']); ?>",
        "embedUrl": "<?php echo esc_url(get_site_url()); ?>",
        "publisher": {
            "@type": "Organization",
            "name": "BenzinaOggi",
            "logo": {
                "@type": "ImageObject",
                "url": "<?php echo plugin_dir_url(__FILE__) . '../assets/logo-benzinaoggi.svg'; ?>"
            }
        }
    }
    </script>
</section>

<style>
/* Hero Video Section Styles */
.hero-video-section {
    position: relative;
    width: 100%;
    max-width: 1200px;
    margin: 0 auto 2rem;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.hero-video-container {
    position: relative;
    width: 100%;
    background: #000;
}

.video-wrapper {
    position: relative;
    width: 100%;
    padding-bottom: 56.25%; /* 16:9 aspect ratio */
    height: 0;
}

.hero-video {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 12px;
}

/* Video Controls Overlay */
.video-controls-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.3) 100%);
    display: flex;
    align-items: flex-end;
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
}

.video-wrapper:hover .video-controls-overlay,
.video-controls-overlay.active {
    opacity: 1;
    pointer-events: auto;
}

.controls-container {
    width: 100%;
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 15px;
    background: linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.8) 100%);
}

.control-btn {
    background: rgba(255,255,255,0.2);
    border: none;
    border-radius: 50%;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    cursor: pointer;
    transition: all 0.3s ease;
    backdrop-filter: blur(10px);
}

.control-btn:hover {
    background: rgba(255,255,255,0.3);
    transform: scale(1.1);
}

.control-btn svg {
    width: 20px;
    height: 20px;
}

/* Progress Bar */
.progress-container {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
}

.progress-bar {
    flex: 1;
    height: 4px;
    background: rgba(255,255,255,0.3);
    border-radius: 2px;
    cursor: pointer;
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    background: #10B981;
    border-radius: 2px;
    width: 0%;
    transition: width 0.1s ease;
}

.time-display {
    color: white;
    font-size: 12px;
    font-weight: 500;
    min-width: 80px;
    text-align: right;
}

/* CTA Button */
.cta-button {
    background: linear-gradient(135deg, #10B981 0%, #059669 100%);
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 25px;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 8px;
}

.cta-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
}

.primary-cta {
    font-size: 16px;
    padding: 15px 30px;
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
}

/* Loading Spinner */
.video-loading {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    color: white;
    z-index: 10;
}

.spinner {
    width: 40px;
    height: 40px;
    border: 4px solid rgba(255,255,255,0.3);
    border-top: 4px solid #10B981;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 10px;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

/* Fallback Styles */
.video-fallback {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    text-align: center;
    padding: 40px 20px;
}

.fallback-image {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    margin-bottom: 20px;
}

.fallback-content h2 {
    font-size: 2rem;
    margin-bottom: 1rem;
    font-weight: 700;
}

.fallback-content p {
    font-size: 1.1rem;
    margin-bottom: 2rem;
    max-width: 600px;
    line-height: 1.6;
}

/* Caption/Transcript */
.video-caption {
    background: #f8f9fa;
    border-top: 1px solid #e9ecef;
    padding: 15px 20px;
}

.caption-toggle {
    background: none;
    border: none;
    color: #6c757d;
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
}

.caption-content {
    margin-top: 15px;
    font-size: 14px;
    line-height: 1.6;
    color: #495057;
}

.caption-content p {
    margin-bottom: 8px;
}

/* Mobile Responsive */
@media (max-width: 768px) {
    .hero-video-section {
        margin: 0 0 1rem;
        border-radius: 8px;
    }
    
    .video-wrapper {
        padding-bottom: 75%; /* More square aspect ratio for mobile */
    }
    
    .controls-container {
        padding: 15px;
        gap: 10px;
        flex-wrap: wrap;
    }
    
    .control-btn {
        width: 40px;
        height: 40px;
    }
    
    .cta-button {
        font-size: 14px;
        padding: 10px 20px;
    }
    
    .primary-cta {
        font-size: 14px;
        padding: 12px 24px;
        width: 100%;
        margin-top: 10px;
    }
    
    .fallback-content h2 {
        font-size: 1.5rem;
    }
    
    .fallback-content p {
        font-size: 1rem;
    }
}

/* Tablet */
@media (min-width: 769px) and (max-width: 1024px) {
    .video-wrapper {
        padding-bottom: 60%; /* Slightly less wide for tablet */
    }
}

/* High DPI displays */
@media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
    .hero-video {
        image-rendering: -webkit-optimize-contrast;
        image-rendering: crisp-edges;
    }
}

/* Reduced motion preference */
@media (prefers-reduced-motion: reduce) {
    .cta-button,
    .spinner,
    .control-btn {
        animation: none;
        transition: none;
    }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
    .video-caption {
        background: #2d3748;
        border-top-color: #4a5568;
    }
    
    .caption-toggle {
        color: #a0aec0;
    }
    
    .caption-content {
        color: #e2e8f0;
    }
}
</style>

<script>
// Video Hero Section JavaScript Controller
document.addEventListener('DOMContentLoaded', function() {
    const video = document.getElementById('hero-video-player');
    const playPauseBtn = document.getElementById('video-play-pause');
    const muteBtn = document.getElementById('video-mute-toggle');
    const progressBar = document.getElementById('video-progress');
    const currentTimeSpan = document.getElementById('current-time');
    const totalTimeSpan = document.getElementById('total-time');
    const ctaButton = document.getElementById('video-cta-button');
    const loading = document.getElementById('video-loading');
    const controlsOverlay = document.querySelector('.video-controls-overlay');
    
    if (!video) return;
    
    // Video event listeners
    video.addEventListener('loadstart', showLoading);
    video.addEventListener('canplay', hideLoading);
    video.addEventListener('loadedmetadata', updateTotalTime);
    video.addEventListener('timeupdate', updateProgress);
    video.addEventListener('ended', showCTA);
    video.addEventListener('pause', showCTA);
    video.addEventListener('play', hideCTA);
    
    // Control event listeners
    playPauseBtn?.addEventListener('click', togglePlayPause);
    muteBtn?.addEventListener('click', toggleMute);
    progressBar?.parentElement.addEventListener('click', seekVideo);
    
    // Auto-hide controls
    let controlsTimeout;
    const videoWrapper = document.querySelector('.video-wrapper');
    
    videoWrapper?.addEventListener('mousemove', showControls);
    videoWrapper?.addEventListener('mouseleave', hideControls);
    
    function showLoading() {
        if (loading) loading.style.display = 'block';
    }
    
    function hideLoading() {
        if (loading) loading.style.display = 'none';
    }
    
    function togglePlayPause() {
        if (video.paused) {
            video.play();
            updatePlayPauseIcon(false);
        } else {
            video.pause();
            updatePlayPauseIcon(true);
        }
    }
    
    function updatePlayPauseIcon(isPaused) {
        const playIcon = playPauseBtn?.querySelector('.play-icon');
        const pauseIcon = playPauseBtn?.querySelector('.pause-icon');
        
        if (playIcon && pauseIcon) {
            if (isPaused) {
                playIcon.style.display = 'block';
                pauseIcon.style.display = 'none';
            } else {
                playIcon.style.display = 'none';
                pauseIcon.style.display = 'block';
            }
        }
    }
    
    function toggleMute() {
        video.muted = !video.muted;
        updateMuteIcon(video.muted);
    }
    
    function updateMuteIcon(isMuted) {
        const unmuteIcon = muteBtn?.querySelector('.unmute-icon');
        const muteIcon = muteBtn?.querySelector('.mute-icon');
        
        if (unmuteIcon && muteIcon) {
            if (isMuted) {
                unmuteIcon.style.display = 'none';
                muteIcon.style.display = 'block';
            } else {
                unmuteIcon.style.display = 'block';
                muteIcon.style.display = 'none';
            }
        }
    }
    
    function updateProgress() {
        if (video.duration) {
            const progress = (video.currentTime / video.duration) * 100;
            if (progressBar) progressBar.style.width = progress + '%';
            
            if (currentTimeSpan) {
                currentTimeSpan.textContent = formatTime(video.currentTime);
            }
        }
    }
    
    function updateTotalTime() {
        if (totalTimeSpan && video.duration) {
            totalTimeSpan.textContent = formatTime(video.duration);
        }
    }
    
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return mins + ':' + (secs < 10 ? '0' : '') + secs;
    }
    
    function seekVideo(e) {
        const progressContainer = e.currentTarget;
        const rect = progressContainer.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        video.currentTime = pos * video.duration;
    }
    
    function showCTA() {
        if (ctaButton) {
            ctaButton.style.display = 'block';
            ctaButton.style.animation = 'pulse 2s infinite';
        }
    }
    
    function hideCTA() {
        if (ctaButton) {
            ctaButton.style.display = 'none';
        }
    }
    
    function showControls() {
        if (controlsOverlay) {
            controlsOverlay.classList.add('active');
            clearTimeout(controlsTimeout);
            controlsTimeout = setTimeout(hideControls, 3000);
        }
    }
    
    function hideControls() {
        if (controlsOverlay && !video.paused) {
            controlsOverlay.classList.remove('active');
        }
    }
    
    // Analytics tracking
    function trackVideoEvent(action, value = null) {
        if (typeof gtag !== 'undefined') {
            gtag('event', action, {
                event_category: 'Video',
                event_label: 'Hero Video',
                value: value
            });
        }
        
        // Also send to WordPress (if analytics plugin exists)
        if (window.BenzinaOggi?.trackEvent) {
            window.BenzinaOggi.trackEvent('video_' + action, { value });
        }
    }
    
    // Track video milestones
    let milestones = [25, 50, 75, 100];
    let trackedMilestones = [];
    
    video.addEventListener('timeupdate', function() {
        if (video.duration) {
            const progress = (video.currentTime / video.duration) * 100;
            
            milestones.forEach(milestone => {
                if (progress >= milestone && !trackedMilestones.includes(milestone)) {
                    trackedMilestones.push(milestone);
                    trackVideoEvent('progress_' + milestone);
                }
            });
        }
    });
    
    // Track interactions
    video.addEventListener('play', () => trackVideoEvent('play'));
    video.addEventListener('pause', () => trackVideoEvent('pause'));
    video.addEventListener('ended', () => trackVideoEvent('complete'));
    ctaButton?.addEventListener('click', () => trackVideoEvent('cta_click'));
});

// Global function for CTA button
function activateNotifications() {
    // Track CTA click
    if (typeof gtag !== 'undefined') {
        gtag('event', 'click', {
            event_category: 'Conversion',
            event_label: 'Video CTA - Activate Notifications'
        });
    }
    
    // Trigger notification request
    if (window.BenzinaOggi?.requestNotificationPermission) {
        window.BenzinaOggi.requestNotificationPermission();
    } else {
        // Fallback: scroll to notification section or show modal
        const notificationSection = document.querySelector('#notification-section');
        if (notificationSection) {
            notificationSection.scrollIntoView({ behavior: 'smooth' });
        } else {
            alert('Attiva le notifiche dalle impostazioni del browser per ricevere avvisi sui prezzi!');
        }
    }
}
</script>
