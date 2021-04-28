
// This code draws a single pixel textured by the camera background at every frame,
// in order to keep the camera texture in GPU memory, so that we can read it back.

// TODO: Leftover code from camera access sample from Chromium site. Needs to be better adapted to our requirements.

let shaderProgram = null;
let vertexBuffer = null;
let aCoordLoc = null;
let uSamplerLoc = null;

export function initCameraCaptureScene(gl) {
    var vertices = [
        -1.0, 1.0, 0.0
    ];

    vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    var vertCode =
    'attribute vec3 coordinates;' +
    'void main(void) {' +
        'gl_Position = vec4(coordinates, 1.0);' +
        'gl_PointSize = 1.0;'+
    '}';
    var vertShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertShader, vertCode);
    gl.compileShader(vertShader);

    // NOTE: we must explicitly use the camera texture in drawing,
    // otherwise uSampler gets optimized away, and the
    // camera texture gets destroyed before we could capture it.
    var fragCode =
    'uniform sampler2D uSampler;' +
    'void main(void) {' +
        'gl_FragColor = texture2D(uSampler, vec2(0,0));' +
    '}';
    var fragShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragShader, fragCode);
    gl.compileShader(fragShader);

    shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertShader);
    gl.attachShader(shaderProgram, fragShader);
    gl.linkProgram(shaderProgram);

    aCoordLoc = gl.getAttribLocation(shaderProgram, "coordinates");
    uSamplerLoc = gl.getUniformLocation(shaderProgram, "uSampler");

    let glError = gl.getError();
    if (glError!= gl.NO_ERROR) {
        console.log("GL error: " + glError);
    }
}


export function drawCameraCaptureScene(gl, cameraTexture) {
    const prevShaderId = gl.getParameter(gl.CURRENT_PROGRAM);

    gl.useProgram(shaderProgram);

    // Bind the geometry
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.vertexAttribPointer(aCoordLoc, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aCoordLoc);

    // Bind the texture to texture unit 0
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, cameraTexture);
    gl.uniform1i(uSamplerLoc, 0);

    // Draw the single point
    gl.drawArrays(gl.POINTS, 0, 1);

    // Restore the previous shader
    gl.useProgram(prevShaderId);
}



/**
 * Converting a WebGLTexture to base64 encoded image.
 *
 * Copy paste from https://stackoverflow.com/questions/8191083/can-one-easily-create-an-html-image-element-from-a-webgl-texture-object
 * Pretty sure this can be optimized for this specific use.
 *
 * @param gl    Context of the canvas to use
 * @param texture       The texture to convert
 * @param width     Width of the resulting image
 * @param height        Height of the resulting image
 * @returns {string}        base64 encoded string of the image (will likely change)
 */
 export function createImageFromTexture(gl, texture, width, height) {
    const prev_framebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING); // save the screen framebuffer ID

    // Create a framebuffer backed by the texture
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    // Read the contents of the framebuffer
    const data = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.deleteFramebuffer(framebuffer);

    gl.bindFramebuffer(gl.FRAMEBUFFER, prev_framebuffer); // bind back the screen framebuffer

    // Create a 2D canvas to store the result
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');

    // Copy the pixels to a 2D canvas
    const imageData = context.createImageData(width, height);
    imageData.data.set(data);

    // Image is vertically flipped
    // Didn't find a better way to flip the image back
    const imageFlip = new ImageData (canvas.width, canvas.height) ;
    const Npel      = imageData.data.length / 4 ;

    for ( let kPel = 0 ; kPel < Npel ; kPel++ ) {
        const kFlip      = flip_index (kPel, canvas.width, canvas.height) ;
        const offset     = 4 * kPel ;
        const offsetFlip = 4 * kFlip ;
        imageFlip.data[offsetFlip] = imageData.data[offset] ;
        imageFlip.data[offsetFlip + 1] = imageData.data[offset + 1] ;
        imageFlip.data[offsetFlip + 2] = imageData.data[offset + 2] ;
        imageFlip.data[offsetFlip + 3] = imageData.data[offset + 3] ;
    }

    context.putImageData(imageFlip, 0, 0);
    return canvas.toDataURL('image/jpeg');
}

function flip_index (kPel, width, height) {
    var i     = Math.floor (kPel / width) ;
    var j     = kPel % width ;

    return height * width - (i + 1) * width + j ;
}


/*
// code from https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices
function clientWaitAsync(gl, sync, flags, interval_ms) {
    return new Promise((resolve, reject) => {
      function test() {
        const res = gl.clientWaitSync(sync, flags, 0);
        if (res == gl.WAIT_FAILED) {
          reject();
          return;
        }
        if (res == gl.TIMEOUT_EXPIRED) {
          setTimeout(test, interval_ms);
          return;
        }
        resolve();
      }
      test();
    });
}

async function getBufferSubDataAsync(gl, target, buffer, srcByteOffset, dstBuffer,
            dstOffset, length) {

    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();

    await clientWaitAsync(gl, sync, 0, 10);
    gl.deleteSync(sync);

    gl.bindBuffer(target, buffer);
    gl.getBufferSubData(target, srcByteOffset, dstBuffer, dstOffset, length);
    gl.bindBuffer(target, null);

    return dstBuffer;
}

async function readPixelsAsync(gl, x, y, w, h, format, type, dest) {
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buf);
    gl.bufferData(gl.PIXEL_PACK_BUFFER, dest.byteLength, gl.STREAM_READ);
    gl.readPixels(x, y, w, h, format, type, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);

    await getBufferSubDataAsync(gl, gl.PIXEL_PACK_BUFFER, buf, 0, dest);

    gl.deleteBuffer(buf);
    return dest;
}
*/
