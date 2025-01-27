// Function to load external scripts
async function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Load the required libraries and initialize the animation
(async function() {
    try {
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js");
        await loadScript("https://cdn.jsdelivr.net/npm/simplex-noise@2.4.0/simplex-noise.min.js");
        startAnimation();
    } catch (error) {
        console.error("Failed to load libraries:", error);
    }
})();

// Animation code in a separate function
function startAnimation() {
    let scene, camera, renderer, outerNucleus, innerGlow, noise;
    let mouseX = 0, mouseY = 0;

    const settings = {
        outerRadius: 2, 
        outerScale: 0.03,
        animationSpeed: 0.001,
        pointSize: 0.012,
        blobScale: 0.17,
        mouseIntensity: 0.085,
        glowSize: 1.3, 
        glowScale: 0.3,
        glowColor1: '#FF0D92',
        glowColor2: '#0D92F4',
        nucleusColor1: '#FF0D92',
        nucleusColor2: '#0D92F4',
        colorChangeSpeed: 0.005
    };

    let colorChangeProgress = 0;
    let direction = 1;

    function init() {
        // Initialize scene, camera, and renderer
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(75, 100 / 100, 0.1, 1000);
        camera.position.z = 3.5;

        renderer = new THREE.WebGLRenderer({ antialias: true });
        const container = document.querySelector('.nucleus-animation');
        renderer.setSize(container.clientWidth, container.clientHeight); // Adjust based on container
        renderer.setClearColor(0x000000); // Black background color
        container.appendChild(renderer.domElement);

        noise = new SimplexNoise();

        outerNucleus = createNucleus(settings.outerRadius, settings.outerScale, settings.pointSize, settings.nucleusColor1, settings.nucleusColor2);
        scene.add(outerNucleus);

        innerGlow = createGlow(settings.glowSize, settings.glowColor1, settings.glowColor2);
        scene.add(innerGlow);

        animate();
    }

    function onWindowResize() {
        const container = document.querySelector('.nucleus-animation');
        renderer.setSize(container.clientWidth, container.clientHeight);
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
    }

    function onMouseMove(event) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouseY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    function createNucleus(radius, scale, pointSize, color1, color2) {
        const segments = 100;
        const nucleusGeometry = new THREE.SphereGeometry(radius, segments, segments);
        const pointMaterial = new THREE.PointsMaterial({
            vertexColors: true,
            size: pointSize
        });

        const nucleus = new THREE.Points(nucleusGeometry, pointMaterial);

        const colors = [];
        const colorA = new THREE.Color(color1);
        const colorB = new THREE.Color(color2);

        for (let i = 0; i < nucleusGeometry.attributes.position.count; i++) {
            const t = i / nucleusGeometry.attributes.position.count;
            const interpolatedColor = colorA.clone().lerp(colorB, t);
            colors.push(interpolatedColor.r, interpolatedColor.g, interpolatedColor.b);
        }

        nucleusGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        return nucleus;
    }

    function createGlow(radius, color1, color2) {
        const glowGeometry = new THREE.SphereGeometry(radius, 64, 64);
        const glowMaterial = new THREE.ShaderMaterial({
            uniforms: {
                glowColor1: { value: new THREE.Color(color1) },
                glowColor2: { value: new THREE.Color(color2) },
                intensity: { value: 0.6 }
            },
            vertexShader: `
                varying vec3 vNormal;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 glowColor1;
                uniform vec3 glowColor2;
                uniform float intensity;
                varying vec3 vNormal;

                void main() {
                    float angle = dot(vNormal, vec3(0.0, 0.0, 1.0));
                    float linearEffect = pow(angle, 10.0);
                    float t = linearEffect; 
                    vec3 blendedColor = mix(glowColor1, glowColor2, t);
                    gl_FragColor = vec4(blendedColor * intensity * linearEffect, 1.0);
                }
            `,
            blending: THREE.AdditiveBlending,
            transparent: true
        });

        return new THREE.Mesh(glowGeometry, glowMaterial);
    }

    function animate() {
        requestAnimationFrame(animate);

        colorChangeProgress += settings.colorChangeSpeed * direction;
        if (colorChangeProgress > 1 || colorChangeProgress < 0) {
            direction *= -1;
            colorChangeProgress = Math.max(0, Math.min(1, colorChangeProgress));
        }

        const interpolatedGlowColor = new THREE.Color().lerpColors(
            new THREE.Color(settings.glowColor1),
            new THREE.Color(settings.glowColor2),
            colorChangeProgress
        );

        innerGlow.material.uniforms.glowColor1.value.copy(interpolatedGlowColor);
        innerGlow.material.uniforms.glowColor2.value.copy(interpolatedGlowColor);

        const interpolatedNucleusColor = new THREE.Color().lerpColors(
            new THREE.Color(settings.nucleusColor1),
            new THREE.Color(settings.nucleusColor2),
            colorChangeProgress
        );

        outerNucleus.material.color.copy(interpolatedNucleusColor);

        outerNucleus.rotation.y += (mouseX * settings.mouseIntensity - outerNucleus.rotation.y) * settings.animationSpeed;
        outerNucleus.rotation.x += (mouseY * settings.mouseIntensity - outerNucleus.rotation.x) * settings.animationSpeed;

        updateNucleusVertices(outerNucleus, settings.outerRadius, settings.outerScale);
        updateGlowVertices(innerGlow, settings.glowSize, settings.glowScale);

        renderer.render(scene, camera);
    }

    function updateNucleusVertices(nucleus, radius, scale) {
        const positions = nucleus.geometry.attributes.position.array;
        const time = Date.now() * 0.01;

        for (let i = 0; i < positions.length; i += 3) {
            let x = positions[i];
            let y = positions[i + 1];
            let z = positions[i + 2];

            const length = Math.sqrt(x * x + y * y + z * z);
            x /= length;
            y /= length;
            z /= length;

            const noiseFactor = radius + noise.noise3D(
                x + time * 0.05,
                y + time * 0.03,
                z + time * 0.08
            ) * scale;

            positions[i] = x * noiseFactor;
            positions[i + 1] = y * noiseFactor;
            positions[i + 2] = z * noiseFactor;
        }

        nucleus.geometry.attributes.position.needsUpdate = true;
    }

    function updateGlowVertices(glow, radius, scale) {
        const positions = glow.geometry.attributes.position.array;
        const time = Date.now() * 0.02;

        for (let i = 0; i < positions.length; i += 3) {
            let x = positions[i];
            let y = positions[i + 1];
            let z = positions[i + 2];

            const length = Math.sqrt(x * x + y * y + z * z);
            x /= length;
            y /= length;
            z /= length;

            const noiseFactor = radius + noise.noise3D(
                x + time * 0.03,
                y + time * 0.04,
                z + time * 0.05
            ) * scale;

            positions[i] = x * noiseFactor;
            positions[i + 1] = y * noiseFactor;
            positions[i + 2] = z * noiseFactor;
        }

        glow.geometry.attributes.position.needsUpdate = true;
    }

    init();
    document.addEventListener('mousemove', onMouseMove);
    window.addEventListener('resize', onWindowResize);
}


