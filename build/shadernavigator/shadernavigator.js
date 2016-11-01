(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (factory((global.SHAD = global.SHAD || {})));
}(this, (function (exports) { 'use strict';

/** Class representing a foo. */
class Foo {

  /**
   * Create a foo.
   * @param {number} anAttribute - a value.
   * @param {number} aSecondAttribute - another value.
   */
  constructor(anAttribute, aSecondAttribute = 10 ) {
    this.anAttribute = anAttribute;
    this.aSecondAttribute = aSecondAttribute;
    console.log("a foo is constructed");
  }

  /**
   * Set anAttribute.
   * @param {number} a - the value to give to anAttribute.
   */
  setAnAttribute(a){
    this.anAttribute = a;
    console.log("calling setAnAttribute()");
  }

  /**
   * Display anAttribute.
   */
  printAnAttribute(){
    console.log(this.anAttribute);
  }

  /**
  * @return {number} The anAttribute value.
  */
  getAnAttribute(){
    return this.anAttribute;
  }

}

/**
* Represent a cubic chunk of texture. Should be part of a {@link Foo}.
*/
class TextureChunk{

  /**
  * Initialize a TextureChunk object, but still, buildFromIndex3D() or buildFromWorldPosition() needs to be called to properly position the chunk in world coord.
  *
  * @param {number} resolutionLevel - The level of resolution, the lower the level, the lower the resolution. Level n has a metric resolution per voxel twice lower/poorer than level n+1, as a result, level n has 8 time less chunks than level n+1, remember we are in 3D!.
  *
  */
  constructor(resolutionLevel){
    /** Word size of a chunk at level 0. Used as a constant. */
    this._chunkSizeLvlZero = 1;

    /** Number of voxel per side of the chunk (suposedly cube shaped). Used as a constant.*/
    this._sizeVoxel = 64;

    /**
    * The level of resolution, the lower the level, the lower the resolution. Level n has a metric resolution per voxel twice lower/poorer than level n+1, as a result, level n has 8 time less chunks than level n+1 (remember we are in 3D!).
    */
    this._resolutionLevel = resolutionLevel;

    /** Size of a chunk in 3D space, related to world coordinates */
    this._sizeWC = this._chunkSizeLvlZero / Math.pow(2, this._resolutionLevel);

    /** True only if totally build, with index and world coordinates origin */
    this._isBuilt = false;
  }


  /**
  * Has to be called explicitely just after the constructor (unless you call buildFromWorldPosition() instead). Finishes to build the chunk.
  * @param {THREE.Vector3} index3D - The index position in the octree. Each members are interger. This is a {@link https://threejs.org/docs/index.html?q=vect#Reference/Math/Vector3 THREE.Vector3}
  */
  buildFromIndex3D(index3D){
    /**
    * The index position in the octree. Each members are interger.
    */
    this._index3D = new THREE.Vector3().copy(index3D);
    this._findChunkOrigin();
    this._buildFileName();

    this._isBuilt = true;
  }


  /**
  * Has to be called explicitely just after the constructor (unless you call buildFromIndex3D() instead). Finishes to build the chunk. The position given in argument is somewhere in this chunk, most likely not at the origin.
  *  @param {THREE.Vector3} position - A position in world cooridnates. This is a {@link https://threejs.org/docs/index.html?q=vect#Reference/Math/Vector3 THREE.Vector3}
  */
  buildFromWorldPosition(position){

    // with the resolution level and the position, we can find the index3D
    // and the origin of the chunk in world cooridnates.
    this._index3D = new THREE.Vector3(
      Math.floor(position.x / this._sizeWC),
      Math.floor(position.y / this._sizeWC),
      Math.floor(position.z / this._sizeWC)
    );

    this._findChunkOrigin();
    this._buildFileName();

    this._isBuilt = true;
  }


  _findChunkOrigin(){
    /**
    * Origin of the chunk in world cooridnates. Is a THREE.Vector3.
    * Is computed from the sizeWC and the index3D
    */
    this._originWC = new THREE.Vector3(
      this._index3D.x * this._sizeWC * (-1),
      this._index3D.y * this._sizeWC * (-1),
      this._index3D.z * this._sizeWC * (-1)
    );
  }


  _buildFileName(){
    /*
    let sagitalRange = Math.floor(this._index3D.x / this._sizeVoxel) * this._sizeVoxel;
    let coronalRange = Math.floor(this._index3D.y / this._sizeVoxel) * this._sizeVoxel;
    let axialRange = Math.floor(this._index3D.z / this._sizeVoxel) * this._sizeVoxel;
    */

    let sagitalRangeStart = this._index3D.x * this._sizeVoxel;
    let coronalRangeStart = this._index3D.y * this._sizeVoxel;
    let axialRangeStart   = this._index3D.z * this._sizeVoxel;

    /** Texture file, build from its index3D and resolutionLevel */
    this._file =  this._resolutionLevel + "/" +
                  sagitalRangeStart + "-" + (sagitalRangeStart + this._sizeVoxel) + "/" +
                  coronalRangeStart + "-" + (coronalRangeStart + this._sizeVoxel) + "/" +
                  axialRangeStart   + "-" + (axialRangeStart + this._sizeVoxel);

  }


  get file(){
    return this._file;
  }




}

// if we wanted to use foo here:
//import foo from './foo.js';


// but we just want to make it accessible:

//export { ShaderImporter } from './ShaderImporter.js';

exports.Foo = Foo;
exports.TextureChunk = TextureChunk;

Object.defineProperty(exports, '__esModule', { value: true });

})));
