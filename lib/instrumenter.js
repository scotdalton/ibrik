(function() {
  var Instrumenter, StructuredCode, coffee, escodegen, esprima, estraverse, fs, istanbul, path, _,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  coffee = require('coffee-script');

  istanbul = require('istanbul');

  escodegen = require('escodegen');

  estraverse = require('estraverse');

  _ = require('lodash');

  esprima = require('esprima');

  path = require('path');

  fs = require('fs');

  StructuredCode = (function() {
    function StructuredCode(code) {
      this.cursors = this.generateOffsets(code);
      this.length = this.cursors.length;
    }

    StructuredCode.prototype.generateOffsets = function(code) {
      var cursor, reg, res, result;
      reg = /(?:\r\n|[\r\n\u2028\u2029])/g;
      result = [0];
      while (res = reg.exec(code)) {
        cursor = res.index + res[0].length;
        reg.lastIndex = cursor;
        result.push(cursor);
      }
      return result;
    };

    StructuredCode.prototype.column = function(offset) {
      return this.loc(offset).column;
    };

    StructuredCode.prototype.line = function(offset) {
      return this.loc(offset).line;
    };

    StructuredCode.prototype.loc = function(offset) {
      var column, index, line;
      index = _.sortedIndex(this.cursors, offset);
      if (this.cursors.length > index && this.cursors[index] === offset) {
        column = 0;
        line = index + 1;
      } else {
        column = offset - this.cursors[index - 1];
        line = index;
      }
      return {
        column: column,
        line: line
      };
    };

    return StructuredCode;

  })();

  Instrumenter = (function(_super) {
    __extends(Instrumenter, _super);

    function Instrumenter(opt) {
      istanbul.Instrumenter.call(this, opt);
    }

    Instrumenter.prototype.instrumentSync = function(code, filename) {
      var e, program;
      filename = filename || ("" + (Date.now()) + ".js");
      if (typeof code !== 'string') {
        throw new Error('Code must be string');
      }
      try {
        code = coffee.compile(code, {
          sourceMap: true
        });
        program = esprima.parse(code.js, {
          loc: true
        });
        this.fixupLoc(program, code.sourceMap);
        return this.instrumentASTSync(program, filename, code);
      } catch (_error) {
        e = _error;
        e.message = "Error compiling " + filename + ": " + e.message;
        throw e;
      }
    };

    Instrumenter.prototype.include = function(filename) {
      var code;
      filename = path.resolve(filename);
      code = fs.readFileSync(filename, 'utf8');
      this.instrumentSync(code, filename);
      eval("" + (this.getPreamble(null)));
    };

    Instrumenter.prototype.fixupLoc = function(program, sourceMap) {
      var notFound, structured;
      notFound = {
        start: {
          line: 0,
          column: 0
        },
        end: {
          line: 0,
          column: 0
        }
      };
      structured = new StructuredCode(program.raw);
      return estraverse.traverse(program, {
        leave: function(node, parent) {
          var mappedLocation, _ref, _ref1;
          mappedLocation = function(location) {
            var column, line, locArray;
            locArray = sourceMap.sourceLocation([location.line - 1, location.column]);
            line = 0;
            column = 0;
            if (locArray) {
              line = locArray[0] + 1;
              column = locArray[1];
            }
            return {
              line: line,
              column: column
            };
          };
          if ((_ref = node.loc) != null ? _ref.start : void 0) {
            node.loc.start = mappedLocation(node.loc.start);
          }
          if ((_ref1 = node.loc) != null ? _ref1.end : void 0) {
            node.loc.end = mappedLocation(node.loc.end);
          }
        }
      });
    };

    return Instrumenter;

  })(istanbul.Instrumenter);

  module.exports = Instrumenter;

}).call(this);
