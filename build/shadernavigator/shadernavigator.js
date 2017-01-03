(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(factory((global.SHAD = global.SHAD || {})));
}(this, (function (exports) { 'use strict';

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
  * @param {String} chunkID - the string ID this chunk has within the ChunkCollection. This is used by the callbacks when succeding or failing to load the texture file.
  */
  constructor(resolutionLevel, voxelPerSide, sizeWC, workingDir, chunkID){
    /** the string ID this chunk has within the ChunkCollection. This is used by the callbacks when succeding or failing to load the texture file */
    this._chunkID = chunkID;

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
      this._loadTexture();
      //this._loadTextureDecode();
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

    //console.log(this._index3D[1]);

  }


  /**
  * [PRIVATE] Build the string of the chunk path to load.
  */
  _buildFileName(){

    let sagitalRangeStart = this._index3D[0] * this._voxelPerSide;
    let coronalRangeStart = this._index3D[1] * this._voxelPerSide;
    let axialRangeStart   = this._index3D[2] * this._voxelPerSide;

    /** Texture file, build from its index3D and resolutionLevel */

    // former
    this._filepath =  this._workingDir + "/" + this._resolutionLevel + "/" +
                  sagitalRangeStart + "-" + (sagitalRangeStart + this._voxelPerSide) + "/" +
                  coronalRangeStart + "-" + (coronalRangeStart + this._voxelPerSide) + "/" +
                  axialRangeStart   + "-" + (axialRangeStart + this._voxelPerSide);
  }


  /**
  * [PRIVATE] Loads the actual image file as a THREE js texture.
  */
  _loadTexture(){
    var that = this;
    this._buildFileName();

    //console.log("LOADING " + this._filepath + " ...");

    this._threeJsTexture = new THREE.TextureLoader().load(
      this._filepath, // url
      function(){
        //console.log('SUCCESS LOAD: ' + that._filepath );
        that._textureLoadingError = false;
        that._triedToLoad = true;

        // calling the success callback if defined
        if( that._onTextureLoadedCallback ){
          that._onTextureLoadedCallback( that._chunkID );
        }

      }, // on load
      function(){}, // on progress

      function(){ // on error
        //console.log('ERROR LOAD: ' + that._filepath );
        that._threeJsTexture = null;
        that._textureLoadingError = true;
        that._triedToLoad = true;

        // call the fallure callback if exists
        if( that._onTextureLoadErrorCallback ){
          that._onTextureLoadErrorCallback( that._chunkID );
        }

      }
    );

    this._threeJsTexture.magFilter = THREE.NearestFilter;
    this._threeJsTexture.minFilter = THREE.NearestFilter;

  }


  /**
  * Alternative to _loadTexture but decode the jpeg strip in JS using a JS lib.
  * It's pretty slow and should maybe be put in a webworker -- to be tested!
  */
  _loadTextureDecode(){
    var that = this;

    var xhr = new XMLHttpRequest();
    xhr.open('GET', this._filepath);
    xhr.responseType = 'arraybuffer';

    xhr.onload = function () {

      var encoded = new Uint8Array(xhr.response);
      var numComponents, width, height, decoded, parser;

      parser = new JpegDecoder();
      parser.parse(encoded);
      width = parser.width;
      height = parser.height;
      numComponents = parser.numComponents;
      decoded = parser.getData(width, height);

      that._threeJsTexture = new THREE.DataTexture(
        decoded,
        width,
        height,
        //THREE.RGBFormat
        THREE.LuminanceFormat
        //THREE.UnsignedByteType
      );

      that._threeJsTexture.magFilter = THREE.NearestFilter;
      that._threeJsTexture.minFilter = THREE.NearestFilter;
      that._threeJsTexture.flipY = true;
      that._threeJsTexture.needsUpdate = true;

      //console.log('SUCCESS LOAD: ' + that._filepath );
      that._textureLoadingError = false;
      that._triedToLoad = true;

      // calling the success callback if defined
      if( that._onTextureLoadedCallback ){
        //console.log("call the callback");
        that._onTextureLoadedCallback( that._chunkID );
      }

    };

    xhr.onerror = function(){
      //console.log('ERROR LOAD: ' + that._filepath );
      that._threeJsTexture = null;
      that._textureLoadingError = true;
      that._triedToLoad = true;

      // call the fallure callback if exists
      if( that._onTextureLoadErrorCallback ){
        that._onTextureLoadErrorCallback( that._chunkID );
      }
    };

    xhr.send();












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

/*
  TODO: replace all var by let
*/

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
  constructor(resolutionLevel, matrix3DSize, workingDir, datatype){
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
    this._chunkSizeLvlZero = 1;

    /** Number of voxel per side of the chunk (suposedly cube shaped). Used as a constant.*/
    this._voxelPerSide = 64;

    /** Size of a chunk in 3D space (aka. in world coordinates) */
    this._sizeChunkWC = this._chunkSizeLvlZero / Math.pow(2, this._resolutionLevel);

    // Creates a fake texture and fake texture data to be sent to the shader in case it's not possible to fetch a real data (out of bound, unable to load texture file)
    this._createFakeTexture();

    /** Keeps a track of how many textures are supposed to be loaded, how many failed to load and how many eventually loaded successfully */
    this._chunkCounter = {
      toBeLoaded: 0,
      loaded: 0,
      failled: 0
    };

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
    ];

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

/**
* The LevelManager is above the {@link ChunkCollection} and contain them all, one for each resolution level. LevelManager also acts like an interface to query chunk data.
*/
class LevelManager{

  /**
  *
  */
  constructor(){

    /**
    * The array of ChunkCollection instances, one per resolution level.
    */
    this._chunkCollections = [];

    /** the directory containing the config file (JSON) and the resolution level folders */
    this._workingDir = "";

    /** The level of resolution, defines which octree to dig into. Is a positive integer.  */
    this._resolutionLevel = 0;


    this.onReadyCallback = null;

    /** Size of the hull that wraps the entire dataset */
    this._cubeHull = null;

    /** size of a chunk, considering it's always cubic */
    this._chunkSize = 64; // will be overwritten using the config file, but it will be 64 anyway.

    this._onConfigErrorCallback = null;
  }


  /**
  * For testing purpose, this is a callback that will be called when the config
  * file will be loaded.
  */
  onReady(cb){
    this.onReadyCallback = cb;
  }


  /**
  * Load the json config file with an XMLHttpRequest.
  * @param {Object} config - {datatype: String, configURL: String} where datatype is the input data type ("octree_tiles" is the only available for the moment) and configURL is the URL of the JSON config file.
  */
  loadConfig(config){
    var that = this;
    var filepath = config.configURL;

    var xobj = new XMLHttpRequest();
    xobj.overrideMimeType("application/json");
    xobj.open('GET', filepath, true);
    xobj.onreadystatechange = function () {
      if (xobj.readyState == 4 && xobj.status == "200") {

        // the directory of the config file is the working directory
        that._workingDir = filepath.substring(0, Math.max(filepath.lastIndexOf("/"), filepath.lastIndexOf("\\")));

        // Rading the config object
        that._loadConfigDescription(config.datatype , JSON.parse(xobj.responseText));
      }else{
        console.error("Could not load config file " + filepath + "\nCode: " + xobj.readyState);

        // if loading the config file failed, we have a callback for that.
        if(that._onConfigErrorCallback){
          that._onConfigErrorCallback(filepath, xobj.status);
        }

      }
    };
    xobj.send(null);

  }


  /**
  * [PRIVATE]
  * Load the config description object, sort its multiple resolution levels
  * so that the poorer goes first and the finer goes last. Then, for each level
  * calls _addChunkCollectionLevel().
  * @param {String} datatype - Type of data, but for now only "octree_tiles" is ok.
  * @param {Object} description - parsed from the JSON decription file.
  */
  _loadConfigDescription(datatype, description){
    var that = this;

    var levels = description.scales;

    // the description may contain more than one level (= multirez),
    // if so, we sort by resolution so that 0 is the poorest and n is the finest
    if(levels.length > 0){
      levels.sort(function(a,b) {
        if (a.resolution[0] > b.resolution[0]){
          return -1;
        }else {
            return 1;
        }
      });
    }

    this._determineChunkSize(levels); // most likely 64 for every config anyway

    // Compute the cube hull, that will give some sense of boundaries to the dataset
    this._computeCubeHull(levels);

    // add a chunk collection for each level
    levels.forEach(function(elem, index){
      that._addChunkCollectionLevel(index, elem.size, datatype);
    });

    if(this.onReadyCallback){
      this.onReadyCallback();
    }

  }


  /**
  * [PRIVATE]
  * Adds a ChunkCollection instance to this._chunkCollections, corresponding to
  * the resolution level in argument.
  * @param {Number} resolutionLevel - positive integer (or zero)
  * @param {Array} voxelSize - Entire number of voxel to form the whole 3D dataset at this level of resolution. This will be translated into the size of the 3D matrix of chunk (basically divided by 64 and rounded to ceil).
  * @param {String} datatype - Type of data, but for now only "octree_tiles" is ok.
  */
  _addChunkCollectionLevel(resolutionLevel, voxelSize, datatype){
    // translating voxelSize into matrix3DSize
    // aka number of chunks (64x64x64) in each dimension
    var matrix3DSize = [
      Math.ceil( voxelSize[0] / this._chunkSize ),
      Math.ceil( voxelSize[1] / this._chunkSize ),
      Math.ceil( voxelSize[2] / this._chunkSize )
    ];

    // creating a new chunk collection for this specific level
    this._chunkCollections.push( new ChunkCollection(
      resolutionLevel,
      matrix3DSize,
      this._workingDir,
      datatype
    ));
  }


  /**
  * Change the level of resolution. Boundaries and "integrity" are checked.
  * @param {Number}
  */
  setResolutionLevel(lvl){
    // TODO: here, we may want to trigger some garbage collecting work over the
    // chunks that belongs to the previous lvl.

    // make sure we dont have a float here!
    var intergerLvl = Math.round(lvl);

    // boundaries to the level
    if(intergerLvl >= 0 && intergerLvl < this._chunkCollections.length){
      this._resolutionLevel = intergerLvl;
    }

  }


  /**
  * @return the resolution level currently in use
  */
  getCurrentResolutionLevel(){
    return this._resolutionLevel;
  }


  /**
  * @return the size of the chunks currently in use, in world coord
  */
  getCurrentChunkSizeWc(){
    return this._chunkCollections[ this._resolutionLevel ].getSizeChunkWc();
  }


  getChunkSizeWcByLvl(lvl){
    return this._chunkCollections[ lvl ].getSizeChunkWc();
  }


  /**
  * @param {Array} position - world coord position as an array [x, y, z]
  * @return the texture data of the 8 chunks that are the closest to the position.
  */
  get8ClosestTextureData(position){
    var the8ClosestTextureData = this._chunkCollections[ this._resolutionLevel ]
              .get8ClosestTextureData(position);

    //console.log(this._resolutionLevel + " " + position[0] + " " + position[1] + " " +position[2]);

    return the8ClosestTextureData;
  }


  get8ClosestTextureDataByLvl(position, lvl){
    var the8ClosestTextureData = this._chunkCollections[ lvl ]
              .get8ClosestTextureData(position);

    //console.log(this._resolutionLevel + " " + position[0] + " " + position[1] + " " +position[2]);

    return the8ClosestTextureData;
  }


  /**
  * Reads the chunk size from the config data. No matter the level, the chunk size should be the same, this is why we just take the first one.
  * @param {Object} levels - config data
  */
  _determineChunkSize(levels){
    this._chunkSize = levels[0].chunk_sizes[0];
  }


  /**
  * The cube hull may be used for different things, like checking inside/outside or simply to show a cube hull with a box.
  * The size data is available at every resolution level, we'll just take the info from the first level (0) since the size remains consistant all along.
  * @param {Object} levels - config data
  */
  _computeCubeHull(levels){
    this._cubeHull = [
      levels[0].size[0] / 64.0,
      levels[0].size[1] / 64.0,
      levels[0].size[2] / 64.0
    ];
  }


  /**
  * @returns {Array} a copy of the cubeHull size as [xSize, ySize, zSize]
  */
  getCubeHull(){
    return this._cubeHull.slice();
  }


  /**
  * Defines the callback called when the config file was not found/able to load.
  * This callback will be called with 2 args:
  *   {string} The config file url
  *   {Number} The error code (most likely 0 rather than 404. Didn't dig why)
  */
  onConfigError(cb){
    this._onConfigErrorCallback = cb;
  }


} /* END CLASS LevelManager */

/**
* An HashIO instance reads and writes the hash part of the URL (what is after '#').
* The read mode: the user can specify some arguments in the URL to specify
* the resolution level, the position and the rotation. Here is how the URL should
* look like: mydomain.com/quadView.html#5/1.01,1.02,1.03/0.1,0.2,0.3
* Where:
*    5 is the resolution level
*    1.01,1.02,1.03 is the x,y,z position of the intersection plane
*    0.1,0.2,0.3 is the x,y,z Euler angle rotation of the intersection plane
*
* The write mode: everytime the intersection plane is moved, the hash is refreshed
* so that the url can be used to come back to a specific position within the dataset.
*
*/
class HashIO{

  constructor(){
    this._rePattern = /(\d)[\/]([-]?[0-9]*[.]?[0-9]+)[,]([-]?[0-9]*[.]?[0-9]+)[,]([-]?[0-9]*[.]?[0-9]+)[\/]([-]?[0-9]*[.]?[0-9]+)[,]([-]?[0-9]*[.]?[0-9]+)[,]([-]?[0-9]*[.]?[0-9]+)/g;

  }


  /**
  * @returns the hash if there is one (without the '#'). Return an empty string if no hash.
  */
  getRawHash(){
    return window.location.hash.substr(1);
  }


  /**
  * Reads the URL hash and returns plane intersection information if the format matches.
  * @return {Object} the returned object if of the form:
  * { resolutionLvl, position {x, y, z}, rotation {x, y, z} }
  * Or returns null if the format does not match.
  */
  getHashInfo(){
    var match  = this._rePattern.exec( this.getRawHash() );

    if(!match)
      return null;

    return {
      resolutionLvl: parseInt(match[1]),
      position: {
        x: parseFloat(match[2]),
        y: parseFloat(match[3]),
        z: parseFloat(match[4])
      },
      rotation: {
        x: parseFloat(match[5]),
        y: parseFloat(match[6]),
        z: parseFloat(match[7])
      }
    };
  }

  /**
  * Write the hash part of the url
  * @param {Object} objectInfo - should have this structure:
  *   { resolutionLvl, position {x, y, z}, rotation {x, y, z} }
  * If one of the parameter is NaN, the URL hash is not updated
  * (some low level bug tend to produce NaN Euler angle).
  *
  */
  setHashInfo( objectInfo ){

    // dont refresh if we get a NaN
    if( isNaN(objectInfo.position.x) || isNaN(objectInfo.position.y) || isNaN(objectInfo.position.z) ||
        isNaN(objectInfo.rotation.x) || isNaN(objectInfo.rotation.y) || isNaN(objectInfo.rotation.z) )
    {
      return;
    }

    window.location.hash = objectInfo.resolutionLvl + "/"+
      objectInfo.position.x + "," +
      objectInfo.position.y + "," +
      objectInfo.position.z + "/" +
      objectInfo.rotation.x + "," +
      objectInfo.rotation.y + "," +
      objectInfo.rotation.z;
  }



} /* END CLASS HashIO */

/**
* A QuadView is a projection of a rendered scene on a quarter of the viewport, typically: top_left, top_right, bottom_left or bottom_right.
* A QuadView instance is part of a QuadScene, where are renderer 4 QuadViews.
*/
class QuadView{

  /**
  * @param {THREE.Scene} scene - the main scene to be used by aggregation here.
  * @param {THREE.Renderer} renderer - the main renderer to be used by aggregation here.
  * @param {Number} objectSize - Considering the object is centered on origin, this is a distance to be used so that the camera are not within the object. Example: 2 times the largest diagonal.
  *
  */
  constructor(scene, renderer, objectSize){
    this._objectSize = objectSize;
    this._camera = null;
    this._config = null;
    this._near = 0.1;
    this._far = 1000;
    this._defaultFov = 30;

    // set when decided which corner
    this._viewName = "";

    this._originToLookAt = new THREE.Vector3(0, 0, 0);
    this._control = null;
    this._renderer = renderer;
    this._scene = scene;

    // mouse coordinates, given by an higher object to prevent recomputing for every view
    this._mouse = {x:0, y:0};

    // keeps a track if the mouse pointer is within this view
    this._mouseInView = false;

    // depends on what corner
    this._backgroundColor = null;



  }

  /**
  * Define the point the camera is supposed to look at. By default, this is in world coordinates but if you place the current camera into an object, this will be in object-related coordinates.
  * If unchanged, [0, 0, 0]
  * @param {Number} x - x from 3D world coordinates
  * @param {Number} y - y from 3D world coordinates
  * @param {Number} z - z from 3D world coordinates
  */
  setOriginToLookAt(x, y, z){
    this._originToLookAt.set(x, y, z);
  }


  /**
  * Init the current view as the top left view of the quad view
  */
  initTopLeft(){
    this._config = {
      left: 0.0,
      bottom: 0.5,
      width: 0.5,
      height: 0.5,
      position: [ -this._objectSize, 0, 0 ],
      up: [ -1, 0, 0 ]
    };
    this._viewName = "top_left";
    this._backgroundColor = new THREE.Color().setRGB( 0.8, 0.8, 0.8 );
  }


  /**
  * Init the current view as the top right view of the quad view
  */
  initTopRight(){
    this._config = {
      left: 0.5,
      bottom: 0.5,
      width: 0.5,
      height: 0.5,
      position: [ 0, -this._objectSize, 0 ],
      up: [ 0, -1, 0 ]
    };
    this._viewName = "top_right";
    this._backgroundColor = new THREE.Color().setRGB( 0.9, 0.9, 0.9 );
  }

  /**
  * Init the current view as the Bottom left view of the quad view
  */
  initBottomLeft(){
    this._config = {
      left: 0.0,
      bottom: 0.0,
      width: 0.5,
      height: 0.5,
      position: [ 0, 0, -this._objectSize ],
      up: [ 0, 1, 0 ]
    };
    this._viewName = "bottom_left";
    this._backgroundColor = new THREE.Color().setRGB( 0.9, 0.9, 0.9 );
  }


  /**
  * Init the current view as the Bottom right view of the quad view
  */
  initBottomRight(){
    this._config = {
      left: 0.5,
      bottom: 0,
      width: 0.5,
      height: 0.5,
      position: [ -this._objectSize/2, this._objectSize/2, -this._objectSize/3 ],
      up: [ 0, 0, -1 ]
    };
    this._viewName = "bottom_right";
    this._backgroundColor = new THREE.Color().setRGB( 0.97, 0.97, 0.97 );
  }


  /**
  * Build an orthographic camera for this view.
  */
  initOrthoCamera(){
    let orthographicCameraFovFactor = 360;

    this._camera = new THREE.OrthographicCamera(
      window.innerWidth / - orthographicCameraFovFactor,
      window.innerWidth / orthographicCameraFovFactor,
      window.innerHeight / orthographicCameraFovFactor,
      window.innerHeight / - orthographicCameraFovFactor,
      this._near,
      this._far
    );

    this._camera.left_orig = window.innerWidth / - orthographicCameraFovFactor;
    this._camera.right_orig = window.innerWidth / orthographicCameraFovFactor;
    this._camera.top_orig = window.innerHeight / orthographicCameraFovFactor;
    this._camera.bottom_orig = window.innerHeight / - orthographicCameraFovFactor;

    this._initCameraSettings();
  }


  /**
  * Build a perspective camera for this view.
  */
  initPerspectiveCamera(){
    this._camera = new THREE.PerspectiveCamera(
      this._defaultFov, // fov
      window.innerWidth / window.innerHeight, // aspect
      this._near, // near
      this._far // far
    );

    this._initCameraSettings();
  }


  /**
  * [PRIVATE]
  * Ends the building of the camera, using the settings from _config.
  */
  _initCameraSettings(){
    this._camera.position.x = this._config.position[0];
    this._camera.position.y = this._config.position[1];
    this._camera.position.z = this._config.position[2];
    this._camera.up.x = this._config.up[ 0 ];
    this._camera.up.y = this._config.up[ 1 ];
    this._camera.up.z = this._config.up[ 2 ];
    this._camera.fov = this._defaultFov;
    this._camera.lookAt( this._originToLookAt );
  }


  /**
  * Adds Orbit control on this view, but only if the pointer (mouse) is within the boundaries of this view.
  * Should be called only after init a camera.
  */
  addOrbitControl(){
    this._control = new THREE.OrbitControls(this._camera);
  }


  /**
  *
  */
  addTrackballControl(renderFunction, toBind){
    this._control = new THREE.TrackballControls( this._camera );


    this._control.rotateSpeed = 5.0;
    this._control.staticMoving = true;
    this._control.zoomSpeed = 0.3;
		this._control.panSpeed = 1;

    /*
    this._control.zoomSpeed = 1.2;
		this._control.panSpeed = 0.8;
		this._control.noZoom = false;
		this._control.noPan = false;
		this._control.staticMoving = true;
		this._control.dynamicDampingFactor = 0.3;
		this._control.keys = [ 65, 83, 68 ];
    */

    this._control.addEventListener( 'change', this.renderView.bind(this) );
  }


  /**
  * Updates the position of the mouse pointer with x and y in [0, 1] with origin at the bottom left corner.
  * Must be called before renderView() in case of using an Orbit Control.
  */
  updateMousePosition(x, y){
    this._mouse = {x:x, y:y};
  }


  /**
  * [PRIVATE]
  * If the camera uses an Orbit Control,
  */
  _updateCameraWithControl(){
    // The camera needs an update only if we have an orbit control
    if(this._control){

      if( this._mouse.x >= this._config.left &&
          this._mouse.x <= (this._config.left + this._config.width) &&
          this._mouse.y >= this._config.bottom &&
          this._mouse.y <= (this._config.bottom + this._config.height)
        ){

        // just entered
        if(! this._mouseInView){
          this._mouseInView = true;
          this.enableControl();
          console.log("ENTER " + this._viewName);
        }

      }else{

        // just left
        if(this._mouseInView){
          this._mouseInView = false;
          this.disableControl();
          console.log("LEAVE" + this._viewName);
        }

      }
    }
  }


  /*
  * Change the background color for this view. If unchanged, top_left and bottom_right are in a bit darker gray than the 2 others.
  * @param {THREE.Color} c - color
  */
  setBackgroundColor(c){
    this._backgroundColor = c;
  }


  /**
  * Render the view, should be called when the main renderer is rendering.
  */
  renderView(){
    // will only work if an Orbt Control is defined
    //this._updateCameraWithControl();

    var left   = Math.floor( window.innerWidth  * this._config.left );
    var bottom = Math.floor( window.innerHeight * this._config.bottom );
    var width  = Math.floor( window.innerWidth  * this._config.width );
    var height = Math.floor( window.innerHeight * this._config.height );

    this._renderer.setViewport( left, bottom, width, height );
    this._renderer.setScissor( left, bottom, width, height );
    this._renderer.setScissorTest( true );
    this._renderer.setClearColor( this._backgroundColor );
    this._camera.aspect = width / height;
    this._camera.updateProjectionMatrix();
    this._renderer.render( this._scene, this._camera );
  }



  /**
  * To use to embed the camera of this QuadView into an existing object, so that it can profit from this object space transformation without further work.
  * We use it to embed a orthographic camera to planes so that the wole system can rotate and move all at once.
  */
  useRelativeCoordinatesOf( object3D ){
    // TODO: remove from an possibly existing parent first (if not scene)

    object3D.add(this._camera);
  }


  /**
  * Updates the camera frustrum for ortho cam, in order to change the width and heigh of its projection and keep a relativelly constant image no matter what zoom level we are using.
  * @param {Number} ff -
  */
  updateOrthoCamFrustrum(ff){
    this._camera.left = this._camera.left_orig * ff;
    this._camera.right = this._camera.right_orig * ff;
    this._camera.top = this._camera.top_orig * ff;
    this._camera.bottom = this._camera.bottom_orig * ff;
    //this._camera.updateProjectionMatrix();
  }


  /**
  * Used for perspective cameras. If the Orbit Control is enabled, the center of rotatation (target) will also be set.
  * @param {THREE.Vector3} pos - 3D position to look at and to turn around.
  */
  updateLookAt(pos){
    this._camera.lookAt( pos.clone() );

    if(this._control){
      this._control.target = pos.clone();
    }

  }


  /**
  * Update the control. This control needs to be updated from an "animate" function (like every frames) but not from a render function.
  * If the control is a TrackballControls, updateControl needs to be called at every loop.
  * If the control is a OrbitControls, updateControl needs to be called only if using the cinetic effect.
  */
  updateControl(){
    this._control.update();
  }


  /**
  * If the control (orbit or trackball) was initialized, it enables it.
  * (Can be called even though it was already enabled, this is NOT a toggle)
  */
  enableControl(){
    if(this._control){
      if(!this._control.enabled){
        this._control.enabled = true;
      }
    }
  }


  /**
  * If the control (orbit or trackball) was initialized, it disables it.
  * (Can be called even though it was already enabled, this is NOT a toggle)
  */
  disableControl(){
    if(this._control){
      if(this._control.enabled){
        //console.log("mouse left " + this._viewName);
        this._control.enabled = false;
      }
    }
  }


  /**
  * @returns {boolean} true if this view is using a orbit/trackball control (no matter if enabled or disabled). Return false if this view does not use any kind of controls.
  */
  isUsingControl(){
    return !!this._control;
  }


  /**
  * Ask if a specific normalized coordinates are in the window boundaries of this view.
  * @param {Number} x - horizontal coordinate normalized to the screen, so within [0, 1]. Origin on the left.
  * @param {Number} y - vertical coordinate normalized to the screen, so within [0, 1]. Origin on the bottom.
  * @returns true if (x, y) are
  */
  isInViewWindow(x, y){
    return x > this._config.left && y > this._config.bottom &&
      x < (this._config.left + this._config.width) &&
      y < (this._config.bottom + this._config.height);
  }


  enableLayer( layerNum ){
    this._camera.layers.enable( layerNum );

  }

  disableLayer( layerNum ){
    this._camera.layers.disable( layerNum );
  }


} /* END QuadView */

/**
* A OrientationHelper is a sphere surrounding the orthogonal planes that will show the direction of left/right, posterior/anterior and inferior/superior.
*
*/
class OrientationHelper{

  /**
  *
  */
  constructor( initRadius ){
    this._sphere = new THREE.Object3D();

    var xColor = 0xff3333;
    var yColor = 0x00EB4E;
    var zColor = 0x0088ff;

    var geometryX = new THREE.CircleGeometry( initRadius, 64 );
    var geometryY = new THREE.CircleGeometry( initRadius, 64 );
    var geometryZ = new THREE.CircleGeometry( initRadius, 64 );
    var materialX = new THREE.LineBasicMaterial( { color: xColor, linewidth:1.5 } );
    var materialY = new THREE.LineBasicMaterial( { color: yColor, linewidth:1.5 } );
    var materialZ = new THREE.LineBasicMaterial( { color: zColor, linewidth:1.5 } );

    // remove inner vertice
    geometryX.vertices.shift();
    geometryY.vertices.shift();
    geometryZ.vertices.shift();

    // X circle
    var circleX = new THREE.Line( geometryX, materialX );
    circleX.name = "xCircle";
    geometryX.rotateY(Math.PI / 2);
    // Y circle
    var circleY = new THREE.Line( geometryY, materialY );
    circleY.name = "yCircle";
    geometryY.rotateX(-Math.PI / 2);
    // Z circle
    var circleZ = new THREE.Line( geometryZ, materialZ );
    circleZ.name = "zCircle";

    this._sphere = new THREE.Object3D();
    this._sphere.add(circleX);
    this._sphere.add(circleY);
    this._sphere.add(circleZ);

    // adding central lines
    var xLineGeometry = new THREE.Geometry();
    xLineGeometry.vertices.push(
    	new THREE.Vector3( -initRadius, 0, 0 ),
    	new THREE.Vector3( initRadius, 0, 0 )
    );

    var xLine = new THREE.Line(
      xLineGeometry,
      new THREE.LineBasicMaterial({	color: xColor, linewidth:1.5 })
    );

    var yLineGeometry = new THREE.Geometry();
    yLineGeometry.vertices.push(
    	new THREE.Vector3(0, -initRadius, 0 ),
    	new THREE.Vector3(0,  initRadius, 0 )
    );

    var yLine = new THREE.Line(
      yLineGeometry,
      new THREE.LineBasicMaterial({	color: yColor, linewidth:1.5 })
    );

    var zLineGeometry = new THREE.Geometry();
    zLineGeometry.vertices.push(
    	new THREE.Vector3(0, 0, -initRadius ),
    	new THREE.Vector3(0, 0,  initRadius )
    );

    var zLine = new THREE.Line(
      zLineGeometry,
      new THREE.LineBasicMaterial({	color: zColor, linewidth:1.5 })
    );

    this._sphere.add( xLine );
    this._sphere.add( yLine );
    this._sphere.add( zLine );


    // adding sprites with labels
    var textureLoader = new THREE.TextureLoader();
    var leftTex = textureLoader.load( "textures/left.png" );
    var rightTex = textureLoader.load( "textures/right.png" );
    var antTex = textureLoader.load( "textures/anterior.png" );
    var postTex = textureLoader.load( "textures/posterior.png" );
    var supTex = textureLoader.load( "textures/superior.png" );
    var infTex = textureLoader.load( "textures/inferior.png" );

    var leftSprite = new THREE.Sprite( new THREE.SpriteMaterial( { map: leftTex} ) );
    var rightSprite = new THREE.Sprite( new THREE.SpriteMaterial( { map: rightTex} ) );
    var antSprite = new THREE.Sprite( new THREE.SpriteMaterial( { map: antTex} ) );
    var postSprite = new THREE.Sprite( new THREE.SpriteMaterial( { map: postTex} ) );
    var supSprite = new THREE.Sprite( new THREE.SpriteMaterial( { map: supTex} ) );
    var infSprite = new THREE.Sprite( new THREE.SpriteMaterial( { map: infTex} ) );

    var distanceFromCenter = initRadius * 1.4;

    leftSprite.position.set( distanceFromCenter, 0, 0 );
    rightSprite.position.set( -distanceFromCenter, 0, 0 );
    antSprite.position.set(0, distanceFromCenter, 0 );
    postSprite.position.set(0, -distanceFromCenter, 0 );
    supSprite.position.set(0, 0, -distanceFromCenter );
    infSprite.position.set(0, 0, distanceFromCenter );

    this._sphere.add(leftSprite);
    this._sphere.add(rightSprite);
    this._sphere.add(antSprite);
    this._sphere.add(postSprite);
    this._sphere.add(supSprite);
    this._sphere.add(infSprite);

    this._sphere.children.forEach( function(child){
      child.layers.enable( 0 );
      child.layers.enable( 1 );
    });



    //this._sphere.layers.enable(0);
    //this._sphere.layers.enable(1);
    console.log("Orientaion Helper mask: " + this._sphere.layers.mask);

  }


  /**
  * Add the local helper mesh to obj.
  * @param {THREE.Object3D} obj - container object to add the local helper.
  */
  addTo( obj ){
    obj.add( this._sphere );
    console.log("ADDED");
  }


  /**
  * Rescale the helper with a given factor.
  * @param {Number} f - a scaling factor, most likely within [0, 1]
  */
  rescale( f ){
    this._sphere.scale.x = f;
    this._sphere.scale.y = f;
    this._sphere.scale.z = f;
  }


  /**
  * Resize the helper depending on the resolution level
  */
  rescaleFromResolutionLvl( lvl ){
    var scale = 1 / Math.pow( 2, lvl );
    this._sphere.scale.x = scale;
    this._sphere.scale.y = scale;
    this._sphere.scale.z = scale;
  }

  /**
  * Set the position of the orientation helper.
  * @param {THREE.Vector3} vPos - The position as a vector to clone.
  */
  setPosition( vPos ){
    this._sphere.position.x = vPos.x;
    this._sphere.position.y = vPos.y;
    this._sphere.position.z = vPos.z;
  }

  /**
  * Show the helper if hidden, hide it if shown.
  */
  toggle(){
    this._sphere.visible = !this._sphere.visible;
  }


} /* END class OrientationHelper */

/**
* A QuadViewInteraction instance knows all the QuadView instance (aggregated in an array) and deals with all the interaction/controller side that a QuadView may need. This includes mouse/keyboard interaction on each view (independently) and possibly orbit/trackball control for QuadViews which enabled it.
*
*/
class QuadViewInteraction{

  /**
  * Build the QuadViewInteraction instance. Requires a list of QuadView instances.
  * @param {Array of QuadView} QuadViewArray - an array of QuadView.
  */
  constructor(QuadViewArray){
    this._quadViews = QuadViewArray;

    this._windowSize = {
      width: window.innerWidth ,
      height: window.innerHeight
    };

    // updated at every mousemove event by the QuadScene
    this._mouse = {x:0, y:0};

    this._mouseLastPosition = {x:-1, y:-1};

    // distance traveled by the mouse, most likely between 2 mousemouve event
    this._mouseDistance = {x:0, y:0};

    // index of the quadview the mouse currently is
    this._indexCurrentView = -1;

    // index of the view the mouse was pressed
    this._indexViewMouseDown = -1;

    // updated by the mousedown/mouseup
    this._mousePressed = false;

    this._rKeyPressed = false;
    this._tKeyPressed = false;

    // declaring some interaction events
    document.addEventListener( 'mousemove', this._onMouseMove.bind(this), false );
    document.addEventListener( 'mousedown', this._onMouseDown.bind(this), false );
    document.addEventListener( 'mouseup', this._onMouseUp.bind(this), false );
    document.addEventListener( 'keydown', this._onKeyDown.bind(this), false);
    document.addEventListener( 'keyup', this._onKeyUp.bind(this), false);

    // function to be called when the mouse is pressed on a view for translation - no R key pressed
    this._onGrabViewTranslateCallback = null;

    // function to be called when the mouse is pressed on a view for rotation - with R key pressed
    this._onGrabViewRotateCallback = null;

    // function called when user maintains click + T and moves mouse
    this._onGrabViewTransverseRotateCallback = null;

    // function called when user scrolls
    this._onScrollViewCallback = null;

    // function to call when the arrow up (keyboard) is down
    this._onArrowUpCallback = null;

    // function to call when the arrow down (keyboard) is down
    this._onArrowDownCallback = null;

    this._onDonePlayingCallback = null;
  }


  /**
  * Because we dont want to be querying window.innerWidth and window.innerHeight all the time.
  * This is supposed to be called by a QuadScene, at the same moment we update the window size for the renderer.
  * @param {Number} w - width of the window in pixel, most likely window.innerWidth
  * @param {Number} h - height of the window in pixel, most likely window.innerHeight
  */
  updateWindowSize(w, h){
    this._windowSize.width = w;
    this._windowSize.height = h;
  }


  /**
  * Updates the position of the mouse pointer with x and y in [0, 1] with origin at the bottom left corner.
  * Updating the mouse position may trigger some events like orbit/trackball control activation
  */
  _onMouseMove( event ) {
    this._mouse.x = (event.clientX / this._windowSize.width);
    this._mouse.y = 1 - (event.clientY / this._windowSize.height);
    this._manageQuadViewsMouseActivity();

    // mouse pressed + moving
    if(this._mousePressed){

      // distance from the last update
      this._mouseDistance.x = (this._mouse.x - this._mouseLastPosition.x)*this._windowSize.width / 100;
      this._mouseDistance.y = (this._mouse.y - this._mouseLastPosition.y)*this._windowSize.height / 100;

      // + R key down --> rotation
      if(this._rKeyPressed){
        var center = {
          x: (this._indexViewMouseDown%2)*0.5 + 0.25,
          y: (this._indexViewMouseDown>1?0:1)*0.5 +0.25,
        };

        var centerToPrevious = new THREE.Vector3(
          this._mouseLastPosition.x - center.x,
          this._mouseLastPosition.y - center.y,
          this._mouseLastPosition.z - center.z
        ).normalize();

        var centerToCurrent = new THREE.Vector3(
          this._mouse.x - center.x,
          this._mouse.y - center.y,
          this._mouse.z - center.z
        ).normalize();

        // the rotation angle (unsigned)
        var angleRad = Math.acos( centerToPrevious.dot(centerToCurrent) );

        // the rotation direction depends on the normal of the angle
        var angleDirection = Math.sign( centerToPrevious.cross(centerToCurrent).z );

        // call the callback for this kind of interaction
        if(this._onGrabViewRotateCallback){
          this._onGrabViewRotateCallback(angleRad, angleDirection, this._indexViewMouseDown);
        }

      }

      // + T key down --> tranverse rotation
      else if(this._tKeyPressed){

        if(this._onGrabViewTransverseRotateCallback){
          this._onGrabViewTransverseRotateCallback(this._mouseDistance, this._indexViewMouseDown);
        }
      }

      // + NO key down --> translation
      else{
        if(this._onGrabViewTranslateCallback){
          this._onGrabViewTranslateCallback(this._mouseDistance, this._indexViewMouseDown);
        }
      }

      // update the last position
      this._mouseLastPosition.x = this._mouse.x;
      this._mouseLastPosition.y = this._mouse.y;

    } /* END  */

  }


  /**
  * [PRIVATE]
  * callback to the mousedown event
  */
  _onMouseDown( event ){
    this._mousePressed = true;
    this._indexViewMouseDown = this._indexCurrentView;

    // will be used as an init position
    this._mouseLastPosition.x = this._mouse.x;
    this._mouseLastPosition.y = this._mouse.y;
  }


  /**
  * [PRIVATE]
  * callback to the mouseup event
  */
  _onMouseUp( event ){
    this._mousePressed = false;
    this._indexViewMouseDown = -1;

    this._mouseDistance.x = 0;
    this._mouseDistance.y = 0;

    if(this._onDonePlayingCallback){
      this._onDonePlayingCallback();
    }
  }


  /**
  * [PRIVATE]
  * Callback to the event onkeydown, aka. when a keyboard key is pressed
  */
  _onKeyDown( event ){
    switch( event.key ){
      case "r":
        this._rKeyPressed = true;
        break;
      case "t":
        this._tKeyPressed = true;
        break;

      case "ArrowDown":
        if(this._onArrowDownCallback){
          this._onArrowDownCallback(this._indexCurrentView);
        }
        break;

      case "ArrowUp":
        if(this._onArrowUpCallback){
          this._onArrowUpCallback(this._indexCurrentView);
        }
        break;

      default:;
    }
  }


  /**
  * [PRIVATE]
  * Callback to the event onkeyup, aka. when a keyboard key is released
  */
  _onKeyUp( event ){
    switch( event.key ){
      case "r":
        this._rKeyPressed = false;
        break;
      case "t":
        this._tKeyPressed = false;
        break;

      default:;
    }

    if(this._onDonePlayingCallback){
      this._onDonePlayingCallback();
    }

  }


  /**
  * For each QuadView instance, trigger things depending on how the mouse pointer interact with a quadview.
  */
  _manageQuadViewsMouseActivity(){
    var that = this;
    var x = this._mouse.x;
    var y = this._mouse.y;

    this._quadViews.forEach(function(qv, index){

      // the pointer is within the QuadView window
      if(qv.isInViewWindow(x, y)){

        that._indexCurrentView = index;

        // even though this quadview may not have any controller
        qv.enableControl();
      }
      // the pointer is outside the QuadView window
      else{

        // even though this quadview may not have any controller
        qv.disableControl();
      }

    });
  }


  /**
  * Callback when one of the QuadView is grabed.
  * The callback will be called with 2 arguments:
  *   {Object} distance {x:, y: } - the distance along x and y in normalized space
  *   {Number} QuadView index
  */
  onGrabViewTranslate(cb){
    this._onGrabViewTranslateCallback = cb;
  }


  /**
  * Defines the callback called when click on a view holding
  * the R keyboard key and move the mouse.
  * It performs a rotation around the normal vector of the current view/plane.
  * The callback is called with 2 arguments:
  *   {Number} angle in radian
  *   {Number} direction, is 1-always +1 or -1
  *   {Number} QuadView index
  */
  onGrabViewRotate(cb){
    this._onGrabViewRotateCallback = cb;
  }


  /**
  * Defines the callback called when click on a view holding the T keyboard key
  * and move the mouse.
  * It performs a transverse rotation.
  *   {Object} distance {x:, y: } - the distance along x and y in normalized space
  *   {Number} QuadView index
  */
  onGrabViewTransverseRotate(cb){
    this._onGrabViewTransverseRotateCallback = cb;
  }


  /**
  * Defines the callback for when the arrow_down keyboard key is down.
  * Usually for travelling along the normal of the plane/view.
  * Called with 1 argument:
  *   {Number} QuadView index
  */
  onArrowDown(cb){
    this._onArrowDownCallback = cb;
  }


  /**
  * Defines the callback for when the arrow_up keyboard key is down.
  * Usually for travelling along the normal of the plane/view.
  * Called with 1 argument:
  *   {Number} QuadView index
  */
  onArrowUp(cb){
    this._onArrowUpCallback = cb;
  }

  /**
  * Callback called when a key of a mouse button is released
  */
  onDonePlaying( cb ){
    this._onDonePlayingCallback = cb;
  }



} /* END class QuadViewInteraction */

/**
* An instance of ColorMapManager is used to load color maps and retrive them.
* A certain amount of default color maps is available but curtom maps can also be added.
* Each texture is stored as a THREE.Texture and are loaded with THREE.TextureLoader.
*/
class ColorMapManager{

  /**
  * Loads the default colormaps.
  */
  constructor(){
    // default folder where the default colormaps are stored
    this._defaultMapFolder = "colormaps/";

    // default colormaps filename
    this._defaultMaps = [
      "plum.png",
      "thermal.png",
      "blue_klein.png",
      "blue_teal.png",
      "rainbow.png",
      "rainbow_alpha.png"
    ];

    // map of colormaps. The keys are colormap file (no extension) and the objects are THREE.Texture
    this._colorMaps = {};

    this._onColormapUpdateCallback = null;

    // The current color map is defined by a name/id and a THREE.Texture
    this._currentColormap = {id: "none", colormap: null};

    // False to if we decide to use a colormap, true to use a colormap
    this._isEnabled = false;

    // single object to load all the textures
    this._textureLoader = new THREE.TextureLoader();

    this._colorMaps["none"] = null;
    this._loadDefaultColormaps();
  }


  /**
  * Load a new colormap from a file and add it to the list.
  * @param {String} filename - url or the colormap file.
  * @param {bool} setCurrent - true to use this one as default, false not to.
  */
  loadColormap(filename, setCurrent=true){
    var that = this;

    // get the basename (no extension)
    var basename = new String(filename).substring(filename.lastIndexOf('/') + 1);
    if(basename.lastIndexOf(".") != -1)
        basename = basename.substring(0, basename.lastIndexOf("."));

    this._textureLoader.load(
      filename,

      // success
      function ( texture ) {
        // add to the map of colormaps
        that._colorMaps[basename] = texture;

        if(setCurrent){
          // make it the current in use
          that._currentColormap.id = basename;
          that._currentColormap.colormap = texture;
        }

        if(that._onColormapUpdateCallback){
          that._onColormapUpdateCallback();
        }

      },

      // Function called when download progresses
      function ( xhr ) {
        //console.log( (xhr.loaded / xhr.total * 100) + '% loaded' );
      },

      // Function called when download errors
      function ( xhr ) {
        console.error( 'Failed to load ' + filename );
      }

    );

  }


  /**
  * [PRIVATE]
  * Loads all the default textures.
  */
  _loadDefaultColormaps(){
    var that = this;

    // for each colormap to be loaded
    this._defaultMaps.forEach(function( texFilename, index ){
      // loading the colormap
      that.loadColormap(
        that._defaultMapFolder + texFilename,
        false
      );
    });
  }


  /**
  * @return the colormap that is currently in use as an object {id, colormap}
  */
  getCurrentColorMap(){
    return this._currentColormap;
  }


  /**
  * @returns true if a colormap is supposed to be used, returns false if not
  */
  isColormappingEnabled(){
    return this._isEnabled;
  }


  /**
  * Activates color mapping. If no colormap has ever been explicitly mentioned as "in use", then the first of the default colormaps is the one to go with.
  */
  enableColorMapping(){
    this._isEnabled = true;
  }


  disableColorMapping(){
    this._isEnabled = false;
  }


  /**
  * @returns a list of available colormaps IDs.
  */
  getAvailableColormaps(){
    return Object.keys( this._colorMaps );
  }


  /**
  * Enable a colormap by a given ID.
  * @param {String} id - the colormap ID must be valid.
  * @return true if success, return false if fail
  */
  useColormap(id){



    if(this._colorMaps.hasOwnProperty(id)){
      this._currentColormap.id = id;
      this._currentColormap.colormap = this._colorMaps[id];

      if(id == "none"){
        this.disableColorMapping();
      }else{

        // we considere that enabling a specific texture comes with
        // enabling the colormapping
        this.enableColorMapping();
      }
      return true;
    }
    return false;
  }


  onColormapUpdate(cb){
    this._onColormapUpdateCallback = cb;
  }


} /* ColorMapManager */

var texture3d_frag = "const int maxNbChunks = 8;\nuniform int nbChunks;\nuniform sampler2D textures[maxNbChunks];\nuniform vec3 textureOrigins[maxNbChunks];\nuniform sampler2D colorMap;\nuniform bool useColorMap;\nuniform float chunkSize;\nvarying vec4 worldCoord;\nvarying vec2 vUv;\nbool isNan(float val)\n{\n  return (val <= 0.0 || 0.0 <= val) ? false : true;\n}\nbool isInsideChunk(in vec3 chunkPosition){\n  return !( chunkPosition.x<0.0 || chunkPosition.x>=1.0 ||\n            chunkPosition.y<0.0 || chunkPosition.y>=1.0 ||\n            chunkPosition.z<0.0 || chunkPosition.z>=1.0 );\n}\nvoid getColorFrom3DTexture(in sampler2D texture, in vec3 chunkPosition, out vec4 colorFromTexture){\n  float numberOfImagePerStripY = 64.0;\n  float numberOfPixelPerSide = 64.0;\n  float yOffsetNormalized = float(int(chunkPosition.z * numberOfImagePerStripY)) / numberOfImagePerStripY;\n  float stripX = chunkPosition.x;\n  float stripY = chunkPosition.y / numberOfImagePerStripY + yOffsetNormalized;\n  vec2 posWithinStrip = vec2(stripX, stripY);\n  colorFromTexture = texture2D(texture, posWithinStrip);\n}\nvec3 worldCoord2ChunkCoord(vec4 world, vec3 textureOrigin, float chunkSize){\n  vec3 chunkSystemCoordinate = vec3( (textureOrigin.x - world.x)*(-1.0)/chunkSize,\n                                    1.0 - (textureOrigin.y - world.y)*(-1.0)/chunkSize,\n                                    1.0 - (textureOrigin.z - world.z)*(-1.0)/chunkSize);\n  return chunkSystemCoordinate;\n}\nvoid main( void ) {\n  vec2 shaderPos = vUv;\n  vec4 color = vec4(0.0, 0.0 , 0.0, 0.0);\n  vec3 chunkPosition;\n  bool mustWrite = false;\n  if(nbChunks >= 1){\n    chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[0], chunkSize);\n    if( isInsideChunk(chunkPosition) ){\n      getColorFrom3DTexture(textures[0], chunkPosition, color);\n      mustWrite = true;\n    }\n    if(nbChunks >= 2){\n      chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[1], chunkSize);\n      if( isInsideChunk(chunkPosition) ){\n        getColorFrom3DTexture(textures[1], chunkPosition, color);\n        mustWrite = true;\n      }\n      if(nbChunks >= 3){\n        chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[2], chunkSize);\n        if( isInsideChunk(chunkPosition) ){\n          getColorFrom3DTexture(textures[2], chunkPosition, color);\n          mustWrite = true;\n        }\n        if(nbChunks >= 4){\n          chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[3], chunkSize);\n          if( isInsideChunk(chunkPosition) ){\n            getColorFrom3DTexture(textures[3], chunkPosition, color);\n            mustWrite = true;\n          }\n          if(nbChunks >= 5){\n            chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[4], chunkSize);\n            if( isInsideChunk(chunkPosition) ){\n              getColorFrom3DTexture(textures[4], chunkPosition, color);\n              mustWrite = true;\n            }\n            if(nbChunks >= 6){\n              chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[5], chunkSize);\n              if( isInsideChunk(chunkPosition) ){\n                getColorFrom3DTexture(textures[5], chunkPosition, color);\n                mustWrite = true;\n              }\n              if(nbChunks >= 7){\n                chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[6], chunkSize);\n                if( isInsideChunk(chunkPosition) ){\n                  getColorFrom3DTexture(textures[6], chunkPosition, color);\n                  mustWrite = true;\n                }\n                if(nbChunks == 8){\n                  chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[7], chunkSize);\n                  if( isInsideChunk(chunkPosition) ){\n                    getColorFrom3DTexture(textures[7], chunkPosition, color);\n                    mustWrite = true;\n                  }\n                }\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n  if(mustWrite){\n    if(useColorMap){\n      vec2 colorToPosition = vec2(color.r, 0.5);\n      vec4 colorFromColorMap = texture2D(colorMap, colorToPosition);\n      if(colorFromColorMap.a == 0.0){\n        discard;\n      }else{\n        gl_FragColor = colorFromColorMap;\n      }\n    }else{\n      gl_FragColor = color;\n    }\n  }else{\n    discard;\n  }\n}\n";

var texture3d_vert = "uniform float chunkSize;\nuniform sampler2D colorMap;\nvarying vec2 vUv;\nvarying vec4 worldCoord;\nvoid main()\n{\n  vUv = uv;\n  vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );\n  gl_Position = projectionMatrix * mvPosition;\n  worldCoord = modelMatrix * vec4( position, 1.0 );\n}\n";

var ShaderImporter = {
	texture3d_frag: texture3d_frag,
  texture3d_vert: texture3d_vert 
};

/**
* A ProjectionPlane instance is a portion of a 3D plane, defined as a rectangular surface. It is subdivided in a certain amount of sub-planes that are square-shaped. Each sub-plane is the size of half a texture chunk of the current resolution level.
* Example: if a texture chunk at level 3 is of size 1/8 x 1/8 x 1/8 in world coordinates, the csub-planes will be 1/16 x 1/16.
* This ensure that we dont have to many texture (Sampler2D) to send the the fragment shader of each sub-planes because, even in critical cases, a sub-plane of this size wont intersect more than 8 texture chunks.
*
*/
class ProjectionPlane{

  /**
  * @param {Number} chunkSize - The size of a texture chunk at the current level of resolution (in world coordinates)
  *
  */
  constructor( chunkSize, colormapManager ){
    var that = this;

    this._plane = new THREE.Object3D();

    //this._subPlaneSize = chunkSize / 2; // ORIG
    //this._subPlaneSize = chunkSize * 0.7; // OPTIM
    this._subPlaneSize = chunkSize / Math.sqrt(2);

    // list of subplanes
    this._subPlanes = [];

    // one shader material per sub-plane
    this._shaderMaterials = [];

    // number of rows and cols of sub-planes to compose the _plane
    //this._subPlaneDim = {row: 10, col: 21}; // ORIG
    this._subPlaneDim = {row: 7, col: 15}; // OPTIM
    //this._subPlaneDim = {row: 4, col: 4}; // TEST

    // to be aggregated
    this._colormapManager = colormapManager;

    // given by aggregation
    this._levelManager = null;

    this._resolutionLevel = 0;

    this._buildSubPlanes();
  }


  /**
  * Build all the subplanes with fake textures and fake origins. The purpose is just to create a compatible data structure able to receive relevant texture data when time comes.
  */
  _buildSubPlanes(){
    var that = this;

    var subPlaneGeometry = new THREE.PlaneBufferGeometry( this._subPlaneSize, this._subPlaneSize, 1 );

    // a fake texture is a texture used instead of a real one, just because
    // we have to send something to the shader even if we dont have data
    var fakeTexture = new THREE.DataTexture(
        new Uint8Array(1),
        1,
        1,
        THREE.LuminanceFormat,  // format, luminance is for 1-band image
        THREE.UnsignedByteType  // type for our Uint8Array
      );

    var fakeOrigin = new THREE.Vector3(0, 0, 0);

    var subPlaneMaterial_original = new THREE.ShaderMaterial( {
      uniforms: {
        // the textures
        nbChunks: {
          type: "i",
          value: 0
        },
        textures: {
          type: "t",
          value: [  fakeTexture, fakeTexture, fakeTexture, fakeTexture,
                    fakeTexture, fakeTexture, fakeTexture, fakeTexture]
        },
        // the texture origins (in the same order)
        textureOrigins: {
          type: "v3v",
          value: [  fakeOrigin, fakeOrigin, fakeOrigin, fakeOrigin,
                    fakeOrigin, fakeOrigin, fakeOrigin, fakeOrigin]
        },
        chunkSize : {
          type: "f",
          value: 1
        },
        colorMap : {
          type: "t",
          value: that._colormapManager.getCurrentColorMap().colormap
        },
        useColorMap : {
          type: "b",
          value: that._colormapManager.isColormappingEnabled()
        }
      }
      ,
      vertexShader: ShaderImporter.texture3d_vert,
      fragmentShader: ShaderImporter.texture3d_frag,
      side: THREE.DoubleSide,
      transparent: true
    });

    for(var j=0; j<this._subPlaneDim.row; j++){
      for(var i=0; i<this._subPlaneDim.col; i++){
        var subPlaneMaterial = subPlaneMaterial_original.clone();
        var mesh = new THREE.Mesh( subPlaneGeometry, subPlaneMaterial );

        mesh.position.set(-this._subPlaneDim.col*this._subPlaneSize/2 + i*this._subPlaneSize + this._subPlaneSize/2, -this._subPlaneDim.row*this._subPlaneSize/2 + j*this._subPlaneSize + this._subPlaneSize/2, 0.0);

        this._plane.add( mesh );
        this._subPlanes.push( mesh );
        this._shaderMaterials.push( subPlaneMaterial );
      }
    }

  }


  /**
  * Defines the level manager so that the texture chunks can be fetched for each sub-plane.
  * @param {LevelManager} lm - the level manager
  */
  setLevelManager(lm){
    this._levelManager = lm;
  }


  /**
  * Debugging. Chanfe the color of the mesh of the plane, bit first, the plane material has to be set as a mesh.
  */
  setMeshColor(c){
    this._subPlanes[0].material.color = c;
  }


  /**
  * fetch each texture info, build a uniform and
  */
  updateUniforms(){
    var nbSubPlanes = this._subPlaneDim.row * this._subPlaneDim.col;
    var textureData = 0;

    for(var i=0; i<nbSubPlanes; i++){
      // center of the sub-plane in world coordinates
      var center = this._subPlanes[i].localToWorld(new THREE.Vector3(0, 0, 0));
      //var chunkSizeWC = this._levelManager.getCurrentChunkSizeWc();

      //textureData = this._levelManager.get8ClosestTextureData([center.x, center.y, center.z]);
      textureData = this._levelManager.get8ClosestTextureDataByLvl(
        [center.x, center.y, center.z],
        this._resolutionLevel
      );

      this._updateSubPlaneUniform(i, textureData);
    }

  }


  printSubPlaneCenterWorld(){
    var nbSubPlanes = this._subPlaneDim.row * this._subPlaneDim.col;
    for(var i=0; i<nbSubPlanes; i++){
      // center of the sub-plane in world coordinates
      var center = this._subPlanes[i].localToWorld(new THREE.Vector3(0, 0, 0));
    }
  }


  /**
  * [PRIVATE]
  * Update the uniform of a specific sub-plane using the texture data. This will automatically update the related fragment shader.
  * @param {Number} i - index of the subplane to update.
  * @textureData {Object} textureData - texture data as created by LevelManager.get8ClosestTextureData()
  */
  _updateSubPlaneUniform(i, textureData){
    //var chunkSizeWC = this._levelManager.getCurrentChunkSizeWc();
    var chunkSizeWC = this._levelManager.getChunkSizeWcByLvl( this._resolutionLevel );

    var uniforms = this._shaderMaterials[i].uniforms;
    uniforms.nbChunks.value = textureData.nbValid;
    uniforms.textures.value = textureData.textures;
    uniforms.textureOrigins.value = textureData.origins;
    uniforms.chunkSize.value = chunkSizeWC;

    uniforms.useColorMap.value = this._colormapManager.isColormappingEnabled();
    uniforms.colorMap.value = this._colormapManager.getCurrentColorMap().colormap;


    //uniforms.colorMap.value = THREE.ImageUtils.loadTexture( "colormaps/rainbow.png" );
    //this._shaderMaterials[i].needsUpdate = true;  // apparently useless

  }


  /**
  * @return the main plane, containing all the sub-planes
  */
  getPlane(){
    return this._plane;
  }


  /**
  * Update the internal resolution level and scale the plane accordingly.
  * @param {Number} lvl - zoom level, most likely in [0, 6] (integer)
  */
  updateScaleFromRezLvl( lvl ){

    // safety measure
    if(lvl < 0){
      lvl = 0;
    }

    this._resolutionLevel = lvl;
    var scale = 1 / Math.pow( 2, this._resolutionLevel );

    this._plane.scale.x = scale;
    this._plane.scale.y = scale;
    this._plane.scale.z = scale;

    // explicitely call to update the matrix, otherwise it would be called at the next render
    // and in the meantime, we need to have proper position to load the chunks.
    this._plane.updateMatrixWorld();

    // this one is not supposed to be necessary
    //this._plane.updateMatrix();

    // now the size is updated, we update the texture
    this.updateUniforms();
  }


  /**
  * Compute and return the normal vector of this plane in world coordinates using the local quaternion.
  * @returns {THREE.Vector3} a normalized vector.
  */
  getWorldNormal(){
    return this._getWorldVectorNormalized( new THREE.Vector3(0, 0, 1) );
  }


  getWorldVectorU(){
    return this._getWorldVectorNormalized( new THREE.Vector3(1, 0, 0) );
  }


  getWorldVectorV(){
    return this._getWorldVectorNormalized( new THREE.Vector3(0, 1, 0) );
  }


  /**
  * [PRIVATE]
  * Transform a local vector (local to the plane) into a world coodinate vector.
  * @param {THREE.Vector3} v - a local vector
  * @returns {THREE.Vector3} a vector in world coodinates
  */
  _getWorldVectorNormalized( v ){
    var ParentQuaternion = new THREE.Quaternion().copy(this._plane.quaternion);
    var vector = v.clone();
    vector.applyQuaternion(ParentQuaternion).normalize();
    return vector;
  }


  /**
  * @return {Number} the size of this plane diagonal in world coordinates.
  */
  getWorldDiagonal(){
    var diago = Math.sqrt( Math.pow(this._subPlaneDim.row, 2) + Math.pow(this._subPlaneDim.col, 2) ) * this._plane.scale.x;

    return diago;
  }


  /**
  * Enable a given layer in the visibility mask, so that it's visible by a camera with the same layer activated.
  */
  enableLayer( l ){
    this._subPlanes.forEach(function(sp){
      sp.layers.enable(l);
    });
  }


  /**
  * Disable a given layer in the visibility mask, so that it's not visible by a camera with a different layer activated.
  */
  disableLayer( l ){
    this._subPlanes.forEach(function(sp){
      sp.layers.disable(l);
    });
  }




} /* END class ProjectionPlane */

/**
* An instance of PlaneManager creates ans give some access to 2 small collections of ProjectionPlane instances. Each "collection" contains 3 ProjectionPlane instances (that are orthogonal to each other in the 3D space) and there is a collection for Hi resolution and a collection for Low resolution.
*
*/
class PlaneManager{

  /**
  * @param {ColorMapManager} colorMapManager - a built instance of ColorMapManager
  * @param {THREE.Object3D} parent - a parent object to place the planes in.
  */
  constructor(colorMapManager, parent){
    this._colormapManager = colorMapManager;
    this._parent = parent;

    this._projectionPlanesHiRez = [];
    this._projectionPlanesLoRez = [];

    // So far, the Hi rez and Lo rez set of planes are exactelly the same
    this._addOrthoPlanes(this._projectionPlanesHiRez);
    this._addOrthoPlanes(this._projectionPlanesLoRez);

  }

  /**
  * Build 3 orthogonal planes, add them to the array in argument arrayToAdd and add them to the parent.
  * @param {Array} arrayToAdd - array to push the 3 ProjectionPlane instances that are about to be created.
  */
  _addOrthoPlanes( arrayToAdd ){
    var pn = new ProjectionPlane(1, this._colormapManager);
    pn.setMeshColor(new THREE.Color(0x000099) );
    arrayToAdd.push( pn );
    this._parent.add( pn.getPlane() );

    var pu = new ProjectionPlane(1, this._colormapManager);
    arrayToAdd.push( pu );
    pu.getPlane().rotateX( Math.PI / 2);
    this._parent.add( pu.getPlane() );

    var pv = new ProjectionPlane(1, this._colormapManager);
    pv.setMeshColor(new THREE.Color(0x990000) );
    arrayToAdd.push( pv );
    pv.getPlane().rotateY( Math.PI / 2);
    pv.getPlane().rotateZ( Math.PI / 2);
    this._parent.add( pv.getPlane() );
  }


  /**
  * Enable a layer mask for the low rez planes, so that the planes are visible from a camera with the same enabled layer.
  * @param {Number} layerIndex - layer to enable, must be in [0, 31]
  */
  enableLayerHiRez(layerIndex){
    this._enableLayerPlaneArray(layerIndex, this._projectionPlanesHiRez);
  }


  /**
  * Enable a layer mask for the hi rez planes, so that the planes are visible from a camera with the same enabled layer.
  * @param {Number} layerIndex - layer to enable, must be in [0, 31]
  */
  enableLayerLoRez(layerIndex){
    this._enableLayerPlaneArray(layerIndex, this._projectionPlanesLoRez);
  }


  /**
  * [PRIVATE]
  * Generic method to enable a layer. Should no be used, use enableLayerHiRez or enableLayerLoRez instead.
  * @param {Number} layerIndex - index of the layer to enable
  * @param {Array} arrayOfPlanes - array of ProjectionPlane instances to which we want to enable a layer
  */
  _enableLayerPlaneArray(layerIndex, arrayOfPlanes){
    arrayOfPlanes.forEach(function(plane){
      plane.enableLayer(layerIndex);
    });
  }


  /**
  * Disable a layer mask for the low rez planes, so that the planes are invisible from a camera that does not have the same enabled layer.
  * @param {Number} layerIndex - layer to enable, must be in [0, 31]
  */
  disableLayerHiRez(layerIndex){
    this._disableLayerPlaneArray(layerIndex, this._projectionPlanesHiRez);
  }


  /**
  * Disable a layer mask for the hi rez planes, so that the planes are invisible from a camera that does not have the same enabled layer.
  * @param {Number} layerIndex - layer to enable, must be in [0, 31]
  */
  disableLayerLoRez(layerIndex){
    this._disableLayerPlaneArray(layerIndex, this._projectionPlanesLoRez);
  }


  /**
  * [PRIVATE]
  * Generic method to disable a layer. Should no be used, use enableLayerHiRez or enableLayerLoRez instead.
  * @param {Number} layerIndex - index of the layer to enable
  * @param {Array} arrayOfPlanes - array of ProjectionPlane instances to which we want to enable a layer
  */
  _disableLayerPlaneArray(layerIndex, arrayOfPlanes){
    arrayOfPlanes.forEach(function(plane){
      plane.disableLayer(layerIndex);
    });
  }


  /**
  * Defines a LevelManager instance for all the ProjectionPlane of all sub collection (hi rez + lo rez)
  * @param {LevelManager} lvlMgr - a built instance of LevelManager.
  */
  setLevelManager(lvlMgr){
    this._setLevelManagerPlaneArray(lvlMgr, this._projectionPlanesHiRez);
    this._setLevelManagerPlaneArray(lvlMgr, this._projectionPlanesLoRez);
  }


  /**
  * [PRIVATE]
  * A rather generic method to set the LevelManager instance to an whole array of ProjectionPlane instances.
  * Written in case more collection of ProjectionPlanes would be added.
  * @param {LevelManager} lvlMgr - a built instance of LevelManager.
  * @param {Array} arrayOfPlanes - array of ProjectionPlane instances to which we want to set the level manager.
  */
  _setLevelManagerPlaneArray(lvlMgr, arrayOfPlanes){
    arrayOfPlanes.forEach(function(plane){
      plane.setLevelManager(lvlMgr);
    });
  }


  /**
  * Update the scale of all instance of all ProjectionPlanes. Still, the lo-rez plane will be updated at (lvl - 2).
  * @param {Number} lvl - level or resolution, most likely in [0, 6]
  */
  updateScaleFromRezLvl(lvl){
    this._updateScaleFromRezLvlPlaneArray(lvl, this._projectionPlanesHiRez);
    this._updateScaleFromRezLvlPlaneArray(lvl - 2, this._projectionPlanesLoRez);
  }


  /**
  * [PRIVATE]
  * Generic function for whatever array of ProjectionPlane instances to update its scale.
  * @param {Number} lvl - level or resolution, most likely in [0, 6]
  * @param {Array} arrayOfPlanes - array of ProjectionPlane instances to which we want to update the scale.
  */
  _updateScaleFromRezLvlPlaneArray(lvl, arrayOfPlanes){
    arrayOfPlanes.forEach( function(plane){
      plane.updateScaleFromRezLvl( lvl );
    });
  }


  /**
  * Update the uniform of all the ProjectionPlane instances.
  */
  updateUniforms(){
    this._updateUniformsPlaneArray(this._projectionPlanesHiRez);
    this._updateUniformsPlaneArray(this._projectionPlanesLoRez);
  }


  /**
  * [PRIVATE]
  * Generic function to updates all the ProjectionPlane instances' uniforms.
  * @param {Array} arrayOfPlanes - array of ProjectionPlane instances to which we want to update the uniforms.
  */
  _updateUniformsPlaneArray(arrayOfPlanes){
    arrayOfPlanes.forEach( function(plane){
      plane.updateUniforms();
    });
  }


  /**
  * @return the size of the plane diagonal in world dimensions.
  */
  getWorldDiagonalHiRez(){
    return this._projectionPlanesHiRez[0].getWorldDiagonal();
  }


  /**
  * @param {Number} planeIndex - index of the plane (Hi-rez) we want the normal vector of.
  * @returns {THREE.Vector3} the normal vector to the plane with such index.
  */
  getWorldVectorN(planeIndex){
    return this._projectionPlanesHiRez[planeIndex].getWorldNormal();
  }


  /**
  * @param {Number} planeIndex - index of the plane (Hi-rez) we want the U vector of.
  * @returns {THREE.Vector3} the U vector to the plane with such index.
  */
  getWorldVectorU(planeIndex){
    return this._projectionPlanesHiRez[planeIndex].getWorldVectorU();
  }


  /**
  * @param {Number} planeIndex - index of the plane (Hi-rez) we want the V vector of.
  * @returns {THREE.Vector3} the V vector to the plane with such index.
  */
  getWorldVectorV(planeIndex){
    return this._projectionPlanesHiRez[planeIndex].getWorldVectorV();
  }


} /* END CLASS PlaneManager */

/**
* A QuadScene is a THREE js context where the viewport is split in 4 windows, for each window comes a QuadView.
* Originally, the purpose of the QuadScene is to display 3 orthogonal views usin othometric cameras, and one additional view using a perspective camera. The later is supposed to be more free of movement, giving an flexible global point of view. The 3 ortho cam are more likely to be in object coordinate so that rotating the main object wont affect what is shown on this views.
*
* @param {String} DomContainer - ID of div to show the QuadScene
* @param {Object} config - {datatype: String, configURL: String} where datatype is the input data type ("octree_tiles" is the only available for the moment) and configURL is the URL of the JSON config file.
*
*/
class QuadScene{

  constructor(DomContainer, config, rez=0){
    this._config = config;
    this._ready = false;
    this._counterRefresh = 0;
    this._resolutionLevel = rez;

    // the four QuadView instances, to be built (initViews)
    this._quadViews = [];
    this._quadViewInteraction = null;

    // all the planes to intersect the chunks. They will all lie into _mainObjectContainer
    this._planeManager = null;

    // visible bounding box for the dataset
    this._cubeHull3D = null;

    // size of the dataset in world coords. TO BE INIT
    this._cubeHullSize = [0, 0, 0];

    // a static gimbal to show dataset orientation
    this._orientationHelper = null;

    // called whenever the lvl, orientation or position changes (if set)
    this._onChangeCallback = null;

    // Called when the config file is loaded, the planes are build and now we just wait to do things
    this._onReadyCallback = null;

    // called whennever the config file failed to load
    this._onConfigFileErrorCallback = null;

    // a single colormap manager that will be used for all the planes
    this._colormapManager = new ColorMapManager();

    // variables used to sync the dat.guy widget and some position/rotation.
    // see _initUI() for more info.
    this._guiVar = null;
    this._datGui = new dat.GUI();
    this._initUI();

    // Container on the DOM tree, most likely a div
    this._domContainer = document.getElementById( DomContainer );

    // scene, where everything goes
    this._scene = new THREE.Scene();

    // renderer construction and setting
    this._renderer = new THREE.WebGLRenderer( { antialias: true } );
    this._renderer.setPixelRatio( window.devicePixelRatio );
    this._renderer.setSize( window.innerWidth, window.innerHeight );
    this._domContainer.appendChild( this._renderer.domElement );

    // the main container to put objects in
    this._mainObjectContainer = new THREE.Object3D();
    this._scene.add(this._mainObjectContainer );

    // TODO: use object real size (maybe)
    // a default camera distance we use instead of cube real size.
    this._cameraDistance = 10;

    // to feed the renderer. will be init
    this._windowSize = {
      width: 0 ,
      height: 0
    };

    this._stats = null;

    this._initViews();

    this._levelManager = new LevelManager();

    this._initPlaneManager();
    //this._addProjectionPlane();
    this._initLevelManager();
    this._animate();
  }


  /**
  * [PRIVATE]
  * Initialize the 4 QuadView instances. The 3 first being ortho cam and the last being a global view perspective cam.
  */
  _initViews(){
    var topLeftView = new QuadView(this._scene, this._renderer, this._cameraDistance);
    topLeftView.initTopLeft();
    topLeftView.initOrthoCamera();
    topLeftView.useRelativeCoordinatesOf(this._mainObjectContainer);
    topLeftView.enableLayer( 0 );

    var topRightView = new QuadView(this._scene, this._renderer, this._cameraDistance);
    topRightView.initTopRight();
    topRightView.initOrthoCamera();
    topRightView.useRelativeCoordinatesOf(this._mainObjectContainer);
    topRightView.enableLayer( 0 );

    var bottomLeft = new QuadView(this._scene, this._renderer, this._cameraDistance);
    bottomLeft.initBottomLeft();
    bottomLeft.initOrthoCamera();
    bottomLeft.useRelativeCoordinatesOf(this._mainObjectContainer);
    bottomLeft.enableLayer( 0 );

    var bottomRight = new QuadView(this._scene, this._renderer, this._cameraDistance);
    bottomRight.initBottomRight();
    bottomRight.initPerspectiveCamera();
    bottomRight.enableLayer( 1 );
    bottomRight.disableLayer(0);
    bottomRight.addTrackballControl(this._render, this);

    // adding the views
    this._quadViews.push(topLeftView);
    this._quadViews.push(topRightView);
    this._quadViews.push(bottomLeft);
    this._quadViews.push(bottomRight);

    // the quadviewinteraction instance deals with mouse things
    this._quadViewInteraction = new QuadViewInteraction( this._quadViews );
  }


  /**
  * [PRIVATE]
  * Initialize the planeManager, so that we eventually have something to display here!
  */
  _initPlaneManager(){
    this._planeManager = new PlaneManager(this._colormapManager, this._mainObjectContainer);
    this._planeManager.enableLayerHiRez(0);
    this._planeManager.disableLayerHiRez(1);
    this._planeManager.enableLayerLoRez(1);
    this._planeManager.disableLayerLoRez(0);
  }


  /**
  * Add a statistics widget
  */
  initStat(){
    this._stats = new Stats();
    this._domContainer.appendChild( this._stats.dom );
  }


  /**
  * [PRIVATE]
  * Update the renderer with new window size if they changed.
  */
  _updateSize() {
    if (  this._windowSize.width != window.innerWidth ||
          this._windowSize.height != window.innerHeight ) {

      this._windowSize.width  = window.innerWidth;
      this._windowSize.height = window.innerHeight;

      // update the object that deals with view interaction
      this._quadViewInteraction.updateWindowSize(
        this._windowSize.width,
        this._windowSize.height
      );

      this._renderer.setSize ( this._windowSize.width, this._windowSize.height );
    }
  }



  /**
  * [PRIVATE]
  * To feed the animation feature built in WebGL.
  */
  _animate(){
    this._render();

    if(this._stats){
      this._stats.update();
    }

    // call a built-in webGL method for annimation
    requestAnimationFrame( this._animate.bind(this) );

    // updating the control is necessary in the case of a TrackballControls
    this._quadViews[3].updateControl();
  }


  /**
  * [PRIVATE]
  * Typical rendering function, necessary in THREE js
  */
  _render(){
    let that = this;

    // TODO: make somethink better for refresh once per sec!
    if(this._ready){
      if(this._counterRefresh % 30 == 0){
        this._updateAllPlanesShaderUniforms();
      }
      this._counterRefresh ++;
    }

    // in case the window was resized
    this._updateSize();

    // refresh each view
    this._quadViews.forEach(function(view){
      view.renderView();
    });

  }


  /**
  * [PRIVATE]
  * Initialize the DAT.GUI component
  */
  _initUI(){
    var that = this;

    this._guiVar = {
      posx: 0,
      posy: 0,
      posz: 0,
      rotx: 0,
      roty: 0,
      rotz: 0,
      frustrum: 1,
      resolutionLevel: that._resolutionLevel,
      colormapChoice: 0, // the value does not matter


      toggleOrientationHelper: function(){
        that._orientationHelper.toggle();
      },

      toggleCubeHull: function(){
        that.toggleCubeHull();
      },

      refresh: function(){
        that._updateAllPlanesShaderUniforms();
      },

      debug: function(){
        console.log(that._colormapManager.getCurrentColorMap());
      }

    };

    this._datGui.add(this._guiVar, 'toggleOrientationHelper').name("Toggle helper");
    this._datGui.add(this._guiVar, 'toggleCubeHull').name("Toggle cube");

    //var controllerFrustrum = this._datGui.add(this._guiVar, 'frustrum', 0, 0.05).name("frustrum").step(0.001).listen();

    var levelController = this._datGui.add(this._guiVar, 'resolutionLevel', 0, 6).name("resolutionLevel").step(1).listen();

    this._datGui.add(this._guiVar, 'debug');

    levelController.onFinishChange(function(lvl) {
      that.setResolutionLevel(lvl);
      //that._updateOthoCamFrustrum();
    });

    // whenever a colormap is loaded, add it to the list in dat.gui
    this._colormapManager.onColormapUpdate( this._updateColormapList.bind(this) );
  }


  /**
  * [PRIVATE]
  * Suposed to be called as a callback of _colormapManager.onColormapUpdate.
  * Updates the dat.guy view and its corresponding controller with the new list of colormaps
  */
  _updateColormapList(){
    var that = this;

    if( typeof this._colormapController !== "undefined" ){
      this._datGui.remove(this._colormapController);
      this._colormapController = null;
    }

    this._colormapController = this._datGui.add(
      this._guiVar,
      'colormapChoice',
      this._colormapManager.getAvailableColormaps()
    ).name("color map");

    this._colormapController.onFinishChange(function(colormapId) {
      that._colormapManager.useColormap(colormapId);
    });
  }


  /**
  * Set the position of the center of the main object (where the center of the planes are).
  * @param {Number} x - x position in world coordinates
  * @param {Number} y - y position in world coordinates
  * @param {Number} z - z position in world coordinates
  */
  setMainObjectPosition(x, y, z){
    if(x>0 && x<this._cubeHullSize[0] &&
       y>0 && y<this._cubeHullSize[1] &&
       z>0 && z<this._cubeHullSize[2]
    ){
      this._mainObjectContainer.position.x = x;
      this._mainObjectContainer.position.y = y;
      this._mainObjectContainer.position.z = z;

      // already done if called by the renderer and using DAT.gui
      this._guiVar.posx = x;
      this._guiVar.posy = y;
      this._guiVar.posz = z;

      this._updateAllPlanesShaderUniforms();
      this._updatePerspectiveCameraLookAt();

      this._syncOrientationHelperPosition();
    }
  }


  /**
  * Set the x position of the main object container.
  * @param {Number} x - position
  */
  setMainObjectPositionX(x){
    if(x>0 && x<this._cubeHullSize[0]){
      this._mainObjectContainer.position.x = x;
      this._updateAllPlanesShaderUniforms();
      this._updatePerspectiveCameraLookAt();

      // already done if called by the renderer and using DAT.gui
      this._guiVar.posx = x;

      this._syncOrientationHelperPosition();
    }
  }


  /**
  * Set the y position of the main object container.
  * @param {Number} y - position
  */
  setMainObjectPositionY(y){
    if(y>0 && y<this._cubeHullSize[1]){
      this._mainObjectContainer.position.y = y;
      this._updateAllPlanesShaderUniforms();
      this._updatePerspectiveCameraLookAt();

      // already done if called by the renderer and using DAT.gui
      this._guiVar.posy = y;

      this._syncOrientationHelperPosition();
    }
  }


  /**
  * Set the z position of the main object container.
  * @param {Number} z - position
  */
  setMainObjectPositionZ(z){
    if(z>0 && z<this._cubeHullSize[2]){
      this._mainObjectContainer.position.z = z;
      this._updateAllPlanesShaderUniforms();
      this._updatePerspectiveCameraLookAt();

      // already done if called by the renderer and using DAT.gui
      this._guiVar.posz = z;

      this._syncOrientationHelperPosition();
    }
  }


  /**
  * Set the Euler angles of MainObject (that contains the planes)
  * @param {Number} x - x rotation in radian
  * @param {Number} y - y rotation in radian
  * @param {Number} z - z rotation in radian
  */
  setMainObjectRotation(x, y, z){
    this._mainObjectContainer.rotation.x = x;
    this._mainObjectContainer.rotation.y = y;
    this._mainObjectContainer.rotation.z = z;

    // already done if called by the renderer and using DAT.gui
    this._guiVar.rotx = x;
    this._guiVar.roty = y;
    this._guiVar.rotz = z;

    this._updateAllPlanesShaderUniforms();
  }



  /**
  * [PRIVATE]
  * Initialize the level manager and run some local init method when the lvl manager is ready.
  */
  _initLevelManager(){
    var that = this;

    // the config file was succesfully loaded
    this._levelManager.loadConfig(this._config);

    this._levelManager.onReady(function(){

      that._planeManager.setLevelManager( that._levelManager );
      that._levelManager.setResolutionLevel( that._resolutionLevel );
      that._buildCubeHull();

      // Place the plane intersection at the center of the data
      that.setMainObjectPosition(
        that._cubeHullSize[0] / 2,
        that._cubeHullSize[1] / 2,
        that._cubeHullSize[2] / 2
      );

      that._initOrientationHelper();
      that.setResolutionLevel( that._resolutionLevel );
      that._initPlaneInteraction();
      that._ready = true;

      if(that._onReadyCallback){
        that._onReadyCallback(that);
      }

    });


    // the config file failed to load
    this._levelManager.onConfigError( function(url, code){
      if(that._onConfigFileErrorCallback){
        that._onConfigFileErrorCallback(url, code);
      }
    });

  }


  /**
  * Update the resolution level, refresh the frustrum, the size of the helper, the scale of the planes.
  * @param {Number} lvl - resolution level in [0, 6]
  */
  setResolutionLevel(lvl){
    console.log("--------- LVL " + lvl + " ---------------");
    this._resolutionLevel = lvl;
    this._levelManager.setResolutionLevel( this._resolutionLevel );
    this._planeManager.updateScaleFromRezLvl( this._resolutionLevel );

    this._syncOrientationHelperScale();
    this._guiVar.resolutionLevel = lvl;
    this._updateOthoCamFrustrum();

    if(this._onUpdateViewCallback){
      this._onUpdateViewCallback( this.getMainObjectInfo() );
    }
  }



  /**
  * Updates the uniforms to send to the shader of the plane. Will trigger chunk loading for those which are not already in memory.
  */
  _updateAllPlanesShaderUniforms(){
    this._planeManager.updateUniforms();
  }


  /**
  * So that the perspective cam targets the object container center
  */
  _updatePerspectiveCameraLookAt(){
    this._quadViews[3].updateLookAt( this._mainObjectContainer.position );
  }


  /**
  * Updates the frustrum of the 3 ortho cam by adjusting a factor relative to the level of resolution. This ensure we keep the same image ratio.
  */
  _updateOthoCamFrustrum(){
    var frustrumFactor = 1 / Math.pow(2, this._resolutionLevel);
    this._quadViews[0].updateOrthoCamFrustrum( frustrumFactor );
    this._quadViews[1].updateOrthoCamFrustrum( frustrumFactor );
    this._quadViews[2].updateOrthoCamFrustrum( frustrumFactor );
  }


  /**
  * Make the cube hull visible. Builds it if not already built.
  */
  showCubeHull(){
    if(!this._cubeHull3D){
      this._buildCubeHull();
    }else{
      this._cubeHull3D.visible = true;
    }
  }


  /**
  * Make the cube hull invisible.
  */
  hideCubeHull(){
    if(this._cubeHull3D){
      this._cubeHull3D.visible = false;
    }
  }


  /**
  * Make the cube hull visible or not (reverses the current state)
  */
  toggleCubeHull(){
    if(this._cubeHull3D){
      this._cubeHull3D.visible = !this._cubeHull3D.visible;
    }
  }


  /**
  * [PRIVATE]
  * Build the cube hull, in other word, the box that adds some notion of boundaries to the dataset.
  */
  _buildCubeHull(){
    if(this._cubeHull3D)
      return;

    this._cubeHullSize = this._levelManager.getCubeHull();

    var cubeHullMaterial = new THREE.MeshBasicMaterial( {
      transparent: true,
      opacity: 0.8,
      color: 0xffffff,
      vertexColors: THREE.FaceColors,
      side: THREE.BackSide
    } );

    var cubeHullGeometry = new THREE.BoxGeometry(
      this._cubeHullSize[0],
      this._cubeHullSize[1],
      this._cubeHullSize[2]
    );

    cubeHullGeometry.faces[0].color.setHex( 0xFF7A7A ); // Sagittal
    cubeHullGeometry.faces[1].color.setHex( 0xFF7A7A );
    cubeHullGeometry.faces[2].color.setHex( 0xff3333 );
    cubeHullGeometry.faces[3].color.setHex( 0xff3333 );
    cubeHullGeometry.faces[4].color.setHex( 0x61FA94 ); // Coronal
    cubeHullGeometry.faces[5].color.setHex( 0x61FA94 );
    cubeHullGeometry.faces[6].color.setHex( 0xA7FAC3 );
    cubeHullGeometry.faces[7].color.setHex( 0xA7FAC3 );
    cubeHullGeometry.faces[8].color.setHex( 0x95CCFC ); // Axial
    cubeHullGeometry.faces[9].color.setHex( 0x95CCFC );
    cubeHullGeometry.faces[10].color.setHex( 0x0088ff );
    cubeHullGeometry.faces[11].color.setHex( 0x0088ff );

    // mesh
    var cubeHullPlainMesh = new THREE.Mesh( cubeHullGeometry, cubeHullMaterial );
    this._cubeHull3D = new THREE.Object3D();
    this._cubeHull3D.add( cubeHullPlainMesh );
    this._cubeHull3D.position.x = this._cubeHullSize[0] / 2;
    this._cubeHull3D.position.y = this._cubeHullSize[1] / 2;
    this._cubeHull3D.position.z = this._cubeHullSize[2] / 2;

    this._cubeHull3D.children.forEach( function(child){
      child.layers.disable( 0 );
      child.layers.enable( 1 );
    });

    this._scene.add( this._cubeHull3D );
  }


  /**
  * Initialize the orientation helper and adds it to the scene (and not to the main object, because it is not supposed to rotate)
  */
  _initOrientationHelper(){
    this._orientationHelper = new OrientationHelper(
      this._planeManager.getWorldDiagonalHiRez() / 13
    );

    this._orientationHelper.addTo( this._scene );
    this._syncOrientationHelperPosition();
  }


  /**
  * Synchronize the orientation helper position based on the main object position.
  */
  _syncOrientationHelperPosition(){
    if(this._orientationHelper){
      this._orientationHelper.setPosition( this._mainObjectContainer.position );
    }
  }


  /**
  * Triggered when the resolution level changes to keep the orientation helper the right size.
  */
  _syncOrientationHelperScale(){
    this._orientationHelper.rescaleFromResolutionLvl( this._resolutionLevel );
  }


  /**
  * Rotate the main object container on its native X axis. This X axis is relative to inside the object.
  * @param {Number} rad - angle in radian
  */
  rotateNativePlaneX( rad ){
    this._rotateNativePlane(2, rad);
  }


  /**
  * Rotate the main object container on its native Y axis. This Y axis is relative to inside the object.
  * @param {Number} rad - angle in radian
  */
  rotateNativePlaneY( rad ){
    this._rotateNativePlane(1, rad);
  }


  /**
  * Rotate the main object container on its native Z axis. This Z axis is relative to inside the object.
  * @param {Number} rad - angle in radian
  */
  rotateNativePlaneZ( rad ){
    this._rotateNativePlane(0, rad);
  }


  /**
  * [PRIVATE]
  * Rotate the main object container on one of its native axis. This axis is relative to inside the object.
  * @param {Number} planeIndex - Index of the plane (0:Z, 1:Y, 2:X)
  * @param {Number} rad - angle in radian
  */
  _rotateNativePlane(planeIndex, rad){
    var normalPlane = this._planeManager.getWorldVectorN(planeIndex);
    this._mainObjectContainer.rotateOnAxis ( normalPlane, rad );
    this._updateAllPlanesShaderUniforms();
  }


  /**
  * Translate the main object container along the u and v vector relative to the x plane instead of the regular coordinate system X.
  * @param {Number} uDistance - distance to move along the uVector of the plane X
  * @param {Number} vDistance - distance to move along the vVector of the plane X
  */
  translateNativePlaneX(uDistance, vDistance){
    this._translateNativePlane(2, uDistance, vDistance);
  }


  /**
  * Translate the main object container along the u and v vector relative to the y plane instead of the regular coordinate system Y.
  * @param {Number} uDistance - distance to move along the uVector of the plane Y
  * @param {Number} vDistance - distance to move along the vVector of the plane Y
  */
  translateNativePlaneY(uDistance, vDistance){
    this._translateNativePlane(1, uDistance, vDistance);
  }


  /**
  * Translate the main object container along the u and v vector relative to the z plane instead of the regular coordinate system Z.
  * @param {Number} uDistance - distance to move along the uVector of the plane Z
  * @param {Number} vDistance - distance to move along the vVector of the plane Z
  */
  translateNativePlaneZ(uDistance, vDistance){
    this._translateNativePlane(0, uDistance, vDistance);
  }


  /**
  * [PRIVATE]
  * Moves the main object container using a the u and v local unit vector of a specific plane.
  * The u and v vector are orthogonal to the plane's normal (even in an oblique context).
  * @param {Number} planeIndex - index of the plane, most likely in [0, 2]
  * @param {Number} uDistance - distance to move the main object along u vector. signed float.
  * @param {Number} vDistance - distance to move the main object along v vector. signed float.
  */
  _translateNativePlane(planeIndex, uDistance, vDistance){
    var uVector = this._planeManager.getWorldVectorU(planeIndex);
    var vVector = this._planeManager.getWorldVectorV(planeIndex);

    this._mainObjectContainer.translateOnAxis( uVector, uDistance );
    this._mainObjectContainer.translateOnAxis( vVector, vDistance );

    // update things related to the main object
    this._updateAllPlanesShaderUniforms();
    this._updatePerspectiveCameraLookAt();
    this._syncOrientationHelperPosition();

  }


  /**
  * Specify a callback for when the Quadscene is ready.
  * @param {Callback} cb - a function to be call with the object _this_ in param (the current QuadScene instance).
  */
  onReady(cb){
    this._onReadyCallback = cb;
  }


  /**
  * [PRIVATE]
  * Defines the callback for interacting with the views
  */
  _initPlaneInteraction(){
    var that = this;

    // callback def: translation
    this._quadViewInteraction.onGrabViewTranslate( function(distance, viewIndex){
      var factor = Math.pow(2, that._resolutionLevel);

      switch (viewIndex) {
        case 0:
          that.translateNativePlaneX(-distance.x/factor, distance.y/factor);
          break;
        case 1:
          that.translateNativePlaneY(distance.x/factor, distance.y/factor);
          break;
        case 2:
          that.translateNativePlaneZ(distance.x/factor, -distance.y/factor);
          break;
        default:  // if last view, we dont do anything
          return;
      }

    });

    // callback def: regular rotation (using R key)
    this._quadViewInteraction.onGrabViewRotate( function(angleRad, angleDir, viewIndex){
      switch (viewIndex) {
        case 0:
          that.rotateNativePlaneX(angleRad * angleDir);
          break;
        case 1:
          that.rotateNativePlaneY(angleRad * angleDir * -1);
          break;
        case 2:
          that.rotateNativePlaneZ(angleRad * angleDir);
          break;
        default:  // if last view, we dont do anything
          return;
      }
    });

    // callback def: transverse rotation (using T key)
    this._quadViewInteraction.onGrabViewTransverseRotate( function(distance, viewIndex){
      //var factor = Math.pow(2, that._resolutionLevel) / 10;
      var factor =  that._resolutionLevel / 2;

      switch (viewIndex) {
        case 0:
          that.rotateNativePlaneZ(distance.x / factor);
          that.rotateNativePlaneY(-distance.y / factor);
          break;
        case 1:
          that.rotateNativePlaneX(-distance.y / factor);
          that.rotateNativePlaneZ(distance.x / factor);
          break;
        case 2:
          that.rotateNativePlaneX(-distance.y / factor);
          that.rotateNativePlaneY(distance.x / factor);
          break;
        default:  // if last view, we dont do anything
          return;
      }
    });

    // callback def: arrow down
    this._quadViewInteraction.onArrowDown( function(viewIndex){
      var factor = 0.01 / Math.pow(2, that._resolutionLevel);

      switch (viewIndex) {
        case 0:
          that.translateNativePlaneY(factor, 0);
          break;
        case 1:
          that.translateNativePlaneX(factor, 0);
          break;
        case 2:
          that.translateNativePlaneY(0, -factor);
          break;
        default:  // if last view, we dont do anything
          return;
      }
    });

    // callback def: arrow up
    this._quadViewInteraction.onArrowUp( function(viewIndex){
      var factor = 0.01 / Math.pow(2, that._resolutionLevel) * -1;

      switch (viewIndex) {
        case 0:
          that.translateNativePlaneY(factor, 0);
          break;
        case 1:
          that.translateNativePlaneX(factor, 0);
          break;
        case 2:
          that.translateNativePlaneY(0, -factor);
          break;
        default:  // if last view, we dont do anything
          return;
      }
    });

    this._quadViewInteraction.onDonePlaying(function(){
      if(that._onUpdateViewCallback){
        that._onUpdateViewCallback( that.getMainObjectInfo() );
      }
    });
  }


  /**
  * @return {Object} the returned object if of the form:
  * { resolutionLvl, position {x, y, z}, rotation {x, y, z} }
  */
  getMainObjectInfo(){

    return {
      resolutionLvl: this._resolutionLevel,
      position: {
        x: this._mainObjectContainer.position.x,
        y: this._mainObjectContainer.position.y,
        z: this._mainObjectContainer.position.z
      },
      rotation: {
        x: this._mainObjectContainer.rotation.x,
        y: this._mainObjectContainer.rotation.y,
        z: this._mainObjectContainer.rotation.z
      }
    };

  }

  /**
  * Defines the callback for whenever the lvl, rotation or position changes
  */
  onUpdateView( cb ){
    this._onUpdateViewCallback = cb;
  }


  /**
  * Defines a function if an error occures when loading the config file has some trouble to load (but not necessary an error). Function called with 2 args: url and status code. The status code will define if it corresponds to an error or not.
  */
  onConfigFileError(cb){
    this._onConfigFileErrorCallback = cb;
  }


}

// if we wanted to use foo here:
//import foo from './foo.js';


// but we just want to make it accessible:
//export { Foo } from './Foo.js';



//export { ShaderImporter } from './ShaderImporter.js';

exports.TextureChunk = TextureChunk;
exports.ChunkCollection = ChunkCollection;
exports.LevelManager = LevelManager;
exports.HashIO = HashIO;
exports.QuadScene = QuadScene;

Object.defineProperty(exports, '__esModule', { value: true });

})));
