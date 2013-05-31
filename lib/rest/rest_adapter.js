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
    var cached = this.store.getForId(type, id)
    // check for store cache hit
    if(cached && get(cached, 'isLoaded')) {
      return Ember.RSVP.resolve(cached);
    }
    var root = this.rootForType(type), adapter = this;

    return this.ajax(this.buildURL(root, id), "GET").then(function(json){
      return Ember.run(adapter, 'didReceiveDataForLoad', json, type, id);
    }, function(xhr) {
      // TODO: set 404
      throw xhr;
    });
  },

  refresh: function(model) {
    var type = get(model, 'type');
    var root = this.rootForType(type), adapter = this;
    var id = get(model, 'id');

    return this.ajax(this.buildURL(root, id), "GET").then(function(json){
      return Ember.run(adapter, 'didReceiveData', json, model);
    }, function(xhr) {
      // TODO: handle deletion
      throw xhr;
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
      Ember.run(adapter, 'didError', xhr, model);
      throw xhr;
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
      Ember.run(adapter, 'didError', xhr, model);
      throw xhr;
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
      Ember.run(adapter, 'didError', xhr, model);
      throw xhr;
    });
  },

  find: function(type, query) {
    var root = this.rootForType(type),
    adapter = this;

    return this.ajax(this.buildURL(root), "GET", {
      data: query
    }).then(function(json){
      return Ember.run(adapter, 'didReceiveDataForFind', json, type);
    }, function(xhr) {
      throw xhr;
    });
  },

  didReceiveData: function(data, targetModel) {
    var models = get(this, 'serializer').deserialize(data);
    var result = null;
    models.forEach(function(model) {
      this.loaded(model);
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
      this.loaded(model);
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
      this.loaded(model);
      if(model.hasType(type)) {
        result.pushObject(model);
      }
    }, this);
    return Ep.ModelArray.create({content: result});
  },

  didError: function(xhr, model) {
    var json = JSON.parse(xhr.responseText),
        serializer = get(this, 'serializer'),
        errors = serializer.extractValidationErrors(get(model, 'type'), json);

    return set(model, 'errors', errors);
  },

  flush: function(session) {
    var adapter = this;

    var rootNodes = this._createDependencyGraph(session);

    var cumulative = [];

    function createNestedPromise(node) {
      var promise;
      var dirtyType = adapter.dirtyType(node.model);
      if(!dirtyType && node.dirtyEmbeddedChildren) {
        dirtyType = "updated";
      }
      var model = node.model;
      if(!dirtyType || adapter.isEmbedded(model)) {
        // return an "identity" promise if we don't want to do anything
        // don't return the model since we don't care about merging the result
        promise = Ember.RSVP.resolve();
      } else if(dirtyType === "created") {
        promise = adapter.create(model);
      } else if(dirtyType === "updated") {
        promise = adapter.update(model);
      } else if(dirtyType === "deleted") {
        promise = adapter.deleteModel(model);
      }
      // keep track of all models for the resolution of the entire flush
      promise = promise.then(function(model) {
        if(!model) return;
        cumulative.push(model);
        return model;
      });
      if(node.children.length > 0) {
        promise = promise.then(function(model) {
          var childPromises = node.children.map(createNestedPromise);
          return Ember.RSVP.all(childPromises).then(function(models) {
            // compact the models since we return null from the identity case above
            adapter.rebuildRelationships(models.compact(), model);
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
      console.error(err.toString());
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

  _createDependencyGraph: function(session) {
    var adapter = this;
    var nodes = Ember.MapWithDefault.create({
      defaultValue: function(model) {
        return new Node(model);
      }
    });

    var dirty = Ember.OrderedSet.create();

    session.get('models').forEach(function(model) {

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
        var cached = this.store.getModel(model);
        var diff = model.diff(cached);
        for(var i = 0; i < diff.length; i++) {
          var d = diff[i];
          if(d.relationship && this.isRelationshipOwner(d.relationship)) {
            rels.push(d);
          }
        }
      }

      node.dirty = node.dirty || this.dirtyType(model);

      // Here we walk up the embedded tree and mark the root as dirty
      // If the model is new we won't be able to determine the root here,
      // in this case we rely on the parent being marked dirty based on
      // a change in the embedded has many
      if(node.dirty && this.isEmbedded(model) && !get(model, 'isNew')) {
        var root = this.findEmbeddedRoot(model);
        var rootNode = nodes.get(root);
        rootNode.dirty = true;
        rootNode.dirtyEmbeddedChildren = true;
      }

      for(var i = 0; i < rels.length; i++) {
        var d = rels[i];
        var name = d.name;
        var parentModel = model.get(name) || session.getModel(d.oldValue);

        // TODO: handle embedded records
        // TODO: handle hasMany's depending on adapter configuration
        //   // In the non-embedded case, there is a potential request race
        //   // condition where the parent returns the id of a deleted child.
        //   // To solve for this we make the child delete complete first.
        //   if(r.changeType === 'remove' && adapter.shouldSave(childNode.record) && adapter.shouldSave(parentNode.record)) {
        //     childNode.addChild(parentNode);
        //   } else {
        //     parentNode.addChild(childNode);
        //   }
        if(parentModel) {
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

  findEmbeddedRoot: function(model) {
    var session = get(model, 'session');
    var parent = model;
    while(parent) {
      model = parent;
      parent = this._embeddedManager.findParent(model);
    }
    // we want the version in the current session
    return session.getModel(model);
  },

  loaded: function(model) {
    this._super.apply(this, arguments);
    this._embeddedManager.updateParents(model);
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
