var get = Ember.get, set = Ember.set;

require('./model_cache');

Orm.Session = Ember.Object.extend({

  init: function() {
    this._super.apply(this, arguments);
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

  load: function(type, id) {
    var cached;
    // always coerce to string
    id = id.toString();

    if(cached = this.cache.getForId(type, id)) {
      return Ember.RSVP.resolve(cached);
    } else {
      var session = this;
      return this.adapter.load(type, id).then(function(model) {
        return session.merge(model);
      });
    }
  },

  find: null,

  refresh: function(model) {
    var session = this;
    return this.adapter.refresh(model).then(function(newModel) {
      return session.merge(newModel);
    });
  },

  flush: function() {
    return this.adapter.flush(this);
  },

  merge: function(model) {
    var existingModel = this.cache.getForId(model.constructor, get(model, 'id'));
    if(existingModel) {
      model.copyAttributes(existingModel);
      return existingModel;
    }
    model = model.copy();
    this.adopt(model);
    return model;
  },

  evict: function(model) {
    return this.cache.remove(model);
  },

  /**
    @private
   */
  adopt: function(model) {
    set(model, 'session', this);
    this.cache.add(model);
    return model;
  },

  destroy: function() {
    this._super();
    // TODO: destroy all models
    this.adapter.sessionWasDestroyed(this);
  },

  models: Ember.computed.alias('cache.models')

});