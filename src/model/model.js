var get = Ember.get, set = Ember.set, Copyable = Ember.Copyable, computed = Ember.computed,
    cacheFor = Ember.cacheFor,
    cacheGet = cacheFor.get,
    metaFor = Ember.meta;

import BaseClass from '../utils/base_class';
import ModelSet from '../collections/model_set';
import copy from '../utils/copy';

export default class Model extends BaseClass {

  get id() {
    return this._attributes['_id'];
  }
  set id(value) {
    return this._attributes['_id'] = value;
  }

  get clientId() {
    return this._attributes['_clientId'];
  }
  set clientId(value) {
    return this._attributes['_clientId'] = value;
  }

  get rev() {
    return this._attributes['_rev'];
  }
  set rev(value) {
    return this._attributes['_rev'] = value;
  }

  get clientRev() {
    return this._attributes['_clientId'];
  }
  set clientRev(value) {
    return this._attributes['_clientId'] = value;
  }

  get isDeleted() {
    return this._attributes['_deleted'];
  }
  set isDeleted(value) {
    return this._attributes['_deleted'] = value;
  }

  get errors() {
    return this._attributes['_errors'];
  }
  set errors(value) {
    return this._attributes['_errors'] = value;
  }

  get isModel() {
    return true;
  }

  constructor(fields) {
    this._attributes = {
      _id: null,
      _clientId: null,
      _rev: null,
      _clientRev: 0,
      _deleted: false,
      _errors: null
    }
    this._relationships = {};

    for(var name in fields) {
      if(!fields.hasOwnProperty(name)) continue;
      this[name] = fields[name];
    }
  }
  
  /**
    Two models are "equal" when they correspond to the same
    key. This does not mean they necessarily have the same data.
  */
  isEqual(model) {
    if(!model) return false;
    var clientId = this.clientId;
    var otherClientId = model.clientId;
    if(clientId && otherClientId) {
      return clientId === otherClientId;
    }
    // in most cases clientIds will always be set, however
    // during serialization this might not be the case
    var id = this.id;
    var otherId = model.id;
    return this instanceof model.constructor && id === otherId
  }

  type: computed(function(key, value) {
    return value || this.constructor;
  }),

  typeKey: computed(function() {
    return get(this, 'type.typeKey');
  }),

  toString() {
    var sessionString = this.session ? this.session.toString() : "detached";
    return "<" + this.typeKey + "[" + get(this, 'id') + ", " + get(this, 'clientId') + "](" + sessionString + ")>";
  }

  toJSON() {
    return this._attributes;
  }

  get hasErrors() {
    !!this.errors;
  }

  get isDetached() {
    return !this.session;
  }

  get isManaged() {
    return !!this.session;
  }

  get isNew() {
    return !this.id;
  }

  get isDirty() {
    if(this.session) {
      return this.session.dirtyModels.contains(this);
    }
  }

  /**
    Returns a copy with all properties unloaded except identifiers.

    @method lazyCopy
    @returns {Model}
  */
  lazyCopy() {
    var copy = new this.constructor();
    copy.id = this.id;
    copy.clientId = this.clientId;
    return copy;
  }

  // creates a shallow copy with lazy children
  // TODO: we should not lazily copy detached children
  copy() {
    var dest = new this.constructor();
    this.copyTo(dest);
    return dest;
  }

  copyTo(dest) {
    dest._attributes = copy(this._attributes);

    // TODO: rels
  }

  copyAttributes(dest) {
    dest.beginPropertyChanges();
    
    this.eachLoadedAttribute(function(name, meta) {
      var left = get(this, name);
      var right = get(dest, name);
      var copy;
      // Ember.copy does not support Date
      if(left instanceof Date) {
        copy = new Date(left.getTime());
      } else {
        copy = Ember.copy(left, true);
      }
      set(dest, name, copy);
    }, this);
    dest.endPropertyChanges();
  }

  copyMeta(dest) {
    set(dest, 'id', get(this, 'id'));
    set(dest, 'clientId', get(this, 'clientId'));
    set(dest, 'rev', get(this, 'rev'));
    set(dest, 'clientRev', get(this, 'clientRev'));
    set(dest, 'errors', Ember.copy(get(this, 'errors')));
    set(dest, 'isDeleted', get(this, 'isDeleted'));
  }

  willWatchProperty(key) {
    if(get(this, 'isManaged') && this.shouldTriggerLoad(key)) {
      Ember.run.scheduleOnce('actions', this, this.load);
    }
  }

  shouldTriggerLoad(key) {
    return this.isAttributeOrRelationship(key) && !this.isPropertyLoaded(key);
  }

  isAttributeOrRelationship(key) {
    var proto = this.constructor.proto(),
        descs = Ember.meta(proto).descs,
        desc = descs[key],
        meta = desc && desc._meta;

    return meta && (meta.isAttribute || meta.isRelationship);
  }

  isPropertyLoaded(key) {
    if(get(this, 'isNew')) {
      return true;
    }

    var proto = this.constructor.proto(),
        descs = Ember.meta(proto).descs,
        desc = descs[key],
        meta = desc && desc._meta;

    if(meta.isRelationship && meta.kind === 'belongsTo') {
      return typeof this['__' + key] !== 'undefined';
    }

    var meta = metaFor(this),
        cache = meta.cache,
        cached = cacheGet(cache, key);

    return typeof cached !== 'undefined';
  }

  anyPropertiesLoaded() { 
    var result = false;
    get(this, 'type.fields').forEach(function(name, meta) {
      result = result || this.isPropertyLoaded(name);
    }, this);
    return result;
  }

  static defineSchema(fields) {
    // TODO
  }

  get attributes() {

  }

  get loadedAttributes() {

  }

  get relationships() {

  }

  get loadedRelationships() {

  }

});

function defineAttribute(proto, name, type, options) {
  Object.defineProperty(proto, name, {
    enumerable: true,
    get: function() {
      return this._attributes[name];
    },
    set: function(value) {
      this.fieldWillChange(name);
      this._attributes[name] = value;
      this.fieldDidChange(name);
    }
  });

  options.name = name;
  options.type = type;

  proto._attributeDefinitions[name] = options;
}

function defineBelongsTo(proto, name, options) {

}

function defineHasMany(proto, name, options) {

}

function sessionAlias(name) {
  return function () {
    var session = get(this, 'session');
    Ember.assert("Cannot call " + name + " on a detached model", session);
    var args = [].splice.call(arguments,0);
    args.unshift(this);
    return session[name].apply(session, args);
  };
}

Model.reopen({
  load: sessionAlias('loadModel'),
  refresh: sessionAlias('refresh'),
  deleteModel: sessionAlias('deleteModel'),
  remoteCall: sessionAlias('remoteCall'),
  markClean: sessionAlias('markClean'),
  invalidate: sessionAlias('invalidate'),
  touch: sessionAlias('touch')
});

Model.reopenClass({

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
    return session.find(this, id);
  },

  typeKey: computed(function() {
    var camelized = this.toString().split(/[:.]/)[1];
    if(camelized) {
      return Ember.String.underscore(camelized);
    } else {
      throw new Ember.Error("Could not infer typeKey for " + this.toString());
    }
  })

});
