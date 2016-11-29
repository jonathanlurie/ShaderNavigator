'use strict';

/**
* An HashIO instance reads and writes the hash part of the URL (what is after '#').
* The read mode: the user can specify some arguments in the URL to specify
* the resolution level, the position and the rotation. Here is how the URL should
* look like: mydomain.com/quadView.html#5/1.01,1.02,1.03/0.1,0.2,0.3
* Where:
*    5 is the resolution level
*    1.01,1.02,1.03 is the x,y,z position of the intersection plane
*    0.1,0.2,0.3 is the x,y,z Euler angle rotation of the intersection plane
*
* The write mode: everytime the intersection plane is moved, the hash is refreshed
* so that the url can be used to come back to a specific position within the dataset.
*
*/
class HashIO{

  constructor(){
    this._rePattern = /(\d)[\/]([-]?[0-9]*[.]?[0-9]+)[,]([-]?[0-9]*[.]?[0-9]+)[,]([-]?[0-9]*[.]?[0-9]+)[\/]([-]?[0-9]*[.]?[0-9]+)[,]([-]?[0-9]*[.]?[0-9]+)[,]([-]?[0-9]*[.]?[0-9]+)/g;

  }


  /**
  * @returns the hash if there is one (without the '#'). Return an empty string if no hash.
  */
  getRawHash(){
    return window.location.hash.substr(1);
  }


  /**
  * Reads the URL hash and returns plane intersection information if the format matches.
  * @return {Object} the returned object if of the form:
  * { resolutionLvl, position {x, y, z}, rotation {x, y, z} }
  * Or returns null if the format does not match.
  */
  getHashInfo(){
    var match  = this._rePattern.exec( this.getRawHash() );

    if(!match)
      return null;

    return {
      resolutionLvl: parseInt(match[1]),
      position: {
        x: parseFloat(match[2]),
        y: parseFloat(match[3]),
        z: parseFloat(match[4])
      },
      rotation: {
        x: parseFloat(match[5]),
        y: parseFloat(match[6]),
        z: parseFloat(match[7])
      }
    };
  }

  /**
  * Write the hash part of the url
  * @param {Object} objectInfo - should have this structure:
  *   { resolutionLvl, position {x, y, z}, rotation {x, y, z} }
  *
  */
  setHashInfo( objectInfo ){
    window.location.hash = objectInfo.resolutionLvl + "/"+
      objectInfo.position.x + "," +
      objectInfo.position.y + "," +
      objectInfo.position.z + "/" +
      objectInfo.rotation.x + "," +
      objectInfo.rotation.y + "," +
      objectInfo.rotation.z;
  }



} /* END CLASS HashIO */

export { HashIO };
