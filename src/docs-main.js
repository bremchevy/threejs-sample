import '../style.css'
import { initDocsScene } from './docs-scene.js'

// initDocsScene call moved to after theme loading

// Loader Handler
// Loader Handler - Robust Check
function removeLoader() {
    if (document.body.classList.contains('loaded')) return;

    setTimeout(() => {
        document.body.classList.add('loaded');
        setTimeout(() => {
            const loader = document.getElementById('loader-overlay');
            if (loader) loader.remove();
        }, 800);
    }, 500);
}

if (document.readyState === 'complete') {
    removeLoader();
} else {
    window.addEventListener('load', removeLoader);
}

// Fallback: Force remove loader after 3 seconds if load event hangs
setTimeout(removeLoader, 3000);

// Theme Switcher Logic (Shared with main page)
// Theme Logic
const savedTheme = localStorage.getItem('theme');
console.log("[DEBUG DOCS] Initial Load - raw localStorage:", savedTheme);
let initialTheme = null;

if (savedTheme) {
    try {
        initialTheme = JSON.parse(savedTheme);
        // 1. Pre-apply CSS Variables immediately
        document.documentElement.style.setProperty('--color-primary', initialTheme.color);
        document.documentElement.style.setProperty('--color-bg', initialTheme.bg);
        document.documentElement.style.setProperty('--glass-border', `${initialTheme.color}33`);
    } catch (e) { console.error(e); }
}

initDocsScene('canvas-container', initialTheme);

function applyTheme(color, bg) {
    // 1. Update CSS Variables
    document.documentElement.style.setProperty('--color-primary', color);
    document.documentElement.style.setProperty('--color-bg', bg);
    document.documentElement.style.setProperty('--glass-border', `${color}33`);

    // 2. Dispatch Event for Three.js
    setTimeout(() => {
        const event = new CustomEvent('theme-change', {
            detail: { color, bg }
        });
        window.dispatchEvent(event);
    }, 100);
}

// Theme Switcher Logic (Shared with main page)
document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const color = btn.getAttribute('data-color');
        const bg = btn.getAttribute('data-bg');

        // Save Selection
        console.log("[DEBUG DOCS] Saving Theme:", { color, bg });
        localStorage.setItem('theme', JSON.stringify({ color, bg }));

        applyTheme(color, bg);
    });
});

// --- UI Interaction Logic (Shared) ---

// Wallet Dropdown Logic
const dropdownTrigger = document.querySelector('.btn-connect-trigger');
const dropdownMenu = document.querySelector('.wallet-dropdown');

if (dropdownTrigger && dropdownMenu) {
    // Toggle
    dropdownTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent immediate close
        const isActive = dropdownMenu.classList.contains('active');

        // Close all other dropdowns if any (extensible)
        document.querySelectorAll('.wallet-dropdown').forEach(d => d.classList.remove('active'));

        if (!isActive) {
            dropdownMenu.classList.add('active');
        }
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (!dropdownMenu.contains(e.target) && !dropdownTrigger.contains(e.target)) {
            dropdownMenu.classList.remove('active');
        }
    });
}

// Mobile Menu Toggle
const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
const navItems = document.querySelector('.nav-items');

if (mobileMenuBtn && navItems) {
    mobileMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        mobileMenuBtn.classList.toggle('active');
        navItems.classList.toggle('active');
    });

    // Close menu when clicking a link
    navItems.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            mobileMenuBtn.classList.remove('active');
            navItems.classList.remove('active');
        });
    });

    // Close menu when clicking outside OR on the overlay background
    document.addEventListener('click', (e) => {
        const isOutside = !navItems.contains(e.target) && !mobileMenuBtn.contains(e.target);
        const isOverlayBackground = e.target === navItems; // Clicking the full-screen glass itself

        if (navItems.classList.contains('active') && (isOutside || isOverlayBackground)) {
            mobileMenuBtn.classList.remove('active');
            navItems.classList.remove('active');
        }
    });
}

// Generic Wallet Option Logic
document.querySelectorAll('.wallet-option').forEach(opt => {
    opt.addEventListener('click', () => {
        const walletName = opt.querySelector('span').innerText;
        console.log(`[DEBUG] Connecting to ${walletName}`);
        alert(`Connecting to ${walletName}...`);

        // Close Dropdown
        if (dropdownMenu) dropdownMenu.classList.remove('active');
    });
});
