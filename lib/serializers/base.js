var SerializerForMixin = require('./serializer_for_mixin');

Ep.Serializer = Ember.Object.extend(SerializerForMixin, {

  typeKey: null,

  serialize: Ember.required(),
  
  deserialize: Ember.required()

});