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

            vec3 finalColor = ambient + diffuse;
            // vec3 finalColor = normal * -1.0;
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
        let hasNormals = false;
    
        lines.forEach(line => {
            const parts = line.trim().split(/\s+/);
            if (parts[0] === 'v') {
                positions.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
            } else if (parts[0] === 'vn') {
                hasNormals = true;
                normals.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
            } else if (parts[0] === 'f') {
                for (let i = 1; i <= 3; i++) {
                    const indicesData = parts[i].split('/');
                    const positionIndex = parseInt(indicesData[0]) - 1; // OBJ indices are 1-based
                    const normalIndex = hasNormals ? parseInt(indicesData[2]) - 1 : null;
                    const key = hasNormals ? `${positionIndex}/${normalIndex}` : `${positionIndex}`;
    
                    if (!vertexMap.has(key)) {
                        vertexMap.set(key, finalPositions.length / 3);
                        finalPositions.push(positions[positionIndex * 3], positions[positionIndex * 3 + 1], positions[positionIndex * 3 + 2]);
                        if (hasNormals) {
                            finalNormals.push(normals[normalIndex * 3], normals[normalIndex * 3 + 1], normals[normalIndex * 3 + 2]);
                        } else {
                            finalNormals.push(0, 0, 0); // Placeholder for normals
                        }
                    }
    
                    indices.push(vertexMap.get(key));
                }
            }
        });
    
        if (!hasNormals) {
            // Calculate normals
            const faceNormals = Array(finalPositions.length / 3).fill(null).map(() => [0, 0, 0]);
    
            for (let i = 0; i < indices.length; i += 3) {
                const i0 = indices[i] * 3;
                const i1 = indices[i + 1] * 3;
                const i2 = indices[i + 2] * 3;
    
                const v0 = [finalPositions[i0], finalPositions[i0 + 1], finalPositions[i0 + 2]];
                const v1 = [finalPositions[i1], finalPositions[i1 + 1], finalPositions[i1 + 2]];
                const v2 = [finalPositions[i2], finalPositions[i2 + 1], finalPositions[i2 + 2]];
    
                const edge1 = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];
                const edge2 = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]];
    
                const normal = [
                    edge1[1] * edge2[2] - edge1[2] * edge2[1],
                    edge1[2] * edge2[0] - edge1[0] * edge2[2],
                    edge1[0] * edge2[1] - edge1[1] * edge2[0]
                ];
    
                const length = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2]);
                if (length > 0) {
                    normal[0] /= length;
                    normal[1] /= length;
                    normal[2] /= length;
                }
    
                for (let j = 0; j < 3; j++) {
                    faceNormals[indices[i + j]][0] += normal[0];
                    faceNormals[indices[i + j]][1] += normal[1];
                    faceNormals[indices[i + j]][2] += normal[2];
                }
            }
    
            // Normalize the normals
            for (let i = 0; i < faceNormals.length; i++) {
                const nx = faceNormals[i][0];
                const ny = faceNormals[i][1];
                const nz = faceNormals[i][2];
                const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
                if (length > 0) {
                    finalNormals[i * 3] = nx / length;
                    finalNormals[i * 3 + 1] = ny / length;
                    finalNormals[i * 3 + 2] = nz / length;
                } else {
                    finalNormals[i * 3] = 0;
                    finalNormals[i * 3 + 1] = 0;
                    finalNormals[i * 3 + 2] = 0;
                }
            }
        }
    
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

        function generateOBJFilePaths() {
            const objFiles = [];
            const basePath = 'webgl-assets/meshes/';
            const numFiles = 60; // Assuming 000.obj to 059.obj
        
            for (let i = 0; i < numFiles; i++) {
                const paddedIndex = ('000' + i).slice(-3); // Ensure padding for single-digit indices
                objFiles.push(`${basePath}${paddedIndex}.obj`);
            }
        
            return objFiles;
        }

        // const objFiles = [
        //     'assets/models/A_10.obj',
        //     'assets/models/cow.obj',
        //     'assets/models/teapot.obj'
        // ];

        const objFiles = generateOBJFilePaths();

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
                setTimeout(loadNextOBJ, 100); // Cycle every 5 seconds
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