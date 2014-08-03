`import setup from './_shared'`
`import Model from 'epf/model/model'`

describe "ActiveModelAdapter", ->

  adapter = null
  session = null

  beforeEach ->
    setup.apply(this)
    adapter = @adapter
    session = @session
    Ep.__container__ = @container

    `class MessageThread extends Model {}`
    MessageThread.defineSchema
      typeKey: 'message_thread'
      attributes:
        subject: {type: 'string'}
    @App.MessageThread = @MessageThread = MessageThread
    @container.register 'model:message_thread', @MessageThread

  afterEach ->
    delete Ep.__container__

  describe '.pathForType', ->

    it 'underscores and pluralizes', ->
      expect(adapter.pathForType('message_thread')).to.eq('message_threads')
