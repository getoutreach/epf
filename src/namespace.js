/**
  @module coalesce
*/

/**
  All Ember Data methods and functions are defined inside of this namespace.

  @class Coalesce
  @static
*/

var Coalesce;
if ('undefined' === typeof Coalesce) {
  /**
    @property VERSION
    @type String
    @default '<%= versionStamp %>'
    @static
  */
  Coalesce = Ember.Namespace.create({
    VERSION: 'VERSION_STRING_PLACEHOLDER'
  });
}

export default Coalesce;
