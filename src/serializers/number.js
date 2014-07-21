var empty = Ember.isEmpty;

import Serializer from './base';

/**
  @namespace serializers
  @class NumberSerializer
*/
export default class NumberSerializer extends Serializer {

  deserialize(serialized) {
    return empty(serialized) ? null : Number(serialized);
  }

  serialize(deserialized) {
    return empty(deserialized) ? null : Number(deserialized);
  }
}