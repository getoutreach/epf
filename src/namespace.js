/**
  @module epf
*/

/**
  All Ember Data methods and functions are defined inside of this namespace.

  @class Ep
  @static
*/

var Ep;
if ('undefined' === typeof Ep) {
  /**
    @property VERSION
    @type String
    @default '<%= versionStamp %>'
    @static
  */
  Ep = Ember.Namespace.create({
    VERSION: 'VERSION_STRING_PLACEHOLDER'
  });

  if (Ember.libraries) {
    Ember.libraries.registerCoreLibrary('EPF', Ep.VERSION);
  }
}

export default Ep;
