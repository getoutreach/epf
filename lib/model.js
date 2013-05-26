var get = Ember.get, set = Ember.set;

require('./model_cache');

Orm.ModelMixin = Ember.Mixin.create({

  id: null,
  clientId: null,
  session: null,
  errors: null,

  /**
    Two models are "equal" when they correspond to the same
    key. This does not mean they necessarily have the same data.
  */
  equals: function(model) {
    var thisType = this.type || this.constructor;
    var otherType = model.type || model.constructor;
    Ember.assert("Cannot compare models of different types.", thisType === otherType);
    return get(model, 'clientId') == get(this, 'clientId')
      || get(model, 'id') && get(model, 'id') == get(this, 'id');
  },


  /**
    Model promises are just proxies and do not have the
    literal type of their contents.

    TODO: handle polymorphism for proxies
  */
  hasType: function(type) {
    return this instanceof type || this.type === type;
  }

});

Orm.Model = Ember.Object.extend(Orm.ModelMixin, {

  isPromise: false,
  isDeleted: false,
  isLoaded: true,

  // TODO: allow assigning id?
  isNew: Ember.computed(function() {
    return !get(this, 'id');
  }).property('id'),

  // TODO: volatile isDirty

  /**
    Recursively merges two object graphs rooted at this model.

    @method merge
    @param session {*} The collection of existing models to merge against
    @param cache [Orm.ModelCache] Used to track already merged objects
    @return {Orm.Model} An existing model inside the session or a copy of the model.
  */
  merge: function(session, cache) {
    // TODO: handle lazy models
    if(!cache) cache = Orm.ModelCache.create();
    if(cache.getModel(this)) {
      return;
    }
    cache.add(this);
    var dest = session.getModel(this);
    var promise;
    if(dest && get(dest, 'isPromise')) {
      // if the destination is a promise we want to
      // merge it's content
      promise = dest;
      dest = dest.content;
    }
    if(!dest) {
      dest = this.constructor.create();
      if(promise) {
        // update the content of the promie so any lingering
        // references will still function
        set(promise, content, dest);
      }
    }
    // TODO: maybe not always set these?
    set(dest, 'id', get(this, 'id'));
    set(dest, 'clientId', get(this, 'clientId'));
    set(dest, 'errors', Ember.copy(get(this, 'errors')));
    session.add(dest);
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
            child.merge(session, cache);
          } else if(child) {
            set(dest, name, child.merge(session, cache));
          } else if(dest) {
            set(dest, name, null);
          }
        } else if(relationship.kind === 'hasMany') {
          var children = get(this, name);
          var destChildren = get(dest, name);
          destChildren.clear();
          children.forEach(function(child) {
            destChildren.addObject(child.merge(session, cache));
          });
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
        var right = get(model, name);
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