/*
  Author: Jonathan Lurie - 2016
  Email: lurie.jo@gmail.com
  License: MIT - http://choosealicense.com/licenses/mit/
*/

/*
  Even though an ImageData will most likely be taken out of a jpeg image, in order
  to keep the format generic, ImageData does not have direct dependencies to
  JpegDistantReader.

  The slowest varying dimension of this._data is along y, the faster is along x.
  In other word, this._data contains RGBRGBRGB de la 1ere ligne, puis RGBRGBRGB
  de la seconde ligne, etc.
*/

var ImageData = function(){
  // pixel values in a 1D array (RGBRGBRGB...)
  this._data = null;

  this._width = 0;
  this._height = 0;

  // number of components/bands per pixel (i.e. 3 for RGB)
  this._components = 0;

  this._isLoadedCallback = null;

  this._appropriateGetValueMethod = this._getValueMultiComponent;
}


/*
  Loads the image and call a callback if defined
*/
ImageData.prototype.build = function(data, width, height, components){
  this._data = data;
  this._width = width;
  this._height = height;
  this._components = components;

  if(this._components == 1){
    this._appropriateGetValueMethod = this._getValueMonoComponent;
  }

  // call a predefined callback with the current image in argument
  if(this._isLoadedCallback){
    this._isLoadedCallback(this);
  }
}


/*
  specify a callback for when it will be loaded.
  This callback will be call with _this_ image in argument.
*/
ImageData.prototype.isLoaded = function(cb){
  this._isLoadedCallback = cb;
}


/*
  return the width of the image.
*/
ImageData.prototype.getWidth = function(){
  return this._width;
}


/*
  return the height of the image.
*/
ImageData.prototype.getHeight = function(){
  return this._height;
}


/*
  Return the number of components per pixel
  (aka. the number of bands, ie. 3 for an RGB image)
*/
ImageData.prototype.getComponents = function(){
  return this._components;
}


/*
  Return the pixel value. Two alternatives are available for a matter of heavy load optimization:
  - single component image will call _getValueMonoComponent
  - multi component image will call _getValueMultiComponent
  But this choice is made earlier to avoid a condition at every request (see build() )
*/
ImageData.prototype.getValue = function(x, y){
  if(x < 0 || x >= this._width || y < 0 || y >= this._height){
    console.warn("ImageData.getValue is out of image.");
    return null;
  }

  // call the appropriate function
  return this._appropriateGetValueMethod(x, y);
}


/*
  PRIVATE
  Returns a single value
*/
ImageData.prototype._getValueMonoComponent = function(x, y){
  var pixelPosition = y * this._width + x;
  return this._data[pixelPosition];
}


/*
  PRIVATE
  Return the pixel value when multiple componants
*/
ImageData.prototype._getValueMultiComponent = function(x, y){
  var pixelPosition = (y * this._width + x) * this._components;
  var extract = this._data.slice(pixelPosition, pixelPosition + this._components);
  return extract;
}
