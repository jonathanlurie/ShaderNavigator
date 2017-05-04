'use strict';

import { TextureLoaderOctreeTiles } from './TextureLoaderOctreeTiles.js';

/*

  TODO: give the possibility to clean/remove the texture object, and with a flag,
  getting to know if it's still loaded or not. It can be interesting to do it for
  an entire zoom level to free some memory when we are currently using another
  zoom level.

  NOTE: take into consideration that other zoom levels than the main/current are possibly in use due to minimap display.

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
  * @param {String} chunkID - the string ID this chunk has within the ChunkCollection. This is used by the callbacks when succeding or failing to load the texture file.
  * @param {String} datatype - Type of data, but for now only "octree_tiles" is ok
  * @param {Array} matrix3DSize - Number of chunks in each dimension [x, y, z] that are supposedly available.
  */
  constructor(resolutionLevel, voxelPerSide, sizeWC, workingDir, chunkID, datatype, matrix3DSize){
    /** the string ID this chunk has within the ChunkCollection. This is used by the callbacks when succeding or failing to load the texture file */
    this._chunkID = chunkID;

    this._matrix3DSize = matrix3DSize;

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

    /** callback when a texture is successfully load. Defined using onTextureLoaded( ... ) */
    this._onTextureLoadedCallback = null;

    /** callback when a texture failled to be loaded. Defined using onTextureLoadError( ... ) */
    this._onTextureLoadErrorCallback = null;

    /** The texture loader takes _this_ in argument because it will need some local info but depending on the datatype, different info may be asked */
    this._textureLoader = null;

    // the data is stored as an octree 3D tiling structure
    if(datatype == "precomputed_octree_tiles")
      this._textureLoader = new TextureLoaderOctreeTiles( this );

  }


  /**
  * @return this._voxelPerSide
  */
  getVoxelPerSide(){
    return this._voxelPerSide;
  }

  /**
  * @return a copy of the this_index3D (Array)
  */
  getIndex3D(){
    return this._index3D.slice();
  }


  /**
  * @return the working directory
  */
  getWorkingDir(){
    return this._workingDir;
  }


  /**
  * @return the resolution level
  */
  getResolutionLevel(){
    return this._resolutionLevel;
  }


  /**
  * Set the texture
  * @param {THREE.Texture} t - Texture loaded by a TextureLoader
  */
  setTexture(t){
    this._threeJsTexture = t;
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


    // try to load only if never tried
    if( !this._triedToLoad){
      this._textureLoader.loadTexture();
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

    this._originWC = new THREE.Vector3(
      this._index3D[0] * this._sizeWC,
      this._index3D[1] * this._sizeWC,
      this._index3D[2] * this._sizeWC
    );

  }


  /**
  * Called by a TextureLoader when the texture is loaded successfully
  */
  onTextureSuccessToLoad(){
    //console.log('SUCCESS LOAD: ' + this._filepath );
    this._textureLoadingError = false;
    this._triedToLoad = true;

    // calling the success callback if defined
    if( this._onTextureLoadedCallback ){
      this._onTextureLoadedCallback( this._chunkID );
    }
  }


  /**
  * called by a TextureLoader when the texture fails to load
  */
  onTextureFailedToLoad(){
    //console.log('ERROR LOAD: ' + this._filepath );
    this._threeJsTexture = null;
    this._textureLoadingError = true;
    this._triedToLoad = true;

    // call the fallure callback if exists
    if( this._onTextureLoadErrorCallback ){
      this._onTextureLoadErrorCallback( this._chunkID );
    }
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


  /**
  * @param {callback function} cb - Callback to be called when the texture file corresponding to the chunk is successfully loaded.
  */
  onTextureLoaded(cb){
    this._onTextureLoadedCallback = cb;
  }


  /**
  * @param {callback function} cb - Callback to be called when the texture file corresponding to the chunk fails to be loaded.
  */
  onTextureLoadError(cb){
    this._onTextureLoadErrorCallback = cb;
  }


} /* END CLASS TextureChunk */

export { TextureChunk };
