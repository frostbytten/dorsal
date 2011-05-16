var http     = require('http'),
    host     = "api.grooveshark.com",
    path     = "/ws/2.1/",
    options  = {
        host : host,
        port: 80,
        method: 'POST',
        path : path,
        headers: {
            'Content-Type' : 'application/json',
        }
    },
    EventEmitter = require('events').EventEmitter,
    beacon = new EventEmitter;

function GSAPI(key,secret) {
    var self = this;
    this.startSession = function(callback) {
		var delta = (new Date)
		if( this.sid === undefined ||( new Date().getTime() - this.sidTime) > this.timeout ) {
	        var sig  = require('crypto').createHmac('md5', secret).update(this.key).digest('hex'),
	            body = JSON.stringify({'method': 'startSession', 'sig': sig, 'wsKey': key});
	        this.rawCall(body, function(err, data) {
				if( ! err ) {
					self.sid = data;
					self.sidTime = new Date().getTime();
				}
				callback(err, data );
			});
		} else {
			callback(null, this.sid);
		}
    };
    
    this.getTopSong = function(sid, artist, callback) {
        var body = JSON.stringify({'method': 'getSongSearchResultsEx', 'wsKey': this.key, 'sessionID': sid, 'query': artist, limit: 1});
        this.rawCall(body, callback);
    }
    
    this.getSimilarSong = function(sid, artistids, songids, callback ) {
        var body = JSON.stringify({'method':'startAutoplay', 'wsKey': this.key, 'sessionID':sid, 'artistIDs': artistids, 'songIDs':songids, limit:3});
        this.rawCall(body, function( err, data ) {
            callback(err, data);                        
        });
    };

	this.getGenreSong = function( sid, genreid, callback ) {
		var body = JSON.stringify({'method': 'startAutoplayTag', 'wsKey': this.key, 'sessionID': sid, 'tagID': genreid} );
		this.rawCall(body, function( err, data) {
			callback(err, data);
		});
	};
	
	this.getNextRadioSong = function( sid, radio, callback ) {
		var body = JSON.stringify({'method': 'getAutoplaySong', 'wsKey': this.key, 'sessionID': sid, 'autoplayState': radio} );
		this.rawCall(body, function( err, newRadio ) {
			self.addSongToRadio( sid, radio, newRadio.nextSong, function( err, data ) {
				newRadio.autoplayState = data;
				callback( err, newRadio );	
			});
		});
	};
    
	// Returns autoplayState
	this.addSongToRadio   = function( sid, radio, song, callback ) {
		var body = JSON.stringify({'method': 'addSongToAutoplay', 'wsKey': this.key, 'sessionID': sid, 'autoplayState': radio, 'song': song } );
		this.rawCall(body, callback);
	};
	
	this.searchSongs = function(sid, query, options, callback ) {
		options = options || {};
		var limit = options.limit || 3;
		var body = JSON.stringify({'method':'getSongSearchResultsEx', 'wsKey': this.key, 'sessionID':sid, 'query':query, 'limit': limit});
		this.rawCall(body, callback);
	}
	
    this.searchArtists = function(sid, artist, options, callback) {
        options = options || {};
        var limit = options.limit || 1;
        var body = JSON.stringify({'method':'getArtistSearchResults', 'wsKey': this.key, 'sessionID': sid, 'query': artist, limit: limit});
        this.rawCall(body, callback);
    };
    
    this.searchMultiArtists = function( sid, artists, options, callback ) {
        options = options||{};
        var limit = options.limit || 1,
            capture = options.capture || 'ArtistID',
            results = [],
            counter = c = artists.length,
            body;
        beacon.on('complete', function(data){
            callback(null, data);
        });
        for( var i=0; i < c; i++) {
            body = JSON.stringify({'method':'getArtistSearchResults', 'wsKey': this.key, 'sessionID': sid, 'query': artists[i], limit: limit});
            this.rawCall(body, function( err, data ) {
               if( err ) throw new Error( err );
               if (data.artists.length > 0) {
                   results.push(data.artists[0][capture]);
               }
               if( 0 === --counter ) {
                   beacon.emit('complete', results);
               }
            });
        }
    };
 
    this.rawCall = function( json, callback ){
		//console.log('SEND: '+json);
        if(typeof callback  !== 'function') {
            throw new Error('no!');
        }
        options.headers['Content-Length'] = json.length;
        var req = new http.request(options, function(res){
            var raw='', data;
            res.on('data', function(chunk) {
                raw += chunk;
            });
            res.on('end', function() {
				//console.log('SEND:'+json);
				//console.log('RECV: '+raw);
				try {
	                data = JSON.parse(raw);
	                if(data.errors === undefined) {
	                    if(data.result.sessionID === undefined ) {
	                        callback(null, data.result);
	                    } else {
	                        callback(null, data.result.sessionID);
	                    }
	                } else {
	                    callback(data.err, null);
	                }
				} catch(e) {
					console.log(e);
					callback(raw, null);
				}
            });
        });
        req.write(json+'\n');
        req.end();
    };
    this.key = key;
	this.sid = undefined;
	this.timeout = 7200000; // 2 hours... we'll test it.
	this.sidTime = undefined;
    return this;
}

exports.init = function( key, secret ) {
    return new GSAPI(key, secret);
}