var get = Ember.get, set = Ember.set;

Ep.EmbeddedManager = Ember.Object.extend({

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
    var serializer = get(this, 'adapter.serializer');
    var parentType = get(model, 'type');
    serializer.eachEmbeddedRecord(model, function(embedded, kind) {
      this._parentMap[get(embedded, 'clientId')] = model;
    }, this);
  },

  findParent: function(model) {
    var parent = this._parentMap[get(model, 'clientId')];
    return parent;
  },

  isEmbedded: function(model) {
    var type = get(model, 'type');
    var result = this._cachedIsEmbedded.get(type);
    if(result === true || result === false) return result;
    var adapter = get(this, 'adapter');
    var mappings = get(adapter, 'serializer.mappings');
    var result = false;
    mappings.forEach(function(parentType, value) {
      for(var name in value) {
        var embedded = value[name]['embedded'];
        result = result || embedded === 'always' && parentType.typeForRelationship(name) !== undefined && parentType.typeForRelationship(name).detect(type);
      }
    });
    this._cachedIsEmbedded.set(type, result);
    return result;
  }

});
