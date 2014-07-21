var get = Ember.get, set = Ember.set;

import BaseClass from '../utils/base_class';

/**
  Keeps track of embedded records.

  @namespace rest
  @class EmbeddedManager
*/
export default class EmbeddedManager extends BaseClass {

  constructor(adapter) {
    this.adapter = adapter;
    // bookkeep all the parents of embedded records
    this._parentMap = {};
    this._cachedIsEmbedded = Ember.Map.create();
  }

  updateParents(model) {
    var type = get(model, 'type'),
        adapter = get(this, 'adapter'),
        typeKey = get(type, 'typeKey'),
        serializer = adapter.serializerFor(typeKey);

    this.eachEmbeddedRecord(model, function(embedded, kind) {
      this._parentMap[get(embedded, 'clientId')] = model;
    }, this);
  }

  findParent(model) {
    var parent = this._parentMap[get(model, 'clientId')];
    return parent;
  }

  isEmbedded(model) {
    var type = get(model, 'type'),
        result = this._cachedIsEmbedded.get(type);

    if(result !== undefined) return result;

    var adapter = get(this, 'adapter'),
        result = false;

    type.eachRelationship(function(name, relationship) {
      var serializer = adapter.serializerFor(relationship.typeKey),
          inverse = type.inverseFor(relationship.key);
      
      // TODO: this currently won't support embedded relationships
      // that don't have an inverse
      if(!inverse) return;

      var config = serializer.configFor(inverse.name);

      result = result || config.embedded === 'always';
    }, this);

    this._cachedIsEmbedded.set(type, result);
    return result;
  }

  embeddedType(type, name) {
    var serializer = this.adapter.serializerFactory.serializerForType(type);
    return serializer.embeddedType(type, name);
  }

  eachEmbeddedRecord(model, callback, binding) {
    this.eachEmbeddedBelongsToRecord(model, callback, binding);
    this.eachEmbeddedHasManyRecord(model, callback, binding);
  }

  eachEmbeddedBelongsToRecord(model, callback, binding) {
    this.eachEmbeddedBelongsTo(get(model, 'type'), function(name, relationship, embeddedType) {
      if(!model.isPropertyLoaded(name)) {
        return;
      }
      var embeddedRecord = get(model, name);
      if (embeddedRecord) { callback.call(binding, embeddedRecord, embeddedType); }
    });
  }

  eachEmbeddedHasManyRecord(model, callback, binding) {
    this.eachEmbeddedHasMany(get(model, 'type'), function(name, relationship, embeddedType) {
      if(!model.isPropertyLoaded(name)) {
        return;
      }
      var array = get(model, name);
      for (var i=0, l=get(array, 'length'); i<l; i++) {
        callback.call(binding, array.objectAt(i), embeddedType);
      }
    });
  }

  eachEmbeddedHasMany(type, callback, binding) {
    this.eachEmbeddedRelationship(type, 'hasMany', callback, binding);
  }

  eachEmbeddedBelongsTo(type, callback, binding) {
    this.eachEmbeddedRelationship(type, 'belongsTo', callback, binding);
  }

  eachEmbeddedRelationship(type, kind, callback, binding) {
    type.eachRelationship(function(name, relationship) {
      var embeddedType = this.embeddedType(type, name);

      if (embeddedType) {
        if (relationship.kind === kind) {
          callback.call(binding, name, relationship, embeddedType);
        }
      }
    }, this);
  }

  /**
    @private
    Traverses the entire embedded graph (including parents)
  */
  eachEmbeddedRelative(model, callback, binding, visited) {
    if(!visited) visited = new Ember.Set();
    if(visited.contains(model)) return;

    visited.add(model);
    callback.call(binding, model);

    this.eachEmbeddedRecord(model, function(embeddedRecord, embeddedType) {
      this.eachEmbeddedRelative(embeddedRecord, callback, binding, visited);
    }, this);

    var parent = this.findParent(model);
    if(parent) {
      this.eachEmbeddedRelative(parent, callback, binding, visited);
    }
  }

}