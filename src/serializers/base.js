import SerializerForMixin from './serializer_for_mixin';

export default Ember.Object.extend(SerializerForMixin, {

  typeKey: null,

  serialize: Ember.required(),
  
  deserialize: Ember.required()

});