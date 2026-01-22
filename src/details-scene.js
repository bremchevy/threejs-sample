import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

export function initDetailsScene(containerId, initialTheme) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // --- Configuration ---
    // Fallback
    if (!initialTheme) {
        try {
            const saved = localStorage.getItem('theme');
            if (saved) initialTheme = JSON.parse(saved);
        } catch (e) { }
    }

    // Use saved theme for initial colors if available
    const primaryC = initialTheme ? new THREE.Color(initialTheme.color) : new THREE.Color(0x00ffff);
    const bgC = initialTheme ? new THREE.Color(initialTheme.bg) : new THREE.Color(0x02020a);

    const CONFIG = {
        bgColor: bgC.getHex(),
        particleColor: primaryC.clone().offsetHSL(0, 0, 0.2).getHex(),
        nodeColor: primaryC.getHex(),
        hoverColor: 0xff0055
    };

    // --- Scene & Camera ---
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(CONFIG.bgColor, 0.02);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 20);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // --- Post Processing ---
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        1.5, 0.4, 0.85
    );
    bloomPass.threshold = 0.8; // Only very bright things glow
    bloomPass.strength = 0.3;  // Much cleaner, subtle glow
    bloomPass.radius = 0.2;    // Tighter glow

    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    // --- Background Particles (Starfield) ---
    const particlesGeo = new THREE.BufferGeometry();
    const particleCount = 2000;
    const posArray = new Float32Array(particleCount * 3);
    const scaleArray = new Float32Array(particleCount);

    for (let i = 0; i < particleCount * 3; i += 3) {
        posArray[i] = (Math.random() - 0.5) * 80; // Spread out more
        posArray[i + 1] = (Math.random() - 0.5) * 60;
        posArray[i + 2] = (Math.random() - 0.5) * 60;
        scaleArray[i / 3] = Math.random();
    }

    particlesGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    particlesGeo.setAttribute('aScale', new THREE.BufferAttribute(scaleArray, 1));

    const particlesMat = new THREE.PointsMaterial({
        size: 0.15,
        color: CONFIG.particleColor,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending
    });

    const starField = new THREE.Points(particlesGeo, particlesMat);
    scene.add(starField);

    // --- Floating Document Nodes ---
    const nodesGroup = new THREE.Group();
    scene.add(nodesGroup);

    // Raycaster
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const sections = Array.from(document.querySelectorAll('.detail-section'));
    sections.forEach(sec => sec.style.display = 'none');

    const interactables = []; // Objects to raycast against
    const nodes = []; // The groups themselves

    // Helper to create text texture
    function createLabel(text) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 1024; // Higher resolution
        canvas.height = 256;

        // Background Pill - Darker and more opaque
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        const r = 40;
        // Make the pill tighter around the text if we shrink font
        // Using mostly full canvas width for high res, but sprite scale will shrink it
        const x = 20, y = 40, w = canvas.width - 40, h = canvas.height - 80;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, r);
        ctx.fill();

        // Border - Thinner
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2; // Thinner border
        ctx.stroke();

        // Text
        ctx.font = '700 55px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // No stroke on text, just clean white
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0)';
        ctx.shadowBlur = 0;

        // Constrain text to fit inside the 1024px canvas with padding
        // This ensures the textbox appears "same for everyone" (uniform container)
        // while prevents text from bursting out.
        const maxWidth = canvas.width - 120;
        ctx.fillText(text.toUpperCase(), canvas.width / 2, canvas.height / 2, maxWidth);

        const texture = new THREE.CanvasTexture(canvas);
        // Anisotropy for sharper angled viewing
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

        // Material - Use tone mapping if possible, or just lower opacity to avoid blowout
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 0.9,
            blending: THREE.NormalBlending // Normal blending avoids additive burnout
        });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(7, 1.75, 1); // Significantly smaller world scale (was 12, 3)
        return sprite;
    }

    // Geometry for the data crystals
    const crystalGeo = new THREE.IcosahedronGeometry(1.0, 0); // Slightly bigger crystal
    const crystalMat = new THREE.MeshBasicMaterial({
        color: CONFIG.nodeColor,
        wireframe: true,
        transparent: true,
        opacity: 0.5
    });
    const crystalCoreGeo = new THREE.IcosahedronGeometry(0.4, 0);
    const crystalCoreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    sections.forEach((section, index) => {
        const title = section.querySelector('h2').innerText;

        // Group container
        const group = new THREE.Group();

        // 1. The Crystal
        const crystal = new THREE.Mesh(crystalGeo, crystalMat.clone());
        const core = new THREE.Mesh(crystalCoreGeo, crystalCoreMat);
        crystal.add(core);
        group.add(crystal);

        // 2. The Label - Use current theme color
        const themeColorHex = '#' + new THREE.Color(CONFIG.nodeColor).getHexString();
        // We reuse the createLabelTheme logic but defined below.
        // NOTE: createLabel was the old function. verify if createLabelTheme is hoisting or available.
        // It is defined at bottom of scope in previous turns.
        // Better to just call createLabelTheme.
        const sprite = createLabelTheme(title, themeColorHex);
        // Label sits lower or higher? Let's put it next to it or slightly above
        sprite.position.set(0, 2.0, 0);
        group.add(sprite);

        // Random position spread
        group.position.set(
            (Math.random() - 0.5) * 40,
            (Math.random() - 0.5) * 25,
            (Math.random() - 0.5) * 20
        );

        // Slower Velocity
        group.userData = {
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.0015, // Extremely slow drift
                (Math.random() - 0.5) * 0.0015,
                (Math.random() - 0.5) * 0.0015
            ),
            rotationSpeed: (Math.random() - 0.5) * 0.01 + 0.002, // Minimum rotation
            originalSectionId: section.id,
            titleText: title, // Save for theme updates
            isFrozen: false,
            crystalMesh: crystal
        };

        nodesGroup.add(group);
        nodes.push(group);
        interactables.push(crystal, sprite); // Check hits on both
    });


    // --- Interaction Logic ---
    let activeNodeGroup = null;

    // Create a centralized reading pane (HTML overlay) if it doesn't exist
    let readingPane = document.getElementById('reading-pane');
    if (!readingPane) {
        readingPane = document.createElement('div');
        readingPane.id = 'reading-pane';
        Object.assign(readingPane.style, {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) scale(0.9)',
            width: '80%',
            maxWidth: '600px',
            background: 'rgba(5, 10, 20, 0.95)', // Keep dark background for contrast
            border: '1px solid var(--color-primary)', // Dynamic Theme Color
            padding: '2rem',
            zIndex: '6000',
            opacity: '0',
            pointerEvents: 'none',
            transition: 'all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)',
            backdropFilter: 'blur(20px)',
            borderRadius: '8px',
            boxShadow: '0 0 50px var(--glass-border)' // Dynamic Theme Shadow
        });

        // NO CLOSE BUTTON - click background to close

        // Content container
        const contentContainer = document.createElement('div');
        contentContainer.id = 'reading-content';

        // Add minimal hint text
        const hint = document.createElement('div');
        hint.innerText = '[ CLICK OUTSIDE TO CLOSE ]';
        Object.assign(hint.style, {
            textAlign: 'center',
            marginTop: '2rem',
            color: 'var(--color-primary)', // Dynamic Theme Color
            fontSize: '0.8rem',
            fontFamily: 'Orbitron, sans-serif',
            letterSpacing: '2px',
            opacity: '0.7'
        });

        readingPane.appendChild(contentContainer);
        readingPane.appendChild(hint);
        document.body.appendChild(readingPane);
    }

    function closeReadingPane() {
        if (activeNodeGroup) {
            activeNodeGroup.userData.isFrozen = false;
            activeNodeGroup = null;
        }

        readingPane.style.opacity = '0';
        readingPane.style.pointerEvents = 'none';
        readingPane.style.transform = 'translate(-50%, -50%) scale(0.9)';
    }

    function onMouseClick(event) {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        const intersects = raycaster.intersectObjects(interactables);

        if (intersects.length > 0) {
            // Find which group
            const hitObj = intersects[0].object;
            const hitGroup = hitObj.parent;

            let targetGroup = null;
            if (hitGroup.userData && hitGroup.userData.originalSectionId) targetGroup = hitGroup;
            else if (hitGroup.parent && hitGroup.parent.userData && hitGroup.parent.userData.originalSectionId) targetGroup = hitGroup.parent;

            if (targetGroup && activeNodeGroup !== targetGroup) {
                // Reset old node
                if (activeNodeGroup) activeNodeGroup.userData.isFrozen = false;

                activeNodeGroup = targetGroup;
                activeNodeGroup.userData.isFrozen = true;

                const sectionId = activeNodeGroup.userData.originalSectionId;
                const sourceSection = document.getElementById(sectionId);
                const readingContent = document.getElementById('reading-content');
                if (sourceSection && readingContent) {
                    readingContent.innerHTML = sourceSection.innerHTML;
                    readingPane.style.opacity = '1';
                    readingPane.style.pointerEvents = 'auto';
                    readingPane.style.transform = 'translate(-50%, -50%) scale(1)';
                }
            }
        } else {
            // Clicked empty space
            closeReadingPane();
        }
    }

    window.addEventListener('mousedown', onMouseClick);
    window.addEventListener('touchstart', (e) => {
        const touch = e.changedTouches[0];
        onMouseClick({ clientX: touch.clientX, clientY: touch.clientY });
    });

    // --- Animation Loop ---
    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);

        const time = clock.getElapsedTime();

        // Collision Avoidance Logic
        // Increased distance to 9.0 to account for the width of the sprites (Scale 7)
        // This ensures they bump into each other before the text overlaps
        const minDistance = 9.0;
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const n1 = nodes[i];
                const n2 = nodes[j];

                if (n1.userData.isFrozen || n2.userData.isFrozen) continue;

                const dx = n1.position.x - n2.position.x;
                const dy = n1.position.y - n2.position.y;
                const dz = n1.position.z - n2.position.z;
                const distSq = dx * dx + dy * dy + dz * dz;

                if (distSq < minDistance * minDistance) {
                    const dist = Math.sqrt(distSq);
                    const force = 0.001 * (minDistance - dist); // Tuning repulsion strength

                    // Push apart velocities
                    // Add X/Y randomness to avoid stacking
                    n1.userData.velocity.x += (dx / dist) * force;
                    n1.userData.velocity.y += (dy / dist) * force;
                    n1.userData.velocity.z += (dz / dist) * force;

                    n2.userData.velocity.x -= (dx / dist) * force;
                    n2.userData.velocity.y -= (dy / dist) * force;
                    n2.userData.velocity.z -= (dz / dist) * force;
                }
            }
        }

        // Animate Nodes
        nodes.forEach(group => {
            const data = group.userData;

            // Rotate Crystal
            if (data.crystalMesh) {
                data.crystalMesh.rotation.x += data.rotationSpeed;
                data.crystalMesh.rotation.y += data.rotationSpeed;
            }

            if (!data.isFrozen) {
                // Drift
                group.position.add(data.velocity);

                // STRICT BOUNDS CHECK (Stay on screen)
                // Assuming camera z=20, FOV=60
                const limitX = 14;
                const limitY = 7;
                const limitZ = 10; // Don't get too close or too far

                if (group.position.x > limitX) { group.position.x = limitX; data.velocity.x *= -1; }
                if (group.position.x < -limitX) { group.position.x = -limitX; data.velocity.x *= -1; }

                if (group.position.y > limitY) { group.position.y = limitY; data.velocity.y *= -1; }
                if (group.position.y < -limitY) { group.position.y = -limitY; data.velocity.y *= -1; }

                if (group.position.z > 5) { group.position.z = 5; data.velocity.z *= -1; }
                if (group.position.z < -10) { group.position.z = -10; data.velocity.z *= -1; }

                // Gentle Sway
                group.position.y += Math.sin(time + group.id) * 0.002;

                // FADE IN when drifting (Release)
                group.children.forEach(child => {
                    if (child.material) {
                        const targetOp = child.isSprite ? 0.9 : 0.5;
                        child.material.opacity = THREE.MathUtils.lerp(child.material.opacity, targetOp, 0.1);
                    } else if (child.isMesh) {
                        child.material.opacity = THREE.MathUtils.lerp(child.material.opacity, 0.5, 0.1);
                        child.children.forEach(c => {
                            if (c.material) c.material.opacity = THREE.MathUtils.lerp(c.material.opacity, 1.0, 0.1);
                        });
                    }
                });

            } else {
                // FROZEN STATE (Clicked)

                // 1. DO NOT ZOOM (Keep current position or just stabilize)
                // We just want it to stop and maybe face the camera perfectly.
                // We calculate a target that is simply "where it is now" but rotation aligned.

                // Optional: Slerp rotation to look at camera
                group.quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)), 0.1);

                // FADE OUT when reading (Active)
                group.children.forEach(child => {
                    if (child.isSprite) {
                        child.material.opacity = THREE.MathUtils.lerp(child.material.opacity, 0.05, 0.1);
                    }
                    if (child.isMesh) {
                        child.material.opacity = THREE.MathUtils.lerp(child.material.opacity, 0.1, 0.1);
                        child.children.forEach(c => {
                            if (c.material) c.material.opacity = THREE.MathUtils.lerp(c.material.opacity, 0.2, 0.1);
                        });
                    }
                });
            }
        });

        // Rotate Starfield
        starField.rotation.y = time * 0.02;

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
    });

    // --- Theme Change Handler ---
    window.addEventListener('theme-change', (e) => {
        const { color, bg } = e.detail;
        const newColor = new THREE.Color(color);
        const newBg = new THREE.Color(bg);

        // 1. Update Config
        CONFIG.bgColor = newBg.getHex();
        CONFIG.nodeColor = newColor.getHex();
        CONFIG.particleColor = newColor.clone().offsetHSL(0, 0, 0.2).getHex();

        // 2. Update Environment
        scene.fog.color = newBg;

        // 3. Update Particles
        particlesMat.color = new THREE.Color(CONFIG.particleColor);

        // 4. Update Crystals and Labels
        nodes.forEach(group => {
            const titleText = group.userData.titleText; // Need to ensure we saved this!

            group.children.forEach(child => {
                // Update Crystal
                if (child.isMesh && child.geometry.type === 'IcosahedronGeometry') {
                    // This is likely the crystal (outer or inner?)
                    // Outer crystal is wireframe
                    if (child.material.wireframe) {
                        child.material.color = newColor;
                    }
                }

                // Update Label (Sprite)
                if (child.isSprite) {
                    // We need to redraw the canvas to change the border color
                    // Assuming 'titleText' is available in userData, which we will add now
                    if (titleText) {
                        const newSprite = createLabelTheme(titleText, color);
                        child.material.map = newSprite.material.map;
                    }
                }
            });
        });
    });

    // Modified createLabel to accept color, or reuse existing one structure
    function createLabelTheme(text, themeColorHex) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 1024;
        canvas.height = 256;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        const r = 40;
        const x = 20, y = 40, w = canvas.width - 40, h = canvas.height - 80;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, r);
        ctx.fill();

        // Border - Theme Color
        ctx.strokeStyle = themeColorHex || '#00ffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.font = '700 55px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0)';
        ctx.shadowBlur = 0;

        const maxWidth = canvas.width - 120;
        ctx.fillText(text.toUpperCase(), canvas.width / 2, canvas.height / 2, maxWidth);

        const texture = new THREE.CanvasTexture(canvas);
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 0.9,
            blending: THREE.NormalBlending
        });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(7, 1.75, 1);
        return sprite;
    }
}
