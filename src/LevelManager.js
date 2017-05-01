'use strict';

import { AjaxFileLoader } from './AjaxFileLoader.js';
import { ChunkCollection } from './ChunkCollection.js';


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

    /** Size of the bounding box that wraps the entire dataset */
    this._boundingBox = null;

    /** size of a chunk, considering it's always cubic */
    this._chunkSize = [64, 64, 64]; // will be overwritten using the config file, but it will be 64 anyway.

    this._onConfigErrorCallback = null;

    this._levelsInfo = null;

    this._axisInfo = null;

    this._onChunksLoadedCallback = null;
    this._onAllChunksLoadedCallback = null;
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
  * @param {Object} config - {datatype: String, url: String} where datatype is the input data type ("octree_tiles" is the only available for the moment) and url is the URL of the JSON config file.
  */
  loadConfig(config){
    var that = this;
    var filepath = config.url;

    AjaxFileLoader.loadTextFile(
      // file URL
      filepath,

      // success callback
      function(data){
        // the directory of the config file is the working directory
        that._workingDir = filepath.substring(0, Math.max(filepath.lastIndexOf("/"), filepath.lastIndexOf("\\")));

        // Rading the config object
        that._loadConfigDescription(config.datatype , JSON.parse(data));
      },

      // error callback
      function(error){
        console.error("Could not load config file " + filepath);

        // if loading the config file failed, we have a callback for that.
        if(that._onConfigErrorCallback){
          that._onConfigErrorCallback(filepath, 0);
        }
      }
    )

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
    this._levelsInfo = description.scales;

    // the description may contain more than one level (= multirez),
    // if so, we sort by resolution so that 0 is the poorest and n is the finest
    if(this._levelsInfo.length > 0){
      this._levelsInfo.sort(function(a,b) {
        if (a.resolution[0] > b.resolution[0]){
          return -1;
        }else {
            return 1;
        }
      });
    }

    this._determineChunkSize(); // most likely 64 for every config anyway

    // Compute the cube _boundingBox, that will give some sense of boundaries to the dataset
    this._computeBoundingBox();

    // the lowest def size (most likely 128) is used in combination with a chunk size (64)
    // to define the proportion of thing in a unit space
    var lowestDefSize = this._levelsInfo[0].size[0];

    // add a chunk collection for each level
    this._levelsInfo.forEach(function(elem, index){
      that._addChunkCollectionLevel(index, elem.size, datatype, lowestDefSize);
    });

    that._axisInfo = description.axisInfo;

    if(this.onReadyCallback){
      this.onReadyCallback();
    }

  }


  /**
  * Get the nth chunk collection
  * @param {Number} n - The index of the requested chunk collection
  * @return {ChunkCollection} the collection, or null if asked a bad index
  */
  getChunkCollection( n ){
    if( n>=0 && n<this._chunkCollections.length){
      return this._chunkCollections[n];
    }else{
      console.warn("ChunkCollection at index " + n + " does not exist.");
      return null;
    }
  }


  /**
  * [PRIVATE]
  * Adds a ChunkCollection instance to this._chunkCollections, corresponding to
  * the resolution level in argument.
  * @param {Number} resolutionLevel - positive integer (or zero)
  * @param {Array} voxelSize - Entire number of voxel to form the whole 3D dataset at this level of resolution. This will be translated into the size of the 3D matrix of chunk (basically divided by 64 and rounded to ceil).
  * @param {String} datatype - Type of data, but for now only "octree_tiles" is ok.
  * @param {Number} lowestDefSize - the size of the lowest resolution level
  */
  _addChunkCollectionLevel(resolutionLevel, voxelSize, datatype, lowestDefSize){
    // translating voxelSize into matrix3DSize
    // aka number of chunks (64x64x64) in each dimension
    var matrix3DSize = [
      Math.ceil( voxelSize[0] / this._chunkSize[0] ),
      Math.ceil( voxelSize[1] / this._chunkSize[1] ),
      Math.ceil( voxelSize[2] / this._chunkSize[2] )
    ];

    // creating a new chunk collection for this specific level
    var chunkCollection = new ChunkCollection(
      resolutionLevel,
      lowestDefSize,
      matrix3DSize,
      this._workingDir,
      datatype
    );

    // dealing with some nested callback (new chunk is loaded)
    if( this._onChunksLoadedCallback ){
      chunkCollection.onChunkLoaded(this._onChunksLoadedCallback);
    }

    // dealing with some nested callback (all chunks are loaded)
    if( this._onAllChunksLoadedCallback ){
      chunkCollection.onAllChunksLoaded(this._onAllChunksLoadedCallback);
    }

    this._chunkCollections.push( chunkCollection );
  }


  onChunkLoaded( cb ){
    this._onChunksLoadedCallback = cb;
  }


  onAllChunksLoaded( cb ){
    this._onAllChunksLoadedCallback = cb;
  }

  /**
  * Change the level of resolution. Boundaries and "integrity" are checked.
  * @param {Number}
  */
  setResolutionLevel(lvl){
    // TODO: here, we may want to trigger some garbage collecting work over the
    // chunks that belongs to the previous lvl.

    // make sure we dont have a float here!
    var intergerLvl = Math.round(lvl) ;

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


  getInvolvedTextureDataByLvl(cornerPositions, lvl){
    var involvedTextureData = this._chunkCollections[ lvl ].getInvolvedTextureData(cornerPositions);
    return involvedTextureData;
  }


  /**
  * Reads the chunk size from the config data. No matter the level, the chunk size should be the same, this is why we just take the first one.
  * @param {Object} levels - config data
  */
  _determineChunkSize(){
    this._chunkSize = this._levelsInfo[0].chunk_sizes[0];
  }


  /**
  * The bounding box may be used for different things, like checking inside/outside or simply to show a bounding box with a box.
  * The size data is available at every resolution level, we'll just take the info from the first level (0) since the size remains consistant all along.
  * @param {Object} levels - config data
  */
  _computeBoundingBox(){
    /*
    this._boundingBox = [
      this._levelsInfo[0].size[0] / 64.0,
      this._levelsInfo[0].size[1] / 64.0,
      this._levelsInfo[0].size[2] / 64.0
    ];
    */

    this._boundingBox = [
      1,
      1,
      1
    ];
  }


  /**
  * @returns {Array} a copy of the bounding box size as [xSize, ySize, zSize]
  */
  getBoundingBox(){
    return this._boundingBox.slice();
  }

  /**
  * @return {boolean} true if xyz is within the bounding box. Return false if outside.
  * @param {Number} x - coordinate along x
  * @param {Number} y - coordinate along y
  * @param {Number} z - coordinate along z
  */
  isInside(x, y, z){
    return (x>0 && x<this._boundingBox[0] && y>0 && y<this._boundingBox[1] && z>0 && z<this._boundingBox[2]);
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


  /**
  * Useful to get an info from the tileset config file.
  * @param {Number} levelIndex - the index in the array
  * @param {String} infoKey - One of the following "chunk_sizes", "encoding", "key", "resolution", "size" or "voxel_offset"
  * @return depending on infoKey, the return value can be a String or an Array.
  */
  getLevelInfo(levelIndex, infoKey){
    if( levelIndex>=0 &&
        levelIndex<this._levelsInfo.length &&
        infoKey in this._levelsInfo[levelIndex]){

      return this._levelsInfo[ levelIndex ][ infoKey ];
    }
  }


  /**
  * Get a tag from axisInfo in the configuration file.
  * @param {String} axis - native webGL axis name: "x", "y" or "z"
  * @param {String} tag - info tag. "name", "originalSize", etc.
  * @return {Object} String or Number value of the given axis and tag
  */
  getAxisInfo(axis, tag){
    if(axis in this._axisInfo && tag in this._axisInfo[axis]){
      return this._axisInfo[axis][tag];
    }
  }


  /**
  * Get the whole object for axis info
  * @return {Object}
  */
  getAllAxisInfo(){
    return this._axisInfo;
  }

} /* END CLASS LevelManager */


export { LevelManager };
