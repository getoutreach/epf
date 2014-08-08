import Model from '../model/model';
var CoreObject = Ember.CoreObject;
var Observable = Ember.Observable;
var Mixin = Ember.Mixin;

var merge = _.merge;


/**
  Attempting to create a subclass of `Model` that supports
  CP's and Ember.Observable.
*/
function EmberModel() {
  return CoreObject.apply(this);
}

var PrototypeMixin = Mixin.create(CoreObject.PrototypeMixin);
PrototypeMixin.ownerConstructor = EmberModel;
EmberModel.PrototypeMixin = PrototypeMixin;
EmberModel.prototype = Object.create(Model.prototype);

// These static properties use getters and do not play well with ClassMixin
var SPECIAL_PROPS = ['fields', 'attributes', 'relationships'];
var ModelClassProps = {};
for(var key in Model) {
  if(!Model.hasOwnProperty(key)) continue;
  if(SPECIAL_PROPS.indexOf(key) !== -1) continue;
  ModelClassProps[key] = Model[key];
}

var ClassMixin = Mixin.create(ModelClassProps, CoreObject.ClassMixin);
ClassMixin.reopen({
  extend: function() {
    var klass = this._super.apply(this, arguments);
    SPECIAL_PROPS.forEach(function(name) {
      var desc = Object.getOwnPropertyDescriptor(Model, name);
      Object.defineProperty(klass, name, desc);
    });
    return klass;
  }
});

ClassMixin.apply(EmberModel);
ClassMixin.ownerConstructor = EmberModel;
EmberModel.ClassMixin = ClassMixin;

EmberModel.proto = function() {
  return this.prototype;
}

EmberModel = EmberModel.extend(Observable, {
  
  init: function() {
    Model.apply(this, arguments);
    this._super.apply(this, arguments);
  },
  
  attributeWillChange: function(name) {
    Ember.propertyWillChange(this, name);
  },
  
  attributeDidChange: function(name) {
    Ember.propertyDidChange(this, name);
  },
  
  belongsToWillChange: function(name) {
    Ember.propertyWillChange(this, name);
  },
  
  belongsToDidChange: function(name) {
    Ember.propertyDidChange(this, name);
  },
  
  hasManyWillChange: function(name) {
    Ember.propertyWillChange(this, name);
  },
  
  hasManyDidChange: function(name) {
    Ember.propertyDidChange(this, name);
  }
  
});

function Attr(type, options={}) {
  this.type = type;
  merge(this, options);
  return this;
}

function attr(type, options={}) {
  return new Attr(type, options);
}

function HasMany(type, options={}) {
  this.kind = 'hasMany';
  this.type = type;
  merge(this, options);
  return this;
}

function hasMany(type, options={}) {
  return new HasMany(type, options);
}

function BelongsTo(type, options={}) {
  this.kind = 'belongsTo';
  this.type = type;
  merge(this, options);
  return this;
}

function belongsTo(type, options={}) {
  return new BelongsTo(type, options);
}

var META_KEYS = ['id', 'clientId', 'rev', 'clientRev', 'errors', 'isDeleted'];

EmberModel.reopenClass({
  
  create: function(hash) {
    // Need to not set fields via Ember initProperties since they depend on
    // the underlying Model constructor being ran
    var fields = {};
    for(var key in hash) {
      if(!hash.hasOwnProperty(key)) continue;
      if(this.fields.get(key) || META_KEYS.indexOf(key) !== -1) {
        fields[key] = hash[key];
        delete hash[key];
      }
    }
    var res = this._super.apply(this, arguments);
    for(var key in fields) {
      if(!fields.hasOwnProperty(key)) continue;
      res[key] = fields[key];
    }
    return res;
  },
  
  extend: function() {
    
    var schema = {
      attributes: {},
      relationships: {}
    };
    for(var i = 0; i < arguments.length; i++) {
      var hash = arguments[i];
      if(hash instanceof Mixin) continue;
      
      for(var key in hash) {
        if(!hash.hasOwnProperty(key)) return;
        var value = hash[key];
        
        if(value instanceof Attr) {
          delete hash[key];
          schema.attributes[key] = value;
        } else if(value instanceof HasMany || value instanceof BelongsTo) {
          delete hash[key];
          schema.relationships[key] = value;
        }
      }
    }
    
    var klass = this._super.apply(this, arguments);
    // copy fields down since not part of ClassMixin
    klass._fields = this._fields;
    klass.defineSchema(schema);
    return klass;
  }
  
});


export {attr, hasMany, belongsTo};

export default EmberModel;
