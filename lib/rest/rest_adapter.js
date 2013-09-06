/*global jQuery*/

require('../adapter');
require('./embedded_manager');
require('./operation_graph');
require('./rest_errors');
require('../serializer/json_serializer/embedded_helpers_mixin');

var get = Ember.get, set  = Ember.set;

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
Ep.RestAdapter = Ep.Adapter.extend(Ep.EmbeddedHelpersMixin, {
  init: function() {
    this._super.apply(this, arguments);
    this._embeddedManager = Ep.EmbeddedManager.create({adapter: this});
    this._pendingOps = {};
  },

  // TODO: keep track of loads and prevent concurrent (return same promise)
  load: function(type, id) {
    var root = this.rootForType(type), adapter = this;

    return this.ajax(this.buildURL(root, id), "GET").then(function(json){
      return adapter.didReceiveDataForLoad(json, type, id);
    }, function(xhr) {
      var model = Ep.LoadError.create({
        id: id,
        type: type
      });
      throw adapter.didError(xhr, model);
    });
  },

  refresh: function(model) {
    var type = get(model, 'type'),
        root = this.rootForType(type),
        id = get(model, 'id'),
        adapter = this;

    return this.ajax(this.buildURL(root, id), "GET").then(function(json){
      return adapter.didReceiveData(json, model);
    }, function(xhr) {
      throw adapter.didError(xhr, model);
    });
  },

  update: function(model) {
    var type = get(model, 'type'),
        root = this.rootForType(type),
        id = get(model, 'id'),
        adapter = this,
        serializer = this.serializerFor(type);

    var data = {};
    data[root] = serializer.serialize(model);

    return this.ajax(this.buildURL(root, id), "PUT",{
      data: data
    }).then(function(json){
      return adapter.didReceiveData(json, model);
    }, function(xhr) {
      throw adapter.didError(xhr, model);
    });
  },

  create: function(model) {
    var type = get(model, 'type'),
        root = this.rootForType(type),
        adapter = this,
        serializer = this.serializerFor(type);

    var data = {};
    data[root] = serializer.serialize(model, { includeId: true });

    return this.ajax(this.buildURL(root), "POST", {
      data: data
    }).then(function(json){
      // TODO: Ids are reified too early. This prevents servers that don't
      // do clientId pass-through from recognizing a single returned model
      // of the same type as being the newly created model.
      return adapter.didReceiveData(json, model);
    }, function(xhr) {
      throw adapter.didError(xhr, model);
    });
  },

  deleteModel: function(model) {
    var type = get(model, 'type'),
        root = this.rootForType(type),
        id = get(model, 'id'),
        adapter = this;

    return this.ajax(this.buildURL(root, id), "DELETE").then(function(json){
      return adapter.didReceiveData(json, model);
    }, function(xhr){
      throw adapter.didError(xhr, model);
    });
  },

  query: function(type, query) {
    var root = this.rootForType(type),
        adapter = this;

    return this.ajax(this.buildURL(root), "GET", {
      data: query
    }).then(function(json){
      return adapter.didReceiveDataForFind(json, type);
    }, function(xhr) {
      // TODO
      throw xhr;
    });
  },

  remoteCall: function(context, name, params) {
    var url, adapter = this;
    if(typeof context === "string") {
      context = this.typeFor(context);
    }
    if(typeof context === 'function') {
      url = this.buildURL(this.rootForType(context));
    } else {
      var id = get(context, 'id');
      Ember.assert("Cannot perform a remote call with a context that doesn't have an id", id);
      url = this.buildURL(this.rootForType(get(context, 'type')), id);
    }

    url = url + '/' + name;

    // TODO: serialize models passed in the params
    var data = params;

    // TODO: how to specify method?
    var method = "POST";
    return this.ajax(url, method,{
      data: data
    }).then(function(json){
      return adapter.didReceiveDataForRpc(json, context);
    }, function(xhr) {
      throw adapter.didError(xhr, context);
    });
  },

  typeFor: function(typeName) {
    return this.container.lookup('model:' + typeName);
  },

  didReceiveData: function(data, targetModel) {
    var result = null;
    this.processData(data, function(model) {
      if(targetModel && model.isEqual(targetModel)) {
        result = model;
      }
    });
    return result;
  },

  didReceiveDataForLoad: function(data, type, id) {
    var result = null;
    this.processData(data, function(model) {
      if(model.hasType(type) && get(model, 'id') === id) {
        result = model;
      }
    });
    return result;
  },

  didReceiveDataForFind: function(data, type) {
    var result = [];
    this.processData(data, function(model) {
      if(model.hasType(type)) {
        result.pushObject(model);
      }
    });
    return Ep.ModelArray.create({content: result});
  },

  didReceiveDataForRpc: function(data, context) {
    return this.didReceiveData(data, context);
  },

  processData: function(data, callback, binding) {
    var models = get(this, 'serializer').deserializePayload(data);
    models.forEach(function(model) {
      this.willLoadModel(model);
    }, this);
    models.forEach(function(model) {
      this.didLoadModel(model);
      callback.call(binding || this, model);
    }, this);
    this.materializeRelationships(models);
  },

  willLoadModel: function(model) {
    // it is possible that some models will have their clientId
    // set by the server and another (e.g. lazy) copy of the model
    model.eachRelatedModel(function(relative) {
      if(get(relative, 'clientId')) {
        this.reifyClientId(model);
      }
    }, this);
  },

  didLoadModel: function(model) {
    // TODO: this could be made way more efficient
    model.eachRelatedModel(function(relative) {
      this.reifyClientId(relative);
    }, this);

    // TODO: this might not be deep enough to solve for
    // nested embedded children
    this._embeddedManager.updateParents(model);
  },

  didError: function(xhr, model) {
    // TODO: it is possible that the server will return new data here
    // we should deserialize like other methods
    var errors;

    if (xhr.status === 422) { // validation error
      var json = JSON.parse(xhr.responseText),
          serializer = get(this, 'serializer'),
          validationErrors = serializer.extractValidationErrors(get(model, 'type'), json);

      errors = Ep.RestErrors.create({
        content: validationErrors
      });
    } else {
      errors = Ep.RestErrors.create();
    }

    set(errors, 'status', xhr.status);
    set(errors, 'xhr', xhr);

    set(model, 'errors', errors);

    throw model;
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
    this.materializeRelationships(models);

    var op = Ep.OperationGraph.create({
      models: models,
      shadows: shadows,
      adapter: this
    });

    return this._performFlush(op);
  },

  _performFlush: function(op) {
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
        return adapter._performFlush(op);
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
      return res;
    }, function(err) {
      // remove all pending operations
      models.forEach(function(model) {
        delete adapter._pendingOps[model.clientId];
      });
      throw err;
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
  */
  rebuildRelationships: function(children, parent) {
    var serializer = get(this, 'serializer');
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
              if(serializer.embeddedType(inverse.type, inverse.name)) {
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
        });
      }
    });
  },

  /**
    Returns whether or not the passed in relationship
    is the "owner" of the relationship. This defaults
    to true for belongsTo and false for hasMany
  */
  isRelationshipOwner: function(relationship) {
    var serializer = get(this, 'serializer');
    var config = this.configFor(relationship.parentType);
    var owner = config[relationship.key] && config[relationship.key].owner;
    // TODO: use lack of an inverse to determine this value as well
    return relationship.kind === 'belongsTo' && owner !== false ||
      relationship.kind === 'hasMany' && owner === true
  },

  isDirtyFromRelationships: function(model, cached, relDiff) {
    var serializer = get(this, 'serializer');
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

    get(this, 'serializer').eachEmbeddedRecord(model, function(embeddedRecord, embeddedType) {
      this.eachEmbeddedRelative(embeddedRecord, callback, binding, visited);
    }, this);

    var parent = this._embeddedManager.findParent(model);
    if(parent) {
      this.eachEmbeddedRelative(parent, callback, binding, visited);
    }
  },

  materializeRelationships: function(models) {

    if(!(models instanceof Ep.ModelSet)) {
      models = Ep.ModelSet.fromArray(models);
    }

    models.forEach(function(model) {

      // TODO: does this overwrite non-lazy embedded children?
      model.eachRelationship(function(name, relationship) {
        if(relationship.kind === 'belongsTo') {
          var child = get(model, name);
          if(child) {
            child = models.getModel(child) || child;
            set(model, name, child);
          }
        } else if(relationship.kind === 'hasMany') {
          // TODO: merge could be per item
          var children = get(model, name);
          var lazyChildren = Ep.ModelSet.create();
          lazyChildren.addObjects(children);
          children.clear();
          lazyChildren.forEach(function(child) {
            child = models.getModel(child) || child;
            children.addObject(child);
          });
        }
      }, this);

    }, this);

  },

  /**
    Takes a URL, an HTTP method and a hash of data, and makes an
    HTTP request.

    When the server responds with a payload, Ember Data will call into `extractSingle`
    or `extractArray` (depending on whether the original query was for one record or
    many records).

    By default, it has the following behavior:

    * It sets the response `dataType` to `"json"`
    * If the HTTP method is not `"GET"`, it sets the `Content-Type` to be
      `application/json; charset=utf-8`
    * If the HTTP method is not `"GET"`, it stringifies the data passed in. The
      data is the serialized record in the case of a save.
    * Registers success and failure handlers.

    @method ajax
    @private
    @param  url
    @param  type
    @param  hash
  */
  ajax: function(url, type, hash) {
    var adapter = this;

    return new Ember.RSVP.Promise(function(resolve, reject) {
      hash = hash || {};
      hash.url = url;
      hash.type = type;
      hash.dataType = 'json';
      hash.context = adapter;

      if (hash.data && type !== 'GET') {
        hash.contentType = 'application/json; charset=utf-8';
        hash.data = JSON.stringify(hash.data);
      }

      if (adapter.headers !== undefined) {
        var headers = adapter.headers;
        hash.beforeSend = function (xhr) {
          forEach.call(Ember.keys(headers), function(key) {
            xhr.setRequestHeader(key, headers[key]);
          });
        };
      }

      hash.success = function(json) {
        Ember.run(null, resolve, json);
      };

      hash.error = function(jqXHR, textStatus, errorThrown) {
        if (jqXHR) {
          jqXHR.then = null;
        }

        Ember.run(null, reject, jqXHR);
      };

      Ember.$.ajax(hash);
    });
  },

  url: "",

  rootForType: function(type) {
    var serializer = this.serializerFor(type);
    return serializer.rootForType(type);
  },

  pluralize: function(string) {
    var serializer = get(this, 'serializer');
    return serializer.pluralize(string);
  },

  buildURL: function(record, suffix) {
    var url = [this.url];

    Ember.assert("Namespace URL (" + this.namespace + ") must not start with slash", !this.namespace || this.namespace.toString().charAt(0) !== "/");
    Ember.assert("Record URL (" + record + ") must not start with slash", !record || record.toString().charAt(0) !== "/");
    Ember.assert("URL suffix (" + suffix + ") must not start with slash", !suffix || suffix.toString().charAt(0) !== "/");

    if (!Ember.isNone(this.namespace)) {
      url.push(this.namespace);
    }

    url.push(this.pluralize(record));
    if (suffix !== undefined) {
      url.push(suffix);
    }

    return url.join("/");
  },

  serializer: Ember.computed(function() {
    // DEPRECATED: user serializerFor instead
    return container.lookup('serializer:main');
  })

});
