var get = Ember.get, set = Ember.set, copy = Ember.copy;

import copy from '../utils/copy';

class Errors extends Map {

  constructor(obj) {
    super()
    for(var key in obj) {
      if(!obj.hasOwnProperty(key)) return;
      this.set(key, obj[key]);
    }
  }
  
  copy() {
    var res = new this.constructor();
    this.forEach(function(value, key) {
      res.set(value, copy(value));
    });
    return res;
  }

}

export default Errors;
