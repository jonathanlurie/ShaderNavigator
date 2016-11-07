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
      position: [ this._objectSize, 0, 0 ],
      up: [ 0, 1, 0 ]
    }
    this._viewName = "top_left";
    this._backgroundColor = new THREE.Color().setRGB( 0.8, 0.8, 0.8 );
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
      position: [ 0, this._objectSize, 0 ],
      up: [ 0, -1, 0 ]
    }
    this._viewName = "top_right";
    this._backgroundColor = new THREE.Color().setRGB( 0.9, 0.9, 0.9 );
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
      position: [ 0, 0, this._objectSize ],
      up: [ 1, 0, 0 ]
    }
    this._viewName = "bottom_left";
    this._backgroundColor = new THREE.Color().setRGB( 0.9, 0.9, 0.9 );
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
      position: [ this._objectSize, this._objectSize, this._objectSize ],
      up: [ 0, 0, 1 ]
    }
    this._viewName = "bottom_right";
    this._backgroundColor = new THREE.Color().setRGB( 0.8, 0.8, 0.8 );
  }


  /**
  * Build an orthographic camera for this view.
  */
  initOrthoCamera(){
    let orthographicCameraFovFactor = 500;

    this._camera = new THREE.OrthographicCamera(
      window.innerWidth / - orthographicCameraFovFactor,
      window.innerWidth / orthographicCameraFovFactor,
      window.innerHeight / orthographicCameraFovFactor,
      window.innerHeight / - orthographicCameraFovFactor,
      this._near,
      this._far
    );

    this._initCameraSettings();
  }


  /**
  * Build a perspective camera for this view.
  */
  initPerspectiveCamera(){
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
  * Adds Orbit control on this view, but only if the pointer (mouse) is within the boundaries of this view.
  * Should be called only after init a camera.
  */
  addOrbitControl(){
    this._control = new THREE.OrbitControls(this._camera);
  }


  /**
  * Updates the position of the mouse pointer with x and y in [0, 1] with origin at the bottom left corner.
  * Must be called before renderView() in case of using an Orbit Control.
  */
  updateMousePosition(x, y){
    this._mouse = {x:x, y:y};
  }


  /**
  * [PRIVATE]
  * If the camera uses an Orbit Control,
  */
  _updateCameraWithControl(){
    // The camera needs an update only if we have an orbit control
    if(this._control){

      if( this._mouse.x >= this._config.left &&
          this._mouse.x <= (this._config.left + this._config.width) &&
          this._mouse.y >= this._config.bottom &&
          this._mouse.y <= (this._config.bottom + this._config.height)
        ){

        // just entered
        if(! this._mouseInView){
          this._mouseInView = true;
          this._control.enabled = true;
          console.log("ENTER " + this._viewName);
        }

      }else{

        // just left
        if(this._mouseInView){
          this._mouseInView = false;
          this._control.enabled = false;
          console.log("LEAVE" + this._viewName);
        }

      }
    }
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

    // will only work if an Orbt Control is defined
    this._updateCameraWithControl();

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
  *
  */
  useRelativeCoordinatesOf( object3D ){
    // TODO: remove from an possibly existing parent first (if not scene)

    object3D.add(this._camera);
  }


} /* END QuadView */

export { QuadView };