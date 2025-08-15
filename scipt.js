// Tailwind CSS Configuration
tailwind.config = {
    // Dark mode disabled for now
    // darkMode: 'class',
    theme: {
        extend: {
            colors: {
                primary: {
                    50: '#fef7f0',
                    100: '#fdeee0',
                    200: '#fad9c1',
                    300: '#f6be97',
                    400: '#f19a6b',
                    500: '#ed7c47',
                    600: '#de5f2a',
                    700: '#b84820',
                    800: '#933a1f',
                    900: '#76321e',
                    950: '#40170d',
                },
                secondary: {
                    50: '#f8fafc',
                    100: '#f1f5f9',
                    200: '#e2e8f0',
                    300: '#cbd5e1',
                    400: '#94a3b8',
                    500: '#64748b',
                    600: '#475569',
                    700: '#334155',
                    800: '#1e293b',
                    900: '#0f172a',
                    950: '#020617',
                },
                accent: {
                    50: '#fef2f2',
                    100: '#fee2e2',
                    200: '#fecaca',
                    300: '#fca5a5',
                    400: '#f87171',
                    500: '#ef4444',
                    600: '#dc2626',
                    700: '#b91c1c',
                    800: '#991b1b',
                    900: '#7f1d1d',
                    950: '#450a0a',
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
                heading: ['Rajdhani', 'Inter', 'system-ui', 'sans-serif'],
            },
            animation: {
                'fade-in': 'fadeIn 0.6s ease-out',
                'slide-up': 'slideUp 0.6s ease-out',
                'scale-in': 'scaleIn 0.5s ease-out',
                'float': 'float 3s ease-in-out infinite',
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0', transform: 'translateY(20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(30px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                scaleIn: {
                    '0%': { opacity: '0', transform: 'scale(0.9)' },
                    '100%': { opacity: '1', transform: 'scale(1)' },
                },
                float: {
                    '0%, 100%': { transform: 'translateY(0px)' },
                    '50%': { transform: 'translateY(-10px)' },
                },
            },
        },
    },
    variants: {
        extend: {
            opacity: ['disabled'],
            cursor: ['disabled'],
            backgroundColor: ['active', 'disabled'],
            textColor: ['active', 'disabled'],
        },
    },
}

// Enhanced Image Loading with Error Handling
document.addEventListener('DOMContentLoaded', () => {
    // Force light theme
    try { document.documentElement.classList.remove('dark'); localStorage.removeItem('sv-theme'); } catch {}
    // Intersection Observer for lazy loading
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset.src) {
                    const tempImage = new Image();
                    tempImage.onload = () => {
                        img.src = img.dataset.src;
                        img.classList.remove('opacity-0');
                        img.classList.add('opacity-100');
                    };
                    tempImage.onerror = () => {
                        handleImageError(img);
                    };
                    tempImage.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    observer.unobserve(img);
                }
            }
        });
    }, {
        rootMargin: '50px 0px',
        threshold: 0.01
    });

    // Handle image errors
    const handleImageError = (img) => {
        const width = img.getAttribute('width') || img.clientWidth || 300;
        const height = img.getAttribute('height') || img.clientHeight || 200;
        img.src = `https://placehold.co/${width}x${height}/DEDEDE/555555?text=Image+Unavailable`;
        img.alt = 'Image unavailable';
        img.classList.remove('opacity-0');
        img.classList.add('opacity-100', 'error-image');
    };

    // Initialize image loading
    const loadImage = (img) => {
        if ('loading' in HTMLImageElement.prototype) {
            img.loading = 'lazy';
        }
        
        img.classList.add('transition-opacity', 'duration-500', 'opacity-0');
        
        img.onerror = () => handleImageError(img);

        if (img.dataset.src) {
            imageObserver.observe(img);
        } else {
            img.classList.remove('opacity-0');
            img.classList.add('opacity-100');
        }
    };

    // Load existing images
    document.querySelectorAll('img[data-src], img:not([data-src])').forEach(loadImage);

    // Watch for dynamically added images
    new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) {
                    if (node.tagName === 'IMG') {
                        loadImage(node);
                    }
                    node.querySelectorAll && node.querySelectorAll('img').forEach(loadImage);
                }
            });
        });
    }).observe(document.body, {
        childList: true,
        subtree: true
    });

    // Reveal-on-scroll for professional touch
    const ro = new IntersectionObserver((entries) => {
        entries.forEach(e => {
            if (e.isIntersecting) e.target.classList.add('is-visible');
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.reveal-on').forEach(el => ro.observe(el));

    // Elevate nav on scroll
    const nav = document.querySelector('nav');
    let scrolled = false;
    window.addEventListener('scroll', () => {
        const y = window.scrollY || window.pageYOffset;
        if (!nav) return;
        if (y > 6 && !scrolled) { nav.classList.add('nav-scrolled'); scrolled = true; }
        else if (y <= 6 && scrolled) { nav.classList.remove('nav-scrolled'); scrolled = false; }
    }, { passive: true });
});

// Enhanced Performance Monitoring
if ('performance' in window && 'PerformanceObserver' in window) {
    const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
            if (entry.entryType === 'largest-contentful-paint') {
                console.log(`LCP: ${entry.startTime.toFixed(2)}ms`);
            }
            if (entry.entryType === 'first-input') {
                console.log(`FID: ${(entry.processingStart - entry.startTime).toFixed(2)}ms`);
            }
            if (entry.entryType === 'layout-shift') {
                if (entry.value > 0.1) {
                    console.warn(`CLS: ${entry.value.toFixed(4)} (above threshold)`);
                }
            }
        });
    });

    try {
        observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });
    } catch (e) {
        console.log('Performance observer not fully supported');
    }

    // Basic performance metrics on load
    window.addEventListener('load', () => {
        setTimeout(() => {
            const timing = performance.getEntriesByType('navigation')[0];
            if (timing) {
                console.log('Performance Metrics:', {
                    'DNS Lookup': `${(timing.domainLookupEnd - timing.domainLookupStart).toFixed(2)}ms`,
                    'TCP Connection': `${(timing.connectEnd - timing.connectStart).toFixed(2)}ms`,
                    'DOM Content Loaded': `${(timing.domContentLoadedEventEnd - timing.navigationStart).toFixed(2)}ms`,
                    'Page Load': `${(timing.loadEventEnd - timing.navigationStart).toFixed(2)}ms`
                });
            }
        }, 1000);
    });
}

// Network Status Handling
window.addEventListener('online', () => {
    document.body.classList.remove('offline');
    showNotification('Connection restored', 'success');
});

window.addEventListener('offline', () => {
    document.body.classList.add('offline');
    showNotification('Connection lost - Some features may be limited', 'warning');
});

// Notification System
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transform translate-x-full transition-transform duration-300 ${
        type === 'success' ? 'bg-green-500 text-white' :
        type === 'warning' ? 'bg-yellow-500 text-white' :
        type === 'error' ? 'bg-red-500 text-white' :
        'bg-blue-500 text-white'
    }`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Slide in
    setTimeout(() => {
        notification.classList.remove('translate-x-full');
    }, 100);
    
    // Slide out and remove
    setTimeout(() => {
        notification.classList.add('translate-x-full');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Enhanced Navigation
document.addEventListener('DOMContentLoaded', () => {
    const menuBtn = document.getElementById('menuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    const sosBtn = document.getElementById('sosBtn');

    // Mobile menu toggle
    if (menuBtn && mobileMenu) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            mobileMenu.classList.toggle('hidden');
            
            // Update menu icon
            const icon = menuBtn.querySelector('i');
            if (mobileMenu.classList.contains('hidden')) {
                icon.setAttribute('data-lucide', 'menu');
            } else {
                icon.setAttribute('data-lucide', 'x');
            }
            lucide.createIcons();
        });

        // Close mobile menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!menuBtn.contains(e.target) && !mobileMenu.contains(e.target)) {
                mobileMenu.classList.add('hidden');
                const icon = menuBtn.querySelector('i');
                icon.setAttribute('data-lucide', 'menu');
                lucide.createIcons();
            }
        });
    }

    // Enhanced SOS button
    if (sosBtn) {
        sosBtn.addEventListener('click', () => {
            sosBtn.classList.add('animate__headShake');
            sosBtn.style.transform = 'scale(0.95)';
            setTimeout(() => {
                sosBtn.classList.remove('animate__headShake');
                sosBtn.style.transform = 'scale(1)';
                showEmergencyModal();
            }, 350);
        });
        // Also trigger SOS send for the new module if present
        window.addEventListener('safevoice:sos', () => {
            try { window.SafeVoiceSendSOS && window.SafeVoiceSendSOS(); } catch {}
        });
    }

    // Authentication handling
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const mobileLoginBtn = document.getElementById('mobileLoginBtn');
    const mobileSignupBtn = document.getElementById('mobileSignupBtn');

    let isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';

    function updateAuthUI() {
        const buttons = [loginBtn, signupBtn, mobileLoginBtn, mobileSignupBtn];
        const logoutButtons = [logoutBtn];

        if (isLoggedIn) {
            buttons.forEach(btn => btn && btn.classList.add('hidden'));
            logoutButtons.forEach(btn => btn && btn.classList.remove('hidden'));
        } else {
            buttons.forEach(btn => btn && btn.classList.remove('hidden'));
            logoutButtons.forEach(btn => btn && btn.classList.add('hidden'));
        }
    }

    // Login button handlers
    [loginBtn, mobileLoginBtn].forEach(btn => {
        if (btn) {
            btn.addEventListener('click', () => {
                window.location.href = 'login.html';
            });
        }
    });

    // Signup button handlers
    [signupBtn, mobileSignupBtn].forEach(btn => {
        if (btn) {
            btn.addEventListener('click', () => {
                window.location.href = 'signup.html';
            });
        }
    });

    // Logout button handler
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            isLoggedIn = false;
            localStorage.setItem('isLoggedIn', 'false');
            updateAuthUI();
            showNotification('Logged out successfully', 'success');
        });
    }

    updateAuthUI();
});

// Emergency Modal
function showEmergencyModal() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl p-8 max-w-md mx-4 animate__animated animate__zoomIn">
            <div class="text-center">
                <div class="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <i data-lucide="phone-call" class="w-10 h-10 text-white"></i>
                </div>
                <h2 class="text-2xl font-bold text-gray-800 mb-4">Emergency Services</h2>
                <p class="text-gray-600 mb-6">Are you experiencing an emergency that requires immediate assistance?</p>
                <div class="space-y-3">
                    <button id="notifySafeVoiceBtn" class="w-full px-6 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors">
                        🔔 Notify SafeVoice Community
                    </button>
                    <button onclick="callEmergency('911')" class="w-full px-6 py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors">
                        🚨 Call 911 (Emergency)
                    </button>
                    <button onclick="callEmergency('poison')" class="w-full px-6 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors">
                        ☠️ Poison Control
                    </button>
                    <button onclick="callEmergency('mental')" class="w-full px-6 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors">
                        🧠 Mental Health Crisis
                    </button>
                    <button onclick="closeEmergencyModal()" class="w-full px-6 py-3 bg-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-400 transition-colors">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    lucide.createIcons();
    
    // Bridge to new SOS system via a custom event
    const notifyBtn = modal.querySelector('#notifySafeVoiceBtn');
    if (notifyBtn) {
        notifyBtn.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('safevoice:sos'));
            closeEmergencyModal();
        });
    }
    
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeEmergencyModal();
        }
    });
}

function callEmergency(type) {
    const numbers = {
        '911': 'tel:911',
        'poison': 'tel:1-800-222-1222',
        'mental': 'tel:988'
    };
    
    if (numbers[type]) {
        window.location.href = numbers[type];
    }
    closeEmergencyModal();
}

function closeEmergencyModal() {
    const modal = document.querySelector('.fixed.inset-0.z-50');
    if (modal) {
        modal.remove();
    }
}

// Testimonial Slider
document.addEventListener('DOMContentLoaded', () => {
    const slides = document.querySelectorAll('.testimonial-slide');
    const dots = document.querySelectorAll('.slider-dot');
    let currentSlide = 0;

    if (slides.length > 0 && dots.length > 0) {
        function showSlide(index) {
            slides.forEach((slide, i) => {
                slide.classList.toggle('hidden', i !== index);
            });
            
            dots.forEach((dot, i) => {
                dot.classList.toggle('bg-orange-500', i === index);
                dot.classList.toggle('bg-gray-300', i !== index);
            });
        }

        // Auto rotate slides
        const slideInterval = setInterval(() => {
            currentSlide = (currentSlide + 1) % slides.length;
            showSlide(currentSlide);
        }, 5000);

        // Click handlers for dots
        dots.forEach((dot, index) => {
            dot.addEventListener('click', () => {
                currentSlide = index;
                showSlide(currentSlide);
                
                // Reset interval
                clearInterval(slideInterval);
                setTimeout(() => {
                    setInterval(() => {
                        currentSlide = (currentSlide + 1) % slides.length;
                        showSlide(currentSlide);
                    }, 5000);
                }, 5000);
            });
        });

        // Initialize first slide
        showSlide(0);
    }
});

// Smooth Scrolling for Anchor Links
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const headerOffset = 80;
                const elementPosition = target.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
});

// Scroll-based animations
const observeElements = () => {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate__animated', 'animate__fadeInUp');
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    // Observe service cards and other elements
    document.querySelectorAll('.group, .bg-white').forEach(el => {
        observer.observe(el);
    });
};

// Initialize scroll animations after DOM is loaded
document.addEventListener('DOMContentLoaded', observeElements);

// Form Validation Utilities
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePhone(phone) {
    const re = /^[\+]?[1-9][\d]{0,15}$/;
    return re.test(phone.replace(/\s/g, ''));
}

// Contact Form Handler
document.addEventListener('DOMContentLoaded', () => {
    const contactForm = document.querySelector('#contact form');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
            const submitBtn = this.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            
            // Validate form
            const name = formData.get('name') || this.querySelector('#name')?.value;
            const email = formData.get('email') || this.querySelector('#email')?.value;
            const message = formData.get('message') || this.querySelector('#message')?.value;
            
            if (!name || !email || !message) {
                showNotification('Please fill in all fields', 'error');
                return;
            }
            
            if (!validateEmail(email)) {
                showNotification('Please enter a valid email address', 'error');
                return;
            }
            
            // Simulate form submission
            submitBtn.textContent = 'Sending...';
            submitBtn.disabled = true;
            
            setTimeout(() => {
                showNotification('Message sent successfully! We\'ll get back to you soon.', 'success');
                this.reset();
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }, 2000);
        });
    }
});

// Service Worker Registration (for PWA capabilities)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

console.log('SafeVoice - Enhanced JavaScript loaded successfully ✅');