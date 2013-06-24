describe 'Ep.Errors', ->

  describe 'forEach', ->

    it 'should iterate over field errors', ->
      errors = Ep.Errors.create(content: {title: ['is too short']})
      count = 0
      errors.forEach (key, fieldErrors) ->
        expect(key).to.eq('title')
        expect(fieldErrors).to.eql(['is too short'])
        count++
      expect(count).to.eq(1)

    it 'should not error if no content specified', ->
      errors = Ep.Errors.create()
      count = 0
      errors.forEach (key, errors) ->
        count++
      expect(count).to.eq(0)
