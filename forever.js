var util = require('util');
var path = require('path');
var events = require('events');
var spawn = require('child_process').spawn;

var Forever = function(file, options) {
  events.EventEmitter.call(this);
  this.times = 0;
  options.options.unshift(file);
  options.silent = options.silent || false;
  options.forever = options.forever || false;
  this.options = options;
}

util.inherits(Forever, events.EventEmitter);

Forever.prototype.run = function() {
  var self = this, child = spawn('node', this.options.options);
  this.child = child;
  child.stdout.on('data', function(data) {
    if (!self.options.silent) {
      process.stdout.write(data);
    }
    self.emit('stdout', null, data);
  });
  child.stderr.on('data', function(data) {
    if (!self.options.silent) {
      process.stderr.write(data)
    }
    self.emit('stderr', null, data);
  });
  child.on('exit', function(code) {
    self.times++;
    if (self.options.forever || self.times < self.options.max) {
      self.emit('restart', null, self);
      process.nextTick(function() {
        self.run();
      });
    } else {
      self.emit('exit', null, self);
    }
  });
};

exports.Forever = Forever;

exports.run = function(file, options) {
  var forever = new Forever(file, options);
  forever.run();
  return forever;
};