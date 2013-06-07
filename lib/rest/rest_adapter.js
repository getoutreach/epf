/*global jQuery*/

require('../adapter');
require('./embedded_manager');

var get = Ember.get, set  = Ember.set;

var Node = function(model) {
  this.dirty = false;
  this.model = model;
  this.children = Ember.Set.create();
  this.parents = Ember.Set.create();
  this.dirtyEmbeddedChildren = false;
};

Node.prototype = {
  addChild: function(childNode) {
    this.children.add(childNode);
    childNode.parents.add(this);
  },

  isRoot: function() {
    return this.parents.every(function(parent) {
      return !get(parent, 'dirty') && parent.isRoot();
    });
  }
};

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

  @class RESTAdapter
  @constructor
  @namespace DS
  @extends Ep.Adapter
*/
Ep.RestAdapter = Ep.Adapter.extend({
  init: function() {
    this._super.apply(this, arguments);
    this._embeddedManager = Ep.EmbeddedManager.create({adapter: this});
  },

  load: function(type, id) {
    var root = this.rootForType(type), adapter = this;

    return this.ajax(this.buildURL(root, id), "GET").then(function(json){
      return Ember.run(adapter, 'didReceiveDataForLoad', json, type, id);
    }, function(xhr) {
      throw Ember.run(adapter, 'didError', xhr, model);
    });
  },

  refresh: function(model) {
    var type = get(model, 'type');
    var root = this.rootForType(type), adapter = this;
    var id = get(model, 'id');

    return this.ajax(this.buildURL(root, id), "GET").then(function(json){
      return Ember.run(adapter, 'didReceiveData', json, model);
    }, function(xhr) {
      throw Ember.run(adapter, 'didError', xhr, model);
    });
  },

  update: function(model) {
    var id, root, adapter, data, type = get(model, 'type');

    id = get(model, 'id');
    root = this.rootForType(type);
    adapter = this;

    data = {};
    data[root] = get(this, 'serializer').serialize(model);

    return this.ajax(this.buildURL(root, id), "PUT",{
      data: data
    }).then(function(json){
      return Ember.run(adapter, 'didReceiveData', json, model);
    }, function(xhr) {
      throw Ember.run(adapter, 'didError', xhr, model);
    });
  },

  create: function(model) {
    var type = get(model, 'type');
    var root = this.rootForType(type);
    var adapter = this;
    var data = {};

    data[root] = get(this, 'serializer').serialize(model, { includeId: true });

    return this.ajax(this.buildURL(root), "POST", {
      data: data
    }).then(function(json){
      return Ember.run(adapter, 'didReceiveData', json, model);
    }, function(xhr) {
      throw Ember.run(adapter, 'didError', xhr, model);
    });
  },

  deleteModel: function(model) {
    var id, root, adapter, type = get(model, 'type');

    id = get(model, 'id');
    root = this.rootForType(type);
    adapter = this;

    return this.ajax(this.buildURL(root, id), "DELETE").then(function(json){
      return Ember.run(adapter, 'didReceiveData', json, model);
    }, function(xhr){
      throw Ember.run(adapter, 'didError', xhr, model);
    });
  },

  findQuery: function(type, query) {
    var root = this.rootForType(type),
    adapter = this;

    return this.ajax(this.buildURL(root), "GET", {
      data: query
    }).then(function(json){
      return Ember.run(adapter, 'didReceiveDataForFind', json, type);
    }, function(xhr) {
      // TODO
      throw xhr;
    });
  },

  remoteCall: function(context, name, params) {
    var url, adapter = this;
    if(typeof context === "string") {
      context = this.lookupType(context);
    }
    if(typeof context === 'function') {
      url = this.buildURL(this.rootForType(context));
    } else {
      var id = get(context, 'id');
      Ember.assert("Cannot perform a remote call with a context that doesn't have an id", id);
      url = this.buildURL(this.rootForType(context.constructor), id);
    }

    url = url + '/' + name;

    // TODO: serialize models passed in the params
    var data = params;

    // TODO: how to specify method?
    var method = "POST";
    return this.ajax(url, method,{
      data: data
    }).then(function(json){
      return Ember.run(adapter, 'didReceiveDataForRpc', json, context);
    }, function(xhr) {
      throw Ember.run(adapter, 'didError', xhr, context);
    });
  },

  lookupType: function(type) {
    return this.container.lookup('model:' + type);
  },

  didReceiveData: function(data, targetModel) {
    var models = get(this, 'serializer').deserialize(data);
    var result = null;
    models.forEach(function(model) {
      this.didLoadModel(model);
      if(targetModel && model.isEqual(targetModel)) {
        result = model;
      }
    }, this);
    return result || targetModel;
  },

  didReceiveDataForLoad: function(data, type, id) {
    var models = get(this, 'serializer').deserialize(data);
    var result = null;
    models.forEach(function(model) {
      this.didLoadModel(model);
      if(model.hasType(type) && get(model, 'id') === id) {
        result = model;
      }
    }, this);
    if(!result) {
      throw new Ember.Error("No data received for " + type.toString() + " with id " + id + ". Server should return 404 instead.");
    }
    return result;
  },

  didReceiveDataForFind: function(data, type) {
    var models = get(this, 'serializer').deserialize(data);
    var result = [];
    // TODO: how to distinguish find results vs. sideloads?
    models.forEach(function(model) {
      this.didLoadModel(model);
      if(model.hasType(type)) {
        result.pushObject(model);
      }
    }, this);
    return Ep.ModelArray.create({content: result});
  },

  didReceiveDataForRpc: function(data, context) {
    return this.didReceiveData(data, context);
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
    if (xhr.status === 422) { // validation error
      var json = JSON.parse(xhr.responseText),
          serializer = get(this, 'serializer'),
          errors = serializer.extractValidationErrors(get(model, 'type'), json);

      set(model, 'errors', errors);
    } else {
      // unknown error?
      set(model, 'errors', {})
    }
    // TODO 404

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

    // for embedded serialization purposes we need to materialize
    // all the lazy relationships in the set
    // (all of the copies have lazy models in their relationships)
    this.materializeRelationships(models);

    var adapter = this;

    var rootNodes = this._createDependencyGraph(models, shadows);

    var cumulative = [];

    function createNestedPromise(node) {
      var promise;
      var dirtyType = adapter.dirtyType(node.model, shadows);
      if(!dirtyType && node.dirtyEmbeddedChildren) {
        dirtyType = "updated";
      }
      var model = node.model;
      if(!dirtyType || adapter.isEmbedded(model)) {
        // return an "identity" promise if we don't want to do anything
        promise = Ember.RSVP.resolve(model);
      } else if(dirtyType === "created") {
        promise = adapter.create(model);
      } else if(dirtyType === "updated") {
        promise = adapter.update(model);
      } else if(dirtyType === "deleted") {
        promise = adapter.deleteModel(model);
      }
      // keep track of all models for the resolution of the entire flush
      promise = promise.then(function(model) {
        // resolve a lazy copy if we did not receive data from the server,
        // this is because the data here means nothing. an example of a
        // corner case which needs this is embedded children
        if(model === node.model) {
          cumulative.push(model.lazyCopy());
        } else {
          cumulative.push(model);
        }
        return model;
      }, function(model) {
        cumulative.push(model);
        throw model;
      });
      if(node.children.length > 0) {
        promise = promise.then(function(model) {
          var childPromises = node.children.map(createNestedPromise);
          return Ember.RSVP.all(childPromises).then(function(models) {
            adapter.rebuildRelationships(models, model);
            // TODO: we return just the model here instead of all models,
            // this works because of the cumulative scoped variable
            // we should try and clean this up
            return model;
          });
        });
      }
      return promise;
    }

    return Ember.RSVP.all(rootNodes.map(createNestedPromise)).then(function() {
      return cumulative;
    }, function(err) {
      throw cumulative;
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

  _createDependencyGraph: function(models, shadows) {
    var adapter = this;
    var nodes = Ember.MapWithDefault.create({
      defaultValue: function(model) {
        return new Node(model);
      }
    });

    models.forEach(function(model) {

      // skip any promises that aren't loaded
      // TODO: think through edge cases in depth
      if(!get(model, 'isLoaded')) {
        return;
      }

      var rels = [];
      var node = nodes.get(model);
      var serializer = get(this, 'serializer');

      // determine which relationships are affected by this flush
      // TODO: we should unify this with dirty checking
      // TODO: right now we assume a relational database and only
      // care about belongsTo
      if(get(model, 'isNew')) {
        model.eachRelationship(function(name, relationship) {
          if(this.isRelationshipOwner(relationship)) {
            rels.push({name: name, type: relationship.kind, relationship: relationship, oldValue: null});
          }
        }, this);
      }
      // } else if(get(model, 'isDeleted')) {
      //   var cached = this.store.getForId(model);
      //   model.eachRelationship(function(name, relationship) {
      //     if(relationship.kind === 'belongsTo') {
      //       rels.push({name: name, type: 'belongsTo', relationship: relationship, oldValue: get(cached, 'name')});
      //     }
      //   }, this);
      // }
      else {
        var cached = shadows.getModel(model);
        var diff = model.diff(cached);
        for(var i = 0; i < diff.length; i++) {
          var d = diff[i];
          if(d.relationship && this.isRelationshipOwner(d.relationship)) {
            rels.push(d);
          }
        }
      }

      node.dirty = node.dirty || this.dirtyType(model, shadows);

      // Here we walk up the embedded tree and mark the root as dirty
      // If the model is new we won't be able to determine the root here,
      // in this case we rely on the parent being marked dirty based on
      // a change in the embedded has many
      if(node.dirty && this.isEmbedded(model) && !get(model, 'isNew')) {
        var root = this.findEmbeddedRoot(model, models);
        var rootNode = nodes.get(root);
        rootNode.dirty = true;
        rootNode.dirtyEmbeddedChildren = true;
      }

      for(var i = 0; i < rels.length; i++) {
        var d = rels[i];
        var name = d.name;
        var parentModel = model.get(name) || shadows.getModel(d.oldValue);

        // TODO: handle hasMany's depending on adapter configuration
        if(parentModel) {
          // the copies are shallow right now and don't reference each other
          // so we must pull the corresponding instance from the set we are dealing with
          parentModel = models.getModel(parentModel);
          var parentNode = nodes.get(parentModel);
          parentNode.addChild(node);
        }
      }

    }, this);

    var rootNodes = Ember.Set.create();

    nodes.forEach(function(model, node) {
      if(node.dirty && node.isRoot()) {
        rootNodes.add(node);
      }
    }, this);

    return rootNodes;
  },

  /**
    Returns whether or not the passed in relationship
    is the "owner" of the relationship. This defaults
    to true for belongsTo and false for hasMany
  */
  isRelationshipOwner: function(relationship) {
    var serializer = get(this, 'serializer');
    var owner = serializer.mappingOption(relationship.parentType, relationship.key, 'owner');
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

  isEmbedded: function(model) {
    return this._embeddedManager.isEmbedded(model);
  },

  dirtyEmbedded: function(models, shadows, session) {

    this.dirtyEmbeddedParents(models, shadows, session);

    models.forEach(function(model) {
      this.dirtyEmbeddedTree(model, models, shadows, session);
    }, this);

  },

  dirtyEmbeddedParents: function(models, shadows, session) {
    // first make sure all parents are in the dirty set
    models.forEach(function(model) {
      var parent;
      while(parent = this._embeddedManager.findParent(model)) {
        model = session.getModel(parent);
        if(!models.contains(model)) {
          var copy = model.copy()
          models.add(copy);
          // add to shadows just for consistency in the logic
          shadows.add(copy);
        }
      }
    }, this);
  },

  dirtyEmbeddedTree: function(model, models, shadows, session) {
    get(this, 'serializer').eachEmbeddedRecord(model, function(embeddedRecord, embeddedType) {
      if (embeddedType !== 'always') { return; }
      if (models.contains(embeddedRecord)) { return; }
      embeddedRecord = session.getModel(embeddedRecord);
      if(!embeddedRecord) return;
      if(!models.contains(embeddedRecord)) {
        var copy = embeddedRecord.copy()
        models.add(copy);
        // add to shadows just for consistency in the logic
        shadows.add(copy);
      }
      this.dirtyEmbeddedTree(embeddedRecord, models, shadows, session);
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

  materializeRelationships: function(models) {

    models.forEach(function(model) {

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

  ajax: function(url, type, hash) {
    try {
      hash = hash || {};
      hash.url = url;
      hash.type = type;
      hash.dataType = 'json';
      hash.context = this;

      if (hash.data && type !== 'GET') {
        hash.contentType = 'application/json; charset=utf-8';
        hash.data = JSON.stringify(hash.data);
      }

      return Ember.RSVP.resolve(jQuery.ajax(hash));
    } catch (error) {
      return Ember.RSVP.resolve(error);
    }
  },

  url: "",

  rootForType: function(type) {
    var serializer = get(this, 'serializer');
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

  sinceQuery: function(since) {
    var query = {};
    query[get(this, 'since')] = since;
    return since ? query : null;
  }
});
