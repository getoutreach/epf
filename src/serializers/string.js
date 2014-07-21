var none = Ember.isNone;

import Serializer from './base';

/**
  @namespace serializers
  @class StringSerializer
*/
export default class StringSerializer extends Serializer {

  deserialize(serialized) {
    return none(serialized) ? null : String(serialized);
  }

  serialize(deserialized) {
    return none(deserialized) ? null : String(deserialized);
  }

}