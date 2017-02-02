'use strict'

import { Annotation } from './Annotation.js';


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
  * name {String} must be unique or can be null (auto picked based on date),
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

    // if no name,
    if(!name){
      name = "annotation_" + this._noNameIncrement + "_" +  new Date().getMilliseconds();
      this._noNameIncrement ++;
    }

    // add the new annotation to the collection
    this._collection[ name ] = new Annotation( points, name, options);

    // add the visual object to Object3D container
    this._container3D.add( this._collection[ name ].getObject3D() );
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
  }

} /* END of class AnnotationCollection */

export { AnnotationCollection };
