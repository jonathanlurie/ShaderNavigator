# Shader Navigator
A work in progress to perform arbitrary slicing (aka. obliques) of large voxel dataset, using shaders on GPU, webGL, an octree data structure and few other things.

# Dependencies
We use [Rollup](https://github.com/rollup/rollup) to generate a singe file project compatible with ES6 spec. Install it globally with:

```sh
npm install -g rollup
```
At some point, we were using using Gulp to auto generate the project at every update, but it does not play well with the Rollup plugin that transform shader files into JS string.  

We use [DocumentationJS](https://github.com/documentationjs/documentation) (as a *devDependencies*) to generate the documentation.

# Commands

**Build project:**
```sh
$ npm run build
```
The single file output is `build/shadernavigator/shadernavigator.js`  

**Build the documentation:**
```sh
npm rund doc
```
The documentation is a web project (with an `index.html`) located in the folder `doc`.

# Run
Run a web server in the root directory and open `quadView.html`.
