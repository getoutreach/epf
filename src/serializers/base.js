import SerializerForMixin from './serializer_for_mixin';

/**
  Base class for serialization/deserialization

  @namespace epf/serializers
  @class Base
*/
export default Ember.Object.extend(SerializerForMixin, {

  typeKey: null,

  serialize: Ember.required(),
  
  deserialize: Ember.required()

});