import '../style.css'
import { initDetailsScene } from './details-scene.js'

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
console.log("[DEBUG DETAILS] Initial Load - raw localStorage:", savedTheme);
let initialTheme = null;

if (savedTheme) {
    try {
        initialTheme = JSON.parse(savedTheme);
        // 1. Pre-apply CSS Variables immediately (prevents Flash of Default Color)
        document.documentElement.style.setProperty('--color-primary', initialTheme.color);
        document.documentElement.style.setProperty('--color-bg', initialTheme.bg);
        document.documentElement.style.setProperty('--glass-border', `${initialTheme.color}33`);
    } catch (e) {
        console.error('Error parsing theme', e);
    }
}

// 2. Initialize Scene with Theme Data
initDetailsScene('canvas-container', initialTheme);

function applyTheme(color, bg) {
    // 1. Update CSS Variables
    document.documentElement.style.setProperty('--color-primary', color);
    document.documentElement.style.setProperty('--color-bg', bg);
    document.documentElement.style.setProperty('--glass-border', `${color}33`);

    // 2. Dispatch Event for Three.js
    // We delay slightly to ensure the scene listener is fully ready if it wasn't already
    setTimeout(() => {
        const event = new CustomEvent('theme-change', {
            detail: { color, bg }
        });
        window.dispatchEvent(event);
    }, 100);
}

// Apply saved theme on start
if (savedTheme) {
    try {
        const { color, bg } = JSON.parse(savedTheme);
        applyTheme(color, bg);
    } catch (e) {
        console.error('Error loading theme', e);
    }
}

// Theme Switcher Logic
document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const color = btn.getAttribute('data-color');
        const bg = btn.getAttribute('data-bg');

        // Save preference
        localStorage.setItem('theme', JSON.stringify({ color, bg }));

        applyTheme(color, bg);
    });
});
