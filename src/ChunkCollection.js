'use strict';

/*
  TODO: replace all var by let
*/

import { TextureChunk } from './TextureChunk.js';

/**
* The Chunk Collection is the container for all the chunks at a given resolution level.
* The resolutionLevel goes from 0 to 6, 0 being the poorer and 6 the sharper.
* ChunkCollection should not be asked anything directly, {@link LevelManager} should be the interface for that.
*/
class ChunkCollection{

  /**
  * Constructor
  * @param {number} resolutionLevel - The level of resolution, the lower the level, the lower the resolution. Level n has a metric resolution per voxel twice lower/poorer than level n+1, as a result, level n has 8 time less chunks than level n+1, remember we are in 3D!.
  * @param {Array} matrix3DSize - Number of chunks in each dimension [x, y, z] that are supposedly available.
  * @param {String} workingDir - The folder containing the config file (JSON) and the resolution level folder
  */
  constructor(resolutionLevel, matrix3DSize, workingDir){
    /**
    * The chunks of the same level. A map is used instead of an array because the chunks are loaded as they need to display, so we prefer to use an key (string built from the index3D) rather than a 1D array index.
    */
    this._chunks = {};

    /** The folder containing the config file (JSON) and the resolution level folder */
    this._workingDir = workingDir;

    /** Number of chunks in each dimension [x, y, z] that are supposedly available. */
    this._matrix3DSize = matrix3DSize;

    /** Level from 0 to 6, possibly more in the future. */
    this._resolutionLevel = resolutionLevel;

    /** Word size of a chunk at level 0. Used as a constant. */
    this._chunkSizeLvlZero = 1; // TODO: could also be 64 so that we kep the same dimensions in 3D than in 2D.

    /** Number of voxel per side of the chunk (suposedly cube shaped). Used as a constant.*/
    this._voxelPerSide = 64;

    /** Size of a chunk in 3D space (aka. in world coordinates) */
    this._sizeChunkWC = this._chunkSizeLvlZero / Math.pow(2, this._resolutionLevel);

    /** Creates a fake texture and fake texture data to be sent to the shader in case it's not possible to fetch a real data (out of bound, unable to load texture file) */
    this._createFakeTexture();

    /** Keeps a track of how many textures are supposed to be loaded, how many failed to load and how many eventually loaded successfully */
    this._chunkCounter = {
      toBeLoaded: 0,
      loaded: 0,
      failled: 0
    }

    this._onChunksLoadedCallback = null;

  }


  /**
  * [PRIVATE] init the chunk for the given index3D. Adds it to the collection AND returns it in case of immediate need.
  * @param {Array} index3D - [x, y, z] index of the chunk, where x, y and z are integer.
  * Does not perform any kind of verification (already exists, out of bound, etc.).
  * @return {TextureChunk} the newly created texture chunk.
  */
  _initChunkFromIndex3D(index3D){
    var that = this;
    var k = this.getKeyFromIndex3D(index3D);

    // add a chunk
    this._chunks[k] = new TextureChunk(
      this._resolutionLevel,
      this._voxelPerSide,
      this._sizeChunkWC,
      this._workingDir,
      k
    );

    // callback on the texture when succesfully loaded
    this._chunks[k].onTextureLoaded(function(chunkID){
      that._countChunks( chunkID, true );
    });

    // callback on the texture when failed to load
    this._chunks[k].onTextureLoadError(function(chunkID){
      that._countChunks( chunkID, false );
    });

    // build it properly
    this._chunks[k].buildFromIndex3D(index3D);

    // increment the counter
    this._chunkCounter.toBeLoaded ++;

    return this._chunks[k];
  }


  /**
  * @return the size of chunks in world coord in this collection
  */
  getSizeChunkWc(){
    return this._sizeChunkWC;
  }

  /**
  * Get a chunk at a given position, not necessary the origin
  */
  getTextureAtPosition(position){
    var index3D = this.getIndex3DFromWorldPosition(position);
    return this.getTextureAtIndex3D(index3D);
  }


  /**
  * Get the THREE.Texture for the chunk at index3D. Build the chunk if it's not already done.
  * @param {Array} index3D - [x, y, z] index of the chunk, where x, y and z are integer.
  * @return {THREE.Texture} Possibly a fake texture if we are asking out of bound.
  */
  getTextureAtIndex3D(index3D){
    var texture = this._fakeTextureData;

    // the required is within boundaries
    if( this.isWithinBounds(index3D) ){

      // fetch the chunk
      var chunk = this._getChunkIfInCollection(index3D);

      // if the chunk is not already in collection, we load it.
      if(!chunk){
        chunk = this._initChunkFromIndex3D(index3D);
      }

      // if the texture was successfully loaded.
      // most likely to be true the first time the texture is loaded due
      // to the async loading of the texture file.
      if(!chunk.loadingError()){
        texture = chunk.getChunkTextureData();
      }
    }

    return texture;
  }


  /**
  * Get the index3D from a arbitrary world position.
  * @param {Array} position - [x, y, z] arbitrary position.
  * @return {Array} the index3D, made of integer.
  *
  * TODO: if we add an offset, it's here!
  */
  getIndex3DFromWorldPosition(position){
    var index3D = [
      Math.floor(position[0] / this._sizeChunkWC),
      Math.floor(position[1] / this._sizeChunkWC),
      Math.floor(position[2] / this._sizeChunkWC)
    ];

    return index3D;
  }


  /**
  * Check if a chunk was already created in the map.
  * @param {Array} index3D - [x, y, z] index of the chunk, where x, y and z are integer.
  * @return {Boolean} - true if the chunk is already in the colletion, return false if not.
  */
  isInCollection(index3D){
    var k = this.getKeyFromIndex3D(index3D);
    return (k in this._chunks);
  }

  /**
  * [PRIVATE]
  * return the chunk at index3D if it was initialized. Return null if not yet created.
  * @param {Array} index3D - [x, y, z] index of the chunk, where x, y and z are integer.
  * @return {object} A chunk of null.
  */
  _getChunkIfInCollection(index3D){
    var k = this.getKeyFromIndex3D(index3D);

    if( k in this._chunks){
      return this._chunks[k];
    }else{
      return null;
    }

  }


  /**
  * @return underscore joined index3D as a string
  */
  getKeyFromIndex3D(index3D){
    return index3D.join("_");
  }


  /**
  * Check if a chunk is within the bounds in term of indexing.
  * @param {Array} index3D - [x, y, z] index of the chunk, where x, y and z are integer.
  * @return {Boolean} - true if within bounds, false if not.
  */
  isWithinBounds(index3D){
    if( index3D[0] < 0 || index3D[0] >= this._matrix3DSize[0] ||
        index3D[1] < 0 || index3D[1] >= this._matrix3DSize[1] ||
        index3D[2] < 0 || index3D[2] >= this._matrix3DSize[2] ){
      return false;
    }else{
      return true;
    }
  }


  /**
  * [PRIVATE]
  * Creates a fake texture of size 1 to send to the shader in case we are
  * out of bound or to complete the Sampler2D array for the fragment shader.
  */
  _createFakeTexture(){

    this._fakeTextureData = {
      texture: new THREE.DataTexture(
          new Uint8Array(1),
          1,
          1,
          THREE.LuminanceFormat,  // format, luminance is for 1-band image
          THREE.UnsignedByteType  // type for our Uint8Array
        ),
      origin: new THREE.Vector3(0, 0, 0),
      validity: false
    };

  }


  /**
  * Get the 8 indexes that are the closest to an arbitrary position.
  * (because we send 8 Sampler2D to the fragment shader)
  * @param {Array} position - An arbitrary position in world coordinates.
  * @return {Array} heigh times [x, y, z] in no specific order.
  */
  _get8ClosestToPositions(position){

    var localChunk = this.getIndex3DFromWorldPosition(position);

    var closest = [
      position[0] % this._sizeChunkWC > this._sizeChunkWC / 2 ? localChunk[0] +1 : localChunk[0] -1,
      position[1] % this._sizeChunkWC > this._sizeChunkWC / 2 ? localChunk[1] +1 : localChunk[1] -1,
      position[2] % this._sizeChunkWC > this._sizeChunkWC / 2 ? localChunk[2] +1 : localChunk[2] -1,
    ];

    /*
    console.log("chunk size: " + this._sizeChunkWC);
    console.log(position);
    console.log(localChunk);
    console.log(closest);
    */

    //console.log(localChunk);
    //sconsole.log(closest);

    // build the chunk index of the 8 closest chunks from position
    var indexes3D = [
      [
        localChunk[0],
        localChunk[1],
        localChunk[2]
      ],
      [
        localChunk[0],
        localChunk[1],
        closest[2]
      ],
      [
        localChunk[0],
        closest[1],
        localChunk[2]
      ],
      [
        localChunk[0],
        closest[1],
        closest[2]
      ],
      [
        closest[0],
        localChunk[1],
        localChunk[2]
      ],
      [
        closest[0],
        localChunk[1],
        closest[2]
      ],
      [
        closest[0],
        closest[1],
        localChunk[2]
      ],
      [
        closest[0],
        closest[1],
        closest[2]
      ],
    ]

    //console.log(indexes3D);

    return indexes3D;
  }

  /**
  * return the 8 texture data for the 8 closest chunks to the given position.
  * The texture data are ordered so that if some are invalid (out of bound, fake texture) they will be placed in the end of the array.
  * @param {Array} position - An arbitrary position in world coordinates.
  * @return {object} the object contains 1 array of textures, one array of chunks origins and one integer to inform how many of these textures are valid. This may seem a strange data structure but it's the closest from what can take the fragment shader and will require no further work. Remember we are potentially speaking of thousands of chunks being loaded!
  */
  get8ClosestTextureData(position){
    var the8closestIndexes = this._get8ClosestToPositions(position);
    var validChunksCounter = 0;
    var validChunksTexture = [];
    var notValidChunksTexture = [];
    var validChunksOrigin = [];
    var notValidChunksOrigin = [];
    var that = this;

    the8closestIndexes.forEach(function(elem){
      var aTextureData = that.getTextureAtIndex3D(elem);

      // this texture data is valid
      if(aTextureData.valid){
        validChunksTexture.push( aTextureData.texture );
        validChunksOrigin.push( aTextureData.origin );
      }
      // is not valid
      else{
        notValidChunksTexture.push( aTextureData.texture );
        notValidChunksOrigin.push( aTextureData.origin );
      }

    });

    validChunksCounter = validChunksTexture.length;

    return {
      textures: validChunksTexture.concat( notValidChunksTexture ),
      origins: validChunksOrigin.concat( notValidChunksOrigin ),
      nbValid: validChunksCounter
    };

  }


  /**
  * [PRIVATE]
  * Called when a chunk is loaded or failed to load. When to total number number of toLoad Vs. Loaded+failed is equivalent, a callback may be called (with no argument) if defined by onChunkLoaded().
  * @param {String} chunkID - the id to identify the chunk within the collection
  * @param {Boolean} success - must be true if loaded with success, or false if failed to load.
  */
  _countChunks(chunkID, success){
    this._chunkCounter.loaded += (+ success);
    this._chunkCounter.failled += (+ (!success));

    //console.log(this._chunkCounter);

    // all the required chunks are OR loaded OR failled = they all tried to load.
    if( (this._chunkCounter.loaded + this._chunkCounter.failled) == this._chunkCounter.toBeLoaded ){
      console.log(">> All required chunks are loaded");

      // call a callback if defined
      if( this._onChunksLoadedCallback ){
        this._onChunksLoadedCallback();
      }

    }
  }


  /**
  * Defines a callback for when all the requested chunks are loaded.
  * This will be called every time we ask for a certain number of chunks and they eventually all have a loading status (success or fail)
  * @param {callback function} cb - function to call
  */
  onChunkLoaded(cb){
    this._onChunksLoadedCallback = cb;
  }


} /* END CLASS ChunkCollection */

export { ChunkCollection };
