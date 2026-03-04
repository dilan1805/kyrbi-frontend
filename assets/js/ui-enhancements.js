/**
 * UI Enhancements for Kyrbi
 * - Scroll Reveal Animations
 * - Header scroll effect
 * - Microinteractions
 */

document.addEventListener('DOMContentLoaded', () => {
    document.documentElement.classList.add('reveal-ready');

    // 1. Header scroll effect
    const header = document.querySelector('.app-header');
    const handleScroll = () => {
        if (!header) return;
        if (window.scrollY > 20) {
            header.classList.add('app-header--scrolled');
        } else {
            header.classList.remove('app-header--scrolled');
        }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check

    // 2. Footer Year Update
    const yearSpan = document.getElementById('year');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }

    // 3. Intersection Observer for Reveal Animations
    const revealElements = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) {
        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });

        revealElements.forEach(el => revealObserver.observe(el));
    } else {
        revealElements.forEach(el => el.classList.add('active'));
    }

    // 3. Nav Link active state on scroll (optional improvement)
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav__link');

    const scrollActive = () => {
        const scrollY = window.pageYOffset;

        sections.forEach(current => {
            const sectionHeight = current.offsetHeight;
            const sectionTop = current.offsetTop - 100;
            const sectionId = current.getAttribute('id');
            const navLink = document.querySelector('.nav__link[href*=' + sectionId + ']');
            if (!navLink) return;

            if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
                navLink.classList.add('is-active');
            } else {
                navLink.classList.remove('is-active');
            }
        });
    };
    window.addEventListener('scroll', scrollActive);

    // 4. Smooth scroll for internal links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (!href || href === '#') return;
            const target = document.querySelector(href);
            if (!target) return;
            e.preventDefault();
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
});
