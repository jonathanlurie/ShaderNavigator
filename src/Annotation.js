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
  * @param {Object} options - all kind of options: name {String}, isClosed {Boolean}, description {String}, color {String} hexa like "#FF0000", eulerAngle {Array} rotation correction [x, y, z], scale {Array} scale correction [x, y, z], position {Array} offset [x, y, z]
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
  * Defines the size of the sphere for a point annotation.
  * @param {Number} r - radius
  */
  setPointRadius( r ){
    this._pointRadius = r;
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
    // maintain integrity (and prevent from running validateAnnotation() )
    if( point.length == 3){
      this._points.push( point );

      // TODO if a point tunrs into a line

      this._meshMustRebuild = true;
    }
  }


  /**
  * Remove a point from the annotation point set.
  * @param {Number} index - optionnal, if set remove the point at this index. If not set, remove the last
  */
  removePoint( index=-1 ){
    if( this._isValid ){
      this._points.splice(index, 1);
      this.validateAnnotation();

      // TODO if a line turns into a point !
      // TODO if closed, do we still leave it close?

      this._meshMustRebuild = true;
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
      var geometry = new THREE.Geometry();
      var material = new THREE.LineBasicMaterial( {
        linewidth: 2, // thickness remains the same on screen no matter the proximity
        color: new THREE.Color(this._color)
      });

      // adding every point
      this._points.forEach(function(point){
        geometry.vertices.push( new THREE.Vector3(point[0], point[1], point[2]));
      })

      // add a the first point again, in the end, to close the loop
      if(this._isClosed && this._points.length > 2){
        geometry.vertices.push( new THREE.Vector3(
            this._points[0][0],
            this._points[0][1],
            this._points[0][2]
          )
        );
      }

      geometry.computeLineDistances();
      var mesh = new THREE.Line( geometry, material );
      mesh.layers.enable( 0 );
      mesh.layers.enable( 1 );

      mesh.geometry.dynamic = true;
      mesh.geometry.verticesNeedUpdate = true;

      this._object3D.add( mesh );

      this._meshMustRebuild = false;
    }
  }


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
  * When we want to close a linstring. Basically adds a point at the end and switch the isClosed boolean.
  */
  closeLinestring(){
    // TODO
  }

/*
TODO
make sure if you use scene.remove(mesh), you also call mesh.geometry.dispose(), mesh.material.dispose() and mesh.texture.dispose() else you'll get memory leaks I think (r71)
*/

} /* END of class Annotation */

export { Annotation };
