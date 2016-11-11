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

    this._originWC = new THREE.Vector3(
      this._index3D[0] * this._sizeWC,
      this._index3D[1] * this._sizeWC,
      this._index3D[2] * this._sizeWC
    );

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


    /*
    console.log("---------------------------------");
    console.log("_filepath:");
    console.log(this._filepath);
    console.log("_index3D:");
    console.log(this._index3D);
    console.log("_sizeWC:");
    console.log(this._sizeWC);
    console.log("_originWC:");
    console.log(this._originWC);
    */
  }


  /**
  * [PRIVATE] Loads the actual image file as a THREE js texture.
  */
  _loadTexture(){
    var that = this;

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

    this._createFakeTexture();

    this._chunkCounter = {
      toBeLoaded: 0,
      loaded: 0,
      failled: 0
    };

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
  * Called when a chunk is loaded or failed to load. When to total number number of toLoad Vs. Loaded+failed is equivalent, a callback may be called.
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
    }
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
  * @param {String} filepath - A valid path to a valid JSON config file.
  */
  loadConfig(filepath){
    var that = this;

    var xobj = new XMLHttpRequest();
    xobj.overrideMimeType("application/json");
    xobj.open('GET', filepath, true);
    xobj.onreadystatechange = function () {
      if (xobj.readyState == 4 && xobj.status == "200") {

        // the directory of the config file is the working directory
        that._workingDir = filepath.substring(0, Math.max(filepath.lastIndexOf("/"), filepath.lastIndexOf("\\")));

        // Rading the config object
        that._loadConfigDescription(JSON.parse(xobj.responseText));
      }
    };
    xobj.send(null);

  }


  /**
  * [PRIVATE]
  * Load the config description object, sort its multiple resolution levels
  * so that the poorer goes first and the finer goes last. Then, for each level
  * calls _addChunkCollectionLevel().
  * @param {Object} description - parsed from the JSON decription file.
  */
  _loadConfigDescription(description){
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

    levels.forEach(function(elem, index){
      that._addChunkCollectionLevel(index, elem.size);

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
  */
  _addChunkCollectionLevel(resolutionLevel, voxelSize){
    // translating voxelSize into matrix3DSize
    // aka number of chunks (64x64x64) in each dimension
    var matrix3DSize = [
      Math.ceil( voxelSize[0] / 64 ),
      Math.ceil( voxelSize[1] / 64 ),
      Math.ceil( voxelSize[2] / 64 )
    ];

    // creating a new chunk collection for this specific level
    this._chunkCollections.push( new ChunkCollection(
      resolutionLevel,
      matrix3DSize,
      this._workingDir));
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


  /**
  * @param {Array} position - world coord position as an array [x, y, z]
  * @return the texture data of the 8 chunks that are the closest to the position.
  */
  get8ClosestTextureData(position){
    var the8ClosestTextureData = this._chunkCollections[ this._resolutionLevel ]
              .get8ClosestTextureData(position);

    return the8ClosestTextureData;
  }

} /* END CLASS LevelManager */

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
      position: [ this._objectSize, 0, 0 ],
      up: [ 0, 1, 0 ]
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
      position: [ 0, this._objectSize, 0 ],
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
      position: [ 0, 0, this._objectSize ],
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
      position: [ this._objectSize / -2, this._objectSize/2, this._objectSize ],
      up: [ 0, 1, 0 ]
    };
    this._viewName = "bottom_right";
    this._backgroundColor = new THREE.Color().setRGB( 0.8, 0.8, 0.8 );
  }


  /**
  * Build an orthographic camera for this view.
  */
  initOrthoCamera(){
    let orthographicCameraFovFactor = 350;

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

    console.log(this._camera);

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
          this._control.enabled = true;
          console.log("ENTER " + this._viewName);
        }

      }else{

        // just left
        if(this._mouseInView){
          this._mouseInView = false;
          this._control.enabled = false;
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
    this._updateCameraWithControl();

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
  *
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


} /* END QuadView */

var texture3d_frag = "const int maxNbChunks = 8;\nuniform int nbChunks;\nuniform sampler2D textures[maxNbChunks];\nuniform vec3 textureOrigins[maxNbChunks];\nuniform float chunkSize;\nvarying vec4 worldCoord;\nvarying vec2 vUv;\nbool isNan(float val)\n{\n  return (val <= 0.0 || 0.0 <= val) ? false : true;\n}\nbool isInsideChunk(in vec3 chunkPosition){\n  return !( chunkPosition.x<0.0 || chunkPosition.x>=1.0 ||\n            chunkPosition.y<0.0 || chunkPosition.y>=1.0 ||\n            chunkPosition.z<0.0 || chunkPosition.z>=1.0 );\n}\nvoid getColorFrom3DTexture(in sampler2D texture, in vec3 chunkPosition, out vec4 colorFromTexture){\n  float numberOfImagePerStripY = 64.0;\n  float numberOfPixelPerSide = 64.0;\n  float yOffsetNormalized = float(int(chunkPosition.z * numberOfImagePerStripY)) / numberOfImagePerStripY;\n  float stripX = chunkPosition.x;\n  float stripY = chunkPosition.y / numberOfImagePerStripY + yOffsetNormalized;\n  vec2 posWithinStrip = vec2(stripX, stripY);\n  colorFromTexture = texture2D(texture, posWithinStrip);\n}\nvec3 worldCoord2ChunkCoord(vec4 world, vec3 textureOrigin, float chunkSize){\n  vec3 chunkSystemCoordinate = vec3( (textureOrigin.x - world.x)*(-1.0)/chunkSize,\n                                    1.0 - (textureOrigin.y - world.y)*(-1.0)/chunkSize,\n                                    1.0 - (textureOrigin.z - world.z)*(-1.0)/chunkSize);\n  return chunkSystemCoordinate;\n}\nvoid main( void ) {\n  vec2 shaderPos = vUv;\n  vec4 color = vec4(0.0, 1.0 , 1.0, 0.2);\n  vec3 chunkPosition;\n  if(nbChunks >= 1){\n    chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[0], chunkSize);\n    if( isInsideChunk(chunkPosition) ){\n      getColorFrom3DTexture(textures[0], chunkPosition, color);\n    }\n    if(nbChunks >= 2){\n      chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[1], chunkSize);\n      if( isInsideChunk(chunkPosition) ){\n        getColorFrom3DTexture(textures[1], chunkPosition, color);\n      }\n      if(nbChunks >= 3){\n        chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[2], chunkSize);\n        if( isInsideChunk(chunkPosition) ){\n          getColorFrom3DTexture(textures[2], chunkPosition, color);\n        }\n        if(nbChunks >= 4){\n          chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[3], chunkSize);\n          if( isInsideChunk(chunkPosition) ){\n            getColorFrom3DTexture(textures[3], chunkPosition, color);\n          }\n          if(nbChunks >= 5){\n            chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[4], chunkSize);\n            if( isInsideChunk(chunkPosition) ){\n              getColorFrom3DTexture(textures[4], chunkPosition, color);\n            }\n            if(nbChunks >= 6){\n              chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[5], chunkSize);\n              if( isInsideChunk(chunkPosition) ){\n                getColorFrom3DTexture(textures[5], chunkPosition, color);\n              }\n              if(nbChunks >= 7){\n                chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[6], chunkSize);\n                if( isInsideChunk(chunkPosition) ){\n                  getColorFrom3DTexture(textures[6], chunkPosition, color);\n                }\n                if(nbChunks == 8){\n                  chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[7], chunkSize);\n                  if( isInsideChunk(chunkPosition) ){\n                    getColorFrom3DTexture(textures[7], chunkPosition, color);\n                  }\n                }\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n  gl_FragColor = color;\n}\n";

var texture3d_vert = "uniform float chunkSize;\nvarying vec2 vUv;\nvarying vec4 worldCoord;\nvoid main()\n{\n  vUv = uv;\n  vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );\n  gl_Position = projectionMatrix * mvPosition;\n  worldCoord = modelMatrix * vec4( position, 1.0 );\n}\n";

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
  constructor( chunkSize ){
    this._plane = new THREE.Object3D();

    this._subPlaneSize = chunkSize / 2;

    // list of subplanes
    this._subPlanes = [];

    // one shader material per sub-plane
    this._shaderMaterials = [];

    // one uniform per shader
    //this.uniforms = [];

    // number of rows and cols of sub-planes to compose the _plane
    this._subPlaneDim = {row: 10, col: 20};

    this._buildSubPlanes();

    // given by aggregation
    this._levelManager = null;

    this._resolutionLevel = 0;
  }


  /**
  *
  */
  _buildSubPlanes(){

    var subPlaneGeometry = new THREE.PlaneBufferGeometry( this._subPlaneSize, this._subPlaneSize, 1 );

    /*
    var subPlaneMaterial = new THREE.MeshBasicMaterial({
        color: 0x666666,
        wireframe: true
    });
    */

    var fakeTexture = new THREE.DataTexture(
        new Uint8Array(1),
        1,
        1,
        THREE.LuminanceFormat,  // format, luminance is for 1-band image
        THREE.UnsignedByteType  // type for our Uint8Array
      );

    var fakeOrigin = new THREE.Vector3(0, 0, 0);

    var subPlaneMaterial_original = new THREE.ShaderMaterial( {
      //uniforms: /*uniforms*/,


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
        }
      }
      ,
      vertexShader: ShaderImporter.texture3d_vert,
      fragmentShader: ShaderImporter.texture3d_frag
    });
    subPlaneMaterial_original.side = THREE.DoubleSide;
    subPlaneMaterial_original.transparent = true;


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


  setMeshColor(c){
    this._subPlanes[0].material.color = c;
    //this._subPlanes[0].visible = false;
  }


  updateChunkSize(s){

  }


  /**
  * fetch each texture info, build a uniform and
  */
  updateUniforms(){
    var nbSubPlanes = this._subPlaneDim.row * this._subPlaneDim.col;

    for(var i=0; i<nbSubPlanes; i++){
      // center of the sub-plane in world coordinates
      var center = this._subPlanes[i].localToWorld(new THREE.Vector3(0, 0, 0));
      var chunkSizeWC = this._levelManager.getCurrentChunkSizeWc();
      var textureData = this._levelManager.get8ClosestTextureData( [center.x, center.y, center.z] );

      var uniforms = this._shaderMaterials[i].uniforms;

      uniforms.nbChunks.value = textureData.nbValid;
      uniforms.textures.value = textureData.textures;
      uniforms.textureOrigins.value = textureData.origins;
      uniforms.chunkSize.value = chunkSizeWC;

      this._shaderMaterials[i].needsUpdate = true;

    }

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
    this._resolutionLevel = lvl;
    var scale = 1 / Math.pow( 2, this._resolutionLevel );

    this._plane.scale.x = scale;
    this._plane.scale.y = scale;
    this._plane.scale.z = scale;
  }



}

// take some inspiration here:
// https://threejs.org/examples/webgl_multiple_views.html

/**
* A QuadScene is a THREE js context where the viewport is split in 4 windows, for each window comes a QuadView.
* Originally, the purpose of the QuadScene is to display 3 orthogonal views usin othometric cameras, and one additional view using a perspective camera. The later is supposed to be more free of movement, giving an flexible global point of view. The 3 ortho cam are more likely to be in object coordinate so that rotating the main object wont affect what is shown on this views.
*
* @param {String} DomContainer - ID of div to show the QuadScene
*
*/
class QuadScene{

  constructor(DomContainer){

    // the four QuadView instances, to be built (initViews)
    this._quadViews = [];

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
    this._renderer = new THREE.WebGLRenderer( /*{ antialias: true }*/ );
    this._renderer.setPixelRatio( window.devicePixelRatio );
    this._renderer.setSize( window.innerWidth, window.innerHeight );
    this._domContainer.appendChild( this._renderer.domElement );

    // the main container to put objects in
    this._mainObjectContainer = new THREE.Object3D();
    this._scene.add(this._mainObjectContainer );

    this._resolutionLevel = 0;

    // TODO: to be
    this._cameraDistance = 10;

    // mouse position in [0, 1], origin being at the bottom left of the viewport
    this._mouse = {x:0, y:0};
    document.addEventListener( 'mousemove', this._onMouseMove.bind(this), false );

    // to feed the renderer. will be init
    this._windowSize = {
      width: 0 ,
      height: 0
    };

    this._stats = null;

    this._initViews();

    // some help!
    this._scene.add( new THREE.AxisHelper( 1 ) );

    // all the planes to intersect the chunks. They will all lie into _mainObjectContainer
    this._projectionPlanes = [];

    this._levelManager = new SHAD.LevelManager();
    this._initLevelManager();
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

    var topRightView = new QuadView(this._scene, this._renderer, this._cameraDistance);
    topRightView.initTopRight();
    topRightView.initOrthoCamera();
    topRightView.useRelativeCoordinatesOf(this._mainObjectContainer);

    var bottomLeft = new QuadView(this._scene, this._renderer, this._cameraDistance);
    bottomLeft.initBottomLeft();
    bottomLeft.initOrthoCamera();
    bottomLeft.useRelativeCoordinatesOf(this._mainObjectContainer);

    var bottomRight = new QuadView(this._scene, this._renderer, this._cameraDistance);
    bottomRight.initBottomRight();
    bottomRight.initPerspectiveCamera();
    bottomRight.addOrbitControl();

    // adding the views
    this._quadViews.push(topLeftView);
    this._quadViews.push(topRightView);
    this._quadViews.push(bottomLeft);
    this._quadViews.push(bottomRight);
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
      this._renderer.setSize ( this._windowSize.width, this._windowSize.height );
    }
  }


  /**
  * [PRIVATE / EVENT]
  * called whenever the pointer is moving. Updates internal coords.
  */
  _onMouseMove( event ) {
    this._mouse.x = (event.clientX / this._windowSize.width);
    this._mouse.y = 1 - (event.clientY / this._windowSize.height);
  }


  /**
  * [PRIVATE]
  * To feed the animation feature built in WebGL.
  */
  animate(){
    this._render();

    if(this._stats){
      this._stats.update();
    }

    // call a built-in webGL method for annimation
    requestAnimationFrame( this.animate.bind(this) );
  }


  /**
  *
  */
  _render(){
    let that = this;

    // when the gui is used
    this._updateMainObjectContainerFromUI();

    // in case the window was resized
    this._updateSize();

    // the last view has an Orbit Control, thus it need the mouse coords
    this._quadViews[3].updateMousePosition(this._mouse.x, this._mouse.y);

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
      resolutionLevel: 0,

      refresh: function(){
        console.log("DEBUG BUTTON");
        that._updateAllPlanesShaderUniforms();

      }

    };

    var controllerPosX = this._datGui.add(this._guiVar, 'posx', -1, 1).name("position x").step(0.001);
    var controllerPosY = this._datGui.add(this._guiVar, 'posy', -1, 1).name("position y").step(0.001);
    var controllerPosZ = this._datGui.add(this._guiVar, 'posz', -1, 1).name("position z").step(0.001);
    var controllerRotX = this._datGui.add(this._guiVar, 'rotx', -Math.PI/2, Math.PI/2).name("rotation x").step(0.01);
    var controllerRotY = this._datGui.add(this._guiVar, 'roty', -Math.PI/2, Math.PI/2).name("rotation y").step(0.01);
    var controllerRotZ = this._datGui.add(this._guiVar, 'rotz', -Math.PI/2, Math.PI/2).name("rotation z").step(0.01);
    var controllerFrustrum = this._datGui.add(this._guiVar, 'frustrum', 0, 2).name("frustrum").step(0.01);
    var levelController = this._datGui.add(this._guiVar, 'resolutionLevel', 0, 6).name("resolutionLevel").step(1);

    this._datGui.add(this._guiVar, 'refresh');

    levelController.onFinishChange(function(lvl) {
      that._updateResolutionLevel(lvl);
      that._updateOthoCamFrustrum();
    });


    controllerPosX.onChange(function(value) {
      that._updateAllPlanesShaderUniforms();
      that._updatePerspectiveCameraLookAt();
    });

    controllerPosY.onChange(function(value) {
      that._updateAllPlanesShaderUniforms();
      that._updatePerspectiveCameraLookAt();
    });

    controllerPosZ.onChange(function(value) {
      that._updateAllPlanesShaderUniforms();
      that._updatePerspectiveCameraLookAt();
    });

    controllerRotX.onChange(function(value) {
      that._updateAllPlanesShaderUniforms();
    });

    controllerRotY.onChange(function(value) {
      that._updateAllPlanesShaderUniforms();
    });

    controllerRotZ.onChange(function(value) {
      that._updateAllPlanesShaderUniforms();
    });

    controllerFrustrum.onChange(function(value){
      that._quadViews[0].updateOrthoCamFrustrum(value);
      that._quadViews[1].updateOrthoCamFrustrum(value);
      that._quadViews[2].updateOrthoCamFrustrum(value);
    });

  }


  /**
  * [PRIVATE]
  * Update the position and rotation of _mainObjectContainer from what is tuned in the dat.gui widget.
  * Called at each _render()
  */
  _updateMainObjectContainerFromUI(){
    // position
    this._mainObjectContainer.position.x = this._guiVar.posx;
    this._mainObjectContainer.position.y = this._guiVar.posy;
    this._mainObjectContainer.position.z = this._guiVar.posz;

    // rotation
    this._mainObjectContainer.rotation.x = this._guiVar.rotx;
    this._mainObjectContainer.rotation.y = this._guiVar.roty;
    this._mainObjectContainer.rotation.z = this._guiVar.rotz;

  }

  /**
  * Adds a cube to the _mainObjectContainer to see it
  */
  addTestCube(){
    // adding the wire cube
    var chunkSize = 1;
    var cubeGeometry = new THREE.BoxGeometry( chunkSize, chunkSize, chunkSize );
    var cubeMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      vertexColors: THREE.FaceColors
      }
    );
    var cubeMesh = new THREE.Mesh( cubeGeometry, cubeMaterial );
    cubeGeometry.faces[0].color.setHex( 0x000000 );
    cubeGeometry.faces[1].color.setHex( 0x000000 );
    cubeGeometry.faces[2].color.setHex( 0x0000ff );
    cubeGeometry.faces[3].color.setHex( 0x0000ff );
    cubeGeometry.faces[4].color.setHex( 0x00ff00 );
    cubeGeometry.faces[5].color.setHex( 0x00ff00 );
    cubeGeometry.faces[6].color.setHex( 0x00ffff );
    cubeGeometry.faces[7].color.setHex( 0x00ffff );
    cubeGeometry.faces[8].color.setHex( 0xff0000 );
    cubeGeometry.faces[9].color.setHex( 0xff0000 );
    cubeGeometry.faces[10].color.setHex( 0xff00ff );
    cubeGeometry.faces[11].color.setHex( 0xff00ff );

    //var cube = new THREE.BoxHelper( cubeMesh );
    //cube.material.color.set( 0x000000 );
    this._mainObjectContainer.add(cubeMesh);
  }



  addProjectionPlane(){
    var pn = new ProjectionPlane(1);
    pn.setMeshColor(new THREE.Color(0x000099) );
    this._projectionPlanes.push( pn );
    this._mainObjectContainer.add( pn.getPlane() );

    var pu = new ProjectionPlane(1);
    pu.setMeshColor(new THREE.Color(0x009900) );
    this._projectionPlanes.push( pu );
    pu.getPlane().rotateX( Math.PI / 2);
    this._mainObjectContainer.add( pu.getPlane() );

    var pv = new ProjectionPlane(1);
    pv.setMeshColor(new THREE.Color(0x990000) );
    this._projectionPlanes.push( pv );
    pv.getPlane().rotateY( Math.PI / 2);
    this._mainObjectContainer.add( pv.getPlane() );
  }


  /**
  * [PRIVATE]
  *
  */
  _initLevelManager(){
    var that = this;

    this._levelManager.loadConfig("../data/info.json");

    this._levelManager.onReady(function(){

      that._projectionPlanes.forEach(function(plane){
        plane.setLevelManager(that._levelManager);
      });

      that._levelManager.setResolutionLevel( that._resolutionLevel ); // most likely 0 at the init

      that._updateAllPlanesShaderUniforms();
    });
  }


  /**
  *
  */
  _updateResolutionLevel(lvl){
    console.log("--------- LVL " + lvl + " ---------------");
    this._resolutionLevel = lvl;
    this._levelManager.setResolutionLevel( this._resolutionLevel );
    this._updateAllPlanesScaleFromRezLvl();
    this._updateAllPlanesShaderUniforms();
  }


  /**
  * When the resolution level is changing, the scale of each plane has to change accordingly before the texture chunks are fetched ( = before _updateAllPlanesShaderUniforms is called).
  */
  _updateAllPlanesScaleFromRezLvl(){
    var that = this;

    this._projectionPlanes.forEach( function(plane){
      plane.updateScaleFromRezLvl( that._resolutionLevel );
    });
  }


  /**
  * Updates the uniforms to send to the shader of the plane. Will trigger chunk loading for those which are not already in memory.
  */
  _updateAllPlanesShaderUniforms(){
    this._projectionPlanes.forEach( function(plane){
      plane.updateUniforms();
    });
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

}

// if we wanted to use foo here:
//import foo from './foo.js';


// but we just want to make it accessible:
//export { Foo } from './Foo.js';



//export { ShaderImporter } from './ShaderImporter.js';

exports.TextureChunk = TextureChunk;
exports.ChunkCollection = ChunkCollection;
exports.LevelManager = LevelManager;
exports.QuadScene = QuadScene;

Object.defineProperty(exports, '__esModule', { value: true });

})));
