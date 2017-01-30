'use strict';

import { QuadView } from './QuadView.js';
import { LevelManager } from './LevelManager.js';
import { OrientationHelper } from './OrientationHelper.js';
import { QuadViewInteraction } from './QuadViewInteraction.js';
import { ColorMapManager } from './ColorMapManager.js';
import { PlaneManager } from './PlaneManager.js';
import { MeshCollection } from './MeshCollection.js';
import { GuiController } from './GuiController.js';
import { BoundingBoxHelper } from './BoundingBoxHelper.js';



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

    // all the planes to intersect the chunks. Contains the multiplane
    this._planeManager = null;

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

    // Container on the DOM tree, most likely a div
    this._domContainer = document.getElementById( DomContainer );

    // scene, where everything goes
    this._scene = new THREE.Scene();

    this._boundingBoxHelper = new BoundingBoxHelper( this._scene );

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
    this._initPlaneManager();
    this._initViews( DomContainer );
    this._levelManager = new LevelManager();


    // init the gui controller
    this._guiController = new GuiController(this);

    this._animate();
  }




  /**
  * [PRIVATE]
  * Initialize the 4 QuadView instances. The 3 first being ortho cam and the last being a global view perspective cam.
  */
  _initViews( DomContainer ){
    var that = this;

    var topLeftView = new QuadView(this._scene, this._renderer, this._cameraDistance);
    topLeftView.initTopLeft();
    topLeftView.initOrthoCamera();
    topLeftView.useRelativeCoordinatesOf(this._planeManager.getMultiplaneContainer());
    topLeftView.enableLayer( 0 );

    var topRightView = new QuadView(this._scene, this._renderer, this._cameraDistance);
    topRightView.initTopRight();
    topRightView.initOrthoCamera();
    topRightView.useRelativeCoordinatesOf(this._planeManager.getMultiplaneContainer());
    topRightView.enableLayer( 0 );

    var bottomLeft = new QuadView(this._scene, this._renderer, this._cameraDistance);
    bottomLeft.initBottomLeft();
    bottomLeft.initOrthoCamera();
    bottomLeft.useRelativeCoordinatesOf(this._planeManager.getMultiplaneContainer());
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
    this._quadViewInteraction = new QuadViewInteraction( this._quadViews, DomContainer);
    this._quadViewInteraction.setMultiplaneContainer( this._planeManager.getMultiplaneContainer() );

    this._quadViewInteraction.onClickPlane(
      "perspective",

      function( point ){
        that.setMultiplanePosition( point.x, point.y, point.z);
      }
    )


  }


  /**
  * Shortcut function to set the multiplane position.
  * Handy because accessible from the onReady callback.
  */
  setMultiplanePosition(x, y, z){
    this._planeManager.setMultiplanePosition( x, y, z);
  }


  /**
  * Shortcut function to set the multiplane position.
  * Handy because accessible from the onReady callback.
  */
  setMultiplaneRotation(x, y, z){
    this._planeManager.setMultiplaneRotation( x, y, z);
  }

  /**
  * [PRIVATE]
  * Initialize the planeManager, so that we eventually have something to display here!
  */
  _initPlaneManager(){
    var that = this;

    this._planeManager = new PlaneManager(this._colormapManager, this._scene);
    this._planeManager.enableLayerHiRez(0);
    this._planeManager.disableLayerHiRez(1);
    this._planeManager.enableLayerLoRez(1);
    this._planeManager.disableLayerLoRez(0);

    // callback when multiplane moves
    this._planeManager.onMultiplaneMove( function( position ){

      that._updatePerspectiveCameraLookAt( position );
      that._syncOrientationHelperPosition( position );
    });

    /*
    // callback when multiplane rotates
    this._planeManager.onMultiplaneRotate( function(){
      // nothing to do here for the moment
    });
    */

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
  * @return {Number} the resolution level
  */
  getResolutionLevel(){
    return this._resolutionLevel;
  }


  /**
  * @return {ColorMapManager} the colormap manager
  */
  getColormapManager(){
    return this._colormapManager;
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
  * @return {OrientationHelper} the instance of OrientationHelper used in Quadscene.
  */
  getOrientationHelper(){
    return this._orientationHelper;
  }


  /**
  * @return {BoundingBoxHelper} the bounding box helper
  */
  getBoundingBoxHelper(){
    return this._boundingBoxHelper;
  }


  /**
  * Entry point to load data (texture chunk octree or mesh collection)
  */
  loadData( config ){
    if( config.datatype == "precomputed_octree_tiles"){
      this._initLevelManager(config);
    }else if(config.datatype == "mesh_collection"){
      this._initMeshCollection(config);
    }else if(config.datatype == "colormap_collection"){
      this._colormapManager.loadCollection( config );
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
      var boxSize = that._levelManager.getBoundingBox();

      that._planeManager.setLevelManager( that._levelManager );
      that._levelManager.setResolutionLevel( that._resolutionLevel );
      that._boundingBoxHelper.build( boxSize );

      that._planeManager.setMultiplanePosition(
        boxSize[0] / 2,
        boxSize[1] / 2,
        boxSize[2] / 2
      );

      that._initOrientationHelper( new THREE.Vector3(boxSize[0] / 2, boxSize[1] / 2, boxSize[2] / 2) );
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
    this._updateOthoCamFrustrum();

    this._guiController.updateResolutionLevelUI( lvl );

    if(this._onUpdateViewCallback){
      this._onUpdateViewCallback( this.getMultiplaneContainerInfo() );
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
  _updatePerspectiveCameraLookAt( position ){
    this._quadViews[3].updateLookAt( position );
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
  * Initialize the orientation helper and adds it to the scene (and not to the main object, because it is not supposed to rotate)
  */
  _initOrientationHelper( position ){
    this._orientationHelper = new OrientationHelper(
      this._planeManager.getWorldDiagonalHiRez() / 13
    );

    this._orientationHelper.addTo( this._scene );
    this._syncOrientationHelperPosition( position );
  }


  /**
  * Synchronize the orientation helper position based on the main object position.
  */
  _syncOrientationHelperPosition( position ){
    if(this._orientationHelper){
      this._orientationHelper.setPosition( position );
    }
  }


  /**
  * Triggered when the resolution level changes to keep the orientation helper the right size.
  */
  _syncOrientationHelperScale(){
    this._orientationHelper.rescaleFromResolutionLvl( this._resolutionLevel );
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
          that._planeManager.translateMultiplaneX(-distance.x/factor, distance.y/factor);
          break;
        case 1:
          that._planeManager.translateMultiplaneY(distance.x/factor, distance.y/factor);
          break;
        case 2:
          that._planeManager.translateMultiplaneZ(distance.x/factor, -distance.y/factor);
          break;
        default:  // if last view, we dont do anything
          return;
      }

    });

    // callback def: regular rotation (using R key)
    this._quadViewInteraction.onGrabViewRotate( function(angleRad, angleDir, viewIndex){
      switch (viewIndex) {
        case 0:
          that._planeManager.rotateMultiplaneX(angleRad * angleDir);
          break;
        case 1:
          that._planeManager.rotateMultiplaneY(angleRad * angleDir * -1);
          break;
        case 2:
          that._planeManager.rotateMultiplaneZ(angleRad * angleDir);
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
          that._planeManager.rotateMultiplaneZ(distance.x / factor);
          that._planeManager.rotateMultiplaneY(-distance.y / factor);
          break;
        case 1:
          that._planeManager.rotateMultiplaneX(-distance.y / factor);
          that._planeManager.rotateMultiplaneZ(distance.x / factor);
          break;
        case 2:
          that._planeManager.rotateMultiplaneX(-distance.y / factor);
          that._planeManager.rotateMultiplaneY(distance.x / factor);
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
          that._planeManager.translateMultiplaneY(factor, 0);
          break;
        case 1:
          that.translateMultiplaneX(factor, 0);
          break;
        case 2:
          that._planeManager._planeManager.translateMultiplaneY(0, -factor);
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
          that._planeManager.translateMultiplaneY(factor, 0);
          break;
        case 1:
          that._planeManager.translateMultiplaneX(factor, 0);
          break;
        case 2:
          that._planeManager.translateMultiplaneY(0, -factor);
          break;
        default:  // if last view, we dont do anything
          return;
      }
    });

    this._quadViewInteraction.onDonePlaying(function(){
      that._onUpdateViewCallback && that._onUpdateViewCallback( that.getMultiplaneContainerInfo() );
    });

  }


  /**
  * @return {Object} the returned object if of the form:
  * { resolutionLvl, position {x, y, z}, rotation {x, y, z} }
  */
  getMultiplaneContainerInfo(){

    var multiplanePos = this._planeManager.getMultiplanePosition();
    var multiplaneRot = this._planeManager.getMultiplaneRotation();

    return {
      resolutionLvl: this._resolutionLevel,
      position: {
        x: multiplanePos.x,
        y: multiplanePos.y,
        z: multiplanePos.z
      },
      rotation: {
        x: multiplaneRot.x,
        y: multiplaneRot.y,
        z: multiplaneRot.z
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
