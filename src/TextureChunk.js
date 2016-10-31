
/**
* Represent a cubic chunk of texture. Should be part of a {@link Foo}.
*/
class TextureChunk{

  /**
  * Build a TextureChunk object.
  * @param {THREE.Vector3} index3D - The index position in the octree. Each members are interger. This is a {@link https://threejs.org/docs/index.html?q=vect#Reference/Math/Vector3 THREE.Vector3}
  * @param {number} resolutionLevel - The level of resolution, the lower the level, the lower the resolution. Level n has a metric resolution per voxel twice lower/poorer than level n+1, as a result, level n has 8 time less chunks than level n+1, remember we are in 3D!.
  * @param {number} sizeWC - Size of the chunk in world coordinates.
  * @param {number} sizeVoxel - Number of voxel per side of the chunk.
  */

  constructor(index3D, resolutionLevel, sizeWC=1, sizeVoxel=64 ){
    console.log("hello 1");
    /**
    * The index position in the octree. Each members are interger.
    */
    this._index3D = new THREE.Vector3().copy(index3D);

    /**
    * The level of resolution, the lower the level, the lower the resolution. Level n has a metric resolution per voxel twice lower/poorer than level n+1, as a result, level n has 8 time less chunks than level n+1 (remember we are in 3D!).
    */
    this.resolutionLevel = resolutionLevel;

    /** Size of a chunk in 3D space, related to world coordinates */
    this._sizeWC = sizeWC;

    /**
    * Origin of the chunk in world cooridnates. Is a THREE.Vector3.
    * Is computed from the sizeWC and the index3D
    */
    this._originWC = new THREE.Vector3(
      this._index3D.x * this._sizeWC * (-1),
      this._index3D.y * this._sizeWC * (-1),
      this._index3D.z * this._sizeWC * (-1)
    );

    /** Number of voxel per side of the chunk (suposedly cube shaped)*/
    this._sizeVoxel = sizeVoxel;

    /** Texture file, build from its index3D and resolutionLevel */
    let sagitalRange = Math.floor(this._index3D.x / this._sizeVoxel) * this._sizeVoxel;
    let coronalRange = Math.floor(this._index3D.y / this._sizeVoxel) * this._sizeVoxel;
    let axialRange = Math.floor(this._index3D.z / this._sizeVoxel) * this._sizeVoxel;

    this._file =  "level_" + this.resolutionLevel + "/" +
                  sagitalRange + "-" + (sagitalRange+this._sizeVoxel) + "/" +
                  coronalRange + "-" + (coronalRange+this._sizeVoxel) + "/" +
                  axialRange + "-" + (axialRange+this._sizeVoxel);

    console.log("hello");

  }

  get file(){
    return this._file;
  }




}

export { TextureChunk };
