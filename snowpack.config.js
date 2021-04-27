/** @type {import("snowpack").SnowpackUserConfig } */

module.exports = {
  mount: {
    public: {url: '/', static: true},
    src: {url: '/dist'},
  },
  plugins: [
      '@snowpack/plugin-svelte',
      '@snowpack/plugin-dotenv',
      'snowpack-plugin-glslify'
    ],
  routes: [
    // {
    //   "match": "routes",
    //   "src": ".*",
    //   "dest": "/index.html"
    // }
  ],
  optimize: {
    // bundle: true,
  },
  packageOptions: {
    // source: "remote"
  },
  devOptions: {
    secure: false,
    hostname: '0.0.0.0',
    open: 'none'
  },
  buildOptions: {
    htmlFragments: true
  },
  alias: {
    '@components': './src/components',
    '@core': './src/core',
    '@public': './public',
    '@shaders': './src/core/engines/ogl/shaders',
    '@src': './src',
    '@thirdparty': './src/third-party'
  }
};
