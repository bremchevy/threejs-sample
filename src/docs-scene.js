import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export function initDocsScene(containerId, initialTheme) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // --- Configuration ---
    // Fallback: Check localStorage if arg missing
    if (!initialTheme) {
        try {
            const saved = localStorage.getItem('theme');
            if (saved) initialTheme = JSON.parse(saved);
        } catch (e) { }
    }

    // Use saved theme for initial colors if available
    const primaryC = initialTheme ? new THREE.Color(initialTheme.color) : new THREE.Color(0x00ffff);
    const bgC = initialTheme ? new THREE.Color(initialTheme.bg) : new THREE.Color(0x02020a);

    // Calculate secondary/complementary from primary for immediate consistency
    const secondaryC = primaryC.clone().offsetHSL(0.6, 0, -0.2);

    const CONFIG = {
        bgColor: bgC.getHex(),
        coreColor: primaryC.getHex(),
        shellColor: secondaryC.getHex(),
        particleColor: primaryC.clone().offsetHSL(0, 0, 0.2).getHex()
    };

    // --- Scene & Camera ---
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(CONFIG.bgColor, 0.03);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 15);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // --- Post Processing ---
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        1.5, 0.4, 0.85
    );
    bloomPass.threshold = 0.15;
    bloomPass.strength = 0.5; // Reduced bloom for subtle effect
    bloomPass.radius = 0.5;

    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    // --- The Neural Core System ---
    const coreGroup = new THREE.Group();

    function updateLayout() {
        if (window.innerWidth < 768) {
            // Mobile: Center and move up
            coreGroup.position.x = 0;
            coreGroup.position.y = 4.0; /* Sits high up in the padding area */
            coreGroup.scale.set(0.6, 0.6, 0.6);
        } else {
            // Desktop: Side alignment
            coreGroup.position.x = -8; // More to the left (was -5)
            coreGroup.position.y = 0;
            coreGroup.scale.set(0.75, 0.75, 0.75); // Scale down (was 1.0)
        }
    }
    updateLayout();

    scene.add(coreGroup);

    // 1. The Nucleus (Pulsing Sphere)
    const nucleusGeo = new THREE.IcosahedronGeometry(2, 4);

    // Custom shader for the nucleus to make it look active
    const nucleusShader = {
        vertexShader: `
            uniform float uTime;
            varying vec3 vNormal;
            varying vec3 vPosition;

            void main() {
                vNormal = normal;
                vPosition = position;
                
                // Pulse effect
                float pulse = sin(uTime * 1.0) * 0.05 + 1.0;
                vec3 pos = position * pulse;
                
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 uColor;
            uniform float uTime;
            varying vec3 vNormal;
            varying vec3 vPosition;

            void main() {
                // Fresnel glow
                vec3 viewDirection = normalize(cameraPosition - vPosition);
                float fresnel = pow(1.0 - dot(viewDirection, vNormal), 2.0);
                
                // Dynamic surface noise
                float noise = sin(vPosition.x * 10.0 + uTime) * sin(vPosition.y * 10.0 + uTime) * sin(vPosition.z * 10.0 + uTime);
                
                vec3 color = uColor + (uColor * fresnel * 2.0) + (vec3(1.0) * noise * 0.2);
                
                gl_FragColor = vec4(color, 0.8);
            }
        `,
        uniforms: {
            uTime: { value: 0 },
            uColor: { value: new THREE.Color(CONFIG.coreColor) }
        },
        transparent: true,
        // blending: THREE.AdditiveBlending // Optional: makes it very bright
    };

    const nucleusMat = new THREE.ShaderMaterial(nucleusShader);
    const nucleus = new THREE.Mesh(nucleusGeo, nucleusMat);
    coreGroup.add(nucleus);

    // 2. The Data Cage (Wireframe Shell)
    const cageGeo = new THREE.IcosahedronGeometry(3.5, 1);
    const cageMat = new THREE.MeshBasicMaterial({
        color: CONFIG.shellColor,
        wireframe: true,
        transparent: true,
        opacity: 0.3
    });
    const cage = new THREE.Mesh(cageGeo, cageMat);
    coreGroup.add(cage);

    // 3. Floating Data Particles (Surrounding Cloud)
    const particlesGeo = new THREE.BufferGeometry();
    const particleCount = 800;
    const posArray = new Float32Array(particleCount * 3);
    const scaleArray = new Float32Array(particleCount);

    for (let i = 0; i < particleCount * 3; i += 3) {
        // Spherical distribution
        const r = 5 + Math.random() * 10; // Distance from center
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);

        posArray[i] = r * Math.sin(phi) * Math.cos(theta);
        posArray[i + 1] = r * Math.sin(phi) * Math.sin(theta);
        posArray[i + 2] = r * Math.cos(phi);

        scaleArray[i / 3] = Math.random();
    }

    particlesGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    particlesGeo.setAttribute('aScale', new THREE.BufferAttribute(scaleArray, 1));

    const particlesMat = new THREE.PointsMaterial({
        size: 0.05,
        color: CONFIG.particleColor,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending
    });

    const particles = new THREE.Points(particlesGeo, particlesMat);
    coreGroup.add(particles);

    // 4. Orbital Rings (Torus)
    const ringGeo = new THREE.TorusGeometry(6, 0.05, 16, 100);
    const ringMat = new THREE.MeshBasicMaterial({
        color: CONFIG.shellColor,
        transparent: true,
        opacity: 0.4
    });

    const ring1 = new THREE.Mesh(ringGeo, ringMat);
    ring1.rotation.x = Math.PI / 2;
    coreGroup.add(ring1);

    const ring2 = new THREE.Mesh(ringGeo, ringMat);
    ring2.rotation.y = Math.PI / 4;
    coreGroup.add(ring2);

    const ring3 = new THREE.Mesh(ringGeo, ringMat);
    ring3.rotation.y = -Math.PI / 4;
    ring3.scale.set(1.2, 1.2, 1.2);
    coreGroup.add(ring3);

    // --- Interaction (Drag to Rotate) ---
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let rotationVelocity = { x: 0, y: 0 };
    const friction = 0.95;

    // Mouse Events
    // Helper: Check if target is interactive content (text, cards, ui)
    function isContent(target) {
        return target.closest('.card') ||
            target.closest('p') ||
            target.closest('h1') ||
            target.closest('h2') ||
            target.closest('h3') ||
            target.closest('a') ||
            target.closest('button') ||
            target.closest('.nav-links');
    }

    // Mouse Events
    window.addEventListener('mousedown', (e) => {
        // Only drag if NOT clicking content
        if (isContent(e.target)) return;

        isDragging = true;
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const deltaMove = {
            x: e.clientX - previousMousePosition.x,
            y: e.clientY - previousMousePosition.y
        };

        rotationVelocity.x = deltaMove.y * 0.002;
        rotationVelocity.y = deltaMove.x * 0.002;

        coreGroup.rotation.x += rotationVelocity.x;
        coreGroup.rotation.y += rotationVelocity.y;

        previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => isDragging = false);

    // Touch Events
    // Touch Events
    window.addEventListener('touchstart', (e) => {
        if (isContent(e.target)) return;
        isDragging = true;
        previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
        if (!isDragging) return;

        // Allow scrolling to happen naturally. 
        // We do NOT preventDefault() anywhere anymore. 
        // Dragging empty space will Scroll AND Rotate.

        const deltaMove = {
            x: e.touches[0].clientX - previousMousePosition.x,
            y: e.touches[0].clientY - previousMousePosition.y
        };

        rotationVelocity.x = deltaMove.y * 0.003;
        rotationVelocity.y = deltaMove.x * 0.003;

        coreGroup.rotation.x += rotationVelocity.x;
        coreGroup.rotation.y += rotationVelocity.y;

        previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: false });

    window.addEventListener('touchend', () => isDragging = false);

    // --- Animation Loop ---
    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);

        const time = clock.getElapsedTime();
        const delta = clock.getDelta(); // Not effectively used due to getElapsedTime, but good practice

        // Shader Updates
        nucleusMat.uniforms.uTime.value = time;

        if (!isDragging) {
            // Apply inertia
            rotationVelocity.x *= friction;
            rotationVelocity.y *= friction;

            coreGroup.rotation.x += rotationVelocity.x;
            coreGroup.rotation.y += rotationVelocity.y;

            // Default slow spin
            coreGroup.rotation.y += 0.002;
            coreGroup.rotation.z += 0.001;
        }

        // Constant rotation of components
        nucleus.rotation.y += 0.002;
        nucleus.rotation.z += 0.001;

        cage.rotation.x -= 0.001;
        cage.rotation.y -= 0.001;

        ring1.rotation.z += 0.002;
        ring2.rotation.z -= 0.002;
        ring3.rotation.z += 0.001;

        // Particle gentle wave
        particles.rotation.y = time * 0.02;

        // Camera float
        camera.position.y = Math.sin(time * 0.2) * 0.2;

        composer.render();
    }

    animate();

    // --- Resize ---
    window.addEventListener('resize', () => {
        const width = window.innerWidth;
        const height = window.innerHeight;

        camera.aspect = width / height;
        camera.updateProjectionMatrix();

        renderer.setSize(width, height);
        composer.setSize(width, height);
        bloomPass.resolution.set(width, height);

        updateLayout();
    });

    // --- Theme Change Handler ---
    window.addEventListener('theme-change', (e) => {
        const { color, bg } = e.detail;

        const newColor = new THREE.Color(color);
        // Calculate complementary/secondary colors relative to the new primary
        const secondaryColor = newColor.clone().offsetHSL(0.6, 0, -0.2);

        // Update Nucleus
        nucleusMat.uniforms.uColor.value = newColor;

        // Update Cage
        cageMat.color = secondaryColor;

        // Update Rings
        ringMat.color = secondaryColor;

        // Update Particles
        particlesMat.color = newColor.clone().offsetHSL(0, 0, 0.2);

        // Update Fog NOT Background (CSS handles background)
        const newBg = new THREE.Color(bg);
        scene.fog.color = newBg;
    });
}
