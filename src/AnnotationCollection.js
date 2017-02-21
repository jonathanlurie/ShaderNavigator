'use strict'

import { Annotation } from './Annotation.js';
import { AjaxFileLoader } from './AjaxFileLoader.js';


/**
* An annotation collection contains uniquely named Annotation instances as well
* as a container for their 3D representations.
* When adding a new annotation, its name must not be already in the collection.
* Still, when a name is not specified, a timestamp-based name is automatically
* picked.
*/
class AnnotationCollection {

  /**
  * Build an empty collection
  */
  constructor(){
    this._collection = {};

    // contains all the Object3D of Annotation instances
    this._container3D = new THREE.Object3D();
    this._container3D.name = "annotation collection";

    this._noNameIncrement = 0;
    this._onAddingAnnotationCallback = null;

    this._annotCreationEnabled = false;
    this._tempAnnotation = null;
  }


  /**
  *
  */
  getContainer3D(){
    return this._container3D;
  }


  /**
  * Add an annotation to the collection
  * @param {Array of Array} points - Array of [x, y, z], if only one, its a point otherwise it can be a linestring (default) or polygon (options.closed must be true)
  * @param {String} name - name, suposedly unique
  * @param {Object} options - all kind of options:
  * isClosed {Boolean} makes the diff between a linestring and a polygon - default: false,
  * description {String} optionnal - default: '',
  * color {String} - default: "FF0000",
  * eulerAngle {Array} rotation correction [x, y, z] - default: [0, 0, 0],
  * scale {Array} scale correction [x, y, z] - default: [1, 1, 1],
  * position {Array} offset [x, y, z] - default: [0, 0, 0]
  */
  addAnnotation(points, name, options = {}){
    if( name in this._collection){
      console.warn(name + " is already in the collection");
      return;
    }

    // if no name, we make one
    name = name || this._getNewAnnotationName();

    // add the new annotation to the collection
    this._collection[ name ] = new Annotation( points, name, options);

    // add the visual object to Object3D container
    this._container3D.add( this._collection[ name ].getObject3D() );

    // a nice callback to do something (mainly from the UI view point)
    if(this._onAddingAnnotationCallback){
      this._onAddingAnnotationCallback( name );
    }
  }


  /**
  * Add to collection the temporary annotation that is currently being created.
  */
  addTemporaryAnnotation(){
    if( this._annotCreationEnabled && this._tempAnnotation ){
      // only adds if the annot contains points
      if( this._tempAnnotation.getNummberOfPoints() ){
        this._collection[ this._tempAnnotation.getName() ] = this._tempAnnotation;
      }else{
        console.warn("The temporary annotation cannot be added to the collection because it is empty.");
      }

      this._tempAnnotation = null;
      this.disableAnnotCreation();
    }
  }


  /**
  * [PRIVATE]
  * returns an incremental fake name so that our annotation does not remain unnamed.
  */
  _getNewAnnotationName(){
    this._noNameIncrement ++;
    return new Date().toISOString() + "_" + this._noNameIncrement;
  }


  /**
  * Remove the anotation from the collection.
  * @param {String} name - name of the annotation to remove (unique)
  */
  removeAnnotation( name ){
    if(! (name in this._collection) ){
      console.warn(name + " annotation is not in the collection. Impossible to remove.");
      return;
    }

    // remove the 3D representation
    this._container3D.remove( this._collection[ name ].getObject3D() );

    // remove the logic object
    delete this._collection[ name ];
  }


  /**
  * Load an annotation file to add its content to the collection.
  * @param {Object} config - contains config.url and may contain more attributes in the future.
  */
  loadAnnotationFileURL( config, isCompressed = false ){
    var that = this;

    var loadingFunction = isCompressed ? AjaxFileLoader.loadCompressedTextFile : AjaxFileLoader.loadTextFile;

    loadingFunction(
      config.url,

      // success load
      function( data ){
        that._loadAnnotationFileContent( data );
      },

      // fail to load
      function( errorInfo ){
        console.warn("Couldnt load the annotation file: " + config.url);

      }
    );
  }


  /**
  * Read and parse the content if a File object containg json annotations.
  * @param {File} file - HTML5 File object, most likely opened using a file dialog
  */
  loadAnnotationFileDialog( annotFile ){
    var that = this;

    var fr = new FileReader();
    fr.onload = function(e){
      //var jsonObj = JSON.parse(e.target.result);
      that._loadAnnotationFileContent( e.target.result );
      //console.log(jsonObj);
    };

    fr.readAsText(annotFile);
  }


  /**
  * [PRIVATE]
  * Generic method to load the string content of an annotation file.
  * This way we can use it no matter if loading from url/ajax or from html5File/dialog.
  */
  _loadAnnotationFileContent( jsonStr ){
    var that = this;
    // attributes to dig in the annotation file
    var annotKeys = ["color", "description", "isClosed", "eulerAngle", "scale", "position"];

    var annotObj = JSON.parse( jsonStr );
    annotObj.annotations.forEach( function( annot ){

      // if an annot has no points, we dont go further
      if( !("points" in annot) || (annot.points.length == 0)){
        return;
      }

      // to be filled on what we find in the annot file
      var optionObj = {};
      var name = ("name" in annot) ? annot.name : null;

      // collecting the option data
      annotKeys.forEach(function(key){
        if( key in annot ){
          optionObj[ key ] = annot[ key ];
        }
      });

      // add to collection
      that.addAnnotation(annot.points, name, optionObj);
    });
  }


  /**
  * Defines a callback to when a new annotation is added.
  * This callback is called with the name of the annotation (unique).
  * @param {function} cb - callback
  */
  onAddingAnnotation( cb ){
    this._onAddingAnnotationCallback = cb;
  }


  /**
  * Init a temporary annotation with a single point.
  * @param {THREE.Vector3} firstPoint - a threejs vector
  */
  createTemporaryAnnotation( firstPoint ){
    if( this._tempAnnotation ){
      console.warn("A temporaray annotation is already created. Validate it or discard it before creating a new one.");
      return;
    }

    if( ! this._annotCreationEnabled ){
      console.warn("annotation creation must be enabled first. Call enableAnnotCreation()");
      return;
    }

    this._tempAnnotation = new Annotation(
      [ [firstPoint.x, firstPoint.y, firstPoint.z] ],
      this._getNewAnnotationName(),
      {
        description: "No description yet",
        isClosed: false
      }
    );

    // add the visual object to Object3D container
    this._container3D.add( this._tempAnnotation.getObject3D() );

  }


  /**
  * Delete the temporaray annotation, meaning reseting the logic object but also
  * clearing up its graphical representation.
  */
  deleteTemporaryAnnotation(){
    if(! this._tempAnnotation ){
      console.warn("No temporary annotation to delete.");
      return;
    }

    // remove the 3D representation
    this._container3D.remove( this._tempAnnotation.getObject3D() );

    // remove the logic object
    this._tempAnnotation = null;
  }


  /**
  * Get the temporary annotation.
  * @return {Annotation}
  */
  getTemporaryAnnotation(){
    return this._tempAnnotation;
  }


  /**
  * Enable the begning of creating a new annotation
  */
  enableAnnotCreation(){
    this._annotCreationEnabled = true;
  }


  /**
  * Disable the annotation creation
  */
  disableAnnotCreation(){
    this._annotCreationEnabled = false;
  }


  /**
  * @return true if the annottaion creation process has started
  */
  isAnnotCreationEnabled(){
    return this._annotCreationEnabled;
  }

} /* END of class AnnotationCollection */

export { AnnotationCollection };
