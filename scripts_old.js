window.onload = function() {
    const canvas = document.getElementById('glCanvas');
    let gl = canvas.getContext('webgl');
    if (!gl) {
        console.error('WebGL not supported, falling back on experimental-webgl');
        gl = canvas.getContext('experimental-webgl');
    }
    if (!gl) {
        alert('Your browser does not support WebGL');
        return;
    }

    const vsSource = `
        attribute vec4 aVertexPosition;
        attribute vec3 aVertexNormal;
        uniform mat4 uModelViewMatrix;
        uniform mat4 uProjectionMatrix;
        varying highp vec3 vNormal;

        void main() {
            gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
            vNormal = aVertexNormal;
        }
    `;

    const fsSource = `
        precision mediump float;
        varying highp vec3 vNormal;
        void main() {
            vec3 lightDirection = normalize(vec3(-0.5, -1.0, -1.0));
            vec3 ambientColor = vec3(0.1, 0.1, 0.3); // Cooler ambient color
            vec3 diffuseColor = vec3(0.3, 0.5, 1.0); // Cooler diffuse color
            vec3 lightColor = vec3(1.0, 1.0, 1.0);

            vec3 normal = normalize(vNormal);
            float lambertian = max(dot(normal, lightDirection), 0.0);

            vec3 ambient = ambientColor * lightColor;
            vec3 diffuse = diffuseColor * lightColor * lambertian;

            // vec3 finalColor = ambient + diffuse;
            vec3 finalColor = normal * -1.0;
            gl_FragColor = vec4(finalColor, 1.0);
        }
    `;

    function initShaderProgram(gl, vsSource, fsSource) {
        const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
        const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

        const shaderProgram = gl.createProgram();
        gl.attachShader(shaderProgram, vertexShader);
        gl.attachShader(shaderProgram, fragmentShader);
        gl.linkProgram(shaderProgram);

        if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
            console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
            return null;
        }

        return shaderProgram;
    }

    function loadShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    function parseOBJ(objText) {
        const positions = [];
        const normals = [];
        const indices = [];
        const vertexMap = new Map();
        const finalPositions = [];
        const finalNormals = [];

        const lines = objText.split('\n');
        lines.forEach(line => {
            const parts = line.trim().split(/\s+/);
            if (parts[0] === 'v') {
                positions.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
            } else if (parts[0] === 'vn') {
                normals.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
            } else if (parts[0] === 'f') {
                for (let i = 1; i <= 3; i++) {
                    const indicesData = parts[i].split('/');
                    const positionIndex = parseInt(indicesData[0]) - 1; // OBJ indices are 1-based
                    const normalIndex = parseInt(indicesData[2]) - 1;
                    const key = `${positionIndex}/${normalIndex}`;

                    if (!vertexMap.has(key)) {
                        vertexMap.set(key, finalPositions.length / 3);
                        finalPositions.push(positions[positionIndex * 3], positions[positionIndex * 3 + 1], positions[positionIndex * 3 + 2]);
                        finalNormals.push(normals[normalIndex * 3], normals[normalIndex * 3 + 1], normals[normalIndex * 3 + 2]);
                    }

                    indices.push(vertexMap.get(key));
                }
            }
        });

        return { positions: finalPositions, normals: finalNormals, indices };
    }

    function loadOBJ(url, callback) {
        fetch(url)
            .then(response => response.text())
            .then(objText => {
                const { positions, normals, indices } = parseOBJ(objText);
                callback(positions, normals, indices);
            });
    }

    function initBuffers(gl, positions, normals, indices) {
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        const normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

        const indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

        return {
            position: positionBuffer,
            normal: normalBuffer,
            indices: indexBuffer,
            numVertices: indices.length
        };
    }

    function initGroundPlaneBuffers(gl) {
        const positions = [
            -10.0, -1.0, 10.0,
            10.0, -1.0, 10.0,
            10.0, -1.0, -10.0,
            -10.0, -1.0, -10.0,
        ];

        const normals = [
            0.0, 1.0, 0.0,
            0.0, 1.0, 0.0,
            0.0, 1.0, 0.0,
            0.0, 1.0, 0.0,
        ];

        const indices = [
            0, 1, 2,
            0, 2, 3,
        ];

        return initBuffers(gl, positions, normals, indices);
    }

    function drawScene(gl, programInfo, buffers, modelViewMatrix) {
        const projectionMatrix = mat4.create();
        const fov = 45 * Math.PI / 180;
        const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
        const zNear = 0.1;
        const zFar = 100.0;
        mat4.perspective(projectionMatrix, fov, aspect, zNear, zFar);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
        gl.vertexAttribPointer(
            programInfo.attribLocations.vertexPosition,
            3,
            gl.FLOAT,
            false,
            0,
            0
        );
        gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normal);
        gl.vertexAttribPointer(
            programInfo.attribLocations.vertexNormal,
            3,
            gl.FLOAT,
            false,
            0,
            0
        );
        gl.enableVertexAttribArray(programInfo.attribLocations.vertexNormal);

        gl.useProgram(programInfo.program);

        gl.uniformMatrix4fv(
            programInfo.uniformLocations.projectionMatrix,
            false,
            projectionMatrix
        );
        gl.uniformMatrix4fv(
            programInfo.uniformLocations.modelViewMatrix,
            false,
            modelViewMatrix
        );

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
        gl.drawElements(gl.TRIANGLES, buffers.numVertices, gl.UNSIGNED_SHORT, 0);
    }

    function start() {
        let isDragging = false; // Add this line
        
        const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
        const programInfo = {
            program: shaderProgram,
            attribLocations: {
                vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
                vertexNormal: gl.getAttribLocation(shaderProgram, 'aVertexNormal'),
            },
            uniformLocations: {
                projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
                modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
            },
        };

        const objFiles = [
            'assets/models/A_10.obj',
            'assets/models/cow.obj',
            'assets/models/teapot.obj'
        ];

        const groundPlaneBuffers = initGroundPlaneBuffers(gl);

        let currentObjIndex = 0;
        let rotation = 0;
        let buffers;

        function loadNextOBJ() {
            if (currentObjIndex >= objFiles.length) {
                currentObjIndex = 0;
            }

            loadOBJ(objFiles[currentObjIndex], function(positions, normals, indices) {
                buffers = initBuffers(gl, positions, normals, indices);
                currentObjIndex++;
                setTimeout(loadNextOBJ, 5000); // Cycle every 5 seconds
            });
        }

        function render() {
            gl.clearColor(0.0, 0.0, 0.0, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

            const groundModelViewMatrix = mat4.create();
            mat4.translate(groundModelViewMatrix, groundModelViewMatrix, [0.0, 0.0, -10.0]);

            const modelViewMatrix = mat4.create();
            mat4.translate(modelViewMatrix, modelViewMatrix, [0.0, 0.0, -10.0]);
            mat4.rotate(modelViewMatrix, modelViewMatrix, rotation, [0, 1, 0]);

            drawScene(gl, programInfo, groundPlaneBuffers, groundModelViewMatrix);
            if (buffers) {
                drawScene(gl, programInfo, buffers, modelViewMatrix);
            }

            requestAnimationFrame(render);
        }

        canvas.addEventListener('mousedown', (event) => {
            isDragging = true;
            lastMouseX = event.clientX;
            lastMouseY = event.clientY;
        });

        canvas.addEventListener('mouseup', () => {
            isDragging = false;
        });

        canvas.addEventListener('mousemove', (event) => {
            if (isDragging) {
                const deltaX = event.clientX - lastMouseX;
                rotation += deltaX * 0.01;
                lastMouseX = event.clientX;
            }
        });

        loadNextOBJ();
        render();
    }

    start();
};