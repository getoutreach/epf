/**
  Abstract base class for a three-way `Model` merge implementation.

  @namespace epf/merge
  @class Base
*/
export default class Base {

  merge(ours, ancestor, theirs) {
    // Not Implemented
  }

}

Base.create = function() { return new this() };