# WebXR client for IEEE workshop

-- general info in preparation

## Development

npm needs to be installed, because dependencies are handled with it. 

Steps to setup the project: 
* clone this repository
* run `npm install` to download the dependencies
* run `npx devcert-cli generate localhost` to create self-signed certificates
* rename certificates to _snowpack.key_ and _snowpack.crt_
* run `npm run start`
* note the URL shown in the terminal after the server started


* open Chrome on an AR capable device, enter `chrome://flags` and enable _WebXR Incubations_
* enter the ULR shown in the terminal in the browser on the device 
* click through the self-signed certificate warning


**Feedback, recommendations and contributions of any kind are very welcome**
