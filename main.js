import './style.css'
import { initScene } from './src/scene.js'

initScene('canvas-container');

// Theme Switcher Logic
document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const color = btn.getAttribute('data-color');
        const bg = btn.getAttribute('data-bg');

        // 1. Update CSS Variables
        document.documentElement.style.setProperty('--color-primary', color);
        document.documentElement.style.setProperty('--color-bg', bg);

        // Update accent color for variety if needed, or keep it synced
        document.documentElement.style.setProperty('--glass-border', `${color}33`); // 20% opacity approx

        // 2. Dispatch Event for Three.js
        const event = new CustomEvent('theme-change', {
            detail: { color, bg }
        });
        window.dispatchEvent(event);
    });
});
