`import Errors from 'coalesce/model/errors'`

describe 'Errors', ->

  describe 'forEach', ->

    it 'should iterate over field errors', ->
      errors = new Errors title: ['is too short']
      count = 0
      errors.forEach (fieldErrors, key) ->
        expect(key).to.eq('title')
        expect(fieldErrors).to.eql(['is too short'])
        count++
      expect(count).to.eq(1)

    it 'should not error if no content specified', ->
      errors = new Errors()
      count = 0
      errors.forEach (key, errors) ->
        count++
      expect(count).to.eq(0)
