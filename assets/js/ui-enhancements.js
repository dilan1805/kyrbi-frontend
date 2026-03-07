/**
 * UI Enhancements for Kyrbi - Premium Edition
 * - Scroll Reveal Animations
 * - Header scroll effect
 * - Magnetic & Interactive Components
 * - Microinteractions
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Core State
    document.documentElement.classList.add('reveal-ready');

    // 2. Optimized Header scroll effect
    const header = document.querySelector('.app-header');
    let lastScrollY = window.scrollY;
    
    const handleScroll = () => {
        if (!header) return;
        const currentScrollY = window.scrollY;
        
        if (currentScrollY > 20) {
            header.classList.add('app-header--scrolled');
        } else {
            header.classList.remove('app-header--scrolled');
        }
        
        // Hide/Show header on scroll direction (Premium feel)
        if (currentScrollY > 200) {
            if (currentScrollY > lastScrollY) {
                header.style.transform = 'translateY(-100%)';
            } else {
                header.style.transform = 'translateY(0)';
            }
        }
        
        lastScrollY = currentScrollY;
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    // 3. Interactive Cards - Mouse Follow Effect
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
        card.addEventListener('mousemove', e => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });
    });

    // 4. Magnetic Buttons (Subtle)
    const magneticButtons = document.querySelectorAll('.button--primary');
    magneticButtons.forEach(btn => {
        btn.addEventListener('mousemove', e => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            
            btn.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
        });
        
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'translate(0, 0)';
        });
    });

    // 5. Intersection Observer for Reveal Animations
    const revealElements = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) {
        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                    // Once animated, no need to observe anymore (Performance)
                    revealObserver.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.15,
            rootMargin: '0px 0px -50px 0px'
        });

        revealElements.forEach(el => revealObserver.observe(el));
    } else {
        revealElements.forEach(el => el.classList.add('active'));
    }

    // 6. Year Update
    const yearSpan = document.getElementById('year');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }

    // 7. Nav Link Active State on Scroll
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav__link');

    const scrollActive = () => {
        const scrollY = window.pageYOffset;

        sections.forEach(current => {
            const sectionHeight = current.offsetHeight;
            const sectionTop = current.offsetTop - 150;
            const sectionId = current.getAttribute('id');
            const navLink = document.querySelector(`.nav__link[href*="#${sectionId}"]`);
            
            if (navLink) {
                if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
                    navLink.classList.add('is-active');
                } else {
                    navLink.classList.remove('is-active');
                }
            }
        });
    };
    window.addEventListener('scroll', scrollActive, { passive: true });

    // 8. Mobile Menu Logic (Improved)
    const navToggle = document.querySelector('.nav__toggle');
    const navLinksContainer = document.querySelector('.nav__links');
    
    if (navToggle && navLinksContainer) {
        navToggle.addEventListener('click', () => {
            const isOpen = navLinksContainer.classList.toggle('is-open');
            navToggle.classList.toggle('is-active');
            document.body.classList.toggle('nav-open', isOpen);
            navToggle.setAttribute('aria-expanded', isOpen);
        });

        // Close menu on link click
        navLinksContainer.querySelectorAll('.nav__link').forEach(link => {
            link.addEventListener('click', () => {
                navLinksContainer.classList.remove('is-open');
                navToggle.classList.remove('is-active');
                document.body.classList.remove('nav-open');
                navToggle.setAttribute('aria-expanded', false);
            });
        });
    }
});

