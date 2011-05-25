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
    EventEmitter = require('events').EventEmitter,
    beacon = new EventEmitter;

function GSAPI(key, secret, username, hmac) {
    var self = this;
	this.username = username;
	this.hmac = hmac;

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
        var body = JSON.stringify({'method':'startAutoplay', 'wsKey': this.key, 'sessionID':sid, 'artistIDs': artistids, 'songIDs':songids});
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
				callback( err, null);
			}
		});
	};
    
	// Returns autoplayState
	this.addSongToRadio   = function( sid, radio, song, callback ) {
		var cleanSong = {SongID: song.SongID, AlbumID: song.AlbumID, ArtistID: song.ArtistID}
		var body = JSON.stringify({'method': 'addSongToAutoplay', 'wsKey': this.key, 'sessionID': sid, 'autoplayState': radio, 'song': cleanSong });
		this.rawCall(body, function( err, data ) {
			if( err == null ) {
				callback(null, data);
			} else {
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
		var body = JSON.stringify({'method': 'createPlaylist', 'wsKey': this.key, 'sessionID': sid,'name': name, songIDs: songs});
		this.rawCall(body, function( err, data ){
			//console.log('create playlist', err, data);
			callback(err, data);
		});
	}
	
	this.getNextSong = function( sid, radio, callback ) {
		var body = JSON.stringify({'method': 'getAutoplaySong', 'wsKey': this.key, 'sessionID': sid, 'autoplayState': radio} );
		this.rawCall(body, function( err, data ) {
			if( err === null ) {
				callback(null, data);
			} else {
				callback( err, null );
			}
		});
	}
		
	this.upVote = function( sid, radio, song, callback ) {
		var cleanSong = {SongID: song.SongID, AlbumID: song.AlbumID, ArtistID: song.ArtistID},
		    body = 	JSON.stringify({'method': 'voteUpAutoplaySong', 'wsKey': this.key, 'sessionID': sid, 'autoplayState': radio, 'song': cleanSong} );
		this.rawCall(body, callback);
	}
	
	this.downVote = function( sid, radio, song, callback ) {
		var cleanSong = {SongID: song.SongID, AlbumID: song.AlbumID, ArtistID: song.ArtistID},
		    body = 	JSON.stringify({'method': 'voteDownAutoplaySong', 'wsKey': this.key, 'sessionID': sid, 'autoplayState': radio, 'song': cleanSong} );
		this.rawCall(body, callback);
	}
	
	this.removeDownVote = function( sid, radio, song, callback ) {

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
        beacon.once('complete', function(data){
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
 
	this.getMultiGenreRadio = function( sid, genreids, callback ) {
		var tmpgenres = [],
			queue=[], counter;
		
		
		beacon.once('completeGenre', function(aps, cue ) {
			for( var i=0, l=cue.length; i<l;i++) {
				aps.seedArtists[cue[i].song.ArtistID] = 's';
			}
			callback( null, {radio: aps, queue: cue});
        });

		beacon.on('nextGenre', function( radio ) {
			--counter;
			if(counter < 0) {
				beacon.emit('completeGenre', radio, queue );
				beacon.removeAllListeners('nextGenre');
			} else {
				body = JSON.stringify({'method':'startAutoplayTag', 'wsKey': self.key, 'sessionID': sid, 'tagID': genreids[counter]});
				self.rawCall(body, function( err, data ) {
					if(err) {
						console.log(err);
						counter++;
					} else {
						if( typeof radio === 'undefined' ) {
							self.getSimilarSong( sid, [data.nextSong.ArtistID], [data.nextSong.SongID], function( err, r ) {
								queue.push({songid: r.nextSong.SongID, userid: -1, song:r.nextSong});
								beacon.emit( 'nextGenre', r.autoplayState );
							});
						} else {
							queue.push({songid: data.nextSong.SongID, userid: -1, song: data.nextSong});
							self.addSongToRadio( sid, radio, data.nextSong, function( err, r ) {
								beacon.emit( 'nextGenre', r );
							});
						}
					}
				});
			}
		});
		
		if( genreids.length < 5 ) {	
			for( var i=0; i < 5; i++ ) 
				tmpgenres.push(genreids[Math.floor(Math.random()*genreids.length)]);
			genreids = tmpgenres;
		}
		counter = genreids.length;
		beacon.emit( 'nextGenre' );
	}

	this.getMultiArtistRadio = function( sid, artistids, callback ) {
		var tmpartists = [], 
		    tmpsongs = [],
			queue=[], counter, body, radio;
		
		
		beacon.once('completeArtists', function(aps, cue ) {
			for( var i=0, l=cue.length; i<l;i++) {
				aps.seedArtists[cue[i].song.ArtistID] = 's';
			}
			callback( null, {radio: aps, queue: cue});
        });

		beacon.on('nextArtist', function( radio ) {
			--counter;
			if(counter < 0) {
				if(queue.length < 5 ) {
					counter = artistids.length-queue.length;
					beacon.emit('nextArtist', radio);
				} else {
					beacon.emit('completeArtists', radio, queue );
					beacon.removeAllListeners('nextArtist');
				}
			} else {
				if( artistids[counter] === undefined ) {
					console.log('Running backup theory');
					self.getSimilarSong( sid, artistids, tmpsongs, function( err, r ) {
						queue.push({songid: r.nextSong.SongID, userid: -1, song: r.nextSong});
						beacon.emit( 'nextArtist', r.autoplayState );
					});
				} else {
					console.log('Main loop');
					body = JSON.stringify({'method':'getArtistAlbums', 'wsKey': self.key, 'sessionID': sid, 'artistID': artistids[counter]});
					self.rawCall(body, function( err, data ) {
						if(err) {
							//console.log(err);
						} else {
							album = data[0].albums[Math.floor(Math.random()*data[0].albums.length)];
							body = JSON.stringify({'method':'getAlbumSongsEx', 'wsKey': self.key, 'sessionID': sid, 'albumID': data[0].albums[Math.floor(Math.random()*data[0].albums.length)].AlbumID});
							self.rawCall(body, function( err, songs ) {
								if( err || ! songs ) {
									callback('We are having problems talking to the music server', null);
								} else {	
									if(songs.songs.length !== 0 ) {
										//console.log('SONGS VALUE', songs);
										song = songs.songs[Math.floor(Math.random()*songs.songs.length)];
										//console.log('SONG VALUE', song);
										if( typeof(song) !== 'undefined' ) {
											if( typeof radio === 'undefined') {
												console.log('Setup the radio');
												self.getSimilarSong( sid, [song.ArtistID], [song.SongID], function( err, r ) {
													tmpsongs.push({SongID: r.nextSong.SongID, AlbumID: r.nextSong.AlbumID, ArtistID: r.nextSong.ArtistID});
													queue.push({songid: r.nextSong.SongID, userid: -1, song: r.nextSong});
													beacon.emit( 'nextArtist', r.autoplayState );
												});
											} else {
												console.log('Populate the radio');
												tmpsongs.push({SongID: song.SongID, AlbumID: song.AlbumID, ArtistID: song.ArtistID});
												queue.push({songid: song.SongID, userid: -1, song: song});
												self.addSongToRadio( sid, radio, song, function (err, r) {
													beacon.emit( 'nextArtist', r );
												});
											}
										}
									} else {
										beacon.emit('nextArtist', radio);
									}
								}
							});
						}
					});
				}
			}
		});
		
		if( artistids.length < 5 ) {
			if( artistids.length > 3 ) {
				for( var i=0; i < 5; i++ ) 
					tmpartists.push(artistids[Math.floor(Math.random()*artistids.length)]);
				artistids = tmpartists;
			} else {
				for( var i=0; i < 5; i++ )
					tmpartists.push(artistids[i]);
				artistids = tmpartists;
			}
			console.log(artistids, 'counter', artistids.length);
		}
		counter = artistids.length;
		beacon.emit( 'nextArtist', radio );
	}
    this.rawCall = function( json, callback ){
		//console.log('DEBUG SEND:', json);
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
					try {
						//console.log('DEBUG RECV:', raw);
		                data = JSON.parse(raw);
		                if(data.errors === undefined) {
		                    if(data.result.sessionID === undefined ) {
		                        callback(null, data.result);
		                    } else {
		                        callback(null, data.result.sessionID);
		                    }
		                } else {
							console.log(data.errors);
		                    callback(data.err, null);
		                }
					} catch(e) {
						console.log(e.message);
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