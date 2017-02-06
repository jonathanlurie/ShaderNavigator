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

    // Annotations
    this._annotationCollection = this._quadScene.getAnnotationCollection();

    var panelWidth = 200;
    var panelSpace = 5;

    this._mainPanel = QuickSettings.create(panelSpace, 0, document.title);

    this._annotationPanel = QuickSettings.create(panelWidth + panelSpace*2 , 0, "Annotations");

    this._initMainPanel();
    this._initAnnotationPanel();
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
    this._mainPanel.addText("Position", "", function(){} );
    this._mainPanel.overrideStyle("Position", "text-align", "center");

    // multiplane rotation
    this._mainPanel.addText("Rotation", "", function(){} );
    this._mainPanel.overrideStyle("Rotation", "margin-top", "0px");
    this._mainPanel.overrideStyle("Rotation", "text-align", "center");
    document.getElementById("Rotation").parentElement.style["margin-top"] = "0px";

    // apply button for multiplane position and rotation
    this._mainPanel.addButton("Apply", function(){
      var newPosition = that._mainPanel.getValue("Position")
        .split(',')
        .map(function(elem){return parseFloat(elem)});

      var newRotation = that._mainPanel.getValue("Rotation")
        .split(',')
        .map(function(elem){return parseFloat(elem)});

      that._quadScene.setMultiplaneRotation(newRotation[0], newRotation[1], newRotation[2]);
      that._quadScene.setMultiplanePosition(newPosition[0], newPosition[1], newPosition[2]);


    });

    this._mainPanel.overrideStyle("Apply", "width", "100%");
    document.getElementById("Apply").parentElement.style["margin-top"] = "0px";

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
    positionString += spaceConfig.position.z.toFixed(4)
    this._mainPanel.setValue("Position", positionString);

    var rotationString = spaceConfig.rotation.x.toFixed(4) + ' , ';
    rotationString += spaceConfig.rotation.y.toFixed(4) + ' , ';
    rotationString += spaceConfig.rotation.z.toFixed(4)
    this._mainPanel.setValue("Rotation", rotationString);
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
      });

    // dropdown menu
    this._annotationPanel.addDropDown("Annotations", [],
      function( dropdownObj ){
        console.log( dropdownObj.value );
      }
    );



  }


}/* END class GuiController */

export { GuiController };
