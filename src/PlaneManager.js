'use strict'

import { ProjectionPlane } from './ProjectionPlane.js';

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
    this._addOrthoPlanes(this._projectionPlanesHiRez)
    this._addOrthoPlanes(this._projectionPlanesLoRez)

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
    })
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
    })
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


export { PlaneManager }
