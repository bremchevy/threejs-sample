import '../style.css'
import { initScene } from './scene.js'

// --- Theme Logic (Read First) ---
// --- Theme Logic (Read First) ---
const savedTheme = localStorage.getItem('theme');
console.log("[DEBUG] Initial Load - raw localStorage:", savedTheme);

// --- Loader Handler (Run First) ---
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

// Immediate check
if (document.readyState === 'complete') {
  removeLoader();
} else {
  window.addEventListener('load', removeLoader);
}
// Safety Fallback (3s)
setTimeout(removeLoader, 3000);

// --- Initialize Scene ---
let initialTheme = null;
if (savedTheme) {
  try {
    initialTheme = JSON.parse(savedTheme);
  } catch (e) { }
}

try {
  // Initialize the 3D Scene
  initScene('canvas-container', initialTheme);
} catch (e) {
  console.error("Critical Scene Error:", e);
  // Force remove loader immediately if scene crashes
  removeLoader();
}

// Theme Logic
// savedTheme already declared at top

function applyTheme(color, bg) {
  // 1. Update CSS Variables
  document.documentElement.style.setProperty('--color-primary', color);
  document.documentElement.style.setProperty('--color-bg', bg);
  document.documentElement.style.setProperty('--glass-border', `${color}33`);

  // 2. Dispatch Event for Three.js
  // Delay slightly to ensure scene is ready or listeners attached
  setTimeout(() => {
    console.log("[DEBUG] Dispatching theme-change event", { color, bg });
    const event = new CustomEvent('theme-change', {
      detail: { color, bg }
    });
    window.dispatchEvent(event);
  }, 500);
}

// Apply Saved Theme
if (savedTheme) {
  try {
    const { color, bg } = JSON.parse(savedTheme);
    applyTheme(color, bg);
  } catch (e) { console.error(e); }
}

// Theme Switcher Logic
document.querySelectorAll('.theme-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const color = btn.getAttribute('data-color');
    const bg = btn.getAttribute('data-bg');

    // Save Selection
    console.log("[DEBUG] Saving Theme:", { color, bg });
    localStorage.setItem('theme', JSON.stringify({ color, bg }));

    applyTheme(color, bg);
  });
});

// --- Wallet Dropdown Logic ---
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

// --- Initialize Button (Hero) Logic ---
const initBtn = document.getElementById('btn-initialize');
const modal = document.getElementById('wallet-modal');
const closeModalBtn = document.querySelector('.close-modal');

if (initBtn && modal) {
  initBtn.addEventListener('click', (e) => {
    e.preventDefault();
    modal.classList.add('active');
  });

  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      modal.classList.remove('active');
    });
  }

  // Click Outside Modal
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  });
}

// --- Generic Wallet Option Logic (Handles both Dropdown & Modal items) ---
document.querySelectorAll('.wallet-option').forEach(opt => {
  opt.addEventListener('click', () => {
    const walletName = opt.querySelector('span').innerText;
    console.log(`[DEBUG] Connecting to ${walletName}`);
    alert(`Connecting to ${walletName}...`);

    // Close Dropdown
    if (dropdownMenu) dropdownMenu.classList.remove('active');
    // Close Modal
    if (modal) modal.classList.remove('active');
  });
});

// --- Mobile Menu Toggle ---
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

