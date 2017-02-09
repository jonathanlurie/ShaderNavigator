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
    this._initAnnotationPanelCallback();
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
      }
    );

    // save annot button
    this._annotationPanel.addButton("Export annotations", null);
    this._annotationPanel.overrideStyle("Export annotations", "width", "100%");
    document.getElementById("Export annotations").parentElement.style["margin-top"] = "0px";

    // dropdown menu
    this._annotationPanel.addDropDown("Annotations", [],
      function( dropdownObj ){
        console.log( dropdownObj.value );
      }
    );



    // callback when a new annot is added in the core, a new item shows on the menu
    that._annotationCollection.onAddingAnnotation( function(name){
      that._annotationPanel.getControl("Annotations").addItem(name);
      console.log( name );
    })

    /*
    this._annotationPanel.getControl("Annotations").removeItem("pouet2");
    */

    // editable field for annotation name
    this._annotationPanel.addText("Annotation name", "", function(){} );
    this._annotationPanel.overrideStyle("Annotation name", "text-align", "center");

    // editable description of the annot
    this._annotationPanel.addTextArea("Annotation description", "", function(){} );
    document.getElementById("Annotation description").parentElement.style["margin-top"] = "0px";

    // Pannel of buttons for dealing with existing annot
    this._annotationPanel.addHTML("panelEditExistingAnnot", this._buildPanelEditExistingAnnot());
    document.getElementById("panelEditExistingAnnot").parentElement.style["margin-top"] = "0px";


    // Button to create a new annotation
    this._annotationPanel.addButton("Start new annotation", function(){
      // show and hide the relevant componants
      that._annotationPanel.hideControl("panelEditExistingAnnot");
      that._annotationPanel.showControl("panelCreateAnnot");
      that._annotationPanel.showControl("Validate annotation");
      that._annotationPanel.hideControl("Start new annotation");

      // prevent the user from doing stupid interactions
      that._annotationPanel.disableControl("Annotations");
      that._annotationPanel.disableControl("Export annotations");
      that._annotationPanel.disableControl("Annotation file");


    });
    this._annotationPanel.overrideStyle("Start new annotation", "width", "100%");

    // Button to validate a homemade annotation
    this._annotationPanel.addButton("Validate annotation", function(){
      // show and hide the relevant componants
      that._annotationPanel.showControl("panelEditExistingAnnot");
      that._annotationPanel.hideControl("panelCreateAnnot");
      that._annotationPanel.hideControl("Validate annotation");
      that._annotationPanel.showControl("Start new annotation");

      // allow the user to interact
      that._annotationPanel.enableControl("Annotations");
      that._annotationPanel.enableControl("Export annotations");
      that._annotationPanel.enableControl("Annotation file");


    });
    this._annotationPanel.overrideStyle("Validate annotation", "width", "100%");
    this._annotationPanel.hideControl("Validate annotation");

    // homemade annot options
    this._annotationPanel.addHTML("panelCreateAnnot", this._buildPanelCreateAnnot());
    document.getElementById("panelCreateAnnot").parentElement.style["margin-top"] = "0px";
    this._annotationPanel.hideControl("panelCreateAnnot");
  }


  /**
  * [PRIVATE]
  * Builds the HTML edit panel for annotations
  */
  _buildPanelEditExistingAnnot(){
    var htmlStr = `
    <div>
      <i id="existingAnnotValidate" class="fa fa-check small-icon" aria-hidden="true"></i>
      <i id="existingAnnotToggleView" class="fa fa-eye small-icon" aria-hidden="true"></i>
      <i id="existingAnnotTarget" class="fa fa-crosshairs small-icon" aria-hidden="true"></i>
      <i id="existingAnnotColorPicker" class="fa fa-paint-brush small-icon" aria-hidden="true"></i>
      <i  id="existingAnnotDelete" class="fa fa-trash small-icon" aria-hidden="true"></i>
    </div>
    `;

    return htmlStr;
  }


  /**
  * [PRIVATE]
  * Builds the pannel with buttons to create a new annotation
  */
  _buildPanelCreateAnnot(){
    var htmlStr = `
    <div>
      <i id="newAnnotUndo" class="fa fa-undo small-icon" aria-hidden="true"></i>
      <i id="newAnnotPaintColorPicker" class="fa fa-paint-brush small-icon" aria-hidden="true"></i>
      <i id="newAnnotDelete" class="fa fa-trash small-icon" aria-hidden="true"></i>
    </div>
    `;

    return htmlStr;
  }


  _initAnnotationPanelCallback(){

    // existing annotations -------------------------

    // check - validate the change of name/description if any
    document.getElementById("existingAnnotValidate").onclick = function(e){
      console.log(e);
    }

    // eye - show/hide the annot
    document.getElementById("existingAnnotToggleView").onclick = function(e){
      console.log(e);
    }

    // target - center the annot
    document.getElementById("existingAnnotTarget").onclick = function(e){
      console.log(e);
    }

    // paint brush - change annot color
    document.getElementById("existingAnnotColorPicker").onclick = function(e){
      console.log(e);
    }

    // trashbin - delete the annot
    document.getElementById("existingAnnotDelete").onclick = function(e){
      console.log(e);
    }

    // new annotations -------------------------

    // Undo - remove the last point added
    document.getElementById("newAnnotUndo").onclick = function(e){
      console.log(e);
    }

    // Paint brush - change color of the annot
    document.getElementById("newAnnotPaintColorPicker").onclick = function(e){
      console.log(e);
    }

    // trashbin - delete the annot
    document.getElementById("newAnnotDelete").onclick = function(e){
      console.log(e);
    }

  }


}/* END class GuiController */

export { GuiController };
