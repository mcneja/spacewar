"use strict";

window.onload = main;

function main() {

    const canvas = document.querySelector("#canvas");
    const gl = canvas.getContext("webgl", { alpha: false, depth: false });

    if (gl == null) {
        alert("Unable to initialize WebGL. Your browser or machine may not support it.");
        return;
    }

    const glResources = initGlResources(gl);
    const state = initState();

    canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock;
    document.exitPointerLock = document.exitPointerLock || document.mozExitPointerLock;

    canvas.onclick = () => {
        if (state.paused) {
            canvas.requestPointerLock();
        } else {
            resetState(state);
            document.exitPointerLock();
        }
    };

    function requestUpdateAndRender() {
        requestAnimationFrame(now => updateAndRender(now, gl, glResources, state));
    }

    function onLockChanged() {
        const mouseCaptured =
            document.pointerLockElement === canvas ||
            document.mozPointerLockElement === canvas;
        if (mouseCaptured) {
            document.addEventListener("mousemove", onMouseMoved, false);
            if (state.paused) {
                state.paused = false;
                state.tLast = undefined;
                state.player.velocity.x = 0;
                state.player.velocity.y = 0;
                requestUpdateAndRender();
            }
        } else {
            document.removeEventListener("mousemove", onMouseMoved, false);
            state.paused = true;
        }
    }

    function onMouseMoved(e) {
        updatePosition(state, e);
    }

    function onWindowResized() {
        requestUpdateAndRender();
    }

    document.addEventListener('pointerlockchange', onLockChanged, false);
    document.addEventListener('mozpointerlockchange', onLockChanged, false);

    window.addEventListener('resize', onWindowResized);

    requestUpdateAndRender();
}

function updatePosition(state, e) {
    if (!state.player.dead) {
        state.player.velocity.x += e.movementX * state.sensitivity;
        state.player.velocity.y -= e.movementY * state.sensitivity;
    }
}

function initGlResources(gl) {
    gl.getExtension('OES_standard_derivatives');

    const glResources = {
        renderDiscs: createDiscRenderer(gl),
    };

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.BLEND);
    gl.clearColor(0, 0, 0.05, 1);

    return glResources;
}

function initState() {
    const state = { sensitivity: 0.002 };
    resetState(state);
    return state;
}

function resetState(state) {
    const gridSizeX = 64;
    const gridSizeY = 64;

    const player = {
        radius: 0.0125,
        position: { x: 0.5, y: 0 },
        velocity: { x: 0, y: 0 },
        color: { r: 0.8, g: 0.6, b: 0 },
        dead: false,
    };

    const sun = {
        radius: 0.1,
        position: { x: 0, y: 0 },
        color: { r: 1, g: 1, b: 0 },
    };

    state.paused = true;
    state.gameOver = false;
    state.tLast = undefined;
    state.player = player;
    state.sun = sun;
}

function discOverlapsDiscs(disc, discs, minSeparation) {
    for (const disc2 of discs) {
        const dx = disc2.position.x - disc.position.x;
        const dy = disc2.position.y - disc.position.y;
        if (dx**2 + dy**2 < (disc2.radius + disc.radius + minSeparation)**2) {
            return true;
        }
    }
    return false;
}

function discsOverlap(disc0, disc1) {
    const dx = disc1.position.x - disc0.position.x;
    const dy = disc1.position.y - disc0.position.y;
    return dx**2 + dy**2 < (disc1.radius + disc0.radius)**2;
}

function createDiscRenderer(gl) {
    const vsSource = `
        attribute vec2 vPosition;
        
        uniform mat4 uProjectionMatrix;

        varying highp vec2 fPosition;

        void main() {
            fPosition = vPosition;
            gl_Position = uProjectionMatrix * vec4(vPosition.xy, 0, 1);
        }
    `;

    const fsSource = `
        #extension GL_OES_standard_derivatives : enable

        varying highp vec2 fPosition;

        uniform highp vec3 uColor;

        void main() {
            highp float r = length(fPosition);
            highp float aaf = fwidth(r);
            highp float opacity = 1.0 - smoothstep(1.0 - aaf, 1.0, r);
            gl_FragColor = vec4(uColor, opacity);
        }
    `;

    const projectionMatrix = new Float32Array(16);
    projectionMatrix.fill(0);
    projectionMatrix[10] = 1;
    projectionMatrix[15] = 1;

    const program = initShaderProgram(gl, vsSource, fsSource);

    const vertexPositionLoc = gl.getAttribLocation(program, 'vPosition');
    const projectionMatrixLoc = gl.getUniformLocation(program, 'uProjectionMatrix');
    const colorLoc = gl.getUniformLocation(program, 'uColor');
    const vertexBuffer = createDiscVertexBuffer(gl);

    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    const stride = 8; // two 4-byte floats
    gl.vertexAttribPointer(vertexPositionLoc, 2, gl.FLOAT, false, stride, 0);

    return discs => {
        gl.useProgram(program);

        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.enableVertexAttribArray(vertexPositionLoc);
        gl.vertexAttribPointer(vertexPositionLoc, 2, gl.FLOAT, false, 0, 0);

        for (const disc of discs) {
            gl.uniform3f(colorLoc, disc.color.r, disc.color.g, disc.color.b);

            projectionMatrix[0] = disc.radius;
            projectionMatrix[5] = disc.radius;
            projectionMatrix[12] = disc.position.x;
            projectionMatrix[13] = disc.position.y;
            gl.uniformMatrix4fv(projectionMatrixLoc, false, projectionMatrix);

            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
    
        gl.disableVertexAttribArray(vertexPositionLoc);
    };
}

function createDiscVertexBuffer(gl) {
    const v = new Float32Array(6 * 2);
    let i = 0;

    function makeVert(x, y) {
        v[i++] = x;
        v[i++] = y;
    }

    makeVert(-1, -1);
    makeVert( 1, -1);
    makeVert( 1,  1);
    makeVert( 1,  1);
    makeVert(-1,  1);
    makeVert(-1, -1);

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW);

    return vertexBuffer;
}

function updateAndRender(now, gl, glResources, state) {
    const t = now / 1000;
    const dt = (state.paused || state.tLast === undefined) ? 0 : Math.min(1/30, t - state.tLast);
    state.tLast = t;

    if (dt > 0) {
        updateState(state, dt);
    }

    drawScreen(gl, glResources, state);

    if (!state.paused) {
        requestAnimationFrame(now => updateAndRender(now, gl, glResources, state));
    }
}

function updateState(state, dt) {
    state.player.position.x += state.player.velocity.x * dt;
    state.player.position.y += state.player.velocity.y * dt;

    fixupPositionAndVelocityAgainstBoundary(state.player);
}

function fixupPositionAndVelocityAgainstBoundary(disc) {
    const xMin = -1 + disc.radius;
    const yMin = -1 + disc.radius;
    const xMax = 1 - disc.radius;
    const yMax = 1 - disc.radius;

    if (disc.position.x < xMin) {
        disc.position.x = xMin;
        disc.velocity.x = 0;
    } else if (disc.position.x > xMax) {
        disc.position.x = xMax;
        disc.velocity.x = 0;
    }
    if (disc.position.y < yMin) {
        disc.position.y = yMin;
        disc.velocity.y = 0;
    } else if (disc.position.y > yMax) {
        disc.position.y = yMax;
        disc.velocity.y = 0;
    }
}

function drawScreen(gl, glResources, state) {
    resizeCanvasToDisplaySize(gl.canvas);

    const screenX = gl.canvas.clientWidth;
    const screenY = gl.canvas.clientHeight;

    gl.viewport(0, 0, screenX, screenY);
    gl.clear(gl.COLOR_BUFFER_BIT);

    glResources.renderDiscs([state.sun, state.player]);
}

function resizeCanvasToDisplaySize(canvas) {
    const rect = canvas.parentNode.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;
    }
}

function initShaderProgram(gl, vsSource, fsSource) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(program));
        return null;
    }

    return program;
}

function loadShader(gl, type, source) {
    const shader = gl.createShader(type);

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}
