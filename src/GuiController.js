'use strict'

class GuiController{

  constructor( quadScene ){

    this._quadScene = quadScene;


    //this._datGui = new dat.GUI();

    // fake value for dat gui - just to display the init value
    this._resolutionLevel = this._quadScene.getResolutionLevel();
    this._resolutionLvlRange = [0, 6];
    this._resolutionLvlSlider = null;


    // special controller for colormaps
    this._colormapManager = this._quadScene.getColormapManager();
    this._colormapManager.onColormapUpdate( this._updateColormapList.bind(this) );


    this._controlKit = new ControlKit();

    // the main panel
    this._mainPanel = this._controlKit.addPanel({
      label: 'BigBrain Explorer',
      align : 'left',
      fixed: false,
      width: 250,
      position: [window.innerWidth - 250, 0]
    });

    this._initActions();
  }


  /**
  * [PRIVATE]
  * Adds buttons to the widget
  */
  _initActions(){
    var that = this;

    //this._datGui.add(this, '_toggleOrientationHelper').name("Toggle compass");
    //this._controlKit.addStringInput(this,'_toggleOrientationHelper',{label: 'Toggle compass'})
    // compass toggle
    this._mainPanel.addButton('Toggle compass',  this._toggleOrientationHelper.bind(this)  );

    // bounding box toggle
    this._mainPanel.addButton('Toggle bounding box',  this._toggleBoundingBoxHelper.bind(this)  );


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

    // last minute build because ControlKit does not allow to refresh
    // a slider value from the outside.
    if(!this._resolutionLvlSlider){
      this._buildResolutionLevelSlider()
    }

  }


  /**
  * [PRIVATE]
  * Last minute build of the resolution level slider. This is necessary because
  * ControlKit does not allow updating a value (and that sucks).
  */
  _buildResolutionLevelSlider(){
    var that = this;

    this._resolutionLvlSlider = this._mainPanel.addSlider(this, '_resolutionLevel', "_resolutionLvlRange",{
      label: 'Resolution',
      step: 1,
      dp: 0,
      onFinish: function(value){
        that._quadScene.setResolutionLevel( that._resolutionLevel );
      }
    })
  }


  /**
  * [PRIVATE] callback
  * Update the colormap list box and the dedicated callback for when the colormap
  * changes.
  */
  _updateColormapList(){
    var that = this;

    var colorMapSelect = {
      maps: this._colormapManager.getAvailableColormaps(),
      selection: null
    }

    colorMapSelect.selection = colorMapSelect.maps[0];

    this._mainPanel.addSelect(colorMapSelect,'maps',{
      label: "Colormap",
      target: "selection",
      onChange:function(index){
        that._colormapManager.useColormap(colorMapSelect.maps[index])
      }
    });

  }





}/* END class GuiController */

export { GuiController };
