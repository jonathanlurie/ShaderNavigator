//precision highp float;

varying  vec2 vUv;
varying  vec4 worldCoord;

void main()
{
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
  gl_Position = projectionMatrix * mvPosition;
  worldCoord = modelMatrix * vec4( position, 1.0 );
}
