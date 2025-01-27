async function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

(async function () {
    try {
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js");
        await loadScript("https://cdn.jsdelivr.net/npm/simplex-noise@2.4.0/simplex-noise.min.js");
        startAnimation();
    } catch (error) {
        console.error("Failed to load libraries:", error);
    }
})();

function startAnimation() {
    let scene, camera, renderer, currentObject, nextObject, innerGlow;
    let morphProgress = 0;
    let morphing = false;
    let colorChangeProgress = 0;
    let colorDirection = 1;

    const settings = {
       morphTime: 2000,
        shapeTime: 6000,
        rotationSpeed: 0.00,
        sphereRadius: 1.2,
        pointSize: 0.03,
        color1: '#FF0D92',
        color2: '#0D92F4',
        blobFrequency: 0.3,
        blobAmplitude: 0.001,
        edgeAmplitude: 0.01,
        blobScale: 0.9,
        morphStepSize: 0.01,
        glowSize: 0.9,
        glowScale: 0.3,
        glowColor1: '#FF0D92',
        glowColor2: '#0D92F4',
        colorChangeSpeed: 0.05,
        initialShapeTime: 3500 
    };

    const noise = new SimplexNoise();

    const shapes = [
        createSpherePoints,
        createCubePoints,
        createSpherePoints,
        createConePoints,
        createSpherePoints,
        createSpherePoints,
        createCylinderPoints,
        createSpherePoints,
        createTorusPoints,
        createPyramidPoints
    ];
    let shapeIndex = 0;
    let isFirstShape = true;

    function easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    function init() {
        scene = new THREE.Scene();

        camera = new THREE.PerspectiveCamera(75, 350 / 350, 0.1, 1000);
        camera.position.z = 2.7;

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(350, 350);
        renderer.setPixelRatio(window.devicePixelRatio || 1);
        renderer.setClearColor(0x000000);
        document.querySelector('.nucleus-animation').appendChild(renderer.domElement);

        currentObject = shapes[0](settings);
        scene.add(currentObject);

        innerGlow = createGlow(settings.glowSize, settings.glowColor1, settings.glowColor2);
        scene.add(innerGlow);

        animate();
        scheduleNextShape();

        window.addEventListener('resize', onWindowResize);
    }

    function onWindowResize() {
        renderer.setSize(350, 350);
        renderer.setPixelRatio(window.devicePixelRatio || 1);
        camera.aspect = 1; 
        camera.updateProjectionMatrix();
    }

    function scheduleNextShape() {
        const shapeTime = isFirstShape ? settings.initialShapeTime : settings.shapeTime;
        isFirstShape = false;

        setTimeout(() => {
            shapeIndex = (shapeIndex + 1) % shapes.length;
            morphToNextShape();
        }, shapeTime);
    }

    function morphToNextShape() {
        if (morphing) return;
        morphing = true;
        const nextShape = shapes[shapeIndex](settings);
        nextObject = nextShape;
        morphProgress = 0;

        function morphStep() {
            morphProgress += settings.morphStepSize;
            const easedProgress = easeInOutQuad(morphProgress);

            if (morphProgress >= 1) {
                scene.remove(currentObject);
                currentObject = nextObject;
                scene.add(currentObject);
                morphing = false;
                scheduleNextShape();
                return;
            }
            interpolateGeometry(currentObject.geometry, nextObject.geometry, easedProgress);
            requestAnimationFrame(morphStep);
        }
        morphStep();
    }

    function interpolateGeometry(geometryA, geometryB, t) {
        const positionsA = geometryA.attributes.position.array;
        const positionsB = geometryB.attributes.position.array;

        for (let i = 0; i < positionsA.length; i++) {
            positionsA[i] = positionsA[i] * (1 - t) + positionsB[i] * t;
        }

        geometryA.attributes.position.needsUpdate = true;
    }

    function createGlow(radius, color1, color2) {
        const glowGeometry = new THREE.SphereGeometry(radius, 64, 64);
        const glowMaterial = new THREE.ShaderMaterial({
            uniforms: {
                glowColor1: { value: new THREE.Color(color1) },
                glowColor2: { value: new THREE.Color(color2) },
                intensity: { value: 0.6 },
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
            transparent: true,
        });

        return new THREE.Mesh(glowGeometry, glowMaterial);
    }

    function animate() {
        requestAnimationFrame(animate);

        if (currentObject) {
            applyBlobEffect(currentObject.geometry, performance.now() / 1000);
            currentObject.rotation.y += settings.rotationSpeed;
            currentObject.rotation.x += settings.rotationSpeed;
            currentObject.rotation.z += settings.rotationSpeed;
        }

        colorChangeProgress += settings.colorChangeSpeed * colorDirection;
        if (colorChangeProgress > 1 || colorChangeProgress < 0) {
            colorDirection *= -1;
            colorChangeProgress = Math.max(0, Math.min(1, colorChangeProgress));
        }

        const interpolatedGlowColor = new THREE.Color().lerpColors(
            new THREE.Color(settings.glowColor1),
            new THREE.Color(settings.glowColor2),
            colorChangeProgress
        );

        innerGlow.material.uniforms.glowColor1.value.copy(interpolatedGlowColor);
        innerGlow.material.uniforms.glowColor2.value.copy(interpolatedGlowColor);

        updateGlowVertices(innerGlow, settings.glowSize, settings.glowScale);

        renderer.render(scene, camera);
    }

    function applyBlobEffect(geometry, time) {
        const positions = geometry.attributes.position.array;
        const center = new THREE.Vector3(0, 0, 0);
        for (let i = 0; i < positions.length; i += 3) {
            const x = positions[i];
            const y = positions[i + 1];
            const z = positions[i + 2];

            const vertex = new THREE.Vector3(x, y, z);
            const distance = vertex.distanceTo(center);

            const amplitude =
                settings.blobAmplitude *
                settings.blobScale *
                (1 - Math.abs(distance - settings.sphereRadius) / settings.sphereRadius);

            const offset = noise.noise3D(
                x * settings.blobFrequency,
                y * settings.blobFrequency,
                z * settings.blobFrequency + time
            );
            positions[i] += offset * amplitude;
            positions[i + 1] += offset * amplitude;
            positions[i + 2] += offset * amplitude;
        }
        geometry.attributes.position.needsUpdate = true;
    }

    function createSpherePoints({ sphereRadius, pointSize, color1, color2 }) {
        const geometry = new THREE.SphereGeometry(sphereRadius, 64, 64);
        return createPoints(geometry, pointSize, color1, color2);
    }

    function createCubePoints({ sphereRadius, pointSize, color1, color2 }) {
        const size = sphereRadius * Math.sqrt(2);
        const geometry = new THREE.BoxGeometry(size, size, size, 14, 32, 32);

        return createPoints(geometry, pointSize, color1, color2);
    }

    function createConePoints({ sphereRadius, pointSize, color1, color2 }) {
        const height = sphereRadius * 1.7;
        const radius = sphereRadius;
        const geometry = new THREE.ConeGeometry(radius, height, 64, 10, true);
        return createPoints(geometry, pointSize, color1, color2);
    }
    function createPyramidPoints({ sphereRadius, pointSize, color1, color2 }) {
      const geometry = new THREE.ConeGeometry(sphereRadius, sphereRadius * 2, 3, 1); // 4 sides for the pyramid
    
      return createPoints(geometry, pointSize, color1, color2);
    }

    function createCylinderPoints({ sphereRadius, pointSize, color1, color2 }) {
        const height = sphereRadius * 1.1;
        const radius = sphereRadius;
        const geometry = new THREE.CylinderGeometry(radius, radius, height, 64, 64, false);
        return createPoints(geometry, pointSize, color1, color2);
    }

    function createTorusPoints({ sphereRadius, pointSize, color1, color2 }) {
        const torusRadius = sphereRadius * 0.75;
        const tubeRadius = sphereRadius * 0.3;
        const geometry = new THREE.TorusGeometry(torusRadius, tubeRadius, 64, 64);
        return createPoints(geometry, pointSize, color1, color2);
    }

    
  
    function createPoints(geometry, pointSize, color1, color2) {
        const material = new THREE.PointsMaterial({ size: pointSize, vertexColors: true });
        const points = new THREE.Points(geometry, material);

        const colors = [];
        const colorA = new THREE.Color(color1);
        const colorB = new THREE.Color(color2);

        for (let i = 0; i < geometry.attributes.position.count; i++) {
            const t = i / geometry.attributes.position.count;
            const color = colorA.clone().lerp(colorB, t);
            colors.push(color.r, color.g, color.b);
        }

        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        return points;
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

            const noiseFactor =
                radius +
                noise.noise3D(x + time * 0.03, y + time * 0.04, z + time * 0.05) * scale;

            positions[i] = x * noiseFactor;
            positions[i + 1] = y * noiseFactor;
            positions[i + 2] = z * noiseFactor;
        }

        glow.geometry.attributes.position.needsUpdate = true;
    }

    init();
}
