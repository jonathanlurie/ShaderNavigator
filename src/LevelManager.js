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

    console.log(this._chunkCollections);
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


} /* END CLASS LevelManager */


export { LevelManager };
