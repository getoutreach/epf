/**
  @private

  All classes extend this class. Provides additonal object model helper
  methods.

  @namespace utils
  @class Base
*/
export default class Base {
  // Legacy Ember.js Object Model methods
  static create(props) {
    return new this(props);
  }

  static reopen(props) {
    for(var key in props) {
      this.prototype[key] = props[key];
    }
    return this;
  }

  static extend(props) {
    var klass = class extends this {};
    klass.reopen(props);
    return klass;
  }

  static reopenClass(props) {
    for(var key in props) {
      this[key] = props[key];
    }
    return this;
  }
}