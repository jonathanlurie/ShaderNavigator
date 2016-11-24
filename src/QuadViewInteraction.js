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

    document.addEventListener( 'mousemove', this._onMouseMove.bind(this), false );
    document.addEventListener( 'mousedown', this._onMouseDown.bind(this), false );
    document.addEventListener( 'mouseup', this._onMouseUp.bind(this), false );

    // function to be called when the mouse is pressed on a view.
    this._onGrabViewCallback = null;
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


    if(this._mousePressed){

      // first time, init
      if(this._mouseLastPosition.x == -1){
        this._mouseLastPosition.x = this._mouse.x;
        this._mouseLastPosition.y = this._mouse.y;
      }
      // regular time
      else{
        this._mouseDistance // TODO
      }

    }

  }


  /**
  * [PRIVATE]
  * callback to the mousedown event
  */
  _onMouseDown( event ){
    this._mousePressed = true;
    this._indexViewMouseDown = this._indexCurrentView;
  }


  /**
  * [PRIVATE]
  * callback to the mouseup event
  */
  _onMouseUp( event ){
    this._mousePressed = false;
    this._indexViewMouseDown = -1;
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



} /* END class QuadViewInteraction */

export { QuadViewInteraction };
