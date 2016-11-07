// take some inspiration here:
// https://threejs.org/examples/webgl_multiple_views.html

'use strict';

import { QuadView } from './QuadView.js';


/**
* A QuadScene is a THREE js context where the viewport is split in 4 windows, for each window comes a QuadView.
* Originally, the purpose of the QuadScene is to display 3 orthogonal views usin othometric cameras, and one additional view using a perspective camera. The later is supposed to be more free of movement, giving an flexible global point of view. The 3 ortho cam are more likely to be in object coordinate so that rotating the main object wont affect what is shown on this views.
*
* @param {String} DomContainer - ID of div to show the QuadScene
*
*/
class QuadScene{

  constructor(DomContainer){
    // the four QuadView instances, to be built (initViews)
    this._quadViews = [];

    // variables used to sync the dat.guy widget and some position/rotation.
    // see _initUI() for more info.
    this._guiVar = null;
    this._datGui = new dat.GUI();
    this._initUI();

    // Container on the DOM tree, most likely a div
    this._domContainer = document.getElementById( DomContainer );

    // scene, where everything goes
    this._scene = new THREE.Scene();

    // renderer construction and setting
    this._renderer = new THREE.WebGLRenderer( /*{ antialias: true }*/ );
    this._renderer.setPixelRatio( window.devicePixelRatio );
    this._renderer.setSize( window.innerWidth, window.innerHeight );
    this._domContainer.appendChild( this._renderer.domElement );

    // the main container to put objects in
    this._mainObjectContainer = new THREE.Object3D();
    this._scene.add(this._mainObjectContainer );

    // TODO: to be
    this._cameraDistance = 10;

    // mouse position in [0, 1], origin being at the bottom left of the viewport
    this._mouse = {x:0, y:0};
    document.addEventListener( 'mousemove', this._onMouseMove.bind(this), false );

    // to feed the renderer. will be init
    this._windowSize = {
      width: 0 ,
      height: 0
    };

    this._stats = null;

    this._initViews();

    // some help!
    this._scene.add( new THREE.AxisHelper( 1 ) );
  }


  /**
  * [PRIVATE]
  * Initialize the 4 QuadView instances. The 3 first being ortho cam and the last being a global view perspective cam.
  */
  _initViews(){
    var topLeftView = new QuadView(this._scene, this._renderer, this._cameraDistance);
    topLeftView.initTopLeft();
    topLeftView.initOrthoCamera();
    topLeftView.useRelativeCoordinatesOf(this._mainObjectContainer);

    var topRightView = new QuadView(this._scene, this._renderer, this._cameraDistance);
    topRightView.initTopRight();
    topRightView.initOrthoCamera();
    topRightView.useRelativeCoordinatesOf(this._mainObjectContainer);

    var bottomLeft = new QuadView(this._scene, this._renderer, this._cameraDistance);
    bottomLeft.initBottomLeft();
    bottomLeft.initOrthoCamera();
    bottomLeft.useRelativeCoordinatesOf(this._mainObjectContainer);

    var bottomRight = new QuadView(this._scene, this._renderer, this._cameraDistance);
    bottomRight.initBottomRight();
    bottomRight.initPerspectiveCamera();
    bottomRight.addOrbitControl();

    // adding the views
    this._quadViews.push(topLeftView);
    this._quadViews.push(topRightView);
    this._quadViews.push(bottomLeft);
    this._quadViews.push(bottomRight);
  }


  /**
  * Add a statistics widget
  */
  initStat(){
    this._stats = new Stats();
  }


  /**
  * [PRIVATE]
  * Update the renderer with new window size if they changed.
  */
  _updateSize() {
    if (  this._windowSize.width != window.innerWidth ||
          this._windowSize.height != window.innerHeight ) {
      this._windowSize.width  = window.innerWidth;
      this._windowSize.height = window.innerHeight;
      this._renderer.setSize ( this._windowSize.width, this._windowSize.height );
    }
  }


  /**
  * [PRIVATE / EVENT]
  * called whenever the pointer is moving. Updates internal coords.
  */
  _onMouseMove( event ) {
    this._mouse.x = (event.clientX / this._windowSize.width);
    this._mouse.y = 1 - (event.clientY / this._windowSize.height);
  }


  /**
  * [PRIVATE]
  * To feed the animation feature built in WebGL.
  */
  animate(){
    this._render();

    if(this._stats){
      this._stats.update();
    }

    // call a built-in webGL method for annimation
    requestAnimationFrame( this.animate.bind(this) );
  }


  /**
  *
  */
  _render(){
    let that = this;

    // when the gui is used
    this._updateMainObjectContainerFromUI();

    // in case the window was resized
    this._updateSize();

    // the last view has an Orbit Control, thus it need the mouse coords
    this._quadViews[3].updateMousePosition(this._mouse.x, this._mouse.y);

    // refresh each view
    this._quadViews.forEach(function(view){
      view.renderView();
    });

  }


  /**
  * [PRIVATE]
  * Initialize the DAT.GUI component
  */
  _initUI(){
    this._guiVar = {
      posx: 0,
      posy: 0,
      posz: 0,
      rotx: 0,
      roty: 0,
      rotz: 0,
      zoom: 1,
      debug: function(){
        console.log("DEBUG BUTTON");
      }
    }

    this._datGui.add(this._guiVar, 'posx', -5, 5).name("position x").step(0.001);
    this._datGui.add(this._guiVar, 'posy', -5, 5).name("position y").step(0.001);
    this._datGui.add(this._guiVar, 'posz', -5, 5).name("position z").step(0.001);
    this._datGui.add(this._guiVar, 'rotx', -Math.PI/2, Math.PI/2).name("rotation x").step(0.01);
    this._datGui.add(this._guiVar, 'roty', -Math.PI/2, Math.PI/2).name("rotation y").step(0.01);
    this._datGui.add(this._guiVar, 'rotz', -Math.PI/2, Math.PI/2).name("rotation z").step(0.01);
    this._datGui.add(this._guiVar, 'zoom', 0.1, 5).name("zoom").step(0.01);
    this._datGui.add(this._guiVar, 'debug');

  }


  /**
  * [PRIVATE]
  * Update the position and rotation of _mainObjectContainer from what is tuned in the dat.gui widget.
  * Called at each _render()
  */
  _updateMainObjectContainerFromUI(){
    this._mainObjectContainer.position.x = this._guiVar.posx;
    this._mainObjectContainer.position.y = this._guiVar.posy;
    this._mainObjectContainer.position.z = this._guiVar.posz;
    this._mainObjectContainer.rotation.x = this._guiVar.rotx;
    this._mainObjectContainer.rotation.y = this._guiVar.roty;
    this._mainObjectContainer.rotation.z = this._guiVar.rotz;
  }

  /**
  * Adds a cube to the _mainObjectContainer to see it
  */
  addTestCube(){
    // adding the wire cube
    var chunkSize = 1;
    var cubeGeometry = new THREE.BoxGeometry( chunkSize, chunkSize, chunkSize );
    var cubeMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      vertexColors: THREE.FaceColors
      }
    );
    var cubeMesh = new THREE.Mesh( cubeGeometry, cubeMaterial );
    cubeGeometry.faces[0].color.setHex( 0x000000 );
    cubeGeometry.faces[1].color.setHex( 0x000000 );
    cubeGeometry.faces[2].color.setHex( 0x0000ff );
    cubeGeometry.faces[3].color.setHex( 0x0000ff );
    cubeGeometry.faces[4].color.setHex( 0x00ff00 );
    cubeGeometry.faces[5].color.setHex( 0x00ff00 );
    cubeGeometry.faces[6].color.setHex( 0x00ffff );
    cubeGeometry.faces[7].color.setHex( 0x00ffff );
    cubeGeometry.faces[8].color.setHex( 0xff0000 );
    cubeGeometry.faces[9].color.setHex( 0xff0000 );
    cubeGeometry.faces[10].color.setHex( 0xff00ff );
    cubeGeometry.faces[11].color.setHex( 0xff00ff );

    //var cube = new THREE.BoxHelper( cubeMesh );
    //cube.material.color.set( 0x000000 );
    this._mainObjectContainer.add(cubeMesh);
  }




}

export { QuadScene };
