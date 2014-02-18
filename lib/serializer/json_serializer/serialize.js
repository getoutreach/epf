var get = Ember.get, set = Ember.set;

function addPropertyHook(name) {
  return function(serialized, model) {
    return this.addProperty(serialized, name, model);
  };
}

Ep.JsonSerializer.reopen({
  
  /**
    The main entry point for serializing a model. While you can consider this
    a hook that can be overridden in your serializer, you will have to manually
    handle serialization. For most cases, there are more granular hooks that you
    can override.

    If overriding this method, these are the responsibilities that you will need
    to implement yourself:

    * If the option hash contains `includeId`, add the model's ID to the serialized form.
      By default, `serialize` calls `addId` if appropriate.
    * If the option hash contains `includeType`, add the model's type to the serialized form.
    * Add the model's attributes to the serialized form. By default, `serialize` calls
      `addAttributes`.
    * Add the model's relationships to the serialized form. By default, `serialize` calls
      `addRelationships`.

    @method serialize
    @param {Ep.Model} model the model to serialize
    @param {Object} [options] a hash of options
    @returns {any} the serialized form of the model
  */
  serialize: function(model, options) {
    var serialized = {}, id, rev, clientRev;

    if (id = get(model, 'id')) {
      this.addId(serialized, model);
    }
    this.addClientId(serialized, model);
    if (rev = get(model, 'rev')) {
      this.addRevision(serialized, model);
    }
    if (clientRev = get(model, 'clientRev')) {
      this.addClientRevision(serialized, model);
    }

    if (options && options.includeType) {
      this.addType(serialized, model);
    }

    this.addAttributes(serialized, model);
    this.addRelationships(serialized, model);

    return serialized;
  },

  addProperty: function(serialized, name, model) {
    var key = this.keyFor(name);
    serialized[key] = get(model, name);
  },

  addId: function(serialized, model) {
    var key = this.keyFor('id');
    serialized[key] = this.serializeId(get(model, 'id'));
  },

  /**
    A hook you can use to normalize IDs before adding them to the
    serialized representation.

    Because the store coerces all IDs to strings for consistency,
    this is the opportunity for the serializer to, for example,
    convert numerical IDs back into number form.

    @param {String} id the id from the record
    @returns {any} the serialized representation of the id
  */
  serializeId: function(id) {
    if (isNaN(id)) { return id; }
    return +id;
  },

  addClientId: addPropertyHook('clientId'),
  addRevision: addPropertyHook('rev'),
  addClientRevision: addPropertyHook('clientRev'),
  addType: addPropertyHook('type'),

  /**
    A hook you can use to change how attributes are added to the serialized
    representation of a model.

    By default, `addAttributes` simply loops over all of the attributes of the
    passed model, maps the attribute name to the key for the serialized form,
    and invokes any registered transforms on the value. It then invokes the
    more granular `addAttribute` with the key and transformed value.

    Since you can override `keyForAttributeName`, `addAttribute`, and register
    custom transforms, you should rarely need to override this hook.

    @method addAttributes
    @param {any} data the serialized representation that is being built
    @param {Ep.Model} model the model to serialize
  */
  addAttributes: function(serialized, model) {
    model.eachAttribute(function(name, attribute) {
      this.addAttribute(serialized, name, model, attribute);
    }, this);
  },

  addAttribute: function(serialized, name, model, attribute) {
    var key = this.keyFor(name);
    serialized[key] = this.serializeValue(get(model, name), attribute.type);
  },

  /**
    @private

    Given an attribute type and value, convert the value into the
    serialized form using the transform registered for that type.

    @method serializeValue
    @param {any} value the value to convert to the serialized form
    @param {String} attributeType the registered type (e.g. `string`
      or `boolean`)
    @returns {any} the serialized form of the value
  */
  serializeValue: function(value, attributeType) {
    if(attributeType) {
      var transform = this.transformFor(attributeType);

      Ember.assert("You tried to use an attribute type (" + attributeType + ") that has not been registered", transform);
      return transform.serialize(value);
    }
    return value;
  },


  /**
    A hook you can use to change how relationships are added to the serialized
    representation of a model.

    By default, `addRelationships` loops over all of the relationships of the
    passed model, maps the relationship names to the key for the serialized form,
    and then invokes the public `addBelongsTo` and `addHasMany` hooks.

    Since you can override `keyForBelongsTo`, `keyForHasMany`, `addBelongsTo`,
    `addHasMany`, and register mappings, you should rarely need to override this
    hook.

    @method addRelationships
    @param {any} serialized the serialized representation that is being built
    @param {Ep.Model} model the model to serialize
  */
  addRelationships: function(serialized, model) {
    model.eachRelationship(function(name, relationship) {
      if (relationship.kind === 'belongsTo') {
        this.addBelongsTo(serialized, model, name, relationship);
      } else if (relationship.kind === 'hasMany') {
        this.addHasMany(serialized, model, name, relationship);
      }
    }, this);
  },

  addBelongsTo: function(serialized, model, name, relationship) {
    var type = get(model, 'type'),
        key = this.keyForBelongsTo(name, type),
        value = null,
        includeType = (relationship.options && relationship.options.polymorphic),
        embeddedChild,
        child,
        id;

    if (this.embeddedType(type, name)) {
      if (embeddedChild = get(model, name)) {
        value = this.serialize(embeddedChild, { includeType: includeType });
      }

      serialized[key] = value;
    } else {
      child = get(model, relationship.key);
      id = child && get(child, 'id');

      if (relationship.options && relationship.options.polymorphic && !Ember.isNone(id)) {
        // TODO Polymorphism
        throw "Polymorphism is not quite ready";
        // type = get(child, 'type');
        // this.addBelongsToPolymorphic(serialized, key, id, type);
      } else {
        serialized[key] = id === undefined ? null : this.serializeId(id);
      }
    }
  },

  addBelongsToPolymorphic: function(hash, key, id, type) {
    var keyForId = this.keyForPolymorphicId(key),
        keyForType = this.keyForPolymorphicType(key);
    hash[keyForId] = id;
    hash[keyForType] = this.rootForType(type);
  },

  /**
    @private

    Determines the singular root name for a particular type.

    This is an underscored, lowercase version of the model name.
    For example, the type `App.UserGroup` will have the root
    `user_group`.

    @param {Ep.Model subclass} type
    @returns {String} name of the root element
  */
  rootForType: function(type) {
    return get(type, 'typeKey');
  },

  /**
    Adds a has-many relationship to the JSON serialized being built.

    The default REST semantics are to only add a has-many relationship if it
    is embedded. If the relationship was initially loaded by ID, we assume that
    that was done as a performance optimization, and that changes to the
    has-many should be saved as foreign key changes on the child's belongs-to
    relationship.

    @param {Object} serialized the JSON being built
    @param {Ep.Model} model the model being serialized
    @param {String} key the JSON key into which the serialized relationship
      should be saved
    @param {Object} relationship metadata about the relationship being serialized
  */
  addHasMany: function(serialized, model, name, relationship) {
    var type = get(model, 'type'),
        key = this.keyForHasMany(name, type),
        serializedHasMany = [],
        includeType = (relationship.options && relationship.options.polymorphic),
        manyArray, embeddedType;

    // If the has-many is not embedded, there is nothing to do.
    embeddedType = this.embeddedType(type, name);
    if (embeddedType !== 'always') { return; }

    // Get the Ep.ManyArray for the relationship off the model
    manyArray = get(model, name);

    // Build up the array of serialized models
    manyArray.forEach(function (model) {
      serializedHasMany.push(this.serialize(model, { includeType: includeType }));
    }, this);

    // Set the appropriate property of the serialized JSON to the
    // array of serialized embedded models
    serialized[key] = serializedHasMany;
  }
  

});