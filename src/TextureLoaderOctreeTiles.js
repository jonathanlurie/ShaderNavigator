'use strict';

import { TextureLoaderInterface } from './TextureLoaderInterface.js';


/**
* A TextureLoaderOctreeTiles is a specialization of TextureLoaderInterface. It loads a texture for a texture chunk directly from a image file in an octree 3D tiling architecture.
*/
class TextureLoaderOctreeTiles extends TextureLoaderInterface{

  constructor( textureChunk ){
    super(textureChunk);
  }


  /**
  * [PRIVATE]
  * Fetch some data from the this._textureChunk to build the name of the texture file
  */
  _buildFileName(){
    // load some data from the texture chunk
    let index3D = this._textureChunk.getIndex3D();
    let voxelPerSide = this._textureChunk.getVoxelPerSide();
    let workingDir = this._textureChunk.getWorkingDir();
    let resolutionLevel = this._textureChunk.getResolutionLevel();

    let sagitalRangeStart = index3D[0] * voxelPerSide;
    let coronalRangeStart = index3D[1] * voxelPerSide;
    let axialRangeStart   = index3D[2] * voxelPerSide;

    /** Texture file, build from its index3D and resolutionLevel */

    // build the filepath
    var filepath =  workingDir + "/" + resolutionLevel + "/" +
                  sagitalRangeStart + "-" + (sagitalRangeStart + voxelPerSide) + "/" +
                  coronalRangeStart + "-" + (coronalRangeStart + voxelPerSide) + "/" +
                  axialRangeStart   + "-" + (axialRangeStart + voxelPerSide);

    return filepath;
  }


  /**
  * Load the octree image as a THREE.Texture and set it in the TextureChunk object
  */
  loadTexture(){
    // first, we need it's filename to get it from the octree
    var filepath = this._buildFileName();
    var that = this;

    var threeJsTexture = new THREE.TextureLoader().load(
      filepath, // url
      function(){
        // ensure we are using nearest neighbors
        threeJsTexture.magFilter = THREE.NearestFilter;
        threeJsTexture.minFilter = THREE.NearestFilter;

        that._textureChunk.setTexture(threeJsTexture);
        that._textureChunk.onTextureSuccessToLoad();
      }, // on load
      function(){}, // on progress, do nothing

      function(){ // on error
        that._textureChunk.onTextureFailedToLoad();
      }
    );

  }


} /* END class TextureLoaderOctreeTiles */

export { TextureLoaderOctreeTiles };
