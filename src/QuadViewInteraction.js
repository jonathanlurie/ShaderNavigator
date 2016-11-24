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

    this._mouse = {x:0, y:0};
  }


  /**
  * Updates the position of the mouse pointer with x and y in [0, 1] with origin at the bottom left corner.
  * Updating the mouse position may trigger some events like orbit/trackball control activation
  */
  updateMousePosition(x, y){
    this._mouse = {x:x, y:y};

    this._manageQuadViewsMouseActivity();
  }


  /**
  * For each QuadView instance, trigger things depending on how the mouse pointer interact with a quadview.
  */
  _manageQuadViewsMouseActivity(){
    var that = this;
    var x = this._mouse.x;
    var y = this._mouse.y;

    this._quadViews.forEach(function(qv){

      // the pointer is within the QuadView window
      if(qv.isInViewWindow(x, y)){

        console.log(qv._viewName);
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
