var get = Ember.get, set = Ember.set;

require('./model_cache');

Orm.ModelMixin = Ember.Mixin.create({

  id: null,
  clientId: null,
  session: null,

  /**
    Two models are equal when they correspond to the same
    key. This does not mean they have the same data.
  */
  equals: function(model) {
    var thisType = this.type || this.constructor;
    var otherType = model.type || model.constructor;
    Ember.assert("Cannot compare models of different types.", thisType === otherType);
    return get(model, 'clientId') == get(this, 'clientId')
      || get(model, 'id') && get(model, 'id') == get(this, 'id');
  }

});

Orm.Model = Ember.Object.extend(Ember.Copyable, Orm.ModelMixin, {

  isDeleted: false,
  isLoaded: true,

  // TODO: allow assigning id?
  isNew: Ember.computed(function() {
    return !get(this, 'id');
  }).property('id'),

  // TODO: volatile isDirty

  /**
    Recursively copies the entire object graph
  */
  copy: function(cache) {
    if(!cache) cache = Orm.ModelCache.create();
    var copy;
    if(copy = cache.getForModel(this)) {
      return copy;
    }
    copy = cache.add(this.constructor.create());
    copy.suspendRelationshipObservers(function() {
      set(copy, 'id', get(this, 'id'));
      set(copy, 'clientId', get(this, 'id'));
      // TODO: revision?
      this.eachAttribute(function(name, meta) {
        // TODO: handle non-primitive attributes
        set(copy, name, get(this, name));
      }, this);
      this.eachRelationship(function(name, relationship) {
        if(relationship.kind === 'belongsTo') {
          var child = get(this, name);
          if(child) {
            set(copy, name, child.copy(cache));
          }
        } else if(relationship.kind === 'hasMany') {
          var children = get(this, name);
          var copiedChildren = get(copy, name);
          children.forEach(function(child) {
            copiedChildren.addObject(child.copy(cache));
          }, this);
        }
      }, this);
    }, this);
    return copy;
  },

  /**
    Recursively merges attributes between two object graphs.
  */
  merge: function(dest, cache) {
    // TODO: handle lazy models
    if(!cache) cache = Orm.ModelCache.create();
    if(cache.getForModel(dest)) {
      return;
    }
    cache.add(dest);
    dest.suspendRelationshipObservers(function() {
      this.eachAttribute(function(name, meta) {
        // TODO: handle non-primitive attributes
        var left = get(this, name);
        var right = get(dest, name);
        if(left !== right) set(dest, name, left);
      }, this);
      this.eachRelationship(function(name, relationship) {
        if(relationship.kind === 'belongsTo') {
          var child = get(this, name);
          var destChild = get(dest, name);
          if(child && destChild) {
            child.merge(destChild, cache);
          } else if(child) {
            set(dest, name, child.copy(cache));
          } else if(dest) {
            set(dest, name, null);
          }
        } else if(relationship.kind === 'hasMany') {
          var children = get(this, name);
          var destChildren = get(dest, name);
          children.merge(destChildren);
        }
      }, this);
    }, this);
    return dest;
  },

  diff: function(model) {
    var diffs = [];

    // TODO: for now we are checking entire fields
    this.eachAttribute(function(name, meta) {
      var left = get(this, name);
      var right = get(model, name);
      if(left instanceof Date && right instanceof Date) {
        left = left.getTime();
        right = right.getTime();
      }
      if(left !== right) {
        // eventually we will have an actual diff
        diffs.push({type: 'attr', name: name});
      }
    }, this);

    this.eachRelationship(function(name, relationship) {
      if(relationship.kind === 'belongsTo') {
        var left = get(this, name);
        var right = get(dest, name);
        if(left && right) {
          if(!left.equals(right)) {
            diffs.push({type: 'belongsTo', name: name, relationship: relationship});
          }
        } else if(left || right) {
          diffs.push({type: 'belongsTo', name: name, relationship: relationship});
        }
      } else if(relationship.kind === 'hasMany') {
        // TODO: compute hasMany diffs
        // this will be required for non-relational backends
      }
    }, this);

    return diffs;
  },

  _suspendedRelationships: false,

  /**
    @private

    The goal of this method is to temporarily disable specific observers
    that take action in response to application changes.

    This allows the system to make changes (such as materialization and
    rollback) that should not trigger secondary behavior (such as setting an
    inverse relationship or marking records as dirty).

    The specific implementation will likely change as Ember proper provides
    better infrastructure for suspending groups of observers, and if Array
    observation becomes more unified with regular observers.
  */
  suspendRelationshipObservers: function(callback, binding) {
    var observers = get(this.constructor, 'relationshipNames').belongsTo;
    var self = this;

    // could be nested
    if(this._suspendedRelationships) return;

    try {
      this._suspendedRelationships = true;
      Ember._suspendObservers(self, observers, null, 'belongsToDidChange', function() {
        Ember._suspendBeforeObservers(self, observers, null, 'belongsToWillChange', function() {
          callback.call(binding || self);
        });
      });
    } finally {
      this._suspendedRelationships = false;
    }
  },

});