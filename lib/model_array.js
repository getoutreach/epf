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
  }

});