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
    var type = get(model, 'type'),
        adapter = get(this, 'adapter'),
        serializer = adapter.serializerFor(type);

    serializer.eachEmbeddedRecord(model, function(embedded, kind) {
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

    // TODO: this currently won't support embedded relationships
    // that don't have an inverse
    type.eachRelationship(function(name, relationship) {
      var parentType = relationship.type,
          serializer = adapter.serializerFor(parentType),
          inverse = type.inverseFor(relationship.key),
          config = serializer.configFor(inverse.name);

      result = result || config.embedded === 'always';
    }, this);

    this._cachedIsEmbedded.set(type, result);
    return result;
  }

});