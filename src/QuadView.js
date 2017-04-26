'use strict';


/**
* A QuadView is a projection of a rendered scene on a quarter of the viewport, typically: top_left, top_right, bottom_left or bottom_right.
* A QuadView instance is part of a QuadScene, where are renderer 4 QuadViews.
*/
class QuadView{

  /**
  * @param {THREE.Scene} scene - the main scene to be used by aggregation here.
  * @param {THREE.Renderer} renderer - the main renderer to be used by aggregation here.
  * @param {Number} objectSize - Considering the object is centered on origin, this is a distance to be used so that the camera are not within the object. Example: 2 times the largest diagonal.
  *
  */
  constructor(scene, renderer, objectSize){
    this._isPerspective = false;
    this._objectSize = objectSize;
    this._camera = null;
    this._config = null;
    this._near = 0.1;
    this._far = 1000;
    this._defaultFov = 30;

    // set when decided which corner
    this._viewName = "";

    this._originToLookAt = new THREE.Vector3(0, 0, 0);
    this._control = null;
    this._renderer = renderer;
    this._scene = scene;

    // mouse coordinates, given by an higher object to prevent recomputing for every view
    this._mouse = {x:0, y:0};

    // keeps a track if the mouse pointer is within this view
    this._mouseInView = false;

    // depends on what corner
    this._backgroundColor = null;

    // we save to get a resize ratio
    this._windowSize = {
      width: window.innerWidth ,
      height: window.innerHeight
    };

  }

  /**
  * Define the point the camera is supposed to look at. By default, this is in world coordinates but if you place the current camera into an object, this will be in object-related coordinates.
  * If unchanged, [0, 0, 0]
  * @param {Number} x - x from 3D world coordinates
  * @param {Number} y - y from 3D world coordinates
  * @param {Number} z - z from 3D world coordinates
  */
  setOriginToLookAt(x, y, z){
    this._originToLookAt.set(x, y, z);
  }


  /**
  * Init the current view as the top left view of the quad view
  */
  initTopLeft(){
    this._config = {
      left: 0.0,
      bottom: 0.5,
      width: 0.5,
      height: 0.5,
      position: [ -this._objectSize, 0, 0 ],
      up: [ -1, 0, 0 ]
    }
    this._viewName = "top_left";
    this._backgroundColor = new THREE.Color().setRGB( 1, 1, 1 );
  }


  /**
  * Init the current view as the top right view of the quad view
  */
  initTopRight(){
    this._config = {
      left: 0.5,
      bottom: 0.5,
      width: 0.5,
      height: 0.5,
      position: [ 0, -this._objectSize, 0 ],
      up: [ 0, -1, 0 ]
    }
    this._viewName = "top_right";
    this._backgroundColor = new THREE.Color().setRGB( 1, 1, 1 );
  }

  /**
  * Init the current view as the Bottom left view of the quad view
  */
  initBottomLeft(){
    this._config = {
      left: 0.0,
      bottom: 0.0,
      width: 0.5,
      height: 0.5,
      position: [ 0, 0, -this._objectSize ],
      up: [ 0, 1, 0 ]
    }
    this._viewName = "bottom_left";
    this._backgroundColor = new THREE.Color().setRGB( 1, 1, 1 );
  }


  /**
  * Init the current view as the Bottom right view of the quad view
  */
  initBottomRight(){
    this._config = {
      left: 0.5,
      bottom: 0,
      width: 0.5,
      height: 0.5,
      position: [ -this._objectSize/10, this._objectSize/10, -this._objectSize/15 ],
      up: [ 0, 0, -1 ]
    }
    this._viewName = "bottom_right";
    this._backgroundColor = new THREE.Color().setRGB( 0.97, 0.97, 0.97 );
  }


  /**
  * Build an orthographic camera for this view.
  */
  initOrthoCamera(){
    this._isPerspective = false;

    let orthographicCameraFovFactor = 720; // default: 360

    this._camera = new THREE.OrthographicCamera(
      window.innerWidth / - orthographicCameraFovFactor,  // left
      window.innerWidth / orthographicCameraFovFactor,    // right
      window.innerHeight / orthographicCameraFovFactor,   // top
      window.innerHeight / - orthographicCameraFovFactor // bottom
      //9.99,//this._objectSize * 0.9, //this._near,
      //10.01//this._objectSize * 1.1 //this._far
      //1,
      //10.1
    );

    this._camera.left_orig = window.innerWidth / - orthographicCameraFovFactor;
    this._camera.right_orig = window.innerWidth / orthographicCameraFovFactor;
    this._camera.top_orig = window.innerHeight / orthographicCameraFovFactor;
    this._camera.bottom_orig = window.innerHeight / - orthographicCameraFovFactor;

    /*
    this._camera.left_orig = this._camera.left;
    this._camera.right_orig = this._camera.right;
    this._camera.top_orig = this._camera.top;
    this._camera.bottom_orig = this._camera.bottom;
    */
    this._initCameraSettings();
  }


  /**
  * Build a perspective camera for this view.
  */
  initPerspectiveCamera(){
    this._isPerspective = true;

    this._camera = new THREE.PerspectiveCamera(
      this._defaultFov, // fov
      window.innerWidth / window.innerHeight, // aspect
      this._near, // near
      this._far // far
    );

    this._initCameraSettings();
  }


  /**
  * [PRIVATE]
  * Ends the building of the camera, using the settings from _config.
  */
  _initCameraSettings(){
    this._camera.position.x = this._config.position[0];
    this._camera.position.y = this._config.position[1];
    this._camera.position.z = this._config.position[2];
    this._camera.up.x = this._config.up[ 0 ];
    this._camera.up.y = this._config.up[ 1 ];
    this._camera.up.z = this._config.up[ 2 ];
    this._camera.fov = this._defaultFov;
    this._camera.lookAt( this._originToLookAt );
  }


  /**
  * Adds an orbit control so that the user can play easily
  */
  addTrackballControl(renderFunction, domContainer){
    this._control = new THREE.TrackballControls( this._camera, domContainer );

    this._control.rotateSpeed = 5.0;
    this._control.staticMoving = true;
    this._control.zoomSpeed = 0.3;
		this._control.panSpeed = 1;

    /*
    this._control.zoomSpeed = 1.2;
		this._control.panSpeed = 0.8;
		this._control.noZoom = false;
		this._control.noPan = false;
		this._control.staticMoving = true;
		this._control.dynamicDampingFactor = 0.3;
		this._control.keys = [ 65, 83, 68 ];
    */

    this._control.addEventListener( 'change', this.renderView.bind(this) );
  }


  /*
  * Change the background color for this view. If unchanged, top_left and bottom_right are in a bit darker gray than the 2 others.
  * @param {THREE.Color} c - color
  */
  setBackgroundColor(c){
    this._backgroundColor = c;
  }


  /**
  * Render the view, should be called when the main renderer is rendering.
  */
  renderView(){

    var left   = Math.floor( window.innerWidth  * this._config.left );
    var bottom = Math.floor( window.innerHeight * this._config.bottom );
    var width  = Math.floor( window.innerWidth  * this._config.width );
    var height = Math.floor( window.innerHeight * this._config.height );

    this._renderer.setViewport( left, bottom, width, height );
    this._renderer.setScissor( left, bottom, width, height );
    this._renderer.setScissorTest( true );
    this._renderer.setClearColor( this._backgroundColor );
    this._camera.aspect = width / height;
    this._camera.updateProjectionMatrix();
    this._renderer.render( this._scene, this._camera );
  }



  /**
  * To use to embed the camera of this QuadView into an existing object, so that it can profit from this object space transformation without further work.
  * We use it to embed a orthographic camera to planes so that the wole system can rotate and move all at once.
  */
  useRelativeCoordinatesOf( object3D ){
    // TODO: remove from an possibly existing parent first (if not scene)

    object3D.add(this._camera);
  }


  /**
  * Updates the camera frustrum for ortho cam, in order to change the width and heigh of its projection and keep a relativelly constant image no matter what zoom level we are using.
  * @param {Number} ff -
  */
  updateOrthoCamFrustrum(ff){
    this._camera.left = this._camera.left_orig * ff;
    this._camera.right = this._camera.right_orig * ff;
    this._camera.top = this._camera.top_orig * ff;
    this._camera.bottom = this._camera.bottom_orig * ff;
    //this._camera.updateProjectionMatrix();
  }


  /**
  * Used for perspective cameras. If a Control is enabled, the center of rotatation (target) will also be set.
  * @param {THREE.Vector3} pos - 3D position to look at and to turn around.
  */
  updateLookAt(pos){
    this._camera.lookAt( pos.clone() );

    if(this._control){
      this._control.target = pos.clone();
    }

  }


  /**
  * Update the control. This control needs to be updated from an "animate" function (like every frames) but not from a render function.
  * If the control is a TrackballControls, updateControl needs to be called at every loop.
  */
  updateControl(){
    this._control.update();
  }


  /**
  * If the control ( trackball) was initialized, it enables it.
  * (Can be called even though it was already enabled, this is NOT a toggle)
  */
  enableControl(){
    if(this._control){
      if(!this._control.enabled){
        this._control.enabled = true;
      }
    }
  }


  /**
  * If the control (trackball) was initialized, it disables it.
  * (Can be called even though it was already enabled, this is NOT a toggle)
  */
  disableControl(){
    if(this._control){
      if(this._control.enabled){
        //console.log("mouse left " + this._viewName);
        this._control.enabled = false;
      }
    }
  }


  /**
  * @returns {boolean} true if this view is using a trackball control (no matter if enabled or disabled). Return false if this view does not use any kind of controls.
  */
  isUsingControl(){
    return !!this._control;
  }


  /**
  * Ask if a specific normalized coordinates are in the window boundaries of this view.
  * @param {Number} x - horizontal coordinate normalized to the screen, so within [0, 1]. Origin on the left.
  * @param {Number} y - vertical coordinate normalized to the screen, so within [0, 1]. Origin on the bottom.
  * @returns true if (x, y) are
  */
  isInViewWindow(x, y){
    return x > this._config.left && y > this._config.bottom &&
      x < (this._config.left + this._config.width) &&
      y < (this._config.bottom + this._config.height);
  }


  /**
  * Enable a layer index for the camera of this view.
  * @param {Number} layerNum - index of the layer.
  */
  enableLayer( layerNum ){
    this._camera.layers.enable( layerNum );

  }


  /**
  * Disable a layer index for the camera of this view.
  * @param {Number} layerNum - index of the layer.
  */
  disableLayer( layerNum ){
    this._camera.layers.disable( layerNum );
  }


  /**
  * Return the camera of this view (unsafe, can be changed).
  */
  getCamera(){
    return this._camera;
  }


  /**
  * Update the ratio of the camera.
  * Most likely to happen when the windows is resized.
  * Depends if the cam is ortho of persp.
  */
  updateRatio(w, h){

    if(this._isPerspective){
      this._camera.aspect = w / h ;
      this._camera.updateProjectionMatrix();
    }else{
      var wRatio = this._windowSize.width / window.innerWidth;
      var hRatio = this._windowSize.height / window.innerHeight;

      this._camera.left /= wRatio;
      this._camera.right /= wRatio;
      this._camera.top /= hRatio;
      this._camera.bottom /= hRatio;
    }

    this._windowSize.width = window.innerWidth;
    this._windowSize.height = window.innerHeight;
  }


  /**
  * @return true if the camera of this view is a perspective camera.
  */
  isPerspective(){
    return this._isPerspective;
  }


  /**
  * @param {String} name of the config param to get. Must be "left", "bottom", "width", "height", "position" or "up". The 4 firsts being window settings, while the 2 lasts are camera settings. Read only.
  * @return {Number} the value of the parameter
  */
  getConfigParam( paramName ){

    if(paramName in this._config){
      return this._config[ paramName ]
    }else{
      console.warn(paramName + " param does not exist in the config.");
      return null;
    }
  }


} /* END QuadView */

export { QuadView };
