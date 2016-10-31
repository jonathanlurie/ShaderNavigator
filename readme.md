# What is es6module ?
It's a simple module architecture using [Rollup](http://rollupjs.org) to bundle the code in one single source file. The purpose is to use your module in a browser with a single import.  
In addition, **es6module** uses [Gulp](http://gulpjs.com/) to run Rollup each and every time a javascript source from the `src` folder is updated.

This module contains a [ES6 classes](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Classes) example: `Foo`. This class is then imported by the project entry-point: `src/es6module.js`, using the ES6 import style.

Documentation is also available to be build, thanks to [Documentation.js](http://documentation.js.org/) that uses the [JSDoc](http://usejsdoc.org/) syntax.

# Prerequisite
Some npm packages need to be installed globally:
```bash
$ npm install -g documentation
$ npm install -g rollup
$ npm install -g gulp
```

You may need a sudo access for that.

## Using es6module as a base
**es6module** is not made to be used as-is, but rather to be a starting point to make your own module. Here is the list of things to change to make it yours:

The entry-point of the module is `src/es6module.js`, of course, you should rename this file with the name of your choice.

In `package.json` file:
- `name`, should be the one of your choice (lower case, possibly with dashes)
- `version`
- `description`
- `main` to the entry point, the file you just renamed
- `moduleName` is important because it separates the classes of your module from other classes that could have the same name in the general scope.
- `moduleBuildDir` *[optionnal]* if you prefere your bundled source in a folder named `dist` rather than `build`, it's here.
- `author` your name
- `license` you can keep MIT of take another one

Note that the tags `moduleName`, `moduleFormat` `moduleBuildDir`, `main` and `moduleBuildDir` from `package.json` are used by `rollup.config.js` and/or `gulpfile.js`.

## Adding custom classes
As you can see in `src/es6module.js`, we import the file `Foo.js`. **Foo** uses the ES6 class notation but alternatively, your custom classes can use the *prototype* kind of declaration. What matters is to export your class or function, like in the very last line of `Foo.js`.

# Build your module
The purpose of building is to have a single *js* source file used in external projects, that contains all the modules. The default is to put it in the `/build/` directory.
Two alternative ways are possible here, they produce the same result:

1. Using Rollup from the script:  
```bash
$ npm run build
```
This actually calls `rollup -c`, that reads its necessary setting from `rollup.config.js`.

2. Using Gulp and its Rollup plugin and watcher. Just run:  
```bash
$ gulp
```
Then, everytime you modify (and save) a *js* file from `/src/`, a task that generates the built version will be performed in the background.

The second is better if you tend to forget to build your project and always wonder why your code does not take in consideration your last edits. If the project gets bigger, building at every edit can take too much time and the first option may be smarter.


# Documentation
Even if you code only for yourself, a bit of documentation can not hurt :) .  
Use the [JSDoc](http://usejsdoc.org/) syntax and then run:  
```bash
$ npm run doc
```
Find the result in the `/doc/` directory.

# How to use your module?
Once built, your module is in `/build/es6module/es6module.js`, you can then follow the webpage example in `/example/test.html`.
