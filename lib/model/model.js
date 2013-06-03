var get = Ember.get, set = Ember.set;

require('../collections/model_set');

Ep.ModelMixin = Ember.Mixin.create({

  id: null,
  clientId: null,
  session: null,
  errors: null,

  /**
    Two models are "equal" when they correspond to the same
    key. This does not mean they necessarily have the same data.
  */
  isEqual: function(model) {
    var clientId = get(this, 'clientId');
    var otherClientId = get(model, 'clientId');
    if(clientId && otherClientId) {
      return clientId === otherClientId;
    }
    // in most cases clientIds will always be set, however
    // during serialization this might not be the case
    var id = get(this, 'id');
    var otherId = get(model, 'id')
    return this.isSameType(model) && id === otherId
  },

  isSameType: function(model) {
    return this.hasType(get(model, 'type'));
  },

  /**
    Model promises are just proxies and do not have the
    literal type of their contents.
  */
  hasType: function(type) {
    return get(this, 'type').detect(type);
  },

  type: Ember.computed(function(key, value) {
    return value || this.constructor;
  }),

  toStringExtension: function() {
    return "[" + get(this, 'id') + ", " + get(this, 'clientId') + "]";
  },

  lazyCopy: function() {
    return Ep.LazyModel.create({
      id: get(this, 'id'),
      clientId: get(this, 'clientId'),
      type: get(this, 'type')
    });
  }

});

Ep.Model = Ember.Object.extend(Ember.Copyable, Ep.ModelMixin, {

  isPromise: false,
  isDeleted: false,
  isLoaded: true,

  // TODO: allow assigning id?
  isNew: Ember.computed(function() {
    return !get(this, 'id');
  }).property('id'),

  clientRevision: Ember.computed(function(key, value) {
    if(arguments.length === 1) {
      return 0;
    }
    return value;
  }),

  // TODO: volatile isDirty

  /**
    Recursively merges two object graphs rooted at this model.

    @method merge
    @param session {*} The collection of existing models to merge against
    @param cache [Ep.ModelSet] Used to track already merged objects
    @return {Ep.Model} An existing model inside the session or a copy of the model.
  */
  __merge: function(session, cache) {
    if(!cache) cache = Ep.ModelSet.create();
    var dest;
    if(dest = cache.getModel(this)) {
      return dest;
    }
    dest = session.getModel(this);
    var promise;
    if(dest && get(dest, 'isPromise')) {
      // if the destination is a promise we want to
      // merge it's content
      promise = dest;
      dest = dest.content;
    }
    if(!dest) {
      // re-use this object if it is detached from a session
      if(!get(this, 'session')) {
        dest = this;
      } else {
        dest = this.constructor.create();
      }
      if(promise) {
        // update the content of the promise so any lingering
        // references will still function
        // TODO: should we just resolve?
        set(promise, 'content', dest);
      }
    }
    if(dest !== this) {
      // if we are merging on to a new object we need to copy
      // all the attributes and relationships over
      dest.beginPropertyChanges();
      // TODO: maybe not always set these?
      set(dest, 'id', get(this, 'id'));
      set(dest, 'clientId', get(this, 'clientId'));
      set(dest, 'errors', Ember.copy(get(this, 'errors')));
      session.add(dest);
      cache.add(dest);
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
            session.merge(child, cache);
          } else if(child) {
            set(dest, name, session.merge(child, cache));
          } else if(dest) {
            set(dest, name, null);
          }
        } else if(relationship.kind === 'hasMany') {
          // TODO: merge could be per item
          var children = get(this, name);
          var destChildren = get(dest, name);
          destChildren.clear();
          set(destChildren, 'meta', get(children, 'meta'));
          children.forEach(function(child) {
            destChildren.addObject(session.merge(child, cache));
          });
        }
      }, this);
      dest.endPropertyChanges();
    } else {
      // if we are re-using the same object, just recurse
      // over all relationships
      session.add(dest);
      cache.add(dest);
      this.eachRelationship(function(name, relationship) {
        if(relationship.kind === 'belongsTo') {
          var child = get(this, name);
          if(child) {
            session.merge(child, cache);
          }
        } else if(relationship.kind === 'hasMany') {
          // TODO: merge could be per item
          var children = get(this, name);
          children.forEach(function(child) {
            session.merge(child, cache);
          });
        }
      }, this);
    }
    return dest;
  },

  // TODO: return actual diff contents, not just which fields
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
      var left = get(this, name);
      var right = get(model, name);
      if(relationship.kind === 'belongsTo') {
        if(left && right) {
          if(!left.isEqual(right)) {
            diffs.push({type: 'belongsTo', name: name, relationship: relationship, oldValue: right});
          }
        } else if(left || right) {
          diffs.push({type: 'belongsTo', name: name, relationship: relationship, oldValue: right});
        }
      } else if(relationship.kind === 'hasMany') {
        var dirty = false;
        var cache = Ep.ModelSet.create();
        left.forEach(function(model) {
          cache.add(model);
        });
        right.forEach(function(model) {
          if(dirty) return;
          if(!cache.contains(model)) {
            dirty = true;
          } else {
            cache.remove(model);
          }
        });
        if(dirty || get(cache, 'length') > 0) {
          diffs.push({type: 'hasMany', name: name, relationship: relationship});
        }
      }
    }, this);

    return diffs;
  },

  // TODO: deep
  copy: function(deep) {
    var dest = this.constructor.create();
    dest.beginPropertyChanges();
    set(dest, 'id', get(this, 'id'));
    set(dest, 'clientId', get(this, 'clientId'));
    set(dest, 'errors', Ember.copy(get(this, 'errors')));
    // TODO revision
    this.eachAttribute(function(name, meta) {
      var left = get(this, name);
      var right = get(dest, name);
      // TODO: handle non-primitive attributes
      set(dest, name, left);
    }, this);
    this.eachRelationship(function(name, relationship) {
      if(relationship.kind === 'belongsTo') {
        var child = get(this, name);
        if(child) set(dest, name, child.lazyCopy());
      } else if(relationship.kind === 'hasMany') {
        // TODO: merge could be per item
        var children = get(this, name);
        var destChildren = get(dest, name);
        children.forEach(function(child) {
          destChildren.addObject(child.lazyCopy());
        });
      }
    }, this);
    dest.endPropertyChanges();
    return dest;
  }

});


Ep.Model.reopenClass({

  /**
    This is the only static method implemented in order to play nicely
    with Ember's default model conventions in the router. It is preferred
    to explicitly call `load` on a session.

    In order to use this method, you must set the Ep.__container__ property. E.g.

    ```
      Ep.__container__ = App.__container__;
    ```
  */
  find: function(id) {
    if(!Ep.__container__) {
      throw new Ember.Error("The Ep.__container__ property must be set in order to use static find methods.");
    }
    var container = Ep.__container__;
    var session = container.lookup('session:main');
    return session.load(this, id);
  }

});