'use strict'

class GuiController{

  constructor( quadScene ){

    this._quadScene = quadScene;
    this._datGui = new dat.GUI();

    // fake value for dat gui - just to display the init value
    this._resolutionLevel = this._quadScene.getResolutionLevel();

    // special controller for colormaps
    this._colormapController = null;

    this._colormapChoice = 0;

    this._colormapManager = this._quadScene.getColormapManager();
    this._colormapManager.onColormapUpdate( this._updateColormapList.bind(this) );

    this._initActions();
  }


  /**
  * [PRIVATE]
  * Adds buttons to the widget
  */
  _initActions(){
    var that = this;

    this._datGui.add(this, '_toggleOrientationHelper').name("Toggle compass");
    this._datGui.add(this, '_toggleBoundingBoxHelper').name("Toggle box");

    // TODO: add a listner on the resolution lvl so that it's updated

    this._datGui.add(this, "_resolutionLevel", 0, 6).name("Resolution level").step(1).listen()
      .onFinishChange(function(lvl) {
        that._quadScene.setResolutionLevel(lvl);
      });
  }


  /**
  * [PRIVATE]
  * Action to toggle the orientation helper
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
  }


  /**
  * [PRIVATE] callback
  * Update the colormap list box and the dedicated callback for when the colormap
  * changes.
  */
  _updateColormapList(){
    var that = this;

    if( this._colormapController ){
      this._datGui.remove(this._colormapController);
      this._colormapController = null;
    }

    this._colormapController = this._datGui.add(
      this,
      '_colormapChoice',
      this._colormapManager.getAvailableColormaps()
    ).name("Color map");

    this._colormapController.onFinishChange(function(colormapId) {
      that._colormapManager.useColormap(colormapId)
    });

  }

}/* END class GuiController */

export { GuiController };
