'use strict';



/**
* A OrientationHelper is a sphere surrounding the orthogonal planes that will show the direction of left/right, posterior/anterior and inferior/superior.
*
*/
class OrientationHelper{

  /**
  *
  */
  constructor( initRadius ){
    this._sphere = new THREE.Object3D();

    var xColor = 0xff3333;
    var yColor = 0x00ff55;
    var zColor = 0x0088ff;

    var geometryX = new THREE.CircleGeometry( initRadius, 64 );
    var geometryY = new THREE.CircleGeometry( initRadius, 64 );
    var geometryZ = new THREE.CircleGeometry( initRadius, 64 );
    var materialX = new THREE.LineBasicMaterial( { color: xColor, linewidth:1.5 } );
    var materialY = new THREE.LineBasicMaterial( { color: yColor, linewidth:1.5 } );
    var materialZ = new THREE.LineBasicMaterial( { color: zColor, linewidth:1.5 } );

    // X circle
    var circleX = new THREE.Line( geometryX, materialX );
    circleX.name = "xCircle";
    geometryX.rotateY(Math.PI / 2)
    // Y circle
    var circleY = new THREE.Line( geometryY, materialY );
    circleY.name = "yCircle";
    geometryY.rotateX(-Math.PI / 2)
    // Z circle
    var circleZ = new THREE.Line( geometryZ, materialZ );
    circleZ.name = "zCircle";

    this._sphere = new THREE.Object3D();
    this._sphere.add(circleX);
    this._sphere.add(circleY);
    this._sphere.add(circleZ);
  }


  /**
  * Add the local helper mesh to obj.
  * @param {THREE.Object3D} obj - container object to add the local helper.
  */
  addTo( obj ){
    obj.add( this._sphere );
    console.log("ADDED");
  }


  /**
  * Rescale the helper with a given factor.
  * @param {Number} f - a scaling factor, most likely within [0, 1]
  */
  rescale( f ){
    this._sphere.scale.x = f;
    this._sphere.scale.y = f;
    this._sphere.scale.z = f;


  }


  /**
  *
  */
  rescaleFromResolutionLvl( lvl ){
    var scale = 1 / Math.pow( 2, lvl );

    this._sphere.scale.x = scale;
    this._sphere.scale.y = scale;
    this._sphere.scale.z = scale;

    console.log(scale);
  }

  /**
  * Set the position of the orientation helper.
  * @param {THREE.Vector3} vPos - The position as a vector to clone.
  */
  setPosition( vPos ){
    console.log(vPos);
    //this._sphere.position.clone(vPos);

    this._sphere.position.x = vPos.x;
    this._sphere.position.y = vPos.y;
    this._sphere.position.z = vPos.z;
  }


} /* END class OrientationHelper */


export { OrientationHelper };
