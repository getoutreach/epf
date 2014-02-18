require('../model');

var get = Ember.get, set = Ember.set, map = Ember.ArrayPolyfills.map, isNone = Ember.isNone;

function mustImplement(name) {
  return function() {
    throw new Ember.Error("Your serializer " + this.toString() + " does not implement the required method " + name);
  };
}

/**
  A serializer is responsible for serializing and deserializing a group of
  records.

  `Ep.Serializer` is an abstract base class designed to help you build a
  serializer that can read to and write from any serialized form.  While most
  applications will use `Ep.JSONSerializer`, which reads and writes JSON, the
  serializer architecture allows your adapter to transmit things like XML,
  strings, or custom binary data.

  Typically, your application's `Ep.Adapter` is responsible for both creating a
  serializer as well as calling the appropriate methods when it needs to
  materialize data or serialize a record.

  The serializer API is designed as a series of layered hooks that you can
  override to customize any of the individual steps of serialization and
  deserialization.

  The hooks are organized by the three responsibilities of the serializer:

  1. Determining naming conventions
  2. Serializing records into a serialized form
  3. Deserializing records from a serialized form

  Because Ember Data lazily materializes records, the deserialization
  step, and therefore the hooks you implement, are split into two phases:

  1. Extraction, where the serialized forms for multiple records are
     extracted from a single payload. The IDs of each record are also
     extracted for indexing.
  2. Materialization, where a newly-created record has its attributes
     and relationships initialized based on the serialized form loaded
     by the adapter.

  Additionally, a serializer can convert values from their JavaScript
  versions into their serialized versions via a declarative API.

  ## Naming Conventions

  One of the most common uses of the serializer is to map attribute names
  from the serialized form to your `Ep.Model`. For example, in your model,
  you may have an attribute called `firstName`:

  ```javascript
  App.Person = Ep.Model.extend({
    firstName: Ep.attr('string')
  });
  ```

  However, because the web API your adapter is communicating with is
  legacy, it calls this attribute `FIRST_NAME`.

  You can determine the attribute name used in the serialized form
  by implementing `keyForAttributeName`:

  ```javascript
  keyForAttributeName: function(type, name) {
    return name.underscore.toUpperCase();
  }
  ```

  ## Serialization

  During the serialization process, a record or records are converted
  from Ember.js objects into their serialized form.

  These methods are designed in layers, like a delicious 7-layer
  cake (but with fewer layers).

  The main entry point for serialization is the `serialize`
  method, which takes the record and options.

  The `serialize` method is responsible for:

  * turning the record's attributes (`Ep.attr`) into
    attributes on the JSON object.
  * optionally adding the record's ID onto the hash
  * adding relationships (`Ep.hasMany` and `Ep.belongsTo`)
    to the JSON object.

  Depending on the backend, the serializer can choose
  whether to include the `hasMany` or `belongsTo`
  relationships on the JSON hash.

  For very custom serialization, you can implement your
  own `serialize` method. In general, however, you will want
  to override the hooks described below.

  ### Adding the ID

  The default `serialize` will optionally call your serializer's
  `addId` method with the JSON hash it is creating, the
  record's type, and the record's ID. The `serialize` method
  will not call `addId` if the record's ID is undefined.

  Your adapter must specifically request ID inclusion by
  passing `{ includeId: true }` as an option to `serialize`.

  NOTE: You may not want to include the ID when updating an
  existing record, because your server will likely disallow
  changing an ID after it is created, and the PUT request
  itself will include the record's identification.

  By default, `addId` will:

  1. Get the primary key name for the record by calling
     the serializer's `primaryKey` with the record's type.
     Unless you override the `primaryKey` method, this
     will be `'id'`.
  2. Assign the record's ID to the primary key in the
     JSON hash being built.

  If your backend expects a JSON object with the primary
  key at the root, you can just override the `primaryKey`
  method on your serializer subclass.

  Otherwise, you can override the `addId` method for
  more specialized handling.

  ### Adding Attributes

  By default, the serializer's `serialize` method will call
  `addAttributes` with the JSON object it is creating
  and the record to serialize.

  The `addAttributes` method will then call `addAttribute`
  in turn, with the JSON object, the record to serialize,
  the attribute's name and its type.

  Finally, the `addAttribute` method will serialize the
  attribute:

  1. It will call `keyForAttributeName` to determine
     the key to use in the JSON hash.
  2. It will get the value from the record.
  3. It will call `serializeValue` with the attribute's
     value and attribute type to convert it into a
     JSON-compatible value. For example, it will convert a
     Date into a String.

  If your backend expects a JSON object with attributes as
  keys at the root, you can just override the `serializeValue`
  and `keyForAttributeName` methods in your serializer
  subclass and let the base class do the heavy lifting.

  If you need something more specialized, you can probably
  override `addAttribute` and let the default `addAttributes`
  handle the nitty gritty.

  ### Adding Relationships

  By default, `serialize` will call your serializer's
  `addRelationships` method with the JSON object that is
  being built and the record being serialized. The default
  implementation of this method is to loop over all of the
  relationships defined on your record type and:

  * If the relationship is a `Ep.hasMany` relationship,
    call `addHasMany` with the JSON object, the record
    and a description of the relationship.
  * If the relationship is a `Ep.belongsTo` relationship,
    call `addBelongsTo` with the JSON object, the record
    and a description of the relationship.

  The relationship description has the following keys:

  * `type`: the class of the associated information (the
    first parameter to `Ep.hasMany` or `Ep.belongsTo`)
  * `kind`: either `hasMany` or `belongsTo`

  The relationship description may get additional
  information in the future if more capabilities or
  relationship types are added. However, it will
  remain backwards-compatible, so the mere existence
  of new features should not break existing adapters.

  @module data
  @submodule data-serializer
  @main data-serializer

  @class Serializer
  @namespace DS
  @extends Ember.Object
  @constructor
*/
Ep.Serializer = Ember.Object.extend({

  deserialize: mustImplement('deserialize'),
  
  serialize: mustImplement('serialize')

});
