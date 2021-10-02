<script>

// ----------------------------------------------------------- USER INTERFACE

// The main element
let mainElement = document.getElementById("WebXRExperience");
if (!mainElement) mainElement = 
	createDomElement("div", "WebXRExperience", document.body,
	"", "", "width:100%; height:100%; display: none;");

// The back button
let backButton = document.getElementById("WebXRExperienceBackButton");
if (!backButton) backButton = createDomElement("div", 
	"WebXRExperienceBackButton", mainElement, "<-", "", 
	"position: fixed; bottom:-0.4cm; left:-0.4cm; width:2cm; height:2cm;" +
	"background:blue; color:white; border-radius: 1cm; font: 1cm arial; " +
	"text-align:center; padding: 0.3cm 0.3cm; box-sizing: border-box;");

// The plus button
let plusButton = document.getElementById("WebXRExperiencePlusButton");
if (!plusButton) plusButton = createDomElement("div", 
	"WebXRExperiencePlusButton", mainElement, "+", "", 
	"position: fixed; bottom:-0.4cm; right:-0.4cm; width:2cm; height:2cm;" +
	"background:blue; color:white; border-radius: 1cm; font: 1cm arial; " +
	"text-align:center; padding: 0.3cm 0.3cm; box-sizing: border-box;");



// -------------------------------------------------------------- HTML ELEMENTS

/** Creates a DOM element
 * @param type The type of the element (its tag name)
 * @param id The id of the element.
 * @param classes The classes of the element.
 * @param parent The parent of the element.
 * @param content The HTML content of the element.
 * @param style The style of the element.
 * @returns The generated element. */
 function createDomElement(type, id, parent, content, classes, style) {

	// Create the element
	let element = document.createElement(type);

	// Set the properties of the element
	if (id) element.id = id;
	if (classes) element.className = classes;
	if (style) element.style.cssText = style;
	if (content) element.innerHTML = content;

	// Set the parent of element
	((parent) ? parent : document.body).appendChild(element);

	// Return the generated element
	return element;
}


/** Creates a CSS rule.
* @param selector The CSS selector
* @param rule The css rule
* @param override Indicates whether to override rules or not. */
function addCssRule(selector, rule, override = false) {

	// If there is no stylesheet, create it
	if (document.styleSheets.length == 0)
		document.head.append(document.createElement('style'));
	let stylesheet = document.styleSheets[0];

	// Check if the rule exists
	let rules = stylesheet.cssRules, ruleIndex, ruleCount = rules.length;
	for (let ruleIndex = 0; ruleIndex < ruleCount; ruleIndex++) {
		if (rules[ruleIndex].cssText.startsWith(selector)) {
			if (override) rules[ruleIndex].cssText = selector + " {"+rule+"}";
			else return;
		}
	}

	// If no rule was fond, create i and add it at the end
	stylesheet.insertRule(selector + " {" + rule + "}", ruleCount);
}


// ---------------------------------------------------------------- DEBUG PANEL

// Create the debug panel element
let debugPanel = createDomElement("div", "DebugPanel", mainElement);
let debugHeader = createDomElement("div", "DebugHeader", debugPanel, "");
let debugTitle = createDomElement("div", "DebugTitle", debugHeader, "Debug: ");
let debugMessages = createDomElement("div", "DebugMessages", debugPanel);
let debugButtons = createDomElement("div", "DebugButtons", debugHeader);
let debugClear = createDomElement("button", "DebugClear", debugButtons, "Clear");
let debugClose = createDomElement("button", "DebugClose", debugButtons, "X");
debugClear.onclick = clearDebugMessages; debugClose.onclick = hideDebugPanel;

addCssRule("#DebugPanel", "position: fixed; width:100%; height: 50%; " +
	"bottom:0; z-index: 1000; background-color: #00000080; color:white; " +
	"overflow-y: auto; font-family: arial;");
addCssRule("#DebugHeader", "background: #00000040; width:100%; padding:1vmin;" +
	"display: flex; justify-content: space-between;");
addCssRule("#DebugMessages", "overflow-y: auto;");
addCssRule("#DebugMessages p", "margin: 1vmin;");
addCssRule("#LoadingScreen", " position:fixed; margin:0; border:none; " +
	"width:100%; height:100%; z-index:900; background:black; color:white;");


/** Shows the debug panel. */
function showDebugPanel() { debugPanel.style.display = "block"; }

/** Hides the debug panel. */
function hideDebugPanel() { debugPanel.style.display = "none"; }

/** Toggles the debug panel visibility. */
function toggleDebugPanel() { debugPanel.style.display = 
	(debugPanel.style.display == "none")? "block": "none"; 
}

/** Sets the debug panel.
 * @param text The text of the panel title. */
function setDebugPanelTitle (text) { debugTitle.innerText = "Debug: " + text; }

/** Captures console messages and displays them. 
* @param text The text of the debug message.
* @param type The type of debug message. */
function createDebugMessage(text, type = 0) {
	let element = document.createElement("p");
	switch (type) {
		case 0: element.style.color = "white"; break;	// Info message
		case 1: element.style.color = "yellow"; break;	// Warning message
		case 2: element.style.color = "red"; break;		// Error message
	}
	element.innerText = text;
	debugMessages.append(element);
	if(type == 2) showDebugPanel();
}

/** Clears the console messages. */
function clearDebugMessages() { debugMessages.innerHTML = ""; }

// Capture console messages
let oldInfo = console.log, oldWarning = console.warn, oldError = console.error;
console.log = (msg) => { createDebugMessage(msg, 0); oldInfo(msg); };
console.warn = (msg) => { createDebugMessage(msg, 1); oldWarning(msg); };
console.error = (msg) => { createDebugMessage(msg, 2); oldError(msg); };

// Capture error messages
window.onerror = (message, source, lineno, colno, error) => {
	createDebugMessage(error + " in line " + lineno + " of " + source, 2);
}
window.onunhandledrejection = (e) => { createDebugMessage(e.reason, 2); };
window.onkeyup = (e) => { if (e.code == "Backquote") toggleDebugPanel(); }
window.ontouchstart = (e) => { if (e.touches.length > 2) toggleDebugPanel(); }

// Start with the debug panel hidden
hideDebugPanel();


// -------------------------------------------------------------------- GEOPOSE

/** Defines a basic GeoPose with orientation angles. */
class GeoPose {
	constructor(latitude=0, longitude=0, altitude=0, yaw=0, pitch=0, roll=0) {
		this.latitude = latitude; this.longitude = longitude; 
		this.altitude = altitude;
		this.yaw = yaw; this.pitch = pitch; this.roll = roll;
	}
}

// Obtain the camera location using the GeoLocation API
// See: https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API
if (navigator.geolocation) {
	navigator.geolocation.watchPosition((data)=> {
		cameraGeoPose.latitude = data.coords.latitude; 
		cameraGeoPose.longitude = data.coords.longitude; 
		cameraGeoPose.altitude = data.coords.altitude;
		// TODO Adjust the altitude to the WPS84 ellipsoid instead of sea level
		// TODO Check other methods to calculate the height over ellipsoid
		// See https://nextnav.com/
	});
} else throw Error ("Unable to obtain the camera location");

// Obtain the camera orientation using the DeviceOrientationEvent API
// See: https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent
let cameraGeoPose = new GeoPose();
if (window.DeviceOrientationEvent) {
	window.addEventListener("deviceorientation", function(data) {
		cameraGeoPose.yaw = data.alpha + yawOffset;
		cameraGeoPose.pitch = data.beta;
		cameraGeoPose.roll = data.gamma;
	}, true);
} else throw Error ("Unable to obtain camera orientation");

// Create an offset value for the yaw orientation to point to the north in case 
// the magnetometer doesn't work
let yawOffset = 0;
document.body.onpointermove = (e) => { yawOffset += e.movementX; }


// ----------------------------------------------------------- WEBXR EXPERIENCE

// The elements of the WebXR experience
let gl, canvas, renderer, scene, camera, sunlight, session, pose, reticle,
	referenceSpace, viewerSpace, hitTestSource, signPost,
	currentTime = 0, lastTime = 0, deltaTime, fpsTime = 0, fpsCounter = 0, fps;

/** Initializes the WebXR experience. */
async function initWebXRExperience() {
	
	// Show the main element
	mainElement.style.display = "block";

	//Load the Threejs
	console.log("Loading Threejs");
	let loaded = false;
	try { loaded = (THREE !== undefined) } catch (e) {}
	if (!loaded) {
		let script = createDomElement("script", null, document.body);
	 	script.src = "https://unpkg.com/three@0.126.0/build/three.js"
	 	requestAnimationFrame(loadWebXRExperience);
	}
}

/** Loads the elements of the WebXR experience. */
async function loadWebXRExperience() {
	let loaded = false;
	try { loaded = (THREE !== undefined); } catch (e) {}
	if (loaded) startWebXRExperience();
	else requestAnimationFrame(loadWebXRExperience);
}

/** Starts the WebXR experience. */
async function startWebXRExperience() {
	
	// Check WebXR support
	if (navigator.xr == undefined) throw new Error("XR is not supported");

	// Add a canvas element and initialize a WebGL context
	canvas = document.createElement("canvas", mainElement);
	mainElement.appendChild(canvas);
	gl = canvas.getContext("webgl", {xrCompatible: true});

	// Set up the renderer
	renderer = new THREE.WebGLRenderer({ alpha: true,
		preserveDrawingBuffer: true, canvas: canvas, context: gl});
	renderer.autoClear = false;
	let width =  window.innerWidth , height = window.innerHeight;
	renderer.setSize(width, height);

	// Create the scene
	scene = new THREE.Scene();

	// Create the lights
	scene.add(new THREE.AmbientLight(0x666666,2));
	sunlight = new THREE.SpotLight(0xffffff);
	sunlight.position.set(0,10,0);
	sunlight.rotation.set(Math.PI, 0, 0);
	scene.add(sunlight);
	// sunlight.castShadow = true;
	// sunlight.shadow.mapSize.width = 512; // default
	// sunlight.shadow.mapSize.height = 512; // default
	// sunlight.shadow.camera.near = 0.5; // default
	// sunlight.shadow.camera.far = 500; // default
	// sunlight.shadow.focus = 1; // default

	// Create the camera
	// Disable matrix auto updates so three.js doesn't attempt
	// to handle the matrices independently.
	camera = new THREE.PerspectiveCamera(75, width/height, 0.01, 100);
	camera.updateProjectionMatrix();
	camera.matrixAutoUpdate = false;

	// Create the reticle
	reticle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1 , 0.01, 32), 
		new THREE.MeshPhongMaterial({color:0x0000AA, opacity:0.5, 
			transparent: true}));
	reticle.position.z = -5;
	scene.add(reticle); reticle.visible = false;

	// Initialize a WebXR session using "immersive-ar".
	session = await navigator.xr.requestSession("immersive-ar", {
		optionalFeatures: ['dom-overlay'], domOverlay: {root: mainElement}, 
		requiredFeatures: ['hit-test']
	});
	session.updateRenderState({baseLayer: new XRWebGLLayer(session, gl)});
	
	// Free the resources when the XR session ends
	session.onend = (event) => { session = null; };

	// A 'local' reference space has a native origin that is located
	// near the viewer's position at the time the session was created.
	referenceSpace = await session.requestReferenceSpace('local');

	// Create another XRReferenceSpace that has the viewer as the origin.
	viewerSpace = await session.requestReferenceSpace('viewer');

	// Perform hit testing using the viewer as origin.
	hitTestSource = await session.requestHitTestSource({ space: viewerSpace });

	// Define the behaviours associated to the buttons
	backButton.onclick = () => { shutdownWebXRExperience() };
	plusButton.onclick = () => {
		if(reticle.visible) {
			signPost = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,2,32), 
				new THREE.MeshPhongMaterial({color: 0xff8800}));
			signPost.position.copy(reticle.position);
			signPost.position.y +=1 ;
			scene.add(signPost);
		}
	};

	// Start updating the XR session 
	session.requestAnimationFrame(updateWebXRExperience);
}


/** Updates the the demo XR session.
* @param time The new time.
* @param frame The frame of reference. */
function updateWebXRExperience(time, frame) {

	// Calculate the FPS
	currentTime = time / 1000; deltaTime = currentTime - lastTime;
	lastTime = currentTime; fpsTime += deltaTime; fpsCounter++;
	if(fpsTime > 1) { 
		fpsTime %= 1; fps = fpsCounter; fpsCounter = 0;
		if(debugTitle) debugTitle.innerText = "Debug: FPS: " + fps;
	}

	// Queue up the next draw request.
	session.requestAnimationFrame(updateWebXRExperience);

	// Bind the graphics framebuffer to the baseLayer's framebuffer
	gl.bindFramebuffer(gl.FRAMEBUFFER, session.renderState.baseLayer.framebuffer);

	// Retrieve the pose of the device. XRFrame.getViewerPose can return 
	// null while the session attempts to establish tracking.
	if (frame) pose = frame.getViewerPose(referenceSpace);
	if (pose) {
		// In mobile AR, we only have one view.
		const view = pose.views[0];
		const viewport = session.renderState.baseLayer.getViewport(view);
		renderer.setSize(viewport.width, viewport.height);

		// Use the view's transform matrix and projection matrix to configure 
		//the THREE.camera.
		camera.matrix.fromArray(view.transform.matrix)
		camera.projectionMatrix.fromArray(view.projectionMatrix);
		camera.updateMatrixWorld(true);

		// Set the reticle
		const hitTestResults = frame.getHitTestResults(hitTestSource);
		reticle.visible = (signPost)? false: true;
		if (hitTestResults.length > 0 && reticle.visible) {
			const hitPose = hitTestResults[0].getPose(referenceSpace);
			let p = hitPose.transform.position, 
			r = hitPose.transform.orientation;
			reticle.position.set(p.x, p.y, p.z);
			reticle.rotation.set(0,0,0);
			// reticle.rotation.setFromQuaternion(new THREE.Quaternion(
			// 	r.x,r.y,r.z,r.w));
			// reticle.rotateY(-cameraGeoPose.yaw * Math.PI/180);
			reticle.updateMatrixWorld(true);
		}
	} else reticle.visible = false;

	// Render the scene with THREE.WebGLRenderer.
	renderer.render(scene, camera);
}

/** Shuts down the XR session. */
async function shutdownWebXRExperience() { if (session) await session.end(); }
</script>


<button on:click={initWebXRExperience}>Start Demo</button>
