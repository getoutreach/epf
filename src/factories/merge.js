/**
  @namespace factory
  @class MergeFactory
*/
export default class MergeFactory {

  constructor(container) {
    this.container = container;
  }

  mergeFor(typeKey) {
    Ember.assert('Passed in typeKey must be a string', typeof typeKey === 'string');
    var mergeStrategy = this.container.lookup('merge-strategy:' + typeKey);
    // if none exists, create and register a default
    if(!mergeStrategy) {
      var Strategy = this.container.lookupFactory('merge-strategy:default');
      this.container.register('merge-strategy:' + typeKey, Strategy);
      mergeStrategy = this.container.lookup('merge-strategy:' + typeKey);
    }
    mergeStrategy.typeKey = typeKey;
    return mergeStrategy;
  }

}