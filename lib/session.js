var get = Ember.get, set = Ember.set;

require('./model_cache');

Orm.Session = Ember.Object.extend({

  init: function() {
    this._super();
    this.cache = Orm.ModelCache.create();
  },

  create: function(type) {
    type = this.container.lookup('model:' + type);
    var model = type.create();
    this.adopt(model);
    return model;
  },

  deleteModel: function(model) {
    set(model, 'isDeleted', true);
  },

  load: function(id) {
    var cached;

    if(cached = this.modelCache.getForId(id)) {
      return Ember.RSVP.resolve(cached);
    } else {
      var session = this;
      return this.adapter.load(id).then(function(model) {
        session.adopt(model);
      });
    }
  },

  find: null,

  refresh: null,

  flush: function() {
    return this.adapter.flush(this);
  }

  merge: null,

  evict: function(model) {
    return this.modelCache.remove(model);
  },


  /**
    @private
   */
  adopt: function(model) {
    set(model, 'session', this);
    this.modelCache.add(model);
    return model;
  },

  destroy: function() {
    this._super();
    this.adapter.sessionWasDestroyed(this);
  }

});