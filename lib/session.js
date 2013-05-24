var get = Ember.get, set = Ember.set;

require('./model_cache');

var uuid = 1;

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
      // TODO: handle errors
      return this.adapter.load(type, id).then(function(model) {
        return session.merge(model);
      });
    }
  },

  find: null,

  refresh: function(model) {
    var session = this;
    // TODO: handle errors
    return this.adapter.refresh(model).then(function(newModel) {
      return session.merge(newModel);
    });
  },

  flush: function() {
    var session = this;
    // TODO: handle errors
    return this.adapter.flush(this).then(function(models) {
      models.forEach(function(model) {
        session.merge(model);
      });
    });
  },

  merge: function(model) {
    // TODO: should only copy different attributes
    // TODO: thinks about server/client revisions here
    var existingModel = this.cache.getForModel(model);
    if(existingModel) {
      if(get(existingModel, 'isNew')) {
        set(existingModel, 'id', get(model, 'id'));
      }
      model.copyAttributes(existingModel);
      return existingModel;
    }
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
    set(model, 'clientId', this.generateClientId());
    this.cache.add(model);
    return model;
  },

  destroy: function() {
    this._super();
    // TODO: destroy all models
    this.adapter.sessionWasDestroyed(this);
  },

  models: Ember.computed.alias('cache.models'),

  generateClientId: function() {
    return Ember.guidFor(this) + "-" + (uuid ++);
  }

});