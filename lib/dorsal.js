var http     = require('http'),
    host     = "api.grooveshark.com",
    path     = "/ws/2.1/",
    options  = {
        host : host,
        port: 80,
        method: 'POST',
        path : path,
        headers: {
            'Content-Type' : 'application/json; charset=UTF-8"',
        }
    },
	winston = require('winston'),
    EventEmitter = require('events').EventEmitter,
    beacon = new EventEmitter;

function GSAPI(key, secret, username, hmac) {
    var self = this;
	this.username = username;
	this.hmac = hmac;
//	winston.add(winston.transports.File, { filename: './dorsal.log' });
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
        var body;
		try {
	 		body = JSON.stringify({'method': 'getSongSearchResultsEx', 'wsKey': this.key, 'sessionID': sid, 'query': artist, limit: 1});
		} catch(e) {
			artist.replace(/[^\w\s]/g, '');
			body = JSON.stringify({'method': 'getSongSearchResultsEx', 'wsKey': this.key, 'sessionID': sid, 'query': artist, limit: 1});
		}
        this.rawCall(body, callback);
    }
    
    this.getSimilarSong = function(sid, artistids, songids, callback ) {
        var body = JSON.stringify({'method':'startAutoplay', 'wsKey': this.key, 'sessionID':sid, 'artistIDs': artistids, 'songIDs':songids, limit:3});
        this.rawCall(body, function( err, data ) {
            callback(err, data);                        
        });
    };

	this.authenticate = function( sid, callback ) {
		var body = JSON.stringify({'method':'authenticateUser', 'wsKey': this.key, 'sessionID':sid, 'username': this.username, 'token':this.hmac});
        this.rawCall(body, function(err, data){
			callback(err, data)
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
			if( err === null ) {
				self.addSongToRadio( sid, radio, newRadio.nextSong, function( err, data ) {
					newRadio.autoplayState = data;
					callback( err, newRadio );	
				});
			} else {
				winston.log( err );
				throw new Error( err[0].message );
			}
		});
	};
    
	// Returns autoplayState
	this.addSongToRadio   = function( sid, radio, song, callback ) {
		winston.log('info', 'Radio:',radio);
		winston.log('info', 'Song', song);
		var cleanSong = {SongID: song.SongID, AlbumID: song.AlbumID, ArtistID: song.ArtistID}
		var body = JSON.stringify({'method': 'addSongToAutoplay', 'wsKey': this.key, 'sessionID': sid, 'autoplayState': radio, 'song': cleanSong });
		this.rawCall(body, function( err, data ) {
			if( err == null ) {
				callback(null, data);
			} else {
				winston.log('info', 'addSongToRadio::ERROR::', err);
				callback(err, null);
			}
		});
	};
	
	this.addCustomSongToRadio = function( sid, radio, song, callback ) {
		var cleanSong = {SongID: song.SongID, AlbumID: song.AlbumID, ArtistID: song.ArtistID}
		var body = JSON.stringify({'method': 'addSongToAutoplay', 'wsKey': this.key, 'sessionID': sid, 'autoplayState': radio, 'song': cleanSong });
		this.rawCall(body, function( err, data ) {
			callback(err, data);
		});
	};
	
	this.createPlaylist = function(sid, name, songs, callback ) {
		var body = JSON.stringify({'method': 'createPlaylist', 'wsKey': this.key, 'sessionID': sid,'name': name, songIDs: songs.join(',')});
		this.rawCall(body, function( err, data ){
			console.log('create playlist', err, data);
			callback(err, data);
		});
	}
	
	this.searchSongs = function(sid, query, options, callback ) {
		options = options || {};
		var limit = options.limit || 3,
		    body, query = query.replace(/[^\u0000-\u0080]/g, '');
		body = JSON.stringify({'method':'getSongSearchResultsEx', 'wsKey': this.key, 'sessionID':sid, 'query':query, 'limit': limit});
		this.rawCall(body, callback);
	}
	
    this.searchArtists = function(sid, artist, options, callback) {
        options = options || {};
        var limit = options.limit || 1,
            body, artist;
		artist = artist.replace(/[^\u0000-\u0080]/g, '');
		body = JSON.stringify({'method':'getArtistSearchResults', 'wsKey': this.key, 'sessionID': sid, 'query': artist, limit: limit});
        this.rawCall(body, callback);
    };
    
    this.searchMultiArtists = function( sid, artists, options, callback ) {
        options = options||{};
        var limit = options.limit || 1,
			from    = options.from    || 'getArtistSearchResults',
            capture = options.capture || 'ArtistID',
            results = [],
            counter = c = artists.length,
            body;
        beacon.on('complete', function(data){
            callback(null, data);
        });
        for( var i=0; i < c; i++) {
			var artist = artists[i];
			if( 'number' !== typeof artist ) {
				artist.replace(/[^\u0000-\u0080]/g, '');
			}
			body = JSON.stringify({'method': from, 'wsKey': this.key, 'sessionID': sid, 'query': artist, 'artistID': artist, limit: limit});
            this.rawCall(body, function( err, data ) {
               if( err ) throw new Error( err );
			   if( from === 'getArtistSearchResults' ) {
	               if (data.artists.length > 0) {
	                   results.push(data.artists[0][capture]);
	               }
				} else if( from === 'getArtistInfo' ) {
					results.push(data[capture]);
				}
               if( 0 === --counter ) {
                   beacon.emit('complete', results);
               }
            });
        }
    };
 
    this.rawCall = function( json, callback ){
        if(typeof callback  !== 'function') {
            callback("", null);
        }
        options.headers['Content-Length'] = json.length;
        var req = new http.request(options, function(res){
            var raw='', data;
			if( res.statusCode !== 200 ) {
				callback("We're sorry, but we are having problems at the moment. Please try later", null);
			} else {
	            res.on('data', function(chunk) {
	                raw += chunk;
	            });
	            res.on('end', function() {
					winston.log('info', 'SEND:'+json);
					winston.log('info', 'RECV: '+raw);
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
						winston.log('error', e);
						callback(raw, null);
					}
	            });
			}
        });
        req.write(json+'\n');
        req.end();
    };
	this.username = username;
	this.hmac = hmac;
    this.key = key;
	this.sid = undefined;
	this.timeout = 7200000; // 2 hours... we'll test it.
	this.sidTime = undefined;
    return this;
}

exports.init = function( key, secret, username, hmac ) {
    return new GSAPI(key, secret, username, hmac);
}