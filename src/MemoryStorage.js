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
  * Adds or modify a record.
  * @param {String} name - name or the record, will be unique
  * @param {Object} value - the value to put in the record 
  */
  static setRecord( name, value ){
    MemoryStorageRecord[ name ] = value;
  }
  
  
  /**
  * Get a record
  * @param {String} name - name of the record
  * @return {Object} existing value or null if there is no record with such name
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
