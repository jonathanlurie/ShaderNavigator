// take some inspiration here:
// https://threejs.org/examples/webgl_multiple_views.html

'use strict';

import { QuadView } from './QuadView.js';
import { ProjectionPlane } from './ProjectionPlane.js';
import { OrientationHelper } from './OrientationHelper.js';
import { QuadViewInteraction } from './QuadViewInteraction.js';





/**
* A QuadScene is a THREE js context where the viewport is split in 4 windows, for each window comes a QuadView.
* Originally, the purpose of the QuadScene is to display 3 orthogonal views usin othometric cameras, and one additional view using a perspective camera. The later is supposed to be more free of movement, giving an flexible global point of view. The 3 ortho cam are more likely to be in object coordinate so that rotating the main object wont affect what is shown on this views.
*
* @param {String} DomContainer - ID of div to show the QuadScene
*
*/
class QuadScene{

  constructor(DomContainer, rez=2){
    this._ready = false;
    this._counterRefresh = 0;
    this._resolutionLevel = rez;

    // the four QuadView instances, to be built (initViews)
    this._quadViews = [];
    this._quadViewInteraction = null;

    // all the planes to intersect the chunks. They will all lie into _mainObjectContainer
    this._projectionPlanes = [];

    // visible bounding box for the dataset
    this._cubeHull3D = null;

    // size of the dataset in world coords. TO BE INIT
    this._cubeHullSize = [0, 0, 0];

    // a static gimbal to show dataset orientation
    this._orientationHelper = null;

    this._onReadyCallback = null;

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

    // some help!
    this._scene.add( new THREE.AxisHelper( 1 ) );

    this._levelManager = new SHAD.LevelManager();
    this._addProjectionPlane();
    this._initLevelManager();
    this.animate();
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
    //bottomRight.addOrbitControl();
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
  animate(){
    this._render();

    if(this._stats){
      this._stats.update();
    }

    // call a built-in webGL method for annimation
    requestAnimationFrame( this.animate.bind(this) );

    // updating the control is necessary in the case of a TrackballControls
    this._quadViews[3].updateControl();
  }


  /**
  *
  */
  _render(){
    let that = this;

    // when the gui is used
    this._updateMainObjectContainerFromUI();

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

      toggleOrientationHelper: function(){
        that._orientationHelper.toggle();
      },

      refresh: function(){
        that._updateAllPlanesShaderUniforms();
      },

      debug: function(){
        //console.log( that._projectionPlanes[0].getWorldDiagonal() );
        that.translateNativePlaneX(0.01, 0);
      },

      debug2: function(){
        //console.log( that._projectionPlanes[0].getWorldDiagonal() );
        that.translateNativePlaneX(0, 0.01);
      },

      rotateX: function(){
        that.rotateNativePlaneX( this.rotx );
      },

      rotateY: function(){
        that.rotateNativePlaneY( this.roty );
      },

      rotateZ: function(){
        that.rotateNativePlaneZ( this.rotz );
      },

    }

    this._datGui.add(this._guiVar, 'toggleOrientationHelper').name("Toggle helper");

    var controllerPosX = this._datGui.add(this._guiVar, 'posx', 0, 2).name("position x").step(0.001).listen();
    var controllerPosY = this._datGui.add(this._guiVar, 'posy', 0, 2).name("position y").step(0.001).listen();
    var controllerPosZ = this._datGui.add(this._guiVar, 'posz', 0, 2).name("position z").step(0.001).listen();
    var controllerRotX = this._datGui.add(this._guiVar, 'rotx', -Math.PI/2, Math.PI/2).name("rotation x").step(0.01).listen();
    var controllerRotY = this._datGui.add(this._guiVar, 'roty', -Math.PI/2, Math.PI/2).name("rotation y").step(0.01).listen();
    var controllerRotZ = this._datGui.add(this._guiVar, 'rotz', -Math.PI/2, Math.PI/2).name("rotation z").step(0.01).listen();
    var controllerFrustrum = this._datGui.add(this._guiVar, 'frustrum', 0, 2).name("frustrum").step(0.01).listen();
    var levelController = this._datGui.add(this._guiVar, 'resolutionLevel', 0, 6).name("resolutionLevel").step(1).listen();

    this._datGui.add(this._guiVar, 'debug');
    this._datGui.add(this._guiVar, 'debug2');

    this._datGui.add(this._guiVar, 'refresh');
    this._datGui.add(this._guiVar, 'rotateX');
    this._datGui.add(this._guiVar, 'rotateY');
    this._datGui.add(this._guiVar, 'rotateZ');


    controllerPosX.onFinishChange(function(xpos) {
      that.setMainObjectPositionX(xpos);
    });
    controllerPosX.onChange(function(xpos) {
      that.setMainObjectPositionX(xpos);
    });

    controllerPosY.onFinishChange(function(ypos) {
      that.setMainObjectPositionY(ypos);
    });
    controllerPosY.onChange(function(ypos) {
      that.setMainObjectPositionY(ypos);
    });

    controllerPosZ.onFinishChange(function(zpos) {
      that.setMainObjectPositionZ(zpos);
      console.log("posZ changed");
    });
    controllerPosZ.onChange(function(zpos) {
      that.setMainObjectPositionZ(zpos);
      console.log("posZ on change");
    });


    levelController.onFinishChange(function(lvl) {
      that.setResolutionLevel(lvl);
      //that._updateOthoCamFrustrum();
    });
    levelController.onChange(function(lvl) {
      that.setResolutionLevel(lvl);
      //that._updateOthoCamFrustrum();
    });

    controllerRotX.onChange(function(value) {
      that._updateAllPlanesShaderUniforms();
    });
    controllerRotX.onFinishChange(function(value) {
      that._updateAllPlanesShaderUniforms();
    });

    controllerRotY.onChange(function(value) {
      that._updateAllPlanesShaderUniforms();
    });
    controllerRotY.onFinishChange(function(value) {
      that._updateAllPlanesShaderUniforms();
    });

    controllerRotZ.onChange(function(value) {
      that._updateAllPlanesShaderUniforms();
    });
    controllerRotZ.onFinishChange(function(value) {
      that._updateAllPlanesShaderUniforms();
    });

    controllerFrustrum.onChange(function(value){
      that._quadViews[0].updateOrthoCamFrustrum(value);
      that._quadViews[1].updateOrthoCamFrustrum(value);
      that._quadViews[2].updateOrthoCamFrustrum(value);
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

    //this._projectionPlanes[0].getPlane().rotation.z = z;
    //this._projectionPlanes[1].getPlane().rotation.x = x;
    //this._projectionPlanes[2].getPlane().rotation.x = x;

    // already done if called by the renderer and using DAT.gui
    this._guiVar.rotx = x;
    this._guiVar.roty = y;
    this._guiVar.rotz = z;

    this._updateAllPlanesShaderUniforms();
  }


  /**
  * [PRIVATE]
  * Update the position and rotation of _mainObjectContainer from what is tuned in the dat.gui widget.
  * Called at each _render()
  */
  _updateMainObjectContainerFromUI(){

    /*
    // position
    this.setMainObjectPosition(
      this._guiVar.posx,
      this._guiVar.posy,
      this._guiVar.posz
    );
    */

    /*
    // rotation
    this.setMainObjectRotation(
      this._guiVar.rotx,
      this._guiVar.roty,
      this._guiVar.rotz
    );
    */

  }


  /**
  *
  */
  _addProjectionPlane(){
    var pn = new ProjectionPlane(1);
    pn.setMeshColor(new THREE.Color(0x000099) );
    this._projectionPlanes.push( pn );
    //pn.getPlane().rotateZ( Math.PI / 2);
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
    pv.getPlane().rotateZ( Math.PI / 2);
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

      that._levelManager.setResolutionLevel( that._resolutionLevel );

      that._buildCubeHull();

      that.setMainObjectPosition(
        that._cubeHullSize[0] / 2,
        that._cubeHullSize[1] / 2,
        that._cubeHullSize[2] / 2
      );

      that._initOrientationHelper();
      //that._updateAllPlanesShaderUniforms();

      that.setResolutionLevel( that._resolutionLevel );

      that._initPlaneInteraction();

      that._ready = true;

      if(that._onReadyCallback){
        that._onReadyCallback(that);
      }

    })
  }


  /**
  * Update the resolution level, refresh the frustrum, the size of the helper, the scale of the planes.
  * @param {Number} lvl - resolution level in [0, 6]
  */
  setResolutionLevel(lvl){
    console.log("--------- LVL " + lvl + " ---------------");
    this._resolutionLevel = lvl;
    this._levelManager.setResolutionLevel( this._resolutionLevel );
    this._updateAllPlanesScaleFromRezLvl();
    this._updateAllPlanesShaderUniforms();
    this._syncOrientationHelperScale();

    this._guiVar.resolutionLevel = lvl;

    this._updateOthoCamFrustrum();
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
    //console.log(">> updating uniforms");
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
    this._scene.add( this._cubeHull3D );
  }


  /**
  * Initialize the orientation helper and adds it to the scene (and not to the main object, because it is not supposed to rotate)
  */
  _initOrientationHelper(){
    this._orientationHelper = new OrientationHelper(
      this._projectionPlanes[0].getWorldDiagonal() / 20
      //1.5
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
    var normalPlane = this._projectionPlanes[planeIndex].getWorldNormal();
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
    var uVector = this._projectionPlanes[planeIndex].getWorldVectorU();
    var vVector = this._projectionPlanes[planeIndex].getWorldVectorV();
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
  *
  */
  _initPlaneInteraction(){
    var that = this;

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


    this._quadViewInteraction.onGrabViewTransverseRotate( function(distance, viewIndex){
      var factor = Math.pow(2, that._resolutionLevel) / 10;

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

  }


}

export { QuadScene };
