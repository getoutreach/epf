import Model from 'epf/model/model';
import ModelSerializer from 'epf/serializers/model';
// Common model setups for tests

function postWithComments() {
  this.App = Ember.Namespace.create();
  class Post extends Ep.Model {}
  Post.defineSchema({
    typeKey: 'post',
    attributes: {
      title: {type: 'string'}
    },
    relationships: {
      comments: {kind: 'hasMany', type: 'comment'}
    }
  });
  this.App.Post = this.Post = Post;
  this.container.register('model:post', Post);

  class Comment extends Ep.Model {}
  Comment.defineSchema({
    typeKey: 'comment',
    attributes: {
      body: {type: 'string'}
    },
    relationships: {
      post: {kind: 'belongsTo', type: 'post'}
    }
  });
  this.App.Comment = this.Comment = Comment;
  this.container.register('model:comment', Comment);
}

function postWithEmbeddedComments() {
  postWithComments.apply(this);
  this.PostSerializer = ModelSerializer.extend({
    properties: {
      comments: {
        embedded: 'always'
      }
    }
  });
  this.container.register('serializer:post', this.PostSerializer);
}

export {postWithComments, postWithEmbeddedComments}
