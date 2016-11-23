const int maxNbChunks = 8;
uniform int nbChunks;
uniform sampler2D textures[maxNbChunks];
uniform vec3 textureOrigins[maxNbChunks];

uniform float chunkSize;


varying vec4 worldCoord;
varying vec2 vUv;

bool isNan(float val)
{
  return (val <= 0.0 || 0.0 <= val) ? false : true;
}


/*
  check if chunkPosition is in [0.0, 1.0]
*/
bool isInsideChunk(in vec3 chunkPosition){
  // maybe optimal to return
  return !( chunkPosition.x<0.0 || chunkPosition.x>=1.0 ||
            chunkPosition.y<0.0 || chunkPosition.y>=1.0 ||
            chunkPosition.z<0.0 || chunkPosition.z>=1.0 );
}


/*
  position is a [x, y, z] vector in [0.0; 1.0] within the texture chunk.
  Args:
    x = u
    y = v
    z = depth (image number within the strip)
    texture = the texture strip (to simulate a 3D tex)
*/
void getColorFrom3DTexture(in sampler2D texture, in vec3 chunkPosition, out vec4 colorFromTexture){

  // number of image that compose the strip
  float numberOfImagePerStripY = 64.0;

  // each image of the texture is square-shaped
  float numberOfPixelPerSide = 64.0;

  // normalized starting point depending on the image index
  float yOffsetNormalized = float(int(chunkPosition.z * numberOfImagePerStripY)) / numberOfImagePerStripY;

  float stripX = chunkPosition.x;
  float stripY = chunkPosition.y / numberOfImagePerStripY + yOffsetNormalized;

  vec2 posWithinStrip = vec2(stripX, stripY);
  colorFromTexture = texture2D(texture, posWithinStrip);

  //colorFromTexture = vec4(colorFromTexture.r, colorFromTexture.g, colorFromTexture.b, 0.5);

}


/*
  translate world coordinates to chunk relative coordinates
  giving a chunk center and size.

  Return a vec3 with xyz in [0.0, 1.0]
*/
vec3 worldCoord2ChunkCoord(vec4 world, vec3 textureOrigin, float chunkSize){

  vec3 chunkSystemCoordinate = vec3( (textureOrigin.x - world.x)*(-1.0)/chunkSize,
                                    1.0 - (textureOrigin.y - world.y)*(-1.0)/chunkSize,
                                    1.0 - (textureOrigin.z - world.z)*(-1.0)/chunkSize);


  /*
  vec3 chunkSystemCoordinate = vec3( (textureOrigin.x - world.x)*(-1.0)/chunkSize,
                                    1.0 - (textureOrigin.z - world.z)*(1.0)/chunkSize,
                                    1.0 - (textureOrigin.y - world.y)*(-1.0)/chunkSize);
  */
  return chunkSystemCoordinate;
}



void main( void ) {

  // the position within the shader
  vec2 shaderPos = vUv;

  // default color when out
  vec4 color = vec4(0.0, 0.0 , 0.0, 0.0);

  vec3 chunkPosition;

  bool mustWrite = false;

  if(nbChunks >= 1){
    chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[0], chunkSize);
    if( isInsideChunk(chunkPosition) ){
      getColorFrom3DTexture(textures[0], chunkPosition, color);
      mustWrite = true;
    }

    if(nbChunks >= 2){
      chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[1], chunkSize);
      if( isInsideChunk(chunkPosition) ){
        getColorFrom3DTexture(textures[1], chunkPosition, color);
        mustWrite = true;
      }

      if(nbChunks >= 3){
        chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[2], chunkSize);
        if( isInsideChunk(chunkPosition) ){
          getColorFrom3DTexture(textures[2], chunkPosition, color);
          mustWrite = true;
        }

        if(nbChunks >= 4){
          chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[3], chunkSize);
          if( isInsideChunk(chunkPosition) ){
            getColorFrom3DTexture(textures[3], chunkPosition, color);
            mustWrite = true;
          }

          if(nbChunks >= 5){
            chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[4], chunkSize);
            if( isInsideChunk(chunkPosition) ){
              getColorFrom3DTexture(textures[4], chunkPosition, color);
              mustWrite = true;
            }

            if(nbChunks >= 6){
              chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[5], chunkSize);
              if( isInsideChunk(chunkPosition) ){
                getColorFrom3DTexture(textures[5], chunkPosition, color);
                mustWrite = true;
              }

              if(nbChunks >= 7){
                chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[6], chunkSize);
                if( isInsideChunk(chunkPosition) ){
                  getColorFrom3DTexture(textures[6], chunkPosition, color);
                  mustWrite = true;
                }

                if(nbChunks == 8){
                  chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[7], chunkSize);
                  if( isInsideChunk(chunkPosition) ){
                    getColorFrom3DTexture(textures[7], chunkPosition, color);
                    mustWrite = true;
                  }

                }
              }
            }
          }
        }
      }
    }
  }

  if(mustWrite){
    gl_FragColor = color;
  }else{
    discard;
  }

}
