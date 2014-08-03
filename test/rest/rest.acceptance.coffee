`import setup from './_shared'`
`import {postWithComments, groupWithMembersWithUsers} from '../support/schemas'`
`import Model from 'epf/model/model'`
`import ModelSerializer from 'epf/serializers/model'`

describe "rest", ->

  adapter = null
  session = null

  beforeEach ->
    setup.apply(this)
    adapter = @adapter
    session = @session
    Ep.__container__ = @container

  afterEach ->
    delete Ep.__container__

  describe "managing groups with embedded members", ->

    beforeEach ->
      groupWithMembersWithUsers.apply(this)

      GroupSerializer = ModelSerializer.extend
        properties:
          members:
            embedded: 'always'

      @container.register 'serializer:group', GroupSerializer

    it 'creates new group and then deletes a member', ->
      adapter.r['POST:/users'] = -> users: {client_id: user.clientId, id: 1, name: "wes"}
      adapter.r['POST:/groups'] = (url, type, hash) ->
        expect(hash.data.group.members[0].role).to.eq('chief')
        return groups: {client_id: group.clientId, id: 2, name: "brogrammers", members: [{client_id: member.clientId, id: 3, role: "chief", group: 2, user: 1}], user: 1}

      childSession = session.newSession()
      user = childSession.create 'user', name: 'wes'
      group = null
      member = null
      childSession.flushIntoParent().then ->
        expect(user.id).to.not.be.null
        expect(adapter.h).to.eql(['POST:/users'])
        childSession = session.newSession()
        user = childSession.add(user)
        group = childSession.create 'group', name: 'brogrammers', user: user
        member = childSession.create 'member', role: 'chief', user: user, group: group
        childSession.flushIntoParent().then ->
          expect(adapter.h).to.eql(['POST:/users', 'POST:/groups'])
          expect(user.id).to.not.be.null
          expect(group.id).to.not.be.null
          expect(group.members.get('length')).to.eq(1)
          expect(user.groups.get('length')).to.eq(1)
          expect(user.members.get('length')).to.eq(1)
          expect(member.id).to.not.be.null

          childSession = session.newSession()
          member = childSession.add(member)
          user = childSession.add(user)
          group = childSession.add(group)
          childSession.deleteModel(member)
          expect(user.members.get('length')).to.eq(0)
          expect(group.members.get('length')).to.eq(0)
          expect(user.groups.get('length')).to.eq(1)

          adapter.r['PUT:/groups/2'] = -> groups: {client_id: group.clientId, id: 2, name: "brogrammers", members: [], user: 1}
          childSession.flushIntoParent().then ->
            expect(member.isDeleted).to.be.true
            expect(group.members.get('length')).to.eq(0)
            expect(user.members.get('length')).to.eq(0)
            expect(user.groups.get('length')).to.eq(1)
            expect(adapter.h).to.eql(['POST:/users', 'POST:/groups', 'PUT:/groups/2'])


    it "doesn't choke when loading a group without a members key", ->
      adapter.r['GET:/groups'] = groups: [{client_id: null, id: "1", name: "brogrammers", user: "1"}]

      session.query("group").then (result) ->
        expect(adapter.h).to.eql(['GET:/groups'])
        expect(result.get('length')).to.eq(1)
        expect(result.get('firstObject').name).to.eq("brogrammers")
        expect(result.get('firstObject').groups).to.be.undefined


    it 'adds a member to an existing group', ->
      adapter.r['GET:/groups/1'] = -> groups: {id: 1, name: "employees", members: [{id: 2, name: "kinz", group: 1, user: 3}]}, users: {id: 3, name: "wtf", members: [2], groups: [1]}

      session.load("group", 1).then (group) ->
        expect(adapter.h).to.eql(['GET:/groups/1'])

        childSession = session.newSession()
        childGroup = childSession.add(group)

        existingMember = childGroup.members.get('firstObject')
        expect(existingMember.user).to.not.be.null
        expect(existingMember.user.isDetached).to.be.false

        member = childSession.create('member', {name: "mollie"})
        childGroup.members.addObject(member)

        expect(childGroup.members.get('length')).to.eq(2)
        expect(group.members.get('length')).to.eq(1)

        adapter.r['PUT:/groups/1'] = -> groups: {id: 1, name: "employees", members: [{id: 2, name: "kinz", group: 1}, {id: 3, client_id: member.clientId, name: "mollie", group: 1}]}
        promise = childSession.flushIntoParent().then ->
          expect(childGroup.members.get('length')).to.eq(2)
          expect(group.members.get('length')).to.eq(2)
          expect(adapter.h).to.eql(['GET:/groups/1', 'PUT:/groups/1'])

        expect(group.members.get('length')).to.eq(2)
        promise


  describe "managing comments", ->

    beforeEach ->
      postWithComments.apply(this)


    it 'creates a new comment within a child session', ->
      adapter.r['POST:/comments'] = -> comment: {client_id: comment.clientId, id: "3", message: "#2", post: "1"}

      post = session.merge @Post.create(id: "1", title: "brogrammer's guide to beer pong", comments: [])
      session.merge @Comment.create(id: "2", message: "yo", post: post)

      childSession = session.newSession()
      childPost = childSession.add(post)
      comment = childSession.create 'comment',
        message: '#2',
        post: childPost

      expect(childPost.comments.get('length')).to.eq(2)

      promise = childSession.flushIntoParent().then ->
        expect(childPost.comments.get('length')).to.eq(2)
        expect(post.comments.get('length')).to.eq(2)

      expect(childPost.comments.get('length')).to.eq(2)
      expect(post.comments.get('length')).to.eq(2)
      promise


  describe "two levels of embedded", ->

    beforeEach ->
      `class User extends Model {}`
      User.defineSchema
        typeKey: 'user'
        attributes:
          name: {type: 'string'}
        relationships:
          profile: {kind: 'belongsTo', type: 'profile'}
      @App.User = @User = User

      `class Profile extends Model {}`
      Profile.defineSchema
        typeKey: 'profile'
        attributes:
          bio: {type: 'string'}
        relationships:
          user: {kind: 'belongsTo', type: 'user'}
          tags: {kind: 'hasMany', type: 'tag'}
      @App.Profile = @Profile = Profile

      `class Tag extends Model {}`
      Tag.defineSchema
        typeKey: 'tag'
        attributes:
          name: {type: 'string'}
        relationships:
          profile: {kind: 'belongsTo', type: 'profile'}
      @App.Tag = @Tag = Tag


      @container.register 'model:user', @User
      @container.register 'model:profile', @Profile
      @container.register 'model:tag', @Tag

      UserSerializer = ModelSerializer.extend
        properties:
          profile:
            embedded: 'always'

      @container.register 'serializer:user', UserSerializer

      ProfileSerializer = ModelSerializer.extend
        properties:
          tags:
            embedded: 'always'

      @container.register 'serializer:profile', ProfileSerializer

    it 'deletes root', ->
      adapter.r['DELETE:/users/1'] = {}

      @User.create id: '1'
      user = session.merge @User.create
        id: '1'
        name: 'abby'
        profile: @Profile.create
          id: '2'
          bio: 'asd'
          tags: [@Tag.create(id: '3', name: 'java')]

      session.deleteModel(user)
      session.flush().then ->
        expect(adapter.h).to.eql(['DELETE:/users/1'])
        expect(user.isDeleted).to.be.true

  describe 'multiple belongsTo', ->
    beforeEach ->
      `class Foo extends Model {}`
      Foo.defineSchema
        typeKey: 'foo',
        relationships:
          bar: {kind: 'belongsTo', type: 'bar'}
          baz: {kind: 'belongsTo', type: 'baz'}
      @App.Foo = @Foo = Foo
      
      `class Bar extends Model {}`
      Bar.defineSchema
        typeKey: 'bar'
        relationships:
          foos: {kind: 'hasMany', type: 'foo'}
      @App.Bar = @Bar = Bar
      
      `class Baz extends Model {}`
      Baz.defineSchema
        typeKey: 'baz'
        relationships:
          foos: {kind: 'hasMany', type: 'foo'}
      @App.Baz = @Baz = Baz

      @container.register 'model:foo', @Foo
      @container.register 'model:bar', @Bar
      @container.register 'model:baz', @Baz

    it 'sets ids properly', ->
      adapter.r['POST:/bars'] = -> bar: {client_id: bar.clientId, id: "1"}
      adapter.r['POST:/bazs'] = -> baz: {client_id: baz.clientId, id: "1"}
      adapter.r['POST:/foos'] = (url, type, hash) ->
        expect(hash.data.foo.bar).to.eq 1
        expect(hash.data.foo.baz).to.eq 1
        foo: {client_id: foo.clientId, id: "1", bar: "1", baz: "1"}

      childSession = session.newSession()
      foo = childSession.create 'foo'
      bar = childSession.create 'bar'
      baz = childSession.create 'baz'
      foo.bar = bar
      foo.baz = baz
      childSession.flushIntoParent().then ->
        expect(adapter.h).to.eql ['POST:/bars', 'POST:/bazs', 'POST:/foos']
        expect(foo.id).to.not.be.null
        expect(bar.id).to.not.be.null
        expect(baz.id).to.not.be.null
        expect(foo.bar).to.not.be.null
        expect(foo.baz).to.not.be.null
        expect(bar.foos.get('length')).to.eq 1
        expect(baz.foos.get('length')).to.eq 1


  describe 'deep embedded relationship with leaf referencing a model without an inverse', ->

    beforeEach ->
      `class Template extends Model {}`
      Template.defineSchema
        typeKey: 'template'
        attributes:
          subject: {type: 'string'}
      @App.Template = @Template = Template

      `class Campaign extends Model {}`
      Campaign.defineSchema
        typeKey: 'campaign'
        attributes:
          name: {type: 'string'}
        relationships:
          campaignSteps: {kind: 'hasMany', type: 'campaign_step'}
      @App.Campaign = @Campaign = Campaign

      `class CampaignStep extends Model {}`
      CampaignStep.defineSchema
        typeKey: 'campaign_step'
        relationships:
          campaign: {kind: 'belongsTo', type: 'campaign'}
          campaignTemplates: {kind: 'hasMany', type: 'campaign_template'}
      @App.CampaignStep = @CampaignStep = CampaignStep

      `class CampaignTemplate extends Model {}`
      CampaignTemplate.defineSchema
        typeKey: 'campaign_template'
        relationships:
          campaignStep: {kind: 'belongsTo', type: 'campaign_step'}
          template: {kind: 'belongsTo', type: 'template'}
      @App.CampaignTemplate = @CampaignTemplate = CampaignTemplate

      @container.register 'model:template', @Template
      @container.register 'model:campaign', @Campaign
      @container.register 'model:campaign_template', @CampaignTemplate
      @container.register 'model:campaign_step', @CampaignStep

      CampaignSerializer = ModelSerializer.extend
        properties:
          campaignSteps:
            embedded: 'always'

      CampaignStepSerializer = ModelSerializer.extend
        properties:
          campaignTemplates:
            embedded: 'always'

      @container.register 'serializer:campaign', CampaignSerializer
      @container.register 'serializer:campaign_step', CampaignStepSerializer


    it 'creates new embedded children with reference to new hasMany', ->
      adapter.r['POST:/templates'] = (url, type, hash) ->
        if hash.data.template.client_id == template.clientId
          {templates: {client_id: template.clientId, id: 2, subject: 'topological sort'}}
        else
          {templates: {client_id: template2.clientId, id: 5, subject: 'do you speak it?'}}
      adapter.r['PUT:/campaigns/1'] = (url, type, hash) ->
        expect(hash.data.campaign.campaign_steps[0].campaign_templates[0].template).to.eq(2)
        expect(hash.data.campaign.campaign_steps[1].campaign_templates[0].template).to.eq(5)
        return campaigns:
          id: 1
          client_id: campaign.clientId
          campaign_steps: [
            {
              client_id: campaignStep.clientId
              id: 3
              campaign_templates: [
                {id: 4, client_id: campaignTemplate.clientId, template: 2, campaign_step: 3}
              ]
            },
            {
              client_id: campaignStep2.clientId
              id: 6
              campaign_templates: [
                {id: 7, client_id: campaignTemplate2.clientId, template: 5, campaign_step: 6}
              ]
            }
          ]

      calls = 0
      # Don't have the requests run at the same time
      adapter.runLater = (callback) ->
        calls++
        Ember.run.later callback, calls * 100

      campaign = session.merge @session.build('campaign', id: 1, campaignSteps:[])

      session = session.newSession()
      campaign = session.add campaign

      campaignStep = session.create('campaign_step', campaign: campaign)
      campaignTemplate = session.create 'campaign_template'
      campaignStep.campaignTemplates.pushObject(campaignTemplate)
      template = session.create 'template'
      template.subject = 'topological sort'
      campaignTemplate.template = template

      campaignStep2 = session.create('campaign_step', campaign: campaign)
      campaignTemplate2 = session.create 'campaign_template'
      campaignStep2.campaignTemplates.pushObject(campaignTemplate2)
      template2 = session.create 'template'
      template2.subject = 'do you speak it?'
      campaignTemplate2.template = template2

      session.flush().then ->
        expect(template.id).to.eq("2")
        expect(template.isNew).to.be.false
        expect(template.subject).to.eq('topological sort')
        expect(campaignTemplate.id).to.not.be.null
        expect(campaignTemplate.template).to.eq(template)
        expect(campaignTemplate.campaignStep).to.eq(campaignStep)
        expect(template2.id).to.eq("5")
        expect(template2.isNew).to.be.false
        expect(template2.subject).to.eq('do you speak it?')
        expect(campaignTemplate2.id).to.not.be.null
        expect(campaignTemplate2.template).to.eq(template2)
        expect(campaignTemplate2.campaignStep).to.eq(campaignStep2)
        expect(adapter.h).to.eql(['POST:/templates', 'POST:/templates', 'PUT:/campaigns/1'])


    it 'save changes to parent when children not loaded in child session', ->
      adapter.r['PUT:/campaigns/1'] = (url, type, hash) ->
        hash.data

      campaign = session.merge @session.build 'campaign',
        name: 'old name'
        id: 1
        campaignSteps: []

      step = session.merge @session.build 'campaign_step',
        id: 2
        campaign: campaign
        campaignTemplates: []

      step2 = session.merge @session.build 'campaign_step',
        id: 4
        campaign: campaign
        campaignTemplates: []

      session.merge @session.build 'campaign_template',
        id: 3
        campaignStep: step 

      expect(campaign.campaignSteps.get('firstObject')).to.eq(step)
      session = session.newSession()
      campaign = session.add campaign
      campaign.name = 'new name'

      session.flush().then ->
        expect(campaign.name).to.eq('new name')
        expect(adapter.h).to.eql(['PUT:/campaigns/1'])
