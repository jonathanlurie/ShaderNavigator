'use strict';

var MemoryStorageRecord = {};


/**
* MemoryStorage is a semi-global shared memory space to set values in a reccord.
* (not accessible from global scope, just accessible from shaderNavigator's scope)
* This is helpful to share some data between objects that are unrealated enough
* to make it irrelevant sending arguments
*
*/
class MemoryStorage {
  
  /**
  *
  */
  static setRecord( name, value ){
    MemoryStorageRecord[ name ] = value;
  }
  
  /**
  *
  */
  static getRecord( name ){
    if( name in MemoryStorageRecord){
      return MemoryStorageRecord[name];
    }else{
      return null;
    }
  }
  
}

export { MemoryStorage }
