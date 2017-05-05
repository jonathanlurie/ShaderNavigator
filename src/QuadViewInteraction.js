'use strict'

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
    }
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
        
      case "u": // UP
        console.log("u key");
        this._quadViews[ this._indexCurrentView ]._camera.rotateX ( 0.0001 );
        break;
        
      case "d": // UP
        console.log("u key");
        this._quadViews[ this._indexCurrentView ]._camera.rotateX ( -0.0001 );
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
    )

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

export { QuadViewInteraction };
