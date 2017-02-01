'use strict'

class GuiController{

  constructor( quadScene ){

    this._quadScene = quadScene;


    //this._datGui = new dat.GUI();

    // fake value for dat gui - just to display the init value
    this._resolutionLevel = this._quadScene.getResolutionLevel();
    this._resolutionLvlRange = [0, 6];
    this._resolutionLvlSliderBuilt = false;
    this._resolutionDescription = '';


    // special controller for colormaps
    this._colormapManager = this._quadScene.getColormapManager();
    this._colormapManager.onColormapUpdate( this._updateColormapList.bind(this) );


    this._mainPanel = QuickSettings.create(window.innerWidth - 250, 0, document.title);



    this._initActions();
  }


  /**
  * [PRIVATE]
  * Adds buttons to the widget
  */
  _initActions(){
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

    // multiplane position
    this._mainPanel.addText("Position", "", null );

    // multiplane rotation
    this._mainPanel.addText("Orientation", "", null );
    this._mainPanel.overrideStyle("Orientation", "margin-top", "0px");
    document.getElementById("Orientation").parentElement.style["margin-top"] = "0px";

    // apply button for multiplane position and rotation
    this._mainPanel.addButton("Apply", function(){

    });
    this._mainPanel.overrideStyle("Apply", "width", "100%");
    document.getElementById("Apply").parentElement.style["margin-top"] = "0px";

    // Button reset orientation
    this._mainPanel.addButton("Reset orientation", function(){
      that._quadScene.setMultiplaneRotation(0, 0, 0);
    });
    this._mainPanel.overrideStyle("Reset orientation", "width", "100%");
    document.getElementById("Reset orientation").parentElement.style["margin-top"] = "0px";

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
    this._mainPanel.setValue("Zoom level", lvl);
    this._updateResolutionDescription( this._resolutionLevel );
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
      }
    );

  }


}/* END class GuiController */

export { GuiController };
