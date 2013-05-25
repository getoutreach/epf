var get = Ember.get, set = Ember.set;

require('./model_cache');

var uuid = 1;

Orm.Session = Ember.Object.extend({

  init: function() {
    this._super.apply(this, arguments);
    this.cache = Orm.ModelCache.create();
  },

  create: function(type) {
    if(typeof type === "string") {
      type = this.lookupType(type);
    }
    var model = type.create();
    this.adopt(model);
    return model;
  },

  lookupType: function(type) {
    return this.container.lookup('model:' + type);
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
    // TODO: thinks about server/client revisions here
    var existingModel = this.cache.getForModel(model);
    if(existingModel === model) return;
    if(existingModel) {
      if(get(existingModel, 'isNew')) {
        set(existingModel, 'id', get(model, 'id'));
      }
      model.merge(existingModel);
      model = existingModel;
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
    if(get(model, 'session') === this) return;
    set(model, 'session', this);
    // TODO: is it bad to always reset the clientId?
    set(model, 'clientId', this.generateClientId());
    this.cache.add(model);
    // recursively add all related models
    if(get(model, 'isLoaded')) {
      model.eachRelationship(function(name, relationship) {
        if(relationship.kind === 'belongsTo') {
          var child = get(model, name);
          if(child) this.adopt(child);
        } else if(relationship.kind === 'hasMany') {
          var children = get(model, name);
          children.forEach(function(child) {
            this.adopt(child);
          }, this);
        }
      }, this);
    }
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