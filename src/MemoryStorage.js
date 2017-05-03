'use strict';

var MemoryStorageRecord = {};


/**
* MemoryStorage is a semi-global shared memory space to set values in a record.
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
  
  
  /**
  * Delete a record from the memory storage. Keep in mind that using "delete" does
  * NOT free the memory.
  * @param {String} name - name of the record.
  */
  static deleteRecord( name ){
    if( name in MemoryStorageRecord){
      delete object[name];
    }else{
      console.warn("The record " + name + " does not exist in MemoryStorage.");
    }
  }
  
  
}

export { MemoryStorage }
