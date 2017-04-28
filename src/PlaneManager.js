'use strict'

import { MemoryStorage } from './MemoryStorage.js';
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

    // object that contains all the planes
    this._multiplaneContainer = new THREE.Object3D();
    this._multiplaneContainer.name = "multiplane container";
    parent.add( this._multiplaneContainer )

    this._projectionPlanesHiRez = [];
    this._projectionPlanesLoRez = [];

    // So far, the Hi rez and Lo rez set of planes are exactelly the same
    this._addOrthoPlanes(this._projectionPlanesHiRez)
    this._addOrthoPlanes(this._projectionPlanesLoRez)

    this._onMultiplaneMoveCallback = null;
    this._onMultiplaneRotateCallback = null;

    // the low-rez planes (bottom right) uses the regular zoom level minus this one (-2)
    this._resolutionLevelLoRezDelta = 2;

    this._isLowRezPlaneVisible = true;
  }


  /**
  * Define a callback for when the multiplane container is moved.
  * @param {function} cb - callback
  */
  onMultiplaneMove(cb){
    this._onMultiplaneMoveCallback = cb;
  }


  /**
  * Define a callback for when the multiplane container is rotated.
  * @param {function} cb - callback
  */
  onMultiplaneRotate(cb){
    this._onMultiplaneRotateCallback = cb;
  }


  /**
  * @return {THREE.Object3D} the multiplane container
  */
  getMultiplaneContainer(){
    return this._multiplaneContainer;
  }


  setMultiplanePosition(x, y, z){
    this._multiplaneContainer.position.x = x;
    this._multiplaneContainer.position.y = y;
    this._multiplaneContainer.position.z = z;

    this.updateUniforms();

    this._onMultiplaneMoveCallback && this._onMultiplaneMoveCallback( this._multiplaneContainer.position );
  }


  getMultiplanePosition(){
    return this._multiplaneContainer.position;
  }


  setMultiplaneRotation(x, y, z){
    this._multiplaneContainer.rotation.x = x;
    this._multiplaneContainer.rotation.y = y;
    this._multiplaneContainer.rotation.z = z;

    this.updateUniforms();

    this._onMultiplaneRotateCallback && this._onMultiplaneRotateCallback();
  }


  getMultiplaneRotation(){
    return this._multiplaneContainer.rotation;
  }


  /**
  * Build 3 orthogonal planes, add them to the array in argument arrayToAdd and add them to the parent.
  * @param {Array} arrayToAdd - array to push the 3 ProjectionPlane instances that are about to be created.
  */
  _addOrthoPlanes( arrayToAdd ){
    var sizeChunkLvl0kWC = MemoryStorage.getRecord("sizeChunkLvl0kWC");
    
    var pn = new ProjectionPlane(sizeChunkLvl0kWC, this._colormapManager);
    pn.setMeshColor(new THREE.Color(0x000099) );
    arrayToAdd.push( pn );
    this._multiplaneContainer.add( pn.getPlane() );

    var pu = new ProjectionPlane(sizeChunkLvl0kWC, this._colormapManager);
    arrayToAdd.push( pu );
    pu.getPlane().rotateX( Math.PI / 2);
    this._multiplaneContainer.add( pu.getPlane() );

    var pv = new ProjectionPlane(sizeChunkLvl0kWC, this._colormapManager);
    pv.setMeshColor(new THREE.Color(0x990000) );
    arrayToAdd.push( pv );
    pv.getPlane().rotateY( Math.PI / 2);
    pv.getPlane().rotateZ( Math.PI / 2);
    this._multiplaneContainer.add( pv.getPlane() );
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

    if(this._isLowRezPlaneVisible){
      this._updateScaleFromRezLvlPlaneArray(lvl - this._resolutionLevelLoRezDelta, this._projectionPlanesLoRez);
    }
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

    if(this._isLowRezPlaneVisible){
      this._updateUniformsPlaneArray(this._projectionPlanesLoRez);
    }
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





  /**
  * [PRIVATE]
  * Rotate the main object container on one of its native axis. This axis is relative to inside the object.
  * @param {Number} planeIndex - Index of the plane (0:Z, 1:Y, 2:X)
  * @param {Number} rad - angle in radian
  */
  _rotateMultiplane(planeIndex, rad){
    var normalPlane = this.getWorldVectorN(planeIndex);
    this._multiplaneContainer.rotateOnAxis ( normalPlane, rad );

    //this.updateUniforms();

    this._onMultiplaneRotateCallback && this._onMultiplaneRotateCallback();
  }


  /**
  * Rotate the main object container on its native Z axis. This Z axis is relative to inside the object.
  * @param {Number} rad - angle in radian
  */
  rotateMultiplaneZ( rad ){
    this._rotateMultiplane(0, rad);
  }


  /**
  * Rotate the main object container on its native X axis. This X axis is relative to inside the object.
  * @param {Number} rad - angle in radian
  */
  rotateMultiplaneX( rad ){
    this._rotateMultiplane(2, rad);
  }


  /**
  * Rotate the main object container on its native Y axis. This Y axis is relative to inside the object.
  * @param {Number} rad - angle in radian
  */
  rotateMultiplaneY( rad ){
    this._rotateMultiplane(1, rad);
  }



  /**
  * Translate the main object container along the u and v vector relative to the x plane instead of the regular coordinate system X.
  * @param {Number} uDistance - distance to move along the uVector of the plane X
  * @param {Number} vDistance - distance to move along the vVector of the plane X
  */
  translateMultiplaneX(uDistance, vDistance){
    this._translateMultiplane(2, uDistance, vDistance);
  }


  /**
  * Translate the main object container along the u and v vector relative to the y plane instead of the regular coordinate system Y.
  * @param {Number} uDistance - distance to move along the uVector of the plane Y
  * @param {Number} vDistance - distance to move along the vVector of the plane Y
  */
  translateMultiplaneY(uDistance, vDistance){
    this._translateMultiplane(1, uDistance, vDistance);
  }


  /**
  * Translate the main object container along the u and v vector relative to the z plane instead of the regular coordinate system Z.
  * @param {Number} uDistance - distance to move along the uVector of the plane Z
  * @param {Number} vDistance - distance to move along the vVector of the plane Z
  */
  translateMultiplaneZ(uDistance, vDistance){
    this._translateMultiplane(0, uDistance, vDistance);
  }


  /**
  * [PRIVATE]
  * Moves the main object container using a the u and v local unit vector of a specific plane.
  * The u and v vector are orthogonal to the plane's normal (even in an oblique context).
  * @param {Number} planeIndex - index of the plane, most likely in [0, 2]
  * @param {Number} uDistance - distance to move the main object along u vector. signed float.
  * @param {Number} vDistance - distance to move the main object along v vector. signed float.
  */
  _translateMultiplane(planeIndex, uDistance, vDistance){
    var uVector = this.getWorldVectorU(planeIndex);
    var vVector = this.getWorldVectorV(planeIndex);

    this._multiplaneContainer.translateOnAxis( uVector, uDistance );
    this._multiplaneContainer.translateOnAxis( vVector, vDistance );

    //this.updateUniforms();

    this._onMultiplaneMoveCallback && this._onMultiplaneMoveCallback( this._multiplaneContainer.position );

  }


  hideLowRezPlane(){
    this._projectionPlanesLoRez.forEach( function(projPlane){
      projPlane.hide();
    });
  }


  showLowRezPlane(){
    this._isLowRezPlaneVisible = true;

    this._projectionPlanesLoRez.forEach( function(projPlane){
      projPlane.show();
    });

    this._updateScaleFromRezLvlPlaneArray(
      this._projectionPlanesHiRez[0].getResolutionLevel() - this._resolutionLevelLoRezDelta,
      this._projectionPlanesLoRez
    );

    this._updateUniformsPlaneArray(this._projectionPlanesLoRez);

  }


} /* END CLASS PlaneManager */


export { PlaneManager }
