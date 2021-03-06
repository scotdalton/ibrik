(function() {
  var DEFAULT_REPORT_FORMAT, Module, existsSync, fileset, fs, ibrik, istanbul, mkdirp, path, which,
    __slice = [].slice;

  Module = require('module');

  fs = require('fs');

  path = require('path');

  ibrik = require('./ibrik');

  istanbul = require('istanbul');

  mkdirp = require('mkdirp');

  which = require('which');

  fileset = require('fileset');

  existsSync = fs.existsSync || path.existsSync;

  DEFAULT_REPORT_FORMAT = 'lcov';

  module.exports = function(opts, callback) {
    var args, cmd, e, excludes, file, reportClassName, reportingDir, reports, runFn, _ref;
    _ref = opts._, cmd = _ref[0], file = _ref[1], args = 3 <= _ref.length ? __slice.call(_ref, 2) : [];
    if (!file) {
      return callback("Need a filename argument for the " + cmd + " command!");
    }
    if (!existsSync(file)) {
      try {
        file = which.sync(file);
      } catch (_error) {
        e = _error;
        return callback("Unable to resolve file [" + file + "]");
      }
    } else {
      file = path.resolve(file);
    }
    excludes = [];
    if ((opts['default-excludes'] == null) || opts['default-excludes']) {
      excludes = ['**/node_modules/**', '**/test/**', '**/tests/**'];
    }
    reportingDir = '' + (opts.dir || path.resolve(process.cwd(), 'coverage'));
    mkdirp.sync(reportingDir);
    reportClassName = opts.report || DEFAULT_REPORT_FORMAT;
    reports = [
      istanbul.Report.create(reportClassName, {
        dir: reportingDir
      })
    ];
    runFn = function() {
      process.argv = ['node', file].concat(__slice.call(args));
      if (opts.verbose) {
        console.log("Running: " + (process.argv.join(' ')));
      }
      process.env.running_under_istanbul = 1;
      return Module.runMain(file, null, true);
    };
    if (opts.print !== 'none') {
      switch (opts.print) {
        case 'detail':
          reports.push(istanbul.Report.create('text'));
          break;
        case 'both':
          reports.push(istanbul.Report.create('text'));
          reports.push(istanbul.Report.create('text-summary'));
          break;
        default:
          reports.push(istanbul.Report.create('text-summary'));
      }
    }
    return istanbul.matcherFor({
      root: opts.root || process.cwd(),
      includes: ['**/*.coffee'],
      excludes: excludes
    }, function(err, matchFn) {
      var coverageVar, hookOpts, instrumenter, transformer, _ref1;
      if (err) {
        return callback(err, null);
      }
      coverageVar = "$$cov_" + (Date.now()) + "$$";
      instrumenter = new ibrik.Instrumenter({
        coverageVariable: coverageVar
      });
      transformer = instrumenter.instrumentSync.bind(instrumenter);
      hookOpts = {
        verbose: opts.verbose
      };
      if (opts['self-test']) {
        ibrik.hook.unloadRequireCache(matchFn);
      }
      ibrik.hook.hookRequire(matchFn, transformer, hookOpts);
      process.once('exit', function() {
        var collector, cov, report, _i, _len;
        file = path.resolve(reportingDir, 'coverage.json');
        if (global[coverageVar] == null) {
          return callback('No coverage information was collected, exit without writing coverage information', null);
        } else {
          cov = global[coverageVar];
        }
        mkdirp.sync(reportingDir);
        console.log('=============================================================================');
        console.log("Writing coverage object [" + file + "]");
        if (!opts.headless) {
          fs.writeFileSync(file, JSON.stringify(cov), 'utf8');
        }
        collector = new istanbul.Collector;
        collector.add(cov);
        console.log("Writing coverage reports at [" + reportingDir + "]");
        console.log('=============================================================================');
        for (_i = 0, _len = reports.length; _i < _len; _i++) {
          report = reports[_i];
          report.writeReport(collector, true);
        }
        return callback(null, cov);
      });
      if (opts != null ? (_ref1 = opts.files) != null ? _ref1.include : void 0 : void 0) {
        if (typeof opts.files.include === 'string') {
          opts.files.include = [opts.files.include];
        }
        return fileset(opts.files.include.join(' '), excludes.join(' '), function(err, files) {
          var filename, _i, _len;
          if (err) {
            return console.error('Error including files: ', err);
          } else {
            for (_i = 0, _len = files.length; _i < _len; _i++) {
              filename = files[_i];
              instrumenter.include(filename);
            }
            return runFn();
          }
        });
      } else {
        return runFn();
      }
    });
  };

}).call(this);
