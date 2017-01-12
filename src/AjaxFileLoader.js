'use strict';

/**
* Contains only static methods to load various kind of data with an AJAX request.
*/
class AjaxFileLoader{

  /**
  * Loads a text file and makes its content available thru a String.
  * @param {String} url - URL of the file to load
  * @param {callback} successCallback - function to call when the file is loaded. Called with one String argument.
  * @param {callback} errorCallback - function to call when the file failed to load. Called with a Number argument (http status).
  */
  static loadTextFile(url, successCallback, errorCallback) {
    var xhr = typeof XMLHttpRequest != 'undefined'
      ? new XMLHttpRequest()
      : new ActiveXObject('Microsoft.XMLHTTP');

    xhr.open('GET', url, true);

    xhr.onload = function() {
      var status;
      var data;

      if (xhr.readyState == 4) { // `DONE`
        status = xhr.status;
        if (status == 200) {
          successCallback && successCallback(xhr.responseText);
        } else {
          errorCallback && errorCallback(status);
        }
      }
    };

    xhr.onerror = function(e){
      errorCallback && errorCallback(status);
    }

    xhr.send();
  }



  static loadCompressedTextFile(url, successCallback, errorCallback) {
    if(! AjaxFileLoader.isPakoAvailable()){
      errorCallback("Pako lib is not available, please include it to your project.")
      return;
    }

    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.responseType = "arraybuffer";

    xhr.onload = function (oEvent) {

      var status = xhr.status;
      var arrayBuffer = xhr.response;

      if (arrayBuffer) {
        var unzipped = pako.inflate(arrayBuffer);
        var result = unzipped.buffer;
        var blob = new Blob([result]);
        var fileReader = new FileReader();

        fileReader.onload = function(event) {
          //console.log(event.target.result.length);
          successCallback && successCallback(event.target.result);
        };

        fileReader.onerror = function(event){
          errorCallback && errorCallback(event);
        }

        fileReader.readAsText(blob);
      }
    };

    xhr.onerror = function(e){
      console.error("Can't find the file " + url);
      errorCallback && errorCallback(status);
    }

    xhr.send(null);

  }


  /**
  * Check if Pako lib (for reading gz files) is available.
  * @return true if available, or false if not
  */
  static isPakoAvailable(){
    var isIt = true;

    try{
      pako;
    }catch(e){
      console.warn(e);
      isIt = false;
    }

    return isIt;
  }


}/* END CLASS AjaxFileLoader */

export { AjaxFileLoader };
