'use strict';

import { MniObjReader } from './MniObjReader.js';

class MeshCollection{

  /**
  * Constructor of the MeshCollection instance.
  *
  */
  constructor( config ){
    this._scene = null;

    this._meshes = {};
  }


  /**
  * @param {THREE.Scene} scene - THREE js Scene to place the meshes
  */
  setScene( scene ){
    this._scene = scene;
  }






} /* END class MeshCollection */


export { MeshCollection };
