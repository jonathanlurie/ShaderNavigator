'use strict';

import { QuadView } from './QuadView.js';
import { LevelManager } from './LevelManager.js';
import { OrientationHelper } from './OrientationHelper.js';
import { QuadViewInteraction } from './QuadViewInteraction.js';
import { ColorMapManager } from './ColorMapManager.js';
import { PlaneManager } from './PlaneManager.js';
import { MeshCollection } from './MeshCollection.js';


/**
* A QuadScene is a THREE js context where the viewport is split in 4 windows, for each window comes a QuadView.
* Originally, the purpose of the QuadScene is to display 3 orthogonal views usin othometric cameras, and one additional view using a perspective camera. The later is supposed to be more free of movement, giving an flexible global point of view. The 3 ortho cam are more likely to be in object coordinate so that rotating the main object wont affect what is shown on this views.
*
* @param {String} DomContainer - ID of div to show the QuadScene
* @param {Object} config - {datatype: String, url: String} where datatype is the input data type ("octree_tiles" is the only available for the moment) and url is the URL of the JSON config file.
*
*/
class QuadScene{

  constructor(DomContainer, rez=0){
    window.addEventListener( 'resize', this._updateSize.bind(this), false );

    this._ready = false;
    this._counterRefresh = 0;
    this._resolutionLevel = rez;

    // the four QuadView instances, to be built (initViews)
    this._quadViews = [];
    this._quadViewInteraction = null;

    // all the planes to intersect the chunks. They will all lie into _mainObjectContainer
    this._planeManager = null;

    // visible bounding box for the dataset
    this._cubeHull3D = null;

    // size of the dataset in world coords. TO BE INIT
    this._cubeHullSize = [0, 0, 0];

    // a static gimbal to show dataset orientation
    this._orientationHelper = null;

    // called whenever the lvl, orientation or position changes (if set)
    this._onChangeCallback = null;

    // Called when the config file is loaded, the planes are build and now we just wait to do things
    this._onReadyCallback = null;

    // called whennever the config file failed to load
    this._onConfigFileErrorCallback = null;

    // a single colormap manager that will be used for all the planes
    this._colormapManager = new ColorMapManager();

    // variables used to sync the dat.guy widget and some position/rotation.
    // see _initUI() for more info.
    this._guiVar = null;
    this._datGui = new dat.GUI();
    this._initUI();

    // Container on the DOM tree, most likely a div
    this._domContainer = document.getElementById( DomContainer );

    // scene, where everything goes
    this._scene = new THREE.Scene();

    var axisHelper = new THREE.AxisHelper( 1 );
    axisHelper.layers.enable(1);

    this._scene.add( axisHelper );

    this._scene.add( new THREE.AmbientLight( 0x444444 ) );

    var light1 = new THREE.DirectionalLight( 0xffffff, 0.75 );
		light1.position.set( 200, 200, 200 );
    light1.layers.enable( 0 );
    light1.layers.enable( 1 );
		this._scene.add( light1 );

    // container of annotations and meshes, this is rotated/scaled/repositioned
    // so that the items are in the proper places compared to the images
    this._adjustedContainer = new THREE.Object3D();

    // contains the annotations (that are not meshes)
    this._annotationContainer = new THREE.Object3D();

    // contains the meshes
    this._meshContainer = new THREE.Object3D();

    // what is inside what:
    this._adjustedContainer.add(this._meshContainer);
    this._adjustedContainer.add(this._annotationContainer);
    this._scene.add(this._adjustedContainer);

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

    // a future instance of MeshCollection, to deal with meshes (obviously)
    this._meshCollection = null;

    this._stats = null;
    this._initViews();
    this._levelManager = new LevelManager();
    this._initPlaneManager();
    this._animate();
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
    topLeftView.enableLayer( 0 );

    var topRightView = new QuadView(this._scene, this._renderer, this._cameraDistance);
    topRightView.initTopRight();
    topRightView.initOrthoCamera();
    topRightView.useRelativeCoordinatesOf(this._mainObjectContainer);
    topRightView.enableLayer( 0 );

    var bottomLeft = new QuadView(this._scene, this._renderer, this._cameraDistance);
    bottomLeft.initBottomLeft();
    bottomLeft.initOrthoCamera();
    bottomLeft.useRelativeCoordinatesOf(this._mainObjectContainer);
    bottomLeft.enableLayer( 0 );

    var bottomRight = new QuadView(this._scene, this._renderer, this._cameraDistance);
    bottomRight.initBottomRight();
    bottomRight.initPerspectiveCamera();
    bottomRight.enableLayer( 1 );
    bottomRight.disableLayer(0);
    bottomRight.addTrackballControl(this._render, this._domContainer);

    // adding the views
    this._quadViews.push(topLeftView);
    this._quadViews.push(topRightView);
    this._quadViews.push(bottomLeft);
    this._quadViews.push(bottomRight);

    // the quadviewinteraction instance deals with mouse things
    this._quadViewInteraction = new QuadViewInteraction( this._quadViews );
  }


  /**
  * [PRIVATE]
  * Initialize the planeManager, so that we eventually have something to display here!
  */
  _initPlaneManager(){
    this._planeManager = new PlaneManager(this._colormapManager, this._mainObjectContainer);
    this._planeManager.enableLayerHiRez(0);
    this._planeManager.disableLayerHiRez(1);
    this._planeManager.enableLayerLoRez(1);
    this._planeManager.disableLayerLoRez(0);
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
  _animate(){
    this._render();

    if(this._stats){
      this._stats.update();
    }

    // call a built-in webGL method for annimation
    requestAnimationFrame( this._animate.bind(this) );

    // updating the control is necessary in the case of a TrackballControls
    this._quadViews[3].updateControl();
  }


  /**
  * [PRIVATE]
  * Typical rendering function, necessary in THREE js
  */
  _render(){
    let that = this;

    // TODO: make somethink better for refresh once per sec!
    if(this._ready){
      if(this._counterRefresh % 30 == 0){
        this._updateAllPlanesShaderUniforms();
      }
      this._counterRefresh ++;
    }

    // in case the window was resized
    //this._updateSize();

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

    this._datGui

    this._guiVar = {
      posx: 0,
      posy: 0,
      posz: 0,
      rotx: 0,
      roty: 0,
      rotz: 0,
      frustrum: 1,
      resolutionLevel: that._resolutionLevel,
      colormapChoice: 0, // the value does not matter


      toggleOrientationHelper: function(){
        that._orientationHelper.toggle();
      },

      toggleCubeHull: function(){
        that.toggleCubeHull();
      },

      refresh: function(){
        that._updateAllPlanesShaderUniforms();
      },

      debug: function(){
        that._adjustedContainer.visible = !that._adjustedContainer.visible;
      },

      meshx: 0.98,
      meshy: 0.8,
      meshz: 1.04,
      meshscalex: 85,
      meshscaley: 85,
      meshscalez: 85,


    }


    this._datGui.add(this._guiVar, 'meshx', 0, 1.5).step(0.001)
      .onChange( function(val){
        that._meshContainer.position.x = val;
      });

    this._datGui.add(this._guiVar, 'meshy', 0, 1.5).step(0.001)
      .onChange( function(val){
        that._meshContainer.position.y = val;
      });

    this._datGui.add(this._guiVar, 'meshz', 0, 1.5).step(0.001)
      .onChange( function(val){
        that._meshContainer.position.z = val;
      });

    this._datGui.add(this._guiVar, 'meshscalex', 80, 110).step(0.001)
      .onChange( function(val){
        that._meshContainer.scale.x = 1/val;
      });

    this._datGui.add(this._guiVar, 'meshscaley', 80, 110).step(0.001)
      .onChange( function(val){
        that._meshContainer.scale.y = 1/val;
      });

    this._datGui.add(this._guiVar, 'meshscalez', 80, 110).step(0.001)
      .onChange( function(val){
        that._meshContainer.scale.z = 1/val;
      });



    this._datGui.add(this._guiVar, 'toggleOrientationHelper').name("Toggle helper");
    this._datGui.add(this._guiVar, 'toggleCubeHull').name("Toggle cube");

    //var controllerFrustrum = this._datGui.add(this._guiVar, 'frustrum', 0, 0.05).name("frustrum").step(0.001).listen();

    var levelController = this._datGui.add(this._guiVar, 'resolutionLevel', 0, 6).name("resolutionLevel").step(1).listen();

    this._datGui.add(this._guiVar, 'debug');

    levelController.onFinishChange(function(lvl) {
      that.setResolutionLevel(lvl);
      //that._updateOthoCamFrustrum();
    });

    // whenever a colormap is loaded, add it to the list in dat.gui
    this._colormapManager.onColormapUpdate( this._updateColormapList.bind(this) );
  }


  /**
  * [PRIVATE]
  * Suposed to be called as a callback of _colormapManager.onColormapUpdate.
  * Updates the dat.guy view and its corresponding controller with the new list of colormaps
  */
  _updateColormapList(){
    var that = this;

    if( typeof this._colormapController !== "undefined" ){
      this._datGui.remove(this._colormapController);
      this._colormapController = null;
    }

    this._colormapController = this._datGui.add(
      this._guiVar,
      'colormapChoice',
      this._colormapManager.getAvailableColormaps()
    ).name("color map");

    this._colormapController.onFinishChange(function(colormapId) {
      that._colormapManager.useColormap(colormapId)
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


  /**
  * Set the x position of the main object container.
  * @param {Number} x - position
  */
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


  /**
  * Set the y position of the main object container.
  * @param {Number} y - position
  */
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


  /**
  * Set the z position of the main object container.
  * @param {Number} z - position
  */
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

    // already done if called by the renderer and using DAT.gui
    this._guiVar.rotx = x;
    this._guiVar.roty = y;
    this._guiVar.rotz = z;

    this._updateAllPlanesShaderUniforms();
  }


  /**
  * Entry point to load data (texture chunk octree or mesh collection)
  */
  loadData( config ){
    if( config.datatype == "precomputed_octree_tiles"){
      this._initLevelManager(config);
    }else if(config.datatype == "mesh_collection"){
      this._initMeshCollection(config);
    }else{
      console.warn("The data to load has an unknown format.");
    }

  }


  /**
  * [PRIVATE]
  */
  _initMeshCollection( config ){
    this._meshCollection = new MeshCollection( config, this._meshContainer );
  }

  /**
  * [PRIVATE]
  * Initialize the level manager and run some local init method when the lvl manager is ready.
  */
  _initLevelManager( config ){
    var that = this;

    // the config file was succesfully loaded
    this._levelManager.loadConfig(config);

    this._levelManager.onReady(function(){

      that._planeManager.setLevelManager( that._levelManager );
      that._levelManager.setResolutionLevel( that._resolutionLevel );
      that._buildCubeHull();

      // Place the plane intersection at the center of the data
      that.setMainObjectPosition(
        that._cubeHullSize[0] / 2,
        that._cubeHullSize[1] / 2,
        that._cubeHullSize[2] / 2
      );

      that._initOrientationHelper();
      that.setResolutionLevel( that._resolutionLevel );
      that._initPlaneInteraction();
      that._ready = true;

      if(that._onReadyCallback){
        that._onReadyCallback(that);
      }

    });


    // the config file failed to load
    this._levelManager.onConfigError( function(url, code){
      if(that._onConfigFileErrorCallback){
        that._onConfigFileErrorCallback(url, code);
      }
    });

  }


  /**
  * Update the resolution level, refresh the frustrum, the size of the helper, the scale of the planes.
  * @param {Number} lvl - resolution level in [0, 6]
  */
  setResolutionLevel(lvl){
    console.log("--------- LVL " + lvl + " ---------------");
    this._resolutionLevel = lvl;
    this._levelManager.setResolutionLevel( this._resolutionLevel );
    this._planeManager.updateScaleFromRezLvl( this._resolutionLevel );

    this._syncOrientationHelperScale();
    this._guiVar.resolutionLevel = lvl;
    this._updateOthoCamFrustrum();

    if(this._onUpdateViewCallback){
      this._onUpdateViewCallback( this.getMainObjectInfo() );
    }
  }



  /**
  * Updates the uniforms to send to the shader of the plane. Will trigger chunk loading for those which are not already in memory.
  */
  _updateAllPlanesShaderUniforms(){
    this._planeManager.updateUniforms();
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
  * Make the cube hull visible or not (reverses the current state)
  */
  toggleCubeHull(){
    if(this._cubeHull3D){
      this._cubeHull3D.visible = !this._cubeHull3D.visible;
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

    cubeHullGeometry.faces[0].color.setHex(  0xFF7A7A ); // Sagittal
    cubeHullGeometry.faces[1].color.setHex(  0xFF7A7A );
    cubeHullGeometry.faces[2].color.setHex(  0xff3333 );
    cubeHullGeometry.faces[3].color.setHex(  0xff3333 );
    cubeHullGeometry.faces[4].color.setHex(  0x61FA94 ); // Coronal
    cubeHullGeometry.faces[5].color.setHex(  0x61FA94 );
    cubeHullGeometry.faces[6].color.setHex(  0xA7FAC3 );
    cubeHullGeometry.faces[7].color.setHex(  0xA7FAC3 );
    cubeHullGeometry.faces[8].color.setHex(  0x95CCFC ); // Axial
    cubeHullGeometry.faces[9].color.setHex(  0x95CCFC );
    cubeHullGeometry.faces[10].color.setHex( 0x0088ff );
    cubeHullGeometry.faces[11].color.setHex( 0x0088ff );

    // mesh
    var cubeHullPlainMesh = new THREE.Mesh( cubeHullGeometry, cubeHullMaterial );
    this._cubeHull3D = new THREE.Object3D();
    this._cubeHull3D.add( cubeHullPlainMesh );
    this._cubeHull3D.position.x = this._cubeHullSize[0] / 2;
    this._cubeHull3D.position.y = this._cubeHullSize[1] / 2;
    this._cubeHull3D.position.z = this._cubeHullSize[2] / 2;

    this._cubeHull3D.children.forEach( function(child){
      child.layers.disable( 0 );
      child.layers.enable( 1 );
    });

    this._scene.add( this._cubeHull3D );
  }


  /**
  * Initialize the orientation helper and adds it to the scene (and not to the main object, because it is not supposed to rotate)
  */
  _initOrientationHelper(){
    this._orientationHelper = new OrientationHelper(
      this._planeManager.getWorldDiagonalHiRez() / 13
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


  /**
  * Triggered when the resolution level changes to keep the orientation helper the right size.
  */
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
    var normalPlane = this._planeManager.getWorldVectorN(planeIndex);
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
    var uVector = this._planeManager.getWorldVectorU(planeIndex);
    var vVector = this._planeManager.getWorldVectorV(planeIndex);

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
  * Defines the callback for interacting with the views
  */
  _initPlaneInteraction(){
    var that = this;

    // callback def: translation
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

    // callback def: regular rotation (using R key)
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

    // callback def: transverse rotation (using T key)
    this._quadViewInteraction.onGrabViewTransverseRotate( function(distance, viewIndex){
      //var factor = Math.pow(2, that._resolutionLevel) / 10;
      var factor =  that._resolutionLevel / 2;

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

    // callback def: arrow down
    this._quadViewInteraction.onArrowDown( function(viewIndex){
      var factor = 0.01 / Math.pow(2, that._resolutionLevel);

      switch (viewIndex) {
        case 0:
          that.translateNativePlaneY(factor, 0);
          break;
        case 1:
          that.translateNativePlaneX(factor, 0);
          break;
        case 2:
          that.translateNativePlaneY(0, -factor);
          break;
        default:  // if last view, we dont do anything
          return;
      }
    });

    // callback def: arrow up
    this._quadViewInteraction.onArrowUp( function(viewIndex){
      var factor = 0.01 / Math.pow(2, that._resolutionLevel) * -1;

      switch (viewIndex) {
        case 0:
          that.translateNativePlaneY(factor, 0);
          break;
        case 1:
          that.translateNativePlaneX(factor, 0);
          break;
        case 2:
          that.translateNativePlaneY(0, -factor);
          break;
        default:  // if last view, we dont do anything
          return;
      }
    });

    this._quadViewInteraction.onDonePlaying(function(){
      if(that._onUpdateViewCallback){
        that._onUpdateViewCallback( that.getMainObjectInfo() );
      }
    });
  }


  /**
  * @return {Object} the returned object if of the form:
  * { resolutionLvl, position {x, y, z}, rotation {x, y, z} }
  */
  getMainObjectInfo(){

    return {
      resolutionLvl: this._resolutionLevel,
      position: {
        x: this._mainObjectContainer.position.x,
        y: this._mainObjectContainer.position.y,
        z: this._mainObjectContainer.position.z
      },
      rotation: {
        x: this._mainObjectContainer.rotation.x,
        y: this._mainObjectContainer.rotation.y,
        z: this._mainObjectContainer.rotation.z
      }
    };

  }

  /**
  * Defines the callback for whenever the lvl, rotation or position changes
  */
  onUpdateView( cb ){
    this._onUpdateViewCallback = cb;
  }


  /**
  * Defines a function if an error occures when loading the config file has some trouble to load (but not necessary an error). Function called with 2 args: url and status code. The status code will define if it corresponds to an error or not.
  */
  onConfigFileError(cb){
    this._onConfigFileErrorCallback = cb;
  }


}

export { QuadScene };
