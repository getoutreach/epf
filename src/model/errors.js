var get = Ember.get, set = Ember.set, copy = Ember.copy;

import copy from '../utils/copy';

// XXX: fails on FF
class Errors extends Map {

  constructor(obj={}) {
    super()
    for(var key in obj) {
      if(!obj.hasOwnProperty(key)) continue;
      this.set(key, obj[key]);
    }
  }
  
  copy() {
    var res = new this.constructor();
    this.forEach(function(value, key) {
      res.set(key, copy(value));
    });
    return res;
  }

}

export default Errors;
