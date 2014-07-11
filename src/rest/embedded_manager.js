var get = Ember.get, set = Ember.set;

import EmbdeddedHelpersMixin from './embedded_helpers_mixin';

export default Ember.Object.extend(EmbdeddedHelpersMixin, {

  // needs to be set for embedded helpers
  // TODO: extract out the embedded helpers
  adapter: null,

  init: function() {
    this._super.apply(this, arguments);

    // bookkeep all the parents of embedded records
    this._parentMap = {};

    this._cachedIsEmbedded = Ember.Map.create();
  },

  updateParents: function(model) {
    var type = get(model, 'type'),
        adapter = get(this, 'adapter'),
        typeKey = get(type, 'typeKey'),
        serializer = adapter.serializerFor(typeKey);

    this.eachEmbeddedRecord(model, function(embedded, kind) {
      this._parentMap[get(embedded, 'clientId')] = model;
    }, this);
  },

  findParent: function(model) {
    var parent = this._parentMap[get(model, 'clientId')];
    return parent;
  },

  isEmbedded: function(model) {
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

});