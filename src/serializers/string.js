var none = Ember.isNone, empty = Ember.isEmpty;

import Serializer from './base';

export default Serializer.extend({

  deserialize: function(serialized) {
    return none(serialized) ? null : String(serialized);
  },

  serialize: function(deserialized) {
    return none(deserialized) ? null : String(deserialized);
  }

});