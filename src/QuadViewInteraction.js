'use strict'

/**
* A QuadViewInteraction instance knows all the QuadView instance (aggregated in an array) and deals with all the interaction/controller side that a QuadView may need. This includes mouse/keyboard interaction on each view (independently) and possibly orbit/trackball control for QuadViews which enabled it.
*
*/
class QuadViewInteraction{

  /**
  * Build the QuadViewInteraction instance. Requires a list of QuadView instances.
  * @param {Array of QuadView} QuadViewArray - an array of QuadView.
  */
  constructor(QuadViewArray){
    this._quadViews = QuadViewArray;

    this._windowSize = {
      width: window.innerWidth ,
      height: window.innerHeight
    };

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

    // declaring some interaction events
    document.addEventListener( 'mousemove', this._onMouseMove.bind(this), false );
    document.addEventListener( 'mousedown', this._onMouseDown.bind(this), false );
    document.addEventListener( 'mouseup', this._onMouseUp.bind(this), false );
    document.addEventListener( 'keydown', this._onKeyDown.bind(this), false);
    document.addEventListener( 'keyup', this._onKeyUp.bind(this), false);

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

      default:;
    }

    if(this._onDonePlayingCallback){
      this._onDonePlayingCallback();
    }

  }


  /**
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



} /* END class QuadViewInteraction */

export { QuadViewInteraction };
