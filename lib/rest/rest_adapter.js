/*global jQuery*/

require('../adapter');
require('./embedded_manager');
require('./operation_graph');
require('./rest_errors');
require('./serializers');

var get = Ember.get, set  = Ember.set, forEach = Ember.ArrayPolyfills.forEach;

var EmbeddedHelpersMixin = require('./embedded_helpers_mixin');
var materializeRelationships = require('../utils/materialize_relationships');

/**
  The REST adapter allows your store to communicate with an HTTP server by
  transmitting JSON via XHR. Most Ember.js apps that consume a JSON API
  should use the REST adapter.

  This adapter is designed around the idea that the JSON exchanged with
  the server should be conventional.

  ## JSON Structure

  The REST adapter expects the JSON returned from your server to follow
  these conventions.

  ### Object Root

  The JSON payload should be an object that contains the record inside a
  root property. For example, in response to a `GET` request for
  `/posts/1`, the JSON should look like this:

  ```js
  {
    "post": {
      title: "I'm Running to Reform the W3C's Tag",
      author: "Yehuda Katz"
    }
  }
  ```

  ### Conventional Names

  Attribute names in your JSON payload should be the underscored versions of
  the attributes in your Ember.js models.

  For example, if you have a `Person` model:

  ```js
  App.Person = Ep.Model.extend({
    firstName: Ep.attr('string'),
    lastName: Ep.attr('string'),
    occupation: Ep.attr('string')
  });
  ```

  The JSON returned should look like this:

  ```js
  {
    "person": {
      "first_name": "Barack",
      "last_name": "Obama",
      "occupation": "President"
    }
  }
  ```

  @class Ep.RestAdapter
  @constructor
  @namespace DS
  @extends Ep.Adapter
*/
Ep.RestAdapter = Ep.Adapter.extend(EmbeddedHelpersMixin, {
  defaultMergeType: 'payload',

  init: function() {
    this._super.apply(this, arguments);
    this._embeddedManager = Ep.EmbeddedManager.create({adapter: this, container: this.container});
    this._pendingOps = {};
  },

  setupContainer: function(parent) {
    var container = parent.child();
    container.register('serializer:model', Ep.RestSerializer);
    container.register('serializer:errors', Ep.RestErrorsSerializer);
    container.register('serializer:payload', Ep.PayloadSerializer);
    return container;
  },

  // TODO: keep track of loads and prevent concurrent (return same promise)
  load: function(typeKey, id, session, opts) {
    var context = {typeKey: typeKey, id: id};

    var promise = this._load(typeKey, id, opts).then(null, function(payload) {
      var type = session.typeFor(typeKey);
      throw Ep.LoadError.create({
        type: type,
        id: id,
        errors: get(payload, 'errors')
      });
    });
    return this._mergeAndContextualizePromise(promise, session, context, opts);
  },

  _load: function(typeKey, id, opts) {
    var context = {typeKey: typeKey, id: id};

    return this._deserializePromise(this.ajax(this.buildUrlFromContext(context), "GET"), context, opts);
  },

  refresh: function(model, session, opts) {
    return this._mergeAndContextualizePromise(this._refresh(model, opts), session, model, opts);
  },

  _refresh: function(model, opts) {
    return this._deserializePromise(this.ajax(this.buildUrlFromContext(model), "GET"), model, opts);
  },

  update: function(model, session, opts) {
    return this._mergeAndContextualizePromise(this._update(model, opts), session, model, opts);
  },

  _update: function(model, opts) {
    var typeKey = get(model, 'typeKey');

    var data = {};
    data[typeKey] = this.serialize(model);

    return this._deserializePromise(this.ajax(this.buildUrlFromContext(model), "PUT", {data: data}), model, opts);
  },

  create: function(model, session, opts) {
    return this._mergeAndContextualizePromise(this._create(model, opts), session, model, opts);
  },

  _create: function(model, opts) {
    var typeKey = get(model, 'typeKey');

    var data = {};
    data[typeKey] = this.serialize(model);

    return this._deserializePromise(this.ajax(this.buildUrlFromContext(model), "POST", {data: data}), model, opts);
  },

  deleteModel: function(model, session, opts) {
    return this._mergeAndContextualizePromise(this._deleteModel(model, opts), session, model, opts);
  },

  _deleteModel: function(model, opts) {
    return this._deserializePromise(this.ajax(this.buildUrlFromContext(model), "DELETE"), model, opts);
  },

  query: function(typeKey, query, session, opts) {
    return this._mergeAndContextualizePromise(this._query(typeKey, query, opts), session, typeKey, opts);
  },

  _query: function(typeKey, query, opts) {
    return this._deserializePromise(this.ajax(this.buildUrlFromContext(typeKey), "GET", {data: query}), typeKey, opts);
  },

  /**
    Calls a custom endpoint on the remote server.

    The following options are available inside the options hash:

    * `type`: The request method. Defaults to `POST`.
    * `deserialize`: (default true) Whether or not to deserialize the response
      into models. This can be set to false to preserve the raw json.
    * `deserializationContext`: The context to be used for deserialization. Defaults
      to the same context that was passed into the method. If set to null, all
      models that are sent back from the server will be returned as the result
      of the remote call.

    @method remoteCall
    @param {any} context the model or type that is used as the context of the call
    @param String name the name of the action to be called
    @param Object [opts] an options hash
    @param Session [session] the session to merge the results into
  */
  remoteCall: function(context, name, params, opts, session) {
    return this._mergeAndContextualizePromise(this._remoteCall(context, name, params, opts), session, context, opts);
  },

  _remoteCall: function(context, name, params, opts) {
    var adapter = this,
        url = this.buildUrlFromContext(context);

    url = url + '/' + name;

    method = opts && opts.type || "POST";

    // Stringify taking into account serializers
    // TODO: Move this into a serializer
    var data = JSON.stringify(params, function(key, value) {
      if(value && get(value, 'isModel')) {
        var typeKey = get(value, 'typeKey');
        var serializer = adapter.serializerFor(typeKey);
        return serializer.serialize(value);
      }
      return value;
    });

    return this._deserializePromise(this.ajax(url, method, {data: data}), context, opts);
  },

  /**
    @private

    Deserialize the contents of a promise.
  */
  _deserializePromise: function(promise, context, opts) {
    var typeKey = opts && opts.typeKey || this.defaultMergeType,
        adapter = this;

    if(opts && opts.deserializationContext !== undefined) {
      context = opts.deserializationContext;
    }

    return promise.then(function(data){
      if (opts && opts.deserialize === false) {
        return data;
      }
      return adapter.deserialize(typeKey, data, {context: context});
    }, function(xhr) {
      if (opts && opts.deserialize === false) {
        throw xhr;
      }
      throw adapter.deserializeError(typeKey, xhr, {context: context});
    });
  },

  /**
    @private

    Merge the contents of the promise into the session.
  */
  _mergePromise: function(promise, session, opts) {
    if(opts && opts.deserialize === false) {
      return promise;
    }

    function merge(deserialized) {
      if(typeof deserialized.merge === 'function') {
        return deserialized.merge(session);
      } else {
        return session.merge(deserialized);
      }
    }

    return promise.then(function(deserialized) {
      return merge(deserialized);
    }, function(deserialized) {
      throw merge(deserialized);
    });
  },

  /**
    @private

    Transform the promise's resolve value to the context
    of the particular operation. E.g. a load operation may
    return a complex payload consisting of many models. In
    this case we want to just return the model that
    corresponds to the load.
  */
  _contextualizePromise: function(promise, context, opts) {
    if(opts && opts.deserializationContext !== undefined) {
      context = opts.deserializationContext;
    }

    function contextualize(merged) {
      // payloads detect their context during deserialization
      if(context && get(merged, 'isPayload')) {
        var result = get(merged, 'context');
        // the server might not return any data for the context
        // of the operation (e.g. a delete with an empty response)
        // in this case we just echo back the client's version
        if(!result) {
          result = context;
        }
        set(result, 'meta', get(merged, 'meta'));
        // TODO: we might want to merge errors here
        if(get(merged, 'errors') && !get(result, 'errors')) {
          set(result, 'errors', get(merged, 'errors'));
        }
        return result;
      }

      return merged;
    }

    return promise.then(function(merged) {
      return contextualize(merged);
    }, function(merged) {
      throw contextualize(merged);
    });
  },

  /**
    @private

    Composition of `_mergePromise` and `_contextualizePromise`.
  */
  _mergeAndContextualizePromise: function(promise, session, context, opts) {
    return this._contextualizePromise(this._mergePromise(promise, session, opts), context, opts);
  },

  /**
    Useful for manually merging in payload data.

    @method mergePayload
    @param Object data the raw payload data
    @param {any} [context] the context of the payload. This property will dictate the return value of this method.
    @param Session [session] the session to merge into. Defaults to the main session.
    @returns {any} The result of the merge contextualized to the context. E.g. if 'post' is the context, this will return all posts that are part of the payload.
  */
  mergePayload: function(data, context, session) {
    var payload = this.deserialize('payload', data, {context: context});
    if(!session) {
      session = this.container.lookup('session:main');
    }
    payload.merge(session);
    if(context) {
      return payload.context;
    }
    return payload;
  },

  /**
    Book-keeping for embedded models is done on the adapter.
    The logic inside this hook is for this purpose.
  */
  willMergeModel: function(model) {
    if(!get(model, 'isLoaded')) {
      return;
    }
    this._embeddedManager.updateParents(model);
  },

  /**
    @private

    Ep.RestAdapter currently supports two types of 422
    error responses:

    1. A typical rails-like response of a hash containing
       a single `errors` key.

    2. A normal payload similar to the other methods with
       the additional caveat that the `errors` property
       will be set on some of the models.
  */
  deserializeError: function(typeKey, xhr, opts) {
    var data;
    if(xhr.responseText) {
      data = JSON.parse(xhr.responseText);
    } else {
      data = {};
    }

    var result = this.deserialize(typeKey, data, opts);

    var errors = get(result, 'errors');
    if(!errors) {
      errors = Ep.RestErrors.create();
      set(result, 'errors', errors);
    }

    set(errors, 'status', xhr.status);
    set(errors, 'xhr', xhr);

    return result;
  },

  flush: function(session) {
    // take a snapshot of the models and their shadows
    // (these will be updated by the session before the flush is complete)
    var models = get(session, 'dirtyModels').copy(true);
    var shadows = Ep.ModelSet.fromArray(models.map(function(model) {
      // shadows are already frozen copies so no need to re-copy
      return session.shadows.getModel(model);
    }));

    // some special logic is required for embedded records to make
    // sure that they are all in the dirty set
    this.dirtyEmbedded(models, shadows, session);

    this.removeEmbeddedOrphans(models, shadows, session);

    // for embedded serialization purposes we need to materialize
    // all the lazy relationships in the set
    // (all of the copies have lazy models in their relationships)
    materializeRelationships(models);

    var op = Ep.OperationGraph.create({
      models: models,
      shadows: shadows,
      adapter: this,
      session: session
    });

    return this._performFlush(op, session);
  },

  _performFlush: function(op, session) {
    var models = get(op, 'models'),
        pending = Ember.Set.create();
    // check for any pending operations
    models.forEach(function(model) {
      var op = this._pendingOps[model.clientId];
      if(op) pending.add(op);
    }, this);

    var adapter = this;
    if(get(pending, 'length') > 0) {
      return Ember.RSVP.all(pending.toArray()).then(function() {
        return adapter._performFlush(op, session);
      });
    }

    var promise = op.perform();

    // if no pending operations, set this flush
    // as the pending operation for all models
    models.forEach(function(model) {
      this._pendingOps[model.clientId] = promise;
    }, this);

    return promise.then(function(res) {
      // remove all pending operations
      models.forEach(function(model) {
        delete adapter._pendingOps[model.clientId];
      });
      return res.map(function(model) {
        return session.merge(model);
      });
    }, function(err) {
      // remove all pending operations
      models.forEach(function(model) {
        delete adapter._pendingOps[model.clientId];
      });
      throw err.map(function(model) {
        return session.merge(model);
      });
    });
  },

  /**
    This callback is intendended to resolve the request ordering issue
    for parent models. For instance, when we have a Post -> Comments
    relationship, the parent post will be saved first. The request will
    return and it is likely that the returned JSON will have no comments.

    In this callback we re-evaluate the relationships after the children
    have been saved, effectively undoing the erroneous relationship results
    of the parent request.

    TODO: this should utilize the "owner" of the relationship
    TODO: move this to OperationGraph
  */
  rebuildRelationships: function(children, parent) {
    parent.suspendRelationshipObservers(function() {
      // TODO: figure out a way to preserve ordering (or screw ordering and use sets)
      for(var i = 0; i < children.length; i++) {
        var child = children[i];

        child.eachRelationship(function(name, relationship) {
          // TODO: handle hasMany's for non-relational databases...
          if(relationship.kind === 'belongsTo') {
            var value = get(child, name);
            var inverse = child.constructor.inverseFor(name);
            if(inverse) {
              // if embedded then we are certain the parent has the correct data
              if(this.embeddedType(inverse.type, inverse.name)) {
                return;
              }

              if(inverse.kind === 'hasMany') {
                var parentCollection = get(parent, inverse.name);
                if(child.get('isDeleted')) {
                  parentCollection.removeObject(child);
                } else if(value && value.isEqual(parent)) {
                  // TODO: make sure it doesn't already exists (or change model arrays to sets)
                  // TODO: think about 1-1 relationships
                  parentCollection.addObject(child);
                }
              }
              
            }
          }
        }, this);
      }
    }, this);
  },

  /**
    Returns whether or not the passed in relationship
    is the "owner" of the relationship. This defaults
    to true for belongsTo and false for hasMany
  */
  isRelationshipOwner: function(relationship) {
    var config = this.configFor(relationship.parentType);
    var owner = config[relationship.key] && config[relationship.key].owner;
    // TODO: use lack of an inverse to determine this value as well
    return relationship.kind === 'belongsTo' && owner !== false ||
      relationship.kind === 'hasMany' && owner === true
  },

  isDirtyFromRelationships: function(model, cached, relDiff) {
    var serializer = this.serializerForModel(model);
    for(var i = 0; i < relDiff.length; i++) {
      var diff = relDiff[i];
      if(this.isRelationshipOwner(diff.relationship) || serializer.embeddedType(model.constructor, diff.name) === 'always') {
        return true;
      }
    }
    return false;
  },

  shouldSave: function(model) {
    return !this.isEmbedded(model);
  },

  isEmbedded: function(model) {
    return this._embeddedManager.isEmbedded(model);
  },

  /**
    @private
    Iterate over the models and remove embedded records
    that are missing their embedded parents.
  */
  removeEmbeddedOrphans: function(models, shadows, session) {
    var orphans = [];
    models.forEach(function(model) {
      if(!this.isEmbedded(model)) return;
      var root = this.findEmbeddedRoot(model, models);
      if(!root || root.isEqual(model)) {
        orphans.push(model);
      }
    }, this);
    models.removeObjects(orphans);
    shadows.removeObjects(orphans);
  },

  /**
    @private
    Dirty the entire graph of embedded models.
  */
  dirtyEmbedded: function(models, shadows, session) {
    models.forEach(function(model) {
      this.eachEmbeddedRelative(model, function(embeddedModel) {
        // updated adapter level tracking of embedded parents
        this._embeddedManager.updateParents(embeddedModel);

        if (models.contains(embeddedModel)) { return; }
        // Materialize the model since we are dealing with lazy copies
        embeddedModel = session.getModel(embeddedModel);
        var copy = embeddedModel.copy();
        models.add(copy);
        // Add to shadows just for consistency in the logic.
        shadows.add(copy);
      }, this);
    }, this);
  },

  findEmbeddedRoot: function(model, models) {
    var parent = model;
    while(parent) {
      model = parent;
      parent = this._embeddedManager.findParent(model);
    }
    // we want the version in the current session
    return models.getModel(model);
  },

  /**
    @private
    Traverses the entire embedded graph (including parents)
  */
  eachEmbeddedRelative: function(model, callback, binding, visited) {
    if(!get(model, 'isLoaded')) return;
    if(!visited) visited = new Ember.Set();
    if(visited.contains(model)) return;
    visited.add(model);

    callback.call(binding, model);

    this.serializerForModel(model).eachEmbeddedRecord(model, function(embeddedRecord, embeddedType) {
      this.eachEmbeddedRelative(embeddedRecord, callback, binding, visited);
    }, this);

    var parent = this._embeddedManager.findParent(model);
    if(parent) {
      this.eachEmbeddedRelative(parent, callback, binding, visited);
    }
  },

  /**
    Builds a URL from a context. A context can be one of three things:

    1. An instance of a model
    2. A string representing a type (typeKey), e.g. 'post'
    3. A hash containing both a typeKey and an id

    @method buildUrlFromContext
    @param {any} context
    @returns {String} url
  */
  buildUrlFromContext: function(context) {
    var typeKey, id;
    if(typeof context === 'string') {
      typeKey = context;
    } else {
      typeKey = get(context, 'typeKey');
      id = get(context, 'id');
    }
    return this.buildUrl(typeKey, id);
  },

  /**
    Builds a URL for a given type and optional ID.

    By default, it pluralizes the type's name (for example, 'post'
    becomes 'posts' and 'person' becomes 'people'). To override the
    pluralization see [pathForType](#method_pathForType).

    If an ID is specified, it adds the ID to the path generated
    for the type, separated by a `/`.

    @method buildUrl
    @param {String} type
    @param {String} id
    @returns {String} url
  */
  buildUrl: function(typeKey, id) {
    var url = [],
        host = get(this, 'host'),
        prefix = this.urlPrefix();

    if (typeKey) { url.push(this.pathForType(typeKey)); }
    if (id) { url.push(id); }

    if (prefix) { url.unshift(prefix); }

    url = url.join('/');
    if (!host && url) { url = '/' + url; }

    return url;
  },

  /**
    @method urlPrefix
    @private
    @param {String} path
    @param {String} parentUrl
    @return {String} urlPrefix
  */
  urlPrefix: function(path, parentURL) {
    var host = get(this, 'host'),
        namespace = get(this, 'namespace'),
        url = [];

    if (path) {
      // Absolute path
      if (path.charAt(0) === '/') {
        if (host) {
          path = path.slice(1);
          url.push(host);
        }
      // Relative path
      } else if (!/^http(s)?:\/\//.test(path)) {
        url.push(parentURL);
      }
    } else {
      if (host) { url.push(host); }
      if (namespace) { url.push(namespace); }
    }

    if (path) {
      url.push(path);
    }

    return url.join('/');
  },

  /**
    Determines the pathname for a given type.

    By default, it pluralizes the type's name (for example,
    'post' becomes 'posts' and 'person' becomes 'people').

    ### Pathname customization

    For example if you have an object LineItem with an
    endpoint of "/line_items/".

    ```js
    DS.RESTAdapter.reopen({
      pathForType: function(type) {
        var decamelized = Ember.String.decamelize(type);
        return Ember.String.pluralize(decamelized);
      };
    });
    ```

    @method pathForType
    @param {String} type
    @returns {String} path
  **/
  pathForType: function(type) {
    var camelized = Ember.String.camelize(type);
    return Ember.String.pluralize(camelized);
  },

  /**
    Takes an ajax response, and returns a relevant error.

    Returning a `DS.InvalidError` from this method will cause the
    record to transition into the `invalid` state and make the
    `errors` object available on the record.

    ```javascript
    App.ApplicationAdapter = DS.RESTAdapter.extend({
      ajaxError: function(jqXHR) {
        var error = this._super(jqXHR);

        if (jqXHR && jqXHR.status === 422) {
          var jsonErrors = Ember.$.parseJSON(jqXHR.responseText)["errors"];

          return new DS.InvalidError(jsonErrors);
        } else {
          return error;
        }
      }
    });
    ```

    Note: As a correctness optimization, the default implementation of
    the `ajaxError` method strips out the `then` method from jquery's
    ajax response (jqXHR). This is important because the jqXHR's
    `then` method fulfills the promise with itself resulting in a
    circular "thenable" chain which may cause problems for some
    promise libraries.

    @method ajaxError
    @param  {Object} jqXHR
    @return {Object} jqXHR
  */
  ajaxError: function(jqXHR) {
    if (jqXHR) {
      jqXHR.then = null;
    }

    return jqXHR;
  },

  /**
    Takes a URL, an HTTP method and a hash of data, and makes an
    HTTP request.

    When the server responds with a payload, Ember Data will call into `extractSingle`
    or `extractArray` (depending on whether the original query was for one record or
    many records).

    By default, `ajax` method has the following behavior:

    * It sets the response `dataType` to `"json"`
    * If the HTTP method is not `"GET"`, it sets the `Content-Type` to be
      `application/json; charset=utf-8`
    * If the HTTP method is not `"GET"`, it stringifies the data passed in. The
      data is the serialized record in the case of a save.
    * Registers success and failure handlers.

    @method ajax
    @private
    @param {String} url
    @param {String} type The request type GET, POST, PUT, DELETE etc.
    @param {Object} hash
    @return {Promise} promise
  */
  ajax: function(url, type, hash) {
    var adapter = this;

    return new Ember.RSVP.Promise(function(resolve, reject) {
      hash = adapter.ajaxOptions(url, type, hash);

      hash.success = function(json) {
        Ember.run(null, resolve, json);
      };

      hash.error = function(jqXHR, textStatus, errorThrown) {
        Ember.run(null, reject, adapter.ajaxError(jqXHR));
      };

      Ember.$.ajax(hash);
    }, "Ep: RestAdapter#ajax " + type + " to " + url);
  },

  /**
    @method ajaxOptions
    @private
    @param {String} url
    @param {String} type The request type GET, POST, PUT, DELETE etc.
    @param {Object} hash
    @return {Object} hash
  */
  ajaxOptions: function(url, type, hash) {
    hash = hash || {};
    hash.url = url;
    hash.type = type;
    hash.dataType = 'json';
    hash.context = this;

    if (hash.data && type !== 'GET') {
      hash.contentType = 'application/json; charset=utf-8';
      hash.data = JSON.stringify(hash.data);
    }

    var headers = get(this, 'headers');
    if (headers !== undefined) {
      hash.beforeSend = function (xhr) {
        forEach.call(Ember.keys(headers), function(key) {
          xhr.setRequestHeader(key, headers[key]);
        });
      };
    }


    return hash;
  }

});