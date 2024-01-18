// This code draws a single pixel textured by the camera background at every frame,
// in order to keep the camera texture in GPU memory, so that we can read it back.

// TODO: Leftover code from camera access sample from Chromium site. Needs to be better adapted to our requirements.
// See more details here: https://source.chromium.org/chromium/chromium/src/+/master:third_party/webxr_test_pages/webxr-samples/proposals/camera-access-barebones.html;bpv=0

import { checkGLError } from '@core/devTools';

let shaderProgram = null;
let vertexBuffer = null;
let aCoordLoc = null;
let uSamplerLoc = null;

// Only print each unique intrinsic string once.
const intrinsicsPrinted = {};

/** Calculates the camera intrinsics matrix from a projection matrix and viewport
 *
 * Projection matrix convention as per
 *   http://www.songho.ca/opengl/gl_projectionmatrix.html
 *
 * P = p0  p4  p8  p12
 *     p1  p5  p9  p13
 *     p2  p6  p10 p14
 *     p3  p7  p11 p15
 *
 * P = p0  p4  p8  0      = 2n/(r-l) skew     (r+l)/(r-l)   0
 *     0   p5  p9  0        0        2n/(t-b) (t+b)/(t-b)   0
 *     0   0   p10 p14      0        0        -(f+n)/(f-n) -2fn/(f-n)
 *     0   0   -1  0        0        0        -1            0
 *
 * The skew factor controls how much of the Y coordinate is mixed into the X coordinate.
 * It is usually zero, but WebXR allows nonzero skew values which results in rhomboid
 * (nonrectangular) pixels.
 *
 * The GL projection matrix transforms to clip space, then to NDC after perspective divide.
 * This needs to be scaled to pixels based on the viewport. The NDC x and y ranges (-1 .. 1)
 * are transformed to (vp.x .. vp.x + vp.width) and (vp.y .. vp.y + vp.height) respectively.
 * For example:
 *
 *   screen_x = vp.w * (ndc_x + 1) / 2 + vp.x
 *            = (vp.w/2) * ndc_x + (vp.w/2 + vp.x)
 *
 * Using a matrix S for the NDC-to-screen-coordinate transform, this is:
 *
 *   p_screen.xy = (S * p_ndc).xy
 *
 *   with S = vp.w/2  0       0  vp.w/2 + vp.x
 *            0       vp.h/2  0  vp.h/2 + vp.y
 *            0       0       1  0
 *            0       0       0  1
 *
 * This transforms a camera-space point into screen space as follows:
 *
 *   p_screen.xy = (S * p_ndc).xy
 *               = (S * p_clip).xy / p_clip.w
 *               = (S * P * p_camera).xy / (P * p_camera).w
 *               = (S * P * p_camera).xy / (-p_camera.z)
 *
 * Note that this uses the usual GL convention of looking along the negative Z axis, with
 * negative-z points being visible.
 *
 * Intrinsic matrix convention as per
 *   https://en.wikipedia.org/wiki/Camera_resectioning#Intrinsic_parameters
 *
 *   K = ax  gamma u0 0
 *       0   ay    v0 0
 *       0   0     1  0
 *
 * The intrinsic matrix K transforms from camera space to homogenous screen space, providing
 * pixel screen coordinates after the perspective divide. This convention assumes looking
 * along the positive Z axis, with positive-z points being visible.
 *
 * For compatibility with WebXR, invert the Z coordinate, and insert a placeholder 3rd row
 * to get a 4x4 matrix. This produces a modified intrinsic matrix K':
 *
 *   K' = 1  0  0  0 * K = ax  gamma -u0 0
 *        0  1  0  0       0   ay    -v0 0
 *        0  0 -1  0       *   *      *  *
 *        0  0  0  1       0   0      -1 0
 *
 * This results in the following transformation from camera space to screen space:
 *
 *   p_screen.xy = (K' * p_camera).xy / (K' * p_camera).w
 *               = (K' * p_camera).xy / (-p_camera.z)
 *
 * Since the p_screen.xy coordinates must be the same for both calculation methods, it
 * follows that the intrinsic matrix K' is simply S * P:
 *
 *   p_screen.xy = (K' * p_camera).xy / (-p_camera.z)
 *               = (S * P * p_camera).xy / (-p_camera.z)
 * => K' = S * P
 *
 * For example, K'[0,2] is -u0, and equals the product of row 0 of S with column 2 of P:
 *   K'[0,2] = S[0,] * P[,2]
 *   -u0 = [vp.v/2, 0, 0, vp.w/2 + vp.x] * [p8, p9, p10, -1]
 *       = (vp.w/2) * p8 + 0 * p9 + 0 * p10 + (vp.w/2 + vp.x) * (-1)
 *       = vp.w/2 * (p8 - 1) - vp.x
 * => u0 = vp.w/2 * (1 - p8) + vp.x
 *
 * Code from https://source.chromium.org/chromium/chromium/src/+/master:third_party/webxr_test_pages/webxr-samples/proposals/camera-access-barebones.html;bpv=0
 *
 */
export function getCameraIntrinsics(projectionMatrix, viewport) {
    const p = projectionMatrix;
    // Principal point in pixels (typically at or near the center of the viewport)
    let u0 = ((1 - p[8]) * viewport.width) / 2 + viewport.x;
    let v0 = ((1 - p[9]) * viewport.height) / 2 + viewport.y;
    // Focal lengths in pixels (these are equal for square pixels)
    let ax = (viewport.width / 2) * p[0];
    let ay = (viewport.height / 2) * p[5];
    // Skew factor in pixels (nonzero for rhomboid pixels)
    let gamma = (viewport.width / 2) * p[4];

    // Print the calculated intrinsics, but once per unique value to
    // avoid log spam. These can change every frame for some XR devices.
    const intrinsicString =
        'intrinsics: u0=' +
        u0 +
        ' v0=' +
        v0 +
        ' ax=' +
        ax +
        ' ay=' +
        ay +
        ' gamma=' +
        gamma +
        ' for viewport {width=' +
        viewport.width +
        ',height=' +
        viewport.height +
        ',x=' +
        viewport.x +
        ',y=' +
        viewport.y +
        '}';
    if (!intrinsicsPrinted[intrinsicString]) {
        console.log('projection:', Array.from(projectionMatrix).join(', '));
        console.log(intrinsicString);
        intrinsicsPrinted[intrinsicString] = true;
    }

    const cameraIntrinsics = {
        fx: ax,
        fy: ay,
        cx: u0,
        cy: v0,
        s: gamma,
    };
    return cameraIntrinsics;
}

export function initCameraCaptureScene(gl) {
    checkGLError(gl, 'initCameraCaptureScene() begin');

    var vertices = [-1.0, 1.0, 0.0];

    vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    var vertCode = 'attribute vec3 coordinates;' + 'void main(void) {' + 'gl_Position = vec4(coordinates, 1.0);' + 'gl_PointSize = 1.0;' + '}';
    var vertShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertShader, vertCode);
    gl.compileShader(vertShader);

    // NOTE: we must explicitly use the camera texture in drawing,
    // otherwise uSampler gets optimized away, and the
    // camera texture gets destroyed before we could capture it.
    var fragCode = 'uniform sampler2D uSampler;' + 'void main(void) {' + 'gl_FragColor = texture2D(uSampler, vec2(0,0));' + '}';
    var fragShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragShader, fragCode);
    gl.compileShader(fragShader);

    shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertShader);
    gl.attachShader(shaderProgram, fragShader);
    gl.linkProgram(shaderProgram);

    aCoordLoc = gl.getAttribLocation(shaderProgram, 'coordinates');
    uSamplerLoc = gl.getUniformLocation(shaderProgram, 'uSampler');

    checkGLError(gl, 'initCameraCaptureScene() end');
}

export function drawCameraCaptureScene(gl, cameraTexture) {
    checkGLError(gl, 'drawCameraCaptureScene() begin');

    // Save ID of the previous shader
    const prevShaderId = gl.getParameter(gl.CURRENT_PROGRAM);
    const prevActiveTexture = gl.getParameter(gl.ACTIVE_TEXTURE);
    const prevTextureId = gl.getParameter(gl.TEXTURE_BINDING_2D);
    const prevArrayBuffer = gl.getParameter(gl.ARRAY_BUFFER_BINDING);

    // Bind the shader program
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

    // cleanup
    gl.activeTexture(prevActiveTexture);
    gl.bindTexture(gl.TEXTURE_2D, prevTextureId);
    gl.disableVertexAttribArray(aCoordLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, prevArrayBuffer);
    gl.useProgram(prevShaderId);

    checkGLError(gl, 'drawCameraCaptureScene() end');
}

let readback_pixels = null; // buffer that stores the last image read from the GPU

/**
 * Converting a WebGLTexture to base64 encoded image.
 *
 * Copy paste from https://stackoverflow.com/questions/8191083/can-one-easily-create-an-html-image-element-from-a-webgl-texture-object
 * Pretty sure this can be optimized for this specific use.
 *
 * @param gl             Context of the canvas to use
 * @param texture        The texture to convert
 * @param imageWidth     Width of the resulting image
 * @param imageHeight    Height of the resulting image
 * @returns {string}     base64 encoded string of the image (will likely change)
 */
export function createImageFromTexture(gl, texture, imageWidth, imageHeight) {
    checkGLError(gl, 'createImageFromTexture() begin');

    const prev_framebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING); // save the screen framebuffer ID

    // Create a framebuffer backed by the texture
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    // Read the contents of the framebuffer
    const texture_bytes = imageWidth * imageHeight * 4;
    if (!readback_pixels || readback_pixels.length != texture_bytes) {
        readback_pixels = new Uint8Array(texture_bytes);
    }
    readback_pixels.fill(0); // init with black

    gl.readPixels(0, 0, imageWidth, imageHeight, gl.RGBA, gl.UNSIGNED_BYTE, readback_pixels);

    gl.bindFramebuffer(gl.FRAMEBUFFER, prev_framebuffer); // bind back the screen framebuffer
    gl.deleteFramebuffer(framebuffer);

    // Texel index (row-major):
    const middle_coords = (imageHeight / 2) * imageWidth + imageWidth / 2;

    // The multiplication (x4) is needed to convert from texel index to
    // byte index in our buffer (each texel is 4 bytes).
    const middle_color = readback_pixels.slice(4 * middle_coords, 4 * (middle_coords + 1));

    // Print out color in the middle of the texture.
    //console.debug("Color in the middle of the texture:", middle_color);
    const colorIsBlack = middle_color[0] == 0 && middle_color[1] == 0 && middle_color[2] == 0;
    const colorBlackMsg = 'The middle of the texture is black!';
    // It is very unlikely for the color in the middle of the texture to be pure black, so notify the user:
    if (colorIsBlack) {
        console.warn(colorBlackMsg);
    }

    // Create a 2D canvas to store the result
    const canvas = document.createElement('canvas');
    canvas.width = imageWidth;
    canvas.height = imageHeight;
    const context = canvas.getContext('2d');

    // Copy the pixels to a 2D canvas
    const imageData = context.createImageData(imageWidth, imageHeight);
    imageData.data.set(readback_pixels);

    // Image is vertically flipped
    // Didn't find a better way to flip the image back
    const imageFlip = new ImageData(canvas.width, canvas.height);
    const Npel = imageData.data.length / 4;

    for (let kPel = 0; kPel < Npel; kPel++) {
        const kFlip = flip_index(kPel, canvas.width, canvas.height);
        const offset = 4 * kPel;
        const offsetFlip = 4 * kFlip;
        imageFlip.data[offsetFlip] = imageData.data[offset];
        imageFlip.data[offsetFlip + 1] = imageData.data[offset + 1];
        imageFlip.data[offsetFlip + 2] = imageData.data[offset + 2];
        imageFlip.data[offsetFlip + 3] = imageData.data[offset + 3];
    }

    context.putImageData(imageFlip, 0, 0);
    let imageBase64 = canvas.toDataURL('image/jpeg');

    checkGLError(gl, 'createImageFromTexture() end');

    return imageBase64;
}

function flip_index(kPel, width, height) {
    var i = Math.floor(kPel / width);
    var j = kPel % width;

    return height * width - (i + 1) * width + j;
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
