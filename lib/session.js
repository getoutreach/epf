var get = Ember.get, set = Ember.set;

require('./model_array');
require('./model_array_manager');
require('./model_cache');

var uuid = 1;

Ep.SessionMixin = Ember.Mixin.create({

  init: function() {
    this._super.apply(this, arguments);
    this.cache = Ep.ModelCache.create();
    this.arrayManager = Ep.ModelArrayManager.create();
  },

  lookupType: function(type) {
    return this.container.lookup('model:' + type);
  },

  merge: function(model) {
    return model.merge(this);
  },

  remove: function(model) {
    // TODO: what does this mean for all relationships of the model in the session?
    // TODO: can models be removed?
    return this.cache.remove(model);
  },

  add: function(model) {
    if(!get(model, 'clientId')) {
      set(model, 'clientId', this.generateClientId());
    }
    set(model, 'session', this);
    return this.cache.add(model);
  },

  getModel: function(model) {
    return this.cache.getModel(model);
  },

  getForId: function(type, id) {
    return this.cache.getForId(type, id);
  },

  destroy: function() {
    this._super();
    this.cache.destroy();
    this.arrayManager.destroy();
    this.models.forEach(function(model) {
      model.destroy();
    });
    this.adapter.sessionWasDestroyed(this);
  },

  models: Ember.computed.alias('cache.models'),

  generateClientId: function() {
    return Ember.guidFor(this) + "-" + (uuid ++);
  }

});

Ep.Session = Ember.Object.extend(Ep.SessionMixin, {

  create: function(type) {
    if(typeof type === "string") {
      type = this.lookupType(type);
    }
    var model = type.create();
    this.add(model);
    return model;
  },

  deleteModel: function(model) {
    set(model, 'isDeleted', true);
    this.arrayManager.modelWasDeleted(model);
  },

  load: function(type, id) {
    if(typeof type === "string") {
      type = this.lookupType(type);
    }
    var cached;
    // always coerce to string
    id = id.toString();

    if(cached = this.getForId(type, id)) {
      return Ember.RSVP.resolve(cached);
    } else {
      var session = this;
      // TODO: handle errors
      return this.adapter.load(type, id).then(function(model) {
        return session.merge(model);
      });
    }
  },

  find: function(type, query) {
    if(typeof type === "string") {
      type = this.lookupType(type);
    }
    var session = this;
    return this.adapter.find(type, query).then(function(models) {
      var merged = Ep.ModelArray.create({content: models, session: session});
      return merged;
    });
  },

  refresh: function(model) {
    var session = this;
    // TODO: handle errors
    return this.adapter.refresh(model).then(function(refreshedModel) {
      return session.merge(refreshedModel);
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
  }

});