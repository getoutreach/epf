var get = Ember.get, set = Ember.set;

Ep.ModelArray = Ember.ArrayProxy.extend({

  session: null,
  meta: null,

  arrayContentWillChange: function(index, removed, added) {
    this._super.apply(this, arguments);

    for (var i=index; i<index+removed; i++) {
      var model = this.objectAt(i);

      if(this.session) {
        this.session.arrayManager.unregister(this, model);
      }
    }
  },

  arrayContentDidChange: function(index, removed, added) {
    this._super.apply(this, arguments);

    for (var i=index; i<index+added; i++) {
      var model = this.objectAt(i);

      if(this.session) {
        this.session.arrayManager.register(this, model);
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
    for(var i = 0; i < this.length; i++) {
      var m = this[i];
      if(obj.isEqual(m)) return true;
    }
    return false;
  }

});