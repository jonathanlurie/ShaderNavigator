/*
  Author: Jonathan Lurie - 2016
  Email: lurie.jo@gmail.com
  License: MIT - http://choosealicense.com/licenses/mit/
*/

var JpegDistantReader = function(){

}

/*
  Performs the http request and put the image data into a Uint8Array.
  Args:
    url: String - address to reach the file (local file system or allowed http)
    callback: String - Function to call when the data is fetched.
              Uint8Array in args of the callback.
*/
JpegDistantReader.prototype.loadAsUint8Array = function(url, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url);
  xhr.responseType = 'arraybuffer';
  xhr.onload = function () {
    callback(new Uint8Array(xhr.response));
  };
  xhr.send();
}


/*
  Copy the information of the loaded image into the imageData structure.
  Args:
    url: String - local or distant address to a jpeg image. A distant http file
                  must accespt Cross Origin request if not on the same server.
    imageData: ImageData instance - object to build.
*/
JpegDistantReader.prototype.decodeImage = function(url, imageData) {

  this.loadAsUint8Array(url, function (encoded) {
    var numComponents, width, height, decoded, parser;

    parser = new JpegDecoder();
    parser.parse(encoded);
    width = parser.width;
    height = parser.height;
    numComponents = parser.numComponents;
    decoded = parser.getData(width, height);

    // build the image in argument (type agnostic object)
    imageData.build(decoded, width, height, numComponents)
  });

}
