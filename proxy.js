var util = require('util');
var argv = require('./optimist').argv;
var forever = require('./forever');
var help = [
  "usage: proxy [options]",
  "",
  "options:",
  " -p port       Specified socks port number",
  " -l address    Specified socks address listen",
  " -h, --help    You're staring at it"
].join('\n');

if (argv.h || argv.help) {
  util.puts(help);
  process.exit(0);
}

var options = {
  forever: true,
//  max: 1,
  options: []
};

Object.keys(argv).forEach(function(key) {
  if (key !== '_') {
    options.options.push('-' + key);
    options.options.push(argv[key]);
  }
});

//util.puts(options.options.join(' '));
forever.run('client.js', options);