'use strict';

/**
* An instance of ColorMapManager is used to load color maps and retrive them.
* A certain amount of default color maps is available but curtom maps can also be added.
* Each texture is stored as a THREE.Texture and are loaded with THREE.TextureLoader.
*/
class ColorMapManager{

  /**
  * Loads the default colormaps.
  */
  constructor(){
    // default folder where the default colormaps are stored
    this._defaultMapFolder = "colormaps/";

    // default colormaps filename
    this._defaultMaps = [
      "plum.png",
      "thermal.png",
      "blue_klein.png",
      "blue_teal.png",
      "rainbow.png",
      "rainbow_alpha.png"
    ];

    // map of colormaps. The keys are colormap file (no extension) and the objects are THREE.Texture
    this._colorMaps = {};

    this._onColormapUpdateCallback = null;

    // The current color map is defined by a name/id and a THREE.Texture
    this._currentColormap = {id: "none", colormap: null};

    // False to if we decide to use a colormap, true to use a colormap
    this._isEnabled = false;

    // single object to load all the textures
    this._textureLoader = new THREE.TextureLoader();

    this._colorMaps["none"] = null;
    this._loadDefaultColormaps();
  }


  /**
  * Load a new colormap from a file and add it to the list.
  * @param {String} filename - url or the colormap file.
  * @param {bool} setCurrent - true to use this one as default, false not to.
  */
  loadColormap(filename, setCurrent=true){
    var that = this;

    // get the basename (no extension)
    var basename = new String(filename).substring(filename.lastIndexOf('/') + 1);
    if(basename.lastIndexOf(".") != -1)
        basename = basename.substring(0, basename.lastIndexOf("."));

    this._textureLoader.load(
      filename,

      // success
      function ( texture ) {
        // add to the map of colormaps
        that._colorMaps[basename] = texture;

        if(setCurrent){
          // make it the current in use
          that._currentColormap.id = basename;
          that._currentColormap.colormap = texture;
        }

        if(that._onColormapUpdateCallback){
          that._onColormapUpdateCallback();
        }

      },

      // Function called when download progresses
      function ( xhr ) {
        //console.log( (xhr.loaded / xhr.total * 100) + '% loaded' );
      },

      // Function called when download errors
      function ( xhr ) {
        console.error( 'Failed to load ' + filename );
      }

    );

  }


  /**
  * [PRIVATE]
  * Loads all the default textures.
  */
  _loadDefaultColormaps(){
    var that = this;

    // for each colormap to be loaded
    this._defaultMaps.forEach(function( texFilename, index ){
      // loading the colormap
      that.loadColormap(
        that._defaultMapFolder + texFilename,
        false
      );
    });
  }


  /**
  * @return the colormap that is currently in use as an object {id, colormap}
  */
  getCurrentColorMap(){
    return this._currentColormap;
  }


  /**
  * @returns true if a colormap is supposed to be used, returns false if not
  */
  isColormappingEnabled(){
    return this._isEnabled;
  }


  /**
  * Activates color mapping. If no colormap has ever been explicitly mentioned as "in use", then the first of the default colormaps is the one to go with.
  */
  enableColorMapping(){
    this._isEnabled = true;
  }


  disableColorMapping(){
    this._isEnabled = false;
  }


  /**
  * @returns a list of available colormaps IDs.
  */
  getAvailableColormaps(){
    return Object.keys( this._colorMaps );
  }


  /**
  * Enable a colormap by a given ID.
  * @param {String} id - the colormap ID must be valid.
  * @return true if success, return false if fail
  */
  useColormap(id){



    if(this._colorMaps.hasOwnProperty(id)){
      this._currentColormap.id = id;
      this._currentColormap.colormap = this._colorMaps[id];

      if(id == "none"){
        this.disableColorMapping();
      }else{

        // we considere that enabling a specific texture comes with
        // enabling the colormapping
        this.enableColorMapping();
      }
      return true;
    }
    return false;
  }


  onColormapUpdate(cb){
    this._onColormapUpdateCallback = cb;
  }


} /* END class ColorMapManager */

export { ColorMapManager };
