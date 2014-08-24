import ObservableArray from './observable_array';
import ModelSet from './model_set';
import isEqual from '../utils/is_equal';

export default class ModelArray extends ObservableArray {
  
  arrayContentWillChange(index, removed, added) {
    for (var i=index; i<index+removed; i++) {
      var model = this.objectAt(i);
      var session = this.session;

      if(session) {
        session.collectionManager.unregister(this, model);
      }
    }

    super(index, removed, added);
  }

  arrayContentDidChange(index, removed, added) {
    super(index, removed, added);

    for (var i=index; i<index+added; i++) {
      var model = this.objectAt(i);
      var session = this.session;

      if(session) {
        session.collectionManager.register(this, model);
      }
    }
  }

  removeObject(obj) {
    var loc = this.length || 0;
    while(--loc >= 0) {
      var curObject = this.objectAt(loc) ;
      if (isEqual(curObject, obj)) this.removeAt(loc) ;
    }
    return this ;
  }

  contains(obj){
    for(var i = 0; i < this.length ; i++) {
      var m = this.objectAt(i);
      if(isEqual(obj, m)) return true;
    }
    return false;
  }

  /**
    Ensure that dest has the same content as this array.

    @method copyTo
    @param dest the other model collection to copy to
    @return dest
  */
  copyTo(dest) {
    var existing = new ModelSet(dest);

    this.forEach(function(model) {
      if(existing.has(model)) {
        existing.delete(model);
      } else {
        dest.pushObject(model);
      }
    });

    for(var model of existing) {
      dest.removeObject(model);
    }
  }
  
  copy() {
    return super(true);
  }

  diff(arr) {
    var diff = new this.constructor();

    this.forEach(function(model) {
      if(!arr.contains(model)) {
        diff.push(model);
      }
    }, this);

    arr.forEach(function(model) {
      if(!this.contains(model)) {
        diff.push(model);
      }
    }, this);

    return diff;
  }

  isEqual(arr) {
    return this.diff(arr).length === 0;
  }

  load() {
    var array = this;
    return Ember.RSVP.all(this.map(function(model) {
      return model.load();
    })).then(function() {
      return array;
    });
  }

}
