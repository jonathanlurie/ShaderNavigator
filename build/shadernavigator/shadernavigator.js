// Build date: Mon  1 May 2017 17:15:02 EDT

(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(factory((global.SHAD = global.SHAD || {})));
}(this, (function (exports) { 'use strict';

/**
* An HashIO instance reads and writes the hash part of the URL (what is after '#').
* The read mode: the user can specify some arguments in the URL to specify
* the resolution level, the position and the rotation. Here is how the URL should
* look like: mydomain.com/quadView.html#5/1.01,1.02,1.03/0.1,0.2,0.3
* Where:
*    5 is the resolution level
*    1.01,1.02,1.03 is the x,y,z position of the intersection plane
*    0.1,0.2,0.3 is the x,y,z Euler angle rotation of the intersection plane
*
* The write mode: everytime the intersection plane is moved, the hash is refreshed
* so that the url can be used to come back to a specific position within the dataset.
*
*/
class HashIO{

  constructor(){
    this._rePattern = /(\d)[\/]([-]?[0-9]*[.]?[0-9]+)[,]([-]?[0-9]*[.]?[0-9]+)[,]([-]?[0-9]*[.]?[0-9]+)[\/]([-]?[0-9]*[.]?[0-9]+)[,]([-]?[0-9]*[.]?[0-9]+)[,]([-]?[0-9]*[.]?[0-9]+)/g;

  }


  /**
  * @returns the hash if there is one (without the '#'). Return an empty string if no hash.
  */
  getRawHash(){
    return window.location.hash.substr(1);
  }


  /**
  * Reads the URL hash and returns plane intersection information if the format matches.
  * @return {Object} the returned object if of the form:
  * { resolutionLvl, position {x, y, z}, rotation {x, y, z} }
  * Or returns null if the format does not match.
  */
  getHashInfo(){
    var match  = this._rePattern.exec( this.getRawHash() );

    if(!match)
      return null;

    return {
      resolutionLvl: parseInt(match[1]),
      position: {
        x: parseFloat(match[2]),
        y: parseFloat(match[3]),
        z: parseFloat(match[4])
      },
      rotation: {
        x: parseFloat(match[5]),
        y: parseFloat(match[6]),
        z: parseFloat(match[7])
      }
    };
  }

  /**
  * Write the hash part of the url
  * @param {Object} objectInfo - should have this structure:
  *   { resolutionLvl, position {x, y, z}, rotation {x, y, z} }
  * If one of the parameter is NaN, the URL hash is not updated
  * (some low level bug tend to produce NaN Euler angle).
  *
  */
  setHashInfo( objectInfo ){

    // dont refresh if we get a NaN
    if( isNaN(objectInfo.position.x) || isNaN(objectInfo.position.y) || isNaN(objectInfo.position.z) ||
        isNaN(objectInfo.rotation.x) || isNaN(objectInfo.rotation.y) || isNaN(objectInfo.rotation.z) )
    {
      return;
    }

    window.location.hash = objectInfo.resolutionLvl + "/"+
      objectInfo.position.x + "," +
      objectInfo.position.y + "," +
      objectInfo.position.z + "/" +
      objectInfo.rotation.x + "," +
      objectInfo.rotation.y + "," +
      objectInfo.rotation.z;
  }



} /* END CLASS HashIO */

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
    };
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
    };
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
    };
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
    };
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

/**
* Contains only static methods to load various kind of data with an AJAX request.
*/
class AjaxFileLoader{

  /**
  * Loads a text file and makes its content available thru a String.
  * @param {String} url - URL of the file to load
  * @param {callback} successCallback - function to call when the file is loaded. Called with one String argument.
  * @param {callback} errorCallback - function to call when the file failed to load. Called with a Number argument (http status).
  */
  static loadTextFile(url, successCallback, errorCallback) {
    var xhr = typeof XMLHttpRequest != 'undefined'
      ? new XMLHttpRequest()
      : new ActiveXObject('Microsoft.XMLHTTP');

    xhr.open('GET', url, true);

    xhr.onload = function() {
      var status;
      var data;

      if (xhr.readyState == 4) { // `DONE`
        status = xhr.status;
        if (status == 200) {
          successCallback && successCallback(xhr.responseText);
        } else {
          errorCallback && errorCallback(status);
        }
      }
    };

    xhr.onerror = function(e){
      errorCallback && errorCallback(status);
    };

    xhr.send();
  }



  static loadCompressedTextFile(url, successCallback, errorCallback) {
    if(! AjaxFileLoader.isPakoAvailable()){
      errorCallback("Pako lib is not available, please include it to your project.");
      return;
    }

    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.responseType = "arraybuffer";

    xhr.onload = function (oEvent) {

      var status = xhr.status;
      var arrayBuffer = xhr.response;

      if (arrayBuffer) {
        var unzipped = pako.inflate(arrayBuffer);
        var result = unzipped.buffer;
        var blob = new Blob([result]);
        var fileReader = new FileReader();

        fileReader.onload = function(event) {
          //console.log(event.target.result.length);
          successCallback && successCallback(event.target.result);
        };

        fileReader.onerror = function(event){
          errorCallback && errorCallback(event);
        };

        fileReader.readAsText(blob);
      }
    };

    xhr.onerror = function(e){
      console.error("Can't find the file " + url);
      errorCallback && errorCallback(status);
    };

    xhr.send(null);

  }


  /**
  * Check if Pako lib (for reading gz files) is available.
  * @return true if available, or false if not
  */
  static isPakoAvailable(){
    var isIt = true;

    try{
      pako;
    }catch(e){
      console.warn(e);
      isIt = false;
    }

    return isIt;
  }


}/* END CLASS AjaxFileLoader */

/**
* Generic interface to load texture and give them to the TextureChunk
*/
class TextureLoaderInterface{

  constructor( textureChunk ){
    this._textureChunk = textureChunk;
  }

} /* END class TextureLoaderInterface */

/**
* A TextureLoaderOctreeTiles is a specialization of TextureLoaderInterface. It loads a texture for a texture chunk directly from a image file in an octree 3D tiling architecture.
*/
class TextureLoaderOctreeTiles extends TextureLoaderInterface{

  constructor( textureChunk ){
    super(textureChunk);
  }


  /**
  * [PRIVATE]
  * Fetch some data from the this._textureChunk to build the name of the texture file
  */
  _buildFileName(){
    // load some data from the texture chunk
    let index3D = this._textureChunk.getIndex3D();
    let voxelPerSide = this._textureChunk.getVoxelPerSide();
    let workingDir = this._textureChunk.getWorkingDir();
    let resolutionLevel = this._textureChunk.getResolutionLevel();

    let sagitalRangeStart = index3D[0] * voxelPerSide;
    let coronalRangeStart = index3D[1] * voxelPerSide;
    let axialRangeStart   = index3D[2] * voxelPerSide;

    /** Texture file, build from its index3D and resolutionLevel */

    // build the filepath
    var filepath =  workingDir + "/" + resolutionLevel + "/" +
                  sagitalRangeStart + "-" + (sagitalRangeStart + voxelPerSide) + "/" +
                  coronalRangeStart + "-" + (coronalRangeStart + voxelPerSide) + "/" +
                  axialRangeStart   + "-" + (axialRangeStart + voxelPerSide);

    return filepath;
  }


  /**
  * Load the octree image as a THREE.Texture and set it in the TextureChunk object
  */
  loadTexture(){
    // first, we need it's filename to get it from the octree
    var filepath = this._buildFileName();
    var that = this;

    var threeJsTexture = new THREE.TextureLoader().load(
      filepath, // url
      function(){
        // ensure we are using nearest neighbors
        threeJsTexture.magFilter = THREE.NearestFilter;
        threeJsTexture.minFilter = THREE.NearestFilter;

        that._textureChunk.setTexture(threeJsTexture);
        that._textureChunk.onTextureSuccessToLoad();
      }, // on load
      function(){}, // on progress, do nothing

      function(){ // on error
        that._textureChunk.onTextureFailedToLoad();
      }
    );

  }


} /* END class TextureLoaderOctreeTiles */

/*

  TODO: give the possibility to clean/remove the texture object, and with a flag,
  getting to know if it's still loaded or not. It can be interesting to do it for
  an entire zoom level to free some memory when we are currently using another
  zoom level.

  NOTE: take into consideration that other zoom levels than the main/current are possibly in use due to minimap display.

*/

/**
* Represent a cubic chunk of texture. Should be part of a {@link LevelManager}.
*/
class TextureChunk{

  /**
  * Initialize a TextureChunk object, but still, buildFromIndex3D() or buildFromWorldPosition() needs to be called to properly position the chunk in world coord.
  *
  * @param {number} resolutionLevel - The level of resolution, the lower the level, the lower the resolution. Level n has a metric resolution per voxel twice lower/poorer than level n+1, as a result, level n has 8 time less chunks than level n+1, remember we are in 3D!.
  * @param {Number} voxelPerSide - Number of pixel/voxel per side of the chunk, most likely 64.
  * @param {Number} sizeWC - Size of the chunk in world coordinates. Most likely 1/2^resolutionLevel.
  * @param {String} workingDir - The folder containing the config file (JSON) and the resolution level folder.
  * @param {String} chunkID - the string ID this chunk has within the ChunkCollection. This is used by the callbacks when succeding or failing to load the texture file.
  * @param {String} datatype - Type of data, but for now only "octree_tiles" is ok
  * @param {Array} matrix3DSize - Number of chunks in each dimension [x, y, z] that are supposedly available.
  */
  constructor(resolutionLevel, voxelPerSide, sizeWC, workingDir, chunkID, datatype, matrix3DSize){
    /** the string ID this chunk has within the ChunkCollection. This is used by the callbacks when succeding or failing to load the texture file */
    this._chunkID = chunkID;

    this._matrix3DSize = matrix3DSize;

    /** Number of voxel per side of the chunk (suposedly cube shaped). Used as a constant.*/
    this._voxelPerSide = voxelPerSide;//64;

    this._workingDir = workingDir;

    /**
    * The level of resolution, the lower the level, the lower the resolution. Level n has a metric resolution per voxel twice lower/poorer than level n+1, as a result, level n has 8 time less chunks than level n+1 (remember we are in 3D!).
    */
    this._resolutionLevel = resolutionLevel;

    /** Size of a chunk in 3D space (aka. in world coordinates) */
    this._sizeWC = sizeWC; //this._chunkSizeLvlZero / Math.pow(2, this._resolutionLevel);

    /** The actuall THREE.Texture */
    this._threeJsTexture = null;

    /** True only if totally build, with index and world coordinates origin */
    this._isBuilt = false;

    /** in case the texture file was unable to load, this flag goes true */
    this._textureLoadingError = false;
    this._triedToLoad = false;

    /** callback when a texture is successfully load. Defined using onTextureLoaded( ... ) */
    this._onTextureLoadedCallback = null;

    /** callback when a texture failled to be loaded. Defined using onTextureLoadError( ... ) */
    this._onTextureLoadErrorCallback = null;

    /** The texture loader takes _this_ in argument because it will need some local info but depending on the datatype, different info may be asked */
    this._textureLoader = null;

    // the data is stored as an octree 3D tiling structure
    if(datatype == "precomputed_octree_tiles")
      this._textureLoader = new TextureLoaderOctreeTiles( this );

  }


  /**
  * @return this._voxelPerSide
  */
  getVoxelPerSide(){
    return this._voxelPerSide;
  }

  /**
  * @return a copy of the this_index3D (Array)
  */
  getIndex3D(){
    return this._index3D.slice();
  }


  /**
  * @return the working directory
  */
  getWorkingDir(){
    return this._workingDir;
  }


  /**
  * @return the resolution level
  */
  getResolutionLevel(){
    return this._resolutionLevel;
  }


  /**
  * Set the texture
  * @param {THREE.Texture} t - Texture loaded by a TextureLoader
  */
  setTexture(t){
    this._threeJsTexture = t;
  }


  /**
  * Has to be called explicitely just after the constructor (unless you call buildFromWorldPosition() instead). Finishes to build the chunk.
  * @param {Array} index3D - The index position in the octree. Each members [x, y, z] are interger.
  */
  buildFromIndex3D(index3D){
    /**
    * The index position in the octree. Each members are interger.
    */
    this._index3D = index3D.slice();
    this._findChunkOrigin();


    // try to load only if never tried
    if( !this._triedToLoad){
      this._textureLoader.loadTexture();
      //this._loadTextureDecode();
    }

    this._isBuilt = true;
  }


  /**
  * [PRIVATE] Finds a chunk origin using its _index3D and _sizeWC.
  * the origin is used by the shader.
  */
  _findChunkOrigin(){
    /**
    * Origin of the chunk in world cooridnates. Is a [x, y, z] Array.
    * Is computed from the sizeWC and the index3D
    */

    this._originWC = new THREE.Vector3(
      this._index3D[0] * this._sizeWC,
      this._index3D[1] * this._sizeWC,
      this._index3D[2] * this._sizeWC
    );

  }


  /**
  * Called by a TextureLoader when the texture is loaded successfully
  */
  onTextureSuccessToLoad(){
    //console.log('SUCCESS LOAD: ' + this._filepath );
    this._textureLoadingError = false;
    this._triedToLoad = true;

    // calling the success callback if defined
    if( this._onTextureLoadedCallback ){
      this._onTextureLoadedCallback( this._chunkID );
    }
  }


  /**
  * called by a TextureLoader when the texture fails to load
  */
  onTextureFailedToLoad(){
    //console.log('ERROR LOAD: ' + this._filepath );
    this._threeJsTexture = null;
    this._textureLoadingError = true;
    this._triedToLoad = true;

    // call the fallure callback if exists
    if( this._onTextureLoadErrorCallback ){
      this._onTextureLoadErrorCallback( this._chunkID );
    }
  }


  /**
  * Alternative to _loadTexture but decode the jpeg strip in JS using a JS lib.
  * It's pretty slow and should maybe be put in a webworker -- to be tested!
  */
  _loadTextureDecode(){
    var that = this;

    var xhr = new XMLHttpRequest();
    xhr.open('GET', this._filepath);
    xhr.responseType = 'arraybuffer';

    xhr.onload = function () {

      var encoded = new Uint8Array(xhr.response);
      var numComponents, width, height, decoded, parser;

      parser = new JpegDecoder();
      parser.parse(encoded);
      width = parser.width;
      height = parser.height;
      numComponents = parser.numComponents;
      decoded = parser.getData(width, height);

      that._threeJsTexture = new THREE.DataTexture(
        decoded,
        width,
        height,
        //THREE.RGBFormat
        THREE.LuminanceFormat
        //THREE.UnsignedByteType
      );

      that._threeJsTexture.magFilter = THREE.NearestFilter;
      that._threeJsTexture.minFilter = THREE.NearestFilter;
      that._threeJsTexture.flipY = true;
      that._threeJsTexture.needsUpdate = true;

      //console.log('SUCCESS LOAD: ' + that._filepath );
      that._textureLoadingError = false;
      that._triedToLoad = true;

      // calling the success callback if defined
      if( that._onTextureLoadedCallback ){
        //console.log("call the callback");
        that._onTextureLoadedCallback( that._chunkID );
      }

    };

    xhr.onerror = function(){
      //console.log('ERROR LOAD: ' + that._filepath );
      that._threeJsTexture = null;
      that._textureLoadingError = true;
      that._triedToLoad = true;

      // call the fallure callback if exists
      if( that._onTextureLoadErrorCallback ){
        that._onTextureLoadErrorCallback( that._chunkID );
      }
    };

    xhr.send();












  }



  /**
  * Returns an object contain the THREE.Texture, the origin as an array [x, y, z]
  * and a boolean specifying the validity.
  * @return {Object}
  */
  getChunkTextureData(){
    return {
      texture: this._threeJsTexture,
      origin: this._originWC,
      valid: !this._textureLoadingError
    }
  }


  /**
  * @return {String} the current texture filepath to load.
  */
  getTextureFilepath(){
    return this._filepath;
  }


  /**
  * Return true if the chunk was not able to load its texture.
  */
  loadingError(){
    return this._textureLoadingError;
  }


  /**
  * @param {callback function} cb - Callback to be called when the texture file corresponding to the chunk is successfully loaded.
  */
  onTextureLoaded(cb){
    this._onTextureLoadedCallback = cb;
  }


  /**
  * @param {callback function} cb - Callback to be called when the texture file corresponding to the chunk fails to be loaded.
  */
  onTextureLoadError(cb){
    this._onTextureLoadErrorCallback = cb;
  }


} /* END CLASS TextureChunk */

var MemoryStorageRecord = {};


/**
* MemoryStorage is a semi-global shared memory space to set values in a reccord.
* (not accessible from global scope, just accessible from shaderNavigator's scope)
* This is helpful to share some data between objects that are unrealated enough
* to make it irrelevant sending arguments
*
*/
class MemoryStorage {
  
  /**
  * Adds or modify a record.
  * @param {String} name - name or the record, will be unique
  * @param {Object} value - the value to put in the record 
  */
  static setRecord( name, value ){
    MemoryStorageRecord[ name ] = value;
  }
  
  
  /**
  * Get a record
  * @param {String} name - name of the record
  * @return {Object} existing value or null if there is no record with such name
  */
  static getRecord( name ){
    if( name in MemoryStorageRecord){
      return MemoryStorageRecord[name];
    }else{
      return null;
    }
  }
  
}

/**
* The Chunk Collection is the container for all the chunks at a given resolution level.
* The resolutionLevel goes from 0 to 6, 0 being the poorer and 6 the sharper.
* ChunkCollection should not be asked anything directly, {@link LevelManager} should be the interface for that.
*/
class ChunkCollection{

  /**
  * Constructor
  * @param {number} resolutionLevel - The level of resolution, the lower the level, the lower the resolution. Level n has a metric resolution per voxel twice lower/poorer than level n+1, as a result, level n has 8 time less chunks than level n+1, remember we are in 3D!.
  * @param {Number} lowestDefSize - Size of the lowest rez level (most likely 128)
  * @param {Array} matrix3DSize - Number of chunks in each dimension [x, y, z] that are supposedly available.
  * @param {String} workingDir - The folder containing the config file (JSON) and the resolution level folder
  * @param {String} datatype - Type of data, but for now only "octree_tiles" is ok.
  */
  constructor(resolutionLevel, lowestDefSize, matrix3DSize, workingDir, datatype){
    /**
    * The chunks of the same level. A map is used instead of an array because the chunks are loaded as they need to display, so we prefer to use an key (string built from the index3D) rather than a 1D array index.
    */
    this._chunks = {};

    this._datatype = datatype;

    /** The folder containing the config file (JSON) and the resolution level folder */
    this._workingDir = workingDir;

    /** Number of chunks in each dimension [x, y, z] that are supposedly available. */
    this._matrix3DSize = matrix3DSize;

    /** Level from 0 to 6, possibly more in the future. */
    this._resolutionLevel = resolutionLevel;

    /** Number of voxel per side of the chunk (suposedly cube shaped). Used as a constant.*/
    this._voxelPerSide = 64;
    
    /** World size of a chunk at level 0. Used as a constant. */
    this._sizeChunkLvl0kWC = this._voxelPerSide / lowestDefSize;

    MemoryStorage.setRecord("sizeChunkLvl0kWC", this._sizeChunkLvl0kWC);

    /** Size of a chunk in 3D space (aka. in world coordinates) */
    this._sizeChunkWC = this._sizeChunkLvl0kWC / Math.pow(2, this._resolutionLevel);

    // Creates a fake texture and fake texture data to be sent to the shader in case it's not possible to fetch a real data (out of bound, unable to load texture file)
    this._createFakeTexture();

    /** Keeps a track of how many textures are supposed to be loaded, how many failed to load and how many eventually loaded successfully */
    this._chunkCounter = {
      toBeLoaded: 0,
      loaded: 0,
      failled: 0
    };

    this._onChunksLoadedCallback = null;
    this._onAllChunksLoadedCallback = null;

  }


  /**
  * [PRIVATE] init the chunk for the given index3D. Adds it to the collection AND returns it in case of immediate need.
  * @param {Array} index3D - [x, y, z] index of the chunk, where x, y and z are integer.
  * Does not perform any kind of verification (already exists, out of bound, etc.).
  * @return {TextureChunk} the newly created texture chunk.
  */
  _initChunkFromIndex3D(index3D){
    var that = this;
    var k = this.getKeyFromIndex3D(index3D);

    // add a chunk
    this._chunks[k] = new TextureChunk(
      this._resolutionLevel,
      this._voxelPerSide,
      this._sizeChunkWC,
      this._workingDir,
      k,
      this._datatype,
      this._matrix3DSize
    );

    // callback on the texture when succesfully loaded
    this._chunks[k].onTextureLoaded(function(chunkID){
      that._countChunks( chunkID, true );
    });

    // callback on the texture when failed to load
    this._chunks[k].onTextureLoadError(function(chunkID){
      that._countChunks( chunkID, false );
    });

    // build it properly
    this._chunks[k].buildFromIndex3D(index3D);

    // increment the counter
    this._chunkCounter.toBeLoaded ++;

    return this._chunks[k];
  }


  /**
  * @return the size of chunks in world coord in this collection
  */
  getSizeChunkWc(){
    return this._sizeChunkWC;
  }


  /**
  * Get the size of a chunk of lvl0 in world coordinate unit space
  * @return {Number} the size (most likely 0.5)
  */
  getSizeChunkLvl0kWC(){
    return this._sizeChunkLvl0kWC;
  }

  /**
  * Get a chunk at a given position, not necessary the origin
  */
  getTextureAtPosition(position){
    var index3D = this.getIndex3DFromWorldPosition(position);
    return this.getTextureAtIndex3D(index3D);
  }


  /**
  * Get the THREE.Texture for the chunk at index3D. Build the chunk if it's not already done.
  * @param {Array} index3D - [x, y, z] index of the chunk, where x, y and z are integer.
  * @return {THREE.Texture} Possibly a fake texture if we are asking out of bound.
  */
  getTextureAtIndex3D(index3D){
    var texture = this._fakeTextureData;

    // the required is within boundaries
    if( this.isWithinBounds(index3D) ){

      // fetch the chunk
      var chunk = this._getChunkIfInCollection(index3D);

      // if the chunk is not already in collection, we load it.
      if(!chunk){
        chunk = this._initChunkFromIndex3D(index3D);
      }

      // if the texture was successfully loaded.
      // most likely to be true the first time the texture is loaded due
      // to the async loading of the texture file.
      if(!chunk.loadingError()){
        texture = chunk.getChunkTextureData();
      }
    }

    return texture;
  }


  /**
  * Get the index3D from a arbitrary world position.
  * @param {Array} position - [x, y, z] arbitrary position.
  * @return {Array} the index3D, made of integer.
  *
  * TODO: if we add an offset, it's here!
  */
  getIndex3DFromWorldPosition(position){

    var index3D = [
      Math.floor(position[0] / this._sizeChunkWC),
      Math.floor(position[1] / this._sizeChunkWC),
      Math.floor(position[2] / this._sizeChunkWC)
    ];

    /*
    if(position[0] >=0 && position[1] >=0 && position[2] >=0 &&
       position[0]<1.609 && position[1]<1.81 && position[2]<1.406 &&
       this._sizeChunkWC == 0.5){

      console.log("------------------------------------");
      console.log(this._sizeChunkWC);
      console.log(this._matrix3DSize);
      console.log(position);
      console.log(index3D);
    }
    */

    return index3D;
  }


  /**
  * Check if a chunk was already created in the map.
  * @param {Array} index3D - [x, y, z] index of the chunk, where x, y and z are integer.
  * @return {Boolean} - true if the chunk is already in the colletion, return false if not.
  */
  isInCollection(index3D){
    var k = this.getKeyFromIndex3D(index3D);
    return (k in this._chunks);
  }

  /**
  * [PRIVATE]
  * return the chunk at index3D if it was initialized. Return null if not yet created.
  * @param {Array} index3D - [x, y, z] index of the chunk, where x, y and z are integer.
  * @return {object} A chunk of null.
  */
  _getChunkIfInCollection(index3D){
    var k = this.getKeyFromIndex3D(index3D);

    if( k in this._chunks){
      return this._chunks[k];
    }else{
      return null;
    }

  }


  /**
  * @return underscore joined index3D as a string
  */
  getKeyFromIndex3D(index3D){
    return index3D.join("_");
  }


  /**
  * Check if a chunk is within the bounds in term of indexing.
  * @param {Array} index3D - [x, y, z] index of the chunk, where x, y and z are integer.
  * @return {Boolean} - true if within bounds, false if not.
  */
  isWithinBounds(index3D){

    if( index3D[0] < 0 || index3D[0] >= this._matrix3DSize[0] ||
        index3D[1] < 0 || index3D[1] >= this._matrix3DSize[1] ||
        index3D[2] < 0 || index3D[2] >= this._matrix3DSize[2] ){
      return false;
    }else{
      return true;
    }

  }


  /**
  * [PRIVATE]
  * Creates a fake texture of size 1 to send to the shader in case we are
  * out of bound or to complete the Sampler2D array for the fragment shader.
  */
  _createFakeTexture(){
    /*
    this._fakeTextureData = {
      texture: new THREE.DataTexture(
          new Uint8Array(0),
          0,
          0,
          THREE.LuminanceFormat,  // format, luminance is for 1-band image
          THREE.UnsignedByteType  // type for our Uint8Array
        ),
      origin: new THREE.Vector3(0, 0, 0),
      validity: false
    };
    */

    this._fakeTextureData = {
      texture: null,
      origin: new THREE.Vector3(0, 0, 0),
      validity: false
    };

  }


  /**
  * Get the 8 indexes that are the closest to an arbitrary position.
  * (because we send 8 Sampler2D to the fragment shader)
  * @param {Array} position - An arbitrary position in world coordinates.
  * @return {Array} heigh times [x, y, z] in no specific order.
  */
  _get8ClosestToPositions(position){

    var localChunk = this.getIndex3DFromWorldPosition(position);

    var closest = [
      Math.abs(position[0] % this._sizeChunkWC) > this._sizeChunkWC / 2 ?
        localChunk[0] + Math.sign(position[0]) :
        localChunk[0] - Math.sign(position[0]),

      Math.abs(position[1] % this._sizeChunkWC) > this._sizeChunkWC / 2 ?
        localChunk[1] + Math.sign(position[1]) :
        localChunk[1] - Math.sign(position[1]),

      Math.abs(position[2] % this._sizeChunkWC) > this._sizeChunkWC / 2 ?
        localChunk[2] + Math.sign(position[2]) :
        localChunk[2] - Math.sign(position[2]),
    ];


    // build the chunk index of the 8 closest chunks from position
    var indexes3D = [
      [
        localChunk[0],
        localChunk[1],
        localChunk[2]
      ],
      [
        localChunk[0],
        localChunk[1],
        closest[2]
      ],
      [
        localChunk[0],
        closest[1],
        localChunk[2]
      ],
      [
        localChunk[0],
        closest[1],
        closest[2]
      ],
      [
        closest[0],
        localChunk[1],
        localChunk[2]
      ],
      [
        closest[0],
        localChunk[1],
        closest[2]
      ],
      [
        closest[0],
        closest[1],
        localChunk[2]
      ],
      [
        closest[0],
        closest[1],
        closest[2]
      ],
    ];

    return indexes3D;
  }

  /**
  * return the 8 texture data for the 8 closest chunks to the given position.
  * The texture data are ordered so that if some are invalid (out of bound, fake texture) they will be placed in the end of the array.
  * @param {Array} position - An arbitrary position in world coordinates.
  * @return {object} the object contains 1 array of textures, one array of chunks origins and one integer to inform how many of these textures are valid. This may seem a strange data structure but it's the closest from what can take the fragment shader and will require no further work. Remember we are potentially speaking of thousands of chunks being loaded!
  */
  get8ClosestTextureData(position){
    var the8closestIndexes = this._get8ClosestToPositions(position);
    var validChunksCounter = 0;
    var validChunksTexture = [];
    var notValidChunksTexture = [];
    var validChunksOrigin = [];
    var notValidChunksOrigin = [];
    var that = this;

    the8closestIndexes.forEach(function(index){
      var aTextureData = that.getTextureAtIndex3D(index);

      // this texture data is valid
      if(aTextureData.valid){
        validChunksTexture.push( aTextureData.texture );
        validChunksOrigin.push( aTextureData.origin );
      }
      // is not valid
      else{
        notValidChunksTexture.push( aTextureData.texture );
        notValidChunksOrigin.push( aTextureData.origin );
      }

    });

    validChunksCounter = validChunksTexture.length;

    return {
      textures: validChunksTexture.concat( notValidChunksTexture ),
      origins: validChunksOrigin.concat( notValidChunksOrigin ),
      nbValid: validChunksCounter
    };

  }


  getInvolvedTextureIndexes(cornerPositions){

    var cornerOrigins = [
      this.getIndex3DFromWorldPosition( [cornerPositions[0].x, cornerPositions[0].y, cornerPositions[0].z] ),
      this.getIndex3DFromWorldPosition( [cornerPositions[1].x, cornerPositions[1].y, cornerPositions[1].z] ),
      this.getIndex3DFromWorldPosition( [cornerPositions[2].x, cornerPositions[2].y, cornerPositions[2].z] ),
      this.getIndex3DFromWorldPosition( [cornerPositions[3].x, cornerPositions[3].y, cornerPositions[3].z] )
    ];

    var min = [
      Math.min(cornerOrigins[0][0], cornerOrigins[1][0], cornerOrigins[2][0], cornerOrigins[3][0]),
      Math.min(cornerOrigins[0][1], cornerOrigins[1][1], cornerOrigins[2][1], cornerOrigins[3][1]),
      Math.min(cornerOrigins[0][2], cornerOrigins[1][2], cornerOrigins[2][2], cornerOrigins[3][2])
    ];

    var max = [
      Math.max(cornerOrigins[0][0], cornerOrigins[1][0], cornerOrigins[2][0], cornerOrigins[3][0]),
      Math.max(cornerOrigins[0][1], cornerOrigins[1][1], cornerOrigins[2][1], cornerOrigins[3][1]),
      Math.max(cornerOrigins[0][2], cornerOrigins[1][2], cornerOrigins[2][2], cornerOrigins[3][2])
    ];


    // build the chunk index of the 8 closest chunks from position
    var indexes3D = [
      [
        min[0],
        min[1],
        min[2]
      ],
      [
        min[0],
        min[1],
        max[2]
      ],
      [
        min[0],
        max[1],
        min[2]
      ],
      [
        min[0],
        max[1],
        max[2]
      ],
      [
        max[0],
        min[1],
        min[2]
      ],
      [
        max[0],
        min[1],
        max[2]
      ],
      [
        max[0],
        max[1],
        min[2]
      ],
      [
        max[0],
        max[1],
        max[2]
      ]
    ];

    return indexes3D;

  }


  _getKeyFromIndex3D( index3D ){
    return "x" +  index3D[0] + "y" + index3D[1] + "z" + index3D[2];
  }


  /**
  *
  */
  getInvolvedTextureData(cornerPositions){
    var that = this;

    /*
    console.log("this._sizeChunkWC");
    console.log(this._sizeChunkWC);
    console.log("cornerPositions");
    console.log(cornerPositions);
    */
    this._sizeChunkWC;
    /*
    var chunkEdgeCase = cornerPositions[0].x % this._sizeChunkWC < this._sizeChunkWC/10 && cornerPositions[1].x % this._sizeChunkWC < this._sizeChunkWC/10; ||
        cornerPositions[0].y % this._sizeChunkWC < this._sizeChunkWC/10 && cornerPositions[1].y % this._sizeChunkWC < this._sizeChunkWC/10 ||
        cornerPositions[0].z % this._sizeChunkWC < this._sizeChunkWC/10 && cornerPositions[1].z % this._sizeChunkWC < this._sizeChunkWC/10;
*/



    /*
    var chunkEdgeCase = cornerPositions[0].x == cornerPositions[1].x ||
                        cornerPositions[0].y == cornerPositions[1].y ||
                        cornerPositions[0].z == cornerPositions[1].z;
    */

    var chunkEdgeCaseX = cornerPositions[0].x == cornerPositions[1].x &&
      (cornerPositions[0].x % this._sizeChunkWC < this._sizeChunkWC*0.1 ||   cornerPositions[0].x % this._sizeChunkWC > this._sizeChunkWC*0.9);

    var chunkEdgeCaseY = cornerPositions[0].y == cornerPositions[1].y &&
      (cornerPositions[0].y % this._sizeChunkWC < this._sizeChunkWC*0.1 ||   cornerPositions[0].y % this._sizeChunkWC > this._sizeChunkWC*0.9);

    var chunkEdgeCaseZ = cornerPositions[0].z == cornerPositions[1].z &&
      (cornerPositions[0].z % this._sizeChunkWC < this._sizeChunkWC*0.1 ||   cornerPositions[0].z % this._sizeChunkWC > this._sizeChunkWC*0.9);

    var chunkEdgeCase = chunkEdgeCaseX || chunkEdgeCaseY || chunkEdgeCaseZ;

    if( chunkEdgeCase ){
      //console.log(">> NEAREST8");
      //console.log(cornerPositions);
      //console.log( Math.floor(Date.now()) );


      var center = [
        (cornerPositions[0].x + cornerPositions[1].x + cornerPositions[2].x + cornerPositions[3].x) / 4,
        (cornerPositions[0].y + cornerPositions[1].y + cornerPositions[2].y + cornerPositions[3].y) / 4,
        (cornerPositions[0].z + cornerPositions[1].z + cornerPositions[2].z + cornerPositions[3].z) / 4
      ];

      return this.get8ClosestTextureData( center );
    }else{
      //console.log(">> INVOLVED");
      //console.log(cornerPositions);
      //console.log( Math.floor(Date.now()) );
    }


    var involvedIndexes = this.getInvolvedTextureIndexes(cornerPositions);


    var loadedMaps = {};

    var validChunksCounter = 0;
    var validChunksTexture = [];
    var notValidChunksTexture = [];
    var validChunksOrigin = [];
    var notValidChunksOrigin = [];
    var that = this;

    involvedIndexes.forEach(function(index){
      var aTextureData = that._fakeTextureData;
      var indexKey = that._getKeyFromIndex3D( index );

      // never loaded before
      if(! (indexKey in loadedMaps)){
        loadedMaps[indexKey] = 1;

        // load the texture , possibly retrieving a fake one (out)
        aTextureData = that.getTextureAtIndex3D(index);
      }

      // this texture data is valid
      if(aTextureData.valid){
        validChunksTexture.push( aTextureData.texture );
        validChunksOrigin.push( aTextureData.origin );
      }
      // is not valid
      else{
        notValidChunksTexture.push( aTextureData.texture );
        notValidChunksOrigin.push( aTextureData.origin );
      }

    });

    validChunksCounter = validChunksTexture.length;

    /*
    return {
      textures: validChunksTexture.concat( notValidChunksTexture ),
      origins: validChunksOrigin.concat( notValidChunksOrigin ),
      nbValid: validChunksCounter
    };
    */

    var textureDatas = {
      textures: validChunksTexture.concat( notValidChunksTexture ),
      origins: validChunksOrigin.concat( notValidChunksOrigin ),
      nbValid: validChunksCounter
    };

    return textureDatas;
  }


  /**
  * [PRIVATE]
  * Called when a chunk is loaded or failed to load. When to total number number of toLoad Vs. Loaded+failed is equivalent, a callback may be called (with no argument) if defined by onChunkLoaded().
  * @param {String} chunkID - the id to identify the chunk within the collection
  * @param {Boolean} success - must be true if loaded with success, or false if failed to load.
  */
  _countChunks(chunkID, success){
    this._chunkCounter.loaded += (+ success);
    this._chunkCounter.failled += (+ (!success));

    var remaining = this._chunkCounter.toBeLoaded - this._chunkCounter.loaded - this._chunkCounter.failled;

    // all the required chunks are OR loaded OR failled = they all tried to load.
    if( !remaining ){
      if(this._onAllChunksLoadedCallback){
        this._onAllChunksLoadedCallback();
      }
    }

    // call a callback if defined
    if( this._onChunksLoadedCallback ){
      this._onChunksLoadedCallback(this._resolutionLevel, remaining);
    }
  }


  /**
  * Defines a callback for when all the requested chunks are loaded.
  * This will be called every time we ask for a certain number of chunks and they eventually all have a loading status (success or fail)
  * @param {callback function} cb - function to call with 2 params: the rez lvl, remaining tiles to load
  */
  onChunkLoaded(cb){
    this._onChunksLoadedCallback = cb;
  }


  /**
  * Defines a callback for when all the required tile of the current level are loaded.
  * Called with no argument.
  */
  onAllChunksLoaded( cb ){
    this._onAllChunksLoadedCallback = cb;
  }

} /* END CLASS ChunkCollection */

/**
* The LevelManager is above the {@link ChunkCollection} and contain them all, one for each resolution level. LevelManager also acts like an interface to query chunk data.
*/
class LevelManager{

  /**
  *
  */
  constructor(){

    /**
    * The array of ChunkCollection instances, one per resolution level.
    */
    this._chunkCollections = [];

    /** the directory containing the config file (JSON) and the resolution level folders */
    this._workingDir = "";

    /** The level of resolution, defines which octree to dig into. Is a positive integer.  */
    this._resolutionLevel = 0;


    this.onReadyCallback = null;

    /** Size of the bounding box that wraps the entire dataset */
    this._boundingBox = null;

    /** size of a chunk, considering it's always cubic */
    this._chunkSize = [64, 64, 64]; // will be overwritten using the config file, but it will be 64 anyway.

    this._onConfigErrorCallback = null;

    this._levelsInfo = null;

    this._axisInfo = null;

    this._onChunksLoadedCallback = null;
    this._onAllChunksLoadedCallback = null;
  }


  /**
  * For testing purpose, this is a callback that will be called when the config
  * file will be loaded.
  */
  onReady(cb){
    this.onReadyCallback = cb;
  }


  /**
  * Load the json config file with an XMLHttpRequest.
  * @param {Object} config - {datatype: String, url: String} where datatype is the input data type ("octree_tiles" is the only available for the moment) and url is the URL of the JSON config file.
  */
  loadConfig(config){
    var that = this;
    var filepath = config.url;

    AjaxFileLoader.loadTextFile(
      // file URL
      filepath,

      // success callback
      function(data){
        // the directory of the config file is the working directory
        that._workingDir = filepath.substring(0, Math.max(filepath.lastIndexOf("/"), filepath.lastIndexOf("\\")));

        // Rading the config object
        that._loadConfigDescription(config.datatype , JSON.parse(data));
      },

      // error callback
      function(error){
        console.error("Could not load config file " + filepath);

        // if loading the config file failed, we have a callback for that.
        if(that._onConfigErrorCallback){
          that._onConfigErrorCallback(filepath, 0);
        }
      }
    );

  }


  /**
  * [PRIVATE]
  * Load the config description object, sort its multiple resolution levels
  * so that the poorer goes first and the finer goes last. Then, for each level
  * calls _addChunkCollectionLevel().
  * @param {String} datatype - Type of data, but for now only "octree_tiles" is ok.
  * @param {Object} description - parsed from the JSON decription file.
  */
  _loadConfigDescription(datatype, description){
    var that = this;

    var levels = description.scales;
    this._levelsInfo = description.scales;

    // the description may contain more than one level (= multirez),
    // if so, we sort by resolution so that 0 is the poorest and n is the finest
    if(this._levelsInfo.length > 0){
      this._levelsInfo.sort(function(a,b) {
        if (a.resolution[0] > b.resolution[0]){
          return -1;
        }else {
            return 1;
        }
      });
    }

    this._determineChunkSize(); // most likely 64 for every config anyway

    // Compute the cube _boundingBox, that will give some sense of boundaries to the dataset
    this._computeBoundingBox();

    // the lowest def size (most likely 128) is used in combination with a chunk size (64)
    // to define the proportion of thing in a unit space
    var lowestDefSize = this._levelsInfo[0].size[0];

    // add a chunk collection for each level
    this._levelsInfo.forEach(function(elem, index){
      that._addChunkCollectionLevel(index, elem.size, datatype, lowestDefSize);
    });

    that._axisInfo = description.axisInfo;

    if(this.onReadyCallback){
      this.onReadyCallback();
    }

  }


  /**
  * Get the nth chunk collection
  * @param {Number} n - The index of the requested chunk collection
  * @return {ChunkCollection} the collection, or null if asked a bad index
  */
  getChunkCollection( n ){
    if( n>=0 && n<this._chunkCollections.length){
      return this._chunkCollections[n];
    }else{
      console.warn("ChunkCollection at index " + n + " does not exist.");
      return null;
    }
  }


  /**
  * [PRIVATE]
  * Adds a ChunkCollection instance to this._chunkCollections, corresponding to
  * the resolution level in argument.
  * @param {Number} resolutionLevel - positive integer (or zero)
  * @param {Array} voxelSize - Entire number of voxel to form the whole 3D dataset at this level of resolution. This will be translated into the size of the 3D matrix of chunk (basically divided by 64 and rounded to ceil).
  * @param {String} datatype - Type of data, but for now only "octree_tiles" is ok.
  * @param {Number} lowestDefSize - the size of the lowest resolution level
  */
  _addChunkCollectionLevel(resolutionLevel, voxelSize, datatype, lowestDefSize){
    // translating voxelSize into matrix3DSize
    // aka number of chunks (64x64x64) in each dimension
    var matrix3DSize = [
      Math.ceil( voxelSize[0] / this._chunkSize[0] ),
      Math.ceil( voxelSize[1] / this._chunkSize[1] ),
      Math.ceil( voxelSize[2] / this._chunkSize[2] )
    ];

    // creating a new chunk collection for this specific level
    var chunkCollection = new ChunkCollection(
      resolutionLevel,
      lowestDefSize,
      matrix3DSize,
      this._workingDir,
      datatype
    );

    // dealing with some nested callback (new chunk is loaded)
    if( this._onChunksLoadedCallback ){
      chunkCollection.onChunkLoaded(this._onChunksLoadedCallback);
    }

    // dealing with some nested callback (all chunks are loaded)
    if( this._onAllChunksLoadedCallback ){
      chunkCollection.onAllChunksLoaded(this._onAllChunksLoadedCallback);
    }

    this._chunkCollections.push( chunkCollection );
  }


  onChunkLoaded( cb ){
    this._onChunksLoadedCallback = cb;
  }


  onAllChunksLoaded( cb ){
    this._onAllChunksLoadedCallback = cb;
  }

  /**
  * Change the level of resolution. Boundaries and "integrity" are checked.
  * @param {Number}
  */
  setResolutionLevel(lvl){
    // TODO: here, we may want to trigger some garbage collecting work over the
    // chunks that belongs to the previous lvl.

    // make sure we dont have a float here!
    var intergerLvl = Math.round(lvl);

    // boundaries to the level
    if(intergerLvl >= 0 && intergerLvl < this._chunkCollections.length){
      this._resolutionLevel = intergerLvl;
    }

  }


  /**
  * @return the resolution level currently in use
  */
  getCurrentResolutionLevel(){
    return this._resolutionLevel;
  }


  /**
  * @return the size of the chunks currently in use, in world coord
  */
  getCurrentChunkSizeWc(){
    return this._chunkCollections[ this._resolutionLevel ].getSizeChunkWc();
  }


  getChunkSizeWcByLvl(lvl){
    return this._chunkCollections[ lvl ].getSizeChunkWc();
  }


  /**
  * @param {Array} position - world coord position as an array [x, y, z]
  * @return the texture data of the 8 chunks that are the closest to the position.
  */
  get8ClosestTextureData(position){
    var the8ClosestTextureData = this._chunkCollections[ this._resolutionLevel ]
              .get8ClosestTextureData(position);

    //console.log(this._resolutionLevel + " " + position[0] + " " + position[1] + " " +position[2]);

    return the8ClosestTextureData;
  }


  get8ClosestTextureDataByLvl(position, lvl){
    var the8ClosestTextureData = this._chunkCollections[ lvl ]
              .get8ClosestTextureData(position);

    //console.log(this._resolutionLevel + " " + position[0] + " " + position[1] + " " +position[2]);

    return the8ClosestTextureData;
  }


  getInvolvedTextureDataByLvl(cornerPositions, lvl){
    var involvedTextureData = this._chunkCollections[ lvl ].getInvolvedTextureData(cornerPositions);
    return involvedTextureData;
  }


  /**
  * Reads the chunk size from the config data. No matter the level, the chunk size should be the same, this is why we just take the first one.
  * @param {Object} levels - config data
  */
  _determineChunkSize(){
    this._chunkSize = this._levelsInfo[0].chunk_sizes[0];
  }


  /**
  * The bounding box may be used for different things, like checking inside/outside or simply to show a bounding box with a box.
  * The size data is available at every resolution level, we'll just take the info from the first level (0) since the size remains consistant all along.
  * @param {Object} levels - config data
  */
  _computeBoundingBox(){
    /*
    this._boundingBox = [
      this._levelsInfo[0].size[0] / 64.0,
      this._levelsInfo[0].size[1] / 64.0,
      this._levelsInfo[0].size[2] / 64.0
    ];
    */

    this._boundingBox = [
      1,
      1,
      1
    ];
  }


  /**
  * @returns {Array} a copy of the bounding box size as [xSize, ySize, zSize]
  */
  getBoundingBox(){
    return this._boundingBox.slice();
  }

  /**
  * @return {boolean} true if xyz is within the bounding box. Return false if outside.
  * @param {Number} x - coordinate along x
  * @param {Number} y - coordinate along y
  * @param {Number} z - coordinate along z
  */
  isInside(x, y, z){
    return (x>0 && x<this._boundingBox[0] && y>0 && y<this._boundingBox[1] && z>0 && z<this._boundingBox[2]);
  }


  /**
  * Defines the callback called when the config file was not found/able to load.
  * This callback will be called with 2 args:
  *   {string} The config file url
  *   {Number} The error code (most likely 0 rather than 404. Didn't dig why)
  */
  onConfigError(cb){
    this._onConfigErrorCallback = cb;
  }


  /**
  * Useful to get an info from the tileset config file.
  * @param {Number} levelIndex - the index in the array
  * @param {String} infoKey - One of the following "chunk_sizes", "encoding", "key", "resolution", "size" or "voxel_offset"
  * @return depending on infoKey, the return value can be a String or an Array.
  */
  getLevelInfo(levelIndex, infoKey){
    if( levelIndex>=0 &&
        levelIndex<this._levelsInfo.length &&
        infoKey in this._levelsInfo[levelIndex]){

      return this._levelsInfo[ levelIndex ][ infoKey ];
    }
  }


  /**
  * Get a tag from axisInfo in the configuration file.
  * @param {String} axis - native webGL axis name: "x", "y" or "z"
  * @param {String} tag - info tag. "name", "originalSize", etc.
  * @return {Object} String or Number value of the given axis and tag
  */
  getAxisInfo(axis, tag){
    if(axis in this._axisInfo && tag in this._axisInfo[axis]){
      return this._axisInfo[axis][tag];
    }
  }


  /**
  * Get the whole object for axis info
  * @return {Object}
  */
  getAllAxisInfo(){
    return this._axisInfo;
  }

} /* END CLASS LevelManager */

/**
* A OrientationHelper is a sphere surrounding the orthogonal planes that will show the direction of left/right, posterior/anterior and inferior/superior.
*
*/
class OrientationHelper{

  /**
  *
  */
  constructor( initRadius ){
    this._sphere = new THREE.Object3D();

    var xColor = 0xff3333;
    var yColor = 0x00EB4E;
    var zColor = 0x0088ff;

    this._initRadius = initRadius / 25;

    var geometryX = new THREE.CircleGeometry( this._initRadius, 64 );
    var geometryY = new THREE.CircleGeometry( this._initRadius, 64 );
    var geometryZ = new THREE.CircleGeometry( this._initRadius, 64 );
    var materialX = new THREE.LineBasicMaterial( { color: xColor, linewidth:1.5 } );
    var materialY = new THREE.LineBasicMaterial( { color: yColor, linewidth:1.5 } );
    var materialZ = new THREE.LineBasicMaterial( { color: zColor, linewidth:1.5 } );

    // remove inner vertice
    geometryX.vertices.shift();
    geometryY.vertices.shift();
    geometryZ.vertices.shift();

    // X circle
    var circleX = new THREE.Line( geometryX, materialX );
    circleX.name = "xCircle";
    geometryX.rotateY(Math.PI / 2);
    // Y circle
    var circleY = new THREE.Line( geometryY, materialY );
    circleY.name = "yCircle";
    geometryY.rotateX(-Math.PI / 2);
    // Z circle
    var circleZ = new THREE.Line( geometryZ, materialZ );
    circleZ.name = "zCircle";

    this._sphere = new THREE.Object3D();
    this._sphere.add(circleX);
    this._sphere.add(circleY);
    this._sphere.add(circleZ);

    // adding central lines
    var xLineGeometry = new THREE.Geometry();
    xLineGeometry.vertices.push(
    	new THREE.Vector3( -this._initRadius, 0, 0 ),
    	new THREE.Vector3( this._initRadius, 0, 0 )
    );

    var xLine = new THREE.Line(
      xLineGeometry,
      new THREE.LineBasicMaterial({	color: xColor, linewidth:1.5 })
    );

    var yLineGeometry = new THREE.Geometry();
    yLineGeometry.vertices.push(
    	new THREE.Vector3(0, -this._initRadius, 0 ),
    	new THREE.Vector3(0,  this._initRadius, 0 )
    );

    var yLine = new THREE.Line(
      yLineGeometry,
      new THREE.LineBasicMaterial({	color: yColor, linewidth:1.5 })
    );

    var zLineGeometry = new THREE.Geometry();
    zLineGeometry.vertices.push(
    	new THREE.Vector3(0, 0, -this._initRadius ),
    	new THREE.Vector3(0, 0,  this._initRadius )
    );

    var zLine = new THREE.Line(
      zLineGeometry,
      new THREE.LineBasicMaterial({	color: zColor, linewidth:1.5 })
    );

    this._sphere.add( xLine );
    this._sphere.add( yLine );
    this._sphere.add( zLine );


    // adding sprites with labels
    var textureLoader = new THREE.TextureLoader();
    var leftTex = textureLoader.load( "textures/left.png" );
    var rightTex = textureLoader.load( "textures/right.png" );
    var antTex = textureLoader.load( "textures/anterior.png" );
    var postTex = textureLoader.load( "textures/posterior.png" );
    var supTex = textureLoader.load( "textures/superior.png" );
    var infTex = textureLoader.load( "textures/inferior.png" );

    var leftSprite = new THREE.Sprite( new THREE.SpriteMaterial( { map: leftTex} ) );
    var rightSprite = new THREE.Sprite( new THREE.SpriteMaterial( { map: rightTex} ) );
    var antSprite = new THREE.Sprite( new THREE.SpriteMaterial( { map: antTex} ) );
    var postSprite = new THREE.Sprite( new THREE.SpriteMaterial( { map: postTex} ) );
    var supSprite = new THREE.Sprite( new THREE.SpriteMaterial( { map: supTex} ) );
    var infSprite = new THREE.Sprite( new THREE.SpriteMaterial( { map: infTex} ) );

    var distanceFromCenter = this._initRadius * 1.4;
    
    var spriteScale = 0.5;
    leftSprite.scale.set(spriteScale, spriteScale, spriteScale);
    rightSprite.scale.set(spriteScale, spriteScale, spriteScale);
    antSprite.scale.set(spriteScale, spriteScale, spriteScale);
    postSprite.scale.set(spriteScale, spriteScale, spriteScale);
    supSprite.scale.set(spriteScale, spriteScale, spriteScale);
    infSprite.scale.set(spriteScale, spriteScale, spriteScale);
    
    leftSprite.position.set( distanceFromCenter, 0, 0 );
    rightSprite.position.set( -distanceFromCenter, 0, 0 );
    antSprite.position.set(0, distanceFromCenter, 0 );
    postSprite.position.set(0, -distanceFromCenter, 0 );
    supSprite.position.set(0, 0, -distanceFromCenter );
    infSprite.position.set(0, 0, distanceFromCenter );

    this._sphere.add(leftSprite);
    this._sphere.add(rightSprite);
    this._sphere.add(antSprite);
    this._sphere.add(postSprite);
    this._sphere.add(supSprite);
    this._sphere.add(infSprite);

    this._sphere.children.forEach( function(child){
      child.layers.enable( 0 );
      child.layers.enable( 1 );
    });

  }


  /**
  * Add the local helper mesh to obj.
  * @param {THREE.Object3D} obj - container object to add the local helper.
  */
  addTo( obj ){
    obj.add( this._sphere );
  }


  /**
  * Rescale the helper with a given factor.
  * @param {Number} f - a scaling factor, most likely within [0, 1]
  */
  rescale( f ){
    this._sphere.scale.x = f;
    this._sphere.scale.y = f;
    this._sphere.scale.z = f;
  }


  /**
  * Resize the helper depending on the resolution level
  */
  rescaleFromResolutionLvl( lvl ){
    var scale = 1 / Math.pow( 2, lvl );
    this._sphere.scale.x = scale;
    this._sphere.scale.y = scale;
    this._sphere.scale.z = scale;
  }

  /**
  * Set the position of the orientation helper.
  * @param {THREE.Vector3} vPos - The position as a vector to clone.
  */
  setPosition( vPos ){
    this._sphere.position.x = vPos.x;
    this._sphere.position.y = vPos.y;
    this._sphere.position.z = vPos.z;
  }

  /**
  * Show the helper if hidden, hide it if shown.
  */
  toggle(){
    this._sphere.visible = !this._sphere.visible;
  }


  /**
  * Set the visibility of the orientation Helpers
  * @param {Boolean} b - true to show, false to hide
  */
  setVisibility( b ){
    this._sphere.visible = b;
  }


  /**
  * @return {Number} the actual radius of orientation helper, considering the ajustment to
  * resolution level.
  */
  getRadius(){
    return (this._initRadius * this._sphere.scale.x);
  }


} /* END class OrientationHelper */

/**
* A QuadViewInteraction instance knows all the QuadView instance (aggregated in an array) and deals with all the interaction/controller side that a QuadView may need. This includes mouse/keyboard interaction on each view (independently) and possibly orbit/trackball control for QuadViews which enabled it.
*
*/
class QuadViewInteraction{

  /**
  * Build the QuadViewInteraction instance. Requires a list of QuadView instances.
  * @param {Array of QuadView} QuadViewArray - an array of QuadView.
  * @param {String} domContainerID - ID of the container
  */
  constructor(QuadViewArray, domContainerID="container"){
    this._quadViews = QuadViewArray;

    this._windowSize = {
      width: window.innerWidth ,
      height: window.innerHeight
    };

    this._domContainer = document.getElementById(domContainerID);

    // updated at every mousemove event by the QuadScene
    this._mouse = {x:0, y:0};

    this._mouseLastPosition = {x:-1, y:-1};

    // distance traveled by the mouse, most likely between 2 mousemouve event
    this._mouseDistance = {x:0, y:0};

    // index of the quadview the mouse currently is
    this._indexCurrentView = -1;

    // index of the view the mouse was pressed
    this._indexViewMouseDown = -1;

    // updated by the mousedown/mouseup
    this._mousePressed = false;

    this._rKeyPressed = false;
    this._tKeyPressed = false;
    this._shiftKeyPressed = false;

    // declaring mouse events
    // (on a specific div to prevent conflict with ControlKit)
    this._domContainer.addEventListener( 'mousemove', this._onMouseMove.bind(this), false );
    this._domContainer.addEventListener( 'mousedown', this._onMouseDown.bind(this), false );
    this._domContainer.addEventListener( 'mouseup', this._onMouseUp.bind(this), false );

    // declaring keyboard events
    // (on document, otherwise it does not work)
    //document.addEventListener( 'keydown', this._onKeyDown.bind(this), false);
    //document.addEventListener( 'keyup', this._onKeyUp.bind(this), false);

    this._domContainer.addEventListener( 'keydown', this._onKeyDown.bind(this), false);
    this._domContainer.addEventListener( 'keyup', this._onKeyUp.bind(this), false);

    // function to be called when the mouse is pressed on a view for translation - no R key pressed
    this._onGrabViewTranslateCallback = null;

    // function to be called when the mouse is pressed on a view for rotation - with R key pressed
    this._onGrabViewRotateCallback = null;

    // function called when user maintains click + T and moves mouse
    this._onGrabViewTransverseRotateCallback = null;

    // function called when user scrolls
    this._onScrollViewCallback = null;

    // function to call when the arrow up (keyboard) is down
    this._onArrowUpCallback = null;

    // function to call when the arrow down (keyboard) is down
    this._onArrowDownCallback = null;

    this._onDonePlayingCallback = null;

    // (aggregation) container of planes
    this._multiplaneContainer = null;

    // to intersect with the multplane container
    this._raycaster = new THREE.Raycaster();

    this._onClickPlaneCallback = {
      perspective: null,
      ortho: null
    };
  }


  /**
  * Because we dont want to be querying window.innerWidth and window.innerHeight all the time.
  * This is supposed to be called by a QuadScene, at the same moment we update the window size for the renderer.
  * @param {Number} w - width of the window in pixel, most likely window.innerWidth
  * @param {Number} h - height of the window in pixel, most likely window.innerHeight
  */
  updateWindowSize(w, h){
    this._windowSize.width = w;
    this._windowSize.height = h;

    this._quadViews.forEach(function(qv){
      qv.updateRatio();
    });
  }


  /**
  * Updates the position of the mouse pointer with x and y in [0, 1] with origin at the bottom left corner.
  * Updating the mouse position may trigger some events like orbit/trackball control activation
  */
  _onMouseMove( event ) {
    this._mouse.x = (event.clientX / this._windowSize.width);
    this._mouse.y = 1 - (event.clientY / this._windowSize.height);
    this._manageQuadViewsMouseActivity();

    // mouse pressed + moving
    if(this._mousePressed){

      // distance from the last update
      this._mouseDistance.x = (this._mouse.x - this._mouseLastPosition.x)*this._windowSize.width / 100;
      this._mouseDistance.y = (this._mouse.y - this._mouseLastPosition.y)*this._windowSize.height / 100;

      // + R key down --> rotation
      if(this._rKeyPressed){
        var center = {
          x: (this._indexViewMouseDown%2)*0.5 + 0.25,
          y: (this._indexViewMouseDown>1?0:1)*0.5 +0.25,
        };

        var centerToPrevious = new THREE.Vector3(
          this._mouseLastPosition.x - center.x,
          this._mouseLastPosition.y - center.y,
          this._mouseLastPosition.z - center.z
        ).normalize();

        var centerToCurrent = new THREE.Vector3(
          this._mouse.x - center.x,
          this._mouse.y - center.y,
          this._mouse.z - center.z
        ).normalize();

        // the rotation angle (unsigned)
        var angleRad = Math.acos( centerToPrevious.dot(centerToCurrent) );

        // the rotation direction depends on the normal of the angle
        var angleDirection = Math.sign( centerToPrevious.cross(centerToCurrent).z );

        // call the callback for this kind of interaction
        if(this._onGrabViewRotateCallback){
          this._onGrabViewRotateCallback(angleRad, angleDirection, this._indexViewMouseDown);
        }

      }

      // + T key down --> tranverse rotation
      else if(this._tKeyPressed){

        if(this._onGrabViewTransverseRotateCallback){
          this._onGrabViewTransverseRotateCallback(this._mouseDistance, this._indexViewMouseDown);
        }
      }

      // + NO key down --> translation
      else{
        if(this._onGrabViewTranslateCallback){
          this._onGrabViewTranslateCallback(this._mouseDistance, this._indexViewMouseDown);
        }
      }

      // update the last position
      this._mouseLastPosition.x = this._mouse.x;
      this._mouseLastPosition.y = this._mouse.y;

    } /* END  */

  }


  /**
  * [PRIVATE]
  * callback to the mousedown event
  */
  _onMouseDown( event ){
    this._mousePressed = true;
    this._indexViewMouseDown = this._indexCurrentView;


    // Shift + click on the perspective cam =
    if( this._shiftKeyPressed ){
      //console.log(this._mouse);

      this._intersectMultiplane( event );

    }


    // will be used as an init position
    this._mouseLastPosition.x = this._mouse.x;
    this._mouseLastPosition.y = this._mouse.y;
  }


  /**
  * [PRIVATE]
  * callback to the mouseup event
  */
  _onMouseUp( event ){
    this._mousePressed = false;
    this._indexViewMouseDown = -1;

    this._mouseDistance.x = 0;
    this._mouseDistance.y = 0;

    if(this._onDonePlayingCallback){
      this._onDonePlayingCallback();
    }
  }


  /**
  * [PRIVATE]
  * Callback to the event onkeydown, aka. when a keyboard key is pressed
  */
  _onKeyDown( event ){

    switch( event.key ){
      case "r":
        this._rKeyPressed = true;
        break;
      case "t":
        this._tKeyPressed = true;
        break;

      case "Shift":
        this._shiftKeyPressed = true;
        break;

      case "ArrowDown":
        if(this._onArrowDownCallback){
          this._onArrowDownCallback(this._indexCurrentView);
        }
        break;

      case "ArrowUp":
        if(this._onArrowUpCallback){
          this._onArrowUpCallback(this._indexCurrentView);
        }
        break;

      default:;
    }
  }


  /**
  * [PRIVATE]
  * Callback to the event onkeyup, aka. when a keyboard key is released
  */
  _onKeyUp( event ){
    switch( event.key ){
      case "r":
        this._rKeyPressed = false;
        break;
      case "t":
        this._tKeyPressed = false;
        break;
      case "Shift":
        this._shiftKeyPressed = false;
        break;

      default:;
    }

    if(this._onDonePlayingCallback){
      this._onDonePlayingCallback();
    }
  }


  /**
  * [PRIVATE]
  * For each QuadView instance, trigger things depending on how the mouse pointer interact with a quadview.
  */
  _manageQuadViewsMouseActivity(){
    var that = this;
    var x = this._mouse.x;
    var y = this._mouse.y;

    this._quadViews.forEach(function(qv, index){

      // the pointer is within the QuadView window
      if(qv.isInViewWindow(x, y)){

        that._indexCurrentView = index;

        // even though this quadview may not have any controller
        qv.enableControl();
      }
      // the pointer is outside the QuadView window
      else{

        // even though this quadview may not have any controller
        qv.disableControl();
      }

    });
  }


  /**
  * Callback when one of the QuadView is grabed.
  * The callback will be called with 2 arguments:
  *   {Object} distance {x:, y: } - the distance along x and y in normalized space
  *   {Number} QuadView index
  */
  onGrabViewTranslate(cb){
    this._onGrabViewTranslateCallback = cb;
  }


  /**
  * Defines the callback called when click on a view holding
  * the R keyboard key and move the mouse.
  * It performs a rotation around the normal vector of the current view/plane.
  * The callback is called with 2 arguments:
  *   {Number} angle in radian
  *   {Number} direction, is 1-always +1 or -1
  *   {Number} QuadView index
  */
  onGrabViewRotate(cb){
    this._onGrabViewRotateCallback = cb;
  }


  /**
  * Defines the callback called when click on a view holding the T keyboard key
  * and move the mouse.
  * It performs a transverse rotation.
  *   {Object} distance {x:, y: } - the distance along x and y in normalized space
  *   {Number} QuadView index
  */
  onGrabViewTransverseRotate(cb){
    this._onGrabViewTransverseRotateCallback = cb;
  }


  /**
  * Defines the callback for when the arrow_down keyboard key is down.
  * Usually for travelling along the normal of the plane/view.
  * Called with 1 argument:
  *   {Number} QuadView index
  */
  onArrowDown(cb){
    this._onArrowDownCallback = cb;
  }


  /**
  * Defines the callback for when the arrow_up keyboard key is down.
  * Usually for travelling along the normal of the plane/view.
  * Called with 1 argument:
  *   {Number} QuadView index
  */
  onArrowUp(cb){
    this._onArrowUpCallback = cb;
  }


  /**
  * Callback called when a key of a mouse button is released
  */
  onDonePlaying( cb ){
    this._onDonePlayingCallback = cb;
  }


  /**
  * Set the plane container, so that we can perform raycasting
  */
  setMultiplaneContainer( c ){
    this._multiplaneContainer = c;
  }


  /**
  * [PRIVATE]
  * perform a raycaster intersection from the perspective camera to the multiplane
  * container.
  * If impact, call a callback with the point coordinates.
  */
  _intersectMultiplane( ){

    // size ratio to the whole window
    var viewWidth = this._quadViews[this._indexViewMouseDown].getConfigParam("width");
    var widthRatio = 1 / viewWidth;
    var viewHeight = this._quadViews[this._indexViewMouseDown].getConfigParam("height");
    var heightRatio = 1 / viewHeight;

    var widthOffset = this._quadViews[this._indexViewMouseDown].getConfigParam("left");
    var heightOffset = this._quadViews[this._indexViewMouseDown].getConfigParam("bottom");

    // these coords are centered on the current view and are within [-1, 1]
    var localCenteredMouse = new THREE.Vector2(
      (this._mouse.x * widthRatio - widthOffset*widthRatio) * 2 - 1,
      (this._mouse.y * heightRatio - heightOffset*heightRatio) * 2 - 1
    );

    this._raycaster.setFromCamera(
      localCenteredMouse,
      this._quadViews[this._indexViewMouseDown].getCamera()
    );

    var intersects = this._raycaster.intersectObject( this._multiplaneContainer, true );

    if(intersects.length ){
      if(this._quadViews[this._indexViewMouseDown].isPerspective()){
        // a callback for persp cam
        this._onClickPlaneCallback.perspective && this._onClickPlaneCallback.perspective( intersects[0].point );
      }else{
        // a callback for ortho cam
        this._onClickPlaneCallback.ortho && this._onClickPlaneCallback.ortho( intersects[0].point );
      }
    }


  }


  /**
  * Defines a callback for shift+clicking on a plane, depending on the camera type.
  * @param {String} - camera type is "ortho" or "perspective"
  * @param {Function} callback - is the method to be called
  */
  onClickPlane( cameraType, callback ){

    if( !(cameraType in this._onClickPlaneCallback) ){
      console.warn('The camera type must be "perspective" or "ortho".');
      return;
    }

    this._onClickPlaneCallback[ cameraType ] = callback;
  }
  

} /* END class QuadViewInteraction */

/**
* An instance of ColorMapManager is used to load color maps and retrive them.
* A certain amount of default color maps is available but curtom maps can also be added.
* Each texture is stored as a THREE.Texture and are loaded with THREE.TextureLoader.
*/
class ColorMapManager{

  /**
  * Loads the default colormaps.
  */
  constructor( ){
    // default folder where the default colormaps are stored
    this._defaultMapFolder = "";

    // the ones from the json config file
    this._colormapsToLoad = [];

    this._colormapSuccessCounter = 0;

    // map of colormaps. The keys are colormap file (no extension) and the objects are THREE.Texture
    this._colorMaps = {};

    this._onColormapUpdateCallback = null;

    // The current color map is defined by a name/id and a THREE.Texture
    this._currentColormap = {id: "none", colormap: null};

    // False to if we decide to use a colormap, true to use a colormap
    this._isEnabled = false;

    // single object to load all the textures
    this._textureLoader = new THREE.TextureLoader();

    this._colorMaps["none"] = null;

  }


  /**
  * Load a new colormap from a file and add it to the list.
  * @param {String} filename - url or the colormap file.
  * @param {bool} setCurrent - true to use this one as default, false not to.
  */
  _loadColormap(filename, setCurrent=true){
    var that = this;

    // get the basename (no extension)
    var basename = new String(filename).substring(filename.lastIndexOf('/') + 1);
    if(basename.lastIndexOf(".") != -1)
        basename = basename.substring(0, basename.lastIndexOf("."));

    this._textureLoader.load(
      filename,

      // success
      function ( texture ) {
        that._colormapSuccessCounter ++;

        // add to the map of colormaps
        that._colorMaps[basename] = texture;

        if(setCurrent){
          // make it the current in use
          that._currentColormap.id = basename;
          that._currentColormap.colormap = texture;
        }

        if(that._colormapSuccessCounter == that._colormapsToLoad.length ){
          that._onColormapUpdateCallback && that._onColormapUpdateCallback();
        }

      },

      // Function called when download progresses
      function ( xhr ) {
        //console.log( (xhr.loaded / xhr.total * 100) + '% loaded' );
      },

      // Function called when download errors
      function ( xhr ) {
        console.error( 'Failed to load ' + filename );
      }

    );

  }


  /**
  * Load colormaps from a config file
  * @param {String} config - the url to the config file for color maps
  */
  loadCollection( config ){
    var that = this;
    var jsonFilename = config.url;

    AjaxFileLoader.loadTextFile(
      jsonFilename,

      // success in loading the json file
      function( fileContent ){
        that._defaultMapFolder = jsonFilename.substring(0, Math.max(jsonFilename.lastIndexOf("/"), jsonFilename.lastIndexOf("\\"))) + "/";

        that._colormapsToLoad = JSON.parse(fileContent);

        // load each colormap
        that._colormapsToLoad.forEach( function(colormapFilename){
          that._loadColormap(
            that._defaultMapFolder + colormapFilename,
            false
          );
        });
      },

      function(){
        console.warn("Unable to load the colormap list file ( " + jsonFilename + " ).");
      }
    );
  }


  /**
  * @return the colormap that is currently in use as an object {id, colormap}
  */
  getCurrentColorMap(){
    return this._currentColormap;
  }


  /**
  * @returns true if a colormap is supposed to be used, returns false if not
  */
  isColormappingEnabled(){
    return this._isEnabled;
  }


  /**
  * Activates color mapping. If no colormap has ever been explicitly mentioned as "in use", then the first of the default colormaps is the one to go with.
  */
  enableColorMapping(){
    this._isEnabled = true;
  }


  disableColorMapping(){
    this._isEnabled = false;
  }


  /**
  * @returns a list of available colormaps IDs.
  */
  getAvailableColormaps(){
    return Object.keys( this._colorMaps );
  }


  /**
  * Enable a colormap by a given ID.
  * @param {String} id - the colormap ID must be valid.
  * @return true if success, return false if fail
  */
  useColormap(id){

    if(this._colorMaps.hasOwnProperty(id)){
      this._currentColormap.id = id;
      this._currentColormap.colormap = this._colorMaps[id];

      if(id == "none"){
        this.disableColorMapping();
      }else{

        // we considere that enabling a specific texture comes with
        // enabling the colormapping
        this.enableColorMapping();
      }
      return true;
    }
    return false;
  }


  onColormapUpdate(cb){
    this._onColormapUpdateCallback = cb;
  }


} /* END class ColorMapManager */

var texture3d_frag = "\nconst int maxNbChunks = 8;\nconst float numberOfImagePerStripY = 64.0;\nconst float numberOfPixelPerSide = 64.0;\nuniform int nbChunks;\nuniform sampler2D textures[maxNbChunks];\nuniform vec3 textureOrigins[maxNbChunks];\nuniform sampler2D colorMap;\nuniform bool useColorMap;\nuniform float chunkSize;\nvarying  vec4 worldCoord;\nvarying  vec2 vUv;\nbool isNan(float val)\n{\n  return (val <= 0.0 || 0.0 <= val) ? false : true;\n}\nbool isInsideChunk(in vec3 chunkPosition){\n  return  ( chunkPosition.x>=0.0 && chunkPosition.x<1.0 &&\n            chunkPosition.y>=0.0 && chunkPosition.y<1.0 &&\n            chunkPosition.z>=0.0 && chunkPosition.z<1.0 );\n}\nvec4 getColorFrom3DTexture(in sampler2D texture, in vec3 chunkPosition){\n  float yOffsetNormalized = float(int(chunkPosition.z * numberOfImagePerStripY)) / numberOfImagePerStripY ;\n  float stripX = chunkPosition.x;  float stripY = chunkPosition.y / numberOfImagePerStripY + yOffsetNormalized;\n  vec2 posWithinStrip = vec2(stripX, stripY);\n  return texture2D(texture, posWithinStrip);\n}\nvec3 worldCoord2ChunkCoord(vec4 world, vec3 textureOrigin){\n  return vec3(  (world.x - textureOrigin.x)/chunkSize,\n                 1.0 - (world.y - textureOrigin.y )/chunkSize,\n                 1.0 - (world.z - textureOrigin.z )/chunkSize);\n}\nvoid main( void ) {\n  if(nbChunks == 0){\n    discard;\n    return;\n  }\n  vec2 shaderPos = vUv;\n  if(shaderPos.x < 0.01 || shaderPos.x > 0.99 || shaderPos.y < 0.01 || shaderPos.y > 0.99){\n    gl_FragColor  = vec4(0.0, 0.0 , 0.0, 1.0);\n    return;\n  }\n  vec4 color = vec4(1.0, 0.0 , 0.0, 1.0);\n  vec4 color2 = vec4(1.0, 0.0 , 0.0, 1.0);\n  vec3 chunkPosition;\n  bool hasColorFromChunk = false;\n  int selectedChunk = -1;\n  for(int i=0; i<maxNbChunks; i++)\n  {\n    if( i == nbChunks ){\n      break;\n    }\n    chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[i]);\n    if( isInsideChunk(chunkPosition) ){\n      color = getColorFrom3DTexture(textures[i], chunkPosition);\n      hasColorFromChunk = true;\n      selectedChunk = i;\n      break;\n    }\n  }\n  if( hasColorFromChunk ){\n    gl_FragColor = color;\n  }else{\n    gl_FragColor = vec4(1.0, 0.0 , 1.0, 1.0);\n  }\n  return ;\n  chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[0]);\n  if( isInsideChunk(chunkPosition) ){\n    color2 = getColorFrom3DTexture(textures[0], chunkPosition);\n    hasColorFromChunk = true;\n  } else if(nbChunks >= 2){\n    chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[1]);\n    if( isInsideChunk(chunkPosition) ){\n      color2 = getColorFrom3DTexture(textures[1], chunkPosition);\n      hasColorFromChunk = true;\n    } else if(nbChunks >= 3){\n      chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[2]);\n      if( isInsideChunk(chunkPosition) ){\n        color2 = getColorFrom3DTexture(textures[2], chunkPosition);\n        hasColorFromChunk = true;\n      } else if(nbChunks >= 4){\n        chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[3]);\n        if( isInsideChunk(chunkPosition) ){\n          color2 = getColorFrom3DTexture(textures[3], chunkPosition);\n          hasColorFromChunk = true;\n        } else if(nbChunks >= 5){\n          chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[4]);\n          if( isInsideChunk(chunkPosition) ){\n            color2 = getColorFrom3DTexture(textures[4], chunkPosition);\n            hasColorFromChunk = true;\n          } else if(nbChunks >= 6){\n            chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[5]);\n            if( isInsideChunk(chunkPosition) ){\n              color2 = getColorFrom3DTexture(textures[5], chunkPosition);\n              hasColorFromChunk = true;\n            } else if(nbChunks >= 7){\n              chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[6]);\n              if( isInsideChunk(chunkPosition) ){\n                color2 = getColorFrom3DTexture(textures[6], chunkPosition);\n                hasColorFromChunk = true;\n              } else if(nbChunks == 8){\n                chunkPosition = worldCoord2ChunkCoord(worldCoord, textureOrigins[7]);\n                if( isInsideChunk(chunkPosition) ){\n                  color2 = getColorFrom3DTexture(textures[7], chunkPosition);\n                  hasColorFromChunk = true;\n                }\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n  if(hasColorFromChunk){\n    if(useColorMap){\n      vec2 colorToPosition = vec2(color.r, 0.5);\n      vec4 colorFromColorMap = texture2D(colorMap, colorToPosition);\n      if(colorFromColorMap.a > 0.0){\n        colorFromColorMap.a = 0.85;\n        gl_FragColor = colorFromColorMap;\n      }else{\n        discard;\n      }\n    }else{\n      gl_FragColor = color2;\n    }\n  }else{\n    gl_FragColor = vec4(1.0, 0.0 , 1.0, 1.0);\n  }\n}\n";

var texture3d_vert = "\nvarying  vec2 vUv;\nvarying  vec4 worldCoord;\nvoid main()\n{\n  vUv = uv;\n  vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );\n  gl_Position = projectionMatrix * mvPosition;\n  worldCoord = modelMatrix * vec4( position, 1.0 );\n}\n";

var ShaderImporter = {
	texture3d_frag: texture3d_frag,
  texture3d_vert: texture3d_vert 
};

/**
* A ProjectionPlane instance is a portion of a 3D plane, defined as a rectangular surface. It is subdivided in a certain amount of sub-planes that are square-shaped. Each sub-plane is the size of half a texture chunk of the current resolution level.
* Example: if a texture chunk at level 3 is of size 1/8 x 1/8 x 1/8 in world coordinates, the csub-planes will be 1/16 x 1/16.
* This ensure that we dont have to many texture (Sampler2D) to send the the fragment shader of each sub-planes because, even in critical cases, a sub-plane of this size wont intersect more than 8 texture chunks.
*
*/
class ProjectionPlane{

  /**
  * @param {Number} chunkSize - The size of a texture chunk at the current level of resolution (in world coordinates)
  *
  */
  constructor( chunkSize, colormapManager ){
    var that = this;

    this._plane = new THREE.Object3D();
    this._plane.name = "projection plane";

    this._subPlaneSize = chunkSize / Math.sqrt(2);

    // relative position of each corner each subplane
    this._subPlaneCorners = [
      new THREE.Vector3(-1 * this._subPlaneSize/2, this._subPlaneSize/2, 0),  // NW
      new THREE.Vector3(this._subPlaneSize/2, this._subPlaneSize/2, 0),  // NE
      new THREE.Vector3(-1 * this._subPlaneSize/2, -1 * this._subPlaneSize/2, 0),  // SW
      new THREE.Vector3( this._subPlaneSize/2, -1 * this._subPlaneSize/2, 0),  // SE
    ];

    // one shader material per sub-plane
    this._shaderMaterials = [];

    // number of rows and cols of sub-planes to compose the _plane

    this._subPlaneDim = {row: 7, col: 15}; // OPTIM
    //this._subPlaneDim = {row: 10, col: 20}; // TEST
    //this._subPlaneDim = {row: 6, col: 13}; // TEST
    //this._subPlaneDim = {row: 1, col: 1};

    // to be aggregated
    this._colormapManager = colormapManager;

    // given by aggregation
    this._levelManager = null;

    this._resolutionLevel = 0;

    this._buildSubPlanes();
  }


  /**
  * @return {Number} resolution level for this plane
  */
  getResolutionLevel(){
    return this._resolutionLevel;
  }

  /**
  * Build all the subplanes with fake textures and fake origins. The purpose is just to create a compatible data structure able to receive relevant texture data when time comes.
  */
  _buildSubPlanes(){
    var that = this;

    var subPlaneGeometry = new THREE.PlaneBufferGeometry( this._subPlaneSize, this._subPlaneSize, 1 );

    // a fake texture is a texture used instead of a real one, just because
    // we have to send something to the shader even if we dont have data
    var fakeTexture = new THREE.DataTexture(
        new Uint8Array(1),
        1,
        1,
        THREE.LuminanceFormat,  // format, luminance is for 1-band image
        THREE.UnsignedByteType  // type for our Uint8Array
      );

    var fakeOrigin = new THREE.Vector3(0, 0, 0);

    var subPlaneMaterial_original = new THREE.ShaderMaterial( {
      uniforms: {
        // the textures
        nbChunks: {
          type: "i",
          value: 0
        },
        textures: {
          type: "t",
          value: [  fakeTexture, fakeTexture, fakeTexture, fakeTexture,
                    fakeTexture, fakeTexture, fakeTexture, fakeTexture]
        },
        // the texture origins (in the same order)
        textureOrigins: {
          type: "v3v",
          value: [  fakeOrigin, fakeOrigin, fakeOrigin, fakeOrigin,
                    fakeOrigin, fakeOrigin, fakeOrigin, fakeOrigin]
        },
        chunkSize : {
          type: "f",
          value: 1
        },
        colorMap : {
          type: "t",
          value: that._colormapManager.getCurrentColorMap().colormap
        },
        useColorMap : {
          type: "b",
          value: that._colormapManager.isColormappingEnabled()
        }
      }
      ,
      vertexShader: ShaderImporter.texture3d_vert,
      fragmentShader: ShaderImporter.texture3d_frag,
      side: THREE.DoubleSide,
      transparent: true
    });

    for(var j=0; j<this._subPlaneDim.row; j++){
      for(var i=0; i<this._subPlaneDim.col; i++){
        var subPlaneMaterial = subPlaneMaterial_original.clone();
        var mesh = new THREE.Mesh( subPlaneGeometry, subPlaneMaterial );

        mesh.position.set(
          this._subPlaneSize * (-0.5*this._subPlaneDim.col + i + 0.5),
          this._subPlaneSize * (-0.5*this._subPlaneDim.row + j + 0.5),
          0.0
        );

        this._plane.add( mesh );
        this._shaderMaterials.push( subPlaneMaterial );
      }
    }

  }


  /**
  * Defines the level manager so that the texture chunks can be fetched for each sub-plane.
  * @param {LevelManager} lm - the level manager
  */
  setLevelManager(lm){
    this._levelManager = lm;
  }


  /**
  * Debugging. Chanfe the color of the mesh of the plane, bit first, the plane material has to be set as a mesh.
  */
  setMeshColor(c){
    this._plane.children[0].material.color = c;
  }


  /**
  * fetch each texture info, build a uniform and
  */
  updateUniforms_NEAREST8(){
    var nbSubPlanes = this._subPlaneDim.row * this._subPlaneDim.col;
    var textureData = 0;

    for(var i=0; i<nbSubPlanes; i++){
      // center of the sub-plane in world coordinates
      var center = this._plane.children[i].localToWorld(new THREE.Vector3(0, 0, 0));



      textureData = this._levelManager.get8ClosestTextureDataByLvl(
        [center.x, center.y, center.z],
        this._resolutionLevel
      );

      this._updateSubPlaneUniform(i, textureData);
    }

  }


  /**
  * Like updateUniforms but instead of using the 8 closest, it uses only the ones
  * that are involved.
  */
  updateUniforms(){
    var nbSubPlanes = this._subPlaneDim.row * this._subPlaneDim.col;
    var textureData = 0;

    //console.log(this._subPlaneCorners);

    for(var i=0; i<nbSubPlanes; i++){
      // corners of the sub-plane in world coordinates
      var corners = [
        this._plane.children[i].localToWorld( this._subPlaneCorners[0].clone() ), // NW
        this._plane.children[i].localToWorld( this._subPlaneCorners[1].clone() ), // NE
        this._plane.children[i].localToWorld( this._subPlaneCorners[2].clone() ), // SW
        this._plane.children[i].localToWorld( this._subPlaneCorners[3].clone() )  // SE
      ];

      //console.log(corners);

      textureData = this._levelManager.getInvolvedTextureDataByLvl(
        corners,
        this._resolutionLevel
      );



      this._updateSubPlaneUniform(i, textureData);
    }

  }


  printSubPlaneCenterWorld(){
    var nbSubPlanes = this._subPlaneDim.row * this._subPlaneDim.col;
    for(var i=0; i<nbSubPlanes; i++){
      // center of the sub-plane in world coordinates
      var center = this._plane.children[i].localToWorld(new THREE.Vector3(0, 0, 0));
    }
  }


  /**
  * [PRIVATE]
  * Update the uniform of a specific sub-plane using the texture data. This will automatically update the related fragment shader.
  * @param {Number} i - index of the subplane to update.
  * @param {Object} textureData - texture data as created by LevelManager.get8ClosestTextureData()
  */
  _updateSubPlaneUniform(i, textureData){
    var uniforms = this._shaderMaterials[i].uniforms;

    //cube.material.map.needsUpdate = true;
    this._shaderMaterials[i].needsUpdate = true;
    this._shaderMaterials[i]._needsUpdate = true;

    // update colormap no  matter what
    uniforms.useColorMap.value = this._colormapManager.isColormappingEnabled();
    uniforms.colorMap.value = this._colormapManager.getCurrentColorMap().colormap;

    var mustUpdate = true;

    /*
    console.log( uniforms.textures.value );
    console.log( textureData.nbValid );
    console.log("---------------------------------");
    */

    for(i=0; i<textureData.nbValid; i++){
      if(!textureData.textures[i]){
        mustUpdate = false;
        break;
      }
    }

    if( mustUpdate ){
      //console.log("UP");
      var chunkSizeWC = this._levelManager.getChunkSizeWcByLvl( this._resolutionLevel );
      uniforms.nbChunks.value = textureData.nbValid;
      uniforms.textures.value = textureData.textures.slice(0, textureData.nbValid);
      uniforms.textureOrigins.value = textureData.origins;
      uniforms.chunkSize.value = chunkSizeWC;

    }

    /*
    // this does not change a damn thing
    uniforms.nbChunks.needsUpdate = true;
    uniforms.textures.needsUpdate = true;
    uniforms.textureOrigins.needsUpdate = true;
    uniforms.chunkSize.needsUpdate = true;
    uniforms.useColorMap.needsUpdate = true;
    uniforms.colorMap.needsUpdate = true;
    */
  }


  /**
  * @return the main plane, containing all the sub-planes
  */
  getPlane(){
    return this._plane;
  }


  /**
  * Update the internal resolution level and scale the plane accordingly.
  * @param {Number} lvl - zoom level, most likely in [0, 6] (integer)
  */
  updateScaleFromRezLvl( lvl ){

    // safety measure
    if(lvl < 0){
      lvl = 0;
    }

    this._resolutionLevel = lvl;
    var scale = 1 / Math.pow( 2, this._resolutionLevel );

    this._plane.scale.x = scale;
    this._plane.scale.y = scale;
    this._plane.scale.z = scale;

    // explicitely call to update the matrix, otherwise it would be called at the next render
    // and in the meantime, we need to have proper position to load the chunks.
    this._plane.updateMatrixWorld();

    // this one is not supposed to be necessary
    //this._plane.updateMatrix();

    // now the size is updated, we update the texture
    this.updateUniforms();
  }


  /**
  * Compute and return the normal vector of this plane in world coordinates using the local quaternion.
  * @returns {THREE.Vector3} a normalized vector.
  */
  getWorldNormal(){
    return this._getWorldVectorNormalized( new THREE.Vector3(0, 0, 1) );
  }


  getWorldVectorU(){
    return this._getWorldVectorNormalized( new THREE.Vector3(1, 0, 0) );
  }


  getWorldVectorV(){
    return this._getWorldVectorNormalized( new THREE.Vector3(0, 1, 0) );
  }


  /**
  * [PRIVATE]
  * Transform a local vector (local to the plane) into a world coodinate vector.
  * @param {THREE.Vector3} v - a local vector
  * @returns {THREE.Vector3} a vector in world coodinates
  */
  _getWorldVectorNormalized( v ){
    var ParentQuaternion = new THREE.Quaternion().copy(this._plane.quaternion);
    var vector = v.clone();
    vector.applyQuaternion(ParentQuaternion).normalize();
    return vector;
  }


  /**
  * @return {Number} the size of this plane diagonal in world coordinates.
  */
  getWorldDiagonal(){
    var diago = Math.sqrt( Math.pow(this._subPlaneDim.row, 2) + Math.pow(this._subPlaneDim.col, 2) ) * this._plane.scale.x;

    return diago;
  }


  /**
  * Enable a given layer in the visibility mask, so that it's visible by a camera with the same layer activated.
  */
  enableLayer( l ){
    this._plane.children.forEach(function(sp){
      sp.layers.enable(l);
    });
  }


  /**
  * Disable a given layer in the visibility mask, so that it's not visible by a camera with a different layer activated.
  */
  disableLayer( l ){
    this._plane.children.forEach(function(sp){
      sp.layers.disable(l);
    });
  }


  /**
  * Hide this plane (the THEE.Object3D)
  */
  hide(){
    this._plane.visible = false;
  }


  /**
  * Show this plane (the THEE.Object3D)
  */
  show(){
    this._plane.visible = true;
  }


} /* END class ProjectionPlane */

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
    parent.add( this._multiplaneContainer );

    this._projectionPlanesHiRez = [];
    this._projectionPlanesLoRez = [];

    // So far, the Hi rez and Lo rez set of planes are exactelly the same
    this._addOrthoPlanes(this._projectionPlanesHiRez);
    this._addOrthoPlanes(this._projectionPlanesLoRez);

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
    });
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
    });
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

/**
* MniObjReader is a parser of mniobj surface files. This version is an atempt of
* making a free from dependency independant module. It is based on the code witten
* by Nicolas Kassis and Tarek Sherif for BrainBrowser
* (https://brainbrowser.cbrain.mcgill.ca).
*
* Since mniobj file can be huge, it may be a good idea to call that froma worker.
*
* @author: Jonathan Lurie (github.com/jonathanlurie)
* @author: Nicolas Kassis
* @author: Tarek Sherif
*/

class MniObjReader{

  /**
  * Constructor of the MniObjReader.
  */
  constructor(){
    this._stack = null;
    this._stackIndex = null;
    this._tempResult = null;
    this._shapeData = null;
  }


  /**
  * Copy an existing MniObjReader instance.
  * This is particularly usefull in the context of a worker, if an MniObjReader
  * is returned, it is using a JSON format to transfer, meaning all the methods
  * are lost and only remains the data. This is to rebuild a proper MniObjReader.
  * @param {MniObjReader} MniObjReaderInstance - the instance to copy the data from.
  */
  copy(MniObjReaderInstance){
    this._stack = MniObjReaderInstance._stack;
    this._stackIndex = MniObjReaderInstance._stackIndex;
    this._tempResult = MniObjReaderInstance._tempResult;
    this._shapeData = MniObjReaderInstance._shapeData;
  }


  /**
  * Parse the nmiobj string.
  * @param {String} objString - This string is obviously taken out of a obj file
  */
  parse(objString) {
    this._parseRawData( objString );
    this._arrangeData();
  }


  /**
  * Parse a obj string
  * @param {String} objString - content of the obj file
  */
  _parseRawData( objString ){
    this._stack = objString.trim().split(/\s+/).reverse();
    this._stackIndex = this._stack.length - 1;
    this._tempResult = {};

    var splitHemispheres = false;  //TODO remove that and the code that depends on that
    var objectClass = this._popStack();
    var start, end, nitems;
    var indices, endIndices;
    var lineIndices = null;
    var lineIndexSize, lineIndexCounter;

    // By default models are not split
    // (this option allows us to split hemispheres
    // into two separate models.)
    this._tempResult.split = false;

    this._tempResult.type = objectClass === "P" ? "polygon" :
                  objectClass === "L" ? "line" :
                  objectClass;

    if(this._tempResult.type === "polygon") {
      this._parseSurfProp();
      this._tempResult.numVertices = parseInt(this._popStack(), 10);
      this._parseVertices();
      this._parseNormals();
      this._tempResult.nitems = parseInt(this._popStack(), 10);
    } else if (this._tempResult.type === "line") {
      this._parseSurfProp();
      this._tempResult.numVertices = parseInt(this._popStack(), 10);
      this._parseVertices();
      this._tempResult.nitems = parseInt(this._popStack(), 10);
    } else {
      this._tempResult.error = true;
      this._tempResult.errorMessage = 'Invalid MNI Object class: must be "polygon" or "line"';
      return;
    }

    this._parseColors();
    this._parseEndIndices();
    this._parseIndices();

    if (this._tempResult.type === "polygon" ) {
      if (splitHemispheres){
        this._tempResult.split = true;
        this._splitHemispheres();
      }
    } else if (this._tempResult.type === "line") {
      indices = this._tempResult.indices;
      endIndices = this._tempResult.endIndices;
      nitems = this._tempResult.nitems;
      lineIndexSize = lineIndexCounter = 0;

      for (var i = 0; i < nitems; i++){
        if (i === 0){
          start = 0;
        } else {
          start = endIndices[i - 1];
        }

        end = endIndices[i];
        lineIndexSize += (end - start - 1) * 2;
      }

      lineIndices = new Uint32Array(lineIndexSize);

      for (var i = 0; i < nitems; i++){
        if (i === 0){
          start = 0;
        } else {
          start = endIndices[i - 1];
        }

        lineIndices[lineIndexCounter++] = indices[start];
        end = endIndices[i];

        for (var j = start + 1; j < end - 1; j++) {
          lineIndices[lineIndexCounter++] = indices[j];
          lineIndices[lineIndexCounter++] = indices[j];
        }

        lineIndices[lineIndexCounter++] = indices[end - 1];
      }

      this._tempResult.indices = lineIndices;
    }
  }


  /**
  * [PRIVATE]
  * Rearange the data from _tempResult to _shapeData
  */
  _arrangeData() {

      this._shapeData = {
        type: this._tempResult.type,
        vertices: this._tempResult.vertices,
        normals: this._tempResult.normals,
        colors: this._tempResult.colors,
        surfaceProperties: this._tempResult.surfaceProperties,
        split: this._tempResult.split,
        error: this._tempResult.error,
        errorMessage: this._tempResult.errorMessage
      };

      var transfer = [
        this._shapeData.vertices.buffer,
        this._shapeData.colors.buffer
      ];

      if (this._shapeData.normals) {
        transfer.push(this._shapeData.normals.buffer);
      }

      if (this._shapeData.split) {
        this._shapeData.shapes = [
          { indices: this._tempResult.left.indices },
          { indices: this._tempResult.right.indices }
        ];

        transfer.push(
          this._tempResult.left.indices.buffer,
          this._tempResult.right.indices.buffer
        );
      } else {
        this._shapeData.shapes = [
          { indices: this._tempResult.indices }
        ];
        transfer.push(
          this._tempResult.indices.buffer
        );
      }

      // unroll colors if necessary
      if(this._shapeData.colors.length === 4) {
        this._unrollColors();
      }
  }


  /**
  * [PRIVATE]
  * From a single color, make a typed array (Uint8) of colors.
  */
  _unrollColors(){
    var dataColor0, dataColor1, dataColor2, dataColor3;
    var count;
    var nbTriangles = this._shapeData.vertices.length / 3;
    var arraySize = nbTriangles * 4;
    var unrolledColors = new Uint8Array(arraySize);

    dataColor0 = this._shapeData.colors[0];
    dataColor1 = this._shapeData.colors[1];
    dataColor2 = this._shapeData.colors[2];
    dataColor3 = this._shapeData.colors[3];

    for(var i=0; i<arraySize; i+=4){
      unrolledColors[i]     = dataColor0 * 255;
      unrolledColors[i + 1] = dataColor1 * 255;
      unrolledColors[i + 2] = dataColor2 * 255;
      unrolledColors[i + 3] = dataColor3 * 255;
    }

    this._shapeData.colors = unrolledColors;
  }


  /**
  * [PRIVATE]
  * Parse surface properties from the raw data.
  */
  _parseSurfProp() {
    if (this._tempResult.type === "polygon") {
      this._tempResult.surfaceProperties = {
        ambient: parseFloat(this._popStack()),
        diffuse: parseFloat(this._popStack()),
        specularReflectance: parseFloat(this._popStack()),
        specularScattering: parseFloat(this._popStack()),
        transparency: parseFloat(this._popStack())
      };

    }else if (this._tempResult.type === "line") {
      this._tempResult.surfaceProperties = {
        width: this._popStack()
      };
    }
  }


  /**
  * [PRIVATE]
  * Parse the vertices from the raw data.
  */
  _parseVertices() {
    var count = this._tempResult.numVertices * 3;
    var vertices = new Float32Array(count);
    var that = this;

    for (var i = 0; i < count; i++) {
      vertices[i] = parseFloat(this._popStack());
    }

    this._tempResult.vertices = vertices;
  }


  /**
  * [PRIVATE]
  * Parse the normal vector from the raw data.
  */
  _parseNormals() {
    var count = this._tempResult.numVertices * 3;
    var normals = new Float32Array(count);

    for (var i = 0; i < count; i++) {
      normals[i] = parseFloat(this._popStack());
    }

    this._tempResult.normals = normals;
  }


  /**
  * [PRIVATE]
  * Parse the color from the raw data.
  */
  _parseColors() {
    var colorFlag = parseInt(this._popStack(), 10);
    var colors;
    var count;

    if (colorFlag === 0) {
      colors = new Float32Array(4);
      for (var i = 0; i < 4; i++){
        colors[i] = parseFloat(this._popStack());
      }
    } else if (colorFlag === 1) {
      count = this._tempResult.num_polygons * 4;
      colors = new Float32Array(count);
      for (var i = 0; i < count; i++){
        colors[i] = parseFloat(this._popStack());
      }
    } else if (colorFlag === 2) {
      count = this._tempResult.numVertices * 4;
      colors = new Float32Array(count);
      for (var i = 0; i < count; i++){
        colors[i] = parseFloat(this._popStack());
      }
    } else {
      this._tempResult.error = true;
      this._tempResult.errorMessage = "Invalid color flag: " + colorFlag;
    }

    this._tempResult.colorFlag = colorFlag;
    this._tempResult.colors = colors;
  }


  /**
  * [PRIVATE]
  * Not sure how useful endIndices are, it was used in BrainBrowser so I kept them.
  * (is that useful?)
  */
  _parseEndIndices(){
    var count = this._tempResult.nitems;
    var endIndices = new Uint32Array(count);

    for(var i = 0; i < count; i++){
      endIndices[i] = parseInt(this._popStack(), 10);
    }

    this._tempResult.endIndices = endIndices;
  }


  /**
  * [PRIVATE]
  * Reads the vertices indices to use to make triangles.
  */
  _parseIndices() {
    var count = this._stackIndex + 1;
    var indices = new Uint32Array(count);

    for (var i = 0; i < count; i++) {
      indices[i] = parseInt(this._popStack(), 10);
    }

    this._tempResult.indices = indices;
  }


  /**
  * [NOT USED]
  * This is legacy code I left from the reader in BrainBrowser. Since splitHemispheres is
  * hardcoded to false, this is not called.
  */
  _splitHemispheres() {
    var numIndices = this._tempResult.indices.length;

    this._tempResult.left = {
      indices: new Uint32Array(Array.prototype.slice.call(this._tempResult.indices, 0, numIndices / 2))
    };

    this._tempResult.right = {
      indices: new Uint32Array(Array.prototype.slice.call(this._tempResult.indices, numIndices / 2))
    };
  }


  /**
  * [PRIVATE]
  * pop the raw data (big string file)
  * @return {String}
  */
  _popStack() {
    return this._stack[this._stackIndex--];
  }


  /**
  * [DEBUGGING]
  * @return {Object} the entire shapeData object.
  */
  getShapeData () {
    return this._shapeData;
  }


  /**
  * @return the number of shapes encoded in the file
  */
  getNumberOfShapes() {
    return this._shapeData.shapes.length;
  }


  /**
  * Returns the index of vertices to be used to make triangles, as a typed array.
  * @return {Uint32Array} Since triangles have 3 vertices, the array contains index such as
  * [i0, i1, i2, i0, i1, i2, ...].
  */
  getShapeRawIndices(shapeNum) {
    if(shapeNum >= 0 && shapeNum<this._shapeData.shapes.length){
      return this._shapeData.shapes[shapeNum].indices;
    }else{
      return null;
    }
  }


  /**
  * Returns the vertice position as a typed array.
  * @return {Float32Array} of points encoded like [x, y, z, x, y, z, ...]
  */
  getRawVertices() {
    return this._shapeData.vertices;
  }


  /**
  * Returns the normal vectors as a typed array.
  * @return {Float32Array} of normal vector encoded like [x, y, z, x, y, z, ...]
  */
  getRawNormals() {
    return this._shapeData.normals;
  }


  /**
  * Get the colors encoded like [r, g, b, a, r, g, b, a, ...]
  * @return {Float32Array} of size 4 or of size 4xnumOfVertices
  */
  getRawColors(){
    return this._shapeData.colors;
  }


  /**
  * The surface properties contains transparency info about specularity transparency
  * and other nice light-related behaviour thingies.
  * May be used when building a material, but this is not mandatory.
  * @return {Object}
  */
  getSurfaceProperties(){
    return this._shapeData.surfaceProperties;
  }


}/* END CLASS MniObjReader */

class MeshCollection{

  /**
  * Constructor of the MeshCollection instance.
  *
  */
  constructor( config, container ){

    // THREE js container (object3D) for all the meshes
    this._container = container;


    // rather than an array because all mesh have an ID
    this._meshes = {};

    // the folder that contains the json config file (that is at config.url).
    // depending on the option of the file, the mesh files can have a
    // relative address to this folder, making the folder portable.
    this._configFileDir = null;

    this._collectionBox = null;

    this._readConfig( config );
  }


  /**
  * [PRIVATE]
  * Start to read the configuration, containing an extensive list of mesh
  * with their description.
  * @param {Object} config - a small config object {datatype: String, url: String}
  */
  _readConfig( config ){
    var that = this;
    var filepath = config.url;

    AjaxFileLoader.loadTextFile(
      // file URL
      filepath,

      // success callback
      function(data){
        // the directory of the config file is the working directory
        that._configFileDir = filepath.substring(0, Math.max(filepath.lastIndexOf("/"), filepath.lastIndexOf("\\"))) + "/";

        // Rading the config object
        that._loadConfigDescription(JSON.parse(data));
      },

      // error callback
      function(error){
        console.error("Could not load config file " + filepath);

        // if loading the config file failed, we have a callback for that.
        if(that._onConfigErrorCallback){
          that._onConfigErrorCallback(filepath, 0);
        }
      }
    );
  }


  /**
  * [PRIVATE]
  *
  */
  _loadConfigDescription( meshConfig ){
    var that = this;

    meshConfig.forEach( function(meshInfo){
      var url = meshInfo.url;

      // "near" means files are in a folder relative to the config file.
      // This can be local or distant.
      if( meshInfo.urlType == "near" ){
        url = that._configFileDir + url;

      // "local" means the specified url is relative to the web app
      }else if(meshInfo.urlType == "local"){
        // nothing to do

      // "absolute" means the path should start by http
      }else if(meshInfo.urlType == "absolute"){
        // nothing to do
      }

      AjaxFileLoader.loadTextFile(
        // file URL
        url,

        // success callback
        function(data){
          var objReader = new MniObjReader();
          objReader.parse( data );
          var mesh = that._buildMeshFromObjReader( objReader );
          mesh.geometry.computeBoundingBox();
          mesh.name = meshInfo.id;
          mesh.userData.longName = meshInfo.name;
          mesh.userData.description = meshInfo.description;

          // parametric rotation
          if("eulerAngle" in meshInfo){
            mesh.rotation.set(meshInfo.eulerAngle[0], meshInfo.eulerAngle[1], meshInfo.eulerAngle[2]);
          }

          // parametric scale
          if("scale" in meshInfo){
            mesh.scale.set(meshInfo.scale[0], meshInfo.scale[1], meshInfo.scale[2]);
          }

          // parametric position
          if("position" in meshInfo){
            mesh.position.set(meshInfo.position[0], meshInfo.position[1], meshInfo.position[2]);
          }

          // shows on all cam
          mesh.layers.enable( 0 );
          mesh.layers.enable( 1 );

          // show only on perspective cam
          //mesh.layers.disable( 0 );
          //mesh.layers.enable( 1 );

          that._meshes[meshInfo.id] = mesh;
          that._container.add( mesh );

          that._updateCollectionBox( mesh );
        },

        // error callback
        function(error){
          console.error("Could not load mesh file " + url);

        }
      );

    });

  }


  /**
  * [PRIVATE]
  * Creates a three mesh out of a mniObjReader instance
  * @param {MniObjReader} mniObjReader - must have called parse() on it first
  * @return {THREE.Mesh} - a mesh based on the mni obj parsed data
  */
  _buildMeshFromObjReader( mniObjReader ){
    var geometry = new THREE.BufferGeometry();
    var indices = mniObjReader.getShapeRawIndices(0);
    var positions = mniObjReader.getRawVertices();
    var normals = mniObjReader.getRawNormals();
    var colors = mniObjReader.getRawColors();
    geometry.setIndex( new THREE.BufferAttribute( indices, 1 ) );
    geometry.addAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
    geometry.addAttribute( 'normal', new THREE.BufferAttribute( normals, 3, true ) );
    geometry.addAttribute( 'color', new THREE.BufferAttribute( colors, 4, true ) );
    geometry.computeBoundingSphere();

    var material = new THREE.MeshPhongMaterial( {
      specular: 0xffffff,
      shininess: 250,
      side: THREE.DoubleSide,
      vertexColors: THREE.VertexColors,
      transparent: true,
      opacity: mniObjReader.getSurfaceProperties().transparency,
    } );

    var mesh = new THREE.Mesh( geometry, material );
    return mesh;
  }


  /**
  * [PRIVATE]
  * Expands the collection bounding box with a new mesh.
  * @param {THREE.Mesh} mesh - a mesh to expand the collection bounding box
  */
  _updateCollectionBox( mesh ){

    // first mesh we load, we take its bb
    if(!this._collectionBox){
      this._collectionBox = mesh.geometry.boundingBox.clone();

    // additionnal mes: we expand the collection bb
    }else{
      this._collectionBox.union( mesh.geometry.boundingBox );
    }
  }


} /* END class MeshCollection */

class GuiController{

  constructor( quadScene ){

    this._quadScene = quadScene;

    // fake value for dat gui - just to display the init value
    this._resolutionLevel = this._quadScene.getResolutionLevel();
    this._resolutionLvlRange = [0, 6];
    this._resolutionLvlSliderBuilt = false;
    this._resolutionDescription = '';

    // special controller for colormaps
    this._colormapManager = this._quadScene.getColormapManager();
    this._colormapManager.onColormapUpdate( this._updateColormapList.bind(this) );

    // Annotations
    this._annotationCollection = this._quadScene.getAnnotationCollection();

    // to specify shift+click on the ortho cam plane projections
    this._quadViewInteraction = this._quadScene.getQuadViewInteraction();

    // the plane manager
    this._planeManager = this._quadScene.getPlaneManager();

    var panelWidth = 200;
    var panelSpace = 5;

    this._mainPanel = QuickSettings.create(panelSpace, 0, document.title);
    this._initMainPanel();

    this._axisInfo = null;
    //this._annotationPanel = QuickSettings.create(panelWidth + panelSpace*2 , 0, "Annotations");
    //this._initAnnotationPanel();
    //this._initAnnotationPanelCallback();
  }


  /**
  * [PRIVATE]
  * Adds buttons to the widget
  */
  _initMainPanel(){
    var that = this;

    // compass toggle
    this._mainPanel.addBoolean("Compass", 1, function(mustShow){
      that._quadScene.getOrientationHelper().setVisibility( mustShow );
    });

    // bounding box toggle
    this._mainPanel.addBoolean("Bounding box", 1, function(mustShow){
      that._quadScene.getBoundingBoxHelper().setVisibility( mustShow );
    });
    document.getElementById("Bounding box").parentElement.parentElement.style["margin-top"] = "0px";

    // Lo-rez plane view toggle
    this._mainPanel.addBoolean("Lo-res projection", 1, function(mustShow){
      if(mustShow){
        that._planeManager.disableLayerHiRez(1);
        that._planeManager.showLowRezPlane();
      }else{
        that._planeManager.enableLayerHiRez(1);
        that._planeManager.hideLowRezPlane();
      }

    });
    document.getElementById("Lo-res projection").parentElement.parentElement.style["margin-top"] = "0px";

    // rez lvl slider
    this._mainPanel.addRange("Zoom level", 0, 6, 0, 1,
      // on change
      function( value ){
        value = Math.floor( value );
        that._updateResolutionDescription(
          value,
          that._quadScene.getLevelManager().getLevelInfo(that._resolutionLevel, "key") + " ➤ "
        );
      },
      // on finish
      function( value ){
        value = Math.floor( value );
        that._resolutionLevel = value;
        that._quadScene.setResolutionLevel( value );

      }
    );

    // resolution info
    this._mainPanel.addText("Resolution", "");
    this._mainPanel.overrideStyle("Resolution", "background-color", "transparent");
    document.getElementById('Resolution').readOnly = true;
    document.getElementById("Resolution").parentElement.style["margin-top"] = "0px";

    // multiplane position (unit x, y, z)
    this._mainPanel.addText("Position", "", function(){} );
    this._mainPanel.overrideStyle("Position", "text-align", "center");
    // when pressing ENTER on this field
    document.getElementById("Position").addEventListener("keypress", function( e ){
      if (e.keyCode == 13) {
        var newPosition = that._mainPanel.getValue("Position")
          .split(',')
          .map(function(elem){return parseFloat(elem)});

        that._quadScene.setMultiplanePosition(newPosition[0], newPosition[1], newPosition[2]);
      }
    });

    // mutiplane position voxel (to match A3D slices index)
    this._mainPanel.addText("Position voxel", "", function(){} );
    this._mainPanel.overrideStyle("Position voxel", "text-align", "center");
    document.getElementById("Position voxel").parentElement.style["margin-top"] = "0px";
    // on pressing ENTER on this field
    document.getElementById("Position voxel").addEventListener("keypress", function( e ){
      if (e.keyCode == 13) {
        var axisInfo = that._axisInfo;

        var newPositionVoxel = that._mainPanel.getValue("Position voxel")
          .split(',')
          .map(function(elem){return parseFloat(elem)});

        var positionUnitX = newPositionVoxel[0] / axisInfo.x.originalSize;
        if(axisInfo.x.reversed){
          positionUnitX = 1 - positionUnitX;
        }
        positionUnitX = positionUnitX * (axisInfo.x.originalSize / axisInfo.x.finalSize) + (axisInfo.x.offset / axisInfo.x.finalSize);

        var positionUnitY = newPositionVoxel[1] / axisInfo.y.originalSize;
        if(axisInfo.y.reversed){
          positionUnitY = 1 - positionUnitY;
        }
        positionUnitY = positionUnitY * (axisInfo.y.originalSize / axisInfo.y.finalSize) + (axisInfo.y.offset / axisInfo.y.finalSize);

        var positionUnitZ = newPositionVoxel[2] / axisInfo.z.originalSize;
        if(axisInfo.z.reversed){
          positionUnitZ = 1 - positionUnitZ;
        }
        positionUnitZ = positionUnitZ * (axisInfo.z.originalSize / axisInfo.z.finalSize) + (axisInfo.z.offset / axisInfo.z.finalSize);

        that._quadScene.setMultiplanePosition(positionUnitX, positionUnitY, positionUnitZ);
      }
    });


    // multiplane rotation
    this._mainPanel.addText("Rotation", "", function(){} );
    this._mainPanel.overrideStyle("Rotation", "margin-top", "0px");
    this._mainPanel.overrideStyle("Rotation", "text-align", "center");
    document.getElementById("Rotation").parentElement.style["margin-top"] = "0px";

    // when pressing ENTER on this field
    document.getElementById("Rotation").addEventListener("keypress", function( e ){
      if (e.keyCode == 13) {
        var newRotation = that._mainPanel.getValue("Rotation")
          .split(',')
          .map(function(elem){return parseFloat(elem)});

        that._quadScene.setMultiplaneRotation(newRotation[0], newRotation[1], newRotation[2]);
      }
    });

    // Button reset rotation
    this._mainPanel.addButton("Reset rotation", function(){
      that._quadScene.setMultiplaneRotation(0, 0, 0);

    });
    this._mainPanel.overrideStyle("Reset rotation", "width", "100%");
    document.getElementById("Reset rotation").parentElement.style["margin-top"] = "0px";

  }


  /**
  * [PRIVATE]
  * Action to toggle the rotation helper
  */
  _toggleOrientationHelper(){
    this._quadScene.getOrientationHelper().toggle();
  }


  /**
  * [PRIVATE]
  * Action to toggle the bounding box helper
  */
  _toggleBoundingBoxHelper(){
    this._quadScene.getBoundingBoxHelper().toggle();
  }


  /**
  * Update the UI with a new resolution level.
  * This does not do anything but refreshing the display
  * (iow. calling this method does NOT change the rez lvl)
  */
  updateResolutionLevelUI( lvl ){
    this._resolutionLevel = lvl;
    this._mainPanel.setValue("Zoom level", lvl);
    this._updateResolutionDescription( this._resolutionLevel );
  }


  /**
  * Update the UI from rotation, position and rez lvl (later is not used here)
  * @param {Object} spaceConfig - { resolutionLvl: Number, position:[x, y, z], rotation:[x, y, z]}
  */
  updateMultiplaneUI( spaceConfig ){
    var positionString = spaceConfig.position.x.toFixed(4) + ' , ';
    positionString += spaceConfig.position.y.toFixed(4) + ' , ';
    positionString += spaceConfig.position.z.toFixed(4);
    this._mainPanel.setValue("Position", positionString);

    var rotationString = spaceConfig.rotation.x.toFixed(4) + ' , ';
    rotationString += spaceConfig.rotation.y.toFixed(4) + ' , ';
    rotationString += spaceConfig.rotation.z.toFixed(4);
    this._mainPanel.setValue("Rotation", rotationString);


    var axisInfo = spaceConfig.axisInfo;
    this._axisInfo = axisInfo; // so that we could reuse it later

    var posVoxelX = ( spaceConfig.position.x - (axisInfo.x.offset / axisInfo.x.finalSize) ) / (axisInfo.x.originalSize / axisInfo.x.finalSize);
    if(axisInfo.x.reversed){
      posVoxelX = 1 - posVoxelX;
    }

    var posVoxelY = ( spaceConfig.position.y - (axisInfo.y.offset / axisInfo.y.finalSize) ) / (axisInfo.y.originalSize / axisInfo.y.finalSize);
    if(axisInfo.y.reversed){
      posVoxelY = 1 - posVoxelY;
    }

    var posVoxelZ = ( spaceConfig.position.z - (axisInfo.z.offset / axisInfo.z.finalSize) ) / (axisInfo.z.originalSize / axisInfo.z.finalSize);
    if(axisInfo.z.reversed){
      posVoxelZ = 1 - posVoxelZ;
    }

    posVoxelX *= axisInfo.x.originalSize;
    posVoxelY *= axisInfo.y.originalSize;
    posVoxelZ *= axisInfo.z.originalSize;

    var positionVoxelString = Math.round(posVoxelX) + ' , ';
    positionVoxelString += Math.round(posVoxelY) + ' , ';
    positionVoxelString += Math.round(posVoxelZ);
    this._mainPanel.setValue("Position voxel", positionVoxelString);

// ----------------- reverse ----------
  /*
    positionVoxelX = positionVoxelX / axisInfo.x.originalSize
    if(axisInfo.x.reversed){
      positionVoxelX = 1 - posVoxelX;
    }
    positionVoxelX * (axisInfo.x.originalSize / axisInfo.x.finalSize) + (axisInfo.x.offset / axisInfo.x.finalSize)
    */
  }


  /**
  * [PRIVATE]
  * update the description of resolution level
  */
  _updateResolutionDescription( lvl, prefix="" ){
    this._resolutionDescription = prefix + this._quadScene.getLevelManager().getLevelInfo(lvl, "key");
    this._mainPanel.setValue("Resolution", this._resolutionDescription);

  }


  /**
  * [PRIVATE] callback
  * Update the colormap list box and the dedicated callback for when the colormap
  * changes.
  */
  _updateColormapList(){
    var that = this;

    // color map
    this._mainPanel.addDropDown("Colormap", this._colormapManager.getAvailableColormaps(),
      function( dropdownObj ){
        that._colormapManager.useColormap(dropdownObj.value);
        that._quadScene.refreshUniforms();
      }
    );

  }


  /**
  * [PRIVATE]
  * Create the pannel dedicated to annotaion management
  */
  _initAnnotationPanel(){
    var that = this;



    // open file button
    this._annotationPanel.addFileChooser(
      "Annotation file",
      "Open",
      "",
      function( file ){
        that._annotationCollection.loadAnnotationFileDialog( file );
      }
    );

    // save annot button
    this._annotationPanel.addButton("Export annotations", null);
    this._annotationPanel.overrideStyle("Export annotations", "width", "100%");
    document.getElementById("Export annotations").parentElement.style["margin-top"] = "0px";

    // dropdown menu
    this._annotationPanel.addDropDown("Annotations", [],
      function( dropdownObj ){
        var annotation = that._annotationCollection.getAnnotation( dropdownObj.value );

        if(annotation){
          that._displayAnnotInfo( annotation );
        }
      }
    );



    // callback when a new annot is added in the core, a new item shows on the menu
    that._annotationCollection.onAddingAnnotation( function(name){
      var dropdownObj = that._annotationPanel.getControl("Annotations");
      dropdownObj.addItem(name);
      console.log( dropdownObj );

      //dropdownObj.setValue(name);

      var annotation = that._annotationCollection.getAnnotation( name );

      if(annotation){
        that._displayAnnotInfo( annotation );
      }
    });

    /*
    this._annotationPanel.getControl("Annotations").removeItem("pouet2");
    */

    // editable field for annotation name
    this._annotationPanel.addText("Annotation name", "", function(){} );
    this._annotationPanel.overrideStyle("Annotation name", "text-align", "center");

    // editable description of the annot
    this._annotationPanel.addTextArea("Annotation description", "", function(){} );
    document.getElementById("Annotation description").parentElement.style["margin-top"] = "0px";

    // Pannel of buttons for dealing with existing annot
    this._annotationPanel.addHTML("panelEditExistingAnnot", this._buildPanelEditExistingAnnot());
    document.getElementById("panelEditExistingAnnot").parentElement.style["margin-top"] = "0px";


    // Button to create a new annotation
    this._annotationPanel.addButton("Start new annotation", function(){
      // show and hide the relevant componants
      that._annotationPanel.hideControl("panelEditExistingAnnot");
      that._annotationPanel.showControl("panelCreateAnnot");
      that._annotationPanel.showControl("Validate annotation");
      that._annotationPanel.hideControl("Start new annotation");

      // prevent the user from doing stupid interactions
      that._annotationPanel.disableControl("Annotations");
      that._annotationPanel.disableControl("Export annotations");
      that._annotationPanel.disableControl("Annotation file");

      // enable creation
      // (the temp annot will 'really' be created at the first click)
      that._annotationCollection.enableAnnotCreation();
    });
    this._annotationPanel.overrideStyle("Start new annotation", "width", "100%");

    // Button to validate a homemade annotation
    this._annotationPanel.addButton("Validate annotation", function(){
      // show and hide the relevant componants
      that._annotationPanel.showControl("panelEditExistingAnnot");
      that._annotationPanel.hideControl("panelCreateAnnot");
      that._annotationPanel.hideControl("Validate annotation");
      that._annotationPanel.showControl("Start new annotation");

      // allow the user to interact
      that._annotationPanel.enableControl("Annotations");
      that._annotationPanel.enableControl("Export annotations");
      that._annotationPanel.enableControl("Annotation file");

      // done with the creation
      that._annotationCollection.addTemporaryAnnotation();

    });
    this._annotationPanel.overrideStyle("Validate annotation", "width", "100%");
    this._annotationPanel.hideControl("Validate annotation");

    // homemade annot options
    this._annotationPanel.addHTML("panelCreateAnnot", this._buildPanelCreateAnnot());
    document.getElementById("panelCreateAnnot").parentElement.style["margin-top"] = "0px";
    this._annotationPanel.hideControl("panelCreateAnnot");
  }


  /**
  * [PRIVATE]
  * Builds the HTML edit panel for annotations
  */
  _buildPanelEditExistingAnnot(){
    var htmlStr = `
    <div>
      <i id="existingAnnotValidate" class="fa fa-check small-icon" aria-hidden="true"></i>
      <i id="existingAnnotToggleView" class="fa fa-eye small-icon" aria-hidden="true"></i>
      <i id="existingAnnotTarget" class="fa fa-crosshairs small-icon" aria-hidden="true"></i>
      <i id="existingAnnotColorPicker" class="fa fa-paint-brush small-icon" aria-hidden="true"></i>
      <i  id="existingAnnotDelete" class="fa fa-trash small-icon" aria-hidden="true"></i>
    </div>
    `;

    return htmlStr;
  }


  /**
  * [PRIVATE]
  * Builds the pannel with buttons to create a new annotation
  */
  _buildPanelCreateAnnot(){
    var htmlStr = `
    <div>
      <i id="newAnnotUndo" class="fa fa-undo small-icon" aria-hidden="true"></i>
      <i id="newAnnotPaintColorPicker" class="fa fa-paint-brush small-icon" aria-hidden="true"></i>
      <i id="newAnnotDelete" class="fa fa-trash small-icon" aria-hidden="true"></i>
    </div>
    `;

    return htmlStr;
  }


  _initAnnotationPanelCallback(){
    var that = this;

    // existing annotations -------------------------

    // check - validate the change of name/description if any
    document.getElementById("existingAnnotValidate").onclick = function(e){
      console.log(e);
    };

    // eye - show/hide the annot
    document.getElementById("existingAnnotToggleView").onclick = function(e){
      console.log(e);
    };

    // target - center the annot
    document.getElementById("existingAnnotTarget").onclick = function(e){
      console.log(e);
    };

    // paint brush - change annot color
    document.getElementById("existingAnnotColorPicker").onclick = function(e){
      console.log(e);
    };

    // trashbin - delete the annot
    document.getElementById("existingAnnotDelete").onclick = function(e){
      console.log(e);
    };

    // new annotations -------------------------

    // Undo - remove the last point added
    document.getElementById("newAnnotUndo").onclick = function(e){
      console.log(e);
    };

    // Paint brush - change color of the annot
    document.getElementById("newAnnotPaintColorPicker").onclick = function(e){
      console.log(e);
    };

    // trashbin - delete the annot
    document.getElementById("newAnnotDelete").onclick = function(e){
      console.log(e);
    };


    //
    this._quadViewInteraction.onClickPlane(
      "ortho",

      function( point ){
        console.log("From GUI:");
        console.log(point);

        // the annotation creation processes is enabled
        if( that._annotationCollection.isAnnotCreationEnabled() ){
          var temporaryAnnot = that._annotationCollection.getTemporaryAnnotation();

          // appending a new point
          if( temporaryAnnot ){
            temporaryAnnot.addPoint( [point.x, point.y, point.z] );
          }
          // init the temporary annot
          else{
            that._annotationCollection.createTemporaryAnnotation( point );
            that._displayAnnotInfo( that._annotationCollection.getTemporaryAnnotation() );
          }

        }
      }
    );

  }


  /**
  * Display annotation info in the text box.
  * @param {Annotation} annot - an instance of annotation,
  * most likely the temporary one from the collection.
  */
  _displayAnnotInfo( annot ){
    this._annotationPanel.setValue("Annotation name", annot.getName());
    this._annotationPanel.setValue("Annotation description", annot.getDescription());
  }


}/* END class GuiController */

/**
* A BoundingBoxHelper instance shows the limits of the dataset in a visual way.
* A bounding box can be built only once.
*/
class BoundingBoxHelper{

  /**
  * Constructor
  * @param {THREE.Object3D} parent - THREE js object to add the boinding box
  */
  constructor( parent ){
    this._size = null;
    this._parentElem = parent;
    this._boundingBox3D = null;
  }


  /**
  * Build the bounding box helper.
  * Can be called only once.
  * @param {Array} size - Array of Number [xsize, ysize, zsize]
  */
  build( size ){
    this._size = size.slice();

    if(this._boundingBox3D)
      return;

    this._boundingBox3D = new THREE.Object3D();

    var boundingBoxMaterial = new THREE.MeshBasicMaterial( {
      transparent: true,
      opacity: 0.8,
      color: 0xffffff,
      vertexColors: THREE.FaceColors,
      side: THREE.BackSide
    } );

    var boundingBoxGeometry = new THREE.BoxGeometry(
      this._size[0],
      this._size[1],
      this._size[2]
    );

    boundingBoxGeometry.faces[0].color.setHex(  0xFF7A7A ); // Sagittal
    boundingBoxGeometry.faces[1].color.setHex(  0xFF7A7A );
    boundingBoxGeometry.faces[2].color.setHex(  0xff3333 );
    boundingBoxGeometry.faces[3].color.setHex(  0xff3333 );
    boundingBoxGeometry.faces[4].color.setHex(  0x61FA94 ); // Coronal
    boundingBoxGeometry.faces[5].color.setHex(  0x61FA94 );
    boundingBoxGeometry.faces[6].color.setHex(  0xA7FAC3 );
    boundingBoxGeometry.faces[7].color.setHex(  0xA7FAC3 );
    boundingBoxGeometry.faces[8].color.setHex(  0x95CCFC ); // Axial
    boundingBoxGeometry.faces[9].color.setHex(  0x95CCFC );
    boundingBoxGeometry.faces[10].color.setHex( 0x0088ff );
    boundingBoxGeometry.faces[11].color.setHex( 0x0088ff );

    // mesh
    var boundingBoxPlainMesh = new THREE.Mesh( boundingBoxGeometry, boundingBoxMaterial );
    this._boundingBox3D.add( boundingBoxPlainMesh );
    this._boundingBox3D.position.x = this._size[0] / 2;
    this._boundingBox3D.position.y = this._size[1] / 2;
    this._boundingBox3D.position.z = this._size[2] / 2;

    this._boundingBox3D.children.forEach( function(child){
      child.layers.disable( 0 );
      child.layers.enable( 1 );
    });

    this._parentElem.add( this._boundingBox3D );
  }


  /**
  * @return {boolean} true if xyz is within the bounding box. Return false if outside.
  * @param {Number} x - coordinate along x
  * @param {Number} y - coordinate along y
  * @param {Number} z - coordinate along z
  */
  isInside(x, y, z){
    return (x>0 && x<this._size[0] && y>0 && y<this._size[1] && z>0 && z<this._size[2]);
  }


  /**
  * Show the bounding box
  */
  show(){
    this._boundingBox3D.visible = true;
  }


  /**
  * Hide the bounding box
  */
  hide(){
    this._boundingBox3D.visible = false;
  }


  /**
  * Show the bounding box if it's hidden, hide if it's shown.
  */
  toggle(){
    this._boundingBox3D.visible = !this._boundingBox3D.visible;
  }


  /**
  * Show or hide
  * @param {Boolean} b - true to show, false to hide.
  */
  setVisibility( b ){
    this._boundingBox3D.visible = b;
  }

}/* END class BoundingBoxHelper */

/**
* An Annotation can be a single point, a segment, a linestring or a polygon.
* Each coordinate is in 3D [x, y, z] and can be represented in a 3D space after
* being converted into a proper THREEjs object.
*/
class Annotation{

  /**
  * Constructor of an annotation.
  * @param {Array of Array} points - Array of [x, y, z], if only one, its a point otherwise it can be a linestring (default) or polygon (options.closed must be true)
  * @param {String} name - name, suposedly unique
  * @param {Object} options - all kind of options: isClosed {Boolean}, description {String}, color {String} hexa like "#FF0000", eulerAngle {Array} rotation correction [x, y, z], scale {Array} scale correction [x, y, z], position {Array} offset [x, y, z]
  */
  constructor(points, name, options={}){

    this._points = points;
    this._name = name;
    this._isClosed = (typeof options.isClosed === 'undefined')? false : options.isClosed;
    this._description = (typeof options.description === 'undefined')? "" : options.description;
    this._color = (typeof options.color === 'undefined')? "#FF00FF" : options.color;
    if( this._color[0] != "#"){ this._color = "#" + this._color; }
    this._eulerAngle = (typeof options.eulerAngle === 'undefined')? [0, 0, 0] : options.eulerAngle;
    this._scale = (typeof options.scale === 'undefined')? [1, 1, 1] : options.scale;
    this._position = (typeof options.position === 'undefined')? [0, 0, 0] : options.position;

    this._isValid = false;
    this.validateAnnotation();

    this._pointRadius = 0.1;

    // visual object
    this._object3D = new THREE.Object3D();
    this._object3D.name = this._name;
    this._object3D.userData.description = this._description;
    this._object3D.userData.isClosed = this._isClosed;
    this._object3D.scale.set(this._scale[0], this._scale[1], this._scale[2]);
    this._object3D.position.set(this._position[0], this._position[1], this._position[2]);
    this._object3D.rotation.set(this._eulerAngle[0], this._eulerAngle[1], this._eulerAngle[2]);

    this._meshMustRebuild = true;

    this._buildAnnotationObject3D();
  }


  /**
  * Routine to validate an annotation. An annotation is valid if it contains at least one point and if this point contains 3 value (for x, y, z)
  */
  validateAnnotation(){
    this._isValid = true;

    // at least one point
    if(this._points.length){
      // every point as a 3D coord
      this._isValid = ! this._points.some( function( point ){
        return (point.length != 3);
      });
    }
    // no point, no annotation :(
    else{
      this._isValid = false;
    }
  }


  /**
  * Add a point at the end of the annotation
  * @param {Array} point - coord [x, y, z]
  */
  addPoint( point ){
    if(this._isClosed){
      console.warn( "The annotation is a closed polygon. You must to first remove the last point to open the loop." );
      return;
    }

    // maintain integrity (and prevent from running validateAnnotation() )
    if( point.length == 3){
      this._points.push( point );

      // this point annotation just turned into a line annotation (let's celebrate!)
      if( this._points.length >= 2 ){
        this.flushObject3D();
        this._buildLinestringAnnotation();
      }

      /*
      NOTE: it would have been better to just add a point to an existing buffer
      in order to make the lin longer, unfortunatelly THREEjs makes it very
      cumbersome (impossible) to extend an existing buffergeometry a simple way.
      In the end, the most convenient is to delete/recreate the whole thing.
      Sorry for that.
      */

      this.validateAnnotation();
    }
  }


  /**
  * Remove a point from the annotation point set.
  * @param {Number} index - optionnal, if set remove the point at this index. If not set, remove the last
  */
  /*
  removePoint( index=-1 ){
    if( this._isValid ){
      this._points.splice(index, 1);
      this.validateAnnotation();

      // TODO if a line turns into a point !
      // TODO if closed, do we still leave it close?

    }
  }
  */


  /**
  * Remove the last point of the annot and adapt the shape if it becomes a
  * point or even of length 0.
  */
  removeLastPoint(){
    // open the loop
    if(this._isClosed){
      console.warn("The polygon just got open.");
      this._isClosed = false;
    }

    if( this._isValid ){
      this._points.pop();

      // no more point into this annot
      if(this._points.length == 0){
        this.flushObject3D();
      }else
      // the line turns into a point
      if(this._points.length == 1){
        this.flushObject3D();
        this._buildPointAnnotation();
      }
      // the lines is getting shorter
      else{
        var lineMesh = this._object3D.children[0];
        lineMesh.geometry.vertices.pop();
        lineMesh.geometry.computeBoundingSphere();
        lineMesh.geometry.dynamic = true;
        lineMesh.geometry.verticesNeedUpdate = true;
      }

      this.validateAnnotation();
    }
  }


  /**
  * Get the THREE Object that represent the annotation. Build it if not already built.
  * @return {THREE.Object3D}
  */
  getObject3D(){
    /*
    if(this._meshMustRebuild){
      if(this._points.length == 1){
        this._buildPointAnnotation();
      }else{
        this._buildLinestringAnnotation();
      }

      return this._object3D;
    }
    */

    return this._object3D;
  }


  /**
  * [PRIVATE]
  * Build a THREE js object that hollows this annotation if it's a point
  */
  _buildPointAnnotation(){
    if( this._isValid ){
      var geometry = new THREE.BufferGeometry();
			var position = new Float32Array( this._points[0] );

      var material = new THREE.PointsMaterial({
        size: 10,
        color: new THREE.Color(this._color),
        sizeAttenuation: false
      });

      geometry.addAttribute( 'position', new THREE.BufferAttribute( position, 3 ) );
      geometry.computeBoundingSphere();
      geometry.dynamic = true;
      geometry.verticesNeedUpdate = true;

      var point = new THREE.Points( geometry, material );

      point.layers.enable( 0 );
      point.layers.enable( 1 );

      this._object3D.add( point );
      this._meshMustRebuild = false;
    }
  }


  /**
  * [PRIVATE]
  * Build a THREE js object that hollows this annotation if it's a linestring or a polygon
  */
  _buildLinestringAnnotation(){
    if( this._isValid ){
      //var geometry = new THREE.Geometry();
      var geometry = new THREE.BufferGeometry();


      var material = new THREE.LineBasicMaterial( {
        linewidth: 1, // thickness remains the same on screen no matter the proximity
        color: new THREE.Color(this._color)
      });

      var bufferSize = this._points.length * 3 + (+this._isClosed)*3;
      var vertices = new Float32Array(bufferSize);

      // adding every point
      this._points.forEach(function(point, index){
        vertices[index*3 ] = point[0];
        vertices[index*3 + 1] = point[1];
        vertices[index*3 + 2] = point[2];
      });

      // add a the first point again, in the end, to close the loop
      if(this._isClosed && this._points.length > 2){
        vertices[bufferSize - 3] = this._points[0][0];
        vertices[bufferSize - 2] = this._points[0][1];
        vertices[bufferSize - 1] = this._points[0][2];
      }

      geometry.addAttribute( 'position', new THREE.BufferAttribute( vertices, 3 ) );
      geometry.getAttribute("position").dynamic = true;

      //geometry.computeLineDistances();
      var mesh = new THREE.Line( geometry, material );
      mesh.layers.enable( 0 );
      mesh.layers.enable( 1 );

      mesh.geometry.dynamic = true;
      mesh.geometry.verticesNeedUpdate = true;

      this._object3D.add( mesh );

      this._meshMustRebuild = false;
    }
  }


  /**
  * [PRIVATE]
  * Builds the annotation, no matter if point or line.
  */
  _buildAnnotationObject3D(){
    // this annotation is corrupted
    if( ! this._isValid ){
      console.warn("This annotation is not valid. Possible reasons: no points OR points number of dimension is not consistant.");
      return;
    }

    if(! this._object3D.children.length ){

      // this is a point
      if(this._points.length == 1 ){
        this._buildPointAnnotation();
      }
      // this is a linestring or a polygon
      else{
        this._buildLinestringAnnotation();
      }

    }else{
      console.warn("The object3D/mesh for this annotation is already built. Maybe use a modifying method instead.");
      return;
    }
  }


  /**
  * [PRIVATE]
  * remove all the childrens from the graphic representation of this annot.
  * This is useful when a single-point annot turns into a line annot and vice-versa.
  */
  flushObject3D(){
    var that = this;

    this._object3D.children.forEach(function(child){
      that._object3D.remove( child );
    });
  }


  /**
  * When we want to close a linstring. Basically adds a point at the end and switch the isClosed boolean.
  */
  closeLinestring(){
    // cannot close it if already closed
    if(this._isClosed){
      console.warn("The annotation linestring is already closed.");
      return;
    }

    // an annot needs at least 3 points to be closed
    if( this._points.length > 2 ){
      this._isClosed = true;

      this.addPoint( this._points[ this._points.length - 1 ] );
    }
  }


  /**
  * @return {String} the name of this annotation
  */
  getName(){
    return this._name;
  }

  /**
  * update the name of this annotation.
  * @param {String} name - the new name
  */
  updateName( name ){
    this._name = name;
    var mesh = this._object3D.name = name;
  }


  /**
  * @return {String} the description of this annotation
  */
  getDescription(){
    return this._description;
  }

  /**
  * Update the description.
  * @param {String} d - the new description
  */
  updateDescription( d ){
    this._description = d;
    this._object3D.userData.description = d;
  }


  /**
  * @return {String} the color of the annotation in hexadecimal
  */
  getColor(){
    return this._color;
  }


  /**
  * Update the color.
  * @param {String} c - should be like "FF0000" or "#FF0000"
  */
  updateColor( c ){
    this._color = c;

    if( this._color[0] != "#"){
      this._color = "#" + this._color;
    }

    if(this._object3D.children.length){
      this._object3D.children[0].material.color.set( this._color );
    }
  }


  /**
  * @return {Number} the number of points in this annotation
  */
  getNummberOfPoints(){
    return this._points.length;
  }


/*
TODO
make sure if you use scene.remove(mesh), you also call mesh.geometry.dispose(), mesh.material.dispose() and mesh.texture.dispose() else you'll get memory leaks I think (r71)
*/

} /* END of class Annotation */

/**
* An annotation collection contains uniquely named Annotation instances as well
* as a container for their 3D representations.
* When adding a new annotation, its name must not be already in the collection.
* Still, when a name is not specified, a timestamp-based name is automatically
* picked.
*/
class AnnotationCollection {

  /**
  * Build an empty collection
  */
  constructor(){
    this._collection = {};

    // contains all the Object3D of Annotation instances
    this._container3D = new THREE.Object3D();
    this._container3D.name = "annotation collection";

    this._noNameIncrement = 0;
    this._onAddingAnnotationCallback = null;

    this._annotCreationEnabled = false;
    this._tempAnnotation = null;
  }


  /**
  *
  */
  getContainer3D(){
    return this._container3D;
  }


  /**
  * Add an annotation to the collection
  * @param {Array of Array} points - Array of [x, y, z], if only one, its a point otherwise it can be a linestring (default) or polygon (options.closed must be true)
  * @param {String} name - name, suposedly unique
  * @param {Object} options - all kind of options:
  * isClosed {Boolean} makes the diff between a linestring and a polygon - default: false,
  * description {String} optionnal - default: '',
  * color {String} - default: "FF0000",
  * eulerAngle {Array} rotation correction [x, y, z] - default: [0, 0, 0],
  * scale {Array} scale correction [x, y, z] - default: [1, 1, 1],
  * position {Array} offset [x, y, z] - default: [0, 0, 0]
  */
  addAnnotation(points, name, options = {}){
    if( name in this._collection){
      console.warn(name + " is already in the collection");
      return;
    }

    // if no name, we make one
    name = name || this._getNewAnnotationName();

    // add the new annotation to the collection
    this._collection[ name ] = new Annotation( points, name, options);

    // add the visual object to Object3D container
    this._container3D.add( this._collection[ name ].getObject3D() );

    // a nice callback to do something (mainly from the UI view point)
    if(this._onAddingAnnotationCallback){
      this._onAddingAnnotationCallback( name );
    }
  }


  /**
  * Get an annotation from the collection
  * @param {String} name - name/ID of the annotation within the collection
  * @return {Annotation} the requested annotation object
  */
  getAnnotation( name ){
    if(! (name in this._collection)){
      console.warn("No annotation named " + name + " in the collection.");
      return null;
    }
    
    return this._collection[ name ];
    
  }

  /**
  * Add to collection the temporary annotation that is currently being created.
  */
  addTemporaryAnnotation(){
    if( this._annotCreationEnabled && this._tempAnnotation ){
      // only adds if the annot contains points
      if( this._tempAnnotation.getNummberOfPoints() ){
        this._collection[ this._tempAnnotation.getName() ] = this._tempAnnotation;
      }else{
        console.warn("The temporary annotation cannot be added to the collection because it is empty.");
      }

      this._tempAnnotation = null;
      this.disableAnnotCreation();
    }
  }


  /**
  * [PRIVATE]
  * returns an incremental fake name so that our annotation does not remain unnamed.
  */
  _getNewAnnotationName(){
    this._noNameIncrement ++;
    return new Date().toISOString() + "_" + this._noNameIncrement;
  }


  /**
  * Remove the anotation from the collection.
  * @param {String} name - name of the annotation to remove (unique)
  */
  removeAnnotation( name ){
    if(! (name in this._collection) ){
      console.warn(name + " annotation is not in the collection. Impossible to remove.");
      return;
    }

    // remove the 3D representation
    this._container3D.remove( this._collection[ name ].getObject3D() );

    // remove the logic object
    delete this._collection[ name ];
  }


  /**
  * Load an annotation file to add its content to the collection.
  * @param {Object} config - contains config.url and may contain more attributes in the future.
  */
  loadAnnotationFileURL( config, isCompressed = false ){
    var that = this;

    var loadingFunction = isCompressed ? AjaxFileLoader.loadCompressedTextFile : AjaxFileLoader.loadTextFile;

    loadingFunction(
      config.url,

      // success load
      function( data ){
        that._loadAnnotationFileContent( data );
      },

      // fail to load
      function( errorInfo ){
        console.warn("Couldnt load the annotation file: " + config.url);

      }
    );
  }


  /**
  * Read and parse the content if a File object containg json annotations.
  * @param {File} file - HTML5 File object, most likely opened using a file dialog
  */
  loadAnnotationFileDialog( annotFile ){
    var that = this;

    var fr = new FileReader();
    fr.onload = function(e){
      //var jsonObj = JSON.parse(e.target.result);
      that._loadAnnotationFileContent( e.target.result );
      //console.log(jsonObj);
    };

    fr.readAsText(annotFile);
  }


  /**
  * [PRIVATE]
  * Generic method to load the string content of an annotation file.
  * This way we can use it no matter if loading from url/ajax or from html5File/dialog.
  */
  _loadAnnotationFileContent( jsonStr ){
    var that = this;
    // attributes to dig in the annotation file
    var annotKeys = ["color", "description", "isClosed", "eulerAngle", "scale", "position"];

    var annotObj = JSON.parse( jsonStr );
    annotObj.annotations.forEach( function( annot ){

      // if an annot has no points, we dont go further
      if( !("points" in annot) || (annot.points.length == 0)){
        return;
      }

      // to be filled on what we find in the annot file
      var optionObj = {};
      var name = ("name" in annot) ? annot.name : null;

      // collecting the option data
      annotKeys.forEach(function(key){
        if( key in annot ){
          optionObj[ key ] = annot[ key ];
        }
      });

      // add to collection
      that.addAnnotation(annot.points, name, optionObj);
    });
  }


  /**
  * Defines a callback to when a new annotation is added.
  * This callback is called with the name of the annotation (unique).
  * @param {function} cb - callback
  */
  onAddingAnnotation( cb ){
    this._onAddingAnnotationCallback = cb;
  }


  /**
  * Init a temporary annotation with a single point.
  * @param {THREE.Vector3} firstPoint - a threejs vector
  */
  createTemporaryAnnotation( firstPoint ){
    if( this._tempAnnotation ){
      console.warn("A temporaray annotation is already created. Validate it or discard it before creating a new one.");
      return;
    }

    if( ! this._annotCreationEnabled ){
      console.warn("annotation creation must be enabled first. Call enableAnnotCreation()");
      return;
    }

    this._tempAnnotation = new Annotation(
      [ [firstPoint.x, firstPoint.y, firstPoint.z] ],
      this._getNewAnnotationName(),
      {
        description: "No description yet",
        isClosed: false
      }
    );

    // add the visual object to Object3D container
    this._container3D.add( this._tempAnnotation.getObject3D() );

  }


  /**
  * Delete the temporaray annotation, meaning reseting the logic object but also
  * clearing up its graphical representation.
  */
  deleteTemporaryAnnotation(){
    if(! this._tempAnnotation ){
      console.warn("No temporary annotation to delete.");
      return;
    }

    // remove the 3D representation
    this._container3D.remove( this._tempAnnotation.getObject3D() );

    // remove the logic object
    this._tempAnnotation = null;
  }


  /**
  * Get the temporary annotation.
  * @return {Annotation}
  */
  getTemporaryAnnotation(){
    return this._tempAnnotation;
  }


  /**
  * Enable the begning of creating a new annotation
  */
  enableAnnotCreation(){
    this._annotCreationEnabled = true;
  }


  /**
  * Disable the annotation creation
  */
  disableAnnotCreation(){
    this._annotCreationEnabled = false;
  }


  /**
  * @return true if the annottaion creation process has started
  */
  isAnnotCreationEnabled(){
    return this._annotCreationEnabled;
  }

} /* END of class AnnotationCollection */

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


    // refresh uniform every half sec
    setInterval(function(){
      if(that._ready){
        that._planeManager.updateUniforms();
      }
    }, 1000);


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
    );

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
    this._refreshUniformsCounter = 100;
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

    this._render();

    if(this._stats){
      this._stats.update();
    }

    if( this._refreshUniformsCounter && this._ready){
      this._planeManager.updateUniforms();
      this._refreshUniformsCounter --;

      // updating the control is necessary in the case of a TrackballControls
      this._quadViews[3].updateControl();
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

    // TODO: make somethink better for refresh once per sec!
    if(this._ready){
      //this._planeManager.updateUniforms();

      // refresh each view
      this._quadViews.forEach(function(view){
        view.renderView();
      });


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
      that._planeManager.updateUniforms();
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
      that._planeManager.updateUniforms();
      //that._render();
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

exports.HashIO = HashIO;
exports.QuadScene = QuadScene;

Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=shadernavigator.js.map
