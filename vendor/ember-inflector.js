(function() {
Ember.String.pluralize = function(word) {
  return Ember.Inflector.inflector.pluralize(word);
};

Ember.String.singularize = function(word) {
  return Ember.Inflector.inflector.singularize(word);
};

})();



(function() {
var BLANK_REGEX = /^\s*$/;

function loadUncountable(rules, uncountable) {
  for (var i = 0, length = uncountable.length; i < length; i++) {
    rules.uncountable[uncountable[i]] = true;
  }
}

function loadIrregular(rules, irregularPairs) {
  var pair;

  for (var i = 0, length = irregularPairs.length; i < length; i++) {
    pair = irregularPairs[i];

    rules.irregular[pair[0]] = pair[1];
    rules.irregularInverse[pair[1]] = pair[0];
  }
}

/**
  Inflector.Ember provides a mechanism for supplying inflection rules for your
  application. Ember includes a default set of inflection rules, and provides an
  API for providing additional rules.

  Examples:

  Creating an inflector with no rules.

  ```js
  var inflector = new Ember.Inflector();
  ```

  Creating an inflector with the default ember ruleset.

  ```js
  var inflector = new Ember.Inflector(Ember.Inflector.defaultRules);

  inflector.pluralize('cow') //=> 'kine'
  inflector.singularize('kine') //=> 'cow'
  ```

  Creating an inflector and adding rules later.

  ```javascript
  var inflector = Ember.Inflector.inflector;

  inflector.pluralize('advice') // => 'advices'
  inflector.uncountable('advice');
  inflector.pluralize('advice') // => 'advice'

  inflector.pluralize('formula') // => 'formulas'
  inflector.irregular('formula', 'formulae');
  inflector.pluralize('formula') // => 'formulae'

  // you would not need to add these as they are the default rules
  inflector.plural(/$/, 's');
  inflector.singular(/s$/i, '');
  ```

  Creating an inflector with a nondefault ruleset.

  ```javascript
  var rules = {
    plurals:  [ /$/, 's' ],
    singular: [ /\s$/, '' ],
    irregularPairs: [
      [ 'cow', 'kine' ]
    ],
    uncountable: [ 'fish' ]
  };

  var inflector = new Ember.Inflector(rules);
  ```

  @class Inflector
  @namespace Ember
*/
function Inflector(ruleSet) {
  ruleSet = ruleSet || {};
  ruleSet.uncountable = ruleSet.uncountable || {};
  ruleSet.irregularPairs= ruleSet.irregularPairs|| {};

  var rules = this.rules = {
    plurals:  ruleSet.plurals || [],
    singular: ruleSet.singular || [],
    irregular: {},
    irregularInverse: {},
    uncountable: {}
  };

  loadUncountable(rules, ruleSet.uncountable);
  loadIrregular(rules, ruleSet.irregularPairs);
}

Inflector.prototype = {
  /**
    @method plural
    @param {RegExp} regex
    @param {String} string
  */
  plural: function(regex, string) {
    this.rules.plurals.push([regex, string]);
  },

  /**
    @method singular
    @param {RegExp} regex
    @param {String} string
  */
  singular: function(regex, string) {
    this.rules.singular.push([regex, string]);
  },

  /**
    @method uncountable
    @param {String} regex
  */
  uncountable: function(string) {
    loadUncountable(this.rules, [string]);
  },

  /**
    @method irregular
    @param {String} singular
    @param {String} plural
  */
  irregular: function (singular, plural) {
    loadIrregular(this.rules, [[singular, plural]]);
  },

  /**
    @method pluralize
    @param {String} word
  */
  pluralize: function(word) {
    return this.inflect(word, this.rules.plurals);
  },

  /**
    @method singularize
    @param {String} word
  */
  singularize: function(word) {
    return this.inflect(word, this.rules.singular);
  },

  /**
    @method inflect
    @param {String} word
    @param {Object} typeRules
  */
  inflect: function(word, typeRules) {
    var inflection, substitution, result, lowercase, isBlank,
    isUncountable, isIrregular, isIrregularInverse, rule;

    isBlank = BLANK_REGEX.test(word);

    if (isBlank) {
      return word;
    }

    lowercase = word.toLowerCase();

    isUncountable = this.rules.uncountable[lowercase];

    if (isUncountable) {
      return word;
    }

    isIrregular = this.rules.irregular[lowercase];

    if (isIrregular) {
      return isIrregular;
    }

    isIrregularInverse = this.rules.irregularInverse[lowercase];

    if (isIrregularInverse) {
      return isIrregularInverse;
    }

    for (var i = typeRules.length, min = 0; i > min; i--) {
       inflection = typeRules[i-1];
       rule = inflection[0];

      if (rule.test(word)) {
        break;
      }
    }

    inflection = inflection || [];

    rule = inflection[0];
    substitution = inflection[1];

    result = word.replace(rule, substitution);

    return result;
  }
};

Ember.Inflector = Inflector;

})();



(function() {
Ember.Inflector.defaultRules = {
  plurals: [
    [/$/, 's'],
    [/s$/i, 's'],
    [/^(ax|test)is$/i, '$1es'],
    [/(octop|vir)us$/i, '$1i'],
    [/(octop|vir)i$/i, '$1i'],
    [/(alias|status)$/i, '$1es'],
    [/(bu)s$/i, '$1ses'],
    [/(buffal|tomat)o$/i, '$1oes'],
    [/([ti])um$/i, '$1a'],
    [/([ti])a$/i, '$1a'],
    [/sis$/i, 'ses'],
    [/(?:([^f])fe|([lr])f)$/i, '$1$2ves'],
    [/(hive)$/i, '$1s'],
    [/([^aeiouy]|qu)y$/i, '$1ies'],
    [/(x|ch|ss|sh)$/i, '$1es'],
    [/(matr|vert|ind)(?:ix|ex)$/i, '$1ices'],
    [/^(m|l)ouse$/i, '$1ice'],
    [/^(m|l)ice$/i, '$1ice'],
    [/^(ox)$/i, '$1en'],
    [/^(oxen)$/i, '$1'],
    [/(quiz)$/i, '$1zes']
  ],

  singular: [
    [/s$/i, ''],
    [/(ss)$/i, '$1'],
    [/(n)ews$/i, '$1ews'],
    [/([ti])a$/i, '$1um'],
    [/((a)naly|(b)a|(d)iagno|(p)arenthe|(p)rogno|(s)ynop|(t)he)(sis|ses)$/i, '$1sis'],
    [/(^analy)(sis|ses)$/i, '$1sis'],
    [/([^f])ves$/i, '$1fe'],
    [/(hive)s$/i, '$1'],
    [/(tive)s$/i, '$1'],
    [/([lr])ves$/i, '$1f'],
    [/([^aeiouy]|qu)ies$/i, '$1y'],
    [/(s)eries$/i, '$1eries'],
    [/(m)ovies$/i, '$1ovie'],
    [/(x|ch|ss|sh)es$/i, '$1'],
    [/^(m|l)ice$/i, '$1ouse'],
    [/(bus)(es)?$/i, '$1'],
    [/(o)es$/i, '$1'],
    [/(shoe)s$/i, '$1'],
    [/(cris|test)(is|es)$/i, '$1is'],
    [/^(a)x[ie]s$/i, '$1xis'],
    [/(octop|vir)(us|i)$/i, '$1us'],
    [/(alias|status)(es)?$/i, '$1'],
    [/^(ox)en/i, '$1'],
    [/(vert|ind)ices$/i, '$1ex'],
    [/(matr)ices$/i, '$1ix'],
    [/(quiz)zes$/i, '$1'],
    [/(database)s$/i, '$1']
  ],

  irregularPairs: [
    ['person', 'people'],
    ['man', 'men'],
    ['child', 'children'],
    ['sex', 'sexes'],
    ['move', 'moves'],
    ['cow', 'kine'],
    ['zombie', 'zombies']
  ],

  uncountable: [
    'equipment',
    'information',
    'rice',
    'money',
    'species',
    'series',
    'fish',
    'sheep',
    'jeans',
    'police'
  ]
};

})();



(function() {
if (Ember.EXTEND_PROTOTYPES) {
  /**
    See {{#crossLink "Ember.String/pluralize"}}{{/crossLink}}

    @method pluralize
    @for String
  */
  String.prototype.pluralize = function() {
    return Ember.String.pluralize(this);
  };

  /**
    See {{#crossLink "Ember.String/singularize"}}{{/crossLink}}

    @method singularize
    @for String
  */
  String.prototype.singularize = function() {
    return Ember.String.singularize(this);
  };
}

})();



(function() {
Ember.Inflector.inflector = new Ember.Inflector(Ember.Inflector.defaultRules);

})();



(function() {

})();

