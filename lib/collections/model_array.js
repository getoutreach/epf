var get = Ember.get, set = Ember.set;

Ep.ModelArray = Ember.ArrayProxy.extend({

  session: null,
  meta: null,

  arrayContentWillChange: function(index, removed, added) {
    for (var i=index; i<index+removed; i++) {
      var model = this.objectAt(i);
      var session = get(this, 'session');

      if(session) {
        session.collectionManager.unregister(this, model);
      }
    }

    this._super.apply(this, arguments);
  },

  arrayContentDidChange: function(index, removed, added) {
    this._super.apply(this, arguments);

    for (var i=index; i<index+added; i++) {
      var model = this.objectAt(i);
      var session = get(this, 'session');

      if(session) {
        session.collectionManager.register(this, model);
      }
    }
  },

  removeObject: function(obj) {
    var loc = get(this, 'length') || 0;
    while(--loc >= 0) {
      var curObject = this.objectAt(loc) ;
      if (curObject.isEqual(obj)) this.removeAt(loc) ;
    }
    return this ;
  },

  contains: function(obj){
    for(var i = 0; i < get(this, 'length') ; i++) {
      var m = this.objectAt(i);
      if(obj.isEqual(m)) return true;
    }
    return false;
  },

  /**
    Ensure that dest has the same content as this array.

    @method copyTo
    @param dest the other model collection to copy to
    @return dest
  */
  copyTo: function(dest) {
    var existing = Ep.ModelSet.create();
    existing.addObjects(dest);

    this.forEach(function(model) {
      if(existing.contains(model)) {
        existing.remove(model);
      } else {
        dest.pushObject(model);
      }
    });

    dest.removeObjects(existing);
  },

  diff: function(arr) {
    var diff = Ember.A();

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
  },

  isEqual: function(arr) {
    return this.diff(arr).length === 0;
  }

});