'use strict';

import { AjaxFileLoader } from './AjaxFileLoader.js';
import { MniObjReader } from './MniObjReader.js';

class MeshCollection{

  /**
  * Constructor of the MeshCollection instance.
  *
  */
  constructor( config, container ){

    // THREE js container (object3D) for all the meshes
    this._container = container;


    // rather than an arrya because all mesh have an ID
    this._meshes = {};

    // the folder that contains the json config file (that is at config.url).
    // depending on the option of the file, the mesh files can have a
    // relative address to this folder, making the folder portable.
    this._configFileDir = null;

    this._collectionBox = null;

    this._readConfig( config );
  }



  /**
  * [PRIVATE]
  * Start to read the configuration, containing an extensive list of mesh
  * with their description.
  * @param {Object} config - a small config object {datatype: String, url: String}
  */
  _readConfig( config ){
    var that = this;
    var filepath = config.url;

    AjaxFileLoader.loadTextFile(
      // file URL
      filepath,

      // success callback
      function(data){
        // the directory of the config file is the working directory
        that._configFileDir = filepath.substring(0, Math.max(filepath.lastIndexOf("/"), filepath.lastIndexOf("\\"))) + "/";

        // Rading the config object
        that._loadConfigDescription(JSON.parse(data));
      },

      // error callback
      function(error){
        console.error("Could not load config file " + filepath);

        // if loading the config file failed, we have a callback for that.
        if(that._onConfigErrorCallback){
          that._onConfigErrorCallback(filepath, 0);
        }
      }
    )
  }


  /**
  * [PRIVATE]
  *
  */
  _loadConfigDescription( meshConfig ){
    var that = this;

    meshConfig.forEach( function(meshInfo){
      var url = meshInfo.url;

      // "near" means files are in a folder relative to the config file.
      // This can be local or distant.
      if( meshInfo.urlType == "near" ){
        url = that._configFileDir + url;

      // "local" means the specified url is relative to the web app
      }else if(meshInfo.urlType == "local"){
        // nothing to do

      // "absolute" means the path should start by http
      }else if(meshInfo.urlType == "absolute"){
        // nothing to do
      }



      AjaxFileLoader.loadTextFile(
        // file URL
        url,

        // success callback
        function(data){
          var objReader = new MniObjReader();
          objReader.parse( data );
          var mesh = that._buildMeshFromObjReader( objReader );
          mesh.geometry.computeBoundingBox();
          mesh.name = meshInfo.id;
          mesh.userData.longName = meshInfo.name;
          mesh.userData.description = meshInfo.description;

          // parametric rotation
          if("eulerAngle" in meshInfo){
            mesh.rotation.set(meshInfo.eulerAngle[0], meshInfo.eulerAngle[1], meshInfo.eulerAngle[2])
          }

          // parametric scale
          if("scale" in meshInfo){
            mesh.scale.set(meshInfo.scale[0], meshInfo.scale[1], meshInfo.scale[2])
          }

          // parametric scale
          if("position" in meshInfo){
            mesh.position.set(meshInfo.position[0], meshInfo.position[1], meshInfo.position[2])
          }

          console.log(meshInfo);

          // shows on all cam
          mesh.layers.enable( 0 );
          mesh.layers.enable( 1 );

          // show only on perspective cam
          //mesh.layers.disable( 0 );
          //mesh.layers.enable( 1 );

          that._meshes[meshInfo.id] = mesh;
          that._container.add( mesh );

          console.log(mesh);
          that._updateCollectionBox( mesh );
        },

        // error callback
        function(error){
          console.error("Could not load mesh file " + url);

        }
      )



    });

    console.log( meshConfig );
  }


  /**
  * [PRIVATE]
  * Creates a three mesh out of a mniObjReader instance
  * @param {MniObjReader} mniObjReader - must have called parse() on it first
  * @return {THREE.Mesh} - a mesh based on the mni obj parsed data
  */
  _buildMeshFromObjReader( mniObjReader ){
    var geometry = new THREE.BufferGeometry();
    var indices = mniObjReader.getShapeRawIndices(0);
    var positions = mniObjReader.getRawVertices();
    var normals = mniObjReader.getRawNormals();
    var colors = mniObjReader.getRawColors();
    geometry.setIndex( new THREE.BufferAttribute( indices, 1 ) );
    geometry.addAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
    geometry.addAttribute( 'normal', new THREE.BufferAttribute( normals, 3, true ) );
    geometry.addAttribute( 'color', new THREE.BufferAttribute( colors, 4, true ) );
    geometry.computeBoundingSphere();

    var material = new THREE.MeshPhongMaterial( {
      specular: 0xffffff,
      shininess: 250,
      side: THREE.DoubleSide,
      vertexColors: THREE.VertexColors,
      transparent: true,
      opacity: 0.2,//mniObjReader.getSurfaceProperties().transparency,
    } );

    var mesh = new THREE.Mesh( geometry, material );
    return mesh;
  }


  _updateCollectionBox( mesh ){

    // first mesh we load, we take its bb
    if(!this._collectionBox){
      this._collectionBox = mesh.geometry.boundingBox.clone();

    // additionnal mes: we expand the collection bb
    }else{
      this._collectionBox.union( mesh.geometry.boundingBox );

      console.log("bounding box:");
      console.log(this._collectionBox.getCenter());
      console.log(this._collectionBox.getSize());

      //this._container.applyMatrix(new THREE.Matrix4().makeScale(-1, 1, 1));

      /*
      var factor = 85;
      this._container.scale.set(1/factor, 1/factor, 1/factor);
      this._container.rotateY( Math.PI);
      this._container.position.set(1.609/2, 1.81/2, 1.406/2);
      */
    }


  }

} /* END class MeshCollection */


export { MeshCollection };
