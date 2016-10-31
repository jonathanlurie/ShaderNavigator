This wrapper relies on this pure [javascript jpeg/dct decoder](https://github.com/notmasteryet/jpgjs).  

**jpgjsWrapper** adds just the necessary to handle the http request and the access to the decoded image data (width, height, number of components per pixel, pixel values at given coordinates).

The main advantage is to bypass the use of a canvas when we just want to get pixel values, especially when directly displaying the image is not necessary.

**Possible use-case**: loading tiled images in webworkers through http requests and use the concatenated tiles as a WebGL texture.

This piece of code is taken from `example.html`:  

```js
// distant or local image url
let url = "images/j1.jpg";

// the jpeg reader over http
let jpgReader = new JpegDistantReader();

// Imade data container
let myImage = new ImageData();

// Things to do when the image is eventually loaded.
// img is an instance the instance of ImageData, aka. myImage in this case.
myImage.isLoaded(function(img){
  document.write("<p>Image width: " + img.getWidth() + " px</p>");
  document.write("<p>Image heigth: " + img.getHeight() + " px</p>");
  document.write("<p>Number of components per pixel: " + img.getComponents() + " bands</p>");
  document.write("<p>The pixel value at [32, 156] is " + img.getValue(32, 156) + "</p>");
  document.write("<img src=\"" + url + "\"/>");
});

// reads the jpeg from a url and stores the necessary data into myImage
jpgReader.decodeImage(url, myImage);
```
