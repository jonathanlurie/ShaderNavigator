//precision highp float;

// a max number we allow
const int maxNbChunks = 8;

// number of image that compose the strip
const float numberOfImagePerStripY = 64.0;

// each image of the texture is square-shaped
const float numberOfPixelPerSide = 64.0;

// refreshed by main program
uniform int nbChunks;
uniform sampler2D textures[maxNbChunks];
uniform vec3 textureOrigins[maxNbChunks];
uniform sampler2D colorMap;
uniform bool useColorMap;
uniform float chunkSize;

varying  vec4 worldCoord;
varying  vec2 vUv;

bool isNan(float val)
{
  return (val <= 0.0 || 0.0 <= val) ? false : true;
}


/*
  check if chunkPosition is in [0.0, 1.0]
*/
bool isInsideChunk(in vec3 chunkPosition){

  return  ( chunkPosition.x>=0.0 && chunkPosition.x<1.0 &&
            chunkPosition.y>=0.0 && chunkPosition.y<1.0 &&
            chunkPosition.z>=0.0 && chunkPosition.z<1.0 );

}


/*
  position is a [x, y, z] vector in [0.0; 1.0] within the texture chunk.
  Args:
    x = u
    y = v
    z = depth (image number within the strip)
    texture = the texture strip (to simulate a 3D tex)
*/
vec4 getColorFrom3DTexture(in sampler2D texture, in vec3 chunkPosition){

  // normalized starting point depending on the image index
  float yOffsetNormalized = float(int(chunkPosition.z * numberOfImagePerStripY)) / numberOfImagePerStripY ;

  float stripX = chunkPosition.x;// + 1.0/64.0/2.0;
  float stripY = chunkPosition.y / numberOfImagePerStripY + yOffsetNormalized;// + 1.0/4096.0/2.0;

  vec2 posWithinStrip = vec2(stripX, stripY);
  return texture2D(texture, posWithinStrip);

}


/*
  translate world coordinates to chunk relative coordinates
  giving a chunk center and size.

  Return a vec3 with xyz in [0.0, 1.0]
*/
vec3 worldCoord2ChunkCoord(vec4 world, vec3 textureOrigin){

  return vec3(  (world.x - textureOrigin.x)/chunkSize + (1.0 / numberOfPixelPerSide / 2.0),
                 1.0 - (world.y - textureOrigin.y )/chunkSize + (1.0 / numberOfPixelPerSide / 2.0),
                 1.0 - (world.z - textureOrigin.z )/chunkSize) + (1.0 / numberOfPixelPerSide / 2.0);
}



void main( void ) {

  // if out, just exit
  if(nbChunks == 0){
    discard;
    return;
  }

  // the position within the shader
  vec2 shaderPos = vUv;

  // display the edges of subplanes
  if(shaderPos.x < 0.01 || shaderPos.x > 0.99 || shaderPos.y < 0.01 || shaderPos.y > 0.99){
    gl_FragColor  = vec4(0.0, 0.0 , 0.0, 1.0);
    return;
  }

  // default color when out
  vec4 color = vec4(1.0, 0.0 , 0.0, 1.0);
  vec4 color2 = vec4(1.0, 0.0 , 0.0, 1.0);
  vec3 chunkPosition;
  bool hasColorFromChunk = false;

  for(int i=0; i<maxNbChunks; i++)
  {

    if( i == nbChunks ){
      break;
    }

    chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[i]);

    if( isInsideChunk(chunkPosition) ){
      color = getColorFrom3DTexture(textures[i], chunkPosition);
      hasColorFromChunk = true;
      break;
    }

  }

  if( hasColorFromChunk ){
    gl_FragColor = color;
  }else{
    gl_FragColor = vec4(1.0, 0.0 , 1.0, 1.0);
    //discard;
  }


  return ;




}
