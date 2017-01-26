'use strict'

class GuiController{

  constructor( quadScene ){

    this._quadScene = quadScene;
    this._datGui = new dat.GUI();

    // fake value for dat gui - just to display the init value
    this._resolutionLevel = this._quadScene.getResolutionLevel();



    this._initActions();
  }

  _initActions(){
    var that = this;

    this._datGui.add(this, '_toggleOrientationHelper').name("Toggle compass");
    this._datGui.add(this, '_toggleBoundingBoxHelper').name("Toggle box");

    // TODO: add a listner on the resolution lvl so that it's updated

    this._datGui.add(this, "_resolutionLevel", 0, 6).name("resolutionLevel").step(1).listen()
      .onFinishChange(function(lvl) {
        that._quadScene.setResolutionLevel(lvl);
      });
  }

  /**
  * Action to toggle the orientation helper
  */
  _toggleOrientationHelper(){
    this._quadScene.getOrientationHelper().toggle();
  }


  _toggleBoundingBoxHelper(){
    this._quadScene.toggleCubeHull();
  }

  _changeResolutionLevel( v ){
    console.log(v);
  }


}/* END class GuiController */

export { GuiController };
