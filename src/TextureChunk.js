'use strict';


/*

  TODO: give the possibility to clean/remove the texture object, and with a flag,
  getting to know if it's still loaded or not. It can be interesting to do it for
  an entire zoom level to free some memory when we are currently using another
  zoom level.

*/

/**
* Represent a cubic chunk of texture. Should be part of a {@link LevelManager}.
*/
class TextureChunk{

  /**
  * Initialize a TextureChunk object, but still, buildFromIndex3D() or buildFromWorldPosition() needs to be called to properly position the chunk in world coord.
  *
  * @param {number} resolutionLevel - The level of resolution, the lower the level, the lower the resolution. Level n has a metric resolution per voxel twice lower/poorer than level n+1, as a result, level n has 8 time less chunks than level n+1, remember we are in 3D!.
  * @param {Number} voxelPerSide - Number of pixel/voxel per side of the chunk, most likely 64.
  * @param {Number} sizeWC - Size of the chunk in world coordinates. Most likely 1/2^resolutionLevel.
  * @param {String} workingDir - The folder containing the config file (JSON) and the resolution level folder.
  */
  constructor(resolutionLevel, voxelPerSide, sizeWC, workingDir){

    /** Number of voxel per side of the chunk (suposedly cube shaped). Used as a constant.*/
    this._voxelPerSide = voxelPerSide;//64;

    this._workingDir = workingDir;

    /**
    * The level of resolution, the lower the level, the lower the resolution. Level n has a metric resolution per voxel twice lower/poorer than level n+1, as a result, level n has 8 time less chunks than level n+1 (remember we are in 3D!).
    */
    this._resolutionLevel = resolutionLevel;

    /** Size of a chunk in 3D space (aka. in world coordinates) */
    this._sizeWC = sizeWC; //this._chunkSizeLvlZero / Math.pow(2, this._resolutionLevel);

    /** The actuall THREE.Texture */
    this._threeJsTexture = null;

    /** True only if totally build, with index and world coordinates origin */
    this._isBuilt = false;

    /** in case the texture file was unable to load, this flag goes true */
    this._textureLoadingError = false;
    this._triedToLoad = false;
  }


  /**
  * Has to be called explicitely just after the constructor (unless you call buildFromWorldPosition() instead). Finishes to build the chunk.
  * @param {Array} index3D - The index position in the octree. Each members [x, y, z] are interger.
  */
  buildFromIndex3D(index3D){
    /**
    * The index position in the octree. Each members are interger.
    */
    this._index3D = index3D.slice();
    this._findChunkOrigin();
    this._buildFileName();

    // try to load only if never tried
    if( !this._triedToLoad){
      this._loadTexture();
    }

    this._isBuilt = true;
  }


  /**
  * [PRIVATE] Finds a chunk origin using its _index3D and _sizeWC.
  * the origin is used by the shader.
  */
  _findChunkOrigin(){
    /**
    * Origin of the chunk in world cooridnates. Is a [x, y, z] Array.
    * Is computed from the sizeWC and the index3D
    */




    this._originWC =[
      this._index3D[0] * this._sizeWC * (1),
      this._index3D[1] * this._sizeWC * (1),
      this._index3D[2] * this._sizeWC * (1)
    ];
  }


  /**
  * [PRIVATE] Build the string of the chunk path to load.
  */
  _buildFileName(){

    let sagitalRangeStart = this._index3D[0] * this._voxelPerSide;
    let coronalRangeStart = this._index3D[1] * this._voxelPerSide;
    let axialRangeStart   = this._index3D[2] * this._voxelPerSide;

    /** Texture file, build from its index3D and resolutionLevel */

/*
    // former
    this._filepath =  this._workingDir + "/" + this._resolutionLevel + "/" +
                  sagitalRangeStart + "-" + (sagitalRangeStart + this._voxelPerSide) + "/" +
                  coronalRangeStart + "-" + (coronalRangeStart + this._voxelPerSide) + "/" +
                  axialRangeStart   + "-" + (axialRangeStart + this._voxelPerSide);
    */

    this._filepath =  this._workingDir + "/" + this._resolutionLevel + "/" +
                  sagitalRangeStart + "-" + (sagitalRangeStart + this._voxelPerSide) + "/" +
                  coronalRangeStart + "-" + (coronalRangeStart + this._voxelPerSide) + "/" +
                  axialRangeStart   + "-" + (axialRangeStart + this._voxelPerSide);

    console.log("---------------------------------");
    console.log("_filepath:");
    console.log(this._filepath);
    console.log("_index3D:");
    console.log(this._index3D);
    console.log("_sizeWC:");
    console.log(this._sizeWC);
    console.log("_originWC:");
    console.log(this._originWC);

  }


  /**
  * [PRIVATE] Loads the actual image file as a THREE js texture.
  */
  _loadTexture(){
    var that = this;

    this._threeJsTexture = new THREE.TextureLoader().load(
      this._filepath, // url
      function(){
        console.log('sucsess');
        that._textureLoadingError = false;
        that._triedToLoad = true;

      }, // on load
      function(){}, // on progress

      function(){ // on error
        //console.error("ERROR TEXTURE " + that._filepath);
        that._threeJsTexture = null;
        that._textureLoadingError = true;
        that._triedToLoad = true;
      }
    );

    this._threeJsTexture.magFilter = THREE.NearestFilter;
    this._threeJsTexture.minFilter = THREE.NearestFilter;

  }



  /**
  * Returns an object contain the THREE.Texture, the origin as an array [x, y, z]
  * and a boolean specifying the validity.
  * @return {Object}
  */
  getChunkTextureData(){
    return {
      texture: this._threeJsTexture,
      origin: this._originWC,
      valid: !this._textureLoadingError
    }
  }


  /**
  * @return {String} the current texture filepath to load.
  */
  getTextureFilepath(){
    return this._filepath;
  }


  /**
  * Return true if the chunk was not able to load its texture.
  */
  loadingError(){
    return this._textureLoadingError;
  }

}

export { TextureChunk };
