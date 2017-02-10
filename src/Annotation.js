'use strict'

/**
* An Annotation can be a single point, a segment, a linestring or a polygon.
* Each coordinate is in 3D [x, y, z] and can be represented in a 3D space after
* being converted into a proper THREEjs object.
*/
class Annotation{

  /**
  * Constructor of an annotation.
  * @param {Array of Array} points - Array of [x, y, z], if only one, its a point otherwise it can be a linestring (default) or polygon (options.closed must be true)
  * @param {String} name - name, suposedly unique
  * @param {Object} options - all kind of options: isClosed {Boolean}, description {String}, color {String} hexa like "#FF0000", eulerAngle {Array} rotation correction [x, y, z], scale {Array} scale correction [x, y, z], position {Array} offset [x, y, z]
  */
  constructor(points, name, options={}){

    this._points = points;
    this._name = name;
    this._isClosed = (typeof options.isClosed === 'undefined')? false : options.isClosed;
    this._description = (typeof options.description === 'undefined')? "" : options.description;
    this._color = (typeof options.color === 'undefined')? "#FF00FF" : options.color;
    if( this._color[0] != "#"){ this._color = "#" + this._color; }
    this._eulerAngle = (typeof options.eulerAngle === 'undefined')? [0, 0, 0] : options.eulerAngle;
    this._scale = (typeof options.scale === 'undefined')? [1, 1, 1] : options.scale;
    this._position = (typeof options.position === 'undefined')? [0, 0, 0] : options.position;

    this._isValid = false;
    this.validateAnnotation();

    this._pointRadius = 0.1;

    // visual object
    this._object3D = new THREE.Object3D();
    this._object3D.name = this._name;
    this._object3D.userData.description = this._description;
    this._object3D.userData.isClosed = this._isClosed;
    this._object3D.scale.set(this._scale[0], this._scale[1], this._scale[2]);
    this._object3D.position.set(this._position[0], this._position[1], this._position[2]);
    this._object3D.rotation.set(this._eulerAngle[0], this._eulerAngle[1], this._eulerAngle[2]);

    this._meshMustRebuild = true;

    this._buildAnnotationObject3D();
  }


  /**
  * Routine to validate an annotation. An annotation is valid if it contains at least one point and if this point contains 3 value (for x, y, z)
  */
  validateAnnotation(){
    this._isValid = true;

    // at least one point
    if(this._points.length){
      // every point as a 3D coord
      this._isValid = ! this._points.some( function( point ){
        return (point.length != 3);
      });
    }
    // no point, no annotation :(
    else{
      this._isValid = false;
    }
  }


  /**
  * Add a point at the end of the annotation
  * @param {Array} point - coord [x, y, z]
  */
  addPoint( point ){
    if(this._isClosed){
      console.warn( "The annotation is a closed polygon. You must to first remove the last point to open the loop." );
      return;
    }

    // maintain integrity (and prevent from running validateAnnotation() )
    if( point.length == 3){
      this._points.push( point );

      // this point annotation just turned into a line annotation (let's celebrate!)
      if( this._points.length >= 2 ){
        this.flushObject3D();
        this._buildLinestringAnnotation();
      }

      /*
      NOTE: it would have been better to just add a point to an existing buffer
      in order to make the lin longer, unfortunatelly THREEjs makes it very
      cumbersome (impossible) to extend an existing buffergeometry a simple way.
      In the end, the most convenient is to delete/recreate the whole thing.
      Sorry for that.
      */

      this.validateAnnotation();
    }
  }


  /**
  * Remove a point from the annotation point set.
  * @param {Number} index - optionnal, if set remove the point at this index. If not set, remove the last
  */
  /*
  removePoint( index=-1 ){
    if( this._isValid ){
      this._points.splice(index, 1);
      this.validateAnnotation();

      // TODO if a line turns into a point !
      // TODO if closed, do we still leave it close?

    }
  }
  */


  /**
  * Remove the last point of the annot and adapt the shape if it becomes a
  * point or even of length 0.
  */
  removeLastPoint(){
    // open the loop
    if(this._isClosed){
      console.warn("The polygon just got open.");
      this._isClosed = false;
    }

    if( this._isValid ){
      this._points.pop();

      // no more point into this annot
      if(this._points.length == 0){
        this.flushObject3D();
      }else
      // the line turns into a point
      if(this._points.length == 1){
        this.flushObject3D();
        this._buildPointAnnotation();
      }
      // the lines is getting shorter
      else{
        var lineMesh = this._object3D.children[0];
        lineMesh.geometry.vertices.pop();
        lineMesh.geometry.computeBoundingSphere();
        lineMesh.geometry.dynamic = true;
        lineMesh.geometry.verticesNeedUpdate = true;
      }

      this.validateAnnotation();
    }
  }


  /**
  * Get the THREE Object that represent the annotation. Build it if not already built.
  * @return {THREE.Object3D}
  */
  getObject3D(){
    /*
    if(this._meshMustRebuild){
      if(this._points.length == 1){
        this._buildPointAnnotation();
      }else{
        this._buildLinestringAnnotation();
      }

      return this._object3D;
    }
    */

    return this._object3D;
  }


  /**
  * [PRIVATE]
  * Build a THREE js object that hollows this annotation if it's a point
  */
  _buildPointAnnotation(){
    if( this._isValid ){
      var geometry = new THREE.BufferGeometry();
			var position = new Float32Array( this._points[0] );

      var material = new THREE.PointsMaterial({
        size: 10,
        color: new THREE.Color(this._color),
        sizeAttenuation: false
      });

      geometry.addAttribute( 'position', new THREE.BufferAttribute( position, 3 ) );
      geometry.computeBoundingSphere();
      geometry.dynamic = true;
      geometry.verticesNeedUpdate = true;

      var point = new THREE.Points( geometry, material );

      point.layers.enable( 0 );
      point.layers.enable( 1 );

      this._object3D.add( point );
      this._meshMustRebuild = false;
    }
  }


  /**
  * [PRIVATE]
  * Build a THREE js object that hollows this annotation if it's a linestring or a polygon
  */
  _buildLinestringAnnotation(){
    if( this._isValid ){
      //var geometry = new THREE.Geometry();
      var geometry = new THREE.BufferGeometry();


      var material = new THREE.LineBasicMaterial( {
        linewidth: 1, // thickness remains the same on screen no matter the proximity
        color: new THREE.Color(this._color)
      });

      var bufferSize = this._points.length * 3 + (+this._isClosed)*3;
      var vertices = new Float32Array(bufferSize);

      // adding every point
      this._points.forEach(function(point, index){
        vertices[index*3 ] = point[0];
        vertices[index*3 + 1] = point[1];
        vertices[index*3 + 2] = point[2];
      });

      // add a the first point again, in the end, to close the loop
      if(this._isClosed && this._points.length > 2){
        vertices[bufferSize - 3] = this._points[0][0];
        vertices[bufferSize - 2] = this._points[0][1];
        vertices[bufferSize - 1] = this._points[0][2];
      }

      geometry.addAttribute( 'position', new THREE.BufferAttribute( vertices, 3 ) );
      geometry.getAttribute("position").dynamic = true;

      //geometry.computeLineDistances();
      var mesh = new THREE.Line( geometry, material );
      mesh.layers.enable( 0 );
      mesh.layers.enable( 1 );

      mesh.geometry.dynamic = true;
      mesh.geometry.verticesNeedUpdate = true;

      this._object3D.add( mesh );

      this._meshMustRebuild = false;
    }
  }


  /**
  * [PRIVATE]
  * Builds the annotation, no matter if point or line.
  */
  _buildAnnotationObject3D(){
    // this annotation is corrupted
    if( ! this._isValid ){
      console.warn("This annotation is not valid. Possible reasons: no points OR points number of dimension is not consistant.");
      return;
    }

    if(! this._object3D.children.length ){

      // this is a point
      if(this._points.length == 1 ){
        this._buildPointAnnotation();
      }
      // this is a linestring or a polygon
      else{
        this._buildLinestringAnnotation();
      }

    }else{
      console.warn("The object3D/mesh for this annotation is already built. Maybe use a modifying method instead.");
      return;
    }
  }


  /**
  * [PRIVATE]
  * remove all the childrens from the graphic representation of this annot.
  * This is useful when a single-point annot turns into a line annot and vice-versa.
  */
  flushObject3D(){
    var that = this;

    this._object3D.children.forEach(function(child){
      that._object3D.remove( child );
    });
  }


  /**
  * When we want to close a linstring. Basically adds a point at the end and switch the isClosed boolean.
  */
  closeLinestring(){
    // cannot close it if already closed
    if(this._isClosed){
      console.warn("The annotation linestring is already closed.");
      return;
    }

    // an annot needs at least 3 points to be closed
    if( this._points.length > 2 ){
      this._isClosed = true;

      this.addPoint( this._points[ this._points.length - 1 ] );
    }
  }


  /**
  * @return {String} the name of this annotation
  */
  getName(){
    return this._name;
  }

  /**
  * update the name of this annotation.
  * @param {String} name - the new name
  */
  updateName( name ){
    this._name = name;
    var mesh = this._object3D.name = name;
  }


  /**
  * @return {String} the description of this annotation
  */
  getDescription(){
    return this._description;
  }

  /**
  * Update the description.
  * @param {String} d - the new description
  */
  updateDescription( d ){
    this._description = d;
    this._object3D.userData.description = d;
  }


  /**
  * @return {String} the color of the annotation in hexadecimal
  */
  getColor(){
    return this._color;
  }


  /**
  * Update the color.
  * @param {String} c - should be like "FF0000" or "#FF0000"
  */
  updateColor( c ){
    this._color = c;

    if( this._color[0] != "#"){
      this._color = "#" + this._color;
    }

    if(this._object3D.children.length){
      this._object3D.children[0].material.color.set( this._color );
    }
  }


  /**
  * @return {Number} the number of points in this annotation
  */
  getNummberOfPoints(){
    return this._points.length;
  }


/*
TODO
make sure if you use scene.remove(mesh), you also call mesh.geometry.dispose(), mesh.material.dispose() and mesh.texture.dispose() else you'll get memory leaks I think (r71)
*/

} /* END of class Annotation */

export { Annotation };
