import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export function initScene(containerId, initialTheme) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // --- Configuration ---
    // Fallback: Check localStorage directly if initialTheme is missing or empty
    if (!initialTheme) {
        try {
            const saved = localStorage.getItem('theme');
            if (saved) initialTheme = JSON.parse(saved);
        } catch (e) {
            console.warn('Scene: could not parse local theme', e);
        }
    }

    // Use saved theme for initial colors if available
    const primaryC = initialTheme ? new THREE.Color(initialTheme.color) : new THREE.Color(0x00ffff);
    const bgC = initialTheme ? new THREE.Color(initialTheme.bg) : new THREE.Color(0x050505);

    const CONFIG = {
        bloomStrength: 1.5,
        bloomRadius: 0.4,
        bloomThreshold: 0.1,
        coreColor: primaryC,
        bgColor: bgC
    };

    // --- Scene & Camera ---
    const scene = new THREE.Scene();
    scene.background = CONFIG.bgColor;
    scene.fog = new THREE.FogExp2(CONFIG.bgColor, 0.03);

    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(2, 0, 14);

    const renderer = new THREE.WebGLRenderer({
        antialias: false,
        powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    // --- 1. Central Energy Core (Wireframe Only) ---
    const coreGeo = new THREE.IcosahedronGeometry(1.5, 4);
    const coreMat = new THREE.MeshBasicMaterial({
        color: CONFIG.coreColor,
        wireframe: true,
        transparent: true,
        opacity: 0.5
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    scene.add(core);

    // --- 2. Particle System ---
    const particlesCount = 4000;
    const posArray = new Float32Array(particlesCount * 3);
    const randomArray = new Float32Array(particlesCount);

    for (let i = 0; i < particlesCount; i++) {
        // Wider distribution to cover left side (camera acts at x=-6)
        const r = 1 + Math.random() * 25;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);

        posArray[i * 3] = r * Math.sin(phi) * Math.cos(theta) - 5;
        posArray[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        posArray[i * 3 + 2] = r * Math.cos(phi);

        randomArray[i] = Math.random();
    }

    const particlesGeo = new THREE.BufferGeometry();
    particlesGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    particlesGeo.setAttribute('aRandom', new THREE.BufferAttribute(randomArray, 1));

    const particlesMat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uColor: { value: new THREE.Color(CONFIG.coreColor) }
        },
        vertexShader: `
            uniform float uTime;
            attribute float aRandom;
            varying float vAlpha;
            
            void main() {
                vec3 pos = position;
                float angle = uTime * (0.05 + aRandom * 0.05);
                float s = sin(angle);
                float c = cos(angle);
                
                float x = pos.x * c - pos.z * s;
                float z = pos.x * s + pos.z * c;
                pos.x = x;
                pos.z = z;

                pos.y += sin(uTime + aRandom * 5.0) * 0.2;

                vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                gl_Position = projectionMatrix * mvPosition;
                
                gl_PointSize = (4.0 * aRandom + 1.0) * (20.0 / -mvPosition.z);
                vAlpha = 0.8;
            }
        `,
        fragmentShader: `
            uniform vec3 uColor;
            varying float vAlpha;
            
            void main() {
                float r = distance(gl_PointCoord, vec2(0.5));
                if (r > 0.5) discard;
                float strength = 1.0 - (r * 2.0);
                strength = pow(strength, 2.0);
                gl_FragColor = vec4(uColor, strength * vAlpha);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const particles = new THREE.Points(particlesGeo, particlesMat);
    scene.add(particles);

    // --- 3. Post-Processing ---
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        1.5, 0.4, 0.85
    );
    bloomPass.threshold = CONFIG.bloomThreshold;
    bloomPass.strength = CONFIG.bloomStrength;
    bloomPass.radius = CONFIG.bloomRadius;

    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    // --- 4. Mouse Parallax & Interaction ---
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const windowHalfX = window.innerWidth / 2;
    const windowHalfY = window.innerHeight / 2;

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let isHovered = false;
    let isExploded = false;

    // Explosion System
    let explosionParticles;
    let explosionGeo;
    let explosionMat;
    const explosionVelocities = [];

    function respawnCore() {
        isExploded = false;
        core.visible = true;
        core.scale.set(0.001, 0.001, 0.001); // Start small
        isHovered = false;

        if (explosionParticles) {
            scene.remove(explosionParticles);
            explosionParticles = null;
            explosionVelocities.length = 0;
        }
    }

    function triggerExplosion() {
        isExploded = true;
        core.visible = false;
        document.body.style.cursor = 'default';

        const particleCount = 2000;
        const posArray = new Float32Array(particleCount * 3);
        const randomArray = new Float32Array(particleCount);

        for (let i = 0; i < particleCount; i++) {
            // Start from center with small spread
            const r = 1.5 * Math.random();
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);

            const x = r * Math.sin(phi) * Math.cos(theta);
            const y = r * Math.sin(phi) * Math.sin(theta);
            const z = r * Math.cos(phi);

            posArray[i * 3] = x;
            posArray[i * 3 + 1] = y;
            posArray[i * 3 + 2] = z;

            randomArray[i] = Math.random();

            // Explosion velocity outward
            const force = 0.05 + Math.random() * 0.1;
            explosionVelocities.push({
                x: x * force,
                y: y * force,
                z: z * force
            });
        }

        explosionGeo = new THREE.BufferGeometry();
        explosionGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        explosionGeo.setAttribute('aRandom', new THREE.BufferAttribute(randomArray, 1));

        explosionMat = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uColor: { value: new THREE.Color(CONFIG.coreColor) },
                uOpacity: { value: 1.0 }
            },
            vertexShader: `
                uniform float uTime;
                attribute float aRandom;
                varying float vAlpha;
                void main() {
                    vec3 pos = position;
                    float angle = uTime * (0.05 + aRandom * 0.05);
                    float s = sin(angle);
                    float c = cos(angle);
                    
                    float x = pos.x * c - pos.z * s;
                    float z = pos.x * s + pos.z * c;
                    pos.x = x;
                    pos.z = z;
                    pos.y += sin(uTime + aRandom * 5.0) * 0.2;

                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                    
                    gl_PointSize = (3.0 * aRandom + 1.0) * (20.0 / -mvPosition.z);
                    vAlpha = 0.8;
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                uniform float uOpacity;
                varying float vAlpha;
                void main() {
                    float r = distance(gl_PointCoord, vec2(0.5));
                    if (r > 0.5) discard;
                    float strength = 1.0 - (r * 2.0);
                    strength = pow(strength, 2.0);
                    gl_FragColor = vec4(uColor, strength * vAlpha * uOpacity);
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        explosionParticles = new THREE.Points(explosionGeo, explosionMat);
        scene.add(explosionParticles);

        setTimeout(respawnCore, 4000);
    }



    document.addEventListener('mousemove', (event) => {
        onInputMove(event.clientX, event.clientY);

        // Raycaster pointer update
        pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        pointer.y = - (event.clientY / window.innerHeight) * 2 + 1;
    });

    document.addEventListener('click', () => {
        if (!isExploded && isHovered) {
            triggerExplosion();
        }
    });

    document.addEventListener('touchmove', (event) => {
        if (event.touches.length > 0) {
            onInputMove(event.touches[0].clientX, event.touches[0].clientY);
        }
    }, { passive: false });

    // --- Layout Management ---
    const desktopCameraPos = new THREE.Vector3(2, 0, 14);
    const desktopLookAt = new THREE.Vector3(-6, 0, 0);

    // Mobile: Look at the Core but higher up, from further back
    const mobileCameraPos = new THREE.Vector3(0, 3, 18); // Camera higher up
    const mobileLookAt = new THREE.Vector3(0, 2, 0); // Look at higher point

    let currentLookAt = new THREE.Vector3();
    let targetCameraPos = new THREE.Vector3();

    function updateLayout() {
        if (window.innerWidth < 768) {
            // Mobile
            currentLookAt.copy(mobileLookAt);
            targetCameraPos.copy(mobileCameraPos);
        } else {
            // Desktop
            currentLookAt.copy(desktopLookAt);
            targetCameraPos.copy(desktopCameraPos);
        }
    }

    // Initial call
    updateLayout();
    // Set camera immediately to avoid jump
    camera.position.copy(targetCameraPos);

    // --- Animation Loop ---
    const clock = new THREE.Clock();

    // Physics variables for interaction
    let targetRotationX = 0;
    let targetRotationY = 0;

    // Previous mouse positions for velocity calculation
    let lastMouseX = 0;
    let lastMouseY = 0;
    let velX = 0;
    let velY = 0;

    function onInputMove(x, y) {
        // Calculate velocity based on movement
        const deltaX = (x - lastMouseX) * 0.001;
        const deltaY = (y - lastMouseY) * 0.001;

        velX += deltaX;
        velY += deltaY;

        lastMouseX = x;
        lastMouseY = y;

        // Keep parallax
        mouseX = (x - windowHalfX) * 0.001;
        mouseY = (y - windowHalfY) * 0.001;
    }

    function animate() {
        requestAnimationFrame(animate);

        const time = clock.getElapsedTime();

        // Smooth Camera Transition between Layouts
        camera.position.lerp(targetCameraPos, 0.05);

        // Simple Smooth Parallax applied on top of base position
        const parallaxX = mouseX * 2;
        const parallaxY = mouseY * 2;

        // Calculate final position with parallax
        // We add parallax to the *current interpolated* position frame-by-frame
        // Note: Simple addition here might drift if not careful, 
        // but given the lerp above handles the base, we just add offset purely for lookAt calculation or modify position slightly?
        // Better: Apply parallax as offset to the targetCameraPos equivalent

        camera.position.x += (parallaxX - (camera.position.x - targetCameraPos.x)) * 0.05;
        camera.position.y += (-parallaxY - (camera.position.y - targetCameraPos.y)) * 0.05;

        // Look At Target
        camera.lookAt(currentLookAt);

        // Object Animations
        particlesMat.uniforms.uTime.value = time;

        if (!isExploded) {
            // Standard Core Logic
            core.rotation.y += velX + 0.005;
            core.rotation.x += velY + 0.005;

            // Raycast / Hover Logic
            raycaster.setFromCamera(pointer, camera);
            const intersects = raycaster.intersectObject(core);

            if (intersects.length > 0) {
                isHovered = true;
                if (core.visible) document.body.style.cursor = 'pointer';
                const targetScale = 1.3;
                core.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
            } else {
                isHovered = false;
                if (core.visible) document.body.style.cursor = 'default';
                core.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
            }
        } else {
            // Explosion Animation
            if (explosionParticles) {
                const positions = explosionParticles.geometry.attributes.position.array;
                for (let i = 0; i < explosionVelocities.length; i++) {
                    positions[i * 3] += explosionVelocities[i].x;
                    positions[i * 3 + 1] += explosionVelocities[i].y;
                    positions[i * 3 + 2] += explosionVelocities[i].z;

                    // Slow down expansion
                    explosionVelocities[i].x *= 0.98;
                    explosionVelocities[i].y *= 0.98;
                    explosionVelocities[i].z *= 0.98;
                }
                explosionParticles.geometry.attributes.position.needsUpdate = true;

                // Update Shader Uniforms
                explosionMat.uniforms.uTime.value += 0.05;
                explosionMat.uniforms.uOpacity.value *= 0.99;

                // Remove if invisible
                if (explosionMat.uniforms.uOpacity.value < 0.01) {
                    scene.remove(explosionParticles);
                    explosionParticles = null;
                }
            }
        }

        // Damping (inertia)
        velX *= 0.95;
        velY *= 0.95;

        // Scroll interaction - Fade out core
        const scrollY = window.scrollY;
        const maxScroll = window.innerHeight * 0.5; // Fade out by half screen
        const opacity = Math.max(0, 1 - (scrollY / maxScroll));

        coreMat.opacity = opacity * 0.5; // 0.5 is the base opacity

        if (!isExploded) {
            core.visible = opacity > 0.01;
        }

        composer.render();
    }

    animate();

    // --- Resize Handler ---
    window.addEventListener('resize', () => {
        const width = window.innerWidth;
        const height = window.innerHeight;

        camera.aspect = width / height;
        camera.updateProjectionMatrix();

        renderer.setSize(width, height);
        composer.setSize(width, height);

        updateLayout(); // Trigger layout update
    });

    // --- Theme Change Handler ---
    window.addEventListener('theme-change', (e) => {
        const { color, bg } = e.detail;

        // Update Config
        CONFIG.coreColor = new THREE.Color(color);
        CONFIG.bgColor = new THREE.Color(bg);

        // Update Materials
        if (coreMat) coreMat.color = CONFIG.coreColor;
        if (particlesMat) particlesMat.uniforms.uColor.value = CONFIG.coreColor;
        if (explosionMat) explosionMat.uniforms.uColor.value = CONFIG.coreColor;

        // Update Fog & BG
        scene.background = CONFIG.bgColor;
        scene.fog.color = CONFIG.bgColor;
    });
}
