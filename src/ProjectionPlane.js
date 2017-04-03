'use strict';

import { ShaderImporter } from './ShaderImporter.js';

/**
* A ProjectionPlane instance is a portion of a 3D plane, defined as a rectangular surface. It is subdivided in a certain amount of sub-planes that are square-shaped. Each sub-plane is the size of half a texture chunk of the current resolution level.
* Example: if a texture chunk at level 3 is of size 1/8 x 1/8 x 1/8 in world coordinates, the csub-planes will be 1/16 x 1/16.
* This ensure that we dont have to many texture (Sampler2D) to send the the fragment shader of each sub-planes because, even in critical cases, a sub-plane of this size wont intersect more than 8 texture chunks.
*
*/
class ProjectionPlane{

  /**
  * @param {Number} chunkSize - The size of a texture chunk at the current level of resolution (in world coordinates)
  *
  */
  constructor( chunkSize, colormapManager ){
    var that = this;

    this._plane = new THREE.Object3D();
    this._plane.name = "projection plane";

    this._subPlaneSize = chunkSize / Math.sqrt(2);

    // relative position of each corner each subplane
    this._subPlaneCorners = [
      new THREE.Vector3(-1 * this._subPlaneSize/2, this._subPlaneSize/2, 0),  // NW
      new THREE.Vector3(this._subPlaneSize/2, this._subPlaneSize/2, 0),  // NE
      new THREE.Vector3(-1 * this._subPlaneSize/2, -1 * this._subPlaneSize/2, 0),  // SW
      new THREE.Vector3( this._subPlaneSize/2, -1 * this._subPlaneSize/2, 0),  // SE
    ];

    // one shader material per sub-plane
    this._shaderMaterials = [];

    // number of rows and cols of sub-planes to compose the _plane

    this._subPlaneDim = {row: 7, col: 15}; // OPTIM
    //this._subPlaneDim = {row: 10, col: 20}; // TEST
    //this._subPlaneDim = {row: 6, col: 13}; // TEST
    //this._subPlaneDim = {row: 1, col: 1};

    // to be aggregated
    this._colormapManager = colormapManager;

    // given by aggregation
    this._levelManager = null;

    this._resolutionLevel = 0;

    this._buildSubPlanes();
  }


  /**
  * @return {Number} resolution level for this plane
  */
  getResolutionLevel(){
    return this._resolutionLevel;
  }

  /**
  * Build all the subplanes with fake textures and fake origins. The purpose is just to create a compatible data structure able to receive relevant texture data when time comes.
  */
  _buildSubPlanes(){
    var that = this;

    var subPlaneGeometry = new THREE.PlaneBufferGeometry( this._subPlaneSize, this._subPlaneSize, 1 );

    // a fake texture is a texture used instead of a real one, just because
    // we have to send something to the shader even if we dont have data
    var fakeTexture = new THREE.DataTexture(
        new Uint8Array(1),
        1,
        1,
        THREE.LuminanceFormat,  // format, luminance is for 1-band image
        THREE.UnsignedByteType  // type for our Uint8Array
      );

    var fakeOrigin = new THREE.Vector3(0, 0, 0);

    var subPlaneMaterial_original = new THREE.ShaderMaterial( {
      uniforms: {
        // the textures
        nbChunks: {
          type: "i",
          value: 0
        },
        textures: {
          type: "t",
          value: [  fakeTexture, fakeTexture, fakeTexture, fakeTexture,
                    fakeTexture, fakeTexture, fakeTexture, fakeTexture]
        },
        // the texture origins (in the same order)
        textureOrigins: {
          type: "v3v",
          value: [  fakeOrigin, fakeOrigin, fakeOrigin, fakeOrigin,
                    fakeOrigin, fakeOrigin, fakeOrigin, fakeOrigin]
        },
        chunkSize : {
          type: "f",
          value: 1
        },
        colorMap : {
          type: "t",
          value: that._colormapManager.getCurrentColorMap().colormap
        },
        useColorMap : {
          type: "b",
          value: that._colormapManager.isColormappingEnabled()
        }
      }
      ,
      vertexShader: ShaderImporter.texture3d_vert,
      fragmentShader: ShaderImporter.texture3d_frag,
      side: THREE.DoubleSide,
      transparent: true
    });

    for(var j=0; j<this._subPlaneDim.row; j++){
      for(var i=0; i<this._subPlaneDim.col; i++){
        var subPlaneMaterial = subPlaneMaterial_original.clone();
        var mesh = new THREE.Mesh( subPlaneGeometry, subPlaneMaterial );

        mesh.position.set(
          this._subPlaneSize * (-0.5*this._subPlaneDim.col + i + 0.5),
          this._subPlaneSize * (-0.5*this._subPlaneDim.row + j + 0.5),
          0.0
        );

        this._plane.add( mesh );
        this._shaderMaterials.push( subPlaneMaterial );
      }
    }

  }


  /**
  * Defines the level manager so that the texture chunks can be fetched for each sub-plane.
  * @param {LevelManager} lm - the level manager
  */
  setLevelManager(lm){
    this._levelManager = lm;
  }


  /**
  * Debugging. Chanfe the color of the mesh of the plane, bit first, the plane material has to be set as a mesh.
  */
  setMeshColor(c){
    this._plane.children[0].material.color = c;
  }


  /**
  * fetch each texture info, build a uniform and
  */
  updateUniforms_NEAREST8(){
    var nbSubPlanes = this._subPlaneDim.row * this._subPlaneDim.col;
    var textureData = 0;

    for(var i=0; i<nbSubPlanes; i++){
      // center of the sub-plane in world coordinates
      var center = this._plane.children[i].localToWorld(new THREE.Vector3(0, 0, 0));



      textureData = this._levelManager.get8ClosestTextureDataByLvl(
        [center.x, center.y, center.z],
        this._resolutionLevel
      );

      this._updateSubPlaneUniform(i, textureData);
    }

  }


  /**
  * Like updateUniforms but instead of using the 8 closest, it uses only the ones
  * that are involved.
  */
  updateUniforms(){
    var nbSubPlanes = this._subPlaneDim.row * this._subPlaneDim.col;
    var textureData = 0;

    //console.log(this._subPlaneCorners);

    for(var i=0; i<nbSubPlanes; i++){
      // corners of the sub-plane in world coordinates
      var corners = [
        this._plane.children[i].localToWorld( this._subPlaneCorners[0].clone() ), // NW
        this._plane.children[i].localToWorld( this._subPlaneCorners[1].clone() ), // NE
        this._plane.children[i].localToWorld( this._subPlaneCorners[2].clone() ), // SW
        this._plane.children[i].localToWorld( this._subPlaneCorners[3].clone() )  // SE
      ];

      //console.log(corners);

      textureData = this._levelManager.getInvolvedTextureDataByLvl(
        corners,
        this._resolutionLevel
      );



      this._updateSubPlaneUniform(i, textureData);
    }

  }


  printSubPlaneCenterWorld(){
    var nbSubPlanes = this._subPlaneDim.row * this._subPlaneDim.col;
    for(var i=0; i<nbSubPlanes; i++){
      // center of the sub-plane in world coordinates
      var center = this._plane.children[i].localToWorld(new THREE.Vector3(0, 0, 0));
    }
  }


  /**
  * [PRIVATE]
  * Update the uniform of a specific sub-plane using the texture data. This will automatically update the related fragment shader.
  * @param {Number} i - index of the subplane to update.
  * @param {Object} textureData - texture data as created by LevelManager.get8ClosestTextureData()
  */
  _updateSubPlaneUniform(i, textureData){
    var uniforms = this._shaderMaterials[i].uniforms;

    //cube.material.map.needsUpdate = true;
    this._shaderMaterials[i].needsUpdate = true;
    this._shaderMaterials[i]._needsUpdate = true;

    // update colormap no  matter what
    uniforms.useColorMap.value = this._colormapManager.isColormappingEnabled();
    uniforms.colorMap.value = this._colormapManager.getCurrentColorMap().colormap;

    var mustUpdate = true;

    /*
    console.log( uniforms.textures.value );
    console.log( textureData.nbValid );
    console.log("---------------------------------");
    */

    for(i=0; i<textureData.nbValid; i++){
      if(!textureData.textures[i]){
        mustUpdate = false;
        break;
      }
    }

    if( mustUpdate ){
      //console.log("UP");
      var chunkSizeWC = this._levelManager.getChunkSizeWcByLvl( this._resolutionLevel );
      uniforms.nbChunks.value = textureData.nbValid;
      uniforms.textures.value = textureData.textures.slice(0, textureData.nbValid);
      uniforms.textureOrigins.value = textureData.origins;
      uniforms.chunkSize.value = chunkSizeWC;

    }

    /*
    // this does not change a damn thing
    uniforms.nbChunks.needsUpdate = true;
    uniforms.textures.needsUpdate = true;
    uniforms.textureOrigins.needsUpdate = true;
    uniforms.chunkSize.needsUpdate = true;
    uniforms.useColorMap.needsUpdate = true;
    uniforms.colorMap.needsUpdate = true;
    */
  }


  /**
  * @return the main plane, containing all the sub-planes
  */
  getPlane(){
    return this._plane;
  }


  /**
  * Update the internal resolution level and scale the plane accordingly.
  * @param {Number} lvl - zoom level, most likely in [0, 6] (integer)
  */
  updateScaleFromRezLvl( lvl ){

    // safety measure
    if(lvl < 0){
      lvl = 0;
    }

    this._resolutionLevel = lvl;
    var scale = 1 / Math.pow( 2, this._resolutionLevel );

    this._plane.scale.x = scale;
    this._plane.scale.y = scale;
    this._plane.scale.z = scale;

    // explicitely call to update the matrix, otherwise it would be called at the next render
    // and in the meantime, we need to have proper position to load the chunks.
    this._plane.updateMatrixWorld();

    // this one is not supposed to be necessary
    //this._plane.updateMatrix();

    // now the size is updated, we update the texture
    this.updateUniforms();
  }


  /**
  * Compute and return the normal vector of this plane in world coordinates using the local quaternion.
  * @returns {THREE.Vector3} a normalized vector.
  */
  getWorldNormal(){
    return this._getWorldVectorNormalized( new THREE.Vector3(0, 0, 1) );
  }


  getWorldVectorU(){
    return this._getWorldVectorNormalized( new THREE.Vector3(1, 0, 0) );
  }


  getWorldVectorV(){
    return this._getWorldVectorNormalized( new THREE.Vector3(0, 1, 0) );
  }


  /**
  * [PRIVATE]
  * Transform a local vector (local to the plane) into a world coodinate vector.
  * @param {THREE.Vector3} v - a local vector
  * @returns {THREE.Vector3} a vector in world coodinates
  */
  _getWorldVectorNormalized( v ){
    var ParentQuaternion = new THREE.Quaternion().copy(this._plane.quaternion);
    var vector = v.clone();
    vector.applyQuaternion(ParentQuaternion).normalize();
    return vector;
  }


  /**
  * @return {Number} the size of this plane diagonal in world coordinates.
  */
  getWorldDiagonal(){
    var diago = Math.sqrt( Math.pow(this._subPlaneDim.row, 2) + Math.pow(this._subPlaneDim.col, 2) ) * this._plane.scale.x;

    return diago;
  }


  /**
  * Enable a given layer in the visibility mask, so that it's visible by a camera with the same layer activated.
  */
  enableLayer( l ){
    this._plane.children.forEach(function(sp){
      sp.layers.enable(l);
    });
  }


  /**
  * Disable a given layer in the visibility mask, so that it's not visible by a camera with a different layer activated.
  */
  disableLayer( l ){
    this._plane.children.forEach(function(sp){
      sp.layers.disable(l);
    });
  }


  /**
  * Hide this plane (the THEE.Object3D)
  */
  hide(){
    this._plane.visible = false;
  }


  /**
  * Show this plane (the THEE.Object3D)
  */
  show(){
    this._plane.visible = true;
  }


} /* END class ProjectionPlane */


export { ProjectionPlane };
