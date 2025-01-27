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
        outerRadius: 2, 
        outerScale: 0.03,
        pointSize: 0.03,
        nucleusColor1: '#FF0D92',
        nucleusColor2: '#0D92F4',
        morphTime: 2000,
        shapeTime: 6000,
        rotationSpeed: 0.003,
        sphereRadius: 1.2,
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
        createSpherePoints,
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
        if (currentObject) {
            // nextObject.rotation.x = currentObject.rotation.x - settings.rotationSpeed * 1999;
            nextObject.rotation.y = currentObject.rotation.y - settings.rotationSpeed * 1999;
            // nextObject.rotation.z = currentObject.rotation.z - settings.rotationSpeed * 1999;
        }
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
      currentObject.rotation.y += settings.rotationSpeed;
      // if (currentObject) {
      //     // Check if current shape is sphere (index 0)
      //     const isSphere = shapeIndex === 0;
          
      //     if (isSphere) {
      //         // Apply pulse effect for sphere
      //         const time = performance.now() / 1000;
      //         const pulseScale = 1 + Math.sin(time * 2) * 0.1; // Adjust pulse speed and intensity
      //         currentObject.scale.set(pulseScale, pulseScale, pulseScale);
      //     } else {
      //         // Only rotate non-sphere shapes on Y axis
              
      //     }
      // }
  
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
    function createNucleus() {
        const segments = 100;
        const radius = settings.outerRadius;
        const pointSize = settings.pointSize;
        const color1 = settings.nucleusColor1; 
        const color2 = settings.nucleusColor2;
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
    function createConePoints({ sphereRadius, pointSize, color1, color2 }) {
      const height = sphereRadius * 1.7;
      const radius = sphereRadius;
      const segments = 64;
      const heightSegments = 30;
      const positions = [];
      for (let i = 0; i <= heightSegments; i++) {
          const y = (i / heightSegments) * height - height/2;
          const currentRadius = radius * (1 - i / heightSegments);
          
          for (let j = 0; j <= segments; j++) {
              const theta = (j / segments) * Math.PI * 2;
              const x = currentRadius * Math.sin(theta);
              const z = currentRadius * Math.cos(theta);
              positions.push(x, y, z);
          }
      }
      for (let i = 0; i <= segments/2; i++) {
          for (let j = 0; j <= segments; j++) {
              const r = (i / (segments/2)) * radius;
              const theta = (j / segments) * Math.PI * 2;
              const x = r * Math.sin(theta);
              const z = r * Math.cos(theta);
              positions.push(x, -height/2, z);
          }
      }
      
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      return createPoints(geometry, pointSize, color1, color2);
  }

    function createPyramidPoints({ sphereRadius, pointSize, color1, color2 }) {
        const baseSize = sphereRadius * 1.5;
        const height = sphereRadius * 2;
        
        const pyramidGeometry = new THREE.BufferGeometry();
        
        const vertices = new Float32Array([
            // Base (square)
            -baseSize/2, -height/2, -baseSize/2,
            baseSize/2, -height/2, -baseSize/2,
            baseSize/2, -height/2, baseSize/2,
            -baseSize/2, -height/2, baseSize/2,
            0, height/2, 0
        ]);
        
        const indices = new Uint16Array([
            0, 1, 2,
            0, 2, 3,
            0, 4, 1,
            1, 4, 2,
            2, 4, 3,
            3, 4, 0 
        ]);
      
        const tempGeometry = new THREE.BufferGeometry();
        tempGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        tempGeometry.setIndex(new THREE.BufferAttribute(indices, 1));
        
        const subdivided = new THREE.BufferGeometry();
        const positions = [];
        
        function addPointsAlongEdge(start, end, segments) {
            for (let i = 0; i <= segments; i++) {
                const t = i / segments;
                positions.push(
                    start.x + (end.x - start.x) * t,
                    start.y + (end.y - start.y) * t,
                    start.z + (end.z - start.z) * t
                );
            }
        }
        

        const segments = 20;
        

        for (let i = 0; i < indices.length; i += 3) {
            const v1 = new THREE.Vector3(
                vertices[indices[i] * 3],
                vertices[indices[i] * 3 + 1],
                vertices[indices[i] * 3 + 2]
            );
            const v2 = new THREE.Vector3(
                vertices[indices[i + 1] * 3],
                vertices[indices[i + 1] * 3 + 1],
                vertices[indices[i + 1] * 3 + 2]
            );
            const v3 = new THREE.Vector3(
                vertices[indices[i + 2] * 3],
                vertices[indices[i + 2] * 3 + 1],
                vertices[indices[i + 2] * 3 + 2]
            );
            

            for (let j = 0; j <= segments; j++) {
                const jt = j / segments;
                for (let k = 0; k <= segments - j; k++) {
                    const kt = k / segments;
                    const t1 = 1 - jt - kt;
                    
                    if (t1 >= 0) {
                        positions.push(
                            v1.x * t1 + v2.x * jt + v3.x * kt,
                            v1.y * t1 + v2.y * jt + v3.y * kt,
                            v1.z * t1 + v2.z * jt + v3.z * kt
                        );
                    }
                }
            }
        }
        
        subdivided.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        
        return createPoints(subdivided, pointSize, color1, color2);
    }

    function createCylinderPoints({ sphereRadius, pointSize, color1, color2 }) {
        const height = sphereRadius * 1.1;
        const radius = sphereRadius;
        const segments = 64;
        const heightSegments = 64;
        const positions = [];
        for (let i = 0; i <= heightSegments; i++) {
            const y = (i / heightSegments) * height - height/2;
            
            for (let j = 0; j <= segments; j++) {
                const theta = (j / segments) * Math.PI * 2;
                const x = radius * Math.sin(theta);
                const z = radius * Math.cos(theta);
                positions.push(x, y, z);
            }
        }
        for (let cap = 0; cap < 2; cap++) {
            const y = cap === 0 ? -height/2 : height/2;
            for (let i = 0; i <= segments/2; i++) {
                for (let j = 0; j <= segments; j++) {
                    const r = (i / (segments/2)) * radius;
                    const theta = (j / segments) * Math.PI * 2;
                    const x = r * Math.sin(theta);
                    const z = r * Math.cos(theta);
                    positions.push(x, y, z);
                }
            }
        }    
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
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
