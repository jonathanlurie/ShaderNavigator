
/**
* A BoundingBoxHelper instance shows the limits of the dataset in a visual way.
* A bounding box can be built only once.
*/
class BoundingBoxHelper{

  /**
  * Constructor
  * @param {THREE.Object3D} parent - THREE js object to add the boinding box
  */
  constructor( parent ){
    this._size = null;
    this._parentElem = parent;
    this._boundingBox3D = null;
  }


  /**
  * Build the bounding box helper.
  * Can be called only once.
  * @param {Array} size - Array of Number [xsize, ysize, zsize]
  */
  build( size ){
    this._size = size.slice();

    if(this._boundingBox3D)
      return;

    this._boundingBox3D = new THREE.Object3D();

    var boundingBoxMaterial = new THREE.MeshBasicMaterial( {
      transparent: true,
      opacity: 0.8,
      color: 0xffffff,
      vertexColors: THREE.FaceColors,
      side: THREE.BackSide
    } );

    var boundingBoxGeometry = new THREE.BoxGeometry(
      this._size[0],
      this._size[1],
      this._size[2]
    );

    boundingBoxGeometry.faces[0].color.setHex(  0xFF7A7A ); // Sagittal
    boundingBoxGeometry.faces[1].color.setHex(  0xFF7A7A );
    boundingBoxGeometry.faces[2].color.setHex(  0xff3333 );
    boundingBoxGeometry.faces[3].color.setHex(  0xff3333 );
    boundingBoxGeometry.faces[4].color.setHex(  0x61FA94 ); // Coronal
    boundingBoxGeometry.faces[5].color.setHex(  0x61FA94 );
    boundingBoxGeometry.faces[6].color.setHex(  0xA7FAC3 );
    boundingBoxGeometry.faces[7].color.setHex(  0xA7FAC3 );
    boundingBoxGeometry.faces[8].color.setHex(  0x95CCFC ); // Axial
    boundingBoxGeometry.faces[9].color.setHex(  0x95CCFC );
    boundingBoxGeometry.faces[10].color.setHex( 0x0088ff );
    boundingBoxGeometry.faces[11].color.setHex( 0x0088ff );

    // mesh
    var boundingBoxPlainMesh = new THREE.Mesh( boundingBoxGeometry, boundingBoxMaterial );
    this._boundingBox3D.add( boundingBoxPlainMesh );
    this._boundingBox3D.position.x = this._size[0] / 2;
    this._boundingBox3D.position.y = this._size[1] / 2;
    this._boundingBox3D.position.z = this._size[2] / 2;

    this._boundingBox3D.children.forEach( function(child){
      child.layers.disable( 0 );
      child.layers.enable( 1 );
    });

    this._parentElem.add( this._boundingBox3D );
  }


  /**
  * @return {boolean} true if xyz is within the bounding box. Return false if outside.
  * @param {Number} x - coordinate along x
  * @param {Number} y - coordinate along y
  * @param {Number} z - coordinate along z
  */
  isInside(x, y, z){
    return (x>0 && x<this._size[0] && y>0 && y<this._size[1] && z>0 && z<this._size[2]);
  }


  /**
  * Show the bounding box
  */
  show(){
    this._boundingBox3D.visible = true;
  }


  /**
  * Hide the bounding box
  */
  hide(){
    this._boundingBox3D.visible = false;
  }


  /**
  * Show the bounding box if it's hidden, hide if it's shown.
  */
  toggle(){
    this._boundingBox3D.visible = !this._boundingBox3D.visible;
  }


  /**
  * Show or hide
  * @param {Boolean} b - true to show, false to hide.
  */
  setVisibility( b ){
    this._boundingBox3D.visible = b;
  }

}/* END class BoundingBoxHelper */

export { BoundingBoxHelper };
