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

  return vec3(  (world.x - textureOrigin.x)/chunkSize,
                 1.0 - (world.y - textureOrigin.y )/chunkSize,
                 1.0 - (world.z - textureOrigin.z )/chunkSize);
}



void main( void ) {

  // if out, just exit
  if(nbChunks == 0){
    discard;
    return;
  }

  // the position within the shader
  vec2 shaderPos = vUv;

  /*
  // display the edges of subplanes
  if(shaderPos.x < 0.01 || shaderPos.x > 0.99 || shaderPos.y < 0.01 || shaderPos.y > 0.99){
    gl_FragColor  = vec4(0.0, 0.0 , 0.0, 1.0);
    return;
  }
  */

  // default color when out
  vec4 color = vec4(1.0, 0.0 , 0.0, 1.0);
  vec3 chunkPosition;
  bool hasColorFromChunk = false;

  chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[0]);
  if( isInsideChunk(chunkPosition) ){
    color = getColorFrom3DTexture(textures[0], chunkPosition);
    hasColorFromChunk = true;
  } else if(nbChunks >= 2){
    chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[1]);
    if( isInsideChunk(chunkPosition) ){
      color = getColorFrom3DTexture(textures[1], chunkPosition);
      hasColorFromChunk = true;
    } else if(nbChunks >= 3){
      chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[2]);
      if( isInsideChunk(chunkPosition) ){
        color = getColorFrom3DTexture(textures[2], chunkPosition);
        hasColorFromChunk = true;
      } else if(nbChunks >= 4){
        chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[3]);
        if( isInsideChunk(chunkPosition) ){
          color = getColorFrom3DTexture(textures[3], chunkPosition);
          hasColorFromChunk = true;
        } else if(nbChunks >= 5){
          chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[4]);
          if( isInsideChunk(chunkPosition) ){
            color = getColorFrom3DTexture(textures[4], chunkPosition);
            hasColorFromChunk = true;
          } else if(nbChunks >= 6){
            chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[5]);
            if( isInsideChunk(chunkPosition) ){
              color = getColorFrom3DTexture(textures[5], chunkPosition);
              hasColorFromChunk = true;
            } else if(nbChunks >= 7){
              chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[6]);
              if( isInsideChunk(chunkPosition) ){
                color = getColorFrom3DTexture(textures[6], chunkPosition);
                hasColorFromChunk = true;
              } else if(nbChunks == 8){
                chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[7]);
                if( isInsideChunk(chunkPosition) ){
                  color = getColorFrom3DTexture(textures[7], chunkPosition);
                  hasColorFromChunk = true;
                }
              }
            }
          }
        }
      }
    }
  }


  // inside the box
  if(hasColorFromChunk){

    // we are using a colormap
    if(useColorMap){
      vec2 colorToPosition = vec2(color.r, 0.5);
      vec4 colorFromColorMap = texture2D(colorMap, colorToPosition);

      // the color from the colormap is not (fully) transparent
      if(colorFromColorMap.a > 0.0){
        colorFromColorMap.a = 0.85;
        gl_FragColor = colorFromColorMap;

      // the color from the colormap is fully transparent, simply not display it
      }else{
        discard;
      }

    // we are not using a colormap
    }else{
      color.a = 0.85;
      gl_FragColor = color;
    }


  // outside the box
  }else{
    discard;
    //gl_FragColor = vec4(0.8, 0.8 , 0.8, 1.0);
    //gl_FragColor = vec4(1.0, 0.0 , 1.0, 1.0);
  }



}
