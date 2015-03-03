
var after = require('after')
var methods = require('methods')
var Router = require('..')
var utils = require('./support/utils')

var assert = utils.assert
var createServer = utils.createServer
var request = utils.request

describe('Router', function () {
  it('should return a function', function () {
    assert.equal(typeof Router(), 'function')
  })

  it('should return a function using new', function () {
    assert.equal(typeof (new Router()), 'function')
  })

  it('should reject missing callback', function () {
    var router = new Router()
    assert.throws(router.bind(router, {}, {}), /argument callback is required/)
  })

  describe('.all(path, fn)', function () {
    it('should be chainable', function () {
      var router = new Router()
      assert.equal(router.all('/', helloWorld), router)
    })

    it('should respond to all methods', function (done) {
      var cb = after(methods.length, done)
      var router = new Router()
      var server = createServer(router)
      router.all('/', helloWorld)

      methods.forEach(function (method) {
        if (method === 'connect') {
          // CONNECT is tricky and supertest doesn't support it
          return cb()
        }

        var body = method !== 'head'
          ? 'hello, world'
          : ''

        request(server)
        [method]('/')
        .expect(200, body, cb)
      })
    })

    it('should not stack overflow with many registered routes', function (done) {
      var router = new Router()
      var server = createServer(router)

      for (var i = 0; i < 6000; i++) {
        router.get('/thing' + i, helloWorld)
      }

      router.get('/', helloWorld)

      request(server)
      .get('/')
      .expect(200, 'hello, world', done)
    })

    describe('with "caseSensitive" option', function () {
      it('should not match paths case-sensitively by default', function (done) {
        var cb = after(3, done)
        var router = new Router()
        var server = createServer(router)

        router.all('/foo/bar', saw)

        request(server)
        .get('/foo/bar')
        .expect(200, 'saw GET /foo/bar', cb)

        request(server)
        .get('/FOO/bar')
        .expect(200, 'saw GET /FOO/bar', cb)

        request(server)
        .get('/FOO/BAR')
        .expect(200, 'saw GET /FOO/BAR', cb)
      })

      it('should not match paths case-sensitively when false', function (done) {
        var cb = after(3, done)
        var router = new Router({ caseSensitive: false })
        var server = createServer(router)

        router.all('/foo/bar', saw)

        request(server)
        .get('/foo/bar')
        .expect(200, 'saw GET /foo/bar', cb)

        request(server)
        .get('/FOO/bar')
        .expect(200, 'saw GET /FOO/bar', cb)

        request(server)
        .get('/FOO/BAR')
        .expect(200, 'saw GET /FOO/BAR', cb)
      })

      it('should match paths case-sensitively when true', function (done) {
        var cb = after(3, done)
        var router = new Router({ caseSensitive: true })
        var server = createServer(router)

        router.all('/foo/bar', saw)

        request(server)
        .get('/foo/bar')
        .expect(200, 'saw GET /foo/bar', cb)

        request(server)
        .get('/FOO/bar')
        .expect(404, 'Cannot GET /FOO/bar\n', cb)

        request(server)
        .get('/FOO/BAR')
        .expect(404, 'Cannot GET /FOO/BAR\n', cb)
      })
    })

    describe('with "strict" option', function () {
      it('should accept optional trailing slashes by default', function (done) {
        var cb = after(2, done)
        var router = new Router()
        var server = createServer(router)

        router.all('/foo', saw)

        request(server)
        .get('/foo')
        .expect(200, 'saw GET /foo', cb)

        request(server)
        .get('/foo/')
        .expect(200, 'saw GET /foo/', cb)
      })

      it('should accept optional trailing slashes when false', function (done) {
        var cb = after(2, done)
        var router = new Router({ strict: false })
        var server = createServer(router)

        router.all('/foo', saw)

        request(server)
        .get('/foo')
        .expect(200, 'saw GET /foo', cb)

        request(server)
        .get('/foo/')
        .expect(200, 'saw GET /foo/', cb)
      })

      it('should not accept optional trailing slashes when true', function (done) {
        var cb = after(2, done)
        var router = new Router({ strict: true })
        var server = createServer(router)

        router.all('/foo', saw)

        request(server)
        .get('/foo')
        .expect(200, 'saw GET /foo', cb)

        request(server)
        .get('/foo/')
        .expect(404, 'Cannot GET /foo/\n', cb)
      })
    })
  })

  methods.slice().sort().forEach(function (method) {
    if (method === 'connect') {
      // CONNECT is tricky and supertest doesn't support it
      return
    }

    var body = method !== 'head'
      ? 'hello, world'
      : ''

    describe('.' + method + '(path, ...fn)', function () {
      it('should be chainable', function () {
        var router = new Router()
        assert.equal(router[method]('/', helloWorld), router)
      })

      it('should respond to a ' + method.toUpperCase() + ' request', function (done) {
        var router = new Router()
        var server = createServer(router)

        router[method]('/', helloWorld)

        request(server)
        [method]('/')
        .expect(200, body, done)
      })

      it('should reject invalid fn', function () {
        var router = new Router()
        assert.throws(router[method].bind(router, '/', 2), /argument handler must be a function/)
      })

      it('should accept multiple arguments', function (done) {
        var router = new Router()
        var server = createServer(router)

        router[method]('/', sethit(1), sethit(2), helloWorld)

        request(server)
        [method]('/')
        .expect('x-fn-1', 'hit')
        .expect('x-fn-2', 'hit')
        .expect(200, body, done)
      })

      describe('req.baseUrl', function () {
        it('should be empty', function (done) {
          var router = new Router()
          var server = createServer(router)

          router[method]('/foo', function handle(req, res) {
            res.setHeader('x-url-base', JSON.stringify(req.baseUrl))
            res.end()
          })

          request(server)
          [method]('/foo')
          .expect('x-url-base', '""')
          .expect(200, done)
        })
      })

      describe('req.route', function () {
        it('should be a Route', function (done) {
          var router = new Router()
          var server = createServer(router)

          router[method]('/foo', function handle(req, res) {
            res.setHeader('x-is-route', String(req.route instanceof Router.Route))
            res.end()
          })

          request(server)
          [method]('/foo')
          .expect('x-is-route', 'true')
          .expect(200, done)
        })

        it('should be the matched route', function (done) {
          var router = new Router()
          var server = createServer(router)

          router[method]('/foo', function handle(req, res) {
            res.setHeader('x-is-route', String(req.route.path === '/foo'))
            res.end()
          })

          request(server)
          [method]('/foo')
          .expect('x-is-route', 'true')
          .expect(200, done)
        })
      })
    })
  })

  describe('.use(...fn)', function () {
    it('should reject missing functions', function () {
      var router = new Router()
      assert.throws(router.use.bind(router), /argument handler is required/)
    })

    it('should reject empty array', function () {
      var router = new Router()
      assert.throws(router.use.bind(router, []), /argument handler is required/)
    })

    it('should reject non-functions', function () {
      var router = new Router()
      assert.throws(router.use.bind(router, '/', 'hello'), /argument handler must be a function/)
      assert.throws(router.use.bind(router, '/', 5), /argument handler must be a function/)
      assert.throws(router.use.bind(router, '/', null), /argument handler must be a function/)
      assert.throws(router.use.bind(router, '/', new Date()), /argument handler must be a function/)
    })

    it('should be chainable', function () {
      var router = new Router()
      assert.equal(router.use(helloWorld), router)
    })

    it('should invoke function for all requests', function (done) {
      var cb = after(3, done)
      var router = new Router()
      var server = createServer(router)

      router.use(saw)

      request(server)
      .get('/')
      .expect(200, 'saw GET /', cb)

      request(server)
      .options('/')
      .expect(200, 'saw OPTIONS /', cb)

      request(server)
      .post('/foo')
      .expect(200, 'saw POST /foo', cb)
    })

    it('should not invoke for blank URLs', function (done) {
      var router = new Router()
      var server = createServer(function hander(req, res, next) {
        req.url = ''
        router(req, res, next)
      })

      router.use(saw)

      request(server)
      .get('/')
      .expect(404, done)
    })

    it('should support another router', function (done) {
      var inner = new Router()
      var router = new Router()
      var server = createServer(router)

      inner.use(saw)
      router.use(inner)

      request(server)
      .get('/')
      .expect(200, 'saw GET /', done)
    })

    it('should accept multiple arguments', function (done) {
      var router = new Router()
      var server = createServer(router)

      router.use(sethit(1), sethit(2), helloWorld)

      request(server)
      .get('/')
      .expect('x-fn-1', 'hit')
      .expect('x-fn-2', 'hit')
      .expect(200, 'hello, world', done)
    })

    it('should accept single array of middleware', function (done) {
      var router = new Router()
      var server = createServer(router)

      router.use([sethit(1), sethit(2), helloWorld])

      request(server)
      .get('/')
      .expect('x-fn-1', 'hit')
      .expect('x-fn-2', 'hit')
      .expect(200, 'hello, world', done)
    })

    it('should accept nested arrays of middleware', function (done) {
      var router = new Router()
      var server = createServer(router)

      router.use([[sethit(1), sethit(2)], sethit(3)], helloWorld)

      request(server)
      .get('/')
      .expect('x-fn-1', 'hit')
      .expect('x-fn-2', 'hit')
      .expect('x-fn-3', 'hit')
      .expect(200, 'hello, world', done)
    })

    describe('req.baseUrl', function () {
      it('should be empty', function (done) {
        var router = new Router()
        var server = createServer(router)

        router.use(sawBase)

        request(server)
        .get('/foo/bar')
        .expect(200, 'saw ', done)
      })
    })
  })

  describe('.use(path, ...fn)', function () {
    it('should be chainable', function () {
      var router = new Router()
      assert.equal(router.use('/', helloWorld), router)
    })

    it('should invoke when req.url starts with path', function (done) {
      var cb = after(3, done)
      var router = new Router()
      var server = createServer(router)

      router.use('/foo', saw)

      request(server)
      .get('/')
      .expect(404, cb)

      request(server)
      .post('/foo')
      .expect(200, 'saw POST /', cb)

      request(server)
      .post('/foo/bar')
      .expect(200, 'saw POST /bar', cb)
    })

    it('should match if path has trailing slash', function (done) {
      var cb = after(3, done)
      var router = new Router()
      var server = createServer(router)

      router.use('/foo/', saw)

      request(server)
      .get('/')
      .expect(404, cb)

      request(server)
      .post('/foo')
      .expect(200, 'saw POST /', cb)

      request(server)
      .post('/foo/bar')
      .expect(200, 'saw POST /bar', cb)
    })

    it('should support array of paths', function (done) {
      var cb = after(3, done)
      var router = new Router()
      var server = createServer(router)

      router.use(['/foo/', '/bar'], saw)

      request(server)
      .get('/')
      .expect(404, cb)

      request(server)
      .get('/foo')
      .expect(200, 'saw GET /', cb)

      request(server)
      .get('/bar')
      .expect(200, 'saw GET /', cb)
    })

    it('should support regexp path', function (done) {
      var cb = after(4, done)
      var router = new Router()
      var server = createServer(router)

      router.use(/^\/[a-z]oo/, saw)

      request(server)
      .get('/')
      .expect(404, cb)

      request(server)
      .get('/foo')
      .expect(200, 'saw GET /', cb)

      request(server)
      .get('/zoo/bear')
      .expect(200, 'saw GET /bear', cb)

      request(server)
      .get('/get/zoo')
      .expect(404, cb)
    })

    it('should accept multiple arguments', function (done) {
      var router = new Router()
      var server = createServer(router)

      router.use('/foo', sethit(1), sethit(2), helloWorld)

      request(server)
      .get('/foo')
      .expect('x-fn-1', 'hit')
      .expect('x-fn-2', 'hit')
      .expect(200, 'hello, world', done)
    })

    describe('with "caseSensitive" option', function () {
      it('should not match paths case-sensitively by default', function (done) {
        var cb = after(3, done)
        var router = new Router()
        var server = createServer(router)

        router.use('/foo', saw)

        request(server)
        .get('/foo/bar')
        .expect(200, 'saw GET /bar', cb)

        request(server)
        .get('/FOO/bar')
        .expect(200, 'saw GET /bar', cb)

        request(server)
        .get('/FOO/BAR')
        .expect(200, 'saw GET /BAR', cb)
      })

      it('should not match paths case-sensitively when false', function (done) {
        var cb = after(3, done)
        var router = new Router({ caseSensitive: false })
        var server = createServer(router)

        router.use('/foo', saw)

        request(server)
        .get('/foo/bar')
        .expect(200, 'saw GET /bar', cb)

        request(server)
        .get('/FOO/bar')
        .expect(200, 'saw GET /bar', cb)

        request(server)
        .get('/FOO/BAR')
        .expect(200, 'saw GET /BAR', cb)
      })

      it('should match paths case-sensitively when true', function (done) {
        var cb = after(3, done)
        var router = new Router({ caseSensitive: true })
        var server = createServer(router)

        router.use('/foo', saw)

        request(server)
        .get('/foo/bar')
        .expect(200, 'saw GET /bar', cb)

        request(server)
        .get('/FOO/bar')
        .expect(404, 'Cannot GET /FOO/bar\n', cb)

        request(server)
        .get('/FOO/BAR')
        .expect(404, 'Cannot GET /FOO/BAR\n', cb)
      })
    })

    describe('with "strict" option', function () {
      it('should accept optional trailing slashes by default', function (done) {
        var cb = after(2, done)
        var router = new Router()
        var server = createServer(router)

        router.use('/foo', saw)

        request(server)
        .get('/foo')
        .expect(200, 'saw GET /', cb)

        request(server)
        .get('/foo/')
        .expect(200, 'saw GET /', cb)
      })

      it('should accept optional trailing slashes when false', function (done) {
        var cb = after(2, done)
        var router = new Router({ strict: false })
        var server = createServer(router)

        router.use('/foo', saw)

        request(server)
        .get('/foo')
        .expect(200, 'saw GET /', cb)

        request(server)
        .get('/foo/')
        .expect(200, 'saw GET /', cb)
      })

      it('should accept optional trailing slashes when true', function (done) {
        var cb = after(2, done)
        var router = new Router({ strict: true })
        var server = createServer(router)

        router.use('/foo', saw)

        request(server)
        .get('/foo')
        .expect(200, 'saw GET /', cb)

        request(server)
        .get('/foo/')
        .expect(200, 'saw GET /', cb)
      })
    })

    describe('req.baseUrl', function () {
      it('should contain the stripped path', function (done) {
        var router = new Router()
        var server = createServer(router)

        router.use('/foo', sawBase)

        request(server)
        .get('/foo/bar')
        .expect(200, 'saw /foo', done)
      })

      it('should contain the stripped path for multiple levels', function (done) {
        var router1 = new Router()
        var router2 = new Router()
        var server = createServer(router1)

        router1.use('/foo', router2)
        router2.use('/bar', sawBase)

        request(server)
        .get('/foo/bar/baz')
        .expect(200, 'saw /foo/bar', done)
      })

      it('should be altered correctly', function(done){
        var router = new Router()
        var server = createServer(router)
        var sub1 = new Router()
        var sub2 = new Router()
        var sub3 = new Router()

        sub3.get('/zed', setsawBase(1))

        sub2.use('/baz', sub3)

        sub1.use('/', setsawBase(2))

        sub1.use('/bar', sub2)
        sub1.use('/bar', setsawBase(3))

        router.use(setsawBase(4))
        router.use('/foo', sub1)
        router.use(setsawBase(5))
        router.use(helloWorld)

        request(server)
        .get('/foo/bar/baz/zed')
        .expect('x-saw-base-1', '/foo/bar/baz')
        .expect('x-saw-base-2', '/foo')
        .expect('x-saw-base-3', '/foo/bar')
        .expect('x-saw-base-4', '')
        .expect('x-saw-base-5', '')
        .expect(200, done)
      })
    })

    describe('req.url', function () {
      it('should strip path from req.url', function (done) {
        var router = new Router()
        var server = createServer(router)

        router.use('/foo', saw)

        request(server)
        .get('/foo/bar')
        .expect(200, 'saw GET /bar', done)
      })

      it('should restore req.url after stripping', function (done) {
        var router = new Router()
        var server = createServer(router)

        router.use('/foo', setsaw(1))
        router.use(saw)

        request(server)
        .get('/foo/bar')
        .expect('x-saw-1', 'GET /bar')
        .expect(200, 'saw GET /foo/bar', done)
      })

      it('should strip/restore with trailing stash', function (done) {
        var router = new Router()
        var server = createServer(router)

        router.use('/foo', setsaw(1))
        router.use(saw)

        request(server)
        .get('/foo/')
        .expect('x-saw-1', 'GET /')
        .expect(200, 'saw GET /foo/', done)
      })
    })
  })

  describe('unicode', function () {
    it('should normalize paths', function (done) {
      var router = new Router()
      var server = createServer(router)

      router.get('/caf\u00E9', helloWorld)

      request(server)
        .get(encodeURI('/cafe\u0301'))
        .expect(200, 'hello, world', done)
    })
  })
})

function helloWorld(req, res) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/plain')
  res.end('hello, world')
}

function sethit(num) {
  var name = 'x-fn-' + String(num)
  return function hit(req, res, next) {
    res.setHeader(name, 'hit')
    next()
  }
}

function setsaw(num) {
  var name = 'x-saw-' + String(num)
  return function saw(req, res, next) {
    res.setHeader(name, req.method + ' ' + req.url)
    next()
  }
}

function setsawBase(num) {
  var name = 'x-saw-base-' + String(num)
  return function sawBase(req, res, next) {
    res.setHeader(name, String(req.baseUrl))
    next()
  }
}

function saw(req, res) {
  var msg = 'saw ' + req.method + ' ' + req.url
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/plain')
  res.end(msg)
}

function sawBase(req, res) {
  var msg = 'saw ' + req.baseUrl
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/plain')
  res.end(msg)
}
