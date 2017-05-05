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
import { AnnotationCollection } from './AnnotationCollection.js';




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
    var that = this;
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
    this._domContainerName = DomContainer;
    this._domContainer = document.getElementById( DomContainer );

    // scene, where everything goes
    this._scene = new THREE.Scene();

    this._boundingBoxHelper = new BoundingBoxHelper( this._scene );

    /*
    var axisHelper = new THREE.AxisHelper( 1 );
    axisHelper.layers.enable(1);
    this._scene.add( axisHelper );
    */
    
    this._scene.add( new THREE.AmbientLight( 0x444444 ) );

    var light1 = new THREE.DirectionalLight( 0xffffff, 0.75 );
		light1.position.set( 200, 200, 200 );
    light1.layers.enable( 0 );
    light1.layers.enable( 1 );
		this._scene.add( light1 );

    // container of annotations and meshes, this is rotated/scaled/repositioned
    // so that the items are in the proper places compared to the images
    this._adjustedContainer = new THREE.Object3D();

    // contains the annotations (collection of logics + meshes)
    this._annotationCollection = new AnnotationCollection();

    // contains the meshes
    this._meshContainer = new THREE.Object3D();

    // what is inside what:
    this._adjustedContainer.add(this._meshContainer);
    this._adjustedContainer.add(this._annotationCollection.getContainer3D());
    this._scene.add(this._adjustedContainer);

    // renderer construction and setting
    this._renderer = new THREE.WebGLRenderer( { antialias: true } );
    this._renderer.setPixelRatio( window.devicePixelRatio );
    this._renderer.setSize( window.innerWidth, window.innerHeight );


    this._domContainer.appendChild( this._renderer.domElement );

    // TODO: use object real size (maybe)
    // a default camera distance we use instead of cube real size.
    this._cameraDistance = 50;

    // fog - the distance will be auto adjusted
    this._scene.fog = new THREE.Fog(0xeeeeee, this._cameraDistance, this._cameraDistance * 2);
    this._renderer.setClearColor( this._scene.fog.color );

    // to feed the renderer. will be init
    this._windowSize = {
      width: 0 ,
      height: 0
    };

    // a future instance of MeshCollection, to deal with meshes (obviously)
    this._meshCollection = null;

    this._stats = null;
    //this._initPlaneManager();
    //this._initViews( DomContainer );
    this._levelManager = new LevelManager();


    // init the gui controller
    //this._guiController = new GuiController(this);

    //this._testAnnotation();

    this._animate();

    this._refreshUniformsCounter = 0;

    /*
    // refresh uniform every half sec
    setInterval(function(){
      if(that._ready){
        that._planeManager.updateUniforms();
      }
    }, 1000);
    */

    /*
    setInterval(function(){
      if( that._refreshUniformsCounter && that._ready){
        that._planeManager.updateUniforms();
        that._refreshUniformsCounter = false;
      }
    }, 30);
    */


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
        that.refreshUniforms();
      }
    )

  }


  /**
  * return the quadview interaction.
  * Useful to specify interaction callback from the outside.
  * @return {QuadViewInteraction}
  */
  getQuadViewInteraction(){
    return this._quadViewInteraction;
  }


  /**
  * Refreshes a counter of frame to send uniforms.
  * Usually, sending new uniforms only once is not enought to get them to GPU,
  * so we have to do it n times.
  */
  refreshUniforms(){
    this._refreshUniformsCounter = 10;
  }


  /**
  * @return {LevelManager} so that the UI can query info
  */
  getLevelManager(){
    return this._levelManager;
  }


  /**
  * Shortcut function to set the multiplane position.
  * Handy because accessible from the onReady callback.
  */
  setMultiplanePosition(x, y, z){
    this._planeManager.setMultiplanePosition( x, y, z);
    this._guiController.updateMultiplaneUI( this.getMultiplaneContainerInfo() );

    // refresh the uniforms
    this.refreshUniforms();

    this.callOnUpdateViewCallback();
  }


  /**
  * Shortcut function to set the multiplane position.
  * Handy because accessible from the onReady callback.
  */
  setMultiplaneRotation(x, y, z){
    this._planeManager.setMultiplaneRotation( x, y, z);
    this._guiController.updateMultiplaneUI( this.getMultiplaneContainerInfo() );

    // refresh the uniforms
    this.refreshUniforms();

    this.callOnUpdateViewCallback();
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
  * @return {PlaneManager} the instance of PlaneManager, mainly for UI things.
  */
  getPlaneManager(){
    return this._planeManager;
  }


  /**
  * Add a statistics widget
  */
  initStat(){
    this._stats = new Stats();
    this._domContainer.appendChild( this._stats.dom );

    // place it on top right
    this._stats.dom.style.right = '0';
    this._stats.dom.style.left = 'initial';
    this._stats.dom.style.top = '0';
    this._stats.dom.style.position = 'absolute';
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

    

    if(this._stats){
      this._stats.update();
    }

    if( this._ready){
    
      // updating the control is necessary in the case of a TrackballControls
      this._quadViews[3].updateControl();
      
      if(this._refreshUniformsCounter){
        this._planeManager.updateUniforms();
        this._refreshUniformsCounter --;
        
        // render only when uniforms where updated
        this._render();
      }
      
      // render no matter what
      //this._render();
    }

    

    // call a built-in method for annimation
    requestAnimationFrame( this._animate.bind(this) );
  }


  /**
  * [PRIVATE]
  * Typical rendering function, necessary in THREE js
  */
  _render(){
    let that = this;

    if(this._ready){
      //this._planeManager.updateUniforms();
      
      for(var i=0; i<this._quadViews.length; i++){
        this._quadViews[i].renderView();
      }
    }

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
    }else if(config.datatype == "annotation_collection"){
      this._annotationCollection.loadAnnotationFileURL( config );
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

    // when tiles are all loaded, we refresh the textures
    this._levelManager.onAllChunksLoaded( function(){
      console.log(">> All required chunks are loaded");
      //that._planeManager.updateUniforms();
      
      that.refreshUniforms();
    });


    // the description file is successfully loaded
    this._levelManager.onReady(function(){
      that._initPlaneManager();
      that._initViews( that._domContainerName );
      var boxSize = that._levelManager.getBoundingBox();

      // safe value, may be changed by what comes next
      var sizeChunkLvl0 = 0.5;
      var firstChunkColl = that._levelManager.getChunkCollection(0);
      if(firstChunkColl){
        sizeChunkLvl0 = firstChunkColl.getSizeChunkLvl0kWC();
      }

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

      // init the gui controller
      that._guiController = new GuiController(that);

      if(that._onReadyCallback){
        that._onReadyCallback(that);
      }

      // the callback above may have changed the rotation/position from URL
      that._guiController.updateMultiplaneUI( that.getMultiplaneContainerInfo() );

      that._render();
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

    // update size of the orientation helper
    this._syncOrientationHelperScale();

    // update the fog distance to progressively hide annotation
    var fogDistance = this._orientationHelper.getRadius() * 4;
    this._scene.fog.far = this._cameraDistance + fogDistance;

    // update the ortho cam frustrum
    this._updateOthoCamFrustrum();

    // update the UI
    this._guiController.updateResolutionLevelUI( lvl );

    // refresh the uniforms
    this.refreshUniforms();

    //this.callOnUpdateViewCallback();
    if(this._onUpdateViewCallback){
      this._onUpdateViewCallback( this.getMultiplaneContainerInfo() );
    }
  }


  callOnUpdateViewCallback(){
    if(this._onUpdateViewCallback){
      this._onUpdateViewCallback( this.getMultiplaneContainerInfo() );
    }
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
      this._planeManager.getWorldDiagonalHiRez()
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
      var factor = Math.pow(2, that._resolutionLevel + 1);

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
      //that._planeManager.updateUniforms();
      that.refreshUniforms();
      that._guiController.updateMultiplaneUI( that.getMultiplaneContainerInfo() );
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
      //that._planeManager.updateUniforms();
      that.refreshUniforms();
      that._guiController.updateMultiplaneUI( that.getMultiplaneContainerInfo() );
    });

    // callback def: transverse rotation (using T key)
    this._quadViewInteraction.onGrabViewTransverseRotate( function(distance, viewIndex){
      var factor =  that._resolutionLevel / 4;

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
      //that._planeManager.updateUniforms();
      that.refreshUniforms();
      that._guiController.updateMultiplaneUI( that.getMultiplaneContainerInfo() );
    });

    // callback def: arrow down
    this._quadViewInteraction.onArrowDown( function(viewIndex){
      var factor = that._levelManager.getBoundingBox()[0] / that._levelManager.getLevelInfo(that._resolutionLevel, "size")[0];

      switch (viewIndex) {
        case 0:
          that._planeManager.translateMultiplaneY(-factor, 0);
          break;
        case 1:
          that._planeManager.translateMultiplaneX(-factor, 0);
          break;
        case 2:
          that._planeManager.translateMultiplaneY(0, -factor);
          break;
        default:  // if last view, we dont do anything
          return;
      }
      //that._planeManager.updateUniforms();
      that.refreshUniforms();
      that._guiController.updateMultiplaneUI( that.getMultiplaneContainerInfo() );
    });

    // callback def: arrow up
    this._quadViewInteraction.onArrowUp( function(viewIndex){
      var factor = that._levelManager.getBoundingBox()[0] / that._levelManager.getLevelInfo(that._resolutionLevel, "size")[0];

      switch (viewIndex) {
        case 0:
          that._planeManager.translateMultiplaneY(factor, 0);
          break;
        case 1:
          that._planeManager.translateMultiplaneX(factor, 0);
          break;
        case 2:
          that._planeManager.translateMultiplaneY(0, factor);
          break;
        default:  // if last view, we dont do anything
          return;
      }
      //that._planeManager.updateUniforms();
      that.refreshUniforms();
      that._guiController.updateMultiplaneUI( that.getMultiplaneContainerInfo() );
    });

    this._quadViewInteraction.onDonePlaying(function(){
      that._guiController.updateMultiplaneUI( that.getMultiplaneContainerInfo() );
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
      },
      axisInfo: this._levelManager.getAllAxisInfo()
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


  /**
  * @return {AnnotationCollection} instance of the annotation collection
  */
  getAnnotationCollection(){
    return this._annotationCollection;
  }


}

export { QuadScene };
