var config = require('./package.json');

// being able to import glsl file as varialbes.
// Taken from Three.js
function glsl () {
	return {
		transform ( code, id ) {
			if ( !/\.glsl$/.test( id ) ) return;

			var transformedCode = 'export default ' + JSON.stringify(
				code
					.replace( /[ \t]*\/\/.*\n/g, '' )
					.replace( /[ \t]*\/\*[\s\S]*?\*\//g, '' )
					.replace( /\n{2,}/g, '\n' )
			) + ';';
			return {
				code: transformedCode,
				map: { mappings: '' }
			}
		}
	};
}

export default {
  entry: config.main, //'src/es6module.js',
  plugins: [
		glsl()
	],
  sourceMap: true,
  format: config.moduleFormat, //'umd',
  moduleName: config.moduleName, //'ES6MOD',
  dest: config.moduleBuildDir + '/' + config.name + '/' + config.name + '.js' //'build/es6module/es6module.js' // equivalent to --output
};
