var get = Ember.get, set = Ember.set;

Ep.ChildSession = Ep.Session.extend({

  init: function() {
    this._super.apply(this, arguments);

    var child = this,
        parent = this.parent;

    this.adapter = Ep.Adapter.createWithMixins({
      load: function() {
        return parent.load.apply(parent, arguments);
      },

      findQuery: function() {
        return parent.findQuery.apply(parent, arguments);
      },

      refresh: function() {
        return parent.refresh.apply(parent, arguments);
      },

      flush: function() {
        var dirty = get(child, 'dirtyModels');
        dirty.forEach(function(model) {
          parent.update(model);
        });
        return parent.flush.apply(parent, arguments);
      }
    });
  }


});