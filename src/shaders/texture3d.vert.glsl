//uniform vec3 textureOrigins[2];
uniform float chunkSize;
uniform sampler2D colorMap;

varying vec2 vUv;
varying vec4 worldCoord;

void main()
{
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
  gl_Position = projectionMatrix * mvPosition;
  worldCoord = modelMatrix * vec4( position, 1.0 );
}
