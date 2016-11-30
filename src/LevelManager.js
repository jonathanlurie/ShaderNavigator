'use strict';

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

    this._determineChunkSize(levels);

    // Compute the cube hull, that will give some sense of boundaries to the dataset
    this._computeCubeHull(levels);

    // add a chunk collection for each level
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
      Math.ceil( voxelSize[0] / this._chunkSize ),
      Math.ceil( voxelSize[1] / this._chunkSize ),
      Math.ceil( voxelSize[2] / this._chunkSize )
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


export { LevelManager };
