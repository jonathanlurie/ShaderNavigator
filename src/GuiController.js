'use strict'

class GuiController{

  constructor( quadScene ){

    this._quadScene = quadScene;


    //this._datGui = new dat.GUI();

    // fake value for dat gui - just to display the init value
    this._resolutionLevel = this._quadScene.getResolutionLevel();
    this._resolutionLevelTemp = this._resolutionLevel;
    this._resolutionLvlRange = [0, 6];
    this._resolutionLvlSliderBuilt = false;
    this._resolutionDescription = '';


    // special controller for colormaps
    this._colormapManager = this._quadScene.getColormapManager();
    this._colormapManager.onColormapUpdate( this._updateColormapList.bind(this) );


    this._controlKit = new ControlKit();

    // the main panel
    this._mainPanel = this._controlKit.addPanel({
      label: document.title,  // default title, like the page
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

    var helperSubGroup = this._mainPanel.addSubGroup({label: 'Helpers', enable: false})
    helperSubGroup.addButton('Toggle compass',  this._toggleOrientationHelper.bind(this)  );
    helperSubGroup.addButton('Toggle bounding box',  this._toggleBoundingBoxHelper.bind(this)  );


    this._navigationSubGroup = this._mainPanel.addSubGroup({label: 'Navigation', enable: true});
    console.log(this._navigationSubGroup);

    this._navigationSubGroup.addButton(
      'Reset orientation',
      this._resetMultiplaneRotation.bind(this)
    );


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
    //this._resolutionDescription = "lalal";
    //this._controlKit.update();
  }


  /**
  * Update the UI with a new resolution level.
  * This does not do anything but refreshing the display
  * (iow. calling this method does NOT change the rez lvl)
  */
  updateResolutionLevelUI( lvl ){
    this._resolutionLevel = lvl;
    this._resolutionLevelTemp = this._resolutionLevel;


    // last minute build because ControlKit does not allow to refresh
    // a slider value from the outside.
    if(!this._resolutionLvlSliderBuilt){
      this._buildResolutionLevelSlider();
      this._resolutionLvlSliderBuilt = true;
    }

    this._updateResolutionDescription( this._resolutionLevel );

  }


  /**
  * [PRIVATE]
  * update the description of resolution level
  */
  _updateResolutionDescription( lvl, prefix="" ){
    this._resolutionDescription = prefix + this._quadScene.getLevelManager().getLevelInfo(lvl, "key");
    this._controlKit.update();
  }


  /**
  * [PRIVATE]
  * Last minute build of the resolution level slider. This is necessary because
  * ControlKit does not allow updating a value (and that sucks).
  */
  _buildResolutionLevelSlider(){
    var that = this;

      this._navigationSubGroup.addSlider(this, '_resolutionLevel', "_resolutionLvlRange",{
      label: 'Zoom level',
      step: 1,
      dp: 0,

      // update the display only while moving the slider
      onChange: function(value){
        that._updateResolutionDescription(
          that._resolutionLevel,
          that._quadScene.getLevelManager().getLevelInfo(that._resolutionLevelTemp, "key") + " ➤ " );
      },

      // when mouse release onthe slider
      onFinish: function(value){
        that._quadScene.setResolutionLevel( that._resolutionLevel );
      }
    })

    this._navigationSubGroup.addStringOutput(this, '_resolutionDescription',{label: "Resolution"})

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

    var ColormapsSubGroup = this._mainPanel.addSubGroup({label: 'Colormaps', enable: false});

    ColormapsSubGroup.addSelect(colorMapSelect,'maps',{
      label: "Choose",
      target: "selection",
      onChange:function(index){
        that._colormapManager.useColormap(colorMapSelect.maps[index])
      }
    });

  }


  _resetMultiplaneRotation(){
    this._quadScene.setMultiplaneRotation(0, 0, 0);
  }

}/* END class GuiController */

export { GuiController };
