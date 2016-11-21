// take some inspiration here:
// https://threejs.org/examples/webgl_multiple_views.html

'use strict';

import { QuadView } from './QuadView.js';
import { ProjectionPlane } from './ProjectionPlane.js';



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

    this._resolutionLevel = 0;

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

    // all the planes to intersect the chunks. They will all lie into _mainObjectContainer
    this._projectionPlanes = [];

    this._levelManager = new SHAD.LevelManager();

    this._cubeHull3D = null;

    // size of the dataset in world coords
    this._cubeHullSize = [0, 0, 0];

    this._initLevelManager();
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
    //bottomRight.addOrbitControl();
    bottomRight.addTrackballControl(this._render, this);

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
    this._domContainer.appendChild( this._stats.dom );
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

    // TODO
    this._quadViews[3]._control.update();
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
    var that = this;

    this._guiVar = {
      posx: 0,
      posy: 0,
      posz: 0,
      rotx: 0,
      roty: 0,
      rotz: 0,
      frustrum: 1,
      resolutionLevel: 0,

      refresh: function(){
        that._updateAllPlanesShaderUniforms();
      },

      debug: function(){
        that._guiVar.posx += 0.1;
      },

    }

    this._datGui.add(this._guiVar, 'posx', 0, 2).name("position x").step(0.001).listen();
    this._datGui.add(this._guiVar, 'posy', 0, 2).name("position y").step(0.001).listen();
    this._datGui.add(this._guiVar, 'posz', 0, 2).name("position z").step(0.001).listen();
    var controllerRotX = this._datGui.add(this._guiVar, 'rotx', -Math.PI/2, Math.PI/2).name("rotation x").step(0.01).listen();
    var controllerRotY = this._datGui.add(this._guiVar, 'roty', -Math.PI/2, Math.PI/2).name("rotation y").step(0.01).listen();
    var controllerRotZ = this._datGui.add(this._guiVar, 'rotz', -Math.PI/2, Math.PI/2).name("rotation z").step(0.01).listen();
    var controllerFrustrum = this._datGui.add(this._guiVar, 'frustrum', 0, 2).name("frustrum").step(0.01).listen();
    var levelController = this._datGui.add(this._guiVar, 'resolutionLevel', 0, 6).name("resolutionLevel").step(1).listen();

    this._datGui.add(this._guiVar, 'refresh');
    this._datGui.add(this._guiVar, 'debug');


    levelController.onFinishChange(function(lvl) {
      that._updateResolutionLevel(lvl);
      that._updateOthoCamFrustrum();
    });
    levelController.onChange(function(lvl) {
      that._updateResolutionLevel(lvl);
      that._updateOthoCamFrustrum();
    });


    controllerRotX.onChange(function(value) {
      that._updateAllPlanesShaderUniforms();
    });
    controllerRotX.onFinishChange(function(value) {
      that._updateAllPlanesShaderUniforms();
    });

    controllerRotY.onChange(function(value) {
      that._updateAllPlanesShaderUniforms();
    });
    controllerRotY.onFinishChange(function(value) {
      that._updateAllPlanesShaderUniforms();
    });

    controllerRotZ.onChange(function(value) {
      that._updateAllPlanesShaderUniforms();
    });
    controllerRotZ.onFinishChange(function(value) {
      that._updateAllPlanesShaderUniforms();
    });



    controllerFrustrum.onChange(function(value){
      that._quadViews[0].updateOrthoCamFrustrum(value);
      that._quadViews[1].updateOrthoCamFrustrum(value);
      that._quadViews[2].updateOrthoCamFrustrum(value);
    });

  }


  /**
  * Set the position of the center of the main object (where the center of the planes are).
  * @param {Number} x - x position in world coordinates
  * @param {Number} y - y position in world coordinates
  * @param {Number} z - z position in world coordinates
  */
  setMainObjectPosition(x, y, z){
    if(x>0 && x<this._cubeHullSize[0] &&
       y>0 && y<this._cubeHullSize[1] &&
       z>0 && z<this._cubeHullSize[2]
    ){
      this._mainObjectContainer.position.x = x;
      this._mainObjectContainer.position.y = y;
      this._mainObjectContainer.position.z = z;

      // already done if called by the renderer and using DAT.gui
      this._guiVar.posx = x;
      this._guiVar.posy = y;
      this._guiVar.posz = z;

      this._updateAllPlanesShaderUniforms();
      this._updatePerspectiveCameraLookAt();
    }
  }


  /**
  * Set the Euler angles of MainObject (that contains the planes)
  * @param {Number} x - x rotation in radian
  * @param {Number} y - y rotation in radian
  * @param {Number} z - z rotation in radian
  */
  setMainObjectRotation(x, y, z){
    this._mainObjectContainer.rotation.x = x;
    this._mainObjectContainer.rotation.y = y;
    this._mainObjectContainer.rotation.z = z;

    // already done if called by the renderer and using DAT.gui
    this._guiVar.rotx = x;
    this._guiVar.roty = y;
    this._guiVar.rotz = z;
  }


  /**
  * [PRIVATE]
  * Update the position and rotation of _mainObjectContainer from what is tuned in the dat.gui widget.
  * Called at each _render()
  */
  _updateMainObjectContainerFromUI(){
    // position
    this.setMainObjectPosition(
      this._guiVar.posx,
      this._guiVar.posy,
      this._guiVar.posz
    );

    // rotation
    this.setMainObjectRotation(
      this._guiVar.rotx,
      this._guiVar.roty,
      this._guiVar.rotz
    );

  }


  /**
  *
  */
  addProjectionPlane(){
    var pn = new ProjectionPlane(1);
    pn.setMeshColor(new THREE.Color(0x000099) );
    this._projectionPlanes.push( pn );
    this._mainObjectContainer.add( pn.getPlane() );

    var pu = new ProjectionPlane(1);
    pu.setMeshColor(new THREE.Color(0x009900) );
    this._projectionPlanes.push( pu );
    pu.getPlane().rotateX( Math.PI / 2);
    this._mainObjectContainer.add( pu.getPlane() );

    var pv = new ProjectionPlane(1);
    pv.setMeshColor(new THREE.Color(0x990000) );
    this._projectionPlanes.push( pv );
    pv.getPlane().rotateY( Math.PI / 2);
    this._mainObjectContainer.add( pv.getPlane() );
  }


  /**
  * [PRIVATE]
  *
  */
  _initLevelManager(){
    var that = this;

    this._levelManager.loadConfig("../data/info.json");

    this._levelManager.onReady(function(){

      that._projectionPlanes.forEach(function(plane){
        plane.setLevelManager(that._levelManager);
      });

      that._levelManager.setResolutionLevel( that._resolutionLevel ); // most likely 0 at the init

      that._updateAllPlanesShaderUniforms();
      that._buildCubeHull();

      that.setMainObjectPosition(
        that._cubeHullSize[0] / 2,
        that._cubeHullSize[1] / 2,
        that._cubeHullSize[2] / 2
      );
    })
  }




  /**
  *
  */
  _updateResolutionLevel(lvl){
    console.log("--------- LVL " + lvl + " ---------------");
    this._resolutionLevel = lvl;
    this._levelManager.setResolutionLevel( this._resolutionLevel );
    this._updateAllPlanesScaleFromRezLvl();
    this._updateAllPlanesShaderUniforms();
  }


  /**
  * When the resolution level is changing, the scale of each plane has to change accordingly before the texture chunks are fetched ( = before _updateAllPlanesShaderUniforms is called).
  */
  _updateAllPlanesScaleFromRezLvl(){
    var that = this;

    this._projectionPlanes.forEach( function(plane){
      plane.updateScaleFromRezLvl( that._resolutionLevel );
    });
  }


  /**
  * Updates the uniforms to send to the shader of the plane. Will trigger chunk loading for those which are not already in memory.
  */
  _updateAllPlanesShaderUniforms(){
    this._projectionPlanes.forEach( function(plane){
      plane.updateUniforms();
    });
  }


  /**
  * So that the perspective cam targets the object container center
  */
  _updatePerspectiveCameraLookAt(){
    this._quadViews[3].updateLookAt( this._mainObjectContainer.position );
  }


  /**
  * Updates the frustrum of the 3 ortho cam by adjusting a factor relative to the level of resolution. This ensure we keep the same image ratio.
  */
  _updateOthoCamFrustrum(){
    var frustrumFactor = 1 / Math.pow(2, this._resolutionLevel);
    this._quadViews[0].updateOrthoCamFrustrum( frustrumFactor );
    this._quadViews[1].updateOrthoCamFrustrum( frustrumFactor );
    this._quadViews[2].updateOrthoCamFrustrum( frustrumFactor );
  }


  /**
  * Make the cube hull visible. Builds it if not already built.
  */
  showCubeHull(){
    if(!this._cubeHull3D){
      this._buildCubeHull();
    }else{
      this._cubeHull3D.visible = true;
    }
  }


  /**
  * Make the cube hull invisible.
  */
  hideCubeHull(){
    if(this._cubeHull3D){
      this._cubeHull3D.visible = false;
    }
  }


  /**
  * [PRIVATE]
  * Build the cube hull, in other word, the box that adds some notion of boundaries to the dataset.
  */
  _buildCubeHull(){
    if(this._cubeHull3D)
      return;

    this._cubeHullSize = this._levelManager.getCubeHull();

    var cubeHullMaterial = new THREE.MeshBasicMaterial( {
      transparent: true,
      opacity: 0.8,
      color: 0xffffff,
      vertexColors: THREE.FaceColors,
      side: THREE.BackSide
    } );

    var cubeHullGeometry = new THREE.BoxGeometry(
      this._cubeHullSize[0],
      this._cubeHullSize[1],
      this._cubeHullSize[2]
    );

    cubeHullGeometry.faces[0].color.setHex( 0xe1ceff ); // Sagittal
    cubeHullGeometry.faces[1].color.setHex( 0xe1ceff );
    cubeHullGeometry.faces[2].color.setHex( 0xA882E0 );
    cubeHullGeometry.faces[3].color.setHex( 0xA882E0 );
    cubeHullGeometry.faces[4].color.setHex( 0xbafcfb ); // Coronal
    cubeHullGeometry.faces[5].color.setHex( 0xbafcfb );
    cubeHullGeometry.faces[6].color.setHex( 0x54B8B6 );
    cubeHullGeometry.faces[7].color.setHex( 0x54B8B6 );
    cubeHullGeometry.faces[8].color.setHex( 0xFFEDB3 ); // Axial
    cubeHullGeometry.faces[9].color.setHex( 0xFFEDB3 );
    cubeHullGeometry.faces[10].color.setHex( 0xDBAA09 );
    cubeHullGeometry.faces[11].color.setHex( 0xDBAA09 );

    // mesh
    var cubeHullPlainMesh = new THREE.Mesh( cubeHullGeometry, cubeHullMaterial );
    this._cubeHull3D = new THREE.Object3D();
    this._cubeHull3D.add( cubeHullPlainMesh );
    this._cubeHull3D.position.x = this._cubeHullSize[0] / 2;
    this._cubeHull3D.position.y = this._cubeHullSize[1] / 2;
    this._cubeHull3D.position.z = this._cubeHullSize[2] / 2;
    this._scene.add( this._cubeHull3D );
  }

}

export { QuadScene };
