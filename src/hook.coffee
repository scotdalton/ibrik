#  Copyright (C) 2014 Yusuke Suzuki <utatane.tea@gmail.com>
#
#  Redistribution and use in source and binary forms, with or without
#  modification, are permitted provided that the following conditions are met:
#
#    * Redistributions of source code must retain the above copyright
#      notice, this list of conditions and the following disclaimer.
#    * Redistributions in binary form must reproduce the above copyright
#      notice, this list of conditions and the following disclaimer in the
#      documentation and/or other materials provided with the distribution.
#
#  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
#  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
#  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
#  ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
#  DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
#  (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
#  LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
#  ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
#  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
#  THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

fs = require 'fs'
Module = require 'module'
istanbul = require 'istanbul'
coffee = require 'coffee-script'

# register loader for coffee-script-redux
do coffee.register
originalLoader = require.extensions['.coffee']
originalJSLoader = null

hook = Object.create istanbul.hook

transformFn = (matcher, transformer, verbose) ->
    (code, filename) ->
        shouldHook = matcher filename
        changed = no

        if shouldHook
            console.error "Module load hook: transform [#{filename}]" if verbose
            try
                transformed = transformer code, filename
                changed = yes
            catch ex
                console.error 'Transformation error; return original code'
                console.error ex.stack
                console.error ex
                console.error ex.stack
                transformed = code
        else
            transformed = code

        {code: transformed, changed}

hook.hookRequire = (matcher, transformer, options = {}) ->
    fn = transformFn matcher, transformer, options.verbose
    postLoadHook = null
    if options.postLoadHook and typeof options.postLoadHook is 'function'
        postLoadHook = options.postLoadHook

    require.extensions['.coffee'] = (module, filename) ->
        ret = fn (fs.readFileSync filename, 'utf8'), filename
        if ret.changed
            module._compile ret.code, filename
        else
            originalLoader module, filename
        postLoadHook filename if postLoadHook

    istanbul.hook.hookRequire matcher, transformer, options

    originalJSLoader = require.extensions['.js']
    require.extensions['.js'] = (module, filename) ->
        # When we're testing code that calls require('coffee-script'),
        # our loader for .coffee is trounced.  I'm not happy about this, but
        # suppress re-loading coffee-script here
        if not endsWith(filename, 'coffee-script.js')
          originalJSLoader module, filename
        return

hook.unhookRequire = ->
    if originalJSLoader
      require.extensions['.js'] = originalJSLoader
      originalJSLoader = null
    do istanbul.hook.unhookRequire
    require.extensions['.coffee'] = originalLoader

endsWith = (string, endString) ->
  return false if string.length < endString.length
  return string.substr(string.length - endString.length) is endString
      
module.exports = hook
# vim: set sw=4 ts=4 et tw=80 :
