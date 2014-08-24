import Error from '../error';
import copy from '../utils/copy';

var EMPTY = [],
    splice = Array.prototype.splice;
    
/**
  Array subclass which implements a variety of mutation methods that
  support `arrayContentDidChange` and `arrayContentWillChange` hooks.
  
  @class ObservableArray
*/
export default class ObservableArray extends Array {

  /**
    Remove all elements from the array. This is useful if you
    want to reuse an existing array without having to recreate it.

    ```javascript
    var colors = ["red", "green", "blue"];
    color.length();   //  3
    colors.clear();   //  []
    colors.length();  //  0
    ```

    @method clear
    @return {Ember.Array} An empty Array.
  */
  clear () {
    var len = this.length;
    if (len === 0) return this;
    this.replace(0, len, EMPTY);
    return this;
  }

  /**
    This will use the primitive `replace()` method to insert an object at the
    specified index.

    ```javascript
    var colors = ["red", "green", "blue"];
    colors.insertAt(2, "yellow");  // ["red", "green", "yellow", "blue"]
    colors.insertAt(5, "orange");  // Error: Index out of range
    ```

    @method insertAt
    @param {Number} idx index of insert the object at.
    @param {Object} object object to insert
    @return {Ember.Array} receiver
  */
  insertAt(idx, object) {
    if (idx > this.length) throw new Error("Index out of range");
    this.replace(idx, 0, [object]);
    return this;
  }

  /**
    Remove an object at the specified index using the `replace()` primitive
    method. You can pass either a single index, or a start and a length.

    If you pass a start and length that is beyond the
    length this method will throw an `OUT_OF_RANGE_EXCEPTION`.

    ```javascript
    var colors = ["red", "green", "blue", "yellow", "orange"];
    colors.removeAt(0);     // ["green", "blue", "yellow", "orange"]
    colors.removeAt(2, 2);  // ["green", "blue"]
    colors.removeAt(4, 2);  // Error: Index out of range
    ```

    @method removeAt
    @param {Number} start index, start of range
    @param {Number} len length of passing range
    @return {Ember.Array} receiver
  */
  removeAt(start, len) {
    if ('number' === typeof start) {

      if ((start < 0) || (start >= this.length)) {
        throw new Error("Index out of range");
      }

      // fast case
      if (len === undefined) len = 1;
      this.replace(start, len, EMPTY);
    }

    return this;
  }

  /**
    Push the object onto the end of the array. Works just like `push()` but it
    is KVO-compliant.

    ```javascript
    var colors = ["red", "green"];
    colors.pushObject("black");     // ["red", "green", "black"]
    colors.pushObject(["yellow"]);  // ["red", "green", ["yellow"]]
    ```

    @method pushObject
    @param {*} obj object to push
    @return object same object passed as a param
  */
  pushObject(obj) {
    this.insertAt(this.length, obj);
    return obj;
  }

  /**
    Add the objects in the passed numerable to the end of the array. Defers
    notifying observers of the change until all objects are added.

    ```javascript
    var colors = ["red"];
    colors.pushObjects(["yellow", "orange"]);  // ["red", "yellow", "orange"]
    ```

    @method pushObjects
    @param {Ember.Enumerable} objects the objects to add
    @return {Ember.Array} receiver
  */
  pushObjects(objects) {
    this.replace(this.length, 0, objects);
    return this;
  }

  /**
    Pop object from array or nil if none are left. Works just like `pop()` but
    it is KVO-compliant.

    ```javascript
    var colors = ["red", "green", "blue"];
    colors.popObject();   // "blue"
    console.log(colors);  // ["red", "green"]
    ```

    @method popObject
    @return object
  */
  popObject() {
    var len = this.length;
    if (len === 0) return null;

    var ret = this.objectAt(len-1);
    this.removeAt(len-1, 1);
    return ret;
  }

  /**
    Shift an object from start of array or nil if none are left. Works just
    like `shift()` but it is KVO-compliant.

    ```javascript
    var colors = ["red", "green", "blue"];
    colors.shiftObject();  // "red"
    console.log(colors);   // ["green", "blue"]
    ```

    @method shiftObject
    @return object
  */
  shiftObject() {
    if (this.length === 0) return null;
    var ret = this.objectAt(0);
    this.removeAt(0);
    return ret;
  }

  /**
    Unshift an object to start of array. Works just like `unshift()` but it is
    KVO-compliant.

    ```javascript
    var colors = ["red"];
    colors.unshiftObject("yellow");    // ["yellow", "red"]
    colors.unshiftObject(["black"]);   // [["black"], "yellow", "red"]
    ```

    @method unshiftObject
    @param {*} obj object to unshift
    @return object same object passed as a param
  */
  unshiftObject(obj) {
    this.insertAt(0, obj);
    return obj;
  }

  /**
    Adds the named objects to the beginning of the array. Defers notifying
    observers until all objects have been added.

    ```javascript
    var colors = ["red"];
    colors.unshiftObjects(["black", "white"]);   // ["black", "white", "red"]
    colors.unshiftObjects("yellow"); // Type Error: 'undefined' is not a function
    ```

    @method unshiftObjects
    @param {Ember.Enumerable} objects the objects to add
    @return {Ember.Array} receiver
  */
  unshiftObjects(objects) {
    this.replace(0, 0, objects);
    return this;
  }

  /**
    Reverse objects in the array. Works just like `reverse()` but it is
    KVO-compliant.

    @method reverseObjects
    @return {Ember.Array} receiver
   */
  reverseObjects() {
    var len = this.length;
    if (len === 0) return this;
    var objects = this.toArray().reverse();
    this.replace(0, len, objects);
    return this;
  }

  /**
    Replace all the the receiver's content with content of the argument.
    If argument is an empty array receiver will be cleared.

    ```javascript
    var colors = ["red", "green", "blue"];
    colors.setObjects(["black", "white"]);  // ["black", "white"]
    colors.setObjects([]);                  // []
    ```

    @method setObjects
    @param {Ember.Array} objects array whose content will be used for replacing
        the content of the receiver
    @return {Ember.Array} receiver with the new content
   */
  setObjects(objects) {
    if (objects.length === 0) return this.clear();

    var len = this.length;
    this.replace(0, len, objects);
    return this;
  }

  /**
    Remove all occurances of an object in the array.

    ```javascript
    var cities = ["Chicago", "Berlin", "Lima", "Chicago"];
    cities.removeObject("Chicago");  // ["Berlin", "Lima"]
    cities.removeObject("Lima");     // ["Berlin"]
    cities.removeObject("Tokyo")     // ["Berlin"]
    ```

    @method removeObject
    @param {*} obj object to remove
    @return {Ember.Array} receiver
  */
  removeObject(obj) {
    var loc = this.length || 0;
    while(--loc >= 0) {
      var curObject = this.objectAt(loc);
      if (curObject === obj) this.removeAt(loc);
    }
    return this;
  }

  /**
    Push the object onto the end of the array if it is not already
    present in the array.

    ```javascript
    var cities = ["Chicago", "Berlin"];
    cities.addObject("Lima");    // ["Chicago", "Berlin", "Lima"]
    cities.addObject("Berlin");  // ["Chicago", "Berlin", "Lima"]
    ```

    @method addObject
    @param {*} obj object to add, if not already present
    @return {Ember.Array} receiver
  */
  addObject(obj) {
    if (!this.contains(obj)) this.pushObject(obj);
    return this;
  }
  
  objectAt(idx) {
    return this[idx];
  }
  
  /**
    Adds each object in the passed enumerable to the receiver.

    @method addObjects
    @param {Ember.Enumerable} objects the objects to add.
    @return {Object} receiver
  */
  addObjects(objects) {
    for (var i = objects.length - 1; i >= 0; i--) {
      this.addObject(objects[i]);
    }
    return this;
  }

  /**
    Removes each object in the passed enumerable from the receiver.

    @method removeObjects
    @param {Ember.Enumerable} objects the objects to remove
    @return {Object} receiver
  */
  removeObjects(objects) {
    for (var i = objects.length - 1; i >= 0; i--) {
      this.removeObject(objects[i]);
    }
    return this;
  }

  // primitive for array support.
  replace(idx, amt, objects) {
    // if we replaced exactly the same number of items, then pass only the
    // replaced range. Otherwise, pass the full remaining array length
    // since everything has shifted
    var len = objects ? objects.length : 0;
    this.arrayContentWillChange(idx, amt, len);

    if (len === 0) {
      this.splice(idx, amt);
    } else {
      replace(this, idx, amt, objects);
    }

    this.arrayContentDidChange(idx, amt, len);
    return this;
  }


  // If browser did not implement indexOf natively, then override with
  // specialized version
  indexOf(object, startAt) {
    var idx, len = this.length;

    if (startAt === undefined) startAt = 0;
    else startAt = (startAt < 0) ? Math.ceil(startAt) : Math.floor(startAt);
    if (startAt < 0) startAt += len;

    for(idx=startAt;idx<len;idx++) {
      if (this[idx] === object) return idx ;
    }
    return -1;
  }

  lastIndexOf(object, startAt) {
    var idx, len = this.length;

    if (startAt === undefined) startAt = len-1;
    else startAt = (startAt < 0) ? Math.ceil(startAt) : Math.floor(startAt);
    if (startAt < 0) startAt += len;

    for(idx=startAt;idx>=0;idx--) {
      if (this[idx] === object) return idx ;
    }
    return -1;
  }

  copy(deep) {
    var arr;
    if (deep) {
      arr = this.map(function(item) { return copy(item, true); });
    } else {
      arr = this.slice();
    }
    var res = new this.constructor();
    res.addObjects(arr);
    return res;
  }
  
  get firstObject() {
    return this.objectAt(0);
  }
  
  get lastObject() {
    return this.objectAt(this.length - 1);
  }
  
  contains(obj) {
    return this.indexOf(obj) >= 0;
  }
  
  arrayContentWillChange(index, removed, added) {
  }

  arrayContentDidChange(index, removed, added) {
  }
  
}

function replace(array, idx, amt, objects) {
  var args = [].concat(objects), chunk, ret = [],
      // https://code.google.com/p/chromium/issues/detail?id=56588
      size = 60000, start = idx, ends = amt, count;

  while (args.length) {
    count = ends > size ? size : ends;
    if (count <= 0) { count = 0; }

    chunk = args.splice(0, size);
    chunk = [start, count].concat(chunk);

    start += size;
    ends -= count;

    ret = ret.concat(splice.apply(array, chunk));
  }
  return ret;
}
