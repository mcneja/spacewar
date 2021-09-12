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

    document.body.addEventListener('keydown', onKeyDown);
    document.body.addEventListener('keyup', onKeyUp);

    function requestUpdateAndRender() {
        requestAnimationFrame(now => updateAndRender(now, gl, glResources, state));
    }

    function onKeyDown(e) {
        switch (e.code) {
            case 'ArrowLeft':
            case 'ArrowUp':
            case 'ArrowRight':
            case 'ArrowDown':
            case 'Numpad1':
            case 'Numpad2':
            case 'Numpad3':
            case 'Numpad4':
            case 'Numpad5':
            case 'Numpad6':
            case 'Numpad7':
            case 'Numpad8':
            case 'Numpad9':
                if (state.paused) {
                    unpause();
                }
                state.pressed.add(e.code);
                e.preventDefault();
                break;
            case 'Escape':
                if (state.paused) {
                    unpause();
                } else {
                    pause();
                }
                e.preventDefault();
                break;
        }
    }

    function pause() {
        state.paused = true;
    }

    function unpause() {
        if (state.paused) {
            state.paused = false;
            state.tLast = undefined;
            requestUpdateAndRender();
        }
    }

    function onKeyUp(e) {
        switch (e.code) {
            case 'ArrowLeft':
            case 'ArrowUp':
            case 'ArrowRight':
            case 'ArrowDown':
            case 'Numpad1':
            case 'Numpad2':
            case 'Numpad3':
            case 'Numpad4':
            case 'Numpad5':
            case 'Numpad6':
            case 'Numpad7':
            case 'Numpad8':
            case 'Numpad9':
                state.pressed.delete(e.code);
                e.preventDefault();
                break;
        }
    }

    function onWindowResized() {
        requestUpdateAndRender();
    }

    window.addEventListener('resize', onWindowResized);

    requestUpdateAndRender();
}

function Vector(x, y) {
    this.x = x || 0;
    this.y = y || 0;
}

Vector.prototype = {
    negative: function() {
        this.x = -this.x;
        this.y = -this.y;
        return this;
    },
    add: function(v) {
        if (v instanceof Vector) {
            this.x += v.x;
            this.y += v.y;
        } else {
            this.x += v;
            this.y += v;
        }
        return this;
    },
    subtract: function(v) {
        if (v instanceof Vector) {
            this.x -= v.x;
            this.y -= v.y;
        } else {
            this.x -= v;
            this.y -= v;
        }
        return this;
    },
    multiply: function(v) {
        if (v instanceof Vector) {
            this.x *= v.x;
            this.y *= v.y;
        } else {
            this.x *= v;
            this.y *= v;
        }
        return this;
    },
    divide: function(v) {
        if (v instanceof Vector) {
            this.x /= v.x;
            this.y /= v.y;
        } else {
            this.x /= v;
            this.y /= v;
        }
        return this;
    },
    equals: function(v) {
        return this.x == v.x && this.y == v.y;
    },
    dot: function(v) {
        return this.x * v.x + this.y * v.y;
    },
    cross: function(v) {
        return this.x * v.y - this.y * v.x;
    },
    lengthSquared: function() {
        return this.dot(this);
    },
    length: function() {
        return Math.sqrt(this.lengthSquared());
    },
    normalize: function() {
        return this.divide(this.length());
    },
    clone: function() {
        return new Vector(this.x, this.y);
    },
    set: function(x, y) {
        this.x = x;
        this.y = y;
        return this;
    }
};

Vector.negative = function(v) {
    return new Vector(-v.x, -v.y);
};
Vector.add = function(a, b) {
    if (b instanceof Vector) return new Vector(a.x + b.x, a.y + b.y);
    else return new Vector(a.x + b, a.y + b);
};
Vector.subtract = function(a, b) {
    if (b instanceof Vector) return new Vector(a.x - b.x, a.y - b.y);
    else return new Vector(a.x - b, a.y - b);
};
Vector.multiply = function(a, b) {
    if (b instanceof Vector) return new Vector(a.x * b.x, a.y * b.y);
    else return new Vector(a.x * b, a.y * b);
};
Vector.divide = function(a, b) {
    if (b instanceof Vector) return new Vector(a.x / b.x, a.y / b.y);
    else return new Vector(a.x / b, a.y / b);
};
Vector.equals = function(a, b) {
    return a.x == b.x && a.y == b.y;
};
Vector.dot = function(a, b) {
    return a.x * b.x + a.y * b.y;
};
Vector.cross = function(a, b) {
    return a.x * b.y - a.y * b.x;
};

function initGlResources(gl) {
    gl.getExtension('OES_standard_derivatives');

    const glResources = {
        renderDiscs: createDiscRenderer(gl),
    };

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.BLEND);
    gl.clearColor(0, 0, 0.1, 1);

    return glResources;
}

function initState() {
    const state = { rocket_acceleration: 0.5, pressed: new Set() };
    resetState(state);
    return state;
}

function circularOrbitVelocity(mu, pos) {
    const r = pos.length();
    const v = Math.sqrt(mu / r) / r;
    return new Vector(-pos.y * v, pos.x * v);
}

function resetState(state) {
    const mu = 0.05;

    const posPlayer = new Vector(-0.4, 0.4);
    const player = {
        radius: 0.0125,
        position: posPlayer,
        velocity: circularOrbitVelocity(mu, posPlayer),
        color: { r: 0.8, g: 0.6, b: 0 },
        dead: false,
    };

    const sun = {
        radius: 0.1,
        position: new Vector(0, 0),
        color: { r: 1, g: 1, b: 0 },
    };

    const posEnemy = new Vector(0.68, -0.68);
    const enemy = {
        radius: 0.0125,
        position: posEnemy,
        velocity: circularOrbitVelocity(mu, posEnemy),
        color: { r: 1, g: 0, b: 0 }
    };

    state.paused = true;
    state.gameOver = false;
    state.tLast = undefined;
    state.mu = mu;
    state.player = player;
    state.enemies = [enemy];
    state.sun = sun;
}

function discOverlapsDiscs(disc, discs, minSeparation) {
    for (const disc2 of discs) {
        const d = Vector.subtract(disc2.position, disc.position);
        if (d.lengthSquared() < (disc2.radius + disc.radius + minSeparation)**2) {
            return true;
        }
    }
    return false;
}

function discsOverlap(disc0, disc1) {
    const d = Vector.subtract(disc1.position, disc0.position);
    return d.lengthSquared() < (disc1.radius + disc0.radius)**2;
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

function updateRocket(rocket, dt, mu, thrust) {
    const stateOld = {
        position: rocket.position,
        velocity: rocket.velocity,
    };
    const stateNew = stateIntegrate(
        stateOld,
        rocket => stateDerivatives(rocket, mu, thrust),
        dt
    );

    rocket.position = stateNew.position.clone();
    rocket.velocity = stateNew.velocity.clone();

    fixupPositionAndVelocityAgainstBoundary(rocket);
}

function updateState(state, dt) {
    updateRocket(state.player, dt, state.mu, vecThrust(state));
    for (const enemy of state.enemies) {
        updateRocket(enemy, dt, state.mu, new Vector(0, 0));
    }
}

const thrustInputs = [
    { keys: ['ArrowLeft', 'Numpad1', 'Numpad4', 'Numpad7'], dir: new Vector(-1, 0) },
    { keys: ['ArrowRight', 'Numpad3', 'Numpad6', 'Numpad9'], dir: new Vector(1, 0) },
    { keys: ['ArrowDown', 'Numpad1', 'Numpad2', 'Numpad3'], dir: new Vector(0, -1) },
    { keys: ['ArrowUp', 'Numpad7', 'Numpad8', 'Numpad9'], dir: new Vector(0, 1) },
];

function vecThrust(state) {
    const joystick = thrustInputs.map(keysDir =>
        keysDir.keys.some(key => state.pressed.has(key)) ? keysDir.dir : new Vector(0, 0)
    ).reduce(Vector.add, new Vector(0, 0));

    const joystickSqLen = joystick.lengthSquared();
    if (joystickSqLen > 1) {
        joystick.divide(Math.sqrt(joystickSqLen));
    }

    return Vector.multiply(joystick, state.rocket_acceleration);
}

function stateAdd(state0, state1) {
    return {
        position: Vector.add(state0.position, state1.position),
        velocity: Vector.add(state0.velocity, state1.velocity),
    };
}

function stateScale(state, scale) {
    return {
        position: Vector.multiply(state.position, scale),
        velocity: Vector.multiply(state.velocity, scale),
    };
}

function gravitationalAcceleration(position, mu) {
    const sun_radius = 0.1;
	const r2 = Math.max(position.lengthSquared(), sun_radius**2);
	const r = Math.sqrt(r2);
	const gravityStrength = -mu / (r2 * r);
	return Vector.multiply(position, gravityStrength);
}

function stateDerivatives(body, mu, thrust) {
    const gravity = gravitationalAcceleration(body.position, mu);
    const acceleration = Vector.add(gravity, thrust);
    return {
        position: body.velocity.clone(),
        velocity: acceleration,
    };
}

function stateIntegrate(state1, derivatives, dt) {
    const k1 = derivatives(state1);
    const k2 = derivatives(stateAdd(state1, stateScale(k1, dt*2/3)));
    const state2 = stateAdd(state1, stateScale(stateAdd(k1, stateScale(k2, 3)), dt/4));
    return state2;
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
    glResources.renderDiscs(state.enemies);
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
